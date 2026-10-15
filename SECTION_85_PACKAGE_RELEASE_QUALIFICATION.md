# Section 85/85 — Package documentation, npm artifacts and stable-release decision

**Date:** 2026-10-15  
**Scope:** ZeruxJS / ZyroJS / Zuix reusable packages only; **not** the separate AIO infrastructure-management application.  
**Section 85 engineering deliverable:** Implemented and locally checked.  
**Stable-release decision:** **NO-GO. Do not publish or promote package versions to stable.**

This is the last scheduled package milestone. Delivering a release decision **does not** mean the prerequisites for a stable production release have been met. Open items remain in `RELEASE_BLOCKERS_84.md` and `RELEASE_DECISION_85.md`; they must be completed before approval, without inventing new package-section numbers or expanding into the AIO application's scope.

## What changed

1. All eight npm-public workspace package manifests now have explicit `files` allowlists. Generated `dist/`, the package README and the declared license copies are included. `zeruxjs` additionally includes its required committed `schema.config.json`. This prevents source files, development tests, local configurations and other accidental inclusions from silently becoming npm artifacts.
2. `scripts/workspace-package-release.mjs` enumerates **all 42 workspaces** and analyzes public-vs-private status, licenses and READMEs, files allowlists, package entrypoints/CLI/type declarations, direct and transitive private workspace dependencies, and unpinned internal dependency ranges. The module uses **the actual local `npm pack --dry-run --json --ignore-scripts --offline` file listing** for each public package; it does not guess `files` glob behavior.
3. The same tarball inventory has two honest modes: source-only inspection (unbuilt `dist` entrypoints are warnings) and post-build strict inspection (unpacked entrypoints are blockers). The latter fails if a package cannot be packed or exposes source/tests, secret-like files, or unsafe tarball paths. Private workspace packages are intentionally excluded from an npm publication decision, but are retained in build/dependency qualification.
4. `npm run release:inventory`, `npm run release:decision` and `npm run release:pack` provide read-only inventory, structured **NO-GO** evidence, and a fail-closed post-build audit. **None executes `npm publish`, sets npm credentials or modifies versions.** `release:pack` is included in the full clean-build runner, the transactional release finalizer and workspace CI.
5. A manually triggered `package-release-review.yml` checks both Node 22 and Node 24 and uploads a JSON review artifact even when the install gate fails. It has read-only repository permissions and no publishing step or npm secret.
6. `scripts/workspace-package-release.test.mjs` covers clean file inventories, absent exports/CLIs, accidental source/environment inclusion, private direct/transitive dependencies, stable/pre-1.0 version advisories and read-only packaging. The package documentation and final blocker register have been updated.

## Commands

From `apps/proworkspace`:

```bash
npm run test:section85         # offline release-inventory negative tests
npm run release:inventory      # JSON source-only inventory; not certification
npm run release:decision       # JSON NO-GO / blocker evidence; no publish
npm run api:freeze:check       # public manifest/API metadata freeze
npm run security:source        # offline source audit only
npm run verify:source          # isolated source snapshot, no installation
npm run deps:check             # currently fails: unresolved external packages

# After a complete, online npm ci and build, in a clean checkout:
npm run release:pack          # strict real tarball entrypoint/manifest audit
npm run verify:clean          # clean install + online audit + build + smoke + pack
npm run lab:live              # provision real provider lab first
```

`npm run release:pack` will **correctly fail** in the source ZIP because generated `dist/` files are deliberately excluded. Do not commit generated output to make a source-only gate appear green.

## Local evidence and limitations

- **42 package workspace manifests** found: **8 public**, **34 marked `private: true`**. Private packages are not silently promoted for npm publication.
- Local API snapshot and offline security audit pass against the current manifests; isolated source preflight and workspace tooling tests pass.
- Affected TypeScript packages **`zcli`, `zeyro`, `zuix`, `zyrojs`** compiled with temporary, globally available Node typings, outside a clean npm installation. Their `npm pack --dry-run` previews include declared runtime/CLI/type export files, and selected runtime regression tests pass. Temporary `node_modules` links and generated `dist` content are **not part of the delivered ZIPs**.
- Remaining public packages are **not** verified as built distributables, and **no package was published**. Successful tarball previews alone do not prove `npm install` works from the registry, that all runtime dependencies are available, that TypeScript consumers compile on all supported platforms, or that public APIs are stable.
- The root lockfile still has **14 distinct unresolved external packages (15 dependency edges)**. `npm ci`, full build, online vulnerability review and integration-provider acceptance cannot be certified with that input.
- A public package that directly or transitively depends on a `private: true` workspace cannot be installed by a generic npm consumer unless that dependency is made available by a separately reviewed publication/distribution plan. The current workspace versions also use `*` for internal dependencies; these require approved semver ranges for a public distribution.
- Most workspaces retain experimental `0.0.1-alpha` versions; no automatic version bump occurred. `0.x` versions without a prerelease suffix are recorded as pre-1.0 compatibility advisories, not mislabeled prereleases.

## Public package matrix

| Package | Current declared version | Visibility | Artifact review status |
|---|---|---|---|
| `zeruxjs` | `0.0.1-alpha.3` | Public | Private/wildcard workspace dependencies and clean-build blockers; NO-GO |
| `zsrv` | `0.0.1-alpha.2` | Public | Wildcard/transitive private dependency chain and clean-build blockers; NO-GO |
| `z-dev` | `0.0.1-alpha.2` | Public | Direct private workspace dependency and clean-build blockers; NO-GO |
| `zwatch` | `0.0.1-alpha.2` | Public | Local compiler/consumer certification pending; prerelease; NO-GO |
| `zcli` | `0.1.0` | Public | Local build and tarball preview passed; online consumer/matrix pending; NO-GO |
| `zeyro` | `0.1.0` | Public | Local build and tarball preview passed; online consumer/matrix pending; NO-GO |
| `zyrojs` | `0.0.1-alpha.2` | Public | Local build and tarball preview passed; actual release remains prerelease; NO-GO |
| `zuix` | `0.2.0` | Public | Local build and tarball preview passed; real-browser/consumer matrix pending; NO-GO |

## Exit criteria for a future GO decision

A named maintainer must review **reproducible evidence** of: complete registry-resolved lockfile and clean Node 22/24 installs; source/build/API freeze and all npm artifact checks; actual consumer imports, declarations, CLI and platform tests; online advisory/license clearance; live provider recovery, uncertain-SMTP, tenancy and distributed fault checks; React/Vue/browser/OS matrix; documented semver and migration plan; package ownership, npm identity, provenance/signature credentials and rollback policy. Any remaining P0 issue is a stop-ship. The `release:decision` tool intentionally defaults to **NO-GO**, leaving human authorization explicit.

See [PACKAGE_RELEASE_GUIDE_85.md](PACKAGE_RELEASE_GUIDE_85.md), [RELEASE_DECISION_85.md](RELEASE_DECISION_85.md), [MIGRATION_COMPATIBILITY_85.md](MIGRATION_COMPATIBILITY_85.md) and [RELEASE_BLOCKERS_84.md](RELEASE_BLOCKERS_84.md).
