# Section 17 — Application route ownership and registry safety

## Scope

- Added revocable route leases with unique IDs, preserving the legacy `addRoute()` API and file format.
- Updated `portlessRun()` to release only its own registration at process cleanup, and to release on synchronous spawn errors.
- Converted route-lock acquisition into a separate `route-lock.ts` module with verifiable process identity and safe release.
- Hardened registry mutations against corrupt JSON, invalid/duplicated records, oversized files, and symlinked paths.
- Improved alias collision behavior: permanent aliases cannot be silently overwritten without `--force`.
- Fixed a TypeScript narrowing error in the Section 16 committed-state decoder discovered by the focused package compile.
- Exposed portless and route-management APIs through the `zsrv` package entry point.

## Behavior and compatibility

Existing `addRoute()` entries still use `{hostname, port, pid}`. Entries created
through `registerRoute()` additionally contain a `leaseId` UUID. The `release()`
method removes the entry only if the current registry still has the matching
hostname and UUID. Legacy consumers that parse route files should ignore extra
fields; consumers that use a strict fixed schema may require updates.

The old route lock was an ownerless directory deleted after 10 seconds.
New locks include `routes.lock/owner.json`. Ownerless or unverifiable locks are
not forcibly removed and require operator attention. Never manually remove a
lock while another process may be mutating the registry.

## Verification

- Focused TypeScript check for all `src/portless` modules passed with local Node types.
- `node --test test/*.test.mjs`: 46 tests passed on Linux.
- No complete workspace build, macOS/Windows suite, or deployment test was run.

## Remaining scope

End-to-end CLI process supervision; secure shared multi-user proxy state and
permissions; route owner identity after abrupt process termination; and native
cross-platform lock testing still need more work.
