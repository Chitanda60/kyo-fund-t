# Upstream Sync Checklist: ffaf4b0 to 2e14d9e

## Range

- Anchor: `ffaf4b090960ecc715a32556bc02b513cce07159` (feat：悬浮框字体大小调整, 2026-06-17)
- Target: `2e14d9e3a3617a228fa4c28305b3b5408a93a43e` (feat：分组下拉宽度调整, 2026-06-24)

## Decisions

- [x] Auto/best data source: port
- [x] Import auto source switch: port
- [x] Recommended tags: port
- [x] Data source column and badges: port
- [x] Personalized sort top/pin: port
- [x] Group dropdown display settings: port
- [x] Width/slider/dialog fixes: port
- [x] Chart cumulative net value: port
- [x] Error boundary/static asset wording: port
- [x] QR image updates (`app/assets/weChatGroup.jpg`): skipped (asset-only, not synced)
- [x] AI/IDE metadata: ignore (intentionally skipped)

## Real product diff in range (verified)

Added: `app/components/DataSourceAccuracyBadge.jsx`, `app/hooks/useDataSourceAccuracyLabels.js`, `app/lib/containerWidth.js`.
Modified: `app/api/fund.js`, `app/lib/query-keys.js`, `app/lib/fundHelpers.js`, `app/stores/settingsStore.js`, `app/hooks/{useRefreshManager,useScanImport,useSyncManager}.js`, `app/page.jsx`, `components/ui/progress.jsx`, `app/globals.css`, `app/assets/weChatGroup.jpg`, and the components listed below. `package.json`/`package-lock.json` (version bump to 2.3.1).
Components: AllSectorsModal, Announcement, ClientErrorBoundary, DcaModal, FundCard/index, FundDataSourceSelector, FundHistoryNetValue(Modal), FundTagsEditDialog, FundTrendChart, FundValuationTrendChart, GlobalClientErrorHandler, GroupManageModal, GroupModal, GroupSummary, MobileFundTable, MobileSettingModal, ModalsLayer, MyEarningsCalendarPage, PcFundTable, PcTableSettingModal, ScanImportConfirmModal, SettingsModal, SortSettingModal.

## app/page.jsx hunk map (upstream monolith -> current refactored homes)

| Upstream hunk                                                                                                                                    | Target file(s)                                                                    | Task | Status |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---- | ------ |
| Imports `ChevronLeft/ChevronRight/SelectGroup/cn`; remove `seedGroupHoldingsFromGlobal` import                                                   | AppShell, HomePageContent, useSyncManager                                         | 7    | TODO   |
| Settings fields `showGroupDropdownPc/Mobile`                                                                                                     | settingsStore, AppShell                                                           | 7    | TODO   |
| Tab refs/overflow `scrollAreaRef`, `hasTabOverflow`, scroll buttons, Resize/MutationObserver                                                     | AppShell, HomePageContent, styles                                                 | 7    | TODO   |
| Scan import callback `(...args)`; `setFundTagRecords` into import hook                                                                           | AppShell, useScanImport, ModalsLayer                                              | 4    | TODO   |
| Remove group-holdings seeding on init/group change                                                                                               | AppShell, useSyncManager, fundHelpers                                             | 7    | TODO   |
| Delete fund no longer deletes `fundDailyEarnings`                                                                                                | **app/features/portfolio/useFundMutations.js**                                    | 7    | TODO   |
| System settings save adds `containerWidthOverride`, `showGroupDropdownOverride`; reads latest `customSettings` from `useStorageStore.getState()` | AppShell, SettingsModal, settingsStore                                            | 7    | TODO   |
| PC width clamp `Math.max(window.innerWidth, 2000)`                                                                                               | AppShell, containerWidth                                                          | 9    | TODO   |
| `handleDataSourceSelect(fundCode, sourceId, autoSource)` stores `autoSource`                                                                     | AppShell, FundDataSourceSelector, useRefreshManager                               | 3    | TODO   |
| Runtime context exposes group-dropdown flags + updated scan callback                                                                             | AppShell, HomePageContent, ModalsLayer                                            | 4/7  | TODO   |
| Filter bar margin/top + group dropdown tab rendering                                                                                             | HomePageContent, AppShell, styles                                                 | 7    | TODO   |
| Personalized sort/top pipeline                                                                                                                   | **app/features/portfolio/useFundDisplayList.js**, SortSettingModal, settingsStore | 6    | TODO   |

## Baseline

- `npm run lint`: PASS (0 errors, 34 warnings) — 2026-06-24
- `npm run build`: PASS (routes /, /market, /mine) — 2026-06-24

## Final (2026-06-24)

- `npm run lint`: PASS — 0 errors, 41 warnings (baseline 34; +7 are pre-existing exhaustive-deps in the ported upstream files).
- `npm run build`: PASS — prerenders /, /market, /mine.
- Routes render with 0 console errors; app version shows 2.3.1.
- Ported (committed): best-source APIs, auto data-source, import auto-source + recommended tags, data-source column/badges, pinned sort, delete-keeps-earnings, group-holdings seed removal, cumulative net value charts + client error handling, PC width clamp + table drag, group-dropdown/width settings store+modal+save wiring, version 2.3.1, supabase RPC schema.
- Supabase-dependent features (auto-source/recommended-tags): code ported + degrade safely; functional verification pending RPC deploy (`doc/supabase.sql` §4) + data.
- **UI follow-up now complete (commit `914a3ab`):** HomePageContent renders group tabs as a dropdown when `showGroupDropdown` is on + tab-overflow scroll buttons (`scrollAreaRef`/`hasTabOverflow` + Resize/MutationObserver in AppShell); `.name-cell`/`.tabs`/`.tabs-scroll-*` CSS merged into `app/styles/components.css`. Re-verified: 0 console errors, tab bar renders, 2.3.1 announcement shows.
- **Remaining (operational, not code):** populate the Supabase `fund_best_source` / `fund_related` / `fund_topic` data so auto-source + recommended-tags return results (RPCs already deployed + reachable).
