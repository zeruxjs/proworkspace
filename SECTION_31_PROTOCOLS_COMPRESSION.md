# Section 31 — Integrated Protocols, HTTP Versions, Telemetry and Compression

## Implemented

- Moved `@zeruxjs/mcp` source into modular `zsrv/src/protocols/mcp/*` and removed the old package.
- Registered MCP tool/resource handler, local JSON-RPC 2.0, Connect unary JSON, bounded Connect framed JSON streaming, lightweight tRPC-style procedure bridge, and SSE hub with bounded clients and replay.
- HTTP/1.0, HTTP/1.1, HTTPS+HTTP/2 via TLS ALPN, HTTP/1.1 WebSocket upgrades, and HTTP/2 gRPC stream forwarding to h2c upstreams.
- Transport capability discovery and opt-in `Alt-Svc: h3` advertisement **only when a real external HTTP/3 QUIC terminator is configured**. External WebTransport sessions may be dispatched into registered handlers. Native HTTP/3, QUIC and WebTransport servers are not provided by Node's standard HTTP/2 APIs.
- Bounded per-host and outside-route telemetry showing active requests, 1xx–5xx status families, individual status counts, incoming HTTP versions and response latency.
- Streaming response compression for Brotli, gzip, deflate, and runtime-supported Zstandard, with proper Accept-Encoding negotiation, Vary, conservative MIME filtering, cache-validator cleanup, no-transform/SSE/range exclusions and upstream encoded-body pass-through.
- Strict protocol request size, default local access and explicit authorization for front-proxied protocol calls; closes protocol streams during shutdown.

## Limits and next integration

- HTTP/3/WebTransport require an external QUIC termination layer; `Alt-Svc` does not create a QUIC listener. Full Connect RPC binary/protobuf, gRPC bidirectional app adapters, and upstream native h2 require application-specific plumbing beyond the JSON subset.
- Native Zstandard encoder is experimental on Node 22.15+/23.8+. Unsupported runtimes skip this choice.
- Do not publish /mcp, /rpc and /events openly; enable an explicit trusted authorization callback and configure the external proxy accordingly.
- Next development phase: adapt ZeruxJS and ZyroJS app registration and route APIs to these transport and compression capabilities.
