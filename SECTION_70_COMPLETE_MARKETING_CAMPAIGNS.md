# Section 70 — Complete function-based marketing campaigns and operations

Date: 13 October 2026. Scope: reusable `@zeruxjs/email` and supporting Queue APIs; **no AIO/CoreDNS/proxy/TLS/DNS infrastructure**.

## Result and architecture

`createMarketingCampaignService` is a DB-backed, server-side campaign interface. The campaign row stores **one subject, one HTML body and/or one plain body**, provider identifiers, a JSON global context and optional segmentation. Recipient rows contain only their own normalized email/name/JSON overrides and a deterministic message ID. No recipient-specific rendered HTML is copied to every row or placed in Redis jobs.

The workflow now includes `create`, `get`, `list`, `recipients`, `preview`, `previewPage`, `schedule`, `enqueue`, `appendRecipients`, `audience`, `overview`, `report`, `pause`, `resume`, `cancel`, `finalize`, `redrivePending`, `exportPage`, `archive` and `redactArchived`. Other existing helpers (`importMarketingRecipients`, `parseMarketingRecipientCSV`, `createMarketingImportJob`, `createVariableRegistry`) continue working. This section does not rename/remove the earlier Section 55 `createCampaignPlanner` API.

### Example: functions only

```ts
import {
  createMarketingCampaignService,
  createDatabaseMarketingAuditLog,
  importMarketingRecipients,
} from '@zeruxjs/email';
import {createVariableRegistry} from 'zeruxjs/variables';

// db must be the project's selected real DB connector implementing atomic
// insert and UPDATE ... WHERE version = expected, with affectedCount.
const auditLog = createDatabaseMarketingAuditLog(db);
const variables = createVariableRegistry();
variables.register('app.support', () => 'support@example.org');

const campaigns = createMarketingCampaignService({
  db,
  queue: publishIntentProducer, // Section 69 outbox-backed queue recommended
  delivery: durableDeliveryRegistrationStore,
  renderer: variables,
  verifyProvider: async account => configuredEmailAccounts.has(account),
  isSubscribed: email => preferences.isSubscribed(email),
  isSuppressed: email => suppressions.isSuppressed(email),
  verifyMissingJob: async id => !(await bullQueue.getJob(id)),
  approveRetention: async campaign => legalHolds.allowCampaignRedaction(campaign.code),
  authorize: async (action, code) => permissions.canManageCampaign(action,code),
  onAudit: auditLog.record,
});

const code = await campaigns.create({
  name: 'Autumn launch', subject: 'Hi {{name}} from {{app.support}}',
  html: '<p>Use {{offer}}</p>', text: 'Offer: {{offer}}',
  account: 'primary', data: {offer:'AUTUMN'},
  recipients: [{email:'opted-in@example.org',name:'Sam',data:{offer:'PERSONAL'}}],
  segment: {all:[{field:'tier',operator:'eq',value:'gold'}]},
  isTracking: false, // no implicit opens/clicks
  autoEnqueue: false,
});

const page = await campaigns.recipients(code,{limit:50});
const message = await campaigns.preview(code,page.recipients[0].id);
await campaigns.schedule(code,Date.now()+3600_000); // enqueue allowed audience
const result = await campaigns.report(code,{limit:200});
// Once every queued recipient has a terminal result:
// await campaigns.finalize(code); // status becomes 'completed'
const exportPage = await campaigns.exportPage(code); // redacted by default
// Later: await campaigns.cancel(code), or finalize(code) after terminal sends.
// await campaigns.archive(code);  // only after queued deliveries are terminal
```

The example filter (`tier === gold`) deliberately excludes the demonstration recipient until its `data.tier` is provided; preview is still allowed. Use `createMarketingImportJob` or `importMarketingRecipients` for larger sources; the one-call create cap remains **1,000 recipients**, append/import batches are bounded, and the `schedule`/`enqueue` APIs operate in **200-recipient pages**. `schedule` defaults to queueing all eligible recipients, with `enqueueNow:false` available for a future external outbox drain. Absolute `sendAt` is Unix **milliseconds**, no more than 365 days ahead.

