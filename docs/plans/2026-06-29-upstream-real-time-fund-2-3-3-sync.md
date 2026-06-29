# Upstream Real-Time Fund 2.3.3 Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port upstream changes from `download/real-time-fund` commit `2e14d9e3a3617a228fa4c28305b3b5408a93a43e` through `be176765566d0e6f83b7614b5e0d7328087a633b` into the current refactored project, preserving the routed App Router shell and split services/features/styles architecture.

**Architecture:** Treat upstream as the product source, not as a file replacement source. Map upstream flat files into the current ownership boundaries: fund API changes go to `app/services/fund/*` and the `app/api/fund.js` barrel stays unchanged; table UI changes go to `app/components/tables/*`; route and shell behavior stays in `app/components/AppShell.jsx` plus render-only page components; CSS changes go to `app/styles/*`. Keep `storageStore` as the only business storage access layer, keep modal state centralized in Zustand, and do not copy upstream `app/page.jsx` over the current route-backed app.

**Tech Stack:** Next.js 16 App Router, JavaScript/JSX only, React, Zustand, TanStack Query/Table, shadcn/ui, Tailwind v4, Supabase optional sync, static export, JSONP/script-injection fund data APIs.

---

## Executor Entry

**Review status:** Confirmed on 2026-06-29 after four review rounds. The review findings have been folded into this plan. Do not restart plan review unless an implementation pre-check fails.

**How to execute:**

1. Work through tasks in order. Later tasks depend on earlier data-source, calendar, and sync decisions.
2. Run each task's `rg` pre-check before editing. If a required anchor is missing, stop and update this plan before changing code.
3. Commit after each task once the listed verification passes, unless the user requests a different commit style.
4. Do not copy upstream files wholesale. Port only the behavior into the current refactored architecture.
5. Treat `npm run lint` as the main automated check. Run `npm run build` at the release/docs checkpoints and final verification.

**Final review decisions already included below:**

- QDII source 4 is explicit. Remove the hidden source-1 Supabase QDII fallback only after adding the storage migration for previously resolved/tagged QDII funds.
- The QDII migration is intentionally tag-gated. Do not add async QDII probing to `storageStore`; untagged source-1 QDII funds recover through auto-source or the data-source selector.
- `navUpdatedAt` stays on fund objects, can travel with real NAV-date syncs, and must not be added to either sync comparison model.
- Table pagination must preserve full-list drag/reorder indices and cross-page batch-selection semantics described in Task 4.
- Task 6 import expansion is valid through `app/stores/index.js`; Task 4 pagination reset dependencies use real table props; Task 2 must add `isPlainObject` to the existing lodash import.

## Upstream Range

**Anchor already synced in this project:**

```text
2e14d9e3a3617a228fa4c28305b3b5408a93a43e
feat：分组下拉宽度调整
2026-06-24 09:52:09 +0800
```

**Target upstream commit:**

```text
be176765566d0e6f83b7614b5e0d7328087a633b
feat：发布 2.3.3
2026-06-28 23:27:17 +0800
```

**Commits in scope:**

```text
a291182 fix：修复云端拉取排序个性化问题
72b8a69 feat：新增数据源4（qdii）
15de2c2 feat：新增表格分页
5b4f7b7 fix: 调整分页器 input 输入框字体大小
7573485 feat: 优化分组下拉滚动效果
83179c1 feat: 发布 2.3.2
56751e6 feat: 添加用户状态检查以优化自动数据源处理
ab30ce5 feat: 调整 PC 端业绩走势、估值走势悬浮框透明度
0a9d2f7 feat: 服务器升级公告
e315e68 feat：优化净值是否已更新判断
84686b5 feat：调整 T+2 类型基金当日收益计算方式
196c22a feat：发布 2.3.3
be17676 feat：发布 2.3.3
```

**Changed upstream files:**

```text
.idea/real-time-fund.iml
AGENTS.md
app/api/fund.js
app/components/Announcement.jsx
app/components/FundDataSourceSelector.jsx
app/components/FundListView.jsx
app/components/FundValuationTrendChart.jsx
app/components/MobileFundTable.jsx
app/components/PcFundTable.jsx
app/globals.css
app/hooks/useHoldingProfit.js
app/hooks/useRefreshManager.js
app/hooks/useSyncManager.js
app/lib/fundHelpers.js
app/lib/query-keys.js
app/lib/tradingCalendar.js
app/page.jsx
package-lock.json
package.json
```

## Current Architecture Mapping

