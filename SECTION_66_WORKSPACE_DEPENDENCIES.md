# Section 66 — Reproducible workspace and dependency repair

**State: PARTIALLY IMPLEMENTED / CLEAN INSTALL GATE BLOCKED** (13 October 2026).

This is a package-only ZeruxJS/ZyroJS/Zuix section. It deliberately does **not** include AIO application hosting, DNS, registrar or CoreDNS management.

## Completed changes

1. Added `apps/proworkspace/scripts/workspace-lock.mjs` to reconcile checked-in **local** npm-workspace metadata from all 42 package manifests and the application manifest. Includes package workspace links (notably previously absent `zuix`), peer metadata, bins, engines and direct package dependency declarations. It does **not** invent external dependency versions or integrity hashes.
2. Updated `apps/proworkspace/package-lock.json` with the actual local workspace packages, workspace links, and `zeruxjs` dependencies missing from older lock metadata. Its external dependency resolutions remain **incomplete** until registry access is possible.
3. Added `scripts/check-workspace-deps.mjs` with `npm run deps:check`, `npm run deps:sync-local`. It detects stale workspace entries and missing external package resolutions, displays the importing packages, exits nonzero when incomplete, and supports JSON output for CI.
4. Added `npm run build:verified`, which requires lock inspection before the existing topological `build:workspaces`. `build:plan` and `build:scope` remain available.
5. Added `scripts/verify-clean-workspace.mjs` (`npm run verify:clean`), which **copies source into a fresh temporary directory** (no `node_modules`/`dist`/symlinks), runs `npm ci`, builds/verifies all workspace artifacts and runs framework HTTP/variable smoke tests. It never alters the user's working dependency directory. `--offline` and `--keep-on-failure` are supported. The command fails early with a clear diagnostic if the lockfile is incomplete.
6. Fixed a real `zeruxjs` CLI TypeScript mismatch between lint command return types and watch callbacks. CLI lint commands now check the returned `ok` flag instead of silently treating lint failures as success.
7. Added workspace-lock regression tests and a GitHub Actions workflow to enforce clean dependency + full build + framework smoke test. The workflow is expected to FAIL until the missing external dependencies are actually resolved and committed.
8. Preserved all previous Section 65 features, including IMAP/POP3, package-created inbox tables, JSON receiving, mapped host tables, campaigns, analytics and queue.

## Tests that actually passed in the current environment

- `node --test scripts/*.test.mjs` — 11 passed, 0 failed (workspace graph, build orchestration and lock sync).
- `node scripts/build-workspaces.mjs --dry-run --json` — 42 workspaces in an acyclic dependency order.
- `tsc -p packages/zeruxjs/tsconfig.json --pretty false` — passes using temporary local dependency links and temporary compiled workspace outputs; these files are **excluded** from both release ZIPs.
- `node --test packages/zeruxjs/test/{fetch-route,services-lifecycle,variables,variables-batch}.test.mjs` — 8 passed, 0 failed. The HTTP test starts a real local server and checks feed/search/SEO/font routes.
- `npm run verify:clean -- --offline` — correctly **blocked**, because `npm run deps:check` identifies missing external resolutions.
- Registry probe `npm view typescript version --fetch-retries=0` — failed with `EAI_AGAIN`, so an authenticated, verified npm lockfile cannot be generated in this environment.

## Remaining 14 REQUIRED external packages missing from the lockfile

- `@zeruxjs/email`: `nodemailer`, `juice`, `sanitize-html`, `html-to-text`, `imapflow`, `mailparser`, `node-pop3`.
- `@zeruxjs/queue`: `bullmq`, `ioredis` (also used by `@zeruxjs/cache-redis`).
- `@zeruxjs/files`: `@aws-sdk/client-s3`, `@aws-sdk/cloudfront-signer`, `@aws-sdk/credential-providers`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner`.

**Important:** npm will also need to lock these packages' **transitive dependencies**. Resolving them by constructing dummy `resolved`/`integrity` fields would make the archive unsafe and nonreproducible; no such fields were fabricated. External imports (`chalk`, `ws` in `zsrv`) were correctly declared in its manifest and have existing lock entries, but their runtime packages were unavailable locally without `npm ci`.

## How to finish Section 66 in a network-enabled CI/checkout

```bash
cd apps/proworkspace
npm run deps:sync-local
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm run deps:check
npm ci --no-audit --no-fund
npm run build:workspaces
npm run test:workspace-tools
npm run verify:clean
```

Commit the regenerated `package-lock.json` **only after** the registry-resolved dependency graph and `npm ci` succeed. CI must run without hand-created dependency links or pre-existing `dist` directories. If the initial clean build reveals additional compiler/runtime errors, fix those **under Section 66** before marking the section green; do not advance the roadmap as if this gate passed.

## Acceptance gate

- [x] Detect stale local workspace metadata and missing external lock resolutions with a failing check.
- [x] Repair local workspace lock metadata and validate its consistency across 42 packages.
- [x] Compile the main framework and smoke-test actual HTTP routes using manually bootstrapped **temporary** workspace builds.
- [x] Add isolated, CI-compatible verification and regression tests.
- [ ] `npm ci` from a clean checkout without temporary links or dist files.
- [ ] `npm run build:workspaces` succeeds for **all 42** packages from the same clean checkout.
- [ ] Full framework startup + shutdown smoke suite succeeds after clean install.
- [ ] `npm run verify:clean` succeeds in CI.

**Release gate remains BLOCKED by missing registry access and therefore unverified external dependency resolution.** This is not a production-ready Section 66 signoff.
