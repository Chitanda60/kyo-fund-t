# Preserve UI Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the project internals while preserving the current page display, interactions, storage behavior, and static-export deployment model.

**Architecture:** Keep `app/page.jsx` as the top-level orchestration component, but move portfolio derivation, display-row building, fund tags, trading actions, removal actions, and external fund APIs into focused hooks/services. Preserve existing component props and DOM/class output during the first pass so UI behavior can be regression-checked at each step. Before high-risk extraction, add a dependency map and dev-only shadow comparisons for pure derived data.

**Tech Stack:** Next.js 16 App Router, React 18, JavaScript/JSX only, Zustand, lodash type checks, TanStack Query where already present, static export, JSONP/script-injection financial APIs, `storageStore` for business localStorage.

---

## Refactor Rules

- Do not change user-facing text, class names, DOM hierarchy, animation props, modal open/close flows, sort order semantics, default values, or visual CSS.
- Do not introduce TypeScript, a new state library, a new test framework, or a new UI framework during this refactor.
- All business `localStorage` access must go through `storageStore` or `useStorageStore`.
- Keep modal state in `app/stores/modalStore.js`; render all modals in `app/components/ModalsLayer.jsx`.
- Use lodash methods for data type checks. Native `typeof === 'undefined'` is allowed only for global environment guards.
- Prefer pure functions for calculations and hooks for React state/effects.
- Preserve existing `useMemo`, `useCallback`, and `useEffect` dependency arrays when moving logic. `reactCompiler: true` does not justify deleting memoization or changing dependency timing.
- Split extracted hooks into two categories:
  - Derived-data hooks must stay pure: accept values as arguments and return calculated values.
  - Mutation/effect hooks may read/write through `useStorageStore.getState()`, `storageStore`, and `useModalStore.getState()` to avoid giant setter parameter lists; pass only contextual callbacks, refs, and local React setters that are not globally available.
- For high-risk pure calculations, add dev-only shadow comparisons or characterization snapshots before deleting the old implementation. Do not ship user-visible changes to support verification.
- Each task should end with `npm run lint` and, when the touched area affects build-time imports or Next runtime, `npm run build`.
- Commit after each task so regressions can be isolated.

## Baseline Verification Checklist

Before touching code, manually capture these behaviors in the current app:

- Home page renders existing fund list in list mode and card mode.
- Search by fund code/name opens dropdown and selected chip flow still works.
- Tabs switch between `全部`, `自选`, `汇总`, and custom groups.
- Sort buttons/selects produce the same order for at least `default`, `yield`, `holdingAmount`, `holding`, `name`, and `tags`.
- PC list actions open the same detail/action/holding/data-source dialogs.
- Mobile list drawer still opens/closes and bottom nav behavior is unchanged.
- Add group, add funds to group, delete from group, and global delete confirmation paths work.
- Buy/sell with known price updates holdings and transactions.
- Buy/sell without price enters `pendingTrades`.
- DCA generation still creates pending trades on trading days.
- Settings export/import, login modal, cloud sync entry points, feedback, donate, tutorial, update log still open from the same UI controls.

---

## Review Resolution

The external review is mostly accepted.

- Accepted: Add an automated safety layer for pure calculations. This plan uses dev-only shadow comparisons instead of adding a new test framework, because the repo currently has no test setup and the refactor goal is low-churn behavior preservation.
- Accepted: Add a dependency-map task before extracting hooks. This prevents circular ordering mistakes such as deriving `activeGroupId` after hooks that already need it.
- Accepted: Expand the storage-access task. It must audit every `rg "localStorage|sessionStorage"` result and add a `storageStore.keys()` helper.
- Accepted: Reduce giant mutation-hook parameter lists by allowing mutation hooks to use store `getState()` directly.
- Accepted: Add React Compiler dependency-array guidance.
- Accepted: Add explicit CSS `postcss-pxtorem` and cascade-order constraints.
- Accepted after round 2: Add a storage snapshot diff guard for mutation/storage tasks so persistent data shape and cloud-sync payloads are checked, not only visible derived output.
- Accepted after round 2: Make shadow-compare coverage explicit. No mismatch only counts after the listed tabs, scopes, sorts, and views have actually been exercised.
- Accepted after round 2: Strengthen Task 6 by separating portfolio-scope cleanup writes from pure derivation and shadow-comparing its derived outputs before deleting legacy logic.
- Accepted after round 3: Fix Task 6 shadow comparison to compare matching non-function projections, and document that shadow compare factories must return the same comparable shape.
- Not accepted: Introducing a new test framework as part of this refactor. That can be a separate project after the preserve-UI refactor lands.

---

### Task 1: Document Architecture Decision And Guardrails

**Files:**
- Create: `doc/adr/0001-preserve-ui-refactor.md`
- Read: `AGENTS.md`
- Read: `doc/localStorage 数据结构.md`

**Step 1: Create ADR directory**

Run:

```bash
mkdir -p doc/adr
```

Expected: directory exists.

**Step 2: Add ADR**

Create `doc/adr/0001-preserve-ui-refactor.md`:

```markdown
# ADR 0001: Preserve-UI Refactor Strategy

## Status

Accepted

## Context

The app is a static-export Next.js mutual fund tracker. Most user-visible orchestration still lives in `app/page.jsx`, with business data persisted through localStorage and optional Supabase sync. The project already has partial boundaries: Zustand stores, modal rendering in `ModalsLayer`, and several hooks.

The primary refactor risk is accidentally changing UI output, interaction timing, storage synchronization, or cloud sync behavior.

## Decision

Refactor incrementally while preserving the current UI contract:

- Keep existing page layout, DOM, class names, user-facing Chinese text, and component props stable during the first pass.
- Move calculation and business logic out of `page.jsx` into feature hooks and pure functions.
- Keep business localStorage access behind `storageStore`.
- Keep modal state in `modalStore` and modal rendering in `ModalsLayer`.
- Split `app/api/fund.js` into service modules only after page-level logic has stable regression checks.

## Consequences

This approach is slower than a rewrite, but each step is small, reviewable, and reversible. It also avoids changing visual behavior while the internals become easier to test and maintain.
```

**Step 3: Verify docs**

Run:

```bash
npm run lint
```

Expected: PASS or only pre-existing lint issues unrelated to the new ADR.

**Step 4: Commit**

```bash
git add doc/adr/0001-preserve-ui-refactor.md
git commit -m "docs: record preserve-ui refactor strategy"
```

---

### Task 2: Add Refactor Regression Notes

**Files:**
- Create: `doc/refactor-regression-checklist.md`

**Step 1: Add manual regression checklist**

Create `doc/refactor-regression-checklist.md` with the baseline checklist from this plan, plus a short section for screenshots:

```markdown
# Refactor Regression Checklist

Use this checklist after each refactor task that touches `app/page.jsx`, stores, hooks, or fund API services.

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
- Sort behavior is unchanged for default, yield, holding amount, total holding profit, name, and tags.
- PC and mobile row actions open the same dialogs.
- Add group, add funds to group, delete from group, and global delete confirmation paths work.
- Buy/sell with known price updates holdings and transactions.
- Buy/sell without price enters pending trades.
- DCA generation still creates pending trades on trading days.
- Settings export/import, auth, sync, feedback, donate, tutorial, and update log entry points still open.

## Storage Checks

- No new direct business `localStorage` reads/writes.
- `funds`, `groups`, `favorites`, `holdings`, `groupHoldings`, `pendingTrades`, `transactions`, `dcaPlans`, `customSettings`, `fundDailyEarnings`, and `tags` still sync through `storageStore`.
```

**Step 2: Verify**

Run:

```bash
npm run lint
```

Expected: PASS or only pre-existing issues.

**Step 3: Commit**

```bash
git add doc/refactor-regression-checklist.md
git commit -m "docs: add refactor regression checklist"
```

---

### Task 3: Map Page State And Hook Dependencies

**Files:**
- Create: `doc/page-refactor-dependency-map.md`
- Read: `app/page.jsx`
- Read: `app/hooks/useSummaryCalculations.js`
- Read: `app/hooks/useRefreshManager.js`
- Read: `app/hooks/useSyncManager.js`
- Read: `app/hooks/useScanImport.js`

**Step 1: Map state and derived data**

Create `doc/page-refactor-dependency-map.md` with these sections:

