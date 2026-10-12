# Section 27 — Fleet CLI, durable restart budgets and verified crash recovery

## Main gap corrected

Section 26 provided a programmatic instance-fleet API only. It lacked a CLI
owner, durable retry budgets, cross-process backend observation and supervisor
crash recovery. Starting a controller in a standalone process could not safely
observe active proxy connections. A crashed controller could also reset its
restart counter, causing endless replacement loops after restarts.

## Implementation

- `src/bin/parse-fleet.ts` — strict argument parser, 2–16 replicas, 3–17 distinct
  ports (with a spare), health and backoff options, unchanged child command args.
- `src/portless/fleet-command.ts` — command lifecycle, control endpoint,
  start/stop/reconcile/status/backends/recover/reset actions, existing proxy RPC,
  startup operation lock and verified orphan-generation registry.
- `src/portless/fleet-state.ts` — private, bounded, schema-checked checkpoint,
  guarded symlink reads/writes, atomic publication with fsync, generation status
  snapshots, persisted retry attempt timestamps and explicit offline reset.
- `src/portless/restart-budget.ts` — validated export/restore of sliding-window
  timestamps; expired attempts discarded on reload.
- `src/portless/instance-fleet.ts` — synchronous pre-attempt callback so a
  failed checkpoint write prevents a replacement from starting.
- `src/portless/local-control.ts` — longer RPC window for operator reconcile.
- `src/bin/zerux.ts`, `src/index.ts` — CLI command routing and public exports.
- `test/fleet-cli.test.mjs` — unit, private state, separate-process deployment,
  healthy backend replacement, CLI stop, hard crash and orphan recovery tests.

## Security and consistency

The controller and its process generations are fingerprint-verified; PID alone
is never proof of ownership. Generation records are written before readiness,
while the route is published only after initial replica health checks. The
private control endpoint requires a token and verifies its owner. The state
reader rejects malformed, oversized, non-private, and symlinked files. Fleet
policy changes require an explicit offline reset, which is serialized with
controller startup and refuses pending crash-recovery generations.

## Validation

- Isolated strict TypeScript check for changed modules passed with temporary
  local Node typings and a temporary Chalk declaration.
- Five new unit and process-integration tests pass.
- Existing fleet/rolling/crash-recovery focused suite: 40 tests passed before
  the final hard-crash addition; the new crash scenario passed independently.
- Full workspace lint/build/typecheck was not requested or run.

## Limitations and next work

Checkpointed state is a last-known snapshot, not a distributed lease. State
write failures after launch can leave stale status; retry budget failures do
not permit a new replacement. Fleet control requires a live local proxy with
an authenticated drain observer. Multi-host fleet control, zero-downtime
replica scaling, authenticated remote control, unattended orphan reconciliation,
Windows/macOS native tests, and production soak testing remain open.
