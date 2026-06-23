import { isArray, isFunction, isPlainObject } from 'lodash';
import { storageStore, useStorageStore } from '../stores';

/**
 * 开发期存储快照工具：用于写路径重构的行为保持验证。
 *
 * 通过 `storageStore` 读取业务数据（与云同步看到的序列化数据一致），
 * 并通过包裹 `onSync` 记录同步事件，验证重构前后：
 *   - 持久化 JSON 形状不变；
 *   - 触发的 SYNC_KEYS 事件数量/顺序不变。
 *
 * 仅用于手动/开发验证，不要接入生产 UI。
 * dev 下已通过 `window.__storageSnapshot` 暴露，便于浏览器控制台调用（见文件底部）。
 */

export const STORAGE_SNAPSHOT_KEYS = [
  'funds',
  'tags',
  'favorites',
  'groups',
  'collapsedCodes',
  'collapsedTrends',
  'collapsedValuationTrends',
  'collapsedEarnings',
  'refreshMs',
  'holdings',
  'groupHoldings',
  'pendingTrades',
  'transactions',
  'dcaPlans',
  'customSettings',
  'fundDailyEarnings',
  'fundDividends'
];

const normalizeForSnapshot = (value) => {
  if (value instanceof Set) return Array.from(value).sort();
  if (isArray(value)) return value;
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        out[key] = normalizeForSnapshot(value[key]);
        return out;
      }, {});
  }
  return value;
};

export function createStorageSnapshot(label = '') {
  const data = {};
  for (const key of STORAGE_SNAPSHOT_KEYS) {
    data[key] = normalizeForSnapshot(storageStore.getItem(key, null));
  }
  return {
    label,
    data
  };
}

export function installSyncEventRecorder({ forward = true } = {}) {
  const store = useStorageStore.getState();
  const previousOnSync = store.onSync;
  const events = [];

  store.setOnSync((key, prevValue, nextValue) => {
    events.push({
      key,
      prevValue,
      nextValue
    });
    if (forward && isFunction(previousOnSync)) {
      previousOnSync(key, prevValue, nextValue);
    }
  });

  return {
    getEvents: () => events.slice(),
    clear: () => {
      events.length = 0;
    },
    restore: () => {
      store.setOnSync(previousOnSync);
    }
  };
}

// 开发期暴露到控制台：window.__storageSnapshot.createStorageSnapshot() 等。
// 生产构建短路，不挂载。验收前如不保留，删除此块即可。
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  window.__storageSnapshot = { createStorageSnapshot, installSyncEventRecorder, STORAGE_SNAPSHOT_KEYS };
}
