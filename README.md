> **Post-Section 85 package release hardening (2026-10-15):** See [POST85_PACKAGE_RELEASE_HARDENING.md](POST85_PACKAGE_RELEASE_HARDENING.md). Public dependency-graph and four foundational npm consumers are repaired/tested locally. Stable release remains **NO-GO** pending registry-backed installation, provider/browser evidence, third-party clearance and maintainer authorization. The AIO application is outside this handoff.



## Section 53 — Queue operations and queued email delivery bridge

See `SECTION_53_QUEUE_OPERATIONS_EMAIL_BRIDGE.md` for bounded queue monitoring, explicit worker recovery controls, optional BullMQ event streams, and the trusted `email.deliver` worker adapter. Marketing consent remains independent of per-message email activity tracking.

### Section 54 — Queue operations and safe scheduled mail

Added opt-in authenticated queue operations dashboard, per-queue authorization and CSRF enforcement, durable CAS-based email delivery state machine with conservative handling of uncertain SMTP outcomes, and ID-only scheduled campaign batches. See `SECTION_54_QUEUE_DASHBOARD_DURABLE_MAIL.md` and `apps/proworkspace/packages/@zeruxjs/queue/README.md`.

### Section 55 — Marketing campaign planning

`@zeruxjs/email` now exposes persistent campaign definitions, segment-aware paginated planning, a signed provider feedback/suppression bridge, and an optional authenticated campaign console. `@zeruxjs/queue` can execute ID-only campaign planning jobs and enforce campaign status before durable SMTP attempts. Consent, bounce suppression and per-email activity tracking remain separate. See `SECTION_55_MARKETING_CAMPAIGNS_SUPPRESSION.md` for the required durable storage and delivery adapters.

### Section 56

Added BullMQ code-registered scheduled tasks (cron, interval and one-off), Redis-coordinated worker throughput limits, provider-neutral email bounce/complaint reputation management, and durable marketing contact-list storage. See `SECTION_56_SCHEDULER_REPUTATION_CONTACTS.md` for configuration, cautions and test results.

**Section 56 continuation:** reputation scan boundaries, optional soft-bounce thresholds, contact erasure, and one-off task cancellation have additional regression coverage. See `SECTION_56_SCHEDULER_REPUTATION_CONTACTS.md`.

### Section 57

Durable delivery reporting, authenticated campaign status charts and reports adapters are described in [SECTION_57_CAMPAIGN_DELIVERY_REPORTING.md](SECTION_57_CAMPAIGN_DELIVERY_REPORTING.md).

### Section 58

Database-native all-time campaign state totals, authenticated provider delivery/defer/bounce/complaint ledger, safe dashboard projections, and Reports chart adapters. See [SECTION_58_CAMPAIGN_NATIVE_PERFORMANCE.md](SECTION_58_CAMPAIGN_NATIVE_PERFORMANCE.md).

### Section 59: Native campaign daily trends

See [SECTION_59_DAILY_CAMPAIGN_TRENDS.md](SECTION_59_DAILY_CAMPAIGN_TRENDS.md) for bounded UTC-day database aggregation, authenticated campaign trend reports, provider-notification counts and honest coverage semantics.

## Section 60 — Function-based campaigns and reusable variables

[Section 60 technical documentation](SECTION_60_DYNAMIC_CAMPAIGNS_DELIVERY_HISTORY.md) describes the one-call marketing API, DB-paginated delivery states, core `{{variable}}` registry and append-only observed delivery history.

### Section 61: Marketing campaign operations, CSV imports and history audits

See [Section 61 technical notes](SECTION_61_CAMPAIGN_OPERATIONS_STREAMED_IMPORTS.md) for the expanded function-first campaign API, stream imports, authenticated campaign UI, shared variable-resolution snapshots, and pending-only recovery.

### Section 62 — Distributed imports, history observations and contact retention

Adds a fenced durable campaign-import job across multiple nodes, an immutable ledger of observed delivery-history gaps, and an explicit dry-run-first contact-retention sweep. See [Section 62 technical documentation](SECTION_62_DISTRIBUTED_IMPORT_HISTORY_PRIVACY.md) for APIs, safety limits and tests.


### Section 63 — IMAP and POP3 inbound email

Added secure read-only inbox polling, durable IMAP UIDVALIDITY/POP3 UIDL deduplication, MIME parsing, attachment hooks, safe inbound HTML, read/folder operations for IMAP, queue polling support, and provider-neutral feedback classification with mandatory trust verification. See `SECTION_63_INBOUND_IMAP_POP3.md`.

