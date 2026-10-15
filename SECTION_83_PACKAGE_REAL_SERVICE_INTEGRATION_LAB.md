# Section 83/85 — Package-only real-service and cross-runtime integration laboratory

**Date:** 15 October 2026  
**Baseline:** Section 82 verified full-project ZIP.  
**Scope:** ZeruxJS, ZyroJS, Zuix, ZSRV and maintained `@zeruxjs/*` **packages**, not an AIO hosting/control-panel deployment.  
**Outcome:** Lab tooling and available offline/real-SQLite acceptance implemented and tested. **Live multi-provider certification remains BLOCKED/UNVERIFIED**. Do not advertise Section 83's complete real-service exit gate as passed.

## Changes

1. `apps/proworkspace/scripts/integration-lab-core.mjs` and `integration-lab.mjs`: deterministic, bounded subprocess lab with explicit suite inventory, dependency-aware `--build`, TCP prechecks (never interpreted as authentication), real TAP test-count validation, zero-pass detection, explicit opt-in settings, fail/skip/blocked distinctions, required-suite enforcement, JSON evidence without captured credentials/payloads, timeouts and process-group termination. No external npm dependencies are added.
2. `integration-lab/compose.yml`: loopback-only, disposable PostgreSQL 16 / MySQL 8.4 / MongoDB 7 / Redis 7.4 / MinIO S3 / GreenMail protocol fixtures. No production port exposure. Test-only credentials, removable temporary volumes, unique Compose project selection. Pin/version overrides for S3 and mail images must be validated in real CI before support claims.
3. `integration-lab/.env.lab.example`, `integration-lab/README.md`: documented opt-ins, TLS test CA, real connector URLs, state isolation, manual start/stop, supported boundaries and explicit release checks. Never send mail or turn off TLS verification by default. Redis Cluster is a **separate** opt-in fixture, not inferred from standalone Redis.
4. Added `tests/integration/section83-s3-live.test.mjs`: real S3 Put/Get/HEAD/Range/Copy/metadata/policy, unique run-scoped prefixes, optional loopback-only random test bucket and cleanup. Requires installed AWS SDK and an authentic S3 service.
5. Added `tests/integration/section83-package-pipeline.test.mjs`: authenticated signed-session tenant boundary with real SQLite persistence, Analytics native event totals, Tags draft/publish isolation, Reports HTTP authorization and Email marketing suppression. This tests **application-owned authorization contracts** and does *not* fabricate a live BullMQ queue or SMTP provider.
6. Reused real PG/MySQL/MongoDB parity, Redis/BullMQ distributed and cluster acceptance, live SMTP TLS verification, live IMAP/POP3 read-only verification and actual Chromium fixtures from earlier sections; configurable inbound TLS ports allow disposable local services.
7. `.github/workflows/package-integration-lab.yml`: manual package-only real-provider CI on Node 22, offline source CI matrix for Node 22/24, strict install-before-integration ordering, persisted non-secret evidence and teardown even on failure. Added `npm run lab:offline`, `lab:live`, `lab:all`, `lab:test` commands and ignored local report directory.

## Local execution evidence (Linux x64 / Node v22.16.0)

| Suite | Actual local outcome | Notes |
|---|---|---|
| Integration harness regression | **5 passed** | arguments, strict skip rules, TAP zero-pass, paths, consent |
| Source contract lab | **33 passed** | isolated source-preflight, 42 package contracts |
| Auth/Security local regressions | **11 passed** | compiled package artifacts |
| Real SQLite matrix | **7 passed, 3 skipped** | skips are PostgreSQL/MySQL/Mongo subtests in shared file |
| Auth → SQLite → Analytics/Tags/Reports → Email suppression | **1 passed** | host-verified tenant principal; no real queue/SMTP claimed |
| Local file/content package pipeline | **1 passed** | local filesystem, no S3 provider |
| Workspace tooling suite | **41 passed** | includes 5 new Section 83 lab-core tests |
| Real PostgreSQL, MySQL, MongoDB | **not run** | live engines, client packages and connection credentials absent |
| Real Redis / BullMQ / Redis Cluster | **not run** | standalone/cluster services absent |
| S3-compatible API | **not run** | MinIO endpoint and AWS SDK unavailable |
| SMTP TLS, IMAP TLS, POP3 TLS | **not run** | GreenMail/test CA unavailable; no mail sent |
| Chromium and actual React/Vue/browser coexistence | **not certified** | browser fixture previously timed out; not fabricated here |
| Registry-backed `npm ci` | **BLOCKED** | 14 unresolved existing external dependency lock entries |

