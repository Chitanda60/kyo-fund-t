# Upstream Real-Time Fund 2.3.1 Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port upstream changes from `download/real-time-fund` commit `ffaf4b090960ecc715a32556bc02b513cce07159` through `2e14d9e3a3617a228fa4c28305b3b5408a93a43e` into the current refactored project without changing the existing routed-page architecture or regressing UI behavior.

**Architecture:** Treat `download/real-time-fund` as the upstream source of product changes, but do not copy files wholesale. Map upstream monolithic `app/page.jsx` changes into the current `AppShell`, route content components, and extracted `app/features/*` hooks according to ownership: orchestration in `AppShell`, render-only tab UI in `app/components/pages/*`, portfolio derivation/mutations in `app/features/portfolio/*`, tags in `app/features/tags/*`, trading in `app/features/trading/*`, and search handoff in `app/features/search/*`. Map upstream `app/api/fund.js` changes into `app/services/fund/*`, and map upstream `app/globals.css` changes into `app/styles/*`. Preserve local conventions: route-backed tabs, `storageStore` for business persistence, Zustand modal state, feature-hook ownership, and the split CSS/service structure.

**Tech Stack:** Next.js 16 App Router, React 19, JavaScript/JSX only, Zustand, TanStack Query, Tailwind v4 CSS variables, shadcn/ui primitives, static export, JSONP/script-injection financial APIs, Supabase optional sync.

---

## Upstream Range

**Anchor commit already matched to the current project's original source:**

```bash
ffaf4b090960ecc715a32556bc02b513cce07159
feat：悬浮框字体大小调整
2026-06-17 17:25:47 +0800
```

**Target upstream commit:**

```bash
2e14d9e3a3617a228fa4c28305b3b5408a93a43e
feat：分组下拉宽度调整
2026-06-24 09:52:09 +0800
```

**Main upstream commits in scope:**

```text
ab6a2aa feat：标签提示
7f1e2fd feat：全部板块切换类别滚动到顶部
169d06e feat：业绩走势展示改为使用累计净值
d2fef6e feat：删除基金不删除收益数据
c1458f9 fix：设置弹框-页面宽度进度条问题
d2e5bbd fix：移动PC表格拖拽问题
9c0b89d feat：忽略 Script Error 提示
d2f6e3b fix：删除全部和自定义分组旧数据迁移逻辑
847c956 feat：移动设备判断增强
2bb40fd feat：自动切换数据源
3907280 feat：导入基金支持选择自动数据源
0a70aa3 feat：部分基金支持推荐标签
26a16a8 feat：优化 PC 端基金标签样式
b659e23 fix：移动端判断兼容性问题
7ca4e21 feat：未登录隐藏估值走势入口
4f71ae7 fix：修复 PC 端页面宽度设置问题
e1e9aea feat: 重新尝试 按钮样式问题
15c04cb feat: 添加用户状态判断以优化数据源切换和自动数据源功能
8c56f6b feat: 新增数据源列
1396041 feat: 个性化排序新增置顶
a40deeb feat: 获取最佳数据源接口缓存
4c00868 feat: 补充静态资源报错提示信息
154a30f feat: 补充静态资源报错提示信息
9b928ae feat: 发布 2.3.0
45323b1 fix：修复弹框高度计算问题
0dce490 fix：文案调整
298feeb feat：定投弹框层级问题
4339afe feat：略微降低悬浮窗透明度
112a113 feat：优化 PC 端分组展示效果
d8c528d feat：导入基金弹框允许是否导入基金标签
0ae4518 feat：移动PC判断逻辑调整
919299e feat：设置弹框布局调整
e40e8af feat：优化 PC 端表格列拖拽效果
28653b6 feat：个性化设置新增下拉展示分组
e33f257 fix：分组内搜索元素布局问题
5b4c194 feat：发布 2.3.1
2e14d9e feat：分组下拉宽度调整
```

Ignore upstream commits that only update AI-agent files, IDE metadata, or group QR images unless the product owner explicitly wants those artifacts synced.

## Non-Negotiable Rules

- Do not overwrite current `app/page.jsx`; it is now a route page, not the upstream monolithic shell.
- Do not overwrite current `app/api/fund.js`; it is now a barrel for `app/services/fund/*`.
- Do not overwrite current `app/globals.css`; it now imports split style files under `app/styles/*`.
- Keep route-backed tabs: `/`, `/market`, `/mine`.
- Keep page orchestration in `app/components/AppShell.jsx`.
- Keep route content in `app/components/pages/HomePageContent.jsx`, `MarketPageContent.jsx`, and `MinePageContent.jsx`.
- Keep extracted business logic in `app/features/*`: display/sort and mutations stay under `app/features/portfolio/*`, tag actions under `app/features/tags/*`, trading/DCA under `app/features/trading/*`, and search/add-fund handoff under `app/features/search/*`.
- All business `localStorage` reads and writes must go through `storageStore` or `useStorageStore`.
- New modal state must live in `app/stores/modalStore.js`; modal rendering stays in `app/components/ModalsLayer.jsx`.
- `page.jsx` and route content components must not subscribe to modal state.
- Use lodash helpers for data type checks unless checking undeclared globals.
- Keep JavaScript/JSX only. Do not introduce TypeScript.
- Do not introduce a test framework during this sync.
- For every task that edits `app/components/AppShell.jsx`, first check the Task 1 `app/page.jsx` hunk map and modify only the hunk(s) owned by that task.
- If a mapped upstream `page.jsx` hunk cannot be found in `AppShell.jsx`, search `app/features/*` before adding new logic to `AppShell.jsx`.
- After every task that edits `app/components/AppShell.jsx`, run `git diff -- app/components/AppShell.jsx` and verify no unrelated hunk was touched.
- Commit after each task when the project builds or at least passes lint for that task.

## Pre-Flight Commands

Run these before editing:

```bash
git status --short
git -C download/real-time-fund show -s --format='%H%n%s%n%ci' ffaf4b090960ecc715a32556bc02b513cce07159
git -C download/real-time-fund show -s --format='%H%n%s%n%ci' 2e14d9e3a3617a228fa4c28305b3b5408a93a43e
git -C download/real-time-fund diff --name-status ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e
npm run lint
npm run build
```

Expected:

- The upstream anchor and target commits print the hashes above.
- The diff includes app/product files plus AI/IDE/docs noise.
- Current project lint/build state is recorded before any sync changes.
- If baseline lint/build already fails, record the failure text in the implementation notes and continue only if the failure is unrelated to the sync.

---

## Task 1: Create The Sync Checklist And Baseline Notes

**Files:**