Section 64 extends inbound IMAP/POP3 with database-free JSON callbacks, host-owned persistence schemas, incremental and distributed mailbox synchronization, advisory security/spam flags, attachment scanning and retention. See [Section 64 documentation](SECTION_64_INBOUND_JSON_SYNC_SECURITY.md).

### Section 65 — IMAP/POP3 Inbox storage and UI integration

The email receiver preserves both JSON-only receive mode and the built-in database-backed inbox table. It additionally supports mapping messages to existing host-owned tables and exposes an authorization-protected Inbox API for custom paginated inbox interfaces, searches and IMAP message actions. See [`SECTION_65_INBOX_STORAGE_UI_API.md`](./SECTION_65_INBOX_STORAGE_UI_API.md).


## Section 66 — workspace build reproducibility (blocked)

See [Section 66 workspace dependency audit](SECTION_66_WORKSPACE_DEPENDENCIES.md) for the strict lockfile diagnostic, local repair, CI smoke tests and the remaining 14 external dependency resolutions that require a live npm registry. The full clean-install gate is **not yet complete**.

### Section 66 continued: source-preflight and lockfile graph hardening

The workspace now supports `cd apps/proworkspace && npm run verify:source` as an **offline, isolated source-only** check. It copies the entire application and workspace source (not just the package tree), skips secrets/generated files/symlinks, runs workspace tooling regressions and validates the 42-package build plan. This is NOT a replacement for `npm run verify:clean`, `npm ci`, or the full package build.

`npm run deps:check` now also audits transitive locked dependency edges, insecure HTTP tarball sources, malformed registry lock records, and stale workspace links. The 14 missing registry dependencies still block clean installation in this environment. See `SECTION_66_CONTINUATION_DEPENDENCY_HARDENING.md`.

### Section 66 continuation — source exports and build timeouts

Before releasing packages, run `npm run contracts:check` from `apps/proworkspace` to validate declared public file targets, and `npm run verify:source` for the isolated offline source test. The full-build command `npm run build:workspaces` now supports `--timeout-ms` (default five minutes per workspace), while `npm run verify:clean` remains the required **network-enabled** clean-install build gate. The exported `zeruxjs/schema/schema.config.json` asset has been restored. See `SECTION_66_CONTINUATION_EXPORTS_TIMEOUTS.md`. The lockfile still needs 14 real third-party registry resolutions: **Section 66 remains blocked**.

### Security reporting

See [SECURITY.md](SECURITY.md) for the current pre-release support policy and instructions for **private** vulnerability reporting. No stable security-update line has been announced.

### Section 66 — Release gate and security policy

`npm run section66:finalize` runs the isolated dependency-resolving, clean-build and smoke-test gate. It fails quickly on unavailable npm registries, and leaves the checked-in lockfile unchanged until all checks pass. The root [security policy](SECURITY.md) defines private vulnerability reporting and pre-release security-support status. This environment still reports `EAI_AGAIN` and 14 unresolved external lockfile entries, so Section 66 is **not yet production-certified**. See [Section 66 final gate report](SECTION_66_RELEASE_GATE_SECURITY.md).


### Section 67 — Email receiving production-hardening (live gate open)

Additional IMAP folders can now be allowlisted, polled and independently
checkpointed without mixing UID cursors or mailbox identities. POP3 UIDL and MIME
attachment validation are stricter, and inbox API manual polling enforces folder
permission checks. See `SECTION_67_IMAP_MULTI_MAILBOX_HARDENING.md`. Real IMAP/POP3,
clean npm installs and database cluster certification remain pending.

### Section 68 — SMTP acceptance, verified feedback and reputation safeguards

See `SECTION_68_SMTP_FEEDBACK_REPUTATION.md`: outbound envelope classifications distinguish SMTP acceptance from downstream delivery, uncertain/partial outcomes stay out of automatic resend, verified preflight SMTP fallback is explicit, signed provider feedback batches are validated in full before writes, and strict TLS policy defaults are enforced. Live SMTP/provider certification and the prior clean-install gate remain open.

### Section 69 — Durable delivery outbox, crash recovery and CodeQL

`@zeruxjs/queue` adds PII-free DB-backed publish intents, CAS-fenced dispatch, bounded pending-intent reconciliation and conservative expired-delivery recovery. Existing SMTP uncertainty and consent gates are preserved. A new `.github/workflows/codeql.yml` runs JavaScript/TypeScript and GitHub Actions security-and-quality scans independently of the unresolved npm clean-install gate. See [Section 69 technical report](SECTION_69_OUTBOX_RECOVERY_CODEQL.md). Section 66 release certification and live provider verification remain open.

