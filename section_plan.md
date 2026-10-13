# ZeruxJS / ZyroJS / Zuix — package-only sections plan (Sections 1–85)

**Plan version:** 2.0 (package-only scope revision) · **Prepared:** 13 October 2026 · **Current package source:** Section 68 (source delivered; live gates open) · **Target final milestone:** **Section 85 (package-only stable-release decision)**

> **Short answer: 20 substantial sections remain — Sections 66 through 85.** This is a **finite, scope-frozen target**, not a guarantee that all engineering problems will be resolved in exactly 20 conversations. Each section can have multiple implementation/test passes **without creating a new section number**. A section is *finished* only when its acceptance criteria pass. If a blocking external dependency, production defect, or missing integration prevents a criterion from passing, record it as **blocked**, not as completed.

## 0. Scope clarification: packages only — NOT the AIO application

This document governs the **reusable package ecosystem**, especially `zeruxjs`, `zyrojs`, `zuix`, `zsrv`, `zcli`, `z-dev`, `zwatch`, `zeyro`, and the `@zeruxjs/*` workspace packages. Application/sample fixtures may be built **only to exercise these packages**, not to implement an unrelated product.

**Explicitly excluded from this section sequence:** the separate AIO/server-manager application; its CoreDNS authoritative zones, nameservers and DNSSEC; registrar configuration; Nginx/Certbot control-plane automation; operating-system firewall management; cluster DNS replication; hosting-panel administration; and application-level orchestration of customer domains. Those deserve an **independent AIO application roadmap** and must not consume Sections 66–85. The reusable `zsrv` server/proxy package **is included**, but provisioning/managing an AIO infrastructure installation **is not**.

**Section count remains:** **65 past sections + 20 planned sections (66–85) = target Section 85.** The final five sections are now reserved for **ZyroJS**, **Zuix**, cross-package integration, security/performance, and package-release qualification. The roadmap deliberately aims to finish a defined production-quality scope instead of adding an indefinite section for every new feature.

## 1. What “finished” means

The goal is a **usable, documented, installable, security-reviewed stable package release** of the ZeruxJS / ZyroJS / Zuix ecosystem; it does **not** include production certification of a separately deployed AIO application. It does **not** mean feature parity with every commercial cloud platform, GA4, GTM, Looker Studio, cPanel, Google Mail or AWS SES; their full feature sets are effectively unbounded. The target is the concrete functional scope below with honest limitations.

### In-scope products and requirements

1. **Framework and runtime:** `zeruxjs`, `zyrojs`, server-side application lifecycle, fetch/Node HTTP, SSR-friendly patterns, hooks, typed routes, validation, rendering and globally reusable `{{variables}}`.
2. **Serving / operations:** `zsrv`, `z-dev`, `zwatch`, `zcli`, `zeyro`; HTTP/1.1 and HTTP/2, supported proxies/upgrades/streams, WebSocket/SSE, gRPC/Connect/tRPC/JSON-RPC/MCP boundaries, compression, load balancing, zero-downtime rolling changes, graceful shutdown, fleet controls and operational visibility. HTTP/3/QUIC/WebTransport may need an appropriately tested external terminator; no false native-support claims.
3. **Styling and interoperability:** `zuix` CSS framework, `@zeruxjs/react`, `@zeruxjs/vue`, `@zeruxjs/zyro`, accessibility, performance and browser/runtime interoperability.
4. **Data and security:** Postgres, MySQL, MongoDB and SQLite connectors; cache/Redis, migrations/transactions/consistency semantics, auth, security utilities, tenant isolation, permission boundaries and secret handling.
5. **Files and content:** local and S3-compatible/AWS file storage; safe upload/download/stream/view, multi-store configuration, private/public access, encryption/key management/caching where supported; media and asset management, search, SEO, feeds, fonts and sharing.
6. **AI utilities:** provider-based AI, bounded retrieval and its security/streaming/documentation; not training a foundation model.
7. **Queue and automation:** BullMQ, Redis/ioredis, one-off jobs, cron/repeat/interval scheduling, delayed tasks, retries, operational dashboard, distributed worker/rate controls, safe recovery and shutdown.
8. **Analytics / tags / reports:** internal GA4-like event collection, GA4 destination support, server `astag` and browser `ttag`, dataLayer/Beacon/SSR hooks, GTM-like tag/trigger/variable/version workflows, and report/dashboard/chart APIs with accuracy and privacy guarantees. Missing analytics DB or analytics errors must **warn / fail soft**, not break application traffic or email.
9. **Email outbound:** multi-account SMTP (password, OAuth2, supported custom transports), HTML/plain templates and attachments, opt-in activity tracking (open/click/confirmed download), marketing consent *independent of tracking*, provider-independent sending safeguards, bounce/complaint history, reputation controls, suppression, campaigns, pagination, personalization, queueing and reporting. **Never automatically retry uncertain SMTP deliveries.**
10. **Email inbound:** IMAP and POP3, secure authenticated connections, MIME/HTML/plain/attachments, scanning hooks and advisory spam/security flags, incremental sync, JSON-only callback mode **without tables**, package-managed DB mode **with automatic table creation**, mapped host-owned tables and authorized, paginated custom-inbox APIs.
11. **Operations and distribution:** reproducible lockfiles/builds, security checks, real database/Redis/IMAP/POP3/SMTP integration tests, Windows/Linux testing where relevant, browser tests, migration and recovery tests, documentation, deployment examples and a versioned release.

