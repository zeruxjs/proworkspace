# Section 13 — Coordinated proxy startup and restart

The `zsrv` proxy lifecycle now serializes startup and restart commands using a per-state-directory exclusive lock. Lock files contain a verifiable process identity and nonce and are written with owner-only permissions. Live owners are never displaced, malformed locks fail closed, and dead-owner locks can be recovered. Operation locks are released after success or failure.

The startup and restart functions share the same protected startup implementation, avoiding nested lock deadlocks. A competing command gets a clear failure rather than overwriting process state.

## Limitations

- The lock applies to the same proxy state directory; concurrent startup using *different* ports/state directories relies on the operating system's exclusive socket binding.
- The lock is local-filesystem coordination, not distributed coordination over network volumes.
- Identity lookup must be supported by the host OS; unknown identity fails closed.
- This is not zero-downtime restart and does not cover out-of-process supervisors.
