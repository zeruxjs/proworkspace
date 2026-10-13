# Section 66 continuation — package export contracts, build timeouts and honest verification

**Date:** 2026-10-13  
**Status:** Source/build tooling improved and offline checks pass. **Section 66 release gate remains BLOCKED** until the external npm dependency graph is resolved and a full clean checkout is built.

## Defects corrected

1. **Broken public ZeruxJS export:** The `zeruxjs` manifest exports `zeruxjs/schema/schema.config.json`, but no `assets/json/schema.config.json` existed. This caused a guaranteed missing-file failure in the final package export check and for any user importing that subpath. A new conservative Draft 2020-12 JSON schema has been committed at the existing export target. It documents serializable top-level configuration fields without pretending to model functions and dynamic plugins. The TypeScript `ZeruxConfig` interface remains authoritative.
2. **Unverified source package exports:** `scripts/workspace-contracts.mjs` now checks all 42 workspace manifests for unsafe/noncanonical public paths and missing committed static assets. Generated targets under `dist/`, `lib/`, and `build/` are verified separately after compilation. Additions include `npm run contracts:check`, regression tests and clean/isolated/CI gating.
3. **Unbounded package builds:** `build-workspaces` now accepts `--timeout-ms` (default 300,000; valid 100–3,600,000), isolates POSIX npm subprocess groups, aborts them on timeout/failure, and returns an actionable timeout error. The clean checkout verifier gives the full 42-workspace build an independent 45-minute maximum to avoid incorrectly imposing the earlier 10-minute total build timeout; each workspace still has its own timeout.
4. **Unsafe generated export verification:** Post-build artifact verification now rejects symlinks, including generated outputs pointing outside the package, rather than treating their targets as verified published files.

## Verified commands

From `apps/proworkspace`:

| Command | Result |
| --- | --- |
| `npm run test:workspace-tools` | **25 passed / 0 failed**, including actual timeout of a hung npm workspace build and rejection of symlinked exports |
| `npm run contracts:check` | **PASS**, 42 workspaces; zero missing or unsafe source exports |
| `npm run verify:source` | **PASS**, 1,523 isolated source files, 42 contracts and build plans, 25 tests |
| `npm run verify:clean -- --offline` | **BLOCKED intentionally** on the incomplete lockfile, not incorrectly marked green |
| `npm ping --registry=https://registry.npmjs.org --fetch-retries=0` | **EAI_AGAIN**: registry DNS unavailable |
| Complete `npm ci`, all-workspace builds and real external services | **NOT VERIFIED** |

The remaining 14 distinct third-party package resolutions (15 local dependency edges) are unchanged: `nodemailer`, `juice`, `sanitize-html`, `html-to-text`, `imapflow`, `mailparser`, `node-pop3`, `bullmq`, `ioredis`, `@aws-sdk/client-s3`, `@aws-sdk/cloudfront-signer`, `@aws-sdk/credential-providers`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-request-presigner`. Additional transitives must be fetched during a network-enabled lock regeneration.

## To complete Section 66 on a network-enabled machine

```bash
cd apps/proworkspace
npm run verify:source
npm run deps:sync-local
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm run deps:check
npm run contracts:check
npm ci --no-audit --no-fund
npm run build:workspaces
npm run test:workspace-tools
npm run verify:clean
```

Resolve any new compiler or runtime failures from that real clean build. Do not handcraft registry `resolved` or `integrity` fields. Do not certify package publication or production readiness from an offline source-only pass.

**Artifact policy:** The changed-only ZIP is cumulative **relative to the exact Section 65 full release**, including all Section 66 continuations; the full ZIP includes every prior section. No AIO application work is included.