### Definition of done (package release gates, evaluated by Section 85)

- [ ] **Reproducible setup:** a clean checkout installs from a committed, valid lockfile and builds *all* supported workspace packages in dependency order without hand-created module links or untracked `dist` files.
- [ ] **Cross-package integration:** generated apps start, serve, stop, redeploy and recover with framework, ZSRV, UI, DB, cache, queue, email, analytics, tags and reports functioning together.
- [ ] **Real external services:** targeted integration suites pass on available real PostgreSQL, MySQL, MongoDB, SQLite, Redis/BullMQ, IMAP, POP3 and SMTP environments; unsupported optional services are explicitly documented instead of implicitly certified.
- [ ] **Email privacy and safety:** both receive modes work; durable and custom inbox queries enforce account/tenant authorization; consent/suppression/provider feedback cannot be bypassed; open/click/download tracking remains independently opt-in; unknown SMTP outcomes are never blindly retried.
- [ ] **Correct history:** where the database can provide transactions, delivery state, outbox, and history use a provable atomic/reconciliation contract. No inaccurate claim of exactly-once SMTP delivery.
- [ ] **ZyroJS production readiness:** reactivity, DOM ownership, async/network behavior, teardown, SSR/hydration where supported and cross-framework adapters pass browser-level stability and memory-leak tests.
- [ ] **Zuix production readiness:** a deterministic CSS compiler, incremental watch, token/themes/variants, public CLI/adapter exports, accessibility-safe styles and release artifact checks pass real app/browser tests.
- [ ] **No application dependency:** package builds/tests/releases can be executed without configuring an AIO manager, authoritative DNS, registrar, Certbot, or an application fleet.
- [ ] **Security and resilience:** credentials never appear in public API payloads/logs, authorization/CSRF/SSRF/XSS/SMTP/MIME/attachment boundaries have threat-model tests, and failures/rolling updates are exercised under load.
- [ ] **Developer quality:** public APIs, configuration schema, examples, compatibility/migration guides, deprecations, tests, lint, CI and release artifacts are documented; no unexplained critical release blockers remain.
- [ ] **Package release evidence:** a final package-only test matrix records environments, commands, results, exceptions and open risks; Sections 1–85 remain traceable.

**Release boundary:** a service integration is tested because the package uses it (e.g., Redis, Postgres, SMTP), not because this plan promises to provision an AIO hosting application. No package should require the AIO manager as an undeclared dependency.

**Important distinction:** “Section implemented” in earlier responses means the *section's code/tests were delivered*, not the entire ecosystem was production-certified. Several earlier results were selected package suites with skipped live-service tests.

## 2. Past work — retrospective Section 1 through Section 65

Status `Implemented / needs qualification` means code was reported or is present in the Section 65 source, **not** that every feature has passed an integrated production environment. Sections 4 and 5 are reconstructed from the prior project development discussion; standalone Section 4/5 technical files are not present in the current archive.

