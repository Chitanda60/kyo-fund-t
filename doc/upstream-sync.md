# Upstream Sync

This project tracks upstream changes from the local checkout:

```text
download/real-time-fund
```

## Recorded Baseline

Current baseline:

```text
ffaf4b090960ecc715a32556bc02b513cce07159
feat：悬浮框字体大小调整
2026-06-17 17:25:47 +0800
```

This baseline corresponds to the current repository's first commit:

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
git -C download/real-time-fund log --oneline ffaf4b090960ecc715a32556bc02b513cce07159..HEAD
```

2. Inspect changed files and stats.

```bash
git -C download/real-time-fund diff --stat ffaf4b090960ecc715a32556bc02b513cce07159..HEAD
git -C download/real-time-fund diff --name-status ffaf4b090960ecc715a32556bc02b513cce07159..HEAD
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