- Create: `doc/upstream-sync-2e14d9e-checklist.md`
- Modify only after successful final sync: `doc/upstream-sync.md`
- Modify only after successful final sync: `AGENTS.md`

**Step 1: Generate upstream file lists**

Run:

```bash
git -C download/real-time-fund diff --name-status ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app components lib package.json package-lock.json public doc
```

Expected product files in scope include:

```text
app/api/fund.js
app/components/AllSectorsModal.jsx
app/components/Announcement.jsx
app/components/ClientErrorBoundary.jsx
app/components/DataSourceAccuracyBadge.jsx
app/components/DcaModal.jsx
app/components/FundCard/index.jsx
app/components/FundDataSourceSelector.jsx
app/components/FundHistoryNetValue.jsx
app/components/FundHistoryNetValueModal.jsx
app/components/FundTagsEditDialog.jsx
app/components/FundTrendChart.jsx
app/components/FundValuationTrendChart.jsx
app/components/GlobalClientErrorHandler.jsx
app/components/GroupManageModal.jsx
app/components/GroupModal.jsx
app/components/GroupSummary.jsx
app/components/MobileFundTable.jsx
app/components/MobileSettingModal.jsx
app/components/ModalsLayer.jsx
app/components/MyEarningsCalendarPage.jsx
app/components/PcFundTable.jsx
app/components/PcTableSettingModal.jsx
app/components/ScanImportConfirmModal.jsx
app/components/SettingsModal.jsx
app/components/SortSettingModal.jsx
app/hooks/useDataSourceAccuracyLabels.js
app/hooks/useRefreshManager.js
app/hooks/useScanImport.js
app/hooks/useSyncManager.js
app/lib/containerWidth.js
app/lib/fundHelpers.js
app/lib/query-keys.js
app/page.jsx
app/stores/settingsStore.js
components/ui/progress.jsx
package-lock.json
package.json
```

**Step 2: Write checklist file**

Create `doc/upstream-sync-2e14d9e-checklist.md` with:

```markdown
# Upstream Sync Checklist: ffaf4b0 to 2e14d9e

## Range

- Anchor: `ffaf4b090960ecc715a32556bc02b513cce07159`
- Target: `2e14d9e3a3617a228fa4c28305b3b5408a93a43e`

## Decisions

- [ ] Auto/best data source: port
- [ ] Import auto source switch: port
- [ ] Recommended tags: port
- [ ] Data source column and badges: port
- [ ] Personalized sort top/pin: port
- [ ] Group dropdown display settings: port
- [ ] Width/slider/dialog fixes: port
- [ ] Chart cumulative net value: port
- [ ] Error boundary/static asset wording: port
- [ ] QR image updates: decide
- [ ] AI/IDE metadata: ignore

## Baseline

- `npm run lint`: TODO
- `npm run build`: TODO

## Final

- `npm run lint`: TODO
- `npm run build`: TODO
- Manual route checks: TODO
- Manual data source checks: TODO
- Manual import checks: TODO

## app/page.jsx Hunk Map

| Upstream hunk                                                                                                                                          | Target file(s)                                                                                                       | Task            | Status |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------- | ------ |
| Imports: `ChevronLeft`, `ChevronRight`, `SelectGroup`, `cn`; remove `seedGroupHoldingsFromGlobal` import                                               | `app/components/AppShell.jsx`, `app/components/pages/HomePageContent.jsx`, `app/hooks/useSyncManager.js`             | Task 7          | TODO   |
| Settings store fields: `showGroupDropdownPc`, `showGroupDropdownMobile`                                                                                | `app/stores/settingsStore.js`, `app/components/AppShell.jsx`                                                         | Task 7          | TODO   |
| Tab refs and overflow state: `scrollAreaRef`, `hasTabOverflow`, left/right scroll buttons, ResizeObserver/MutationObserver                             | `app/components/AppShell.jsx`, `app/components/pages/HomePageContent.jsx`, `app/styles/*`                            | Task 7          | TODO   |
| Scan import callback changed from fixed args to `(...args)`; `setFundTagRecords` passed into import hook                                               | `app/components/AppShell.jsx`, `app/hooks/useScanImport.js`, `app/components/ModalsLayer.jsx`                        | Task 4          | TODO   |
| Remove group-holdings seeding during local initialization and group/member changes                                                                     | `app/components/AppShell.jsx`, `app/hooks/useSyncManager.js`, `app/lib/fundHelpers.js` if cleanup is safe            | Task 7          | TODO   |
| Delete fund no longer deletes `fundDailyEarnings`                                                                                                      | `app/features/portfolio/useFundMutations.js`                                                                         | Task 7          | TODO   |
| System settings save accepts `containerWidthOverride` and `showGroupDropdownOverride`; reads latest `customSettings` from `useStorageStore.getState()` | `app/components/AppShell.jsx`, `app/components/SettingsModal.jsx`, `app/stores/settingsStore.js`                     | Task 7          | TODO   |
| PC width clamp uses `Math.max(window.innerWidth, 2000)` instead of only viewport width                                                                 | `app/components/AppShell.jsx`, `app/lib/containerWidth.js`                                                           | Task 9          | TODO   |
| `handleDataSourceSelect(fundCode, sourceId, autoSource)` stores `autoSource`                                                                           | `app/components/AppShell.jsx`, `app/components/FundDataSourceSelector.jsx`, `app/hooks/useRefreshManager.js`         | Task 3          | TODO   |
| Personalized sort/top pipeline from upstream page-level derived list                                                                                   | `app/features/portfolio/useFundDisplayList.js`, `app/components/SortSettingModal.jsx`, `app/stores/settingsStore.js` | Task 6          | TODO   |
| Tag save/recommended-tag merge hunk, if present outside the modal layer                                                                                | `app/features/tags/useFundTags.js`, `app/components/FundTagsEditDialog.jsx`, `app/hooks/useScanImport.js`            | Task 4          | TODO   |
| Search/add-fund handoff hunk, if touched by scan import options                                                                                        | `app/features/search/useFundSearchBox.js`, `app/hooks/useScanImport.js`, `app/components/ScanImportConfirmModal.jsx` | Task 4          | TODO   |
| Runtime context exposes `showGroupDropdownPc`, `showGroupDropdownMobile`, and updated scan import callback                                             | `app/components/AppShell.jsx`, `app/components/pages/HomePageContent.jsx`, `app/components/ModalsLayer.jsx`          | Task 4 / Task 7 | TODO   |
| Filter bar margin/top and group dropdown tab rendering                                                                                                 | `app/components/pages/HomePageContent.jsx`, `app/components/AppShell.jsx`, `app/styles/*`                            | Task 7          | TODO   |
```

**Step 3: Record the page hunk map**

Run:

```bash
git -C download/real-time-fund diff --unified=2 ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app/page.jsx
```

Then copy the table above into `doc/upstream-sync-2e14d9e-checklist.md` and update each row's status while executing the corresponding task.

Expected:

- Every upstream `app/page.jsx` hunk is owned by exactly one task, except shared runtime context rows that explicitly name both tasks.
- No task uses upstream `app/page.jsx` as a wholesale replacement for current `app/page.jsx`.

**Step 4: Commit**

```bash
git add doc/upstream-sync-2e14d9e-checklist.md
git commit -m "docs: add upstream 2.3.1 sync checklist"
```

---

## Task 2: Port Fund API And Query Key Changes

**Files:**

- Modify: `app/services/fund/valuationApi.js`
- Modify: `app/services/fund/shared.js` if upstream helper logic belongs there
- Modify: `app/api/fund.js`
- Modify: `app/lib/query-keys.js`

**Step 1: Inspect upstream API diff**

Run:

```bash
git -C download/real-time-fund diff ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app/api/fund.js app/lib/query-keys.js
```

Expected upstream changes:

- Best-source API helpers were added.
- Best-source query keys were added.
- `fetchBestValuationSource` gained cache behavior.

**Step 2: Locate current equivalent functions**

Run:

```bash
rg "fetchBestValuationSource|valuationSource|queryKeys|fundBestSource|bestValuationSource" app/services app/lib app/api
```

Expected:

- Current data-source fetching logic is split under `app/services/fund/*`.
- `app/api/fund.js` re-exports service functions.

**Step 3: Add best-source query keys**

In `app/lib/query-keys.js`, add key factories matching the current style:

```javascript
bestValuationSource: (fundCode) => ['bestValuationSource', fundCode],
fundBestSource: (fundCode) => ['fundBestSource', fundCode],
fundsBestSources: (fundCodes) => ['fundsBestSources', fundCodes],
```

If the file already groups fund keys under an object, preserve that grouping and naming style.

**Step 4: Port best-source helpers**

In the relevant fund service module, port upstream behavior for:

- `fetchFundBestSource(fundCode)`
- `fetchFundsBestSources(fundCodes)`
- cached `fetchBestValuationSource(fundCode)`

Implementation requirements:

- Return a stable source id that existing `FundDataSourceSelector` understands.
- Handle missing or failed upstream response by returning null or the current fallback used by the app.
- Do not throw for ordinary upstream API failure during refresh.
- Preserve JSONP/script-injection patterns where upstream uses them.
- If TanStack Query client is used directly, use existing `getQueryClient()` and current query key helpers.

**Step 5: Export helpers through the current barrel**

Current project has no `app/services/fund/index.js`. Add the functions to `app/services/fund/valuationApi.js` by default. If a separate `app/services/fund/dataSourceApi.js` is created for clarity, add one explicit `export * from '../services/fund/dataSourceApi';` line to `app/api/fund.js`.

Ensure `app/api/fund.js` exposes:

```javascript
fetchFundBestSource;
fetchFundsBestSources;
fetchBestValuationSource;
```

**Step 6: Verify imports**

Run:

```bash
rg "fetchFundBestSource|fetchFundsBestSources|fetchBestValuationSource" app components lib
npm run lint
```

Expected:

- No unresolved imports.
- Lint passes or only shows pre-existing unrelated baseline failures.

**Step 7: Commit**

```bash
git add app/services/fund app/api/fund.js app/lib/query-keys.js
git commit -m "feat: add cached best valuation source APIs"
```

---

## Task 3: Port Auto Data Source Selection

**Files:**

- Modify: `app/components/FundDataSourceSelector.jsx`
- Modify: `app/hooks/useRefreshManager.js`
- Modify: `app/components/AppShell.jsx`
- Modify: `app/components/FundCard/index.jsx`
- Modify: `app/components/ModalsLayer.jsx` if data source callbacks flow through a modal

**Step 1: Inspect upstream component and refresh diffs**

Run:

```bash
git -C download/real-time-fund diff ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app/components/FundDataSourceSelector.jsx app/hooks/useRefreshManager.js app/components/FundCard/index.jsx app/page.jsx
```

Expected upstream behavior:

- Fund-level `autoSource` flag.
- Manual source selection disables or updates automatic source behavior.
- Refresh can switch valuation source automatically when the user is logged in or when upstream conditions are met.
- UI shows whether current source is automatic.

**Step 2: Find current callback ownership**

Run:

```bash
rg "handleDataSource|FundDataSourceSelector|dataSource|autoSource" app/components app/hooks app/stores
```

Expected:

- Source-selection state update logic lives in `AppShell.jsx`.
- Fund cards and tables receive props from route/page content.

**Step 3: Update persisted fund shape**

Where fund objects are updated in `AppShell.jsx`, support:

```javascript
{
  dataSource: nextSourceId,
  autoSource: Boolean(nextAutoSource)
}
```

Rules:

- Existing funds without `autoSource` remain valid.
- Business writes go through `storageStore` or `useStorageStore`.
- Cloud sync trigger behavior remains the same as other fund edits.

**Step 4: Update `FundDataSourceSelector`**

Add upstream's automatic-source switch while preserving current styling and interactions:

- Display manual source options exactly as before.
- Add automatic-source toggle only where upstream shows it.
- When auto mode is enabled, fetch or display best source.
- When manual source is selected, persist `autoSource: false`.
- Loading and failed best-source lookup should not block manual selection.

**Step 5: Update refresh logic**

In `app/hooks/useRefreshManager.js`, port upstream automatic source update:

- During refresh, detect funds with `autoSource`.
- Fetch best source for those funds.
- If best source differs from stored `dataSource`, update only that fund's source.
- Avoid infinite refresh loops.
- Avoid triggering excessive Supabase sync writes; batch if current store API supports it.

**Step 6: Update fund card display**

In `app/components/FundCard/index.jsx`, port only visual indicators required for auto-source display.

Preserve:

- Existing card layout.
- Existing responsive behavior.
- Current extracted component boundaries.

**Step 7: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- Add or select a fund.
- Open data source selector.
- Toggle automatic source on.
- Refresh data.
- Confirm source label changes only for the target fund.
- Select manual source and confirm auto mode turns off.

**Step 8: Commit**

```bash
git add app/components/FundDataSourceSelector.jsx app/hooks/useRefreshManager.js app/components/AppShell.jsx app/components/FundCard/index.jsx app/components/ModalsLayer.jsx
git commit -m "feat: support automatic fund data source selection"
```

---

## Task 4: Port Import Auto Source And Recommended Tags

**Files:**

- Modify: `app/hooks/useScanImport.js`
- Modify: `app/components/ScanImportConfirmModal.jsx`
- Modify: `app/components/ModalsLayer.jsx`
- Modify: `app/components/AppShell.jsx`
- Modify: `app/components/FundTagsEditDialog.jsx`
- Modify: `app/features/tags/useFundTags.js` if recommended-tag save/merge behavior belongs to tag actions
- Modify: `app/features/search/useFundSearchBox.js` if add-fund/search handoff needs to pass new scan-import options
- Modify: `app/lib/fundHelpers.js` if tag normalization helper changes are needed
- Review: `doc/supabase.sql`

**Step 1: Inspect upstream import and tag diffs**

Run:

```bash
git -C download/real-time-fund diff ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app/hooks/useScanImport.js app/components/ScanImportConfirmModal.jsx app/components/FundTagsEditDialog.jsx app/components/ModalsLayer.jsx app/page.jsx doc/supabase.sql
rg "fundTags|recommended|handleSaveFundTags|addFund|setScanConfirmModalOpen|confirmScanImport" app/components app/hooks app/features app/lib
```

Expected upstream behavior:

- Scan import confirm modal has switches for automatic source and recommended tag import.
- Import can call best-source API in batch.
- Import can call Supabase RPC for recommended tags.
- Fund tag edit dialog can show recommended tags.

**Step 2: Update `ScanImportConfirmModal` props**

Add props matching upstream behavior:

```javascript
autoDataSource;
setAutoDataSource;
autoImportTags;
setAutoImportTags;
```

Rules:

- Defaults should preserve current behavior for users who do nothing.
- Existing import confirmation flow remains unchanged except for new optional toggles.
- Use existing project switch/toggle components and CSS classes.

**Step 3: Update modal state flow**

In `app/stores/modalStore.js` if needed, add low-frequency modal state fields only if the current modal architecture requires global storage for these toggles.

In `ModalsLayer.jsx`:

- Subscribe to modal state only inside `ModalsLayer`.
- Pass scan import options into `cb.current.handleConfirmScanImport` or the existing callback.
- Do not subscribe `AppShell.jsx` to modal state.

**Step 4: Update import hook**

In `app/hooks/useScanImport.js`, port upstream logic:

- Accept `autoDataSource`.
- Accept `autoImportTags`.
- If `autoDataSource` is true, call `fetchFundsBestSources` and assign `dataSource` plus `autoSource: true`.
- If `autoImportTags` is true, call recommended tag RPC and merge tags into imported fund data.
- On failure, import the funds without blocking the entire flow.

Storage rules:

- Write imported funds through `storageStore`.
- Preserve existing duplicate handling.
- Preserve cloud sync triggers.
- Do not delete historical earnings when deleting or replacing fund records.

**Step 5: Update recommended tags in tag editor**

In `FundTagsEditDialog.jsx`:

- Port upstream recommended-tag display and tooltip behavior.
- Fetch recommendations only when user/session context is available.
- Avoid noisy errors if Supabase is not configured.

In `app/features/tags/useFundTags.js`:

- If upstream page-level tag save/merge logic is part of recommended tags, port it here instead of adding new tag mutation logic to `AppShell.jsx`.
- Preserve the existing storage path through `storageHelper.setItem('tags', ...)`.
- Keep modal state access through `useModalStore.getState()` / `useModalStore.setState()`.

In `app/features/search/useFundSearchBox.js`:

- Only update this hook if the search/add-fund handoff must pass additional scan-import options into the confirm modal.
- Keep this hook as UI handoff logic; actual import writes stay in `useScanImport.js`.

**Step 6: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- Open scan/OCR import confirm modal.
- Toggle automatic source.
- Toggle recommended tags.
- Import a known fund.
- Confirm imported fund contains `autoSource` only when selected.
- Confirm tags are imported only when selected and available.
- Confirm failed RPC does not prevent fund import.

**Step 7: Commit**

```bash
git add app/hooks/useScanImport.js app/components/ScanImportConfirmModal.jsx app/components/ModalsLayer.jsx app/components/AppShell.jsx app/components/FundTagsEditDialog.jsx app/features/tags/useFundTags.js app/features/search/useFundSearchBox.js app/lib/fundHelpers.js app/stores/modalStore.js doc/supabase.sql
git commit -m "feat: import automatic sources and recommended tags"
```

---

## Task 5: Port Data Source Badges And Table Column

**Files:**

- Create: `app/components/DataSourceAccuracyBadge.jsx`
- Create: `app/hooks/useDataSourceAccuracyLabels.js`
- Modify: `app/components/PcFundTable.jsx`
- Modify: `app/components/MobileFundTable.jsx`
- Modify: `app/components/PcTableSettingModal.jsx`
- Modify: `app/components/MobileSettingModal.jsx`
- Modify: `app/components/SortSettingModal.jsx` only if upstream ties sorting settings to the new column
- Modify: `app/styles/components.css` or other split style files as needed

**Step 1: Inspect upstream table diffs**

Run:

```bash
git -C download/real-time-fund diff ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app/components/DataSourceAccuracyBadge.jsx app/hooks/useDataSourceAccuracyLabels.js app/components/PcFundTable.jsx app/components/MobileFundTable.jsx app/components/PcTableSettingModal.jsx app/components/MobileSettingModal.jsx app/components/SortSettingModal.jsx app/globals.css
```

Expected upstream behavior:

- A data-source accuracy badge component was added.
- PC and mobile tables can display a data-source column.
- Table setting modals expose the column where appropriate.
- Drag behavior was adjusted.

**Step 2: Add badge hook**

Create `app/hooks/useDataSourceAccuracyLabels.js` by adapting upstream code.

Rules:

- Use current service/query key names.
- Avoid repeated network calls for the same fund/source.
- Return stable labels for missing data.

**Step 3: Add badge component**

Create `app/components/DataSourceAccuracyBadge.jsx` by adapting upstream code.

Rules:

- Keep JSX only.
- Use existing CSS variable naming style.
- Do not hardcode layout dimensions that break table rows.

**Step 4: Add PC table column**

In `PcFundTable.jsx`:

- Add data-source column definition.
- Include manual/auto source label.
- Include accuracy badge only where upstream shows it.
- Preserve current drag and column ordering behavior.
- Preserve current desktop-only layout at `> 640px`.

**Step 5: Add mobile table data-source display**

In `MobileFundTable.jsx`:

- Add data-source display in the same location upstream uses.
- Preserve current swipe actions and responsive layout.
- Port upstream drag fix only if it applies to current code.

**Step 6: Update settings modals**

In `PcTableSettingModal.jsx` and `MobileSettingModal.jsx`:

- Add the new column toggle.
- Preserve existing saved settings shape.
- Existing users without the new key should receive a safe default.

**Step 7: Place styles in split CSS**

Map upstream `app/globals.css` additions into the current split files:

- Component-specific badge/table styles: `app/styles/components.css`
- Layout or responsive rules: `app/styles/layout.css`
- Tokens only if new CSS variables are needed: `app/styles/tokens.css`

Do not paste upstream global CSS wholesale.

**Step 8: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- PC table displays data-source column when enabled.
- Mobile table displays data-source information without text overlap.
- Column drag still works on PC.
- Mobile row gestures still work.
- Table settings persist after refresh.

**Step 9: Commit**

```bash
git add app/components/DataSourceAccuracyBadge.jsx app/hooks/useDataSourceAccuracyLabels.js app/components/PcFundTable.jsx app/components/MobileFundTable.jsx app/components/PcTableSettingModal.jsx app/components/MobileSettingModal.jsx app/components/SortSettingModal.jsx app/styles
git commit -m "feat: show fund data source accuracy in tables"
```

---

## Task 6: Port Personalized Sort Top/Pin Changes

**Files:**

- Modify: `app/components/SortSettingModal.jsx`
- Modify: `app/components/PcFundTable.jsx`
- Modify: `app/components/MobileFundTable.jsx`
- Modify: `app/components/AppShell.jsx`
- Modify: `app/features/portfolio/useFundDisplayList.js`
- Modify: `app/lib/fundHelpers.js` if upstream added sorting helpers
- Modify: `app/stores/settingsStore.js` if upstream persists new sort settings

**Step 1: Inspect upstream sort diff**

Run:

```bash
git -C download/real-time-fund diff ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app/components/SortSettingModal.jsx app/components/PcFundTable.jsx app/components/MobileFundTable.jsx app/page.jsx app/lib/fundHelpers.js app/stores/settingsStore.js
rg "sort|personal|top|pin|置顶|排序|displayFundsRaw|displayFunds" app/features/portfolio app/components app/lib app/stores
```

Expected upstream behavior:

- Personalized sorting supports placing selected funds at the top.
- Table/card order respects this setting.

**Step 2: Locate current sort pipeline**

Run:

```bash
rg "sort|personal|top|pin|置顶|排序|displayFundsRaw|displayFunds" app/features/portfolio app/components app/lib app/stores
```

Expected:

- Sort state may be owned by `AppShell.jsx` / stores / setting modals.
- The derived display list and actual sort pipeline are owned by `app/features/portfolio/useFundDisplayList.js`.
- Tables consume already sorted rows and should not duplicate the portfolio sort pipeline.

**Step 3: Add persisted sort setting**

If upstream adds a new setting key, add it to `settingsStore.js` with a safe default.

Rules:

- Existing localStorage users must migrate implicitly.
- No direct `window.localStorage` access for business settings.
- Do not break old table settings.

**Step 4: Apply sort helper**

Port upstream helper logic into the current sort pipeline in `app/features/portfolio/useFundDisplayList.js`.

Rules:

- Group filtering still happens before or after sorting exactly as current behavior requires.
- Top/pin setting applies consistently to PC, mobile, and card views.
- Search results remain stable.
- Do not move this derived-list logic back into `AppShell.jsx`.

**Step 5: Update modal UI**

In `SortSettingModal.jsx`, add upstream controls for top/pin.

Rules:

- Keep current modal state in Zustand.
- Use `modalCbRef` for callbacks into `AppShell.jsx`.
- Do not add route-level modal subscriptions.

**Step 6: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- Enable personalized top/pin setting.
- Confirm selected funds appear at the top on PC table.
- Confirm selected funds appear at the top on mobile layout.
- Refresh browser and confirm persistence.

**Step 7: Commit**

```bash
git add app/components/SortSettingModal.jsx app/components/PcFundTable.jsx app/components/MobileFundTable.jsx app/components/AppShell.jsx app/features/portfolio/useFundDisplayList.js app/lib/fundHelpers.js app/stores/settingsStore.js
git commit -m "feat: support pinned personalized fund sorting"
```

---

## Task 7: Port Group Dropdown, Width Settings, And Group-Holdings Migration Fixes

**Files:**

- Create: `app/lib/containerWidth.js`
- Modify: `app/stores/settingsStore.js`
- Modify: `app/components/SettingsModal.jsx`
- Modify: `app/components/AppShell.jsx`
- Modify: `app/components/pages/HomePageContent.jsx`
- Modify: `app/hooks/useSyncManager.js`
- Modify: `app/features/portfolio/useFundMutations.js`
- Modify: `app/components/GroupManageModal.jsx`
- Modify: `app/components/GroupModal.jsx`
- Modify: `app/components/GroupSummary.jsx`
- Modify: `components/ui/progress.jsx`
- Modify: `app/styles/layout.css`
- Modify: `app/styles/components.css`

**Step 1: Inspect upstream layout/settings diffs**

Run:

```bash
git -C download/real-time-fund diff ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app/lib/containerWidth.js app/stores/settingsStore.js app/components/SettingsModal.jsx app/components/GroupManageModal.jsx app/components/GroupModal.jsx app/components/GroupSummary.jsx components/ui/progress.jsx app/hooks/useSyncManager.js app/page.jsx app/globals.css
rg "seedGroupHoldingsFromGlobal|setFundDailyEarnings|fundDailyEarnings|removeFund|removeFundsBulk" app/components/AppShell.jsx app/hooks/useSyncManager.js app/features/portfolio
```

Expected upstream behavior:

- PC page width setting fix.
- Progress slider width fix in settings modal.
- Optional group dropdown display on PC/mobile.
- Group dropdown width adjustment.
- Group search layout fix.
- Obsolete group-holdings seeding from global holdings was removed.
- Deleting a fund no longer deletes historical daily earnings.

**Step 2: Add container width helper**

Create `app/lib/containerWidth.js` from upstream, adapted to current naming.

Rules:

- Helper should be framework-independent.
- It should not read DOM state directly unless upstream already does and there is no better existing helper.

**Step 3: Update settings defaults**

In `settingsStore.js`, add upstream settings such as:

```javascript
showGroupDropdownPc;
showGroupDropdownMobile;
```

Use upstream default values unless they conflict with current UI behavior.

**Step 4: Update settings modal layout**

In `SettingsModal.jsx`:

- Port the layout improvements.
- Fix page-width slider/progress layout.
- Add group dropdown display settings.
- Keep modal open/close state in Zustand.

**Step 5: Map upstream `page.jsx` changes to current files**

For any upstream `page.jsx` logic related to page width or group dropdown:

- Put orchestration/state logic in `AppShell.jsx`.
- Put render-only route content changes in `HomePageContent.jsx`.
- Do not modify current route `app/page.jsx` except if route metadata/imports actually require it.

**Step 6: Update group components**

In group-related components:

- Port dropdown width adjustment.
- Port group search layout fix.
- Preserve existing grouping behavior.
- Ensure deleting "All" or custom groups does not resurrect old migration logic removed upstream.

**Step 7: Remove obsolete group-holdings seeding**

Apply the upstream deletion consistently across current refactored files:

- In `AppShell.jsx`, remove the local-init seeding from global holdings into `groupHoldings`.
- In `AppShell.jsx`, remove the effect that keeps backfilling group holdings from global holdings when holdings or groups change.
- In `useSyncManager.js`, remove `seedGroupHoldingsFromGlobal` from the import list and remove the post-cloud seeding block before `setGroupHoldings`.
- Keep `groupHoldings` data loaded from local/cloud storage as-is.
- Do not delete existing scoped holdings.

Expected:

- Deleting the "All" or custom group relationship no longer recreates old scoped holding data through migration/backfill.
- Existing scoped group holdings are preserved when explicitly present.

**Step 8: Preserve daily earnings when deleting funds**

Apply upstream's delete-fund behavior to the current feature hook:

- In `app/features/portfolio/useFundMutations.js`, remove the single-fund `removeFund` block that deletes `fundDailyEarnings` for `removeCode`.
- In the bulk delete path, remove the block that deletes each selected code from `fundDailyEarnings`.
- Do not change the cross-group move/migration block that moves scoped `fundDailyEarnings` between source and target scopes; upstream changed delete semantics only.
- Keep fund removal, group membership cleanup, favorites cleanup, holdings cleanup, pending trades, transactions, valuation series, and DCA cleanup behavior unchanged unless upstream explicitly changed those.
- Do not add this logic back into `AppShell.jsx`.

Expected:

- Removing a fund from the portfolio does not erase its historical daily earnings buckets.
- Moving funds between groups may still move scoped daily earnings if that is the existing explicit migration behavior; this task only changes delete behavior.

**Step 9: Update progress primitive**

In `components/ui/progress.jsx`, port the width fix only.

Do not restyle all progress bars unless upstream did so intentionally.

**Step 10: Place CSS changes**

Map upstream CSS:

- Settings modal component rules: `app/styles/components.css`
- Container/page width rules: `app/styles/layout.css`
- New variables: `app/styles/tokens.css`

**Step 11: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- Settings modal page-width slider does not overflow.
- PC page width changes apply and persist.
- Mobile page width behavior remains unchanged.
- Group dropdown display toggles work on PC and mobile.
- Group dropdown width matches upstream intended behavior.
- Search layout in grouped view does not overlap.
- Deleting a fund or group relationship does not delete historical daily earnings and does not recreate old scoped holdings.

**Step 12: Commit**

```bash
git add app/lib/containerWidth.js app/stores/settingsStore.js app/components/SettingsModal.jsx app/components/AppShell.jsx app/components/pages/HomePageContent.jsx app/hooks/useSyncManager.js app/features/portfolio/useFundMutations.js app/components/GroupManageModal.jsx app/components/GroupModal.jsx app/components/GroupSummary.jsx components/ui/progress.jsx app/styles
git commit -m "feat: sync group dropdown and page width settings"
```

---

## Task 8: Port Chart, Net Value, Error Boundary, And Small UI Fixes

**Files:**

- Modify: `app/components/FundHistoryNetValue.jsx`
- Modify: `app/components/FundHistoryNetValueModal.jsx`
- Modify: `app/components/FundTrendChart.jsx`
- Modify: `app/components/FundValuationTrendChart.jsx`
- Modify: `app/components/ClientErrorBoundary.jsx`
- Modify: `app/components/GlobalClientErrorHandler.jsx`
- Modify: `app/components/DcaModal.jsx`
- Modify: `app/components/AllSectorsModal.jsx`
- Modify: `app/components/Announcement.jsx`
- Modify: `app/components/MyEarningsCalendarPage.jsx`
- Modify: `app/styles/components.css`
- Modify: `app/styles/layout.css`

**Step 1: Inspect upstream diffs**

Run:

```bash
git -C download/real-time-fund diff ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app/components/FundHistoryNetValue.jsx app/components/FundHistoryNetValueModal.jsx app/components/FundTrendChart.jsx app/components/FundValuationTrendChart.jsx app/components/ClientErrorBoundary.jsx app/components/GlobalClientErrorHandler.jsx app/components/DcaModal.jsx app/components/AllSectorsModal.jsx app/components/Announcement.jsx app/components/MyEarningsCalendarPage.jsx app/globals.css
```

Expected upstream behavior:

- Historical performance trend uses cumulative net value.
- Some chart tooltip and opacity styles changed.
- "Script Error" and static asset errors are ignored or clarified.
- All sectors modal scrolls to top when switching categories.
- DCA modal z-index/layer issue fixed.
- Some text and announcement copy changed.
- Unauthenticated users hide valuation trend entry where upstream requires it.

**Step 2: Port cumulative net value changes**

Update history chart components:

- Use cumulative net value for performance trend where upstream does.
- Preserve current chart API and props.
- Keep empty/error/loading states.

**Step 3: Port chart styling fixes**

Update trend/valuation chart components and split CSS:

- Tooltip readability.
- Floating window opacity where upstream adjusted it.
- Mobile chart layout only if upstream changed it.

**Step 4: Port error filtering**

In `ClientErrorBoundary.jsx` and `GlobalClientErrorHandler.jsx`:

- Ignore common cross-origin `Script Error`.
- Ignore ResizeObserver noise if upstream does.
- Add static asset error wording from upstream.
- Do not hide real application exceptions.

**Step 5: Port small modal/page fixes**

- `DcaModal.jsx`: z-index/layer fix.
- `AllSectorsModal.jsx`: scroll to top after category switch.
- `Announcement.jsx`: upstream text changes.
- `MyEarningsCalendarPage.jsx`: upstream bug fixes, if any.

**Step 6: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- Fund history modal renders cumulative net value trend.
- Valuation trend entry visibility matches login state.
- All sectors modal category switch scrolls to top.
- DCA modal layers above other UI correctly.
- Artificial static asset failure shows the intended message if practical to test.

**Step 7: Commit**

```bash
git add app/components/FundHistoryNetValue.jsx app/components/FundHistoryNetValueModal.jsx app/components/FundTrendChart.jsx app/components/FundValuationTrendChart.jsx app/components/ClientErrorBoundary.jsx app/components/GlobalClientErrorHandler.jsx app/components/DcaModal.jsx app/components/AllSectorsModal.jsx app/components/Announcement.jsx app/components/MyEarningsCalendarPage.jsx app/styles
git commit -m "fix: sync chart and client error handling updates"
```

---

## Task 9: Port PC Width Clamp And Table Drag Fixes

**Files:**

- Modify: `app/components/AppShell.jsx`
- Modify: `app/components/PcFundTable.jsx`
- Modify: `app/components/MobileFundTable.jsx`
- Modify: `app/styles/layout.css`
- Modify: `app/styles/components.css`

**Step 1: Inspect upstream diffs**

Run:

```bash
git -C download/real-time-fund diff ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- app/page.jsx app/components/PcFundTable.jsx app/components/MobileFundTable.jsx app/globals.css
```

Expected upstream behavior:

- Upstream did not change `app/hooks/useIsMobile.js`.
- The relevant responsive-width change is a small `app/page.jsx` hunk that clamps PC width with `Math.max(window.innerWidth, 2000)`.
- PC/mobile table drag behavior was adjusted.

**Step 2: Port the PC width clamp hunk**

In current architecture, map the upstream `app/page.jsx` width hunk into `AppShell.jsx` or the helper introduced in Task 7:

Rules:

- Must be SSR/static-export safe.
- Use `typeof window === 'undefined'` only for undeclared global checks.
- Avoid hydration mismatch.
- Do not edit `app/hooks/useIsMobile.js` for this upstream range unless a later upstream diff actually changes it.

**Step 3: Update drag behavior**

Apply upstream table drag changes in PC/mobile table files.

Rules:

- Preserve existing row action behavior.
- Preserve scroll behavior.
- Do not introduce table layout shifts.

**Step 4: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- Desktop browser uses PC table.
- Narrow viewport uses mobile table.
- Touch-capable desktop behavior remains acceptable.
- Dragging columns or rows does not trigger unintended clicks.

**Step 5: Commit**

```bash
git add app/components/AppShell.jsx app/components/PcFundTable.jsx app/components/MobileFundTable.jsx app/styles
git commit -m "fix: sync responsive detection and table drag behavior"
```

---

## Task 10: Package Version, Optional Assets, And Documentation

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `doc/upstream-sync.md`
- Modify: `AGENTS.md`
- Optional modify: project memory entry `[[upstream-sync-baseline]]` if that memory store is available in the execution environment
- Optional modify: `public/*` or `app/assets/*` only for approved QR/static asset updates

**Step 1: Inspect package diff**

Run:

```bash
git -C download/real-time-fund diff ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- package.json package-lock.json
```

Expected:

- Upstream release version changed to `2.3.1`.
- Dependency changes, if any, are visible.

**Step 2: Apply version/dependency changes**

If upstream changed only version:

- Update `package.json` version.
- Update `package-lock.json` version fields.

If upstream added dependencies:

- Apply dependency entries exactly.
- Run `npm install --package-lock-only` only if package-lock needs regeneration.

**Step 3: Decide static assets**

Inspect asset diffs:

```bash
git -C download/real-time-fund diff --name-status ffaf4b090960ecc715a32556bc02b513cce07159..2e14d9e3a3617a228fa4c28305b3b5408a93a43e -- public app/assets
```

Port only user-facing product assets that are needed:

- Group QR code images: optional.
- PWA/static app assets: port if upstream changed product-visible behavior.
- AI/IDE metadata: ignore.

**Step 4: Update sync documentation**

After all product changes are verified, update `doc/upstream-sync.md`:

```markdown
## Current Upstream Baseline

- Repository: `download/real-time-fund`
- Commit: `2e14d9e3a3617a228fa4c28305b3b5408a93a43e`
- Subject: `feat：分组下拉宽度调整`
- Date: `2026-06-24 09:52:09 +0800`
- Sync status: Product changes from `ffaf4b0..2e14d9e` ported into current refactored architecture.
```

Update `AGENTS.md` `UPSTREAM SYNC` section with the same baseline only after the sync is complete.

If the execution environment has access to the project memory entry `[[upstream-sync-baseline]]`, update it to the same target commit. If it is outside the writable workspace or unavailable, record that in `doc/upstream-sync-2e14d9e-checklist.md` instead of blocking the code sync.

**Step 5: Verify**

Run:

```bash
npm run lint
npm run build
git status --short
```

Expected:

- Lint passes.
- Build passes.
- Only intended files are modified.

**Step 6: Commit**

```bash
git add package.json package-lock.json doc/upstream-sync.md AGENTS.md public app/assets
git commit -m "chore: advance upstream sync baseline to 2.3.1"
```

---

## Task 11: Final Regression Pass

**Files:**

- Modify: `doc/upstream-sync-2e14d9e-checklist.md`

**Step 1: Run final automated checks**

```bash
npm run lint
npm run build
```

Expected:

- Both commands pass.

**Step 2: Run route smoke checks**

Start dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/
http://localhost:3000/market
http://localhost:3000/mine
```

Expected:

- Home page renders portfolio/fund UI.
- Market page renders market/sector UI.
- Mine page renders personal/settings-related UI.
- Bottom or top navigation still routes instead of switching local-only tabs.

**Step 3: Manual product regression checklist**

Verify:

- Add fund.
- Delete fund without deleting old earnings data.
- Refresh valuation.
- Switch data source manually.
- Enable automatic data source and refresh.
- Import scanned funds with automatic source disabled.
- Import scanned funds with automatic source enabled.
- Import scanned funds with recommended tags disabled.
- Import scanned funds with recommended tags enabled.
- Edit fund tags and confirm recommendations appear when available.
- Open PC table settings and toggle data source column.
- Open mobile settings and confirm layout does not overlap.
- Use personalized sort top/pin.
- Use group dropdown on PC and mobile.
- Open settings modal and adjust page width.
- Open fund history net value modal.
- Open valuation trend chart.
- Open DCA modal.
- Open all sectors modal and switch categories.
- Confirm unauthenticated users do not see gated valuation trend entry where upstream requires it.

**Step 4: Update checklist**

In `doc/upstream-sync-2e14d9e-checklist.md`, fill in:

- Final lint result.
- Final build result.
- Manual check result.
- Any intentionally skipped upstream changes.

**Step 5: Commit**

```bash
git add doc/upstream-sync-2e14d9e-checklist.md
git commit -m "docs: record upstream 2.3.1 sync verification"
```

---

## Stop Conditions

Stop and ask for review if any of these happen:

- Upstream change requires replacing current routed pages with the old monolithic `page.jsx`.
- Upstream code writes business data with direct `window.localStorage`.
- Best-source API requires secrets that are absent from current environment.
- Supabase recommended-tag RPC is missing and cannot fail safely.
- Lint/build failure appears caused by the sync and cannot be isolated within the current task.
- Manual source switching or automatic source switching corrupts fund data.
- Table drag/swipe regressions cannot be fixed without redesigning the table.
- CSS changes would visibly alter unrelated UI sections beyond the upstream intended fixes.

## Final Acceptance Criteria

- Product changes from upstream `ffaf4b0..2e14d9e` are either ported or explicitly documented as intentionally skipped.
- Current route-backed three-page structure remains intact.
- Current service/CSS/component split remains intact.
- No new direct business `localStorage` access is introduced.
- New data source and tag features work with missing network/Supabase responses gracefully.
- `npm run lint` passes.
- `npm run build` passes.
- `doc/upstream-sync.md`, `AGENTS.md`, and accessible `[[upstream-sync-baseline]]` memory are advanced only after successful verification.

---

## 审核意见（2026-06-25）

本次执行已覆盖 upstream `ffaf4b0..2e14d9e` 的大部分功能迁移，当前工作区干净，2.3.1 相关提交已进入当前分支，自动数据源、推荐标签、数据源准确度展示、分组下拉、tab 溢出滚动按钮、页面宽度设置、Supabase RPC schema 等主要内容均已在当前重构架构中找到对应实现。

但不建议直接判定为 100% 完成，仍有以下需要补齐或复核的事项：

1. `app/features/portfolio/useFundMutations.js` 中单个删除基金已保留 `fundDailyEarnings`，但批量删除路径仍会清理 `fundDailyEarnings`。这与本计划 Task 7 中“删除基金时保留每日收益数据”的要求不一致，应先修复。
2. 本次复核运行 `npm run build` 时停留在 `Creating an optimized production build ...`，且 Next.js 提示 workspace root 被推断为 `/Users/apple`。虽然执行记录中写有 build PASS，但当前复核未能重新确认，应处理 root 推断问题后再次验证。
3. `doc/upstream-sync.md` 已将当前 baseline 更新为 `2e14d9e3a3617a228fa4c28305b3b5408a93a43e`，但未来同步命令示例仍引用旧锚点 `ffaf4b090960ecc715a32556bc02b513cce07159`，容易误导下一轮同步，应改为从新 baseline 对比。
4. `doc/upstream-sync-2e14d9e-checklist.md` 前部仍存在未勾选/TODO 状态，和结尾“已完成”的描述不完全一致，应统一文档状态。
5. `npm run lint` 当前可以通过，但会扫描 `download/real-time-fund` 下的 upstream 工作副本，导致 warning 数量被外部目录污染。建议在 ESLint ignore 中排除 `download/**`，或将 upstream 工作副本移出当前项目目录。

建议处理顺序：

1. 修复批量删除基金仍删除 `fundDailyEarnings` 的问题。
2. 修正 `doc/upstream-sync.md` 中未来同步命令的 baseline。
3. 统一 checklist 中的完成状态。
4. 排除 `download/**` 对 lint/build 验证的干扰，并处理 Next.js workspace root 推断问题。
5. 重新运行 `npm run lint` 和 `npm run build`，确认通过后再将本计划标记为最终完成。

---

## 完成度复核意见（2026-06-25，基于上游真实提交逐条核对）

对上方「审核意见」5 点做了实证核对，结论：**1 点为误判（无需修改），1 点已解决，其余 3 点为轻微的文档/配置整理，均不影响运行时**。代码与功能层面实质已完成且忠于上游。

**逐条核对：**

1. **批量删除 `fundDailyEarnings` —— ❌ 误判，无需修改。** 计划书正文此处与上游真实提交不符：「删除基金不删除收益数据」提交 `d2fef6e` 仅从 `page.jsx` 移除了 18 行 = **单条删除那一个块**，并未改动批量路径；同步目标 `2e14d9e`（在 `d2fef6e` 之后）的 `removeFundsBulk` 仍执行 `delete nb[c]`，即**批量删除依旧删 earnings**。当前 `app/features/portfolio/useFundMutations.js`（单条=保留、批量=删除）与上游目标**完全一致**。同步应以上游最终状态为准，故此为正确行为，不应"修复"。
2. **build 未确认 + workspace root 推断 —— ✅ 已解决。** `npm run build` 多次通过（预渲染 `/`、`/market`、`/mine`、`/_not-found`、`/icon.svg`）。root 推断警告为 CLAUDE.md 已注明的「多 lockfile（野生 yarn.lock）、无害」既知项。
3. **`doc/upstream-sync.md` 下次同步命令仍引用旧锚点 —— ⚠️ 有效·轻微。** 第 68/74 行示例仍为 `ffaf4b0..HEAD`，baseline 已推进到 `2e14d9e`，应改为 `2e14d9e..HEAD`。
4. **checklist 的 Decisions 仍全为未勾选 —— ⚠️ 有效·轻微。** `doc/upstream-sync-2e14d9e-checklist.md` 顶部 `- [ ]` 与末尾「已完成」描述矛盾，应统一为 `[x]`。
5. **lint 扫描 `download/` —— ⚠️ 有效·轻微。** `eslint.config.mjs` 未排除 `download/**`，实测仅 `download/real-time-fund/app/page.jsx` 单文件即报 18 warnings，污染 `npm run lint`；应在 ignore 加入 `download/**`。

**总体判定：**

| 领域                                 | 完成度                            |
| ------------------------------------ | --------------------------------- |
| 代码移植（Task 1–11 + 遗留 UI 收尾） | 完成·已提交·忠于上游              |
| build / lint（0 errors）             | 通过                              |
| 运行时                               | 0 console errors、显示 2.3.1 公告 |
| 文档/配置整理（#3/#4/#5）            | 3 项待办（不影响运行）            |
| Supabase 数据投入                    | 未做（代码外·运维工作）           |

**结论：功能层面已完成且忠于上游，无阻碍标记「最终完成」的实现问题。** 将上方 #1 判为「需先修复」属误判。剩余仅 #3/#4/#5 三处轻微文档/lint 整理（各 1 至数行），以及 Supabase 侧的数据投入（`fund_best_source` / `fund_related` / `fund_topic`，使自动数据源与推荐标签真正返回数据）。
