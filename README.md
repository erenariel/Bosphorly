<div align="center">
<img src="assets/brand/approved-icon.webp" alt="Bosphorly B app icon — vector concept" width="128">

# Bosphorly

**Istanbul, made simple.**

*Mobile-first arrival planning · Istanbul discovery · Ethical travel intermediation*

[Traveler demo](index.html) · [Researched tour prices](prices.html) · [Interactive Istanbul map](map.html) · [Product presentation](presentation.html) · [Partner dashboard preview](dashboard.html) · [Roadmap](docs/ROADMAP.md)
</div>

> **Public prototype · 16 November 2026.** This is not a live agency, payment service, reservation engine, or partner portal. No bookings or charges are made. All demo prices, provider cards, referral KPIs, commissions and sample transactions are illustrative or third-party research, **not confirmed commercial offers**.

## What is available

- 📱 **Mobile-first traveler concept**: selectable arrival airport, hotel zone, skip-transfer action, multi-step form preview and 12 draft language locales (TR, EN, RU, UK, DE, FR, NL, AR, HE, AZ, FA, ES). Some UI strings need human review.
- 🗺️ **Istanbul discovery map**: 14 landmark/airport/neighborhood pins, search and filters, with public OpenStreetMap/Leaflet tiles when internet is available **and a built-in offline schematic fallback** when map tiles cannot load.
- 🚇 **Transport pointers**: links to official M11, M4 and tram service sources. Not real-time journey planning; do not assume listed station changes or service times are current.
- 🎟️ **In-platform experience planning**: travelers stay on Bosphorly through the product and booking-preview journey. No third-party supplier checkout redirects or supplier-published fares appear on traveler cards. `data/offers.json` is an internal catalog of unsigned draft products; rates are quote-required until contractual approval.
- 🏨 **Partner console (illustrative)**: responsive presentation of synthetic referral counts, commission calculations and a readiness checklist, without real bookings or customer data.
- ✨ **Product presentation**: vision for travelers, hotels, licensed travel suppliers and the proposed commission model.
- 🔎 **SEO and publishing foundations**: accessible structure, plain-language disclosures, source links and an editorial strategy.
- 🛡️ **Security boundaries**: never enter actual card/passport details or customer information into prototype forms.

## Repository structure

```text
index.html             Standalone mobile-first traveler demo
booking.html           In-platform booking preview (not a real reservation)
booking.js             Local-only booking validation and catalog integration
booking.css            Responsive booking styles
data/offers.json       Bosphorly-owned draft products and fixed Sultanahmet transfer tariffs\ndata/public-market-prices.json   Source-checked public operator price research\nprices.html            Public tour price research page (not live Bosphorly tariffs)\nprices.js              Local price filter and rendering\nhotel-lookup.js        Optional Google Places hotel matching\nconfig/maps-public.js  Restricted browser-only Google Maps key configuration
map.html               Istanbul map and transport information
presentation.html      Product vision and investor/partner presentation
presentation.css       Presentation styling
dashboard.html         Public synthetic partner console
dashboard.css          Dashboard responsive styling
dashboard.js           Demo-only tab and filter logic
assets/brand/           User-selected compact logo + fallback vector icon
assets/maps/            Istanbul schematic fallback map
docs/PRODUCT.md        Core product and personas
docs/ROADMAP.md        Delivery phases
docs/SEO.md            Destination-content strategy
docs/LEGAL-GATES.md    Compliance, privacy and legal checks
tools/check_site.py     JS, internal-link, pricing and redirect smoke tests
BRAND.md               Brand direction
PROJECT_BRIEF.md       Extended original project brief
SECURITY.md            Responsible reporting and prototype security
CONTRIBUTING.md        Contribution guidelines
.github/workflows/     Quality check and Pages publishing
```


## New Istanbul guide library

Original English and Turkish visitor articles (editorial prototypes, not live operator information):

