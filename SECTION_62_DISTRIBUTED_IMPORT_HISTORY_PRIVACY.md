# Section 62 — Distributed marketing imports, delivery-history discrepancy ledger and contact retention

This release extends the Section 61 function-first marketing/queue system without changing email consent, independent per-message activity tracking, sender reputation policies, or the rule that Redis holds only opaque IDs.

## 1. Multi-node campaign audience import coordinator — `@zeruxjs/email`

`createMarketingImportJob(options)` coordinates an **immutable paginated import source** across multiple workers using the shared database, not process-local locks.

- Separate `zerux_marketing_import_jobs` CAS document table. Its `id` is a SHA-256 hash of campaign code and job ID, not a contact address.
- An explicit `sourceRevision` binds checkpoints to a *fixed immutable source snapshot*, with strict job/campaign/batch-size identity checks. A new source revision needs a **new job ID**.
- A 3 s–1 h lease with owner, random token and monotonically increasing epoch is atomically acquired with `UPDATE ... WHERE version = expected`. Only one valid worker may checkpoint a page. A lost worker's stale checkpoint is rejected.
- `runOnce(workerId)` loads at most one page (maximum 500 recipients; default 200). It renews its lease while paging/inserting, appends through the existing idempotent `campaigns.appendRecipients()` API, and advances the durable cursor only after a successful insert batch. Failed pages retain the cursor and can replay on another worker.
- `acquire`, `renew`, `commit`, `cancel` and `get` support trusted worker operation and recovery. Cancellation invalidates active leases, though an already-started append can finish; cancellation never retroactively rolls back inserted recipients.
- `get()` reports job counters and a lease owner/expiry but never reveals lease tokens, recipients, email addresses or campaign template HTML. Failed-page error details are classified before checkpointing rather than storing exception messages that might include PII.
- Source pages must be **keyset ordered and replayable** and must use opaque, monotonically increasing, URL-safe cursors. Changing a mutable source or reusing sourceRevision makes correctness unverifiable.

### Example

```ts
import {createMarketingImportJob, enqueueMarketingImportJob,
        createMarketingImportProcessor} from '@zeruxjs/email';

const importJob = createMarketingImportJob({
  db: reportingDb,
  id: 'vip-2026-10-batch',
  campaignCode: code,
  sourceRevision: 'crm-export-v003-immutable',
  batchSize: 200,
  source: {
    page: ({cursor, limit}) => immutableCrmExport.page({cursor, limit})
  },
  append: (campaignCode, rows) => campaigns.appendRecipients(campaignCode, rows)
});

// Any replica can process one page; calling this more than once is safe.
const result = await importJob.runOnce('worker-eu-1');

// BullMQ adapter: Redis sees {id,campaignCode} and nothing else.
await enqueueMarketingImportJob(bullQueue, 'vip-2026-10-batch', code);
const processor = createMarketingImportProcessor(async (id, campaignCode) => {
  // Resolve an allowed, pre-registered source and DB-backed job here.
  // Reject unknown campaign/job IDs rather than opening arbitrary sources.
  return importJob;
});
await processor({data: {id:'vip-2026-10-batch',campaignCode:code}}, 'worker-eu-1');
```

**Operational note:** Each invocation handles **one page**. The application should run a registered recurring/continuation task or call `runOnce` repeatedly until `status === 'completed'`. This release does not automatically schedule future pages. Backfill is at-least-once; correctness depends on the recipient unique IDs and idempotent `appendRecipients`.

## 2. Versioned delivery-history observations — `@zeruxjs/queue`

`createDatabaseEmailDeliveryHistory(...).latest(campaignId,messageId)` reads the latest recorded transition (internal/trusted operation). `createDatabaseDeliveryHistoryGapLedger(db)` writes separate, immutable observations into `zerux_email_history_gaps` keyed by `(campaign,opaque message ID,current version)`. These are **not fabricated delivery transitions**.

