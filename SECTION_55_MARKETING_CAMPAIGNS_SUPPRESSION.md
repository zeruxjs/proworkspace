# Section 55 — Durable marketing campaigns and suppression bridge

## Summary

Extends Section 54 without replacing BullMQ, email manager, consent preferences or independent activity tracking. New APIs in `@zeruxjs/email`: `createCampaignPlanner`, `createDatabaseCampaignStore`, `createCampaignDeliveryGate`, `matchesCampaignSegment`, `createMarketingSuppressionService`, `createDatabaseMarketingSuppressionStore`, `createMarketingFeedbackEndpoint`, `createCampaignDashboard`, and `createCampaignAnalyticsReporter`. `@zeruxjs/queue` adds `enqueueCampaignPlan`, `createCampaignPlanningProcessor`, and campaign-aware pre-SMTP policy checks in `createDurableEmailDeliveryProcessor`.

## Architecture and safety

- Campaign definitions are **durable** version-checked records: `draft → scheduled → running → completed`, with `paused`/`cancelled` controls. Completed means *audience planning/enqueueing finished*, not that all recipients received mail.
- Pages are limited to 1–200 contacts. The generic SQL JSON-document adapter caps serialized checkpoints at 60 KB to fit portable `TEXT` columns (including MySQL); lower `batchSize` for unusually long recipient addresses or segment definitions. The host provides a stable cursor-paginated, campaign-scoped `source.page`, not a public contact-list endpoint. The host is responsible for stable ordering, unique recipients across pages, and tenant isolation. Segment conditions have a bounded, typed allowlist (`all`, `any`, eq/ne/in/gt/gte/lt/lte/exists); no dynamic JavaScript execution or SQL fragments are accepted.
- The planner checks explicit marketing opt-in and suppression before persisting staged recipients. If either read fails, **no page advance occurs**. The queued mail worker and email manager each support a fresh check just before SMTP sending. Marketing subscriptions and email *activity tracking* remain independent.
- A staged page is persisted **before** calls to `ensureMessage` and `enqueue`, with a CAS lease and a per-target checkpoint after each enqueue. Failures preserve remaining pending targets. Message IDs are deterministic SHA-256-derived opaque IDs; the host's `ensureMessage` MUST perform an idempotent insert and `enqueue` MUST use a deterministic BullMQ job ID. Provider SMTP remains at-least-once; use the Section 54 durable delivery state machine for uncertainty rather than blind retries.
- The planner stores recipient identifiers only in the private, durable campaign state, **not** in Redis jobs. The `campaign.plan` job payload contains only campaign ID and monotonic sequence. A stable storage-backed CAS adapter is required in multi-instance deployments.
- A cancelled campaign's queued email is suppressed by the **delivery-time** campaign gate. Paused/scheduled campaigns defer pre-SMTP delivery and should be retried by policy; already in-flight provider calls cannot be revoked. Do not use queue-wide pause alone for campaign cancellation.
- Suppression records use a canonical email hash as DB key, versioned compare-and-swap, and replay detection for up to the last 128 provider event IDs per recipient. Hard bounce, complaint and manual feedback block immediately; soft bounces block at configurable threshold (default 3). Dedupe is bounded; a long-lived provider event ledger is a future capability.
- A provider webhook is never trusted by default: the optional HTTP adapter requires a host-supplied `verifySignature(rawBytes,headers)` **and** payload parser. The signed raw payload is capped (default 64 KiB), with a read timeout and max 100 records per request; storage failures return 503 for provider retry. No default public webhook URL or signing secret is supplied by ZeruxJS.
- `createCampaignAnalyticsReporter(analytics,site)` emits best-effort `email.campaign.scheduled|queued|completed|cancelled` events without emails, message content, or browser tracking data. These metrics are operational telemetry, can be missing on crashes, and must not replace durable campaign counters. Reports can graph events using the internal analytics source; numerical `count` aggregation requires `numericFields:['count']` and the existing numeric materialization/reconciliation caveats.
- The optional `/_email/campaigns` UI demands host session authentication, **per-campaign authorization**, CSRF verification, same-origin POSTs, bounded body parsing, and redacted responses. It contains create/schedule/pause/resume/cancel/status controls plus basic JSON audience conditions and independent tracking toggles. No default login or public dashboard exists. The optional `/_email/feedback` signed intake is separately configured.

## Configuring storage and a planner

