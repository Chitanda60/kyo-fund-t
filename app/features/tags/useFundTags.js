import { useCallback, useEffect } from 'react';
import { isArray } from 'lodash';
import { v4 as uuidv4 } from 'uuid';
import { useModalStore } from '../../stores';
import {
  getFundCodesFromTagRecord,
  normalizeFundTagInstanceListFromInput,
  sanitizeTagRowForStorage
} from '../../lib/fundHelpers';
import { DEFAULT_FUND_TAG_THEME } from '@/app/constants';

/**
 * 基金标签动作 Hook（mutation）：从 page.jsx 抽离的标签编辑/新增/删除/更新逻辑。
 *
 * 设计约束（行为保持）：
 * - 偏离源计划签名：fundTagRecords 状态与 fundTagListsByCode 派生保留在 page.jsx
 *   （它们在 useSyncManager 之前/早期就被消费，且 useSyncManager 需要 setFundTagRecords，
 *   而本 Hook 需要 useSyncManager 产出的 storageHelper —— 存在环形）。
 *   因此本 Hook 只承载动作，state/setter/funds/storageHelper 作为入参传入。
 *   详见 doc/page-refactor-dependency-map.md。
 * - 写存储仍走 storageHelper.setItem('tags', ...)（触发云同步），与原 page.jsx 一致。
 * - 弹框状态走 useModalStore（getState/setState），page.jsx 不订阅 modal store。
 * - 各 useCallback/useEffect 依赖数组与原 page.jsx 完全一致。
 */