| Section | What was delivered / focused on | Remaining qualification or follow-up |
|---:|---|---|
| **1** | Framework-neutral `@zeruxjs/search`, `seo`, `feed`: scoring/search, structured meta and sitemaps, RSS/Atom/JSON Feed. | Production integration, broad package testing. |
| **2** | Modularized media, assets, search, SEO, feeds; streamed media, import/export and response helpers. | Distributed media/index storage, app integration. |
| **3** | AI provider abstraction, document retrieval/grounded prompts, in-process MCP-style tool/resource dispatcher. | Streaming/provider qualification; MCP subsequently consolidated into ZSRV. |
| **4** | Fonts, accessibility utilities and sharing APIs: font loading/preload, focus/ARIA/reduced-motion, share/clipboard/link helpers. | Real browser and accessibility audits. |
| **5** | Performance and web-vitals helpers, React/Vue bridges, observable/derived `zyro` state utilities. | Real React/Vue and ZyroJS/browser interoperability tests. |
| **6** | `zwatch` shared-process file watcher and `zcli` argument parser hardening. | Large-tree and cross-platform process tests. |
| **7** | `z-dev` request-body/host guards; `zsrv` authority/forwarding and route matching. | Full HTTP integration. |
| **8** | ZSRV route registry reliability. | Multi-process route reconciliation. |
| **9** | WebSocket proxy/tunnel and process lifecycle protections. | Real network and failure tests. |
| **10** | Graceful proxy shutdown/draining. | Under-load shutdown validation. |
| **11** | Managed process identity and safe termination. | Cross-platform supervised process tests. |
| **12** | Cross-platform restart/process identity hardening. | Windows/Unix process test matrix. |
| **13** | Coordinated proxy startup and restart. | Concurrent-controller qualification. |
| **14** | Startup state recovery. | Crash-injection tests. |
| **15** | Crash-recoverable startup journal. | Durable storage and power-loss cases. |
| **16** | Coherent startup-state publication and reading. | Filesystem/controller stress validation. |
| **17** | Route ownership leases and safe registry behavior. | Multi-node network validation. |
| **18** | Application process supervision and CLI safeguards. | Real process faults and limits. |
| **19** | Health-check policies and bounded restart behavior. | Production failure simulation. |
| **20** | Managed app status and safe manual reload. | Role controls and integration. |
| **21** | Multi-instance readiness routing and handover. | Real failover, draining, proxy behavior. |
| **22** | Rolling deployment orchestration. | Cluster deployment testing. |
| **23** | Rolling CLI, cross-process drains and deployment history. | Persistence/concurrency validation. |
| **24** | Crash recovery and retention for rolling wrappers. | Restart/rollback fault tests. |
| **25** | Persistent health reconciliation across controllers. | Split-brain and storage failures. |
| **26** | Health-aware multi-instance supervision. | Fleet integration. |
| **27** | Fleet CLI, durable restart budgets, crash-recovery checks. | Multi-host qualification. |
| **28** | Dynamic fleet autoscaling/capacity repair. | Resource-policy and actual-host testing. |
| **29** | Resource-aware fleet scaling, metrics and observability. | Metrics fidelity and live load tests. |
| **30** | ZSRV consolidation, workload safeguards and refactoring. | Gateway production qualification. |
| **31** | Integrated ZSRV protocols, MCP location, HTTP/WS/streams, compression and proxy coexistence work. | Confirm native versus external-terminator HTTP/3/QUIC/WebTransport; interoperability. |
| **32** | ZeruxJS/ZyroJS framework integration, cache and stream/protocol controls. | Browser/server end-to-end tests. |
| **33** | ZCLI and Zeyro tooling/testing foundation. | Complete CLI and test-runner integration. |
| **34** | Cache and database reliability. | Connector/Redis-cluster certification. |
| **35** | DB, MongoDB, auth and security improvements. | Real engines, permission and tenant isolation. |
| **36** | Hooks, TypeScript/lint tooling and HTTP validation. | Full workspace build and CI. |
| **37** | Media, asset manager, AI and retrieval improvements. | External storage/provider and security tests. |
| **38** | Accessibility, performance, share and frontend bridges. | Real browser and framework testing. |
| **39** | Search, SEO, feed, font and framework content endpoints. | Crawler/browser and published-app tests. |
| **40** | Dev/watch/runtime staged hot reload, rollback, safe handler handoff and draining. | Full application lifecycle and concurrency tests. |
| **41** | `@zeruxjs/files`, email SMTP service and opt-in DB-backed analytics/tracking. | Multi-store/SMTP/analytics integration. |
| **42** | Build workflow, ordered lifecycle/scoped DB/cache/files/email/analytics services, rollback. | Reproducible clean-build verification. |
| **43** | HTTP analytics collector, email tracking endpoints and bounded telemetry delivery. | Web/runtime production traffic tests. |
| **44** | Encrypted email tracking links, idempotent content instrumentation, safer collector ingress. | Key/consumer compatibility and privacy. |
| **45** | Rotatable authenticated email-tracking token keys and legacy transition policy. | Operational key rotation. |
| **46** | Marketing consent and one-click unsubscribe kept separate from per-send email activity tracking; open/click/download observations. | Shared persistent identity/consent, provider tests. |
| **47** | `analytics` IDs and storage, server/browser `tags`, `reports` charts/dashboard, versioned definitions. | Completeness of GA4/GTM/report-style workflows. |
| **48** | Native SQL/Mongo analytics grouping and exact-count reports. | Live multi-database execution. |
| **49** | Numeric metric fact materialization and DB-side sum/avg/min/max. | Backfill/cross-store atomicity. |
| **50** | Reconciliation/backfill for historical numeric facts. | Consistent historical coverage. |
| **51** | Durable reconciliation jobs, CAS checkpoints and fenced worker leases. | Multi-node databases/time consistency. |
| **52** | BullMQ queue, ioredis cache compatibility and reconciliation queue worker. | Live Redis/BullMQ worker suite. |
| **53** | Queue inspect/retry/pause/events APIs and queued-email bridge. | Safe operator/runbook validation. |
| **54** | Authenticated queue dashboard and conservative durable mail send-state machine. | Live SMTP uncertainty/Redis tests. |
| **55** | Campaign planning, audience segmentation, signed feedback, suppression and optional management UI. | Production-scale campaign orchestration. |
| **56** | Code-registered cron/repeat/one-off tasks, rate-limited workers, reputation/bounce/complaint ledger, marketing contact storage; later scan/erasure hardening. | Provider-verifiable feedback and live queue tests. |
| **57** | Durable delivery-state store, paginated campaign reporting and reports charts. | Multi-DB scale tests. |
| **58** | DB-native exact campaign totals and authenticated provider-outcome ledger. | Real provider coverage and large databases. |
| **59** | Native UTC-day campaign trends, date-range API and charts. | Current-state-versus-event-history distinction. |
| **60** | One-call function-based marketing campaigns, one-copy templates, per-recipient JSON, core `{{variable}}` registry, observed delivery history. | Atomic history and full framework integration. |
| **61** | Streaming/CSV audience imports, recipient expansion, pause/resume, queue redrive, private marketing dashboard, preview and audit. | Cluster/scale/operational approval. |
| **62** | Distributed fenced import jobs, durable history-gap observations and contact retention sweep. | Outbox/transactional repair, cross-DB tests. |
| **63** | IMAP/POP3 receive, MIME and attachments, durable identities, mailbox polling, signed/trusted feedback boundary. | Real live mail-server tests. |
| **64** | JSON-only inbound mode, storage-independent callback, incremental IMAP sync, safety/spam/violation markers, scanner hooks and retention. | Production MIME/security validation. |
| **65** | **Both** package-managed DB table and JSON mode preserved; custom table/column mapping; authorized account-scoped paginated inbox UI APIs. | Real provider, custom-schema and multi-tenant integration. |

