# Upstream Sync

This project tracks upstream changes from the local checkout:

```text
download/real-time-fund
```

## Recorded Baseline

Current baseline:

```text
2e14d9e3a3617a228fa4c28305b3b5408a93a43e
feat：分组下拉宽度调整
2026-06-24 09:52:09 +0800
```

The baseline is also marked in the upstream checkout by the local git tag
**`sync-baseline`** (annotated, points at `2e14d9e`). Prefer referencing it by
name instead of hardcoding the SHA — `git -C download/real-time-fund diff
sync-baseline..HEAD` always shows exactly the unported range. After finishing a
sync, move the tag forward to the newly-synced commit:

```bash
git -C download/real-time-fund tag -f -a sync-baseline -m "Sync baseline: <commit> (<date>)" <new-commit>
```

The 2.3.1 sync (`ffaf4b0..2e14d9e`) was ported into the refactored architecture
on 2026-06-24 (see `doc/upstream-sync-2e14d9e-checklist.md` and the `feat:`/`fix:`
commits). Ported: best-source cached APIs, auto data-source selection, import
auto-source + recommended tags, data-source column/badges, pinned sort,
delete-fund-keeps-earnings, removal of group-holdings seeding, cumulative net
value charts, client error handling, PC width clamp, group-dropdown/width
settings store+modal+save wiring, version 2.3.1.

The full `ffaf4b0..2e14d9e` code range is now ported (incl. the group-tab dropdown +
tab-overflow scroll buttons in HomePageContent/AppShell and the `.tabs`/`.tabs-scroll-*`
/`.name-cell` CSS merge into `app/styles/components.css`). Verified: lint 0 errors,
build prerenders all routes, 0 console errors, the in-app 2.3.1 announcement renders.

**Operational follow-up (not code — your side):** the two Supabase RPCs
(`get_fund_best_source` / `get_fund_recommended_tags`) are deployed (SQL in
`doc/supabase.sql` §4) and verified reachable (HTTP 200, empty results). To make
auto-source / recommended-tags actually do something, populate `fund_best_source`
and the `fund_related`/`fund_topic` tables. Until then the features degrade safely.

The previous baseline was `ffaf4b0` (the current repository's first commit):

```text
be6cfa56ab2970f220a7f5efa2f90241b70b3c76
feat: init
2026-06-17 17:40:05 +0800
```

Verification performed on 2026-06-24:

- Compared current initial commit `be6cfa5` with upstream commit `ffaf4b0`.
- Excluded AI/IDE/docs noise:
  - `.agent/`
  - `.claude/`
  - `.cursor/`
  - `.trae/`
  - `.idea/`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `GEMINI.md`
  - nested `AGENTS.md`
- Result: `190/190` project file blobs matched.

## Future Sync Workflow

When `download/real-time-fund` updates:

1. Inspect upstream commits since the recorded baseline.

```bash
git -C download/real-time-fund fetch origin
git -C download/real-time-fund log --oneline sync-baseline..origin/main
```

2. Inspect changed files and stats.

```bash
git -C download/real-time-fund diff --stat sync-baseline..origin/main
git -C download/real-time-fund diff --name-status sync-baseline..origin/main
```

3. Group changes by product area:

- fund API/data source logic
- refresh/sync/storage behavior
- scan import/OCR/tag import
- table/card/chart UI
- modal/settings behavior
- styles/assets/docs
- deploy/Sentry/IDE/tooling changes

4. Port only relevant changes into the current architecture.

Current project is no longer shaped like upstream:

- main tabs are route-backed pages: `/`, `/market`, `/mine`
- `AppShell` owns former `app/page.jsx` orchestration
- fund APIs are split under `app/services/fund/`
- feature hooks live under `app/features/`
- business storage must go through `storageStore`
- CSS is split under `app/styles/`

Do not directly overwrite current files with upstream files.

5. Verify after porting:

```bash
npm run lint
npm run build
```

Also perform manual checks for touched areas.

6. Advance this baseline only after the upstream diff range has been fully analyzed and relevant changes are ported or intentionally rejected.

Update both:

- this file
- `AGENTS.md`

## Notes

The baseline should represent the last upstream commit whose relevant changes have been reconciled into this project.
