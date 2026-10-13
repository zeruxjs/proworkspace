# Section 61 — Campaign Operations, Streaming Audience Imports, Audit & Recovery

This is a larger, cumulative release built on the exact **Section 60** source. It does not replace the existing campaign planner, durable SMTP state machine, provider-feedback ledger, reputation service, analytics, or independent tracking options.

## 1. Function-first campaign workflows (`@zeruxjs/email`)

New APIs on `createMarketingCampaignService(...)`:

- `create({...autoEnqueue:false})` persists the one reusable campaign template plus initial recipients, and deliberately does not enqueue delivery. Existing default (auto-enqueue) is unchanged.
- `appendRecipients(code, entries, enqueueNow?)` adds 1–1,000 recipients per call; canonicalized email addresses map to stable message IDs. Repeating the same data is idempotent; conflicting data for the same address is rejected. The persisted `recipientCount` is recomputed with database-native COUNT.
- `audience(code)` returns actual DB recipient totals, enqueued/unqueued counts, state, and whether the denormalized count agrees with the DB. Counts are not an atomic cross-table snapshot.
- `overview(code)` provides a bounded **PII-free** summary of campaign and enqueue status, provider count, and tracking-enabled flag.
- `previewPage(code,{cursor,limit})` returns at most 20 recipient-specific previews, using the same renderer used for mail. Requires host authorization to render recipient data.
- `pause(code)` / `resume(code)` change a durable campaign gate. Queued workers defer while paused; canceled campaigns suppress. They **do not retract an SMTP operation already in flight**.
- `redrivePending(code,{cursor,limit})` is an explicit, permission-gated recovery operation for lost/removed BullMQ jobs. Only records already checkpointed as enqueued **and still in durable `pending` state** are submitted. `sent`, `uncertain`, `suppressed`, etc. are never redriven by this method. `submitted` counts enqueue calls, not new Redis jobs or delivered messages.
- `enqueue(code)` now persists `queue_failed` after a queue submission failure. Replay uses stable IDs and the durable mail store to prevent a re-send of terminal messages.
- `list(...)` and `recipients(...)` now use `limit+1` lookahead to distinguish an exact final page from a continuation page.

Optional server-only `verifyProvider(account)` confirms configured email account names at creation. Optional PII-free `onAudit({code,action,at,count?})` reports successful lifecycle operations; audit failures never replay side effects. Recipient and campaign tables try to create optional compound indexes for `(campaign_id,id)` and `(campaign_id,enqueued_at)`.

### Usage

```ts
const code = await campaigns.create({
  name: 'Quarterly offer',
  subject: 'Hello {{name}} — {{offer.code}}',
  content: '<h1>Welcome {{name}}</h1><p>Offer {{offer.code}}</p>',
  providers: ['primary_smtp', 'backup_smtp'],
  data: {offer: {code: 'SAVE15'}},
  emails: [{email: 'first@example.com', name: 'First'}],
  autoEnqueue: false,
  isTracking: {enabled:true,opens:true,clicks:true}
});
await campaigns.appendRecipients(code, [{email:'second@example.com', name:'Second'}]);
const totals = await campaigns.audience(code);
const previews = await campaigns.previewPage(code, {limit:10});
await campaigns.enqueue(code);
// Admin may call campaigns.pause(code), resume(code), cancel(code), or redrivePending(code).
```

Email delivery still rechecks marketing consent, suppression, and reputation at the appropriate boundary. Activity tracking remains a separate per-message choice. A campaign template is stored once; recipient data is in a separate durable table and rendered at send time.

## 2. Streaming recipient import and CSV support

New exports from `@zeruxjs/email`:

- `importMarketingRecipients(service, campaignCode, source, options)` — accepts synchronous or asynchronous iterables of addresses or `{email,name,data}` objects. Flushes bounded batches with idempotent replay. Caps each import at 1,000,000 recipients (default 100,000), with `batchSize <= 1000`. Optional `signal` for cancellation, `onProgress` and `enqueueAfter` (enqueue once after a complete import).
- `parseMarketingRecipientCSV(source,options)` — async RFC4180-style CSV reader with quoted cells and line breaks. Inputs can be a string or an async stream of strings/byte chunks. First column must be `email`. Additional columns can be `name`, `data` (JSON object), and `data.<safeProperty>`. Bounds: max rows, input bytes, field/record length and 64 columns. Rejects duplicate and prototype-polluting header names.

