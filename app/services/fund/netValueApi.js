import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { isArray, isNumber, isString } from 'lodash';
import { TZ, nowInTz, toTz, getNetValueStaleTime, loadScript, parseNetValuesFromLsjzContent } from './shared';
import { fetchFundPingzhongdata } from './miscApi';

dayjs.extend(utc);
dayjs.extend(timezone);

export const fetchFundNetValue = async (code, date) => {
  if (typeof window === 'undefined') return null;
  const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${code}&page=1&per=1&sdate=${date}&edate=${date}`;
  try {
    const apidata = await loadScript(url, { staleTime: getNetValueStaleTime() });
    if (apidata && apidata.content) {
      const content = apidata.content;
      if (content.includes('暂无数据')) return null;
      const rows = content.split('<tr>');
      for (const row of rows) {
        if (row.includes(`<td>${date}</td>`)) {
          const cells = row.match(/<td[^>]*>(.*?)<\/td>/g);
          if (cells && cells.length >= 2) {
            const valStr = cells[1].replace(/<[^>]+>/g, '');
            const val = parseFloat(valStr);
            return isNaN(val) ? null : val;
          }
        }
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const fetchFundNetValueRange = async (code, sdate, edate) => {
  if (typeof window === 'undefined') return [];
  if (!isString(code) || !String(code).trim()) return [];
  if (
    !isString(sdate) ||
    !isString(edate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(sdate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(edate)
  ) {
    return [];
  }
  if (sdate > edate) return [];

  const c = String(code).trim();
  const merged = new Map();
  let pageNum = 1;
  const per = 500;
  while (true) {
    const url = `https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=${c}&page=${pageNum}&per=${per}&sdate=${sdate}&edate=${edate}`;
    try {
      const apidata = await loadScript(url);
      const content = apidata?.content || '';
      const batch = parseNetValuesFromLsjzContent(content);
      if (!batch.length) break;
      for (const row of batch) {
        merged.set(row.date, row);
      }
      if (batch.length < per) break;
      pageNum += 1;
    } catch {
      break;
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * 拉取基金历史分红数据。
 * @param {string} code 基金代码
 * @param {string} sdate 开始 YYYY-MM-DD
 * @returns {Promise<Array<{ date: string, dividend: number, nav: number }>>} 按日期升序
 */
export const fetchFundDividends = async (code, sdate) => {
  const edate = dayjs().format('YYYY-MM-DD');
  const rows = await fetchFundNetValueRange(code, sdate, edate);
  return rows
    .filter((r) => r.dividend !== undefined && r.dividend !== null)
    .map((r) => ({
      date: r.date,
      dividend: r.dividend,
      nav: r.nav
    }));
};

/**
 * 从业绩趋势接口（pingzhongdata.Data_netWorthTrend）提取指定日期范围的净值序列。
 * 返回格式与 fetchFundNetValueRange 完全一致，可作为 lsjz 的替代数据源。
 * @param {string} code 基金代码
 * @param {string} sdate 开始日期 YYYY-MM-DD（含）
 * @param {string} edate 结束日期 YYYY-MM-DD（含）
 * @param {object} [options]
 * @param {number} [options.cacheTime] - pingzhongdata 缓存时长，默认 1 小时
 * @returns {Promise<Array<{ date: string, nav: number, growth: number|null }>>} 按日期升序
 */
export const fetchNetValueRangeFromTrend = async (code, sdate, edate, options = {}) => {
  if (typeof window === 'undefined') return [];
  if (!isString(code) || !String(code).trim()) return [];
  if (
    !isString(sdate) ||
    !isString(edate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(sdate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(edate)
  ) {
    return [];
  }
  if (sdate > edate) return [];

  const { cacheTime = 60 * 60 * 1000 } = options;

  try {
    const pz = await fetchFundPingzhongdata(String(code).trim(), { cacheTime });
    const trend = pz?.Data_netWorthTrend;
    if (!isArray(trend) || trend.length === 0) return [];

    // 过滤出有效数据点并按时间升序排列
    const valid = trend.filter((d) => d && isNumber(d.x) && Number.isFinite(Number(d.y))).sort((a, b) => a.x - b.x);

    // 按日期去重（同一天可能有多个数据点，取最后一条）并转换格式
    const byDate = new Map();
    for (const d of valid) {
      const date = dayjs(d.x).tz(TZ).format('YYYY-MM-DD');
      const nav = Number(d.y);
      if (!Number.isFinite(nav) || nav <= 0) continue;
      byDate.set(date, nav); // 同日覆盖取最后一条
    }

    // 提取范围内数据并计算 growth（日涨跌幅）
    const allDates = Array.from(byDate.keys()).sort();
    const results = [];
    for (let i = 0; i < allDates.length; i++) {
      const date = allDates[i];
      if (date < sdate || date > edate) continue;
      const nav = byDate.get(date);
      let growth = null;
      // 寻找前一个交易日净值用于计算涨跌幅
      if (i > 0) {
        const prevNav = byDate.get(allDates[i - 1]);
        if (Number.isFinite(prevNav) && prevNav > 0) {
          growth = ((nav - prevNav) / prevNav) * 100;
        }
      }
      results.push({ date, nav, growth });
    }

    return results;
  } catch {
    return [];
  }
};

export const fetchSmartFundNetValue = async (code, startDate) => {
  const today = nowInTz().startOf('day');
  let current = toTz(startDate).startOf('day');
  for (let i = 0; i < 30; i++) {
    if (current.isAfter(today)) break;
    const dateStr = current.format('YYYY-MM-DD');
    const val = await fetchFundNetValue(code, dateStr);
    if (val !== null) {
      return { date: dateStr, value: val };
    }
    current = current.add(1, 'day');
  }
  return null;
};

export const fetchSmartFundNetValueBackward = async (code, startDate) => {
  const today = nowInTz().startOf('day');
  let current = toTz(startDate).startOf('day');
  if (current.isAfter(today)) current = today;
  for (let i = 0; i < 30; i++) {
    const dateStr = current.format('YYYY-MM-DD');
    const val = await fetchFundNetValue(code, dateStr);
    if (val !== null) {
      return { date: dateStr, value: val };
    }
    current = current.subtract(1, 'day');
  }
  return null;
};