### Historical documents in the source tree

- **Sections 1–3:** `SECTION_PROGRESS.md` and `apps/proworkspace/packages/{PLACEHOLDER_IMPLEMENTATION.md,SECTION_2_MODULAR_PROGRESS.md,SECTION_3_AI_MCP_PROGRESS.md}`. Section 4/5 descriptions come from previous project discussion rather than dedicated files.
- **Sections 6–33:** individual `SECTION_6_...md` through `SECTION_33_...md` at repository root. Section **31 has two** technical documents covering its protocol/consolidation work.
- **Section 34:** `apps/proworkspace/packages/SECTION_34_DATA_CACHE_DATABASE.md`.
- **Sections 35–65:** individual root `SECTION_35_...md` through `SECTION_65_INBOX_STORAGE_UI_API.md` files, plus the Section 56 continuation changelog.

## 3. Future work — fixed plan: Sections 66–85

**Legend:** P0 = release blocker, P1 = essential v1 functionality, P2 = documentation/operational polish. All proposed section titles and order are **planning commitments, not an assertion that the features already exist**.

### Phase A — Make the existing code installable and email-complete (66–70)

#### Section 66 — Reproducible workspace and dependency repair **[P0]**

**Status (13 October 2026): IN PROGRESS / BLOCKED.** Local workspace metadata and an offline isolated full-source preflight are verified (18 tooling tests; all 42 workspaces planned). Lockfile validation now covers missing transitive edges, insecure downloads, and orphan links. A real `npm ci` and full build remain **unverified** because 14 third-party resolutions are missing and registry access fails. See `SECTION_66_WORKSPACE_DEPENDENCIES.md` and `SECTION_66_CONTINUATION_DEPENDENCY_HARDENING.md`.

**Work:** Reconcile package exports, missing imports, workspaces, generated outputs, Node/TypeScript versions and npm lockfiles across `zeruxjs`, `zcli`, `zsrv`, `zwatch`, hooks, lint and newer Email/Queue dependencies. Remove reliance on local `node_modules` symlinks or precompiled unshipped `dist`. Audit build order and optional dependency loading. Run isolated package tests plus a clean checkout install/build/test smoke run.

**Exit gate:** All supported workspaces install and compile from committed sources and lockfiles in a clean environment; smoke-test a booted ZeruxJS application. If the npm registry or a platform is unavailable, the section stays blocked with reproducible commands/evidence rather than claiming clean-build success.

#### Section 67 — Production-quality IMAP/POP3 and custom inbox storage **[P0/P1]**

**Status (13 October 2026): SOURCE HARDENING IMPLEMENTED / LIVE GATE OPEN.** Multi-folder allowlists, bound cursors, per-folder distributed checkpoints, parser/attachment/POP3 UIDL safety and authorization checks are tested against mocked protocols and SQLite. Email and Queue tests pass. Two live protocol tests are provided but skipped without test-server credentials and external npm packages. Section 66 clean-install certification is also still blocked; do not claim Section 67 production-complete until real integration acceptance passes. See `SECTION_67_IMAP_MULTI_MAILBOX_HARDENING.md`.

**Work:** Finish real IMAP/POP3 interoperability, TLS/STARTTLS/OAuth rules where protocol supports them, incremental resume, multi-mailbox UID handling, safe timeouts and reconnects; MIME nesting/headers/attachments/CID, stream and size limits, HTML sanitation, malware/spam/advisory policy hooks, mailbox action semantics; validate all **three receiving modes**: JSON with no tables, package-created inbox table, host-mapped existing schema. Improve database-native pagination/search and account/tenant isolation; test callback replay and cursor guarantees.

**Exit gate:** Real IMAP/POP3 test servers + SQLite integration prove message and attachment parity, deduplication, no accidental remote deletion, storage-mode selection, pagination and user-authored UI operations; hostile MIME tests pass.

#### Section 68 — Outbound email, feedback and reputation correctness **[P0/P1]**

**Work:** Test password/OAuth2/custom SMTP pathways, multi-account selection/failover, attachments and templates, queue throttling, policy-controlled marketing vs transactional messages; bounce, complaint, delivery, deferral ingestion from verified webhooks/mailbox feedback; maintain separate event and suppression tables, rolling rate thresholds, explicit unknown-feedback state, one-click unsubscribe and independent per-email activity tracking. Document SPF/DKIM/DMARC and sender authentication prerequisites, and provide safe per-transport diagnostics.

**Exit gate:** SMTP acceptance and confirmed downstream outcomes cannot be conflated; duplicates, forged notices, transient failures and uncertain sends are handled correctly. Test transports and at least one real SMTP/provider integration; no default retries of uncertain SMTP outcomes.

#### Section 69 — Atomic outbox, delivery transitions and crash recovery **[P0]**

**Work:** Database-side outbox and append-only journal contract for campaign delivery; use real transactions where available, CAS/fencing otherwise, idempotent queue publication and bounded reconciliation of delivery state / journal / pending enqueue. Crash-inject each intermediate step. Document limitations per connector, especially Mongo transaction requirements and SMTP non-transactionality.