### Section 71 — Analytics collection, privacy, identity and retention

The `@zeruxjs/analytics` package now supports typed allowlisted events, explicit consent rules for pseudonymous visitor/session IDs, origin-bound multi-tenant collectors, optional bot/prefetch suppression, fail-soft DB collection and label-safe metrics. Trusted administrators can page through a site- and age-scoped retention workflow with numeric-first deletion and an approval callback; the previous numeric backfill and durable reconciliation APIs remain. Local Analytics and real-SQLite tests pass (60 passed, 3 optional external connector tests skipped). External PG/MySQL/Mongo tests and clean npm release gates remain outstanding. See [Section 71 documentation](SECTION_71_ANALYTICS_COLLECTION_IDENTITY_RETENTION.md). **Next: Section 72 — Tags.**


### Section 72 — GTM-style draft, publish and rollback governance

`@zeruxjs/tags` now separates draft edits from published server/browser tag evaluation. An independent `authorizePublish` gate, optimistic-CAS immutable releases, retained rollback history, dual-mode no-side-effects preview and origin-bound, consent-aware browser/SSR telemetry are implemented. The admin studio uses hash-pinned JavaScript CSP; published browser listeners refresh without relying on a potentially stale public script cache. Optional GA4/webhook destinations remain server-configured; failures warn without breaking analytics traffic. Local Tags suite: **22 passed**. A real two-connection SQLite release CAS test passes (1/1); other real multi-engine CAS and external destinations and Section 66 clean installation are still open. See [Section 72 documentation](SECTION_72_TAGS_PUBLISHABLE_RUNTIME_GOVERNANCE.md). **Next: Section 73 — Reports.**


### Section 73 — Reports studio, exports and campaign dashboards

`@zeruxjs/reports` now supports tenant-bound saved report stores, separate viewer/editor/export/sensitive-property/campaign roles, bounded UTC date filtering, catalog pagination and CSV/JSON exports. The studio includes an optional marketing report panel for delivery states, native performance, daily trends and consent-enabled observed opens/clicks, always distinguishing SMTP acceptance and provider notifications from unique inbox deliveries. Local Reports tests: **35 passed**; two real SQLite integrations (existing analytics + new tenant/CAS/report COUNT test) pass. Production release remains blocked by the earlier clean-install gate and live multi-DB/SMTP test requirements. See [Section 73 technical report](SECTION_73_REPORTS_CAMPAIGN_ANALYTICS_DASHBOARDS.md). **Next: Section 74 — Database, auth and tenant security.**

### Section 74 — Tenant-safe database operations, migration and backup boundaries

`@zeruxjs/db` adds a fail-closed, opt-in tenant DML facade and a checksum-verified migration runner that requires a real, exclusive, transaction-pinned host implementation. SQL runtime inputs and Mongo schema-operation claims are tightened, while Auth enforces explicit tenant/site permissions and safe table mappings. Real SQLite isolation, rollback, and WAL backup/restore are tested. Live PG/MySQL/Mongo and the old clean-install gate remain outstanding. See [Section 74 technical documentation](SECTION_74_DATABASE_AUTH_MIGRATIONS_TENANT_SECURITY.md). **Next: Section 75 — Redis/Queue scheduler.**

### Section 75 — Redis Cache and Distributed Queue Scheduler

Cluster-safe, tenant-scoped cache clearing and Redis Cluster BullMQ connections are implemented, along with separately authorized schedule operations, bounded job/retention/retry validation, and optional live Redis certification tests. All source/mock tests pass, but **live Redis/Cluster, outage, DST and clean npm installation remain unverified**. See [`SECTION_75_REDIS_CACHE_QUEUE_SCHEDULER.md`](SECTION_75_REDIS_CACHE_QUEUE_SCHEDULER.md). Next: Section 76 — ZeruxJS core/runtime/API integration.

### Section 76 — ZeruxJS framework runtime and service API integration

The framework now rejects overlapping reserved service HTTP paths and protects them from late plugin mutations, fails closed on middleware that does not call `next()` or references an unavailable route guard, and owns template variables per runtime generation. Runtime boot no longer stores raw, potentially credential-bearing configuration on `globalThis`. Tags/Reports/Queue startup types reflect the Section 72–75 governance and Cluster APIs. Local ZeruxJS unit and HTTP integrations and an injected eight-service Node listener pass; external providers, clean npm install and live hot reload across persistent database managers remain release gates. See [`SECTION_76_ZERUX_CORE_RUNTIME_API_INTEGRATION.md`](SECTION_76_ZERUX_CORE_RUNTIME_API_INTEGRATION.md). **Next: Section 77 — ZSRV.**


