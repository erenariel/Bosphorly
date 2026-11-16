# BOSPHORLY — Product brief (v0.1)
Date: 16 November 2026 · Stage: independent research and interactive concept prototype

## Vision
A guest-first multilingual **referral intermediary** for Istanbul: the hotel reception's tour brochure desk, moved online and no longer limited to one hotel's guests. One understandable interface for arranging arrival transfer and discovering tours/cruises/hammams from licensed companies. Bosphorly does not sell the services itself: the traveler sends a request through Bosphorly, the licensed company confirms, delivers and collects payment, and Bosphorly earns a contracted commission from the company for each completed referral. The sides are (1) traveler, (2) licensed tour/transfer company, and (3) optional referring hotel, which receives a share of Bosphorly's commission. An operations administrator manages attribution, monthly reconciliation, data quality and safety.

The full model, including what company agreements must cover, is in [docs/BUSINESS-MODEL.md](docs/BUSINESS-MODEL.md).

## Non-negotiable user experience
- A visitor can skip airport transfer and explore activities directly.
- Guest chooses IST (Istanbul Airport) or SAW (Sabiha Gokcen), hotel and travel date. Hotel autocomplete should resolve verified hotel property ID and geolocation, not accept blindly guessed names.
- Show clear, confirmed *per vehicle* transfer price and *per person* activity price. Display inclusions, pickup information, luggage capacity, language, timings, cancellation/changes, supplier legal identity and availability before proceeding.
- Minimal flow on mobile, easy keyboard access, accessible contrast, no forced registration, progressive disclosure of personal info.
- Required passenger details are collected only when needed for service fulfillment: traveler name, party size, flight number, date/time, phone/WhatsApp and confirmation email. Nationality and passport data must not be collected by default. If a documented provider-specific legal obligation requires them, collect separately with adequate notice and retention controls.
- Payment: the licensed company collects payment directly (on the day, at pickup, or via the company's own payment link). Bosphorly does not collect or hold traveler money in the referral model. Taking payments on Bosphorly is a separate future decision that requires its own licensing and PSP review; even then, never capture raw card details on our servers.
- After a successful, verified booking, suggest nearby offerings with a route map and correct tour meeting point. For tours, distinguish scheduled activity route from guest journey to meeting point.
- Loyalty is applied only after verified fulfillment, not merely after clicking or booking. Cancellations/refunds reverse pending rewards where applicable.

## Core customer journey
1. Welcome in the visitor's language: airport transfer or skip.
2. Airport IST/SAW → verified hotel/district search → date → quote. Flexible fare zones + registered supplier offer, capacity, vehicle class and surcharges; don't compute final price solely from road distance.
3. Confirm passenger quantity and essential flight/contact details.
4. Summary: the company's price and units, currency, company legal name and licence, meeting details, clear cancellation/change terms, and a plain statement that the contract and payment are with the company, not Bosphorly. Acknowledge required terms.
5. Bosphorly sends the request with a unique **Bosphorly reference code** to the company. The request stays `requested` until the company explicitly confirms or declines; Bosphorly never confirms on the company's behalf.
6. The company confirms and collects payment directly from the traveler. Bosphorly sends the traveler a request summary (reference code, company contact, meeting point, accessibility notes and support) in the user's language; the service voucher/invoice comes from the company.
7. Show recommended tours near hotel and route. No hidden required purchases.
8. After the company reports the coded service as delivered, Bosphorly records the commission (and the hotel share, if a hotel referred the traveler) in the monthly reconciliation; loyalty stamp credited once. Cancellations, no-shows and refunds earn no commission. Disputes lead to a hold.

## Transparent transfer fare policy
Transfer prices are the transfer company's retail tariffs, not Bosphorly's. The current fixed fares are **IST → Sultanahmet €55** and **SAW → Sultanahmet €65**, one way; every other zone shows **Price on request** until the company publishes a rate for it. Before live launch, price rules should depend on origin, service-zone polygons, direction, vehicle class, capacity, luggage, wait times, dates, tax and contract margin. All published price versions must be auditable. Avoid putting any single hotel's internal price sheet into public code.

## Commission and reconciliation
Bosphorly's revenue is a commission paid by the company on each completed, coded referral. The traveler pays the company's own price (price parity: never more than buying directly), so the commission comes out of the company's margin. Each company agreement defines the rate, gross/net (VAT) basis, which sales count, monthly reporting, payment term and treatment of cancellations, no-shows and refunds.

Track the company's retail price, commission basis, commission amount, hotel share, taxes, status (reported, reconciled, invoiced, paid, reversed) and outstanding balance as *separate fields*. Example only: a €60 delivered tour with an agreed 10% commission gives Bosphorly €6 before tax; if a hotel referred the guest, the hotel's share of that €6 is whatever the hotel agreement says and cannot be inferred. Never show commissions to travelers.

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
- `referral_codes` (unique Bosphorly reference per request, company, hotel attribution)
- `supplier_reports` (monthly coded-sales report per company, reconciliation status)
- `commission_entries`, `hotel_share_entries`, `commission_invoices` (immutable ledger records)
- Future only, if Bosphorly ever becomes merchant of record: `payments`, `refunds`, `psp_webhook_events`
- `rewards_ledger` (credit/debit, eligible fulfilled booking ID, anti-duplicate key)
- `consent_events`, `translations`, `audit_logs`, `support_cases`

### Integration boundaries
`GeocodingInterface` / `RoutingInterface` for hotel location and real maps; `SupplierAvailabilityInterface` to prevent overselling; `SupplierRequestInterface` to forward requests and receive confirm/decline (email, WhatsApp or partner panel); `MessagingInterface` for request summaries and consented messages. No payment gateway in the referral model. A provider API is not assumed to exist until documented and contracted. For providers without an API, offer a **request-to-confirm** workflow, not false real-time instant confirmation.

## Delivery phases
**0 (this folder):** mobile-first web concept, city-map pins using OpenStreetMap, official transit references, ten original SEO guides, sample partner dashboard, price-on-request flow, 12 draft language selectors, booking preview and loyalty concept; no production backend, live routing, inventory, payment or billing.

**1 — Validated Istanbul pilot:** signed commission agreements with 1–2 licensed companies (starting with the Sultanahmet airport transfer) and 1–2 hotels; approved prices, product inclusions, legal review of the referral model, request form with Bosphorly reference codes, manual company confirmation, first monthly reconciliation.

**2 — Hotel & company portals:** RBAC, company catalog/price editor, request confirm/decline in a panel, coded-sales reporting, commission ledger and hotel shares, disputes, QR referral attribution, dashboards, operational monitoring.

**3 — Growth:** GDPR/KVKK mature privacy controls, automated translations with human review, 30–50+ locales, route maps, location-based recommendations, partner-funded loyalty, native mobile apps, additional destinations.

## Legal/safety gates BEFORE public launch
1. Confirm the referral-intermediary model under Turkey's Law 1618: whether a platform that never sells or collects money needs its own travel agency certificate, or should operate under a partner A-group agency. Contract and check each company's licence.
2. Have counsel review distance contracts, service-specific cancellation/refund terms, dates/times, failure-to-perform and operator-cancellation rights. Certain date-specific leisure/transport cases have exceptions to the general withdrawal right; this does **not** license a blanket "never refundable or changeable" policy. Display the correct terms per SKU and make pre-purchase acknowledgment meaningful.
3. KVKK/GDPR notices, processors, EU guest lawful basis where applicable, marketing consent independent from performance, security controls, vendor contracts and data minimization. Avoid passport retention by default.
4. Commission invoicing and tax treatment (including hotel shares). PSP/KYC, 3DS, chargebacks and refunds apply only if Bosphorly later decides to collect payments. No payment credential storage.
5. Obtain media use permission; do not copy photos, text or brochure art into the product without rights. Show partner status accurately.

## Quality targets for pilot (proposed, not achieved)
- >90% completion among customers who begin a valid request (aspirational metric to test, not a promise).
- Every request answered (confirmed or declined) by the company within an agreed time.
- 100% of delivered referrals matched in monthly reconciliation; 0 commission on cancelled/refunded sales; user consent recorded.
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