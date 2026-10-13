# Section 57 — Durable campaign delivery reporting and Reports integration

## Scope

This section extends **@zeruxjs/queue**, **@zeruxjs/email**, **@zeruxjs/reports**, and the ZeruxJS email startup type contract. It builds upon the completed Section 56 source without altering marketing-consent decisions or independently opted-in message activity tracking.

### 1. Durable delivery records (`@zeruxjs/queue`)

`createDatabaseEmailDeliveryStore(db, table?)` implements the existing `DurableEmailDeliveryStore` interface used by `createDurableEmailDeliveryProcessor()`, as well as a new `create(record)` and `pageCampaign(campaignId, cursor, limit)` API. State changes rely on a database atomic conditional update and **must expose affectedCount**. A stale version fails instead of overwriting current worker state. The persisted campaign, purpose and recipient are immutable across updates. The database stores the version and limited reporting columns separately from the full delivery document.

The database uses the ordinary ZeruxJS structural `createTable / insert / select / update` contract. An optional composite campaign index is best effort; operators should create an equivalent index for large tables if the connector cannot handle this optional operation.

```ts
import {
  createDatabaseEmailDeliveryStore,
  createCampaignDeliveryReporter,
  createDurableEmailDeliveryProcessor,
} from '@zeruxjs/queue';

// db = the trusted ZeruxJS connection facade selected by the application.
const deliveries = createDatabaseEmailDeliveryStore(db);
await deliveries.create({
  id: 'mail_982', version: 1, purpose: 'marketing',
  campaignId: 'autumn_campaign', recipient: 'buyer@example.test',
  state: 'pending', lease: null, updatedAt: Date.now()
});

const reportDelivery = createCampaignDeliveryReporter({
  source: deliveries, maxRecords: 10_000, pageSize: 200,
  // Optional. Activity remains independent of consent and is not inferred.
  activity: emailActivityStore
});
const snapshot = await reportDelivery('autumn_campaign');
```

**Important:** The existing email manager and queue planner do not automatically create delivery records. The host application's persistent message preparation must call `deliveries.create()` with a stable ID *before* enqueueing. Only opaque message IDs should enter Redis. An SMTP sender still requires fresh marketing-consent and suppression checks before sending. SMTP acceptance is **not** proof of inbox placement.

### 2. Honest reporting semantics

`createCampaignDeliveryReporter` returns a PII-free count of `pending`, `claimed`, `sending`, `sent`, `suppressed`, `uncertain` and `rejected` states. Results also include grouped UTC-day counts and an optional activity summary (observed open, click, download-link click and confirmed-download events). The latter reports `coverage: 'available-summaries-only'` and how many message activity summaries existed, avoiding an incorrect claim that untracked messages had zero engagement.

The source is scanned in bounded pages with a deterministic, exclusive ID cursor. `maxRecords` is at most 100,000 per request (default 10,000). At the exact boundary, the reporter probes for an additional row: `complete: true` means end of scan; `complete: false` means counts are **partial** and `sentPercent` is `null`. This is not a materialized aggregate/warehouse and is intentionally not described as an unbounded exact reporting engine. Counts reflect committed delivery states at the time each page was read; no multi-page snapshot isolation is guaranteed during concurrent sends.

**Operator alert:** The `uncertain` state is exposed separately and must be reviewed; it is never silently treated as a failed job that is safe to resend.

### 3. Authenticated email dashboard

`createCampaignDashboard({...options, deliveryReport: reportDelivery})` adds `GET /_email/campaigns/api?id=autumn_campaign&view=delivery` and a visual delivery overview inside the existing protected interface. It reuses the mandatory session and `authorizeCampaign(principal, campaignId, 'read')` checks. The route does not exist unless the host explicitly enables the existing campaign dashboard; unconfigured reporting returns 404. Responses are projected onto a strict whitelist, removing recipients, message IDs, routing secrets and lease tokens even if a custom callback accidentally includes them. Database/report failures return 503 rather than fabricated zero counts.

The ZeruxJS framework startup config accepts an optional `email.campaignDashboard.deliveryReport` callback and retains its existing route-lifecycle cleanup behavior. No authentication or dashboard route is enabled automatically.

### 4. `@zeruxjs/reports` integration

`campaignDeliveryCharts(snapshot)` converts the PII-free delivery summary to two normal `ChartData` objects: a durable delivery-state bar chart and a daily SMTP-sent line chart. Both propagate `truncated` if the report was partial. The host must enforce its tenant/campaign authorization **before** retrieving a snapshot or embedding charts into a report. This is an adapter, not a new public Reports data source or cross-tenant query endpoint.

### Verification

- Queue and Email regression tests run with no failures (live Redis integration skipped without a configured test server).
- Reports chart tests cover state and daily aggregation, partial coverage, and invalid totals.
- Real built-in Node SQLite test verifies 611 persisted records, two independent connections, atomic CAS, and aggregate reporting beyond the previous 500-row query ceiling.
- Affected package TypeScript builds pass with temporary offline dependency links. Generated `dist`, `node_modules`, and local artifacts are excluded from the two ZIPs.

### Production requirements

Live PostgreSQL, MySQL, MongoDB, multi-worker Redis/BullMQ, and SMTP-provider integrations remain **unverified** here. The complete ZeruxJS workspace has unresolved dependency/typecheck blockers from previous sections. Verify provider-authenticated bounce/complaint intake, permissions and CSRF at the deployment origin, sensitive-data retention/erasure, backups, schema migrations, throughput limits, and true snapshot isolation before production certification.

