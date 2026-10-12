# Section 44 — Private Email Tracking Tokens and Bounded Telemetry Ingress

## Scope

This section hardens Section 43's HTTP telemetry endpoints without altering the database schema, default opt-in tracking policy, or generation-scoped runtime service ownership.

### Email tracking link confidentiality

- **New URLs** use authenticated AES-256-GCM encryption with randomly generated nonces/IVs. They retain the existing `/_analytics/email/open/:token` and `/_analytics/email/click/:token` route structures, but use `v2.<base64url>` tokens. The signed destination, message ID, account and campaign cannot be read by simply decoding a token as base64; tampering is rejected by authentication.
- **Previously issued Section 43 HMAC URLs remain resolvable** while still signed, valid, not expired, and permitted by the current outbound-link policy. This is a backwards-compatibility decoder, not a way to create new legacy links.
- Keep `email.tracking.secret` **stable across process restarts, deployments and all replicas** serving tracking URLs. Changing it invalidates both old and new links; implement a key-ring/rotation mechanism in a later section if seamless rotation is needed. Always store it in a secret manager/environment, never in client config.
- Repeated `instrumentHtml()` calls on previously marked HTML do not add another pixel or wrap the service's own click links. Explicit `data-no-track`, `data-tracking="off"`, `rel="unsubscribe"`, and common opt-out/unsubscribe paths and query-parameter names are excluded from click rewriting. Existing per-send `tracking:false` and per-message opt-in controls remain intact.
- Destinations that would produce a token longer than the HTTP decoder's limit are left as ordinary direct links rather than rewritten to a broken redirect. Newly generated tracking URLs remain HTTPS-only, require supported account identifiers, and continue to respect `allowedLinkHosts` at both creation and resolution.
- These protections improve confidentiality **in the URL itself**, not full privacy: recipients, their email providers, reverse proxies, browser history and server logs can still encounter full tracking URLs. They are not an anonymization or guaranteed unique-open mechanism. Do not log tokens in untrusted systems; honor notices, consent and unsubscribe preferences.

### HTTP collector bounds

The optional native collection endpoint has two additional limits. Both operate within each collector/runtime generation:

```ts
export default {
  analytics: {
    analytics: 'reporting',        // a previously registered DB connector
    collector: {
      prefix: '/_analytics',
      allowedOrigins: ['https://app.example.com'],
      serverToken: process.env.ANALYTICS_SERVER_TOKEN,
      maxBodyBytes: 16384,
      bodyTimeoutMs: 3000,        // absolute upload/read deadline, 10–60000
      maxConcurrentReads: 64,     // request body readers per instance, 1–1000
      maxEventsPerMinute: 120,
      storageTimeoutMs: 350,
      maxPendingEvents: 64
    }
  }
};
```

- A slowly trickling or perpetually open request body receives **408** when its total wall-clock read deadline expires. The stream is canceled best-effort, without awaiting an uncooperative stream, and the active reader slot is released.
- When simultaneous body reads reach `maxConcurrentReads`, additional authorized POSTs receive **429** rather than creating unbounded in-flight body parsing work.
- An honest oversize `Content-Length` is rejected immediately with **413**; streaming bytes still enforce `maxBodyBytes` when a client omits or falsifies that header.
- Authorized browser origins now receive CORS headers on collector errors as well as on successful collection. Disconnected DBs, storage timeouts and event tracking failures remain best-effort and return 204, preserving Section 41–43 behavior.
- Invalid collector settings are still caught by the framework's optional analytics startup boundary; they do not prevent the rest of the application from starting.

## Verification

- `@zeruxjs/analytics`: **19 passing tests**, including six new Section 44 cases (token confidentiality/tampering, legacy compatibility, re-entrant instrumentation/opt-out exclusion, body read timeout and concurrency caps, size and configuration limits, and untrackable long destinations).
- `zeruxjs`: **35 passing tests**, including one new runtime integration test proving `bodyTimeoutMs` and `maxConcurrentReads` pass through the configured service scope. Other tests cover live Node HTTP collection, email send + tracking, service startup/teardown, hot runtime and build behavior.
- Workspace build-tool regressions: **7 tests passing**, for **61 tests total** across analytics, ZeruxJS, and build tooling. The analytics TypeScript compiler completed successfully. ZeruxJS `tsc` emitted its compiled output but is **not clean** without the full dependency installation; known missing workspace packages (zcli, lint, cache, zwatch) remain. See the specific Section 42–43 dependency limitations. No live SMTP, DB, multi-node deployment or external ingress was verified.

## Limitations / future development

- Request parsing has bounded **time and concurrency**, but a malicious proxy/network can still consume upstream resources. Configure edge upload timeouts, authentication, request size limits and per-IP/rate policies as well; `allowedOrigins` is **not** strong authentication.
- Collector rate limits, reader counts and analytics queues are **per process**, not distributed. No durable queue/backpressure beyond the limits above is implemented.
- AES-GCM tokens are not revocable per recipient without a revocation/consent backing store. Email clients and bots can prefetch links or pixels. Consent records, unsubscribe state, one-click unsubscribe handling, campaign/bounce/complaint workflows and queued marketing delivery belong to a future marketing/queue section.
- Retaining support for legacy HMAC tracking URLs necessarily retains their previous readable-token format for those links only. Remove it after any legitimately issued legacy token has expired, if a deliberate breaking change is acceptable.
