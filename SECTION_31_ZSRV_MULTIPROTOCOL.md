# Section 31 — ZSRV integrated protocol gateway

This section moves the old `@zeruxjs/mcp` implementation into `zsrv` and expands
transport handling without introducing fake HTTP/3 capabilities. The old
package directory and workspace-lock references have been removed.

## Implemented

- Modular `src/protocols/mcp` tool/resource registries and stateless MCP core over
  HTTP POST, with origin/auth checks and bounded JSON requests.
- JSON-RPC 2.0 method registry, batches, notifications, and safe errors.
- SSE event hub with bounded subscribers/history, heartbeats, event IDs and replay.
- Connect unary JSON and framed JSON streaming subset, plus a small tRPC-style
  JSON procedure bridge.
- Framed gRPC request/response forwarding from HTTP/2 to local h2c backends.
- WebTransport router abstraction for **external QUIC** session providers.
- Accurate transport capabilities and validated `Alt-Svc` advertisement for
  **already running external HTTP/3** terminators.
- Proxy-wide and per-application HTTP status distribution, recent request rate,
  latency, active request/connection count, and optional Linux worker usage.
- Focused end-to-end protocol tests, including TLS+ALPN HTTP/2 and gRPC framing.

## Compatibility and migration

Replace imports:

```diff
- import { createMcpServer, ToolRegistry } from '@zeruxjs/mcp';
+ import { createMcpServer, ToolRegistry, createProtocolGateway } from 'zsrv';
```

Pass `protocols: createProtocolGateway({ mcp })` when creating the proxy.
Existing ordinary HTTP/WebSocket route functions remain available.
The gateway has reserved endpoints (`/mcp`, `/rpc`, `/events`, `/trpc/*`, and
registered Connect procedure paths); use a gateway on a dedicated listener or
hostname when endpoint collisions are possible.

## Production scope and limitations

This is **not a claim of complete RFC/protocol compliance**. The built-in MCP
server covers common tools and resources but not the entire current MCP
specification; Connect/tRPC bridges are subsets, and unsupported codecs should
be handled by the official upstream SDKs. gRPC support is streaming HTTP/2
wire forwarding to h2c, not a general gRPC-to-REST transcoder or protobuf
compiler. QUIC, HTTP/3 and WebTransport have no native Node HTTP-server support
in this runtime and require a separate compatible QUIC terminator. Do not
advertise HTTP/3 until the terminator is operating.

MCP tools must independently authorize sensitive actions. The protocol gateway
allows local requests by default and validates browser Origin, but reverse
proxies and public deployments must supply explicit authentication/authorization
and secure trusted-proxy policy. SSE and streamed Connect requests may remain
open and count against connection limits; tune limits accordingly.

## Validation

Focused strict TS compilation and HTTP protocol integration tests are performed
in the isolated ZSRV package. The complete ProWorkspace integration build is
not part of this pass.

### Streaming compression

HTTP forwarding also supports content-negotiated streaming Brotli, gzip,
deflate and conditional Zstandard compression (`ProxyServerOptions.compression`).
Encoded upstream payloads are passed through without double compression,
and SSE, gRPC, Connect, range and no-transform payloads are left alone.
Client `Accept-Encoding` quality values are respected; HTTP response caches
receive `Vary: Accept-Encoding` when relevant. Compression can be disabled
when an edge server such as Nginx or Caddy already handles it.
