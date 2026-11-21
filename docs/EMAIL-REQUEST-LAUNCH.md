# Email request launch checklist (PR #45)

**Status: NOT DEPLOYED.** The new Worker endpoint is gated by `ENABLE_EMAIL_REQUESTS=true` and requires configured Resend/Turnstile. The current static website still uses email drafts; do not claim delivery is automatic.

## Secure deployment prerequisites

1. Deploy the existing Cloudflare Worker with a managed `RATE_LIMITER` binding and `PUBLIC_ORIGIN=https://bosphorly.com`.
2. Verify the sender domain in Resend. Store `RESEND_API_KEY`, `REQUEST_FROM_EMAIL`, and `TURNSTILE_SECRET` as Worker secrets, not GitHub Pages assets. Configure a public Turnstile site key on the client.
3. Confirm the `info@bosphorly.com` inbox can receive mail, including a real delivery test from the Worker. Provider acceptance alone is not proof of inbox delivery.
4. Set `config/api.js` to the deployed HTTPS API origin and implement a real client POST to `/v1/requests` with Turnstile response. Show success only on HTTP 202; show actionable error otherwise.
5. Review privacy policy, retention and lawful basis before sending visitor PII to the email provider. Never submit card/passport data.
6. Enable `ENABLE_EMAIL_REQUESTS=true` only after staging end-to-end tests, then merge PR #45 after CI is green.

## Acceptance tests (must run before production)

- All 23 locales: tr, en, ru, uk, de, fr, nl, ar, he, az, fa, es, it, pt, hr, hu, bs, zh, ja, ko, hi, bn, id. Verify no WhatsApp copy remains in inquiry/consent/success/banner; check RTL for ar/he/fa.
- Main tour request, special tour card, Discover ask link, transfer request, mobile, desktop.
- Required fields, email validation, dates, consent, 1–30 guests, payload length, rate limit, invalid Turnstile, duplicate submissions, provider outage, retry and idempotency.
- Reference ID and all requested details appear in the actual received mailbox; no false 'sent' status for drafts.
- GitHub Actions tests pass; deploy to Pages; independently verify `https://bosphorly.com`, `/booking.html`, `/tours.html` and mail delivery.

## Current limitation

Without verified third-party credentials, deployment access and a confirmed inbound email test, the assistant cannot honestly certify automatic delivery or live-site rollout.
