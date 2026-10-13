# Section 67 — Inbound email mailbox isolation and protocol hardening

**Status: source changes and offline regression coverage implemented; live protocol acceptance gate OPEN.**

This section extends the Section 63–65 IMAP/POP3 receiver without changing the original receiving modes. The package still supports:

1. `mode:'json'` — no ZeruxJS table; parsed JSON and application-owned callback/storage;
2. `mode:'persist'` with `createDatabaseInboxStore(db)` — lazily creates package-owned `zerux_email_inbox`, unique message IDs and paginated reads;
3. `mode:'persist'` with `createMappedDatabaseInboxStore(db,{table,columns,createTable:false})` — writes application-owned schema without DDL. Alternatively inject a custom `InboundStore`.

No inbound feature auto-deletes messages on IMAP/POP3 servers. The existing sender, marketing-consent and independently configured tracking systems are unchanged.

## Improvements implemented

- **Folder allowlists:** `IncomingAccount.mailboxes` accepts up to 100 additional configured IMAP folder paths. `receiver.poll(account,{mailbox})` rejects any unconfigured folder. `receiver.pollConfiguredMailboxes()` iterates the explicitly configured folders (and POP3 account single inbox). Plain `receiver.poll()` and `receiver.pollAll()` retain their previous default-folder behavior.
- **Bound folder cursors:** New IMAP cursors include `mailbox` alongside `uidValidity` and `afterUid`. A cursor returned for one folder cannot be supplied to another folder. Older cursors without `mailbox` remain accepted only for the account's configured default folder; applications switching a default folder must reset the cursor deliberately.
- **Durable worker folder isolation:** `createDatabaseMailboxSync({id,account,mailbox,db,receiver})` gives each explicitly configured folder its own lease, fencing epoch and database checkpoint; the old unscoped checkpoint key remains unchanged for backwards compatibility. The coordinator verifies the returned folder and rejects cross-folder progress.
- **IMAP UID bounds:** Validates the 32-bit UID range, refuses invalid remote message IDs before flag changes, and avoids invalid `4294967296` UID range queries when a cursor is at the protocol limit.
- **Safer incoming MIME:** Rejects corrupt parser/attachment structures, fractional or negative declared attachment sizes, and unbounded external-parser attachment bytes. Oversized attachments are represented with `contentOmitted`, never submitted to scanner/storage callbacks or base64 output.
- **POP3 UIDL validation:** Rejects duplicate message numbers/UIDLs and CR/LF/NUL contamination *before* invoking `RETR`. `QUIT` is still sent on failure; no remote `DELE` is ever issued by normal receiving.
- **Custom inbox authorization:** `createInboxApi().poll(account,mailbox?)` includes the requested mailbox in the host authorization context. Denial happens before connecting to the remote IMAP server.
- **Opt-in live smoke tests:** `packages/@zeruxjs/email/test/inbound-live-optional.test.mjs` uses only TLS `verify()` and IMAP folder discovery. It never modifies flags, sends messages, returns message content or deletes remote mail.

### Example: separate folder checkpoints

```ts
const receiver = createEmailReceiver({
  accounts:[{
    name:'support',protocol:'imap',host:'imap.example.com',
    auth:{user:process.env.IMAP_USER!,password:process.env.IMAP_PASSWORD!},
    mailbox:'INBOX',mailboxes:['Archive','Support/2026']
  }],
  store:createDatabaseInboxStore(db),
  mode:'persist'
});

const inboxSync = createDatabaseMailboxSync({
  id:'support-receiver',account:'support',mailbox:'INBOX',db,receiver
});
const archiveSync = createDatabaseMailboxSync({
  id:'support-receiver',account:'support',mailbox:'Archive',db,receiver
});
await inboxSync.runOnce('node-a');
await archiveSync.runOnce('node-b');

// Or request parsed JSON from a single configured folder directly:
const page = await receiver.poll('support',{
  mailbox:'Archive',cursor:{afterUid:0,mailbox:'Archive'}
});
```

The checkpoint and inbox stores require a shared database connector supporting unique inserts, atomic version-checked CAS updates and affected-row counts. The two folders above use distinct durable lease rows. `pollConfiguredMailboxes()` by itself **does not persist cursors**; use one named durable mailbox-sync job per folder for production workers.

### Private API example

```ts
const inbox = createInboxApi({
  store,receiver,
  authorize: async ({account,operation,mailbox}) => {
    // Resolve the host request's authenticated user and permissions.
    return await canAccessMailAccountAndFolder(account,operation,mailbox);
  }
});
await inbox.poll('support','Archive');
```

The permissions callback must enforce tenant- and user-level isolation. Listing/searching the saved inbox are already account-scoped and must not be directly exposed as public HTTP APIs. SMTP credentials are never included in result payloads.

## Live integration acceptance

For a **test** inbox/POP3 account whose credentials are authorized for integration tests, install dependencies with npm access and run:

```bash
cd apps/proworkspace
npm ci
npm run build -w @zeruxjs/email
ZERUX_TEST_LIVE_INBOUND=1 \
ZERUX_TEST_IMAP_HOST=imap.example.test \
ZERUX_TEST_IMAP_USER=test-user \
ZERUX_TEST_IMAP_PASSWORD='example-only' \
ZERUX_TEST_POP3_HOST=pop.example.test \
ZERUX_TEST_POP3_USER=test-user \
ZERUX_TEST_POP3_PASSWORD='example-only' \
node --test packages/@zeruxjs/email/test/inbound-live-optional.test.mjs
```

Use process secrets/environment injection rather than checking credentials into scripts or CI logs. The smoke tests support either protocol independently and skip absent credentials. For full Section 67 certification, expand real-server coverage to nested MIME, CID rendering, large messages, reconnect and UIDVALIDITY rollover using disposable test accounts. The suite included here is **not** proof that all protocol behaviours work against production servers.

## Test evidence and limitations

- Selected Email suite: **116 passed, 2 skipped** (opt-in live IMAP/POP3), zero failures.
- Queue suite: **46 passed, 1 skipped** (live Redis), zero failures.
- Email, Queue and dependency TypeScript package builds passed using local workspace links; real SQLite validates checkpoint isolation between two independent connections.
- Actual external protocol libraries, authenticated live IMAP/POP3 servers, full `npm ci` and production database-cluster testing remain unverified here. The Section 66 npm registry/lockfile gate remains open. These limits must be cleared before production release signoff.

This is not a substitute for virus scanning, validated sender authentication, user authorization, retention controls or server-side data protection. Incoming security flags remain *advisory*; hostile MIME should not be rendered unsanitized in custom clients.
