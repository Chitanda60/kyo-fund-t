import { useRef } from 'react';
import { isArray, isPlainObject } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { toTz, migrateDcaPlansToScoped } from '../../lib/fundHelpers';
import { DCA_SCOPE_GLOBAL, DAILY_EARNINGS_SCOPE_ALL } from '@/app/constants';
import { normalizePendingTrades, storageStore, useStorageStore, useModalStore } from '../../stores';
import { fetchSmartFundNetValue, fetchSmartFundNetValueBackward } from '../../api/fund';

/**
 * 交易动作 Hook（mutation）：从 page.jsx 抽离的持仓/交易/待处理队列相关写操作。
 *
 * 设计约束（行为保持）：
 * - 按计划：仅 currentTab / groups / getScopedGroupId / showToast 作为入参（非 Zustand 上下文），
 *   存储 setter 与数据通过 useStorageStore.getState() 在回调内读取，弹框走 useModalStore。
 * - 各函数体与原 page.jsx 完全一致；唯一差异是 setter/数据来源由组件级解构改为
 *   函数内 useStorageStore.getState() 解构（zustand setter 引用稳定、函数式更新在提交时读取
 *   store，行为不变），以及 modal setter 改为本地 useModalStore.setState 包装。
 * - isProcessingPendingRef 内置于本 Hook（原 page.jsx 中仅 processPendingQueue 使用）。
 * - 这些 handler 在原 page.jsx 中均为每渲染重建的普通函数（非 useCallback），此处保持一致。
 *
 * 注：本 Hook 内 modal setter 仅以普通对象/null 调用，故本地包装不处理函数式入参。
 */