**Exit gate:** A crash cannot silently drop a committed pending job or fabricate a completed send; retries remain bounded and unknown SMTP outcomes stay `uncertain`. SQLite and representative SQL/Mongo environments demonstrate their declared consistency tier.

#### Section 70 — Complete function-based marketing campaigns and operations **[P1]**

**Work:** Finalize `campaigns.create/get/list/recipients/preview/schedule/pause/resume/cancel/redrivePending`, dynamic JSON personalization with globally registered `{{variables}}`, HTML/plain/subject preview, provider selection, contact imports/dedup/segmentation, campaign status and pagination, reporting, audience consent and suppression, admin UI permissions/CSRF, audit, retention/export and safe archiving. Exercise multi-worker races and many-recipient batch scheduling.

**Exit gate:** A documented API-only workflow creates → previews → schedules → sends/pauses → checks delivery/results → exports/archives, with privacy-safe operator pages, queue recovery and a single stored template per campaign.

### Phase B — Analytics, tags, reports and data correctness (71–75)

#### Section 71 — Analytics collection, identity, storage and backfill **[P1]**

**Work:** Finish internal analytics event schemas, bounded keys/values, event correlation IDs, session/identity and consent semantics, server and browser ingestion, bot/noise policies, durable event storage and nonfatal telemetry failures; metric materialization, historical reconciliation, exact-versus-sampled warnings and retention. Validate same APIs with PostgreSQL/MySQL/MongoDB/SQLite.

**Exit gate:** Reliable event ingestion, safe missing-DB behavior (warning only), documented counts and privacy retention; reproducible cross-database query tests and no blocking of page/email delivery.

#### Section 72 — Tags: GTM-style publishable runtime and governance **[P1]**

**Work:** Complete `astag`/`ttag`, dataLayer, triggers, registered variables, GA4/internal/webhook destinations, browser/SSR transports, drafts/versioning/publish/rollback, debug mode, CSP/privacy controls, access checks and external sink failure handling.

**Exit gate:** A configured website demonstrates preview → verify → publish → rollback across server and browser, and refuses unauthorized scripts/configuration changes; opt-out rules are tested.

#### Section 73 — Reports and campaign analytics dashboards **[P1]**

**Work:** Finish chart and report editors/API, saved definitions, filters/date windows, exact/approx coverage, aggregation, scalable time-series, email/campaign open-click-delivery-bounce reporting, export options and roles/tenants. Add pagination on report inputs and performance caps; avoid presenting provider notifications as unique deliveries without evidence.

**Exit gate:** A tenant can build, save, share (only as authorized), export and revisit live/archived analytics and campaign dashboards with verifiable query totals.

#### Section 74 — Database, authentication, migrations and tenant security **[P0]**

**Work:** Qualify real PG/MySQL/Mongo/SQLite adapters, schema migrations, SQL identifier safety and parameterization, Mongo operator controls, transactions, connection pooling, typed query semantics, CAS affected-row contracts and database backup/recovery. Harden auth sessions/tokens/roles, secret storage, user/site boundaries and unsafe database table/column mapping.

**Exit gate:** Common connector contract passes a shared real-engine suite; one tenant/account cannot access another's emails, analytics, jobs or files; migration/rollback rehearsal passes.

#### Section 75 — Redis cache and distributed queue scheduler certification **[P0]**

**Work:** Real BullMQ + ioredis cluster/standalone runs, queue ownership, delayed/cron/repeatable/one-off jobs, registration, scheduler timezone/DST behavior, multi-worker rate/concurrency limits, operator dashboard and permission scopes, retries, DLQ/retention, shutdown, distributed leases, connection outages. Repair Redis namespace-scoped cache clearing so one tenant never flushes unrelated data.

**Exit gate:** Real Redis test suite passes under worker concurrency, failure and restart; scheduled jobs execute once per intended occurrence within documented at-least-once semantics; safe pause/recover and tenant isolation.

### Phase C — Framework, server, adapters and remaining ecosystem packages (76–80)

#### Section 76 — ZeruxJS core/runtime/API integration **[P0/P1]**

**Work:** End-to-end framework startup/shutdown, runtime-generation service lifetimes and rollback, hooks, app routes, HTTP response handling, dynamic-variable registry across subject/html/text/general rendering, configuration/validation, auth/CSRF boundaries, SSR and hot updates. Align integration and exports with API docs and other packages.

**Exit gate:** A clean sample app boots from source and uses Files, Email, Queue, Analytics, Tags, Reports, DB and Cache with correct lifecycle and no credential leakage.

#### Section 77 — ZSRV gateway, protocols and rolling multi-instance serving **[P0/P1]**

**Work:** Verify proxy routes, HTTP/1.x and HTTP/2, WebSocket, SSE, gRPC/Connect/tRPC, JSON-RPC/MCP, compression br/gzip/deflate/zstd, trusted proxy metadata, cache/stream controls, readiness/handover, restart budgets, rolling rollback and observability. Test HTTP/3/QUIC/WebTransport boundaries via supported external terminators; make unsupported native capabilities explicit.

**Exit gate:** Load/restart/fault suites show no unintentional 5xx spikes from controlled deploys within defined drain limits, no stale routes or leaked process identity, and safe supported protocol negotiation.

