# Section 69 — Durable email publish outbox, crash recovery and CodeQL

Date: 2026-10-13. Scope: reusable ZeruxJS packages and repository security workflow, **not the separate AIO hosting application**.

## Why this is needed

The previous email delivery pipeline had three separate durability boundaries: a database delivery row, a Redis/BullMQ job, and a separately written, append-only observed-state journal. A database transaction cannot atomically commit a row in PostgreSQL, MySQL, MongoDB or SQLite **and** publish an external Redis job. Claiming exactly-once SMTP delivery or atomic history for these independent systems would be incorrect.

This section implements recoverable **at-least-once queue publication** with stable BullMQ job identity and conservative failure handling. The SMTP side retains the Section 68 rule: once a submission may have started, **never automatically resend based solely on expired leases**.

## Implementation

### Durable intent storage

`@zeruxjs/queue` exports `createDatabaseDeliveryOutbox(db, table?, clock?)` using the existing `DeliveryDatabase` adapter: `createTable`, `insert`, `select`, `update` and atomic `affectedCount`-based compare-and-swap. The new `zerux_email_publish_outbox` table holds only an opaque message ID, version, status, lease deadline and a serialized **PII-free** intent with scheduled time, attempt budget and metadata. It does not store recipients, MIME bodies, credentials, or campaign personalization. An optional index accelerates actionable scans.

Operations include `register`, `get`, `page`, `due`, `claim`, `settle`, and a separately authorized redrive mechanism. `register` is idempotent for exactly matching scheduling/attempt settings and rejects conflicting requests. Claims use version CAS and short-lived random fencing tokens; expired leases can be reclaimed by another process.

`due()` performs an indexed, bounded scan for only `pending` or expired `leased` rows, so large published archives cannot prevent new work from being discovered. Operator polling is explicitly bounded by page size and maximum pages.

### Integration with the existing campaign/queue API

The drop-in `createOutboxBackedEmailQueue({outbox, now, dispatch?})` accepts the existing `email.deliver` `{messageId}` job interface and commits the intent before attempting any Redis work. Its acknowledgement means **stored in the database**, **not delivered or queued in Redis**. A worker or scheduled `createDeliveryOutboxJobProcessor`/`dispatcher.runPage` must drain the intents. Example:

```ts
import {
  createDatabaseDeliveryOutbox,
  createDeliveryOutboxDispatcher,
  createOutboxBackedEmailQueue,
  createDeliveryOutboxJobProcessor,
} from '@zeruxjs/queue';

const outbox = createDatabaseDeliveryOutbox(db);
const producer = createOutboxBackedEmailQueue({outbox});

// Use producer in createMarketingCampaignService({db, queue: producer, delivery, ...}).
// Use the actual BullMQ queue only in the dispatcher:
const dispatcher = createDeliveryOutboxDispatcher({outbox, queue, delivery});
await dispatcher.runPage({limit: 100});

// Optionally register this processor as a recurring email.outbox.poll job.
const processOutbox = createDeliveryOutboxJobProcessor(dispatcher, {
  pageSize: 100,
  maxPages: 10,
});
```

All Redis jobs are `email.deliver` with only `{messageId}`, a stable `jobId`, and the original absolute schedule converted to a remaining delay at dispatch time. Persisted outbox intents survive a Redis outage. Retrying a queue publish after a DB-ack crash may publish **the same stable job ID twice** across retention windows; downstream delivery CAS is still the mandatory protection against double SMTP submission.

### Conservative recovery and operator redrive

`createEmailDeliveryRecoveryScanner({store, now})` runs a bounded campaign scan. Dry run is the default. Expired `claimed` records become `pending` (SMTP has not started). Expired `sending` records become `uncertain` and are **not automatically resent**. Use the journalled delivery store to observe these transitions; independently stored history is still not transactional.

`createMissingEmailPublishIntentScanner({source, outbox, allowCampaign})` addresses the crash window where a pending delivery was committed to the DB **before** its corresponding intent was registered. It requires a trusted campaign approval callback, bounded keyset pagination and defaults to dry-run. It never registers a sent/uncertain/claimed/sending delivery. The host decides an appropriate absolute `scheduledAt` and retry budget.

