# Section 75/85 — Redis cache, BullMQ queue and scheduler hardening

**Date:** 14 October 2026  
**Delivery status:** SOURCE HARDENING COMPLETE; **LIVE REDIS/CLUSTER CERTIFICATION NOT COMPLETE**.

## What changed

1. The Redis cache adapter clears namespaces with bounded groups of individually verified keys, avoiding `CROSSSLOT` failures for cross-shard deletes. The injected ioredis Cluster adapter scans every primary, handles cross-slot `mget`/`mset` as individual operations, and refuses `FLUSHDB` on clusters. All operations preserve literal namespace boundaries. A scan is not a transaction or an atomic cutover; stop writers before a mandatory destructive sweep.
2. Queue mode can now create and own separate, real ioredis Cluster producer and worker clients with independent retry behavior; cluster mode requires explicit `{hash-tag}` BullMQ prefixes and rejects conflicting standalone configuration. It cleans up both clients after startup failure and managed shutdown.
3. Queue job input validation now bounds IDs, retry attempts/backoff, delays, deduplication TTL, retention and repeat policies and worker lock durations. Scheduled tasks reject dangerous JSON keys at **all nesting levels**, and excessive nesting.
4. Schedule CRUD for host-facing clients is separately authorized as `schedule-inspect`, `schedule-create`, `schedule-remove`. Results and audit logs reveal schedule IDs/metadata rather than payloads, and queue authorization is checked for each action. Trusted internal `schedules()` remains code-owned and must **not** be exposed directly through HTTP.
5. Added mocked Cluster topology, startup/shutdown, tenancy, permissions, unsafe payload and validation regression tests. Added opt-in live Redis standalone and Cluster tests for two workers, scheduled/delayed jobs, retry state and cache isolation. No test data or secrets are added to the ZIP.

## Usage example

```ts
const worker = await createQueueService({
  redis: {cluster:{nodes:[{host:'redis-1.internal',port:7000},{host:'redis-2.internal',port:7001}]}},
  prefix:'{tenant-blue}',
  queues:['maintenance'],
  workers:{maintenance:{processor:taskRegistry.processor,concurrency:2,limiter:{max:30,duration:60_000}}},
  administration:{
    authorize:(action,queue,principal)=>acl.can(principal,action,queue),
    onAudit:entry=>audit.write(entry)
  }
});
const ctx=await getTrustedHostPrincipal(request);
await worker.operations.scheduleCron('maintenance','nightly',{task:'cleanup'},'0 0 * * *',ctx,{timezone:'UTC'});
await worker.operations.listSchedules('maintenance',{limit:20},ctx);
await worker.close();
```

In real deployments, `taskRegistry` and `acl` come from your application. Never accept a client-supplied principal as already authenticated.

## Results and outstanding acceptance

- Local TypeScript compilation: `@zeruxjs/cache`, `@zeruxjs/cache-redis`, `@zeruxjs/queue`, and needed DB/Email test dependencies.
- Unit suites include a real SQLite-backed queue/outbox regression set. Test totals recorded in the delivery summary.
- Redis/BullMQ, real Redis Cluster, worker restart/crash and network partition, scheduled timezone/DST boundary, Redis ACL/resharding and Section 66 clean npm install **remain unverified**. Running source tests is not certification. Repeat these checks with a provisioned disposable infrastructure stack and record command exits/logs before promoting a release.
- Outbox/SMTP remains *at-least-once*; a Redis job may execute more than once. Never infer exactly-once side effects, or mailbox delivery, from queue completion.

## Next section

**Section 76/85 — ZeruxJS core/runtime/API integration.** Keep the 85-section roadmap package-only; application AIO infrastructure stays out of this plan.
