# Section 66 continuation — clean source snapshots and dependency graph hardening

**Date:** 2026-10-13  
**Status:** PARTIALLY IMPLEMENTED, **FULL CLEAN-INSTALL/BUILD GATE STILL BLOCKED**.  
**Scope:** Package-only ZeruxJS, ZyroJS, Zuix and the workspace libraries. No AIO infrastructure changes.

## Problems resolved

1. **False clean-checkout coverage.** `verify:clean` used to copy `package.json`, `package-lock.json`, `packages/` and `scripts/` only. That omitted the sample application's `app/` routes, public assets, project TypeScript and Zerux configuration, and integration tests. A passing check could not legitimately be called a complete source checkout.
2. Added `scripts/workspace-snapshot.mjs`, a reusable snapshot routine covering the complete application source. It prevents destination-within-source recursion and omits `node_modules`, all generated `dist`, symlinks (including links outside the checkout), `.env` secrets (retaining public `.env.example`), caches, and TypeScript incremental build data. **No local credentials or installed dependencies are copied**.
3. `verify:clean` now uses that complete snapshot; it also runs workspace tooling tests *after* `npm ci` and before framework smoke tests. A clean `npm ci` remains mandatory.
4. Added `npm run verify:source`, a **separate offline, isolated source-only preflight**. It validates the source snapshot, runs the real workspace tooling test files inside it, plans all 42 package builds, and reports outstanding lockfile dependencies. It does **not** install dependencies or compile packages. A green source preflight does NOT count as production build signoff.
5. `scripts/workspace-lock.mjs` now diagnoses missing nested/transitive required dependency edges, HTTP lockfile tarball downloads, malformed external lock entries, and obsolete local workspace links. `--sync-local` removes obsolete **local links** only and never invents external version/integrity data.
6. Added regressions for correct snapshot coverage/exclusions, missing nested lockfile dependencies, nested package resolution, lockfile integrity diagnostics, stale-link deletion, and preservation of genuine downloaded dependency records.
7. CI runs the offline source preflight first, then the strict lock check, `npm ci`, the complete package build, tooling tests, framework smoke checks, and an independently generated clean checkout verification.

## Verified tests and commands

From `apps/proworkspace`:

| Command | Result | Scope |
| --- | --- | --- |
| `npm run test:workspace-tools` | **18 passed, 0 failed** | Workspace dependency/build/snapshot tooling |
| `npm run verify:source` | **PASS** | 1,519 files copied into an isolated source checkout, 42 workspaces planned, 18 tests passed |
| `npm run deps:check` | **BLOCKED as intended** | 14 absent third-party packages, 15 missing required lock edges |
| `npm run verify:clean -- --offline` | **BLOCKED as intended** | Will not claim clean install with missing resolutions |
| `npm view typescript version --fetch-retries=0` | **EAI_AGAIN** | npm registry DNS unavailable from this environment |
| Full `npm ci`, all-package clean compile, live services | **NOT VERIFIED** | Requires real dependency resolution/install and service environments |

The **14 missing external packages** are:
- `@zeruxjs/email`: `nodemailer`, `juice`, `sanitize-html`, `html-to-text`, `imapflow`, `mailparser`, `node-pop3`.
- `@zeruxjs/queue` / `@zeruxjs/cache-redis`: `bullmq`, `ioredis`.
- `@zeruxjs/files`: `@aws-sdk/client-s3`, `@aws-sdk/cloudfront-signer`, `@aws-sdk/credential-providers`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner`.

`ioredis` is required by two local workspaces, hence **15 unresolved dependency edges** representing **14 distinct external packages**. Npm must also resolve all of their transitives.

## Required final Section 66 acceptance (network-enabled checkout/CI)

```bash
cd apps/proworkspace
npm run verify:source
npm run deps:sync-local
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm run deps:check
npm ci --no-audit --no-fund
npm run build:workspaces
npm run test:workspace-tools
npm run verify:clean
```

Record and fix any **additional** compiler/test errors exposed by the first genuinely clean install. No fabricated package tarball URL, registry version, integrity hash or claimed production status substitutes for these commands. CI must pass on a clean runner before Section 66 closes.

## Backwards compatibility and artifact policy

No runtime Email, Queue, database, web, ZyroJS, or Zuix API was removed. Source ZIPs exclude temporary local links and compiled `dist` outputs. The **changed-only archive** continues to represent the cumulative diff from the exact full **Section 65** project because Section 66 is not yet closed.
