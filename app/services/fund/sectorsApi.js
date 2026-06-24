import { isArray } from 'lodash';
import * as qk from '../../lib/query-keys';
import { withRetry } from '../../lib/asyncHelper';
import { getQueryClient } from '../../lib/get-query-client';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { ONE_DAY_MS } from '@/app/constants';

// ============================================================================
// fund_related & fund_secid 批量微任务合并与防抖去重合并加载器 (DataLoader Pattern)
// ============================================================================

// 1. fund_related 缓存和队列
const relatedSectorsInflight = new Map(); // key = "code|seg" -> { promise, resolve }
const relatedSectorsQueue = new Map(); // key = seg -> Set(code)
let relatedSectorsTimeout = null;

// 2. fund_secid 缓存和队列
const fundSecidsInflight = new Map(); // key = label -> { promise, resolve }
const fundSecidsQueue = new Set(); // Set(label)
let fundSecidsTimeout = null;

const processRelatedSectorsQueue = async () => {
  if (relatedSectorsQueue.size === 0) return;

  const currentQueues = new Map(relatedSectorsQueue);
  relatedSectorsQueue.clear();
  relatedSectorsTimeout = null;

  for (const [seg, codesSet] of currentQueues.entries()) {
    const missingCodes = Array.from(codesSet);
    if (missingCodes.length === 0) continue;

    try {
      const { data, error } = await withRetry(() =>
        supabase.from('fund_related').select('fund_code, related_sector').in('fund_code', missingCodes)
      );

      if (error) throw error;

      const foundMap = new Map();
      if (isArray(data)) {
        data.forEach((item) => {
          const c = String(item.fund_code).trim();
          const v = item.related_sector != null ? String(item.related_sector).trim() : '';
          foundMap.set(c, v);
        });
      }

      const qc = getQueryClient();
      for (const code of missingCodes) {
        const value = foundMap.get(code) || '';
        qc.setQueryData(qk.relatedSectors(code, seg), value, { staleTime: ONE_DAY_MS });

        const key = `${code}|${seg}`;
        const resolver = relatedSectorsInflight.get(key);
        if (resolver) {
          resolver.resolve(value);
          relatedSectorsInflight.delete(key);
        }
      }
    } catch (e) {
      for (const code of missingCodes) {
        const key = `${code}|${seg}`;
        const resolver = relatedSectorsInflight.get(key);
        if (resolver) {
          resolver.resolve('');
          relatedSectorsInflight.delete(key);
        }
      }
    }
  }
};

const processFundSecidsQueue = async () => {
  if (fundSecidsQueue.size === 0) return;

  const missingLabels = Array.from(fundSecidsQueue);
  fundSecidsQueue.clear();
  fundSecidsTimeout = null;

  try {
    const { data, error } = await withRetry(() =>
      supabase.from('fund_secid').select('related_sector, secid').in('related_sector', missingLabels)
    );

    if (error) throw error;

    const foundMap = new Map();
    if (isArray(data)) {
      data.forEach((item) => {
        const l = String(item.related_sector).trim();
        const s = item.secid != null ? String(item.secid).trim() : '';
        foundMap.set(l, s);
      });
    }

    const qc = getQueryClient();
    for (const label of missingLabels) {
      const value = foundMap.get(label) || '';
      qc.setQueryData(qk.fundSecid(label), value, { staleTime: ONE_DAY_MS });

      const resolver = fundSecidsInflight.get(label);
      if (resolver) {
        resolver.resolve(value);
        fundSecidsInflight.delete(label);
      }
    }
  } catch (e) {
    for (const label of missingLabels) {
      const resolver = fundSecidsInflight.get(label);
      if (resolver) {
        resolver.resolve('');
        fundSecidsInflight.delete(label);
      }
    }
  }
};

/**
 * 批量获取基金「关联板块」
 * @param {string[]} codes
 */
export const fetchRelatedSectorsBatch = async (codes, { cacheTime = ONE_DAY_MS, authSegment = 'anon' } = {}) => {
  if (!isArray(codes) || codes.length === 0) return {};
  if (!isSupabaseConfigured) return {};

  const seg = authSegment != null && authSegment !== '' ? String(authSegment) : 'anon';
  const qc = getQueryClient();
  const results = {};

  const promisesToWait = [];

  for (const c of codes) {
    const normalized = String(c).trim();
    if (!normalized) continue;

    // 优先从 React Query 同步缓存中取
    const cached = qc.getQueryData(qk.relatedSectors(normalized, seg));
    if (cached !== undefined) {
      results[normalized] = cached;
      continue;
    }

    const inflightKey = `${normalized}|${seg}`;
    if (relatedSectorsInflight.has(inflightKey)) {
      // 存在正在处理的相同请求，直接复用它的 Promise
      promisesToWait.push(
        relatedSectorsInflight.get(inflightKey).promise.then((val) => {
          results[normalized] = val;
        })
      );
    } else {
      // 新增一个微任务合并的 Promise
      let resolveFn;
      const promise = new Promise((resolve) => {
        resolveFn = resolve;
      });
      relatedSectorsInflight.set(inflightKey, { promise, resolve: resolveFn });

      if (!relatedSectorsQueue.has(seg)) {
        relatedSectorsQueue.set(seg, new Set());
      }
      relatedSectorsQueue.get(seg).add(normalized);

      promisesToWait.push(
        promise.then((val) => {
          results[normalized] = val;
        })
      );
    }
  }

  // 触发微任务级别的合并批量查询
  if (relatedSectorsQueue.size > 0 && !relatedSectorsTimeout) {
    relatedSectorsTimeout = setTimeout(processRelatedSectorsQueue, 0);
  }

  if (promisesToWait.length > 0) {
    await Promise.all(promisesToWait);
  }

  return results;
};

