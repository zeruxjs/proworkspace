# Section 30 — ZSRV consolidation

This section consolidates the security, dev-server and production behavior of the
ZSRV package instead of extending fleet controls one small feature at a time.

## Implemented

- Bind management proxy to loopback by default, explicit numeric bind override
- Explicit trust-store changes; no implicit CA installation at proxy startup
- TLS-only default on a TLS port; opt-in backward-compatible plaintext fallback
- RFC hop-by-hop header filtering, including `Connection`-nominated header names
- HTTPS custom TLD certificate coverage and exact-hostname SNI validation
- Bounded concurrent/on-disk-hostname certificate generation and context cache
- Symlink checks in the hostname certificate directory
- Fail-closed hosts-file modification and validation of managed DNS names
- Modular dev-server entry point and bounded HTML response buffering
- Reliable error propagation at dev startup, loopback application binding
- Serialized watcher reloads, watcher disposal, and bounded shutdown
- WebSocket message limits for dev sockets
- Cgroup v1/v2 CPU and memory limit diagnostics
- Focused security, integration and regression test coverage

## Remaining qualification

Production certification still requires deployment-specific validation of TLS
trust behavior, network access controls, macOS/Windows process handling,
external dependency installations, load testing, full workspace build, and
cross-host distributed control. These are not represented as completed here.

ZSRV feature development should now be deprioritized relative to the unfinished
other ZeruxJS/ZyroJS packages unless concrete ZSRV errors arise.

## Additional workload safeguards

- Bounded per-client token-bucket request admission
- Global concurrent HTTP/WebSocket request limit
- Request-body size checks for declared and chunked uploads
- Strict `proxy start` CLI flags and early validation
- Tests for rate enforcement, overloaded requests, chunked oversize uploads,
  duplicate CLI flags, and invalid bind addresses
