# Section 35 — Database, MongoDB, Auth and Security

## Scope

Deepened four ZeruxJS packages while preserving existing public entry points and keeping new capabilities in dedicated modules.

### Database manager (`@zeruxjs/db`)
- Managers now have `await manager.disconnect()` with repeated-call safety. The manager refuses work after closure.
- Connector initialization cleans up earlier connectors in reverse order after a failed connection.
- Package-based connector resolution rejects path/URL specifiers and avoids masking errors raised *inside* a resolved connector module.
- Dependent-query path lookups cannot access inherited/prototype properties.
- JSON input is bounded (8 MiB / depth 64) and rejects undefined, nonfinite numbers and dangerous object property names.
- Connection summaries redact URI/DSN, passwords, nested credentials and native clients.

### MongoDB (`@zeruxjs/db-mongo`)
- Split `index.ts` into `connector.ts` and `query.ts` with public exports.
- Optional native `mongodb` driver when a URI is supplied; injected driver clients are not owned or disconnected by the connector.
- Query selector/document-key validation, nesting limits, explicit unfiltered-write opt-in.
- Ordinary selects execute through `find()` cursors; advanced joins, groups and unions require aggregation.
- Missing driver features error rather than silently returning empty results for important read/write/schema operations.
- Document operators and collection identifiers are validated; SELECT offsets/limits are bounded.

### Authentication (`@zeruxjs/auth`)
- Existing auth DB, session, password, OTP and challenge APIs preserved in `core.ts`.
- Password size/format checks and mandatory production pepper; independent strength policy.
- Session tokens carry random identifiers for external revocation stores; prevent payload override of protected fields.
- RFC 6238 TOTP and otpauth provisioning URI; random secret generation.
- Scoped, expiring hashed API/reset tokens with revocation; optional session revocation registry.
- OAuth 2.0 PKCE authorization URL/state creation with redirect allowlist.

### Security (`@zeruxjs/security`)
- Session-bound HMAC CSRF tokens with expiry and same-origin comparison.
- Explicit allowlist CORS evaluation for simple and preflight requests.
- Security headers, validation of CSP nonce/sources, cookie serialization with secure prefixes.
- Bounded in-process rate limiter that fails closed when exhausted; path-traversal checks improved for Windows paths.

## Validation

- Four isolated TypeScript builds passed using temporary Node typings available in the container.
- 16 focused runtime tests passed (3 DB, 4 Mongo, 5 Auth, 4 Security).
- Mongo and DB tests use mock/injected drivers rather than a running external MongoDB service.
- Full workspace build, native authentication provider workflows, distributed storage tests and external database integration were not run.

## Production considerations

This is an implementation section, not a claim of complete production certification. Auth token/session revocation stores and the rate limiter are in-memory and require shared persistent backends for multi-server deployments. Verify real database drivers, WebAuthn attestation/assertions, OAuth token exchange/ID-token validation, OTP replay protection, permission enforcement and migration behavior before deployment. SQL query arrays are not implicit transactions. Mongo's SQL-like join/group mapping remains intentionally constrained.

Tests can be run from each package using `npm test` once workspace dependencies and Node type packages are installed.
