# Section 66 — Release gate, registry-blocker evidence and security policy

**Date:** 2026-10-13  
**Scope:** ZeruxJS, ZyroJS, Zuix and reusable workspace packages only; AIO hosting application excluded.  
**Status:** **BLOCKED — clean production build has not passed**. Source-level fixes, tests and security policy have been delivered, but completion requires a real registry-backed installation and clean build.

## Implemented in this continuation

1. **One-command release verification** (`apps/proworkspace/scripts/workspace-release.mjs` and `scripts/finalize-section66.mjs`): creates an isolated source checkout; checks npm registry accessibility; resolves the lockfile using npm; validates all workspace dependency and export contracts; performs `npm ci`, all-workspace compilation, workspace tool tests and framework lifecycle smoke tests. It commits the verified lockfile to the original source **only after every step succeeds**. Failures do not commit a changed lockfile.
2. **Prompt registry failure**: before attempting a long npm installation, `npm ping --fetch-retries=0 --fetch-timeout=6000` runs with a 15-second process timeout. A failed connection returns a clear error and stops the release gate without attempting to invent dependency metadata.
3. **Root `SECURITY.md`**: describes actual package-version status, supported channels, a confidential disclosure process, best-effort response targets and security responsibilities. The outdated GitHub-template version examples (`5.1.x`, `5.0.x`, `4.0.x`) are **not** used. GitHub Actions verifies that the root policy exists for both push/pull-request CI and manual release execution.
4. **Regression tests**: simulate successful clean verification, failure during build, unexpected manifest modification, source contract failures, lockfile read-only verification and failed registry accessibility.

## Measured outcomes

- `npm run test:workspace-tools`: **31 passed, 0 failed**.
- `npm run verify:source`: **31 passed**, 42 packages in the build/contract plan, 1,526 staged source files; **14 unresolved external package resolutions** remain.
- `npm run section66:finalize`: **BLOCKED** at the registry connectivity check. Exact reason: `EAI_AGAIN` while contacting `https://registry.npmjs.org/-/ping`. The original lockfile was unchanged and no all-package clean build was performed.
- This environment does not provide an authenticated or reliably reachable npm registry or pre-cached tarballs for the missing packages. External package versions and integrity hashes **have not** been guessed or fabricated.

## Finish Section 66 on a network-enabled machine

From a fresh checkout of the full Section 66 source, with Node.js 22 and a working npm registry:

```sh
cd apps/proworkspace
npm run section66:finalize
npm run deps:check
npm ci --no-audit --no-fund
npm run build:workspaces
npm run verify:clean
```

`section66:finalize` uses a temporary checkout and only writes the resolved lockfile after its staged clean install, all-package build and smoke tests succeed. **Commit that lockfile** after verifying the command reports `PASS`. In GitHub Actions, the workflow's `workflow_dispatch` job can generate a verified lockfile artifact, but an actual CI run and review remain required.

## Closure criteria

Section 66 can be called **completed** only after all of the following are evidenced on an environment that can reach required package registries:

- The committed `package-lock.json` has complete, genuine registry-resolved dependency records and passes `npm run deps:check`.
- `npm ci` succeeds in a clean checkout using the committed lockfile.
- All **42** workspace packages build, including their declared public exports.
- Framework HTTP, service lifecycle and variable-registry smoke tests pass from the resulting clean build.
- A second isolated `npm run verify:clean` run succeeds, and the CI workflow reports success.
- The root `SECURITY.md` remains present and accurately reflects version support and a private disclosure path.

Passing offline source/tooling tests **does not replace** these gates. The present release remains Section 66 work in progress rather than an independently certified stable release.