### Section 77 — ZSRV gateway, protocols and rolling serving

The ZSRV reverse proxy now strips untrusted client forwarding metadata before setting its own socket-derived forwarding chain, refuses invalid WebSocket upgrades, safely aborts over-limit streaming uploads even after upstream headers have been sent, preserves HTTP/2 gRPC upstream authority and trailers, and tracks gRPC transport failures for circuit isolation. Rolling app replacements require a bounded pre-cutover health check before publishing a lease (`--precutover-checks`), followed by existing post-cutover verification/rollback and drain behavior. **171 self-contained ZSRV gateway/rolling/backend tests and 34 workspace-tooling tests pass**, but the complete ZSRV CLI/dev tests, clean-install build, cross-process load acceptance and live external HTTP/3 terminator remain blocked/unverified. See [`SECTION_77_ZSRV_GATEWAY_PROTOCOLS_ROLLING_SERVING.md`](SECTION_77_ZSRV_GATEWAY_PROTOCOLS_ROLLING_SERVING.md). **Next: Section 78 — Frontend interoperability.**


### Section 78 — Frontend interoperability and accessibility

React adapters now pin SSR snapshots and stabilize selected server/client values; Vue integrates with injected Vue 3 effect scopes, manual teardown, and SSR one-shot reads; Zyro observables have explicit route/component subscription ownership. ZeruxJS exposes ARIA tab keyboard/focus helpers and an SSR-safe reduced-motion query. A localhost-only browser fixture is reusable for Sections 81–82. **38 focused tests passed, 1 Chromium browser test skipped; 34 workspace tooling tests passed.** No live React/Vue hydration or headless Chromium certification was possible in this environment, and the Section 66 clean-install dependencies remain open. See [`SECTION_78_FRONTEND_BRIDGES_ACCESSIBILITY.md`](SECTION_78_FRONTEND_BRIDGES_ACCESSIBILITY.md). **Next: Section 79 — CLI/dev tooling.**

### Section 79 — CLI, dev tooling and test runner (source delivery)

The `zcli` package now offers a non-destructive TypeScript/JavaScript starter
(`zcli create`) with exclusive directory creation and dry-run planning. `zeyro`
rejects accidental empty-green CLI test runs, validates config/arguments,
resolves config-relative roots and completes started `afterAll` hooks after bail.
`zwatch` validates polling options before resource allocation and retains safe
cross-platform fallback scanning. `apps/proworkspace` includes `npm run doctor`,
`npm run doctor:strict` and `npm run test:developer` for transparent workspace
lock/source checks and developer package regressions.

**Source/build gate:** Local developer tests pass; the clean machine path
`npm ci → dev → test → lint/typecheck → build → launch` is **not certified**.
The 14 unresolved third-party lockfile packages, live browser/runtime
integration and full OS matrix remain open. See
[`SECTION_79_CLI_DEV_TOOLING_TEST_RUNNER.md`](SECTION_79_CLI_DEV_TOOLING_TEST_RUNNER.md).
**Next:** Section 80 — remaining ecosystem packages and content/files.


## Section 80 — Ecosystem packages and content workflows (2026-10-14)

Completed targeted hardening of streamed file/media size claims, storage copy policies, request-authorized media metadata, AI fallback, document evidence/snapshot safety and sitemap runtime validation. Added a 13-package build/test gate (`npm run test:ecosystem:offline` / `npm run test:ecosystem`) and a real local-files content workflow. **13 builds and 97 offline ecosystem tests passed, plus 36 tooling tests; 42 package source contracts verified.** Live S3/CDN/AI services, provider multipart race tests, clean registry installation and OS/browser release gates remain **unverified/blocked**. See [`SECTION_80_ECOSYSTEM_CONTENT_FILES_QUALIFICATION.md`](SECTION_80_ECOSYSTEM_CONTENT_FILES_QUALIFICATION.md). **Next: Section 81 — ZyroJS standalone runtime.**

## Section 81 — ZyroJS standalone reactive/DOM runtime (2026-10-14)

`zyrojs` now supports owned reactive effects, automatic conditional re-tracking, batched updates, computed disposal, keyed DOM child reconciliation, controlled form bindings and explicit unmount. Network resources reject stale cancelled responses. The package root, `./dom` and `./network` exports were installed and imported from an **offline npm tarball**. Run `cd apps/proworkspace && npm run test:zyrojs` for the repeatable gate (**22 ZyroJS tests + 13 observable bridge tests passed**). Source preflight and 36 workspace tooling tests pass. Browser certification and clean npm install remain open; the 14 prior missing external dependencies were not fabricated. See [`SECTION_81_ZYROJS_STANDALONE_RUNTIME.md`](SECTION_81_ZYROJS_STANDALONE_RUNTIME.md). **Next Section 82 — Zuix CSS standalone compiler.**

