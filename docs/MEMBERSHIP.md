# Membership, campaigns and coupons

Built and tested, **not deployed**. Until the API is deployed and its address is set in `config/api.js`, the site shows membership as "coming soon" and keeps working with device-only requests.

## How it works

| Campaign | Who gets it | When | Default |
|---|---|---|---|
| Welcome | every new member | at sign-up | 5 %, 90 days |
| Hotel | members who arrived through a partner hotel's link/QR (`?h=hotel-id`) | at sign-up | per hotel campaign |
| Second tour | the member | when their first request is fulfilled | 7 %, 120 days |
| Referral | the **inviter** (`?ref=CODE`) | when the invited friend's first request is fulfilled | 5 %, 120 days |
| Loyalty | the member | every 5 fulfilled requests (stamps reset) | 10 %, 180 days |

- **Who pays:** Bosphorly's commission (`funded_by = 'bosphorly'`). `MAX_DISCOUNT_BPS` (default 1000 = 10 %) caps every coupon, including coupons from older campaigns, so a discount never exceeds what the commission can carry. Set it below your lowest commission rate.
- **One coupon per request.** A coupon is *held* when a signed-in member sends a request with it, *redeemed* when the partner marks the tour completed, and released if the request is cancelled.
- **Rewards follow completed tours, not sign-ups**, so fake accounts earn nothing.
- **Sign-in:** 6-digit code e-mailed via Resend. Only a keyed hash is stored; codes last 10 minutes and allow 5 tries; at most 3 codes per address per 15 minutes. Sessions last 90 days, are stored hashed, and end on sign-out or account deletion.
- **Stored per member:** e-mail, optional name, language, marketing consent with its timestamp, invite code, stamps and coupons. For each request only the reference, service, date and guests are stored, never the WhatsApp message, phone or hotel. Account deletion removes all of it.

## Partner check-in

`partner.html` is for tour companies and hotel reception. Enter the partner key and the request code (BOS-…). The page shows the service, date, guests, the guest's first name and the coupon. **Tour completed** redeems the coupon and adds a stamp; **Cancelled** releases the coupon. The guest's e-mail and phone are never shown there.

## Deploy (Cloudflare Workers + D1, free tier)

1. **D1 oluştur → id'yi gir (Create D1 → enter id):** Create a Cloudflare account and create the D1 database (`npx --yes wrangler@4.166.0 d1 create bosphorly-booking` or via the Cloudflare dashboard). Replace the `REPLACE_BEFORE_DEPLOYMENT` placeholder in `backend/wrangler.jsonc` (`d1_databases[0].database_id`) with the generated `database_id`.
2. **Verify sending domain in Resend:** In Resend, verify the sending domain (e.g. `bosphorly.com` or a verified sending subdomain, using DNS records at the domain registrar) and check `MAIL_FROM` and `PUBLIC_ORIGIN` (`https://bosphorly.com`) in `backend/wrangler.jsonc`. Requests from other origins are refused.
3. **Configure GitHub Secrets (for automated deployment):** In the repository **Settings → Secrets and variables → Actions**, add:
   - `CLOUDFLARE_API_TOKEN` (with Workers Scripts + D1 edit permissions)
   - `CLOUDFLARE_ACCOUNT_ID` (or `CLAUDFLARE_ACCOUNT_ID`)
   - `RESEND_API_KEY`
   - `CODE_PEPPER` (a long random secret for HMAC-hashing one-time sign-in codes)
   - `PARTNER_TOKEN` (shared bearer key for `partner.html` lookup/fulfil/cancel)
   - `ADMIN_TOKEN` (bearer key for `/v1/admin/*` endpoints)
4. **Deploy via GitHub Actions (`Deploy member API`):** Trigger the **Deploy member API** workflow (`.github/workflows/deploy-member-api.yml`, `workflow_dispatch` on `main`). It runs the member API and schema tests, applies remote D1 migrations (`wrangler d1 migrations apply bosphorly-booking --remote --config backend/wrangler.jsonc`), deploys the Worker (`wrangler deploy --config backend/wrangler.jsonc`), and uploads `ADMIN_TOKEN`, `PARTNER_TOKEN`, `CODE_PEPPER`, and `RESEND_API_KEY` via `wrangler secret bulk`.
   - *Manual CLI alternative:*
     ```sh
     npx --yes wrangler@4.166.0 d1 migrations apply bosphorly-booking --remote --config backend/wrangler.jsonc
     npx --yes wrangler@4.166.0 deploy --config backend/wrangler.jsonc
     npx --yes wrangler@4.166.0 secret put ADMIN_TOKEN --config backend/wrangler.jsonc
     npx --yes wrangler@4.166.0 secret put PARTNER_TOKEN --config backend/wrangler.jsonc
     npx --yes wrangler@4.166.0 secret put CODE_PEPPER --config backend/wrangler.jsonc
     npx --yes wrangler@4.166.0 secret put RESEND_API_KEY --config backend/wrangler.jsonc
     ```
5. **Enable on the public site (when ready to launch):** Leave `base: ''` empty in `config/api.js` until you decide to go live. Once the Worker, D1 database, and legal gates are ready, set `base` in `config/api.js` to the Worker URL (or `https://api.bosphorly.com`).
6. **Optional campaigns:** Change percentages with `POST /v1/admin/campaigns` (Bearer `ADMIN_TOKEN`). Add a hotel campaign with `{"id":"hotel-x-2027","kind":"hotel","hotelId":"hotel-x","percentBps":500,"validDays":60}` after adding the hotel (status `verified`) to the `hotels` table.

`DEV_RETURN_CODE=1` returns the sign-in code in the API response when no e-mail provider is set. Use it **only** for local testing, never in production.

## Before launch (legal and business checklist)

- **Partner agreement:** companies must agree to apply Bosphorly coupons to the confirmed price and to deduct the discount from the commission they owe.
- **KVKK:** the privacy notice (`privacy.html`) includes a draft KVKK disclosure section for membership data (what data is collected, why, retention periods, and how to delete an account or request deletion), Cloudflare D1 and Resend (USA). Before launch: fill in the data controller (the individual running the site), contact and retention period, and have a lawyer confirm the Art. 9 route for transfers abroad (WhatsApp, Resend, Cloudflare).
- **Commercial e-mails (Law 6563, İYS):** marketing e-mails need the separate, never pre-ticked consent (already in the form) and registration of the sender in İYS. Sign-in codes are not marketing.
- **Discount display (Advertising Regulation):** when showing a "before" price, it must be the lowest price of the last 30 days. Bosphorly shows the company's own price and a percentage, so keep company prices up to date.
- **Terms:** write short coupon terms (one per request, validity, not exchangeable for cash, not combinable) and link them from My account.
