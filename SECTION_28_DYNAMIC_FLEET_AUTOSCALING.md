# Section 28 — Dynamic Fleet Autoscaling, Capacity Repair and Diagnostics

## Scope

An expanded implementation section covering four related production concerns:

1. **Dynamic resizing and recovery**: online replica scale-up and scale-down,
   process readiness, atomic route switching, bounded draining, operation
   serialization and recovery after partial scale-up failures.
2. **Proxy-side load signals and autoscaling**: bounded per-second request
   counters, authenticated loopback metrics RPC, hysteresis, multi-sample
   thresholds, min/max capacity, pause/resume and cooldown.
3. **Persistent controls**: CLI flags and commands, desired replica count,
   durable policy state, restart budgets, configuration fingerprints and
   low-write-frequency policy checkpoint updates.
4. **Operational visibility and safety**: bounded lifecycle history, status,
   route/owner diagnostics, symlink rejection and safe absent-state handling.

## New module boundaries

- `src/portless/autoscale-policy.ts` — pure policy and threshold validation.
- `src/portless/fleet-autoscaler.ts` — scheduled metrics and capacity decisions.
- `src/portless/fleet-capacity.ts` — reusable deterministic capacity selection.
- `src/portless/fleet-events.ts` — bounded private lifecycle audit history.
- `src/portless/fleet-diagnostics.ts` — read-only runtime diagnostics.

Existing public modules in `src/portless` and CLI arguments in `src/bin` were
extended without replacing the earlier public APIs.

## Commands

```sh
zerux-server fleet run --name api --ports 4300,4301,4302,4303 \
  --replicas 2 --health-path /health --autoscale \
  --max-replicas 3 --scale-up-rps 25 --scale-down-rps 5 \
  --scale-cooldown 30000 --scale-samples 3 \
  --scale-interval 5000 --scale-window 30000 -- node app.mjs
zerux-server fleet scale api 3 --json
zerux-server fleet autoscale api pause --json
zerux-server fleet autoscale api resume --json
zerux-server fleet metrics api --json
zerux-server fleet doctor api --json
zerux-server fleet history api --json
```

Manual target changes respect the configured bounds when autoscaling is
active, pause automation, and persist their desired capacity. The normal
supervisor restart restores the persisted target provided the deployment
configuration still matches its fingerprint.

## Guardrails

- Never route a child before it is ready; never stop a retiring member before
  removing it from future route selection.
- Never overwrite newer route leases. Stop and replacement operations remain
  bounded and observable.
- Use only authenticated private loopback control for proxy traffic metrics.
- Reject invalid, stale, or missing load readings rather than scaling down.
- Cap counters to one-minute buckets, cap event files to 100 records and 64 KiB,
  and avoid checkpoint writes for unmodified sampling state.
- Do not silently overwrite symlinked state or history files.
- Preserve preexisting fleet, rolling, and proxy APIs for callers.

## Verification

Dedicated tests cover pure autoscale decisions, manual and concurrent
resizing, partial scale failures, capacity repair, route protection,
HTTP/backend metrics RPC, persistence, CLI commands, diagnostics, and history.
The complete application test suite was not requested. Some optional workspace
runtime dependencies require installation for normal builds.

## Further development

Native Windows/macOS validation, distributed replica scheduling, memory/CPU
telemetry, long-window metrics storage, load forecasting and zero-interruption
WebSocket migrations remain outside this local fleet implementation.