#### Section 78 — Frontend interoperability, React/Vue/Zyro bridges and accessibility **[P1]**

**Work:** Stabilize cross-framework bridge contracts for `@zeruxjs/react`, `@zeruxjs/vue`, `@zeruxjs/zyro` and ZeruxJS application rendering. Verify hooks, subscription cleanup, concurrent rendering, SSR compatibility, route lifecycle, keyboard/focus behavior, ARIA semantics and reduced motion. Build a shared browser test fixture that Sections 81–82 can reuse; fix boundaries between the framework, reactive core and CSS output **without yet certifying the standalone ZyroJS or Zuix package**.

**Exit gate:** Representative React, Vue, Zyro and ZeruxJS examples compile and run in supported browsers without duplicated subscriptions, unhandled hydration errors or major accessibility regressions; each adapter documents its supported API and constraints.

#### Section 79 — CLI/dev tooling/test runner and developer experience **[P1]**

**Work:** `zcli`, `z-dev`, `zwatch`, `zeyro`, TypeScript/lint/hooks integration, project templates, generated files, live-reload and diagnostics, cross-platform path/process/permission handling, CI scripts and unit/integration test runner. Clean up deprecated aliases and stabilize public package exports.

**Exit gate:** From a clean machine: create app → develop with hot reload → test → lint/typecheck → build → launch works without manual fixups on supported platforms.

#### Section 80 — Remaining ecosystem packages and content/file workflows **[P1]**

**Work:** Complete/qualify Files (local/AWS S3/S3-compatible, streaming, signed URLs, multi-store selection, encryption/privacy/cloud caching as supported), Media, Asset Manager, AI/provider abstraction and document retrieval, Search, SEO, Feed, Font, Share, Performance, Validator, Security and basic frontend bridges. Avoid inflated claims about fully trained AI or universal media types; explicitly bound each supported capability.

**Exit gate:** All retained public packages have non-placeholder entry points, meaningful integration tests and usage examples; declared storage/cloud/browser features work against representative real services.

### Phase D — Dedicated ZyroJS / Zuix quality and package release (81–85)

#### Section 81 — ZyroJS standalone runtime: production-level completion **[P0/P1]**

**Work:** Audit the `zyrojs` package and its public `./dom` and `./network` exports as a standalone library, not merely a ZeruxJS adjunct. Complete observable/computed/effect ownership, batching and dependency tracking; deterministic subscription disposal and memory safety; async cancellation and stale-response handling; DOM events/bindings, forms and list updates; SSR/hydration **only to the extent explicitly supported**; safe text/HTML boundaries; package types and dual-runtime/browser behavior. Verify compatibility with the `@zeruxjs/zyro` bridge and mixed React/Vue applications. Replace placeholder APIs or declare unsupported functionality honestly. Cover race conditions, nested updates, unmount/remount, exception paths and long-running sessions. Update examples, JSDoc and migration notes.

**Exit gate:** Clean standalone installation and `zyrojs` import from a packed tarball; unit + real-browser integration suites covering reactive updates, DOM ownership, networking, cleanup and selected SSR flows; no reproducible subscription leaks or uncaught error propagation; published exports/types match actual output. This is a dedicated ZyroJS gate, not an AIO application milestone.

#### Section 82 — Zuix CSS: production compiler, themes and adapters **[P0/P1]**

**Work:** Harden the standalone `zuix` package as a deterministic, zero-dependency utility-first CSS compiler: bounded content scanning and escaping, valid utility/variant syntax, theme token resolution, custom extensions/plugins, responsive states, dark mode, accessibility/reduced-motion styles, development watcher, incremental caching, output ordering/deduplication, minification where supported, source diagnostics and stable CLI behavior. Exercise `./node`, `./vite`, `./theme` entry points plus ZeruxJS, ZyroJS, React, Vue and representative Vite/Next/Nuxt integrations **where supported by actual adapters**. Verify output CSS with browser snapshots/visual checks and large-file performance. Avoid claiming arbitrary framework support without a tested adapter.

**Exit gate:** Clean installation and tarball smoke test; deterministic identical output for identical inputs, watch/build parity, tested theme/variant behavior, no CSS injection via malicious class content, type/CLI export verification, browser-checked UI examples and documented supported framework/toolchain matrix.

#### Section 83 — Package-only real-service and cross-runtime integration lab **[P0]**

**Work:** Create repeatable package integration suites with disposable service fixtures for PostgreSQL, MySQL, MongoDB, SQLite, Redis/BullMQ, S3-compatible storage, test SMTP, IMAP and POP3, plus browser runtimes. Exercise `zeruxjs` and `zyrojs` standalone, Zuix build/watch and the `@zeruxjs/*` packages end-to-end: auth → DB → queue/email → analytics/tags/reports → UI. Run constrained fault-injection, multi-worker and schema migration cases; verify test isolation, cleanup and CI accessibility. Application fixtures are **test harnesses**, not an AIO management product.

**Exit gate:** A reproducible CI/local matrix records versions, commands, service health, pass/fail/skip and exact unsupported boundaries. All release-critical real-service and browser suites pass on available certified environments; unverified optional integrations are excluded from supported claims, not quietly marked green.

#### Section 84 — Package security, reliability, performance and API freeze **[P0]**

