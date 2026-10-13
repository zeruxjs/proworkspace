# Section 65 — Inbox database choices, schema mapping and server-side UI functions

## Database table creation is preserved

Section 65 does **not** remove `createDatabaseInboxStore`. The inbound receiver continues to support three mutually compatible storage strategies:

1. **Package-managed database storage** (`mode:'persist'`, `database:'main'`, optional `table`). ZeruxJS lazily creates the inbox table and optional `(account,id)` read index on the *first database operation*. It stores bounded JSON metadata and uses unique message IDs for idempotent inserts. This is the backwards-compatible Section 63 path.
2. **Host-owned database table** (`mode:'persist'`, `database:'main'`, `mapping:{table,...}`). The application creates the table in its own migration and supplies mapped column names. With the default `createTable:false`, ZeruxJS **does not run any DDL**. The three mandatory fields are the message ID (unique/primary), account name and serialized JSON payload. Optional column mappings persist `subject`, `mailbox`, `receivedAt` and first sender for the host's own reporting/indexes. If an entirely different schema is required, implement `InboundStore` (`get`,`put`,`page`, optional `erase`) instead of the mapped adapter.
3. **JSON-only** (`mode:'json'`). No inbox table or DB connector is required. `poll()` returns parsed JSON; use `onMessage` to write to an independently managed system. JSON mode is **not automatically deduplicated**, so host storage must persist `message.id` uniquely. Poll retries can revisit remote messages.

All modes retain secure IMAP or POP3 polling, bounded parsing, sanitized HTML, plain text, sender/recipient details, attachment metadata, optional attachment storage, advisory spam/security flags and external scanning hooks.

### Example A: built-in inbox persistence

```ts
// zerux.config.ts — resolve 'main' to an existing registered database connector.
email: {
  accounts: [{name:'support',receive:{protocol:'imap',host:'imap.example.com',
    auth:{user:process.env.IMAP_USER,password:process.env.IMAP_PASSWORD}}}],
  receive: {enabled:true,mode:'persist',database:'main',table:'zerux_email_inbox'}
}
```

To use the function API with an application-side session, add `receive.api.authorize`. The inbox API is never created unless explicitly opted in with an authorization callback.

### Example B: existing custom database table

```ts
email: {
  receive: {
    mode: 'persist', database: 'main',
    mapping: {
      table: 'my_received_mail',
      createTable: false, // your migration created these columns and PK
      columns: {
        id: 'message_key', account: 'mail_account', payload: 'json_data',
        subject: 'email_subject', mailbox: 'folder',
        receivedAt: 'arrival_ms', from: 'sender_address'
      }
    },
    api: {
      authorize: async ({account,operation}) =>
        currentStaffCanAccessMailbox(account,operation),
      canErase: async message => retentionPolicy.mayErase(message.id)
    }
  }
}
```

`createMappedDatabaseInboxStore(db, {table,columns,createTable:false})` can also be used directly. Identifiers are validated against `[a-z][a-z0-9_]*`, maximum 63 chars; duplicate column names are rejected. Database authorization and schema migrations remain under application control. A custom table must enforce unique IDs. Use parameterized connector operations; never construct SQL by string interpolation.

### Example C: JSON only, custom data mapping

```ts
const receiver = createEmailReceiver({
  accounts: [myImapOrPop3Account], mode:'json',
  onMessage: async message => {
    await db.myInbox.upsert({
      id: message.id, from: message.from[0], subject: message.subject,
      text: message.text, sanitizedHtml: message.html,
      attachments: message.attachments, risk: message.safety?.risk
    });
  }
});
const result = await receiver.poll('support');
// result.messages: array of fully parsed messages for application-defined handling.
```

A `saveAttachment` callback can persist binary content privately, or `attachmentContent:'base64'` permits bounded inline bytes in JSON mode. Never render the raw HTML of untrusted inbound messages; persist and display the sanitizer's output, enforce your own content-security policy, and scan external files before download.

## Build your own inbox UI from functions

Use `createInboxApi({store,receiver,authorize,canErase})` on the trusted server. `authorize` is mandatory and is called **per operation and account**, not merely when the service is constructed. A host may pass the returned inbox API through an authenticated route or server action. Do not expose direct database connectors or mailbox credentials to the browser.

```ts
const inbox = createInboxApi({
  store: createDatabaseInboxStore(db,'zerux_email_inbox'),
  receiver,
  authorize: async ({account,operation,messageId}) =>
    verifyMailboxPermission(currentSession(), account, operation, messageId),
  canErase: async message => retentionPolicy.canErase(message.id)
});

const page = await inbox.list({account:'support',cursor:null,limit:50});
// { items: InboxSummary[], nextCursor, done }

const filtered = await inbox.search({
  account:'support', subject:'invoice', hasAttachments:true,
  limit:25, maxScanned:1000, cursor:null
});
// { items, nextCursor, done, scanned, scanLimited }

const full = await inbox.get('support',page.items[0].id);
await inbox.markSeen('support',page.items[0].id);
await inbox.markUnread('support',page.items[0].id);
await inbox.setFlagged('support',page.items[0].id,true);
const folders = await inbox.folders('support');
const polling = await inbox.poll('support'); // returns counters, not raw email bodies
// Explicit host-approved local cleanup (never server-side IMAP/POP3 DELE):
await inbox.eraseLocal('support',page.items[0].id);
```

`list()` and `search()` return **summaries** only: ID, account, mailbox, protocol, subject, from, dates, attachment count, and advisory risk flags. They never return HTML, plaintext message bodies or attachment content. `get()` returns the complete persisted parsed message after authorization; cross-account messages are indistinguishable from missing ones.

Because the legacy inbox table stores full messages in JSON, `search()` intentionally scans a bounded number of rows in application memory (`maxScanned<=5000`) and can return a partial set with `scanLimited:true`. It is **not an exact global full-text search**. Applications with large mailboxes should add their own indexed search/read model. Pagination uses a stable opaque message hash ID, not arrival-time sorting. For date-oriented queries, build an indexed host adapter.

All mutating operations enforce server-side account authorization. IMAP `markSeen`, `markUnread` and `setFlagged` fence on UIDVALIDITY to avoid acting on a different message after UID reuse. POP3 lacks remote read/star flags, so these operations reject POP3. `eraseLocal` requires a separate host `canErase` approval and does not delete from the remote mailbox. `folders` is IMAP-only. The receiver is read-only during polling.

## Validation and deployment

- Email and core variables compiled; selected Email regression tests passed, including real SQLite with two independent connections.
- The expanded tests validate built-in DDL, custom application tables, pagination boundary semantics, account scoping, authorization, bounded search and IMAP flag fencing.
- Full framework compilation remains blocked by pre-existing unresolved workspace dependencies (`zcli`, `zsrv`, `zwatch`, lint, cache, hooks). New startup configuration is covered by TypeScript checks for the affected code path.
- Live IMAP/POP3 servers, Redis queues, and PostgreSQL/MySQL/MongoDB deployments remain unverified. Install the external protocol/parser dependencies and complete live integration testing before production deployment.

## Preserved features

All Section 63/64 receive security features, SMTP sending, campaign scheduling, reputation, suppression, email analytics, and independently configured email activity tracking remain unchanged.
