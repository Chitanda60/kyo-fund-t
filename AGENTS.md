# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-24T00:00:00+08:00
**Commit:** eea12c1
**Branch:** refactor/preserve-ui

## OVERVIEW

Real-time mutual fund valuation tracker (基估宝). Next.js 16 App Router, pure JavaScript/JSX, static export to GitHub Pages. The project is a client-side SPA with glassmorphism styling, localStorage-first persistence, optional Supabase cloud sync, and Chinese financial data loaded through JSONP/script injection plus selected fetch/Supabase calls.

The preserve-UI refactor is applied: fund API logic is split under `app/services/fund/`, feature hooks live under `app/features/`, modal state is centralized in Zustand, and global CSS is split into `app/styles/*` with `app/globals.css` as the import barrel.

The main `home / market / mine` tabs are **route-backed App Router pages** (`/`, `/market`, `/mine`), with the route files grouped under the `app/(main)/` route group (the parenthesized folder organizes the route files without changing the URLs; `layout.jsx` and `global-error.jsx` stay at `app/`). All former `app/page.jsx` orchestration (state, effects, handlers, `NavLayout`, the shared navbar/announcement/market-index chrome, and `ModalsLayer`) now lives in a persistent client shell `app/components/AppShell.jsx`, mounted once from `app/layout.jsx` so it survives route navigation (stores/refresh/sync stay alive; navigation fires no extra storage writes). Route pages are render-only and read data/actions from `AppRuntimeContext` (split state/actions). Portfolio group tabs (`全部 / 自选 / 汇总 / custom groups`) remain internal home-page state (`currentTab` in AppShell), not routes. Desktop `/mine` redirects to `/` after viewport resolves non-mobile. `trailingSlash: true` is set so GitHub Pages deep links resolve per-route `index.html`.

## STRUCTURE

```
real-time-fund/
├── app/                               # Next.js App Router root
│   ├── (main)/page.jsx                # Route `/`: renders <HomePageContent /> only  (route group — parens are not part of the URL)
│   ├── (main)/market/page.jsx         # Route `/market`: renders <MarketPageContent />
│   ├── (main)/mine/page.jsx           # Route `/mine`: <MinePageContent />; desktop redirects to `/`
│   ├── layout.jsx                     # Root layout (must stay at app/): providers + mounts persistent <AppShell>
│   ├── components/AppShell.jsx        # Persistent client shell: ALL former page.jsx state/effects/handlers, NavLayout, navbar chrome, ModalsLayer; provides AppRuntimeContext
│   ├── components/pages/              # Render-only route content (Home/Market/Mine PageContent)
│   ├── contexts/AppRuntimeContext.jsx # Split state/actions context consumed by route content
│   ├── hooks/useMainTabRoute.js       # URL-derived mainTab + setMainTab (router.push)
│   ├── global-error.jsx               # App-level client error page/toast
│   ├── globals.css                    # CSS import barrel only
│   ├── api/fund.js                    # Fund API barrel re-exporting app/services/fund/*
│   ├── services/fund/                 # External fund/market data APIs
│   │   ├── shared.js                  # Query cache, JSONP/script helpers, date helpers
│   │   ├── valuationApi.js            # 天天基金/Sina/Supabase valuation source logic
│   │   ├── holdingsApi.js             # Holdings + stock quote script injection
│   │   ├── netValueApi.js             # Net value, dividends, smart NAV lookup
│   │   ├── searchApi.js               # Fund search JSONP
│   │   ├── marketApi.js               # Tencent market index scripts
│   │   ├── sectorsApi.js              # Related sectors + Eastmoney sector quotes
│   │   └── miscApi.js                 # Releases, feedback, pingzhongdata, OCR LLM, ranking
│   ├── features/                      # Extracted page-level feature hooks
│   │   ├── portfolio/                 # Scope, display list, table rows, mutations
│   │   ├── trading/                   # Trade actions and DCA scheduler
│   │   ├── tags/                      # Fund tag state/actions
│   │   └── search/                    # Search box state/actions
│   ├── stores/                        # Zustand stores: storage, modal, user, settings
│   ├── components/                    # Core shell at root (AppShell/ModalsLayer/NavLayout); rest grouped into subfolders (see below)
│   ├── hooks/                         # App hooks: refresh, sync, scan import, calculations
│   ├── lib/                           # Utilities: Supabase, query client, OCR, helpers, snapshots
│   ├── styles/                        # Split global CSS: tokens/base/layout/components
│   ├── constants/                     # Shared constants
│   └── assets/                        # Static imported assets
├── components/ui/                     # shadcn/ui primitives
├── lib/utils.js                       # cn() helper only
├── public/                            # Static: allFund.json, PWA manifest, service worker, icon
├── doc/                               # Project docs, Supabase SQL, CSVs, ADR/checklists
├── docs/plans/                        # Preserve-UI refactor plan and execution runbook
├── .github/workflows/nextjs.yml       # GitHub Pages deploy workflow
├── .husky/pre-commit                  # lint-staged pre-commit hook
├── next.config.js                     # Static export, reactStrictMode, reactCompiler
├── jsconfig.json                      # Path alias: @/* -> ./*
├── eslint.config.mjs                  # Active ESLint flat config
├── postcss.config.mjs                 # Tailwind v4 + pxtorem config
├── components.json                    # shadcn/ui config
├── env.example                        # NEXT_PUBLIC_* environment template
└── package.json                       # Node >= 20.9.0, npm scripts, deps
```

