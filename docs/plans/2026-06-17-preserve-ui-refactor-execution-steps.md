# Preserve UI Refactor Execution Steps

> Source plan: `docs/plans/2026-06-17-preserve-ui-refactor.md`

**Goal:** Execute the preserve-UI refactor task by task, without changing page display, interaction behavior, persisted data shape, or cloud sync payloads.

**Architecture:** Keep `app/page.jsx` as the orchestration shell while extracting pure derivations, mutation actions, search state, tag logic, and fund API modules into feature/service files. Use dev-only shadow comparison for derived data and storage snapshots for write paths so every extraction proves equivalence before commit.

**Tech Stack:** Next.js App Router, React JSX, Zustand stores, TanStack Query, lodash, JSONP/script-injection APIs, localStorage via `storageStore`.

---

## 0. How To Use This Runbook

Execute this file from top to bottom. Each task should be completed, verified, and committed before starting the next task.

Default loop:

1. Read the matching task in `2026-06-17-preserve-ui-refactor.md`.
2. Confirm the working tree state with `git status --short`.
3. Modify only the files listed in the task.
4. Run the required verification commands.
5. Perform the manual checks for that task.
6. Commit only that task.

Default verification:

```bash
npm run lint
npm run build
```

Default commit pattern:

```bash
git add <task files>
git commit -m "<task commit message>"
```

---

## 1. Non-Negotiable Rules

- Do not change user-facing Chinese text, DOM hierarchy, class names, visual CSS, modal flows, sort semantics, default state, or animation behavior unless the source plan explicitly says so.
- JavaScript/JSX only. Do not introduce TypeScript, a new UI library, new state library, or test framework.
- Business storage must go through `storageStore` / `useStorageStore`.
- Modal state remains in `app/stores/modalStore.js`; modal rendering remains in `app/components/ModalsLayer.jsx`.
- `page.jsx` must not subscribe to modal store state. Use `useModalStore.getState()` or `modalCbRef` for page-level handlers.
- Use lodash for data type checks. Native `typeof === 'undefined'` is allowed only for global environment checks.
- Preserve existing `useMemo`, `useCallback`, and `useEffect` dependency arrays when moving code.
- Derived-data hooks must stay pure. Mutation/effect hooks may use `useStorageStore.getState()`, `storageStore`, and `useModalStore.getState()`.
- Shadow compare factories must return the same comparable shape and must not include functions.
- Keep low-risk docs/helper tasks separate from behavior-moving tasks.

---

## 2. Preflight Baseline

Run before Task 1:

```bash
npm run lint
npm run build
```

Create a short baseline note in `doc/refactor-regression-checklist.md` during Task 2. Before code extraction begins, capture screenshots or notes for:

- Desktop list view
- Desktop card view
- Mobile list view
- Mobile drawer open
- Settings modal
- Trade modal
- Group management modal

Check these behaviors before code extraction begins:

- Search dropdown opens, filters, selects chips, and unselects chips.
- Scopes work: `全部`, `自选`, `汇总`, and at least one custom group.
- Sorts work: `default`, `yield`, `holdingAmount`, `todayProfit`, `holding`, `estimateProfit`, `yesterdayProfit`, `holdingDays`, `holdingCost`, `sinceAddedChangePercent`, `consecutiveTrend`, `tags`, `name`.
- Trading works: buy with price, buy without price, clear holding.
- Group actions work: add group, add to group, delete from group, global delete.
- Settings export/import and modal entry points work.

---

## 3. Shared Verification Tools

### 3.1 Shadow Compare Flow

Use for pure derived-data tasks: Task 6, Task 7, and Task 8.

1. Implement the new hook while keeping the legacy calculation in `app/page.jsx`.
2. Add `devShadowCompare(label, legacyFactory, nextFactory)`.
3. Compare same-shape serializable projections only. Do not compare functions.
4. Run:

```bash
npm run lint
npm run build
npm run dev
```

5. Exercise the screens listed in the task.
6. Confirm the browser console has no `[shadow-compare mismatch]` messages.
7. Remove the legacy block and the `devShadowCompare` import in the same task before commit.
8. Run `npm run lint` and `npm run build` again.

### 3.2 Storage Snapshot Flow

Use for storage-writing tasks: Task 6 if cleanup writes, Task 9, Task 10, Task 11, Task 12, and Task 14.