## Variable and audience rules

- Shared `createVariableRegistry()` resolvers support `{{path}}` in subject, HTML and text and resolve a consistent snapshot per recipient with appropriate HTML escaping; each campaign stores a single copy of the template. Plain JSON `{...globalData,...recipientData}` overrides global values, and reserved `name`, `email`, `campaign` fields are supplied by the service.
- `segment` uses the Section 55 validated `all`/`any` criteria. Queue selection reads primitives from individual JSON properties, plus `name` and `email`. Other JSON object values are usable in templates, not numeric/primitive segment matching. The audience remains stored for reporting even if filtered out.
- Duplicate recipients are normalized by address. A creation batch rejects duplicates, and a replayed append/import compares persisted name and JSON before treating duplicates as idempotent. Streaming CSV fields/data are bounded by the existing parser.
- Optional service `isSubscribed` and `isSuppressed` run before adding jobs or redriving, and again on `sendById`. An explicit false consent or true suppression excludes a recipient; configured lookup exceptions fail closed. **These hooks do not replace the mandatory independent consent/suppression checks in `createDurableEmailDeliveryProcessor` and `EmailManager` immediately before SMTP**. Do not run production marketing without configuring those independent policies.
- Providers are validated when `verifyProvider` is installed. A stable per-recipient hash selects a provider from the configured set; no SMTP credential is stored in a campaign or BullMQ payload.

## Scheduling, races, pause and recovery

- A shared JSON/CAS **operation lease** serializes append/import pages, queue publishing, manual redrive, time changes, completion, and archive/retention checks across processes using the campaign's stored version. Default expiry is 5 minutes, renewed for long operations. Another worker sees a bounded `operation is busy` error and can retry later; crash recovery occurs after lease expiry. Queue operations use deterministic job IDs and recipient checkpoint CAS.
- Rescheduling is **intentionally forbidden after any recipient is checkpointed as enqueued**: do not silently change a stored campaign timestamp while an old delayed BullMQ job still exists. Create with `autoEnqueue:false`, preview, then `schedule`. `schedule` while paused updates the timestamp without queueing; `resume` restores readiness. Pause/cancel check `deliveryGate` in the durable processor; already-in-flight SMTP actions cannot be retracted.
- Publication to Redis and the database remain independent commits. Prefer Section 69's outbox producer and polling dispatcher, and its missing-intent recovery, instead of a raw BullMQ queue for crash-proof pending work. **Exactly-once SMTP sending is not claimed.** The receiving mail server's final delivery is also not proven by an SMTP `sent` state.
- Manual `redrivePending` requires explicit `authorize('redrive')` and a positive queue-job absence check through `verifyMissingJob` or `queue.getJob`. It only republishes durable `pending` records originally checkpointed as enqueued. It does not redrive `sending`, `sent`, `suppressed`, `uncertain`, or `rejected` states. If the real queue cannot be queried, it **fails closed** rather than republishing blindly. Use Section 69's outbox-aware redriver when using outbox publication.
- Lease checks constrain races but do not create a DB/Redis distributed transaction; a publisher that is interrupted mid-request may still leave a recoverable intention. Lease expiry during a slow external queue call, DB outages, and time skew must be addressed operationally. A production job runner should keep commands idempotent, run on consistent time, monitor outbox backlog, and retry `busy` errors.

## Reports, privacy and retention

