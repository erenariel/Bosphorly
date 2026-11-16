#!/usr/bin/env python3
"""Fetch the Central Bank of the Republic of Türkiye (TCMB) daily rates into data/rates.json.

Runs during the Pages deploy (daily schedule). On any failure it keeps the existing file,
so the site always has the last good bulletin and shows its date.
"""
from __future__ import annotations
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

URL = "https://www.tcmb.gov.tr/kurlar/today.xml"
OUT = Path(__file__).resolve().parents[1] / "data" / "rates.json"
CODES = ["EUR", "USD", "GBP", "RUB", "SAR", "AED", "AZN"]


def num(text: str | None) -> float | None:
    try:
        return float(text) if text and text.strip() else None
    except ValueError:
        return None


def parse(xml: bytes) -> dict:
    root = ET.fromstring(xml)
    rates = {}
    for cur in root.findall("Currency"):
        code = cur.get("CurrencyCode") or cur.get("Kod")
        if code not in CODES:
            continue
        unit = int(cur.findtext("Unit") or "1")
        selling = num(cur.findtext("ForexSelling"))
        if not selling:
            continue
        rates[code] = {"unit": unit, "forex_selling": selling,
                       "forex_buying": num(cur.findtext("ForexBuying")),
                       "banknote_selling": num(cur.findtext("BanknoteSelling"))}
    missing = [c for c in ("EUR", "USD") if c not in rates]
    if missing:
        raise ValueError(f"bulletin lacks {missing}")
    return {"source": "TCMB (Türkiye Cumhuriyet Merkez Bankası) gösterge niteliğindeki kurlar",
            "source_url": URL, "date": root.get("Tarih"), "bulletin": root.get("Bulten_No"),
            "basis": "forex_selling", "base": "TRY", "rates": rates}


def main() -> int:
    try:
        with urllib.request.urlopen(URL, timeout=20) as resp:
            data = parse(resp.read())
    except Exception as exc:  # keep the last good file
        print(f"rates: kept existing file ({exc})", file=sys.stderr)
        return 0
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"rates: {data['date']} bulletin {data['bulletin']}: " + ", ".join(f"{k} {v['forex_selling']}" for k, v in data["rates"].items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
