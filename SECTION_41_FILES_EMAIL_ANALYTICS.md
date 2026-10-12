# Section 41 — Storage, Email and Analytics

Added three reusable @zeruxjs packages: `files`, `email`, `analytics`, and integrated Files-backed storage with Media. Files supports multiple named backends including encrypted local S3-lite and official AWS SDK S3-compatible endpoints (custom endpoint, region, path-style, credential profiles, assumed role ARNs, OIDC web identity), CloudFront URL signing, Fetch streams, access policies, and opt-in byte cache. Email supports multiple SMTP/OAuth2 accounts, reusable templates, sanitized/inlined HTML and table layouts, recipient filtering, saved templates and suppressions, in-memory queue/retries, Files attachments, and opt-in tracking hooks. Analytics supports a configured named DB connector, server-side events, a bounded browser collector, a browser client, and signed email open/click endpoints.

## Explicit failure policy

- Analytics is optional and best-effort: disconnected/missing DB, invalid samples and insertion/query errors emit deduplicated warnings, not exceptions. Collection can be disabled at runtime.
- An email send can opt into open, click and campaign tracking per message or via send options; account defaults cannot silently enable it. `tracking:false` always disables it for one send.
- Instrumentation, tracking callbacks and analytics warning handlers are isolated from SMTP delivery and must never cause duplicate sends. Signed pixels and redirects remain usable when the analytics DB is unavailable.
- The event model preserves opaque message ID, account and campaign marker for future marketing/queue integration; it is not yet a durable marketing campaign platform.

## Verification

Focused isolated TypeScript builds and Node test suites cover Files local/S3-compatible adapters, Media integration, Email, and Analytics including fail-soft, shutdown and tracking opt-out cases. S3 and SMTP integration uses injected clients/transports rather than live cloud credentials or servers. No complete workspace build was run. See individual package READMEs for exact API and limitations.

## Known constraints

Local S3-lite offers bucket/key operations but is not itself an S3 HTTP wire-protocol server. Third-party S3 protocol quirks, AWS IAM/STS, KMS and CloudFront require real infrastructure for end-to-end verification. Email queues are memory-only; permanent analytics loss can drop events. Resource-aware file access and HTTPS hosting need correct application authentication, RBAC, limits, malware screening, DNS/TLS and deployment policies. Cloud SDK/Nodemailer/HTML dependencies must be installed in the consuming workspace.

The originally planned cross-package application-lifecycle, real dependency-backed and production/development consistency work remains deferred to the next section.

The workspace package-lock was updated with the new workspace links/manifests but could not fetch an updated third-party dependency resolution graph in this offline validation environment. Run `npm install` with registry access before relying on `npm ci` for a clean deployment; this limitation is separate from the successful isolated TypeScript and offline tests.
