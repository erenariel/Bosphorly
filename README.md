<div align="center">
<img src="assets/brand/bosphorly-logo.webp" alt="Bosphorly brand" width="460">

# Bosphorly

**Istanbul, made simple.**

Mobile-first Istanbul travel companion · Airport transfer planning · City guides · Maps · Partner console

[Explore the traveler experience](index.html) · [Product presentation](presentation.html) · [Partner dashboard (demo)](dashboard.html) · [Product blueprint](docs/PRODUCT.md) · [SEO plan](docs/SEO.md)
</div>

> **Status: public pre-launch prototype (November 2026).** No bookings, payments, real coupons, live availability, hotel referrals or commercial partnerships are enabled. Any supplier names, prices, dashboard transactions and commissions are clearly labeled research or synthetic examples.

## What you can try today

- 📱 **Mobile-first public experience:** responsive arrival planner, transfer skip option, basic accessible multi-step form, and a bottom navigation bar for phones.
- 🗺️ **Istanbul city discovery:** searchable map with 14 selected locations and list fallback. Leaflet/OpenStreetMap loads only when internet access allows. Positions are approximate, **not navigational turn-by-turn routes**.
- 🚇 **Transit introduction:** 20 sourced rail connections, including M11 to IST and M4 to SAW, with links to authoritative operators. This is **not** a complete or live transport feed.
- ✈️ **Transfer preview:** IST/SAW and hotel-area selection with **price on request**. Public pricing is intentionally disabled until authorized supplier price rules exist.
- ⛵ **Experiences research:** public example tours and links to original suppliers. No reseller agreements claimed.
- 🌐 **Language foundations:** 12 draft UI locales (TR/EN/RU/UK/DE/FR/NL/AR/HE/AZ/FA/ES), including RTL direction. Some text still falls back to English and must be professionally reviewed before production.
- 📖 **Indexed-content groundwork:** five original topic guides in English and five in Turkish, with source links, `Article` JSON-LD, descriptive titles, readable text and review dates.
- 🪄 **Brand and product presentation:** responsive B2B story about traveler, hotel and supplier value.
- 🏨 **Independent partner console:** sample referral KPIs, tabs, illustrative bookings, commission formula and production-readiness checklist. **Never enter real partner or customer data.**

## Project separation

**Bosphorly** is a standalone codebase and travel-intermediary product. It shares **no code, booking data, credentials, CI, releases, environment, repository history or production integrations** with **KonaklamaFlow**, the hotel-operations project. Never copy KonaklamaFlow hotel guest records into this public repository.

## Local preview

No package install or API key is required for the demo UI.

```bash
python3 -m http.server 8080
# Open http://localhost:8080
```

- Traveler application: `index.html`
- Partner dashboard (sample only): `dashboard.html`
- Visitor guides: `en/` and `tr/`

The external OpenStreetMap tiles and Leaflet library need an internet connection; if unavailable, the location list and official transport links remain useful.

## Tests

```bash
python3 tools/check_site.py
node --check app.js
node --check city.js
node --check dashboard.js
```

CI runs static link/metadata checks and JavaScript syntax checks. A production browser/E2E and accessibility suite is still on the roadmap.

## Publish to GitHub (public)

The connected GitHub app in ChatGPT can edit **existing** repositories but cannot currently create a new one. **This package has not been published to GitHub.**

1. Open <https://github.com/new>. Choose owner `erenariel`, repository name `Bosphorly` (or another distinct name), **Public**, and do **not** initialize with README, license or `.gitignore` because they already exist here.
2. Unpack this project in a local directory and follow the commands below, or upload its contents through GitHub's web file upload tool. Do not upload the ZIP as a single file expecting GitHub Pages to unpack it.
3. After the repository exists, a GitHub connector with write access can add or update files. It must remain separate from `erenariel/konaklamaflow`.

```bash
git init
git branch -M main
git add .
git commit -m "feat: launch Bosphorly mobile-first public prototype"
git remote add origin https://github.com/erenariel/Bosphorly.git
git push -u origin main
```

To publish the website, open **Settings → Pages → Build and deployment → GitHub Actions**. The `.github/workflows/pages.yml` workflow deploys on `main` when GitHub Pages is enabled. Never treat `dashboard.html` as a secure staff panel on a public static site.

After the site has a real public address and a verified canonical URL, run:

```bash
python3 tools/generate_sitemap.py --site-url https://erenariel.github.io/Bosphorly/
```

Commit the generated `sitemap.xml`, `robots.txt`, and canonical/hreflang metadata. If you use a custom domain, provide that **actual** URL instead. Add the live property to Google Search Console and submit the sitemap. Search indexing and Google AI citations are **not guaranteed**.

## Key boundaries

- **No live payments or bookings:** use a licensed supplier agreement, a backend, availability handling and hosted checkout before enabling sales.
- **No verified partners:** listed operators came from brochure/public research. Do not copy third-party brochure photos, logos or catalogs without permission.
- **No personal data in a public repository:** sample inputs stay in the browser; do not commit passport scans, bookings, phone numbers or tokens.
- **No hard-coded cancellation rule:** each product needs the supplier's legally reviewed terms and a clear merchant-of-record disclosure.
- **No false live rail predictions:** give official operator links and regularly review sourced content.

## Repository layout

| Area | Purpose |
| --- | --- |
| `index.html`, `app.js`, `styles.css` | Mobile traveler demo, multilingual reservation preview, sample tours |
| `launch.css`, `launch-i18n.js` | New premium visual layer, mobile navigation and incremental translations |
| `city.js`, `data/` | Discoverable locations and official-line references |
| `en/`, `tr/`, `guide.css` | Editorial visitor guides and SEO groundwork |
| `presentation.html`, `presentation.css` | Responsive corporate product presentation |
| `dashboard.html`, `dashboard.*` | Separate desktop-first **fake-data** partner experience |
| `assets/brand/` | User-selected brand logo and app icons |
| `docs/` | Product, architecture, search and regulatory decisions |
| `tools/` | Lightweight static quality checks and post-deploy sitemap generator |
| `.github/` | CI and GitHub Pages deployment workflow |

## License & brand

The repository can be **publicly readable without being open-source licensed**. No source code or brand license has been granted yet. The Bosphorly logo is a project-owner-selected artwork. Confirm commercial rights and trademark availability before use in production. If open-source reuse is desired, pick an explicit code license later and handle brand assets separately.

See [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [Production gates](docs/LEGAL-GATES.md).