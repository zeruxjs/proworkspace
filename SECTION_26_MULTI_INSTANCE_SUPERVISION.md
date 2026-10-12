# Section 26 — Multi-instance health-aware supervision

## What was implemented

`zsrv` now includes `launchInstanceFleet()` — a modular, local multi-process controller built on the existing `RouteStore`, `launchSupervisedCommand()`, health probes, and connection-drain observer. This is a **programmatic API**; the standalone fleet CLI and persistent restart-budget registry are future integration work.

* Launches 2–16 processes on distinct loopback ports, with at least one spare port for replacements. Publishes the initial route only after all desired instances pass readiness.
* Monitors each child with optional HTTP health checks (TCP is also supported). A crashed child also prompts reconciliation immediately, without waiting for the monitor interval.
* After the configured failure threshold, removes unhealthy instances from the route **when healthy capacity remains**, starts a replacement on an unused port, and atomically adds the replacement through the existing route lease.
* If all replicas are unhealthy, keeps a nonempty route while preparing the next healthy generation. The proxy's existing passive/active backend health logic can isolate failing backends, but this is not guaranteed zero-downtime recovery.
* Waits for tracked HTTP and WebSocket connections to drain before stopping retired children; records when a drain times out. If drain observation fails after cutover, the new live backend remains published.
* Uses a bounded sliding restart-attempt budget (failed launches consume attempts) and capped exponential delay. Counts automatically expire at the end of their configured window.
* Automatically readmits a temporarily isolated but recovered backend without spending a replacement attempt.
* Preserves conditional route ownership: a superseded fleet cannot overwrite or remove the replacement owner's route.
* Cancels pending replacement delays on shutdown, coordinates concurrent reconciliation, releases owned routes, terminates children, and removes process listeners.
* Emits immutable `FleetStatus` snapshots and provides a manual `reconcile()` method for control planes.

## Source layout

```
apps/proworkspace/packages/zsrv/
├── src/portless/
│   ├── fleet-types.ts       # Configuration, status, public contracts
│   ├── restart-budget.ts    # Sliding window and bounded backoff
│   └── instance-fleet.ts    # Processes, health, routes, draining and shutdown
├── src/index.ts             # Public exports
└── test/instance-fleet.test.mjs
```

## Usage

```ts
import { launchInstanceFleet, RouteStore } from 'zsrv';
// The example assumes `proxy` is your existing, already configured ZSRV proxy.

const routes = new RouteStore('/path/to/state');
const fleet = await launchInstanceFleet(['node', 'server.mjs'], {
  store: routes,
  hostname: 'api.localhost',
  ports: [4300, 4301, 4302],
  replicas: 2,
  connections: proxy.backendConnections, // actual serving proxy, not a fresh tracker
  health: { path: '/health', timeoutMs: 1500 },
  healthIntervalMs: 2000,
  unhealthyThreshold: 2,
  maxReplacements: 5,
  restartWindowMs: 60_000,
  replacementDelayMs: 100,
  maxReplacementDelayMs: 5000,
  drainTimeoutMs: 10_000,
  onStatus: status => console.log(status.phase, status.members),
});

const result = await fleet.reconcile();
console.log(result.replaced, result.failures);
await fleet.stop();
```


## Verification

15 dedicated integration tests cover startup and rollback, weighted pool visibility, unhealthy isolation, automatic recovery after child exit, failed replacements, restart budget exhaustion and expiry, in-flight draining, route ownership, concurrency, shutdown cancellation, and interval-based monitoring. Existing route, WebSocket, backend health, and rolling deployment regression tests are also run. TypeScript source compilation is checked with temporary local Node type definitions.

## Limitations and next section

This is a **single-controller, local-process** supervisor. It does not yet provide a persistent restart budget, fleet-level CLI commands, distributed coordination, native Windows process-tree recovery, automatic zero-downtime capacity expansion, or cross-proxy connection aggregation. It expects its caller to use the actual proxy connection observer and to configure a health endpoint reflecting application readiness. On extended failures, traffic capacity can be reduced or completely unavailable. Native environment and production load testing remain necessary.