### `app/components/` layout

Only the core shell stays at the root of `app/components/`: `AppShell.jsx`, `ModalsLayer.jsx`, `NavLayout.jsx`. Everything else is grouped into subfolders:

- `modals/<category>/` — all dialogs/drawers/modals (`trading`, `group`, `scan`, `tags`, `settings`, `fund-detail`, `common`)
- `tables/` — `PcFundTable`, `MobileFundTable`, `FundListView`
- `charts/` — `FundTrendChart`, `FundValuationTrendChart`, `FundIntradayChart`, `FundHistoryNetValue`
- `fund/` — fund display bits (`FundDailyEarnings`, `FundDataSourceSelector`, `DataSourceAccuracyBadge`, `GroupAccountSummaryCard`, `GroupSummary`, `SummaryTabContent`, `EmptyStateCard`)
- `nav/` — `MobileBottomNav`, `PcSideNav`, `UserMenu`
- `market/` — `MarketTab`, `MarketIndexAccordion`, `MineTab`
- `search/` — `SearchBar`, `SearchFund`, `ScanButton`, `RefreshButton`
- `system/` — side-effect/infra (`ClientErrorBoundary`, `GlobalClientErrorHandler`, `AnalyticsGate`, `PwaRegister`, `KeepScreenAwake`, `ThemeColorSync`, `UpdateChecker`, `Announcement`)
- `common/` — shared primitives (`Common`, `Icons`, `FitText`)
- `pages/` — route content components (`HomePageContent`, `MarketPageContent`, `MinePageContent`, `MyEarningsCalendarPage`)
- `FundCard/` — the fund card and its parts

Paths cited in the tables below may use the pre-reorg flat location; resolve a component by basename under these subfolders.

## WHERE TO LOOK

| Task                     | Location                                                                | Notes                                                                              |
| ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Main app orchestration   | `app/components/AppShell.jsx`                                           | All state/effects/handlers, navbar chrome, ModalsLayer; provides AppRuntimeContext |
| Main tab routing         | `app/{page,market/page,mine/page}.jsx` + `app/hooks/useMainTabRoute.js` | Route content + URL-derived tab; group tabs stay internal                          |
| Fund data public imports | `app/api/fund.js`                                                       | Barrel only; keep export names stable                                              |
| Fund valuation APIs      | `app/services/fund/valuationApi.js`                                     | 天天基金 fundgz, Sina, Supabase QDII fallback                                      |
| Fund holdings APIs       | `app/services/fund/holdingsApi.js`                                      | pingzhongdata holdings + stock quote script injection                              |
| Fund search APIs         | `app/services/fund/searchApi.js`                                        | Eastmoney search JSONP                                                             |
| Market and sectors       | `app/services/fund/marketApi.js`, `sectorsApi.js`                       | Tencent indices, Supabase/Eastmoney sector data                                    |
| Portfolio derivation     | `app/features/portfolio/usePortfolioScope.js`                           | Active scope, linked holdings, tab data                                            |
| Display list/sorting     | `app/features/portfolio/useFundDisplayList.js`                          | Filtering and sort result models                                                   |
| Table row models         | `app/features/portfolio/useFundTableRows.js`                            | PC/mobile table data                                                               |
| Fund mutations           | `app/features/portfolio/useFundMutations.js`                            | Delete, move, reorder, group cleanup                                               |
| Trading actions          | `app/features/trading/useTradingActions.js`                             | Buy/sell, pending queue, transaction mutations                                     |
| DCA scheduling           | `app/features/trading/useDcaScheduler.js`                               | Scheduled pending trades                                                           |
| Tags                     | `app/features/tags/useFundTags.js`                                      | `tags` storage key, tag pool/edit actions                                          |
| Search box               | `app/features/search/useFundSearchBox.js`                               | Search UI state, chips, add fund trigger                                           |
| Business storage         | `app/stores/storageStore.js`                                            | Unified localStorage access and cloud sync trigger                                 |
| Modal state              | `app/stores/modalStore.js`                                              | All modal open flags/payloads                                                      |
| Modal rendering          | `app/components/ModalsLayer.jsx`                                        | Central modal/drawer/dialog render layer                                           |
| Cloud sync               | `app/hooks/useSyncManager.js`, `app/lib/supabase.js`                    | Supabase auth/config sync                                                          |
| Refresh loop             | `app/hooks/useRefreshManager.js`                                        | Fund data refresh, holdings, charts, DCA processing                                |
| OCR import               | `app/hooks/useScanImport.js`, `app/lib/ocr.js`                          | Tesseract + LLM parsing                                                            |
| Query cache              | `app/lib/get-query-client.js`, `app/lib/query-keys.js`                  | TanStack Query cache shared with imperative APIs                                   |
| Valuation time series    | `app/lib/valuationTimeseries.js`                                        | localStorage intraday valuation history                                            |
| Styles                   | `app/globals.css`, `app/styles/*.css`                                   | Import barrel + split global CSS                                                   |
| UI primitives            | `components/ui/`                                                        | shadcn/ui, radix-ui, lucide                                                        |
| localStorage schema      | `doc/localStorage 数据结构.md`                                          | Stored data shape docs                                                             |
| Supabase schema          | `doc/supabase.sql`                                                      | Cloud sync DB + RPCs                                                               |
| Refactor plan            | `docs/plans/2026-06-17-preserve-ui-refactor.md`                         | Source plan                                                                        |
| Refactor execution       | `docs/plans/2026-06-17-preserve-ui-refactor-execution-steps.md`         | Task-by-task runbook                                                               |

