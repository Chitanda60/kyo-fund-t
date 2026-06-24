import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as qk from '../../lib/query-keys';
import { getQueryClient } from '../../lib/get-query-client';
import { nowInTz, runEastmoneyF10ScriptForApidata, fundDebugLog } from './shared';
import { fetchFundPingzhongdata } from './miscApi';

dayjs.extend(utc);
dayjs.extend(timezone);

const extractHoldingsReportDate = (html) => {
  if (!html) return null;

  // 优先匹配带有“报告期 / 截止日期”等关键字附近的日期
  const m1 = html.match(/(报告期|截止日期)[^0-9]{0,20}(\d{4}-\d{2}-\d{2})/);
  if (m1) return m1[2];

  // 兜底：取文中出现的第一个 yyyy-MM-dd 格式日期
  const m2 = html.match(/(\d{4}-\d{2}-\d{2})/);
  return m2 ? m2[1] : null;
};

const isLastQuarterReport = (reportDateStr) => {
  if (!reportDateStr) return false;

  const report = dayjs(reportDateStr, 'YYYY-MM-DD');
  if (!report.isValid()) return false;

  const now = nowInTz();
  // 允许最近 6 个月内的报告（覆盖上一季度 + 上上季度，兼容披露延迟）
  const sixMonthsAgo = now.subtract(6, 'month');
  return report.isAfter(sixMonthsAgo) && report.isBefore(now.add(7, 'day'));
};

