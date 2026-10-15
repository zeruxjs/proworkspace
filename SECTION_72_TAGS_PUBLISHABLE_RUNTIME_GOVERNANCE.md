# Section 72 / 85 — GTM-style publishable tag runtime and governance

**Date:** 14 October 2026  
**Scope:** `@zeruxjs/tags` and its existing Zerux runtime integration. **Package phase only; excludes AIO/application infrastructure.**

## Implementation

1. **Immutable live snapshots.** Existing `TagContainerStore` versioned CAS documents now hold both editable `triggers/tags/variables` and the live governance envelope. `publishedContainer()` selects the live release, not uncommitted drafts. Legacy documents without an envelope remain live until the first draft save and migrate without data loss. The editor uses separate *Save draft* and *Publish draft* controls; both browser-auto listeners and server `astag` run only published triggers.
2. **Auditable, conflict-safe transition.** `saveTagDraft`, `publishTagDraft` and `rollbackTagRelease` build a validated whole-document CAS update with monotonically increasing revision and release IDs. Atomicity requires the configured DB's **conditional UPDATE affectedCount** contract. A lost race responds `409` rather than overwriting another worker. Published snapshots are retained as a capped 12-release history; a rollback is a new published release, leaving the draft unchanged. Document size is restricted to 58 KB to fit SQL `TEXT` backends; oldest snapshots are pruned when needed. This is local release-history metadata, **not a compliance-grade immutable audit ledger**.
3. **Independent authorization and previews.** Host `authorizeAdmin` protects the editor, read/write API, release status and previews. Privileged publish/rollback operations additionally require explicitly configured `authorizePublish`; without it they fail closed. Both operations use same-origin Origin verification and version-CAS preconditions. Preview can select the saved draft or current published release but has no analytics/webhook side effects. Credentials are not rendered to the browser; publish checks GA4 secret and named webhook destination presence before activation. Tag destination parameters accept exact `{{registered_variable_id}}` bindings, resolved as bounded scalars with no evaluation.
4. **Browser/server runtime and privacy.** The generated self-contained `ttag.js` responds with `no-store` and only includes *published* automatic trigger types. Browser commands cannot rewrite its trusted site or debug policy and cannot force a custom request ID through `dataLayer`. Client property values and dataLayer variables are bounded and scalar-only, pending unsent events are discarded on consent denial, and a granted-consent assertion is included in collection requests. `createAstag` defaults to the same configured consent state; a fixed UTC day is reserved per request scope. Collector supports site-bound allowlisted origins, opt-in known-bot suppression, required browser-consent assertion and exact-ID deduplication. Browser claims are not proof of legal consent.
5. **CSP and isolation.** Admin HTML uses an inline script **SHA-256 CSP hash** instead of `script-src 'unsafe-inline'`, plus frame denial, no-referrer and no-store headers. Custom executable/script tags remain unsupported. External GA4/webhook destinations are separately caught and do not block other tags, request-ID/storage errors produce sanitized fail-soft warnings, named webhook URLs reject IP literals/local DNS names, timeouts and redirects are bounded. Egress firewall/DNS controls are still required to prevent rebinding and guarantee network isolation.

## API example

```ts
const tags = createTagManager({
  analytics, requestIds: analytics.createRequestIdStore(),
  store: analytics.createDocumentStore('analytics_tag_containers','default',emptyTagContainer()),
  site:'shop', allowedOrigins:['https://shop.example.com'],
  siteByOrigin:{'https://shop.example.com':'shop'},
  dashboardHost:'tags.example.com',
  defaultConsent:'denied', requireBrowserConsent:true, botPolicy:'drop-known',
  authorizeAdmin: req => hasEditorPermission(req),
  authorizePublish: req => hasPublisherPermission(req),
  credentials:{google:{secret:process.env.GA4_SECRET!}},
  destinations:{crm:{url:'https://hooks.example.com/tag'}},
  onWarning: message => console.warn(message)
});

// With application auth/session and a same-origin Origin header:
await fetch('/_tags/admin/api',{method:'PUT',body:JSON.stringify({...draft,version:2})});
await fetch('/_tags/admin/preview',{method:'POST',body:JSON.stringify({name:'page_view',mode:'draft'})});
await fetch('/_tags/admin/publish',{method:'POST',body:JSON.stringify({expectedVersion:2})});
await fetch('/_tags/admin/rollback',{method:'POST',body:JSON.stringify({expectedVersion:3,releaseId:1})});
```

In real HTTP clients, set `Content-Type: application/json` and include the application's authentication and CSRF protections. The snippet is illustrative rather than an unauthenticated runnable example.

## Verification and outstanding gates

- TypeScript `tsc -p packages/@zeruxjs/tags/tsconfig.json`: **passed** in the local linked baseline environment.
- `node --test packages/@zeruxjs/tags/test/*.test.mjs`: **22 passed, 0 failed**. Includes original browser/collector/destination tests, script syntax, draft isolation, preview against draft vs live, published script activation/rollback, publisher role and CSRF, concurrent CAS conflict, consent and tenant binding, browser request-ID trust boundary, admin CSP, history cap, external sink validation and warning-only failures.
- A two-connection real SQLite release integration test also **passed (1/1)** using the actual `@zeruxjs/db-sqlite` + `@zeruxjs/analytics` DB document adapter. Run `npm run test:tags-sqlite` after building those local workspaces. Isolated `verify:source` passed **31 tooling tests** and **42 package contracts** (1,545 isolated source files).
- **Not yet certified:** Clean registry-backed `npm ci` (Section 66 still blocked by 14 missing dependency-lock resolutions), real PostgreSQL/MySQL/MongoDB distributed release CAS/rollback, live GA4 Measurement Protocol outcomes, public DNS rebinding/egress isolation, distributed ingress-rate limits, browser end-to-end CSP compatibility in a production deployment, and partner-provider delivery semantics. External sink 2xx means HTTP acceptance only.

**Next:** Section 73/85 — Reports and campaign analytics dashboards. The roadmap still has **85 package sections**, and standalone AIO infrastructure remains outside their scope.
