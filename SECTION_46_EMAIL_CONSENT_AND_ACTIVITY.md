# Section 46 — Marketing Email Preferences and Independent Email Activity Tracking

## Separation of responsibilities

**Marketing permission and email activity tracking are two different concerns.**

1. `@zeruxjs/email` checks recipient subscription state **only for** `purpose:'marketing'` and generates an RFC 8058-style one-click unsubscribe header. Without a configured preference service, unreadable preference storage, or an affirmative subscribed record, marketing delivery is rejected before SMTP. Transactional email is not blocked by the marketing preference service. Each marketing message has exactly one `To` recipient; no `Cc` or `Bcc`.
2. `@zeruxjs/analytics` tracks email activity **only when tracking is enabled for that specific send**, including transactional messages. Subscription status neither enables nor disables analytics instrumentation. Open/click telemetry may have additional privacy or consent requirements in your jurisdiction, which the application must enforce before enabling it.
3. A multi-recipient transactional send shares one tracking ID; send separate messages for per-recipient reporting. A normal email **attachment has no reliable remote download signal**. It is transmitted with the email. No download counter is fabricated for attachments.

## Basic per-send tracking

```ts
const result = await mail.send({
  account:'transactional',to:'customer@example.net',subject:'Your files',
  text:'Your report is ready',
  html:'<a href="https://app.example.com/reports/report.zip">Get report</a>',
  purpose:'transactional',
  tracking:{
    enabled:true,
    opens:true,
    clicks:true,
    downloads:true,
    downloadLinks:['https://app.example.com/reports/report.zip']
  }
});
// result.trackingId: opaque UUID, only when tracking is requested and a tracking service is available.
const activity = await tracking.getActivity(result.trackingId!);
// activity?.sentAt, firstOpenedAt, lastOpenedAt, opens,
// firstClickedAt, lastClickedAt, clicks,
// firstDownloadClickedAt, lastDownloadClickedAt, downloadClicks,
// firstDownloadedAt, lastDownloadedAt, downloads, downloadedBytes, links[]
```

- All timestamps are epoch milliseconds, suitable for `new Date(value)`.
- Set `tracking:false` on `mail.send(message,{tracking:false})` to force all tracking off, regardless of the message field. `tracking:{enabled:true,opens:false,clicks:true}` records only clicks and delivery. Nothing is tracked just because a message is marketing, subscribed, or uses an email account with defaults.
- Download links can be declared explicitly with `tracking.downloadLinks:[...]`, or marked in a trusted HTML anchor with `data-track-download`/`data-email-download`/`download`. `downloads:false` turns off download-link classification. `clicks:false` disables link wrapping, including download-link clicks. Tracking URLs only proxy permitted HTTPS destinations.
- `downloadClicks` counts visits to marked download links, **not successful downloads**; email scanners or security tools can follow links without a human. Per-link counts use a SHA-256-based opaque link identifier and exclude recipient addresses/raw destination URLs. For actual successful downloads, the application's file-delivery endpoint must call a server-side hook *after successful delivery*:

```ts
await tracking.recordDownload({
  id:result.trackingId!,account:'transactional',
  url:'https://app.example.com/reports/report.zip',
  bytes:downloadedByteCount
});
```

The application must associate that download with the email's tracking ID using its authenticated download links or server-side session context. This hook is never invoked automatically by a tracking redirect, and does not inspect email attachments. Only call it when you can verify the file was served; streaming response completion, aborted transfers, and browser download/save semantics require application-specific handling. `recordDownload()` itself is trusted server-only, not a public unprotected endpoint.

For analytics, the best-effort events are `email.sent`, `email.open`, `email.click`, `email.download_click` and `email.download`, with an opaque `message_id`, account, campaign, and optional hashed `link_id` / confirmed byte count. Data is never guaranteed to be complete: blocked pixels, link prefetches, offline DBs and telemetry wait deadlines affect measurement.

## Activity aggregation storage

`createEmailTrackingService` exposes `getActivity(id)` and accepts an optional `activityStore` implementing `{record(event):Promise<void>, get(id):Promise<EmailActivitySummary|null>}`. Without a store it uses `createMemoryEmailActivityStore()` with a bounded 10,000-message default. **This in-memory summary is lost on restart and is not coherent across multiple servers.** Provide a shared, durable, atomic implementation for multi-server use and future marketing-queue workers. Event writes to the existing analytics DB continue independently, and telemetry failures/slow writes must not block SMTP delivery or redirects. Aggregation reads also fail soft and are time-bounded.

## Marketing permission service

```ts
import {createEmailPreferenceService} from '@zeruxjs/email';
const preferences=createEmailPreferenceService({
  baseUrl:'https://mail.example.com',
  secret:process.env.EMAIL_PREFERENCES_SECRET!,
  store:sharedConsentStore // implement durable get/set with commit-before-resolve semantics
});
await preferences.subscribe('customer@example.net',{source:'confirmed-signup',proof:'verified-consent-reference'});
const subscribed=await preferences.isSubscribed('customer@example.net');
```

- Explicit proof is required for `subscribe`. A shared `ConsentStore` is required for production/multi-instance deployments; default in-process memory is for local development only.
- Marketing email includes HTTPS `List-Unsubscribe` and `List-Unsubscribe-Post` headers. The signed, encrypted URL does not expose the address. `GET`/`HEAD` cannot unsubscribe users (link-scanner-safe); an RFC-style `POST` body is required. A POST writes `unsubscribed` before returning success, and storage failure returns 503 so callers can retry.
- The endpoint is mounted by ZeruxJS when `email.preferences.enabled:true`. Unlike analytics (which fails soft), failure to mount a required unsubscribe endpoint aborts startup, preventing marketing emails being sent with broken unsubscribe links.
- Email preference state controls *whether marketing email is delivered*. Tracking policy controls *whether the enabled analytics service instruments a particular message*. Neither is implicitly derived from the other.

## Verification and known limits

- `@zeruxjs/analytics`: 29 tests passed, including independent summary, first/last timestamps, per-link counts, download clicks vs confirmed download hook, and storage timeout resilience.
- `@zeruxjs/email`: 24 tests passed, including marketing consent/unsubscribe, transactional tracking after marketing opt-out, and no implicit tracking on subscribed marketing mail.
- Existing ZeruxJS HTTP/lifecycle tests were exercised. The main framework still requires a complete workspace dependency installation for an unconditional all-tests pass and production build certification.
- No live SMTP provider, persistent consent DB, production TLS ingress, real mail-client pixel behaviour, or completed binary download stream was exercised.