| Upstream file                                | Current target                                                                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/fund.js`                            | `app/services/fund/valuationApi.js`, `app/lib/query-keys.js`; keep `app/api/fund.js` as barrel only                                                       |
| `app/components/FundDataSourceSelector.jsx`  | `app/components/fund/FundDataSourceSelector.jsx`                                                                                                          |
| `app/components/FundValuationTrendChart.jsx` | `app/components/charts/FundValuationTrendChart.jsx`                                                                                                       |
| `app/components/FundListView.jsx`            | `app/components/tables/FundListView.jsx`                                                                                                                  |
| `app/components/PcFundTable.jsx`             | `app/components/tables/PcFundTable.jsx`                                                                                                                   |
| `app/components/MobileFundTable.jsx`         | `app/components/tables/MobileFundTable.jsx`                                                                                                               |
| `app/components/Announcement.jsx`            | `app/components/system/Announcement.jsx`                                                                                                                  |
| `app/globals.css`                            | `app/styles/components.css` unless tokens/base/layout ownership is clearly better                                                                         |
| `app/hooks/useRefreshManager.js`             | `app/hooks/useRefreshManager.js`                                                                                                                          |
| `app/hooks/useHoldingProfit.js`              | `app/hooks/useHoldingProfit.js`                                                                                                                           |
| `app/hooks/useSyncManager.js`                | `app/hooks/useSyncManager.js`                                                                                                                             |
| `app/lib/fundHelpers.js`                     | `app/lib/fundHelpers.js`                                                                                                                                  |
| `app/lib/tradingCalendar.js`                 | `app/lib/tradingCalendar.js`                                                                                                                              |
| `app/page.jsx`                               | Only inspect the group-dropdown hunk; current render lives in `app/components/pages/HomePageContent.jsx` and shell state in `app/components/AppShell.jsx` |
| `package*.json`                              | `package.json`, `package-lock.json`                                                                                                                       |
| `.idea/real-time-fund.iml`                   | Ignore                                                                                                                                                    |
| upstream `AGENTS.md`                         | Do not overwrite. Optionally merge the Safari input zoom note into current `AGENTS.md` after code sync                                                    |

## Existing Partial Overlap

The current project already has some earlier groundwork that must be reused:

- `app/services/fund/valuationApi.js` already has `fetchQdiiValuationFromSupabase`, but upstream converts QDII into explicit data source `4` instead of only a data source `1` fallback.
- `components/ui/pagination.jsx` already exists and is used by `MarketTab`, so table pagination should use this primitive.
- `app/stores/settingsStore.js` and `HomePageContent` already contain group-dropdown settings from the previous sync; only the upstream scroll behavior hunk needs reconciliation.
- `app/styles/components.css` already contains tooltip and tab CSS. Do not edit `app/globals.css` except to preserve import order.

## Non-Negotiable Rules

- Do not overwrite current `app/page.jsx`, `app/api/fund.js`, or `app/globals.css`.
- Do not directly copy upstream table files; they are large and behavior-sensitive.
- Keep `AppShell` persistent across route navigation.
- Keep `/`, `/market`, and `/mine` route-backed.
- Use lodash type helpers for data type checks, except undeclared global guards.
- Business persistence must go through `storageStore` / `useStorageStore`.
- `fundTablePageSize` is a local UI setting and must not be added to `SYNC_KEYS`.
- Legacy QDII funds that were previously resolved/tagged with `valuationSource: 'supabase_qdii'` while still storing `dataSource: 1` must be migrated to `dataSource: 4`; do not make this optional.
- Untagged QDII detection must not be added to `storageStore` normalization because it would require async Supabase checks. Untagged source-1 QDII funds recover through auto-source or the data-source selector after source 4 is added.
- `navUpdatedAt` is an intentional short-lived fund field used by T+2 daily-profit logic. Keep it in local `funds` with the NAV data, but do not add it to `getFundCodesSignature`; this prevents navUpdatedAt-only writes from triggering extra cloud sync while still allowing it to travel with a real NAV-date update.
- No TypeScript.
- No new test framework during this sync.
- Commit after each task once lint passes, unless the user asks for a different commit style.

## Pre-Flight

**Files:** none

**Step 1: Confirm upstream range**

Run:

```bash
git -C download/real-time-fund show -s --format='%H%n%s%n%ci' 2e14d9e3a3617a228fa4c28305b3b5408a93a43e
git -C download/real-time-fund show -s --format='%H%n%s%n%ci' be176765566d0e6f83b7614b5e0d7328087a633b
git -C download/real-time-fund log --oneline --reverse 2e14d9e3a3617a228fa4c28305b3b5408a93a43e..be176765566d0e6f83b7614b5e0d7328087a633b
```

Expected:

- Anchor prints `2e14d9e3...`.
- Target prints `be176765...`.
- Log prints the 13 commits listed above.

**Step 2: Record current baseline**

Run:

```bash
git status --short
npm run lint
npm run build
```

Expected:

- Any pre-existing dirty files are listed and not reverted.
- Lint/build results are recorded in implementation notes before editing.
- If lint/build already fails, continue only after noting that the failure pre-existed and is unrelated.

**Step 3: Pre-check high-risk hook anchors**

Run:

```bash
rg -n "bestSourcesMap|fetchFundsBestSources|updated.push\\(data\\)|confirmDays|navUpdatedAt|isNavUpdated|profitBasisDate|useValuation|shareForTodayProfit" app/hooks/useRefreshManager.js app/hooks/useHoldingProfit.js app/lib/fundHelpers.js app/lib/tradingCalendar.js
```

Expected:

- `useRefreshManager.js` contains a `bestSourcesMap` block, an `oldData` snapshot, and an `updated.push(data)` point where `navUpdatedAt` can be inserted.
- `useHoldingProfit.js` contains `hasExactTodayData`, `hasTodayData`, `hasTodayValuation`, `canCalcTodayProfit`, the same-day transaction exclusion, and the later `useValuation` block that Task 8 will replace.
- If any anchor is missing or materially renamed, stop and update this plan before editing.

---

## Task 1: Create Sync Checklist

**Files:**

- Create: `doc/upstream-sync-be17676-checklist.md`
- Later modify: `doc/upstream-sync.md`
- Later modify: `AGENTS.md`

**Step 1: Create checklist skeleton**

Write `doc/upstream-sync-be17676-checklist.md`:

```markdown
# Upstream Sync Checklist: 2e14d9e to be17676

## Range

- Anchor: `2e14d9e3a3617a228fa4c28305b3b5408a93a43e`
- Target: `be176765566d0e6f83b7614b5e0d7328087a633b`

## Decisions

