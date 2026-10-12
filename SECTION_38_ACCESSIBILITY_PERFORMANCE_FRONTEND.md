# Section 38 — Accessibility, Performance, Share & Frontend Bridges

This section continues from the **Section 37 full archive** and develops six application-facing packages as coordinated but independently importable modules:

| Package | Delivered capabilities |
|---|---|
| `@zeruxjs/accessibility` | Nested focus traps, focus restoration, dialog lifecycle, accessible live regions, RTL/disabled-aware roving keyboard selection |
| `@zeruxjs/performance` | Native LCP/FCP/CLS/TTFB observation, bounded RUM samples and delivery, injected/optional Lighthouse audit, weak versus strong ETags |
| `@zeruxjs/share` | Native-share and clipboard fallbacks with cancellation semantics, safe Open Graph metadata, secure external share link attributes |
| `@zeruxjs/react` | Transactional external stores, selector snapshot stability, injected React memoized hooks, observable interop |
| `@zeruxjs/vue` | Combined refs, readonly observable adapters, bidirectional store/ref syncing, cleanup |
| `@zeruxjs/zyro` | Transactional notifications, memoized selectors, stable combined snapshots, abortable async state and synchronization edge-case fixes |

## Design and safety

- Browser integration is opt-in: no global event listeners, network calls, or metrics collection upon module import. DOM behavior requires an actual browser or suitable DOM implementation.
- The performance observer intentionally does **not** claim accurate INP measurement; CLS uses bounded session windows, and real browser/lifecycle validation is still required.
- RUM transmission is explicit and defaults to `credentials: 'omit'`. Applications must handle consent, authentication, and data retention.
- The Lighthouse adapter lazily imports optional `lighthouse`, targets an existing Chrome remote debugging port, and does not launch a browser.
- `createReactBindings` takes actual React hooks as parameters and should be used inside React components, with stable selector functions when appropriate.
- Resource adapters use structural typing so packages do not force large framework runtime dependencies on servers.
- Sharing rejects non-HTTP(S) and credential-bearing URLs. Native user cancellation is never converted into implicit clipboard writes.

## Validation

Each package was compiled in isolation with strict TypeScript settings, followed by Node test suites containing existing and new regressions. Temporary typings and emitted `dist` files are excluded from archives. A complete workspace build, real browser accessibility audit, full Lighthouse run, and production telemetry load testing were not performed.

## Remaining work

Full native browser/assistive-tech acceptance tests, spec-complete INP metrics, real React/Vue integration environments, and privacy/consent integration belong to application integration testing. ZSRV and earlier packages remain unchanged in this section.
