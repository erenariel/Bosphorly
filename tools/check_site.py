#!/usr/bin/env python3
"""Static integrity smoke tests for the public Bosphorly prototype."""
from __future__ import annotations
import json
import re
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
PAGES = ["index.html", "map.html", "booking.html", "prices.html", "tours.html", "presentation.html", "dashboard.html", "account.html", "explore.html", "route.html", "search.html", "privacy.html", "404.html", "partner.html", "faq.html"]
GUIDE_PAIRS = [
    ("en/istanbul-guide.html", "tr/istanbul-rehberi.html"),
    ("en/airport-transfer.html", "tr/havalimani-transferi.html"),
    ("en/public-transport.html", "tr/toplu-tasima.html"),
    ("en/old-city.html", "tr/tarihi-yarimada.html"),
    ("en/bosphorus-cruises.html", "tr/bogaz-turlari.html"),
]
ALL_PAGES = PAGES + [p for pair in GUIDE_PAIRS for p in pair]


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for attribute in ("href", "src"):
            if values.get(attribute):
                self.paths.append(values[attribute])


def assert_local_links():
    for filename in ALL_PAGES:
        page_path = ROOT / filename
        html = page_path.read_text(encoding="utf-8")
        parser = References()
        parser.feed(html)
        for url in parser.paths:
            if url.startswith(("#", "mailto:", "tel:", "data:", "javascript:", "//")):
                continue
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc:
                continue
            path = unquote(parsed.path)
            if not path or path.startswith("/"):
                continue
            destination = (page_path.parent / path).resolve()
            assert destination.is_relative_to(ROOT), (filename, path)
            assert destination.exists(), f"Broken internal path: {filename} → {path}"


def assert_no_supplier_checkout_redirects():
    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    booking = (ROOT / "booking.html").read_text(encoding="utf-8")
    forbidden = ["bluebrotherstour", "orientbosphorus", "sealandtrip",
                 "azureturizm", "alaturkahamam"]
    for domain in forbidden:
        assert domain not in homepage.lower(), f"Unexpected supplier redirect: {domain}"
        assert domain not in booking.lower(), f"Unexpected supplier redirect: {domain}"
    assert "booking.html?service=" in homepage
    assert "data/public-market-prices.json" in (ROOT / "booking.js").read_text()


def assert_booking_safety():
    offers = json.loads((ROOT / "data/offers.json").read_text(encoding="utf-8"))
    assert offers["booking_enabled"] is False
    assert offers["offers"]
    ids = set()
    for offer in offers["offers"]:
        assert offer["id"] not in ids
        ids.add(offer["id"])
        assert "url" not in offer, "No third-party sales URLs in public offers"
        if offer["price_eur"] is not None:
            assert offer["rate_status"] == "approved"
            assert offer["partner_status"] == "contracted"
    market = json.loads((ROOT / "data/public-market-prices.json").read_text(encoding="utf-8"))
    assert len(market["records"]) >= 35, "Expected researched public operator rates"
    assert market["status"] == "PUBLIC_OPERATOR_PRICE_RESEARCH_NOT_BOSPHORLY_QUOTES"
    assert all(item["price_type"].startswith("listed") or item["price_type"] == "not_publicly_listed" for item in market["records"])
    assert all(item.get("source_url", "").startswith("https://") for item in market["records"])
    rates = {x["airport"]: x for x in offers["transfers"]["rate_rules"]}
    assert rates["IST"]["price_eur"] == 60
    assert rates["SAW"]["price_eur"] == 65
    assert offers["transfers"]["pricing_status"].startswith("FIXED_")
    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "function preferredLanguage()" in homepage
    assert "navigator.languages" in homepage
    assert "hotelPlacesMount" in homepage and "hotelVerification" in homepage
    assert "Illustrative transfer price" not in homepage
    assert "data/home-prices.json" in homepage
    assert "assets/brand/approved-icon.webp" in homepage
    assert "config/maps-public.js" in homepage
    key = (ROOT / "config/maps-public.js").read_text(encoding="utf-8")
    assert 'googleMapsBrowserKey: ""' in key, "Do not commit real Google credentials in the public template"
    assert (ROOT / "assets/brand/approved-icon.webp").stat().st_size > 1000
    assert (ROOT / "assets/maps/istanbul-schematic.svg").stat().st_size > 500
    page = (ROOT / "explore.html").read_text()
    assert 'id="mapFallback"' in page and 'id="getting-around"' in page
    assert "explore.html" in (ROOT / "map.html").read_text(), "map.html must forward to Discover"


