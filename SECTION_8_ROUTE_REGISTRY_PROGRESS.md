# Section 8 — zsrv route registry reliability

## Implemented
- Validates newly registered hostname, port and PID before acquiring a lock or writing state.
- Rejects invalid stored route entries when loading JSON.
- Persists route changes using unique same-directory temporary files, file sync and atomic rename.
- Attempts directory sync where supported; cleans up temporary files on failure.
- Tracks acquired lock inode/device so releasing a lock cannot delete a replaced lock directory.
- Uses nonrecursive removal when reclaiming stale locks.
- Treats EPERM while probing PIDs as an existing process instead of declaring it stale.
- Added on-disk registry tests and an HTTP proxy integration test.

## Validation
- 7 focused Node tests passed, including request-security tests, route persistence and local proxy forwarding.
- Production workspace build / full typecheck not run. Temporary compiled dist files used only for the tests and excluded from the archives.

## Remaining work
- Distributed/multi-host coordination is not included; the state store is local disk based.
- Stale-lock recovery is based on age rather than a renewable lease.
- HTTPS/WebSocket and lifecycle integration tests still require additional coverage.
