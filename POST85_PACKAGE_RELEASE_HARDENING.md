# Package release hardening after Section 85 — final source handoff

**Date:** 2026-10-15  
**Scope:** Reusable packages under `apps/proworkspace/packages/` only. No AIO application work.  
**Decision:** **NO-GO for stable public npm release**. Source/package-policy repairs are complete locally; environment-dependent acceptance gates remain unresolved.

## Changes made in this handoff

1. **Public dependency closure:** Converted five foundational packages from private to *public-release candidates*: `@zeruxjs/cache`, `@zeruxjs/db`, `@zeruxjs/hooks`, `@zeruxjs/lint`, `@zeruxjs/security`. Their existing prerelease versions were **not promoted**. The project now has **13 public-candidate manifests and 29 private workspaces**. No npm publishing was attempted; maintainers must review the decision to distribute these libraries.
2. **Deterministic internal versions:** Replaced **41 wildcard local workspace dependency ranges** with the exact existing workspace versions, then synchronized only local workspace metadata in `package-lock.json`. **No external registry entries, integrity hashes or licenses were invented.**
3. **Real tarball compatibility:** Added an explicit `dist`/README/license file allowlist for each new public candidate. Adjusted CommonJS package export conditions so `@zeruxjs/cache` and `@zeruxjs/db` support their declared Node ESM-import and CommonJS-require paths. A real, completely offline npm tarball consumer installs and imports `cache`, `db`, `hooks`, and `security`; each package was compiled locally using preinstalled TypeScript and Node typings.
4. **Publication ordering and invariants:** Added `npm run release:graph` with dependency-first ordering, version-mismatch detection, required-private-dependency detection, and cycle rejection. A private optional `@zeruxjs/queue` peer is an **explicit unavailable opt-in**, not treated as if it were installable from npm.
5. **CI scope:** Extended the no-publish release-review workflow to Linux, Windows and macOS on Node 22/24, adding graph checks and the packed-foundation consumer. It remains intentionally fail-closed until a real registry-backed lockfile, artifact builds, licensing, and further gates pass.
6. **API freeze:** Updated `api-freeze.json` after the explicit public-candidate classification and exports review. All other prior API contracts are retained.

## Local evidence versus certification

| Gate | Result in this handoff | Certification boundary |
|---|---|---|
| Source contracts and API freeze | PASS | Offline structural/source checks only |
| Publication dependency graph | PASS | 13 candidates ordered; private optional Queue remains unavailable |
| Foundation package builds | PASS: cache, db, hooks, security | Local Node 22/TypeScript toolchain with temporary global Node typings |
| Foundation runtime regressions | PASS | Existing unit test suites, not external service matrix |
| Foundation npm tarball consumer | PASS | Four independent tarballs installed offline; imports exercised |
| `@zeruxjs/lint` full build | BLOCKED | Workspace `zwatch` build/dependency tree not installed in isolated source environment |
| `npm ci` clean Node 22/24 | BLOCKED | 14 distinct third-party packages absent from the committed lock |
| Full 13-package builds and packed consumers | NOT VERIFIED | Registry-resolved clean install and dependency-order build required |
| Online CVE and transitive license audit | NOT VERIFIED | Registry/advisory access unavailable; `svg-tags` and missing private license metadata still require review |
| Live PG/MySQL/Mongo, Redis, SMTP/IMAP/POP3, S3, browser, fault injection | NOT VERIFIED | Real disposable services/CI and host credentials/environment required |
| Stable semver/provenance/human authorization | NOT APPROVED | No prerelease version promotion, signing, publication or credentials added |

## Next execution at a registry-connected build agent

From `apps/proworkspace/`, with network access and permission to update and review the lockfile:

```bash
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm run deps:check
npm ci --no-audit --no-fund
npm run verify:source
npm run release:graph
npm run security:online
npm run build:workspaces
npm run release:foundation:consumer
npm run release:pack
npm run lab:live
```

`release:pack` **must fail** for unfinished prerelease/stability criteria; it is not permission to publish. Commit only a registry-generated, validated lockfile. Run the protected, no-publish GitHub Actions workflow on Node 22/24 and all three operating systems. Record the provider, mail-delivery, browser, S3, fault-injection and security evidence, review licenses, select a semver/migration policy, and obtain maintainer approval *before* enabling any publish action. The remaining private optional Queue integration will require its own dependency/publishing decision before it can be used by public npm consumers.

**Do not treat the two deliverable ZIPs as prebuilt npm artifacts.** The full ZIP is the complete updated source repository. It deliberately excludes temporary `node_modules`, `dist`, and local test artifacts. The delta ZIP contains only changed files from the Section 85 baseline. A fresh registry-backed build is mandatory.


## Final GO-readiness execution — 2026-10-15

See [`RELEASE_GO_READINESS_FINAL.md`](RELEASE_GO_READINESS_FINAL.md). Added all-public packed consumer acceptance, installed third-party license-artifact inspection, opt-in npm lockfile repair CI and integration-lab report symlink/absolute-path containment fixes. **68 workspace-tooling tests, 60 isolated source-preflight tests** passed. Registry DNS remains unavailable, 14 external packages are unresolved, and real-provider/browser evidence plus maintainer signoff are still outstanding. **Stable release remains NO-GO.**
