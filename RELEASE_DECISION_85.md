# Final package stable-release decision — Section 85/85

**Decision: NO-GO — stable/public npm release is NOT authorized.**  
**Date:** 2026-10-15  
**Scope:** Reusable packages in `apps/proworkspace/packages/`, not the AIO application.  
**Decision owner:** Named repository/package maintainers; no automated GO is inferred.

## Completed locally

| Check | Evidence | Interpretation |
|---|---|---|
| Package inventory | 42 workspace packages: 8 public, 34 private | Manifest classification only |
| API freeze/offline structural audit | `npm run api:freeze:check`, `npm run security:source` | Pass; not a CVE/license/artifact audit |
| Package tarball allowlists | Explicit `files` for 8 public manifests | Prevents shipping unrestricted source/test directories |
| Four scoped artifact builds | `zcli`, `zeyro`, `zyrojs`, `zuix` TypeScript builds | Pass locally using temporary Node typings; not clean npm install |
| Four npm dry-run previews | All declared JS, CLI and type export files present in the four generated outputs | Pass locally; no public npm consumer matrix proof |
| Scoped runtime regressions | Selected test suites on those built packages | Pass locally; browser/provider/OS gates remain open |
| Release-inventory negative tests | Direct/transitive private deps, missing outputs and unsafe files detected | Pass; dry-run checker is not a package publisher |
| Clean source preflight | Source/build-plan checks with no external dependencies installed | Pass; deliberately not a production certification |

## Blocking evidence

| Stop condition | Present state | Closure requirement |
|---|---|---|
| **P0: clean registry lock/install** | 14 distinct missing external packages; 15 required dependency edges | Resolve from real npm registry and pass `npm ci`, Node 22/24 builds and isolated repeat |
| **P0: unpublished internal dependencies** | `zeruxjs`, `z-dev`, and transitive `zsrv` dependency chains include private `@zeruxjs/*` packages | Review the distribution graph and publish/restructure dependencies before public consumer installation |
| **P0: wildcard internal semver ranges** | Public manifests still use `*` for internal workspace dependencies | Pin and test compatible real published versions |
| **P0: provider and uncertain-delivery correctness** | Live SMTP/IMAP/POP3, Redis/Cluster, PG/MySQL/Mongo, S3, provider fault recovery not certified | Successful opt-in live lab and crash/failure evidence |
| **P0: online security/license clearance** | High/critical advisory check cannot run cleanly, transitive artifact licenses incomplete (`svg-tags` review needed) | Clean online audit, third-party notice/license approval, no unresolved critical issues |
| **P1: packed consumer/runtime matrix** | Only four public package builds inspected locally; full public package builds/consumer install/typings/OS/browser not certified | CI Node 22/24 Linux/Windows/macOS consumers and appropriate React/Vue/browser tests |
| **P1: stability/version policy** | Experimental alpha and sub-1.0 manifests remain | Reviewed compatibility/migration/semver plan and API/types freeze |
| **P1: signed publication and rollback** | No protected publisher workflow or maintainer GO | Approve release identity, provenance, rollback/deprecation procedure before any publish |

## Decision and next actions

The 20-section package-development milestone has reached **Section 85 source/report delivery**, but the **stable-release acceptance exit gate is not passed**. No version is promoted, no private package is made public, no credentials or publish tokens are added, and no release is uploaded. A future GO must be a recorded maintainer decision supported by the above external evidence; the offline decision generator deliberately reports `NO_GO` until such a separate authorization exists.

Commands and CI: `npm run release:decision`, `npm run release:pack`, `npm run verify:clean`, `npm run lab:live`, plus `.github/workflows/package-release-review.yml`. The blockers are carried forward in `RELEASE_BLOCKERS_84.md` and should be closed against their existing IDs; no new AIO or other product work is part of this decision.


## Post-85 corrective handoff — 2026-10-15

The source-only package graph has been repaired: five foundation libraries are now public **candidates**, 41 internal wildcard ranges were pinned exactly, and an offline packed-consumer check now passes for cache, db, hooks and security. The public candidate count is **13** (29 private workspaces). See `POST85_PACKAGE_RELEASE_HARDENING.md`. The original pre-handoff classification (8 public/34 private), public-to-private blocker and wildcard descriptions above are retained as historical findings **resolved in source**. However, **PKG-001 through PKG-010 are not collectively certified or closed**: 14 registry dependencies remain absent from the lock, full clean install/provider/browser/security evidence is lacking, and no stable publication has been authorized. **Decision remains NO-GO.**


## Final GO-readiness execution — 2026-10-15

See [`RELEASE_GO_READINESS_FINAL.md`](RELEASE_GO_READINESS_FINAL.md). Added all-public packed consumer acceptance, installed third-party license-artifact inspection, opt-in npm lockfile repair CI and integration-lab report symlink/absolute-path containment fixes. **68 workspace-tooling tests, 60 isolated source-preflight tests** passed. Registry DNS remains unavailable, 14 external packages are unresolved, and real-provider/browser evidence plus maintainer signoff are still outstanding. **Stable release remains NO-GO.**
