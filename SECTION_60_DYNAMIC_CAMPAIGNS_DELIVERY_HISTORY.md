# Section 60 — Function-Based Marketing Campaigns, Global Dynamic Variables, and Delivery History

## Scope

This section implements a server-side marketing campaign creation API, registered dynamic variables usable throughout a ZeruxJS application, and append-only **observed** durable email-delivery state transitions. The work builds directly on Sections 46–59. There is no newsletter/editor-only restriction: a campaign may be created entirely from application functions with an array of named recipients and JSON data.

## Core ZeruxJS variable engine

Import `createVariableRegistry`, `variables`, `registerVariable`, and `renderVariables` from `zeruxjs` or `zeruxjs/variables`:

```ts
import { createVariableRegistry, registerVariable, renderVariables } from 'zeruxjs';

registerVariable('company.name', () => 'Acme');
registerVariable('customer.credit', async ({ customer }) => /* lookup */ 42);
console.log(await renderVariables('Hello {{name}} at {{company.name}}', { name: 'Ada' }));

// Prefer an application-scoped registry in multitenant / SSR programs:
const registry = createVariableRegistry();
registry.register('application.support', async () => 'help@example.com');
await registry.render('<p>{{name}}: {{application.support}}</p>', {name: '<Ada>'}, {escape: 'html'});
```

Only named scalar values, safe nested JSON paths, and explicitly registered asynchronous resolvers are evaluated. **No eval, expression execution, prototype traversal, arbitrary functions from templates, or implicit HTML injection.** Registered names cannot overwrite a non-`undefined` context value. Missing values default to empty, with optional `keep` or `error`. Output size, token count, and nesting/parameter sizes are bounded. The convenience singleton is process-local; use an application-scoped registry for tenant isolation.

## Function-based campaign API

Construct `createMarketingCampaignService` from `@zeruxjs/email`. It requires a configured database connection with atomic conditional updates, a BullMQ queue, and a durable delivery store from `@zeruxjs/queue`:

```ts
import { createMarketingCampaignService } from '@zeruxjs/email';
import { createDatabaseEmailDeliveryStore, createDatabaseEmailDeliveryHistory,
         createJournaledEmailDeliveryStore, createDurableEmailDeliveryProcessor } from '@zeruxjs/queue';
import { createVariableRegistry } from 'zeruxjs';

const registry = createVariableRegistry();
registry.register('company.name', async () => 'Acme');
const deliveryStore = createJournaledEmailDeliveryStore(
  createDatabaseEmailDeliveryStore(db),
  createDatabaseEmailDeliveryHistory(db)
);
const campaigns = createMarketingCampaignService({
  db,
  queue: queueService.queue('emails'),
  delivery: deliveryStore,
  renderer: registry,
  // For requests crossing an HTTP boundary, implement the app's authorization rules:
  authorize: async (action, code) => currentActorCanManageCampaign(action, code)
});

const campaignCode = await campaigns.create({
  name: 'New product launch',
  subject: 'Hi {{name}}, a message from {{company.name}}',
  content: '<h2>Hello {{name}}</h2><p>Your offer: {{offer.code}}</p>',
  providers: ['primary_smtp', 'backup_smtp'], // names configured in EmailManager
  data: { offer: { code: 'WELCOME20' } },
  emails: [
    { email: 'ada@example.com', name: 'Ada', data: { tier: 'Gold' } },
    { email: 'lin@example.com', name: 'Lin', data: { tier: 'Silver' } }
  ],
  isTracking: true,
  sendAt: Date.now() + 60_000
});

const definition = await campaigns.get(campaignCode); // one canonical template
const listing = await campaigns.list({cursor: null, limit: 25});
const recipients = await campaigns.recipients(campaignCode, {cursor: null, limit: 50});
const preview = await campaigns.preview(campaignCode, recipients.recipients[0].id);
const pending = await campaigns.enqueue(campaignCode); // resume after Redis outage

// Register with the existing durable BullMQ SMTP worker:
const processor = createDurableEmailDeliveryProcessor({
  store: deliveryStore,
  campaignGate: campaigns.deliveryGate,
  isSubscribed: email => preferences.isSubscribed(email),
  isSuppressed: email => suppressions.isSuppressed(email),
  send: (messageId) => campaigns.sendById(messageId, emailManager)
});
```

`create()` returns a **single unique campaign code**, and attempts to enqueue all initial recipients. The `content` field defaults to HTML; set `contentType: 'text'` for plaintext. Alternatively use `html`/`text`. `emails` is an alias for `recipients` (provide one, not both). `account` is a shortcut for one `providers` entry. Queued jobs carry only `messageId` and delay metadata; recipient PII, JSON variables, subject and HTML remain in the database. Provider account **names**, not SMTP credentials, are stored in the campaign. Provider choice for each recipient is deterministic.

The campaign template is persisted **once**; each recipient row stores its name, email, and bounded JSON object, not a rendered subject/HTML copy. `preview` resolves variables on demand, and `sendById` resolves them immediately before EmailManager's marketing checks and SMTP send. The existing email manager handles HTML processing, unsubscribe headers, fresh consent and suppression checks, and **optional** tracking instrumentation. `isTracking: false` disables tracking even for campaigns. Tracking events remain independent of subscription consent, as required in earlier sections.

