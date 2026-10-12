# Section 16 — Coherent startup-state publication and reading

## Implemented

- Added a versioned, atomically replaced `proxy.state.json` commit record (port, TLS, TLD, process marker).
- Extended the write-ahead journal transaction to cover this committed record, publishing it *after* compatibility files.
- Readers now reject pending transactions rather than accidentally merging new port settings with old TLS/TLD values.
- Proxy discovery reads each directory once from a consistent state view; compatibility accessors use that same parser.
- Lifecycle discovery can recover a stranded journal while holding the correct operation lock; stop now participates in the same lock as restart.
- Preserved strict legacy parsing for deployments without the new commit record; migrated older four-key journals remain recoverable.
- Protected live owners recorded in the canonical state, even when the legacy PID marker was removed.
- Startup now invokes pending-journal recovery under the correct candidate-port directory lock before probing and publishing.
- Aligned startup locking with candidate state directories during privileged HTTPS port fallback.
- Added focused runtime tests for publication, journal boundaries, legacy migration, invalid records and discovery.

## Safety and compatibility

- Journal recovery requires the existing operation lock; it refuses unknown owner identity and conflicting changes.
- Modern clients should read the committed record, not individual compatibility files.
- Legacy installations are upgraded on their next successful startup, but uncoordinated third-party readers may continue to see mixed legacy files during migration.
- Multiple state files are not one filesystem transaction; the committed record is the authority and the journal enforces the recovery boundary.

## Out of scope

- Full OS/crash-consistency certification; Windows/macOS filesystem and process identity tests.
- A distributed state store or multi-host coordination.
- Whole-workspace build/lint/typecheck.
