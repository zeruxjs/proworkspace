# Section 71 / 85 — Analytics collection, identity, storage, reconciliation and retention

**Date:** 14 October 2026  
**Scope:** `@zeruxjs/analytics` package, its browser/HTTP collection entry points and the existing shared DB JSON facade. **AIO/application infrastructure is out of scope.**

## Delivered API and migration policy

The existing database-backed `createAnalytics()` (`track`, `events`, `aggregate`, `aggregateNumeric`, `reconcileNumeric`, `createReconciliationJob`) remains compatible for ordinary cookie-less and identity-free telemetry. **No database column is added:** explicit visitor consent and opaque visitor tokens are serialized into bounded existing `properties_json` fields `zConsent` and `zVisitorId`. An opaque session token uses the existing `session_id` column. In addition to the existing scalar property limits (40 keys, 1,024 characters per string, 8 KB JSON, finite numbers, validated event names), identity-bearing fields require `consent:'granted'` and 16–128 ASCII characters `[A-Za-z0-9_-]`. `consent:'denied'` never stores an event. Reserved system property keys cannot be spoofed by arbitrary callers; request-correlation keys are generated from the trusted ingress flow. **Never supply email addresses, IPs, telephone numbers, account secrets, or browser fingerprint data as visitor/session IDs or arbitrary event properties.** Identity tokens must be application-assigned, per-site and purpose-bound; the library does not infer identity from transport metadata.

New optional config:

```ts
import {createAnalytics,createAnalyticsCollector,createEventClient,createAnonymousAnalyticsId}
  from '@zeruxjs/analytics';

const analytics=createAnalytics({
  analytics:'reporting', // mandatory named @zeruxjs/db connection
  database:dbManager,
  enabled:true,
  webConsent:'required', // default 'optional' for backward compatibility
  eventSchemas:{
    'page.view':{properties:{section:'string'}},
    purchase:{properties:{value:'number',currency:'string'}}
  },
  numericFields:['value'], // numeric facts remain explicitly opt-in
  onWarning:message=>logger.warn(message),
  approveRetention:async scope=>adminPolicy.mayEraseMetrics(scope.site,scope.before)
});
await analytics.initialize();

const collector=createAnalyticsCollector({
  analytics,
  allowedOrigins:['https://app.example.org'],
  siteByOrigin:{'https://app.example.org':'customer-site'},
  requireBrowserConsent:true,
  botPolicy:'drop-known',
  // For nonbrowser collectors configure serverToken and tenant-scoped auth separately.
  serverToken:process.env.ANALYTICS_COLLECTION_TOKEN
});

// In the browser only after users give permission; never store this automatically.
const client=createEventClient({endpoint:'https://metrics.example.org/_analytics/collect',requireConsent:true});
client.setConsent('granted');
const session=createAnonymousAnalyticsId();
await client.track('page.view',{section:'docs'},{sessionId:session,site:'customer-site'});
client.setConsent('denied'); // subsequent events are not transmitted
```

`eventSchemas` is an **optional strict allowlist** of event names and property types (`string`, `number`, `boolean`, `null`). If provided, unregistered names/keys or wrong types are skipped with a one-time warning; setting `allowAdditionalProperties:true` allows additional scalar keys for that name. Reserved internal property keys are always rejected if provided externally. The client avoids network writes for denied consent. The server also skips denied consent; `webConsent:'required'` skips browser-source events until granted. For a **public browser collector**, configure both `requireBrowserConsent:true` and origin-to-site mapping. The collector rejects an untrusted browser's attempt to override its mapped site and prevents browser sources from pretending to be server/email traffic. CORS origin allowlisting is **not authentication** for server ingestion: server tokens must be kept confidential and server tenant authorization must be enforced by the calling application.

`botPolicy:'drop-known'` (off by default) ignores recognizable crawler/headless/prefetch requests *before* allocating correlation IDs or entering storage. This is heuristic noise filtering, **not** a reliable method to identify humans; ad blockers, mail image proxies and bot disguises remain. The collector preserves bounded request bodies, read deadlines, storage deadlines, in-flight caps and per-instance rate limits from Section 44. New collector prevalidation rejects malformed event payloads **before** consuming durable request-ID reservations. Keep a shared durable `requestIdStore` when replay uniqueness is required across replicas.

## Counts, numeric coverage and correction