```markdown
# Page Refactor Dependency Map

## Store Subscriptions

- `useStorageStore`: funds, groups, favorites, collapsed state, refreshMs, holdings, groupHoldings, pendingTrades, transactions, dcaPlans, customSettings, fundDailyEarnings, valuationSeries, sort settings.
- `useSettingsStore`: layout/settings values derived from customSettings.
- `useUserStore`: auth user.

## Local UI State

- currentTab
- mainTab / hasVisitedMarketTab
- search state
- group search state
- viewMode
- maskAmounts
- percentModes / todayPercentModes
- fundTagRecords
- fundExtraDataByCode
- importMsg

## Derived Data Order

1. `todayStr`
2. `isMobile`
3. settings derived from `customSettings`
4. `activeGroupId`
5. `getHoldingProfit`
6. `useSummaryCalculations`
7. portfolio scope data
8. fund tag derived data
9. fund extra data fetch for scoped funds
10. display list filtering/sorting
11. table/card row view model
12. callbacks and modal callback ref

## Effect Dependencies To Preserve

- Sort fallback effect depends on `sortRules`, `sortBy`.
- Dynamic style effect depends on `isMobile`, `dynamicStyleMobile`, `dynamicStylePc`.
- Fund extra data fetch depends on `scopedFunds`.
- Init effect depends on storage init functions and `refreshAll`.
- Auth/session effect runs once and must not subscribe to modal state.
- Modal callback ref must remain after all callbacks/data are defined.

## Extraction Constraints

- Derived-data hooks must not call setters except for existing cleanup effects already present in the moved block.
- Mutation hooks may use store `getState()` to avoid passing every setter, but must preserve storageStore writes that trigger sync.
- Search hook must be called after scan-import setters exist.
- Fund-tags hook must be called after `storageHelper` exists, unless storage access is passed in as a stable dependency.
```

Add any additional dependencies discovered while reading the file.

**Step 2: Verify**

Run:

```bash
npm run lint
```

Expected: PASS or only pre-existing issues.

**Step 3: Commit**

```bash
git add doc/page-refactor-dependency-map.md
git commit -m "docs: map page refactor dependencies"
```

---

### Task 4: Add Dev-Only Shadow Compare Helper

**Files:**
- Create: `app/lib/devShadowCompare.js`

**Step 1: Create helper**

Create `app/lib/devShadowCompare.js`:

```javascript
import { isEqual, isFunction, isString } from 'lodash';

const shouldCompare = () => {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') return false;
  if (typeof window === 'undefined') return false;
  return true;
};

export function devShadowCompare(label, legacyValueFactory, nextValueFactory) {
  if (!shouldCompare()) {
    return isFunction(nextValueFactory) ? nextValueFactory() : nextValueFactory;
  }

  const nextValue = isFunction(nextValueFactory) ? nextValueFactory() : nextValueFactory;

  try {
    const legacyValue = isFunction(legacyValueFactory) ? legacyValueFactory() : legacyValueFactory;
    if (!isEqual(legacyValue, nextValue)) {
      console.error('[shadow-compare mismatch]', isString(label) ? label : 'unknown', {
        legacyValue,
        nextValue
      });
    }
  } catch (error) {
    console.error('[shadow-compare error]', isString(label) ? label : 'unknown', error);
  }

  return nextValue;
}
```

Implementation notes:

- `legacyValueFactory` and `nextValueFactory` must return the same comparable shape: same keys, same value types.
- Do not include functions in shadow values. Function identity is not a meaningful behavior comparison and will create false mismatches.
- If the runtime value has extra fields or callback functions, compare a projection and continue using the full runtime value separately.

**Step 2: Verify**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

**Step 3: Commit**

```bash
git add app/lib/devShadowCompare.js
git commit -m "chore: add dev shadow compare helper"
```

---

### Task 5: Add Storage Snapshot Diff Harness

**Files:**
- Create: `app/lib/storageSnapshot.js`
- Create: `doc/storage-snapshot-scenarios.md`

**Purpose:**

This task adds a lightweight, framework-free guard for write-heavy refactors. It protects persistent data shape and cloud-sync payloads for Task 9, Task 10, Task 11, Task 12, Task 14, and any portfolio cleanup writes moved in Task 6.

**Step 1: Create snapshot helper**

Create `app/lib/storageSnapshot.js`:

```javascript
import { isArray, isFunction, isPlainObject } from 'lodash';
import { storageStore, useStorageStore } from '../stores';

export const STORAGE_SNAPSHOT_KEYS = [
  'funds',
  'tags',
  'favorites',
  'groups',
  'collapsedCodes',
  'collapsedTrends',
  'collapsedValuationTrends',
  'collapsedEarnings',
  'refreshMs',
  'holdings',
  'groupHoldings',
  'pendingTrades',
  'transactions',
  'dcaPlans',
  'customSettings',
  'fundDailyEarnings',
  'fundDividends'
];

const normalizeForSnapshot = (value) => {
  if (value instanceof Set) return Array.from(value).sort();
  if (isArray(value)) return value;
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        out[key] = normalizeForSnapshot(value[key]);
        return out;
      }, {});
  }
  return value;
};

export function createStorageSnapshot(label = '') {
  const data = {};
  for (const key of STORAGE_SNAPSHOT_KEYS) {
    data[key] = normalizeForSnapshot(storageStore.getItem(key, null));
  }
  return {
    label,
    data
  };
}

export function installSyncEventRecorder({ forward = true } = {}) {
  const store = useStorageStore.getState();
  const previousOnSync = store.onSync;
  const events = [];

  store.setOnSync((key, prevValue, nextValue) => {
    events.push({
      key,
      prevValue,
      nextValue
    });
    if (forward && isFunction(previousOnSync)) {
      previousOnSync(key, prevValue, nextValue);
    }
  });

  return {
    getEvents: () => events.slice(),
    clear: () => {
      events.length = 0;
    },
    restore: () => {
      store.setOnSync(previousOnSync);
    }
  };
}
```

Implementation notes:

- This helper is for manual/dev verification. Do not wire it into production UI.
- It intentionally uses existing `storageStore` reads so it verifies the same serialized business data cloud sync sees.
- During snapshot verification, expose the helper to the browser console through a temporary dev-only path such as `window.__storageSnapshot = { createStorageSnapshot, installSyncEventRecorder }`. Remove that temporary exposure before committing production refactor code unless it is clearly guarded and intentionally kept for development.
- If importing `storageStore` from `../stores` creates a cycle, move this helper to a dev-only script under `scripts/` and load it from the browser console instead.

**Step 2: Document write scenarios**

Create `doc/storage-snapshot-scenarios.md`:

```markdown
# Storage Snapshot Scenarios

Run these scenarios before and after write-heavy refactor tasks. Restore/import the same fixed localStorage seed data before each run. Save baseline `createStorageSnapshot()` output and `installSyncEventRecorder().getEvents()` JSON to scratch files under `/tmp` or another ignored temporary location, then compare refactor output against those files.

## Required Scenarios

1. Buy with resolved price
   - Expected keys to inspect: `holdings` or `groupHoldings`, `transactions`.
   - Expected sync keys: holding key and `transactions`.

2. Buy without price
   - Expected keys to inspect: `pendingTrades`, holding initialization.
   - Expected sync keys: `pendingTrades`, holding key if initialized.

3. Clear holding
   - Expected keys to inspect: holding key, `transactions`, `pendingTrades`, `dcaPlans`, `fundDailyEarnings`.

4. Delete one fund from a custom group
   - Expected keys to inspect: `groups`, `groupHoldings`, `transactions`, `pendingTrades`, `dcaPlans`, `fundDailyEarnings`.

5. Delete one global fund
   - Expected keys to inspect: `funds`, `groups`, `favorites`, collapsed keys, holdings, transactions, daily earnings, dividends.

6. Move funds between groups
   - Expected keys to inspect: `groups`, `holdings`, `groupHoldings`, `transactions`, `pendingTrades`, `dcaPlans`, `fundDailyEarnings`.

7. Announcement close / non-business storage routing
   - Expected keys to inspect: announcement keys only; no SYNC_KEYS event should fire.

8. Edit / add / delete fund tags
   - Expected keys to inspect: `tags`.
   - Expected sync keys: `tags`.

## Pass Criteria

- Snapshot JSON shape is equal before and after the refactor for the same operation and seed data.
- Sync event key order and count are equal unless the task intentionally batches writes. Any intentional change must be documented in the task commit.
- No extra SYNC_KEYS event fires for theme, announcement, auth session cleanup, or other non-business storage.
```

**Step 3: Verify**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

**Step 4: Commit**

```bash
git add app/lib/storageSnapshot.js doc/storage-snapshot-scenarios.md
git commit -m "chore: add storage snapshot diff harness"
```

---

### Task 6: Extract Portfolio Scope Derivation

**Files:**
- Create: `app/features/portfolio/usePortfolioScope.js`
- Create: `app/features/portfolio/usePortfolioScopeCleanup.js`
- Modify: `app/page.jsx`

