# Split Main Tabs Into Pages Final Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the current top-level `home / market / mine` tab experience into three App Router pages while preserving UI, interactions, localStorage shape, and cloud sync payloads.

**Architecture:** State moves before routes. First extract render-only page content and move all former `app/page.jsx` state/effects/handlers into a persistent client `AppShell` mounted from `app/layout.jsx`, while the app still behaves like the current single route. Only after `AppShell` is stable, create real route pages `app/page.jsx`, `app/market/page.jsx`, and `app/mine/page.jsx`. Do not use `(main-tabs)` because `app/page.jsx` and `app/(main-tabs)/page.jsx` both resolve to `/`.

**Tech Stack:** Next.js App Router, React JSX, Zustand stores, TanStack Query, lodash, static export, shadcn/ui, existing CSS and components.

---

## 0. Final Execution Decisions

All review feedback has been incorporated. This file is the final execution source of truth.

| Issue                                          | Decision                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route group can create duplicate `/` page      | Use direct route files only: `app/page.jsx`, `app/market/page.jsx`, `app/mine/page.jsx`.                                                                           |
| Route switching changes mount lifecycle        | Move all former page-level state/effects/handlers into persistent `AppShell` before adding real routes.                                                            |
| Intermediate route split could reset state     | Execute in this order: content extraction -> AppShell extraction -> route cutover.                                                                                 |
| Storage/cloud sync equivalence must be proven  | Reuse `app/lib/storageSnapshot.js` for route lifecycle snapshot + `onSync` event comparison.                                                                       |
| Runtime context can amplify rerenders          | Split and memoize runtime context values before route cutover; profile search typing and route navigation.                                                         |
| Mobile layout classes are coupled to `mainTab` | Recreate old class behavior from route-derived `mainTab` in `AppShell`.                                                                                            |
| Desktop `/mine` is ambiguous                   | Desktop `/mine` should redirect to `/` unless product explicitly chooses a desktop mine page; the redirect must wait until viewport state is confirmed non-mobile. |
| GitHub Pages deep links are new risk           | Decide `trailingSlash` before route cutover; verify static export artifacts and deployed deep links.                                                               |

Treat Sections 1-8 as executable instructions. Section 9 is decision history only and does not add extra work beyond the task steps.

---

## 0.1 Execution Order And Hard Gates

Execute tasks strictly in order. Commit after each task.

Do not create `app/market/page.jsx`, `app/mine/page.jsx`, or any other real main-tab route until Task 3 is complete and verified.

Task 3 is the main migration gate:

- `AppShell` must own all former `app/page.jsx` state, effects, handlers, `NavLayout`, and `ModalsLayer`.
- The app must still behave as the original single-route tab UI.
- `npm run lint`, `npm run build`, and manual checks in Task 3 must pass.
- Route lifecycle storage/sync risk must be understood before route cutover.

Task 4 is the route cutover gate:

- Route pages must stay render-only.
- Navigation must change URL instead of local `mainTab` state.
- Desktop `/mine` redirect must wait for confirmed non-mobile viewport state.
- A bare `!isMobile` redirect is forbidden.

If any stop condition in Section 7 occurs, stop the current task, inspect `git status --short` and `git diff`, and fix within the current task before continuing.

---

## 1. Scope And Non-Goals

### In Scope

- Add real App Router pages:
  - `/` -> home portfolio page
  - `/market` -> market page
  - `/mine` -> mine page
- Keep `NavLayout`, `PcSideNav`, and `MobileBottomNav` visually unchanged.
- Replace local `mainTab` state with URL-derived tab state after `AppShell` is stable.
- Mount `AppShell` once from `app/layout.jsx`.
- Keep `ModalsLayer` global and mounted once inside `AppShell`.
- Keep portfolio group tabs internal to the home page.
- Verify route navigation does not change business storage shape or cloud sync events.

### Out Of Scope

- Do not route-split `全部 / 自选 / 汇总 / 自定义分组`.
- Do not redesign navigation.
- Do not change Chinese UI text.
- Do not introduce TypeScript, a new router library, a new state library, or a test framework.
- Do not rewrite table/card/chart components.
- Do not change API fetching behavior.

---

## 2. Current State

Current top-level navigation is state-based:

- `app/page.jsx` owns `const [mainTab, setMainTab] = useState('home')`.
- `NavLayout` receives `mainTab` and `setMainTab`.
- `PcSideNav` supports `home` and `market`.
- `MobileBottomNav` supports `home`, `market`, and `mine`.
- `MarketTab` is mounted lazily after `hasVisitedMarketTab`.
- `MineTab` is mobile-oriented.
- `ModalsLayer` is rendered at the bottom of `app/page.jsx`.

Current behavior is hidden-by-style, not route-unmounted:

- Home content is guarded by `mainTab === 'home'`.
- Market content is guarded by `mainTab === 'market'`.
- Mine content is guarded by `mainTab === 'mine'`.
- Home and market can remain mounted while hidden.

State that must stay persistent in `AppShell`:

- `mainTab` during the pre-route phase, then route-derived `mainTab` after cutover
- `currentTab` and `setCurrentTab`
- search state and selected chips
- sort/view state
- display derivations such as `displayFunds`, `pcFundTableData`, `holdingsForTabWithLinked`
- all mutation/trading/search/tag handlers
- refresh/sync/auth effects
- `modalCbRef`
- modal callback payloads
- mobile scroll/nav visibility state

The new route page components must not introduce new business state. Existing leaf components such as `MarketTab`, `MineTab`, tables, cards, drawers, and dialogs may keep their current internal UI state.

---

## 3. Target Route Shape

Use direct route files:

```txt
app/
├── layout.jsx
├── page.jsx                     # /
├── market/
│   └── page.jsx                 # /market
├── mine/
│   └── page.jsx                 # /mine
├── components/
│   ├── AppShell.jsx             # persistent client shell
│   └── pages/
│       ├── MainTabsContent.jsx  # temporary, removed after route cutover
│       ├── HomePageContent.jsx
│       ├── MarketPageContent.jsx
│       └── MinePageContent.jsx
└── contexts/
    └── AppRuntimeContext.jsx
```

Expected final routes:

| Route     | Page                  | Existing view          |
| --------- | --------------------- | ---------------------- |
| `/`       | `app/page.jsx`        | `mainTab === 'home'`   |
| `/market` | `app/market/page.jsx` | `mainTab === 'market'` |
| `/mine`   | `app/mine/page.jsx`   | `mainTab === 'mine'`   |

Do not create `app/(main-tabs)/page.jsx` while `app/page.jsx` exists.

---

## 4. Shared Rules

- Every task must run:

```bash
npm run lint
npm run build
```

- Preserve the existing visual layout and CSS class names.
- Preserve `ModalsLayer` as a single global layer.
- Preserve `modalCbRef` callback names until all consumers are migrated.
- Keep all former `app/page.jsx` state/effects/handlers in `AppShell`.
- Keep route page files and `*PageContent` components as render-only consumers of `AppRuntimeContext`.
- Keep all business storage access through `storageStore` / `useStorageStore`.
- Use lodash for data type checks.
- Do not change storage keys or payload shapes.
- Do not create real `/market` or `/mine` route files until `AppShell` owns state.
- Do not move state and switch route lifecycle in the same task.
- Commit each task separately.

Default commit pattern:

```bash
git add <task files>
git commit -m "<task commit message>"
```

---

## 5. Required Verification

### 5.1 Manual UI Baseline

Before Task 1, run:

```bash
npm run lint
npm run build
```

Capture notes/screenshots in `doc/refactor-regression-checklist.md`:

- Desktop `/` home page
- Mobile `/` home page
- Mobile bottom nav home -> market -> mine
- Desktop side nav home -> market
- Search dropdown and add fund confirm modal
- Settings modal
- Trade modal
- Market ranking and add-fund flow
- Mine login/feedback/help entries on mobile

### 5.2 Route Lifecycle Storage Snapshot

Use existing `app/lib/storageSnapshot.js`.

If `window.__storageSnapshot` is not exposed, add a temporary guarded dev-only exposure while executing the migration:

```js
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  window.__storageSnapshot = { createStorageSnapshot, installSyncEventRecorder };
}
```

Remove the exposure before final acceptance unless it is intentionally kept as a clearly guarded development helper.

Baseline sequence before route cutover:

1. Restore/import the same fixed localStorage seed data.
2. Start dev server.
3. Open `/`.
4. Start `installSyncEventRecorder()`.
5. Capture `createStorageSnapshot()` as baseline start.
6. In the current tab UI, navigate home -> market -> home -> mine.
7. Capture `createStorageSnapshot()` and `getEvents()` as baseline end.
8. Save JSON under `/tmp/split-main-tabs-route-snapshots`.

Post-cutover sequence:

1. Restore/import the same fixed localStorage seed data.
2. Start dev server.
3. Open `/`.
4. Start `installSyncEventRecorder()`.
5. Capture `createStorageSnapshot()` as route start.
6. Navigate `/market` -> `/` -> `/mine` with the app navigation.
7. Capture `createStorageSnapshot()` and `getEvents()` as route end.
8. Compare against baseline.

Required result:

- Snapshot shape must match.
- No additional `SYNC_KEYS` events should fire only because of route navigation.
- Any intentional difference must be documented before continuing.

### 5.3 Static Export And GitHub Pages Checks

Before route cutover, decide whether this deployment should enable:

```js
trailingSlash: true;
```

Default decision for GitHub Pages project subpaths: enable `trailingSlash: true` during route cutover unless local build/deploy constraints prove it harmful.

After route cutover, run:

```bash
npm run build
```

Check:

- `out/index.html`
- `out/market/index.html` or the intentionally chosen equivalent artifact
- `out/mine/index.html` or the intentionally chosen equivalent artifact

Before merging/deploying, verify on the GitHub Pages URL, including repository subpath if applicable:

- Direct refresh on `/`
- Direct refresh on `/market`
- Direct refresh on `/mine`
- Browser back/forward across all three routes

---

## 6. Task Execution

### Task 1: Add Runtime Context And Route Constants

**Files:**

- Create: `app/contexts/AppRuntimeContext.jsx`
- Create: `app/lib/mainTabRoutes.js`
- Modify: `doc/storage-snapshot-scenarios.md`
- Modify: `doc/refactor-regression-checklist.md`

**Step 1: Create route constants**

Create `app/lib/mainTabRoutes.js`:

```js
export const MAIN_TAB_IDS = {
  HOME: 'home',
  MARKET: 'market',
  MINE: 'mine'
};

export const MAIN_TAB_ROUTES = {
  [MAIN_TAB_IDS.HOME]: '/',
  [MAIN_TAB_IDS.MARKET]: '/market',
  [MAIN_TAB_IDS.MINE]: '/mine'
};

export function getMainTabFromPathname(pathname) {
  if (pathname && pathname.startsWith('/market')) return MAIN_TAB_IDS.MARKET;
  if (pathname && pathname.startsWith('/mine')) return MAIN_TAB_IDS.MINE;
  return MAIN_TAB_IDS.HOME;
}
```

Do not use these constants in navigation yet.

**Step 2: Create split runtime contexts**

Create `app/contexts/AppRuntimeContext.jsx`:

```jsx
'use client';

import { createContext, useContext } from 'react';

const AppRuntimeStateContext = createContext(null);
const AppRuntimeActionsContext = createContext(null);

export function AppRuntimeProvider({ state, actions, children }) {
  return (
    <AppRuntimeActionsContext.Provider value={actions}>
      <AppRuntimeStateContext.Provider value={state}>{children}</AppRuntimeStateContext.Provider>
    </AppRuntimeActionsContext.Provider>
  );
}

export function useAppRuntimeState() {
  const value = useContext(AppRuntimeStateContext);
  if (!value) {
    throw new Error('useAppRuntimeState must be used within AppRuntimeProvider');
  }
  return value;
}

export function useAppRuntimeActions() {
  const value = useContext(AppRuntimeActionsContext);
  if (!value) {
    throw new Error('useAppRuntimeActions must be used within AppRuntimeProvider');
  }
  return value;
}

export function useAppRuntime() {
  return {
    ...useAppRuntimeState(),
    ...useAppRuntimeActions()
  };
}
```

**Step 3: Document snapshot scenario**

In `doc/storage-snapshot-scenarios.md`, add `main-tab-route-lifecycle`:

- Baseline: home -> market -> home -> mine inside the old tab UI.
- Post-cutover: `/` -> `/market` -> `/` -> `/mine`.
- Expected: same snapshot shape, no extra sync events caused only by navigation.

In `doc/refactor-regression-checklist.md`, add rows for:

- route lifecycle snapshot
- `onSync` event comparison
- GitHub Pages deep-link refresh
- mobile container class check
- runtime context render/profile check

**Step 4: Verify**

Run:

```bash
npm run lint
npm run build
```

**Step 5: Commit**

```bash
git add app/contexts/AppRuntimeContext.jsx app/lib/mainTabRoutes.js doc/storage-snapshot-scenarios.md doc/refactor-regression-checklist.md
git commit -m "chore: prepare main tab route split guards"
```