## Section 82 — Zuix CSS source/runtime hardening

The standalone `zuix` compiler now has bounded scanning and class generation, safer arbitrary CSS and output paths, deterministic watch regeneration, Vite stale-class invalidation, strict CLI parsing and an offline packed-consumer gate (`cd apps/proworkspace && npm run test:zuix`). See [SECTION_82_ZUIX_PRODUCTION_COMPILER_THEMES_ADAPTERS.md](SECTION_82_ZUIX_PRODUCTION_COMPILER_THEMES_ADAPTERS.md). Chromium rendering and clean npm installation remain unverified release blockers; **Next: Section 83**.


### Section 83 — Package-only live-provider and cross-runtime integration laboratory

Added a versioned package-only integration runner with source, Auth/Security, real SQLite and content/workflow tests, an opt-in disposable PostgreSQL/MySQL/Mongo/Redis/MinIO/GreenMail Compose lab, browser and live email/queue suite wiring, strict skip/failure reporting, optional scoped builds and a manual CI matrix. **Five offline suites pass** (33 source + 11 Auth/Security + 7 SQLite + 1 authenticated package pipeline + 1 content workflow; the shared SQLite file skips 3 optional engine tests). **41 workspace tooling tests pass.** Real PG/MySQL/Mongo/Redis/S3/mail/browser suites have *not* been certified; 14 unresolved external dependencies still block clean `npm ci`. See [Section 83 technical documentation](SECTION_83_PACKAGE_REAL_SERVICE_INTEGRATION_LAB.md) and [`integration-lab/README.md`](apps/proworkspace/integration-lab/README.md). **Next: Section 84 — Package security/API freeze.**

## Section 84 — Package security, reliability, performance and API freeze (2026-10-15)

Added a frozen manifest-level public API baseline for all 42 package workspaces, an offline source/lock security scanner, a license metadata inventory, a required online production advisory gate for clean release CI, bounded Security helper stress tests and security regressions for Z-Dev symlink/traversal containment. The local source and affected-package tests pass; **clean npm installation, real provider/browser fault/load testing and online CVE/license clearance remain blocked/unverified**, so stable-release qualification is not claimed. See [`SECTION_84_PACKAGE_SECURITY_PERFORMANCE_API_FREEZE.md`](SECTION_84_PACKAGE_SECURITY_PERFORMANCE_API_FREEZE.md) and [`RELEASE_BLOCKERS_84.md`](RELEASE_BLOCKERS_84.md). **Next: Section 85 — package-only release packaging and an explicit GO/NO-GO decision.**

## Section 85 — Package release qualification (final scheduled package milestone)

**Source/release-review tooling delivered; public stable-release decision: NO-GO.** The eight npm-public workspace manifests now restrict tarball contents, and a read-only release inventory checks actual `npm pack --dry-run` file listings, runtime/type/CLI entries, licenses, public/private dependency chains and incompatible wildcard ranges. The 34 private workspaces stay private. Source-only inspection is not confused with a post-build tarball check.

From `apps/proworkspace`, use `npm run release:inventory` or `npm run release:decision` for JSON evidence, `npm run test:section85` for the packaging regressions, and `npm run release:pack` **after a clean build** for the strict artifact gate. The existing isolated clean-release command also runs the tarball checks, and a manual Node 22/24 no-publish CI workflow gathers review results. No npm version was promoted and no package was published.

The clean install remains blocked by 14 missing third-party lock entries; public `zeruxjs`/`z-dev`/`zsrv` dependency graphs also need publication-policy changes. Online advisories, all eight built consumers, live providers, Windows/macOS and browser acceptance require evidence. See [Section 85](SECTION_85_PACKAGE_RELEASE_QUALIFICATION.md), [release guide](PACKAGE_RELEASE_GUIDE_85.md), [migration policy](MIGRATION_COMPATIBILITY_85.md) and [NO-GO decision](RELEASE_DECISION_85.md). The separate AIO application remains outside this package roadmap.


### Final package release readiness (2026-10-15)

See [RELEASE_GO_READINESS_FINAL.md](RELEASE_GO_READINESS_FINAL.md). The repository now provides real full-matrix public npm tarball consumer checks, installed third-party license metadata checks and an opt-in registry-backed lockfile recovery workflow. The **stable npm release is still NO-GO** until all external acceptance evidence and maintainer approvals pass; AIO was not changed.