1. Restore/import the same fixed localStorage seed data before each baseline and refactor run.
2. In development, expose `{ createStorageSnapshot, installSyncEventRecorder }` as `window.__storageSnapshot`.
3. Prefer a guarded dev-only exposure that can remain through all snapshot tasks:

```js
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  window.__storageSnapshot = { createStorageSnapshot, installSyncEventRecorder };
}
```

4. Remove the exposure before final acceptance unless it is intentionally kept as a clearly guarded development helper.
5. Capture baseline with the old implementation.
6. Save baseline `createStorageSnapshot()` and `installSyncEventRecorder().getEvents()` JSON to scratch files under `/tmp` or another ignored temporary location.
7. Repeat the same scenario after refactor with the same seed data.
8. Compare snapshot JSON and sync events.

Required result:

- Snapshot shape must match.
- Sync event count/order must match.
- Any intentional batching difference must be documented in the task commit message or checklist.

Suggested scratch directory:

```bash
/tmp/preserve-ui-refactor-snapshots
```

### 3.3 Snapshot Scenario Matrix

| Scenario | Task | Action | Expected focus |
|---|---:|---|---|
| 1 | 10 | Buy with resolved price | holdings and transactions writes |
| 2 | 10 | Buy without price | pending queue and fallback write behavior |
| 3 | 10 | Clear holding | holding cleanup and transaction state |
| 4 | 12 | Delete one fund from custom group | group-scoped fund removal |
| 5 | 12 | Delete one global fund | global fund cleanup |
| 6 | 12 | Move funds between groups | fund/group relationship writes |
| 7 | 14 | Close announcement | no `SYNC_KEYS` event should fire |
| 8 | 9 | Edit fund tags, add pool tag, delete/update global tag | `tags` payload and sync event order |
| DCA | 11 | Generate DCA trades | `dcaPlans` and `pendingTrades` writes |

---

## 4. Task Index

| Task | Name | Type | Main Verification |
|---:|---|---|---|
| 1 | ADR | Docs | `npm run lint` |
| 2 | Regression Checklist | Docs | `npm run lint` |
| 3 | Page Dependency Map | Docs/audit | `npm run lint` |
| 4 | Dev Shadow Compare Helper | Helper | lint + build |
| 5 | Storage Snapshot Harness | Helper/docs | lint + build |
| 6 | Portfolio Scope | Derived data + cleanup | shadow compare + snapshot if cleanup writes |
| 7 | Fund Display List | Derived data | shadow compare |
| 8 | Fund Table Rows | Derived data | shadow compare |
| 9 | Fund Tags | Mutation | snapshot scenario 8 |
| 10 | Trading Actions | Mutation | snapshot scenarios 1-3 |
| 11 | DCA Scheduler | Mutation | DCA snapshot |
| 12 | Fund Mutations | Mutation | snapshot scenarios 4-6 |
| 13 | Search Box | UI state/actions | manual checks |
| 14 | Business Storage Access | Storage routing | storage audit + scenario 7 |
| 15 | Fund API Services | API split | lint + build after each batch |
| 16 | Feature Barrels | Imports | lint + build |
| 17 | Final Page Slimming | Cleanup | full regression |
| 18 | Optional CSS Split | Optional CSS organization | build + screenshots |

---

## 5. Execution Tasks

### Task 1: ADR

**Files**

- Create: `doc/adr/0001-preserve-ui-refactor.md`

**Steps**

1. Record the preserve-UI refactor strategy.
2. Include constraints: no UI/interaction change, storage equivalence, cloud sync equivalence, no TypeScript, no new test framework.
3. Include consequences: slower task-by-task movement, shadow compare for derivations, storage snapshots for writes.

**Verify**

```bash
npm run lint
```

**Commit**

```bash
git add doc/adr/0001-preserve-ui-refactor.md
git commit -m "docs: record preserve-ui refactor strategy"
```

### Task 2: Regression Checklist

**Files**

- Create: `doc/refactor-regression-checklist.md`

**Steps**

1. Add screenshot checklist from Section 2.
2. Add behavior checklist from Section 2.
3. Add storage checklist from Section 3.3.
4. Add a task execution record table with columns: task, date, lint, build, manual checks, snapshot/shadow result, notes.

**Verify**

```bash
npm run lint
```

**Commit**

