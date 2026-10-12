# Section 49 — Database-native materialized numeric analytics

## Purpose and backwards compatibility

Section 48 introduced native database count aggregations. Section 49 extends the analytics/reporting path with an **opt-in, durable numeric fact table** for `sum`, `average`, `min`, and `max` over selected event properties. The new path is **NOT a fully reconciled historical warehouse** and should never be described as exact over all historical events without backfill and consistency controls. Unconfigured numeric fields still use the existing bounded `sampled` report mode.

No changes have been made to browser `ttag`, server `astag`, tags/GA4 forwarding, email open/click/download tracking, or marketing consent. Fail-soft event ingestion remains intact. This section modifies the optional numeric reporting sidecar only.

## Enable it

```ts
export default {
  analytics: {
    analytics: 'reporting',  // existing named @zeruxjs/db connection
    enabled: true,
    indexes: true,          // optional; let a migration tool manage indexes with false
    numericFields: ['value', 'quantity', 'duration_ms'] // 0..8 unique, scalar numeric properties
  },
  reports: {
    enabled: true,
    prefix: '/_reports',
    authorize: request => verifyReportRole(request),
    site: 'storefront' // if you need this host-enforced site boundary
  }
};
```

Every **new successfully persisted event** with a finite number in a configured property also attempts one row in the `<events-table>_numeric` fact table. Missing, string, boolean, or `null` values are not numerically indexed; only configured property names are materialized. The separate fact table is an opt-in projection, so existing events remain readable from the original analytics events table and existing collection APIs are unchanged. One event may generate multiple facts (maximum eight).

```ts
await analytics.initialize();
await analytics.track({name:'purchase',site:'storefront',properties:{value:49.95,quantity:2}});

const totals=await analytics.aggregateNumeric({
  metric:'sum',valueField:'value',groupBy:'event',site:'storefront',
  since:Date.parse('2026-10-01T00:00:00Z'),until:Date.now(),limit:100
});
// totals: {total, groups, matchedFacts, truncated, mode:'materialized',
//          coverage:'indexed-only', groupBy, metric, valueField}
```

Supported dimensions: `event`, `source`, `site`, `pathname`, and explicitly bounded UTC `day` (maximum 366 calendar days). Filters use validated event/source/site/time field expressions and parameterized database query DSL. Up to 500 groups may be queried, and a chart draws at most 60. Supported metrics are SUM/AVG/MIN/MAX. `total` is computed independently from limited displayed groups; for AVG it represents an average of **all matching fact rows**, not an average of group averages; for MIN/MAX it is the global min/max. `matchedFacts` is the number of matching indexed numeric property rows, *not* the full event count.

### Reports behavior

Configure a chart with `metric:'sum'|'average'|'min'|'max'`, a **configured** `valueField`, and a built-in dimension. Reports chooses `aggregateNumeric` and marks the response `queryMode:'materialized'`, `numericCoverage:'indexed-only'`, and `matchedFacts`. The studio **always shows the coverage warning**, even when the group list is not truncated. For non-indexed fields, reports preserve the existing bounded `sampled` source-row path. `distinct` and custom `property:<name>` dimensions are still sampled; no unimplemented exactness claims are made.

### Failure behavior and operational boundaries

- Raw event insertion still returns its ID when a subsequent optional numeric fact insertion fails. Warnings are deduplicated, `status().numericDropped` and `status().numericIndexed` are process-local diagnostics. Reports exclude any missing facts and show coverage warnings, never a fabricated all-events total. A missing numeric table means `aggregateNumeric` rejects; authenticated report query routes then return 503 rather than claiming zero.
- **Dual-table inserts are not atomic.** A DB failure between the event insert and fact insert, or a partial Mongo `insertMany` failure, may leave missing or partially indexed fact rows. The current framework database facade does not expose an atomic cross-table transaction contract. These metrics should be treated as **materialized subsets**, not certified finance/revenue totals. This phase intentionally does not automatically replay or backfill facts, since replay requires idempotent writes and a cross-node migration/checkpoint policy. A future durable queue and reconciliation job are required for guaranteed completeness.
- **Older rows aren't backfilled.** Enabling `numericFields` today cannot retroactively materialize old `properties_json`. Backfill should run from a controlled migration/reconciliation job, with idempotent fact upserts and an explicit completeness watermark, before any attempt to claim historical accuracy. Do not use these numbers for regulated accounting.
- Numeric facts use the connector's FLOAT storage type and normal floating-point aggregation. For currency, prefer integer minor units (e.g. `amount_cents`) for now and avoid values beyond the connector's exactly representable integer range. Precision-oriented DECIMAL reporting should be implemented as a later schema/query feature.
- The named DB connector must be **shared** across replicas. The opt-in fact table has a stable derived ID per event/property to support future idempotent migrations. Mongo's `createTable({ifNotExists:true})` now tolerates the native NamespaceExists (48) error during parallel startup. Production readers still may see events before their numeric facts commit; snapshot consistency and transactional rollups are not implemented.
- Daily metrics remain bounded to a year and can generate hundreds of database count/metric queries. High-volume multi-year reporting needs rollups/partitions, not 366 independent reads. `indexes:false` delegates index lifecycle to your database migration system.

## Testing and verification

- Compile source using `tsc -p` for `db`, `db-sql-core`, `db-mongo`, `analytics`, and `reports`. SQLite is tested with Node's built-in SQLite driver and the optional `better-sqlite3` type-shim used **only locally** for the build environment (not included in either archive).
- Package tests include numeric sums/averages/min/max, negative values, site filtering, a >500-event dataset, bounded day intervals, empty sets, invalid property names, failed writes and unavailable connectors, Mongo pipeline translations, legacy report fallback, and always-visible studio warnings.
- `npm run test:analytics-numeric-sqlite` verifies 1,201 newly stored numeric events plus an unindexed historical row in a real in-memory SQLite database. The numeric fact total is intentionally lower than the all-event count, proving the system doesn't silently claim historical coverage.
- This is a tested **increment** in numeric reporting infrastructure, not a full production rollout or GA4/GTM/Looker Studio parity. PostgreSQL/MySQL/Mongo replica verification, cross-table transaction guarantees, backfill, multi-year rollups and full framework compilation remain outstanding.
- The report studio now draws signed numeric values around a true zero baseline for vertical/horizontal bars, lines, and area charts. Pie/doughnut charts warn about negative data rather than visually omitting it without explanation.
