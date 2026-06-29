# Upstream Sync Checklist: 2e14d9e to be17676

## Range

- Anchor: `2e14d9e3a3617a228fa4c28305b3b5408a93a43e`
- Target: `be176765566d0e6f83b7614b5e0d7328087a633b`

## Decisions

- [x] QDII data source 4: ported
- [x] Table pagination: ported
- [x] Safari pagination input 16PX fix: ported (`text-[16PX]` on page-size input)
- [x] Group dropdown scroll behavior: ported (removed forced `max-h-none`/`maxHeight:none`)
- [x] Cloud customSettings sort fix: ported
- [x] Auto-source user-state guard: ported
- [x] Chart tooltip transparency: ported (into `app/styles/components.css`)
- [x] Trading-day NAV updated logic: ported
- [x] T+2 daily profit logic: ported
- [x] Version and announcement: ported (v2.3.3)
- [x] `.idea`: ignored
- [x] Upstream legacy `AGENTS.md`: not overwritten

## Baseline

- `npm run lint`: 42 warnings, 0 errors
- `npm run build`: passes (static export, all routes prerendered)

## Final

- `npm run lint`: 42 warnings, 0 errors (no new errors introduced)
- `npm run build`: passes (static export, routes `/`, `/market`, `/mine` prerendered)
- Manual data source 4 checks: PENDING (needs browser — QDII fund shows source 4, normal fund hides it)
- Manual table pagination checks: PENDING (needs browser — see Task 4 notes below)
- Manual T+2/QDII profit checks: PENDING (needs browser/devtools)
- Manual cloud sort setting checks: PENDING (needs cloud account)

### Task 4 (pagination) — browser verification still required

Ported into the refactored, **window-virtualized** PC table and the non-virtualized
mobile table; lint + build are green but runtime behavior was not verifiable headlessly.
Verify in a browser:

- PC and mobile list views paginate; changing sort/group resets to page 1.
- Per-page input persists across reload; iOS Safari does not zoom on focus (`text-[16PX]`).
- Drag/reorder when `sortBy === 'default'` moves the underlying full-list item even from page 2
  (reorder uses `data.findIndex(code)`, not page-local index).
- Cross-page batch select ("全选" / bulk delete / move) behaves as expected.
- PC sticky header + `.table-scroll-area` horizontal scroll still work after the
  `.table-pc-wrap` wrappers moved from `FundListView` into `PcFundTable`.

## File Mapping

| Upstream change               | Target file(s)                                                                                                                                                                                    | Status                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| data source 4 / `isQdiiFund`  | `app/services/fund/valuationApi.js`, `app/lib/query-keys.js`, `app/stores/storageStore.js`, `app/components/fund/FundDataSourceSelector.jsx`, `app/components/charts/FundValuationTrendChart.jsx` | DONE                          |
| table pagination              | `app/components/tables/PcFundTable.jsx`, `app/components/tables/MobileFundTable.jsx`, `app/components/tables/FundListView.jsx`                                                                    | DONE (browser verify pending) |
| cloud customSettings sort fix | `app/hooks/useSyncManager.js`                                                                                                                                                                     | DONE                          |
| auto-source user-state guard  | `app/hooks/useRefreshManager.js`                                                                                                                                                                  | DONE                          |
| NAV updated + T+2 profit      | `app/lib/tradingCalendar.js`, `app/lib/fundHelpers.js`, `app/hooks/useRefreshManager.js`, `app/hooks/useHoldingProfit.js`                                                                         | DONE                          |
| tooltip opacity               | `app/styles/components.css`                                                                                                                                                                       | DONE                          |
| release                       | `app/components/system/Announcement.jsx`, `package.json`, `package-lock.json`, docs                                                                                                               | DONE                          |

## Known limitation

The QDII data-source migration (`storageStore`) is intentionally tag-gated: it only
upgrades funds already tagged `valuationSource: 'supabase_qdii'` from `dataSource: 1`
to `4`. A true QDII fund stored as source 1 but never tagged recovers via auto-source
or the data-source selector, not via async detection in the storage normalizer.