```bash
git add doc/refactor-regression-checklist.md
git commit -m "docs: add refactor regression checklist"
```

### Task 3: Page Dependency Map

**Files**

- Create: `doc/page-refactor-dependency-map.md`
- Read: `app/page.jsx`
- Read: `app/hooks/useSummaryCalculations.js`
- Read: `app/hooks/useRefreshManager.js`
- Read: `app/hooks/useSyncManager.js`
- Read: `app/hooks/useScanImport.js`

**Steps**

1. Map store subscriptions used by `page.jsx`.
2. Map local UI state that must remain local.
3. Map derived-data order and dependency relationships.
4. Map effect dependencies that must be preserved.
5. List extraction constraints for Tasks 6-13.
6. Confirm hook order before moving code.

**Verify**

```bash
npm run lint
```

**Commit**

```bash
git add doc/page-refactor-dependency-map.md
git commit -m "docs: map page refactor dependencies"
```

### Task 4: Dev Shadow Compare Helper

**Files**

- Create: `app/lib/devShadowCompare.js`

**Steps**

1. Add `devShadowCompare(label, legacyValueFactory, nextValueFactory)`.
2. Production must short-circuit.
3. Development should call both factories, compare serializable values, and log `[shadow-compare mismatch]` on differences.
4. Factories must compare same-shape, non-function projections.

**Verify**

```bash
npm run lint
npm run build
```

**Commit**

```bash
git add app/lib/devShadowCompare.js
git commit -m "chore: add dev shadow compare helper"
```

### Task 5: Storage Snapshot Harness

**Files**

- Create: `app/lib/storageSnapshot.js`
- Create: `doc/storage-snapshot-scenarios.md`

**Steps**

1. Add `createStorageSnapshot()`.
2. Add `installSyncEventRecorder()`.
3. Add or document the dev-only console access path through `window.__storageSnapshot`.
4. Confirm snapshot keys include all business storage keys needed by scenarios, including `tags`.
5. Document scenarios 1-8 and DCA from Section 3.3.
6. Document expected result for scenario 8: expected key `tags`, expected sync key `tags`.

**Verify**

```bash
npm run lint
npm run build
```

**Commit**

```bash
git add app/lib/storageSnapshot.js doc/storage-snapshot-scenarios.md
git commit -m "chore: add storage snapshot diff harness"
```

### Task 6: Portfolio Scope

**Files**

- Create: `app/features/portfolio/usePortfolioScope.js`
- Create: `app/features/portfolio/usePortfolioScopeCleanup.js`
- Modify: `app/page.jsx`

**Steps**

1. Move pure portfolio derivation into `usePortfolioScope`.
2. Move linked daily-earnings cleanup into `usePortfolioScopeCleanup`.
3. Keep the legacy calculation temporarily in `page.jsx`.
4. Add shadow compare only for these 8 comparable non-function fields:
   - `activeGroupId`
   - `linkedHoldingsForAllFav`
   - `currentFundDailyEarnings`
   - `portfolioDailySeries`
   - `holdingsForTabWithLinked`
   - `dcaPlansForTab`
   - `transactionsForTab`
   - `activeGroupCodeSet`
5. Use the full `nextPortfolioScope` directly for `groupById` and `getScoped*` functions.

**Verify before removing legacy**

```bash
npm run lint
npm run build
npm run dev
```

Exercise:

- `全部`
- `自选`
- `汇总` if available
- At least one custom group

Expected:

- No `[shadow-compare mismatch]` console messages.
- If cleanup writes `fundDailyEarnings`, storage snapshots match.

**Finish**

1. Remove the legacy block.
2. Remove the `devShadowCompare` import from `page.jsx`.
3. Run:

```bash
npm run lint
npm run build
```

**Commit**

```bash
git add app/features/portfolio/usePortfolioScope.js app/features/portfolio/usePortfolioScopeCleanup.js app/page.jsx
git commit -m "refactor: extract portfolio scope derivation"
```

### Task 7: Fund Display List

**Files**

- Create: `app/features/portfolio/useFundDisplayList.js`
- Modify: `app/page.jsx`

**Steps**

1. Move `scopedFunds`, filtering, sorting, `displayFundsRaw`, and `displayFunds`.
2. Keep the legacy calculation temporarily in `page.jsx`.
3. Shadow compare only `{ scopedFunds, displayFundsRaw }`.

