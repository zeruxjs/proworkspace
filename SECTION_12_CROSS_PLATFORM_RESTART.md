# Section 12 — Cross-platform process identity and restart

- `zsrv` now obtains a process creation fingerprint on Linux, macOS (`ps`) and Windows (PowerShell/CIM). It never falls back to PID-only signaling if lookup fails.
- Marker validation recognizes platform-specific creation fingerprints without relaxing nonce or PID checks.
- Shutdown wait/poll parameters are validated **before** `SIGTERM`, preventing malformed options from causing an unexpected signal.
- `portlessRestart()` and `zerux-server proxy restart` stop an identified process before starting a new listener; restart refuses to proceed if the existing process cannot be verified or stopped.

## Limits

macOS and Windows identity lookup has not been executed on those operating systems. Non-Linux process signals/permissions and endpoint readiness still need native CI coverage. Restart is sequential (not zero-downtime), and cross-process concurrent restarts are not serialized yet.