`recipients` provides keyset pagination plus each message's durable state (`pending`, `sending`, `sent`, `uncertain`, etc.). The existing Section 58/59 reporters provide aggregate campaign metrics; these APIs do not duplicate that reporting engine.

### Safety and operational behavior

* Up to 1,000 recipients may be created in a single call; use application imports or multiple separately managed campaigns for larger sends. Pages are bounded (1–200).
* If Redis enqueue fails after durable creation, the campaign remains accessible via its code with `status: 'queue_failed'`. Call `enqueue(code, {cursor})` repeatedly to resume. The Queue processor also needs its own durable claim/uncertain-state protection; the email manager's process-local idempotency map is insufficient for multi-server delivery.
* A campaign with `status: 'building'` indicates an interrupted recipient import. It **must not** be delivered, and requires operator reconciliation rather than guessing its recipient count. No atomic DB transaction spans the campaign creation and up to 1,000 recipient inserts.
* Cancellation sets the campaign state; wire `campaigns.deliveryGate` into the existing durable email processor so queued emails are suppressed at the delivery boundary. Cancellation cannot recall mail that has already entered SMTP.
* Marketing sends require the usual consent and suppression/reputation services. Queue timestamps are advisory; the worker checks consent and campaign state again before SMTP. Email activity tracking may be independently enabled per campaign.
* Campaign getters/listings expose recipient or content information only to authorized server-side callers. Configure the `authorize` callback before exposing them through an HTTP endpoint; no public API is installed by default.
* The registry renderer is explicitly injected to avoid a global/tenant data leak or a framework-to-email circular runtime dependency. Without injection, built-in `{{name}}`, `{{email}}`, and JSON interpolation still works.

## Append-only delivery history

`createDatabaseEmailDeliveryHistory(db)` persists immutable rows keyed by the SHA-256 hash of `messageId + version`, deduplicates exact retries, and rejects conflicting replays. It exposes:

```ts
const history = createDatabaseEmailDeliveryHistory(db);
const observedStore = createJournaledEmailDeliveryStore(deliveryStore, history);
const page = await history.page(campaignCode, {cursor: null, limit: 50});
const timeline = await history.trends(campaignCode, '2026-10-01', '2026-10-13');
```

Wrap the **same delivery store** used by the sender and campaign creation if all transitions should be observed, as shown in the service setup example above. The wrapper records `pending` creation and successful CAS **state changes** (`claimed`, `sending`, `sent`, `uncertain`, etc.), excluding metadata-only updates. Daily trend counts come from database-native grouped counts on immutable `occurred_at` values and are therefore different from Section 59's *current state by last update day*. There is no 500-row application scan for trend totals. Use `campaignTransitionHistoryCharts()` from `@zeruxjs/reports` to adapt its daily output into labeled SMTP-sent and uncertain transition charts, keeping this coverage disclosure intact.

**Consistency limitation:** General ZeruxJS database connectors do not yet guarantee a transaction shared by a delivery-state update and a journal insert. The wrapper performs CAS first, then writes history. A crash between those actions can leave a missing transition. Consequently, history reports correctly label coverage **`recorded-transitions-only`**, never claim transactionally complete histories, and do not promise snapshot consistency across many queries. A transactional connector-specific outbox/reconciliation mechanism remains a future milestone. Never publicly expose raw journal message IDs without authorization.

## Database compatibility and test evidence

The new modules rely on the ZeruxJS generic createTable/insert/select/update query contract. Exact operation semantics (CAS affectedCount, grouped SQL COUNT, keyset pagination and unique primary keys) are required. Real Node built-in SQLite integration tests pass; live PostgreSQL, MySQL, MongoDB, BullMQ/Redis and SMTP provider testing remain outstanding. An optional type-only shim allows the SQLite package to build when `better-sqlite3` is not installed; the default built-in `node:sqlite` still works.

Run the focused and package tests after dependency installation:

```bash
cd apps/proworkspace/packages/@zeruxjs/email
npm run build && node --test test/*.test.mjs
cd ../queue
npm run build && node --test test/*.test.mjs
```

Full workspace compilation still requires previously missing workspace packages (`zcli`, `zsrv`, `zwatch`, hooks, lint, etc.). BullMQ's live-Redis integration is skipped when Redis is unavailable. Production use requires a real Redis worker, provider-verified feedback, and a durable storage/backup strategy.

## Section 60 verification summary

- **130 tests passed; 1 live-Redis test skipped; 0 failed** across the complete Email, Queue, Reports, and new core-variable suites. This includes SQLite-backed end-to-end worker/delivery history, journal replay, campaign pagination/renderer integration, and authorization cases.
- `@zeruxjs/cache`, `@zeruxjs/cache-redis`, `@zeruxjs/analytics`, `@zeruxjs/email`, `@zeruxjs/queue`, `@zeruxjs/reports`, plus SQLite/SQL-core dependencies compiled locally. `zeruxjs/src/variables.ts` passed isolated strict TypeScript checking.
- The full ZeruxJS workspace build still depends on unresolved pre-existing workspace packages; this release must not be interpreted as full framework certification.
