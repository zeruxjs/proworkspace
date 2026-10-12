# @zeruxjs/email

Multiple independent SMTP connections, Nodemailer transport reuse, password or OAuth2 authentication, optional pooling, DKIM, typed templates, email-safe HTML and tables, recipient suppression, batching, transient retry queues, attachment streams from `@zeruxjs/files`, and opt-in email analytics hooks.

```ts
import {createEmailManager,createEmailLayout,emailRow} from '@zeruxjs/email';
import {createEmailTrackingService} from '@zeruxjs/analytics/email';

const tracking=createEmailTrackingService({
  analytics,baseUrl:'https://events.example.com',secret:process.env.EMAIL_TRACKING_SECRET!
});
const mail=createEmailManager({
  accounts:[
    {name:'transactional',smtp:{host:'smtp.example.com',port:587,requireTLS:true,
      auth:{type:'password',user:'sender@example.com',pass:process.env.SMTP_PASSWORD!}},
      defaults:{from:'Sender <sender@example.com>'}},
    {name:'notifications',smtp:{host:'smtp.example.com',port:465,secure:true,
      auth:{type:'oauth2',user:'alerts@example.com',clientId:process.env.OAUTH_CLIENT_ID!,
        clientSecret:process.env.OAUTH_CLIENT_SECRET!,refreshToken:process.env.OAUTH_REFRESH_TOKEN!}},
      defaults:{from:'Alerts <alerts@example.com>'}}
  ],
  tracking,files // optional named Files manager for attachment streaming
});

await mail.send({account:'transactional',to:'person@example.net',subject:'Order receipt',
  html:createEmailLayout(emailRow(['Item','Price'])),text:'Order receipt',
  tracking:{enabled:false}});

// Marketing/notification tracking is a PER-SEND explicit choice.
await mail.send({account:'notifications',to:'person@example.net',subject:'News',
  html:'<p>View our news</p>',text:'View our news'},
  {tracking:{enabled:true,opens:true,clicks:true,campaign:'october'}});

await mail.close();
```

Tracking **does not run automatically**, even if it appears in an account default. `{tracking:false}` in send options overrides message tracking. Successful delivery is never retried because of tracking instrumentation, database writes, or warning callbacks. The open pixel has approximate accuracy (images can be blocked, cached or prefetched); clicks and opens do not imply explicit human engagement. Tracking links exclude unsubscribe URLs and should be enabled only when lawful and disclosed to recipients.

`convertHtmlToEmail` sanitizes and inlines a supported subset of HTML/CSS, `createEmailLayout`, `emailRow`, `emailButton` produce email-client-friendly table markup, and `createTemplateRegistry` manages reusable templates with escaped variables. Arbitrary CSS Grid/Flex and complex interactivity cannot be made universally compatible across mail clients.

Delivery safeguards include `createRecipientFilter` for allow/block/suppression lists, encrypted-transport policy options, optional `authorize` hook for `@zeruxjs/auth`, bounded batches, idempotency keys scoped to a manager lifetime, and a bounded in-memory transient-error queue. The included `createEmailQueue` is **not durable**; a future marketing/queue package should persist scheduling, suppression, campaign state and send IDs before delivery. Never use open/click telemetry as a substitute for unsubscribe/consent handling.

For file attachments supply `files` when creating the manager and set `attachments:[{filename:'manual.pdf',file:{storage:'object',bucket:'uploads',key:'manual.pdf'}}]`. Streams are bounded by the configured attachment limits. Avoid local path attachments unless explicitly allowed for trusted server code.

## Section 46: Marketing permission is separate from activity tracking

`purpose:'marketing'` requires one recipient and an affirmative subscribed record in an injected `preferences` service. Marketing unsubscribe endpoints are hosted by ZeruxJS and require a POST to modify preference state. `purpose:'transactional'` remains independent of the marketing permission store. Neither an opt-in subscription nor an unsubscribe silently changes `tracking` for any message. Tracking is still off unless explicitly requested *on the send*, and can be overridden by `{tracking:false}`.

For tracked deliveries, `EmailResult.trackingId` identifies activity reports (an opaque UUID), but is only supplied when tracking is requested and a tracking service is injected. `message.tracking` accepts `opens`, `clicks`, `downloads`, and a list of exact HTTPS `downloadLinks`. For per-email first/last timestamps and counts call `tracking.getActivity(result.trackingId)` in `@zeruxjs/analytics`. A link click is **not** a proven completed download. Attachments are not trackable after delivery. See root `SECTION_46_EMAIL_CONSENT_AND_ACTIVITY.md`.

## Section 55 — Marketing campaigns

Use `createCampaignPlanner` for persistent, segmented recipient paging and stage-before-enqueue checkpoints, `createDatabaseCampaignStore` for atomic multi-node document CAS, `createMarketingSuppressionService` with a shared store for hard/soft bounce and complaint handling, and `createCampaignDashboard`/`createMarketingFeedbackEndpoint` for *opt-in* authenticated routes. `createCampaignAnalyticsReporter` can emit best-effort operational events for internal Reports. Never assume memory stores provide restart/multi-server safety; provider webhooks must verify raw-body signatures.

For full configuration, queue-worker integration, privacy controls, and deployment restrictions, see the project root `SECTION_55_MARKETING_CAMPAIGNS_SUPPRESSION.md`.