- [ ] QDII data source 4: port
- [ ] Table pagination: port
- [ ] Safari pagination input 16PX fix: port
- [ ] Group dropdown scroll behavior: port/reconcile
- [ ] Cloud customSettings sort fix: port
- [ ] Auto-source user-state guard: port
- [ ] Chart tooltip transparency: port
- [ ] Trading-day NAV updated logic: port
- [ ] T+2 daily profit logic: port
- [ ] Version and announcement: port
- [ ] `.idea`: ignore
- [ ] Upstream legacy `AGENTS.md`: do not overwrite

## Baseline

- `npm run lint`: TODO
- `npm run build`: TODO

## Final

- `npm run lint`: TODO
- `npm run build`: TODO
- Manual data source 4 checks: TODO
- Manual table pagination checks: TODO
- Manual T+2/QDII profit checks: TODO
- Manual cloud sort setting checks: TODO

## File Mapping

| Upstream change               | Target file(s)                                                                                                                                                      | Status |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| data source 4 / `isQdiiFund`  | `app/services/fund/valuationApi.js`, `app/lib/query-keys.js`, `app/components/fund/FundDataSourceSelector.jsx`, `app/components/charts/FundValuationTrendChart.jsx` | TODO   |
| table pagination              | `app/components/tables/PcFundTable.jsx`, `app/components/tables/MobileFundTable.jsx`, `app/components/tables/FundListView.jsx`                                      | TODO   |
| cloud customSettings sort fix | `app/hooks/useSyncManager.js`                                                                                                                                       | TODO   |
| auto-source user-state guard  | `app/hooks/useRefreshManager.js`                                                                                                                                    | TODO   |
| NAV updated + T+2 profit      | `app/lib/tradingCalendar.js`, `app/lib/fundHelpers.js`, `app/hooks/useRefreshManager.js`, `app/hooks/useHoldingProfit.js`                                           | TODO   |
| tooltip opacity               | `app/styles/components.css`                                                                                                                                         | TODO   |
| release                       | `app/components/system/Announcement.jsx`, `package.json`, `package-lock.json`, docs                                                                                 | TODO   |
```

**Step 2: Commit**

Run:

```bash
git add doc/upstream-sync-be17676-checklist.md
git commit -m "docs: add upstream 2.3.3 sync checklist"
```

Expected:

- Checklist file is committed.

---

## Task 2: Port QDII Data Source 4 Backend

**Files:**

- Modify: `app/services/fund/valuationApi.js`
- Modify: `app/lib/query-keys.js`
- Modify: `app/stores/storageStore.js`
- Verify unchanged barrel: `app/api/fund.js`

**Step 1: Update query keys**

Add:

```js
/** @param {string} fundCode */
export const isQdiiFund = (fundCode) => ['isQdiiFund', String(fundCode).trim()];
```

**Step 2: Update valuation source normalization**

In `app/services/fund/valuationApi.js`, update `normalizeValuationDataSource`:

```js
function normalizeValuationDataSource(dataSource) {
  const n = Number(dataSource);
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  return 1;
}
```

**Step 3: Add QDII existence API**

Add near `fetchQdiiValuationFromSupabase`:

```js
export const isQdiiFund = async (code) => {
  if (!code || !isSupabaseConfigured) return false;
  const normalized = String(code).trim();
  if (!normalized) return false;

  const qc = getQueryClient();
  try {
    return await qc.fetchQuery({
      queryKey: qk.isQdiiFund(normalized),
      queryFn: async () => {
        const { data, error } = await withRetry(() =>
          supabase.from('gs_qdii').select('fund_code').eq('fund_code', normalized).maybeSingle()
        );
        return !error && data != null;
      },
      staleTime: 12 * 60 * 60 * 1000
    });
  } catch {
    return false;
  }
};
```

**Step 4: Expand source-name mapping**

Update:

```js
const SOURCE_NAME_TO_ID = { fundgz: 1, sina_ds2: 2, sina_ds3: 3, supabase_qdii: 4 };
```

**Step 5: Implement explicit source 4**

Move the browser-environment guard below the data source normalization and add:

```js
if (ds === 4) {
  const qdii = await fetchQdiiValuationFromSupabase(c);
  if (!qdii) throw new Error('gs_qdii no data');
  return {
    code: c,
    ...qdii,
    gsz: null
  };
}
```

Then keep the `window` / `document` guard for data sources `1`, `2`, and `3`.

**Step 6: Add mandatory legacy QDII migration**

Before removing the implicit source-1 fallback, add a central storage migration so stored funds like this:

```js
{ code: '000000', dataSource: 1, valuationSource: 'supabase_qdii' }
```

become:

```js
{ code: '000000', dataSource: 4, valuationSource: 'supabase_qdii' }
```

Implementation location: `app/stores/storageStore.js`.

Add `isPlainObject` to the lodash import in `app/stores/storageStore.js` if it is not already present.

Add a small funds normalizer used by `normalizeStorageValue('funds', value)` and by `initFunds`:

```js
const normalizeFundsForStorage = (value) => {
  const list = isString(value) ? JSON.parse(value || '[]') : value;
  if (!isArray(list)) return [];
  return list.map((fund) => {
    if (!isPlainObject(fund)) return fund;
    const dataSource = Number(fund.dataSource);
    if (fund.valuationSource === 'supabase_qdii' && (!Number.isFinite(dataSource) || dataSource === 1)) {
      return { ...fund, dataSource: 4 };
    }
    return fund;
  });
};
```

Wire it into `normalizeStorageValue('funds', value)` so every future `setItem('funds', ...)` write is normalized, not only initial load. Also ensure existing local storage is persisted during `initFunds` when the migration changes the loaded list. Direct `localStorage` access is allowed here because this is inside `storageStore`.

Important sync side effect: `dataSource` is part of `getFundCodesSignature`, so the first `1 -> 4` migration can trigger one `funds` cloud sync. That is expected and desirable because it propagates the explicit source-4 migration to cloud devices.

Known limitation: this migration is intentionally tag-gated. It only covers funds that already have `valuationSource: 'supabase_qdii'`, because detecting untagged QDII funds would require async `isQdiiFund` / Supabase checks that do not belong in the synchronous storage normalizer. A true QDII fund stored as `dataSource: 1` but never tagged may need one auto-source refresh or a manual source-4 selection to recover after the hidden fallback is removed.

Run after implementation:

```bash
rg -n "normalizeFundsForStorage|supabase_qdii.*dataSource|dataSource: 4" app/stores/storageStore.js
```

Expected:

- Legacy QDII data-source migration is mandatory and centralized.
- Migration uses `isPlainObject` rather than introducing ad hoc shape checks or native type checks.
- Migration is idempotent across both initial load and future `funds` writes.
- The first migrated write may sync because `dataSource` changes; this is expected.
- No component or feature hook writes `window.localStorage` directly.

**Step 7: Remove implicit source-1 QDII fallback**

Match upstream behavior by removing the `trySupabaseFallback` path from the fundgz request and removing the `storedValuationSource === 'supabase_qdii' && dataSource === 1` shortcut in `fetchFundData`.

Because Step 6 migrates resolved/tagged legacy records, removing the hidden fallback should not silently break existing QDII funds that previously resolved through the Supabase QDII fallback. It may still expose untagged QDII funds that were stored as source 1 before ever receiving `valuationSource: 'supabase_qdii'`; accept that as a recoverable known limitation, handled by auto-source or the data-source selector rather than by async detection in `storageStore`.

**Step 8: Verify exports**

Run:

```bash
rg -n "isQdiiFund|supabase_qdii|SOURCE_NAME_TO_ID|normalizeValuationDataSource" app/services/fund app/lib/query-keys.js app/api/fund.js
npm run lint
```

Expected:

- `isQdiiFund` is exported through `app/api/fund.js` because the barrel exports `valuationApi`.
- `app/lib/query-keys.js` also exports `isQdiiFund`, but it is only consumed as `qk.isQdiiFund`; there is no barrel-name collision because `app/api/fund.js` does not export query-key factories.
- Lint passes or only known warnings remain.

**Step 9: Commit**

Run:

```bash
git add app/services/fund/valuationApi.js app/lib/query-keys.js app/stores/storageStore.js
git commit -m "feat: add QDII valuation source"
```

---

## Task 3: Port QDII Data Source 4 UI

**Files:**

- Modify: `app/components/fund/FundDataSourceSelector.jsx`
- Modify: `app/components/charts/FundValuationTrendChart.jsx`

**Step 1: Import the QDII checker**

Update:

```js
import { fetchFundValuationBySource, fetchBestValuationSource, fetchFundBestSource, isQdiiFund } from '@/app/api/fund';
```

**Step 2: Add source-4 state**

Expand the initial state objects in `FundDataSourceSelector`:

```js
const [estimates, setEstimates] = useState({ 1: null, 2: null, 3: null, 4: null });
const [valuationSources, setValuationSources] = useState({ 1: null, 2: null, 3: null, 4: null });
const [isQdii, setIsQdii] = useState(false);
```

**Step 3: Load source 4 only for QDII funds**

In the `useEffect` that loads estimates:

- Reset `isQdii` to `false`.
- Call `isQdiiFund(fund.code)` first.
- Fetch sources `1`, `2`, and `3` for all funds.
- Fetch source `4` only when `qdii === true`.
- Include source `4` in realtime accuracy diffs when it has numeric `gszzl`.

**Step 4: Render source 4 conditionally**

Change the radio item list to:

```js
[
  { id: '1', name: '数据源 1', est: estimates[1] },
  { id: '2', name: '数据源 2', est: estimates[2] },
  { id: '3', name: '数据源 3', est: estimates[3] },
  ...(isQdii ? [{ id: '4', name: '数据源 4', est: estimates[4] }] : [])
];
```

Display the orange `限免` badge for `item.id === '4'`.

**Step 5: Update valuation trend labels**

In `app/components/charts/FundValuationTrendChart.jsx`, add:

```js
supabase_qdii: '数据源 4';
```

Also add `supabase_qdii: new Map()` to the `sourceData` object.

**Step 6: Verify**

Run:

```bash
npm run lint
```

Manual check:

- Open a known QDII fund from `gs_qdii`; data source modal shows source 4.
- Open a normal fund; source 4 is hidden.
- Auto-source can select `4` if RPC returns `supabase_qdii`.

**Step 7: Commit**

Run:

```bash
git add app/components/fund/FundDataSourceSelector.jsx app/components/charts/FundValuationTrendChart.jsx
git commit -m "feat: show QDII data source option"
```

---

## Task 4: Port Table Pagination

**Files:**

- Modify: `app/components/tables/PcFundTable.jsx`
- Modify: `app/components/tables/MobileFundTable.jsx`
- Modify: `app/components/tables/FundListView.jsx`
- Reuse: `components/ui/pagination.jsx`
- Reuse: `components/ui/input.jsx`

**Step 1: Add TanStack pagination imports**

In both table files, change the table import to include `getPaginationRowModel`:

```js
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
```

Add shadcn pagination imports:

```js
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
```

**Step 2: Add shared pagination state pattern**

In each table component:

```js
const [pagination, setPagination] = useState(() => {
  let size = 20;
  try {
    if (typeof window !== 'undefined') {
      const stored = storageStore.getItem('fundTablePageSize');
      if (stored && isNumber(stored) && stored > 0) size = stored;
    }
  } catch (e) {}
  return { pageIndex: 0, pageSize: size };
});

