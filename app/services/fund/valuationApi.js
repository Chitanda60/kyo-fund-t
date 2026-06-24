import { isArray, isNumber, isObject } from 'lodash';
import * as qk from '../../lib/query-keys';
import { withRetry } from '../../lib/asyncHelper';
import { getQueryClient } from '../../lib/get-query-client';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { storageStore } from '../../stores';
import { ONE_DAY_MS } from '@/app/constants';
import {
  getNetValueStaleTime,
  loadScript,
  fundDebugLog,
  computeYesterdayNavMetricsFromList,
  parseNetValuesFromLsjzContent
} from './shared';
import { searchFunds } from './searchApi';

export const fetchFundDataFallback = async (c) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('无浏览器环境');
  }
  return new Promise(async (resolve, reject) => {
    try {
      // 尝试并行获取 F10 数据和通过搜索接口获取基金名称
      const f10Promise = (async () => {
        const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${c}&page=1&per=3&sdate=&edate=`;
        const apidata = await loadScript(url);
        const content = apidata?.content || '';
        const navList = parseNetValuesFromLsjzContent(content);
        const latest = navList.length > 0 ? navList[navList.length - 1] : null;
        const previousNav = navList.length > 1 ? navList[navList.length - 2] : null;
        const yM = computeYesterdayNavMetricsFromList(navList);
        return { latest, previousNav, yM };
      })();

      const namePromise = (async () => {
        try {
          // 通过搜索接口查询该代码对应的基金详情
          const results = await searchFunds(c);
          const found = results.find((item) => item.CODE === c);
          return found ? found.NAME || found.SHORTNAME : null;
        } catch (e) {
          return null;
        }
      })();

      const [navResult, fundName] = await Promise.all([f10Promise, namePromise]);

      if (navResult && navResult.latest && navResult.latest.nav) {
        const { latest, previousNav, yM } = navResult;
        resolve({
          code: c,
          name: fundName || `基金(${c})`,
          dwjz: String(latest.nav),
          lastNav: previousNav ? String(previousNav.nav) : null,
          gsz: null,
          gztime: null,
          jzrq: latest.date,
          gszzl: null,
          zzl: Number.isFinite(latest.growth) ? latest.growth : null,
          yesterdayZzl: yM.yesterdayZzl,
          yesterdayNavDelta: yM.yesterdayNavDelta,
          noValuation: true,
          valuationSource: 'fallback',
          holdings: [],
          holdingsReportDate: null,
          holdingsIsLastQuarter: false
        });
      } else {
        reject(new Error('未能获取到基金数据'));
      }
    } catch (e) {
      reject(new Error('基金数据加载失败'));
    }
  });
};

// fundgz JSONP 固定回调名为 window.jsonpgz；这里做成“常驻分发器”以支持并发请求，避免覆盖全局回调导致串数据/悬挂。
const JSONPGZ_DISPATCHER_KEY = '__rtf_jsonpgz_dispatcher_v1__';

function ensureJsonpgzDispatcher() {
  if (typeof window === 'undefined') return null;
  if (window[JSONPGZ_DISPATCHER_KEY]) return window[JSONPGZ_DISPATCHER_KEY];

  const previous = typeof window.jsonpgz === 'function' ? window.jsonpgz : null;
  const pendingByCode = new Map(); // code -> Set(entry)

  const dispatcher = (json) => {
    try {
      if (!json || !isObject(json)) {
        fundDebugLog('jsonpgz called with invalid payload', json);
        // 部分情况下接口会回调 jsonpgz() 但不给参数（undefined）。
        // 若当前只有 1 个 pending，可视为该请求失败信号，直接触发其 fallback，避免一直等到超时。
        if (pendingByCode.size === 1) {
          const onlyKey = Array.from(pendingByCode.keys())[0];
          const set = pendingByCode.get(onlyKey);
          if (set && set.size > 0) {
            fundDebugLog('jsonpgz invalid payload -> fail single pending', { fundcode: onlyKey, listeners: set.size });
            pendingByCode.delete(onlyKey);
            for (const entry of set) {
              try {
                entry?.cleanup?.();
              } catch (e) {}
              try {
                entry?.onError?.(new Error('jsonpgz invalid payload'));
              } catch (e) {}
            }
            return;
          }
        }
        if (previous) previous(json);
        return;
      }
      const code = json.fundcode != null ? String(json.fundcode).trim() : '';
      const set = code ? pendingByCode.get(code) : null;
      if (!set || set.size === 0) {
        fundDebugLog('jsonpgz no pending match', { fundcode: code, pendingKeys: Array.from(pendingByCode.keys()) });
        if (previous) previous(json);
        return;
      }

      fundDebugLog('jsonpgz dispatch', { fundcode: code, listeners: set.size });
      pendingByCode.delete(code);
      for (const entry of set) {
        try {
          entry?.cleanup?.();
        } catch (e) {}
        try {
          entry?.onJson?.(json);
        } catch (e) {
          try {
            entry?.onError?.(e);
          } catch (e2) {}
        }
      }
    } catch (e) {
      if (previous) previous(json);
    }
  };

  const api = {
    add(code, entry) {
      const k = code != null ? String(code).trim() : '';
      if (!k) return () => {};
      let set = pendingByCode.get(k);
      if (!set) {
        set = new Set();
        pendingByCode.set(k, set);
      }
      set.add(entry);
      fundDebugLog('jsonpgz add pending', { fundcode: k, pendingCount: set.size });
      return () => {
        const cur = pendingByCode.get(k);
        if (!cur) return;
        cur.delete(entry);
        if (cur.size === 0) pendingByCode.delete(k);
        fundDebugLog('jsonpgz remove pending', { fundcode: k, remaining: cur.size });
      };
    },
    previous
  };

  window.jsonpgz = dispatcher;
  window[JSONPGZ_DISPATCHER_KEY] = api;
  fundDebugLog('jsonpgz dispatcher installed', { hadPrevious: Boolean(previous) });
  return api;
}

/** 同一基金代码并发的新浪估值 JSONP 去重，避免数据源 2/3 各打一遍 */
const sinaEstimateNetworthInflight = new Map();

function normalizeValuationDataSource(dataSource) {
  const n = Number(dataSource);
  if (n === 2) return 2;
  if (n === 3) return 3;
  return 1;
}

/**
 * 新浪 FdFundService.getEstimateNetworthPic 原始响应（含 networth 序列）
 * @param {string} code
 * @returns {Promise<object|null>}
 */
function fetchSinaEstimateNetworthResponse(code) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('无浏览器环境'));
  }
  const c = code != null ? String(code).trim() : '';
  if (!c) return Promise.reject(new Error('基金编码无效'));

  const existing = sinaEstimateNetworthInflight.get(c);
  if (existing) return existing;

  const p = new Promise((resolve, reject) => {
    fundDebugLog('fetchSinaEstimateNetworth start', { code: c });
    const callbackName = `jsonp_sina_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const url = `https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FdFundService.getEstimateNetworthPic?symbol=${c}&callback=${callbackName}`;

    const scriptSina = document.createElement('script');
    let timer;

    const cleanupScript = () => {
      if (timer) clearTimeout(timer);
      try {
        delete window[callbackName];
      } catch (e) {}
      if (document.body && document.body.contains(scriptSina)) {
        document.body.removeChild(scriptSina);
      }
    };

    window[callbackName] = (res) => {
      cleanupScript();
      resolve(res);
    };

    timer = setTimeout(() => {
      cleanupScript();
      resolve(null);
    }, 10000);

    scriptSina.src = url;
    scriptSina.async = true;
    scriptSina.onerror = () => {
      cleanupScript();
      reject(new Error('sina script error'));
    };
    document.body.appendChild(scriptSina);
  }).finally(() => {
    sinaEstimateNetworthInflight.delete(c);
  });

  sinaEstimateNetworthInflight.set(c, p);
  return p;
}

/**
 * 统一估值结构（仅估值相关字段）
 * @typedef {object} UnifiedFundValuation
 * @property {string} code
 * @property {number | null} gsz - 估算净值
 * @property {string | null} gztime - 估值时间
 * @property {number | null} gszzl - 估算涨跌幅（百分比数值，如 1.23 表示 +1.23%）
 * @property {string} valuationSource - 如 fundgz、sina_ds2、sina_ds3
 */

/**
 * 从 Supabase gs_qdii 表获取 QDII 基金的估值数据（作为天天基金数据源 1 的 fallback）
 */
export const fetchQdiiValuationFromSupabase = async (code) => {
  if (!code || !isSupabaseConfigured) return null;
  const normalized = String(code).trim();
  if (!normalized) return null;

  try {
    const { data, error } = await withRetry(() =>
      supabase.from('gs_qdii').select('gztime, gszzl, gzstatus').eq('fund_code', normalized).maybeSingle()
    );

    if (error || !data) return null;

    // gszzl 在表中是 real，通常为百分比数值（如 1.23 表示 1.23%）
    return {
      gztime: data.gztime != null ? String(data.gztime).replace(/:(\d{2}):\d{2}$/, ':$1') : null,
      gszzl: data.gszzl != null && Number.isFinite(Number(data.gszzl)) ? Number(data.gszzl) : null,
      valuationSource: 'supabase_qdii',
      gzstatus: data.gzstatus
    };
  } catch (e) {
    return null;
  }
};

/**
 * 通过 Edge Function best-valuation-source 查询指定日期各数据源估值，
 * 与实际涨跌幅比对，返回最准确的数据源编号。
 *
 * @param {string} code - 基金代码
 * @param {string} jzrq - 最新净值日期（如 "2026-06-10"）
 * @param {number} actualZzl - 实际涨跌幅（百分比，如 1.23 表示 +1.23%）
 * @returns {Promise<{ bestSource: number|null, isYesterdayAccuracy: boolean, isTodayAccuracy: boolean, diffs: Object<string,number>, diff?: number }|null>}
 */
export async function fetchBestValuationSource(code, jzrq, actualZzl) {
  if (!isSupabaseConfigured || !supabase?.functions?.invoke) return null;
  const c = code != null ? String(code).trim() : '';
  if (!c || !jzrq || !isNumber(actualZzl) || !Number.isFinite(actualZzl)) return null;

  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('best-valuation-source', {
        body: { code: c, jzrq, actualZzl }
      })
    );

    if (error || !data?.success) return null;
    return data.data || null;
  } catch (e) {
    return null;
  }
}

