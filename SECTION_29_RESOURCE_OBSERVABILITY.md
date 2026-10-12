# Section 29 — Resource-Aware Fleet Autoscaling and Production Observability

This section builds on Section 28 and adds four related capabilities:

1. **Process-aware autoscaling:** CPU (% of one core) or average RSS (MiB) for actual fleet application child PIDs; Linux `/proc` parsing handles process names with spaces/parentheses and treats process disappearance/PID reuse as missing observations.
2. **HTTP SLO telemetry and safety gates:** recent completed HTTP 5xx ratio and approximate p95 latency per backend, bounded to 512 completions per backend and at most 1,024 backend histories. Traffic quality can block automatic scale-down. WebSockets remain part of connection accounting, but are not counted as HTTP completions.
3. **Operational interfaces:** authenticated `fleet metrics --prometheus`, `fleet doctor --live`, CLI status observations, JSON support, and a read-only live health reporter. No unauthenticated metrics endpoint is created.
4. **Durable metric observations:** validated, symlink-safe, owner-private snapshots stored at most once per 30 seconds, with bounded retention and an offline `fleet samples` CLI.

## File architecture

New:
- `src/portless/fleet-resources.ts`
- `src/portless/fleet-prometheus.ts`
- `src/portless/fleet-live-health.ts`
- `src/portless/fleet-metric-history.ts`
- Five focused regression-test modules

Updated:
- `src/portless/autoscale-policy.ts`, `fleet-autoscaler.ts`, `backend-connections.ts`, `proxy.ts`, `fleet-command.ts`
- `src/bin/parse-fleet.ts`, `src/bin/zerux.ts`, `src/index.ts`
- Package `README.md`

## Safety and correctness

CPU and memory modes explicitly require Linux and verified child PIDs. Bad samples fail closed (no scale decision) rather than being interpreted as zero. The resource monitor validates start timestamps and monotonic counters. HTTP completion history, metrics history, and CLI formatting remain bounded and validated. Explicit operator scaling continues to pause autoscaling.

## Verification scope

This section has isolated strict TypeScript validation, focused unit tests and real local proxy/CLI regressions. The full ProWorkspace build, distributed loads, macOS/Windows native test suites and high-volume load testing are not part of this section. The resource metric sampler measures direct child processes; descendant process trees and cgroup-aware resource accounting remain future work.
