# Section 48 — Exact analytics counts and database-native reporting

## What changed

This section follows Section 47 without replacing the `astag`/`ttag`, `dataLayer`, Beacon, consent-independent email activity tracking, or dashboard lifecycle contracts.

- `@zeruxjs/analytics` now has **`aggregate({groupBy, ...filters})`** for exact event counts computed by the shared DB connection instead of first downloading at most 500 events. Supported dimensions: `event`, `source`, `site`, `pathname`, and `day` with explicit `since`/`until` timestamps. Supports `name`, `source`, `site`, `since` and `until` filters. The API returns `{groups, total, truncated, mode:'database', groupBy}`. `total` is exact for the filter over committed events; `truncated` means the **groups output** has been limited, not that `total` was sampled.
- Standard grouped counts translate to Zerux DB parameterized query expressions (`COUNT(id)`, `GROUP BY`, bounded `ORDER BY`/`LIMIT`) for SQL connectors. `@zeruxjs/db-mongo` translates exactly this safe query subset into native MongoDB `$match`, `$group`/`$count`, `$sort`, `$project`, `$limit` stages (including the empty-set count case).
- Bounded daily queries use exact UTC-day timestamp partitions with `since <= occurred_at <= until`, up to 366 UTC days; no dialect-specific date expressions. They run in batches of up to six concurrent reads. Longer ranges are rejected. For high-volume multi-year charts, a durable pre-aggregated warehouse is still needed.
- If the active DB connector supports it, analytics initialization creates **three indexes** for `occurred_at`, `(event_name, occurred_at)` and `(site, occurred_at)`. Index names are short, deterministic and migration-friendly; repeated startup with PostgreSQL/SQLite/Mongo remains idempotent. MySQL duplicate-index errors are tolerated. Index failure is **non-fatal to ingestion** and reflected in `status().indexesReady`; `indexes:false` delegates index management to your DBA/migration tool. Database schema initialization failure still returns false.
- `@zeruxjs/reports` automatically selects `analytics.aggregate()` for `metric:'count'` with supported groupings, displaying exact total counts even when only the first groups fit the chart limit. `ChartData.queryMode` distinguishes `database` vs `sampled`. For `groupBy:'day'` the saved chart must specify `since` and `until` to use native daily aggregation; otherwise it explicitly remains on the 500-row fallback. Other metrics (`sum`, `average`, `min`, `max`, `distinct`) and `property:...` dimensions still use the bounded row query and **must not** be interpreted as full historical totals. Custom report adapters with `aggregate()` can provide their own native execution.
- Report runtime accepts `site` as a **host-enforced filter**. A stored chart's `site` cannot override that boundary; all report reads go through the same filter. To enforce tenant permissions, continue to use `authorize(request)` and map the authenticated tenant to a scoped source or reports service. Do not expose a shared unscoped admin dashboard to unauthorised tenants.
- Native aggregate reads reject on DB errors. The authenticated HTTP query returns 503 rather than silently displaying a bogus zero. **Event collection remains best-effort and never throws** on disconnected connectors (unchanged).

## Usage

```ts
const analytics = createAnalytics({
  analytics: 'reporting', database: databaseManager,
  indexes: true // default; false for externally managed migrations
});
await analytics.initialize();
const summary = await analytics.aggregate({
  groupBy: 'event', site: 'tenant-1',
  since: Date.parse('2026-10-01T00:00:00Z'),
  until: Date.parse('2026-10-12T23:59:59.999Z'),
  limit: 100
});
// summary.total counts every matching committed event in storage.
// summary.groups is bounded; summary.truncated indicates hidden groups.
```

Example report configuration:

```ts
reports: {
  enabled: true,
  prefix: '/_reports',
  site: 'tenant-1',
  authorize: async request => canEditTenantReports(request, 'tenant-1')
}
// Example saved count chart:
// {id:'views',title:'Page views',type:'line',metric:'count',groupBy:'day',
//  eventName:'page_view',since:Date.parse('2026-10-01'),until:Date.parse('2026-10-12')}
```

Use dedicated per-tenant analytics credentials/data partitions in addition to application-scoped report authorizers where your tenancy requires stronger isolation. Collection endpoints already enforce their own origin/bearer policies; those are unrelated to report authorization.

## Verification

- `@zeruxjs/analytics`, `@zeruxjs/tags`, `@zeruxjs/reports`, `@zeruxjs/db`, `@zeruxjs/db-mongo`, and `@zeruxjs/db-sql-core` package source compilations pass in the local toolchain. `@zeruxjs/db-sqllite` needs its optional `better-sqlite3` declaration available at compile time; it was built locally with a temporary type shim and the real Node SQLite engine.
- Tests exercise 1,203-record in-memory SQL-like aggregation; filtered totals, group truncation, UTC midnight boundaries; 503 on DB outages; strict filters; site enforcement; Mongo native pipeline shape; and an **actual in-memory SQLite database with 1,101 persisted events and three indexes**. Run unit tests with `node --test packages/@zeruxjs/{analytics,reports,tags}/test/*.test.mjs packages/@zeruxjs/db-mongo/test/*.test.cjs` after builds, and cross-package SQLite with `npm run test:analytics-sqlite` after building the required package dependencies.

## Accuracy and operational limits

- The exactness claim covers committed event **counts**, not telemetry delivery guarantees. An event skipped by best-effort analytics due to a missing DB is never included; ad blockers and failed browser Beacon delivery also remain outside the dataset.
- SQL and MongoDB functions were tested via local SQL SQLite integration and mocked Mongo aggregation pipelines. Real PostgreSQL, MySQL, and MongoDB instance/failover testing is not yet certified; index creation with MySQL deserves dedicated repeated-run deployment testing.
- Counts may change between `total` and grouped selects under concurrent writes because the generic Zerux DB API doesn't yet provide a read-snapshot/transaction contract. For a fully snapshot-consistent report, use a connector-provided snapshot/warehouse implementation. Multi-node deployments must share the same durable connector; this work does not implement a distributed write queue.
- The aggregate API is server-side, not an unauthenticated public query endpoint. It validates dimensions, limits and filter values and does **not** accept arbitrary raw SQL or Mongo expressions. Group outputs are limited to 500 and chart displays to 60; `truncated` remains visible to users.
- Grouped `COUNT` reads depend on the DB adapter's aggregate capabilities; database errors are surfaced to the authenticated reports endpoint as 503. For exact property dimensions/numeric sums, ingestion rollups, production-scale cardinality handling, and real distribution tests, additional work remains.
