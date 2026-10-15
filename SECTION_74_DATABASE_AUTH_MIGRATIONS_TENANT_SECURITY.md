# Section 74/85 — Database, authentication, migrations and tenant security

**Package source implementation:** 14 October 2026. **External engine certification:** pending; see gates below. This work concerns reusable packages, not the separately managed AIO application.

## Delivered APIs

- `@zeruxjs/db`: `createTenantDatabaseFacade(base, { tenantId, tables, tenantColumn? })`. Explicit physical-table allowlisting; only select, insert, update and delete; tenant predicate is ANDed with all caller predicates; tenant keys are immutable; rejected cross-database routing, joins, unions and subqueries. No raw/native/schema query access is exposed. **This is an opt-in application data boundary**, not authentication: the server must derive `tenantId` from an authenticated, authorized principal and must never accept it directly from request JSON.
- `@zeruxjs/db`: `createDatabaseMigrationRunner(migrations, { transaction })`. Sorted version IDs, SHA-256 content checksums, drift and journal-prefix checks, `plan/status/apply/rollbackLast`, required asynchronous approval for rollback, a required **host-provided exclusive and real transaction boundary** (pinned connector AND journal). A JSON query array is not a transaction. MySQL DDL can implicitly commit; MongoDB requires appropriate replica-set/session transactions; these engines must not be passed an unaudited transaction wrapper and claimed to have atomic schema rollback.
- `@zeruxjs/db-sql-core`: strict runtime identifier, SQL function/operator/join/order/index-method/column type/size and limit validation; raw string CHECK removed from executable compilation; rejected inconsistent INSERT row structures and empty predicates; accurate PostgreSQL DML `affectedCount` including zero-row compare-and-swap. MySQL `INSERT ... RETURNING` is now rejected instead of silently ignored. SQLite AUTOINCREMENT and index dialect SQL handled explicitly. Values remain bound as parameters.
- `@zeruxjs/db-mongo`: unsupported schema changes no longer report success; index fields must be genuine named fields; unrecognized filter operators fail closed. Existing operator-key validation and unfiltered-write protection remain. No implicit cross-document transaction is claimed.
- `@zeruxjs/auth`: validated configurable users/groups/usermeta table and column identifiers; session cookie and lifetime validation before saving configuration; session identity checks; the organization ID `0` no longer accidentally drops the role scope. `hasTenantPermission` / `requireTenantPermission` enforce **explicit** permission + exact tenant, optionally site scope (no implicit wildcard). On MySQL set `setAuthConfig({db:{supportsReturning:false}})` to use driver-reported insert IDs rather than unsupported RETURNING.
- `@zeruxjs/db-sqlite`: `createSqliteConsistentBackup(nativeDb, absoluteDestination)` uses Node SQLite online backup API, checks the snapshot integrity and refuses to overwrite existing paths. A test copies a verified backup to a **new, offline** database and verifies restored contents. Backup copies still need encryption, retention policy, private directory permissions and disaster recovery rehearsal in real deployments.

## Example: scope the trusted database facade

```ts
import { createTenantDatabaseFacade } from '@zeruxjs/db';
import { requireTenantPermission } from '@zeruxjs/auth';

// principal was obtained from an already validated/revocation-checked session;
// tenant and site are NOT taken from client request parameters.
requireTenantPermission(principal, { tenantId: principal.tenantId, siteId, permission:'email:read' });
const inbox = createTenantDatabaseFacade(manager.getConnectionFacade('main'), {
  tenantId: principal.tenantId,
  tables: { messages:'email_inbox_messages' },
  tenantColumn: 'tenant_id'
});
const page = await inbox.select({ table:'messages', limit:25, offset:0 });
```

Important: tenant-aware facades are **not substituted automatically** into existing Email, Files, Analytics, Reports or Queue code. Each host must integrate the principal→tenant authorization boundary, use the proper scoped stores, preserve role/CSRF checks, and test tenant isolation across those modules. Existing unmanaged native SQL, arbitrary collection pipelines and direct connector access bypass this opt-in wrapper.

## Example: migration transaction contract

```ts
import { createDatabaseMigrationRunner } from '@zeruxjs/db';

const runner = createDatabaseMigrationRunner([
  { id: '2026101401_add_visits',
    up: [{ op:'createTable', table:'visits', columns:[{name:'id',type:'integer',primary:true}] }],
    down: [{ op:'dropTable', table:'visits' }] }
], {
  transaction: async (executeExclusively) => {
    // REQUIRED HOST IMPLEMENTATION: obtain distributed/exclusive lock and
    // a real transaction-pinned facade + journal on the SAME session/connection;
    // COMMIT if everything succeeds, else ROLLBACK. Do not fake this contract.
    return await hostMigrationTransaction(executeExclusively);
  }
});
console.log(runner.plan());
await runner.apply();
// Rollback only after a tested backup, explicit privileged approval and service coordination:
await runner.rollbackLast(async id => await administratorApproved(id));
```

A migration's `up`/`down` operations must be pre-reviewed privileged code, **not** generated from untrusted HTTP payloads. For multi-engine changes, `transaction` must guarantee journal atomicity and exclusive serialization; if the engine cannot provide that guarantee, write a separately audited engine-specific procedure. Never treat arbitrary SQL schema DDL on MySQL as automatically rollbackable.

## Local verification and engine parity

From `apps/proworkspace`, build the target packages with the workspace build command in a network-enabled clean install, then run:

```
node --test tests/section74-database-engine-parity.test.mjs
```

By default this exercises real Node SQLite and explicitly skips other engines. Set these optional environment variables to test real services on **isolated disposable test databases only**:

- `ZX_TEST_PG_URL`: PostgreSQL test connection URL.
- `ZX_TEST_MYSQL_HOST`, `ZX_TEST_MYSQL_PORT`, `ZX_TEST_MYSQL_USER`, `ZX_TEST_MYSQL_PASSWORD`, `ZX_TEST_MYSQL_DB`: test MySQL connection.
- `ZX_TEST_MONGO_URI`, `ZX_TEST_MONGO_DB`: test MongoDB replica/standalone test database with an installed `mongodb` peer dependency.

The parity test creates and drops a uniquely named **test** table/collection; CRUD and affected-row counts must agree. It does **not** by itself certify real-engine transactions, migrations, pool failover or TLS/connection exhaustion. A cross-service suite must further exercise Email, Analytics, Queue and Files under tenant principals.

Focused suites: `@zeruxjs/db`, `db-sql-core`, `db-sqlite`, `db-mongo`, `auth`, `security`. A SQLite test uses two independent connections to validate tenant data separation, and another checks transactional migration failure rollback and checksum drift. Separate SQLite WAL backup/restore tests exercise native snapshots.

## Outstanding qualification / limitations

- External `pg`, `mysql2` and `mongodb` servers and drivers are not available for live parity, real session-pinned transaction migration, or pool failure/timeout certification here.
- Existing Section 66 lockfile deficiency (14 unresolved external packages), clean install, complete all-workspace build and CodeQL still need network-enabled execution.
- The existing session/API-token registries remain in-process unless the host supplies durable shared revocation/issuance storage. Require secure env secrets, session key rotation, provider ID token verification, actual WebAuthn verification, MFA replay control and live auth integration before production.
- A malicious/compromised database owner or application-level native connection is not isolated by the JSON tenant wrapper. Apply least-privilege DB roles, row-level policies where available, separate secrets, backups and an independently tested permission matrix.

**Next package Section 75:** Redis cache namespace isolation and distributed queue/scheduler certification.
