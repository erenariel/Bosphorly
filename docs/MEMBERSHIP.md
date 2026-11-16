# Membership and campaign foundation

PR #2 was reviewed and merged before this separate feature branch. Bosphorly is
an in-platform intermediary for transfers and experiences. Supplier pricing,
fulfillment and hotel commissions remain separate from member marketing.

## Delivered

`membership.html?lang=tr` (also en/ar/ru) demonstrates registration, required
country selection, separate terms/privacy acknowledgement, optional unchecked
email permission, an account preference view, withdrawal and reset. Identity
fields are disabled synthetic values: no real account or profile is created,
no mail sent and no data stored in browser storage or submitted. The public
Pages frontend has no membership API URL or sign-in credentials configured.
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