/**
 * 按基金编码与数据源类型获取估值（天天基金 fundgz 或新浪估算曲线末点）。
 * @param {string} code - 基金编码
 * @param {number | string} [dataSource=1] - 1 天天基金；2、3 新浪估算不同口径
 * @returns {Promise<UnifiedFundValuation>}
 */
export async function fetchFundValuationBySource(code, dataSource = 1) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('无浏览器环境');
  }
  const c = code != null ? String(code).trim() : '';
  if (!c) throw new Error('基金编码无效');

  const ds = normalizeValuationDataSource(dataSource);

  if (ds === 2 || ds === 3) {
    fundDebugLog('fetchFundValuationBySource sina', { code: c, dataSource: ds });
    const res = await fetchSinaEstimateNetworthResponse(c);
    if (!res?.result?.data?.networth || !isArray(res.result.data.networth) || res.result.data.networth.length === 0) {
      throw new Error('sina no data');
    }
    const networth = res.result.data.networth;
    const lastPoint = networth[networth.length - 1];
    const gRate = ds === 2 ? parseFloat(lastPoint.growthrate) : parseFloat(lastPoint.growthrate2);
    const preNav = ds === 2 ? parseFloat(lastPoint.pre_nav) : parseFloat(lastPoint.pre_nav2);
    const gsz = Number.isFinite(preNav) ? preNav : null;
    const gszzl = Number.isFinite(gRate) ? gRate * 100 : null;
    if (gsz == null && gszzl == null) {
      throw new Error('sina empty point');
    }

    // 构建分时估值序列，格式与 fundValuationTimeseries 一致
    const navKey = ds === 2 ? 'pre_nav' : 'pre_nav2';
    const timeseries = [];
    const seen = new Set();
    for (const point of networth) {
      const value = parseFloat(point[navKey]);
      if (!Number.isFinite(value)) continue;
      const time = point.min_time || null;
      const date = point.pre_date || null;
      if (!time || !date) continue;
      const key = `${date} ${time}`;
      if (seen.has(key)) continue;
      seen.add(key);
      timeseries.push({ time, value, date });
    }

    return {
      code: c,
      gsz,
      gztime: lastPoint.min_time
        ? `${lastPoint.pre_date} ${lastPoint.min_time}`.replace(/:(\d{2}):\d{2}$/, ':$1')
        : null,
      gszzl,
      valuationSource: `sina_ds${ds}`,
      fundValuationTimeseries: { [c]: timeseries }
    };
  }

  const dispatcher = ensureJsonpgzDispatcher();
  if (!dispatcher) throw new Error('无浏览器环境');

  fundDebugLog('fetchFundValuationBySource fundgz', { code: c });
  const gzUrl = `https://fundgz.1234567.com.cn/js/${c}.js?rt=${Date.now()}`;

  return new Promise((resolve, reject) => {
    let settled = false;
    const settleOnce = (fn) => (arg) => {
      if (settled) return;
      settled = true;
      fn(arg);
    };
    const safeResolve = settleOnce(resolve);
    const safeReject = settleOnce(reject);

    const trySupabaseFallback = async (originalError) => {
      fundDebugLog('fetchFundValuationBySource try supabase fallback', { code: c });
      const qdii = await fetchQdiiValuationFromSupabase(c);
      if (qdii) {
        safeResolve({
          code: c,
          ...qdii,
          gsz: null // 由 fetchFundData 等调用方配合 dwjz 计算
        });
      } else {
        safeReject(originalError || new Error('gz failed and no qdii fallback'));
      }
    };

    const scriptGz = document.createElement('script');
    scriptGz.src = gzUrl;
    scriptGz.async = true;

    const cleanupScript = () => {
      try {
        if (timer) clearTimeout(timer);
      } catch (e) {}
      try {
        if (document.body && document.body.contains(scriptGz)) document.body.removeChild(scriptGz);
      } catch (e) {}
      try {
        if (removePending) removePending();
      } catch (e) {}
    };

    const onTimeout = () => {
      fundDebugLog('fetchFundValuationBySource gz timeout', { code: c, timeoutMs: 8000 });
      cleanupScript();
      trySupabaseFallback(new Error('gz timeout'));
    };

    const timer = setTimeout(onTimeout, 5000);

    let removePending = null;
    removePending = dispatcher.add(c, {
      cleanup: cleanupScript,
      onJson: (json) => {
        fundDebugLog('fetchFundValuationBySource jsonpgz', { code: c, fundcode: json?.fundcode });
        cleanupScript();

        if (!json || !isObject(json)) {
          trySupabaseFallback(new Error('invalid json'));
          return;
        }

        const gszzlNum = Number(json.gszzl);
        const gszNum = Number(json.gsz);
        safeResolve({
          code: json.fundcode != null ? String(json.fundcode).trim() : c,
          gsz: Number.isFinite(gszNum) ? gszNum : json.gsz,
          gztime: json.gztime != null ? String(json.gztime).replace(/:(\d{2}):\d{2}$/, ':$1') : null,
          gszzl: Number.isFinite(gszzlNum) ? gszzlNum : json.gszzl,
          valuationSource: 'fundgz'
        });
      },
      onError: (e) => {
        cleanupScript();
        trySupabaseFallback(e || new Error('gz error callback'));
      }
    });

    scriptGz.onerror = () => {
      fundDebugLog('fetchFundValuationBySource gz script error', { code: c, url: gzUrl });
      cleanupScript();
      trySupabaseFallback(new Error('gz script error'));
    };

    document.body.appendChild(scriptGz);
  });
}

