# Section 82/85 — Zuix CSS: production compiler, themes and adapters

**Scope:** Standalone `zuix` package only, with toolchain smoke integration. This section does not implement the AIO application. Baseline: verified Section 81 full project ZIP.

## Work completed

1. Added `src/safety.ts` with bounded compiler and scanner limits, restricted arbitrary CSS value grammar, declaration/property checks, at-rule condition validation and Unicode-capable class escaping. Invalid classes are reported in `GenerateResult.unmatched` rather than emitting unsafe CSS. A max-classes failure prevents unbounded iterable allocation.
2. Hardened `src/compiler.ts` with validation of final CSS declarations, numeric screen widths, bounded variant depth, deterministic sorted tokens, stricter custom keyframe naming, and safe plugin value handling. Existing theme token resolution, preflight, animation and accessibility motion/contrast/dark variants remain supported.
3. Hardened `src/node.ts` with bounded root-relative static scanning, excluded build/symlink paths, file-size and aggregate limits, incremental mtime/size class caching, deterministic ordered results, safe output paths, safe per-source generated CSS cleanup, and watch retries after errors.
4. Hardened CLI input parsing. Unknown commands/flags, missing values and repeated flags now fail nonzero. SIGINT/SIGTERM teardown for watch is explicit.
5. Updated framework-neutral Vite adapter: resolved root, replacement of initially scanned classes by up-to-date transformed module classes, removal on deletion, and virtual CSS invalidation. Node filesystem code is dynamically imported inside the Vite hook, so browser consumers can safely import the package root.
6. Added runtime/security regression tests, watch/build parity tests, Vite hook tests, output/symlink safety tests and `test:zuix` with a real, offline npm-pack consumer of all four advertised package entry points. Added opt-in `test:zuix:browser` and documented the integration support matrix.

## Verification (local source gate)

| Check | Result |
| --- | --- |
| Zuix package TypeScript compilation | PASS |
| Zuix package Node regressions + smoke | 11 passed, 0 failed |
| Packed npm artifact offline install and import (`.`, `./node`, `./vite`, `./theme`) | PASS |
| Workspace tooling tests | 36 passed, 0 failed |
| Isolated source preflight | 33 passed, 42 contracts; 1,594 source files |
| Real Chromium rendering / computed CSS | BLOCKED: Chromium failed to render even a minimal page (timeout) |
| Real Vite + React/Vue app, Next/Nuxt app integration | NOT VERIFIED; no Next/Nuxt plugin provided |
| Clean npm ci/full workspace build | BLOCKED: existing 14 external registry dependency lock resolutions |

## Behavioral and security notes

- Arbitrary CSS values are a constrained utility language, **not** a full CSS parser. `url()`, style-breaking syntax and CSS comments are deliberately excluded. Custom animation/body CSS and plugin `addBase()` remain trusted sources.
- Static scanning cannot determine runtime-built class names. Use `safelist`, bounded content globs and normal package CSS imports.
- `minify` is a whitespace/output compacting mode, not vendor prefixing or an AST minifier. No claim of support for every CSS specification or browser version.
- The existing `ZuixTheme` extension API and default token palette are retained; theme values emitted into declarations are verified. CSS in generated files is deterministic for identical config/content.
- Watcher class caching uses `size`/`mtime`, which is adequate for normal development but does not detect content replacement with identical size and timestamp; invoke `zuix build` for canonical CI output.
- `zuixVite()` is a framework-neutral Vite hook. Plain Vite/React/Vue component scanning is covered with a deterministic plugin mock, not actual framework execution. Next and Nuxt require integration via the CLI-generated stylesheet unless a first-class adapter is independently implemented and tested.

## Release blockers and follow-up

- **ZUIX-82-BROWSER (P1):** Chromium cannot render in this environment. Re-run `npm run test:zuix:browser` on a supported runner and expand to visual snapshots, responsive/dark/motion variants and CSSOM checks.
- **ZUIX-82-FRAMEWORK (P1):** Real installed React/Vue/Vite and Next/Nuxt build smoke matrices remain unverified; scope claims to demonstrated integrations.
- **ZUIX-82-SCALE (P2):** Real-world large content sets, memory bounds and cross-platform watch behavior need dedicated Section 83/84 profiling.
- **RELEASE-66-LOCK (P0):** 14 previously identified unresolved npm dependency lock records continue to block clean workspace installation.

**Next planned section:** Section 83 — package-only real-service and cross-runtime integration lab. This is a source/local milestone, **not final production/browser certification**.