### Task 2: Extract Page Content While Keeping Single-Route Behavior

**Files:**

- Create: `app/components/pages/MainTabsContent.jsx`
- Create: `app/components/pages/HomePageContent.jsx`
- Create: `app/components/pages/MarketPageContent.jsx`
- Create: `app/components/pages/MinePageContent.jsx`
- Modify: `app/page.jsx`

**Step 1: Create page content components**

Create render-only components that receive props from `app/page.jsx`.

Rules:

- Do not move state into these components.
- Do not add business effects.
- Do not change markup, class names, or Chinese text.
- Preserve existing `display: contents` guards for now.

`MainTabsContent` should render:

- `HomePageContent` when `mainTab === 'home'`
- `MarketPageContent` when `mainTab === 'market'`
- `MinePageContent` when `mainTab === 'mine'`

It should preserve the current hidden-by-style behavior during this task.

**Step 2: Move home JSX**

Move the home JSX block out of `app/page.jsx` into `HomePageContent`.

Do not change:

- fund group tabs
- search markup
- sort markup
- `FundListView` props
- `SummaryTabContent` props
- `GroupSummary` props
- handler names

**Step 3: Move market JSX**

Move the inline `MarketTab` block into `MarketPageContent`.

Keep `hasVisitedMarketTab` behavior for now.

**Step 4: Move mine JSX**

Move the inline `MineTab` invocation into `MinePageContent`.

Keep mobile-only behavior unchanged.

**Step 5: Verify**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Manual checks:

- Single-route app still behaves exactly like baseline.
- Mobile bottom nav home -> market -> mine does not reset page state.
- Search/add fund still works.
- `全部`, `自选`, `汇总`, and custom group tabs still work.
- Market add-fund opens scan confirm modal.
- Mine login/help/feedback entries still work.

**Step 6: Commit**

```bash
git add app/components/pages app/page.jsx
git commit -m "refactor: extract main tab page content"
```

### Task 3: Extract Persistent AppShell Before Adding Routes

**Files:**

- Create: `app/components/AppShell.jsx`
- Modify: `app/layout.jsx`
- Modify: `app/page.jsx`
- Modify: `app/components/pages/MainTabsContent.jsx`
- Modify: `app/components/pages/HomePageContent.jsx`
- Modify: `app/components/pages/MarketPageContent.jsx`
- Modify: `app/components/pages/MinePageContent.jsx`

**Step 1: Move former page shell into `AppShell`**

Move from `app/page.jsx` to `app/components/AppShell.jsx`:

- all `useStorageStore` subscriptions and init effects
- auth/user/sync logic
- refresh logic
- theme/layout logic
- `mainTab` state for the pre-route phase
- `currentTab` and portfolio group tab state
- search state
- sort/view state
- derived data hooks
- mutation/trading/tag/search handlers
- `modalCbRef`
- `NavLayout`
- `ModalsLayer`

Hard rule: if a value was formerly page-level state or a page-level handler, it belongs in `AppShell`, not in `app/page.jsx`, future route pages, or `*PageContent`.

**Step 2: Build stable context values**

Use split contexts from `AppRuntimeContext`.

Create a memoized `runtimeActions` object for stable handlers:

```js
const runtimeActions = useMemo(
  () => ({
    setMainTab,
    handleOpenLogin,
    handleMarketTabAddFund,
    getFundCardPropsForRow,
    showToast
  }),
  [setMainTab, handleOpenLogin, handleMarketTabAddFund, getFundCardPropsForRow, showToast]
);
```

Create a memoized `runtimeState` object for data:

```js
const runtimeState = useMemo(
  () => ({
    mainTab,
    isMobile,
    user,
    userAvatar,
    lastSyncTime,
    currentTab,
    displayFunds,
    pcFundTableData,
    searchTerm,
    selectedFunds,
    sortBy,
    sortOrder,
    sortRules
  }),
  [
    mainTab,
    isMobile,
    user,
    userAvatar,
    lastSyncTime,
    currentTab,
    displayFunds,
    pcFundTableData,
    searchTerm,
    selectedFunds,
    sortBy,
    sortOrder,
    sortRules
  ]
);
```

These snippets are intentionally incomplete. Add every value used by `MainTabsContent`, `HomePageContent`, `MarketPageContent`, `MinePageContent`, and `ModalsLayer`.

Do not pass a fresh giant object literal directly to context providers.

**Step 3: Render persistent shell**

`AppShell` should render:

```jsx
<AppRuntimeProvider state={runtimeState} actions={runtimeActions}>
  <NavLayout
    mainTab={mainTab}
    setMainTab={setMainTab}
    isMobile={isMobile}
    containerRef={containerRef}
    containerClassName={containerClassName}
    containerWidth={containerWidth}
    showThemeTransition={showThemeTransition}
    setShowThemeTransition={setShowThemeTransition}
    mobileBottomNavHidden={mobileBottomNavHidden}
  >
    {children}
    <ModalsLayer callbacksRef={modalCbRef} />
  </NavLayout>
</AppRuntimeProvider>
```

**Step 4: Mount `AppShell` from root layout**

Modify `app/layout.jsx`.

Keep the current provider structure. Insert `AppShell` inside existing global providers, around `{children}`:

```jsx
<QueryClientProviderWrapper>
  <TooltipProvider>
    <ClientErrorBoundary toastTitle="页面渲染异常" toastId="app-render-error" closeModals>
      <AppShell>{children}</AppShell>
    </ClientErrorBoundary>
  </TooltipProvider>
</QueryClientProviderWrapper>
```

**Step 5: Simplify `app/page.jsx`**

After moving shell logic, `app/page.jsx` should render the temporary single-route content:

```jsx
'use client';

import MainTabsContent from './components/pages/MainTabsContent';

export default function HomePage() {
  return <MainTabsContent />;
}
```

`MainTabsContent` and page content components should read from `useAppRuntimeState()` and `useAppRuntimeActions()`.

**Step 6: Preserve mobile container classes**

The old shell used:

- `content`
- `content-with-mobile-tabbar`
- `mine-mobile-root`
- `mobile-main-tab-panel`
- `mobile-main-tab-panel--home`

Recreate the same class behavior from `mainTab` in `AppShell`.

**Step 7: Profile/check context stability**

Use React DevTools Profiler or temporary render counters while typing in search.

Required result:

- Search typing should not remount `MarketTab` or `MineTab`.
- Search typing and route-tab switching should not feel slower than baseline.
- Broad rerenders caused by the temporary single-route `runtimeState` object are acceptable only if there is no visible interaction regression.
- Document any remaining broad rerender before route cutover.

**Step 8: Verify**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Manual checks:

- Single-route app still behaves like baseline.
- Mobile bottom nav state does not reset when switching home/market/mine.
- Modals work from all main tabs.
- Refresh/sync still run.
- Mobile bottom nav spacing and scroll behavior match baseline.

**Step 9: Commit**

```bash
git add app/components/AppShell.jsx app/layout.jsx app/page.jsx app/components/pages
git commit -m "refactor: move main tab runtime into app shell"
```

### Task 4: Cut Over To Real Routes

**Files:**

- Create: `app/hooks/useMainTabRoute.js`
- Create: `app/market/page.jsx`
- Create: `app/mine/page.jsx`
- Modify: `app/components/AppShell.jsx`
- Modify: `app/page.jsx`
- Modify: `app/components/pages/HomePageContent.jsx`
- Modify: `app/components/pages/MarketPageContent.jsx`
- Modify: `app/components/pages/MinePageContent.jsx`
- Optionally modify: `next.config.js`

**Step 1: Add route hook**

Create `app/hooks/useMainTabRoute.js`:

```js
'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MAIN_TAB_ROUTES, getMainTabFromPathname } from '@/app/lib/mainTabRoutes';

export function useMainTabRoute() {
  const pathname = usePathname();
  const router = useRouter();
  const mainTab = getMainTabFromPathname(pathname);

  const setMainTab = useCallback(
    (tabId) => {
      const nextPath = MAIN_TAB_ROUTES[tabId] || MAIN_TAB_ROUTES.home;
      router.push(nextPath);
    },
    [router]
  );

  return { mainTab, setMainTab };
}
```

**Step 2: Replace pre-route `mainTab` state**

In `AppShell`, replace local `mainTab` state with:

```js
const { mainTab, setMainTab } = useMainTabRoute();
```

**Step 3: Make route pages render only their page content**

Modify `app/page.jsx`:

```jsx
'use client';

import HomePageContent from './components/pages/HomePageContent';

export default function HomePage() {
  return <HomePageContent />;
}
```

Create `app/market/page.jsx`:

```jsx
'use client';

import MarketPageContent from '@/app/components/pages/MarketPageContent';

export default function MarketPage() {
  return <MarketPageContent />;
}
```

