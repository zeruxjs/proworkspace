# Package release guide — ZeruxJS, ZyroJS and Zuix

**Current status (2026-10-15): NO-GO for stable npm publication.** This is an operator/developer guide for the reusable package monorepo, not a deployment guide for the separate AIO server manager.

## Packages and consumers

The workspace root is `apps/proworkspace`. The `packages/*` and `packages/@zeruxjs/*` workspaces collectively hold 42 package manifests. Eight currently have no `private: true` flag: `zeruxjs`, `zsrv`, `z-dev`, `zwatch`, `zcli`, `zeyro`, `zyrojs` and `zuix`. The other 34 are intentionally private in npm metadata, **including** Analytics, Tags, Reports, DB connectors, Cache, Queue, Email, React and Vue bridges; they are not ready for npm release simply because an internal import works.

`zeruxjs` is the application framework; `zsrv` provides serving/proxy/rolling facilities; `z-dev` provides dev utilities; `zwatch` provides file watchers; `zcli` is the CLI registry and project creator; `zeyro` is the test runner; `zyrojs` is the standalone reactive runtime and DOM/network package; `zuix` is the standalone CSS generator and Vite adapter.

## Reproducible release candidate review

Start from a fresh checked-out commit with no local `node_modules`, `dist`, cache, injected credentials or generated changes. Review `SECURITY.md`, the license files and the current API baseline. Run:

```bash
cd apps/proworkspace
npm run verify:source
npm run release:inventory
npm run api:freeze:check
npm run security:source
npm run deps:check
```

If any result fails, **do not package/publish**. Fix the committed npm registry lock entries with `npm run section66:finalize` in a network-enabled environment; this step is transactional and runs clean build and tests before accepting the new lockfile. Do not fabricate `resolved`/`integrity` hashes or bypass installation failures.

Once dependencies resolve, the full clean checkout workflow is:

```bash
npm ci --no-audit --no-fund
npm run security:online
npm run build:workspaces
npm run release:pack
npm run test:workspace-tools
npm run verify:clean
npm run lab:live
```

The package artifact check inspects the **actual output of `npm pack --dry-run`** and fails if an entrypoint, bin or TypeScript declaration is absent, if a secret-like file or source/test directory leaks, or if a publicly intended package depends on a private/unpinned workspace package. It does **not** send any package to npm. Package signatures, provenance and consumer installation tests must be added to the human-reviewed publication transaction in a protected, least-privilege CI environment.

### When the above becomes green

Validate a packed tarball consumer in a fresh directory on Linux, Windows and macOS for Node 22/24 and the support matrix actually declared in each package. Verify ESM imports, CLI behavior, exported `.d.ts` signatures, SSR/browser behavior where applicable, and required `peerDependencies`. Run tests under production-like storage, Redis, email and provider fault scenarios. Review all lockfile license entries, installed NOTICE/license artifacts, and public change notes. Use the `package-release-review` manual CI workflow to gather Node 22/24 evidence without publishing.

Release only from a protected reviewed tag/commit with explicit maintainer GO approval. Protect npm credentials and limit package scopes. Use trusted publishing/provenance mechanisms as supported by the registry and CI environment, and prepare deprecation/rollback guidance before pushing a version. Publishing is intentionally **not implemented as an automated action** in this repository's Section 85 tooling.

## Supported feature boundaries

The package roadmap describes many substantial source capabilities but should not be read as broad production certification. Real SMTP inbox delivery cannot be inferred from SMTP acceptance; distributed queues are at-least-once; native HTTP/3 requires an external suitable terminator where used; provider-specific cloud/DB integrations and browser support require their own exercised environments. Analytics is designed to fail soft, but host applications must supply tenant/consent and authorization configuration. Read the per-package README and the relevant Section 67–84 report for exact implemented interfaces and limitations.

## Troubleshooting

- **Missing `dist/` in a source ZIP:** expected; build cleanly, then run `npm run release:pack`. Do not edit exports to point at unpublished source just to quiet the checker.
- **Private/workspace wildcard dependency detected:** choose a reviewed publication order and pin actual compatible npm versions, or keep the package private. Do not `npm publish --force` or use local symlinks as public-distribution evidence.
- **Missing lock entries:** fix via real npm registry resolution; 14 distinct packages/15 edges are currently unresolved.
- **Browser or provider tests skipped:** do not count skipped as passed; provision real services/runtimes and attach CI evidence.
- **API freeze mismatch:** review compatibility, update semver and migration notes, then regenerate the freeze snapshot explicitly; do not blindly bless a break.

See [MIGRATION_COMPATIBILITY_85.md](MIGRATION_COMPATIBILITY_85.md) and [RELEASE_DECISION_85.md](RELEASE_DECISION_85.md).


### Completing registry-dependent release qualification

Run `.github/workflows/package-lock-recovery.yml` via `workflow_dispatch` to generate an **unmerged, unpublished** candidate lockfile for review. On a clean installed checkout, execute `npm run license:installed`, `npm run release:public:consumer`, and `npm run release:pack`. The all-public packed consumer tests real imports and declarations, not only file lists. `--only=...` is a scoped diagnostic and **never** certifies the full release. See `RELEASE_GO_READINESS_FINAL.md` for the remaining live-provider, browser, semver and approval requirements.