- [English Istanbul travel guide](en/istanbul-guide.html) · [Türkçe İstanbul rehberi](tr/istanbul-rehberi.html)
- [IST and SAW airport transfers](en/airport-transfer.html) · [Havalimanı transferi](tr/havalimani-transferi.html)
- [Metro and public transport](en/public-transport.html) · [Toplu taşıma](tr/toplu-tasima.html)
- [Byzantine and Ottoman Old City](en/old-city.html) · [Tarihî Yarımada](tr/tarihi-yarimada.html)
- [Bosphorus cruises](en/bosphorus-cruises.html) · [Boğaz turları](tr/bogaz-turlari.html)

Editorial location and rail reference records: [places](data/places.json) · [rail lines](data/rail-lines.json). These are not live map routing or transit feeds.

## Local preview

Open `index.html` in a browser or run a local static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`. Interactive map tiles need access to OpenStreetMap and Leaflet CDNs.

## Deploy

Go to **Settings → Pages → Build and deployment** on this repository, select **GitHub Actions** as the source, and check the `Deploy Bosphorly public prototype` workflow. Publishing is only complete when GitHub Pages reports a live URL.

## Planned next milestones

Supplier and hotel verification; Google Places configuration and location-based service zones; contracts and rights to sell; booking backend; consentful reservation details; hosted payment solution; transparent cancellation/refunds; fulfilled-sales commissions and rewards; professionally reviewed localized editorial guides.

See [product spec](docs/PRODUCT.md), [roadmap](docs/ROADMAP.md) and [legal gates](docs/LEGAL-GATES.md).

## Separation from KonaklamaFlow

**Bosphorly and KonaklamaFlow are independent projects.** Never transfer hotel guest records, tokens, production credentials, private contracts or source code between them without explicit authority and a separate privacy/security review.

## Brand

The original selected visual direction is a white **B**, aqua flight trail and historic gold forms on midnight blue. The public website uses a small optimized crop of the user-selected artwork (`assets/brand/approved-icon.webp`). The separate SVG remains an approximate fallback, not the master vector logo. Full-size image exports are retained outside the public repo pending final brand packaging.

© 2026 Bosphorly concept. Brand name, domain and trademark availability require verification.

## In-platform checkout policy (November 2026)

Every traveler experience card leads to `booking.html?service=<approved-id>`. The public catalog **must not contain referral/affiliate checkout links** to outside agencies. Prices visible to guests will be approved and maintained by Bosphorly administrators after valid supplier contracts; the static `data/offers.json` is a read-only demonstration and **not a trusted price source for production purchases**.

Real booking requests, confirmation numbers, card payments, passport information, commissions and customer messages all require a secure backend and a separate legal/operational release gate. Codex implementation brief: [Issue #1](https://github.com/erenariel/Bosphorly/issues/1).


## Traveler pricing and browser localization (16 Nov 2026)

- **Sultanahmet airport transfers are fixed**, not estimated, at **IST → Sultanahmet €55** and **SAW → Sultanahmet €65**, one way. These are the project's customer tariffs as provided by the operator. Other destinations remain `Ask for price`. Real reservations remain disabled until fulfillment is integrated.
- **21 sourced operator records** (20 advertised prices and one rate-on-request) are in `data/public-market-prices.json`. Cards and `prices.html` show original posted currencies and mark them as **operator research, NOT Bosphorly sales rates**. Dates/packages/seasonal discounts can change.
- On first launch, the traveler's interface detects the browser language via `navigator.languages`. A manually chosen language is remembered for subsequent visits.
- Optional Google Places (New) autocomplete identifies a selected Istanbul hotel by its name, formatted address and location. Without a configured restricted browser key, a clearly marked manual fallback remains available. See [Google Places activation](docs/GOOGLE-PLACES.md).
- The homepage includes subtle animated water flourishes through CSS, respecting the visitor's reduced-motion preference. No heavy animated GIF is required.

**Data rule:** Supplier public list prices must never silently become confirmed retail tariffs. Price approvals and booking fulfillment need the secure backend planned in Issue #1.
