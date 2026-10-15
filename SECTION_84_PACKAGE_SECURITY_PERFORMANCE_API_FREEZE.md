# Section 84/85 — Package security, reliability, performance and API freeze

**Date:** 2026-10-15  
**Scope:** Package workspace only (no AIO host manager, DNS server or operating-system control plane).  
**Status:** **Source changes and local gates implemented and passing; release-security exit gate remains OPEN.** This report is not a penetration test, online dependency scan, distributed load test or stable-release authorization.

## Delivered security fixes

1. **Z-Dev module/public assets:** Previously a lexically contained path could be a symlink to a file outside the package; a configured public directory could also escape the package root. `resolveSafeModuleAsset` now canonicalizes the package root and asset, rejects escapes, enforces regular file/directory type, validates the supplied relative path, and is used when loading configured module files/public roots and when reading served public assets. Added a real-filesystem regression for direct traversal, encoded separators, outside-file/outside-directory symlinks and safe in-tree symlinks. Filesystem replacement between verification and opening remains a narrow time-of-check/time-of-use limitation; do not allow hostile users to mutate installed package roots.
2. **Security package DoS/input guards:** `createNonce` requires a safe 16–64-byte size to prevent oversized random allocations; `sanitizeRelativeAssetPath` rejects URL-like query/fragment, colon/ADS and encoded dot/slash/backslash delimiters; cookie Path rejects all ASCII control bytes, not just CR/LF. Existing CSRF, CORS, session-bound token and rate-limit behavior remains compatible. Added deterministic randomized property regressions; these are not a complete fuzz campaign.
3. **Supply-chain baseline:** A committed `apps/proworkspace/api-freeze.json` captures all **42** workspace names, versions, publish visibility, import/export/types/bin entrypoints, Node engines and peer dependency constraints. Normal implementation-only changes do not alter the snapshot. Source preflight, clean release and CI fail closed on unexpected contract drift. Planned breaking changes require explicit review plus `npm run api:freeze:write` and semver/migration notes; generating a new snapshot is **not** a substitute for API compatibility review.
4. **Offline package audit:** `npm run security:source` checks version formats, public license fields, install-time hook policy, Git/remote/file dependency specs, known embedded credential signatures in source/assets and package docs, insecure/malformed lock entries and the frozen public API. It reports private/unpinned-engine packages and incomplete external dependency metadata as advisories. **Offline scanning cannot determine known CVEs or grant license clearance.**
5. **Online release gate:** the clean-workspace CI and isolated Section 66 release finalizer now require `npm run security:online` (`npm audit --omit=dev --audit-level=high`) after clean `npm ci`. The step has not run successfully here because of the pre-existing unresolved registry dependencies. A committed license inventory utility lists declared local licenses and external lock metadata; installed LICENSE files, transitive notices and SPDX compatibility require later human/tool verification.

## Reproducible commands

```bash
cd apps/proworkspace
npm run test:release-security    # offline API/audit negative tests
npm run api:freeze:check        # unexpected changes are rejected
npm run security:source         # structural source + lock audit only
npm run license:inventory       # declared metadata only
npm run verify:source           # isolated source snapshot; no build
npm run test:workspace-tools

# Requires a built @zeruxjs/security package:
npm run test:security:stress
npm run test:section84

# Requires real registry resolution and clean installation:
npm run security:online
npm run verify:clean
```

The tests for the affected Security and Z-Dev packages also require their build artifacts. Local compilation used temporary, *excluded-from-delivery* links to Node typings and the local Security package; production clean-install certification is still blocked.

## Local verification (Node v22.16.0, Linux, 2026-10-15)

| Check | Result | Scope |
|---|---|---|
| Security + Z-Dev TypeScript compilation | Passed | Two affected packages, temporary local Node typings |
| Security + Z-Dev regressions | **12 passed, 0 failed** | Includes real-filesystem symlink/traversal tests and bounded input fuzz smoke |
| Release API/audit negative tests | **6 passed, 0 failed** | Missing baseline, breaking exports/engines, malicious hooks and license metadata |
| Workspace tooling | **48 passed, 0 failed** | Includes finalizer fail-closed regression |
| Isolated source preflight | **40 tests passed**, 42 contracts | No npm install or provider connectivity |
| Offline source security audit/API freeze | Passed | 42 package manifests and source-assets pattern check |
| Lock license inventory | 42 local + 622 external lock entries | `node_modules/svg-tags` has no license metadata in the lockfile |
| Online advisory and license clearance | **NOT RUN** | Requires clean installed dependency tree and policy review |
| Live service/browser/OS/cluster fault checks | **NOT RUN** | See Section 83 blocked matrix |