Create `app/mine/page.jsx`:

```jsx
'use client';

import MinePageContent from '@/app/components/pages/MinePageContent';

export default function MinePage() {
  return <MinePageContent />;
}
```

**Step 4: Remove temporary `MainTabsContent` usage**

`MainTabsContent` should no longer be imported by route pages. Keep the file until Task 6 cleanup or delete it in this task if no references remain.

**Step 5: Desktop `/mine` decision**

Default behavior: desktop `/mine` redirects to `/`.

Implement in `MinePageContent` or `app/mine/page.jsx` with a client-side effect using `useRouter().replace('/')` only after the viewport has been resolved as desktop.

Do not implement this as a bare `if (!isMobile) router.replace('/')`. `useIsMobile` is based on client `matchMedia`, so its initial value can be false or unsettled before the first client effect. A bare `!isMobile` check can incorrectly redirect mobile users who directly open or refresh `/mine`.

Use one of these guarded approaches:

- Preferred: update `useIsMobile` to return `undefined` before the client media query settles, then return `true` or `false`; redirect only when `isMobile === false`.
- Acceptable: keep the current boolean hook, but add a local tri-state viewport resolver in the mine route. Read `window.matchMedia` in a client effect, store `undefined | true | false`, and redirect only when the resolved value is exactly `false`.

Example shape:

```jsx
const router = useRouter();
const [resolvedIsMobile, setResolvedIsMobile] = useState(undefined);

useEffect(() => {
  const media = window.matchMedia('(max-width: 640px)');
  const update = () => setResolvedIsMobile(media.matches);

  update();
  media.addEventListener('change', update);

  return () => {
    media.removeEventListener('change', update);
  };
}, []);

useEffect(() => {
  if (resolvedIsMobile === false) {
    router.replace('/');
  }
}, [resolvedIsMobile, router]);
```

If this example is used, ensure the page imports `useEffect`, `useState`, and `useRouter`. Use the same media query breakpoint as `useIsMobile`.

Document this in `doc/refactor-regression-checklist.md`.

**Step 6: Decide `trailingSlash`**

If deployment target is GitHub Pages project subpath, add to `next.config.js`:

```js
trailingSlash: true;
```

If not adding it, document why in `doc/refactor-regression-checklist.md`.

**Step 7: Verify**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Manual checks:

- `/` renders home.
- `/market` renders market.
- `/mine` renders mine on mobile.
- Mobile direct open/refresh on `/mine` stays on mine and does not briefly jump to `/`.
- Desktop direct open/refresh on `/mine` redirects to `/` only after viewport state is known.
- No hydration warning or visible flicker is caused by the `/mine` redirect guard.
- Main nav active state follows URL.
- Browser back/forward changes active main tab.
- Modals work from all pages.
- Market add-fund opens scan confirm modal.
- Mobile bottom nav spacing and scroll behavior match baseline.

**Step 8: Commit**

```bash
git add app/hooks/useMainTabRoute.js app/components/AppShell.jsx app/page.jsx app/market/page.jsx app/mine/page.jsx app/components/pages next.config.js doc/refactor-regression-checklist.md
git commit -m "refactor: cut main tabs over to routes"
```

### Task 5: Route Lifecycle Snapshot Verification

**Files:**

- Modify: `doc/refactor-regression-checklist.md`
- Optionally modify: `app/components/AppShell.jsx`

**Step 1: Run storage snapshot comparison**

Use the process in Section 5.2.

Compare:

- baseline start/end snapshots
- post-cutover start/end snapshots
- baseline `onSync` events
- post-cutover `onSync` events

**Step 2: Fix unexpected route side effects**

If route navigation creates extra sync events:

- inspect effects in `AppShell`
- check `currentTab` persistence timing
- check init effects that call `storageStore.setItem`
- check refresh/sync setup effects

Do not accept extra sync events without documenting why they are intentional.

**Step 3: Remove temporary snapshot exposure**

Remove `window.__storageSnapshot` exposure unless it is intentionally kept behind a dev-only guard.

**Step 4: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- route lifecycle snapshots match expected shape.
- no extra navigation-only sync events.

**Step 5: Commit**

```bash
git add app/components/AppShell.jsx doc/refactor-regression-checklist.md
git commit -m "test: verify route lifecycle storage behavior"
```

### Task 6: Remove Compatibility And Temporary Files

**Files:**

