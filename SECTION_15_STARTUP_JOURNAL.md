# Section 15 — Crash-recoverable proxy startup journal

`zsrv` now uses a write-ahead journal (`.proxy-startup-journal.json`) when publishing its startup metadata. This provides recovery after process interruption between updates of `proxy.port`, `proxy.tls`, `proxy.tld` and `proxy.pid`.

## Behavior

- The operation lock must be held by callers throughout publication and recovery.
- Before changing any state files, an atomic, fsynced journal stores both the previous and intended states. Writes are done through temporary files and rename; directory fsync is attempted where supported.
- After all four files are written, the journal is removed. The owner PID marker is written last.
- The next startup detects an interrupted journal and restores prior values only when each file still equals either its recorded previous or intended value.
- Recovery fails closed when a marker belongs to a live or unverifiable process, the journal is corrupted, or third-party state changes have occurred. Inspect these cases manually; never forcibly remove a live process marker.
- Normal failed publications roll back and clear the journal when rollback succeeds; failed rollback leaves the journal for investigation.

## Limitations

This is journal-based recovery for the four startup metadata files, not a single atomic multi-file transaction. Concurrent readers may observe intermediate values, and platform-specific filesystem durability guarantees vary. Native cross-platform crash and power-failure testing, reader-side coherent snapshots and lock integration audits remain for later sections.

## Focused validation

`node --test test/startup-journal.test.mjs test/startup-state.test.mjs` after compiling package sources. Nine focused checks passed in this section.
