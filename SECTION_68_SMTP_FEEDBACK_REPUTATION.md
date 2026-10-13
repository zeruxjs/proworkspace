# Section 68 — Verified outbound SMTP envelopes, failover, feedback and sender reputation

**Scope:** ZeruxJS/ZyroJS package ecosystem only; no AIO application infrastructure.

**Status: implementation complete and selected offline tests passed; live SMTP, provider-webhook, Redis, and clean-install certification OPEN.** Section 66's npm-registry lockfile blocker is unchanged. Section 69 will handle transactional outbox/journal consistency.

## SMTP submission status is NOT delivery confirmation

`@zeruxjs/email` exports `classifySmtpAcceptance(intended,providerResult)` and `describeSmtpOutcome(...)` and extends `EmailResult` with `submissionStatus` and `acceptanceComplete`. These classify **only SMTP envelope responses**:

- `accepted`: provider enumerated all intended recipients as SMTP-accepted; **not proof of downstream delivery**.
- `partial`: provider enumerated a mixture of accepted and rejected recipients; the whole envelope has an incomplete delivery outcome.
- `rejected`: provider explicitly rejected all intended envelope recipients.
- `unknown`: provider did not account for every recipient, returned unrecognized recipients, or reported contradictory results. Do **not** resend automatically.

Provider-returned addresses are validated against the originally requested To/Cc/Bcc envelope; unrecognized addresses never enter sender-reputation accepted counters. `options.onSmtpWarning({account,status,reason})` emits **PII-free reason codes**. The manager's tracking `onSent` hook is no longer run for envelopes with zero verified accepted recipients; telemetry failures do not cause duplicate SMTP submission. A resolved transport call alone is not proof of SMTP acceptance. Legacy custom transports returning `{}` now have `submissionStatus:'unknown'`.

The `@zeruxjs/queue` durable delivery processor recognizes the explicit `submissionStatus` returned by the sender, if supplied:

| Sender result | Durable state | Automatically re-send? |
| --- | --- | --- |
| `accepted` | `sent` (meaning SMTP accepted, **not inbox delivered**) | No |
| `partial` | `uncertain` | **Never** |
| `unknown` | `uncertain` | **Never** |
| `rejected` | `rejected` terminal | No |
| Legacy custom callback returning void/unknown shape | Previous callback contract (sender must self-verify) | No after entering `sending` |

Applications integrating an EmailManager with the durable queue should return its `EmailResult` to the processor, not discard the return value. Partial recipient acceptance must be reviewed manually. This Section 68 change does **not** implement a transactional outbox, exactly-once SMTP or compensation for partial delivery.

## Explicit preflight failover, never an SMTP retry

```ts
const result=await emailManager.sendWithVerifiedFailover(
  {to:'recipient@example.org',subject:'Hello',text:'Hello'},
  ['smtp-primary','smtp-backup']
);
console.log(result.account,result.submissionStatus);
```

This API checks `transport.verify()` before calling `send()` **exactly once** using the first verified enabled account. If the first account cannot verify, a second explicitly specified account may be chosen. Custom transports **without `verify()` do not qualify** as verified failover choices. If every preflight verification fails, the manager throws `EMAIL_NO_VERIFIED_TRANSPORT`, and no message is submitted. If SMTP `sendMail()` fails or times out after the preflight, the manager **does not try the backup**: SMTP may have accepted the first submission despite the error. All account choices and sender domains must be authorized by the host and configured for SPF/DKIM/DMARC alignment. If the caller sets `message.account`, it must match the first candidate.

## Stronger outbound TLS and signing configuration

- `ignoreTLS:true` and `requireTLS:false` on STARTTLS SMTP are rejected.
- An explicit `secure:false` on port 465 is rejected.
- Non-465 SMTP defaults to requiring STARTTLS when constructing Nodemailer transports. This is an intentional secure-default change; unsupported plaintext development relays must supply a custom transport and never be used for sensitive mail.
- TLS minimum version, SMTP connection/greeting/socket timeouts and DKIM domain/selector/key settings receive stricter validation.
- Password, OAuth2 and injected transports remain supported; actual OAuth2 provider token renewal is a provider-dependent live integration requirement.

## Safer signed provider feedback batches