const SECTOR_QUOTE_CACHE_MS = 60 * 1000;

/**
 * 批量获取板块 secid
 * @param {string[]} labels
 */
export const fetchFundSecidsBatch = async (labels, { cacheTime = ONE_DAY_MS } = {}) => {
  if (!isArray(labels) || labels.length === 0) return {};
  if (!isSupabaseConfigured) return {};

  const qc = getQueryClient();
  const results = {};

  const promisesToWait = [];

  for (const label of labels) {
    const normalized = String(label).trim();
    if (!normalized) continue;

    // 优先从 React Query 同步缓存中取
    const cached = qc.getQueryData(qk.fundSecid(normalized));
    if (cached !== undefined) {
      results[normalized] = cached;
      continue;
    }

    if (fundSecidsInflight.has(normalized)) {
      // 存在正在处理的相同请求，直接复用它的 Promise
      promisesToWait.push(
        fundSecidsInflight.get(normalized).promise.then((val) => {
          results[normalized] = val;
        })
      );
    } else {
      // 新增一个微任务合并的 Promise
      let resolveFn;
      const promise = new Promise((resolve) => {
        resolveFn = resolve;
      });
      fundSecidsInflight.set(normalized, { promise, resolve: resolveFn });

      fundSecidsQueue.add(normalized);

      promisesToWait.push(
        promise.then((val) => {
          results[normalized] = val;
        })
      );
    }
  }

  // 触发微任务级别的合并批量查询
  if (fundSecidsQueue.size > 0 && !fundSecidsTimeout) {
    fundSecidsTimeout = setTimeout(processFundSecidsQueue, 0);
  }

  if (promisesToWait.length > 0) {
    await Promise.all(promisesToWait);
  }

  return results;
};

/**
 * 批量获取东方财富板块/指数行情（单次请求）
 * @param {string[]} secids
 * @returns {Promise<Record<string, { name: string, code: string, pct: number|null }|null>>}
 */
export const fetchEastmoneySectorQuotesBatch = async (secids, { cacheTime = SECTOR_QUOTE_CACHE_MS } = {}) => {
  if (!isArray(secids) || secids.length === 0) return {};
  if (typeof fetch === 'undefined') return {};

  const qc = getQueryClient();
  const results = {};
  const missingSecids = [];

  for (const secid of secids) {
    const s = secid != null ? String(secid).trim() : '';
    if (!s) continue;
    const cached = qc.getQueryData(qk.eastSectorQuote(s));
    if (cached !== undefined) {
      results[s] = cached;
    } else {
      missingSecids.push(s);
    }
  }

  if (missingSecids.length === 0) return results;

  const chunkSize = 20;
  const chunks = [];
  for (let i = 0; i < missingSecids.length; i += chunkSize) {
    chunks.push(missingSecids.slice(i, i + chunkSize));
  }

  try {
    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const url = `https://push2delay.eastmoney.com/api/qt/ulist.np/get?fields=f12,f13,f14,f3&secids=${encodeURIComponent(chunk.join(','))}`;
          const res = await fetch(url);
          if (!res.ok) return;
          const json = await res.json();
          const diff = json?.data?.diff;
          if (!isArray(diff)) return;

          for (const item of diff) {
            const code = item.f12 != null ? String(item.f12) : '';
            const market = item.f13 != null ? String(item.f13) : '';
            const key = market && code ? `${market}.${code}` : '';
            if (!key) continue;

            const f3 = item.f3;
            const pct = f3 != null && Number.isFinite(Number(f3)) ? Number(f3) / 100 : null;
            const quote = {
              name: item.f14 != null ? String(item.f14) : '',
              code,
              pct
            };

            results[key] = quote;
            qc.setQueryData(qk.eastSectorQuote(key), quote, { staleTime: cacheTime });
          }
        } catch (e) {
          console.error('Fetch sector quotes batch chunk error:', e);
        }
      })
    );

    for (const s of missingSecids) {
      if (results[s] === undefined) {
        results[s] = null;
        qc.setQueryData(qk.eastSectorQuote(s), null, { staleTime: cacheTime });
      }
    }
  } catch (e) {
    for (const s of missingSecids) {
      if (results[s] === undefined) results[s] = null;
    }
  }

  return results;
};