```ts
const rows = parseMarketingRecipientCSV(uploadedCsvStream, {maxRows: 100_000});
const result = await importMarketingRecipients(campaigns, campaignCode, rows, {
  batchSize: 200,
  enqueueAfter: true,
  signal: abortController.signal,
  onProgress: ({processed,added}) => audit.info('campaign import progress', {processed,added})
});
```

**Important:** Host code must authorize import operations, serialize concurrent imports for the same campaign, and retry the *same* records after a partial failure. Recipient insertion and count checkpoint are not one database transaction. The `audience()` function shows the actual DB count if a prior import stopped between those writes. Avoid auto-enqueue until import is complete, and never put recipient addresses, HTML content, or provider credentials in a BullMQ payload.

## 3. Core ZeruxJS variable registry

`createVariableRegistry()` now also exposes `renderFields({subject,html,text}, context, options)` and `extract(template)`. A named async resolver is called once per multi-field render; all repeated `{{name}}` tokens across subject, HTML and text get the same value. Options allow per-field HTML escaping, missing-variable behavior, and a bounded combined output size. This registry remains application-scoped and code-registered, not an expression evaluator or JavaScript interpreter.

`@zeruxjs/email` uses `renderFields` when provided, with backward-compatible fallback for third-party renderers that only implement `render`.

## 4. Append-only journal coverage audits

`@zeruxjs/queue` `createDatabaseEmailDeliveryHistory(...).auditCurrent(campaignCode, deliverySource, {cursor,limit})` checks bounded pages of durable delivery records against the **latest observed** recorded transition. It returns only counters (`covered`, `missing`, `stale`, `checked`), cursor and completeness flags, never addresses or message IDs. It does **not** fabricate missing history or claim to recover every intermediate transition.

`page()` now uses lookahead pagination. Optional `(campaign_id,message_id,version)` indexing improves audit lookups. Because state updates and history inserts still lack a shared database transaction, audit coverage is an observation, not a proof of perfect historical completeness.

## 5. Authenticated marketing administration

`createMarketingCampaignDashboard({...})` is an **opt-in** server-side HTTP dashboard with default prefix `/_email/marketing`. It is separate from the existing general campaign planner UI. Application-provided callbacks are mandatory for session authentication, per-campaign authorization, campaign creation, and CSRF verification. Global listing additionally requires `authorizeList`; if absent, list access is forbidden. State-changing requests require a same-origin Origin header plus CSRF verification. No route is mounted automatically.

Controls: create a reusable campaign template (small HTTP batches), read summaries, list campaigns with explicit permission, view original template, inspect bounded recipients and personalized previews, enqueue, pause, resume, cancel, append a bounded batch, and redrive pending jobs. Large imports belong to the trusted streaming server API rather than HTTP JSON requests. Normal overview/list responses exclude message IDs, recipient JSON, credentials and send leases. Preview/recipient views contain PII and require separate action permissions; do not grant them casually.

Runtime integration is exposed as `email.marketingCampaignDashboard` and is stripped from settings passed to the generic EmailManager. A route-conflict or missing authentication error fails startup rather than silently enabling an unprotected console.

## 6. Verification and remaining limitations

Tests cover SQLite (campaigns, CSV import of hundreds of recipients, queue outage recovery, stable IDs, distinct authorization scopes, variable snapshots and history audits), the Email, Queue and Reports regression suites, and a separate core renderer test. Real Redis/BullMQ, live SMTP/SES-provider notifications, large real PostgreSQL/MySQL/MongoDB clusters and complete framework compilation are **not** certified by these tests.

Also outstanding: atomic campaign-recipient import transactions, a distributed import lock, a state+history transaction/outbox, deletion/privacy retention policy for campaign audiences, queue rate tests with live Redis, and true exactly-once SMTP delivery (cannot be guaranteed from simple SMTP acknowledgement). Do not describe SMTP acceptance as inbox delivery.