**Verify before removing legacy**

```bash
npm run lint
npm run build
npm run dev
```

Exercise every sort:

- `default`
- `yield`
- `holdingAmount`
- `todayProfit`
- `holding`
- `estimateProfit`
- `yesterdayProfit`
- `holdingDays`
- `holdingCost`
- `sinceAddedChangePercent`
- `consecutiveTrend`
- `tags`
- `name`

Exercise scopes:

- `全部`
- `自选`
- `汇总` if available
- Custom group with holdings
- Custom group without holdings if available

Expected:

- No `[shadow-compare mismatch]` console messages.

**Finish**

1. Remove the legacy block.
2. Remove the `devShadowCompare` import from `page.jsx`.
3. Run:

```bash
npm run lint
npm run build
```

**Commit**

```bash
git add app/features/portfolio/useFundDisplayList.js app/page.jsx
git commit -m "refactor: extract fund display list derivation"
```

### Task 8: Fund Table Rows

**Files**

- Create: `app/features/portfolio/useFundTableRows.js`
- Modify: `app/page.jsx`

**Steps**

1. Move `latestDailyByCode`, `groupTotalHoldingAmount`, `pendingCodesForTab`, and `pcFundTableData`.
2. Keep the legacy calculation temporarily in `page.jsx`.
3. Shadow compare the same 4 keys.

**Verify before removing legacy**

```bash
npm run lint
npm run build
npm run dev
```

Exercise:

- PC list view
- Mobile list view
- Card view
- `全部`
- `自选`
- `汇总` if available
- One custom group

Expected:

- No `[shadow-compare mismatch]` console messages.

**Finish**

1. Remove the legacy block.
2. Remove the `devShadowCompare` import from `page.jsx`.
3. Run:

```bash
npm run lint
npm run build
```

**Commit**

```bash
git add app/features/portfolio/useFundTableRows.js app/page.jsx
git commit -m "refactor: extract fund table row model"
```

### Task 9: Fund Tags

**Files**

- Create: `app/features/tags/useFundTags.js`
- Modify: `app/page.jsx`

**Steps**

1. Capture baseline snapshots for scenario 8 before moving code.
2. Move `fundTagRecords`, `fundTagListsByCode`, tag edit/open/save/pool/delete/update/usage logic.
3. Call the hook after `storageHelper` is available.
4. Keep `setFundTagRecords` returned for sync/import initialization.

**Verify**

```bash
npm run lint
npm run build
```

Manual checks:

- Existing tags render.
- Edit tag modal opens and saves.
- Add pool tag.
- Delete global tag.
- Update global tag.
- Sort by tags.

Storage snapshot check:

- Repeat scenario 8 with the same seed data.
- Compare snapshot JSON and sync events.
- The `tags` payload shape and `onSync` event count/order must match.

**Commit**

```bash
git add app/features/tags/useFundTags.js app/page.jsx
git commit -m "refactor: extract fund tag actions"
```

### Task 10: Trading Actions

**Files**

- Create: `app/features/trading/useTradingActions.js`
- Modify: `app/page.jsx`

**Steps**

1. Capture baseline snapshots for scenarios 1-3 before moving code.
2. Move `handleSaveHolding`, `handleClearConfirm`, `processPendingQueue`, `handleDeleteTransaction`, `handleMergeAllGroupTransactionsToCurrent`, `handleAddHistory`, and `handleTrade`.
3. Use `useStorageStore.getState()` and `useModalStore.getState()` inside callbacks.
4. Keep batched `storageStore.setItem` behavior.

**Verify**

```bash
npm run lint
npm run build
```

Storage snapshot check:

- Repeat scenario 1: buy with resolved price.
- Repeat scenario 2: buy without price.
- Repeat scenario 3: clear holding.
- Compare snapshot JSON and sync events.

Manual checks:

- Edit holding.
- Clear holding.
- Buy with price.
- Buy without price.
- Delete transaction in current scope.
- Merge group transactions.

**Commit**

```bash
git add app/features/trading/useTradingActions.js app/page.jsx
git commit -m "refactor: extract trading actions"
```

### Task 11: DCA Scheduler

**Files**

- Create: `app/features/trading/useDcaScheduler.js`
- Modify: `app/page.jsx`

**Steps**

