# Section 56 — BullMQ task scheduling, email sender reputation and recipient lists

This section builds on Section 55. Email activity tracking (`enabled`, opens, clicks, download links, confirmed downloads) is **independent of marketing subscription**. SMTP acceptance is not proof that a message arrived in an inbox.

## What changed

- **`@zeruxjs/queue`** — `createTaskRegistry()` for explicit code-owned task handlers; `queueService.schedules(queueName)` for delayed single-run tasks, fixed intervals, cron (5/6 fields and IANA time zones), schedule listing and removal using BullMQ 5 Job Schedulers. Schedules persist in Redis and aren't implemented with per-process timers. Payloads are JSON-bound at 8 KiB. A scheduler that references a task without a registered worker handler fails its job instead of executing untrusted code.
- **Redis-coordinated throughput** — configure `workers[queue].limiter = {max, duration}`. BullMQ stores the rate limit in Redis so the participating workers on the same queue coordinate. Ensure the same queue config is deployed to all workers; do not assume that it limits direct SMTP sends that bypass the queue.
- **`@zeruxjs/email`** — `createEmailReputationService` for accepted SMTP recipients and authenticated hard bounce / soft bounce / complaint feedback, with rolling percent rates. `createDatabaseReputationLedger(db)` creates `zerux_email_reputation_events` with an indexed identity/primary key and separate account/kind/timestamp/hashed recipient columns. UUID/sha256-derived event keys make duplicate SMTP and provider feedback idempotent. This is a *separate* table from the recipient suppression table (`zerux_marketing_suppressions`).
- **Sender safety** — default seven-day observed-feedback window, warning at hard-bounce ≥ 2% or complaint ≥ 0.05%, pause marketing at hard-bounce ≥ 5% or complaint ≥ 0.1%, only after ≥ 100 SMTP-accepted recipients. Override the thresholds and sampling minimum to meet local policy. Critical transactional mail remains available by default, with `protectTransactional` opt-in to block it. Any configured marketing reputation lookup failure blocks the send; post-SMTP telemetry errors never result in duplicate sending.
- **Authenticated feedback bridge** — use the existing signed provider webhook adapter to feed *both* recipient suppression and per-account reputation. `feedbackAccount(event)` **must** derive a trusted SMTP-account identity after signature verification. An inbound, unsigned event is never authoritative.
- **Durable contacts** — `createDatabaseMailingContactStore(db)` creates `zerux_email_contacts`. `createMailingListService` can upsert recipients, manage membership, store validated traits, paginate with stable hashed contact IDs and provide a CampaignPlanner `CampaignSource`. Recipient names/addresses stay out of Redis queue payloads.
- **Framework integration** — `email.reputation = {enabled:true,database:'analytics',policy:{...}}` selects a named connector using the server-only `ZeruxConfig`. It must have durable createTable, insert and select support. The queue runtime also accepts worker limiter configuration. Config and DB handles remain private from public runtime manifests.

## Code sample: register cron and interval tasks

```ts
import {createTaskRegistry} from '@zeruxjs/queue';

const tasks = createTaskRegistry();
tasks.register('analytics-reconcile', async ({year}) => {
  // One trusted, bounded job page; do not run unbounded work here.
  return jobs[year].runOnce('analytics-maintenance');
});
tasks.register('cleanup-expired', async () => cleanupExpired());

const queueService = await createQueueService({
  redis:{url:process.env.REDIS_URL},
  queues:['maintenance','emails'],
  workers:{
    maintenance:{processor:tasks.processor,concurrency:2},
    emails:{processor:emailProcessor,concurrency:3,limiter:{max:60,duration:60_000}}
  }
});
const scheduler = queueService.schedules('maintenance');
await scheduler.cron('daily-cleanup',{task:'cleanup-expired'},'15 3 * * *',{timezone:'UTC'});
await scheduler.every('reconcile-2025',{task:'analytics-reconcile',data:{year:'2025'}},60_000);
await scheduler.once('one-time',{task:'cleanup-expired'},new Date(Date.now()+60_000));
const schedules = await scheduler.list();
await scheduler.remove('reconcile-2025');
```

Cron / repeat caveat: BullMQ Job Schedulers generate subsequent jobs when the current scheduled job enters processing; missed executions while Redis/workers are offline are not guaranteed to be caught up individually. Make handlers idempotent: BullMQ processes at least once.

## Configure provider-neutral SMTP reputation

```ts
email: {
  accounts: [{name:'marketing',smtp:{host:'smtp.example.test',port:587,auth:{type:'password',user:'...',pass:'...'}}}],
  reputation: {
    enabled:true,
    database:'reporting',
    policy:{minimumAccepted:100,windowMs:7*86400000,
      warnBouncePercent:2,pauseBouncePercent:5,
      warnComplaintPercent:0.05,pauseComplaintPercent:0.1}
  },
  marketingFeedback: {
    enabled:true,
    suppression: suppressionService,
    verifySignature: verifyProviderSignature,
    parse: parseProviderNotification,
    feedbackAccount: verifiedEvent => mapVerifiedEventToAccount(verifiedEvent)
  }
}
```

