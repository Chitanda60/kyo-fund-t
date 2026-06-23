import { isArray, isNumber, isObject, isPlainObject } from 'lodash';
import { useStorageStore, useModalStore } from '../../stores';
import {
  migrateDcaPlansToScoped,
  cloneHoldingDeep,
  getFundCodesFromTagRecord,
  sanitizeTagRowForStorage,
  serializeTagRecordsForCompare
} from '../../lib/fundHelpers';
import { DCA_SCOPE_GLOBAL, DAILY_EARNINGS_SCOPE_ALL } from '@/app/constants';
import { clearFund } from '../../lib/valuationTimeseries';

/**
 * 基金增删/移动动作 Hook（mutation）：从 page.jsx 抽离 reorder / remove / bulk-remove /
 * move-funds 以及二次确认请求逻辑。
 *
 * 设计约束（行为保持）：
 * - 按计划：currentTab / setCurrentTab / displayFunds / setFundTagRecords / strip 辅助 /
 *   showToast / 详情关闭 ref 作为入参（非 Zustand 或本地态）。新增 storageHelper 入参
 *   （removeFund/removeFundsBulk 用其 setItem('tags', ...) 写入并触发云同步）。
 * - 存储 setter/数据在每个函数顶部由 useStorageStore.getState() 解构（zustand setter 引用稳定、
 *   函数式更新在提交时读 store；事件处理器中直接读取与渲染期一致），函数体与原 page.jsx 一致。
 * - 弹框走 useModalStore.setState（本地 helper，仅以普通对象调用）。
 * - 这些 handler 在原 page.jsx 中均为每渲染重建的普通函数，此处保持一致（非 useCallback）。
 */