**Current source area:**
- `app/page.jsx`: logic around `activeGroupId`, `linkedHoldingsForAllFav`, the cleanup effect that removes linked global daily earnings, `currentFundDailyEarnings`, `portfolioDailySeries`, `holdingsForTabWithLinked`, `dcaPlansForTab`, `transactionsForTab`, `groupById`, `getScopedGroupId`, `getScopedHolding`, `getScopedDcaPlan`, and `activeGroupCodeSet`.

**Step 1: Create feature directory**

Run:

```bash
mkdir -p app/features/portfolio
```

Expected: directory exists.

**Step 2: Create pure scope hook**

Create `app/features/portfolio/usePortfolioScope.js`.

Implementation notes:

- Import `useMemo`, `useCallback`.
- Import lodash methods used by moved logic.
- Import `dayjs`, `TZ`, `migrateDcaPlansToScoped`, `DAILY_EARNINGS_SCOPE_ALL`, `DCA_SCOPE_GLOBAL`, `SUMMARY_TAB_ID`, `SUMMARY_SOURCE_GLOBAL`.
- Accept all data as arguments. Do not subscribe to stores inside this hook.
- Do not call setters in this hook.
- Return the same variables currently used by `page.jsx`.

Target signature:

```javascript
export function usePortfolioScope({
  currentTab,
  groups,
  funds,
  favorites,
  holdings,
  groupHoldings,
  dcaPlans,
  transactions,
  fundDailyEarnings,
  summaryMergedHoldings,
  summaryHoldingSourceGroupByCode,
  groupsWithHoldings,
  getHoldingProfit,
  todayStr
}) {
  // pure moved logic only
  return {
    activeGroupId,
    linkedHoldingsForAllFav,
    currentFundDailyEarnings,
    portfolioDailySeries,
    holdingsForTabWithLinked,
    dcaPlansForTab,
    transactionsForTab,
    groupById,
    getScopedGroupId,
    getScopedHolding,
    getScopedDcaPlan,
    activeGroupCodeSet
  };
}
```

**Step 3: Create cleanup effect hook**

Create `app/features/portfolio/usePortfolioScopeCleanup.js`:

```javascript
import { useEffect } from 'react';
import { isPlainObject } from 'lodash';
import { DAILY_EARNINGS_SCOPE_ALL } from '@/app/constants';

export function usePortfolioScopeCleanup({ linkedHoldingsForAllFav, setFundDailyEarnings }) {
  useEffect(() => {
    const linkedCodes = linkedHoldingsForAllFav?.linked;
    if (!(linkedCodes instanceof Set) || linkedCodes.size === 0) return;
    setFundDailyEarnings((prev) => {
      if (!isPlainObject(prev)) return prev;
      const globalBucket = prev[DAILY_EARNINGS_SCOPE_ALL];
      if (!isPlainObject(globalBucket)) return prev;
      const nextGlobalBucket = { ...globalBucket };
      let changed = false;
      for (const code of linkedCodes) {
        if (code in nextGlobalBucket) {
          delete nextGlobalBucket[code];
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, [DAILY_EARNINGS_SCOPE_ALL]: nextGlobalBucket };
    });
  }, [linkedHoldingsForAllFav, setFundDailyEarnings]);
}
```

This hook owns the write side effect. It must be verified with the storage snapshot scenarios if it changes `fundDailyEarnings`.

**Step 4: Replace logic in `page.jsx` with shadow comparison**

In `app/page.jsx`:

- Add import:

```javascript
import { usePortfolioScope } from './features/portfolio/usePortfolioScope';
import { usePortfolioScopeCleanup } from './features/portfolio/usePortfolioScopeCleanup';
import { devShadowCompare } from './lib/devShadowCompare';
```

- First pass: keep the legacy portfolio scope derivation next to the hook and compare pure outputs:

```javascript
const legacyPortfolioScope = useMemo(() => {
  // original pure portfolio scope calculation, copied exactly
  return {
    activeGroupId: legacyActiveGroupId,
    linkedHoldingsForAllFav: legacyLinkedHoldingsForAllFav,
    currentFundDailyEarnings: legacyCurrentFundDailyEarnings,
    portfolioDailySeries: legacyPortfolioDailySeries,
    holdingsForTabWithLinked: legacyHoldingsForTabWithLinked,
    dcaPlansForTab: legacyDcaPlansForTab,
    transactionsForTab: legacyTransactionsForTab,
    activeGroupCodeSet: legacyActiveGroupCodeSet
  };
}, [
  // original dependency list, copied exactly
]);
```

- Use the new hook:

```javascript
const nextPortfolioScope = usePortfolioScope({
  currentTab,
  groups,
  funds,
  favorites,
  holdings,
  groupHoldings,
  dcaPlans,
  transactions,
  fundDailyEarnings,
  summaryMergedHoldings,
  summaryHoldingSourceGroupByCode,
  groupsWithHoldings,
  getHoldingProfit,
  todayStr
});

devShadowCompare('usePortfolioScope', () => legacyPortfolioScope, () => ({
  activeGroupId: nextPortfolioScope.activeGroupId,
  linkedHoldingsForAllFav: nextPortfolioScope.linkedHoldingsForAllFav,
  currentFundDailyEarnings: nextPortfolioScope.currentFundDailyEarnings,
  portfolioDailySeries: nextPortfolioScope.portfolioDailySeries,
  holdingsForTabWithLinked: nextPortfolioScope.holdingsForTabWithLinked,
  dcaPlansForTab: nextPortfolioScope.dcaPlansForTab,
  transactionsForTab: nextPortfolioScope.transactionsForTab,
  activeGroupCodeSet: nextPortfolioScope.activeGroupCodeSet
}));

const {
  activeGroupId,
  linkedHoldingsForAllFav,
  currentFundDailyEarnings,
  portfolioDailySeries,
  holdingsForTabWithLinked,
  dcaPlansForTab,
  transactionsForTab,
  groupById,
  getScopedGroupId,
  getScopedHolding,
  getScopedDcaPlan,
  activeGroupCodeSet
} = nextPortfolioScope;

usePortfolioScopeCleanup({ linkedHoldingsForAllFav, setFundDailyEarnings });
```

Important: remove the legacy calculation and `devShadowCompare` import only after manual checks and storage snapshot checks pass.

**Step 5: Verify no UI or storage contract changed**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Expected: lint/build pass and the browser console has no `[shadow-compare mismatch]` for `usePortfolioScope`.

Manual check:

- App renders all tabs and summaries as before.
- Summary tab, all tab, favorite tab, and at least one custom group are opened while shadow comparison is active.
- If linked holdings cleanup runs, compare `fundDailyEarnings` with the storage snapshot workflow.

**Step 6: Remove legacy shadow block**

After checks pass, remove the legacy calculation and `devShadowCompare` import from `page.jsx`.

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

**Step 7: Commit**

```bash
git add app/features/portfolio/usePortfolioScope.js app/features/portfolio/usePortfolioScopeCleanup.js app/page.jsx
git commit -m "refactor: extract portfolio scope derivation"
```

---

### Task 7: Extract Fund Display Filtering And Sorting

**Files:**
- Create: `app/features/portfolio/useFundDisplayList.js`
- Modify: `app/page.jsx`

**Current source area:**
- `app/page.jsx`: `scopedFunds`, `fundExtraDataByCode` fetch effect may remain for now, and `displayFundsRaw` / `displayFunds`.

**Step 1: Create hook**

Create `app/features/portfolio/useFundDisplayList.js`.

Target signature:

```javascript
export function useFundDisplayList({
  funds,
  currentTab,
  favorites,
  activeGroupCodeSet,
  activeGroupId,
  groups,
  sortBy,
  sortOrder,
  holdingsForTabWithLinked,
  getHoldingProfitForTab,
  deferredGroupFundSearchTerm,
  shouldShowGroupFundSearch,
  currentFundDailyEarnings,
  fundExtraDataByCode,
  todayStr,
  fundTagListsByCode
}) {
  return {
    scopedFunds,
    displayFundsRaw,
    displayFunds
  };
}
```

Move the existing filtering/sorting code exactly. Keep `useDeferredValue` inside the hook for `displayFunds`.

**Step 2: Replace code in `page.jsx`**

Add import:

```javascript
import { useFundDisplayList } from './features/portfolio/useFundDisplayList';
import { devShadowCompare } from './lib/devShadowCompare';
```

For the first pass, keep a legacy calculation next to the hook and compare it in development:

