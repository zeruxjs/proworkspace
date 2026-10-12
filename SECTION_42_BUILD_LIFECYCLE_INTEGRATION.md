# Section 42 — Build Workflows and Runtime-Service Lifecycle

## Scope

This pass integrates previous Files, Email and Analytics packages with ZeruxJS application bootstrap and adds a real application-build flow. It also replaces the fragile workspace-builder script with a tested dependency scheduler and protects application HTTP generations during reloads.

### Workspace build and dependency validation

Run from `apps/proworkspace`:

```bash
node scripts/build-workspaces.mjs --dry-run --json
node scripts/build-workspaces.mjs --scope zeruxjs --dry-run
node scripts/build-workspaces.mjs --scope zeruxjs --with-dependents --concurrency 2
npm run build:workspaces
npm run test:workspace-tools
```

The planner enumerates workspaces from `package.json`, follows local build dependencies, sorts deterministically, rejects unknown scopes and cycles, supports concurrent execution, aborts when a child build fails, and can verify declared `main`, `types`, `bin`, and `exports` artifacts (`--verify`). `--dry-run` never invokes package builds. Optional peer dependencies are *not* forced into the build graph. The workspace scripts must be used with installed packages to perform real builds.

### `zerux build` now produces application output

The ZeruxJS CLI `build` command no longer prints a placeholder. It compiles TypeScript source files with the project's TypeScript compiler, copies JavaScript and application assets, and stages the output under `.<service>/build/` (or the configured `outDir`). The entire directory is switched only after successful preparation; a failed build leaves the last complete output intact. Manifests include a SHA-256 digest of the input files, counts, and source-directory mapping. Symbolic links in source trees and output paths (including symlinked parent directories), output paths nested within an input source directory, dangerous path traversal, excessive individual file size, and likely secret files are rejected.

After `zerux build`, `zerux start` selects the completed build when its valid manifest is present. `zerux dev` continues to use source modules for fast iteration. The build is *transpilation*, not a substitute for a project-wide typecheck, linter, dependency audit, or external bundle optimizer. Compilation requires `typescript` installed in the application. Generated files are owned by the build user and use restrictive permissions; align the production execution user accordingly.

### Runtime service configuration

`ZeruxConfig` accepts optional `files`, `analytics`, and `email` definitions in addition to the existing `db` and `cache`. The initialization order is DB → Cache → Files → Analytics → Email; cleanup is reversed. An initialization failure in a required service closes every already started service. Analytics initialization is best effort and cannot abort application startup. File and SMTP credentials are removed from the public runtime config after initialization. Plugins and request handlers access managers through `api.service('files' | 'email' | 'analytics' | 'database' | 'cache')` and `context.services.get('files')`.

```ts
export default (api) => {
  const files = api.service('files');
  const email = api.service('email');
  const analytics = api.service('analytics');
  // Explicitly authorize file and email operations in application code.
};
```

Example configuration (values shown only for structure; supply secrets through environment variables):

```ts
const config = {
  db: { /* named connectors */ },
  files: {
    defaultStorage: 'uploads',
    stores: [{ name: 'uploads', type: 'local', root: './data/uploads' }]
  },
  analytics: { analytics: 'reporting', enabled: true },
  email: {
    accounts: [{ name: 'transactional', smtp: { host: 'smtp.example.com', port: 465, auth: { type: 'password', user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } } }]
  }
};
```

Each runtime generation owns its service scope. Hot reload prepares the next scope and worker set before switching to it. A failed preparation disposes partial resources and keeps the previous generation. After a successful switch, old HTTP responses are drained before old workers, protocol sessions, and service managers are closed; lingering responses have a bounded 30-second shutdown deadline. Existing requests keep their original handler.

### Manifest safety

`runtime.json` now redacts recursive password, secret, token, API-key, credential and security configuration instead of serializing them. This does not replace secret management or filesystem-level access controls.

### Validation

Focused test suites cover workspace dependency planning, cycle detection, cancellation, export artifact verification, build rollbacks, nested-output and ancestor-symlink denial, real TypeScript transpilation, isolated service scopes, missing analytics, reverse cleanup, request stream draining and manifest redaction. The final selected suites passed 32 tests (25 ZeruxJS and 7 workspace-tool tests), and the workspace planning CLI successfully produced a dry-run build graph. The affected ZeruxJS modules compile with temporary typings for uninstalled external dependencies. No full project build or real SMTP, database, or AWS connection is claimed.

### Known remaining work

- Full `npm ci`, all-workspace typechecking and all-provider integration require the actual dependency installation and service environment.
- Production compilation does not optimize or bundle frontend CSS/JS assets or enforce application-wide type safety.
- Shared process globals in legacy DB/cache facades should ultimately be replaced with generation-scoped access exclusively; new `service()` APIs supply a scoped path but cannot automatically upgrade old imports.
- Service shutdown is integrated into reload and initialization error paths. Coordinated process-exit hooks for every external ZSRV shutdown mode need full-process certification.