export function useFundMutations({
  currentTab,
  setCurrentTab,
  displayFunds,
  setFundTagRecords,
  storageHelper,
  stripFundFromGroupScope,
  stripManyFundsFromGroupScope,
  showToast,
  fundDetailDrawerCloseRef,
  fundDetailDialogCloseRef
}) {
  const setFundDeleteConfirm = (v) => useModalStore.setState({ fundDeleteConfirm: v });
  const setFundDeleteBulkConfirm = (v) => useModalStore.setState({ fundDeleteBulkConfirm: v });

  const handleReorder = (oldIndex, newIndex) => {
    const { funds, groups, setFunds, setGroups } = useStorageStore.getState();
    const movedItem = displayFunds[oldIndex];
    const targetItem = displayFunds[newIndex];
    if (!movedItem || !targetItem) return;

    if (currentTab === 'all' || currentTab === 'fav') {
      const newFunds = [...funds];
      const fromIndex = newFunds.findIndex((f) => f.code === movedItem.code);

      if (fromIndex === -1) return;

      // Remove moved item
      const [removed] = newFunds.splice(fromIndex, 1);

      // Find target index in the array (after removal)
      const toIndex = newFunds.findIndex((f) => f.code === targetItem.code);

      if (toIndex === -1) {
        // If target not found (should not happen), put it back
        newFunds.splice(fromIndex, 0, removed);
        return;
      }

      if (oldIndex < newIndex) {
        // Moving down, insert after target
        newFunds.splice(toIndex + 1, 0, removed);
      } else {
        // Moving up, insert before target
        newFunds.splice(toIndex, 0, removed);
      }

      setFunds(newFunds);
    } else {
      const groupIndex = groups.findIndex((g) => g.id === currentTab);
      if (groupIndex > -1) {
        const group = groups[groupIndex];
        const newCodes = [...group.codes];
        const fromIndex = newCodes.indexOf(movedItem.code);
        const toIndex = newCodes.indexOf(targetItem.code);

        if (fromIndex !== -1 && toIndex !== -1) {
          newCodes.splice(fromIndex, 1);
          newCodes.splice(toIndex, 0, movedItem.code);

          const newGroups = [...groups];
          newGroups[groupIndex] = { ...group, codes: newCodes };
          setGroups(newGroups);
        }
      }
    }
  };

  const requestRemoveFund = (fund) => {
    const { groups, groupHoldings, pendingTrades, dcaPlans, transactions, holdings } = useStorageStore.getState();
    const gid =
      currentTab !== 'all' && currentTab !== 'fav' && groups.some((g) => g.id === currentTab) ? currentTab : null;

    if (gid) {
      const gh = groupHoldings[gid]?.[fund.code];
      const hasGroupHolding = gh && isNumber(gh.share) && gh.share > 0;
      const hasGroupPending = pendingTrades.some((t) => t.fundCode === fund.code && t.groupId === gid);
      const scoped = migrateDcaPlansToScoped(dcaPlans);
      const hasGroupDca = !!scoped[gid]?.[fund.code];
      const txList = transactions[fund.code] || [];
      const hasGroupTx = txList.some((t) => t.groupId === gid);
      const needsConfirm = hasGroupHolding || hasGroupPending || hasGroupDca || hasGroupTx;
      if (needsConfirm) {
        setFundDeleteConfirm({ code: fund.code, name: fund.name, scope: 'group', groupId: gid });
      } else {
        fundDetailDrawerCloseRef.current?.();
        fundDetailDialogCloseRef.current?.();
        stripFundFromGroupScope(fund.code, gid);
      }
      return;
    }

    const h = holdings[fund.code];
    const hasGlobalHolding = h && isNumber(h.share) && h.share > 0;
    const hasGroupHolding = Object.values(groupHoldings || {}).some(
      (b) => b && b[fund.code] && isNumber(b[fund.code].share) && b[fund.code].share > 0
    );
    const hasHolding = hasGlobalHolding || hasGroupHolding;
    const otherGroups = groups.filter((g) => g.codes.includes(fund.code)).map((g) => g.name);
    if (hasHolding || otherGroups.length > 0) {
      setFundDeleteConfirm({ code: fund.code, name: fund.name, scope: 'global', otherGroups });
    } else {
      fundDetailDrawerCloseRef.current?.();
      fundDetailDialogCloseRef.current?.();
      removeFund(fund.code);
    }
  };

  /** @returns {boolean|void} false 表示已弹出二次确认，由确认成功回调再清空选中；true 表示已立即执行，调用方可清空多选 */
  const requestRemoveFundsFromCurrentGroup = (codes) => {
    const { groups, dcaPlans, groupHoldings, pendingTrades, transactions, holdings, funds } =
      useStorageStore.getState();
    const gid =
      currentTab !== 'all' && currentTab !== 'fav' && groups.some((g) => g.id === currentTab) ? currentTab : null;
    const list = Array.from(new Set((codes || []).filter(Boolean)));
    if (list.length === 0) return true;

    if (gid) {
      const scoped = migrateDcaPlansToScoped(dcaPlans);
      const needsConfirm = list.some((code) => {
        const gh = groupHoldings[gid]?.[code];
        const hasGroupHolding = gh && isNumber(gh.share) && gh.share > 0;
        const hasGroupPending = pendingTrades.some((t) => t.fundCode === code && t.groupId === gid);
        const hasGroupDca = !!scoped[gid]?.[code];
        const txList = transactions[code] || [];
        const hasGroupTx = txList.some((t) => t.groupId === gid);
        return hasGroupHolding || hasGroupPending || hasGroupDca || hasGroupTx;
      });

      if (needsConfirm) {
        setFundDeleteBulkConfirm({ codes: list, groupId: gid, count: list.length, scope: 'group' });
        return false;
      }

      fundDetailDrawerCloseRef.current?.();
      fundDetailDialogCloseRef.current?.();
      stripManyFundsFromGroupScope(list, gid);
      showToast(`已从当前分组移除 ${list.length} 支基金`, 'success');
      return true;
    }

    // 全部 / 自选：与单条删除、移动端批量删除作用域一致
    const fundsWithOtherGroups = [];
    for (const code of list) {
      const otherGroupNames = groups.filter((g) => g.codes.includes(code)).map((g) => g.name);
      if (otherGroupNames.length > 0) {
        const meta = funds.find((f) => f.code === code);
        fundsWithOtherGroups.push({
          code,
          name: meta?.name || code,
          otherGroups: otherGroupNames
        });
      }
    }
    const needsGlobalConfirm = list.some((code) => {
      const h = holdings[code];
      const hasGlobalHolding = h && isNumber(h.share) && h.share > 0;
      const hasGroupHolding = Object.values(groupHoldings || {}).some(
        (b) => b && b[code] && isNumber(b[code].share) && b[code].share > 0
      );
      return hasGlobalHolding || hasGroupHolding;
    });

    if (needsGlobalConfirm || fundsWithOtherGroups.length > 0) {
      setFundDeleteBulkConfirm({ codes: list, count: list.length, scope: 'global', fundsWithOtherGroups });
      return false;
    }

    fundDetailDrawerCloseRef.current?.();
    fundDetailDialogCloseRef.current?.();
    removeFundsBulk(list);
    showToast(`已删除 ${list.length} 支基金`, 'success');
    return true;
  };

  /** PC / 移动端列表共用：批量删除当前 Tab 下选中基金（与 PcFundTable onRemoveFunds 一致） */
  const removeFundsFromCurrentTabHandler = (codes) => requestRemoveFundsFromCurrentGroup(codes);

  /**
   * 批量迁移分组（含持仓/交易/待处理/定投等分组作用域数据）
   *
   * - fromTab: 'all' | 'fav' | groupId
   * - targetId: 'all' | groupId
   * - dryRun: 仅检测目标是否存在持仓数据冲突
   * - overwrite: 冲突时是否覆盖目标持仓数据
   */
  const handleMoveFunds = async ({ codes, fromTab, targetId, dryRun = false, overwrite = false } = {}) => {
    const {
      groups,
      groupHoldings,
      holdings,
      setGroups,
      setHoldings,
      setGroupHoldings,
      setPendingTrades,
      setTransactions,
      setDcaPlans,
      setFundDailyEarnings
    } = useStorageStore.getState();
    const list = Array.from(new Set((codes || []).filter(Boolean)));
    if (list.length === 0) return { conflicts: [] };

    const isCustomTab = (tab) => tab && tab !== 'all' && tab !== 'fav' && groups.some((g) => g?.id === tab);
    const fromGid = isCustomTab(fromTab) ? fromTab : null;
    const toGid = targetId && targetId !== 'all' ? targetId : null;

    if (targetId === 'all') {
      if (!fromGid) return { conflicts: [] };
    } else {
      if (!toGid || !groups.some((g) => g?.id === toGid)) return { conflicts: [] };
      if (toGid === fromGid) return { conflicts: [] };
    }

    const conflicts = [];
    for (const code of list) {
      const hasTargetHolding = toGid ? groupHoldings?.[toGid]?.[code] != null : holdings?.[code] != null;
      if (hasTargetHolding) conflicts.push(code);
    }
    if (dryRun) return { conflicts };
    if (!overwrite && conflicts.length > 0) return { conflicts };

    // 1) groups.codes：维护基金所属分组（仅自定义分组）
    if (fromGid || toGid) {
      setGroups((prev) => {
        const next = (prev || []).map((g) => {
          if (!g?.id) return g;
          if (fromGid && g.id === fromGid) {
            return { ...g, codes: (g.codes || []).filter((c) => !list.includes(c)) };
          }
          if (toGid && g.id === toGid) {
            return { ...g, codes: Array.from(new Set([...(g.codes || []), ...list])) };
          }
          return g;
        });
        return next;
      });
    }

    // 2) holdings / groupHoldings：迁移持仓（支持覆盖确认）
    setHoldings((prev) => {
      const next = { ...(prev || {}) };

      // all/fav -> group：从 global holdings 移出（目标持仓写入 groupHoldings）
      if (!fromGid && toGid) {
        for (const code of list) delete next[code];
        return next;
      }

      // group -> all：从 groupHoldings 写入 global holdings（并在 groupHoldings 中移除）
      if (fromGid && !toGid) {
        const fromBucket = groupHoldings?.[fromGid] || {};
        let changed = false;
        for (const code of list) {
          const fromValue = fromBucket?.[code];
          if (fromValue === undefined) continue;
          if (overwrite || next[code] == null) {
            next[code] = cloneHoldingDeep(fromValue) ?? fromValue;
            changed = true;
          }
        }
        if (!changed) return prev;
        return next;
      }

      // group<->group：global holdings 不参与
      return prev;
    });

    setGroupHoldings((prev) => {
      const next = { ...(prev || {}) };
      const getBucket = (gid) => (next[gid] && isObject(next[gid]) ? { ...next[gid] } : {});

      // 读取源持仓
      const sourceBucket = fromGid ? getBucket(fromGid) : null;
      const targetBucket = toGid ? getBucket(toGid) : null;

      if (toGid) next[toGid] = targetBucket;
      if (fromGid) next[fromGid] = sourceBucket;

      for (const code of list) {
        const fromValue = fromGid ? sourceBucket?.[code] : holdings?.[code];

        // 写入目标（仅在目标为自定义分组时）
        if (toGid) {
          if (overwrite || targetBucket?.[code] == null) {
            targetBucket[code] = cloneHoldingDeep(fromValue) ?? fromValue ?? null;
          }
        }

        // 移除源分组持仓（仅源为自定义分组时；all/fav -> group 的源在 setHoldings 中删）
        if (fromGid && sourceBucket && code in sourceBucket) {
          delete sourceBucket[code];
        }
      }

      return next;
    });

    // 3) pendingTrades：迁移待处理队列（通过 groupId 归属作用域）
    setPendingTrades((prev) => {
      let changed = false;
      const next = (prev || []).map((t) => {
        if (!t?.fundCode) return t;
        if (!list.includes(t.fundCode)) return t;
        const inFromScope = fromGid ? t.groupId === fromGid : !t.groupId;
        if (!inFromScope) return t;
        changed = true;
        if (toGid) return { ...t, groupId: toGid };
        const rest = { ...t };
        delete rest.groupId;
        return rest;
      });
      if (!changed) return prev;
      return next;
    });

    // 4) transactions：迁移交易记录（通过 groupId 归属作用域）
    setTransactions((prev) => {
      const out = { ...(prev || {}) };
      let changed = false;
      for (const code of list) {
        const arr = out?.[code];
        if (!isArray(arr) || arr.length === 0) continue;
        const nextArr = arr.map((tx) => {
          if (!tx) return tx;
          const inFromScope = fromGid ? tx.groupId === fromGid : !tx.groupId;
          if (!inFromScope) return tx;
          changed = true;
          if (toGid) return { ...tx, groupId: toGid };
          const rest = { ...tx };
          delete rest.groupId;
          return rest;
        });
        out[code] = nextArr;
      }
      if (!changed) return prev;
      return out;
    });

    // 5) dcaPlans：迁移定投计划（按 scope 分桶）
    setDcaPlans((prev) => {
      const scoped = migrateDcaPlansToScoped(prev);
      const fromKey = fromGid || DCA_SCOPE_GLOBAL;
      const toKey = toGid || DCA_SCOPE_GLOBAL;
      const fromBucket = scoped[fromKey] && isObject(scoped[fromKey]) ? { ...scoped[fromKey] } : {};
      const toBucket = scoped[toKey] && isObject(scoped[toKey]) ? { ...scoped[toKey] } : {};
      let changed = false;
      for (const code of list) {
        if (fromBucket[code] === undefined) continue;
        toBucket[code] = fromBucket[code];
        delete fromBucket[code];
        changed = true;
      }
      if (!changed) return prev;
      const nextScoped = { ...scoped, [fromKey]: fromBucket, [toKey]: toBucket };
      return nextScoped;
    });

    // 6) fundDailyEarnings：每日收益序列（按 scope 分桶：all + 自定义分组 id）
    setFundDailyEarnings((prev) => {
      const fromKey = fromGid || DAILY_EARNINGS_SCOPE_ALL;
      const toKey = toGid || DAILY_EARNINGS_SCOPE_ALL;
      const base = isPlainObject(prev) ? prev : {};
      const fromBucket = isPlainObject(base[fromKey]) ? { ...base[fromKey] } : {};
      const toBucket = isPlainObject(base[toKey]) ? { ...base[toKey] } : {};
      let changed = false;
      for (const code of list) {
        if (!(code in fromBucket)) continue;
        if (!overwrite && code in toBucket) continue;
        toBucket[code] = fromBucket[code];
        delete fromBucket[code];
        changed = true;
      }
      if (!changed) return prev;
      const next = { ...base, [fromKey]: fromBucket, [toKey]: toBucket };
      return next;
    });

    // 迁移成功后切换到目标分组
    setCurrentTab(targetId === 'all' ? 'all' : targetId);
    showToast('分组迁移完成', 'success');
    return { conflicts: [] };
  };

  const removeFund = (removeCode) => {
    const {
      funds,
      groups,
      setFunds,
      setGroups,
      setCollapsedCodes,
      setCollapsedTrends,
      setCollapsedEarnings,
      setFavorites,
      setHoldings,
      setGroupHoldings,
      setPendingTrades,
      setTransactions,
      setValuationSeries,
      setFundDailyEarnings,
      setDcaPlans
    } = useStorageStore.getState();
    const next = funds.filter((f) => f.code !== removeCode);
    setFunds(next);

    // 同步删除分组中的失效代码
    const nextGroups = groups.map((g) => ({
      ...g,
      codes: g.codes.filter((c) => c !== removeCode)
    }));
    setGroups(nextGroups);

    // 同步删除展开收起状态
    setCollapsedCodes((prev) => {
      if (!prev.has(removeCode)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(removeCode);
      return nextSet;
    });

    // 同步删除业绩走势收起状态
    setCollapsedTrends((prev) => {
      if (!prev.has(removeCode)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(removeCode);
      return nextSet;
    });

    // 同步删除我的收益收起状态
    setCollapsedEarnings((prev) => {
      if (!prev.has(removeCode)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(removeCode);
      return nextSet;
    });

    // 同步删除自选状态
    setFavorites((prev) => {
      if (!prev || !prev.has(removeCode)) return prev;
      const nextSet = new Set(prev);
      nextSet.delete(removeCode);
      if (nextSet.size === 0 && currentTab === 'fav') setCurrentTab('all');
      return nextSet;
    });

    // 同步删除持仓数据
    setHoldings((prev) => {
      if (!prev[removeCode]) return prev;
      const next = { ...prev };
      delete next[removeCode];
      return next;
    });

    setGroupHoldings((prev) => {
      const next = {};
      let changed = false;
      for (const gid of Object.keys(prev || {})) {
        const bucket = { ...(prev[gid] || {}) };
        if (bucket[removeCode]) {
          delete bucket[removeCode];
          changed = true;
        }
        next[gid] = bucket;
      }
      return changed ? next : prev;
    });

    // 同步删除待处理交易
    setPendingTrades((prev) => {
      const next = prev.filter((trade) => trade?.fundCode !== removeCode);
      return next;
    });

    // 同步删除该基金的交易记录
    setTransactions((prev) => {
      if (!prev[removeCode]) return prev;
      const next = { ...prev };
      delete next[removeCode];
      return next;
    });

    // 同步删除该基金的估值分时数据
    clearFund(removeCode);
    setValuationSeries((prev) => {
      if (!(removeCode in prev)) return prev;
      const next = { ...prev };
      delete next[removeCode];
      return next;
    });

    // 同步删除该基金的每日收益数据
    try {
      setFundDailyEarnings((prev) => {
        if (!isPlainObject(prev)) return prev;
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((scopeKey) => {
          const bucket = next[scopeKey];
          if (!isPlainObject(bucket) || !(removeCode in bucket)) return;
          const nb = { ...bucket };
          delete nb[removeCode];
          next[scopeKey] = nb;
          changed = true;
        });
        return changed ? next : prev;
      });
    } catch {}

    // 同步删除该基金的定投计划（所有 scope）
    setDcaPlans((prev) => {
      const scoped = migrateDcaPlansToScoped(prev);
      const nextScoped = {};
      let changed = false;
      for (const [scope, bucket] of Object.entries(scoped)) {
        if (!isPlainObject(bucket)) continue;
        const nb = { ...bucket };
        if (nb[removeCode]) {
          delete nb[removeCode];
          changed = true;
        }
        nextScoped[scope] = nb;
      }
      if (!changed) return prev;
      return nextScoped;
    });

    setFundTagRecords((prev) => {
      const next = prev
        .map((r) => {
          const codes = getFundCodesFromTagRecord(r).filter((c) => c !== removeCode);
          return sanitizeTagRowForStorage({ ...r, fundCodes: codes });
        })
        .filter(Boolean);
      if (serializeTagRecordsForCompare(prev) === serializeTagRecordsForCompare(next)) return prev;
      storageHelper.setItem('tags', JSON.stringify(next));
      return next;
    });
  };

  /** 批量从「全部」逻辑删除多支基金（单次合并更新） */
  const removeFundsBulk = (codes) => {
    const {
      setFunds,
      setGroups,
      setCollapsedCodes,
      setCollapsedTrends,
      setCollapsedEarnings,
      setFavorites,
      setHoldings,
      setGroupHoldings,
      setPendingTrades,
      setTransactions,
      setValuationSeries,
      setFundDailyEarnings,
      setDcaPlans
    } = useStorageStore.getState();
    const set = new Set((codes || []).filter(Boolean));
    if (set.size === 0) return;

    setFunds((prev) => prev.filter((f) => !set.has(f.code)));

    setGroups((prev) => {
      const next = prev.map((g) => ({
        ...g,
        codes: g.codes.filter((c) => !set.has(c))
      }));
      return next;
    });

    setCollapsedCodes((prev) => {
      let nextSet = prev;
      let changed = false;
      for (const c of set) {
        if (nextSet.has(c)) {
          if (!changed) {
            nextSet = new Set(nextSet);
            changed = true;
          }
          nextSet.delete(c);
        }
      }
      return changed ? nextSet : prev;
    });

    setCollapsedTrends((prev) => {
      let nextSet = prev;
      let changed = false;
      for (const c of set) {
        if (nextSet.has(c)) {
          if (!changed) {
            nextSet = new Set(nextSet);
            changed = true;
          }
          nextSet.delete(c);
        }
      }
      return changed ? nextSet : prev;
    });

    setCollapsedEarnings((prev) => {
      let nextSet = prev;
      let changed = false;
      for (const c of set) {
        if (nextSet.has(c)) {
          if (!changed) {
            nextSet = new Set(nextSet);
            changed = true;
          }
          nextSet.delete(c);
        }
      }
      return changed ? nextSet : prev;
    });

    setFavorites((prev) => {
      let nextSet = prev;
      let changed = false;
      for (const c of set) {
        if (nextSet.has(c)) {
          if (!changed) {
            nextSet = new Set(nextSet);
            changed = true;
          }
          nextSet.delete(c);
        }
      }
      if (changed && nextSet.size === 0) {
        setCurrentTab('all');
      }
      return changed ? nextSet : prev;
    });

    setHoldings((prev) => {
      let next = prev;
      let changed = false;
      for (const c of set) {
        if (next[c]) {
          if (!changed) {
            next = { ...prev };
            changed = true;
          }
          delete next[c];
        }
      }
      return changed ? next : prev;
    });

    setGroupHoldings((prev) => {
      const next = {};
      let changed = false;
      for (const gid of Object.keys(prev || {})) {
        const bucket = { ...(prev[gid] || {}) };
        for (const c of set) {
          if (bucket[c]) {
            delete bucket[c];
            changed = true;
          }
        }
        next[gid] = bucket;
      }
      return changed ? next : prev;
    });

    setPendingTrades((prev) => {
      const next = prev.filter((t) => !set.has(t?.fundCode));
      if (next.length === prev.length) return prev;
      return next;
    });

    setTransactions((prev) => {
      let next = prev;
      let changed = false;
      for (const c of set) {
        if (next[c]) {
          if (!changed) {
            next = { ...prev };
            changed = true;
          }
          delete next[c];
        }
      }
      if (changed) {
        // storageHelper.setItem handled by setTransactions
      }
      return changed ? next : prev;
    });

    for (const c of set) {
      clearFund(c);
    }

    setValuationSeries((prev) => {
      let next = prev;
      let changed = false;
      for (const c of set) {
        if (c in next) {
          if (!changed) {
            next = { ...prev };
            changed = true;
          }
          delete next[c];
        }
      }
      return changed ? next : prev;
    });

    try {
      setFundDailyEarnings((prev) => {
        if (!isPlainObject(prev)) return prev;
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((scopeKey) => {
          const bucket = next[scopeKey];
          if (!isPlainObject(bucket)) return;
          let nb = bucket;
          let innerChanged = false;
          for (const c of set) {
            if (c in nb) {
              if (!innerChanged) {
                nb = { ...bucket };
                innerChanged = true;
              }
              delete nb[c];
            }
          }
          if (innerChanged) {
            next[scopeKey] = nb;
            changed = true;
          }
        });
        if (changed) {
          // storageHelper.setItem handled by setFundDailyEarnings
        }
        return changed ? next : prev;
      });
    } catch {
      /* empty */
    }

    setDcaPlans((prev) => {
      const scoped = migrateDcaPlansToScoped(prev);
      let changed = false;
      const nextScoped = {};
      for (const [scope, bucket] of Object.entries(scoped)) {
        if (!isPlainObject(bucket)) continue;
        const nb = { ...bucket };
        for (const c of set) {
          if (nb[c]) {
            delete nb[c];
            changed = true;
          }
        }
        nextScoped[scope] = nb;
      }
      if (!changed) return prev;
      return nextScoped;
    });

    setFundTagRecords((prev) => {
      const next = prev
        .map((r) => {
          const codes = getFundCodesFromTagRecord(r).filter((c) => !set.has(c));
          return sanitizeTagRowForStorage({ ...r, fundCodes: codes });
        })
        .filter(Boolean);
      if (serializeTagRecordsForCompare(prev) === serializeTagRecordsForCompare(next)) return prev;
      storageHelper.setItem('tags', JSON.stringify(next));
      return next;
    });
  };

  return {
    handleReorder,
    requestRemoveFund,
    requestRemoveFundsFromCurrentGroup,
    removeFundsFromCurrentTabHandler,
    handleMoveFunds,
    removeFund,
    removeFundsBulk
  };
}
