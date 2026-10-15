# Section 77/85 — ZSRV gateway, protocols and rolling multi-instance serving

**Date:** 14 October 2026  
**Status:** Source hardening and local gateway/rolling acceptance delivered. **Production zero-downtime and clean-install certification remain OPEN.** ZSRV is a framework package; this work does not implement the later AIO infrastructure management application.

## Scope and changes

1. **Proxy trust boundary.** On HTTP/1.x and HTTP/2 upstream forwarding, ZSRV removes untrusted `Forwarded`, all `X-Forwarded-*`, `X-Real-IP`, `X-Client-IP`, `True-Client-IP`, and selected vendor proxy client-IP aliases before setting its own `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-Port` based on the actual inbound socket and validated authority. The hop-loop limit remains bounded. This policy intentionally treats the immediate peer as the client. **When behind a trusted Nginx/Envoy/Cloudflare terminator, configure real-IP trust and access control at that edge, or add a separately audited CIDR-allowlisted trust policy; do not pass unauthenticated headers through.** This is not PROXY protocol support.
2. **WebSocket handshake validation.** Upgrade tunnels are allowed only for `GET`, `Connection: Upgrade`, `Upgrade: websocket`, RFC 6455 version 13 and a 16-byte base64 Sec-WebSocket-Key. Malformed or unknown upgrades are answered with 400 before selecting/backpressuring a backend. Valid 101 responses retain subprotocol/extension headers and early frame bytes, and active tunnels continue to participate in backend draining.
3. **Bounded streamed uploads.** When a chunked body exceeds the configured `maxBodyBytes` *after* an upstream response began, the proxy aborts the partial response and upload instead of attempting a second status line. When headers have not been sent, it returns 413 as before. Existing cache/stream/backpressure semantics are preserved.
4. **HTTP/2 gRPC forwarding.** For TLS ALPN h2 requests, forward gRPC frames to the loopback h2c backend without conversion. Preserve the original validated virtual-host authority with `:authority`, remove HTTP/1-only Host, explicitly negotiate `te: trailers`, relay response trailers and record transport-level success/failure in the backend pool. HTTP/1 gRPC continues to receive 426. Backend application errors are not automatically labeled transport failures.
5. **Rolling pre-cutover health gate.** After the new child reports readiness, `preCutoverChecks` (1–20, default 1) additional health probes complete **before** the route lease is switched. The CLI exposes `--precutover-checks N`; existing `--verify-checks` remain post-cutover verification. Any pre-publication failure keeps the old child and route active. Post-publication failure attempts lease-protected rollback, and in-flight HTTP/WebSocket drain still respects configured deadlines. This reduces controlled-deploy faults; it cannot eliminate sudden failures between probes and real traffic.
6. **Regression and acceptance harness.** Added HTTP integration tests for forwarding spoofing, blocked non-WebSocket upgrades, bounded upload overflow after a started response, CLI option validation and a failed candidate never appearing in the traffic route. The existing TLS h2→h2c gRPC test now checks the backend's received `:authority`; existing protocol, fleet, backend, rolling and security suites remain intact.

## Protocol and capability matrix

| Protocol / behavior | Actual supported implementation | Production caveat |
| --- | --- | --- |
| HTTP/1.0, HTTP/1.1 | Native Node proxy to loopback HTTP backend | Reverse proxy must be hardened at deployment edge |
| TLS HTTP/2 | Node `http2.createSecureServer`, `allowHTTP1` fallback | Requires valid certificates, ALPN, secure key/SNI distribution |
| WebSocket | HTTP/1.1 Upgrade with streamed TCP tunnels | Long-lived tunnels end at drain deadline; client reconnect needed |
| SSE | Streaming and bounded app-local gateway `SseHub` | Timeout, reverse proxy buffering and reconnect strategy must be configured |
| gRPC | HTTP/2 framing/trailers to h2c loopback backend | Does not translate gRPC to JSON/HTTP/1 or implement arbitrary upstream TLS |
| Connect/tRPC/JSON-RPC/MCP | Existing registered app-local protocol gateway APIs | Authorization/origin checks and request-size limits are mandatory |
| br/gzip/deflate/zstd | Negotiated streaming compression; zstd only if Node/zlib supports it | Existing encoding and `no-transform` are preserved; no fabricated zstd capability |
| HTTP/3, QUIC, WebTransport | **External terminator only**; opt-in H3 Alt-Svc disclosure | No native Node QUIC/WebTransport server; validate terminator end-to-end |
| Cache | Opt-in bounded public-only representation cache | Not distributed; invalidation/tenant scope need production configuration |

