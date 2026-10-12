# Section 11 — Process identity and safe shutdown

The proxy no longer uses a bare numeric PID marker for stopping a server. It writes a structured, atomically replaced marker containing a random nonce and the Linux kernel process start time. Before signaling a process, the stop command verifies its identity, checks the expected proxy endpoint, and rechecks identity after the network check. It waits for process exit before clearing the owned marker, leaving it intact after a timeout. Stale markers are removed only when their contents remain unchanged.

Legacy numeric markers are not trusted for signaling; restart a legacy proxy manually before using the new stop command. The identity mechanism intentionally fails closed on systems without Linux `/proc`, so supported non-Linux process identity providers remain follow-up work. The endpoint verification remains a liveness check, not cryptographic authentication; privileged users and shared writable state directories require separate trust controls.

Focused tests cover marker validation, atomic writing, stale markers, legacy refusal, and termination of an identified child process. Full workspace validation was not performed.