```javascript
const legacyFundDisplay = useMemo(() => {
  // original scopedFunds/displayFundsRaw calculation, copied exactly
  return { scopedFunds: legacyScopedFunds, displayFundsRaw: legacyDisplayFundsRaw };
}, [
  // original dependency list, copied exactly
]);

const nextFundDisplay = useFundDisplayList({
  funds,
  currentTab,
  favorites,
  activeGroupCodeSet,
  activeGroupId,
  groups,
  sortBy,
  sortOrder,
  holdingsForTabWithLinked,
  getHoldingProfitForTab,
  deferredGroupFundSearchTerm,
  shouldShowGroupFundSearch,
  currentFundDailyEarnings,
  fundExtraDataByCode,
  todayStr,
  fundTagListsByCode
});

const { scopedFunds, displayFundsRaw } = devShadowCompare(
  'useFundDisplayList',
  () => legacyFundDisplay,
  () => ({
    scopedFunds: nextFundDisplay.scopedFunds,
    displayFundsRaw: nextFundDisplay.displayFundsRaw
  })
);

const displayFunds = nextFundDisplay.displayFunds;
```

Important: the legacy calculation must be copied exactly and removed only after one manual regression pass shows no shadow mismatch.

**Step 3: Verify sort parity and shadow output**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Expected: lint/build pass and the browser console has no `[shadow-compare mismatch]` for `useFundDisplayList`.

Manual check these sorts before/after while the shadow comparison is still active. No mismatch only counts for branches actually exercised:

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

Also exercise these scopes before Step 4:

- `全部`
- `自选`
- `汇总` when available
- At least one custom group with holdings
- At least one custom group without holdings if available

**Step 4: Remove legacy shadow block**

After the manual checks pass, remove the legacy calculation and `devShadowCompare` import from `page.jsx`. Keep only the hook result.

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

**Step 5: Commit**

```bash
git add app/features/portfolio/useFundDisplayList.js app/page.jsx
git commit -m "refactor: extract fund display list derivation"
```

---

### Task 8: Extract PC/Mobile Row View Model Builder

**Files:**
- Create: `app/features/portfolio/useFundTableRows.js`
- Modify: `app/page.jsx`

**Current source area:**
- `app/page.jsx`: `latestDailyByCode`, `groupTotalHoldingAmount`, `pendingCodesForTab`, `pcFundTableData`.

**Step 1: Create hook**

Create `app/features/portfolio/useFundTableRows.js`.

Target signature:

```javascript
export function useFundTableRows({
  displayFunds,
  holdingsForTabWithLinked,
  isTradingDay,
  todayStr,
  getHoldingProfitForTab,
  dcaPlansForTab,
  pendingTrades,
  activeGroupId,
  currentFundDailyEarnings,
  currentTab,
  summaryHoldingSourceGroupByCode,
  linkedHoldingsForAllFav,
  fundTagListsByCode
}) {
  return {
    latestDailyByCode,
    groupTotalHoldingAmount,
    pendingCodesForTab,
    pcFundTableData
  };
}
```

Move the existing logic exactly. Keep returned object names unchanged.

**Step 2: Replace in `page.jsx`**

Add import:

```javascript
import { useFundTableRows } from './features/portfolio/useFundTableRows';
import { devShadowCompare } from './lib/devShadowCompare';
```

For the first pass, keep the legacy `latestDailyByCode`, `groupTotalHoldingAmount`, `pendingCodesForTab`, and `pcFundTableData` calculation next to the hook and compare in development:

```javascript
const legacyFundTableRows = useMemo(() => {
  // original row-model calculation, copied exactly
  return {
    latestDailyByCode: legacyLatestDailyByCode,
    groupTotalHoldingAmount: legacyGroupTotalHoldingAmount,
    pendingCodesForTab: legacyPendingCodesForTab,
    pcFundTableData: legacyPcFundTableData
  };
}, [
  // original dependency list, copied exactly
]);

const nextFundTableRows = useFundTableRows({
  displayFunds,
  holdingsForTabWithLinked,
  isTradingDay,
  todayStr,
  getHoldingProfitForTab,
  dcaPlansForTab,
  pendingTrades,
  activeGroupId,
  currentFundDailyEarnings,
  currentTab,
  summaryHoldingSourceGroupByCode,
  linkedHoldingsForAllFav,
  fundTagListsByCode
});

const { latestDailyByCode, groupTotalHoldingAmount, pendingCodesForTab, pcFundTableData } = devShadowCompare(
  'useFundTableRows',
  () => legacyFundTableRows,
  () => nextFundTableRows
);
```

Remove the legacy block only after one manual regression pass shows no shadow mismatch.

**Step 3: Verify row rendering and shadow output**

Run:

```bash
npm run lint
npm run build
npm run dev
```

Expected: lint/build pass and the browser console has no `[shadow-compare mismatch]` for `useFundTableRows`.

Manual check:

- PC list row values match before screenshots.
- Mobile list row values match before screenshots.
- Card view still receives `groupTotalHoldingAmount` and `pendingCodesForTab` correctly.
- While the shadow comparison is still active, exercise PC list view, mobile list view, card view, all/fav tabs, summary tab when available, and at least one custom group. Unvisited views/scopes are not considered verified.

**Step 4: Remove legacy shadow block**

After checks pass, remove the legacy calculation and `devShadowCompare` import from `page.jsx`. Keep only the hook result.

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

**Step 5: Commit**

```bash
git add app/features/portfolio/useFundTableRows.js app/page.jsx
git commit -m "refactor: extract fund table row model"
```

---

### Task 9: Extract Fund Tag State And Actions

**Files:**
- Create: `app/features/tags/useFundTags.js`
- Modify: `app/page.jsx`

**Current source area:**
- `app/page.jsx`: `fundTagRecords`, `fundTagListsByCode`, `openFundTagsEdit`, `handleSaveFundTags`, `handleAddPoolTag`, `handleDeleteGlobalTag`, `handleUpdateGlobalTag`, `getTagUsageLabels`, and the effect that bumps `fundTagsEdit._tick`.

**Step 1: Create feature directory**

Run:

```bash
mkdir -p app/features/tags
```

Expected: directory exists.

**Step 2: Create hook**

Create `app/features/tags/useFundTags.js`.

Target signature:

```javascript
export function useFundTags({ funds, storageHelper }) {
  const [fundTagRecords, setFundTagRecords] = useState([]);

  return {
    fundTagRecords,
    setFundTagRecords,
    fundTagListsByCode,
    openFundTagsEdit,
    handleSaveFundTags,
    handleAddPoolTag,
    handleDeleteGlobalTag,
    handleUpdateGlobalTag,
    getTagUsageLabels
  };
}
```

Implementation notes:

- Move current code exactly.
- Use `useModalStore.setState` inside the hook for `fundTagsEdit`.
- Keep `setFundTagRecords` returned because sync/import initialization still needs it.

**Step 3: Replace in `page.jsx`**

Add import:

```javascript
import { useFundTags } from './features/tags/useFundTags';
```

Remove local tag state/action blocks and call the hook after `storageHelper` is available.

Important ordering: if `storageHelper` is currently created after tag code, move only the hook call to a later point and keep derived values available to following logic. Do not change behavior.

**Step 4: Verify tag flows**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

Manual check:

- Existing fund tags render in list and card.
- Editing tags opens same modal and saves to `tags`.
- Adding tag to pool updates available tags.
- Deleting global tag updates usage labels.
- Sorting by tags still works.

Storage snapshot check:

- Before this task, capture baseline snapshots for scenario 8: edit existing fund tags, add a pool tag, delete a global tag, and update a global tag.
- After this task, repeat scenario 8 with the same seed data.
- Compare snapshot JSON and sync events. The `tags` payload shape and `onSync` event count/order must match.

**Step 5: Commit**

```bash
git add app/features/tags/useFundTags.js app/page.jsx
git commit -m "refactor: extract fund tag actions"
```

---

### Task 10: Extract Trading Actions

**Files:**
- Create: `app/features/trading/useTradingActions.js`
- Modify: `app/page.jsx`

**Current source area:**
- `app/page.jsx`: `handleSaveHolding`, `handleClearConfirm`, `processPendingQueue`, `handleDeleteTransaction`, `handleMergeAllGroupTransactionsToCurrent`, `handleAddHistory`, `handleTrade`.

**Step 1: Create feature directory**

Run:

```bash
mkdir -p app/features/trading
```

Expected: directory exists.

**Step 2: Create hook**

Create `app/features/trading/useTradingActions.js`.

Target signature:

```javascript
export function useTradingActions({
  currentTab,
  groups,
  showToast,
  getScopedGroupId
}) {
  return {
    handleSaveHolding,
    handleClearConfirm,
    processPendingQueue,
    handleDeleteTransaction,
    handleMergeAllGroupTransactionsToCurrent,
    handleAddHistory,
    handleTrade
  };
}
```

Implementation notes:

- Keep `isProcessingPendingRef` inside this hook.
- Read storage data and setters from `useStorageStore.getState()` inside callbacks. Do not pass every setter from `page.jsx`.
- Use `useModalStore.getState()` for modal payloads and `useModalStore.setState()` for closing trade/history/holding modals.
- Keep `storageStore.setItem` usage for batched pending queue processing.
- Preserve all toast messages.
- Preserve transaction shapes exactly.
- Preserve any local context that is not in Zustand (`currentTab`, `groups`, `getScopedGroupId`, `showToast`) through hook arguments.

**Step 3: Replace in `page.jsx`**

Add import:

```javascript
import { useTradingActions } from './features/trading/useTradingActions';
```

Replace moved functions with hook call.

**Step 4: Verify trading flows and storage snapshots**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

Manual check:

- Edit holding saves global and group-scoped holdings.
- Clear holding deletes matching pending trades, transactions, DCA plan, and daily earnings.
- Buy with price updates holding and adds transaction.
- Buy without price adds pending trade and initializes holding.
- Delete transaction only removes transaction in current scope.
- Merge group transactions copies records without mutating originals.

Storage snapshot check:

- Before this task, capture baseline snapshots for storage scenarios 1, 2, and 3 from `doc/storage-snapshot-scenarios.md`.
- After this task, repeat the same scenarios with the same seed data.
- Compare the snapshot JSON and sync events. The shapes, relevant key order, and event counts must match unless the task intentionally preserves existing batching with identical final data.
- Document any intentional event-order difference in the commit message body.

**Step 5: Commit**

```bash
git add app/features/trading/useTradingActions.js app/page.jsx
git commit -m "refactor: extract trading actions"
```

---

### Task 11: Extract DCA Scheduling

**Files:**
- Create: `app/features/trading/useDcaScheduler.js`
- Modify: `app/page.jsx`

**Current source area:**
- `app/page.jsx`: `scheduleDcaTrades` and `isSchedulingDcaRef`.

**Step 1: Create hook**

Create `app/features/trading/useDcaScheduler.js`.

Target signature:

```javascript
export function useDcaScheduler({ isTradingDay, setDcaPlans, showToast }) {
  return {
    scheduleDcaTrades
  };
}
```

Implementation notes:

- Keep `isSchedulingDcaRef` inside this hook.
- Use `useStorageStore.getState()` as current code does.
- Keep `setDcaPlans` as an argument only because the current implementation uses the subscribed setter in the no-new-pending branch. If that branch is converted to `useStorageStore.getState().setDcaPlans`, remove the argument in the same task.
- Preserve `storageStore.setItem('dcaPlans', ...)` and `storageStore.setItem('pendingTrades', ...)` batching.
- Preserve date/trading-day behavior exactly.

**Step 2: Replace in `page.jsx`**

Add import:

```javascript
import { useDcaScheduler } from './features/trading/useDcaScheduler';
```

Replace local `scheduleDcaTrades`.

**Step 3: Verify with storage snapshots**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

Manual check:

- Existing DCA plans generate no duplicate pending IDs.
- Non-trading days are skipped/rolled exactly as before.
- Capture and compare snapshots for a DCA generation scenario that writes `dcaPlans` and `pendingTrades`.

**Step 4: Commit**

```bash
git add app/features/trading/useDcaScheduler.js app/page.jsx
git commit -m "refactor: extract dca scheduling"
```

---

### Task 12: Extract Fund Removal And Move Actions

**Files:**
- Create: `app/features/portfolio/useFundMutations.js`
- Modify: `app/page.jsx`

**Current source area:**
- `app/page.jsx`: `requestRemoveFund`, `requestRemoveFundsFromCurrentGroup`, `removeFundsFromCurrentTabHandler`, `handleMoveFunds`, `removeFund`, `removeFundsBulk`, `handleReorder`, and row wrappers that depend on these actions.

**Step 1: Create hook**

Create `app/features/portfolio/useFundMutations.js`.

Target signature:

```javascript
export function useFundMutations({
  currentTab,
  setCurrentTab,
  displayFunds,
  setFundTagRecords,
  stripFundFromGroupScope,
  stripManyFundsFromGroupScope,
  showToast,
  fundDetailDrawerCloseRef,
  fundDetailDialogCloseRef
}) {
  return {
    handleReorder,
    requestRemoveFund,
    requestRemoveFundsFromCurrentGroup,
    removeFundsFromCurrentTabHandler,
    handleMoveFunds,
    removeFund,
    removeFundsBulk
  };
}
```

Implementation notes:

- Read storage data and setters from `useStorageStore.getState()` inside callbacks. Do not pass every store setter from `page.jsx`.
- Use `useModalStore.setState()` for delete confirmation modal payloads.
- Preserve confirmation modal payloads exactly.
- Preserve success toast text exactly.
- Preserve cleanup of collapsed state, favorites, groups, holdings, transactions, pending trades, DCA plans, daily earnings, dividends/valuation where currently present.
- Preserve local-only dependencies as arguments: `currentTab`, `setCurrentTab`, `displayFunds`, `setFundTagRecords`, group-action helpers, toast, and close refs.

**Step 2: Replace in `page.jsx`**

Add import:

```javascript
import { useFundMutations } from './features/portfolio/useFundMutations';
```

Replace moved functions with hook call.

**Step 3: Verify removal/move flows and storage snapshots**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

Manual check:

- Remove fund from custom group with no holdings executes immediately.
- Remove fund from custom group with holdings opens confirmation.
- Remove global fund in other groups opens confirmation.
- Bulk delete confirmation behavior is unchanged.
- Move funds from group to group preserves scoped holdings/transactions/pending/DCA/daily earnings.
- Reorder all/fav and group tabs still persists order.

Storage snapshot check:

- Before this task, capture baseline snapshots for storage scenarios 4, 5, and 6 from `doc/storage-snapshot-scenarios.md`.
- After this task, repeat the same scenarios with the same seed data.
- Compare the snapshot JSON and sync events. Fund deletion and movement must not change persisted shapes or unexpected SYNC_KEYS events.

**Step 4: Commit**

```bash
git add app/features/portfolio/useFundMutations.js app/page.jsx
git commit -m "refactor: extract fund mutation actions"
```

---

### Task 13: Extract Search/Add-Fund UI State

**Files:**
- Create: `app/features/search/useFundSearchBox.js`
- Modify: `app/page.jsx`

**Current source area:**
- `app/page.jsx`: `searchTerm`, `deferredSearchTerm`, `isSearchFocused`, `searchResults`, `selectedFunds`, `isSearching`, `dropdownRef`, `inputRef`, `showDropdown`, click-outside effect, `handleMobileSearchClick`, search effect, `handleSearchInput`, `toggleSelectFund`, `addFund`.

**Step 1: Create feature directory**

Run:

```bash
mkdir -p app/features/search
```

Expected: directory exists.

**Step 2: Create hook**

Create `app/features/search/useFundSearchBox.js`.

Target signature:

```javascript
export function useFundSearchBox({
  funds,
  setScannedFunds,
  setSelectedScannedCodes,
  setIsOcrScan,
  setScanConfirmModalOpen,
  setError
}) {
  return {
    searchTerm,
    setSearchTerm,
    isSearchFocused,
    setIsSearchFocused,
    searchResults,
    selectedFunds,
    setSelectedFunds,
    isSearching,
    dropdownRef,
    inputRef,
    showDropdown,
    setShowDropdown,
    handleMobileSearchClick,
    handleSearchInput,
    toggleSelectFund,
    addFund
  };
}
```

Implementation notes:

- Preserve current search threshold `val.length < 2`.
- Preserve chip behavior and error message.
- Preserve manual 6-digit code parsing.

**Step 3: Replace in `page.jsx`**

Add import:

```javascript
import { useFundSearchBox } from './features/search/useFundSearchBox';
```

Replace moved search state/actions with hook call after scan import setters are available.

**Step 4: Verify**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

Manual check:

- Search dropdown opens/closes as before.
- Selecting/unselecting chips works.
- Add button opens scan confirm modal with same selected codes.
- Manual 6-digit codes work.

**Step 5: Commit**

```bash
git add app/features/search/useFundSearchBox.js app/page.jsx
git commit -m "refactor: extract fund search box state"
```

---

### Task 14: Replace Direct Business localStorage Access

**Files:**
- Modify: `app/page.jsx`
- Modify: `app/components/FundCard/index.jsx`
- Modify: `app/components/Announcement.jsx`
- Modify: `app/stores/storageStore.js`
- Audit: every file returned by `rg -n "localStorage|sessionStorage" app lib components public --glob '!public/sw.js'`