## Local verification (not production certification)

Commands from `apps/proworkspace/packages/zsrv`:

```bash
# Local source modules affected by this section (with @types/node available):
# Type-check proxy.ts, grpc-forward.ts, proxy-headers.ts, rolling-app.ts,
# parse-rolling.ts using the package tsconfig options / noEmit.
node --test test/section77-gateway-security.test.mjs test/rolling-app.test.mjs test/protocol-gateway.test.mjs

# Wider self-contained suites; do not substitute this for the full ZSRV suite.
# These local CLI/dev suites require the unresolved external dependencies:
mapfile -t tests < <(find test -maxdepth 1 -name '*.test.mjs' | sort | grep -Ev '/(app-status-integration|app-supervision-integration|dev-injection-regression|fleet-cli|fleet-observability-cli|fleet-scale-cli|fleet-metrics|fleet-scale|rolling-cli-control|proxy-cli-options|cli-run-arguments|live-handler|fleet-parser-autoscale)\.test\.mjs$')
node --test --test-concurrency=6 "${tests[@]}"

# From apps/proworkspace:
node scripts/verify-source-workspace.mjs
node --test scripts/*.test.mjs
```

- **171 passed, 0 failed** in the selected 42 test files (ZSRV proxy, protocol, backend/fleet/rolling and related regressions). Includes 4 new Section 77 gateway tests, 1 additional pre-cutover rolling test and the strengthened preexisting gRPC authority assertion. No live Redis/cluster or external HTTP/3/QUIC terminator was available.
- **Targeted TypeScript no-emit check passed** for the five directly affected core modules using the package compiler options. Whole-ZSRV TypeScript build remains blocked by missing `chalk`, `ws`, and unbuilt `z-dev`/`zwatch` dependencies in the isolated ZIP. Emission with compiler diagnostics was used only to exercise affected local tests; this is not a clean build.
- **34 workspace tooling tests passed**; the source-only preflight passed **31 tests**, **42 contracts** and **1,563 isolated source files**, with **14 unresolved external npm dependencies** unchanged.
- An attempted all-files ZSRV test run could not certify the full suite: subprocess CLI/dev tests were unable to boot with missing packages, and the aggregate run was stopped after its timeout. The isolated 171-test result deliberately excludes those tests. Do not present it as 171/171 of *all* ZSRV tests.

## Operational release gates (must be completed on an integration host)

- Resolve Section 66's 14 missing lockfile resolutions, run registry-backed `npm ci`, `npm run build:verified`, **all** ZSRV tests including CLI/dev and cross-process fleet tests, and complete a fresh application boot from built packages.
- Verify TLS cert rotation/SNI, ALPN h2+HTTP/1 fallback, independent origin/protocol authorization, real IPv4/IPv6, full gRPC cancellation/errors/trailers, WebSocket reconnect, SSE drain/replay and optional public caching/compression under load.
- Run externally terminated HTTP/3/QUIC/WebTransport contract tests only with a real QUIC stack. Never advertise HTTP/3 unless the terminator is running, routing UDP and doing TLS correctly.
- Test controlled deploys under sustained HTTP/2 and WebSocket load with failures at every lifecycle boundary: startup, pre-cutover health, lease switch, post-cutover health, drain, old child termination, process kill, filesystem crash/recovery and rollback. Define and measure p95/p99, availability and drained-vs-forced counts. **No zero-5xx or zero-downtime production SLO is certified here.**
- Confirm reverse-proxy trusted-IP configuration, tenant/host routing, forwarded headers, TLS and idle timeouts, request rate/body admission, owner/lease reclamation and process identity across multiple machines; ZSRV currently uses local loopback backends and is not itself a multi-host L4 load balancer.

## Next section

**Section 78/85 — Frontend interoperability, React/Vue/Zyro bridges and accessibility.** Maintain the two-ZIP delivery rule and preserve all earlier package work.