useEffect(() => {
  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
}, [currentTab, sortBy, sortOrder]);
```

Use lodash `isNumber`; if not already imported, add it.

**Step 3: Wire table state**

Add to `useReactTable`:

```js
state: {
  ...existingState,
  pagination
},
onPaginationChange: setPagination,
getPaginationRowModel: getPaginationRowModel()
```

Make sure rendering uses `table.getRowModel().rows`, which now returns paginated rows.

Pagination-specific reorder rules:

- Drag-and-drop reorder must continue to call `onReorder(oldIndex, newIndex)` with indexes from the full `data` array, not page-local row indexes. Compute indexes by `row.original.code` / `active.id` / `over.id` with `data.findIndex`.
- Move-to-front buttons must also compute their source index from the full `data` array.
- `SortableContext` may list only visible page row ids for page-local dragging, but the reorder callback must still translate those ids back to full-data indexes.

**Step 4: Add pagination footer**

Add the upstream footer below the table body in both table files:

- Left side: `每页` + `<Input>` + `条`.
- Input `className` must include `text-[16PX]` to prevent iOS Safari zoom.
- On blur, sanitize invalid values to `20`, call `table.setPageSize(val)`, write `storageStore.setItem('fundTablePageSize', val)`, and scroll to top.
- Right side: `PaginationPrevious`, page links with ellipses, `PaginationNext`.

**Step 5: Move or reconcile PC wrapper**

Upstream moved `.table-pc-wrap` / `.table-scroll-area` from `FundListView` into `PcFundTable`. Reconcile carefully:

- If current `PcFundTable` already owns its scroll wrapper, do not duplicate wrappers.
- If `FundListView` still wraps `PcFundTable`, move that wrapper into `PcFundTable` before adding the footer so pagination sits inside the table container.
- Preserve sticky header behavior and any existing route-shell offsets.

**Step 6: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual check:

- PC list view paginates rows.
- Mobile list view paginates rows.
- Changing sort/group resets to first page.
- Every-page input persists after reload.
- iOS/mobile viewport focus on input does not zoom.
- Drag/reorder still works when `sortBy === 'default'`; dragging within page 2 moves the underlying full list item, not page-local index `0`.
- Batch selection semantics are explicit: "全选" selects every batch-selectable row in the current filtered tab across all pages, individual selected codes persist while paging, and bulk delete/move receives the selected code set across pages.

**Step 7: Commit**

Run:

```bash
git add app/components/tables/PcFundTable.jsx app/components/tables/MobileFundTable.jsx app/components/tables/FundListView.jsx
git commit -m "feat: add fund table pagination"
```

---

## Task 5: Port Cloud Sort Settings Fix

**Files:**

- Modify: `app/hooks/useSyncManager.js`

**Step 1: Replace merge direction**

Find the `cloudData.customSettings` apply block. Change:

```js
const merged = { ...(currentCustomSettings || {}), ...cloudData.customSettings };
```

to:

```js
const merged = { ...cloudData.customSettings };
```

Remove `currentCustomSettings` if it becomes unused.

**Step 2: Apply cloud local sort rules**

After `setCustomSettings(merged)`, add:

```js
if (merged.localSortRules && isArray(merged.localSortRules)) {
  useStorageStore.getState().setSortRules(merged.localSortRules);
}
```

**Step 3: Verify**

Run:

```bash
rg -n "localSortRules|setSortRules|customSettings" app/hooks/useSyncManager.js
npm run lint
```

Manual check:

- Put different local sort rules in cloud config.
- Trigger cloud pull.
- Table sort rules update to cloud rules, not stale local rules.

**Step 4: Commit**

Run:

```bash
git add app/hooks/useSyncManager.js
git commit -m "fix: apply cloud sort personalization"
```

---

## Task 6: Port Auto-Source User-State Guard

**Files:**

- Modify: `app/hooks/useRefreshManager.js`

**Step 1: Import user store**

Change:

```js
import { useStorageStore, storageStore } from '../stores';
```

to:

```js
import { useStorageStore, storageStore, useUserStore } from '../stores';
```

**Step 2: Guard auto-source refresh**

Before editing, rerun the pre-check for this hook:

```bash
rg -n "bestSourcesMap|fetchFundsBestSources|autoSourceCodes|useStorageStore.getState\\(\\).funds" app/hooks/useRefreshManager.js
```

Expected:

- The existing auto-source batch block is present and can be wrapped with the user-state guard.

In the `bestSourcesMap` block:

- Read `const user = useUserStore.getState().user;`.
- If no user and any fund has `autoSource`, call `setFunds` to set `autoSource: false`.
- If user exists, keep the existing batch `fetchFundsBestSources` flow.

Target shape:

```js
const currentFunds = useStorageStore.getState().funds || [];
const user = useUserStore.getState().user;