**Current direct access examples:**
- `app/page.jsx`: direct `localStorage`/`sessionStorage` auth cleanup and `rtf_unadded_ds`.
- `app/components/FundCard/index.jsx`: direct `rtf_unadded_ds`.
- `app/components/Announcement.jsx`: direct localStorage key scan.

**Step 1: Classify direct storage usage**

Run:

```bash
rg -n "localStorage|sessionStorage" app lib components public --glob '!public/sw.js'
```

Expected: list all remaining direct accesses and comments. Create a temporary checklist in the task notes that classifies each runtime code hit as one of:

- `business-storage`: must move to `storageStore`.
- `storage-store-internal`: allowed inside `app/stores/storageStore.js`.
- `supabase-session`: allowed with a comment because Supabase SDK owns auth keys.
- `theme-bootstrap`: allowed for inline pre-hydration theme setup in `app/layout.jsx`.
- `session-storage`: allowed only for auth/session cleanup with a comment.
- `comment-only`: no code change needed.

**Step 2: Add key iteration helper**

`storageStore` currently has no key enumeration helper. Add one to `useStorageStore` and expose it through the `storageStore` shortcut object:

```javascript
keys: () => {
  if (typeof window === 'undefined') return [];
  return Object.keys(window.localStorage);
}
```

At the bottom:

```javascript
export const storageStore = {
  setItem: (key, val) => useStorageStore.getState().setItem(key, val),
  getItem: (key, def) => useStorageStore.getState().getItem(key, def),
  removeItem: (key) => useStorageStore.getState().removeItem(key),
  clear: () => useStorageStore.getState().clear(),
  keys: () => useStorageStore.getState().keys()
};
```

**Step 3: Replace business storage keys**

Replace `rtf_unadded_ds` access with `storageStore.getItem('rtf_unadded_ds', {})` and `storageStore.setItem('rtf_unadded_ds', JSON.stringify(next))`.

For `Announcement.jsx`, replace direct key scanning with `storageStore.keys()`.

Auth/session cleanup can remain direct only if it targets Supabase session keys or `sessionStorage`; add a short comment:

```javascript
// Supabase session cleanup: auth SDK owns these keys, not app business storage.
```

Theme initialization in `app/layout.jsx` can remain direct because it is inline pre-hydration theme bootstrapping.

`app/hooks/useTheme.js` already uses `storageStore` for runtime theme persistence. Only its comment may mention localStorage.

**Step 4: Verify**

Run:

```bash
npm run lint
npm run build
rg -n "localStorage|sessionStorage" app lib components public --glob '!public/sw.js'
```

Expected:

- Lint/build pass.
- Remaining direct storage usage is either inside `storageStore`, Supabase session cleanup, theme bootstrap, or documented exception.
- Storage snapshot scenario 7 passes: announcement cleanup writes only announcement keys and fires no SYNC_KEYS event.
- Existing Supabase session cleanup remains an explicit exception and does not use `storageStore`.

**Step 5: Commit**

```bash
git add app/page.jsx app/components/FundCard/index.jsx app/components/Announcement.jsx app/stores/storageStore.js
git commit -m "refactor: route business storage through storage store"
```

---

### Task 15: Split Fund API By Source Without Changing Imports

**Files:**
- Create: `app/services/fund/scriptLoader.js`
- Create: `app/services/fund/netValueApi.js`
- Create: `app/services/fund/valuationApi.js`
- Create: `app/services/fund/holdingsApi.js`
- Create: `app/services/fund/searchApi.js`
- Create: `app/services/fund/marketApi.js`
- Create: `app/services/fund/miscApi.js`
- Modify: `app/api/fund.js`

**Current source area:**
- `app/api/fund.js`

**Step 1: Create service directory**

Run:

```bash
mkdir -p app/services/fund
```

Expected: directory exists.

**Step 2: Move script loading helpers first**

Create `app/services/fund/scriptLoader.js` with:

- `loadScript`
- Eastmoney script normalizer/runner helpers
- JSONP dispatcher helpers where shared

Keep exported names the same where public.

**Step 3: Move API groups**

Move functions in small batches:

- `netValueApi.js`: `fetchFundNetValue`, `fetchFundNetValueRange`, `fetchNetValueRangeFromTrend`, `fetchSmartFundNetValue`, `fetchSmartFundNetValueBackward`, net-value parsers.
- `valuationApi.js`: `fetchFundData`, `fetchFundDataFallback`, `fetchBestValuationSource`, `fetchFundValuationBySource`, valuation data-source helpers, QDII valuation.
- `holdingsApi.js`: `fetchFundHoldings`, holdings report parsing, related sectors/secid/sector quotes if tightly coupled.
- `searchApi.js`: `searchFunds`, fuzzy/search JSONP helpers.
- `marketApi.js`: `fetchShanghaiIndexDate`, `fetchMarketIndices`, raw index parsers.
- `miscApi.js`: `fetchLatestRelease`, `submitFeedback`, `parseFundTextWithLLM`, `fetchOcrDailyRemaining`, `fetchFundHistory`, `fetchFundValuationTrend`, `fetchFundPingzhongdata`, period return helpers.

**Step 4: Keep compatibility barrel**

Replace `app/api/fund.js` with re-exports:

```javascript
export * from '../services/fund/scriptLoader';
export * from '../services/fund/netValueApi';
export * from '../services/fund/valuationApi';
export * from '../services/fund/holdingsApi';
export * from '../services/fund/searchApi';
export * from '../services/fund/marketApi';
export * from '../services/fund/miscApi';
```

If circular imports appear, resolve by moving shared constants/helpers to `app/services/fund/shared.js`.

**Step 5: Verify after each moved batch**

Run after every batch:

```bash
npm run lint
npm run build
```

Expected: both pass after each batch.

Manual check:

- Refresh fund data.
- Search funds.
- Open holdings/related-sector UI.
- Open market tab.
- Open history/valuation trend charts.

**Step 6: Commit**

```bash
git add app/api/fund.js app/services/fund
git commit -m "refactor: split fund api services"
```

---

### Task 16: Add Compatibility Barrel For Features

**Files:**
- Create: `app/features/portfolio/index.js`
- Create: `app/features/tags/index.js`
- Create: `app/features/trading/index.js`
- Create: `app/features/search/index.js`
- Modify: `app/page.jsx`

**Step 1: Create barrels**

Example `app/features/portfolio/index.js`:

```javascript
export * from './usePortfolioScope';
export * from './useFundDisplayList';
export * from './useFundTableRows';
export * from './useFundMutations';
```

Create equivalent barrels for tags, trading, and search.

**Step 2: Update imports**

In `app/page.jsx`, change feature imports to barrel imports:

```javascript
import { usePortfolioScope, useFundDisplayList, useFundTableRows, useFundMutations } from './features/portfolio';
```

**Step 3: Verify**

Run:

```bash
npm run lint
npm run build
```

Expected: both pass.

**Step 4: Commit**

```bash
git add app/features app/page.jsx
git commit -m "refactor: add feature barrels"
```

---

### Task 17: Final Page Slimming Pass

**Files:**
- Modify: `app/page.jsx`

**Step 1: Remove dead imports**

Run:

```bash
npm run lint
```

Use lint feedback to remove unused imports from `app/page.jsx`.

**Step 2: Remove compatibility wrappers no longer needed**

Review modal setter wrappers in `page.jsx`. Keep wrappers still passed to components. Remove only unused ones.

**Step 3: Verify line count and behavior**

Run:

```bash
wc -l app/page.jsx
npm run lint
npm run build
```

Expected:

- `page.jsx` is materially smaller.
- Lint/build pass.
- Manual regression checklist passes.

**Step 4: Commit**

```bash
git add app/page.jsx
git commit -m "refactor: clean page orchestration imports"
```

---

### Task 18: Optional CSS Organization Pass

**Files:**
- Create: `app/styles/tokens.css`
- Create: `app/styles/base.css`
- Create: `app/styles/layout.css`
- Create: `app/styles/components.css`
- Modify: `app/globals.css`

**Only do this after all JS refactors are stable.**

**Step 1: Split by copy/paste only**

Move CSS blocks without editing declarations. Preserve order through imports in `globals.css`:

```css
@import './styles/tokens.css';
@import './styles/base.css';
@import './styles/layout.css';
@import './styles/components.css';
```

Do not change selector order, media query placement, Tailwind import/layer order, or any `px`/`PX` spelling. The `postcss-pxtorem` behavior and cascade order must remain byte-for-byte equivalent except for file boundaries/imports.

**Step 2: Verify visual output**

Run:

```bash
npm run build
```

Expected: build passes.

Manual check:

- Desktop and mobile screenshots match baseline.
- No text overflow or z-index regressions.
- Modal, drawer, table sticky headers, and mobile nav still layer correctly.
- PC `px`, mobile media-query `px`, preserved `1px` borders, and uppercase `PX` opt-outs behave the same after PostCSS processing.

