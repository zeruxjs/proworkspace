# Section 24 — Rolling wrapper crash recovery and retention

## Problem

The Section 23 CLI owned detached child application generations, but a hard
wrapper crash could leave those children alive with no control endpoint. The
private history snapshot was not sufficiently reliable to identify or safely
terminate those child processes. Old deployment events were bounded to 50 but
had no age-based retention or CLI compaction workflow.

## Implementation

- `generation-registry.ts` stores the controller PID/creation fingerprint,
  nonce, child generation PID/creation fingerprints/ports, and route lease.
  Every write is private, bounded, atomically replaced and fsynced.
- `process-supervisor.ts` invokes `onSpawn` before readiness. Failure to
  persist the new child aborts startup and terminates the child.
- `rolling-app.ts` exposes `onSpawn` and `onLease`, publishing the lease
  fingerprint while the initial process is starting.
- `rolling-command.ts` uses a shared operation lock to recover stale owners
  before starting; it tracks generation exit, removes records after a clean
  stop, and surfaces recovery-needed state through CLI status.
- `rolling recover NAME [--dry-run] [--json]` can preview or execute
  recovery, refuses live or unverifiable owners, checks
  child identities before signalling, terminates only verified generations,
  and removes an old route only when its lease still matches.
- `rolling prune NAME [--days N] [--max-events N] [--json]` compacts the
  private audit history while the controller is offline. Regular history
  updates retain at most 50 entries from the last 90 days by default.
- `rolling-recovery.test.mjs` covers a hard-killed owner, PID fingerprint
  mismatch, route takeover, dangerous symlinks, live-owner refusal, history
  retention, and failed persistence during child startup.

## Operational boundaries

- Safety-first recovery can reject work that requires manual inspection.
- Grandchildren that outlive a dead process-group leader cannot be
  conclusively identified by the recorded leader alone.
- Linux behavior has been exercised; macOS/Windows need native testing.
- This is one-host local coordination, not a distributed supervisor.
- The normal complete-workspace build and all-package integration suite were
  not run. Focused TypeScript and ZSRV regressions were exercised instead.