export const fetchFundHoldings = async (code) => {
  if (!code) return { holdings: [], holdingsReportDate: null, holdingsIsLastQuarter: false };
  return new Promise((resolveH) => {
    fundDebugLog('fetchFundHoldings start', { code });
    const holdingsUrl = `https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=${code}&topline=10&year=&month=&_=${Date.now()}`;
    getQueryClient()
      .fetchQuery({
        queryKey: qk.fundHoldingsArchives(code),
        queryFn: async () => {
          const r = await runEastmoneyF10ScriptForApidata(holdingsUrl);
          if (!r?.ok) throw new Error(r?.error || '数据加载失败');
          return r.apidata;
        },
        staleTime: 60 * 60 * 1000
      })
      .then(async (apidata) => {
        let holdings = [];
        const html = apidata?.content || '';
        const holdingsReportDate = extractHoldingsReportDate(html);
        const holdingsIsLastQuarter = isLastQuarterReport(holdingsReportDate);

        // 如果不是上一季度末的披露数据，则不展示重仓（并避免继续解析/请求行情）
        if (!holdingsIsLastQuarter) {
          resolveH({ holdings: [], holdingsReportDate, holdingsIsLastQuarter: false });
          return;
        }

        const headerRow = (html.match(/<thead[\s\S]*?<tr[\s\S]*?<\/tr>[\s\S]*?<\/thead>/i) || [])[0] || '';
        const headerCells = (headerRow.match(/<th[\s\S]*?>([\s\S]*?)<\/th>/gi) || []).map((th) =>
          th.replace(/<[^>]*>/g, '').trim()
        );
        let idxCode = -1,
          idxName = -1,
          idxWeight = -1;
        headerCells.forEach((h, i) => {
          const t = h.replace(/\s+/g, '');
          if (idxCode < 0 && (t.includes('股票代码') || t.includes('证券代码'))) idxCode = i;
          if (idxName < 0 && (t.includes('股票名称') || t.includes('证券名称'))) idxName = i;
          if (idxWeight < 0 && (t.includes('占净值比例') || t.includes('占比'))) idxWeight = i;
        });
        const rows = html.match(/<tbody[\s\S]*?<\/tbody>/i) || [];
        const dataRows = rows.length
          ? rows[0].match(/<tr[\s\S]*?<\/tr>/gi) || []
          : html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        for (const r of dataRows) {
          const tds = (r.match(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi) || []).map((td) => td.replace(/<[^>]*>/g, '').trim());
          if (!tds.length) continue;
          let hc = '';
          let hn = '';
          let hw = '';
          if (idxCode >= 0 && tds[idxCode]) {
            const raw = String(tds[idxCode] || '').trim();
            const mA = raw.match(/(\d{6})/);
            const mHK = raw.match(/(\d{5})/);
            // 海外股票常见为英文代码（如 AAPL / usAAPL / TSLA.US / 0700.HK）
            const mAlpha = raw.match(/\b([A-Za-z]{1,10})\b/);
            hc = mA ? mA[1] : mHK ? mHK[1] : mAlpha ? mAlpha[1].toUpperCase() : raw;
          } else {
            const codeIdx = tds.findIndex((txt) => /^\d{6}$/.test(txt));
            if (codeIdx >= 0) hc = tds[codeIdx];
          }
          if (idxName >= 0 && tds[idxName]) {
            hn = tds[idxName];
          } else if (hc) {
            const i = tds.findIndex((txt) => txt && txt !== hc && !/%$/.test(txt));
            hn = i >= 0 ? tds[i] : '';
          }
          if (idxWeight >= 0 && tds[idxWeight]) {
            const wm = tds[idxWeight].match(/([\d.]+)\s*%/);
            hw = wm ? `${wm[1]}%` : tds[idxWeight];
          } else {
            const wIdx = tds.findIndex((txt) => /\d+(?:\.\d+)?\s*%/.test(txt));
            hw = wIdx >= 0 ? tds[wIdx].match(/([\d.]+)\s*%/)?.[1] + '%' : '';
          }
          if (hc || hn || hw) {
            holdings.push({ code: hc, name: hn, weight: hw, change: null });
          }
        }
        holdings = holdings.slice(0, 10);
        const normalizeTencentCode = (input) => {
          const raw = String(input || '').trim();
          if (!raw) return null;
          // already normalized tencent styles (normalize prefix casing)
          const mPref = raw.match(/^(us|hk|sh|sz|bj)(.+)$/i);
          if (mPref) {
            const p = mPref[1].toLowerCase();
            const rest = String(mPref[2] || '').trim();
            // usAAPL / usIXIC: rest use upper; hk00700 keep digits
            return `${p}${/^\d+$/.test(rest) ? rest : rest.toUpperCase()}`;
          }
          const mSPref = raw.match(/^s_(sh|sz|bj|hk)(.+)$/i);
          if (mSPref) {
            const p = mSPref[1].toLowerCase();
            const rest = String(mSPref[2] || '').trim();
            return `s_${p}${/^\d+$/.test(rest) ? rest : rest.toUpperCase()}`;
          }

          // A股/北证
          if (/^\d{6}$/.test(raw)) {
            const pfx =
              raw.startsWith('6') || raw.startsWith('9')
                ? 'sh'
                : raw.startsWith('4') || raw.startsWith('8')
                  ? 'bj'
                  : 'sz';
            return `s_${pfx}${raw}`;
          }
          // 港股（数字）
          if (/^\d{5}$/.test(raw)) return `s_hk${raw}`;

          // 形如 0700.HK / 00001.HK
          const mHkDot = raw.match(/^(\d{4,5})\.(?:HK)$/i);
          if (mHkDot) return `s_hk${mHkDot[1].padStart(5, '0')}`;

          // 形如 AAPL / TSLA.US / AAPL.O / BRK.B（腾讯接口对“.”支持不稳定，优先取主代码）
          const mUsDot = raw.match(/^([A-Za-z]{1,10})(?:\.[A-Za-z]{1,6})$/);
          if (mUsDot) return `us${mUsDot[1].toUpperCase()}`;
          if (/^[A-Za-z]{1,10}$/.test(raw)) return `us${raw.toUpperCase()}`;

          return null;
        };

        const getTencentVarName = (tencentCode) => {
          const cd = String(tencentCode || '').trim();
          if (!cd) return '';
          // s_* uses v_s_*
          if (/^s_/i.test(cd)) return `v_${cd}`;
          // us/hk/sh/sz/bj uses v_{code}
          return `v_${cd}`;
        };

        const needQuotes = holdings
          .map((h) => ({
            h,
            tencentCode: normalizeTencentCode(h.code)
          }))
          .filter((x) => Boolean(x.tencentCode));
        if (needQuotes.length) {
          try {
            const tencentCodes = needQuotes.map((x) => x.tencentCode).join(',');
            if (!tencentCodes) {
              resolveH({ holdings, holdingsReportDate, holdingsIsLastQuarter });
              return;
            }
            const quoteUrl = `https://qt.gtimg.cn/q=${tencentCodes}`;
            await new Promise((resQuote) => {
              const scriptQuote = document.createElement('script');
              scriptQuote.src = quoteUrl;
              let quoteDone = false;
              const cleanupQuote = () => {
                quoteDone = true;
                if (quoteTimer) clearTimeout(quoteTimer);
                if (document.body.contains(scriptQuote)) document.body.removeChild(scriptQuote);
              };
              const quoteTimer = setTimeout(() => {
                if (quoteDone) return;
                cleanupQuote();
                resQuote();
              }, 10000);
              scriptQuote.onload = () => {
                if (quoteDone) return;
                needQuotes.forEach(({ h, tencentCode }) => {
                  const varName = getTencentVarName(tencentCode);
                  const dataStr = varName ? window[varName] : null;
                  if (dataStr) {
                    const parts = dataStr.split('~');
                    const isUS = /^us/i.test(String(tencentCode || ''));
                    const idx = isUS ? 32 : 5;
                    if (parts.length > idx) {
                      h.change = parseFloat(parts[idx]);
                    }
                  }
                });
                cleanupQuote();
                resQuote();
              };
              scriptQuote.onerror = () => {
                cleanupQuote();
                resQuote();
              };
              document.body.appendChild(scriptQuote);
            });
          } catch (e) {}
        }

        let assetAllocation = [];
        try {
          const pz = await fetchFundPingzhongdata(code);
          const rawSeries = pz?.Data_assetAllocation?.series || [];
          let filtered = rawSeries.filter((s) => s.type !== 'line' && !String(s.name || '').includes('净资产'));
          let sum = 0;
          let parsedSeries = [];
          filtered.forEach((s) => {
            if (s.data && s.data.length > 0) {
              const val = Number(s.data[s.data.length - 1]);
              if (!Number.isNaN(val) && val > 0) {
                sum += val;
                parsedSeries.push({ name: String(s.name).replace('占净比', ''), value: val });
              }
            }
          });
          if (sum < 100 && parsedSeries.length > 0) {
            const other = 100 - sum;
            if (other >= 0.01) {
              parsedSeries.push({ name: '其他', value: other });
            }
          }
          assetAllocation = parsedSeries;
        } catch (e) {}

        resolveH({ holdings, holdingsReportDate, holdingsIsLastQuarter, assetAllocation });
        fundDebugLog('fetchFundHoldings resolved', {
          code,
          holdingsCount: holdings?.length || 0,
          holdingsReportDate,
          holdingsIsLastQuarter
        });
      })
      .catch(() =>
        resolveH({ holdings: [], holdingsReportDate: null, holdingsIsLastQuarter: false, assetAllocation: [] })
      );
  });
};