**Step 3: Commit**

```bash
git add app/globals.css app/styles
git commit -m "refactor: organize global styles"
```

---

## Completion Criteria

- `npm run lint` passes.
- `npm run build` passes.
- `app/page.jsx` has been reduced substantially without changing UI behavior.
- Business storage access goes through `storageStore`, except documented Supabase/session/theme bootstrapping exceptions.
- `app/api/fund.js` is a compatibility barrel or at least significantly decomposed.
- Manual regression checklist passes on desktop and mobile.
- Every task is committed separately.

## Rollback Strategy

- Revert the most recent task commit if a regression appears.
- Because each task preserves existing public props/imports where possible, regressions should be isolated to the last extracted feature hook or service batch.
- If API splitting creates circular import risk, keep `app/api/fund.js` intact and postpone Task 15; page-level extraction still provides most maintainability benefit.

---

## Review Opinion — 2026-06-17 (Claude / Opus 4.8)

> Resolution note: The actionable parts of this review have been incorporated above in "Review Resolution" and Tasks 3, 4, 6, 7, 8, 10, 12, 14, and 18. Treat the task list above as the source of truth during execution.

总体评价：**方向正确、排序合理、低风险**。计划顺着项目既有约定（hooks 化、modalStore + ModalsLayer、storageStore、barrel 兼容层、每任务单独提交）推进，而不是另起炉灶，这点很对。增量 + 可回滚 + 每步 lint/build 的纪律也到位。以下是基于实际代码核对后的具体意见，按重要性排序。

### 🔴 必须补强

1. **缺自动化安全网，是这份计划最大的短板。**
   验证手段全靠 `npm run lint` + `npm run build` + 人工清单。但 lint/build 只能抓语法/导入错误，**抓不到行为漂移**。而风险最高的恰恰是 Task 4 的 `displayFundsRaw`（300+ 行）和 Task 5 的 `pcFundTableData`（260+ 行）这类纯计算——Task 4 一个任务就要人工核对 **13 种排序模式**的前后一致性，靠肉眼几乎不可靠。
   计划第 16 行"不引入测试框架"的约束，恰好砍掉了针对最危险任务的最强验证工具。建议二选一：
   - 给被抽离的纯函数补 **characterization 测试**（快照锁定当前输出）——这与"不改 UI"的目标完全一致，且不触碰 UI 层；或
   - 更轻量的 **运行时影子对比（shadow-compare）**：抽离后在 dev 模式下让新旧实现并行跑一轮，对结果 `isEqual` 断言、不一致就 `console.error`。零框架成本，能在真实数据上抓到分叉。
   不补这一层，"行为保持"就只是口号而非可验证的契约。

2. **Task 11 的范围被低估。**
   实际直接访问 `localStorage/sessionStorage` 的文件有 **13 个**（page.jsx、layout.jsx、constants、userStore、Announcement、FundCard、useTheme、useRefreshManager、dailyEarnings、supabase、api/fund.js…），计划只点名了 3 个。Step 1 的 `rg` 会暴露它们，但任务的预估工作量、提交粒度需要据此放大。另外已确认 `storageStore` **没有** keys 枚举 helper，所以 Step 2 是**必做项**而非 "if needed"——`Announcement.jsx` 的 key 扫描依赖它。

### 🟡 建议调整

3. **巨型参数列表是隐藏的坏味道。** `useFundMutations` 约 25 个入参（绝大多数是 setter）、`usePortfolioScope` 14 个、`useTradingActions` 16 个。把 25 个 setter 一路透传，抵消了一部分抽离的收益，也让调用点很脆。而且策略不自洽：Task 3 要求"hook 内不订阅 store"以保持纯净，但 Task 7/9 的 mutation hook 内部**又**直接调 `storageStore.setItem` / `useModalStore.getState()`。建议明确分两类：
   - **派生计算 hook**（Task 3/4/5）→ 保持纯函数式入参，便于测试；
   - **副作用/mutation hook**（Task 7/8/9）→ 直接从 store `getState()` 读写，**只传必要的回调**，不要透传一堆 setter。
   两类规则统一后，参数列表能砍掉一大半。

4. **抽离顺序应先画依赖图。** 已确认 `usePortfolioScope` 的入参 `summaryMergedHoldings` 等来自 `useSummaryCalculations`——hook 之间已存在喂数链；Task 6 自己也提示了 `storageHelper` 的定义顺序问题，Task 10 依赖 scan-import 的 setter 先就位。这些 state→derived→effect 的先后关系构成一张依赖图。**建议在 Task 3 之前先产出这张图**，否则把某个 `useMemo` 提到它依赖项上方会引入 TDZ/`undefined` 漂移，而 build 不一定报错。

5. **React Compiler 的交互要写进规则。** `reactCompiler: true` 会自动 memo。搬运 `useMemo/useCallback` 进 hook 时，**务必原样保留依赖数组**，不要因为"编译器会处理"就删依赖——下游 effect/memo 可能依赖其引用稳定性，删依赖会悄悄改变重算时机。建议在 Refactor Rules 里加一条明文约束。

### 🟢 认可的判断

6. Task 12（拆 fund API）放在 page 级抽离稳定**之后**、并保留 `app/api/fund.js` barrel 不动调用方——正确。Rollback 里"有循环依赖就推迟 Task 12"的退路也务实。
7. Task 15（CSS 拆分）标为"可选、最后做"是对的：`globals.css` 3557 行叠加 `postcss-pxtorem` 与 Tailwind v4 的 `@import`/layer 顺序敏感，纯复制粘贴 + `@import` 保序是风险最低的做法。建议把"pxtorem 转换与级联顺序不得改变"显式写进该任务的验收点。

### 一句话结论
**可以执行**，但开工前先做两件事：(a) 补一层针对纯计算的 characterization 测试或影子对比；(b) 画出 hook/状态依赖图以锁定抽离顺序。这两点补上后，"不改展示与交互"才从约束变成可被自动验证的契约。

— Claude (Opus 4.8)，2026-06-17

---

## Review Opinion (Round 2) — 2026-06-17 (Claude / Opus 4.8)

> Resolution note: The actionable parts of this second review have been incorporated above in "Review Resolution" and Tasks 5, 6, 7, 8, 10, 11, 12, and 14. Treat the task list above as the source of truth during execution.

复审了第一轮之后的更新。**结论：吸收得很到位，可以开工。** 七条原始意见基本都落地了——新增 Task 3（依赖图）、Task 4（`devShadowCompare` 助手）、Task 6/7 的"旧实现并行影子对比再删除"流程、Refactor Rules 第 21 行（保留依赖数组）和第 22–24 行（派生 hook / mutation hook 两分法）、Task 13 的存储分类清单 + 强制 `keys()` helper、Task 17 的 pxtorem/级联顺序约束。用 dev 影子对比替代测试框架，对这种"零测试基建 + 低改动量"的项目是合理取舍，我认可不引入测试框架的决定。

但更新也**重新划定了安全网的边界**，暴露出新的优先级。以下三点按重要性排序。

### 🔴 残留的头号风险：安全网只盖了"显示"，没盖"写入与云同步"