**Work:** Threat-model the public package interfaces; audit tenant boundaries, CSRF/auth, SQL/Mongo query constraints, unsafe dynamic HTML, MIME/attachment scanning, SSRF, mail credentials, provider webhooks, queue job payload privacy, prototype pollution, path traversal and denial-of-service limits. Run dependency/license and supply-chain scans; fuzz parsers, variable rendering and compiler input; perform high-volume load, resource-leak and shutdown tests. Set supported Node/OS/browser/DB versions, measure bundle/compile/runtime performance and define deprecations/semver compatibility. Fix P0/P1 defects within this section, not by inventing indefinite new sections.

**Exit gate:** No unresolved critical/high-severity in-scope vulnerabilities or unexplained reproducible data-loss risks; cross-package API contracts and version policy are frozen; performance budgets, resource bounds, license and runtime support matrix are recorded; failures are reproducible and tracked.

#### Section 85 — Package documentation, npm packaging and stable-release go/no-go **[P0]**

**Work:** Produce installable tarballs for `zeruxjs`, `zyrojs`, `zuix`, `zsrv`, `zcli`, `z-dev`, `zwatch`, `zeyro` and maintained `@zeruxjs/*` packages; verify names/exports/types/`files`/CLI bin maps/dependency versions; check publish dry runs, signing/provenance options, release notes, semver, upgrades and examples. Publish **only if explicitly authorized and credentials are available**; otherwise deliver reproducible release-ready archives and commands. Provide runnable framework-first, ZyroJS-first and Zuix-first starters, migration notes, API guides, test reports, a support matrix and a final **GO / NO-GO** decision for packages alone. Do not imply that a package release certifies an AIO hosting installation.

**Exit gate:** A clean user installation of packed artifacts successfully creates, builds, runs and tests the supported example apps without manual symlinks. CI and the release-evidence matrix demonstrate the agreed package gates. A **GO** is the finite end of Sections 1–85; a **NO-GO** lists concrete blockers and retains the current section until resolved. Post-v1 requests start a separately approved package roadmap/version.

## 4. Milestones and estimated remaining work

| Milestone | Sections | What should be demonstrably done | Remaining after milestone |
|---|---|---|---:|
| **Current baseline** | 1–65 | Broad packages and targeted tests; inbox has JSON/managed/mapped storage | **20** |
| **Reliable install + complete email** | 66–70 | Clean builds; IMAP/POP3, SMTP/campaign and outbox workflows qualified | **15** |
| **Telemetry + storage platform** | 71–75 | Analytics, tags, reports, DB/auth and distributed queues integration-tested | **10** |
| **Framework and full package coverage** | 76–80 | Runtime/server/frontend/CLI/content package flows interoperable | **5** |
| **ZyroJS / Zuix / release** | 81–85 | Dedicated reactive runtime + CSS compiler certification, package-only real-service lab, security, documentation and stable-release decision | **0** |

**Estimated number of further “Continue” milestones: 20, covering packages only.** These are designed to be **larger integrated increments**, as requested; not one minor helper function per section. If a phase takes several messages to finish, continue *within that same section* and do not silently increment the planned section count. This is a section count, **not a trustworthy calendar-time estimate**: live service availability, required credentials, third-party API behavior, testing platforms and newly discovered defects all affect elapsed time.

## 5. Important known risks, prioritized

| Priority | Evidence/observation from existing project | Required resolution |
|---|---|---|
| **Critical** | Previous runs used temporary local workspace links/generated `dist`; full `zeruxjs` build failed on unresolved `zcli`, `zsrv`, `zwatch`, hooks and lint references. | Section 66 clean install + full workspace build. |
| **Critical** | Live SMTP, IMAP, POP3 and BullMQ/Redis integration tests were not completed in the reported releases. | Sections 67, 68, 75, 83. |
| **Critical** | Delivery state and append-only history were not transactionally tied across connectors; manual reconciliation exists but cannot reconstruct every missing transition. | Sections 69 and 74. |
| **High** | Mongo/PG/MySQL tests often involved SQL/aggregation translation or isolated unit tests rather than full live engine tests. | Sections 71–75, 83. |
| **High** | Email provider feedback may be incomplete or unverifiable; SMTP acceptance does not guarantee delivery or inbox placement. | Section 68 provider-specific verification and honest status metrics. |
| **High** | Custom inbox table mapping and JSON callbacks place additional idempotency and authorization duties on host applications. | Section 67 docs, tests and safe defaults. |
| **High** | Redis namespace `clear()` was documented as using database-wide `flushDb()` in the previous package audit. | Section 75 scope-safe cache invalidation. |
| **High** | `zyrojs` still declares a prerelease version and requires dedicated browser/runtime and memory-safety qualification; bridge tests alone do not certify it. | Section 81. |
| **High** | `zuix` needs full compiler/watch/adapter/visual regression coverage beyond a limited smoke suite. | Section 82. |
| **Medium** | `zuix` has a smoke-test script but still needs broad browser, snapshot, adapter, malicious-class and performance qualification; many packages have narrow unit suites. | Sections 78, 80, 82–84. |
| **Medium** | Browser/React/Vue, QUIC/WebTransport and provider integrations need real compatible runtimes. | Sections 77–78 and 83. |

## 6. Rules for every future section

