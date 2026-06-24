import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as qk from '../../lib/query-keys';
import { getQueryClient } from '../../lib/get-query-client';
import { isTradingDay } from '../../lib/tradingCalendar';
import { storageStore } from '../../stores';
import { DEFAULT_TZ } from '@/app/constants';

dayjs.extend(utc);
dayjs.extend(timezone);

const getBrowserTimeZone = () => {
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || DEFAULT_TZ;
  }
  return DEFAULT_TZ;
};
export const TZ = getBrowserTimeZone();
dayjs.tz.setDefault(TZ);
export const nowInTz = () => dayjs().tz(TZ);
export const toTz = (input) => (input ? dayjs.tz(input, TZ) : nowInTz());

/**
 * 获取单位净值的缓存时长（单位：毫秒）
 * - 交易日交易时段（09:30-15:00）：30 分钟，减少高频刷新时的冗余请求
 * - 非交易时段（含周末、节假日、闭市）：5 分钟，确保净值更新后能尽快捕获
 */
export const getNetValueStaleTime = () => {
  const now = nowInTz();
  const day = now.day();
  const isWeekend = day === 0 || day === 6;

  // 判定是否为交易日（利用 tradingCalendar 的缓存，若未加载则回退到周末判断）
  const tradingDay = isTradingDay(now);

  const hour = now.hour();
  const minute = now.minute();
  const timeNum = hour * 100 + minute;

  // A股交易时段：09:30-11:30, 13:00-15:00
  // 加上前后各 5 分钟冗余：09:25-11:35, 12:55-15:05
  const isTradingTime = tradingDay && ((timeNum >= 925 && timeNum <= 1135) || (timeNum >= 1255 && timeNum <= 1505));

  if (isTradingTime) {
    return 30 * 60 * 1000; // 30 分钟
  }
  return 5 * 60 * 1000; // 5 分钟
};

function normalizeEastmoneyScriptUrl(url) {
  let key = url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('_');
    parsed.searchParams.delete('_t');
    key = parsed.toString();
  } catch (e) {}
  return key;
}

/** 东方财富 F10 / FundArchives 等 JSONP（window.apidata），不做缓存；由 loadScript / fetchQuery 控制 staleTime */
export function runEastmoneyF10ScriptForApidata(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;

    let done = false;
    const cleanup = () => {
      done = true;
      if (timer) clearTimeout(timer);
      if (document.body.contains(script)) document.body.removeChild(script);
    };

    const timer = setTimeout(() => {
      if (done) return;
      cleanup();
      resolve({ ok: false, error: '请求超时' });
    }, timeoutMs);

    script.onload = () => {
      if (done) return;
      cleanup();
      let apidata;
      try {
        apidata = window?.apidata ? JSON.parse(JSON.stringify(window.apidata)) : undefined;
      } catch (e) {
        apidata = window?.apidata;
      }
      resolve({ ok: true, apidata });
    };

    script.onerror = () => {
      if (done) return;
      cleanup();
      resolve({ ok: false, error: '数据加载失败' });
    };

    document.body.appendChild(script);
  });
}

export const loadScript = (url, options = {}) => {
  if (typeof document === 'undefined' || !document.body) return Promise.resolve(null);

  const { staleTime = 10 * 60 * 1000 } = options;
  const norm = normalizeEastmoneyScriptUrl(url);
  const qc = getQueryClient();

  return qc
    .fetchQuery({
      queryKey: qk.eastmoneyScript(norm),
      queryFn: () => runEastmoneyF10ScriptForApidata(url),
      staleTime: staleTime
    })
    .then((result) => {
      if (!result?.ok) {
        qc.removeQueries({ queryKey: qk.eastmoneyScript(norm) });
        throw new Error(result?.error || '数据加载失败');
      }
      return result.apidata;
    });
};

