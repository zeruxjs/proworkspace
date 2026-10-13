# Section 56 — Completion & hardening changes

This follow-up extends the Section 56 delivery without changing the core queue, SMTP and marketing-tracking architecture. The changed-files archive is measured against the **Section 55 full ZIP**, so it contains both the initial Section 56 implementation and this follow-up; the full project preserves all prior sections.

## Added or corrected

- **Reputation snapshot scan-limit boundary:** exactly `scanLimit` ledger records no longer result in a false overflow. A one-record lookahead fails closed when a scan really is truncated.
- **Optional soft-bounce protection:** set both `warnSoftBouncePercent` and `pauseSoftBouncePercent` to act on observed signed soft-bounce feedback. Unset values retain existing hard-bounce/complaint policy. `softBouncePercent` and `sampleSufficient` are included in the reputation snapshot.
- **Contact erasure:** `createMailingListService({store}).erase(email)` performs version-fenced deletion of the contact, including address, lists and traits. DB adapters require atomic `delete` with `affectedCount` or `rowCount`; missing semantics cause an explicit error. This does not erase backups, provider logs or independent consent/suppression histories; applications must follow their own retention and deletion policies.
- **Canonical removal:** `removeFromList` normalizes addresses in the same way as `upsert`, so case changes do not bypass membership deletion.
- **One-off task cancellation:** `queueService.schedules(queueName).cancelOnce(id)` removes a waiting/delayed one-off job; it refuses active jobs or unsupported state checks. Recurring cron/interval schedules continue to use `.remove(id)`.
- **Framework config:** Reputation policy type includes the optional soft-bounce thresholds.

## Validation

- TypeScript: `tsc -p packages/@zeruxjs/email` and `tsc -p packages/@zeruxjs/queue` passed using local workspace links and Node typings.
- Selected unit/regression tests: **91 passing, 1 skipped, 0 failing**, across Email, Queue and Redis Cache. The skipped test requires a live Redis/BullMQ environment.
- Framework runtime suite was not executed because the source archive does not contain the built `packages/zeruxjs/dist/bootstrap/services.js` and the broader workspace dependencies remain unresolved.
- Live PostgreSQL, MySQL, MongoDB, SMTP feedback, BullMQ/Redis and fleet tests are still required before production certification.

## Behavior and safety caveats

SMTP acceptances and signed provider feedback are different facts, and missing feedback is not proof of a healthy sender. Reputation scores are observed-feedback ratios, not inbox deliverability scores. Email activity tracking (opens, click counts and download hooks) stays independent from marketing consent. Bulk mail still requires fresh consent and suppression checks before delivery. Queue workers execute only application-registered task handlers, not executable payloads supplied by Redis.