影子对比是为**纯派生**设计的，目前只用在 Task 6/7。而真正能造成**不可逆损害**的是写本地存储的任务：
- **Task 9（交易）、Task 11（增删/移动）、Task 13（存储路由）** 全部通过 `storageStore.setItem` 写入，而我已核实该写入会对 SYNC_KEYS 触发 `onSync(key, prev, next)`（[storageStore.js:523-539](app/stores/storageStore.js#L523)）——**写入形状一旦细微漂移，会连带改变上传到 Supabase 的云同步载荷**，污染的是持久化用户数据，比显示 bug 严重一个量级。这三个任务目前**只有人工核对**，没有任何自动护栏。

建议补一个与影子对比对称的轻量手段——**存储快照差分**：在 main 分支上先对一组固定操作（买入有价/无价、清仓、跨组移动、删除）跑一遍，把相关 storageStore key dump 成 JSON 基线；重构后对同样操作再 dump 一次，`isEqual` 比对。零框架成本，能抓到 transaction 形状、批处理顺序、`onSync` 触发次数的偏移。这是当前计划最该补的一块。

### 🟡 影子对比的有效性 = 人工触发覆盖率，需写成硬约束

`devShadowCompare` 只在"实际跑到的数据状态"上比对：某个排序模式或某个 tab/scope 在 dev 里没点到，就**不会**产生比对，却会得到"无 mismatch"的假安全感。Task 6 Step 3 已列出 13 种排序，但建议把话挑明：**Step 4 删除旧实现前，必须在影子对比存活期间把 13 种排序 × 每个 tab/分组 scope 全部手动驱动一遍**，否则未触发的分支是"未验证"而非"已验证"。Task 7 的 PC/移动/卡片三视图同理。

### 🟡 Task 5 是"既派生又写入"的混合体，恰好没有护栏

`usePortfolioScope` 被归为派生 hook，但签名里收了 `setFundDailyEarnings`，且移动块内含写 `fundDailyEarnings` 的清理逻辑——它违反了第 22–23 行"派生 hook 保持纯净"的规则（Task 3 第 253 行用"已存在的 cleanup effect 除外"打了补丁）。问题在于：它是最核心的派生之一（产出 `currentFundDailyEarnings`、`portfolioDailySeries`、各种 `getScoped*`），却**既没影子对比、又夹带写入**。建议二选一：把它纯产出的部分（`currentFundDailyEarnings`、`portfolioDailySeries`）也加一层影子对比；或把那段 `fundDailyEarnings` 写入清理拆成独立的 effect hook，让 `usePortfolioScope` 回归真正的纯派生。

### 🟢 其余认可
- Task 4 `devShadowCompare` 实现正确：production 短路、`isFunction` 双形态、`try/catch` 包住旧实现求值。唯一提醒：Task 6/7 里 legacy 用 `useMemo` 无条件求值，开发期会双算一次——只要严格执行 Step 4 删除、不把中间态发版即可，无需改设计。
- 两分法规则 + Task 9/11 改用 `getState()` 把入参从 ~25 个砍到个位数，正是我想要的方向。
- 依赖图（Task 3）放在所有抽离之前，顺序锁定问题解决。

### 一句话结论
显示层的护栏已经补齐，计划**具备开工条件**。开工前唯一还该补的是**写入层的存储快照差分**（覆盖 Task 9/11/13 + Task 5 的写入），把"不改交互"这个契约从"显示可验证"扩展到"持久化数据与云同步载荷也可验证"。

— Claude (Opus 4.8)，2026-06-17

---

## Review Opinion (Round 3) — 2026-06-17 (Claude / Opus 4.8)

> Resolution note: The blocking item from this third review has been incorporated above in "Review Resolution" and Tasks 4 and 6. Treat the task list above as the source of truth during execution.

第二轮的三点全部高质量落地，复审通过。**计划现在可以执行。** 特别认可两处：

- **新增 Task 5 存储快照工具命中要害。** `installSyncEventRecorder` 包裹 `onSync` 同时记录序列化数据**和**同步事件，`createStorageSnapshot` 用 `storageStore.getItem` 读取——验证的正是云同步实际看到的那份数据。7 个场景精确对应 Task 10/12/14 的写入路径，连"公告关闭不得触发 SYNC_KEYS"这种负向断言都覆盖了。这正是我担心的"写入层无护栏"的对称解法。
- **Task 6 拆分干净。** 纯 `usePortfolioScope`（签名里已移除 `setFundDailyEarnings`、不再写）+ 独立 `usePortfolioScopeCleanup`（独占写副作用），两分法终于自洽。

### 🔴 一个确切的实现 bug：Task 6 的影子对比会永远误报 mismatch

Task 6 Step 4 这样写：

```javascript
} = devShadowCompare('usePortfolioScope', () => legacyPortfolioScope, () => nextPortfolioScope);
```

`legacyPortfolioScope` 是 **8 键**投影（不含 `groupById` 和 3 个 `getScoped*` 函数），而 `nextPortfolioScope` 是**完整 12 键**（多了 `groupById` + `getScopedGroupId/Holding/DcaPlan`）。`devShadowCompare` 内部 `isEqual(legacyValue, nextValue)` 比较的就是这两个对象——**键集不等，`isEqual` 恒为 false，于是每次渲染都打印 `[shadow-compare mismatch]`**。这会让 Task 6 的护栏完全失效（满屏假阳性，真分叉反而被淹没）。

注意这偏离了 Task 7/8 用对的模式：Task 7 传的是**键集匹配的投影**（`() => ({ scopedFunds, displayFundsRaw })` 对 legacy 的同 2 键），Task 8 传的也是同 4 键。Task 6 唯独把完整对象塞了进去。

**修复**：让 next 工厂也投影成同样 8 个可比键，真正的 12 个值仍直接从 `nextPortfolioScope` 解构（不要从 `devShadowCompare` 的返回值里取）：

```javascript
devShadowCompare('usePortfolioScope', () => legacyPortfolioScope, () => ({
  activeGroupId: nextPortfolioScope.activeGroupId,
  linkedHoldingsForAllFav: nextPortfolioScope.linkedHoldingsForAllFav,
  currentFundDailyEarnings: nextPortfolioScope.currentFundDailyEarnings,
  portfolioDailySeries: nextPortfolioScope.portfolioDailySeries,
  holdingsForTabWithLinked: nextPortfolioScope.holdingsForTabWithLinked,
  dcaPlansForTab: nextPortfolioScope.dcaPlansForTab,
  transactionsForTab: nextPortfolioScope.transactionsForTab,
  activeGroupCodeSet: nextPortfolioScope.activeGroupCodeSet
}));

// 真正使用的 12 个值（含函数）直接从 nextPortfolioScope 解构：
const {
  activeGroupId, linkedHoldingsForAllFav, currentFundDailyEarnings, portfolioDailySeries,
  holdingsForTabWithLinked, dcaPlansForTab, transactionsForTab, groupById,
  getScopedGroupId, getScopedHolding, getScopedDcaPlan, activeGroupCodeSet
} = nextPortfolioScope;
```

（根因是函数值无法用 `isEqual` 有意义地比较，所以必须排除在对比之外——这点制定者在 legacy 投影里已经想到了，只是 next 侧忘了同样投影。）建议顺手在 Task 4 `devShadowCompare` 的注释里加一句"两个工厂必须返回相同键集，且不要放入函数值"，避免后续任务重蹈覆辙。

### 🟢 其余无新增问题
- 快照工具的 `normalizeForSnapshot` 对 Set 排序、对象键排序处理正确，能消除无序集合/键序带来的假阳性。
- 循环依赖的退路（导入成环就移到 `scripts/` 从控制台加载）已预先写好，务实。
- Task 6 Step 5 把"联动清仓时用快照流程核对 `fundDailyEarnings`"写进了验收，写副作用也纳入了护栏。

### 一句话结论
**批准执行。** 唯一的阻断项是 Task 6 影子对比的键集不匹配 bug——按上面投影修复即可（约两分钟改动），其余全部就绪。

— Claude (Opus 4.8)，2026-06-17

---

## Review Opinion (Round 4 / 终审) — 2026-06-17 (Claude / Opus 4.8)

第三轮的键集 bug 已正确修复，**无遗留阻断项，计划批准执行（sign-off）。**

核对结果：
- **Task 6 Step 4** —— `devShadowCompare` 的 next 工厂现在投影成与 `legacyPortfolioScope` 完全一致的 8 个可比键；真正使用的 12 个值（含 `groupById` 与 3 个 `getScoped*` 函数）直接从 `nextPortfolioScope` 解构，不再经由 `devShadowCompare` 的返回值。键集对齐、函数被排除在对比之外——永久误报已消除。改法与我建议的一致。
- **Task 4 注释** —— 第 327–329 行补上了三条约束（两个工厂须返回相同形状、不得放入函数值、有额外字段就比投影并另行使用完整值）。这把"键集必须匹配"从个案修复升级成了**通用规则**，能防止后续任务重蹈覆辙。
- 顺带复核 Task 7/8：两者传入的本就是键集匹配的纯数据投影（Task 7 两键、Task 8 四键、均无函数），与新规则一致，无需改动。

至此，四轮评审的全部意见均已闭环：

| 轮次 | 核心意见 | 状态 |
|---|---|---|
| R1 | 安全网 / 存储范围 / 参数列表 / 依赖图 / Compiler 依赖数组 / CSS 顺序 | ✅ 全部落实 |
| R2 | 写入层快照差分 / 影子对比覆盖率显式化 / Task 6 拆分写副作用 | ✅ 全部落实 |
| R3 | Task 6 影子对比键集 bug | ✅ 已修复 + 升级为通用规则 |
| R4 | 终审复核 | ✅ 无新增问题 |

**结论：可以进入实施。** 执行时按既定纪律走即可——每个高风险抽离任务在删除 legacy 前，务必让影子对比 / 存储快照在"全部排序 × tab × scope × 视图"被真实触发的前提下零 mismatch；写入类任务（Task 10/12/14 + Task 6 cleanup）逐一比对快照 JSON 与 `onSync` 事件数。无需再来下一轮评审。

— Claude (Opus 4.8)，2026-06-17
