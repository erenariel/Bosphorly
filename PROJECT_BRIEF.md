# BOSPHORLY — Product brief (v0.1)
Date: 16 November 2026 · Stage: independent research and interactive concept prototype

## Vision
A hotel-linked, guest-first multilingual experience marketplace for Istanbul. One understandable interface for arranging arrival transfer, discovering tours/cruises/hammams, and earning benefits from *completed* eligible bookings. The three sides are (1) traveler, (2) referring hotel, and (3) licensed supplier/agency. An operations administrator manages disputes, settlement, data quality and safety.

## Non-negotiable user experience
- A visitor can skip airport transfer and explore activities directly.
- Guest chooses IST (Istanbul Airport) or SAW (Sabiha Gokcen), hotel and travel date. Hotel autocomplete should resolve verified hotel property ID and geolocation, not accept blindly guessed names.
- Show clear, confirmed *per vehicle* transfer price and *per person* activity price. Display inclusions, pickup information, luggage capacity, language, timings, cancellation/changes, supplier legal identity and availability before proceeding.
- Minimal flow on mobile, easy keyboard access, accessible contrast, no forced registration, progressive disclosure of personal info.
- Required passenger details are collected only when needed for service fulfillment: traveler name, party size, flight number, date/time, phone/WhatsApp and confirmation email. Nationality and passport data must not be collected by default. If a documented provider-specific legal obligation requires them, collect separately with adequate notice and retention controls.
- Payment methods: secured hosted/embedded provider checkout with 3-D Secure; or pay at hotel ONLY when supplier and referring hotel have contracted for it. Never capture raw card details on our servers.
- After a successful, verified booking, suggest nearby offerings with a route map and correct tour meeting point. For tours, distinguish scheduled activity route from guest journey to meeting point.
- Loyalty is applied only after verified fulfillment, not merely after clicking or booking. Cancellations/refunds reverse pending rewards where applicable.

## Core customer journey
1. Welcome in the visitor's language: airport transfer or skip.
2. Airport IST/SAW → verified hotel/district search → date → quote. Flexible fare zones + registered supplier offer, capacity, vehicle class and surcharges; don't compute final price solely from road distance.
3. Confirm passenger quantity and essential flight/contact details.
4. Summary: exact retail price and units, currency, supplier, meeting details, clear individual cancellation/change terms. Choose allowed payment route and acknowledge required terms.
5. Payment provider redirects/tokens; server verifies PSP webhook and idempotency before booking status becomes `confirmed`. For pay-at-hotel, collect explicit guarantee or partner approval as contracted.
6. Electronic voucher (QR, booking reference, itinerary, supplier contact, accessibility instructions and support), in user's language.
7. Show recommended tours near hotel and route. No hidden required purchases.
8. After supplier checks off fulfilled service, hotel referral and operator settlement entered; loyalty stamp credited once. Disputes lead to a hold.

## Transparent transfer fare policy
No public transfer quote is shown until a contracted supplier's current, authorized rate card is available. The interface currently displays **Price on request** for every zone and airport. Before live launch, price rules should depend on origin, service-zone polygons, direction, vehicle class, capacity, luggage, wait times, dates, tax and contract margin. All published price versions must be auditable. Avoid putting any single hotel's internal price sheet into public code.

## B2B commission and settlement
Track supplier gross price, supplier net price, authorized retail price, taxes, platform revenue, hotel referral revenue, payment fees, refunds and outstanding balance as *separate fields*. The commercial contract defines percentages, net/gross basis, payout windows, chargebacks and tax invoice handling. Example only: a €60 eligible sale with an agreed 10% total commission has €6 total commission before payment/tax adjustments; hotel share cannot be inferred without agreement. Never expose internal commissions on guest checkout.

## Loyalty concept
`Bosphorly Passport` is a digital stamp card, not a physical passport/document. Example rule set for commercial modeling: 1 eligible fulfilled booking → 1 stamp; 5 stamps unlock a partner-approved discount; additional rewards (e.g., a complimentary limited-value activity) only when partner budget and inventory are explicitly contracted. Rules need expiry, per-person limits, refunds reversal, anti-fraud, accessible terms, and caps. No actual rewards are promised by the demo.

## Localization
A locale registry holds BCP 47 language codes and translation bundles; canonical content is supplier-authoritative and field-based. Guest's preferred language applies to booking, supplier inclusions, customer support notices, legal copy and receipts where available. Layout supports RTL for Arabic, Hebrew and Persian; currency and date formats use locale-aware APIs; phone numbers use E.164. UI should always distinguish translated content from human-reviewed legal/operational instructions.

The initial visual prototype includes English, Turkish, Russian, Ukrainian, German, French, Dutch/Flemish (Dutch locale), Arabic, Hebrew, Azerbaijani, Persian and Spanish as **draft UI translations**. Some long secondary notices still fall back to English; professional proofreading is needed before launch.

