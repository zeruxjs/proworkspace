# Section 32 — ZeruxJS / ZyroJS integration and ZSRV cache controls

## Updated packages
- **zeruxjs:** modular protocol-registration facade wrapping ZSRV's built-in MCP, JSON-RPC 2.0, Connect, tRPC and SSE handlers; typed plugin/runtime entry points; outbound streaming and opt-in request-body streaming; explicit cache headers and conditional ETags; bounded per-app 1xx–5xx monitoring. The gateway preserves its localhost-by-default access policy. Static/private content remains uncached unless explicitly marked public.
- **zyrojs:** framework-neutral protocol client, Connect JSON framed-stream client, bounded SSE iterator, signal-driven remote resource and event channel, bounded LRU/TTL async query cache. Supports cancellation, timeouts, limits and lifecycle cleanup.
- **zsrv:** optional bounded public GET cache with TTL, route-generation isolation, LRU, invalidation, stats, CLI flags and safe post-cache compression. Exposes smaller `zsrv/protocols` entry to avoid eagerly loading ZSRV CLI dependencies.

## Safety rules
1. No automatic caching of authenticated, personalized, streamed, encoded, `Set-Cookie`, `Vary`, private, or unspecified-TTL responses by the proxy.
2. Protocol methods must be explicitly registered, and remote or forwarded callers must pass the configured authorization policy. Use authentication on exposed endpoints.
3. Streaming responses have `no-store, no-transform`, optional byte caps and abort-aware cleanup; oversized request bodies must opt into `meta.streamBody` to bypass the usual 1 MiB parser.
4. Response cache stores identity bytes only, compresses on delivery according to each client, and never decompresses or recompresses encoded upstream content.
5. Query caching is local and requires caller-selected TTL; it does not cache failed requests.

## Remaining boundaries
- No complete cross-process cache invalidation or distributed persistence; the proxy cache is in-memory and not shared between proxy workers.
- No general HTML-transform caching or content security policy engine.
- Native HTTP/3/WebTransport still require a real QUIC terminator; the application adapters do not implement them.
- Connect JSON framed streaming uses Fetch streaming upload support, which depends on browser runtime. Full Protobuf/gRPC clients are out of scope.
- Full workspace builds and native operating-system tests have not been performed; focused package tests are included.