### Bounded stress smoke and budgets

`npm run test:security:stress` exercised **80,000 limiter calls, 50,000 HTML escaping operations, 30,000 cookie serializations and 5,000 CSRF issue/verify pairs** (165,000 operations total). The active limiter key count never exceeded **512**; the test enforces a generous **30-second total runtime**, **128 MiB positive heap-change ceiling** and **512-key storage cap**. These are *smoke safety budgets*, not SLA throughput guarantees or formal leak proof. Run large parallel request, SMTP, queue, WebSocket and browser soak tests on the actual deployed topology before any production claim.

## Public compatibility / support policy (candidate, not certified)

- **Semver:** existing package versions and experimental/prerelease labels are preserved. No package is automatically promoted to `1.0.0`. An approved public export/type/peer/engine change requires a version and migration review, then an explicitly reviewed API snapshot update. The snapshot protects metadata **only**; TypeScript signature snapshots and real consumer compatibility remain Section 85 work.
- **Node:** Node 22 on Linux is locally exercised. Node 24 source-only CI is configured, but a successful Node 24 clean-build has not been witnessed. `zyrojs`/`zuix` declare Node `>=20`; the other packages have no uniform committed `engines.node` statement, so blanket Node 20/24 production support **must not** be claimed.
- **Operating systems:** Linux source and selected compiled package tests only. Windows and macOS require separate release acceptance.
- **Browsers/frameworks:** Real Chromium, Firefox/WebKit, React/Vue hydration, Vite/Next/Nuxt and memory-leak acceptance remain open. The standalone ZyroJS and Zuix packed-consumer gates from Sections 81–82 do not substitute for this matrix.
- **Datastores/providers:** Real SQLite is exercised by Section 83; PG/MySQL/Mongo, Redis/Redis Cluster, SMTP/IMAP/POP3, S3/MinIO, live GA4/webhooks and real browser/provider certification remain unverified.
- **Features not certified:** native HTTP/3/QUIC, mailbox placement guarantees, exactly-once SMTP, arbitrary failure zero downtime, host-managed tenant trust configuration, and any AIO-server-manager functionality.

## Threat model: controls, coverage, residual risk

| Boundary | Checked control | Evidence and remaining work |
|---|---|---|
| Public devtool file/asset path | Encoded traversal, realpath containment and type checks | Z-Dev regression; writable package-root races require OS isolation and follow-up |
| CSRF/cookies/cross-origin | Session signatures, strict cookie controls, declared origin policy | Security regression; proxy/TLS deployment not certified |
| SQL/Mongo / tenant isolation | Section 74 tenant facades, validator/operator restrictions | SQLite integration only; multi-DB negative authorization tests still needed |
| Client HTML, variables, CSS | Sections 76/81/82 escaped templates/DOM/CSS | Randomized Security smoke only here; browser and automated fuzz corpus needed |
| Outbound URLs, media/MIME, attachment safety | Sections 67–80 strict parsers/allowlists/authorization | Provider-specific SSRF/redirect/MIME malformed payloads require specialized fuzzing |
| Email consent/tracking / uncertain delivery | Section 69–70 conservative idempotency/outbox rules | Real provider retries, feedback and data durability remain live gate |
| Redis jobs / telemetry PII | ID-only queue payloads, fail-soft analytics, tenant scoping | Live Redis cluster partitions/ACLs and privacy audit remain open |
| Supply chain and package versions | Lock metadata checks, API freeze, forbidden hook/dependency detection | 14 absent external lock entries; online CVE and license checks not completed |
| Capacity/resource exhaustion | Bounded limiter, nonce, file/CSS/analytics scans | Single-process stress smoke only; distributed fault/load tests outstanding |

## Release blockers and ownership

See [`RELEASE_BLOCKERS_84.md`](RELEASE_BLOCKERS_84.md) for actionable P0/P1 work, reproduction commands, closure evidence and owners. **The Section 84 security/performance exit criterion is not certified:** outstanding real-service testing, 14 unresolved external dependencies, online CVE/license review, browser/OS profiling and data-loss resilience need evidence before a stable GO. Section 85 must issue an explicit GO/NO-GO, not silently clear these gates.
