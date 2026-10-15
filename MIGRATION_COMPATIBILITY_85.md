# Public API and migration review — Section 85

**Release state: prerelease/source milestone; no stable-version promotion authorized.** The committed `apps/proworkspace/api-freeze.json` fixes package manifest entrypoints/visibility, versions and declared consumer constraints. It is **not** an exhaustive signature-level semantic API diff; actual TypeScript and runtime consumer compatibility are release gates.

## Changes requiring migration review

- **ZeruxJS (Sections 74–77):** Middleware that previously allowed a request to continue without calling `next()` now fails closed. Reserved service routes cannot be overwritten or removed by app routes. Any existing middleware relying on implicit continuation must be updated to explicitly call `next()` after authorization. Raw configuration is no longer exposed through a global runtime object; use the supported configuration/lifecycle interfaces.
- **Tags (Section 72):** Saving a tag container changes the **draft** only. A separate publisher permission and publish action are required to change the active version. Update existing admin flows that assumed autosave was a live deployment.
- **Reports (Section 73):** Tenant scoping, read/edit/export and sensitive-property scopes are distinct. Hosts must provide real authorization and tenancy resolvers; do not rely on client-provided identifiers.
- **Database (Section 74):** `createTenantDatabaseFacade()` is an explicitly scoped interface; the generic DB facade is not magically tenant-isolated. Migrations must use a host-provided exclusive transaction and engine-aware DDL policy.
- **Queue (Section 75):** Scheduler permissions, validation, and optional Redis Cluster prefix/connection options require explicit configuration; do not assume exactly-once job or email delivery.
- **ZyroJS (Section 81):** Effects/scopes and reactive DOM roots have deterministic disposal; call the returned cleanup/unmount interfaces instead of relying on garbage collection. Raw HTML injection is restricted; use safe VNode/attribute bindings. The `./dom` and `./network` exports are documented and locally packed.
- **Zuix (Section 82):** Unsafe arbitrary CSS values/selectors and out-of-project/symlink CSS paths are rejected. Confirm intended custom utilities and Vite integration against the stricter compiler. Public package code is split between the root, `./node`, `./vite` and `./theme` entry points.

## Version and environment policy

Public versions currently range from `0.0.1-alpha.*` to `0.1.0`/`0.2.0`; no general stable support promise or automatic semver upgrade is made. Node 22 was locally exercised for representative packages, but all packages have not passed clean Node 24, Windows or macOS acceptance. `zyrojs` and `zuix` each declare Node `>=20`; that statement does not extend to every other package or imply a verified full runtime matrix.

Before releasing a breaking change: identify imported paths and TypeScript signatures, provide a tested consumer migration and deprecation path, choose a reviewed package version, update tests/docs, and only then approve an `api-freeze.json` change. All dependent/private workspaces and transitive consumers must have a compatible version plan. If a previously published version exists, preserve its reproducibility and use a new semver version rather than rewriting a released artifact.

**No release authorization:** Review of this document does not authorize `npm publish`. See `RELEASE_DECISION_85.md` for the concrete NO-GO evidence.
