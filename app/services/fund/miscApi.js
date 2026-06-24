import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { isArray, isNumber } from 'lodash';
import * as qk from '../../lib/query-keys';
import { withRetry } from '../../lib/asyncHelper';
import { getQueryClient } from '../../lib/get-query-client';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { TZ, nowInTz } from './shared';

dayjs.extend(utc);
dayjs.extend(timezone);

export const fetchLatestRelease = async () => {
  const url = process.env.NEXT_PUBLIC_GITHUB_LATEST_RELEASE_URL;
  if (!url) return null;

  try {
    const data = await withRetry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      },
      2,
      500
    );

    if (!data || !data.tag_name) return null;

    return {
      tagName: data.tag_name,
      body: data.body || ''
    };
  } catch (err) {
    console.error('fetchLatestRelease failed after retries:', err);
    return null;
  }
};

export const submitFeedback = async (formData) => {
  const response = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    body: formData
  });
  return response.json();
};

const PINGZHONGDATA_GLOBAL_KEYS = [
  'ishb',
  'fS_name',
  'fS_code',
  'fund_sourceRate',
  'fund_Rate',
  'fund_minsg',
  'stockCodes',
  'zqCodes',
  'stockCodesNew',
  'zqCodesNew',
  'syl_1n',
  'syl_6y',
  'syl_3y',
  'syl_1y',
  'Data_fundSharesPositions',
  'Data_netWorthTrend',
  'Data_ACWorthTrend',
  'Data_grandTotal',
  'Data_rateInSimilarType',
  'Data_rateInSimilarPersent',
  'Data_fluctuationScale',
  'Data_holderStructure',
  'Data_assetAllocation',
  'Data_performanceEvaluation',
  'Data_currentFundManager',
  'Data_buySedemption',
  'swithSameType'
];

let pingzhongdataQueue = Promise.resolve();

const enqueuePingzhongdataLoad = (fn) => {
  const p = pingzhongdataQueue.then(fn, fn);
  // 避免队列被 reject 永久阻塞
  pingzhongdataQueue = p.catch(() => undefined);
  return p;
};

const snapshotPingzhongdataGlobals = (fundCode) => {
  const out = {};
  for (const k of PINGZHONGDATA_GLOBAL_KEYS) {
    if (typeof window?.[k] === 'undefined') continue;
    try {
      out[k] = JSON.parse(JSON.stringify(window[k]));
    } catch (e) {
      out[k] = window[k];
    }
  }

  return {
    fundCode: out.fS_code || fundCode,
    fundName: out.fS_name || '',
    ...out
  };
};

const jsonpLoadPingzhongdata = (fundCode, timeoutMs = 20000) => {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined' || !document.body) {
      reject(new Error('无浏览器环境'));
      return;
    }

    const url = `https://fund.eastmoney.com/pingzhongdata/${fundCode}.js?v=${Date.now()}`;
    const script = document.createElement('script');
    script.src = url;
    script.async = true;

    let done = false;
    let timer = null;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      script.onload = null;
      script.onerror = null;
      if (document.body.contains(script)) document.body.removeChild(script);
    };

    timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error('pingzhongdata 请求超时'));
    }, timeoutMs);

    script.onload = () => {
      if (done) return;
      done = true;
      const data = snapshotPingzhongdataGlobals(fundCode);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (done) return;
      done = true;
      cleanup();
      reject(new Error('pingzhongdata 加载失败'));
    };

    document.body.appendChild(script);
  });
};

const fetchAndParsePingzhongdata = async (fundCode) => {
  // 使用 JSONP(script 注入) 方式获取并解析 pingzhongdata
  return enqueuePingzhongdataLoad(() => jsonpLoadPingzhongdata(fundCode));
};

/**
 * 获取并解析「基金走势图/资产等」数据（pingzhongdata）
 * 来源：https://fund.eastmoney.com/pingzhongdata/${fundCode}.js
 */
export const fetchFundPingzhongdata = async (fundCode, { cacheTime = 60 * 60 * 1000 } = {}) => {
  if (!fundCode) throw new Error('fundCode 不能为空');
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('无浏览器环境');
  }

  const qc = getQueryClient();
  const key = qk.pingzhongdata(fundCode);

  try {
    return await qc.fetchQuery({
      queryKey: key,
      queryFn: () => fetchAndParsePingzhongdata(fundCode),
      staleTime: cacheTime
    });
  } catch (e) {
    qc.removeQueries({ queryKey: key });
    throw e;
  }
};