- Delete or modify: `app/components/pages/MainTabsContent.jsx`
- Modify: `app/components/AppShell.jsx`
- Modify: `app/components/pages/HomePageContent.jsx`
- Modify: `app/components/pages/MarketPageContent.jsx`
- Modify: `app/components/pages/MinePageContent.jsx`

**Step 1: Remove compatibility state**

Remove:

- `hasVisitedMarketTab`
- `mobileHomeTabVisible`
- `style={{ display: mainTab === ... ? 'contents' : 'none' }}`
- page-level `visible` props where route selection already handles rendering
- unused `MainTabsContent`

Keep route-derived `mainTab` only for navigation active state, shell classes, and route-specific shell behavior.

**Step 2: Preserve MarketTab query behavior**

In route mode, `MarketTab` mounts only on `/market`.

Set:

```jsx
<MarketTab isActive />
```

or equivalent. Verify TanStack Query cache/staleTime prevents excessive refetching. Do not reintroduce `hasVisitedMarketTab`.

**Step 3: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- `/` no longer mounts market content.
- `/market` no longer mounts home list content.
- `/mine` no longer mounts home list content.
- Market data does not unexpectedly refetch on every quick back/forward navigation beyond accepted cache behavior.
- No layout jump in mobile bottom nav.

**Step 4: Commit**

```bash
git add app/components/AppShell.jsx app/components/pages
git commit -m "refactor: remove tab visibility compatibility layer"
```

### Task 7: Navigation Semantics And Static Export Checks

**Files:**

- Modify: `app/components/PcSideNav.jsx`
- Modify: `app/components/MobileBottomNav.jsx`
- Modify: `app/components/NavLayout.jsx`
- Modify: `doc/refactor-regression-checklist.md`

**Step 1: Preserve navigation props**

Keep:

```jsx
value;
onChange;
```

Do not require route imports inside nav components unless needed.

**Step 2: Preserve accessibility**

Ensure active buttons still have:

```jsx
aria-current={active ? 'page' : undefined}
```

Do not add visible text or change labels.

**Step 3: Check static export artifacts**

Run:

```bash
npm run build
```

Check the chosen artifact shape:

- `out/index.html`
- `out/market/index.html` if `trailingSlash: true`
- `out/mine/index.html` if `trailingSlash: true`

or document the non-trailing equivalent if that decision was made.

**Step 4: Verify**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- Desktop side nav unchanged.
- Mobile bottom nav unchanged.
- Browser back/forward updates active state.
- Direct refresh works locally for each route.

**Step 5: Commit**

```bash
git add app/components/PcSideNav.jsx app/components/MobileBottomNav.jsx app/components/NavLayout.jsx doc/refactor-regression-checklist.md
git commit -m "refactor: align tab navigation with routes"
```

### Task 8: Final Cleanup And Documentation

**Files:**

- Modify: `app/components/AppShell.jsx`
- Modify: `app/components/pages/HomePageContent.jsx`
- Modify: `app/components/pages/MarketPageContent.jsx`
- Modify: `app/components/pages/MinePageContent.jsx`
- Modify: `doc/refactor-regression-checklist.md`
- Modify: `AGENTS.md`

**Step 1: Remove unused imports and props**

Search:

```bash
rg -n "mainTab ===|hasVisitedMarketTab|mobileHomeTabVisible|MainTabsContent|NavLayout|ModalsLayer|\\(main-tabs\\)" app
```

Remove stale imports, compatibility branches, and any accidental route group references.

**Step 2: Profile final context behavior**

Use React DevTools Profiler or temporary render counters.

Check:

- typing in search
- switching portfolio group tabs
- opening/closing settings modal
- `/` -> `/market` -> `/` navigation

Document any notable rerender behavior in `doc/refactor-regression-checklist.md`.

**Step 3: Update docs**

Update `AGENTS.md` to say:

- App has route-backed main pages `/`, `/market`, `/mine`.
- Portfolio group tabs remain internal home-page state.
- Global shell is `app/components/AppShell.jsx`.
- `AppShell` owns former page-level state/effects/handlers.
- Desktop `/mine` behavior.
- `trailingSlash` decision, if changed.

Update `doc/refactor-regression-checklist.md` with final route regression results.

**Step 4: Final verification**

Run:

```bash
npm run lint
npm run build
```

Manual checks:

- Desktop `/`
- Desktop `/market`
- Desktop direct `/mine`
- Mobile `/`
- Mobile `/market`
- Mobile `/mine`
- Browser refresh on each route
- Browser back/forward between routes
- Settings modal on home
- Trade modal on home
- Market add-fund confirm modal
- Mine login/help/feedback entries
- Cloud sync still triggers on real storage writes
- Navigation alone does not trigger unexpected sync events