- `overview` and `audience` provide per-campaign counts. `report(code,{cursor,limit})` returns a bounded page's delivery-state counts (`notQueued`, `pending`, `claimed`, `sending`, `smtpAccepted`, `suppressed`, `uncertain`, `rejected`, `missing`), `scanned`, `nextCursor`, and whether this is a complete first page. For large campaigns **sum all pages**; do not call a partial result an exact full-campaign total. `smtpAccepted` is not provider-verified delivery or a unique open.
- `exportPage` is PII-redacted by default and contains only opaque message IDs and delivery states. `includePII:true` requires a separate `authorize('exportPII')` permission, and is server API-only, never exposed by the dashboard. Other read/render privileges must also be checked; server helpers intentionally need trusted application access controls.
- `createDatabaseMarketingAuditLog(db)` exposes `{record,page}`; pass `onAudit: audit.record`. It writes only campaign code/action/timestamp/count and does not write recipient email, MIME, credentials, or dynamic JSON. The audit callback is **best effort and not transactional** with command execution; emit independent alerts for failed audit writes where your policy requires guaranteed auditing.
- `finalize(code)` transitions a `ready` campaign to `completed` only after a bounded full scan proves that every enqueued recipient has a terminal `sent`/`suppressed`/`rejected` durable transport outcome (never from SMTP delivery guesses). `archive(code)` requires `cancel` **or** `finalize` and a separate bounded full scan that rejects any recipient in `pending`, `claimed`, `sending`, `uncertain`, or with missing checkpoint. Only confirmed terminal transport states (`sent`, `suppressed`, `rejected`) or never-enqueued recipients allow archival. An archive is read-only, stops future processing, and **does not erase PII by itself**.
- `redactArchived(code,{olderThan,cursor,limit,dryRun})` is a separate, default dry-run, legal-hold-approved page-wise deletion of archived campaign **recipient rows**. On reaching the last page with `dryRun:false`, the function clears stored content/provider/JSON and retains safe historical metadata/counters. It requires a DB connector with atomic `delete`, `authorize('retention')`, and `approveRetention`; the archive must predate the cutoff. Continue via returned `nextCursor`, or replay from null after a crash. **Durable delivery records, activity events, suppression/consent, logs, audit data and external provider records are NOT erased here**; apply separate retention policies to those systems.

## Operator dashboard

`createMarketingCampaignDashboard` is an **opt-in**, CSP-restricted, cookie-private route. The host must supply `authorize`, `authorizeCampaign`, `authorizeCreate`, `verifyCsrf`, and `csrfToken`; list-all access requires `authorizeList`. Every state-changing action checks same-origin POST and a trusted CSRF verifier. The new operator controls include time scheduling, paginated recipient/preview/list/results views, redacted exports, terminal-delivery finalization and archive. Raw template content is only displayed for an individually authorized `template` view. Sensitive per-recipient `data` and provider names are not surfaced by overview/recipient/export widgets. Always place behind the host's tenant-scoped session checks.

## Verification performed locally

- Built `@zeruxjs/email` TypeScript from source with the installed global compiler and temporary local Node typings.
- Ran the email-package test suite, including a new **415-recipient** paginated segmentation/scheduling test, dual-worker SQLite CAS contention, consent/suppression, terminal completion, archives with uncertain delivery outcomes, redaction and explicit PII permissions, durable audit and HTTP CSRF/origin/tenant permission checks.
- Ran the adjacent Queue package suite, including outbox/recovery tests, after locally building the internal packages from source.
- **Not certified here:** registry-backed clean `npm ci` from an untouched clone (Section 66 remains open), real live BullMQ/Redis SMTP submission/fault injection, true multi-connector PostgreSQL/MySQL/MongoDB campaign load tests, tenant-specific production RBAC, provider webhooks, actual GitHub CodeQL execution. The SQLite tests exercise real SQL connector behavior but not these external environments.

## Files

`apps/proworkspace/packages/@zeruxjs/email/src/marketing.ts`, `marketing-audit.ts`, `index.ts`, `marketing-dashboard.ts`; Section 70 tests under `apps/proworkspace/packages/@zeruxjs/email/test/` and a single compatibility change to the old operator redrive test. See Section 69 for outbox wiring.