## CONVENTIONS

- **JavaScript only** — no TypeScript in app code. `tsx: false` in `components.json`.
- **No `src/` directory** — root-level `app/`, `components/`, `lib/`.
- **Static export** — `output: 'export'` in `next.config.js`; no server runtime dependency for the built site.
- **Chinese UI** — all user-facing app text is zh-CN.
- **Path aliases** — `@/*` maps to project root. shadcn aliases are in `components.json`.
- **React Compiler enabled** — `reactCompiler: true`.
- **localStorage-first** — user data lives locally; Supabase sync is optional/secondary.
- **Unified Data Access** — business localStorage reads/writes must go through `storageStore` / `useStorageStore`. Direct `window.localStorage` is allowed only inside `storageStore`, early theme bootstrap, Supabase/session cleanup, or clearly documented non-business exceptions.
- **Cloud sync trigger** — only `SYNC_KEYS` in `app/stores/storageStore.js` trigger sync callbacks.
- **Lodash type checks** — use lodash methods (`isArray`, `isObject`, `isString`, `isNumber`, `isBoolean`, `isNil`, `isEqual`, etc.) for data type checks. Native `typeof === 'undefined'` is allowed for global environment guards.
- **Feature barrels** — import feature hooks through `app/features/*/index.js` from `app/components/AppShell.jsx`.
- **Fund API barrel** — preserve public exports through `app/api/fund.js`; add API implementations under `app/services/fund/`.
- **shadcn/ui conventions** — new-york style, CSS variables, lucide icons, `cn()` from `lib/utils.js`.
- **Linting only** — `npm run lint` is the main automated check; there is no test runner.
- **Pre-commit** — `lint-staged` runs ESLint on JS/JSX and Prettier on JSON/CSS/MD.

## MODAL RULES

All dialogs/drawers/modals follow the central modal architecture.

1. **Modal state belongs in Zustand** — add open flags, payloads, and data to `app/stores/modalStore.js`.
2. **Rendering belongs in ModalsLayer** — add modal rendering in `app/components/ModalsLayer.jsx` (rendered by `AppShell`), not in route pages.
3. **`AppShell` must not subscribe to modal state** — use `useModalStore.getState()` inside handlers and pass data/functions through `modalCbRef`.
4. **Callbacks/data cross the boundary through `callbacksRef`** — add page-level functions/data to `modalCbRef.current`, then consume as `cb.current.xxx` in `ModalsLayer`.
5. **Low-frequency modals may be dynamic** — many modal components are loaded with `dynamic(() => import(...), { ssr: false })`.
   - **Modal files live under `app/components/modals/<category>/`** (`trading`, `group`, `scan`, `tags`, `settings`, `fund-detail`, `common`). `ModalsLayer.jsx` stays at `app/components/ModalsLayer.jsx` (it is the render layer, not a modal). Import a modal as `./modals/<category>/<Name>` from `ModalsLayer`, or `@/app/components/modals/<category>/<Name>` elsewhere.
