import { useEffect } from 'react';
import { isPlainObject } from 'lodash';
import { DAILY_EARNINGS_SCOPE_ALL } from '@/app/constants';

/**
 * 写副作用 Hook：从 page.jsx 抽离的「清理 linked 基金的全局 fundDailyEarnings」副作用。
 *
 * 当某基金在全局无持仓但被分组持仓联动展示（linked）时，将其残留在全局桶
 * (DAILY_EARNINGS_SCOPE_ALL) 中的每日收益记录清除，避免重复计入。
 *
 * 该 Hook 拥有唯一的写副作用，必须用存储快照场景验证（写 fundDailyEarnings）。
 * 依赖数组与原 page.jsx 完全一致：[linkedHoldingsForAllFav, setFundDailyEarnings]。
 */
export function usePortfolioScopeCleanup({ linkedHoldingsForAllFav, setFundDailyEarnings }) {
  useEffect(() => {
    const linkedCodes = linkedHoldingsForAllFav?.linked;
    if (!(linkedCodes instanceof Set) || linkedCodes.size === 0) return;
    setFundDailyEarnings((prev) => {
      if (!isPlainObject(prev)) return prev;
      const globalBucket = prev[DAILY_EARNINGS_SCOPE_ALL];
      if (!isPlainObject(globalBucket)) return prev;
      const nextGlobalBucket = { ...globalBucket };
      let changed = false;
      for (const code of linkedCodes) {
        if (code in nextGlobalBucket) {
          delete nextGlobalBucket[code];
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, [DAILY_EARNINGS_SCOPE_ALL]: nextGlobalBucket };
    });
  }, [linkedHoldingsForAllFav, setFundDailyEarnings]);
}
