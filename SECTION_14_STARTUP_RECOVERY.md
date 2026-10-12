# Section 14 — ZSRV startup state recovery

`zsrv` now publishes startup state using per-file atomic temporary-file renames and synchronizes each temporary file before publishing. Publication checks for an existing live or unverifiable process marker and rejects takeover even when an endpoint probe fails. If publication fails, previously changed files are restored; the listener is closed and startup reports failure. The process marker is published last.

An application route is no longer registered if proxy startup or readiness fails.

## Limits

This is rollback for synchronous publication failure, **not an all-files atomic filesystem transaction**. A hard crash between renames may still leave mismatched state files; the operation lock protects participating startup commands, but clients outside the lock can observe partial metadata. Full crash-consistent journaling, directory fsync, and adversarial filesystem races remain future work.