/**
 * 获取基金申赎确认天数（SSBCFMDATA）
 * 通过天天基金移动端 API FundMNBaseInfo 获取。
 * - 返回 1 表示 T+1 确认（普通 A 股基金）
 * - 返回 2 表示 T+2 确认（QDII 等跨境基金）
 * - 返回 null 表示获取失败
 *
 * 结果通过 TanStack Query 缓存 24 小时（此属性极少变动）。
 * @param {string} code - 基金代码
 * @returns {Promise<number|null>}
 */
export const fetchFundConfirmDays = async (code) => {
  const c = code != null ? String(code).trim() : '';
  if (!c) return null;

  const qc = getQueryClient();
  try {
    return await qc.fetchQuery({
      queryKey: qk.fundConfirmDays(c),
      queryFn: async () => {
        const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNBaseInfo?FCODE=${c}&plat=Android&appType=ttjj&product=EFund&Version=1&deviceid=rtf${Date.now()}`;
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const json = await resp.json();
        if (!json || !json.Success || !json.Datas) return null;
        const raw = json.Datas.SSBCFMDATA;
        const num = Number(raw);
        return Number.isFinite(num) && num > 0 ? num : null;
      },
      staleTime: ONE_DAY_MS
    });
  } catch (e) {
    return null;
  }
};

export const fetchFundData = async (c, overrideDataSource) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('无浏览器环境');
  }

  const code = c != null ? String(c).trim() : '';
  if (!code) return fetchFundDataFallback(c);

  let dataSource = overrideDataSource || 1;
  let storedName = null;
  let storedValuationSource = null;
  if (!overrideDataSource) {
    try {
      const arr = storageStore.getItem('funds', []);
      if (isArray(arr)) {
        const f = arr.find((x) => x.code === code);
        if (f) {
          if (f.dataSource) dataSource = f.dataSource;
          if (f.name) storedName = f.name;
          if (f.valuationSource) storedValuationSource = f.valuationSource;
        }
      }
    } catch (e) {}
  }

  // 1. 发起并发的历史净值和重仓请求
  const lsjzPromise = new Promise((resolveT) => {
    const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=1&per=3&sdate=&edate=`;
    loadScript(url, { staleTime: getNetValueStaleTime() })
      .then((apidata) => {
        const content = apidata?.content || '';
        const navList = parseNetValuesFromLsjzContent(content);
        if (navList.length > 0) {
          const latest = navList[navList.length - 1];
          const previousNav = navList.length > 1 ? navList[navList.length - 2] : null;
          const yM = computeYesterdayNavMetricsFromList(navList);
          resolveT({
            dwjz: String(latest.nav),
            zzl: Number.isFinite(latest.growth) ? latest.growth : null,
            jzrq: latest.date,
            lastNav: previousNav ? String(previousNav.nav) : null,
            yesterdayZzl: yM.yesterdayZzl,
            yesterdayNavDelta: yM.yesterdayNavDelta
          });
        } else {
          resolveT(null);
        }
      })
      .catch(() => resolveT(null));
  });

  // 2. 发起估值请求
  // 对于已知 valuationSource 为 supabase_qdii 的基金（dataSource=1），直接走 Supabase 查询，
  // 避免 fundgz JSONP 对 QDII 基金无响应导致等待超时
  const gzPromise =
    storedValuationSource === 'supabase_qdii' && normalizeValuationDataSource(dataSource) === 1
      ? fetchQdiiValuationFromSupabase(code).then((qdii) => {
          if (qdii) return { code, ...qdii, gsz: null };
          // Supabase 无数据时回退到常规流程
          return fetchFundValuationBySource(code, dataSource);
        })
      : fetchFundValuationBySource(code, dataSource);

  // 3. 编排并合并数据
  return new Promise(async (resolve, reject) => {
    let baseData = null;
    try {
      baseData = await gzPromise;
    } catch (e) {
      try {
        baseData = await fetchFundDataFallback(code);
      } catch (fbErr) {
        reject(fbErr);
        return;
      }
    }

    const [tData] = await Promise.all([lsjzPromise]);

    if (tData) {
      if (tData.jzrq && (!baseData.jzrq || tData.jzrq >= baseData.jzrq)) {
        baseData.dwjz = tData.dwjz;
        baseData.jzrq = tData.jzrq;
        baseData.zzl = tData.zzl;
        baseData.lastNav = tData.lastNav;
      } else if (!baseData.dwjz && tData.dwjz) {
        // Fallback for Sina which doesn't provide dwjz/jzrq
        baseData.dwjz = tData.dwjz;
        baseData.jzrq = tData.jzrq;
        baseData.zzl = tData.zzl;
        baseData.lastNav = tData.lastNav;
      }
      if (Object.prototype.hasOwnProperty.call(tData, 'yesterdayZzl')) {
        baseData.yesterdayZzl = tData.yesterdayZzl;
      }
      if (Object.prototype.hasOwnProperty.call(tData, 'yesterdayNavDelta')) {
        baseData.yesterdayNavDelta = tData.yesterdayNavDelta;
      }
    }

    // 针对 supabase_qdii 等仅提供 gszzl 的数据源，使用最新的 dwjz 计算 gsz
    if (baseData.valuationSource === 'supabase_qdii' || (baseData.gsz == null && baseData.gszzl != null)) {
      const nav = Number(baseData.dwjz);
      const gszzl = Number(baseData.gszzl);
      if (Number.isFinite(nav) && Number.isFinite(gszzl)) {
        baseData.gsz = nav * (1 + gszzl / 100);
      }
    }

    if (!baseData.name) {
      // 优先使用 localStorage 中已存储的基金名称，避免不必要的 searchFunds 网络请求
      if (storedName) {
        baseData.name = storedName;
      } else {
        try {
          const results = await searchFunds(code);
          const found = results.find((item) => item.CODE === code);
          if (found) baseData.name = found.NAME || found.SHORTNAME;
        } catch (e) {}
      }
    }

    resolve({
      ...baseData
    });
  });
};