if (!user) {
  const hasAutoSource = currentFunds.some((f) => f.autoSource);
  if (hasAutoSource) {
    useStorageStore.getState().setFunds((prev) => prev.map((f) => (f.autoSource ? { ...f, autoSource: false } : f)));
  }
} else {
  const autoSourceCodes = currentFunds.filter((f) => f.autoSource && uniqueCodes.includes(f.code)).map((f) => f.code);
  // existing fetchFundsBestSources flow
}
```

**Step 3: Verify**

Run:

```bash
npm run lint
```

Manual check:

- Logged out: refresh turns off `autoSource` without calling best-source RPC.
- Logged in: refresh still batches best-source lookups.

**Step 4: Commit**

Run:

```bash
git add app/hooks/useRefreshManager.js
git commit -m "fix: guard auto source by user state"
```

---

## Task 7: Port Trading-Day NAV Updated Logic

**Files:**

- Modify: `app/lib/tradingCalendar.js`
- Modify: `app/lib/fundHelpers.js`

**Step 1: Add trading-day helpers**

In `app/lib/tradingCalendar.js`, add:

```js
export function getPrevTradingDay(date) {
  let d = date.startOf('day');
  let attempts = 30;
  while (attempts-- > 0) {
    if (isTradingDay(d)) return d;
    d = d.subtract(1, 'day');
  }
  return null;
}