Expansion registry includes: pt-PT, it, el, pl, ro, hu, bg, cs, sk, sl, hr, sr-Latn, sr-Cyrl, bs, sq, mk, da, sv, nb, nn, fi, is, et, lv, lt, ga, mt, cy, eu, ca, gl, lb, rm, be, ka, hy, tr, ku, ur, ps, hi, and others according to guest demand. Not all are ready/translatable automatically today. `nl-BE` needs Belgian Dutch proofreading, and `az` should not be treated as Turkish.

## Data model (relational)
- `hotels` (id, legal name, address, lat/lon, service_zone, active)
- `hotel_staff`, `referral_links` (signed referral token, hotel's commission attribution)
- `suppliers` (license ID, company legal name, bank/settlement IDs, contract status)
- `products` (SKU, category, published language, age bands, inclusion/exclusion, images with permissions)
- `departures` (start/end, time zone, capacity, supplier availability and confirmation mode)
- `rate_cards` (supplier, pickup polygon, airport, price currency, vehicle, effective dates, audit version)
- `quotes` (quote amount, currency, expiry, supplier rate version, vehicle class, hotel ID)
- `bookings`, `booking_passengers`, `booking_status_events`
- `payments`, `refunds`, `psp_webhook_events` (deduplicated by provider event ID)
- `commission_entries`, `hotel_settlement_entries`, `supplier_settlement_entries` (immutable ledger records)
- `rewards_ledger` (credit/debit, eligible fulfilled booking ID, anti-duplicate key)
- `consent_events`, `translations`, `audit_logs`, `support_cases`

### Integration boundaries
`GeocodingInterface` / `RoutingInterface` for hotel location and real maps; `SupplierAvailabilityInterface` to prevent overselling; `PaymentGatewayInterface` with PCI-controlled tokenized 3DS checkout; `MessagingInterface` for vouchers and consented messages. A provider API is not assumed to exist until documented and contracted. For providers without an API, offer a **request-to-confirm** workflow, not false real-time instant confirmation.

## Delivery phases
**0 (this folder):** mobile-first web concept, city-map pins using OpenStreetMap, official transit references, ten original SEO guides, sample partner dashboard, price-on-request flow, 12 draft language selectors, booking preview and loyalty concept; no production backend, live routing, inventory, payment or billing.

**1 — Validated Istanbul pilot:** signed pilot agreements with 1–2 licensed agencies and 1–2 hotels; official rate cards, product inclusions, verified hotel inventory, legal review, live availability or manual approval, responsive PWA, hosted payments, vouchers.

**2 — Hotel & supplier portals:** RBAC, supplier catalog editor, booking status transitions, commission ledger and settlement, refunds and disputes, QR referral attribution, dashboards, operational monitoring.

**3 — Growth:** GDPR/KVKK mature privacy controls, automated translations with human review, 30–50+ locales, route maps, location-based recommendations, partner-funded loyalty, native mobile apps, additional destinations.

## Legal/safety gates BEFORE public launch
1. Confirm business model under Turkey's Law 1618 and appropriate licensing/partnership with an authorized travel agency for tour sales and brokerage; contract and check tour-transfer supplier authority.
2. Have counsel review distance contracts, service-specific cancellation/refund terms, dates/times, failure-to-perform and operator-cancellation rights. Certain date-specific leisure/transport cases have exceptions to the general withdrawal right; this does **not** license a blanket "never refundable or changeable" policy. Display the correct terms per SKU and make pre-purchase acknowledgment meaningful.
3. KVKK/GDPR notices, processors, EU guest lawful basis where applicable, marketing consent independent from performance, security controls, vendor contracts and data minimization. Avoid passport retention by default.
4. PSP/KYC, 3DS, chargeback handling, tax invoicing, payment capture, currency accounting and refunds. No payment credential storage.
5. Obtain media use permission; do not copy photos, text or brochure art into the product without rights. Show partner status accurately.

## Quality targets for pilot (proposed, not achieved)
- >90% completion among customers who begin a valid checkout (aspirational metric to test, not a promise).
- p95 quote request under 2 seconds excluding third-party routing; soft-fail with helpful error.
- 0 double charges; webhooks idempotent; user consent recorded; accurate refund reversal.
- Every bookable SKU manually audited for included transfers, supplier verification and cancellation terms.

## Research references
- Blue Brothers: https://www.bluebrotherstour.com/bosphorus-tour and https://bluebrotherstour.com.tr/old-city-tour/
- Sea & Land license statement: https://sealandtrip.com/about-us/
- Azure Tour: https://www.azureturizm.com/
- Orient Bosphorus: https://orientbosphorus.com/tours
- Alaturka Hamam: https://www.alaturkahamam.com/
- Gray Line Istanbul Classics: https://www.grayline.com/tours/istanbul-classics/
- Turkish Law 1618: https://mevzuat.adalet.gov.tr/mevzuat/103833
- Ministry of Trade distance contracts explainer (17 August 2026): https://tuketici.ticaret.gov.tr/yayinlar/tuketici-bilgi-rehberi/mesafeli-sozlesmeler-hakkinda-bilgilendirme