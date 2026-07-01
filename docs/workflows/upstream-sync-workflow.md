# Upstream Sync Workflow

**Purpose:** Define the repeatable workflow for syncing changes from the upstream working copy `download/real-time-fund` into this refactored project.

**Core rule:** The upstream anchor commit means "the latest upstream commit that this project has fully absorbed." It must be advanced only after implementation, verification, and documentation are complete.

---

## Phase 1: Confirm Current State

1. Read the current upstream baseline from:
   - `doc/upstream-sync.md`
   - `AGENTS.md` `UPSTREAM SYNC` section

2. Check local worktree state before starting:

```bash
git status --short
```

3. Identify any uncommitted or user-owned changes. Do not revert unrelated changes.

**Output:** a clear old anchor commit, for example:

```text
2e14d9e3a3617a228fa4c28305b3b5408a93a43e
feat：分组下拉宽度调整
2026-06-24 09:52:09 +0800
```

---

## Phase 2: Update Or Inspect Upstream

The upstream working copy lives at:

```text
download/real-time-fund
```

If the user wants the latest upstream state, update that working copy first. If the user asks to sync a known target commit, inspect that target directly.

Useful commands:

```bash
git -C download/real-time-fund status --short
git -C download/real-time-fund show -s --format='%H%n%s%n%ci' HEAD
git -C download/real-time-fund log --oneline --decorate -n 20
```

When network access or `git pull` is needed, ask for approval before using escalated commands.

**Output:** a target upstream commit.

---

## Phase 3: Analyze The Upstream Range

Compare the old anchor to the target commit:

```bash
git -C download/real-time-fund log --oneline --reverse <old-anchor>..<target-commit>
git -C download/real-time-fund diff --stat <old-anchor>..<target-commit>
git -C download/real-time-fund diff --name-status <old-anchor>..<target-commit>
```

For important files, inspect targeted diffs:

```bash
git -C download/real-time-fund diff <old-anchor>..<target-commit> -- app/page.jsx
git -C download/real-time-fund diff <old-anchor>..<target-commit> -- app/api/fund.js
```

Summarize:

- commits in scope
- changed files
- user-facing features
- data/storage/schema changes
- release/version changes
- risky behavior changes

**Do not copy upstream files into this project.** Upstream is the product source, not the architecture source.

---

## Phase 4: Map Changes To Current Architecture

Map upstream flat files into the current project structure.

Common mappings:

| Upstream area                    | Current project target                                                 |
| -------------------------------- | ---------------------------------------------------------------------- |
| `app/api/fund.js` implementation | `app/services/fund/*`, with `app/api/fund.js` kept as a barrel         |
| `app/page.jsx` orchestration     | `app/components/AppShell.jsx`, `app/components/pages/*`, feature hooks |
| table components                 | `app/components/tables/*`                                              |
| fund UI components               | `app/components/fund/*`                                                |
| chart components                 | `app/components/charts/*`                                              |
| announcement                     | `app/components/system/Announcement.jsx`                               |
| global CSS                       | `app/styles/*`, keeping `app/globals.css` as import barrel             |
| business localStorage            | `app/stores/storageStore.js`                                           |
| modal state/rendering            | `app/stores/modalStore.js`, `app/components/ModalsLayer.jsx`           |

Respect current architecture constraints:

- route-backed `/`, `/market`, `/mine`
- persistent `AppShell`
- unified `storageStore` for business persistence
- JavaScript/JSX only
- lodash type helpers for type checks
- no direct wholesale upstream overwrite

---

## Phase 5: Write The Migration Plan

Create or update a plan under:

```text
docs/plans/YYYY-MM-DD-upstream-real-time-fund-<target>-sync.md
```

The plan should include:

- upstream range and target commit
- changed upstream files
- architecture mapping
- known overlaps already present in this project
- non-negotiable rules
- pre-flight commands
- task-by-task implementation steps
- exact files to modify
- `rg` anchors before editing
- verification commands
- manual regression checklist
- final baseline update steps

The plan is a checkpoint. Do not change business code before the plan is reviewed and confirmed.

---

## Phase 6: Review And Absorb Feedback

Have the plan reviewed before implementation.

For each review comment:

1. Verify it against actual code or upstream diff.
2. Classify it:
   - blocking risk
   - non-blocking risk
   - known limitation
   - rejected suggestion
3. Update the plan body, not only the review notes.
4. Keep an execution-facing summary in the plan.

Once the user confirms the plan, stop reviewing and proceed to implementation.

---

## Phase 7: Implement Task By Task

Execute the confirmed plan in order.

For each task:

1. Run the task's pre-check commands.
2. Stop if an expected code anchor is missing.
3. Make the smallest scoped code change.
4. Preserve user-owned unrelated worktree changes.
5. Run the listed verification command.
6. Commit when the task is complete and verified, if commits are part of the plan.

Typical verification:

```bash
npm run lint
```

Use `npm run build` at release/final checkpoints or whenever static export behavior may be affected.

---

## Phase 8: Final Verification

After all tasks are complete:

```bash
npm run lint
npm run build
git status --short
```

Also run the plan's manual regression checklist. For this app, usually check:

- home route `/`
- `/market`
- `/mine`
- table sorting/pagination/reorder/batch actions
- fund data source selection
- refresh/auto-source behavior
- cloud sync behavior
- announcement/version behavior
- static export route behavior

Document any known residual manual checks in the checklist file.

---

## Phase 9: Advance The Upstream Anchor

Advance the anchor only after all implementation and verification are complete.

Update:

- `doc/upstream-sync.md`
- `AGENTS.md` `UPSTREAM SYNC`
- the sync checklist for this range

If the upstream working copy uses a `sync-baseline` tag, move it only after the project has fully absorbed the range:

```bash
git -C download/real-time-fund tag -f -a sync-baseline -m "Sync baseline: <target-short> (<date>)" <target-commit>
```

The new anchor should record:

```text
<target-commit>
<target-subject>
<target-commit-date>
```

Remember:

- Plan target = where we intend to sync.
- Anchor commit = where this project has already fully synced.

---

## Stop Conditions

Stop and ask for confirmation if:

- the upstream range includes unexpected large rewrites
- code anchors in the plan are missing
- implementation requires changing the current route-backed architecture
- implementation requires direct business `localStorage` access outside `storageStore`
- verification fails for a reason unrelated to the current task
- the user asks to pause and review before code changes

---

## One-Line Summary

Analyze upstream from the current anchor, write and review a migration plan, implement only after confirmation, verify fully, then advance the anchor to the target commit.