6. **Close/setter compatibility stays inside ModalsLayer** — close handlers should use `useModalStore.setState` / `getState`, not page `useState`.
7. **Error isolation** — `ModalsLayer` is wrapped in `ClientErrorBoundary`; `modalErrorResetKey` can reset after modal render failures.

Quick add-modal flow:

1. Add state/default shape in `modalStore.js`.
2. Create or update the modal component under `app/components/modals/<category>/`.
3. Render it in `ModalsLayer.jsx` (import from `./modals/<category>/<Name>`).
4. If page-level callbacks/data are needed, register them in `modalCbRef.current` in `app/components/AppShell.jsx`.

## STORAGE RULES

- Business keys are centralized in `app/stores/storageStore.js`.
- `storageStore.setItem()` updates localStorage, updates Zustand state, normalizes special keys such as `pendingTrades`, and triggers `onSync` for `SYNC_KEYS`.
- `storageStore.keys()` exists for controlled key enumeration.
- Do not add direct `window.localStorage` reads/writes in feature hooks or components for business data.
- `tags` is a first-class sync key. Tag writes must preserve payload shape and sync event ordering.
- `fundValuationTimeseries` is managed in `app/lib/valuationTimeseries.js`.
- Theme bootstrap in `app/layout.jsx` intentionally reads `localStorage` early to avoid first-paint theme flicker.
- Supabase auth/session cleanup in `app/components/AppShell.jsx` may touch local/session storage as an auth exception.

## STYLE RULES

- `app/globals.css` is an import barrel:
  - `tailwindcss`
  - `tw-animate-css`
  - `shadcn/tailwind.css`
  - `app/styles/tokens.css`
  - `app/styles/base.css`
  - `app/styles/layout.css`
  - `app/styles/components.css`
- Preserve CSS import order.
- PC breakpoint is `> 640px`; mobile media query is `@media (max-width: 640px)`.
- Global `px` values outside media queries are converted by `postcss-pxtorem`.
- `@media (max-width: 640px)` block `px` values are intentionally not converted.
- `1px` borders remain px because `minPixelValue: 2`.
- Use uppercase `PX` only when a value must bypass pxtorem.
- Preserve glassmorphism variables/effects unless a task explicitly changes them.

## EXTERNAL DATA FLOW

- Fund valuation uses 天天基金 fundgz JSONP, Sina fallback/source selection, and Supabase QDII fallback.
- Historical/net-value data uses Eastmoney APIs and pingzhongdata-derived trend data.
- Holdings use pingzhongdata and Tencent quote scripts.
- Market indices use Tencent quote scripts.
- Related sectors use Supabase tables and Eastmoney sector quotes.
- Fund fuzzy matching loads `public/allFund.json` and Fuse.js lazily.
- OCR import uses Tesseract plus LLM parsing through configured Supabase/edge/API paths.
- Feedback posts to Web3Forms when configured.
- Latest release check uses `NEXT_PUBLIC_GITHUB_LATEST_RELEASE_URL` when configured.

## CURRENT ANTI-PATTERNS / RISKS

- **No test infrastructure** — no unit/integration test runner or test scripts.
- **Legacy ESLint config remains** — `.eslintrc.json` still exists, but `eslint.config.mjs` is active.
- **No Docker files in current worktree** — old Docker-related docs may be stale if referenced elsewhere.
- **Many console statements and empty catches** — error handling/logging is uneven across API, hooks, and components.
- **Some direct storage access remains** — mostly inside `storageStore`, theme bootstrap, and auth/session cleanup; audit before adding more.
- **JSONP/script injection cannot be cancelled** once a script is appended.
- **Static export limits runtime APIs** — do not add Next server routes that the exported app depends on.
- **Large table components** — `PcFundTable.jsx` and `MobileFundTable.jsx` remain very large and behavior-sensitive.
- **Plan-only helpers** — `app/lib/devShadowCompare.js` and `app/lib/storageSnapshot.js` are development/refactor guardrails, not runtime product features.

## COMMANDS

```bash
# Development
npm run dev              # Start dev server
npm run build            # Static export to out/
npm run lint             # ESLint check
npm run lint:fix         # ESLint auto-fix

# Environment
cp env.example .env.local
```

## ENVIRONMENT VARIABLES

From `env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY`
- `NEXT_PUBLIC_GA_ID`
- `NEXT_PUBLIC_GITHUB_LATEST_RELEASE_URL`
- `NEXT_PUBLIC_IS_GITHUB_LOGIN`