Or build directly:

```ts
const reputation = createEmailReputationService({
  ledger:createDatabaseReputationLedger(db)
});
const manager = createEmailManager({
  accounts, preferences, marketingSuppression, reputation
});
const snapshot = await reputation.snapshot('marketing');
// {accepted, hardBounces, softBounces, complaints, bouncePercent, complaintPercent, status,
//  feedbackCoverage:'reported-only', ...}
```

For OAuth2, password, and custom transport authentication, the same `sendMail` manager integration applies; authentication mode does not change the reputation policy. SMTP cannot reveal later spam reports or hard bounces on its own. Wire the authenticated provider feedback API (SNS/SES, mail delivery providers, or trusted DSN processing). The thresholds follow SES-like guidance but **are not Amazon SES account health** or a guarantee of deliverability.

### Contacts

```ts
const lists = createMailingListService({store:createDatabaseMailingContactStore(db)});
await lists.upsert('customer@example.com',['newsletter','premium'],{region:'AU',lifetimeValue:1200});
const source = lists.campaignSource('newsletter');
// Pass source into createCampaignPlanner; it still separately verifies opt-in and suppressions.
```

## Correctness and deployment limitations

- The per-account percentages count **observed signed feedback** over **SMTP-accepted recipient events**, not the provider's entire reputation scoring universe. Some recipients or providers never send feedback; percentages can undercount complaints. Forwarding/aliasing can distort numerator and denominator. Never call these exact inbox delivery rates.
- The reputation snapshot currently pages the event ledger (with `scanLimit` and fail-closed overflow) instead of maintaining an incremental materialized daily counter. For high-volume production, add aggregate tables or native database COUNT queries and indexes for `(account, occurred_at)` before using this as a high-throughput pre-send guard.
- If SMTP accepted a message but ledger recording failed, the email is **not** retried for the sake of telemetry. A reconciliation task is needed to recover missing acceptance events from provider logs.
- Bounce and complaint protection is effective only with verified feedback routed to the service. Unverified webhook bodies must never be treated as signed. If the provider offers no feedback mechanism, report that visibility is incomplete rather than claiming the reputation is healthy.
- Shared SQL/Mongo database connectors should be validated live for the contact/reputation table semantics. Tests use mock DB contracts. Redis/BullMQ live integration remains skipped in this environment; the full framework typecheck still has unresolved workspace imports.
- Marketing subscription/suppression and per-message email activity tracking have separate state, independent code paths and policies. These changes do not switch tracking on or off.
- Contacts are stored as PII in the configured DB. Restrict access, establish retention and deletion policy, and avoid sharing these rows through scheduler payloads or public dashboards.

## Test coverage

`tsc -p packages/@zeruxjs/email` and `tsc -p packages/@zeruxjs/queue` pass with local dependency links. Selected Email, Queue and runtime tests: **88 passed, 1 live Redis test skipped, 0 failed**. Tests include signed feedback, per-account rate gating, idempotent replay, cron/interval/one-off registration, worker limiter validation, contact membership and keyset pagination, and framework runtime cleanup. Do not equate injected drivers with a live Redis/SMTP production test.

Official references: https://docs.bullmq.io/guide/job-schedulers/ and https://docs.aws.amazon.com/ses/latest/dg/reputationdashboardmessages.html

## Section 56 continuation — operational safety and data removal

- **Reputation scan boundary**: a history containing exactly `scanLimit` rows now remains valid; a one-row lookahead refuses the verdict only when more rows exist. If the reputation DB is unavailable or exceeds the limit, marketing email still fails closed; transactional email retains its explicit policy.
- **Soft-bounce monitoring**: account health now returns `softBouncePercent`, and can optionally warn or pause at configured `warnSoftBouncePercent`/`pauseSoftBouncePercent`. These two settings must be provided together and represent observed provider feedback, not guaranteed inbox delivery. Default policy remains based on hard bounces and complaints.
- **Data quality**: `sampleSufficient` is returned with every reputation snapshot. A `healthy` status with `sampleSufficient:false` means there is insufficient SMTP acceptance history for threshold enforcement; it does not prove sender health.
- **Recipient erasure**: `mailingLists.erase(email)` removes stored address, traits and membership using version-checked deletion (if the connector implements an atomic `delete` with `affectedCount` or `rowCount`); memory stores support the same API. Erasure is not suppression. An explicit reimport can recreate the contact, and campaign recipients already queued still require independent consent/suppression checks before sending. Applications must separately purge replicated/backups and tracking data according to their retention policy.
- **One-off task cancellation**: `queueService.schedules('maintenance').cancelOnce('task-id')` safely removes waiting/delayed one-off tasks. It cannot cancel active jobs, and fails closed when the driver lacks the required state/remove APIs. Use `.remove(id)` for recurring cron and interval schedules.

These changes use existing exposed package surfaces, retain per-message tracking independence, and add regression tests. Real BullMQ/Redis and live multi-server PostgreSQL/MySQL/MongoDB SMTP feedback tests remain prerequisites before production certification.
