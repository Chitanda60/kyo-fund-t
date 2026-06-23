import { isEqual, isFunction, isString } from 'lodash';

const shouldCompare = () => {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return false;
  if (typeof window === 'undefined') return false;
  return true;
};

/**
 * 开发期影子对比助手：用于行为保持重构。
 *
 * 重构纯派生逻辑时，临时保留旧实现（legacy）与新实现（next）并行计算，
 * 用 lodash isEqual 比对二者，一旦不一致就在控制台打印 [shadow-compare mismatch]。
 * 生产环境短路，只返回 next 值，零开销。
 *
 * 约束：
 * - `legacyValueFactory` 与 `nextValueFactory` 必须返回**相同形状**（同键、同值类型）的可序列化对象。
 * - **不要把函数放进对比值**。函数标识不是有意义的行为对比，会造成永久误报；
 *   若运行时值含额外字段或回调函数，请只比对投影（projection），完整运行时值单独使用。
 *
 * @param {string} label - 对比标签，出现在 mismatch 日志中。
 * @param {Function|*} legacyValueFactory - 旧实现值或返回旧实现值的工厂函数。
 * @param {Function|*} nextValueFactory - 新实现值或返回新实现值的工厂函数。
 * @returns {*} 始终返回 next 值。
 */
export function devShadowCompare(label, legacyValueFactory, nextValueFactory) {
  if (!shouldCompare()) {
    return isFunction(nextValueFactory) ? nextValueFactory() : nextValueFactory;
  }

  const nextValue = isFunction(nextValueFactory) ? nextValueFactory() : nextValueFactory;

  try {
    const legacyValue = isFunction(legacyValueFactory) ? legacyValueFactory() : legacyValueFactory;
    if (!isEqual(legacyValue, nextValue)) {
      console.error('[shadow-compare mismatch]', isString(label) ? label : 'unknown', {
        legacyValue,
        nextValue
      });
    }
  } catch (error) {
    console.error('[shadow-compare error]', isString(label) ? label : 'unknown', error);
  }

  return nextValue;
}
