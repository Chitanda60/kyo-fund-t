# Storage Snapshot Scenarios

Run these scenarios before and after write-heavy refactor tasks. Capture both `createStorageSnapshot()` output and sync events from `installSyncEventRecorder()`.

## How To Load The Harness (dev)

`app/lib/storageSnapshot.js` self-attaches to `window.__storageSnapshot` in development, but only once the module is loaded. During a snapshot task, make it load by **temporarily** adding a dev-only side-effect import at the top of `app/page.jsx` (remove before committing the task):

```js
import '@/app/lib/storageSnapshot'; // TEMP dev-only — remove before commit
```

Then in the browser console:

```js
const rec = window.__storageSnapshot.installSyncEventRecorder();
// ... perform the scenario in the UI ...
const snap = window.__storageSnapshot.createStorageSnapshot('scenario-N');
copy(JSON.stringify({ snap, events: rec.getEvents() }, null, 2)); // save to /tmp/preserve-ui-refactor-snapshots/
rec.restore();
```

Capture the baseline on the OLD implementation first, save the JSON to a scratch file under `/tmp/preserve-ui-refactor-snapshots`, then repeat after the refactor with the same fixed seed data and diff.

## Required Scenarios

1. **Buy with resolved price** (Task 10)
   - Keys to inspect: `holdings` or `groupHoldings`, `transactions`.
   - Expected sync keys: holding key and `transactions`.

2. **Buy without price** (Task 10)
   - Keys to inspect: `pendingTrades`, holding initialization.
   - Expected sync keys: `pendingTrades`, holding key if initialized.

3. **Clear holding** (Task 10)
   - Keys to inspect: holding key, `transactions`, `pendingTrades`, `dcaPlans`, `fundDailyEarnings`.

4. **Delete one fund from a custom group** (Task 12)
   - Keys to inspect: `groups`, `groupHoldings`, `transactions`, `pendingTrades`, `dcaPlans`, `fundDailyEarnings`.

5. **Delete one global fund** (Task 12)
   - Keys to inspect: `funds`, `groups`, `favorites`, collapsed keys, holdings, transactions, daily earnings, dividends.

6. **Move funds between groups** (Task 12)
   - Keys to inspect: `groups`, `holdings`, `groupHoldings`, `transactions`, `pendingTrades`, `dcaPlans`, `fundDailyEarnings`.

7. **Announcement close / non-business storage routing** (Task 14)
   - Keys to inspect: announcement keys only; **no `SYNC_KEYS` event should fire**.

8. **Edit / add / delete fund tags** (Task 9)
   - Action: edit existing fund tags, add a pool tag, delete a global tag, update a global tag.
   - Expected key: `tags`; expected sync key: `tags`.

DCA. **Generate DCA trades** (Task 11)

- Keys to inspect: `dcaPlans`, `pendingTrades`.
- Run a DCA generation scenario on a trading day.

main-tab-route-lifecycle. **Split main tabs into pages** (2026-06-24 migration)

- Baseline (before route cutover): in the old single-route tab UI, navigate `home -> market -> home -> mine` with the nav controls.
- Post-cutover: navigate `/` -> `/market` -> `/` -> `/mine` with app navigation.
- Capture `createStorageSnapshot()` + `installSyncEventRecorder().getEvents()` at the start and end of each sequence, same fixed seed.
- Expected: identical snapshot shape; **no additional `SYNC_KEYS` event fires only because of navigation**.

## Pass Criteria

- Snapshot JSON shape is equal before and after the refactor for the same operation and seed data.
- Sync event key order and count are equal unless the task intentionally batches writes. Any intentional change must be documented in the task commit.
- No extra `SYNC_KEYS` event fires for theme, announcement, auth session cleanup, or other non-business storage.
