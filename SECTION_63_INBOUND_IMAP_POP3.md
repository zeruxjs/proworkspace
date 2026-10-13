# Section 63 — Unified email sending / receiving and durable inbox

## Overview

`@zeruxjs/email` now provides independent **send** (existing SMTP / custom transport) and **receive** (IMAP / POP3) capabilities. An account may have SMTP plus an incoming protocol, or an application may have only incoming accounts. All inbound APIs are server-side; this section does not create publicly reachable read-mail routes.

- `createEmailReceiver()` — multi-account receiver, `verify`, `poll`, `pollAll`, `get`, `page`, `folders` (IMAP), `markSeen` (IMAP with UIDVALIDITY fencing), and `close`.
- `createDatabaseInboxStore()` — primary-key deduplication of per-account, protocol, mailbox, UIDVALIDITY, and IMAP UID / POP3 UIDL; portable DB connector primitives; bounded keyset pagination. An in-memory store exists for local development only.
- `createIncomingPollProcessor()` — safe job processor adapter for `@zeruxjs/queue`; accepts just an account name, no credentials or message content in Redis.
- MIME decoding via `mailparser`, IMAP via `imapflow`, POP3 via `node-pop3`. `node-pop3` returns raw bytes via streams to avoid corrupting MIME source; data remains bounded by per-account limits.
- Attachment *metadata* is stored in the inbox; binary files may be uploaded using the application-provided `saveAttachment` callback, which returns an opaque reference. No raw emails or binary attachment payloads are stored in the inbox table.
- HTML is sanitized before storage by `sanitize-html`. Inbound HTML may be untrusted and must not be rendered without appropriate CSP. Remote images/scripts are not retained in the default sanitizer policy.
- `classifyIncomingDeliveryNotice()` exposes conservative delivery-status candidates, and `createTrustedInboundFeedbackProcessor()` will only record them after an explicit, trusted verifier approves the notice. An ordinary inbound email is **not** equivalent to cryptographically verified provider feedback.

## Framework configuration — combined send and receive

```ts
const config = {
  database: { /* configure a database connector named 'main' */ },
  email: {
    accounts: [{
      name: 'support',
      smtp: {
        host: 'smtp.example.com', port: 465, secure: true,
        auth: {type: 'password', user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD!},
      },
      receive: {
        protocol: 'imap', host: 'imap.example.com', port: 993,
        auth: { user: process.env.IMAP_USER!, password: process.env.IMAP_PASSWORD! },
      },
    }],
    receive: { enabled: true, database: 'main', table: 'zerux_email_inbox' },
  },
};
```

`scope.get('email')` retains the existing SMTP manager's `send()` API, plus a new `.receive` receiver. No polling starts automatically; register a periodic task through `@zeruxjs/queue`'s named scheduler and invoke `scope.get('email').receive.poll('support')` from your authorized worker.

For receive-only, set `email.accounts: []` and pass `email.receive.accounts` with one or more IMAP/POP3 connection records. The resulting service exposes `.receive` and `.close`, and does not pretend a sending transport exists.

**IMAP OAuth2** is supported using `{user, accessToken}`. **POP3** uses `{user, password}` only with the selected driver. TLS 1.2+ with certificate validation is required on all configured receive connections. Plaintext connections and insecure TLS bypasses are unsupported by this receiver.

## Programmatic API

```ts
import { createEmailReceiver, createDatabaseInboxStore } from '@zeruxjs/email';

const receiver = createEmailReceiver({
  accounts: [{
    name: 'sales', protocol: 'pop3', host: 'pop.example.com', port: 995,
    auth: {user: process.env.POP_USER!, password: process.env.POP_PASS!},
  }],
  store: createDatabaseInboxStore(db),
  saveAttachment: async ({account,messageId,attachment,content}) => {
    // Upload to a private @zeruxjs/files bucket. Make uploads idempotent by messageId.
    return await savePrivateAttachment(account,messageId,attachment.filename,content);
  },
});

const result = await receiver.poll('sales');
// result: { account, protocol, scanned, stored, duplicates, oversized, newIds }
const page = await receiver.page('sales', null, 50);
const newMessage = await receiver.get(result.newIds[0]);
await receiver.close();
```

IMAP `folders()` lists server mailbox paths. IMAP `markSeen(account,messageId)` is **explicitly mutating** and separately opens a write lock after validating the original UIDVALIDITY; polling uses a read-only lock and does not mark messages seen. POP3 `poll()` uses UIDL and RETR only, never DELE.

## Bounds and operational constraints

- Default `maxMessageBytes`: 8 MiB (hard cap 32 MiB), `maxMessagesPerPoll`: 50 (hard cap 500), `maxMailboxMessages`: 5,000 (hard cap 50,000). Large mailboxes fail with a descriptive message rather than allocating unbounded UID data. A true high-volume UID cursor is future work.
- Inbound body texts and sanitized HTML are capped at 24,000 characters each with `bodyTruncated` indicating partial content; 100 attachment metadata entries maximum. The stored inbox document is capped at 60,000 UTF-8 bytes for portability.
- The durable inbox keeps received email addresses/content and **requires host-defined retention, encryption at rest, access control and backups**. Do not expose `page()` or `get()` publicly without authorization.
- Concurrent workers coordinate deduplication via a database unique primary key, but attachment uploads may be retried after a competing worker or DB failure. Make `saveAttachment` content-addressable or otherwise idempotent.
- `verify()` and `poll()` contact remote servers on demand. The queue task adapter includes only the account identifier; schedule it explicitly with your production queue service.
- Database connector's atomic unique insert is required for correct multi-server deduplication. Live PostgreSQL/MySQL/MongoDB connectivity remains to be tested.
- Send-side marketing consent, bounce/reputation checks, and activity tracking are unchanged, and remain independently configured.

## Dependencies and verification

New package dependencies: `imapflow`, `node-pop3`, `mailparser` (and existing `sanitize-html`). The local environment could not reach `registry.npmjs.org`, so the workspace lockfile has the updated workspace dependency declaration **but not the external resolved package graph**. With registry access, regenerate the lockfile using `npm install` from `apps/proworkspace`, commit the updated lock, and only then run `npm ci`. The protocol adapters are verified with injected IMAP/POP3 clients, plus real SQLite persistence across two independent connections; no live mail-server compatibility claim is made.

Full ZeruxJS framework checking is still blocked by existing unrelated workspace imports (`zcli`, `zsrv`, `zwatch`, `@zeruxjs/hooks`, `@zeruxjs/lint`).
