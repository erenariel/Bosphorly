<div align="center">
<img src="assets/brand/brandmark.svg" alt="Bosphorly B app icon — vector concept" width="128">

# Bosphorly

**Istanbul, made simple.**

*Mobile-first arrival planning · Istanbul discovery · Ethical travel intermediation*

[Traveler demo](index.html) · [Interactive Istanbul map](map.html) · [Product presentation](presentation.html) · [Partner dashboard preview](dashboard.html) · [Roadmap](docs/ROADMAP.md)
</div>

> **Public prototype · 16 November 2026.** This is not a live agency, payment service, reservation engine, or partner portal. No bookings or charges are made. All demo prices, provider cards, referral KPIs, commissions and sample transactions are illustrative or third-party research, **not confirmed commercial offers**.

## What is available

- 📱 **Mobile-first traveler concept**: selectable arrival airport, hotel zone, skip-transfer action, multi-step form preview and 12 draft language locales (TR, EN, RU, UK, DE, FR, NL, AR, HE, AZ, FA, ES). Some UI strings need human review.
- 🗺️ **Istanbul discovery map**: 14 landmark/airport/neighborhood pins, search and filters, with public OpenStreetMap/Leaflet tiles when internet is available.
- 🚇 **Transport pointers**: links to official M11, M4 and tram service sources. Not real-time journey planning; do not assume listed station changes or service times are current.
- 🎟️ **Research-based experience examples**: links to providers, no claimed commercial relationship.
- 🏨 **Partner console (illustrative)**: responsive presentation of synthetic referral counts, commission calculations and a readiness checklist, without real bookings or customer data.
- ✨ **Product presentation**: vision for travelers, hotels, licensed travel suppliers and the proposed commission model.
- 🔎 **SEO and publishing foundations**: accessible structure, plain-language disclosures, source links and an editorial strategy.
- 🛡️ **Security boundaries**: never enter actual card/passport details or customer information into prototype forms.

## Repository structure

```text
index.html             Standalone mobile-first traveler demo
map.html               Istanbul map and transport information
presentation.html      Product vision and investor/partner presentation
presentation.css       Presentation styling
dashboard.html         Public synthetic partner console
dashboard.css          Dashboard responsive styling
dashboard.js           Demo-only tab and filter logic
assets/brand/           Distinctive Bosphorly visual identity (concept SVG)
docs/PRODUCT.md        Core product and personas
docs/ROADMAP.md        Delivery phases
docs/SEO.md            Destination-content strategy
docs/LEGAL-GATES.md    Compliance, privacy and legal checks
BRAND.md               Brand direction
PROJECT_BRIEF.md       Extended original project brief
SECURITY.md            Responsible reporting and prototype security
CONTRIBUTING.md        Contribution guidelines
.github/workflows/     Quality check and Pages publishing
```

## Local preview

Open `index.html` in a browser or run a local static server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`. Interactive map tiles need access to OpenStreetMap and Leaflet CDNs.

## Deploy

Go to **Settings → Pages → Build and deployment** on this repository, select **GitHub Actions** as the source, and check the `Deploy Bosphorly public prototype` workflow. Publishing is only complete when GitHub Pages reports a live URL.

## Planned next milestones

Supplier and hotel verification; actual zone-based pricing; contracts and rights to sell; booking backend; consentful reservation details; hosted payment solution; transparent cancellation/refunds; fulfilled-sales commissions and rewards; professionally reviewed localized editorial guides.

See [product spec](docs/PRODUCT.md), [roadmap](docs/ROADMAP.md) and [legal gates](docs/LEGAL-GATES.md).

## Separation from KonaklamaFlow

**Bosphorly and KonaklamaFlow are independent projects.** Never transfer hotel guest records, tokens, production credentials, private contracts or source code between them without explicit authority and a separate privacy/security review.

## Brand

The original selected visual direction is a white **B**, aqua flight trail and historic gold forms on midnight blue. The current SVG in this repository is a vector concept based on those elements; the master high-resolution selected artwork remains in the private design starter package until its original image asset is explicitly added to this repository.

© 2026 Bosphorly concept. Brand name, domain and trademark availability require verification.
