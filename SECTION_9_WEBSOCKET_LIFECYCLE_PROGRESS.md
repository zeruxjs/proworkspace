# Section 9: WebSocket tunneling and process lifecycle

## Delivered
- WebSocket upgrade `head` bytes are sent to the upstream tunnel **after** the 101 handshake, rather than mistakenly as an HTTP request body.
- Bi-directional tunnel close/error propagation and explicit not-found upgrade response.
- Idle initial TLS/HTTP detection connections time out after ten seconds.
- Strict PID parsing, process existence handling and marker-ownership-aware removal.
- CLI stop refuses to terminate itself, a malformed PID or a live PID without a responding proxy.
- New focused regression tests for WebSocket echo and lifecycle utilities.

## Validation
- Four focused tests passed (two lifecycle, one HTTP proxy, one WebSocket integration).
- Changed TypeScript modules transpiled with the installed TypeScript compiler.
- Full workspace build/typecheck not run; extracted project does not contain Node type packages.

## Caveats
- `portlessStop` relies on a proxy health probe and PID file, not verified OS process identity; use trusted private state directories.
- This pass does not implement distributed proxy coordination, full connection draining, or HTTP/2 WebSocket extended CONNECT.