function parsePingzhongSylNumber(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/%/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * 用净值走势估算「近一周」涨跌幅：最新净值相对约 7 个自然日前最近一条净值。
 * pingzhongdata 另提供 syl_6y（近六月）等；近周无独立字段，由走势推算。
 */
export function computeWeekReturnFromNetWorthTrend(trend) {
  if (!isArray(trend) || trend.length < 2) return null;
  const valid = trend.filter((d) => d && isNumber(d.x) && Number.isFinite(Number(d.y))).sort((a, b) => a.x - b.x);
  if (valid.length < 2) return null;
  const latest = valid[valid.length - 1];
  const latestMs = latest.x;
  const latestNav = Number(latest.y);
  if (!Number.isFinite(latestNav) || latestNav === 0) return null;
  const cutoff = latestMs - 7 * 24 * 60 * 60 * 1000;
  let before = null;
  for (const d of valid) {
    if (d.x <= cutoff) before = d;
    else break;
  }
  if (!before) before = valid[0];
  const firstNav = Number(before.y);
  if (!Number.isFinite(firstNav) || firstNav === 0) return null;
  return ((latestNav - firstNav) / firstNav) * 100;
}

/**
 * 计算基金连涨连跌天数
 * @param {Array<{x: number, y: any}>} trend - pingzhongdata.Data_netWorthTrend 原始数据
 * @returns {{ type: 'up' | 'down', days: number } | null}
 */
export function calculateConsecutiveTrend(trend) {
  if (!isArray(trend) || trend.length < 2) return null;
  const valid = trend.filter((d) => d && isNumber(d.x) && Number.isFinite(Number(d.y))).sort((a, b) => a.x - b.x);
  if (valid.length < 2) return null;

  let count = 0;
  let type = null;

  for (let i = valid.length - 1; i > 0; i--) {
    const curr = Number(valid[i].y);
    const prev = Number(valid[i - 1].y);

    if (curr > prev) {
      if (type === 'down') break;
      type = 'up';
      count++;
    } else if (curr < prev) {
      if (type === 'up') break;
      type = 'down';
      count++;
    } else {
      break;
    }
  }

  if (count >= 3) {
    return { type, days: count };
  }
  return null;
}

/**
 * 基金阶段涨跌幅（东方财富 pingzhongdata：近一月/三月/六月/一年为接口字段；近一周由净值走势推算）
 * @returns {Promise<{ week: number|null, month: number|null, month3: number|null, month6: number|null, year1: number|null, consecutiveTrend: { type: 'up'|'down', days: number }|null }>}
 */
export async function fetchFundPeriodReturns(fundCode, { cacheTime = 60 * 60 * 1000 } = {}) {
  const empty = { week: null, month: null, month3: null, month6: null, year1: null, consecutiveTrend: null };
  if (!fundCode) return empty;
  try {
    const pz = await fetchFundPingzhongdata(fundCode, { cacheTime });
    return {
      week: computeWeekReturnFromNetWorthTrend(pz?.Data_netWorthTrend),
      month: parsePingzhongSylNumber(pz?.syl_1y),
      month3: parsePingzhongSylNumber(pz?.syl_3y),
      month6: parsePingzhongSylNumber(pz?.syl_6y),
      year1: parsePingzhongSylNumber(pz?.syl_1n),
      consecutiveTrend: calculateConsecutiveTrend(pz?.Data_netWorthTrend)
    };
  } catch {
    return empty;
  }
}

export const fetchFundHistory = async (code, range = '1m', options = {}) => {
  if (typeof window === 'undefined') return [];
  const { netValueType = 'unit' } = options;
  const useAccumulatedNetValue = netValueType === 'accumulated';

  const end = nowInTz();
  let start = end.clone();

  switch (range) {
    case '1m':
      start = start.subtract(1, 'month');
      break;
    case '3m':
      start = start.subtract(3, 'month');
      break;
    case '6m':
      start = start.subtract(6, 'month');
      break;
    case '1y':
      start = start.subtract(1, 'year');
      break;
    case '3y':
      start = start.subtract(3, 'year');
      break;
    case 'all':
      start = dayjs(0).tz(TZ);
      break;
    default:
      start = start.subtract(1, 'month');
  }

  // 业绩走势默认走 pingzhongdata.Data_netWorthTrend；需要累计净值展示时走 Data_ACWorthTrend。
  // 同时附带 Data_grandTotal（若存在，格式为 [{ name, data: [[ts, val], ...] }, ...]）
  try {
    const pz = await fetchFundPingzhongdata(code);
    const unitTrend = pz?.Data_netWorthTrend;
    const accumulatedTrend = pz?.Data_ACWorthTrend;
    const hasAccumulatedTrend = isArray(accumulatedTrend) && accumulatedTrend.length > 0;
    const trend = useAccumulatedNetValue && hasAccumulatedTrend ? accumulatedTrend : unitTrend;
    const actualNetValueType = useAccumulatedNetValue && hasAccumulatedTrend ? 'accumulated' : 'unit';
    const grandTotal = pz?.Data_grandTotal;

    if (isArray(trend) && trend.length) {
      const startMs = start.startOf('day').valueOf();
      const endMs = end.endOf('day').valueOf();

      // 若起始日没有净值，则往前推到最近一日有净值的数据作为有效起始
      const normalizeTrendPoint = (d) => {
        if (isArray(d)) {
          const ts = Number(d[0]);
          const value = Number(d[1]);
          if (!Number.isFinite(ts) || !Number.isFinite(value)) return null;
          return { x: ts, y: value, equityReturn: null };
        }
        if (d && isNumber(d.x) && Number.isFinite(Number(d.y))) return d;
        return null;
      };
      const buildValueByDate = (list) => {
        const out = new Map();
        if (!isArray(list)) return out;
        list
          .map(normalizeTrendPoint)
          .filter(Boolean)
          .forEach((d) => {
            const date = dayjs(d.x).tz(TZ).format('YYYY-MM-DD');
            out.set(date, Number(d.y));
          });
        return out;
      };
      const validTrend = trend
        .map(normalizeTrendPoint)
        .filter((d) => d && d.x <= endMs)
        .sort((a, b) => a.x - b.x);
      const unitValueByDate = buildValueByDate(unitTrend);
      const accumulatedValueByDate = buildValueByDate(accumulatedTrend);
      const unitReturnByDate = new Map();
      if (useAccumulatedNetValue && isArray(unitTrend)) {
        unitTrend
          .filter((d) => d && isNumber(d.x))
          .forEach((d) => {
            const date = dayjs(d.x).tz(TZ).format('YYYY-MM-DD');
            const equityReturn = isNumber(d.equityReturn) ? Number(d.equityReturn) : null;
            if (equityReturn != null) unitReturnByDate.set(date, equityReturn);
          });
      }
      const startDayEndMs = startMs + 24 * 60 * 60 * 1000 - 1;
      const hasPointOnStartDay = validTrend.some((d) => d.x >= startMs && d.x <= startDayEndMs);
      let effectiveStartMs = startMs;
      if (!hasPointOnStartDay) {
        const lastBeforeStart = validTrend.filter((d) => d.x < startMs).pop();
        if (lastBeforeStart) effectiveStartMs = lastBeforeStart.x;
      }

      const out = validTrend
        .filter((d) => d.x >= effectiveStartMs && d.x <= endMs)
        .map((d) => {
          const value = Number(d.y);
          const date = dayjs(d.x).tz(TZ).format('YYYY-MM-DD');
          const equityReturn = useAccumulatedNetValue
            ? (unitReturnByDate.get(date) ?? null)
            : isNumber(d.equityReturn)
              ? Number(d.equityReturn)
              : null;
          return {
            date,
            value,
            unitNetValue: unitValueByDate.get(date) ?? (actualNetValueType === 'unit' ? value : null),
            accumulatedNetValue:
              accumulatedValueByDate.get(date) ?? (actualNetValueType === 'accumulated' ? value : null),
            equityReturn
          };
        });
      out.netValueType = actualNetValueType;

      // 解析 Data_grandTotal 为多条对比曲线，使用同一有效起始日
      if (isArray(grandTotal) && grandTotal.length) {
        const grandTotalSeries = grandTotal
          .map((series) => {
            if (!series || !series.data || !isArray(series.data)) return null;
            const name = series.name || '';
            const points = series.data
              .filter((item) => isArray(item) && isNumber(item[0]))
              .map(([ts, val]) => {
                if (ts < effectiveStartMs || ts > endMs) return null;
                const numVal = Number(val);
                if (!Number.isFinite(numVal)) return null;
                const date = dayjs(ts).tz(TZ).format('YYYY-MM-DD');
                return { ts, date, value: numVal };
              })
              .filter(Boolean);
            if (!points.length) return null;
            return { name, points };
          })
          .filter(Boolean);

        if (grandTotalSeries.length) {
          out.grandTotalSeries = grandTotalSeries;
        }
      }

      if (out.length) return out;
    }
  } catch (e) {
    return [];
  }
  return [];
};

export const fetchFundValuationTrend = async (code, range = '3m') => {
  if (!isSupabaseConfigured) return [];
  if (!supabase?.functions?.invoke) return [];

  const { data, error } = await withRetry(() =>
    supabase.functions.invoke('get-fund-valuation-trend', {
      body: { fund_code: code, range }
    })
  );

  if (error || !data || data.error) return [];
  return isArray(data.data) ? data.data : [];
};

export const parseFundTextWithLLM = async (text) => {
  if (!text) return null;
  if (!isSupabaseConfigured) return null;
  if (!supabase?.functions?.invoke) return null;

  try {
    const { data, error } = await withRetry(() =>
      supabase.functions.invoke('analyze-fund', {
        body: { text }
      })
    );

    // 处理每日 OCR 用量限流
    if (data?.error === 'DAILY_LIMIT_EXCEEDED') {
      const err = new Error(data.message || '今日 OCR 识别次数已达上限');
      err.code = 'DAILY_LIMIT_EXCEEDED';
      err.remaining = 0;
      throw err;
    }

    if (error) return null;
    if (!data || data.success !== true) return null;
    if (!isArray(data.data)) return null;

    // 保持与旧实现兼容：返回 JSON 字符串，由调用方 JSON.parse
    return JSON.stringify(data.data);
  } catch (e) {
    // 限流错误向上传播，让调用方捕获并展示提示
    if (e?.code === 'DAILY_LIMIT_EXCEEDED') throw e;
    return null;
  }
};

/**
 * 通过 Supabase Edge Function 获取天天基金估值排行
 * @param {string|number} sort 排序字段 (3:估值涨幅, 4:成交热度, 5:实际涨幅)
 * @param {string} order 排序方向 (desc | asc)
 * @param {number} page 页码
 * @param {number} pageSize 每页条数
 * @returns {Promise<{Data: {list: Array, allRecords: number}} | null>}
 */
export const fetchFundValuationRanking = async (sort = 3, order = 'desc', page = 1, pageSize = 20) => {
  if (!isSupabaseConfigured) return null;
  if (!supabase?.functions?.invoke) return null;

  const { data, error } = await withRetry(() =>
    supabase.functions.invoke('fund-valuation-ranking', {
      body: { sort, order, page, pageSize }
    })
  );

  if (error) throw new Error(error.message || '加载估值排行失败');
  if (!data || data.success !== true) throw new Error(data?.error || '加载估值排行失败');

  // 保持与原 JSONP 返回结构一致：{ Data: { list: [...], ... } }
  return { Data: data.data };
};

/**
 * 查询当前用户今日 OCR 剩余可用次数
 * @param {string} userId 当前用户 ID
 * @param {number} [maxLimit=5] 每日上限
 * @returns {Promise<{ remaining: number, used: number, max: number }>}
 */
export const fetchOcrDailyRemaining = async (userId, maxLimit = 5) => {
  if (!userId || !isSupabaseConfigured) return { remaining: maxLimit, used: 0, max: maxLimit };

  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('ocr_daily_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .maybeSingle();

    if (error) return { remaining: maxLimit, used: 0, max: maxLimit };
    const used = data?.count || 0;
    return { remaining: Math.max(0, maxLimit - used), used, max: maxLimit };
  } catch {
    return { remaining: maxLimit, used: 0, max: maxLimit };
  }
};
