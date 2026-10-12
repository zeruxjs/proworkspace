# Section 51 — Durable reconciliation jobs, fenced leases and crash recovery

This release builds on Section 50's **administrator-only** numeric backfill. It adds persisted job records and cross-process coordination; it does not launch a background queue or turn numeric aggregates into certified accounting records.

## Public API

```ts
import {randomUUID} from 'node:crypto';

// Use a shared @zeruxjs/db connector and an existing UNIQUE(event_id,property_name)
// index. Initialize analytics once for each worker's runtime generation.
const analytics = createAnalytics({
  analytics: 'reporting', database: dbManager,
  numericFields: ['value', 'quantity']
});
if (!await analytics.initialize()) throw new Error('Analytics DB not ready');

// Only create these from authenticated maintenance code, not a public route.
const job = analytics.createReconciliationJob(
  'historic_store_2025',
  {
    since: Date.parse('2025-01-01T00:00:00.000Z'),
    until: Date.parse('2025-12-31T23:59:59.999Z'),
    site: 'storefront',
    batchSize: 100 // one scan page, 1..200
  },
  { leaseMs: 60_000 }
);

// Call from a scheduler, queue worker, or a supervised maintenance command.
const workerInvocation = `worker-${randomUUID()}`;
const result = await job.runOnce(workerInvocation);
if (result.busy) {
  // Either another worker owns a live lease OR the scan has already finished.
  // Inspect result.state.status and use scheduler-level backoff; never spin.
}
console.log(result.state.status, result.state.cursor, result.state.scanned);

// After the last page is persisted, state.status is "completed".
// To pick up late/backdated events, explicitly begin another full pass:
// await job.restart(); // refused while any unexpired lease is held
```

`job.get()` returns the current durable snapshot, with the worker lease owner and expiry but **without the fencing token**. `job.acquire(owner)`, `job.renew(lease)`, `job.checkpoint(lease,page)`, `job.fail(lease,error)`, and `job.restart()` are available for custom trusted coordination, but `runOnce(owner)` is the recommended bounded one-page operation. `runOnce()` uses a temporary lease-heartbeat timer **only during the awaited operation**; it does not create a persistent background worker, schedule retries, or continue after the caller terminates.

## Storage and safety guarantees

- A separate `<events table>_reconcile_jobs` table stores one CAS-versioned JSON record per job ID. The table is created lazily with a primary key. The existing `@zeruxjs/db` conditional `UPDATE ... WHERE id=? AND version=?` is the atomic ownership/checkpoint primitive. Connectors **must report** accurate `affectedCount` or `rowCount`; missing counts are an error, not a false success. `createReconciliationJob()` fails if the configured database lacks the conditional-update facade, initialized numeric materialization, or the verified/external unique event-property index.
- Each lease has a random token, worker ID, expiry and monotonically increasing epoch. Another worker cannot acquire an unexpired lease; an expired lease can be reclaimed. Checkpoint, renewal, and error-state updates require the current token/epoch, an unexpired lease, and a successful version CAS. Stale worker writes cannot advance another worker's checkpoint.
- Every successful page saves its source cursor and cumulative `scanned`, `expectedFacts`, `created`, `existing`, `invalidRows`, and `pages` atomically in the job record. A crash between writing numeric facts and saving the cursor causes that page to be replayed, using Section 50's unique `(event_id,property_name)` index and idempotent fact inserts.
- A job ID is tied to its immutable UTC time window, site, page size, events/facts tables, and **sorted numeric field set**. Reusing that ID with different parameters or an incompatible projection configuration fails rather than silently adopting the old cursor. Numeric field reordering alone is safe.
- A failed page is recorded as `failed` (with a bounded diagnostic) only if its worker still owns the lease; no cursor is advanced. The next trusted scheduler invocation can reclaim and retry it. A `completed` status means **this keyset source scan exhausted its window at that moment**, not an atomic snapshot or certified numerical coverage.
- Explicit `restart()` begins a fresh pass (with incremented pass/epoch and reset counters) and is rejected while a live lease exists. Use it for late/backdated inserts, gaps left by partial writes, or subsequent audits. Never automatically restart a completed job in a tight loop.

## Deployment notes and limitations

1. **All replicas must use the same persistent database**, schema, job ID, indexed fact collection, and synchronized system clocks. Lease duration must exceed clock drift and be appropriate to DB latency; the heartbeat may miss its deadline during a process pause, and a losing worker must tolerate page replay. Clock skew cannot be eliminated by process-local `Date.now()`; production deployment should monitor NTP drift or use DB-time-based coordination in a future version.
2. A database's `CREATE TABLE`/primary-key semantics and atomic conditional UPDATE must be genuine. For MySQL, external index migration is recommended for the Section 50 unique numeric-fact index. Do not assert `numericUniqueIndexManagedExternally:true` without validating that constraint in the actual DB.
3. Per-event ingestion is still best-effort and its numeric fact projection is nontransactional. Jobs may have invalid historical properties (`invalidRows`) or encounter conflicting facts and reject. `completed` does **not** assert that no source event was inserted during the scan or that all historical numeric facts exist. No snapshot cutoff watermark, deletion/erasure propagation, distributed supervisor, automatic retry policy, scheduler, or comprehensive multi-node production certification is provided here.
4. Backfill is an **administrative** operation with explicit site and time bounds. Exposing it directly over a public HTTP route would risk expensive scans and tenant data disclosure. Limit job frequency, concurrency, and cumulative window sizes through your trusted operations tooling.
5. The shared documents store writes a full JSON record on each checkpoint; don't treat it as a high-volume event-ingestion queue. Production reporting continues to label numeric aggregates `coverage:'indexed-only'`.

## Verification matrix

| Connector | Verification | Remaining work |
| --- | --- | --- |
| SQLite | **Real on-disk SQLite**, two independent connector instances, 211 events, 422 facts, lease expiry/reclaim, stale fencing, failure/retry, explicit restart and late data | Production-grade coordinator clock and busy/lock operational testing |
| PostgreSQL | SQL compiler verifies `UPDATE ... WHERE id AND version` and result `rowCount` handling | Real PostgreSQL instance/replica, isolation, permission and lease-expiry tests |
| MySQL | SQL compiler verifies parameterized CAS update and `affectedRows` | Real MySQL/InnoDB instance, migration and isolation tests |
| MongoDB | Existing connector unit tests and `modifiedCount` update mapping included in regression | Live replica-set CAS, unique-index and failover tests |

### Test commands

```bash
cd apps/proworkspace
# Build @zeruxjs/db, @zeruxjs/db-sql-core, @zeruxjs/db-sqllite, @zeruxjs/analytics,
# @zeruxjs/tags and @zeruxjs/reports first, with workspace type dependencies.
node --test packages/@zeruxjs/analytics/test/jobs.test.mjs
npm run test:analytics-job-sqlite
npm run test:analytics-job-sql-compiler
```

## Unchanged contracts

Browser `ttag()` and server `astag()` event requests, UTC-day request IDs, GA4/webhook tag dispatch, Reports charts, and independent opt-in email open/click/download activity remain unchanged. Telemetry insert failures remain best-effort warnings; **administrative** backfill errors intentionally reject rather than being silently ignored.
