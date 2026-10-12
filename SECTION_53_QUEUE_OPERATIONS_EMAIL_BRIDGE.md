# Section 53 — BullMQ operations, recovery controls and email delivery bridge

## Scope

Expanded Section 52's `@zeruxjs/queue` while retaining Redis/ioredis connection policy, ZeruxJS generation-scoped cleanup, and all Analytics/Tags/Reports and email features. This section focuses on **operational control and a trusted email delivery bridge**, not full marketing campaign orchestration.

### Queue monitoring

- `service.snapshot()` reports Redis-backed waiting/active/delayed/failed/completed/paused/prioritized/parent-waiting counts, plus local-worker/stream configuration per queue.
- `events:{enabled:true,...}` optionally consumes cross-worker BullMQ `QueueEvents` from Redis streams using dedicated connection options. Whitelisted notices include queue, event type, optional job ID and UTC timestamp. Failure reasons, job payloads, result bodies, SMTP credentials and transport errors are not forwarded in event notices.
- Subscribes to completed, failed, waiting, active, stalled and progress. Streams initialize under readiness deadline and close during service shutdown. Startup rolls back constructed resources when streams fail to become ready.
- `service.operations.inspect` supports bounded, state-filtered paginated records without returning job `data`, raw return values or exception details. Maximum page size is at most 100; applications can configure a lower cap.

### Recovery controls

- `service.operations.retryFailed` handles one specific job, checks its current state then calls BullMQ's atomic job retry operation. This is intentionally not a broad replay endpoint.
- `pauseQueue` / `resumeQueue` act globally in Redis; `pauseWorker` / `resumeWorker` operate only on the current process's worker.
- Every operation uses a host-authored, per-call `administration.authorize` callback. Without it, the administrative API is denied. An optional best-effort audit callback records action, queue, optional ID, outcome and timestamp; no data. Audit durability and HTTP-level authentication/CSRF are the host application's responsibility. **No queue admin HTTP routes are auto-mounted.**
- Trusted code still has the preexisting raw queue producer (`service.queue`) and `getJob` methods. Do not publish these directly to users: `getJob()` yields raw BullMQ objects that can contain sensitive payloads.

### Email queue adapter

- `createEmailDeliveryProcessor()` accepts only `email.deliver` jobs carrying one validated stable `messageId` and resolves all email data via a trusted shared store.
- Marketing consent is checked from the current durable preference store; unsubscribed emails are suppressed before acknowledging completion. Consent database outages reject the job, never bypass consent. Transactional emails remain independent of marketing consent.
- `enqueueEmailById()` constructs a stable job ID, delay, retry policy, and an opaque `{messageId}` only; email content and recipients are not serialized to Redis.
- Activity tracking is never coupled to consent or the queue. It remains opt-in per email, with the existing Section 46+ open, click and download activity implementation retained unchanged.
- Exactly-once email is **not guaranteed**. A trusted `deliver()` implementation must use a durable idempotency claim and handle uncertain SMTP outcomes; the email manager must check consent again immediately before sending to close the worker-check race.

## Verification

- TypeScript build passed for `@zeruxjs/cache`, `@zeruxjs/cache-redis`, and `@zeruxjs/queue` using local compiler and Node typings.
- 26 selected cache/queue/framework/workspace-tool tests: **25 passed, 1 skipped (real BullMQ/Redis), 0 failures**. Tests cover permission denial, bounded redacted inspection, single-job retry and state checks, local/global pause, QueueEvents listener isolation and shutdown, startup rollback, fresh marketing consent and consent outage, and enqueue payload restrictions.
- The full ZeruxJS TypeScript build is **not certified** because unrelated workspace imports (`zcli`, `zsrv`, `zwatch`, `@zeruxjs/lint`, `@zeruxjs/hooks`) are unresolved in the current offline install. Its `dist` bootstrap output was sufficient for the selected runtime tests and was excluded from the deliverable.
- npm registry dependencies BullMQ and ioredis still require an online install and lockfile reconciliation. Live Redis, event-stream failover, real multi-node worker contention, SMTP acceptance recovery, and durable email delivery claims remain to be verified. No fake live certification.

## API details

See `apps/proworkspace/packages/@zeruxjs/queue/README.md` for examples and production cautions. The queue admin API is intentionally not exposed through HTTP without host wiring; attach authentication and CSRF protections before building an operator-facing dashboard.
