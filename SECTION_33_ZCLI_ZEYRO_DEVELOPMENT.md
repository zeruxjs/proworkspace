# Section 33 — ZCLI and Zeyro implementation

Baseline: Section 32 complete project. This section focuses on two developer tooling packages instead of incremental ZSRV updates.

## ZCLI

- Replaced process-global command dispatch internals with `CommandRegistry` and `ZeruxCLI` compatibility class.
- Multiple packages can register commands against one keyword without executing handlers during registration.
- Supports aliases, help, docs, tab-completion candidates, deterministic command results and typed option schemas with required/default/choice validation.
- Allows explicit plugin registration using `package.json.zeruxCli.plugins`; no indiscriminate scanning/execution of installed `node_modules` packages.
- Canonical path validation and module-entry traversal protection are preserved, including when `exports` prevents direct `package.json` resolution.
- Maintains `cli.addKey`, `cli.addCommand`, `parseArguments`, and `cli.color` compatibility for the existing ZeruxJS entry.
- Registration and dispatch do not force `process.exit()`, allowing long-running server commands to survive naturally.

## Zeyro

- Replaces the previous single-file implementation and empty placeholder modules with a working modular test runner.
- Provides isolated test registries (`createRunner`), nested suites, before/after hooks, focused/skipped tests, table-driven tests, retries, timeouts, bail, filtering and focus prevention.
- Adds negative assertions, cycle-aware equality (including Maps, Sets, Dates and typed arrays), asynchronous matchers, async polling with cancellation, mocks and spies.
- Implements a JavaScript-test discovery CLI with JSON/TAP/pretty reporters, configuration validation and meaningful exit codes.
- Adds optional DOM and Playwright-shaped adapters using explicit dependencies supplied by the consuming application.
- Fixes the import-cache issue when the file-discovery CLI runs repeatedly in the same process.

## Validation

- Isolated `tsc` compilation completed successfully for both packages with temporary local Node type declarations.
- ZCLI: 12 node:test cases passed.
- Zeyro: 8 node:test cases passed.
- The packages do not depend on native browser emulators or require the entire workspace to be built.

## Compatibility and limitations

- Automatic execution of all installed CLI packages has intentionally been replaced with an explicit allowlist. Set `zeruxCli.plugins` in your application manifest to activate plugins.
- ZCLI handlers no longer terminate the process immediately; they return an exit code. Long-running commands are unaffected.
- Zeyro's test runner cannot terminate an uncooperative asynchronous function once its timeout expires; the deadline ends awaiting, not the underlying computation.
- Zeyro's CLI loads compiled JavaScript test files. Run a TypeScript build/loader separately for `.ts` test sources.
- The optional browser adapters are not substitutes for fully-featured Vitest/Playwright integration.
- No full app build or browser integration suite was performed.
