

## Section 53 — Queue operations and queued email delivery bridge

See `SECTION_53_QUEUE_OPERATIONS_EMAIL_BRIDGE.md` for bounded queue monitoring, explicit worker recovery controls, optional BullMQ event streams, and the trusted `email.deliver` worker adapter. Marketing consent remains independent of per-message email activity tracking.

### Section 54 — Queue operations and safe scheduled mail

Added opt-in authenticated queue operations dashboard, per-queue authorization and CSRF enforcement, durable CAS-based email delivery state machine with conservative handling of uncertain SMTP outcomes, and ID-only scheduled campaign batches. See `SECTION_54_QUEUE_DASHBOARD_DURABLE_MAIL.md` and `apps/proworkspace/packages/@zeruxjs/queue/README.md`.

### Section 55 — Marketing campaign planning

`@zeruxjs/email` now exposes persistent campaign definitions, segment-aware paginated planning, a signed provider feedback/suppression bridge, and an optional authenticated campaign console. `@zeruxjs/queue` can execute ID-only campaign planning jobs and enforce campaign status before durable SMTP attempts. Consent, bounce suppression and per-email activity tracking remain separate. See `SECTION_55_MARKETING_CAMPAIGNS_SUPPRESSION.md` for the required durable storage and delivery adapters.