def assert_home_prices():
    """The home page reads a small extract of the price catalogue; it must match the catalogue and cover its tour cards."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("build_home_prices", ROOT / "tools/build_home_prices.py")
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)
    current = (ROOT / "data/home-prices.json").read_text(encoding="utf-8")
    assert current == tool.text(), "data/home-prices.json is out of date: run python3 tools/build_home_prices.py"
    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    cards = re.findall(r"\{id:'([^']+)'", homepage[homepage.find("const tours=["):homepage.find("];", homepage.find("const tours=["))])
    assert cards and set(cards) <= set(tool.HOME_IDS), ("Add the home page tour ids to HOME_IDS", set(cards) - set(tool.HOME_IDS))


def assert_hreflang():
    """Pages that switch language with ?lang= list every supported language; verified EN/TR pairs cross-reference each other."""
    langs = re.findall(r"'(\w+)'", re.search(r"const supported = \[([^\]]+)\]", (ROOT / "lang.js").read_text(encoding="utf-8")).group(1))
    for page in ["index.html", "tours.html", "prices.html", "explore.html", "route.html", "faq.html", "booking.html", "search.html"]:
        html = (ROOT / page).read_text(encoding="utf-8")
        found = re.findall(r'hreflang="([\w-]+)" href="([^"]+)"', html)
        assert sorted(l for l, _ in found) == sorted(langs + ["x-default"]), (page, "hreflang list differs from lang.js")
        assert all(h.endswith("?lang=" + l) for l, h in found if l != "x-default"), page
    priv = dict(re.findall(r'hreflang="([\w-]+)" href="([^"]+)"', (ROOT / "privacy.html").read_text(encoding="utf-8")))
    assert priv == {
        "tr": "https://bosphorly.com/privacy.html?lang=tr",
        "en": "https://bosphorly.com/privacy.html?lang=en",
        "x-default": "https://bosphorly.com/privacy.html",
    }, priv
    for en_page, tr_page in GUIDE_PAIRS:
        expected = {
            "en": f"https://bosphorly.com/{en_page}",
            "tr": f"https://bosphorly.com/{tr_page}",
            "x-default": f"https://bosphorly.com/{en_page}",
        }
        for page in (en_page, tr_page):
            found = dict(re.findall(r'hreflang="([\w-]+)" href="([^"]+)"', (ROOT / page).read_text(encoding="utf-8")))
            assert found == expected, (page, found)


def assert_seo():
    """Verify robots.txt, sitemap.xml, unique titles/descriptions, canonicals, visible-only JSON-LD and image attributes."""
    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    assert "User-agent: *" in robots and "Allow: /" in robots
    assert "Sitemap: https://bosphorly.com/sitemap.xml" in robots

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    entries = re.findall(r"<url><loc>([^<]+)</loc><lastmod>(\d{4}-\d{2}-\d{2})</lastmod></url>", sitemap)
    assert entries, "sitemap.xml has no valid <url> entries"
    locs = [loc for loc, _ in entries]
    assert len(locs) == len(set(locs)), "Duplicate URLs in sitemap.xml"
    assert all(loc.startswith("https://bosphorly.com/") for loc in locs), locs
    expected_public = {
        "https://bosphorly.com/" if p == "index.html" else f"https://bosphorly.com/{p}"
        for p in ALL_PAGES
        if p not in {"404.html", "account.html", "dashboard.html", "partner.html", "presentation.html", "map.html"}
    }
    assert set(locs) == expected_public, (set(locs) ^ expected_public)

    titles, descs = {}, {}
    forbidden_ld_keys = {"aggregateRating", "review", "reviews", "ratingValue", "reviewCount", "availability"}
    ld_types_by_page = {}
    for page in ALL_PAGES:
        html = (ROOT / page).read_text(encoding="utf-8")
        t_match = re.search(r"<title>([^<]+)</title>", html)
        d_match = re.search(r'<meta name="description" content="([^"]+)"', html)
        c_match = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        assert t_match and t_match.group(1).strip(), f"Missing <title> in {page}"
        assert d_match and d_match.group(1).strip(), f"Missing meta description in {page}"
        assert c_match and c_match.group(1).startswith("https://bosphorly.com/"), f"Missing/invalid canonical in {page}"
        expected_canon = "https://bosphorly.com/explore.html" if page == "map.html" else (
            "https://bosphorly.com/" if page == "index.html" else f"https://bosphorly.com/{page}"
        )
        assert c_match.group(1) == expected_canon, (page, c_match.group(1), expected_canon)
        titles.setdefault(t_match.group(1).strip(), []).append(page)
        descs.setdefault(d_match.group(1).strip(), []).append(page)

        for raw_ld in re.findall(r'<script type="application/ld\+json"[^>]*>([\s\S]*?)</script>', html):
            data = json.loads(raw_ld)
            assert not (forbidden_ld_keys & set(re.findall(r'"(\w+)"\s*:', raw_ld))), (page, "Forbidden fake review/rating/availability key in JSON-LD")
            ld_types_by_page.setdefault(page, []).append(data.get("@type"))

        for img_tag in re.findall(r"<img\b[^>]*>", html):
            alt_m = re.search(r'\balt="([^"]*)"', img_tag)
            w_m = re.search(r'\bwidth="(\d+)"', img_tag)
            h_m = re.search(r'\bheight="(\d+)"', img_tag)
            l_m = re.search(r'\bloading="lazy"', img_tag)
            assert alt_m and alt_m.group(1).strip(), (page, "Missing/empty alt on img", img_tag)
            assert w_m and h_m and l_m, (page, "Missing width/height/loading=lazy on img", img_tag)

    assert all(len(v) == 1 for v in titles.values()), {k: v for k, v in titles.items() if len(v) > 1}
    assert all(len(v) == 1 for v in descs.values()), {k: v for k, v in descs.items() if len(v) > 1}
    assert "TravelAgency" in ld_types_by_page.get("index.html", []), ld_types_by_page
    assert "FAQPage" in ld_types_by_page.get("faq.html", []), ld_types_by_page


def assert_faq():
    """Every language answers the same questions and names the same links."""
    faq = json.loads((ROOT / "data/faq.json").read_text(encoding="utf-8"))
    langs = re.findall(r"'(\w+)'", re.search(r"const supported = \[([^\]]+)\]", (ROOT / "lang.js").read_text(encoding="utf-8")).group(1))
    assert sorted(faq) == sorted(langs)
    for lang, f in faq.items():
        assert len(f["qa"]) == len(faq["en"]["qa"]) and all(q and a for q, a in f["qa"]), lang
        assert set(f["links"]) == set(faq["en"]["links"]) and all(f[k] for k in ("nav", "title", "intro", "cta", "wa")), lang
        assert all("60" in a and "65" in a for q, a in [f["qa"][2]]) or lang in ("fa",), (lang, "transfer prices")
    faq_html = (ROOT / "faq.html").read_text(encoding="utf-8")
    ld_raw = re.search(r'<script type="application/ld\+json" id="faqLd">([\s\S]*?)</script>', faq_html).group(1)
    ld = json.loads(ld_raw)
    assert ld["@type"] == "FAQPage" and len(ld["mainEntity"]) == len(faq["en"]["qa"])
    for (q, a), entity in zip(faq["en"]["qa"], ld["mainEntity"]):
        assert entity["name"] == q and entity["acceptedAnswer"]["text"] == a
        assert q in faq_html and a in faq_html


def assert_knowledge():
    """The assistant knowledge extract must match tools/build_knowledge.py and carry bosphorly.com URLs."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("build_knowledge", ROOT / "tools/build_knowledge.py")
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)
    current = (ROOT / "backend/knowledge.json").read_text(encoding="utf-8")
    assert current == tool.text(), "backend/knowledge.json is out of date: run python3 tools/build_knowledge.py"
    chunks = json.loads(current)
    assert len(chunks) >= 20
    for c in chunks:
        assert c.get("id") and c.get("title") and c.get("text")
        assert c.get("url", "").startswith("https://bosphorly.com/"), c