- `analytics.aggregate({groupBy:'event'|'source'|'site'|'pathname'|'day', ...})` uses native DB `COUNT`. `mode:'database'` is **exact for the persisted rows it queries**, not proof every page load or email view was collected. `total` includes all matched persisted rows, even if result groups were truncated.
- Legacy `analytics.counts()` counts only the last up to 500 returned rows. Prefer `analytics.countsWithCoverage(query)` returning `{counts,scanned,limit,coverage:'sampled-page'|'unavailable',possiblyTruncated}` for a clearly labeled, non-global sample.
- `analytics.aggregateNumeric(...)` reads materialized **committed** facts only and keeps `coverage:'indexed-only'`. Event insertion followed by numeric materialization is not one cross-database transaction, and older rows are not silently backfilled.
- Use `analytics.reconcileNumeric({since,until,site,batchSize,cursor})` for bounded, idempotent historical facts; it needs a database-enforced unique `(event_id,property_name)` index. For many pages and multiple workers use `createReconciliationJob()` with fencing from Section 51. Restart an exhausted scan to pick up late historical imports. Completion proves window scan exhaustion, not a transactional snapshot.
- `initialize()` now also attempts a unique `id` index on the raw event table (especially relevant for MongoDB, where an SQL-style primary-key declaration alone does not create an index), in addition to read indexes. With `indexes:false`, independently manage **all** required indexes and uniqueness constraints.

## Explicit retention

Retention is **trusted-server/admin-only**, never an unauthenticated web endpoint:

```ts
const scope={site:'customer-site',before:Date.now()-90*86400000,limit:100};
const dry=await analytics.purgePage(scope); // default dry-run
if(legalHoldChecked) {
  let cursor;
  do {
    const result=await analytics.purgePage({...scope,cursor,dryRun:false});
    cursor=result.nextCursor??undefined;
  } while(cursor);
}
```

`purgePage()` requires an initialized named database with delete support, a **nonempty specific site**, a cutoff **at least 24 hours in the past**, page limit 1–100, and configured `approveRetention` callback for all actual deletions. It deletes materialized numeric rows for a source event *first*, then deletes the event row using site, ID and age predicates. If deleting facts fails, the source event is preserved and the operation throws so the page can be retried. Retention is not transactional: a process crash can leave partial work and operators must restart from the previous cursor or from the beginning. Numeric backfills/late writes racing with deletion can re-create facts; quiesce conflicting jobs for that site/window before purging and perform a later orphan check. The result's `coverage:'bounded-keyset'` is **not** a snapshot claim.

If a deployment currently has **no** `numericFields`, the function cannot infer whether an old sidecar table exists. For destructive purges, explicitly pass `numericSidecar:'present'` (will delete rows in the sidecar, fails closed if unavailable), or `numericSidecar:'absent'` **only after independently verifying that no historical numeric facts exist**. An unqualified purge is rejected. `dryRun` never writes. The direct `purgeAnalyticsEvents()` helper is low-level and does **not** perform approval checks: use `analytics.purgePage()` in application code.

**Data not removed:** request-ID reservation tables, email activity/tracking state, marketing suppression and consent sources, browser/local storage (managed by the host), mail provider logs, queue/outbox, audit logs or external GA4/tag sinks. Those are separate deletion and lawful retention obligations. Confirm user consent and privacy policy before collecting; do not derive security/audit or billing truth from this best-effort telemetry.

## Verification and release boundaries

From the extracted Section 70 baseline, built TypeScript `@zeruxjs/analytics` using the local TypeScript compiler and temporary existing Node typings; used the actual project `@zeruxjs/db`, `@zeruxjs/db-sql-core` and `@zeruxjs/db-sqllite` connectors with Node built-in SQLite. The Analytics suite passes **60 tests**, with **3 skipped** opt-in live connector tests and **0 failures**. The new real-SQLite tests cover event schema validation, per-visitor/session consent, collector origin/tenant binding, known-bot filtering, invalid request-ID prevalidation, missing DB nonfatal response, exact native counts, numeric facts, idempotent historical reconciliation, pagewise retention, failure-before-source-delete and explicit sidecar policies.

`test/section71-live-databases.test.mjs` provides a **real external connector** parity gate for a disposable database. Provision the relevant drivers/workspace builds and environment variables:

| Backend | Environment |
| --- | --- |
| PostgreSQL | `ZERUX_TEST_PG_URL` |
| MySQL | `ZERUX_TEST_MYSQL_HOST`, `ZERUX_TEST_MYSQL_DATABASE`, optional `ZERUX_TEST_MYSQL_USER`, `ZERUX_TEST_MYSQL_PASSWORD`, `ZERUX_TEST_MYSQL_PORT` |
| MongoDB | `ZERUX_TEST_MONGO_URI`, `ZERUX_TEST_MONGO_DATABASE` |

Tests are skipped when those credentials are absent. **No claim of real PG/MySQL/MongoDB execution here:** external clusters, cross-connector unique-index checks, pool/failover testing, multi-region scale tests, registry-backed Section 66 clean install, email SMTP/Redis and hosted CodeQL remain open release gates. Exact counts rely on database reads but cannot provide network-delivery guarantees or a cross-DB transactional snapshot.

**Next:** Section 72 — Tags: GTM-style publishable runtime and governance. Roadmap remains **85 package sections**; AIO is excluded.
