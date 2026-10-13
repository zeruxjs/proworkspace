# Section 59 — Database-native UTC-Day Campaign Trends

## Scope

This release extends the Section 58 campaign-performance work with **bounded, native daily count aggregation** over durable email-delivery states and verified provider outcomes. It adds a protected dashboard view, a Reports chart adapter, and optional index support. No marketing-consent or email-activity-tracking behavior was changed.

## APIs

`@zeruxjs/queue` exports `createDatabaseCampaignTrendsReporter()`:

```ts
import { createDatabaseCampaignTrendsReporter } from '@zeruxjs/queue';

const dailyTrends = createDatabaseCampaignTrendsReporter({
  db: reportingDatabase,
  deliveryTable: 'zerux_email_delivery',
  // Only enable when this durable provider-outcome table has already been initialized.
  providerTable: 'zerux_email_provider_outcomes',
  maxDays: 92
});

const result = await dailyTrends('fall_2026', '2026-10-01', '2026-10-31');
```

- `from` and `to` are both **inclusive** UTC calendar dates.
- The default maximum is **92 days**; administrators can configure 1–366 days. Each day uses exact half-open timestamp bounds `[start, next UTC midnight)`.
- Queries use database-native grouped `COUNT()` and indexed columns; they never fetch email bodies, credentials, message IDs or recipients.
- A date day with no records is a zero-count bucket; unavailable tables, corrupt counts, invalid dates, and database failures **throw** rather than silently returning zero.
- Results return `complete: true` for completed bounded day queries. They do **not** promise a cross-query transactional snapshot (`snapshotConsistent: false`).
- `deliveryCoverage: 'last-state-update-day'` counts the **current persisted state** grouped by the date of its latest update. A message last updated today is *not* counted on its earlier days. This is **not** an immutable event-time history. True historical transition trends require a separate append-only delivery-state event ledger.
- `providerCoverage: 'reported-events-only'` counts only authenticated outcome notifications persisted to the provider ledger. Provider events are **not unique deliveries**, inbox placement guarantees or reliable denominators for bounce/complaint rates if provider feedback is incomplete.
- If no `providerTable` is configured, `provider` and `providerEvents` are **null**, never invented zeros.

## Authenticated campaign dashboard

`@zeruxjs/email`'s existing optional campaign dashboard accepts a `trendsReport(campaignId, from, to)` callback. After host session and per-campaign authorization, it supports:

`GET /_email/campaigns/api?id=fall_2026&view=trends&from=2026-10-01&to=2026-10-31`

The UI provides UTC date selectors and daily trend rows. A strict public projection exposes only day labels and aggregate state/provider counts; unexpected recipient identifiers, credentials and provider metadata are stripped. The endpoint remains disabled without the callback. Host authentication and CSRF rules for mutation requests are unchanged.

Use a server-controlled database/tenant context for the callback. Do not derive the tenant database, table names or authorization grants from untrusted query parameters.

## Reports integration

`@zeruxjs/reports` exports `campaignDailyTrendsCharts()` for PII-free date-series representations:

- `smtpSentByDay`: current `sent` state grouped by its last update UTC day.
- `providerDeliveredByDay`: provider-reported `delivered` notification counts by UTC day; absent (`null`) when no provider-outcome source is configured.

The adapter validates category counts, ordering, provider coverage and group totals before rendering, and labels the differing meanings explicitly.

## Database requirements and portability

Use the existing ZeruxJS database query abstraction, including grouped `COUNT()` expressions and `gte`/`lt` filters. Two optional, idempotent indexes are added at source-table initialization:

- `zerux_email_delivery (campaign_id, updated_at)`
- `zerux_email_provider_outcomes (campaign_id, occurred_at)`

Index creation is non-fatal; these are query-performance aids, not uniqueness constraints. Existing uniqueness constraints for provider event IDs and message IDs remain in force.

SQLite was tested with actual database files and independent connections. SQL-core and Mongo query DSLs both translate comparison operators used in the trend queries. Live PostgreSQL, MySQL, MongoDB, Redis, SMTP and signed provider-webhook integration still require testing. Note that multiple day queries are bounded but execute separately and can observe concurrent changes; use database snapshot transactions or append-only materialization for strict historical consistency.

## Tests and validation

- Large mock set (>110,000 delivery rows) confirming native grouped counts without a payload scan.
- Date-window bounds, invalid dates, other-campaign isolation, missing tables and corrupt aggregate results.
- Dashboard session/tenant checks and output redaction.
- Reports chart adapter validation and data-coverage labels.
- Real SQLite test involving >1,200 indexed delivery rows and two independently opened SQLite connections.
- Existing Queue, Email and Reports regression suites (see Section 59 completion message for the final count).

## Not included

No provider-specific webhook parser/signature adapter, immutable delivery-transition log, data warehouse, distributed snapshot isolation, or automatic historical backfill was added in Section 59. These remain separate production-hardening tasks. In particular, never calculate deliverability, inbox placement or confirmed bounce percentages from SMTP `sent` status alone.
