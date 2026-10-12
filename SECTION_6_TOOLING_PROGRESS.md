# Section 6 — Developer tooling

## Implemented

### zwatch
- Replaced the old socket takeover watcher with an explicit resource-managed implementation.
- Source split into public exports (`index.ts`), types, filesystem scanner/diff, and lifecycle watcher engine.
- Watchers share a single native filesystem watcher per root **within one process**, with ref-count-like subscription disposal.
- Recursive native notifications with configurable polling fallback, debounced scans, update/create/delete classification, ignore predicates and error hooks.
- Polling timers are unref'd; no global signal handlers, no listener socket takeover, and no stale Unix socket deletion.
- Symlink traversal disabled; `.git` and `node_modules` ignored by default.

### zcli
- Extracted standalone, importable argument parsing into `args.ts`; CLI entry continues using the same parser.
- Correct `--` separator handling, repeated flags, negative numeric values, explicit assignment forms, protected key validation, and thrown `ArgumentError` instead of process termination in the parser.

## Verification
- TypeScript source transpilation: passed for the modified package source files.
- Node test runner: 4 focused tests passed (argument cases, dangerous option names, diff classification, watcher lifecycle/events).
- Full workspace typecheck / dependent applications: not run.

## Deliberate limitations
- Cross-process event sharing was removed instead of claiming safe takeover semantics; sharing is currently limited to consumers within one process. A separate daemon protocol can be built with authentication, ownership, heartbeat and reconnect tests.
- Native watcher recursion depends on the Node/platform filesystem; metadata polling is the fallback. Large trees should use a production event backend and incremental directory tracking.
- CLI command registration/plugin loading remains a larger separate workstream.
