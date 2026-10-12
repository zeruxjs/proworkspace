# Section 21 — Multi-instance routing and readiness-checked handovers

## Implemented

- Shared `RouteBackend` type and optional multi-instance route pool (legacy `port` remains the first entry).
- RouteStore `registerPoolRoute()`, lease `switchBackends()` and conditional `replacePoolBackendsIfOwned()`. Writes remain protected by the route lock and atomic registry replacement.
- Strict validation of backend port range, weights, duplicates, pool size, and persisted primary-port consistency.
- Proxy-local smooth weighted round-robin applied to HTTP forwarding and HTTP/1.1 WebSocket upgrades.
- Passive failure isolation, configurable cooldown, optional active TCP/HTTP probes, failure thresholds, bounded probe concurrency and live health snapshots. Timers stop on proxy close.
- Readiness-checked `handoverBackends()` helper. Failed readiness or lost lease does not change the published route.
- Existing requests remain attached to their selected upstream while subsequent requests see the committed route.
- Added tests for weighted selection, schema rejection, persistent lease ownership, readiness rollback, live HTTP routing/failover, in-flight cutover, WS balancing and health recovery.

## Guarantees and scope

The route-file change is atomic for participating RouteStore readers; the system is **not** an orchestrator for launching new processes or draining remote WebSocket sessions. The caller must retain the old instance long enough for active connections to finish and ensure the replacement is listening before switching. A selected unhealthy target may fail its first request before passive detection; non-idempotent HTTP requests are never retried automatically.

The proxy remains **loopback-only** and targeted at local development. No authentication, public ingress, external service discovery, persistent health-state database, or cluster-wide coordination is provided.

## Validation

Run `tsc -p apps/proworkspace/packages/zsrv/tsconfig.json` in an installed workspace, then `npm test` within `zsrv` to run the new and existing regression tests. This section was checked with temporary local Node type declarations and a validation-only Chalk symlink; neither is included in the deliverables.
