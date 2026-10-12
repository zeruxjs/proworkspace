# Section 23 — Rolling CLI, cross-process draining and deployment history

## Delivered

- `rolling run`, `deploy`, `stop`, `status`, and `history` CLI subcommands; strict
  flags separated from the child command, and a bounded 2–16 port pool.
- Authenticated loopback-only local RPC using a per-process random secret in a
  per-user private descriptor, with PID start-time verification and size limits.
- Proxy-side RPC exposes only a bounded wait for actual backend connection
  counts, including WebSocket tunnels, so a CLI in a separate process does not
  create and trust an empty tracker.
- Persistent, atomic, private snapshots and a bounded history of the last 50
  deployment events per app; failed deployments and drain deadlines recorded.
- Offline-aware `status` output, API exports and usage documentation.
- Runtime test with a proxy, a CLI-owned application and a deploy command in
  separate processes; verifies in-flight request survival during handover,
  history, generation transition and route withdrawal on stop.

## Boundaries

- The deployed command must implement a healthy local HTTP endpoint; it is
  executed as a *trusted* application under the launching user's privileges.
- Connection draining is process-local to a single updated proxy, reached over
  its verified loopback control channel; not a multi-node or zero-risk handover.
- A drain deadline can still interrupt long-lived sessions; this is reported.
- Restart after unexpected supervisor termination does not automatically adopt
  orphan children. Long-term pruning of historical host records is not included.
- Full workspace typecheck, platform-specific native verification and large
  production workloads were not run.
