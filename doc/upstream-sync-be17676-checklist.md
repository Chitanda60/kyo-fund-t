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

- `npm run lint`: 42 warnings, 0 errors
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
