# Section 22 — Rolling deployment orchestration

## Goal

Extend Section 21's health-aware multi-backend routing to actually launch and
retire application child generations while keeping the old generation available
until the replacement has passed health checks.

## Implemented

- `portless/rolling-app.ts`: opt-in controller that launches the first child,
  publishes a route lease only when ready, creates new generations on spare
  ports, and atomically switches the leased backend after candidate readiness.
- Post-switch health verification with **conditional rollback** before the old
  child is stopped. Refuses to overwrite a newer lease if another process took
  ownership of the route.
- Asynchronous, single-flight `deploy()` and idempotent `stop()` with
  cancellation-safe behavior during startup, drain and shutdown.
- `portless/backend-connections.ts`: per-host-and-port connection accounting,
  used by the proxy to track requests and WebSocket tunnels independently of
  the current route table. Waiters support a bounded drain timeout.
- `proxy.ts`: request and upgraded-tunnel instrumentation plus cleanup of
  WebSocket half-closed tunnels that could otherwise stall draining.
- Public exports in `zsrv/src/index.ts` and usage instructions in its README.

## Focused verification

Tests cover tracked releases, forced deadlines, live HTTP traffic through the
proxy, held requests during a handover, successful candidate replacement,
failed candidate startup, health-check rollback, repeated deployments,
concurrent deploy calls, shutdown races, route takeover and WebSocket cleanup.

Validation is run using a temporary local Node typings link because the ZIP
workspace does not include installed dependencies. Temporary `dist/`,
`node_modules/` and local TypeScript configurations are **not shipped**.

## Boundaries

- Connection accounting is per proxy process, not distributed or IPC-shared.
- For draining, `launchRollingApplication` requires the actual proxy's
  `backendConnections`. Cross-process CLI coordination is not included.
- When a drain deadline expires, the old child is stopped anyway and the
  operation reports `drained: false`. This is a bounded rather than an
  unconditional zero-interruption guarantee.
- Not tested on macOS/Windows; no full workspace build or external
  production traffic test was performed.
- Automated adoption into `zerux-server run`, persistent fleet state,
  out-of-process health reporting and crash recovery are future sections.
