# Section 81/85 — ZyroJS standalone runtime hardening

**Date:** 2026-10-14. **Baseline:** Section 80 full project. **Scope:** `apps/proworkspace/packages/zyrojs`, its observable bridge compatibility, and root build/test tooling. **No AIO application changes.**

## Implemented

1. **Reactive ownership:** Added explicit `createEffectScope()`/`onScopeDispose()` with idempotent disposal and aggregated cleanup errors. `effect()` re-tracks conditional dependencies, accepts per-run cleanup and releases dependencies on errors. Nested synchronous `batch()` coalesces writes. Global processing protects against unbounded self-triggering cycles. The effect retains its owning scope on later reruns.
2. **Computed and helper lifecycle:** `computed()` exposes `.dispose()` (and is automatically owned inside a scope), `useEffect()` returns a stop handle, and `useMemo()` returns a getter with `.dispose()`. These are framework-neutral helpers, **not** React hooks. Removed misleading demo semantics.
3. **Deep object/array change tracking:** Plain-object/array `reactive()` now tracks property reads, key enumeration, membership changes, additions/deletions, length changes and mutable nested objects. Frozen descriptors and native internal-slot objects such as `Map` and `Date` are not proxied. Writes through the raw original reference remain untracked.
4. **DOM correctness:** Replaced the placeholder patcher with an owned VNode tree, keyed child reordering, dynamic text/VNode child bindings, event and reactive property teardown, `unmount()`, and simple controlled `bind:value`/`bind:checked` fields. The system does not hydrate arbitrary server markup or take over React/Vue-owned DOM roots.
5. **Security boundaries:** Native DOM property setters and attribute APIs preserve text boundaries. Raw HTML sinks, scriptable `on*` attributes, risky URL schemes and raw CSS strings are disallowed. `renderToString()` escapes text and attributes and intentionally produces static SSR only. Its VNode element names are validated.
6. **Network races:** A stale `createRemoteResource().refresh()` response rejects with `AbortError` even if its loader ignores its AbortSignal; it never overwrites current data. A cancelled cache loader cannot commit its expired shared result. External AbortSignal listeners and request state are cleaned up.
7. **Package contract:** The published entry points `.`, `./dom`, `./network` now declare explicit ESM JS + TypeScript declarations. The manifest includes build output files and Node 20+ minimum. A real **offline npm tarball installation** in a separate consumer exercises all three imports. Pre-release `0.0.1-alpha.2` is **retained** until the full Section 85 release gates have passed.
8. **Regression tool:** `npm run test:zyrojs` compiles ZyroJS + `@zeruxjs/zyro`, runs their standalone regressions, packs ZyroJS and checks its installed runtime exports. The test uses temporary files only, and does not change production dependencies or resolve the missing external lock entries.

## API and migration notes

```ts
import { signal, batch, effect, computed, createEffectScope } from 'zyrojs';
import { h, render, unmount, renderToString } from 'zyrojs/dom';

const owner = createEffectScope();
const state = signal(0);
owner.run(() => effect(() => console.log(state.value)));
batch(() => { state.value = 1; state.value = 2; });
owner.dispose();

const container = document.getElementById('app')!;
render(h('button', { onClick: () => { state.value++; } }, () => state.value), container);
unmount(container);
const safeHtml = renderToString(h('div', {}, '<untrusted>'));
```

Migration from the early preview: use `onClick`, **not** lowercase `onclick`; unmount roots explicitly on route/component teardown; consume returned `useEffect` stop functions and `computed.dispose()` unless inside a scope; do not rely on the former patcher's unimplemented child diff. `renderToString` is an escaped static render, **not** an automatic hydrator. Network callers must handle cancellation rejections.

## Local evidence

| Check | Result | Limitation |
|---|---|---|
| ZyroJS TypeScript declaration build | Passed | Local TypeScript and Node types available |
| Standalone ZyroJS local unit / DOM / network / stress tests | **22 passed, 0 failed** | DOM harness simulates a subset of browsers |
| `@zeruxjs/zyro` bridge build/tests | **13 passed, 0 failed** | Observable bridge only, not running React/Vue |
| `npm pack` and offline fresh consumer install | **Passed** | Local tarball, not registry or clean monorepo install |
| Workspace tooling tests | **36 passed** | Local tools only |
| Isolated source preflight | **1,590 source files, 42 package contracts, 33 tests** | Source-only; `npm ci` still blocked by 14 unresolved external entries |
| Chromium/WebKit/Firefox browser DOM | **Not certified** | Installed Chromium did not yield a usable headless page in current environment |
| React/Vue in-browser side-by-side roots + hydration | **Not certified** | Runtime framework fixtures and browsers not provisioned |
| Cross-platform Node/OS and registry production build | **Not certified** | Section 83–85 release-gate work |

## Security, limitations and next phase

- `renderToString()` allows VNode component functions to run once while serializing. Do not execute user-provided JavaScript/functions; the escaping boundary protects strings, **not** arbitrary trusted code execution.
- Native URL parsing, CSP, credentialed requests, secure cookies, and authorization are the consuming application's responsibility. The library rejects dangerous inline HTML and URL schemes but is **not** a standalone HTML sanitizer for arbitrary rich content.
- Effects are synchronous, and returned asynchronous work is not tracked as an effect dependency. Use `createRemoteResource()` for cancellation and stale-response handling. Cache and SSE remain per-instance, not multi-user persistence.
- Preserve exclusive ownership of each DOM root. React/Vue can coexist in other roots through the existing bridge; no automatic shared DOM reconciliation is claimed.
- The clean-install, real-browser, memory-profile and external-service qualification portions of the Section 81 **production exit gate remain open**. Section 83 provides the service/browser matrix, Section 84 the security/performance gate and Section 85 the release decision.

**Next:** Section 82 — standalone Zuix CSS compiler, Vite adapters, deterministic utilities, escaping and browser output qualification.
