# Section 20 — Managed application status and safe manual reload

## Delivered

- Implemented immutable, subscribable managed lifecycle snapshots.
- Implemented an explicit, serialized manual `restart()` API separate from
  automatic on-failure/always restart quotas.
- Ensured route leases are released between processes, readiness is awaited
  before republishing, and concurrent restarts share one promise.
- Added optional POSIX SIGUSR2 reload for CLI-managed apps (`--reload-signal`).
- Added per-user, private, atomic runtime-status snapshots, safe readers, and
  `zerux-server status [name] [--json]`.
- Recorded a verified owner process fingerprint to avoid mistaking a reused
  PID for a live app. The status reader is **never** used for process control.
- Added focused and end-to-end tests for manual restarts, signals, status
  storage, malformed files, and observer cleanup.

## Boundaries

Manual reload is sequential and briefly unpublishes the route. Runtime status
is local observability only. It is not an authenticated HTTP endpoint or
zero-downtime deployment protocol. Status history requires operator rotation.
Native Windows/macOS testing and production app integration remain outstanding.

No changes to Docker/deployment files or unrelated applications.