`createMarketingFeedbackEndpoint` still requires the **host-provided signature verifier** (provider-specific canonicalization, secret rotation, timestamp and replay-window validation belong to the host). The endpoint now validates the *entire signed batch* before modifying suppression, reputation or provider-outcome stores:

- Rejects invalid event kinds/IDs/times and spoofable `manual` administrative suppression events.
- Validates recipient addresses, host-derived sender account mapping, and provider/campaign/message attribution.
- Validates all events before writes: an invalid later entry cannot cause a partial **input-validation** side effect from an earlier entry.
- Deduplicates identical event IDs within one signed batch, rejecting conflicting reused IDs.
- Bounded request bodies and `maxEvents` (default 100), no-store responses, rejects unsigned requests.
- Verified `delivered`/`deferred` notices go only to the provider-outcome ledger and do **not** trigger recipient suppression.
- Verified hard-bounce/soft-bounce/complaint notices continue through suppression, reputation and optional provider-outcome stores.

**Important limitation:** The endpoint still writes to multiple independent stores non-transactionally. A *storage* failure after earlier committed writes returns HTTP 503; retries must be idempotent, and replay deduplication windows must be sized for provider retry schedules. The domain-specific provider verification callback MUST resolve account and delivery identities using authenticated metadata, not unsigned message fields. Provider outcome ledgers cannot guarantee a complete universe of events. Failure to receive provider feedback must never be portrayed as verified delivery.

## Email account manager integration example

```ts
const manager=createEmailManager({
  accounts: [/* SMTP settings or injected transports */],
  reputation: {
    checkBeforeSend: (account,purpose) => reputation.checkBeforeSend(account,purpose),
    recordAccepted: (account,email,id) => reputation.recordAccepted(account,email,id)
  },
  onSmtpWarning: ({account,status,reason}) => {
    auditLogger.warn({account,status,reason}); // no email addresses or credentials
  }
});

const outcome=await manager.send({
  to:'customer@example.org',subject:'Your receipt',text:'Thanks',purpose:'transactional'
});
if(outcome.submissionStatus!=='accepted') {
  // Surface for manual review or durable uncertainty handling; NEVER blind SMTP retry.
}
```

For **marketing** messages, the prior opt-in consent and suppression gates continue to run both before rendering and immediately before SMTP. One-click unsubscribe metadata continues through the existing preferences service. Activity/open/click tracking remains separately opt-in per send and does not imply marketing consent.

## Opt-in live SMTP interoperability checks

Live SMTP tests are included as `packages/@zeruxjs/email/test/smtp-live-optional.test.mjs`. They are skipped by default, have no embedded credentials, and do not send mail unless specifically enabled:

```bash
cd apps/proworkspace
npm ci
npm run build -w @zeruxjs/email
ZERUX_TEST_LIVE_SMTP=1 ZERUX_TEST_SMTP_HOST=host.example.test \
ZERUX_TEST_SMTP_PORT=465 ZERUX_TEST_SMTP_USER=test@example.test \
ZERUX_TEST_SMTP_PASSWORD="(inject via secret manager)" \
node --test packages/@zeruxjs/email/test/smtp-live-optional.test.mjs
```

The optional **send-one-test-email** assertion additionally requires `ZERUX_TEST_SMTP_SEND=1` and `ZERUX_TEST_SMTP_RECIPIENT`, using a disposable mailbox owned by the operator. These checks were **not run live in this environment**; Nodemailer and registry dependencies remain unavailable, and no SMTP-provider credentials were supplied. Provider-signature interoperability must also be tested with each provider's documented webhook scheme.

## Release verification and remaining gates

- Email and Queue package builds and tests pass using local package tooling; new injection regressions cover partial/unknown/rejected SMTP, no automatic uncertain replay, provider batch validation, preflight failover, conflicting idempotency, STARTTLS validation and signed batch deduplication.
- Real SMTP, OAuth2 refresh, DKIM/SPF/DMARC alignment, outbound attachments with installed Nodemailer, real provider feedback retries and high-volume distributed Redis have not been certified.
- Other package regression tests remain available; Section 66's full clean `npm ci` and 42-workspace build are blocked by unavailable npm registry resolution in this container.
- Section 69, not 68, is responsible for atomic queue outbox/journal and crash consistency. No claims of exactly-once mail or provider confirmation are made here.
