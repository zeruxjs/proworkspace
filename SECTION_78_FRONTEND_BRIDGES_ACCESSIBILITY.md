# Section 78 — Frontend interoperability, React/Vue/Zyro bridges and accessibility

**Date:** 14 October 2026  
**Source baseline:** `proworkspace-section77-full-updated-project.zip`.  
**Scope:** *packages only*, framework bridge APIs and minimal progressive enhancement. Standalone ZyroJS and Zuix certification are reserved for Sections 81–82.

## Changes

1. **`@zeruxjs/react`:** Optional `getServerSnapshot` on the external-store contract; pinned SSR payloads using `createReactStore(initial,{serverSnapshot})`; selector-derived server snapshot memoization; `useReactStore`, `useReactSelector` and `createReactBindings` pass SSR server readings instead of substituting live client state. React `useSyncExternalStore` remains runtime-injected. The host is responsible for a matching server/client hydration payload and stable selector identity.
2. **`@zeruxjs/vue`:** `createVueBindings(runtime)` provides scope-owned reactive shallow-ref projection, explicit manual `connect/stop`, synchronous `watch` integration via `fromRef`, a race-closing second snapshot read, and SSR one-shot `useStore(...,{ssr:true})` that creates no external subscription. Scope-less `useStore` fails loudly to prevent leaks.
3. **`@zeruxjs/zyro`:** Added `createZyroSubscriptionScope()` for route/component observer ownership, immediate or deferred projection, idempotent manual stop/destroy, safe disposal of all registrations even after one throws, and synchronous notification de-duplication during initial subscription.
4. **`zeruxjs/accessibility`:** Added a browser-only-on-use export for semantic ARIA tab groups; validates one-to-one tab/panel relationships; maintains `aria-selected`, roving `tabIndex`, hidden panels, keyboard Home/End, RTL/vertical arrows, disabled handling, focus and unmount cleanup; reads reduced-motion preference with an SSR-safe fallback. This is a narrow primitive, not a complete UI component library or accessibility audit.
5. **Reusable browser fixture:** Added a localhost-only static asset server that denies non-HTML/JS/CSS reads outside the workspace, isolated HTML bridge/accessibility fixture and a Chromium `--dump-dom` runner. Intended for reuse by standalone ZyroJS and Zuix browser gates in Sections 81/82. The fixture intentionally includes CSP restrictions and does not access the network.
6. **Tooling and documentation:** `npm run test:frontend` (transpile and unit/fixture-server tests) and `npm run test:frontend:browser` (explicit opt-in Chromium run) plus bridge READMEs and roadmap.

## Verified in this source environment

- `node scripts/test-frontend.mjs`: **38 passed, 1 skipped, 0 failed**. Includes the React, Vue, Zyro adapter lifecycle suites, SSR/source-only correctness, accessibility semantics with a DOM substitute, and fixture HTTP access validation.
- `node --test scripts/*.test.mjs`: **34 passed, 0 failed**.
- `node scripts/verify-source-workspace.mjs`: **31 tooling tests passed, 42 package contracts verified**. Clean `npm ci` and complete workspace build remain outside this isolated preflight.
- TypeScript strict builds for **`@zeruxjs/react`, `@zeruxjs/vue`, `@zeruxjs/zyro`**, and an isolated build for **`zeruxjs/src/accessibility.ts`** pass. The wider ZeruxJS build is still blocked by Section 66 missing dependencies (`zcli`, `zsrv`, `zwatch`, `@zeruxjs/hooks`, etc.).
- The Chromium test is **skipped in the certified local suite**: installed Chromium fails to render even a static `data:` page under the current system service/sandbox configuration. A browser binary being installed does not count as a successful browser integration test. Opt-in invocation is documented for supported environments.

## Supported/unsupported matrix

| Boundary | Source and Node test | Real external framework/browser |
| --- | --- | --- |
| React external stores and SSR selector snapshots | Passed | React 18/19 hydration, StrictMode and concurrent rendering not run against an installed React runtime |
| Vue shallow-ref injection and effect-scope disposal | Passed with injected runtime | Native Vue 3/Vite/Nuxt hydration and scope behavior not run against installed Vue |
| Zyro observable bridge route scope | Passed | Standalone `zyrojs` DOM/effect lifecycle requires Section 81 |
| ZeruxJS ARIA tab primitive | Passed with deterministic DOM fixture | Chromium/browser accessibility acceptance not completed |
| Reduced-motion preference | SSR fallback and injected matchMedia tested | Real CSS media query browser assertion not completed |
| Zuix CSS | Not modified in Section 78 | Standalone compiler/adapters/visual gate in Section 82 |

## Release blockers / follow-on acceptance

- **FRONTEND-78-BROWSER (P1):** Run the shared `RUN_BROWSER_TESTS=1` fixture in working Chromium/Firefox/WebKit environments; confirm keyboard tab behavior, focus, ARIA, and `prefers-reduced-motion` styles under physical browser execution. If it fails, fix this section before certification.
- **FRONTEND-78-REACT (P1):** Install supported React + ReactDOM versions and run real `useSyncExternalStore` hydration/StrictMode/concurrent-render tests; verify server and client hydration payload equality.
- **FRONTEND-78-VUE (P1):** Install Vue 3 in a disposable test environment, verify real scopes/watch + SSR/hydration/disposal.
- **WORKSPACE-66-DEPS (P0):** Clear the 14 unresolved external package dependencies and perform complete clean installation/build/tarball certification.

**Status:** Source hardening, unit/DOM-substitute/fixture HTTP tests done; **browser/framework integration and clean-install release gate open**. Next: **Section 79 — CLI/dev tooling/test runner and developer experience**.
