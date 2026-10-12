# Section 36 — Framework hooks, TypeScript, lint tooling and HTTP validation

Baseline: Section 35 full updated project. This section implements four related packages as modular, independently testable libraries.

## @zeruxjs/hooks

- Replaced shared module-level render state with request-scoped AsyncLocalStorage.
- Stable rerender identity, functional state updates, reducers, refs, dependency-aware memoization and effect cleanup.
- Detects changed hook count/order and concurrent same-instance renders; prevents async renders from corrupting shared state.
- Async request-scoped contexts and nested provider overrides.
- Path alias registry with validation, private atomic file replacement, size limits and legacy loader compatibility.
- Stable API exports from `src/index.ts`, plus `./context`, `./state`, `./paths` subpaths.

The hook engine is server-side and does not independently schedule a browser rerender. Concurrent path-registry writers still require an external lock; atomic rename prevents truncated files, not lost updates.

## @zeruxjs/typescript

- TypeScript-to-ESM/CJS transformation, in-process diagnostics without emit, tsconfig generation with no overwrite by default.
- Optional esbuild bundling, a disposable CommonJS `require()` extension hook, and a Node ESM loader subpath.
- Source transformation and typechecking are separate by design.
- Verified native Node ESM execution of a `.ts` entry using the generated loader.

## @zeruxjs/lint

- Returns structured ESLint, Stylelint and Prettier results; combined runs aggregate counts and preserve failures.
- Source-file enumeration, exclusions for build/dependency directories and symlinks, file caps and 5 MiB formatting limit.
- Config loading via `file://` URLs instead of filesystem paths, symlink size checks, serial watched linting with disposal.
- `lintAll` runs all three engines, not just formatting. The engines remain declared package dependencies.

**Validation limitation:** ESLint/Stylelint/Prettier were unavailable in the extracted baseline. Adapter invocation and error propagation were tested using temporary local stand-ins, not full versions of the external engines. These stand-ins are excluded from both archives.

## @zeruxjs/validator

- Added a Fetch `Request` adapter supporting bounded streamed JSON input, schema validation, safely formatted client errors, and validated route handlers.
- Query parameter validation rejects prototype-sensitive names, excessive repeated fields and oversized URLs.
- Exported via package root and the `./http` subpath.

## Validation summary

- 9 hooks tests passed.
- 5 TypeScript tests passed.
- 2 lint helper tests passed; runner-contract smoke checks passed with temporary engine stand-ins.
- 7 validator HTTP tests passed.
- Isolated TypeScript compilation passed for all four packages.
- Full workspace build, external engine tests, and application integration tests were not requested and were not run.

No project files were deleted. The Section 35 baseline's historical `DELETED.txt` remains in the full ZIP unchanged; the delta ZIP only records deletions introduced by this section (none).
