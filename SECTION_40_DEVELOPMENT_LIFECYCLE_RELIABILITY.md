# Section 40 — Dev/watch/runtime reliability

## Scope

This update spans `zwatch`, `z-dev`, `zeruxjs`, and `zsrv`. It focuses on **maintaining a live development application while source files are changing**, safe local state files, watcher isolation and worker cleanup. It is not a production deployment change.

### Watcher (`zwatch`)

* New `watchDirectory(root, onEvent, options)` returns `{ ready, flush, close }`. Existing `startWatcher()` continues returning an unsubscribe function.
* Watchers are shared by root, but every subscription has independent path filters. Filtering scans by *all* subscribers was previously incorrect: files seen by one listener could disappear for the others.
* Take one initial snapshot before emitting change events; never treat existing files as freshly added on subscription.
* Native recursive notifications, where supported, accelerate changes; periodic scans still detect missed notifications. Scans are serialized and `flush()` can force a deterministic scan for tests/tools.
* Ignore common generated folders; never follow symlinks while scanning. Exclusions apply to descendants. Subscriber callbacks and errors are isolated.
* Close the underlying watcher and polling timer when the last subscriber unsubscribes.

```ts
import { watchDirectory } from 'zwatch';
const watcher = watchDirectory(process.cwd(), ({ file, type }) => console.log(file, type), {
  ignored: relative => relative === '.zerux' || relative.startsWith('.zerux/'),
  pollIntervalMs: 2000,
  onError: console.error
});
await watcher.ready;
await watcher.flush();  // can be used for deterministic reconciliation
watcher.close();
```

### Development server (`z-dev`)

* Development-server HTTP listener binds to `127.0.0.1` by default, not `0.0.0.0`. Explicit `ZDEV_BIND_HOST` overrides this for **deliberate** remote development deployments. If exposed remotely, configure trusted reverse-proxy authentication, IP restrictions and TLS; the devtools interface must not be assumed safe for the public Internet.
* Internal `POST /__<service>/events` requires a loopback remote address, an existing registered app and the matching service name. Outbound event publishing has a 3-second timeout.
* Registry and snapshot files use 4 MiB limits, atomic replacement and `0600` permissions, and refuse symlink targets. Malformed files fail closed rather than being silently overwritten.
* Log tail inspection reads at most the final 256 KiB of a log file and refuses non-regular files.
* HTML client injection uses JavaScript string serialization with HTML script-boundary escaping. It is idempotent and handles case-insensitive closing body tags.
* Saved snapshot responses expose the last hot-reload attempt status and error.

### Application runtime (`zeruxjs`)

* `createHotRuntime` stages each next generation and activates it only after preparation succeeds. It serializes rebuilds and retains the previous live generation if the next bootstrap, worker initialization or manifest write fails.
* On successful activation, dispose previous workers and close previous protocol handlers. A failed old-generation cleanup does not roll back already active requests.
* Worker initialization now rolls back already-started workers and pools if a later startup hook fails.
* Pending thread-worker tasks are rejected on pool shutdown, with timeouts cleared, rather than hanging indefinitely.
* `runtime.json` and `dev.json` are written atomically with bounded/private metadata. They reject malformed or linked existing files. Hot-reload status is persisted for the devtools UI.

### ZSRV integration

* The development listener **remains open** across reloads. The new `createLiveRequestHandler()` pins each HTTP request to the generation active when that request began.
* Only switch handlers after `watchFunc` succeeds. Failed rebuilds leave the previous listener and request handler in place, instead of closing the app port and failing to reopen it.
* Existing WebSocket server objects are not recreated on reload. Native HTTP/3 / distributed deployment behavior is outside this pass.

## Validation

* Watcher: new and previous tests (initial snapshot, shared root with separate ignores, nested exclusions, explicit scan, symlink rejection, callback isolation, disposal).
* Devtools: HTTP request-limit tests, atomic state/symlink tests, bounded log tail, injection escaping and idempotence.
* ZeruxJS: three hot-runtime tests, rollback and pending-task cleanup tests, metadata persistence tests.
* ZSRV: live in-flight handler swap and failure isolation using a real HTTP server.
* Isolated builds for `zwatch` and `z-dev` passed. Focused changed modules passed TypeScript checks. A full monorepo build was not performed; dependencies needed for that are absent in the extracted archive.

## Known limits

* Filesystem change polling is still not a distributed watcher; this package does not guarantee that every intermediate state of a rapidly edited file is delivered.
* The dev runtime hot swap is process-local; it does not persist worker heaps or websocket sessions across full process restarts.
* A generation's workers may overlap briefly during staged startup; plugins using exclusive locks/ports need a coordinated handover contract.
* Exposing devtools beyond the local machine requires additional authentication; setting `ZDEV_BIND_HOST=0.0.0.0` alone is unsafe.
* The runtime manifest is not a durable transaction spanning every application service; failed filesystem writes can leave earlier successfully written metadata unchanged.
