# Membership and campaign foundation

PR #2 was reviewed and merged before this separate feature branch. Bosphorly is
an in-platform intermediary for transfers and experiences. Supplier pricing,
fulfillment and hotel commissions remain separate from member marketing.

## Delivered

`membership.html?lang=tr` (also en/ar/ru) provides editable blank name and
email fields, required country selection and a preferred communication language
(defaulted to the screen language). Terms/privacy acknowledgements and optional
unchecked marketing permission stay separate. No form details are submitted,
persisted or displayed as a registered account. The local check clearly reports
that registration is unavailable; clear-form and clear-email-choice actions
only affect this form. The frontend still has no API URL or sign-in credentials.
Controls carry no HTML name attributes so a script failure cannot serialize PII
into a native form GET. The continue control is a plain button, not a native
submit. Autocomplete can use the browser's own name/email suggestions.
Country means residence, not ethnicity or nationality. RTL and mobile supported.
English legal draft text is explicitly tagged `lang=en` when translation is
pending; reviewed legal translations are a launch gate, not automatic fallback
contracts. The full Turkish/English drafts are displayed in the page itself.

Migration 0002 creates encrypted member profiles, append-only versioned consent
history and one **draft** 10% mobile-member campaign. The user deferred the free
tour campaign; there is no free-tour promise, entitlement or redemption logic.
The draft percentage never changes current quotes or researched supplier prices.

## API

The existing Worker exposes two rate-limited POST routes with strict origin
controls, bearer identity, bounded JSON bodies and no cookies:

- `/v1/members/profile`: requires fullName, email, ISO country code,
  preferredLanguage (en/tr/ru/uk/de/fr/nl/ar/he/az/fa/es),
  termsVersion `membership-draft-v1`, privacyVersion `privacy-draft-v1` and
  marketingEmail boolean. Email must match a cryptographically verified,
  email-verified identity token. Upserts converge on the SHA-256 hash of issuer
  and subject. The unique identity prevents duplicate profiles on retries;
  consent events are append-only observations, so retries can add observations.
- `/v1/members/marketing/withdraw`: accepts `{}` and immediately clears email
  permission with an atomic consent event. Does not change membership status.

There is no password database or client-controlled identity/role. RS256 tokens
are verified by JOSE against a pinned server-configured public JWK, issuer and
client audience; expiry, issued-at and a maximum 15-minute token age are required.
Pinning requires an operational key-rotation procedure: provision new issuer
public keys before changing verification config. Never accept a client JWK.
For production, select a managed identity provider and complete callback/PKCE
and replay protections; the public demo does not implement a fake sign-in.

Profile name/email/country are AES-256-GCM encrypted with random per-write IVs,
a versioned envelope and Bosphorly-specific authenticated context. Do not log
request bodies, tokens or decrypted profiles. Role separation: members can
write only their own profile/preferences; admin pricing bearer tokens confer
no membership identity. Existing supplier controls are unchanged.

## Gmail and activation

The owner uses Gmail. No Gmail password, SMTP password, API key or OAuth token
belongs in this repository or chat. Gmail is an account/mailbox, not a configured
identity or campaign delivery service. Use server-side Google OAuth with minimal
scopes if Gmail is retained for transactional sending; production campaign
volume, quotas, sender domain, deliverability and unsubscribe handling need a
separate decision. No Gmail API scope is requested by this PR and no email is
sent. Never use a connected personal inbox to silently send marketing.

Before activating the member API, finish the legal/company fields below, approve
identity and email providers, implement secure sign-in and a retention/deletion
worker, and configure a dedicated staging D1 database with migrations 0001/0002.
Use environment-specific `MEMBER_ISSUER`, `MEMBER_AUDIENCE`, `MEMBER_JWK` (public)
and secret `MEMBER_DATA_KEY` (32 random bytes encoded base64). Only then set
`MEMBERSHIP_ENABLED=approved`. Do not set it on production yet. Rotate the data
key with decrypt/re-encrypt and retain old versions until migration completes;
there is no public profile-read route or decryption endpoint in this phase.

Before any campaign delivery, implement double opt-in, a signed expiring
unsubscribe link that needs no login, durable suppression, consent re-check at
send time and withdrawal handling for already queued messages. Marketing opt-in
must never be required for membership or member-discount eligibility. Collect
no tracking pixels, device fingerprints, passports or card details.

## Legal draft checklist

The page contains drafts of membership terms, KVKK privacy notice and separate
commercial email permission. Review and complete: legal entity/controller name,
registered address/contact, user support and account deletion, processing
purposes and lawful bases, processors and cross-border safeguards, retention
periods and deletion procedure, data-subject rights and application channel,
eligibility/disputes, commercial-message/IYS obligations and withdrawal timing.
Privacy acknowledgement is not blanket consent for all processing. These texts
are not a legal conclusion or finalized contract. Provider-specific cancellation,
refund and consumer purchase terms must be shown separately before each sale.
Replace draft document versions with reviewed immutable versions before launch.

## Campaign conditions still to decide

The proposed 10% mobile discount needs dates/timezone, eligible products,
currency, discount cap, minimum spend, exclusions, stacking, per-member limits,
refund/reversal rules and funding approval. Browser width alone is not proof of
eligibility; compute the benefit on the server from an approved policy and
verified account. Campaign status cannot become approved without core rule
fields in SQL, and **no redemption/quote integration is enabled**. Future
redemptions need unique booking/member idempotency, limits and atomic reversal.

Run `npm test` and `npm run test:mobile`. Tests use only synthetic identities and
sample data, verify token claims/signatures, encryption, strict fields, optional
consent, disabled collection, draft campaign gating and mobile/RTL behavior.

## Registration field research (2026-11-16)

Sources were consulted to inform a product decision, not to claim these fields
are all legally mandatory for every travel platform:

- [GetYourGuide privacy policy, section 2.1](https://www.getyourguide.com/c/privacy-policy/):
  name and email are account data; managed identity is an alternative to a local
  password. This supports a short registration form, not copying its policies.
- [KVKK basic principles](https://kvkk.gov.tr/SharedFolderServer/CMSFiles/a23bfe08-9b3a-4c2f-8a97-a259dcc0e667.PDF):
  collect data related and proportionate to the purpose; do not collect details
  simply because they might be needed later.
- [KVKK consent guidance](https://www.kvkk.gov.tr/Icerik/2037/Acik-Riza-Alirken-Dikkat-Edilecek-Hususlar):
  purpose-specific, freely given and withdrawable consent.

| Information | Bosphorly decision | Purpose |
| --- | --- | --- |
| Full name | Required, editable single field | Member identity, accommodates international names |
| Email | Required; verify at real activation | Account access and service communication |
| Residence country | Required (owner requirement) | Service localisation; not nationality or ethnicity |
| Communication language | Prefilled, changeable | Communicate in the guest's chosen language |
| Terms acceptance | Separate required acknowledgement | Record the reviewed terms version on launch |
| Privacy notice | Separate acknowledgement | Inform the member; not blanket processing consent |
| Campaign email | Optional, unchecked | Promotional messages only with separate permission |
| Phone, flight and hotel | Defer to relevant booking | Not necessary for account creation |
| Birth date, sex, national ID/passport, street address, card | Not requested | No current membership purpose |

The field choices above are Bosphorly product decisions informed by the sources.
No new age/date-of-birth or SMS-marketing requirement has been inferred.
