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
PAGES = ["index.html", "map.html", "booking.html", "prices.html", "presentation.html", "dashboard.html"]


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
    assert rates["IST"]["price_eur"] == 55
    assert rates["SAW"]["price_eur"] == 65
    assert offers["transfers"]["pricing_status"].startswith("FIXED_")
    homepage = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "function preferredLanguage()" in homepage
    assert "navigator.languages" in homepage
    assert "hotelPlacesMount" in homepage and "hotelVerification" in homepage
    assert "Illustrative transfer price" not in homepage
    assert "data/public-market-prices.json" in homepage
    assert "assets/brand/approved-icon.webp" in homepage
    assert "config/maps-public.js" in homepage
    key = (ROOT / "config/maps-public.js").read_text(encoding="utf-8")
    assert 'googleMapsBrowserKey: ""' in key, "Do not commit real Google credentials in the public template"
    assert (ROOT / "assets/brand/approved-icon.webp").stat().st_size > 1000
    assert (ROOT / "assets/maps/istanbul-schematic.svg").stat().st_size > 500
    page = (ROOT / "map.html").read_text()
    assert 'id="mapFallback"' in page
    assert "tileload" in page


def assert_js_parses():
    script_sources = ["booking.js", "dashboard.js", "prices.js", "hotel-lookup.js", "config/maps-public.js", "config/contact.js"]
    for name in script_sources:
        subprocess.run(["node", "--check", str(ROOT / name)], check=True)
    for page in PAGES:
        html = (ROOT / page).read_text(encoding="utf-8")
        inline = re.findall(r"<script(?:\s[^>]*)?>([\s\S]*?)</script>", html, re.I)
        for content in inline:
            if not content.strip():
                continue
            with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".js") as f:
                f.write(content)
                f.flush()
                subprocess.run(["node", "--check", f.name], check=True)


if __name__ == "__main__":
    assert_local_links()
    assert_no_supplier_checkout_redirects()
    assert_booking_safety()
    assert_js_parses()
    print("Bosphorly: internal links, booking safety, logo, map and JS syntax OK.")
