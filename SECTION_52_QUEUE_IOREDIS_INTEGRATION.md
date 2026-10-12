# Section 52 — BullMQ queues, ioredis cache adapter, and reconciliation-worker bridge

## Scope

Added a new `@zeruxjs/queue` workspace package, an optional ioredis driver for the existing `@zeruxjs/cache-redis` package, and a private ZeruxJS queue service bootstrap. Section 51's durable reconciliation job can now be scheduled through BullMQ using `createAnalyticsReconciliationProcessor`. This is a major integration step, **not** live production certification.

### New package: `@zeruxjs/queue`

- Explicit named queues; producer methods: `add`, `addBulk`, `getJob`, `counts`, `pause`, `resume`; built-in BullMQ delayed, repeatable, retry, priority and bounded retention job options.
- Optional trusted worker processors, concurrency, errors hook, health/status via `waitUntilReady`, generation-scoped cleanup, startup deadlines, best-effort graceful shutdown, explicit namespaced Redis keyspace, unique enqueue IDs supported through BullMQ `jobId`.
- Producer Redis policy: fail promptly (`maxRetriesPerRequest:1`, `enableOfflineQueue:false`). Worker Redis policy: tolerate disconnect/retry (`maxRetriesPerRequest:null`, `enableOfflineQueue:true`) for BullMQ blocking reads.
- Validates names, queue declarations, processors, worker concurrency, and critical job option bounds. Closes already-created queues if initialization fails.
- `createAnalyticsReconciliationProcessor` accepts only allowlisted persisted reconciliation jobs and invokes one bounded `runOnce()` page per queue job with a new owner identity. It never bypasses Section 51 DB leases, silently restarts completed jobs, or exposes an unauthenticated HTTP endpoint.

### Updated package: `@zeruxjs/cache-redis`

- `createCacheHelper({driver:'ioredis', url})` selects ioredis v5; the existing `redis`/node-redis driver remains the default.
- Added adapter that maps ioredis lowercase commands into existing cache helper semantics (`set NX/XX/EX`, `mget`, `mset`, `incrby`, `decrby`, `scan`, `quit`).
- Existing namespace-safe `SCAN` deletion, JSON values, TTL handling, and default refusal to `FLUSHDB` remain intact. Injected connections remain caller-owned unless `ownClient:true`.
- Added `createBullMQRedisOptions({url|host,...})` with Redis/Rediss URL parsing, a separate producer/worker retry policy, and explicit prohibition of ioredis `keyPrefix` in BullMQ.
- Queue and cache **share a Redis server if configured**, not an unsafe blocking socket and not the same key prefix. For truly shared physical connection accounting, BullMQ manages its own duplicates.

### ZeruxJS integration

- New private `queue` configuration in `ZeruxConfig`; queues initialize after database/cache and shut down before cache/database, with rollback and per-generation ownership.
- Optional queues mark degraded on startup failure; `required:true` fails application startup, and closes already-open infrastructure.
- Queue Redis credentials and application-supplied worker functions are removed from the public runtime config, along with the existing analytics, tags, reports and email secrets.
- Workers start only when explicitly supplied and should usually run in a separate supervised process. Default queue config only initializes producers.
- The marketing-email delivery API is not automatically queued; future marketing flows can enqueue an email ID, then make delivery/consent/tracking decisions in the worker. Never persist arbitrary SMTP credentials or personal-content payloads in Redis.

### Configuration example

```ts
import {createAnalyticsReconciliationProcessor} from '@zeruxjs/queue';
const reconcileJob=analytics.createReconciliationJob('historic', {since:0,until:Date.now(),site:'demo',batchSize:100},{leaseMs:60_000});
const queue={
  enabled:true, required:false, prefix:'proworkspace',
  redis:{url:process.env.REDIS_URL},
  queues:['emails','analytics-maintenance'],
  workers:{'analytics-maintenance':{
    processor:createAnalyticsReconciliationProcessor({historic:reconcileJob}), concurrency:1
  }}
};
// In a trusted scheduler, not at every web process startup:
await queueService.queue('analytics-maintenance').add('analytics.reconcile',{id:'historic'},
  {repeat:{every:60_000},jobId:'reconcile-historic'});
```

See `apps/proworkspace/packages/@zeruxjs/queue/README.md` and `apps/proworkspace/packages/@zeruxjs/cache-redis/README.md` for complete APIs, operational constraints, and examples.

### Verification and limitations

- Local TypeScript builds: `@zeruxjs/cache`, `@zeruxjs/cache-redis`, `@zeruxjs/queue` passed.
- 24 selected unit, lifecycle, and workspace-tool tests executed: **23 passed, 1 skipped, 0 failed**. The skipped test requires `QUEUE_REDIS_URL` and real BullMQ packages.
- Local ZeruxJS compiler emits JavaScript but the complete TypeScript check still fails because several preexisting workspace dependencies (`zcli`, `zsrv`, lint, hooks, watcher) have not been built in this environment.
- Npm registry access is unavailable here, so BullMQ/ioredis could not be fetched. Package manifests declare real third-party dependencies, but the existing `package-lock.json` cannot have their integrity-checked transitive entries generated offline. Its workspace metadata was updated; **run `npm install` from `apps/proworkspace` with npm-registry access to regenerate the full lockfile before using `npm ci` or deploying**. Do not treat offline mock-driver tests as proof of Redis connectivity or full BullMQ compatibility.
- Recommended production verification: Redis noeviction policy, durability/backup retention, at-least-once idempotent handlers, BullMQ event and retry visibility, concurrent worker testing, queue memory limits and job cleanup, realistic outages, graceful workers, permission boundaries, and multi-instance analytics checkpoint contention.
- Section 51 DB-time leases and a dedicated worker dashboard remain outstanding; a queue alone does not make numeric reconciliation snapshot-complete.
