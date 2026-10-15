# Package stable-release GO readiness — final execution boundary

**Date:** 2026-10-15  
**Scope:** Package-only (`apps/proworkspace/packages/*`), without AIO application changes.  
**Decision:** **NO-GO** for stable/public npm publication. This is an evidence-based decision, **not a declaration that development work was skipped**.

## Executed and verified in this pass

- Retained the reviewed 13-public / 29-private publication graph and pinned internal version policy. All 42 local package contracts remain structurally valid.
- Added `npm run release:public:consumer`: package **every public candidate** using actual `npm pack`, install all tarballs together into an isolated temporary npm project, import each root entrypoint, and verify TypeScript declarations with the workspace compiler and an isolated consumer. `--only=` is an explicitly scoped diagnostic; it cannot stand in for full qualification. Tarballs, installation and runtime/type failures block the test. No publish calls are made.
- Added `npm run license:installed` for installed-package manifest/version/license-file inspection against committed lock metadata. It fails on missing/mismatched package artifacts or license metadata and is **not a legal license approval**.
- Added `.github/workflows/package-lock-recovery.yml`: opt-in, read-only CI job to resolve missing registry-backed lock entries, run a real `npm ci`, advisories, artifact/license checks, builds and tarball consumers, and upload a candidate lockfile for **explicit review and commit**. Nothing is auto-published or silently merged.
- Integrated these additional checks into clean verification and no-publish release CI across Node 22 and 24 on Linux/Windows/macOS.
- Hardened Section 83 integration-lab report paths: absolute paths outside the checkout, symlink ancestors (including dangling links), and symlink report files are rejected. Regression-tested normal nested reporting and escape attempts.
- **Local results:** 68 workspace-tooling tests passed, 60 isolated source-preflight tests passed, 42 package contracts validated. Local TypeScript builds of cache, db, hooks and security passed. Offline registry access remained unavailable, so the full consumer matrix did **not** pass.

## Stop conditions that cannot be removed by source edits alone

| Required certification | Evidence in this environment | Required closure |
|---|---|---|
| **Complete clean npm lock and reproducible `npm ci`** | **Blocked:** 14 external packages (15 edges) absent from the lock; `registry.npmjs.org` DNS failed with `EAI_AGAIN`; no matching local cached artifacts. `npm run verify:clean -- --offline` correctly fails. | Run the opt-in lock-recovery workflow or registry-connected npm on a trusted machine. Review/commit the lockfile and repeat `npm ci` on Node 22/24. Never invent integrity hashes. |
| **13/13 public package consumers** | **Not certified.** New full-matrix consumer added; local isolated `@types/node` installation could not resolve from npm cache. | Full workspace build, then `npm run release:public:consumer` on all CI targets. Fix any real import/declaration issues. |
| **Online advisories and third-party license clearance** | **Not certified.** Offline structural audit passes; installed artifact review is now executable but depends on clean install. | `npm run security:online`, `npm run license:installed`, then human review of SPDX compatibility, notices and exceptional entries such as `svg-tags`. |
| **Real services, faults and browsers** | **Not certified.** Docker unavailable here; no authenticated SMTP, real databases/Redis/S3 or successful browser sessions are accessible. | Run package integration lab with its required named suites, including Redis Cluster, provider recovery/faults, Chromium and other target runtimes. Retain results. |
| **Stable versions, compatibility, provenance and approval** | **Not approved.** Several 13 package versions are still alpha; publication/rollback are privileged maintainer decisions. | Complete semver/migration approval, protected cross-platform CI results and human signoff. Do not promote versions without those decisions. |

## Reproduce and complete in a registry-enabled environment

```bash
cd apps/proworkspace
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm run deps:check
npm ci --no-audit --no-fund
npm run security:online
npm run license:installed
npm run verify:source
npm run build:workspaces
npm run release:public:consumer
npm run release:foundation:consumer
npm run release:pack
npm run lab:live
npm run release:decision
```

Do not claim that `lab:live` alone certifies all outages, fault injection, browsers and multi-OS consumers. Run those explicitly and retain the evidence in the protected release review. The new recovery workflow supplies a candidate lock for code review, **not** an automatic fix or a replacement for authorization.

**Package source handoff:** complete and regression-tested within this environment.  
**Stable npm GO:** not reached; certifying it without the above results would be false.  
**AIO:** not modified; can be developed from the source handoff while these package release gates remain tracked.