1. **Build directly from the last full verified ZIP**; no feature regression or accidental source deletion.
2. Ship **exactly two archives**: (a) changes since previous full section, with project-relative paths, and (b) complete updated project. Compare content byte-for-byte and verify ZIP integrity.
3. Keep a detailed `SECTION_NN_*.md` changelog, update `SECTION_PROGRESS.md`, and update **`section_plan.md`** status/checklist; preserve previous sections. AIO work is never added as a dependency or as an extra section.
4. Run the unit and integration suites relevant to changes **plus impacted neighboring packages**. Report pass/skip/fail counts accurately and differentiate mocks from real services.
5. Treat **security, auth, privacy, backward compatibility and data-migration paths** as part of the feature, not follow-on work.
6. Preserve the user-specified email invariants: separate marketing consent from tracking; no analytics-caused crashes; no automatic unsafe SMTP retries; optional receive storage; no accidental remote deletion; private data not placed in Redis jobs.
7. Don't add a Section 86 just because a bug is discovered in Section 70 or 80: fix it as a continuation of the affected section or at the Section 84/85 release gate.
8. Track a **release-blocker list**: blocker ID, affected section, severity, reproduction, owner/next action, test demonstrating closure. A section is not green while a required live-system test is still unverified.
9. **Scope freeze for v1.0:** newly requested unrelated applications or an unlimited set of features should be written to a **post-v1 backlog**, not silently increase the count; critical safety fixes remain in-scope.

## 7. Explicitly not implied by this roadmap

- The separate AIO/hosting-panel application, CoreDNS authoritative control plane, DNSSEC zone management, registrar integration, Nginx/Certbot automation, multi-node hosting control plane or a full clone of cPanel.
- A full clone of AWS SES, GA4, GTM, Looker Studio, Gmail, Kubernetes or an unlimited set of third-party integrations.
- A guarantee that any email will reach an inbox or that all providers furnish reliable delivery/bounce/complaint notifications.
- Any guarantee of zero downtime under arbitrary network, node or dependency failures; `zsrv` rolling serving is tested only within documented package/runtime constraints.
- Native HTTP/3/QUIC/WebTransport support where the implementation depends on a gateway or external TLS/QUIC terminator.
- A trained language model inside `@zeruxjs/ai-model` (existing goal is safe provider integration and retrieval).
- Separate WordPress quotation/payslip/e-commerce plugin projects mentioned in unrelated conversations; their repos and release criteria are not part of this ZeruxJS project.

## 8. What to do next

On the next **“Continue”**, continue **Section 66: Reproducible workspace and dependency repair** until its clean-build exit gate passes. Begin by fixing package imports and the lockfile/clean-build toolchain before adding more features. Continue implementing and testing Section 66 until its stated exit gate is met or a verified external blocker is documented. Every later Continue should advance to the next **unfinished** section according to this plan rather than choosing a new, open-ended topic.

**Final destination: Section 85 — a documented, tested GO/NO-GO for the ZeruxJS / ZyroJS / Zuix package ecosystem ONLY. AIO application work is deliberately tracked separately.**

### Section 66 status update — public export contract and build-timeout checks (13 October 2026)

- Checked all 42 package source entrypoint contracts and restored the missing `zeruxjs/schema/schema.config.json` exported asset.
- Added CI/isolated source/clean-checkout export checks, per-workspace npm build timeouts and generated-entrypoint symlink rejection.
- Verification: 25 tooling tests passed, `contracts:check` passed, isolated `verify:source` passed.
- **Do not close Section 66**: 14 external dependency lock resolutions are still absent because npm registry DNS returned `EAI_AGAIN`; only a real `npm ci` and verified 42-workspace compile can finish the gate. Section 67 starts after that gate passes.


### Section 66 — security policy and final release gate evidence (2026-10-13)

A root `SECURITY.md` now describes the actual experimental package versions, private reporting channels and best-effort triage targets. The release tool can run the entire registry-backed clean checkout, dependency lockfile resolution, package build and smoke suite in one transaction (`cd apps/proworkspace && npm run section66:finalize`). The npm-registry connectivity probe fails with `EAI_AGAIN` in the current environment; **31 tooling tests pass**, but the **14 unresolved dependencies** and clean-install/build gate mean **Section 66 is NOT completed**. Section 67 remains the next development section only after successful external clean-build verification. Detailed conditions: `SECTION_66_RELEASE_GATE_SECURITY.md`.

## Section 68 — Outbound mail/feedback source implementation (2026-10-13)
- Implemented SMTP envelope acceptance status classification and per-recipient attribution, no false reputation accepted increments for unknown recipients; PII-free operator diagnostics.
- Durable queue now handles explicit `accepted` / `partial` / `rejected` / `unknown` from the sender conservatively, without replaying uncertain results; legacy custom senders remain compatible.
- Added explicit `sendWithVerifiedFailover()` that may change transport **before submission only**; never retries after SMTP may have begun.
- Bound in-process idempotency keys to message and tracking payload fingerprints, rejecting conflicting repeats; strict default STARTTLS and SMTP timeout/DKIM validation.
- Signed webhook batches are completely validated before persistence and reject manual suppression events and conflicting event IDs; multi-store persistence remains nontransactional and requires idempotent retry.
- Added opt-in SMTP connection and send smoke tests; they require a real configured server, registry-installed packages and a disposable test inbox. Live acceptance gate **OPEN**; Section 66 clean-install gate **OPEN**. See `SECTION_68_SMTP_FEEDBACK_REPUTATION.md`.
