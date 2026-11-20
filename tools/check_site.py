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
PAGES = ["index.html", "map.html", "booking.html", "prices.html", "presentation.html", "dashboard.html", "account.html", "explore.html", "route.html", "search.html", "privacy.html", "404.html", "partner.html"]


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
    for filename in PAGES:
        html = (ROOT / filename).read_text(encoding="utf-8")
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
            destination = (ROOT / path).resolve()
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
    """Pages that switch language with ?lang= list every supported language for search engines."""
    langs = re.findall(r"'(\w+)'", re.search(r"const supported = \[([^\]]+)\]", (ROOT / "lang.js").read_text(encoding="utf-8")).group(1))
    for page in ["index.html", "tours.html", "prices.html", "explore.html", "route.html"]:
        html = (ROOT / page).read_text(encoding="utf-8")
        found = re.findall(r'hreflang="([\w-]+)" href="([^"]+)"', html)
        assert sorted(l for l, _ in found) == sorted(langs + ["x-default"]), (page, "hreflang list differs from lang.js")
        assert all(h.endswith("?lang=" + l) for l, h in found if l != "x-default"), page


def assert_js_parses():
    script_sources = ["booking.js", "dashboard.js", "prices.js", "hotel-lookup.js", "config/maps-public.js", "config/contact.js", "lang.js", "currency.js", "account-store.js", "account.js", "site-header.js", "discover-common.js", "google-rating.js", "weather.js", "member.js", "account-member.js", "config/api.js", "backend/members.js", "explore.js", "route.js", "search.js", "tools/build_discover.py"]
    for name in script_sources:
        if name.endswith(".py"):
            continue
        subprocess.run(["node", "--check", str(ROOT / name)], check=True)
    assert_discover_data()
    for page in PAGES:
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
    assert_hreflang()
    assert_js_parses()
    print("Bosphorly: internal links, booking safety, logo, map and JS syntax OK.")