`createDeliveryOutboxRedriver({outbox,delivery,queue,authorize})` may explicitly reopen a `published` intent only when the durable delivery is still `pending`, there is no BullMQ job for the stable ID, and the server-side authorizer approves it. It does **not** run automatically.

**Important operational limitations:** A DB/Redis distributed transaction is not claimed. There is no guaranteed exactly-once delivery, nor proof of final inbox receipt. The outbox registration and delivery-row insert are still two commits, which is why the explicit missing-intent reconciliation exists. Schedule periodic dispatcher runs and monitor failed/deferred/unacknowledged intents. In production qualify the connector's atomic affected-row semantics and time consistency, and ensure queue-job IDs cannot be recycled unsafely.

## CodeQL — `.github/workflows/codeql.yml`

Added a dedicated advanced-setup CodeQL workflow scanning **all ZeruxJS/ZyroJS/Zuix JavaScript/TypeScript source and the repository's GitHub Actions workflows**. Both matrix jobs run `security-and-quality` queries to detect security flaws as well as relevant reliability/maintainability issues.

- Automatic triggers: pushes, pull requests, merge queue requests and a scheduled weekly run (Monday 03:17 UTC); manual dispatch is available.
- Least privilege: root `permissions: {}`, individual job gets `contents: read`, `actions: read`, `security-events: write`; no secrets, write access to repository content, or `pull_request_target` event.
- Uses a commit-pinned checkout action with `persist-credentials: false` and the current major `github/codeql-action@v4` per the action author's version-update recommendation.
- Runs Node-independent, no-build extraction (`build-mode: none`) so the **Section 66 incomplete npm lockfile** does not prevent security analysis of tracked source. Both the JavaScript/TypeScript and Actions queries scan the repository in independently categorized runs; no compiled JS or npm resolution is falsely asserted.
- Excludes only generated/dependency output directories (`dist`, `build`, `node_modules`, `.next`, `coverage`) and minified JS from duplicate/noisy analysis; first-party framework, mail, routing, auth, queue, database, front-end source and tests remain included.
- Per-language concurrency for PRs, 50-minute job timeout, and failures are reported separately (no `continue-on-error`). SARIF analysis/results require GitHub code scanning to be enabled and supported for the repository's visibility/plan; scheduled jobs are only run for the default branch. Avoid enabling duplicate CodeQL default and advanced setups in parallel.

CodeQL is static analysis and **not** a replacement for dependency vulnerability alerts, signed release artifacts, SAST triage, live SMTP/Redis fault injection, or authentication tests. Review findings before a production release.

## Verification evidence

- Email regression: **126 passed, 4 skipped, 0 failed** (local baseline).
- Queue regression: **56 passed, 1 skipped, 0 failed**, including new real SQLite dual-connection fencing/crash/ack and recovered delivery-state tests.
- Other package and workspace regressions are run separately and reported in the Section 69 delivery message.
- CodeQL workflow: YAML parsing and static configuration review. **Actual GitHub-hosted CodeQL scanning is not executable in this environment**; verify security alerts and workflow permission behavior after pushing.
- Section 66 clean `npm ci` remains unverified because the npm registry was inaccessible and the lockfile has unresolved external packages. It must remain an explicit release blocker, not an excuse to claim complete integration.

## Release and migration

The new outbox is **opt-in**. Existing direct queue producers remain backward compatible. To migrate, configure an appropriate database connector, create the outbox with the same connector used for delivery state, switch campaign enqueue to the outbox-backed queue, and start recurring dispatch. Run a dry-run missing-intent reconciliation for existing pending rows; review results before enabling registration. Keep permissions and sender consent/suppression decisions with the durable delivery processor, not the outbox dispatcher.

See `SECTION_68_SMTP_FEEDBACK_REPUTATION.md` for SMTP acceptance uncertainty and `SECTION_62_DISTRIBUTED_IMPORT_HISTORY_PRIVACY.md` for existing history-gap monitoring.
