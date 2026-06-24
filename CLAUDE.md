# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

基估宝 (real-time-fund) — a static-export Next.js mutual-fund valuation & holdings tracker. Chinese UI, glassmorphism design, mobile + desktop. All user data lives in `localStorage`; financial data comes from public Chinese APIs via JSONP; Supabase is an optional cloud-sync backend.

## Commands

```bash
# First-time setup in a fresh checkout (node_modules missing):
npm install --legacy-peer-deps            # peer-dep conflicts require this flag
npm install typescript --no-save --legacy-peer-deps   # eslint-config-next v16 needs the `typescript` peer even though the project is JS-only

npm run dev      # dev server on :3000 (Turbopack)
npm run build    # static export to out/ (output: 'export')
npm run lint     # eslint . — baseline is ~36 warnings, 0 errors. Treat new ERRORS as blocking; warnings are mostly pre-existing react-hooks/exhaustive-deps
npm run lint:fix # eslint --fix (also runs prettier on staged files via husky pre-commit)
```

There is **no test framework** — zero test files, no `test` script. Behavior is verified by `npm run build` + manual/browser checks. When making behavior-preserving changes, a strong headless check is to build before/after and diff the emitted assets (e.g. `out/_next/static/chunks/*.css` is content-hashed, so identical output ⇒ identical rendering).

`next.config.js` warns about multiple lockfiles (a stray `/Users/.../yarn.lock`) — harmless.

## Architecture (the big picture)

**Single client-rendered SPA.** `app/page.jsx` (`HomePage`) is the orchestration shell — it composes feature hooks and renders the layout, but the heavy logic lives elsewhere. There is no server runtime (`output: 'export'`); everything runs in the browser.

**Data flow:** external JSONP/script-injection → TanStack Query cache → feature hooks → `storageStore` (Zustand state + `localStorage`) → optional Supabase sync.

### State management (Zustand, `app/stores/`)

- **`storageStore`** is the single source of truth for ALL business data. **Every business `localStorage` read/write MUST go through it** (`useStorageStore` in React, `storageStore.{getItem,setItem,removeItem,keys}` elsewhere). It auto-JSON-parses/stringifies, dedups writes via `isEqual`, mirrors keys into Zustand state, and — crucially — fires `onSync(key, prev, next)` for any key in `SYNC_KEYS`, which is what triggers Supabase cloud sync. Changing how/when a `SYNC_KEYS` key is written changes the cloud-sync payload. Documented exceptions that stay on raw `localStorage`/`sessionStorage`: Supabase auth-session cleanup (`sb-*-auth-token`) and the inline pre-hydration theme bootstrap in `app/layout.jsx`.
- **`modalStore`** holds all modal open/state. **`page.jsx` must NOT subscribe to modal state** (would re-render the whole page on every modal toggle). Modals render in `app/components/ModalsLayer.jsx`, which subscribes to `modalStore`; page-level callbacks/data reach modals through a `modalCbRef` (`useRef`) so ref updates don't re-render. Read modal state in handlers via `useModalStore.getState()`.
- `settingsStore` (derived from `customSettings`), `userStore` (auth user snapshot; Supabase owns the session).

### Feature hooks (`app/features/`)

`page.jsx` was refactored from a ~5200-line god component into focused hooks, imported via barrels (`app/features/{portfolio,tags,trading,search}/index.js`):

- `portfolio/` — `usePortfolioScope` (+`usePortfolioScopeCleanup`), `useFundDisplayList` (filter/sort, 13 sort modes), `useFundTableRows` (PC/mobile row view-models), `useFundMutations` (add/remove/move funds with cascading cleanup across holdings/transactions/pendingTrades/dcaPlans/fundDailyEarnings).
- `tags/useFundTags`, `trading/{useTradingActions,useDcaScheduler}`, `search/useFundSearchBox`.

**Two hook categories with different rules:** _derived-data_ hooks are pure (data in via args, values out, no setters); _mutation_ hooks may read/write via `useStorageStore.getState()` / `useModalStore.getState()` to avoid giant setter param lists. **Hook call order matters** — several hooks depend on each other's outputs (e.g. `activeGroupId` must exist before `useHoldingProfit`/`useSummaryCalculations`, so it stays inline in `page.jsx` and is passed _into_ `usePortfolioScope`). See `doc/page-refactor-dependency-map.md`.

### External data (`app/services/fund/`)

`app/api/fund.js` is now an 8-line **re-export barrel**; the real code is split into `services/fund/{shared,sectorsApi,netValueApi,valuationApi,holdingsApi,searchApi,marketApi,miscApi}.js` (acyclic: net-value/holdings → miscApi for `fetchFundPingzhongdata`; valuation → searchApi; all → shared). Import paths are unchanged (`from '@/app/api/fund'`). **All external calls use JSONP / `<script>` injection** (天天基金, 东方财富, 腾讯财经) to bypass CORS in the static-export build — not `fetch()`. `sectorsApi` keeps module-level mutable state (inflight Maps + debounce timers) for batch/dedup loaders — those must stay co-located in one module.

### Rendering

Dual responsive layouts switch at 640px: `PcFundTable` vs `MobileFundTable` (and card view via `FundCard`). CSS: `app/globals.css` `@import`s Tailwind v4 then `app/styles/{tokens,base,layout,components}.css` partials. Units: PC uses `px` (converted to `rem` by `postcss-pxtorem`, rootValue 16); inside `@media (max-width:640px)` blocks `px` is left untouched; use uppercase `PX` to opt a value out of conversion.

## Conventions (enforced)

- **Type checks via lodash** (`isArray`, `isNumber`, `isString`, `isPlainObject`, `isNil`, `isEqual`, …) — not native `typeof`/`Array.isArray`. The only native exception is `typeof x === 'undefined'` for global-env guards (`window`, `document`, `process`, `Intl`).
- **JavaScript/JSX only** — no TypeScript in app code. Path alias `@/* → ./*`.
- **React Compiler is ON** (`reactCompiler: true`). When extracting a `useMemo`/`useCallback` into a clean hook, the compiler enforces `react-hooks/preserve-manual-memoization` as an **error** if the dep array omits a value the body reads. Fix per case: add the value to deps if it's referentially stable (e.g. a passed-in setter); add `// eslint-disable-next-line react-hooks/preserve-manual-memoization` if the omission is intentional to preserve recompute timing. Never add a value whose identity changes every render (e.g. an unmemoized `showToast`) — it destabilizes the callback and can change downstream effect behavior.
- **Adding a modal:** add state to `modalStore` → render in `ModalsLayer` (lazy-load low-frequency modals with `dynamic(..., {ssr:false})`) → expose any page-level callback through `modalCbRef.current` → never put modal `useState` in `page.jsx`. See the "Modal 写法规范" in `AGENTS.md`.
- **OCR/LLM fund-text parsing** (`parseFundTextWithLLM`) and QDII valuation go through Supabase Edge Functions (`analyze-fund`, etc.), not a directly-embedded LLM key. Supabase config is via `NEXT_PUBLIC_*` env (see `env.example`); when unset, those features no-op (`isSupabaseConfigured` guards).

## Deeper reference

`AGENTS.md` (root) is a detailed generated knowledge base — file-by-file "where to look" tables, full conventions, anti-patterns, the localStorage schema (`doc/localStorage 数据结构.md`), and Supabase SQL. There are also scoped `AGENTS.md` files in `app/api/`, `app/lib/`, `app/components/`, `app/components/FundCard/`, and `components/ui/`. Read the relevant one before deep work in that directory.