## DEPLOYMENT

- GitHub Pages deployment is defined in `.github/workflows/nextjs.yml`.
- Workflow builds on pushes to `main` and manual dispatch.
- Build output is `out/`.
- Node version in workflow is 20.
- `next.config.js` uses static export and unoptimized images.

## UPSTREAM SYNC

- Upstream working copy lives at `download/real-time-fund`.
- Current project was recreated from upstream project files after dropping Git history.
- The recorded upstream baseline commit is:

```text
be176765566d0e6f83b7614b5e0d7328087a633b
feat：发布 2.3.3
2026-06-28 23:27:17 +0800
```

- The 2.3.1 range `ffaf4b0..2e14d9e` was fully ported on 2026-06-24/25 (see `doc/upstream-sync-2e14d9e-checklist.md` and `doc/upstream-sync.md`), including the home group-dropdown tab rendering + tab-overflow scroll buttons and the `.name-cell`/`.tabs-scroll-*` CSS merge into `app/styles/components.css`. The only remaining work is operational (not code): populate the Supabase `fund_best_source` / `fund_related` / `fund_topic` data so auto-source + recommended-tags return results (the RPCs are deployed + reachable).
- The 2.3.3 range `2e14d9e..be17676` was ported on 2026-06-29 (see `doc/upstream-sync-be17676-checklist.md`): QDII data source 4 (explicit source `4` + `isQdiiFund`, tag-gated `storageStore` migration replacing the implicit source-1 Supabase fallback), table pagination, cloud sort-personalization apply fix, auto-source login guard, trading-day NAV-update logic, T+2 daily-profit basis (`navUpdatedAt`/`profitBasisDate`), PC chart tooltip opacity, group-dropdown scroll behavior, and the v2.3.3 release. Table pagination (Task 4) still needs in-browser verification of drag/reorder, cross-page batch select, and iOS Safari input zoom.
- Safari input zoom: inputs used on mobile should have a computed font-size of at least 16px. When using Tailwind arbitrary sizes in CSS that passes through pxtorem, use `text-[16PX]` for small pagination/settings inputs that must not trigger iOS Safari zoom.
- The original baseline `ffaf4b0` was verified by comparing 190 project files from the repo's first commit `be6cfa5` against `download/real-time-fund` (excluding AI/IDE/docs noise): `190/190` matching blobs.
- Future upstream update workflow: compare `download/real-time-fund` latest commit against the recorded baseline commit, analyze the diff, then port relevant changes into the current refactored architecture.
- Do not directly copy upstream files over current files; current project has route-backed tabs, `AppShell`, split fund services, feature hooks, unified `storageStore`, and split CSS.
- After successfully porting upstream changes, update `doc/upstream-sync.md` and this baseline only when the current project has fully absorbed that upstream range.

## DOCUMENTATION

- `README.md` — user-facing overview/setup.
- `CLAUDE.md` — Claude-specific project guidance if present.
- `AGENTS.md` — this file, Codex/agent project knowledge.
- `doc/localStorage 数据结构.md` — local storage schema.
- `doc/supabase.sql` — Supabase schema/RPC setup.
- `doc/edgeFunction/*.ts` — Supabase Edge Function examples.
- `doc/fund_tracking_targets.csv`, `doc/related_sector_secid.csv` — optional sector data imports.
- `doc/adr/0001-preserve-ui-refactor.md` — preserve-UI refactor ADR.
- `doc/refactor-regression-checklist.md` — manual regression checklist.
- `doc/storage-snapshot-scenarios.md` — storage snapshot scenarios.
- `doc/upstream-sync.md` — upstream baseline commit and sync workflow.
- `docs/plans/2026-06-17-preserve-ui-refactor.md` — source refactor plan.
- `docs/plans/2026-06-17-preserve-ui-refactor-execution-steps.md` — execution runbook.

## NOTES

- Fund code format is 6-digit numeric string, e.g. `110022`.
- Important storage keys include `funds`, `tags`, `favorites`, `groups`, `holdings`, `groupHoldings`, `pendingTrades`, `transactions`, `dcaPlans`, `customSettings`, `fundDailyEarnings`, and `fundDividends`.
- `public/sw.js`, `public/manifest.webmanifest`, and `public/Icon-60@3x.png` are used for PWA behavior.
- `public/allFund.json` is used for lazy fuzzy fund search.
- License is AGPL-3.0.
- Current branch has a dirty worktree with many user changes/deletions. Do not revert unrelated changes without explicit instruction.