`createDeliveryHistoryGapScanner({source,history,ledger})` checks one bounded page (maximum 200 delivery records) and records:

- Missing: no transition exists in the append-only history.
- Stale/review-needed: last recorded state or version does not match the current materialized delivery record. A version mismatch can also be a legitimate metadata-only update; operators must not assume a missing state transition is proven.
- Covered: the current version and state match the most recent journal entry.

The response contains only checked/covered/missing/stale/observationsCreated counts and a continuation cursor, never addresses or rendered content. The observation ledger is deduplicated across retries, detects conflicting observations at the same version, and provides internal keyset pagination. The original transition table remains immutable, and no event is backdated.

```ts
import {createDatabaseEmailDeliveryHistory,
        createDatabaseDeliveryHistoryGapLedger,
        createDeliveryHistoryGapScanner} from '@zeruxjs/queue';

const history = createDatabaseEmailDeliveryHistory(db);
const gaps = createDatabaseDeliveryHistoryGapLedger(db);
const scan = createDeliveryHistoryGapScanner({source: deliveryStore, history, ledger:gaps});
const page = await scan(code, {cursor:null,limit:100});
// page.covered, page.missing, page.stale, page.nextCursor
```

**Limit:** Neither a gap observation nor latest-state agreement proves a complete historical timeline. State and journal writes are **still not one database transaction**. Metadata-only version updates can create review-needed observations even when no state change was missed. Transactional outbox support remains a future task.

## 3. Bounded contact retention and erasure — `@zeruxjs/email`

`sweepMailingContactRetention(options)` adds an explicit, **dry-run by default** contact cleanup workflow:

- Requires a deterministic `olderThan` UTC millisecond cutoff and a host-owned `canErase(contact)` policy callback. The callback must check legal holds, customer records, active campaigns, subscription records and any other retention dependencies.
- Reads sorted keyset pages (1–200 contacts) with an upper bound of 10,000 inspected records per invocation. Progress returns `nextCursor` so the next task can continue. At an exact limit, `done` remains false rather than guessing the end.
- Re-reads each eligible row before erasure and uses the store's version-checked atomic delete to prevent deleting a concurrently modified contact. Missing atomic-delete support causes a hard error before erasure starts.
- Returns only counts, cursor and a dry-run flag; optional `onErased({contactId,at})` contains an opaque hashed contact ID rather than the plaintext address. If the audit hook fails *after* deletion, the deletion is not repeated.

```ts
const result = await sweepMailingContactRetention({
  store: durableContactStore,
  olderThan: Date.parse('2025-01-01'),
  dryRun: true, // explicitly change to false for authorized deletion
  maxScanned: 1000,
  canErase: (contact) => compliance.mayErase(contact.email)
});
```

**Scope:** This erases from the **contact-list table only**. It does **not** delete separately held message-recipient records, marketing consent, suppression safety records, SMTP provider logs, or audit records. Those require independent, policy-compliant retention and erasure decisions. Never erase suppression records merely to make an address eligible for marketing again.

## 4. Verification and database compatibility

- SQLite integration tests: two independent DB connections coordinate the same import; fail/retry without cursor loss, fence stale workers, detect conflicting source revisions, cancel an active lease; gap observation and repeated replay; contact-retention policies and cross-connection atomic deletion.
- Six package suites (`email`, `queue`, `reports`, `analytics`, `tags`, `cache-redis`) pass with one **skipped live Redis** test. TypeScript builds pass for all six packages plus the cache prerequisite, and core `variables.ts` passes isolated strict checking.
- Other SQL/Mongo connectors are structurally supported where they implement atomic conditional `update` and affected-row counts, but **live PostgreSQL/MySQL/MongoDB multi-node testing is not included**. The Section 61 full-framework build still has unresolved workspace packages and was not certified by the focused checks.
- Integration tests use Node's experimental built-in SQLite driver; production Redis/BullMQ, provider feedback, inbox delivery and real SMTP outcomes are not verified here.