export function useFundTags({ funds, fundTagRecords, setFundTagRecords, storageHelper }) {
  const openFundTagsEdit = useCallback(
    (row) => {
      if (!row?.code) return;
      const raw = row.rawFund;
      const fc = String(row.code).trim();
      const tags = (fundTagRecords || [])
        .filter((r) => getFundCodesFromTagRecord(r).includes(fc))
        .map((r) => ({
          id: String(r.id ?? '').trim() || uuidv4(),
          name: String(r.name ?? '').trim(),
          theme: String(r.theme ?? '').trim() || DEFAULT_FUND_TAG_THEME
        }))
        .filter((x) => x.name)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
      useModalStore.setState({
        fundTagsEdit: {
          open: true,
          code: row.code,
          name: row.fundName || raw?.name || '',
          tags
        }
      });
    },
    [fundTagRecords]
  );

  const handleSaveFundTags = useCallback(
    (code, tagRows) => {
      if (!code) return;
      const fc = String(code).trim();
      const rows = isArray(tagRows) ? tagRows : [];
      const normalized = normalizeFundTagInstanceListFromInput(rows);

      setFundTagRecords((prev) => {
        const selectedById = new Map(normalized.map((x) => [String(x.id).trim(), x]).filter(([id]) => id));

        const byId = new Map();
        for (const r of prev) {
          const id = String(r?.id ?? '').trim();
          if (!id) continue;
          byId.set(id, r);
        }

        for (const [id, row] of [...byId.entries()]) {
          const nm = String(row.name ?? '').trim();
          if (!nm) {
            byId.delete(id);
            continue;
          }
          const meta = selectedById.get(id);
          if (meta) {
            let codes = getFundCodesFromTagRecord(row);
            if (!codes.includes(fc)) codes = [...codes, fc].sort();
            const nextRow = sanitizeTagRowForStorage({
              ...row,
              id,
              name: meta.name,
              theme: meta.theme,
              fundCodes: codes
            });
            if (nextRow) byId.set(id, nextRow);
          } else {
            const codes = getFundCodesFromTagRecord(row).filter((c) => c !== fc);
            const nextRow = sanitizeTagRowForStorage({
              ...row,
              fundCodes: codes
            });
            if (nextRow) byId.set(id, nextRow);
          }
        }

        for (const [id, meta] of selectedById) {
          if (byId.has(id)) continue;
          const row = sanitizeTagRowForStorage({
            id,
            name: meta.name,
            theme: meta.theme,
            fundCodes: [fc]
          });
          if (row) byId.set(id, row);
        }

        const next = Array.from(byId.values())
          .map(sanitizeTagRowForStorage)
          .filter(Boolean)
          .sort((a, b) => String(a.id).localeCompare(String(b.id)));
        storageHelper.setItem('tags', JSON.stringify(next));
        return next;
      });
    },
    [storageHelper, setFundTagRecords]
  );

  /** 仅写入可选池：每次新增一条独立记录（允许可选池内重名），不改变已有 fundCodes */
  const handleAddPoolTag = useCallback(
    (payload) => {
      const th = String(payload?.theme ?? '').trim() || DEFAULT_FUND_TAG_THEME;
      const rawNames =
        isArray(payload?.names) && payload.names.length
          ? payload.names
          : payload?.name != null && String(payload.name).trim()
            ? [String(payload.name).trim()]
            : [];
      if (!rawNames.length) return;

      setFundTagRecords((prev) => {
        const next = [...prev];
        for (const nm of rawNames) {
          const name = String(nm ?? '').trim();
          if (!name) continue;
          const row = sanitizeTagRowForStorage({
            id: uuidv4(),
            name,
            theme: th,
            fundCodes: []
          });
          if (row) next.push(row);
        }
        storageHelper.setItem('tags', JSON.stringify(next));
        return next;
      });
    },
    [storageHelper, setFundTagRecords]
  );

  /** 从全局 tags 存储中按 id 移除该条标签记录，并清理各基金已选列表中的同 id 引用 */
  const handleDeleteGlobalTag = useCallback(
    (tagId) => {
      const id = String(tagId ?? '').trim();
      if (!id) return;
      setFundTagRecords((prev) => {
        const next = prev.filter((r) => String(r.id).trim() !== id);
        storageHelper.setItem('tags', JSON.stringify(next));
        return next;
      });
    },
    [storageHelper, setFundTagRecords]
  );

  /** 更新全局标签（如名称、主题），影响所有使用该标签的基金 */
  const handleUpdateGlobalTag = useCallback(
    (tagId, payload) => {
      const id = String(tagId ?? '').trim();
      const name = String(payload?.name ?? '').trim();
      const theme = String(payload?.theme ?? '').trim() || DEFAULT_FUND_TAG_THEME;
      if (!id || !name) return;

      setFundTagRecords((prev) => {
        const next = prev.map((r) => {
          if (String(r.id).trim() === id) {
            return sanitizeTagRowForStorage({
              ...r,
              name,
              theme
            });
          }
          return r;
        });
        storageHelper.setItem('tags', JSON.stringify(next));
        return next;
      });
    },
    [storageHelper, setFundTagRecords]
  );

  /** 删除前展示：该标签关联的基金文案列表（按标签 id） */
  const getTagUsageLabels = useCallback(
    (tagId) => {
      const id = String(tagId ?? '').trim();
      const row = fundTagRecords.find((r) => String(r.id).trim() === id);
      if (!row) return [];
      const codes = getFundCodesFromTagRecord(row);
      return codes.map((c) => {
        const f = funds.find((x) => String(x.code) === String(c));
        const namePart = f?.name ? String(f.name) : '';
        return namePart ? `${namePart}（${c}）` : String(c);
      });
    },
    [fundTagRecords, funds]
  );

  // 当全局标签变化且标签编辑弹框处于打开状态时，触发弹框层的重新渲染，以便底部可选标签池能立即展示最新内容
  useEffect(() => {
    const ms = useModalStore.getState();
    if (ms.fundTagsEdit?.open) {
      useModalStore.setState({ fundTagsEdit: { ...ms.fundTagsEdit, _tick: Date.now() } });
    }
  }, [fundTagRecords]);

  return {
    openFundTagsEdit,
    handleSaveFundTags,
    handleAddPoolTag,
    handleDeleteGlobalTag,
    handleUpdateGlobalTag,
    getTagUsageLabels
  };
}
