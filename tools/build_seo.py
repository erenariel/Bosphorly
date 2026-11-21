#!/usr/bin/env python3
"""Search metadata builder for Bosphorly (see docs/SEO.md).

    python3 tools/build_seo.py                 # update canonical/hreflang links, FAQ JSON-LD, and sitemap.xml
    python3 tools/build_seo.py --sitemap-only  # refresh sitemap.xml lastmod only

What it maintains:
- sitemap.xml: every indexable public page (no robots noindex, no meta refresh) under https://bosphorly.com/,
  with lastmod = latest commit date (UTC) of the page and its content sources.
- <link rel="canonical" href="https://bosphorly.com/..."> in the static <head> of every HTML page.
- <link rel="alternate" hreflang="..."> on ?lang= pages, privacy.html (TR/EN), and verified EN/TR guide pairs.
- faq.html: static answers and FAQPage JSON-LD from data/faq.json (English default), kept in sync.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://bosphorly.com/"
# Pages that switch across all supported languages with ?lang=.
ADAPTIVE_ALL = ["index.html", "explore.html", "tours.html", "prices.html", "route.html", "faq.html", "booking.html", "search.html"]
# Pages that switch between verified Turkish and English with ?lang=.
ADAPTIVE_TR_EN = ["privacy.html"]
# Visible content that lives outside the page file, for lastmod.
CONTENT_SOURCES = {
    "index.html": ["data/offers.json", "data/public-market-prices.json", "data/home-prices.json"],
    "prices.html": ["prices.js", "data/public-market-prices.json"],
    "tours.html": ["tours.js"],
    "explore.html": ["explore.js", "data/discover/places.json", "data/discover/en.json", "data/discover/tr.json"],
    "route.html": ["route.js", "data/discover/places.json", "data/discover/en.json", "data/discover/tr.json"],
    "faq.html": ["data/faq.json"],
    "booking.html": ["booking.js"],
    "search.html": ["search.js"],
}
# FAQ answers that point to a page: question index -> (link key in data/faq.json, address). Mirrors faq.html.
FAQ_LINKS = {2: ("transfer", "index.html#booking"), 6: ("privacy", "privacy.html"),
             7: ("account", "account.html"), 8: ("email", "mailto:info@bosphorly.com")}


def site_pages() -> list[str]:
    """Every page of the site (root, en/, tr/), as paths relative to the repository."""
    files = list(ROOT.glob("*.html")) + list((ROOT / "en").glob("*.html")) + list((ROOT / "tr").glob("*.html"))
    return sorted(p.relative_to(ROOT).as_posix() for p in files)


def page_url(rel: str) -> str:
    return SITE + ("" if rel == "index.html" else rel)


def canonical_url(rel: str) -> str:
    if rel == "map.html":
        return page_url("explore.html")
    return page_url(rel)


def is_indexable(rel: str) -> bool:
    text = (ROOT / rel).read_text(encoding="utf-8")
    robots = re.search(r'<meta name="robots" content="([^"]*)"', text)
    if robots and "noindex" in robots.group(1):
        return False
    return not re.search(r'http-equiv="refresh"', text, re.I)


def indexable_pages() -> list[str]:
    return [p for p in site_pages() if is_indexable(p)]


def supported_langs() -> list[str]:
    block = re.search(r"const supported = \[([^\]]+)\]", (ROOT / "lang.js").read_text(encoding="utf-8")).group(1)
    return re.findall(r"'(\w+)'", block)


# ---------------------------------------------------------------- sitemap

def _git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


def history_available() -> bool:
    try:
        return _git("rev-parse", "--is-shallow-repository") == "false"
    except (OSError, subprocess.CalledProcessError):
        return False


def last_changed(rel: str) -> str:
    """Latest commit date (UTC, YYYY-MM-DD) of the page and its content sources; today if edited locally."""
    files = [rel] + [f for f in CONTENT_SOURCES.get(rel, []) if (ROOT / f).exists()]
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    if _git("status", "--porcelain", "--", *files):
        return today
    dates = []
    for f in files:
        stamp = _git("log", "-1", "--format=%cI", "--", f)
        if stamp:
            dates.append(dt.datetime.fromisoformat(stamp).astimezone(dt.timezone.utc).date().isoformat())
    return max(dates) if dates else today


def current_lastmods() -> dict[str, str]:
    path = ROOT / "sitemap.xml"
    if not path.exists():
        return {}
    return dict(re.findall(r"<loc>([^<]+)</loc><lastmod>([^<]+)</lastmod>", path.read_text(encoding="utf-8")))


def build_sitemap() -> None:
    known = current_lastmods()
    history = history_available()
    if not history:
        print("build_seo: no git history (shallow clone); keeping existing lastmod values", file=sys.stderr)
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    pages = sorted(indexable_pages(), key=lambda p: (p != "index.html", "/" in p, p))
    rows = []
    for rel in pages:
        loc = page_url(rel)
        lastmod = last_changed(rel) if history else known.get(loc, today)
        rows.append(f"  <url><loc>{loc}</loc><lastmod>{lastmod}</lastmod></url>")
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n")
    (ROOT / "sitemap.xml").write_text(xml, encoding="utf-8")


# ---------------------------------------------------------------- canonical and hreflang

LANG_BLOCK = re.compile(r"(?:<!-- seo:lang -->.*?<!-- /seo:lang -->\n?)|(?:(?:<!-- Language versions:[^\n]*-->\n)?"
                        r"(?:<link rel=\"alternate\" hreflang=\"[\w-]+\" href=\"[^\"]+\">\n?)+)", re.S)


def hreflang_block(rel: str, langs: list[str]) -> str:
    base = page_url(rel)
    links = "".join(f'<link rel="alternate" hreflang="{l}" href="{base}?lang={l}">\n' for l in langs)
    return ("<!-- Language versions: the page switches language with ?lang=, so each one has its own address. -->\n"
            + links + f'<link rel="alternate" hreflang="x-default" href="{base}">\n')


def set_canonical(text: str, href: str) -> str:
    text = re.sub(r'<link rel="canonical" href="[^"]*">\n?', "", text)
    tag = f'<link rel="canonical" href="{href}">'
    return re.sub(r"(</title>\n?)", lambda m: m.group(1) + tag + ("\n" if m.group(1).endswith("\n") else ""), text, count=1)


def build_links() -> None:
    all_langs = supported_langs()
    for rel in site_pages():
        path = ROOT / rel
        text = original = path.read_text(encoding="utf-8")
        text = set_canonical(text, canonical_url(rel))
        if rel in ADAPTIVE_ALL or rel in ADAPTIVE_TR_EN:
            langs = all_langs if rel in ADAPTIVE_ALL else ["tr", "en"]
            block = hreflang_block(rel, langs)
            if LANG_BLOCK.search(text):
                text, n = LANG_BLOCK.subn(lambda _m: block, text, count=1)
                assert n == 1, f"{rel}: language links not updated"
            else:
                text = text.replace("</head>", block + "</head>", 1)
        if text != original:
            path.write_text(text, encoding="utf-8")


# ---------------------------------------------------------------- FAQ

def faq_jsonld(entry: dict, lang: str) -> dict:
    return {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": lang,
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}}
                           for q, a in entry["qa"]]}


def script_json(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def build_faq() -> None:
    path = ROOT / "faq.html"
    text = path.read_text(encoding="utf-8")
    en = json.loads((ROOT / "data/faq.json").read_text(encoding="utf-8"))["en"]
    items = []
    for i, (q, a) in enumerate(en["qa"]):
        more = ""
        if i in FAQ_LINKS:
            key, href = FAQ_LINKS[i]
            more = f'<a class="more" href="{href}">{html.escape(en["links"][key], quote=False)}</a>'
        items.append(f'<details class="qa"{" open" if i == 0 else ""}><summary>{html.escape(q, quote=False)}</summary>'
                     f'<p>{html.escape(a, quote=False)}</p>{more}</details>')
    text = re.sub(r'<div id="list">.*?</div>\n', lambda _m: '<div id="list">' + "".join(items) + "</div>\n", text, count=1, flags=re.S)
    text = re.sub(r'(<h1 id="title">)[^<]*(</h1>)', lambda m: m.group(1) + html.escape(en["title"], quote=False) + m.group(2), text, count=1)
    text = re.sub(r'(<p class="lead" id="intro">)[^<]*(</p>)', lambda m: m.group(1) + html.escape(en["intro"], quote=False) + m.group(2), text, count=1)
    text = re.sub(r'(<a class="ask" id="ask"[^>]*>)[^<]*(</a>)', lambda m: m.group(1) + html.escape(en["cta"], quote=False) + m.group(2), text, count=1)
    ld = f'<script type="application/ld+json" id="faqLd">{script_json(faq_jsonld(en, "en"))}</script>'
    if 'id="faqLd"' in text:
        text = re.sub(r'<script type="application/ld\+json" id="faqLd">.*?</script>', lambda _m: ld, text, count=1, flags=re.S)
    else:
        text = text.replace("</head>", ld + "\n</head>", 1)
    path.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    if "--sitemap-only" not in sys.argv:
        build_links()
        build_faq()
    build_sitemap()
    print("build_seo: sitemap.xml" + ("" if "--sitemap-only" in sys.argv else ", canonical/hreflang links and FAQ structured data") + " updated.")