**Step 5: Commit**

```bash
git add app/components/AppShell.jsx app/components/pages doc/refactor-regression-checklist.md AGENTS.md
git commit -m "docs: record tab route split regression results"
```

---

## 7. Stop Conditions

Stop immediately if:

- `npm run build` fails because routes conflict or static export cannot resolve the route shape.
- `app/page.jsx` and any `app/(main-tabs)/page.jsx` coexist.
- real `/market` or `/mine` routes are created before `AppShell` owns former page-level state.
- route switching remounts `AppShell`.
- navigation click changes visual styling unexpectedly.
- route refresh loses state that should persist from `storageStore`.
- `ModalsLayer` remounts in a way that breaks modal callbacks.
- market add-fund can no longer open scan confirm modal.
- cloud sync receives navigation-only storage writes.
- mobile `/mine` differs from previous `mainTab === 'mine'` behavior.
- mobile direct open/refresh on `/mine` redirects to `/` before viewport state is confirmed.
- desktop `/mine` redirect is implemented with a bare `!isMobile` check.
- mobile scroll/bottom-nav spacing differs from baseline.
- context changes cause obvious render storms that make search typing or route navigation feel worse.

Recovery:

```bash
git status --short
git diff
```

Fix inside the current task. If the cause is unclear, revert only the current task commit.

---

## 8. Final Acceptance

The split is complete when:

- `/`, `/market`, and `/mine` are real App Router pages.
- `AppShell` was extracted before route cutover.
- main navigation uses route changes instead of local `mainTab` state.
- portfolio group tabs remain internal to the home page.
- `AppShell` is mounted from `app/layout.jsx` and owns former page-level state/effects/handlers.
- route page components are render-only consumers of `AppRuntimeContext`.
- runtime context values are memoized/split enough to avoid obvious render regressions.
- `ModalsLayer` is mounted once in `AppShell`.
- mobile shell/container classes match baseline behavior.
- desktop `/mine` behavior is implemented, documented, and guarded so mobile deep links are not redirected before viewport state is confirmed.
- `npm run lint` passes.
- `npm run build` passes.
- route lifecycle storage snapshots match expected shape.
- no extra navigation-only sync events occur.
- manual route refresh/back/forward checks pass.
- manual home/market/mine behavior checks match baseline.
- GitHub Pages deep links are verified or a follow-up deployment note is recorded.

---

## 9. Decision History

These notes explain why the final plan is shaped this way. They are not additional execution steps.

Round 1 resolved:

- Removed the `(main-tabs)` route group approach to avoid duplicate `/` pages.
- Made direct `app/page.jsx`, `app/market/page.jsx`, and `app/mine/page.jsx` the only route shape.
- Added a hard state ownership contract: all former page-level state/effects/handlers stay in persistent `AppShell`.
- Marked `runtimeValue` examples as intentionally incomplete so executors do not under-provision context.
- Added route lifecycle storage snapshot and `onSync` event verification.
- Added mobile container class preservation as a required check.
- Added GitHub Pages deep-link/static export verification.
- Clarified `MarketTab` remount/query behavior verification.

Round 2 resolved:

- Reordered tasks so `AppShell` owns state before real route files are created.
- Removed the Tasks 1-5 temporary state reset window.
- Split the former giant Task 6 into AppShell extraction, route cutover, route lifecycle snapshot, and cleanup tasks.
- Added split/memoized context guidance and profiling checks.
- Chose default desktop `/mine` behavior: redirect to `/`.
- Moved `trailingSlash` decision before route cutover.

Round 3 resolved:

- Added an explicit guard for desktop `/mine` redirect: do not redirect on a bare `!isMobile` check.
- Required the redirect to wait until viewport state is confirmed non-mobile.
- Added manual checks for mobile direct `/mine` refresh, desktop direct `/mine` refresh, and hydration/flicker behavior.
- Added stop and acceptance criteria for the `/mine` redirect guard.

Round 4 confirmed:

- The `/mine` redirect guard uses the same `(max-width: 640px)` breakpoint as `useIsMobile`.
- The final plan has no remaining review blockers.

Final decision: execute this plan as written. The highest-risk task is Task 3 (`AppShell` extraction). Do not begin Task 4 route cutover until Task 3 passes verification.
