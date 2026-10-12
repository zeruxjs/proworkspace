# Section 43 — Runtime HTTP Telemetry Wiring and Deadline Safety

## What changed

This section closes the integration gap between Section 41's analytics/email endpoint primitives and Section 42's generation-scoped runtime services.

1. The ZeruxJS bootstrap now mounts enabled, explicitly configured analytics collectors as native Fetch-style application routes, automatically and without requiring a user-authored route file.
2. Explicitly enabled email tracking now creates its signed pixel and click-redirect routes in the same application generation as its email manager; the manager receives the *same* tracking service instance. A pixel or click URL is never intentionally generated for a service that failed to mount its routes.
3. Service HTTP endpoints are scoped to an application generation, registered after plugins and discovered routes have been examined, rejected if they overlap existing application or static-file paths, and cleared on teardown. Dynamic parameters and catch-all routes are included in collision detection. A route collision is a configuration conflict and intentionally fails generation preparation rather than silently exposing or shadowing a tracking endpoint.
4. Analytics initialization/collector creation and optional email-tracker construction are best-effort. Missing databases, tracking-library failures and invalid tracking settings do not prevent a required email manager from starting. Failed collector construction is logged as a warning. Email remains explicitly opt-in on each **send** even when the tracking service is configured globally.
5. Outbound analytics writes, tracking callbacks, and collector storage have configurable small wait deadlines and bounded outstanding-operation counts. A stuck DB promise can time out the caller without indefinitely blocking email delivery, pixel serving, redirects or event collector responses. Timed-out operations are **not canceled** and remain counted until settled, preventing an unbounded accumulation of hung operations. No reliable delivery or durable queue is claimed.
6. The global analytics and email credentials are removed from public runtime config after service initialization as in Section 42. HTTP route registrations expose only paths and handlers, not tracking secrets or SMTP credentials.

## Example

Enable only the services you actually use. `analytics.analytics` is the **name** of a previously configured DB connector. The `collector` object must be present to mount the event collection route. An allowed browser origin is **not** a user-authentication mechanism; apply authenticated server tokens, authorization, and abuse controls as appropriate.

```ts
const config = {
  db: { /* named DB connection "reporting" */ },
  analytics: {
    analytics: 'reporting',
    enabled: true,
    collector: {
      prefix: '/_analytics',
      allowedOrigins: ['https://app.example.com'],
      serverToken: process.env.ANALYTICS_SERVER_TOKEN,
      maxBodyBytes: 16384,
      maxEventsPerMinute: 120,
      storageTimeoutMs: 350,
      maxPendingEvents: 64
    }
  },
  email: {
    accounts: [/* SMTP or injected transports */],
    tracking: {
      enabled: true,                   // make handlers available; does NOT track sends by default
      baseUrl: 'https://events.example.com',
      secret: process.env.EMAIL_TRACKING_SECRET, // >= 32 bytes
      path: '/_analytics/email',
      telemetryTimeoutMs: 350,
      maxPendingTelemetry: 64
    }
  }
};
```

When the application serves `events.example.com` and HTTP requests reach this ZeruxJS instance, these routes become available:

| Route | HTTP behavior | Notes |
| --- | --- | --- |
| `/_analytics/collect` | POST and CORS preflight OPTIONS | Collection requires an approved Origin or a valid server bearer token; responds with 204 when storage is offline. |
| `/_analytics/email/open/:token` | GET pixel / HEAD | Signed, expiring URL; does not require JavaScript. |
| `/_analytics/email/click/:token` | GET/HEAD redirect | Signed destination, HTTPS-only; supports an optional host allowlist. |

The example uses a dedicated event hostname only if DNS/proxy/TLS actually route it to the same runtime. For a different host or subdomain, configure its ingress separately. Routes are not an independent DNS server.

Only explicit opt-in sending instruments mail:

```ts
await email.send({
  from: 'sender@example.com',
  to: 'recipient@example.com',
  subject: 'News', text: 'Hello', html: '<a href="https://app.example.com/docs">Docs</a>',
  tracking: { enabled: true, opens: true, clicks: true, campaign: 'launch' }
});
// email.send(message, { tracking: false }) overrides all tracking for that send.
```

Browser `@zeruxjs/analytics/browser` can POST events to `/_analytics/collect`. Event recording is best effort; open counts are approximate because email clients may proxy, block or prefetch pixels. Respect privacy, consent and unsubscribe requirements for marketing messages. A future queue/marketing package can integrate with existing message/account/campaign markers but is not delivered here.

## Verification performed in this section

- Compiled `@zeruxjs/analytics` with TypeScript and ran its 13 tests (including 2 new hung-storage deadline tests).
- Compiled ZeruxJS with temporarily available Node typings and ran 52 selected framework, analytics, runtime service, request lifecycle, build and workspace-tool tests successfully after compiling selected fixture dependencies; added 6 service-HTTP integration tests.
- Exercised real `bootstrapApplication()` + Node HTTP server, real `@zeruxjs/email` delivery through an injected transport, collector requests during a missing database, signed pixel and click redirects, and signed-route registration.
- Ran six focused email analytics/queue/tracking-policy tests. The final combined focused run passed 60 tests with zero failures.

## Remaining validation and limits

No full `npm ci`, comprehensive package typecheck, real SMTP, real database, external ingress, load test or live cloud-provider verification was performed. Framework-wide `tsc` emitted JavaScript but reported unresolved external packages before full dependency installation (zcli, zsrv, zwatch, cache, hooks, lint), as already documented in Section 42. The repository lockfile may still need a dependency refresh from an online registry, also noted in Section 41.

Telemetry timeouts do not terminate underlying database operations; the concurrency cap bounds their outstanding count **per runtime instance**, not globally across a horizontally scaled fleet. Server-side metrics remain ephemeral when storage is unavailable. Collector authorization by allowed Origin alone is unsuitable for sensitive analytics or high-trust actions. Rate limiting is in-memory per instance and is not a distributed enforcement layer. Runtime shutdown/rolling deployment certification and durable marketing queues remain future work.
