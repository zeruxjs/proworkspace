# Section 50 — Historical numeric backfill and resumable reconciliation

## What is implemented

Section 49 stored opt-in numeric facts as a separate sidecar table and reported `coverage:'indexed-only'`, because older events or transient fact-write errors might not have projections. Section 50 adds **`analytics.reconcileNumeric({since,until,site?,cursor?,batchSize?})`** for controlled server-side backfill and recovery. This is an *administrative API*, not a public HTTP route, a background job, or a complete transactional warehouse.

- A bounded, keyset-paginated scan of persisted raw events ordered by event `id` (`id > cursor`) within an explicit, inclusive millisecond time range. `batchSize` defaults to 100 and is limited to 1–200 events. Every response includes `scanned`, `expectedFacts`, `created`, `existing`, `invalidRows`, `nextCursor`, `hasMore`, and `windowExhausted`.
- Only explicitly configured finite numeric properties are backfilled (maximum eight fields, preserving all Section 49 filtering). Invalid historical JSON is counted as `invalidRows` instead of stopping valid records. Numeric fact read/insert failures **reject** rather than reporting false completion.
- New numeric fact IDs now depend on `(eventId, propertyName)` via a stable SHA-256-derived suffix. Earlier Section 49 positional IDs remain recognized when they have matching event/property data. A unique database index on `(event_id, property_name)` prevents duplicate projections between replicas, different `numericFields` orders, and overlapping backfill workers.
- An existing matching fact is reused. If a fact for the same event/property has a different metric value or dimension, reconciliation **fails closed** and requires operator investigation; it does not silently overwrite historical data. A failed insert is re-read to tolerate another worker winning the insert race.
- `analytics.status().numericUniqueIndexReady` indicates whether the connector accepted unique-index setup, or the operator explicitly declared that an external migration has provisioned it. With no uniqueness contract, the administration API is deliberately unavailable; ordinary event tracking remains optional and fail-soft.

## Usage

```ts
const analytics = createAnalytics({
  analytics:'reporting',
  database: dbManager,
  numericFields:['value','quantity'],
  indexes:true
});
await analytics.initialize();

// Trusted maintenance process only; use an explicit historic window.
let cursor: string | undefined;
do {
  const batch = await analytics.reconcileNumeric({
    since: Date.parse('2025-01-01T00:00:00Z'),
    until: Date.parse('2025-12-31T23:59:59.999Z'),
    site: 'storefront',
    batchSize: 100,
    ...(cursor ? {cursor} : {})
  });
  // Persist cursor in YOUR durable job store only after this page returns successfully.
  // Track invalidRows and alert before claiming historic coverage.
  cursor = batch.nextCursor ?? undefined;
  if (!batch.hasMore) break;
} while (true);
```

On a failure, **restart from the last successful durable cursor, not the failed page**. Reprocessing pages is safe with the unique index in place. For late/backdated events or concurrent ingestion, repeat a complete bounded scan from the beginning after traffic settles: `windowExhausted` only means that the source query was exhausted at that instant, NOT that a snapshot, completeness watermark or consistent rollup exists. The cursor identifies the last scanned source event, **not** a lease or lock. Use one controlled job per historical window, or overlapping workers with the unique index and collision-safe retry.

For databases whose index creation is managed by migration tooling (especially MySQL, where generic `CREATE INDEX IF NOT EXISTS` isn't universally supported), install the following database constraint with a supported migration first:

```sql
CREATE UNIQUE INDEX analytics_events_numeric_event_field_uq
  ON analytics_events_numeric(event_id, property_name);
```

Then use `{indexes:false, numericUniqueIndexManagedExternally:true}` to assert that the database constraint really exists. **The assertion is not a runtime inspection** and must only be set after inspecting the actual database schema. For default `indexes:true`, the connector's unique-index creation must return `ok:true`; if it rejects because of duplicates or unsupported schema, backfill stays disabled until fixed. Index names created automatically may vary with the configured table prefix; do not assume the example name is the generated one.

## Cross-database status

| Storage | Section 50 verification | Production qualification |
|---|---|---|
| SQLite | Native SQLite driver ran 623 historic inserts, 935 unique facts, resume/replay and repair | Local real-database integration |
| PostgreSQL | Parameterized SQL compiler test covers `CREATE UNIQUE INDEX` and keyset predicates | Live DB migration, permissions, locking, and replica tests outstanding |
| MySQL | Parameterized SQL compiler test covers `CREATE UNIQUE INDEX` and keyset predicates | Live DB tests and externally managed unique index recommended |
| MongoDB | Existing native aggregation and connector tests from earlier sections remain supported | Live Mongo cluster and uniqueness/index rollout need testing |
| Other supported connectors | Core query DSL uses select, insert and createIndex only | Needs accurate `gt`, ordering, unique index and insert error semantics |

## Important limits

1. Numeric facts are still a **separate nontransactional projection**. Concurrent reporting may observe events before their facts, and tracking failures can leave recoverable gaps. No atomic cross-table commit, durable distributed job lease/checkpoint, or snapshot-consistent watermark was added. Store completed cursors externally and rerun a full window when necessary.
2. Indexing a new fact is not *proof* that all relevant history is indexed. The reports API continues returning `numericCoverage:'indexed-only'`; it does not label reconciled windows as certified complete. Reports are not suitable for regulated accounting without further controls.
3. Conflicts caused by corrections to already-committed events/facts are detected and rejected; this API does not rewrite data or implement deletion/right-to-erasure propagation. Manually repair corrupted data following a controlled migration.
4. SQLite uses Node's built-in experimental driver in these tests; PostgreSQL/MySQL are SQL-compilation tests only, not live integration tests. Keep application analytics DB shared among replicas, and independently verify production indexes.
5. The packages are source/TypeScript-tested, not full-workspace production-certified. Avoid invoking a large unbounded historical scan within a request handler.

## Regression commands

```bash
cd apps/proworkspace
# After installing workspace dependencies and building db/sqlite/analytics packages:
node --test packages/@zeruxjs/analytics/test/*.test.mjs
npm run test:analytics-reconciliation-sqlite
npm run test:analytics-reconciliation-sql-compiler
```

Existing server `astag`, browser `ttag`, request IDs, tag dispatching, report definition/query API, and independent email tracking remain unchanged.
