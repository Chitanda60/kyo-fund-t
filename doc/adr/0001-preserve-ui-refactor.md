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

### Constraints

- No UI or interaction change: user-facing Chinese text, DOM hierarchy, class names, visual CSS, modal flows, sort semantics, default state, and animation behavior stay identical unless the source plan explicitly says otherwise.
- Storage equivalence: persisted business data shape must not change. All business localStorage access stays behind `storageStore` / `useStorageStore`.
- Cloud sync equivalence: `onSync` payloads and the set/order of `SYNC_KEYS` events for a given operation must not change.
- No TypeScript: the project stays JavaScript/JSX only.
- No new test framework: verification uses dev-only shadow comparison for derived data and storage snapshots for write paths, not an added test runner.

## Consequences

This approach is slower than a rewrite, but each step is small, reviewable, and reversible. It also avoids changing visual behavior while the internals become easier to test and maintain.

- Task-by-task movement is slower than a big-bang rewrite, but every extraction is independently verifiable and revertible.
- Pure derivations (Tasks 6-8) are proven equivalent with `devShadowCompare` before the legacy code is deleted.
- Write paths (Tasks 9-12, 14, and the Task 6 cleanup effect) are proven equivalent with storage snapshots that compare both persisted JSON shape and `onSync` event count/order.
