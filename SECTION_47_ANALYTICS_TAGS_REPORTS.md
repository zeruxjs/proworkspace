# Section 47 — Analytics, Tags, and Reports

Introduces two distinct workspace packages (`@zeruxjs/tags`, `@zeruxjs/reports`) and extends the existing `@zeruxjs/analytics`. Integrates all three with managed Zerux runtime startup/shutdown and generation-scoped HTTP routes. Separates **email activity tracking** from **marketing consent**; Section 46 email functionality is not modified.

## Delivered

1. **Analytics:** 16-character base62 cryptographic request IDs; UTC-day ID key; atomic reservation abstraction; DB adapter using a `(UTC day, ID)` primary-key key; optional DB old-key pruning; backward-compatible analytics collector extended with opt-in request enforcement, 409 duplicate, 422 invalid, 503 unavailable, returned request ID/day headers; scalar correlation fields on stored events; generic DB compare-and-swap document store for tags/reports.
2. **Tags:** immutable/versioned definition validation, triggers (all/event/pageview/click/form/history), conditional matching, variables (constant/event/dataLayer/context), tag types (internal analytics, GA4 server Measurement Protocol, configured HTTPS webhook). `createAstag` implements server event/config/set/get/consent, with scoped request correlation. Self-contained browser `ttag.js` implements parallel `ttag` commands, preloaded dataLayer, and explicitly published automatic page/click/form/history listeners, cryptographically generated base62 request IDs, Beacon + fetch keepalive and visibility-change/pagehide flushing. A public origin can be set for tagging subdomains. Authenticated admin designer, version-checked publication, and a no-side-effects trigger preview endpoint. Credentials stay on server.
3. **Reports:** authenticated report/page designer, 10 chart presentation types, six metrics, internal analytics dimensions, safe saved report documents with optimistic CAS persistence adapter. Event-limited query responses explicitly flag truncation (the built-in DB query cannot yet compute warehouse-scale totals).
4. **Framework:** `ZeruxConfig` adds `tags` and `reports` startup options; both configs are removed from public runtime manifests with other secrets. Their routes are scoped to the active generation and safely removed on shutdown. Startup degradation does not stop the application when optional telemetry is unavailable. Admin routing cannot initialize without a host authorizer.

## Configuration sample

```ts
// zerux.config.ts (conceptual; inject your actual DB manager and auth/session callbacks)
export default {
  analytics: { analytics: 'reporting', enabled: true,
    collector: { prefix:'/_analytics',allowedOrigins:['https://app.example.com'],serverToken:process.env.INGEST_SECRET } },
  tags: { enabled:true, site:'app',prefix:'/_tags',
    publicOrigin:'https://tags.example.com',
    allowedOrigins:['https://app.example.com'],
    dashboardHost:'tags.example.com',
    authorizeAdmin: async request => isAdminSession(request),
    credentials: { ga4: { secret: process.env.GA4_MP_SECRET! } },
    destinations: { crm: {url:'https://webhooks.example.net/events'} }
  },
  reports: { enabled:true,prefix:'/_reports',
    dashboardHost:'reports.example.com',authorize:async request=>canEditReports(request) }
};
```

With no tag container defined, the default container collects every event to internal analytics; additional GA4/webhook tags are created via the dashboard. Define the host's auth/session policy and reverse-proxy domains before enabling admin routes. Neither studio has a built-in password or unsafe anonymous default.

## Activity flow

```text
Browser: dataLayer.push / ttag('event', name, properties)
  -> cryptographic 16-character ID
  -> navigator.sendBeacon(text/plain JSON); fetch keepalive fallback
  -> Origin-approved /_tags/collect (size, time and rate limits)
  -> atomic UTC-date + ID reservation (409 on duplicate)
  -> trigger matching and variable evaluation
  -> internal analytics / GA4 Measurement Protocol / allowlisted webhook
  -> optional requestID event correlation in @zeruxjs/analytics

Server: request-scoped astag('event', name, properties)
  -> allocate/reserve server request ID once
  -> same trigger/tag engine, source='server'

Reports: authenticated designer -> internal analytics events -> bounded chart query
```

## Tested and limitations

Unit and route-integration suites cover reservation collisions, UTC-day rollover, DB adapter basics, tag conditions and variable resolution, browser Beacon, GA4/webhook dispatch, admin authorization, CSRF, compare-and-swap conflicts, report aggregation, sampling flag, and framework lifecycle/cleanup. Compile separately with `tsc -p packages/@zeruxjs/{analytics,tags,reports}/tsconfig.json`; run `node --test .../test/*.test.mjs`. Existing analytics tests remain passing.

This is a functional integrated **first phase**, **not full GA4/GTM/Looker feature parity or production certification**. Remaining production-critical items: complete framework/workspace install/typecheck in a dependency-resolved environment; real PostgreSQL/MySQL/SQLite persistence and failover tests; hardened distributed request-rate limiting/ingestion queues; data governance and policy controls; native aggregate query/warehouse storage for data sets above the 500-row fallback; multi-series reports and advanced report UI; GA4's full field semantics/Google validation; complete external tag adapter ecosystem; multi-tenant RBAC and OIDC integrations; public sharing/scheduling/export. Browser beacons, cookie-less identities, proxies and ad blockers cannot guarantee delivery. Do not mistake an HTTP 204 or GA4 2xx as proof of downstream persistence.
