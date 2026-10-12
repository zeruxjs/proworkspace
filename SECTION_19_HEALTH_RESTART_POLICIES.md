# Section 19 — Application health checks and bounded crash recovery

## Scope

Extended `zsrv`'s modular child supervision with an HTTP health checker and
restart controller. Existing TCP readiness and non-restarting application
behavior remain the defaults unless explicit flags are supplied.

## Changes

- `src/portless/health.ts`: loopback-only HTTP/TCP probes, bounded timeouts,
  status-code validation, rejected redirects, strict origin-form paths, and
  no response-body buffering.
- `src/portless/managed-app.ts`: configured restart policies (`never`,
  `on-failure`, `always`), sliding-window quota, capped exponential backoff,
  runtime polling with consecutive failure thresholds, cancelable backoff,
  signal coordination, child cleanup and lifecycle callbacks.
- `src/portless/process-supervisor.ts`: HTTP readiness support before route
  publication, maintaining existing TCP readiness as default.
- `src/portless/portless.ts`: route leases are registered only when the child
  is ready and released on each exit before any respawn. No stale routes are
  left for intentionally unavailable applications.
- `src/bin/parse-run.ts`, `src/bin/zerux.ts`: CLI options for health, restart,
  budgets and monitor settings with input validation.
- `src/index.ts`: exports public supervision APIs.
- Focused and end-to-end tests include unhealthy status, controlled crash,
  readiness, retry exhaustion, CLI parsing, and route republishing.

## Verification

- TypeScript check on `zsrv`'s portless and CLI source paths: passed using
  available local Node type declarations and an external chalk declaration.
- `node --test test/*.test.mjs`: 64 passing regression tests after the final
  source update, including HTTP and WebSocket proxy integration tests.
- Full workspace build intentionally not run. Source-package dependencies were
  unavailable in this extracted archive; a local external chalk installation
  was symlinked solely for runtime tests, then excluded from both deliveries.

## Limitations

- Restart counters are not persisted across wrapper restarts; this is not a
  distributed supervisor or zero-downtime system.
- HTTP health probes target IPv4 loopback only and do not follow redirects.
- Native Windows process-tree termination and actual third-party workspace
  integration remain to be tested on their target platforms.
