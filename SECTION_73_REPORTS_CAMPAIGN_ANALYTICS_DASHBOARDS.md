# Section 73 / 85 — Reports and campaign analytics dashboards

**Date:** 14 October 2026  
**Scope:** `@zeruxjs/reports`, associated analytics SQLite integration tests and package-focused documentation. **Does not include AIO/application infrastructure.**

## Implementation

1. **Saved reporting and query provenance.** Existing versioned report documents, pages, chart editor, ten chart types, exact DB COUNT and indexed numeric aggregate support remain intact. Added optional bounded UTC request date windows for live query/export (without rewriting saved definitions). Corrected sampled averages to exclude missing/non-numeric values and total distinct/average metrics to reflect the whole bounded sample, not the sum of group averages. Native aggregate adapters are validated rather than silently accepting impossible counts; sampled source adapters cannot return more rows than requested or violate an enforced site scope.
2. **Tenant isolation and delegated permissions.** `ReportsOptions.authorize(request,action,resourceId?)` distinguishes `read`, `edit`, `export`, `sensitive` and `campaign`; older single-argument authorization callbacks continue to work and therefore must already grant all intended operations. `resolveScope(request)` binds a verified application tenant to its **own versioned store** and enforced analytics `site`. Storage authorization precedes tenant resolution. In tenant mode, request-less `reports.query()` is prohibited. Property-dimension charts additionally need the `sensitive` permission on query/export. Per-report invitation/ACL management is **not implemented**; host role/tenant policy controls sharing.
3. **Reports APIs.** Added cursor/version-scoped report-catalog pagination (`1–50` metadata rows), JSON/CSV per-chart/page exports, strict role checks and CSV formula neutralization. Exports are bounded by 256 KiB output, 12 charts and a conservative query-work budget (500 estimated queries), with a single native daily count window limited to 366 days. The saved document editor remains limited to 256 KiB input and CAS version checks; invalid writes return `422`, storage outages `503`, and CAS conflicts `409`.
4. **Campaign analytics.** Added opt-in `/campaign` reporting backed by application-provided `@zeruxjs/email` marketing and analytics adapters: bounded delivery-state pages (including `smtpAccepted`, `uncertain`, suppressed and missing records); native all-time states and provider notices; daily last-update/provider trends; and observed open/click/download events when explicitly configured. Nothing infers unique recipients from event notifications, automatic email opens or SMTP handoff. Responses include scope/coverage disclaimers. Site and campaign access must also be enforced by the callback's backing service; unauthenticated exports of recipients are not provided.
5. **Dashboard and CSP.** The existing mobile-responsive report/chart studio gains date filter controls, export actions and optional campaign views. Untrusted report/chart names use DOM `textContent`, previews cap visible charts and the static inline CSS/JavaScript is hash-pinned by CSP instead of `unsafe-inline`. Failures surface as errors rather than fabricated zeros.
6. **Existing integration correction.** The real SQLite analytics COUNT test was expecting three event indexes; Section 71 introduced an additional unique event-ID index. The test now correctly asserts four indexes, preserving the existing data correctness test.

## Representative usage

```ts
const reports = createReports({
  analytics,
  authorize: (request, action, code) => authorizeReportsSession(request, action, code),
  // Only a verified session can choose the site. Different tenants MUST use different stores.
  resolveScope: async request => {
    const site = await verifiedSiteFromSession(request);
    return {
      site,
      store: analytics.createDocumentStore('analytics_report_documents', `tenant_${site}`, {version:1,reports:[]})
    };
  },
  // Optional; adapter must bind campaign reads to the resolved tenant and check consent.
  campaigns: {
    report: (code, {cursor, limit, site}) => authorizedMarketingForSite(site).report(code,{cursor,limit})
  }
});
```

The host's `authorizeReportsSession`, `verifiedSiteFromSession` and `authorizedMarketingForSite` are illustrative application functions, not utilities supplied by Reports. Document IDs must follow the database document store's allowlist; map tenant IDs to approved IDs rather than using arbitrary user input. Do not configure a memory-only store for clustered production reports. Use the full package README for route details and data-coverage meanings.

## Local verification

- Reports TypeScript build: `tsc -p packages/@zeruxjs/reports/tsconfig.json` **passed** (local source links to built Analytics).
- Reports suite: **35 passed, 0 failed**; includes new dynamic scope/role/CSV/security/date-window/campaign cases and the original chart tests.
- New real SQLite `tests/integration/reports-sqlite.test.mjs`: **1 passed** using two independent DB connections, >500 raw events in one tenant, exact COUNT and concurrent save conflicts.
- Existing `tests/integration/analytics-sqlite.test.mjs`: **1 passed** after updating the obsolete index-count assertion.
- Packaging and workspace preflight evidence is documented in the final delivery summary.

## Remaining release gates

- Section 66's clean registry-backed `npm ci`, all-package build and release lock are **not certified** (14 external dependency resolutions remain previously unresolved).
- Live PostgreSQL/MySQL/MongoDB CAS/aggregation equivalence and distributed load testing are not verified. Nor are remote live SMTP, Redis/outbox, actual email activity click/open provider coverage, and end-to-end browser/SSO/session deployment.
- Report exports are per-chart sequential reads, **not atomic database snapshots**. `queryMode:'sampled'` denotes a bounded source page, numeric fact aggregations are explicitly indexed-only, SMTP acceptance does not prove inbox delivery, and provider notifications/tracking events are not unique delivered messages/readers.

**Next:** Section 74/85 — Database, authentication, migrations and tenant security. The 85-section package roadmap is unchanged; standalone AIO infrastructure remains outside scope.