1. Capture a DCA baseline snapshot before moving code.
2. Move `scheduleDcaTrades` and `isSchedulingDcaRef`.
3. Preserve date and trading-day behavior.
4. Preserve writes to `dcaPlans` and `pendingTrades`.

**Verify**

```bash
npm run lint
npm run build
```

Storage snapshot check:

- Run a DCA generation scenario that writes `dcaPlans` and `pendingTrades`.
- Compare snapshot JSON and sync events.

**Commit**

```bash
git add app/features/trading/useDcaScheduler.js app/page.jsx
git commit -m "refactor: extract dca scheduling"
```

### Task 12: Fund Mutations

**Files**

- Create: `app/features/portfolio/useFundMutations.js`
- Modify: `app/page.jsx`

**Steps**

1. Capture baseline snapshots for scenarios 4-6 before moving code.
2. Move reorder, remove, bulk remove, move funds, and global delete logic.
3. Use store `getState()` for storage data and setters.
4. Preserve modal payloads, toasts, and cleanup behavior.

**Verify**

```bash
npm run lint
npm run build
```

Storage snapshot check:

- Repeat scenario 4: delete one fund from custom group.
- Repeat scenario 5: delete one global fund.
- Repeat scenario 6: move funds between groups.
- Compare snapshot JSON and sync events.

Manual checks:

- Remove from group without holdings.
- Remove from group with holdings opens confirm.
- Remove global fund in other groups opens confirm.
- Bulk delete behavior unchanged.
- Move funds between groups.
- Reorder all/fav/custom group.

**Commit**

```bash
git add app/features/portfolio/useFundMutations.js app/page.jsx
git commit -m "refactor: extract fund mutation actions"
```

### Task 13: Search Box

**Files**

- Create: `app/features/search/useFundSearchBox.js`
- Modify: `app/page.jsx`

**Steps**

1. Move search state, dropdown refs, click outside behavior, mobile search focus, search effect, selected chips, and add fund logic.
2. Call the hook after scan-import setters exist.
3. Preserve selected chip shape and add-fund modal payloads.

**Verify**

```bash
npm run lint
npm run build
```

Manual checks:

- Search dropdown opens/closes.
- Select/unselect chips.
- Add opens scan confirm modal.
- Manual 6-digit code works.

**Commit**

```bash
git add app/features/search/useFundSearchBox.js app/page.jsx
git commit -m "refactor: extract fund search box state"
```

### Task 14: Business Storage Access

**Files**

- Modify: `app/page.jsx`
- Modify: `app/components/FundCard/index.jsx`
- Modify: `app/components/Announcement.jsx`
- Modify: `app/stores/storageStore.js`

**Audit**

```bash
rg -n "localStorage|sessionStorage" app lib components public --glob '!public/sw.js'
```

**Steps**

1. Add `storageStore.keys()`.
2. Replace `rtf_unadded_ds` direct access with `storageStore`.
3. Replace `Announcement.jsx` direct key scanning with `storageStore.keys()`.
4. Keep Supabase session cleanup and layout theme bootstrap as documented exceptions.
5. Document any remaining direct storage access that is not business data.

**Verify**

```bash
npm run lint
npm run build
rg -n "localStorage|sessionStorage" app lib components public --glob '!public/sw.js'
```

Storage snapshot check:

- Scenario 7: announcement close writes only announcement keys.
- No `SYNC_KEYS` event fires for announcement/theme/auth cleanup.

**Commit**

```bash
git add app/page.jsx app/components/FundCard/index.jsx app/components/Announcement.jsx app/stores/storageStore.js
git commit -m "refactor: route business storage through storage store"
```

### Task 15: Fund API Services

**Files**

- Create: `app/services/fund/scriptLoader.js`
- Create: `app/services/fund/netValueApi.js`
- Create: `app/services/fund/valuationApi.js`
- Create: `app/services/fund/holdingsApi.js`
- Create: `app/services/fund/searchApi.js`
- Create: `app/services/fund/marketApi.js`
- Create: `app/services/fund/miscApi.js`
- Modify: `app/api/fund.js`

**Steps**

1. Move API functions in small batches.
2. Keep public export names compatible.
3. Make `app/api/fund.js` a re-export barrel.
4. If circular imports appear, move shared constants/helpers to `app/services/fund/shared.js`.
5. After each batch, run lint and build before moving the next batch.

**Verify after each batch**

```bash
npm run lint
npm run build
```

