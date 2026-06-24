# Refactor Regression Checklist

Use this checklist after each refactor task that touches `app/page.jsx`, stores, hooks, or fund API services.

## Baseline (captured before Task 1)

- Branch: `refactor/preserve-ui`
- `npm run lint`: 0 errors, 36 warnings (pre-existing `react-hooks/exhaustive-deps` + `import/no-anonymous-default-export`). This warning count is the baseline; a task must not increase it.
- `npm run build`: success (static export, 4 routes).

## Screenshots To Compare

- Desktop list view
- Desktop card view
- Mobile list view
- Mobile drawer open
- Settings modal
- Trade modal
- Group management modal

## Behavior Checks

- Home page renders fund list in list mode and card mode.
- Search by fund code/name opens dropdown and selected chip flow works.
- Tabs switch between all available tab types.
- Scopes work: `全部`, `自选`, `汇总`, and at least one custom group.
- Sort behavior is unchanged for: `default`, `yield`, `holdingAmount`, `todayProfit`, `holding`, `estimateProfit`, `yesterdayProfit`, `holdingDays`, `holdingCost`, `sinceAddedChangePercent`, `consecutiveTrend`, `tags`, `name`.
- PC and mobile row actions open the same dialogs.
- Add group, add funds to group, delete from group, and global delete confirmation paths work.
- Buy/sell with known price updates holdings and transactions.
- Buy/sell without price enters pending trades.
- DCA generation still creates pending trades on trading days.
- Settings export/import, auth, sync, feedback, donate, tutorial, and update log entry points still open.

## Storage Checks

- No new direct business `localStorage` reads/writes.
- `funds`, `groups`, `favorites`, `holdings`, `groupHoldings`, `pendingTrades`, `transactions`, `dcaPlans`, `customSettings`, `fundDailyEarnings`, and `tags` still sync through `storageStore`.
- For each write-path task, snapshot JSON shape and `onSync` event count/order match baseline (see `doc/storage-snapshot-scenarios.md`).

## Task Execution Record

|                       Task | Date       | lint       | build | manual checks | snapshot/shadow result | notes                                      |
| -------------------------: | ---------- | ---------- | ----- | ------------- | ---------------------- | ------------------------------------------ |
|                      1 ADR | 2026-06-23 | pass (36w) | n/a   | n/a           | n/a                    | docs only                                  |
|     2 Regression checklist | 2026-06-23 | pass (36w) | n/a   | n/a           | n/a                    | docs only                                  |
|           3 Dependency map |            |            |       |               |                        |                                            |
|         4 devShadowCompare |            |            |       |               |                        |                                            |
| 5 Storage snapshot harness |            |            |       |               |                        |                                            |
|          6 Portfolio scope |            |            |       |               |                        | shadow compare 8 fields + cleanup snapshot |
|        7 Fund display list |            |            |       |               |                        | shadow compare scopedFunds/displayFundsRaw |
|          8 Fund table rows |            |            |       |               |                        | shadow compare 4 fields                    |
|                9 Fund tags |            |            |       |               |                        | snapshot scenario 8                        |
|         10 Trading actions |            |            |       |               |                        | snapshot scenarios 1-3                     |
|           11 DCA scheduler |            |            |       |               |                        | DCA snapshot                               |
|          12 Fund mutations |            |            |       |               |                        | snapshot scenarios 4-6                     |
|              13 Search box |            |            |       |               |                        | manual checks                              |
| 14 Business storage access |            |            |       |               |                        | storage audit + scenario 7                 |
|       15 Fund API services |            |            |       |               |                        | lint+build after each batch                |
|         16 Feature barrels |            |            |       |               |                        |                                            |
|     17 Final page slimming |            |            |       |               |                        | full regression                            |
|      18 Optional CSS split |            |            |       |               |                        | optional                                   |

## Split Main Tabs Into Pages (2026-06-24 migration)

Checks specific to turning `home / market / mine` tabs into routes `/`, `/market`, `/mine`:

- [ ] Route lifecycle snapshot: `main-tab-route-lifecycle` JSON shape matches baseline (see `doc/storage-snapshot-scenarios.md`).
- [ ] `onSync` event comparison: navigation alone fires no extra `SYNC_KEYS` events.
- [ ] GitHub Pages deep-link refresh: direct refresh of `/`, `/market`, `/mine` (incl. repo subpath) works after deploy.
- [ ] Mobile container class check: `content` / `content-with-mobile-tabbar` / `mine-mobile-root` / `mobile-main-tab-panel*` behavior matches baseline per route.
- [ ] Runtime context render/profile check: typing in search does not remount `MarketTab`/`MineTab`; no broad rerender storm.
- [ ] Desktop direct `/mine` redirects to `/` only after viewport resolved non-mobile; mobile direct `/mine` does not jump.