export function useTradingActions({ currentTab, groups, getScopedGroupId, showToast }) {
  const isProcessingPendingRef = useRef(false);

  const setHoldingModal = (v) => useModalStore.setState({ holdingModal: v });
  const setClearConfirm = (v) => useModalStore.setState({ clearConfirm: v });
  const setAddHistoryModal = (v) => useModalStore.setState({ addHistoryModal: v });
  const setTradeModal = (v) => useModalStore.setState({ tradeModal: v });

  const handleSaveHolding = (code, data, groupIdOverride) => {
    const { setHoldings, setGroupHoldings } = useStorageStore.getState();
    const gid = getScopedGroupId(
      groupIdOverride !== undefined
        ? groupIdOverride
        : currentTab !== 'all' && currentTab !== 'fav' && groups.some((g) => g.id === currentTab)
          ? currentTab
          : null
    );
    if (!gid) {
      setHoldings((prev) => {
        const next = { ...prev };
        if (data.share === null && data.cost === null) {
          delete next[code];
        } else {
          next[code] = data;
        }
        return next;
      });
    } else {
      setGroupHoldings((prev) => {
        const next = { ...prev };
        const bucket = { ...(next[gid] || {}) };
        if (data.share === null && data.cost === null) {
          delete bucket[code];
        } else {
          bucket[code] = data;
        }
        next[gid] = bucket;
        return next;
      });
    }
    setHoldingModal({ open: false, fund: null });
  };

  const handleClearConfirm = () => {
    const { setHoldings, setGroupHoldings, setTransactions, setPendingTrades, setDcaPlans, setFundDailyEarnings } =
      useStorageStore.getState();
    const clearConfirm = useModalStore.getState().clearConfirm;
    if (clearConfirm?.fund) {
      const code = clearConfirm.fund.code;
      const gid = getScopedGroupId(
        clearConfirm.groupId !== undefined
          ? clearConfirm.groupId
          : currentTab !== 'all' && currentTab !== 'fav' && groups.some((g) => g.id === currentTab)
            ? currentTab
            : null
      );
      if (!gid) {
        setHoldings((prev) => {
          const next = { ...prev };
          delete next[code];
          return next;
        });
      } else {
        setGroupHoldings((prev) => {
          const next = { ...prev };
          if (next[gid]) {
            const bucket = { ...next[gid] };
            delete bucket[code];
            next[gid] = bucket;
          }
          return next;
        });
      }

      setTransactions((prev) => {
        const next = { ...(prev || {}) };
        const list = next[code] || [];
        const filtered = list.filter((t) => {
          if (!gid) return t?.groupId;
          return t?.groupId !== gid;
        });
        if (filtered.length) next[code] = filtered;
        else delete next[code];
        return next;
      });

      setPendingTrades((prev) => {
        const next = prev.filter((trade) => {
          if (trade.fundCode !== code) return true;
          return gid ? trade.groupId !== gid : !trade.groupId;
        });
        return next;
      });

      const dcaScope = gid || DCA_SCOPE_GLOBAL;
      setDcaPlans((prev) => {
        const scoped = migrateDcaPlansToScoped(prev);
        if (!scoped[dcaScope]) return prev;
        const next = { ...scoped };
        const bucket = { ...next[dcaScope] };
        delete bucket[code];
        if (Object.keys(bucket).length === 0) {
          delete next[dcaScope];
        } else {
          next[dcaScope] = bucket;
        }
        return next;
      });

      try {
        const earningsScope = gid || DAILY_EARNINGS_SCOPE_ALL;
        setFundDailyEarnings((prev) => {
          if (!isPlainObject(prev) || !isPlainObject(prev[earningsScope]) || !(code in prev[earningsScope]))
            return prev;
          const next = { ...prev, [earningsScope]: { ...prev[earningsScope] } };
          delete next[earningsScope][code];
          return next;
        });
      } catch {}
    }
    setClearConfirm(null);
  };

  const processPendingQueue = async () => {
    if (isProcessingPendingRef.current) return;
    isProcessingPendingRef.current = true;
    try {
      const currentPending = normalizePendingTrades(useStorageStore.getState().pendingTrades);
      if (currentPending.length !== (useStorageStore.getState().pendingTrades || []).length) {
        storageStore.setItem('pendingTrades', JSON.stringify(currentPending));
      }
      if (currentPending.length === 0) return;

      let stateChanged = false;
      let tempHoldings = { ...useStorageStore.getState().holdings };
      let tempGroupHoldings;
      try {
        tempGroupHoldings = JSON.parse(JSON.stringify(useStorageStore.getState().groupHoldings || {}));
      } catch {
        tempGroupHoldings = { ...(useStorageStore.getState().groupHoldings || {}) };
      }
      const processedIds = new Set();
      const newTransactions = [];

      const handledIds = new Set();
      const readCurrent = (fundCode, tradeGid) => {
        if (!tradeGid) {
          return tempHoldings[fundCode] || { share: 0, cost: 0 };
        }
        if (!tempGroupHoldings[tradeGid]) tempGroupHoldings[tradeGid] = {};
        return tempGroupHoldings[tradeGid][fundCode] || { share: 0, cost: 0 };
      };

      const writeCurrent = (fundCode, tradeGid, share, cost, extra = {}) => {
        if (!tradeGid) {
          tempHoldings[fundCode] = { share, cost, ...extra };
        } else {
          if (!tempGroupHoldings[tradeGid]) tempGroupHoldings[tradeGid] = {};
          tempGroupHoldings[tradeGid][fundCode] = { share, cost, ...extra };
        }
      };

      for (const trade of currentPending) {
        if (trade?.id && handledIds.has(trade.id)) continue;
        if (trade?.id) handledIds.add(trade.id);

        const tradeGid = trade.groupId || null;
        let queryDate = trade.date;
        if (trade.isAfter3pm) {
          queryDate = toTz(trade.date).add(1, 'day').format('YYYY-MM-DD');
        }

        // 尝试获取智能净值
        const navOffsetDays = Number(trade.navOffsetDays);
        if (Number.isFinite(navOffsetDays) && navOffsetDays) {
          queryDate = toTz(queryDate).add(navOffsetDays, 'day').format('YYYY-MM-DD');
        }
        const result =
          trade.netValueSearch === 'backward'
            ? await fetchSmartFundNetValueBackward(trade.fundCode, queryDate)
            : await fetchSmartFundNetValue(trade.fundCode, queryDate);

        if (result && result.value > 0) {
          // 成功获取，执行交易
          const current = readCurrent(trade.fundCode, tradeGid);

          let newShare, newCost;
          let tradeShare = 0;
          let tradeAmount = 0;

          if (trade.type === 'buy') {
            const feeRate = trade.feeRate || 0;
            const netAmount = trade.amount / (1 + feeRate / 100);
            const share = netAmount / result.value;
            newShare = current.share + share;
            newCost = (current.cost * current.share + trade.amount) / newShare;

            tradeShare = share;
            tradeAmount = trade.amount;
          } else {
            const sellShare =
              trade.share != null && Number.isFinite(Number(trade.share)) && Number(trade.share) > 0
                ? Number(trade.share)
                : trade.amount != null && Number.isFinite(Number(trade.amount)) && Number(trade.amount) > 0
                  ? Number(trade.amount) / result.value
                  : 0;
            newShare = Math.max(0, current.share - sellShare);
            newCost = current.cost;
            if (newShare === 0) newCost = 0;

            tradeShare = sellShare;
            tradeAmount = sellShare * result.value;
          }

          writeCurrent(trade.fundCode, tradeGid, newShare, newCost, {
            ...(current.firstPurchaseDate ? { firstPurchaseDate: current.firstPurchaseDate } : {}),
            ...(trade.type === 'buy' && !current.firstPurchaseDate && result.date
              ? { firstPurchaseDate: result.date }
              : {})
          });
          stateChanged = true;
          processedIds.add(trade.id);

          // 记录交易历史
          newTransactions.push({
            id: trade.id,
            fundCode: trade.fundCode,
            type: trade.type,
            share: tradeShare,
            amount: tradeAmount,
            price: result.value,
            date: result.date, // 使用获取到净值的日期
            isAfter3pm: trade.isAfter3pm,
            isDca: !!trade.isDca,
            timestamp: Date.now(),
            ...(tradeGid ? { groupId: tradeGid } : {})
          });
        }
      }

      if (stateChanged) {
        // 构建最终的 transactions 状态
        const prevTransactions = useStorageStore.getState().transactions;
        const nextTransactions = { ...prevTransactions };
        newTransactions.forEach((tx) => {
          const current = nextTransactions[tx.fundCode] || [];
          // 避免重复添加 (虽然 id 应该唯一)
          if (!current.some((t) => t.id === tx.id)) {
            const row = {
              id: tx.id,
              type: tx.type,
              share: tx.share,
              amount: tx.amount,
              price: tx.price,
              date: tx.date,
              isAfter3pm: tx.isAfter3pm,
              isDca: tx.isDca,
              timestamp: tx.timestamp
            };
            if (tx.groupId) row.groupId = tx.groupId;
            nextTransactions[tx.fundCode] = [row, ...current].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          }
        });

        // 构建最终的 pendingTrades 状态
        const prevPending = normalizePendingTrades(useStorageStore.getState().pendingTrades);
        const nextPending = prevPending.filter((t) => !processedIds.has(t.id));

        // 通过 storageStore.setItem 更新（内部会同步更新 state + localStorage + 触发云端同步）
        // 由于在同一同步代码块中，React 18 会自动批量处理，只触发一次 re-render
        storageStore.setItem('holdings', JSON.stringify(tempHoldings));
        storageStore.setItem('groupHoldings', JSON.stringify(tempGroupHoldings));
        storageStore.setItem('pendingTrades', JSON.stringify(nextPending));
        storageStore.setItem('transactions', JSON.stringify(nextTransactions));

        showToast(`已处理 ${processedIds.size} 笔待定交易`, 'success');
      }
    } finally {
      isProcessingPendingRef.current = false;
    }
  };

  const handleDeleteTransaction = (fundCode, transactionId, groupIdOverride) => {
    const { setTransactions } = useStorageStore.getState();
    setTransactions((prev) => {
      const current = prev[fundCode] || [];
      const gid = getScopedGroupId(groupIdOverride);
      const next = current.filter((t) => {
        if (t.id !== transactionId) return true;
        const inScope = !gid ? !t.groupId : t.groupId === gid;
        return !inScope;
      });
      const nextState = { ...prev, [fundCode]: next };
      return nextState;
    });
    showToast('交易记录已删除', 'success');
  };

  const handleMergeAllGroupTransactionsToCurrent = (fundCode, groupIdOverride) => {
    const { setTransactions, setPendingTrades } = useStorageStore.getState();
    const targetGid = getScopedGroupId(groupIdOverride);
    if (!fundCode || !targetGid) return;

    // 复制“历史交易记录”到当前分组（不改变原记录）
    setTransactions((prev) => {
      const list = prev?.[fundCode] || [];
      if (!isArray(list) || list.length === 0) return prev;

      const existingCurrent = list.filter((t) => t && t.groupId === targetGid);
      const copiedKey = new Set(
        existingCurrent.filter((t) => t?.copiedFromId).map((t) => `${t.copiedFromId}|${t.copiedFromGroupId ?? ''}`)
      );

      const toCopy = list.filter((t) => {
        if (!t) return false;
        const fromGid = t.groupId ?? null;
        if (fromGid === targetGid) return false;
        const key = `${t.id}|${fromGid ?? ''}`;
        return !copiedKey.has(key);
      });

      if (toCopy.length === 0) return prev;

      const copied = toCopy.map((t) => ({
        ...t,
        id: uuidv4(),
        groupId: targetGid,
        copiedFromId: t.id,
        copiedFromGroupId: t.groupId ?? null
      }));

      const nextList = [...list, ...copied].sort((a, b) => (b?.timestamp || 0) - (a?.timestamp || 0));
      const nextState = { ...prev, [fundCode]: nextList };
      return nextState;
    });

    // 复制“待处理队列”到当前分组（不改变原记录）
    setPendingTrades((prev) => {
      const list = isArray(prev) ? prev : [];
      const existingCurrent = list.filter((t) => t && t.fundCode === fundCode && t.groupId === targetGid);
      const copiedKey = new Set(
        existingCurrent.filter((t) => t?.copiedFromId).map((t) => `${t.copiedFromId}|${t.copiedFromGroupId ?? ''}`)
      );

      const toCopy = list.filter((t) => {
        if (!t || t.fundCode !== fundCode) return false;
        const fromGid = t.groupId ?? null;
        if (fromGid === targetGid) return false;
        const key = `${t.id}|${fromGid ?? ''}`;
        return !copiedKey.has(key);
      });

      if (toCopy.length === 0) return prev;

      const copied = toCopy.map((t) => ({
        ...t,
        id: uuidv4(),
        groupId: targetGid,
        copiedFromId: t.id,
        copiedFromGroupId: t.groupId ?? null
      }));

      const next = [...list, ...copied];
      return next;
    });

    showToast('已从全部分组复制该基金交易记录到当前分组', 'success');
  };

  const handleAddHistory = (data) => {
    const { setTransactions } = useStorageStore.getState();
    const addHistoryModal = useModalStore.getState().addHistoryModal;
    const fundCode = data.fundCode;
    const historyGid = getScopedGroupId(addHistoryModal.groupId);
    // 添加历史记录仅作补录展示，不修改真实持仓金额与份额
    setTransactions((prev) => {
      const current = prev[fundCode] || [];
      const record = {
        id: uuidv4(),
        type: data.type,
        share: data.share,
        amount: data.amount,
        price: data.price,
        date: data.date,
        isAfter3pm: false, // 历史记录通常不需要此标记，或者默认为 false
        isDca: false,
        isHistoryOnly: true, // 仅记录，不参与持仓计算
        timestamp: data.timestamp || Date.now(),
        ...(historyGid ? { groupId: historyGid } : {})
      };
      // 按时间倒序排列
      const next = [record, ...current].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const nextState = { ...prev, [fundCode]: next };
      return nextState;
    });
    showToast('历史记录已添加', 'success');
    setAddHistoryModal({ open: false, fund: null });
  };

  const handleTrade = (fund, data) => {
    const { holdings, groupHoldings, setPendingTrades, setTransactions } = useStorageStore.getState();
    const tradeModal = useModalStore.getState().tradeModal;
    const tradeGid = getScopedGroupId(tradeModal.groupId);
    // 如果没有价格（API失败），加入待处理队列
    if (!data.price || data.price === 0) {
      const pending = {
        id: uuidv4(),
        fundCode: fund.code,
        fundName: fund.name,
        type: tradeModal.type,
        share: data.share,
        amount: data.totalCost,
        feeRate: tradeModal.type === 'buy' ? data.feeRate : 0, // Buy needs feeRate
        feeMode: data.feeMode,
        feeValue: data.feeValue,
        date: data.date,
        isAfter3pm: data.isAfter3pm,
        isDca: false,
        timestamp: Date.now(),
        ...(tradeGid ? { groupId: tradeGid } : {})
      };

      setPendingTrades((prev) => [...(prev || []), pending]);

      // 如果该基金没有持仓数据，初始化持仓金额为 0
      const tabH = tradeGid ? groupHoldings[tradeGid] || {} : holdings;
      if (!tabH[fund.code]) {
        handleSaveHolding(fund.code, { share: 0, cost: 0 }, tradeGid);
      }

      setTradeModal({ open: false, fund: null, type: 'buy' });
      showToast('净值暂未更新，已加入待处理队列', 'info');
      return;
    }

    const current = (tradeGid ? groupHoldings[tradeGid] || {} : holdings)[fund.code] || { share: 0, cost: 0 };
    const isBuy = tradeModal.type === 'buy';

    let newShare, newCost;

    if (isBuy) {
      newShare = current.share + data.share;

      // 如果传递了 totalCost（即买入总金额），则用它来计算新成本
      // 否则回退到用 share * price 计算（减仓或旧逻辑）
      const buyCost = data.totalCost !== undefined ? data.totalCost : data.price * data.share;

      // 加权平均成本 = (原持仓成本 * 原份额 + 本次买入总花费) / 新总份额
      // 注意：这里默认将手续费也计入成本（如果 totalCost 包含了手续费）
      newCost = (current.cost * current.share + buyCost) / newShare;
    } else {
      newShare = Math.max(0, current.share - data.share);
      // 减仓不改变单位成本，只减少份额
      newCost = current.cost;
      if (newShare === 0) newCost = 0;
    }

    handleSaveHolding(
      fund.code,
      {
        share: newShare,
        cost: newCost,
        ...(current.firstPurchaseDate ? { firstPurchaseDate: current.firstPurchaseDate } : {}),
        ...(isBuy && !current.firstPurchaseDate && data.date ? { firstPurchaseDate: data.date } : {})
      },
      tradeGid
    );

    setTransactions((prev) => {
      const curList = prev[fund.code] || [];
      const record = {
        id: uuidv4(),
        type: tradeModal.type,
        share: data.share,
        amount: isBuy ? data.totalCost : data.share * data.price,
        price: data.price,
        date: data.date,
        isAfter3pm: data.isAfter3pm,
        isDca: false,
        timestamp: Date.now(),
        ...(tradeGid ? { groupId: tradeGid } : {})
      };
      const next = [record, ...curList];
      const nextState = { ...prev, [fund.code]: next };
      return nextState;
    });

    setTradeModal({ open: false, fund: null, type: 'buy' });
  };

  return {
    handleSaveHolding,
    handleClearConfirm,
    processPendingQueue,
    handleDeleteTransaction,
    handleMergeAllGroupTransactionsToCurrent,
    handleAddHistory,
    handleTrade
  };
}