const parseLatestNetValueFromLsjzContent = (content) => {
  if (!content || content.includes('暂无数据')) return null;
  const rowMatches = content.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const row of rowMatches) {
    const cells = row.match(/<td[^>]*>(.*?)<\/td>/gi) || [];
    if (!cells.length) continue;
    const getText = (td) => td.replace(/<[^>]+>/g, '').trim();
    const dateStr = getText(cells[0] || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    const navStr = getText(cells[1] || '');
    const nav = parseFloat(navStr);
    if (!Number.isFinite(nav)) continue;
    let growth = null;
    for (const c of cells) {
      const txt = getText(c);
      const m = txt.match(/([-+]?\d+(?:\.\d+)?)\s*%/);
      if (m) {
        growth = parseFloat(m[1]);
        break;
      }
    }
    return { date: dateStr, nav, growth };
  }
  return null;
};

/**
 * 解析历史净值数据（支持多条记录）
 * 返回按日期升序排列的净值数组
 */
/**
 * 根据 lsjz 升序净值列表推算「上一完整交易日」相对再前一日的涨跌幅与每份净值差（用于昨日收益）
 */
export const computeYesterdayNavMetricsFromList = (navList) => {
  const out = { yesterdayZzl: null, yesterdayNavDelta: null };
  try {
    const len = navList.length;
    if (len < 2) return out;
    const rowPrev = navList[len - 2];
    out.yesterdayZzl = Number.isFinite(rowPrev?.growth) ? rowPrev.growth : null;
    if (len >= 3) {
      const navP = navList[len - 2].nav;
      const navPP = navList[len - 3].nav;
      if (Number.isFinite(navP) && Number.isFinite(navPP)) {
        out.yesterdayNavDelta = navP - navPP;
      }
    } else if (len === 2) {
      const r0 = navList[0];
      const g = r0.growth;
      if (Number.isFinite(g) && Number.isFinite(r0.nav)) {
        out.yesterdayNavDelta = r0.nav - r0.nav / (1 + g / 100);
      }
    }
  } catch {
    return out;
  }
  return out;
};

export const parseNetValuesFromLsjzContent = (content) => {
  if (!content || content.includes('暂无数据')) return [];
  const rowMatches = content.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const results = [];
  for (const row of rowMatches) {
    const cells = row.match(/<td[^>]*>(.*?)<\/td>/gi) || [];
    if (!cells.length) continue;
    const getText = (td) => td.replace(/<[^>]+>/g, '').trim();
    const dateStr = getText(cells[0] || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    const navStr = getText(cells[1] || '');
    const nav = parseFloat(navStr);
    if (!Number.isFinite(nav)) continue;
    let growth = null;
    for (const c of cells) {
      const txt = getText(c);
      const m = txt.match(/([-+]?\d+(?:\.\d+)?)\s*%/);
      if (m) {
        growth = parseFloat(m[1]);
        break;
      }
    }

    let dividend = null;
    const divText = getText(cells[6] || '');
    const divMatch = divText.match(/派现金(\d+(?:\.\d+)?)/);
    if (divMatch) {
      dividend = parseFloat(divMatch[1]);
    }

    results.push({ date: dateStr, nav, growth, dividend });
  }
  // 返回按日期升序排列的结果（API返回的是倒序，需要反转）
  return results.reverse();
};

/**
 * 按日期区间批量拉取历史净值（lsjz），支持分页，减少逐日请求次数。
 * @param {string} code 基金代码
 * @param {string} sdate 开始 YYYY-MM-DD
 * @param {string} edate 结束 YYYY-MM-DD
 * @returns {Promise<Array<{ date: string, nav: number, growth: number|null }>>} 按日期升序
 */

const RTF_FUND_DEBUG_LS_KEY = 'rtf_debug_fund';
function fundDebugEnabled() {
  try {
    // 仅开发环境允许输出调试日志（避免生产环境污染控制台）
    if (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'production') return false;
    if (typeof window === 'undefined') return false;
    const v = storageStore.getItem(RTF_FUND_DEBUG_LS_KEY);
    return v === '1' || v === 'true';
  } catch (e) {
    return false;
  }
}
export function fundDebugLog(...args) {
  try {
    if (!fundDebugEnabled()) return;

    console.debug('[fund][debug]', ...args);
  } catch (e) {}
}
