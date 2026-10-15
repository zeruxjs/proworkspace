# Section 76/85 — ZeruxJS core, runtime and API integration

**Date:** 14 October 2026  
**Status:** Framework source hardening and local integration tests delivered. **Clean npm installation and production multi-service certification remain blocked.** This section covers the **package framework**, not the separate AIO infrastructure application.

## Delivered and why

1. **Fail-closed middleware:** A global middleware that does not call `next()` previously fell through to application routing. Now a request without a completed middleware chain receives **403** unless middleware has already sent a response. Missing route-specific middleware now yields **500**, never an unauthenticated route execution. Middleware errors still follow framework exception handling. Static files in `public` remain intentionally public; place private content behind authenticated routes.
2. **Reserved service endpoint integrity:** The generation-scoped service router now validates complete batches and rejects dynamic, wildcard, duplicate and otherwise overlapping paths across services, not just identical route strings. Application/plugin routes cannot add, replace or delete overlapping reserved endpoints after mount. Service/app route collisions during bootstrap abort preparation and close already acquired service resources in reverse order. This is **not** a replacement for host authorization, CSRF or destination validation inside the service providers.
3. **Lifecycle-owned template variables:** `runtime.variables` and `api.variables()` return the same *per-generation* variable registry, independent of the legacy process-global convenience registry. A registry can render **subject, HTML and plain text together**, evaluating the same async resolver once per render and HTML-escaping only the HTML field. Closing the runtime services clears its resolver registry, including on a later hot reload disposal; the new generation's registry remains independent. Do not register secrets as public template variables.
4. **Safer bootstrap:** Removed assignment of raw `zeruxConfig` to `globalThis`; previously it could expose SMTP passwords, tracking signatures, DB credentials and other private values to unrelated server modules. Host services keep private settings in their scoped manager instances, and the existing public manifest uses redaction. `bootstrapApplication(..., providers?)` gains an optional initializer injection seam for isolated framework tests; normal apps keep the original four-argument call.
5. **Service type/API alignment:** `ZeruxConfig.tags` now types independent publish permission, site/origin binding, consent and warning settings; Reports supports independently authorized read/edit/export/sensitive/campaign actions and tenant-specific scope/campaign sources; Queue config declares Redis Cluster seed nodes and the three scheduler authorization actions. Runtime initializer behavior is unchanged and still requires host callbacks and explicitly configured packages.
6. **End-to-end local smoke tests:** New tests start actual Node HTTP listeners, load app/entry/middleware routes from disk, validate service endpoints and host headers, simulate all eight service integrations (Database, Cache, Files, Analytics, Email, Tags, Reports, Queue), verify cleanup order, isolate two generation-owned registries, and inject registration/middleware failures.

## Integration pattern

```ts
// index.ts or a trusted framework plugin (runs once per prepared generation)
export default function register(api) {
  const registry = api.variables();
  registry.register('app.brand', () => 'Zerux');
  // Supply a trusted per-recipient context from the host, not an arbitrary browser object.
  api.addRoute({
    pattern: '/api/render-preview',
    method: 'GET',
    handler: async (ctx) => {
      // Host-authenticate this route before deploying: previews can contain private data.
      const context = {firstName: 'Ada'};
      return registry.renderFields({
        subject: 'Welcome to {{app.brand}}',
        html: '<p>Hello {{firstName}}</p>',
        text: 'Hello {{firstName}}'
      }, context, {escape: {html: 'html'}, missing: 'error'});
    }
  });
}
```

For production, authenticate and CSRF-protect any state-changing endpoints, use explicit tenant/site scopes for DB/analytics/campaign operations, pass `api.variables()` explicitly to host-owned template workflows that accept a registry, and never expose `ctx.config`, `ctx.env`, raw manager instances or credentials in HTTP responses. `api.service(name)` returns a **trusted server-side** service and must not be exposed as a universal HTTP dispatcher. Tag publish/rollback requires `authorizePublish`, Reports requires `authorize`, Queue privileged endpoints require host session/CSRF and operation-level `administration.authorize` checks. Email tracking and Analytics remain best-effort unless explicitly configured as required.

## Evidence and limitations

- `packages/zeruxjs`: TypeScript compilation and the **complete local test suite** pass, including the Section 76 tests and existing service, HTTP, streaming, hot-reload, worker, manifest, variable, tags/reports and campaign tests.
- The eight-service smoke test uses **injectable in-process adapters**, not live SMTP, external PostgreSQL/MySQL/MongoDB, live S3, Redis, GA4 or production identity providers. A real Node listener is used to exercise the router. Existing unit suites test package implementations separately.
- `npm run verify:source` verifies the isolated source snapshot and package contracts. The **registry-backed `npm ci` gate remains unresolved**; a scoped workspace build still fails in `zsrv` where third-party packages `chalk` and `ws` are absent. The framework itself compiles using temporary local links and prebuilt dependencies, which are **not included** in either release ZIP.
- Hot reload remains generation-drained but the global active database/cache manager compatibility surfaces need live concurrent-connection/load qualification. File-system manifest and developer snapshot publication during a failed hot activation is not a full transaction. Do not claim zero-downtime cross-process deployments or release certification from these tests.
- Run representative live service tests from Sections 67–75 and the multi-runtime lab in Section 83 before production promotion. No unaudited service was implicitly enabled.

## Next section

**Section 77/85 — ZSRV gateway, protocols and rolling multi-instance serving.** Preserve the two-ZIP delivery rule: only changed files and full updated source project.
