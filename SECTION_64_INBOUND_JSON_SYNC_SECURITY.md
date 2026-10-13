# Section 64 — Storage-optional IMAP/POP3, safe MIME JSON, distributed sync, and retention

## What changed

This release adds **fully optional local inbox persistence** to the existing `@zeruxjs/email` receive API. Use `mode:'json'` to receive a bounded JSON-ready mail object and store it in any host-defined tables, document collections, or third-party services. **No ZeruxJS inbox schema is created** in JSON mode. The existing default persisted behavior remains unchanged when an `InboundStore` is supplied, including its duplicate protection.

The release also adds incremental IMAP UID cursors, a shared-database lease/checkpoint coordinator with stale-worker fencing, advisory safety signals, pluggable mail/attachment scanners, bounded binary output, and explicit local inbox retention.

## 1. Just receive JSON, use your own database

```ts
import {createEmailReceiver} from '@zeruxjs/email';

const receiver = createEmailReceiver({
  accounts: [{
    name:'support', protocol:'imap', host:'imap.example.com', port:993,
    auth:{user:process.env.IMAP_USER!,password:process.env.IMAP_PASSWORD!},
    maxMessagesPerPoll:100,
    maxMailboxMessages:1000
  }],
  mode:'json',
  attachmentContent:'base64',                 // opt-in; otherwise metadata only
  maxInlineAttachmentBytes:2*1024*1024,      // total binary budget per message
  onMessage:async message=>{
    // Host owns schema, mapping, encryption and retries. Use message.id as an idempotency key.
    await myMailboxDatabase.upsert({
      externalKey:message.id,
      subject:message.subject,
      html:message.html,                       // sanitized by the default sanitizer
      text:message.text,
      sender:message.from[0],
      attachments:message.attachments,         // base64 may be omitted when over budget
      safety:message.safety,
    });
  }
});

const result=await receiver.poll('support');
console.log(result.messages); // actual parsed objects; empty in persist mode
```

In this mode `get()` and `page()` require a host-provided inbox store; otherwise use **your own** DB queries for stored messages and pagination. To replace the built-in inbox storage while retaining `receiver.get/page`, pass an `InboundStore` implementation (`get`, atomic `put`, `page`, optional `erase`) and select `mode:'persist'`. Host-defined table names and columns are entirely under your control.

The ZeruxJS framework service startup now accepts `email.receive.mode:'json'` and no database configuration, plus `onMessage`, `attachmentContent`, `maxInlineAttachmentBytes`, `inspectRaw`, `inspectAttachment` and `saveAttachment`. Persistent mode still resolves a named database connector unless a host `store` is supplied.

**Important:** JSON mode does not automatically deduplicate messages. Every scan may encounter the same message again. Consumers MUST use `message.id` as a stable unique key. When a callback fails, polling fails and a checkpoint must not advance. For an application-managed schema, create the unique key and storage transaction in your own code.

## 2. MIME metadata and attachments

Returned `InboundMessage` has stable identity, account/protocol/mailbox, server remote UID/UIDL, UIDVALIDITY (IMAP), normalized subject, message ID, dates, plain text, sanitized HTML, names and email addresses for From/To/Cc/Bcc/Reply-To, reply/thread references, priority, and attachments. Each attachment contains filename, MIME content type, byte size, optional CID/inline indicator, a host storage reference, an optional scan verdict and optional `contentBase64`.

- **Default output:** attachment metadata only, with no bytes in the inbox database.
- **JSON/base64 output:** opt in with `attachmentContent:'base64'`; limited by `maxInlineAttachmentBytes` (default 2 MiB, max 8 MiB total **per message**). Omitted content is marked `contentOmitted:true` and reported by safety flags. JSON increases memory/network consumption, so prefer a private storage callback for large files.
- **Private storage:** `saveAttachment({account,messageId,attachment,content})` lets you upload bytes using `@zeruxjs/files` or your own encrypted storage. Filenames are reduced to a safe basename and control characters removed before callbacks.
- No remote attachment content is automatically executed. Treat names, content types and all parsed bodies as attacker-controlled.

The input raw MIME message remains capped to 1–32 MiB by account configuration. Bodies are truncated to 24,000 characters each; at most 100 attachment metadata entries are retained. The built-in persistence format is subject to a 60 KB JSON metadata cap. Parsing of complex MIME requires the `mailparser` runtime dependency.

## 3. Advisory safety / spam / violation markers

`message.safety` is a plain object:

```ts
{
  engine:'zerux-heuristic-v1',
  score:100,
  risk:'high',
  flags:['active_html','executable_attachment','suspicious_link'],
  authentication:'unverified',
  externalVerdict:'malware' // only if supplied by your own trusted scanner
}
```

Offline heuristics mark: script/iframe-style HTML, unsafe URL schemes, remote media, hyperlink display/URL mismatches, executable or macro-enabled attachment filenames, potentially encrypted archives, unusually large attachments, possible spam phrases, empty sender, control characters, truncation and withheld attachment content. **These are indicators, NOT a calibrated spam score, antivirus scan, safe-content certification or SPF/DKIM/DMARC verification.** No message is silently deleted just because a heuristic fires.

For production-grade filtering, integrate your own verified scanners:

```ts
const receiver=createEmailReceiver({
  accounts,mode:'json',
  inspectRaw:async ({raw})=>spamAndMalwareScanner.classify(raw),
  inspectAttachment:async ({filename,content})=>virusScanner.scan(filename,content),
  onMessage:async message=>{
    if(message.safety?.risk==='high')await quarantine(message);
    else await saveToOwnDatabase(message);
  }
});
```

