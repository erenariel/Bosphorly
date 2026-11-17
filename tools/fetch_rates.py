#!/usr/bin/env python3
"""Refresh data/rates.json: TRY value of each display currency.

Order of sources:
  1. TCMB (Central Bank of the Republic of Türkiye) indicative rates, forex selling. Official; published on
     working days around 15:30 Istanbul time. Used unless its bulletin is more than MAX_AGE_DAYS old
     (long public holidays), or it cannot be reached.
  2. ExchangeRate-API open access endpoint (daily market rates, no key; attribution required).
  3. fawazahmed0 currency-api (daily market rates, free, served by jsDelivr / Cloudflare Pages).
On total failure the existing file is kept, so the site always has the last good rates and shows their date.

  python3 tools/fetch_rates.py          refresh data/rates.json
  python3 tools/fetch_rates.py --check  try every source and print what each returns (writes nothing)
"""
from __future__ import annotations
import datetime as dt
import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "rates.json"
CODES = ["EUR", "USD", "GBP", "RUB", "SAR", "AED", "AZN"]
MAX_AGE_DAYS = 4
TCMB_URL = "https://www.tcmb.gov.tr/kurlar/today.xml"
ERAPI_URL = "https://open.er-api.com/v6/latest/TRY"
CURAPI_URLS = ["https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/try.json",
               "https://latest.currency-api.pages.dev/v1/currencies/try.json"]


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "Bosphorly-rates/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read()


def num(text: str | None) -> float | None:
    try:
        return float(text) if text and text.strip() else None
    except ValueError:
        return None


def require_core(rates: dict) -> None:
    missing = [c for c in ("EUR", "USD") if c not in rates]
    if missing:
        raise ValueError(f"source lacks {missing}")


def tcmb() -> dict:
    root = ET.fromstring(get(TCMB_URL))
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
    require_core(rates)
    return {"kind": "tcmb", "source": "TCMB (Türkiye Cumhuriyet Merkez Bankası) gösterge niteliğindeki kurlar",
            "source_name": "TCMB", "source_url": TCMB_URL, "date": root.get("Tarih"), "bulletin": root.get("Bulten_No"),
            "basis": "forex_selling", "rates": rates}


def from_per_try(per_try: dict, day: dt.date, kind: str, name: str, url: str) -> dict:
    """Market sources give units of foreign currency per 1 TRY; the site needs TRY per unit."""
    rates = {}
    for code in CODES:
        v = per_try.get(code) or per_try.get(code.lower())
        if v:
            rates[code] = {"unit": 1, "forex_selling": round(1 / float(v), 6)}
    require_core(rates)
    return {"kind": kind, "source": name + " (daily market rates)", "source_name": name, "source_url": url,
            "date": day.strftime("%d.%m.%Y"), "basis": "market", "rates": rates}


def erapi() -> dict:
    j = json.loads(get(ERAPI_URL))
    if j.get("result") != "success":
        raise ValueError(f"result {j.get('result')}")
    day = dt.datetime.fromtimestamp(int(j["time_last_update_unix"]), dt.timezone.utc).date()
    return from_per_try(j["rates"], day, "market", "ExchangeRate-API", "https://www.exchangerate-api.com")


def curapi() -> dict:
    last = None
    for url in CURAPI_URLS:
        try:
            j = json.loads(get(url))
            return from_per_try(j["try"], dt.date.fromisoformat(j["date"]), "market", "currency-api", url)
        except Exception as exc:  # try the mirror
            last = exc
    raise last


SOURCES = [("TCMB", tcmb), ("ExchangeRate-API", erapi), ("currency-api", curapi)]


def age_days(data: dict, today: dt.date) -> int:
    d = dt.datetime.strptime(data["date"], "%d.%m.%Y").date()
    return (today - d).days


def pick(today: dt.date) -> dict | None:
    for name, fn in SOURCES:
        try:
            data = fn()
        except Exception as exc:
            print(f"rates: {name} failed ({exc})", file=sys.stderr)
            continue
        if age_days(data, today) > MAX_AGE_DAYS:
            print(f"rates: {name} is {age_days(data, today)} days old, trying the next source", file=sys.stderr)
            continue
        return data
    return None


def main(argv: list[str]) -> int:
    today = dt.datetime.now(dt.timezone.utc).date()
    if "--check" in argv:
        for name, fn in SOURCES:
            try:
                d = fn()
                print(f"{name}: OK {d['date']} ({age_days(d, today)} d) " + ", ".join(f"{k} {v['forex_selling']}" for k, v in d["rates"].items()))
            except Exception as exc:
                print(f"{name}: FAILED {exc}")
        return 0
    data = pick(today)
    if not data:
        print("rates: kept existing file", file=sys.stderr)
        return 0
    data = {**data, "base": "TRY", "fetched_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"rates: {data['source_name']} {data['date']}: " + ", ".join(f"{k} {v['forex_selling']}" for k, v in data["rates"].items()))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
