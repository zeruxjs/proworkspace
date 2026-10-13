# Security Policy

This policy covers the **ZeruxJS, ZyroJS, Zuix, ZSRV and `@zeruxjs/*` reusable packages** maintained in this repository. It does not cover a separately deployed AIO hosting application, the configuration of third-party mail providers, or third-party packages themselves.

## Supported Versions

The package ecosystem is currently in **pre-release development**. Package versions are **not synchronized**: for example, `zeruxjs` is at `0.0.1-alpha.3`, while other packages use `0.0.1-alpha.x`, `0.1.0-alpha.x`, `0.1.0`, or `0.2.0` version numbers in their manifests. These are **not** the example `5.1.x`, `5.0.x`, or `4.0.x` versions from GitHub's default security-policy template.

| Version or release channel | Security updates | Status |
| --- | --- | --- |
| Current maintained development branch | **Best effort** | Vulnerabilities are triaged and fixes are developed here; there is no guaranteed response SLA or maintenance commitment. |
| Existing `0.x` and `0.x-alpha` packages | **Not guaranteed** | Experimental/pre-release packages. Fixes may land on the maintained branch instead of being backported to each previously distributed version. |
| Older or abandoned snapshots, commits and tags | **No committed support** | Upgrade to a maintained version when a fix becomes available. |
| Future stable `1.0.x` | **Not released yet** | Stable-version maintenance policy will be defined before the first stable release. |

A **source section number** (such as Section 66) is a development milestone, not a package version or a promise of production security support. Package releases are not considered production-certified until their clean-build, integration, and security gates have passed.

## Reporting a Vulnerability

**Please report suspected vulnerabilities privately. Do not include exploits, credentials, customer data, or sensitive reproduction details in a public issue or discussion.**

1. Open the repository's **Security** tab and select **Report a vulnerability**, **if private vulnerability reporting is enabled**. Submit a concise description, affected packages/versions, impact, reproduction steps, and a safe proof of concept there.
2. If the private reporting option is not enabled, use an **existing private communication channel with the repository maintainers** to ask for a secure reporting channel. Do **not** publish the vulnerability details while requesting that channel. The project has **not published a verified dedicated security email address**, so please do not guess one.
3. If you cannot establish a private channel, defer sensitive details until a secure method is available. Public issues can be used only to request private-reporting instructions **without sharing the vulnerability itself**.

### What happens after a report?

The following are **best-effort targets, not contractual service-level guarantees**, while the project remains pre-release:

| Stage | Target |
| --- | --- |
| Acknowledgement | Within **3 business days** of receiving a report through an active private channel. |
| Initial triage | Within **7 business days** after acknowledgement, including a request for more information if needed. |
| Progress updates | About **every 14 calendar days** for confirmed, unresolved issues, or at an interval agreed with the reporter. |
| Resolution and disclosure | Severity- and complexity-dependent. We will coordinate mitigation, patches, and responsible disclosure; no universal fix deadline is promised. |

Accepted reports will be assessed for reproducibility, security impact, affected versions, remediation, and any need to notify users. If a report is declined or cannot be reproduced, we will explain the reason privately when a response channel is available. A maintainer may request a minimal reproducer or additional context. Fixes and advisories may be issued when confirmed and a safe disclosure plan is ready.

### Reporting guidelines

- Include the **package name and version or commit**, supported Node.js/runtime environment, vulnerability class, expected versus actual behavior, and a **minimal, non-destructive** reproduction where possible.
- Remove or redact **credentials, tokens, personal information, production mail, customer records, and other secrets**. Avoid sending raw inbox contents or private keys.
- Do not access data that you do not own, compromise other users, send unsolicited marketing emails, run denial-of-service attacks, or use destructive testing against systems without authorization.
- Notify maintainers before publicly disclosing an exploitable issue, and allow reasonable time for coordinated remediation. We welcome responsible research and will assess reports in good faith.

## Security Considerations for Integrators

These packages include security-relevant features such as session authorization, mailbox polling, SMTP dispatch, marketing consent, analytics collection, and user-provided HTML. **Installing a package alone does not guarantee secure production deployment.** Applications must configure trusted credentials, TLS, least-privilege database access, inbound mail scanning, authentication/CSRF on administrative routes, consent and suppression checks, rate limits, log redaction, safe HTML rendering, and appropriate data-retention policies. See each package's documentation for its specific security requirements.

This policy will be revisited before a stable `1.0` release, including an authenticated dedicated reporting contact and explicit supported stable-version lines.
