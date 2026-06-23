import { useMemo } from 'react';
import { isArray, isNumber, isPlainObject } from 'lodash';
import { migrateDcaPlansToScoped } from '../../lib/fundHelpers';
import { DCA_SCOPE_GLOBAL, SUMMARY_TAB_ID, SUMMARY_SOURCE_GLOBAL, DAILY_EARNINGS_SCOPE_ALL } from '@/app/constants';

/**
 * 纯派生 Hook：从 page.jsx 抽离的「投资组合作用域」派生数据。
 *
 * 设计约束（行为保持）：
 * - 纯函数式：所有数据通过参数传入，内部不订阅 store、不调用任何 setter。
 * - 写副作用（清理 linked 全局 fundDailyEarnings）由独立的 usePortfolioScopeCleanup 承担。
 * - 偏离源计划签名一处：`activeGroupId` 改为**入参**而非返回值。
 *   原因：activeGroupId 仅依赖 currentTab + groups，且必须在 useHoldingProfit /
 *   useSummaryCalculations（本 Hook 的输入来源）之前算出，因此保留在 page.jsx 原位，
 *   作为参数传入，避免环形顺序。详见 doc/page-refactor-dependency-map.md。
 *
 * 各 useMemo 的依赖数组与原 page.jsx 完全一致。
 */