export function countTradingDaysBetween(startDateStr, endDateStr, toDayjs) {
  const start = toDayjs(startDateStr).startOf('day');
  const end = toDayjs(endDateStr).startOf('day');
  const totalDays = end.diff(start, 'day');
  if (totalDays <= 0) return 0;
  let count = 0;
  let d = start.add(1, 'day');
  const limit = Math.min(totalDays, 400);
  for (let i = 0; i < limit; i++) {
    if (isTradingDay(d)) count++;
    d = d.add(1, 'day');
  }
  return count;
}
```

**Step 2: Update `isNavUpdated`**

Before editing, verify `fundHelpers.js` already extends the `isSameOrAfter` dayjs plugin. If not, add it before using `isSameOrAfter`.

Import the helpers:

```js
import { getPrevTradingDay, countTradingDaysBetween } from './tradingCalendar';
```

Replace the natural-day logic with:

```js
export function isNavUpdated(jzrq, todayStr, confirmDays) {
  if (!isString(jzrq) || !jzrq) return false;
  if (jzrq === todayStr) return true;

  const days = Number(confirmDays) || 1;

  if (days <= 1) {
    const prevTD = getPrevTradingDay(toTz(todayStr));
    if (!prevTD) return false;
    return toTz(jzrq).startOf('day').isSameOrAfter(prevTD, 'day');
  }

  const tradingDays = countTradingDaysBetween(jzrq, todayStr, toTz);
  return tradingDays >= 0 && tradingDays <= days;
}
```

**Step 3: Verify edge cases manually in devtools or temporary console**

Check expected behavior:

- Normal fund on Saturday with Friday NAV: updated.
- Normal fund during long holiday with pre-holiday latest NAV: updated.
- QDII/T+2 fund with NAV two trading days behind: updated.
- QDII/T+2 fund beyond confirm days: not updated.

**Step 4: Run checks**

Run:

```bash
npm run lint
```

**Step 5: Commit**

Run:

```bash
git add app/lib/tradingCalendar.js app/lib/fundHelpers.js
git commit -m "fix: use trading days for NAV update checks"
```

---

## Task 8: Port T+2 Daily Profit Basis

**Files:**

- Modify: `app/hooks/useRefreshManager.js`
- Modify: `app/hooks/useHoldingProfit.js`
- Inspect: `app/hooks/useSyncManager.js`
- Inspect: `app/stores/storageStore.js`

**Step 1: Track refresh date**

Before editing, rerun the pre-check for both hooks:

```bash
rg -n "updated.push\\(data\\)|getStoredFundSnapshot|confirmDays|hasTodayValuation|canCalcTodayProfit|useValuation|shareForTodayProfit" app/hooks/useRefreshManager.js app/hooks/useHoldingProfit.js
```

Expected:

- `updated.push(data)` has a nearby `oldData` snapshot.
- `useHoldingProfit.js` has the existing same-day transaction exclusion and later `useValuation` block that will be replaced.

In `useRefreshManager`, near existing date helpers inside `refreshAll`, add:

```js
const refreshDateStr = dayjs().tz(TZ).format('YYYY-MM-DD');
```

**Step 2: Set `navUpdatedAt` when NAV date advances**

After `oldData` is read and before `updated.push(data)`, add:

```js
const currentNavDate = isValidDateStr(data.jzrq) ? data.jzrq : null;
const previousNavDate = isValidDateStr(oldData?.jzrq) ? oldData.jzrq : null;
if (currentNavDate && previousNavDate && currentNavDate > previousNavDate) {
  data.navUpdatedAt = refreshDateStr;
} else if (currentNavDate && previousNavDate === currentNavDate && oldData?.navUpdatedAt === refreshDateStr) {
  data.navUpdatedAt = oldData.navUpdatedAt;
} else if (data.navUpdatedAt !== undefined) {
  delete data.navUpdatedAt;
}
```

**Step 3: Preserve `navUpdatedAt` during merge**

Do not manually overwrite `navUpdatedAt` from the old fund object in the final funds merge. The fresh `data` object should carry it only when the refresh logic explicitly sets it.

Before relying on this sync behavior, verify the two sync gates:

```bash
rg -n "getComparablePayload|return JSON.stringify|stripLegacyTagsFromFundObject|all\\.funds =" app/hooks/useSyncManager.js
rg -n "getFundCodesSignature|new Set\\(\\['jzrq', 'dwjz', 'dataSource', 'showImageChart'" app/stores/storageStore.js
```

Expected:

- `collectLocalPayload` still passes `funds` as whole fund objects after only stripping legacy inline tags.
- `getComparablePayload` uses fund code lists for comparable sync signatures and does not model `navUpdatedAt`.
- `getFundCodesSignature` does not include `navUpdatedAt`.

Sync decision:

- Keep `navUpdatedAt` in the stored fund object and allow it to sync when a real NAV-date update syncs the same fund row.
- There are two sync gates to keep in mind: `storageStore.getFundCodesSignature` filters `funds` writes before scheduling sync, while `useSyncManager.getComparablePayload` avoids redundant full syncs. Do not add `navUpdatedAt` to either comparison model.
- Do not strip `navUpdatedAt` in `collectLocalPayload`. If another device receives a newer `jzrq`/`dwjz` from cloud on the same date, carrying `navUpdatedAt` lets T+2 profit calculation consistently switch to confirmed NAV with that cloud NAV.
- If future product direction requires `navUpdatedAt` to be local-only, then also define how cloud-applied advanced NAV should switch to confirmed NAV without this marker before stripping it.

**Step 4: Update `useHoldingProfit` basis logic**

Near the top of `getHoldingProfit`, add:

```js
const confirmDays = Number(fund.confirmDays) || 1;
const isDelayedConfirmFund = Number.isFinite(confirmDays) && confirmDays >= 2;
const hasExactTodayData = isString(fund.jzrq) && fund.jzrq === todayStr;
const hasTodayData = isNavUpdated(fund.jzrq, todayStr, fund.confirmDays);
const hasTodayValuation = isString(fund.gztime) && fund.gztime.startsWith(todayStr);
const navUpdatedAtToday = isString(fund.navUpdatedAt) && fund.navUpdatedAt === todayStr;
const shouldUseConfirmedNav =
  hasExactTodayData || (isDelayedConfirmFund ? hasTodayData && navUpdatedAtToday : hasTodayData);
