import { useMemo, useDeferredValue } from 'react';
import { isArray, isNumber, isString } from 'lodash';
import dayjs from 'dayjs';
import { isNavUpdated } from '../../lib/fundHelpers';
import { SUMMARY_TAB_ID } from '@/app/constants';

/**
 * 纯派生 Hook：从 page.jsx 抽离的「过滤 + 排序后的展示基金列表」。
 *
 * 设计约束（行为保持）：
 * - 纯函数式：数据由参数传入，内部不订阅 store、不调用 setter。
 * - displayFundsRaw 的过滤/排序逻辑与依赖数组与原 page.jsx 完全一致。
 * - 偏离源计划签名：scopedFunds 与 fundExtraDataByCode 的 fetch effect 保留在 page.jsx
 *   （scopedFunds 被 fetch effect 依赖、且需在其声明前可用），scopedFunds 作为入参传入，
 *   hook 仅产出 displayFundsRaw / displayFunds。详见 doc/page-refactor-dependency-map.md。
 */
export function useFundDisplayList({
  scopedFunds,
  currentTab,
  groups,
  sortBy,
  sortOrder,
  holdingsForTabWithLinked,
  getHoldingProfitForTab,
  deferredGroupFundSearchTerm,
  shouldShowGroupFundSearch,
  currentFundDailyEarnings,
  fundExtraDataByCode,
  todayStr,
  fundTagListsByCode
}) {
  // 过滤和排序后的基金列表（包含“列表搜索”过滤）
  const displayFundsRaw = useMemo(() => {
    let filtered = [...scopedFunds];

    const q = String(shouldShowGroupFundSearch ? (deferredGroupFundSearchTerm ?? '') : '').trim();
    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter((f) => {
        const name = String(f?.name ?? '').toLowerCase();
        const code = String(f?.code ?? '').toLowerCase();
        let hasTagMatch = false;
        if (f?.code && Array.isArray(fundTagListsByCode?.[f.code])) {
          hasTagMatch = fundTagListsByCode[f.code].some(
            (t) => t?.name && String(t.name).toLowerCase().includes(qLower)
          );
        }
        return name.includes(qLower) || code.includes(qLower) || hasTagMatch;
      });
    }

    if (currentTab !== 'all' && currentTab !== 'fav' && currentTab !== SUMMARY_TAB_ID && sortBy === 'default') {
      const group = groups.find((g) => g.id === currentTab);
      if (group && group.codes) {
        const codeMap = new Map(group.codes.map((code, index) => [code, index]));
        filtered.sort((a, b) => {
          const indexA = codeMap.get(a.code) ?? Number.MAX_SAFE_INTEGER;
          const indexB = codeMap.get(b.code) ?? Number.MAX_SAFE_INTEGER;
          return indexA - indexB;
        });
      }
    }

    const profitByCode =
      sortBy === 'holdingAmount' || sortBy === 'holdingRatio' || sortBy === 'todayProfit' || sortBy === 'holding'
        ? new Map(filtered.map((f) => [f.code, getHoldingProfitForTab(f, holdingsForTabWithLinked[f.code])]))
        : null;

    const estimateProfitByCode =
      sortBy === 'estimateProfit'
        ? new Map(
            filtered.map((f) => {
              const hasTodayData = isNavUpdated(f.jzrq, todayStr, f.confirmDays);
              const holding = holdingsForTabWithLinked[f.code];
              const profit = getHoldingProfitForTab(f, holding);
              const total = profit ? profit.profitTotal : null;
              if (hasTodayData) return [f.code, total];

              const principal =
                holding && isNumber(holding.cost) && isNumber(holding.share) ? holding.cost * holding.share : 0;
              const hasTodayEstimate = !f.noValuation && isString(f.gztime) && f.gztime.startsWith(todayStr);
              const estimateChangeValue = f.noValuation ? null : isNumber(f.gszzl) ? Number(f.gszzl) : null;
              const holdingProfitPercentValue = total != null && principal > 0 ? (total / principal) * 100 : null;
              const hasEstimatePercent = hasTodayEstimate && estimateChangeValue != null;
              const hasHoldingPercent = holdingProfitPercentValue != null;
              const fallbackEstimateProfitPercentValue =
                hasEstimatePercent || hasHoldingPercent
                  ? (hasEstimatePercent ? estimateChangeValue : 0) + (hasHoldingPercent ? holdingProfitPercentValue : 0)
                  : null;

              const val =
                fallbackEstimateProfitPercentValue != null && principal > 0
                  ? principal * (fallbackEstimateProfitPercentValue / 100)
                  : null;
              return [f.code, val];
            })
          )
        : null;

    return filtered.sort((a, b) => {
      if (sortBy === 'yield') {
        const getYieldValue = (fund) => {
          // 与 estimateChangePercent 展示逻辑对齐：
          // - noValuation 为 true 一律视为无“估算涨幅”
          // - 仅在 gszzl 为数字时使用 gszzl
          if (fund.noValuation) {
            return { value: 0, hasValue: false };
          }
          if (isNumber(fund.gszzl)) {
            return { value: Number(fund.gszzl), hasValue: true };
          }
          return { value: 0, hasValue: false };
        };

        const { value: valA, hasValue: hasA } = getYieldValue(a);
        const { value: valB, hasValue: hasB } = getYieldValue(b);

        // 无“估算涨幅”展示值（界面为 `—`）的基金统一排在最后
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;

        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'holdingAmount') {
        const pa = profitByCode?.get(a.code);
        const pb = profitByCode?.get(b.code);
        const amountA = pa?.amount ?? Number.NEGATIVE_INFINITY;
        const amountB = pb?.amount ?? Number.NEGATIVE_INFINITY;
        return sortOrder === 'asc' ? amountA - amountB : amountB - amountA;
      }
      if (sortBy === 'holdingRatio') {
        const pa = profitByCode?.get(a.code);
        const pb = profitByCode?.get(b.code);
        const amountA = pa?.amount;
        const amountB = pb?.amount;
        const hasA = amountA != null && Number.isFinite(amountA) && amountA > 0;
        const hasB = amountB != null && Number.isFinite(amountB) && amountB > 0;
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        // holdingRatio sort is equivalent to holdingAmount sort (same denominator within group)
        return sortOrder === 'asc' ? amountA - amountB : amountB - amountA;
      }
      if (sortBy === 'yesterdayIncrease') {
        const valA = Number(a.zzl);
        const valB = Number(b.zzl);
        const hasA = Number.isFinite(valA);
        const hasB = Number.isFinite(valB);

        // 无最新涨幅数据（界面展示为 `—`）的基金统一排在最后
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;

        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'todayProfit') {
        const pa = profitByCode?.get(a.code);
        const pb = profitByCode?.get(b.code);
        const valA = pa?.profitToday;
        const valB = pb?.profitToday;
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);

        // 无当日收益数据的基金统一排在最后
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;

        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'holding') {
        const pa = profitByCode?.get(a.code);
        const pb = profitByCode?.get(b.code);
        const valA = pa?.profitTotal;
        const valB = pb?.profitTotal;
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'estimateProfit') {
        const valA = estimateProfitByCode ? estimateProfitByCode.get(a.code) : null;
        const valB = estimateProfitByCode ? estimateProfitByCode.get(b.code) : null;
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'yesterdayProfit') {
        const getYesterdayProfit = (code, jzrq) => {
          const list = currentFundDailyEarnings?.[code];
          if (!isArray(list) || list.length === 0) return null;
          let matchedDaily = null;
          if (isString(jzrq)) {
            if (jzrq === todayStr) {
              for (let i = list.length - 1; i >= 0; i--) {
                if (list[i]?.date && list[i].date < todayStr) {
                  matchedDaily = list[i];
                  break;
                }
              }
            } else {
              for (const item of list) {
                if (item?.date === jzrq) {
                  matchedDaily = item;
                  break;
                }
              }
            }
          }
          if (!matchedDaily && jzrq !== todayStr) matchedDaily = list[list.length - 1];
          return matchedDaily && Number.isFinite(Number(matchedDaily.earnings)) ? Number(matchedDaily.earnings) : null;
        };
        const valA = getYesterdayProfit(a.code, a.jzrq);
        const valB = getYesterdayProfit(b.code, b.jzrq);
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'holdingDays') {
        const ha = holdingsForTabWithLinked[a.code];
        const hb = holdingsForTabWithLinked[b.code];
        const valA = ha?.firstPurchaseDate ? dayjs(todayStr).diff(dayjs(ha.firstPurchaseDate), 'day') : null;
        const valB = hb?.firstPurchaseDate ? dayjs(todayStr).diff(dayjs(hb.firstPurchaseDate), 'day') : null;
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'holdingCost') {
        const getCost = (h) =>
          h?.cost != null && h?.share != null && Number.isFinite(Number(h.cost)) && Number.isFinite(Number(h.share))
            ? Number(h.cost) * Number(h.share)
            : null;
        const valA = getCost(holdingsForTabWithLinked[a.code]);
        const valB = getCost(holdingsForTabWithLinked[b.code]);
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'sinceAddedChangePercent') {
        const getSinceAddedChangeValue = (f) => {
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
          return addBaseNav != null && sinceAddedCurrentNav != null
            ? (sinceAddedCurrentNav / addBaseNav - 1) * 100
            : null;
        };
        const valA = getSinceAddedChangeValue(a);
        const valB = getSinceAddedChangeValue(b);
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'consecutiveTrend') {
        const getTrendValue = (code) => {
          const trend = fundExtraDataByCode[code]?.consecutiveTrend;
          if (!trend || !Number.isFinite(trend.days)) return 0;
          return trend.type === 'up' ? trend.days : -trend.days;
        };
        const valA = getTrendValue(a.code);
        const valB = getTrendValue(b.code);
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (['last1Week', 'last1Month', 'last3Months', 'last6Months', 'last1Year'].includes(sortBy)) {
        const keyMap = {
          last1Week: 'week',
          last1Month: 'month',
          last3Months: 'month3',
          last6Months: 'month6',
          last1Year: 'year1'
        };
        const key = keyMap[sortBy];
        const valA = fundExtraDataByCode[a.code]?.[key];
        const valB = fundExtraDataByCode[b.code]?.[key];
        const hasA = valA != null && Number.isFinite(valA);
        const hasB = valB != null && Number.isFinite(valB);
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (sortBy === 'tags') {
        const getTagKey = (fund) => {
          const code = String(fund?.code ?? '').trim();
          const list = code ? fundTagListsByCode?.[code] : null;
          if (!isArray(list) || list.length === 0) return '';
          return list
            .map((t) => (t?.name != null ? String(t.name).trim() : ''))
            .filter(Boolean)
            .join('、');
        };
        const keyA = getTagKey(a);
        const keyB = getTagKey(b);
        const hasA = !!keyA;
        const hasB = !!keyB;
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1;
        if (!hasB) return -1;
        return sortOrder === 'asc' ? keyA.localeCompare(keyB, 'zh-CN') : keyB.localeCompare(keyA, 'zh-CN');
      }
      if (sortBy === 'name') {
        const nameA = a.name ?? '';
        const nameB = b.name ?? '';
        return sortOrder === 'asc' ? nameA.localeCompare(nameB, 'zh-CN') : nameB.localeCompare(nameA, 'zh-CN');
      }
      return 0;
    });
  }, [
    scopedFunds,
    currentTab,
    groups,
    sortBy,
    sortOrder,
    holdingsForTabWithLinked,
    getHoldingProfitForTab,
    deferredGroupFundSearchTerm,
    shouldShowGroupFundSearch,
    currentFundDailyEarnings,
    fundExtraDataByCode,
    todayStr,
    fundTagListsByCode
  ]);

  const displayFunds = useDeferredValue(displayFundsRaw);

  return {
    displayFundsRaw,
    displayFunds
  };
}