export function usePortfolioScope({
  currentTab,
  activeGroupId,
  groups,
  funds,
  holdings,
  groupHoldings,
  dcaPlans,
  transactions,
  fundDailyEarnings,
  summaryMergedHoldings,
  summaryHoldingSourceGroupByCode,
  groupsWithHoldings,
  getHoldingProfit
}) {
  /**
   * 全部/自选：当全局 holdings 无该基金持仓，但自定义分组存在持仓时，
   * 仅用于展示地将其它分组的持仓汇总到当前 tab（不写入 localStorage）。
   */
  const linkedHoldingsForAllFav = useMemo(() => {
    const enabled = (currentTab === 'all' || currentTab === 'fav') && !activeGroupId;
    if (!enabled) return { derived: {}, linked: new Set(), groupIdsByCode: {} };

    const derived = {};
    const linked = new Set();
    const groupIdsByCode = {};

    const hasGlobalHolding = (h) => !!h && isNumber(h.share) && Number(h.share) > 0;

    for (const fund of funds || []) {
      const code = fund?.code;
      if (!code) continue;
      if (hasGlobalHolding(holdings?.[code])) continue;

      let totalShare = 0;
      let totalCostShare = 0;
      let hasAnyCost = false;
      const sourceGroupIds = [];

      for (const g of groups || []) {
        const gid = g?.id;
        if (!gid) continue;
        const h = groupHoldings?.[gid]?.[code];
        if (!h) continue;
        const s = Number(h.share);
        if (!Number.isFinite(s) || s <= 0) continue;
        sourceGroupIds.push(gid);
        totalShare += s;

        const c = h.cost == null || h.cost === '' ? null : Number(h.cost);
        if (c != null && Number.isFinite(c) && c > 0) {
          totalCostShare += c * s;
          hasAnyCost = true;
        }
      }

      if (totalShare > 0) {
        derived[code] = {
          share: totalShare,
          cost: hasAnyCost ? totalCostShare / totalShare : null
        };
        linked.add(code);
        groupIdsByCode[code] = sourceGroupIds;
      }
    }

    return { derived, linked, groupIdsByCode };
  }, [currentTab, activeGroupId, funds, holdings, groupHoldings, groups]);

  // 依赖数组与原 page.jsx 完全一致（刻意省略 groupHoldings 以保留原重算时机）。
  // React Compiler 的 preserve-manual-memoization 会因 deps 未覆盖全部读取而报错，
  // 此处禁用以保持行为不变；exhaustive-deps 警告保留（与原 page.jsx 一致）。
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const currentFundDailyEarnings = useMemo(() => {
    if (!isPlainObject(fundDailyEarnings)) return {};

    const getScopeBucket = (scopeKey) => {
      const scoped = fundDailyEarnings[scopeKey];
      return isPlainObject(scoped) ? scoped : {};
    };

    if (activeGroupId) {
      return getScopeBucket(activeGroupId);
    }

    if (currentTab === SUMMARY_TAB_ID) {
      const out = {};
      Object.entries(summaryHoldingSourceGroupByCode || {}).forEach(([code, source]) => {
        const scopeKey = source === SUMMARY_SOURCE_GLOBAL ? DAILY_EARNINGS_SCOPE_ALL : source;
        const bucket = getScopeBucket(scopeKey);
        const list = bucket[code];
        if (isArray(list) && list.length > 0) out[code] = list;
      });
      return out;
    }

    const globalBucket = getScopeBucket(DAILY_EARNINGS_SCOPE_ALL);

    if (currentTab !== 'all' && currentTab !== 'fav') {
      return globalBucket;
    }

    const linkedCodes = linkedHoldingsForAllFav?.linked;
    if (!(linkedCodes instanceof Set) || linkedCodes.size === 0) {
      return globalBucket;
    }

    const out = { ...globalBucket };
    const groupIdsByCode = linkedHoldingsForAllFav?.groupIdsByCode || {};

    for (const code of linkedCodes) {
      const groupIds = isArray(groupIdsByCode[code]) ? groupIdsByCode[code] : [];
      if (groupIds.length === 0) continue;

      let fallbackPrincipalCurrent = 0;
      for (const gid of groupIds) {
        const h = groupHoldings?.[gid]?.[code];
        if (!h) continue;
        const share = Number(h.share);
        const cost = Number(h.cost);
        if (!Number.isFinite(share) || share <= 0) continue;
        if (!Number.isFinite(cost) || cost <= 0) continue;
        fallbackPrincipalCurrent += cost * share;
      }

      const byDate = new Map();
      for (const gid of groupIds) {
        const bucket = getScopeBucket(gid);
        const list = bucket[code];
        if (!isArray(list) || list.length === 0) continue;

        for (const item of list) {
          const date = item?.date ? String(item.date) : '';
          const earnings = Number(item?.earnings);
          const rate = Number(item?.rate);
          const baseCostAmount = Number(item?.baseCostAmount);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
          if (!Number.isFinite(earnings)) continue;
          const prev = byDate.get(date) || {
            earnings: 0,
            rowCount: 0,
            singleRate: null,
            rateCount: 0,
            baseCostAmount: 0
          };
          prev.earnings += earnings;
          prev.rowCount += 1;
          if (Number.isFinite(rate)) {
            prev.rateCount += 1;
            if (prev.singleRate == null) prev.singleRate = rate;
          }
          if (Number.isFinite(baseCostAmount) && baseCostAmount > 0) {
            prev.baseCostAmount += baseCostAmount;
          }
          byDate.set(date, prev);
        }
      }

      if (byDate.size > 0) {
        out[code] = [...byDate.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, row]) => {
            const earnings = row.earnings;
            const baseCostAmount =
              Number.isFinite(row.baseCostAmount) && row.baseCostAmount > 0 ? row.baseCostAmount : null;
            let rate = null;
            if (baseCostAmount != null) {
              rate = (earnings / baseCostAmount) * 100;
            } else if (row.rowCount === 1 && row.rateCount === 1 && Number.isFinite(row.singleRate)) {
              rate = row.singleRate;
            } else if (Number.isFinite(fallbackPrincipalCurrent) && fallbackPrincipalCurrent > 0) {
              // 兼容旧数据：历史记录缺少快照且无 rate 时，用当前关联持仓成本兜底展示
              rate = (earnings / fallbackPrincipalCurrent) * 100;
            }
            return { date, earnings, rate, baseCostAmount };
          });
      }
    }

    return out;
  }, [fundDailyEarnings, activeGroupId, currentTab, summaryHoldingSourceGroupByCode, linkedHoldingsForAllFav]);

  const portfolioDailySeries = useMemo(() => {
    if (!isPlainObject(fundDailyEarnings)) return [];
    const byDate = new Map();
    Object.values(fundDailyEarnings).forEach((bucket) => {
      if (!isPlainObject(bucket)) return;
      Object.values(bucket).forEach((list) => {
        if (!isArray(list) || list.length === 0) return;
        list.forEach((item) => {
          const date = item?.date ? String(item.date) : '';
          const earnings = Number(item?.earnings);
          const baseCostAmount = Number(item?.baseCostAmount);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
          if (!Number.isFinite(earnings)) return;

          const prev = byDate.get(date) || { earnings: 0, baseCostAmount: 0 };
          prev.earnings += earnings;
          if (Number.isFinite(baseCostAmount) && baseCostAmount > 0) {
            prev.baseCostAmount += baseCostAmount;
          }
          byDate.set(date, prev);
        });
      });
    });
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        date,
        earnings: data.earnings,
        baseCostAmount: data.baseCostAmount > 0 ? data.baseCostAmount : null,
        rate: null
      }));
  }, [fundDailyEarnings]);

  const holdingsForTabWithLinked = useMemo(() => {
    if (currentTab === SUMMARY_TAB_ID) return summaryMergedHoldings;
    if (activeGroupId) return groupHoldings[activeGroupId] || {};
    if (currentTab !== 'all' && currentTab !== 'fav') return holdings;
    const derived = linkedHoldingsForAllFav.derived || {};
    const keys = Object.keys(derived);
    if (keys.length === 0) return holdings;
    return { ...(holdings || {}), ...derived };
  }, [currentTab, activeGroupId, summaryMergedHoldings, holdings, groupHoldings, linkedHoldingsForAllFav]);

  const dcaPlansForTab = useMemo(() => {
    const scoped = migrateDcaPlansToScoped(dcaPlans);
    const bucket = scoped[activeGroupId || DCA_SCOPE_GLOBAL];
    return isPlainObject(bucket) ? bucket : {};
  }, [dcaPlans, activeGroupId]);

  const transactionsForTab = useMemo(() => {
    if (!activeGroupId) return transactions;
    const out = {};
    Object.entries(transactions || {}).forEach(([code, list]) => {
      if (!isArray(list)) return;
      const filtered = list.filter((t) => t.groupId === activeGroupId);
      if (filtered.length) out[code] = filtered;
    });
    return out;
  }, [transactions, activeGroupId]);

  const groupById = useMemo(() => {
    const map = new Map();
    for (const g of groups || []) {
      if (!g?.id) continue;
      map.set(g.id, g);
    }
    return map;
  }, [groups]);

  const getScopedGroupId = (groupIdOverride) =>
    groupIdOverride !== undefined ? groupIdOverride : activeGroupId || null;

  const getScopedHolding = (code, groupIdOverride) => {
    if (!code) return undefined;
    if (groupIdOverride !== undefined) {
      return groupIdOverride ? groupHoldings?.[groupIdOverride]?.[code] : holdings?.[code];
    }
    if (activeGroupId) return groupHoldings?.[activeGroupId]?.[code];
    return holdingsForTabWithLinked?.[code];
  };

  const getScopedDcaPlan = (code, groupIdOverride) => {
    if (!code) return undefined;
    const scope = getScopedGroupId(groupIdOverride) || DCA_SCOPE_GLOBAL;
    const scoped = migrateDcaPlansToScoped(dcaPlans);
    return scoped?.[scope]?.[code];
  };

  const activeGroupCodeSet = useMemo(() => {
    if (currentTab === SUMMARY_TAB_ID) {
      const fundByCode = new Map((isArray(funds) ? funds : []).map((f) => [f.code, f]));
      const set = new Set();
      Object.entries(holdings || {}).forEach(([code, h]) => {
        const fund = fundByCode.get(code);
        if (!fund || !h) return;
        const p = getHoldingProfit(fund, h, null);
        if (p && Number.isFinite(p.amount) && p.amount > 0) set.add(code);
      });
      for (const g of groupsWithHoldings) {
        for (const c of g.codes || []) set.add(c);
      }
      return set;
    }
    if (currentTab === 'all' || currentTab === 'fav') return null;
    const group = groupById.get(currentTab);
    if (!group || !isArray(group.codes)) return null;
    return new Set(group.codes);
  }, [currentTab, groupById, groupsWithHoldings, funds, holdings, getHoldingProfit]);

  return {
    linkedHoldingsForAllFav,
    currentFundDailyEarnings,
    portfolioDailySeries,
    holdingsForTabWithLinked,
    dcaPlansForTab,
    transactionsForTab,
    groupById,
    getScopedGroupId,
    getScopedHolding,
    getScopedDcaPlan,
    activeGroupCodeSet
  };
}