const useValuation = hasTodayValuation && !shouldUseConfirmedNav ? true : isTradingDay && !hasTodayData;
const canCalcTodayProfit = shouldUseConfirmedNav || hasTodayValuation;
const profitBasisDate = canCalcTodayProfit && !useValuation && isString(fund.jzrq) && fund.jzrq ? fund.jzrq : todayStr;
```

Remove the later duplicate `useValuation` block.

**Step 5: Update cache key validity**

Include `profitBasisDate` in the cache validity comparison and cached payload.

**Step 6: Update same-day transaction exclusion**

Change:

```js
if (!tx || tx.date !== todayStr) continue;
```

to:

```js
if (!tx || !tx.date || tx.date < profitBasisDate) continue;
```

**Step 7: Verify**

Run:

```bash
npm run lint
```

Manual check:

- QDII/T+2 fund during daytime with today's valuation but delayed NAV uses valuation for today's profit.
- After NAV date advances during refresh, the same fund uses confirmed NAV.
- A transaction between old NAV date and `profitBasisDate` is excluded from daily-profit shares.

**Step 8: Commit**

Run:

```bash
git add app/hooks/useRefreshManager.js app/hooks/useHoldingProfit.js
git commit -m "fix: adjust T+2 daily profit basis"
```

---

## Task 9: Port Tooltip And Group Dropdown Polish

**Files:**

- Modify: `app/styles/components.css`
- Inspect: `app/components/pages/HomePageContent.jsx`

**Step 1: Add desktop tooltip transparency**

Add near existing `.trend-tooltip-*` rules:

```css
@media (min-width: 641px) {
  .trend-tooltip-desktop {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.75)) !important;
    backdrop-filter: blur(8px) !important;
  }

  [data-theme='light'] .trend-tooltip-desktop {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.2)) !important;
    backdrop-filter: blur(2px) !important;
  }
}
```

**Step 2: Reconcile group dropdown scroll**

In `HomePageContent`, find `SelectContent` for group dropdown. Remove any forced unlimited height such as:

```jsx
className="max-h-none"
style={{ maxHeight: 'none' }}
```

Keep the width style:

```jsx
style={{ width: isMobile ? 230 : 300 }}
```

If current code already matches this, mark this step complete with no code change.

**Step 3: Verify**

Run:

```bash
npm run lint
```

Manual check:

- PC chart hover tooltip remains readable and less opaque.
- Group dropdown scrolls normally when many groups exist.

**Step 4: Commit**

Run:

```bash
git add app/styles/components.css app/components/pages/HomePageContent.jsx
git commit -m "fix: polish tooltip and group dropdown"
```

If `HomePageContent.jsx` had no changes, omit it from `git add`.

---

## Task 10: Port Version And Announcement

**Files:**

- Modify: `app/components/system/Announcement.jsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1: Update announcement key and text**

Set:

```js
const ANNOUNCEMENT_KEY = 'hasClosedAnnouncement_v2.3.3';
```

Use final upstream announcement content:

```jsx
<p>v2.3.3 版本更新内容：</p>
<p>1. 优化净值更新判断。</p>
<p>2. 调整 T+2 类型基金当日收益计算方式。</p>
```

Do not preserve the intermediate server-upgrade announcement unless product explicitly wants an old operational notice.

**Step 2: Bump package version**

Set `version` to `2.3.3` in `package.json` and `package-lock.json`.

Preferred command:

```bash
npm version 2.3.3 --no-git-tag-version
```

If this changes unrelated lockfile sections, inspect before committing.

**Step 3: Verify**

Run:

```bash
rg -n '"version": "2.3.3"|hasClosedAnnouncement_v2.3.3|v2.3.3' package.json package-lock.json app/components/system/Announcement.jsx
npm run lint
npm run build
```

Manual check:

- Fresh localStorage profile sees v2.3.3 announcement.
- Closing it stores `hasClosedAnnouncement_v2.3.3`.
- Older `hasClosedAnnouncement_v*` keys are still cleaned up by existing logic.

**Step 4: Commit**

Run:

```bash
git add app/components/system/Announcement.jsx package.json package-lock.json
git commit -m "chore: release version 2.3.3"
```

---

