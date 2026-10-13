# Section 58 — Native campaign performance and provider outcome reporting

## Changes

Section 58 extends `@zeruxjs/queue`, `@zeruxjs/email`, `@zeruxjs/reports`, and the optional ZeruxJS campaign dashboard. These APIs preserve Section 57's bounded detail scan and independently configurable message activity tracking.

### Native database-state aggregation (`@zeruxjs/queue`)

`createDatabaseCampaignPerformanceReporter({ db, deliveryTable?, provider? })` performs a native `COUNT(id) ... GROUP BY state` against `zerux_email_delivery` with the campaign ID applied in the **database query**. It fetches at most eight grouped rows; it does not read message payloads, recipient addresses, or the 100,000 message-scan limit from Section 57. Grouped counts use the existing ZeruxJS query DSL, already translated to SQL or MongoDB aggregation pipelines by compatible database connectors.

It returns `{campaignId, mode:'database', complete:true, total, counts, smtpAcceptedPercent, dailyCoverage:'not-computed', activityCoverage:'not-computed', provider}`. SMTP state `sent` means the sender registered SMTP acceptance, not inbox placement. Rates are fractions of all persisted delivery records for the campaign, *not* provider-confirmed mailbox delivery or accepted-attempt denominator. The delivery table must first be initialized by `createDatabaseEmailDeliveryStore()` or a managed migration. A missing table or failed query **throws**; it never masquerades as a zero campaign. Counts reflect committed records observed during the query; concurrent writes and the separate provider query are **not transactionally snapshot consistent**.

```ts
import {
  createDatabaseEmailDeliveryStore,
  createDatabaseProviderOutcomeLedger,
  createDatabaseCampaignPerformanceReporter
} from '@zeruxjs/queue';

const deliveryStore = createDatabaseEmailDeliveryStore(db);
// Your application's durable message preparation must create its delivery rows.
const provider = createDatabaseProviderOutcomeLedger(db);
const readPerformance = createDatabaseCampaignPerformanceReporter({ db, provider });
const report = await readPerformance('campaign_fall');
```

### Authenticated provider event ledger

`createDatabaseProviderOutcomeLedger(db, table?)` stores provider, campaign ID, **opaque** message ID, verified provider event ID hash, event kind and timestamp (no recipient, email HTML, content or SMTP secrets). It accepts `delivered`, `deferred`, `hard-bounce`, `soft-bounce`, and `complaint`. The durable primary key is a SHA-256 hash of the provider and event ID. Identical replays return `false`; replays with conflicting attribution, type or timestamp **throw**, rather than overwrite the original event. Database failures are not swallowed.

`ledger.summarize(campaignId)` uses a native DB `GROUP BY kind`; it returns exact counts of **recorded authenticated notifications**, not guaranteed global provider coverage, recipient-level unique delivered counts, inbox placement, or universal complaint rates. A provider may not supply delivery or complaint events for every message. `record()` must be called only by verified provider integrations or authorized internal workers.

### Signed provider intake

The optional `createMarketingFeedbackEndpoint()` supports `delivered` and `deferred` provider notifications in addition to existing suppression-worthy bounce and complaint events. **Delivery/defer notifications do not change recipient suppression or sender reputation**. Bounce and complaint events still invoke the suppression and reputation services before the outcome ledger, preserving their independent policies. The endpoint requires the application's signature verification callback and trusted `feedbackDelivery()` attribution to the correct campaign/message and **stable provider timestamp**. The configured ledger's failures return 503, which lets compliant providers replay the event. The ledger's idempotent event ID means replay does not add extra counts. Without provider-outcome support, delivery/defer notifications are rejected (503). No provider endpoint is automatically public.

```ts
createMarketingFeedbackEndpoint({
  verifySignature: yourProviderSignatureVerifier,
  parse: yourVerifiedProviderPayloadParser,
  suppression,
  providerOutcomes: provider,
  feedbackDelivery: event => trustedProviderMapping(event)
  // trustedProviderMapping yields: {provider, campaignId, messageId, occurredAt}
});
```

Every field in the mapping must originate from verified provider metadata or a trusted local database lookup, **not unsigned request parameters**. The host remains responsible for provider-specific authentication, webhook retry support and event retention. SMTP credentials or auth mechanisms (password, OAuth, custom transport) are not tied to these APIs.

### UI and Reports

- `GET /_email/campaigns/api?id=...&view=performance` is available only when an authenticated host explicitly sets `campaignDashboard.performanceReport`. It uses the existing mandatory `authorizeCampaign(principal,id,'read')` check, no-store response, and whitelist projection. The performance view visualizes native state totals and separately labels provider-reported event counts.
- The previous `view=delivery` bounded report still supports observed activity and per-UTC-day details, with its partial-scan flag. **All-time performance intentionally does not invent a daily history or open/click totals.**
- `campaignPerformanceCharts(snapshot)` in `@zeruxjs/reports` returns chart-friendly state totals and optional provider-event groups, with `queryMode:'database'`. Report embedders must enforce tenant/campaign access before obtaining the snapshot. No public cross-tenant dataset was introduced.

### Verification

- Synthetic database-native grouping with 100,123 delivery records (beyond Section 57's max-scanned cap).
- **Real Node SQLite database:** 1,203 delivery rows, two independent connections, persisted provider event replay, native grouped totals.
- MongoDB **mock connector pipeline** test confirms the `campaign_id` filter and `$group` translation. This is not a real Mongo cluster test.
- HTTP tests: campaign-specific authentication, CSRF-protected existing actions, extra-field stripping, invalid aggregate rejection, unsigned feedback denial, fail-closed outcome writes, delivered/deferred processing without suppressions.
- Queue, Email and Reports regression suites passed with live Redis integration skipped (no configured Redis instance).
- `@zeruxjs/queue`, `@zeruxjs/email`, and `@zeruxjs/reports` TypeScript builds pass. The full framework typecheck remains blocked by previously unresolved workspace packages (`zcli`, `zsrv`, `zwatch`, hooks, lint, and others).

### Limitations / next stage

Full historical time-series summaries, a provider-specific adapter catalog, live PostgreSQL/MySQL/MongoDB clusters, Redis/BullMQ, actual SMTP/inbox outcome verification, transactional cross-query snapshots, and customer-scale load benchmarking remain outstanding. Providers with incomplete notifications will yield incomplete provider outcome history, although the stored event counts are exact over received verified events. For production, configure database indexes, permissions, cleanup/retention, backups, webhook verification and a real mail-provider integration.
