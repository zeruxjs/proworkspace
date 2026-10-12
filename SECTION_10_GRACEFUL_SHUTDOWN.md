# Section 10 — Graceful proxy shutdown

## Implemented

- `zsrv/src/portless/drain.ts`: reusable connection tracker with an idempotent asynchronous drain API, live connection counts, timeout validation, graceful listener shutdown, idle HTTP connection close, and forced socket termination after a configurable deadline.
- `zsrv/src/portless/proxy.ts`: attaches tracking to plain and TLS-wrapper proxies. Removes calls to `close()` on non-listening inner HTTP servers; the outer TCP wrapper owns the listening socket.
- `zsrv/src/portless/portless.ts`: SIGINT and SIGTERM handlers initiate a single bounded drain after successful startup; termination handlers are not installed for failed bind attempts.
- `zsrv/test/drain.test.mjs`: tests active request completion, idempotent drain, idle connection timeout and input validation.

## API

```ts
const server = createProxyServer(options);
server.listen(3000);
console.log(server.connectionTracker.activeConnections);
await server.connectionTracker.drain({ timeoutMs: 10_000 });
```

## Limitations

- The deadline forcibly closes still-active tunnels; that is intentional to avoid indefinite shutdown.
- This work does not implement automatic restarts, distributed coordination, or end-to-end HTTPS certificates testing.
- The original full workspace typecheck and build were not run. Focused tests were run against freshly transpiled source.
