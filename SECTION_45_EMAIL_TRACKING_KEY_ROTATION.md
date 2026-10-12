# Section 45 — Email Tracking Key Rotation and Backwards Compatibility

## Changes

Section 44 introduced encrypted tracking links but depended on a single immutable secret. Deploying a different secret would invalidate all unexpired tracked mail sent by the previous deployment. Section 45 provides **controlled rotation** while retaining per-send opt-in tracking, fail-soft analytics writes, and existing email/analytics routes.

### Key-ring configuration

```ts
export default {
  email: {
    accounts: [/* configured transport(s) */],
    tracking: {
      enabled: true,
      baseUrl: 'https://events.example.com',
      keyRing: {
        current: { id: '2026_nov', secret: process.env.EMAIL_TRACKING_NOV_SECRET },
        previous: [{ id: '2026_oct', secret: process.env.EMAIL_TRACKING_OCT_SECRET }]
      },
      acceptLegacyHmac: false,
      allowedLinkHosts: ['app.example.com']
    }
  }
};
```

- **Choose one:** `secret` (existing legacy configuration), or `keyRing` (rotation). Supplying both is invalid; the optional tracking service fails soft at bootstrap rather than failing email startup.
- `keyRing.current` signs new tracking URLs; `keyRing.previous` lists up to **four** verification-only keys. Each key requires a unique public ASCII `id` (letters/digits/underscore/hyphen, 1–32 characters) and a secret of at least 32 bytes. IDs must not contain private information.
- New key-ring URLs are `v3.<key-id>.<base64url>` with random 96-bit IVs, AES-256-GCM authentication, key IDs bound as authenticated additional data, and domain-separated encryption keys. New links include the same opaque account, message, campaign, expiry and destination fields as v2. The URL is not anonymous; service and email recipients still see that a tracking URL exists.
- Old `v2.` AES-GCM URLs remain decryptable by any key in the ring (v2 URLs had no key ID). Existing signed `v1`-style Section 43 HMAC URLs remain supported unless `acceptLegacyHmac:false`. Legacy HMAC signatures are verified in constant time and are still subject to the existing expiry and HTTPS/allowlist policies.
- Existing `secret` configurations **continue creating v2 links** unchanged; no migration is mandatory. Newly issued key-ring links are v3. Token parsing also rejects non-canonical base64url to prevent multiple textual encodings of an authenticated payload.

### Recommended multi-instance deployment procedure

1. **Provision:** Add the upcoming signing key to *verification sets across all replicas* before any instance starts signing with it. For example, keep key A current and add key B to `previous` across the fleet.
2. **Activate:** Switch the active key to B, with A in `previous`, across the fleet. Replicas on both configurations can verify each other's links during the rollout.
3. **Retain:** Keep A in `previous` at least until its last-issued links expire (max token lifetime is currently 30 days). Remove A only if you deliberately accept invalidating any older links. Rotate again by repeating the process.
4. **HMAC migration:** Only set `acceptLegacyHmac:false` after signed Section 43 links are no longer required. This does not disable encrypted v2 or v3 links.

Store secrets in environment/secret-management infrastructure, propagate them consistently, and never log them. Multiple running apps cannot coordinate rotation automatically; operator deployment sequencing remains necessary. Do not assume this supplies one-click unsubscribe, durable email queues, user consent, or guarantees of unique human opens.

### Compatibility / failure behavior

| Issued link | Single `secret` configuration | Rotating key ring |
| --- | --- | --- |
| Section 43 signed HMAC | Valid when issued with that secret, unless disabled | Valid when issuing secret remains in ring and HMAC compatibility enabled |
| Section 44 encrypted v2 | Valid with the issuing secret | Valid when issuing secret remains in ring |
| Section 45 encrypted v3 | Not supported | Valid when matching key ID and secret are in ring |

Malformed or expired tokens, mismatched key IDs, retired keys and disallowed HTTPS destinations return 404. Invalid tracking key-ring config warns/degrades only the optional tracking subsystem; it must not block application startup or actual email delivery.

### Verification

- Analytics: 24 passing tests, including 5 new key rotation, tampering, retirement and compatibility tests.
- ZeruxJS: 37 passing tests across framework runtime, service endpoints, build, reload, networking, and worker lifecycle, including one new Section 45 HTTP service-generation test.
- `@zeruxjs/analytics` TypeScript build passed with temporary Node typings resolved from the environment. Main ZeruxJS TypeScript compilation still reports existing unresolved workspace package typings without a full dependency installation; compilation emits testable code, but is not certified clean.
- No live SMTP, production TLS ingress, distributed fleet rollout or production database was exercised. Run a staged blue/green rollover before relying on this rotation mechanism for customer communications.