Manual checks after the full split:

- Refresh fund data.
- Search funds.
- Holdings/related sector UI.
- Market tab.
- History/valuation trend charts.

**Commit**

```bash
git add app/api/fund.js app/services/fund
git commit -m "refactor: split fund api services"
```

### Task 16: Feature Barrels

**Files**

- Create: `app/features/portfolio/index.js`
- Create: `app/features/tags/index.js`
- Create: `app/features/trading/index.js`
- Create: `app/features/search/index.js`
- Modify: `app/page.jsx`

**Steps**

1. Export feature hooks from barrels.
2. Update `page.jsx` feature imports.
3. Keep import names explicit and easy to trace.

**Verify**

```bash
npm run lint
npm run build
```

**Commit**

```bash
git add app/features app/page.jsx
git commit -m "refactor: add feature barrels"
```

### Task 17: Final Page Slimming

**Files**

- Modify: `app/page.jsx`

**Steps**

1. Remove unused imports.
2. Remove unused modal setter wrappers only if no component/callback still needs them.
3. Remove dead compatibility variables only after searching all references.
4. Keep behavior unchanged.

**Verify**

```bash
wc -l app/page.jsx
npm run lint
npm run build
```

Manual checks:

- Full `doc/refactor-regression-checklist.md` passes on desktop and mobile.

**Commit**

```bash
git add app/page.jsx
git commit -m "refactor: clean page orchestration imports"
```

### Task 18: Optional CSS Split

Only execute after all JavaScript tasks are stable.

**Files**

- Create: `app/styles/tokens.css`
- Create: `app/styles/base.css`
- Create: `app/styles/layout.css`
- Create: `app/styles/components.css`
- Modify: `app/globals.css`

**Steps**

1. Move CSS by copy/paste only.
2. Preserve selector order.
3. Preserve media query placement.
4. Preserve Tailwind import/layer order.
5. Preserve `px`/`PX` spelling and `postcss-pxtorem` behavior.

**Verify**

```bash
npm run build
```

Manual checks:

- Desktop/mobile screenshots match baseline.
- Modal/drawer/table sticky/mobile nav layering unchanged.
- PC `px`, mobile media-query `px`, `1px` borders, and `PX` opt-outs still behave the same.

**Commit**

```bash
git add app/globals.css app/styles
git commit -m "refactor: organize global styles"
```

---

## 6. Stop Conditions And Recovery

Stop immediately if:

- `npm run lint` fails with a new issue.
- `npm run build` fails.
- Any shadow compare mismatch appears after exercising the required branches.
- Storage snapshot shape differs unexpectedly.
- `onSync` event count/order changes unexpectedly.
- UI screenshots or modal flows differ from baseline.

Inspect before fixing:

```bash
git status --short
git diff
```

Recovery rule:

- Fix within the same task when the cause is clear.
- Revert only that task commit if the task cannot be repaired quickly.
- Do not revert unrelated user changes.

---

## 7. Final Acceptance

The refactor is done when:

- All non-optional tasks 1-17 are committed separately.
- `npm run lint` passes.
- `npm run build` passes.
- Full manual regression checklist passes on desktop and mobile.
- Business storage access is routed through `storageStore`, with documented exceptions only.
- Storage snapshot scenarios match baseline.
- Shadow compare tasks had zero mismatches before legacy removal.
- `app/page.jsx` is materially smaller.
- `app/api/fund.js` is decomposed or intentionally postponed because of documented circular import risk.
- Any temporary `window.__storageSnapshot` exposure is removed or clearly guarded as dev-only.

---

## 8. Review Resolution Log

This runbook incorporates the execution-file review rounds completed on 2026-06-23:

- Round 1: Added Task 9 tag snapshot coverage because `tags` is a sync key.
- Round 1: Added baseline JSON scratch-file persistence.
- Round 1: Required a fixed localStorage seed before baseline/refactor comparisons.
- Round 2: Added a dev console access path for snapshot helpers through `window.__storageSnapshot`.
- Round 3: Confirmed all substantive issues are closed.
- Round 3 optional optimization: a guarded dev-only `window.__storageSnapshot` exposure may remain through all snapshot tasks, then be removed or kept only as an intentional dev helper.

Treat Sections 0-7 as the source of truth during execution. The full historical review text was condensed here so the execution steps stay readable.
