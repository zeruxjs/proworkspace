# Section 37 — Media, Asset Manager, AI and Knowledge Retrieval

Base: `proworkspace-full-updated-hooks-typescript-lint-validation.zip` (Section 36).

## Scope

This pass expands four application-facing packages that had functional but narrow foundations. APIs are modular and the existing primary exports are retained. It does not change ZSRV, the frontend, or any deployment files.

### @zeruxjs/media

- `createMediaResponse(store,id,{request,downloadName,inline,cacheControl})` returns Fetch `Response` for GET/HEAD with ETag, If-None-Match, If-Range, single `bytes=` ranges, 206/304/416, safe attachment headers, no-sniff and private no-store by default.
- `uploadMediaRequest(store,request,options)` uploads raw Fetch bodies without buffering; content length checks, MIME declaration, size limits and cancellation.
- `streamRange()` implements bounded file reads, close-on-cancel and `O_NOFOLLOW` for symlink-safe opened files. Metadata reads also avoid symlink following, use 8 KiB maximum and validate key metadata fields. The root directory cannot contain symlink components. `list({includeExpired:true})` explicitly supports validated expired records.
- The existing `download()` continues to verify full-file SHA-256. Streaming does *not* verify SHA-256, to avoid buffering an untrusted upload; do not infer stream-level integrity validation from size checking.

### @zeruxjs/asset-manager

- Variants with validated URL, value, and per-variant metadata; `resolve(id,variant)` and `listAssetVariants(asset)`.
- Atomic `apply()` with add/update/remove operations and optimistic `revision` conflict checks; `AssetRevisionError`.
- Existing v1 snapshot structure retained, adding optional `revision` for persistence.
- Atomic catalog writes with size caps and restrictions on file type and symlink targets. Bounded reads and atomic validation on restore.

### @zeruxjs/ai

- `AiProvider.stream()` and client `stream()` / `streamComplete()`; OpenAI-compatible text delta parsing from fragmented UTF-8 SSE frames, respecting `[DONE]`, MIME validation, byte caps and network cancellation.
- `withConcurrencyLimit` provides FIFO limits for both buffered and streamed calls, bounded queueing, abortable queue waits, and read-only status.
- Retry only on explicitly retryable `AiProviderError`s; honors Retry-After bounded by max delay, aborts waiters, never retries a stream after partial output.
- Provider requests reject redirects and overwrite caller-provided credentials with the configured Bearer token.
- No claim of OpenAI Responses API or tool-call streaming support; only text content deltas are emitted.

### @zeruxjs/ai-model

- `chunkDocument()` produces deterministic overlapping chunks with source metadata and bound controls.
- `retrieveEvidence()` and `createEvidencePrompt()` provide limited-length excerpts and references, so applications can render citations from actual source records.
- `createGroundedAssistant(base,provider)` connects any compatible chat provider to retrieved knowledge, returning generated answers alongside actual evidence, including stream support.
- `saveKnowledgeBase` / `loadKnowledgeBase` use bounded snapshots, restrictive writes, atomic replacement and symlink rejection.
- Bounded document contents and metadata validation.
- The package remains **lexical retrieval**, not a trained neural model. Prompts and generated citations still require application-level trust and verification.

## Testing

- Scoped strict TypeScript compiles for the four packages.
- Existing tests plus added runtime regressions for ranges, upload/expiry and symlink behavior; revisions, variants, persistence; streaming SSE fragmentation, request safety and retry/concurrency; chunking, evidence budgeting, provider bridging and snapshot persistence.
- No full monorepo build or real hosted AI-provider request; provider tests use local mocked Fetch responses.
- The changed-only archive contains only source, tests, READMEs, package manifests, lockfile and this document, and reconstructs the new full ZIP against the Section 36 baseline. `dist`, `node_modules`, caches and temporary validation tools remain excluded.

## Production constraints

The media store and asset catalog use local files; distributed writes and shared hosting require external locks or databases. Media authorization and MIME/antivirus checks must be enforced by application routes. The AI provider protocol is the Chat Completions SSE subset, with bounded text events only. Keyword retrieval does not guarantee factual correctness and untrusted document content must not be treated as trusted instructions.
