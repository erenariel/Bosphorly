"""Build data/discover/*.json from tools/discover-src/ (one master file plus one file per language).

master.json holds places (coordinates, category, prices, links, aliases) and route stops with English and
Turkish texts; <lang>.json holds the other languages' texts. Run: python3 tools/build_discover.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "tools" / "discover-src"
OUT = ROOT / "data" / "discover"
LANGS = ["en", "tr", "ru", "uk", "de", "fr", "nl", "ar", "he", "az", "fa", "es", "it", "pt", "hr", "hu", "bs"]
CHECKED = "2026-11-16"
GUIDES = [
    ("en/istanbul-guide.html", "Istanbul travel guide", "en", "essentials tips first visit"),
    ("en/airport-transfer.html", "Istanbul airport transfer guide", "en", "IST SAW airport taxi transfer Sabiha Gökçen"),
    ("en/public-transport.html", "Istanbul public transport", "en", "metro tram ferry Istanbulkart Marmaray bus"),
    ("en/old-city.html", "Byzantine and Ottoman Istanbul", "en", "Sultanahmet Hagia Sophia Topkapı old city"),
    ("en/bosphorus-cruises.html", "Bosphorus cruises and experiences", "en", "boat cruise ferry Bosphorus"),
    ("tr/istanbul-rehberi.html", "İstanbul gezi rehberi", "tr", "gezilecek yerler ipuçları"),
    ("tr/havalimani-transferi.html", "İstanbul havalimanı transfer rehberi", "tr", "IST SAW taksi transfer Sabiha Gökçen"),
    ("tr/toplu-tasima.html", "İstanbul metro ve toplu taşıma", "tr", "metro tramvay vapur İstanbulkart Marmaray otobüs"),
    ("tr/tarihi-yarimada.html", "Bizans ve Osmanlı mirası", "tr", "Sultanahmet Ayasofya Topkapı tarihi yarımada"),
    ("tr/bogaz-turlari.html", "İstanbul Boğaz turları", "tr", "tekne vapur Boğaz turu"),
]


def main():
    master = json.loads((SRC / "master.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    places = [{k: v for k, v in p.items() if k not in LANGS} for p in master["places"]]
    stops = [{k: v for k, v in s.items() if k not in LANGS} for s in master["stops"]]
    guides = [{"href": h, "title": t, "lang": l, "keywords": k} for h, t, l, k in GUIDES]
    base = {"checked": CHECKED, "places": places, "stops": stops, "guides": guides}
    (OUT / "places.json").write_text(json.dumps(base, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    en_ui = master["ui"]["en"]
    for lang in LANGS:
        if lang in ("en", "tr"):
            pack = {"places": {p["id"]: p[lang] for p in master["places"]},
                    "stops": {s["id"]: s[lang] for s in master["stops"]},
                    "ui": master["ui"][lang]}
        else:
            f = SRC / f"{lang}.json"
            if not f.exists():
                continue
            pack = json.loads(f.read_text(encoding="utf-8"))
        missing = [p["id"] for p in places if p["id"] not in pack["places"]] + [s["id"] for s in stops if s["id"] not in pack["stops"]] \
            + [k for k in en_ui if k not in pack["ui"]]
        assert not missing, (lang, missing)
        (OUT / f"{lang}.json").write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("discover data built:", len(places), "places,", len(stops), "stops")


if __name__ == "__main__":
    main()