## Task 11: Update Sync Documentation And Baseline

**Files:**

- Modify: `doc/upstream-sync.md`
- Modify: `doc/upstream-sync-be17676-checklist.md`
- Modify: `AGENTS.md`

**Step 1: Update checklist final section**

Mark all decisions complete or intentionally skipped. Record final lint/build results and manual checks.

**Step 2: Update upstream baseline doc**

In `doc/upstream-sync.md`, change current baseline to:

```text
be176765566d0e6f83b7614b5e0d7328087a633b
feat：发布 2.3.3
2026-06-28 23:27:17 +0800
```

Add a summary paragraph:

```markdown
The 2.3.3 sync (`2e14d9e..be17676`) was ported into the refactored architecture on 2026-06-29. Ported: QDII data source 4, table pagination, cloud sort-personalization apply fix, auto-source login guard, trading-day NAV-update logic, T+2 daily-profit basis, PC tooltip opacity, group-dropdown scroll behavior, v2.3.3 release announcement and package version.
```

**Step 3: Update `AGENTS.md` upstream baseline**

Update the recorded upstream baseline in the "UPSTREAM SYNC" section to `be176765...` only after code is ported and verified.

Also add the Safari input zoom note if not already represented:

```markdown
- Safari input zoom: inputs used on mobile should have a computed font-size of at least 16px. When using Tailwind arbitrary sizes in CSS that passes through pxtorem, use `text-[16PX]` for small pagination/settings inputs that must not trigger iOS Safari zoom.
```

**Step 4: Move local upstream tag if used**

Only after all tasks are complete:

```bash
git -C download/real-time-fund tag -f -a sync-baseline -m "Sync baseline: be17676 (2026-06-28)" be176765566d0e6f83b7614b5e0d7328087a633b
```

**Step 5: Final verification**

Run:

```bash
npm run lint
npm run build
git status --short
```

Expected:

- Lint/build pass or only known pre-existing warnings remain.
- No unexpected unrelated files are modified.

**Step 6: Commit**

Run:

```bash
git add doc/upstream-sync.md doc/upstream-sync-be17676-checklist.md AGENTS.md
git commit -m "docs: record upstream 2.3.3 sync"
```

---

## Manual Regression Checklist

Run these after all tasks:

- Home route `/`: card view and list view render.
- Main routes `/market` and `/mine` still navigate without remounting the shell unexpectedly.
- PC table: pagination, sorting, column settings, drag/reorder, batch delete, move group.
- Mobile table: pagination, detail drawer, edit mode, batch move/delete, settings modal.
- Data source modal: normal fund shows sources 1-3; QDII fund shows source 4.
- Auto-source: logged-in user can fetch best source; logged-out user has auto-source disabled safely.
- Valuation trend: data source 4 appears when historical `supabase_qdii` rows exist.
- T+2/QDII fund: daily profit uses valuation before confirmed NAV advances and confirmed NAV after `navUpdatedAt` is set.
- Cloud sync: cloud `customSettings.localSortRules` overwrites local stale rules during pull.
- Announcement: v2.3.3 text appears once per new close key.
- Build output still supports static export and routes with trailing slash.

## Out Of Scope

- Populating Supabase `gs_qdii`, `fund_best_source`, `fund_related`, or `fund_topic` data.
- Changing database schema unless source-4 data requires operational table population.
- Introducing test infrastructure.
- Copying upstream IDE metadata.
- Replaying the intermediate server-upgrade announcement after the final v2.3.3 release announcement.

---

## Final Review Resolution

This plan was reviewed four times on 2026-06-29 and is approved for implementation. Historical review notes have been folded into the executable tasks above; execute the task list rather than reopening review.

**Resolved implementation decisions:**

- QDII source 4 must be ported as an explicit data source. The legacy source-1 Supabase QDII fallback can be removed only after Task 2 adds the mandatory tag-gated storage migration.
- The QDII migration covers funds already resolved/tagged with `valuationSource: 'supabase_qdii'`. Do not add async QDII detection to `storageStore`; untagged source-1 QDII funds recover via auto-source or manual source-4 selection.
- `navUpdatedAt` stays in stored fund objects. It should not be added to `storageStore.getFundCodesSignature` or `useSyncManager.getComparablePayload`, and should not be stripped from `collectLocalPayload`.
- Pagination must preserve full-list reorder indexes and cross-page selected-code behavior.
- `isQdiiFund` is intentionally present both as `qk.isQdiiFund` and as an API function; keep query keys namespaced through `qk`.

**Verified integration assumptions:**

- The upstream range and file mapping are accurate for `2e14d9e3a3617a228fa4c28305b3b5408a93a43e..be176765566d0e6f83b7614b5e0d7328087a633b`.
- `app/api/fund.js` remains a barrel; implementation belongs in `app/services/fund/valuationApi.js` and query keys in `app/lib/query-keys.js`.
- `Task 6` can import `useUserStore` from the existing stores barrel.
- `Task 4` pagination reset dependencies use real table props: `currentTab`, `sortBy`, and `sortOrder`.
- `Task 2` should add `isPlainObject` to the existing lodash import in `app/stores/storageStore.js`. Existing store code mostly uses `isObject`, but `isPlainObject(fund)` is the stricter choice for the new migration.

**Stop conditions for the executor:**

- A required `rg` pre-check anchor is missing or materially renamed.
- Lint/build fails for a reason not clearly caused by the current task.
- A task requires direct business `localStorage` access outside `storageStore`.
- A port would require replacing current route-backed `AppShell` architecture with upstream `app/page.jsx`.

If none of those occurs, proceed task-by-task and use the manual regression checklist before updating the upstream baseline.