```ts
import {
  createDatabaseCampaignStore,createDatabaseMarketingSuppressionStore,
  createMarketingSuppressionService,createCampaignPlanner,
  createCampaignDeliveryGate,createCampaignAnalyticsReporter
} from '@zeruxjs/email';
import {enqueueEmailById,enqueueCampaignPlan,createCampaignPlanningProcessor} from '@zeruxjs/queue';

const db = database.getConnectionFacade('app'); // Must implement atomic affectedCount on conditional UPDATE
const campaignStore=createDatabaseCampaignStore(db);
const suppression=createMarketingSuppressionService({store:createDatabaseMarketingSuppressionStore(db)});
const planner=createCampaignPlanner({
  store:campaignStore,
  // Implement cursor-stable, recipient-unique page reads from your PRIVATE contact database.
  source:{page:({cursor,limit})=>contacts.listPage({cursor,limit})},
  isSubscribed:email=>preferences.isSubscribed(email),
  isSuppressed:email=>suppression.isSuppressed(email),
  // CAS/unique durable insert: persist marketing message, campaign ID and explicit tracking policy.
  ensureMessage:(target,{campaignId,tracking})=>mailStore.ensureById(target.messageId,{
    campaignId,recipient:target.recipient,purpose:'marketing',tracking
  }),
  enqueue:(messageId,sendAt)=>enqueueEmailById(queueService.queue('emails'),messageId,{
    delay:Math.max(0,sendAt-Date.now())
  }).then(()=>{}),
  onMetric:createCampaignAnalyticsReporter(analytics,'storefront')
});

const draft=await planner.create({id:'october_news',name:'October newsletter',sendAt:Date.now()+3600000,
  segment:{all:[{field:'region',operator:'eq',value:'AU'}]},
  tracking:{enabled:true,opens:true,clicks:true} // OPTIONAL; consent does not enable this
});
await planner.command(draft.id,'schedule');
await enqueueCampaignPlan(queueService.queue('campaigns'),draft.id,{delay:Math.max(0,draft.sendAt-Date.now())});

const processor=createCampaignPlanningProcessor({
  planners:{october_news:planner},
  // Schedule a fresh unique sequence; respect sendAt if returned status === 'scheduled'.
  scheduleNext:(id,sequence,status)=>enqueueCampaignPlan(queueService.queue('campaigns'),id,{
    sequence,delay:status==='scheduled'?Math.max(0,draft.sendAt-Date.now()):1000
  })
});

// Email worker: fresh pre-SMTP checks and durable send state remain required.
const campaignGate=createCampaignDeliveryGate(campaignStore);
// createDurableEmailDeliveryProcessor({store:mailDeliveryStore,
//   isSubscribed:email=>preferences.isSubscribed(email),
//   isSuppressed:email=>suppression.isSuppressed(email),campaignGate,
//   send: (messageId)=>smtpSender.sendById(messageId) });
```

`onMetric` should never be relied upon for billing or exact sends. It is explicitly best-effort and has no direct relationship to open/click/download tracking. Message bodies, SMTP credentials and destination email addresses **must not** be placed in the BullMQ payload.

### Signed provider webhook

```ts
import {createMarketingFeedbackEndpoint} from '@zeruxjs/email';
const feedback=createMarketingFeedbackEndpoint({
  suppression,
  verifySignature:(raw,headers)=>myProvider.verifyWebhook(raw,headers),
  parse:(raw)=>myProvider.parseSignedFeedback(raw)
});
// Explicitly mount feedback.routes() in your trusted application, or configure
// email.marketingFeedback with enabled:true, these callbacks and suppression.
```

The provider-specific signature scheme, event ID mapping, and provider bounce classification must be implemented by the application. A `GET`/unsigned notification cannot suppress users.

### Optional dashboard integration

```ts
email: {
  accounts:[/* ... */],
  campaignDashboard:{
    planner,
    authorize:request=>session.getAuthenticatedOperator(request),
    authorizeCampaign:(operator,id,action)=>access.mayManageCampaign(operator,id,action),
    csrfToken:(request,operator)=>sessions.csrfToken(request,operator),
    verifyCsrf:(request,operator)=>sessions.verifyCsrf(request,operator)
  }
}
```

This config stays on the server, and ZeruxJS owns the routes per runtime generation. A missing authorization or invalid route fails startup rather than exposing the dashboard.

## Verification

- `@zeruxjs/email` compiler and test suite passed, including campaign paging, concurrency, retries, delivery gate, tracking independence, auth/CSRF/scoped permissions, suppression CAS, provider signature rejection and pre-SMTP suppression.
- `@zeruxjs/queue` compiler and suite passed (live BullMQ/Redis test skipped due to absent installation).
- Real SQLite integration passed using **two independent connectors** for shared campaign state and suppression concurrency. SQL migration against live PostgreSQL/MySQL and actual MongoDB remains to be tested.
- ZeruxJS's campaign route bootstrap and prior queue bootstrap selected tests passed; wider workspace typecheck still has missing workspace dependencies (`zcli`, `zsrv`, `zwatch`, `@zeruxjs/hooks`, `@zeruxjs/cache`, etc.).

## Not production-certified yet

No shipped contact/import or list hygiene UI, no provider-specific signed webhook parser, no automated durable inbox for open/click events, no exact multi-node SMTP provider reconciliation, no live Redis or Postgres/MySQL/Mongo server tests, no marketing rate caps/unsubscribe audit retention manager, no full campaign conversions/attribution dashboard, and no production cert. A queue worker must be explicitly configured to process `campaign.plan` jobs. The planner is safe for retry only if `ensureMessage` and BullMQ enqueues use their documented stable IDs. Legal/compliance review, unsubscribe requirements and data retention should be applied to each deployment.
