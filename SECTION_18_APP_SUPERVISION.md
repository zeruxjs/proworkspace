# Section 18 — Application process supervision and CLI hardening

## Problem

- `portlessRun` previously registered a route before its application child bound
  the assigned port, exposing broken routes on slow or failed startup.
- The legacy command launcher ran Unix commands via a shell and called
  `process.exit` directly from child/signal events. It had no readiness
  contract, deadline, or bounded process cleanup.
- The CLI parsed `run` flags by removing only `--option` tokens while leaving
  their values in the command. This could launch the wrong executable and
  discarded valid application options.
- ZCLI loaded `package.json.zerux` paths without ensuring the entry stayed
  inside the declaring package (including symlink escapes).

## Implementation

**ZSRV:** New `src/portless/process-supervisor.ts`, reusable typed launch API,
port probes, readiness deadline, direct executable spawn, local binary PATH,
process group shutdown, cleanup and exit status handling. CLI run argument
parser is separate in `src/bin/parse-run.ts`; the CLI now validates its options
and propagates operation failure via exit code. `portlessRun` now validates,
starts the child, waits for readiness, then registers an ownership-aware route;
it stops the child if route registration fails. The old `spawnCommand` wrapper
now uses the supervisor instead of shell interpolation and forced parent exit.

**ZCLI:** Plugin path resolution is in `src/plugins.ts` and ensures realpath
containment and only JS module files, with support for symlinked packages.

## Validation

- Focused `zsrv` TypeScript typecheck and package transpilation.
- Full `zsrv` focused suite (including proxy, WebSocket, journal and route tests).
- New integration test launches real proxy and child CLI processes; verifies a
  not-yet-ready app has no route, HTTP forwarding works after readiness, and
  the route is removed after SIGTERM.
- `zcli` plugin loader typecheck and path containment tests.
- No workspace-wide build, lint, or typecheck was run.

## Remaining work

Actual HTTP health-check readiness with custom endpoints; robust Windows
process tree management; handling executable wrappers and monorepo script
framework flags (such as npm run dev -> vite); Windows/macOS native coverage;
application hot restart/zero-downtime handoff and comprehensive production
integration remain future sections.

## Packaging

`zsrv/package.json` now advertises the `zerux-server` executable through its
npm `bin` map. The workspace package-lock metadata was synchronized with that
map. Compiled `dist/` output is intentionally omitted from these source ZIPs;
run `npm run build` in the package before invoking its installed binary.
