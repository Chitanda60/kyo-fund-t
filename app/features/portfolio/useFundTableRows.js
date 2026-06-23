import { useMemo } from 'react';
import { isArray, isNumber, isString, isPlainObject } from 'lodash';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TZ, isNavUpdated, normalizeFundTagTheme } from '../../lib/fundHelpers';
import { SUMMARY_TAB_ID } from '@/app/constants';
import { formatMoney } from '@/lib/utils';

// dayjs.tz 在 pcFundTableData 中使用，确保插件已注册（与 page.jsx 一致，重复 extend 幂等）。
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 纯派生 Hook：从 page.jsx 抽离的「PC/移动端表格行视图模型」及其辅助派生。
 *
 * 设计约束（行为保持）：
 * - 纯函数式：数据由参数传入，内部不订阅 store、不调用 setter。
 * - 四个 useMemo（latestDailyByCode / groupTotalHoldingAmount / pendingCodesForTab /
 *   pcFundTableData）的逻辑体与依赖数组与原 page.jsx 完全一致。
 * - pcFundTableData 的依赖数组刻意省略 currentFundDailyEarnings（保留原重算时机），
 *   故对该 memo 禁用 preserve-manual-memoization（exhaustive-deps 警告保留，与原一致）。
 */
export function useFundTableRows({
  displayFunds,
  holdingsForTabWithLinked,
  isTradingDay,
  todayStr,
  getHoldingProfitForTab,
  dcaPlansForTab,
  pendingTrades,
  activeGroupId,
  currentFundDailyEarnings,
  currentTab,
  summaryHoldingSourceGroupByCode,
  linkedHoldingsForAllFav,
  fundTagListsByCode
}) {
  const latestDailyByCode = useMemo(() => {
    const out = {};
    if (!isPlainObject(currentFundDailyEarnings)) return out;
    for (const f of displayFunds) {
      const code = f?.code;
      if (!code) continue;
      const list = currentFundDailyEarnings[code];
      if (!isArray(list) || list.length === 0) continue;
      const byDate = new Map();
      for (const item of list) {
        const date = item?.date ? String(item.date) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        byDate.set(date, item);
      }
      out[code] = { byDate, last: list[list.length - 1] };
    }
    return out;
  }, [currentFundDailyEarnings, displayFunds]);

  // 分组内所有基金持仓金额之和，用于持仓占比（PC 端表格 + FundCard 更多区域共用）
  const groupTotalHoldingAmount = useMemo(() => {
    let total = 0;
    for (const ff of displayFunds) {
      const h = holdingsForTabWithLinked[ff.code];
      const p = getHoldingProfitForTab(ff, h);
      if (p && p.amount != null && Number.isFinite(p.amount) && p.amount > 0) total += p.amount;
    }
    return total;
  }, [displayFunds, holdingsForTabWithLinked, getHoldingProfitForTab]);

  // 当前 tab 作用域下有待处理交易的基金代码集合
  const pendingCodesForTab = useMemo(() => {
    const set = new Set();
    for (const t of pendingTrades) {
      if (!t || !t.fundCode) continue;
      if (activeGroupId) {
        if (t.groupId === activeGroupId) set.add(t.fundCode);
      } else {
        set.add(t.fundCode);
      }
    }
    return set;
  }, [pendingTrades, activeGroupId]);

  // PC 端表格数据（用于 PcFundTable）
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const pcFundTableData = useMemo(() => {
    return displayFunds.map((f) => {
      const hasTodayData = isNavUpdated(f.jzrq, todayStr, f.confirmDays);
      const latestNav =
        f.dwjz != null && f.dwjz !== '' ? (isNumber(f.dwjz) ? Number(f.dwjz).toFixed(4) : String(f.dwjz)) : '—';
      const estimateNav = f.noValuation
        ? '—'
        : f.gsz != null
          ? isNumber(f.gsz)
            ? Number(f.gsz).toFixed(4)
            : String(f.gsz)
          : '—';

      const yesterdayChangePercent =
        f.zzl != null && f.zzl !== '' ? `${f.zzl > 0 ? '+' : ''}${Number(f.zzl).toFixed(2)}%` : '—';
      const yesterdayChangeValue = f.zzl != null && f.zzl !== '' ? Number(f.zzl) : null;
      const yesterdayDate = f.jzrq || '-';

      const estimateChangePercent = f.noValuation
        ? '—'
        : isNumber(f.gszzl)
          ? `${f.gszzl > 0 ? '+' : ''}${Number(f.gszzl).toFixed(2)}%`
          : (f.gszzl ?? '—');
      const estimateChangeValue = f.noValuation ? null : isNumber(f.gszzl) ? Number(f.gszzl) : null;
      const estimateTime = f.noValuation ? f.jzrq || '-' : f.gztime || f.time || '-';
      const hasTodayEstimate = !f.noValuation && isString(f.gztime) && f.gztime.startsWith(todayStr);

      const holding = holdingsForTabWithLinked[f.code];
      const isHoldingLinked =
        (currentTab === 'all' || currentTab === 'fav') && linkedHoldingsForAllFav.linked?.has?.(f.code);
      const profit = getHoldingProfitForTab(f, holding);
      const amount = profit ? profit.amount : null;
      const holdingAmount = amount == null ? '未设置' : `¥${formatMoney(amount)}`;
      const holdingAmountValue = amount;
      const holdingRatioValue =
        amount != null && Number.isFinite(amount) && amount > 0 && groupTotalHoldingAmount > 0
          ? amount / groupTotalHoldingAmount
          : null;
      const holdingDaysValue = holding?.firstPurchaseDate
        ? dayjs.tz(todayStr, TZ).diff(dayjs.tz(holding.firstPurchaseDate, TZ), 'day')
        : null;

      const profitToday = profit ? profit.profitToday : null;
      const todayProfit =
        profitToday == null
          ? ''
          : `${profitToday > 0 ? '+' : profitToday < 0 ? '-' : ''}${formatMoney(Math.abs(profitToday))}`;
      const todayProfitValue = profitToday;

      const total = profit ? profit.profitTotal : null;
      const principal = holding && isNumber(holding.cost) && isNumber(holding.share) ? holding.cost * holding.share : 0;
      const holdingCostValue =
        holding && isNumber(holding.cost) && isNumber(holding.share) ? holding.cost * holding.share : null;
      const holdingCost = holdingCostValue == null ? '-' : formatMoney(holdingCostValue);
      const costNavValue = holding && isNumber(holding.cost) ? holding.cost : null;
      const costNav = costNavValue == null ? '—' : Number(costNavValue).toFixed(4);
      const todayProfitPercent =
        profitToday != null && profit?.principalToday > 0
          ? `${profitToday > 0 ? '+' : profitToday < 0 ? '-' : ''}${Math.abs((profitToday / profit.principalToday) * 100).toFixed(2)}%`
          : '';

      const latestNavDateStr = isString(f.jzrq) ? f.jzrq : '';
      const dailyMeta = latestDailyByCode?.[f.code];
      const dailyList = currentFundDailyEarnings?.[f.code];

      // 解析昨日收益对应的记录（避免当晚更新今日净值后，“昨日收益”显示成“今日收益”）
      let yesterdayMatchedDaily = null;
      if (isArray(dailyList) && dailyList.length > 0) {
        if (latestNavDateStr === todayStr) {
          // 如果最新净值日期已更新为今天，昨日收益取今天之前的最后一个记录
          for (let i = dailyList.length - 1; i >= 0; i--) {
            if (dailyList[i]?.date && dailyList[i].date < todayStr) {
              yesterdayMatchedDaily = dailyList[i];
              break;
            }
          }
        } else {
          // 否则取最新净值日期对应的记录或最后一个记录
          yesterdayMatchedDaily =
            (latestNavDateStr ? dailyMeta?.byDate?.get(latestNavDateStr) || null : null) || dailyMeta?.last || null;
        }
      }

      const yesterdayProfitVal =
        yesterdayMatchedDaily && Number.isFinite(Number(yesterdayMatchedDaily.earnings))
          ? Number(yesterdayMatchedDaily.earnings)
          : null;
      const yesterdayProfit =
        yesterdayProfitVal == null
          ? ''
          : `${yesterdayProfitVal > 0 ? '+' : yesterdayProfitVal < 0 ? '-' : ''}${formatMoney(Math.abs(yesterdayProfitVal))}`;
      const dailyBaseCostAmount =
        yesterdayMatchedDaily &&
        yesterdayMatchedDaily.baseCostAmount != null &&
        yesterdayMatchedDaily.baseCostAmount !== '' &&
        Number.isFinite(Number(yesterdayMatchedDaily.baseCostAmount))
          ? Number(yesterdayMatchedDaily.baseCostAmount)
          : null;
      const derivedRateFromSnapshot =
        yesterdayProfitVal != null && dailyBaseCostAmount != null && dailyBaseCostAmount > 0
          ? (yesterdayProfitVal / dailyBaseCostAmount) * 100
          : null;
      const dailyRate =
        yesterdayMatchedDaily &&
        yesterdayMatchedDaily.rate != null &&
        yesterdayMatchedDaily.rate !== '' &&
        Number.isFinite(Number(yesterdayMatchedDaily.rate))
          ? Number(yesterdayMatchedDaily.rate)
          : derivedRateFromSnapshot;
      const yesterdayProfitPercentLine =
        dailyRate != null
          ? `${dailyRate > 0 ? '+' : dailyRate < 0 ? '-' : ''}${Math.abs(dailyRate).toFixed(2)}%`
          : yesterdayProfitVal != null && principal > 0
            ? `${yesterdayProfitVal > 0 ? '+' : yesterdayProfitVal < 0 ? '-' : ''}${Math.abs((yesterdayProfitVal / principal) * 100).toFixed(2)}%`
            : '';
      const yesterdaySecondLinePctValue =
        dailyRate != null
          ? dailyRate
          : yesterdayProfitVal != null && principal > 0
            ? (yesterdayProfitVal / principal) * 100
            : null;

      const holdingProfit =
        total == null ? '' : `${total > 0 ? '+' : total < 0 ? '-' : ''}${formatMoney(Math.abs(total))}`;
      const holdingProfitPercent =
        total != null && principal > 0
          ? `${total > 0 ? '+' : total < 0 ? '-' : ''}${Math.abs((total / principal) * 100).toFixed(2)}%`
          : '';
      const holdingProfitValue = total;

      const holdingProfitPercentValue = total != null && principal > 0 ? (total / principal) * 100 : null;
      const hasEstimatePercent = hasTodayEstimate && estimateChangeValue != null;
      const hasHoldingPercent = holdingProfitPercentValue != null;
      const fallbackEstimateProfitPercentValue =
        hasEstimatePercent || hasHoldingPercent
          ? (hasEstimatePercent ? estimateChangeValue : 0) + (hasHoldingPercent ? holdingProfitPercentValue : 0)
          : null;
      const estimateProfitPercentValue = hasTodayData ? holdingProfitPercentValue : fallbackEstimateProfitPercentValue;
      const estimateProfitValue = hasTodayData
        ? total
        : estimateProfitPercentValue != null && principal > 0
          ? principal * (estimateProfitPercentValue / 100)
          : null;
      const estimateProfit =
        estimateProfitValue == null
          ? ''
          : `${estimateProfitValue > 0 ? '+' : estimateProfitValue < 0 ? '-' : ''}${formatMoney(Math.abs(estimateProfitValue))}`;
      const estimateProfitPercent =
        estimateProfitPercentValue == null
          ? ''
          : `${estimateProfitPercentValue > 0 ? '+' : ''}${estimateProfitPercentValue.toFixed(2)}%`;

      const addBaseNavRaw = f.addBaseNav != null && f.addBaseNav !== '' ? Number(f.addBaseNav) : null;
      const addBaseNav =
        addBaseNavRaw != null && Number.isFinite(addBaseNavRaw) && addBaseNavRaw > 0 ? addBaseNavRaw : null;
      const sinceAddedCurrentNav = (() => {
        if (f.noValuation) {
          const v = Number(f.dwjz);
          return Number.isFinite(v) && v > 0 ? v : null;
        }
        const v = Number(f.gsz);
        return Number.isFinite(v) && v > 0 ? v : null;
      })();
      const sinceAddedChangeValue =
        addBaseNav != null && sinceAddedCurrentNav != null ? (sinceAddedCurrentNav / addBaseNav - 1) * 100 : null;
      const sinceAddedChangePercent =
        sinceAddedChangeValue == null
          ? '—'
          : `${sinceAddedChangeValue > 0 ? '+' : ''}${sinceAddedChangeValue.toFixed(2)}%`;
      const sinceAddedDateRaw = (() => {
        const raw = f.addBaseDate;
        const rawStr = raw != null ? String(raw) : '';
        if (/^\d{4}-\d{2}-\d{2}/.test(rawStr)) return rawStr.slice(0, 10);
        const ts = Number(f.addedAt);
        if (Number.isFinite(ts) && ts > 0) return dayjs.tz(ts, TZ).format('YYYY-MM-DD');
        return '';
      })();
      const sinceAddedDate = (() => {
        const raw = sinceAddedDateRaw || '';
        if (!raw) return '';
        const currentYear = isString(todayStr) && todayStr.length >= 4 ? todayStr.slice(0, 4) : '';
        if (currentYear && raw.startsWith(`${currentYear}-`) && raw.length >= 10) return raw.slice(5);
        return raw;
      })();

      const fc = String(f.code ?? '').trim();
      const listFromDerived = fundTagListsByCode[fc];
      const fundTags = isArray(listFromDerived)
        ? listFromDerived.map(({ name, theme }) => ({
            name: String(name ?? '').trim(),
            theme: normalizeFundTagTheme(theme)
          }))
        : [];

      return {
        rawFund: f,
        code: f.code,
        fundName: f.name,
        fundTags,
        isHoldingLinked: !!isHoldingLinked,
        isUpdated: isNavUpdated(f.jzrq, todayStr, f.confirmDays),
        hasDca: dcaPlansForTab[f.code]?.enabled === true,
        hasPending: pendingCodesForTab.has(f.code),
        latestNav,
        latestNavDate: yesterdayDate,
        estimateNav,
        estimateNavDate: estimateTime,
        yesterdayChangePercent,
        yesterdayChangeValue,
        yesterdayDate,
        estimateChangePercent,
        estimateChangeValue,
        estimateChangeMuted: f.noValuation,
        estimateTime,
        hasTodayEstimate,
        totalChangePercent: estimateProfitPercent,
        estimateProfit,
        estimateProfitValue,
        estimateProfitPercent,
        sinceAddedChangePercent,
        sinceAddedChangeValue,
        sinceAddedDate,
        sinceAddedDateRaw: sinceAddedDateRaw || undefined,
        holdingAmount,
        holdingAmountValue,
        holdingRatioValue,
        holdingCost,
        holdingCostValue,
        costNav,
        costNavValue,
        holdingDaysValue,
        todayProfit,
        todayProfitPercent,
        todayProfitValue,
        yesterdayProfit,
        yesterdayProfitValue: yesterdayProfitVal,
        yesterdayProfitPercent: yesterdayProfitPercentLine,
        yesterdaySecondLinePctValue,
        holdingProfit,
        holdingProfitPercent,
        holdingProfitValue,
        holdingTargetGroupId: currentTab === SUMMARY_TAB_ID ? summaryHoldingSourceGroupByCode[f.code] : undefined
      };
    });
  }, [
    displayFunds,
    holdingsForTabWithLinked,
    isTradingDay,
    todayStr,
    getHoldingProfitForTab,
    dcaPlansForTab,
    pendingCodesForTab,
    latestDailyByCode,
    currentTab,
    summaryHoldingSourceGroupByCode,
    linkedHoldingsForAllFav,
    fundTagListsByCode,
    groupTotalHoldingAmount
  ]);

  return {
    latestDailyByCode,
    groupTotalHoldingAmount,
    pendingCodesForTab,
    pcFundTableData
  };
}
