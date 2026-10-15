# Section 79/85 — CLI/dev tooling, test runner and developer experience

Date: 2026-10-14 · Scope: reusable package ecosystem only · Baseline: Section 78 full project ZIP

## Delivered

1. `zcli`: a new public `createZeruxProject()` and executable `zcli create <dir> [--js|--ts] [--dry-run]`. Uses write-exclusive staged files, exclusive final directory claim and on-failure cleanup. It refuses existing project targets, including dangling symlinks. The starter includes a private `package.json`, `.env.example`, `.gitignore`, JS/TS source/config, Node smoke test and README. It does **not** silently install dependencies, run arbitrary generators or overwrite existing projects. No shell-command construction.
2. `zeyro`: strict CLI arguments, config JSON size limit, config-relative root resolution, no symlink recursion, bounded retry/timeout config, nonzero return for no matching files/registered tests, and `afterAll` cleanup on `bail` for suites already started. The runner exposes failures during deferred teardown. Test timeouts do not cancel noncooperative user async code.
3. `zwatch`: validates watcher roots, callbacks, debounce and polling settings before allocating shared resources. Preserves polling fallback for unsupported native recursive watch and reports initial native errors. No symlink directory traversal.
4. Workspace DX: read-only `npm run doctor` (`--json` output available), `npm run doctor:strict` (fails on missing lock resolutions/invalid contracts) and `npm run test:developer` (dependency-scoped builds and ZCLI/Zeyro/Zwatch/Z-Dev tests with platform-independent file expansion). Node-only source preflight now exercises doctor regressions. Local package-lock workspace metadata was synchronized using `deps:sync-local` **without inventing any third-party resolution**.

## Commands and expected behavior

Run from `apps/proworkspace`:

```sh
npm run doctor
npm run doctor -- --json
npm run doctor:strict
npm run test:developer
npm run test:workspace-tools
npm run verify:source
npm run verify:clean
```

Run the published package command from a new directory after installing it:

```sh
zcli create my-app --ts
cd my-app
npm install
npm test
npm run dev
```

For JavaScript instead use `zcli create my-app --js`. `--dry-run` changes nothing.

## Verification summary

- The affected `zcli`, `zeyro`, `zwatch`, `z-dev` and `@zeruxjs/security` source TypeScript builds passed locally after linking the already present local packages/Node typings for the offline environment.
- Focused tests: ZCLI 15 passed, Zeyro 11 passed, Zwatch 7 passed, Z-Dev 5 passed; workspace tooling **36 passed** and isolated source preflight **33 passed** with **42 package contracts** validated. The four-package `test:developer` command passed.
- Generated JS starter executed its standalone Node test. Generated TS starter was structurally checked but **not** clean-installed or launched.
- `test:developer` succeeds in the local prepared workspace; the command is *not* proof of clean installation.

## Known open gates

- **Blocker:** the Section 66 package lock still has 14 unresolved external npm packages and 15 missing dependency edges, so fresh `npm ci` is not certified. Dependencies must be resolved with genuine registry metadata, then `verify:clean` executed before release.
- Windows/macOS full build, live HMR file/restart behavior, real React/Vue browser hydration, broad lint/types/build/launch pipeline and clean-machine scaffold acceptance were not run in this environment.
- Do not label Section 79's clean machine exit criterion passed or the entire package ecosystem stable based on the local source tests.

**Next Section 80:** Content/file workflows and remaining ecosystem packages (AIO infrastructure excluded).
