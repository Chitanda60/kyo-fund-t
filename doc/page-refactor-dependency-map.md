# Page Refactor Dependency Map

Snapshot of `app/page.jsx` (`HomePage`, starts line 111) structure used to order Tasks 6-13.
Line numbers are approximate anchors against the pre-refactor file and will drift as extraction proceeds.

## Store Subscriptions

- `useStorageStore()` (line ~112): `funds`, `groups`, `favorites`, `collapsedCodes`, `collapsedTrends`, `collapsedValuationTrends`, `collapsedEarnings`, `refreshMs`, `holdings`, `groupHoldings`, `pendingTrades`, `transactions`, `dcaPlans`, `customSettings`, `fundDailyEarnings`, `valuationSeries`, `sortBy`, `sortOrder`, `pcSortDisplayMode`, `mobileSortDisplayMode`, `sortRules`, plus their setters and `init*` loaders.
- `useSettingsStore()` (line ~202): `tempSeconds`, `containerWidth`, `showMarketIndexPc/Mobile`, `showGroupFundSearchPc/Mobile`, `dynamicStylePc/Mobile`, `isGroupSummarySticky`, `syncFromCustomSettings`. Derived from `customSettings` via an effect (line ~224).
- `useUserStore`: auth user.
- `useModalStore`: modal open/state. **`page.jsx` must not subscribe** — use `useModalStore.getState()` / `setState()` or `modalCbRef`.

## Local UI State (must remain local to page)

- `fundTagRecords` (line ~171) — owned by Task 9 `useFundTags` after extraction; setter still returned for sync/import init.
- `error` (line ~197)
- `currentTab` (line ~230), `mainTab`, `hasVisitedMarketTab`
- search state: `searchTerm`, `isSearchFocused`, `searchResults`, `selectedFunds`, `isSearching`, `showDropdown`, `groupFundSearchTerm` — Task 13.
- `viewMode`, `maskAmounts`
- `percentModes`, `todayPercentModes`
- `fundExtraDataByCode` (line ~744)
- `importMsg`
- refs: `isLoggingOutRef`, `isExplicitLoginRef`, `dropdownRef`, `inputRef`, `isProcessingPendingRef`, `isSchedulingDcaRef`, `modalCbRef`.

## Derived-Data Order (actual declaration order)

1. `fundTagListsByCode` (~176) — from `fundTagRecords` + `funds`.
2. settings derived from `customSettings` (effect ~224).
3. `useSummaryCalculations({ currentTab, setCurrentTab, getHoldingProfit })` (~428) → `groupsWithHoldings`, `summaryMergedHoldings`, `summaryHoldingSourceGroupByCode`.
4. `getHoldingProfitForTab` (~430).
5. `linkedHoldingsForAllFav` (~447).
6. `currentFundDailyEarnings` (~517) — **reads** `summaryHoldingSourceGroupByCode`, `linkedHoldingsForAllFav`; cleanup effect writes `fundDailyEarnings` (→ Task 6 `usePortfolioScopeCleanup`).
7. `portfolioDailySeries` (~625).
8. `holdingsForTabWithLinked` (~658), `dcaPlansForTab` (~668), `transactionsForTab` (~674).
9. `groupById` (~685), `activeGroupCodeSet` (~713).
10. `scopedFunds` (~735).
11. `fundExtraDataByCode` fetch effect (~747) — depends on `scopedFunds`.
12. `displayFundsRaw` (~799, ~300 lines) → `displayFunds` (`useDeferredValue`).
13. `latestDailyByCode` (~1119), `groupTotalHoldingAmount` (~1139), `pendingCodesForTab` (~1150), `pcFundTableData` (~1164, ~260 lines).
14. tag actions (~2073-2266), view toggles, trading handlers, mutation handlers, `getFundCardPropsForRow` (~4229).
15. `useGroupActions({ currentTab, setCurrentTab })` (~2517) → `stripFundFromGroupScope`, `stripManyFundsFromGroupScope`, group helpers.
16. `modalCbRef.current = { ... }` — must stay AFTER all callbacks/data are defined.

## Effect Dependencies To Preserve

- Sort fallback effect (~255) depends on `sortRules`, `sortBy` (warns on `setSortBy`/`setSortRules` — leave as-is).
- `customSettings` → settings sync effect (~224).
- Mobile drawer / table-setting effects (~393-401) reference modal setters (warned, leave as-is).
- `fundExtraDataByCode` fetch effect (~747) depends on `scopedFunds`.
- Init effect (~2696) depends on storage `init*` + `refreshAll` (intentionally narrow dep list — do not "fix").
- Auth/session effect (~2803) runs and must not subscribe to modal state.
- `currentFundDailyEarnings` cleanup effect — moves to `usePortfolioScopeCleanup`, keep deps `[linkedHoldingsForAllFav, setFundDailyEarnings]`.

## Extraction Constraints (Tasks 6-13)

- Derived-data hooks (Task 6 `usePortfolioScope`, Task 7 `useFundDisplayList`, Task 8 `useFundTableRows`) must be **pure**: accept values as args, return computed values, call no setters. The one cleanup write in the scope area goes to Task 6 `usePortfolioScopeCleanup` (a separate effect hook).
- Mutation hooks (Task 9 tags, Task 10 trading, Task 11 DCA, Task 12 mutations) may read/write via `useStorageStore.getState()` / `storageStore` / `useModalStore.getState()` to avoid giant setter parameter lists; pass only contextual callbacks/refs/local setters not available globally.
- `usePortfolioScope` consumes `summaryMergedHoldings` / `summaryHoldingSourceGroupByCode` / `groupsWithHoldings` from `useSummaryCalculations` → it must be called AFTER that hook.
- `useFundDisplayList` depends on `activeGroupCodeSet`, `activeGroupId`, `holdingsForTabWithLinked`, `currentFundDailyEarnings`, `fundExtraDataByCode`, `fundTagListsByCode` → after Task 6 + tags.
- `useFundTableRows` depends on `displayFunds` → after Task 7.
- Task 9 `useFundTags` must be called after `storageHelper` exists, or take storage access as a stable dependency.
- Task 13 `useFundSearchBox` must be called after scan-import setters exist.
- `modalCbRef.current = {...}` assignment must remain after every callback/data field it references.

## Confirmed Hook Order (target)

`useStorageStore` → `useSettingsStore` → local state → `useSummaryCalculations` → `useFundTags` (Task 9) → `usePortfolioScope` (Task 6) → `usePortfolioScopeCleanup` (Task 6) → `useFundDisplayList` (Task 7) → `useFundTableRows` (Task 8) → trading/DCA/mutation hooks (Tasks 10-12) → `useFundSearchBox` (Task 13) → `useGroupActions` → `modalCbRef` assignment.
