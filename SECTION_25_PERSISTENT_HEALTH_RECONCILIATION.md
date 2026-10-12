# Section 25 — Persistent health and multi-controller reconciliation

## Problem

The ZSRV multi-backend pool previously lost its passive/active circuit-breaker
state whenever the proxy restarted. It also treated the hostname as the only
state key; an old response could affect a newly leased backend using the same
port. Recovery for orphaned rolling controllers had to be requested by name,
without a bounded all-controller inventory. The CLI had no direct live view of
an application's individual backend health states.

## Implemented

- Added `backend-health-state.ts`: private, bounded, versioned snapshots,
  256 KiB cap, 1,024 backend cap, safe file validation, symlink refusal,
  atomic file replacement, data and best-effort directory synchronization,
  and configurable snapshot expiry (default 60 seconds).
- `BackendPool` restores recent failure isolation for the **same** route
  signature only; a changed registration, lease, PID, backend list, or weight
  resets its historical circuit breakers. Failure and recovery updates are
  debounced instead of writing on every HTTP request.
- Proxy HTTP and WebSocket responses carry their original route signature.
  Late successes/failures cannot change the health of a replacement route.
  Asynchronous probe results similarly check the route's signature.
- Normal `portlessProxy()` instances use the existing private local-control
  directory. The standalone proxy API can opt into persistence via
  `backendHealth.stateDir`.
- Authenticated loopback control supports per-host backend status; CLI:
  `zerux-server rolling backends NAME [--json]`.
- Added `rolling-reconciler.ts`: bounded private-directory scan, owner
  fingerprint classification, serialized cross-process reconciliation,
  per-record error reporting, dry-run mode, and explicit CLI entry point:
  `zerux-server rolling reconcile [--dry-run] [--json]`.
- `src/index.ts` exports the new state and reconciliation APIs and removes a
  pre-existing duplicated `readDeploymentHistory` export.

## Focused checks

- `test/backend-health-persistence.test.mjs`: checkpoint restore, expiration,
  circuit-breaker recovery, lease isolation, old-response protection,
  unsafe files, debounce.
- `test/rolling-reconciler.test.mjs`: live owners, invalid records, dry-run,
  and actual recovery after a simulated supervisor SIGKILL.
- `test/proxy-health-control.test.mjs`: authenticated live proxy health
  inspection and input validation.

## Limits and operational considerations

- Checkpoints are local and advisory. The actual route registry and process
  identity remain authoritative; no checkpoint authorizes process signals.
- Bulk reconciliation is opt-in: it can stop safely identifiable *orphaned*
  children and therefore is not scheduled implicitly. Live or unverifiable
  controllers are never terminated by this operation.
- Backends are isolated after upstream failures, not by HTTP status codes
  returned from responsive application instances.
- Cross-platform native deployment and crash simulation remain unverified.
- The full ProWorkspace build is intentionally not run; focused ZSRV checks are.
