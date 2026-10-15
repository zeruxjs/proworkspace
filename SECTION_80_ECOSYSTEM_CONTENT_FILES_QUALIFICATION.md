# Section 80/85 — Ecosystem packages, content and file workflows

**Date:** 14 October 2026 · **Scope:** package libraries only, not the separate AIO/server-manager application.  
**Baseline:** Section 79 full-project archive. **Result:** source implementation + local integration verified. External-provider / clean-install exit criteria remain open.

## Implemented and corrected

1. **`@zeruxjs/files`**: Uploading via Fetch now counts and validates `Content-Length` in the streamed producer before storage commits. Short and long declarations reject without deleting a different writer's object. Cross-store / native copies enforce destination MIME allowlists and destination maximum object size, including when a native driver supplies its own `copy` implementation. Encrypted local files remain private AES-256-GCM objects; the AWS S3 adapter and its signing features remain provider dependent.
2. **`@zeruxjs/media`**: Legacy media request streams apply length checking before the metadata commit. `createMediaResponse({inline:true})` forces unknown/executable MIME types to attachment. The modern files-backed media service now exposes `statAuthorized(id, request)` and `listAuthorized(request, pagination)`; both fail closed and apply the application's existing per-object read policy. Its previous `stat()` and `list()` remain **trusted server-only** APIs; callers must not serve their results directly in a public handler.
3. **`@zeruxjs/ai`**: Stream fallback also works when the primary provider only implements `chat` and fails before yielding. Aborted requests must not fail over. Already-emitted stream fragments remain fail-closed without switching models.
4. **`@zeruxjs/ai-model`**: Snapshot restoration rejects duplicate document IDs transactionally. Document IDs reject control characters, and query length is bounded. Evidence prompts JSON-quote untrusted document excerpts, retaining source references. This is lexical retrieval and an LLM prompt adapter: **it does not train weights or provide universal semantic retrieval**.
5. **`@zeruxjs/seo`**: Runtime sitemap change-frequency allowlist protects XML from untyped malicious values (TypeScript types are not runtime security boundaries).
6. **Content workflow**: Added a real local-disk integration using `@zeruxjs/files`, `@zeruxjs/media`, `@zeruxjs/asset-manager`, `@zeruxjs/search`, `@zeruxjs/feed`, `@zeruxjs/seo` and `@zeruxjs/ai-model`. It verifies private media authorization, catalog/search projections, server-generated RSS/sitemap and retrieval evidence. This test is local and **does not represent a cloud or browser test**.
7. **Retained package verification**: Offline build/test runner covers **Files, Media, Asset Manager, AI, AI Model, Search, SEO, Feed, Font, Share, Performance, Validator and Security**. Public packages retain their existing exported entry points; no placeholder implementations were substituted.

## Usage

```ts
import {createMediaFilesService} from '@zeruxjs/media';

const media = createMediaFilesService(files, {
  storage: 'local', bucket: 'content-bucket',
  authorize: (request, address, action, metadata) =>
    authorizeTenantMediaRequest(request, address, action, metadata)
});

// Always prefer request-bound methods in HTTP routes:
const detail = await media.statAuthorized(id, request);
const page = await media.listAuthorized(request, { limit: 50 });
// If objects were filtered out, `nextCursor` is suppressed to avoid exposing backend object-key cursors. Use a tenant-specific bucket or key prefix for complete pagination.
```

```sh
cd apps/proworkspace
npm run test:ecosystem:offline  # builds 13 packages, skips AWS-SDK-specific test
npm run test:ecosystem          # includes AWS SDK-injected tests; needs installed SDK
npm run verify:source          # isolated source verification
npm run verify:clean           # required clean-install release gate (currently blocked)
```

## Local evidence

| Gate | Result | Qualification |
|---|---|---|
| Scoped TypeScript package builds | 13/13 passed | Local TypeScript + injected Node typings; not registry clean install |
| Offline ecosystem regressions + new workflow | **97 passed, 0 failed, 0 skipped** | AWS SDK-dependent Files test deliberately excluded |
| Isolated source verification | 1,586 source files, 42 contracts, 33 tests | Source-only gate; not equivalent to `npm ci` |
| Workspace tooling | 36 passed, 0 failed | Developer-tooling unit suite |
| Live local disk streaming + permissions | Passed | Real filesystem, not a simulated filesystem |
| Live AWS S3, MinIO/RustFS, CDN signing | **Not tested** | SDK injected tests still required; verify each provider and multipart race semantics |
| External AI provider, embeddings, cloud media transforms | **Not tested/not claimed** | No real model or transformation service configured |
| Clean npm install and npm pack smoke | **Blocked** | Previously identified 14 unresolved third-party lockfile records |
| Browser and cross-OS run | **Not tested** | Headless Chromium and Windows/macOS CI still open |

## Important boundaries / release risks

- AWS SDK multipart uploads with create-only semantics require provider-specific race and policy testing; a preflight HEAD is not an atomic cross-writer guarantee. Signing a PUT does not itself enforce tenant application authorization; perform checks before issuing signed URLs and restrict credentials/buckets.
- Files' low-level manager methods, S3 `getClient`, Media's trusted `list`/`stat`, and Asset/Knowledge/Search in-memory stores operate within the host's authorization boundary. Reuse tenant-scoped services when exposing them as HTTP endpoints. Public CDN URLs do not imply object visibility permissions.
- `inline` media is restricted to an allowlist; browser CSP, MIME sniffing and antivirus scanning are host deployment concerns. The local media store verifies downloaded bytes, but partial-range streams provide size checks rather than an end-to-end digest for each range.
- Asset revisions, keyword search/knowledge snapshots, optional performance collection, font helpers, sharing, feed/SEO and validators are scoped helpers, not a complete CMS/CDN/AI-training suite. Do not describe them as fully fledged provider platforms.
- Existing live DB, SMTP, IMAP/POP3, Redis/BullMQ, CodeQL and registry-backed release gaps from previous sections remain open. Section 83 is the scheduled real-provider/cross-runtime lab and Sections 84–85 cover security/release decisions.

**Next:** Section 81 — standalone `zyrojs` reactive runtime qualification, with separate Section 82 `zuix` compiler qualification. Keep 85 package sections; AIO infrastructure is excluded.