**Important environment qualification:** For local verification, temporary package symlinks, a globally available TypeScript compiler and locally available `@types/node` were used to build scoped packages. These links/build outputs are excluded from both ZIPs and are **not** a clean checkout install. Source-only tests succeed without this workaround. The offline lab suite reports the actual passing tests only after the dependencies were built.

## Security and reliability properties

- No default mutation of production services. Docker fixture ports bind `127.0.0.1`; users must deliberately configure live credentials.
- Real-engine parity uses random table names and teardown, Redis suites random prefixes, S3 uses a unique object prefix / optional random loopback bucket. A lab run cannot certify global service correctness based on an open TCP socket.
- Missing credentials/services/dependencies -> `skipped`/`blocked`, not `passed`; an explicitly required skipped suite -> overall failure. A selected suite with zero passed tests is not successful.
- Reports contain suite names, runtime, fixture-definition SHA-256, duration, pass/fail/skip counts and reason categories; no complete child output, authentication tokens, network traces or emails are recorded.
- Child process groups are killed after bounded timeouts. Shutdown of Docker Compose fixtures is explicit and enforced in CI `if: always()`.
- GreenMail test certs require trusted test CA (`NODE_EXTRA_CA_CERTS`); `NODE_TLS_REJECT_UNAUTHORIZED=0` is not used.
- A failed/uncertain SMTP submission or provider notification is not treated as confirmed inbox delivery. Email sending is not exercised by default.

## Reproduction and next-action checklist

```sh
cd apps/proworkspace
node --test scripts/integration-lab-core.test.mjs
npm run lab:offline                    # requires built scoped packages
node scripts/integration-lab.mjs --only=source --require=source
node scripts/integration-lab.mjs --live --build --report=integration-lab/reports/live.json
npm run verify:source
npm run deps:check                     # still flags unresolved third-party locks
```

For real providers, start `integration-lab/compose.yml` with a unique project name, configure only disposable credentials from the example file, and run `--only=pg,mysql,mongo,redis-cache,redis-queue,s3 --require=pg,mysql,mongo,redis-cache,redis-queue,s3 --build`. Live mail and Cluster/browser certificates remain separate mandatory gating tasks before making those specific support claims. CI evidence must include actual provider versions and results; the Compose YAML lists *intended* image tags and is not evidence those images were pulled or exercised.

## Release blockers (carry to Sections 84 and 85)

| ID | Severity | Scope | Reproduction / next closure action |
|---|---|---|---|
| S83-001 | P0 | Section 66 dependency locks | Resolve 14 third-party entries via registry, run clean `npm ci`, full build and isolated install |
| S83-002 | P0 | PG / MySQL / Mongo / Redis | Run required real suites with audited engine versions, save CI evidence; add fault/restart tests where absent |
| S83-003 | P0 | S3 and mail protocols | Run live S3 and trusted TLS SMTP/IMAP/POP3 suites in disposable lab, verify object/message cleanup |
| S83-004 | P0 | Real browser and frontend | Repair Chromium runner, exercise actual React/Vue/Zyro/Zuix integration in supported browsers |
| S83-005 | P1 | Multi-worker and fault cases | Test queue restart/network partitions, DB migration rollback on each real engine, recovery and delayed/DST semantics |
| S83-006 | P1 | CI/image reproducibility | Verify image tag/digests, run manual CI workflow and archive sanitized evidence for version/support matrix |

**Next fixed section:** 84/85 — Package security, reliability, performance and API freeze. No additional AIO product section is created.
