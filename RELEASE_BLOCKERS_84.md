# Package release blockers — Section 84 evidence register

**Reviewed:** 2026-10-15. Package scope only. `BLOCKED/UNVERIFIED` is not `PASS`. Owner for every item: package maintainer + named CI/provider operator when a real environment is required. No item is silently waived.

| ID | Priority | Affected section/package | Reproduction / check | Required closure evidence | State |
|---|---|---|---|---|---|
| PKG-001 | **P0** | 66, all workspaces | `cd apps/proworkspace && npm run deps:check && npm ci` | Valid committed registry-resolved lockfile; clean `npm ci` and dependency-order build on Node 22/24 | **BLOCKED**: 14 absent external locks (`@aws-sdk/client-s3`, `@aws-sdk/cloudfront-signer`, `@aws-sdk/credential-providers`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner`, `bullmq`, `html-to-text`, `imapflow`, `ioredis`, `juice`, `mailparser`, `node-pop3`, `nodemailer`, `sanitize-html`) |
| PKG-002 | **P0** | 67–75, 83; email/queue/DB | `npm run lab:live` with provisioned disposable services | Authenticated SMTP/IMAP/POP3, Redis/BullMQ, PG/MySQL/Mongo, S3 and recovery/fault test matrix with real pass evidence | **UNVERIFIED** |
| PKG-003 | **P0** | 69–70, email outbox | Run crash recovery tests across two real connectors + SMTP while killing workers at each delivery boundary | Proven conservative uncertain-delivery handling, reconciliation, tenant/consent enforcement without duplicate automatic SMTP send | **UNVERIFIED** |
| PKG-004 | **P0** | 66, 84; supply chain | `npm run security:online` in clean installed checkout | Zero untriaged high/critical production advisories, transitive licenses and notices reviewed | **BLOCKED** by PKG-001; `svg-tags` license missing from lock metadata, requires artifact review |
| PKG-005 | **P1** | 78, 81–82, UI adapters | `npm run test:frontend:browser` / `npm run test:zuix:browser` on real browsers | Chromium + Firefox/WebKit selected scenarios, React/Vue hydration, long-running DOM listener/subscription and CSS visual checks | **UNVERIFIED** |
| PKG-006 | **P1** | 75–77, serving/queues | Isolated rolling/Redis outage/cluster partition and cross-process stress acceptance | Real fault-injected drain/rolling, Redis Cluster hashes/ACLs, DST schedules, memory/load budgets | **UNVERIFIED** |
| PKG-007 | **P1** | 84–85, API/OS | `npm run api:freeze:check` and release consumer tarball checks | Published exports, public types and runtime support matrix tested on clean Node 22/24, Linux/Windows/macOS with approved semver migration | **PARTIAL**: metadata freeze passed; consumer/OS/typed declaration matrix open |
| PKG-008 | **P1** | 84, Z-Dev filesystem | `node --test packages/z-dev/test/asset-security.test.mjs` after build | Realpath containment regression and directory write policy; TOCTOU tested on immutable roots | **PARTIAL**: symlink/traversal behavior fixed and tested; hostile-writer race not certified |
| PKG-009 | **P1** | 84, hardening / abuse | `npm run test:security:stress` plus live soak suite | Resource retention, browser/worker leak, request-flood budgets and parser fuzz evidence from target topology | **PARTIAL**: bounded single-process smoke only |
| PKG-010 | **P1** | 85, release | `npm run build:workspaces && npm pack --dry-run` for each publishable workspace | Signed/provenance-capable distributable tarballs, exact dependencies/exports/types, docs/migration and final recorded GO/NO-GO | **OPEN** |

**Escalation:** Any reproduced cross-tenant disclosure, arbitrary-file read, unsafe automatic SMTP retry, secret exposure, prototype pollution, SSRF into private networks or critical dependency advisory is a **P0 stop-ship** pending a demonstrated fix and regression. Authorization decisions for externally configured identities and databases remain the host application's responsibility. No public npm publish is authorized by this document.

## Section 85 final review — 2026-10-15

**Final decision: NO-GO.** The existing PKG-001 through PKG-010 blockers stay open; no unverified gate has been waived. New explicit packaging observations within **PKG-010**:

- The monorepo contains **8 currently npm-public package manifests** and **34 private workspaces**. Private dependencies in public `zeruxjs` and `z-dev`, and a transitive private chain through `zsrv`, are stop-ship for unrestricted npm consumers.
- Public manifests using wildcard (`*`) workspace dependency ranges need a reviewed semver release graph, not local symlinks.
- Source ZIPs omit generated `dist`; the strict post-build packaging gate correctly fails on those absent artifacts. Four scoped packages have local build and dry-run evidence only.
- Section 85 added `npm run release:pack` with real `npm pack --dry-run --json` inventory validation, source-only `release:decision` and a no-publish manual CI matrix. This closes **tooling implementation** but not the actual release acceptance criteria.
- Licenses are not fully resolved for future private-package publication (notably `@zeruxjs/tags` and `@zeruxjs/reports` lack declared license metadata), and transitive lockfile artifact review including `svg-tags` remains mandatory.

Do not change any of these statuses to closed until real install, artifact/consumer, advisory, provider and maintainer evidence is attached. See `RELEASE_DECISION_85.md` and `SECTION_85_PACKAGE_RELEASE_QUALIFICATION.md`.


## Post-85 corrective handoff — 2026-10-15

The source-only package graph has been repaired: five foundation libraries are now public **candidates**, 41 internal wildcard ranges were pinned exactly, and an offline packed-consumer check now passes for cache, db, hooks and security. The public candidate count is **13** (29 private workspaces). See `POST85_PACKAGE_RELEASE_HARDENING.md`. The original pre-handoff classification (8 public/34 private), public-to-private blocker and wildcard descriptions above are retained as historical findings **resolved in source**. However, **PKG-001 through PKG-010 are not collectively certified or closed**: 14 registry dependencies remain absent from the lock, full clean install/provider/browser/security evidence is lacking, and no stable publication has been authorized. **Decision remains NO-GO.**
