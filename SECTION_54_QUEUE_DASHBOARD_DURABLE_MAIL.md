# Section 54 — Queue dashboard, durable email delivery and scheduled campaign batches

## Scope

Extends the exact Section 53 project. The queue service and ZeruxJS lifecycle gain an opt-in protected queue operations UI; the queue package gains a persistent-CAS email delivery state machine and bounded campaign-batch scheduling. Existing analytics, tags, reports, ioredis, BullMQ and opt-in email activity interfaces remain intact.

### Queue administration UI

- No routes unless explicitly configured. Default base: `/_queue/admin`, with `/api`, `/app.js`, and `/app.css`. No default account/password.
- Host session authorization on every request, per-queue `administration.authorize` for every status/inspection/action, and a host CSRF token/verification requirement for writes.
- Same-origin write enforcement, bounded JSON bodies and job pagination, strict response headers, redacted metadata only. No SMTP credentials, recipients, job payloads, results, or error stacks in API responses.
- Counts, worker presence, failed/waiting/active/delayed/completed inspection, one-job retry, global queue pause/resume, and local worker pause/resume. Retrying a **failed** BullMQ job is not a delivery-status override.
- Routes belong to the same ZeruxJS runtime generation. Invalid route registration cleans up the queue service. Operator audit callback remains host-owned.

### Durable mail state machine

- Uses an app-supplied `DurableEmailDeliveryStore` with atomic load/save by version, so shared SQL/Mongo storage can arbitrate concurrent workers. An in-process test store exists but is not suitable for production.
- Marketing permission is checked before SMTP starts; the trusted sender must **recheck consent at the SMTP boundary**. Transactional email tracking, open/click/download analytics and per-send tracking switches are unaffected by marketing consent.
- If an email is in `sending` and its lease expires, a later worker marks it `uncertain` rather than initiating another delivery. SMTP failures/timeouts after `sending` also become `uncertain`. Missing consent blocks delivery; consent lookup outages before `sending` release the claim for safe retry.
- An explicitly authorized `resolveUncertainEmailDelivery` operation can mark an independently verified sent/suppressed/rejected outcome without emailing again. Persist operator evidence in the host audit system.
- No full exactly-once guarantee: a provider may accept SMTP after the application's timeout. State transitions prevent blind retries, not all possible ambiguous or concurrent remote-provider behavior.

### Campaign scheduling foundation

`enqueueEmailCampaignBatch(queue, messageIds, {sendAt, attempts})` submits 1–200 validated unique durable IDs with BullMQ delay and deterministic job IDs. It never places message bodies or recipients in Redis. Scheduling and per-email delivery status are separate from the marketing subscription model; there is no automatic recipient import, segmentation, full campaign UI or persistent campaign index yet.

## Verification

- `@zeruxjs/queue` TypeScript build passed.
- `@zeruxjs/cache`, `@zeruxjs/cache-redis`, `@zeruxjs/email` TypeScript builds passed.
- 22 queue-focused tests passed; one real-Redis test skipped because no Redis/BullMQ installation was available.
- 24 email tests, four Redis cache tests, and seven workspace-tool tests passed.
- Nine selected ZeruxJS queue/service-lifecycle tests passed (including new route lifetime/rollback checks).
- Broader HTTP integration suite requires missing workspace module builds (`zsrv`, analytics, etc.) and is **not counted as passing**. Full framework TypeScript compilation still fails on unresolved workspace imports.
- Archive manifests compared bytewise against exact Section 53 full ZIP; generated `dist` output and development symlinks are excluded.

Overall distinct selected checks: **66 passed, 1 skipped, 0 failed**. A separate broader HTTP suite was attempted but could not complete because other workspace packages were not built.

## Production blockers

Full dependency installation and lockfile regeneration, real Redis/BullMQ and SMTP execution, live shared DB CAS under cross-server contention, authenticated proxy deployment, durable audit and alert delivery, campaign recipient/segment persistence, SMTP-provider reconciliation, and end-to-end workspace certification. Source APIs are useful now, but this is **not** a fully certified production marketing platform.
