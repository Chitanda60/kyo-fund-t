import { useCallback, useRef } from 'react';
import { isPlainObject } from 'lodash';
import { migrateDcaPlansToScoped, toTz, formatDate } from '../../lib/fundHelpers';
import { DCA_SCOPE_GLOBAL } from '@/app/constants';
import { loadHolidaysForYears, isTradingDay as isDateTradingDay } from '../../lib/tradingCalendar';
import { normalizePendingTrades, storageStore, useStorageStore } from '../../stores';

/**
 * 定投调度 Hook（mutation）：从 page.jsx 抽离的 scheduleDcaTrades（交易日自动生成定投买入队列）。
 *
 * 设计约束（行为保持）：
 * - isSchedulingDcaRef 内置于本 Hook（原 page.jsx 中仅此函数使用）。
 * - 读取均走 useStorageStore.getState()（与原一致）；写入走 storageStore.setItem 批处理（保留）。
 * - 原 no-new-pending 分支使用订阅的 setDcaPlans；此处改为 useStorageStore.getState().setDcaPlans
 *   （同一稳定 setter，行为不变），从而依赖数组由 [isTradingDay, setDcaPlans] 收敛为 [isTradingDay]。
 * - 日期/交易日顺延逻辑与原 page.jsx 完全一致。
 */
export function useDcaScheduler({ isTradingDay, showToast }) {
  const isSchedulingDcaRef = useRef(false);

  const scheduleDcaTrades = useCallback(async () => {
    if (!isTradingDay) return;
    const storeState = useStorageStore.getState();
    const currentDcaPlans = storeState.dcaPlans;
    if (!isPlainObject(currentDcaPlans)) return;
    const currentFunds = storeState.funds;
    const codesSet = new Set(currentFunds.map((f) => f.code));
    if (codesSet.size === 0) return;

    if (isSchedulingDcaRef.current) return;
    isSchedulingDcaRef.current = true;

    try {
      const scoped = migrateDcaPlansToScoped(currentDcaPlans);
      const groupIdSet = new Set(storeState.groups.map((g) => g?.id).filter(Boolean));

      const todayStrDynamic = formatDate();
      const today = toTz(todayStrDynamic).startOf('day');
      let nextPlans;
      try {
        nextPlans = JSON.parse(JSON.stringify(scoped));
      } catch {
        nextPlans = { ...scoped };
      }
      const newPending = [];

      const years = new Set([today.year(), today.year() + 1]);
      Object.values(scoped).forEach((bucket) => {
        if (!isPlainObject(bucket)) return;
        Object.values(bucket).forEach((plan) => {
          if (plan?.firstDate) years.add(toTz(plan.firstDate).year());
          if (plan?.lastDate) years.add(toTz(plan.lastDate).year());
        });
      });
      await loadHolidaysForYears([...years]);

      const processBucket = (scopeKey, bucket) => {
        if (!isPlainObject(bucket)) return;
        const tradeGid = scopeKey === DCA_SCOPE_GLOBAL ? null : scopeKey;
        if (tradeGid && !groupIdSet.has(tradeGid)) return;

        Object.entries(bucket).forEach(([code, plan]) => {
          if (!plan || !plan.enabled) return;
          if (!codesSet.has(code)) return;

          const amount = Number(plan.amount);
          const feeRate = Number(plan.feeRate) || 0;
          if (!amount || amount <= 0) return;

          const cycle = plan.cycle || 'monthly';
          if (!plan.firstDate) return;

          const first = toTz(plan.firstDate).startOf('day');
          if (today.isBefore(first, 'day')) return;

          const last = plan.lastDate ? toTz(plan.lastDate).startOf('day') : null;

          let current = last ? last.clone() : first.clone();
          let lastGenerated = null;

          const stepOnce = () => {
            if (cycle === 'daily') return current.add(1, 'day');
            if (cycle === 'weekly') return current.add(1, 'week');
            if (cycle === 'biweekly') return current.add(2, 'week');
            if (cycle === 'monthly') return current.add(1, 'month');
            return current.add(1, 'day');
          };

          if (last) {
            current = stepOnce();
          }

          while (true) {
            if (current.isAfter(today, 'day')) break;

            if (!current.isBefore(first, 'day')) {
              // 非交易日顺延至下一个交易日
              let tradeDate = current.clone();
              let maxAttempts = 30;
              while (!isDateTradingDay(tradeDate) && maxAttempts-- > 0) {
                tradeDate = tradeDate.add(1, 'day');
              }
              if (!isDateTradingDay(tradeDate) || tradeDate.isAfter(today, 'day')) {
                current = stepOnce();
                continue;
              }

              const dateStr = tradeDate.format('YYYY-MM-DD');

              const pending = {
                id: `dca_${scopeKey}_${code}_${dateStr}`,
                fundCode: code,
                fundName: (currentFunds.find((f) => f.code === code) || {}).name,
                type: 'buy',
                share: null,
                amount,
                feeRate,
                feeMode: undefined,
                feeValue: undefined,
                date: dateStr,
                isAfter3pm: false,
                isDca: true,
                timestamp: Date.now(),
                ...(tradeGid ? { groupId: tradeGid } : {})
              };
              newPending.push(pending);
              lastGenerated = tradeDate;
            }
            current = stepOnce();
          }

          if (lastGenerated) {
            if (!nextPlans[scopeKey]) nextPlans[scopeKey] = {};
            nextPlans[scopeKey][code] = {
              ...plan,
              lastDate: lastGenerated.format('YYYY-MM-DD')
            };
          }
        });
      };

      processBucket(DCA_SCOPE_GLOBAL, scoped[DCA_SCOPE_GLOBAL]);
      Object.keys(scoped).forEach((k) => {
        if (k === DCA_SCOPE_GLOBAL) return;
        processBucket(k, scoped[k]);
      });

      if (newPending.length === 0) {
        if (JSON.stringify(nextPlans) !== JSON.stringify(scoped)) {
          useStorageStore.getState().setDcaPlans(nextPlans);
        }
        return;
      }

      // 计算去重后的新 pending 列表
      const prevPending = normalizePendingTrades(useStorageStore.getState().pendingTrades);
      const existingIds = new Set(prevPending.map((t) => t.id));
      const unique = newPending.filter((t) => !existingIds.has(t.id));

      // 批量更新 dcaPlans 和 pendingTrades
      // 通过 storageStore.setItem 更新（内部会同步更新 state + localStorage + 触发云端同步）
      // 由于在同一同步代码块中，React 18 会自动批量处理，只触发一次 re-render
      const nextPending = normalizePendingTrades(unique.length > 0 ? [...prevPending, ...unique] : prevPending);
      storageStore.setItem('dcaPlans', JSON.stringify(nextPlans));
      storageStore.setItem('pendingTrades', JSON.stringify(nextPending));

      if (unique.length > 0) {
        showToast(`已生成 ${unique.length} 笔定投买入`, 'success');
      }
    } finally {
      isSchedulingDcaRef.current = false;
    }
  }, [isTradingDay]);

  return { scheduleDcaTrades };
}