def assert_js_parses():
    script_sources = ["booking.js", "dashboard.js", "prices.js", "tours.js", "hotel-lookup.js", "config/maps-public.js", "config/contact.js", "lang.js", "currency.js", "account-store.js", "account.js", "site-header.js", "assistant-chat.js", "discover-common.js", "google-rating.js", "weather.js", "member.js", "account-member.js", "config/api.js", "backend/members.js", "backend/assistant.js", "backend/telegram.js", "backend/worker.js", "explore.js", "route.js", "search.js", "tools/build_discover.py", "tools/build_seo.py"]
    for name in script_sources:
        if name.endswith(".py"):
            continue
        subprocess.run(["node", "--check", str(ROOT / name)], check=True)
    assert_discover_data()
    for page in ALL_PAGES:
        html = (ROOT / page).read_text(encoding="utf-8")
        inline = re.findall(r"<script(?:\s(?![^>]*application/ld\+json)[^>]*)?>([\s\S]*?)</script>", html, re.I)
        for content in inline:
            if not content.strip():
                continue
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".js") as f:
                f.write(content)
                f.flush()
                subprocess.run(["node", "--check", f.name], check=True)


def assert_discover_data():
    """Every language pack of the Discover pages covers every place, stop and label of the English one."""
    import json
    base = json.loads((ROOT / "data/discover/places.json").read_text(encoding="utf-8"))
    en = json.loads((ROOT / "data/discover/en.json").read_text(encoding="utf-8"))
    langs = re.search(r"const supported = \[([^\]]+)\]", (ROOT / "lang.js").read_text(encoding="utf-8")).group(1)
    for lang in re.findall(r"'(\w+)'", langs):
        pack = json.loads((ROOT / f"data/discover/{lang}.json").read_text(encoding="utf-8"))
        for p in base["places"]:
            assert len(pack["places"][p["id"]]) == 2, (lang, p["id"])
            assert -90 < p["lat"] < 90 and -180 < p["lng"] < 180
        for s in base["stops"]:
            assert len(pack["stops"][s["id"]]) == 2, (lang, s["id"])
        assert set(en["ui"]) <= set(pack["ui"]), (lang, set(en["ui"]) - set(pack["ui"]))
        # Membership texts: every key, with the same {placeholders} as English.
        men = json.loads((ROOT / "data/members/en.json").read_text(encoding="utf-8"))
        mpack = json.loads((ROOT / f"data/members/{lang}.json").read_text(encoding="utf-8"))
        for k, v in men.items():
            assert k in mpack, (lang, k)
            assert sorted(re.findall(r"\{\w+\}", v)) == sorted(re.findall(r"\{\w+\}", mpack[k])), (lang, k)


if __name__ == "__main__":
    assert_local_links()
    assert_no_supplier_checkout_redirects()
    assert_booking_safety()
    assert_home_prices()
    assert_knowledge()
    assert_hreflang()
    assert_seo()
    assert_faq()
    assert_js_parses()
    print("Bosphorly: internal links, booking safety, SEO metadata, logo, map and JS syntax OK.")