`inspectRaw` may return `clean`, `spam`, `phishing`, `malware` or `review`. The attachment scanner may return `clean`, `suspicious` or `blocked`. A blocked/suspicious attachment is not saved or returned as base64; an externally detected malware message also withholds binary attachment bytes. Scanner exceptions stop polling (fail closed). The host controls final inbox/quarantine decisions. Message headers claiming authentication or trust are not accepted as proof.

Default HTML sanitization removes scripts and remote images using `sanitize-html`; deployments still need a restrictive CSP and must not trust user-supplied HTML. Replacing the sanitizer is a privileged application responsibility.

## 4. Incremental high-volume IMAP and distributed workers

```ts
// Start from the beginning of the current IMAP UID generation.
let cursor={afterUid:0};
const first=await receiver.poll('support',{cursor});
cursor=first.nextCursor!;
// Save cursor only after all JSON callbacks have committed successfully.
```

With `cursor`, IMAP sends a **bounded UID range query to the server** rather than enumerating all mailbox UIDs. Ranges are bounded by `maxMailboxMessages` and processing by `maxMessagesPerPoll`. `nextCursor` includes UIDVALIDITY to fence mailbox resets. An unexpected UIDVALIDITY change throws; do not automatically reuse the old cursor. UIDNEXT is used to avoid incorrectly skipping UIDs that have not yet been assigned.

For scheduled, multi-server processing:

```ts
import {createDatabaseMailboxSync,createIncomingSyncProcessor} from '@zeruxjs/email';

const job=createDatabaseMailboxSync({
  db:mainDatabase,
  id:'support-inbox-incremental',
  account:'support',
  receiver,
  leaseMs:60000
});

await job.runOnce('node-1'); // one bounded page; invoke repeatedly from queue scheduler
const processor=createIncomingSyncProcessor(async ()=>job);
// Queue job data MUST be: {id:'support-inbox-incremental',account:'support'}
```

The coordinator uses atomic versioned database updates for leasing, heartbeat renewal, fencing and durable cursor commits. A second worker can take over an expired lease. Poll failures store **only** a PII-free failure classification; mailbox contents and credentials do not enter the checkpoint or Redis. Stale workers cannot update a newer cursor. `job.resetCursor()` is an explicit administrator action, intended after reviewing UIDVALIDITY changes.

This is **at-least-once ingestion**, not exactly once: interrupted pages can replay. A persistent `InboundStore` has a unique incoming message ID; custom JSON consumers must provide their own unique key. The database connector must implement atomic conditional update with accurate `affectedCount`. IMAP UID search has been cross-checked against the [ImapFlow search guide](https://imapflow.com/docs/guides/searching/) and mailbox fields against the [mailbox guide](https://imapflow.com/docs/guides/mailbox-management/), but live-server behavior remains unverified.

POP3 retains UIDL-based deduplication in persistent mode and bounded UIDL polling. POP3 does not support the IMAP cursor or folders/read flags; UIDL lists can still be large. The POP3 receiver does not send DELE. Sending, marketing consent and activity tracking are independent from receiving.

## 5. Mailbox administration and local retention

- `receiver.accounts()` lists safe account metadata (never credentials).
- `receiver.verify()` opens a TLS-authenticated connection without modifying mail.
- `receiver.folders()` lists IMAP folders.
- `receiver.markSeen(account,messageId)` or `receiver.markSeen(account,messageObject)` changes a flag **only after checking UIDVALIDITY**. JSON mode can supply its returned message object without an inbox DB table; its immutable ID is rechecked.
- `receiver.pollAll()` fetches enabled accounts sequentially. For production use one named queue job per account.
- `sweepInboundRetention()` scans your local store under strict bounds, default dry-run, host-defined `canErase`, and explicit `dryRun:false` to delete. It NEVER deletes remote IMAP/POP3 messages. An optional `afterErase` callback can clean external attachment references; cleanup failures are reported separately. The built-in inbox stores implement explicit `erase` when the DB connector supports atomic deletion with affected row count.

```ts
const preview=await sweepInboundRetention({
  store:inboxStore,account:'support',olderThan:Date.parse('2025-01-01'),
  dryRun:true,canErase:async message=>!await legalHold.exists(message.id),
  maxScanned:1000
});
```

Remote mail, campaign data, consent/suppression data and external attachment files have **separate** retention lifecycles; deleting a local inbox row does not remove them.

## 6. Test coverage and outstanding production certification

Added focused tests for DB-free IMAP/POP3 JSON callbacks, binary attachments and omission caps, unsafe filename handling, sender/recipient metadata, safety scanner verdicts and failures, IMAP UID cursors and UIDVALIDITY mismatch, local and real-SQLite retention, a real-SQLite two-connection lease takeover, checkpoint fencing, JSON-mode markSeen, and queue-task payload validation.

Known limits:
- The environment cannot install `imapflow`, `node-pop3`, `mailparser` or `sanitize-html` from npm, so **real connection/parsing and real protocol-server tests were not performed**. Integration tests inject protocol and parser implementations.
- No full SPF/DKIM/DMARC verifier, antivirus engine, adaptive spam model, or guaranteed spam detection is bundled. Connect your own scanners.
- POP3 OAuth2 depends on provider/driver support and is not implemented by the current POP3 adapter.
- No real PostgreSQL/MySQL/MongoDB cluster validation or live Redis/BullMQ tests in this section; SQLite and unit tests cover the new paths.
- Full ZeruxJS framework TypeScript compilation remains blocked by existing missing workspace imports (`zcli`, `zsrv`, `zwatch`, hooks, lint).
- External npm dependency graph still needs full online `npm install` from `apps/proworkspace`, then lockfile regeneration before `npm ci`.
