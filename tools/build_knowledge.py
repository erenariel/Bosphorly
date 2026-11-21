#!/usr/bin/env python3
"""Build compact site knowledge chunks for the Bosphorly AI assistant (RAG)."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "backend/knowledge.json"


def build_chunks() -> list[dict[str, str]]:
    chunks: list[dict[str, str]] = []

    # 1. Core service, payment process & contact info
    chunks.append({
        "id": "contact-info",
        "title": "Bosphorly contact & service overview / İletişim",
        "url": "https://bosphorly.com/faq.html",
        "text": (
            "Bosphorly is an independent request service in Istanbul, not a tour company or travel agency. "
            "We pass guest requests for airport transfers, Bosphorus cruises, tours, and Turkish hammam experiences "
            "to licensed local companies and confirm details by email. "
            "Contact email: info@bosphorly.com. Telegram bot: @BosphorlyBot. Website: https://bosphorly.com. "
            "İletişim e-postası: info@bosphorly.com. Bosphorly İstanbul'da bağımsız bir talep hizmetidir."
        ),
    })

    chunks.append({
        "id": "payment-process",
        "title": "Payment process / Ödeme süreci",
        "url": "https://bosphorly.com/faq.html",
        "text": (
            "Nothing is paid on the Bosphorly website. "
            "Ödeme yöntemi talebinden sonra seninle iletişime geçtiğimizde paylaşılır. "
            "We share the payment method when we contact you about your request. "
            "Never share credit card numbers or passport numbers in chat."
        ),
    })

    chunks.append({
        "id": "booking-changes-cancellations",
        "title": "Booking changes, cancellations & refunds / Değişiklik ve iptal",
        "url": "https://bosphorly.com/faq.html",
        "text": (
            "To change or cancel a booking, write to info@bosphorly.com as early as possible with your reference code (BOS-...). "
            "Cancellation terms are provided by email together with your confirmation. "
            "Rezervasyon değişikliği, iptal veya iade talepleri için referans kodunuzla info@bosphorly.com adresine yazın."
        ),
    })

    # 2. FAQ (EN and TR)
    faq = json.loads((ROOT / "data/faq.json").read_text(encoding="utf-8"))
    for lang in ("en", "tr"):
        qa_list = faq.get(lang, {}).get("qa", [])
        for idx, (q, a) in enumerate(qa_list):
            chunks.append({
                "id": f"faq-{lang}-{idx}",
                "title": q,
                "url": f"https://bosphorly.com/faq.html?lang={lang}",
                "text": f"Q: {q} A: {a}",
            })

    # 3. Offers & fixed Sultanahmet transfer rates
    offers = json.loads((ROOT / "data/offers.json").read_text(encoding="utf-8"))
    transfers = offers.get("transfers", {})
    rate_parts = [
        f"{r.get('airport')} to {r.get('zone', 'Sultanahmet').title()}: €{r.get('price_eur')} one-way per vehicle"
        for r in transfers.get("rate_rules", [])
    ]
    chunks.append({
        "id": "transfer-rates",
        "title": "Airport transfer rates (IST / SAW to Sultanahmet) / Havalimanı transfer fiyatları",
        "url": "https://bosphorly.com/booking.html",
        "text": (
            "Fixed one-way airport transfer rates to Sultanahmet per vehicle: "
            + "; ".join(rate_parts)
            + ". Istanbul Airport (IST) -> Sultanahmet €60, Sabiha Gökçen (SAW) -> Sultanahmet €65. "
            "Other Istanbul zones require an individual quote confirmed upon request. "
            "Diğer bölgeler için güncel fiyat talep sırasında teyit edilir."
        ),
    })

    for offer in offers.get("offers", []):
        chunks.append({
            "id": f"offer-{offer['id']}",
            "title": offer["name"],
            "url": f"https://bosphorly.com/booking.html?service={offer['id']}",
            "text": (
                f"{offer['name']} ({offer.get('category', '')}, {offer.get('duration', '')}): "
                f"{offer.get('description', '')} Price is confirmed upon request."
            ),
        })

    # 4. Public market prices (tours & hammam)
    market = json.loads((ROOT / "data/public-market-prices.json").read_text(encoding="utf-8"))
    for rec in market.get("records", []):
        rid = rec.get("id", "")
        title_en = rec.get("title", "")
        title_tr = rec.get("title_tr", "")
        price = rec.get("price")
        currency = rec.get("currency", "EUR")
        basis = rec.get("basis", "per_person")
        price_str = f"Approx. {price} {currency} ({basis}); exact price confirmed upon request." if price is not None else "Price confirmed upon request."
        details = rec.get("details") or {}
        en_det = details.get("en") or {}
        tr_det = details.get("tr") or {}
        summary = en_det.get("summary") or tr_det.get("summary") or ""
        duration = en_det.get("duration") or tr_det.get("duration") or ""
        # Include multilingual titles for keyword matching across languages
        alt_titles = " | ".join(
            str(rec[k]) for k in ("title_tr", "title_ru", "title_ar", "title_de", "title_fr", "title_es")
            if rec.get(k)
        )
        text = f"{title_en} ({alt_titles}). Operator: {rec.get('operator', '')}. {duration}. {price_str} {summary}".strip()
        chunks.append({
            "id": f"tour-{rid}",
            "title": f"{title_en} / {title_tr}" if title_tr else title_en,
            "url": "https://bosphorly.com/prices.html",
            "text": text,
        })

    # 5. Discover places & 2-day route stops (EN + TR)
    disc_en = json.loads((ROOT / "data/discover/en.json").read_text(encoding="utf-8"))
    disc_tr = json.loads((ROOT / "data/discover/tr.json").read_text(encoding="utf-8"))
    for pid, (name_en, desc_en) in disc_en.get("places", {}).items():
        name_tr, desc_tr = disc_tr.get("places", {}).get(pid, ["", ""])
        chunks.append({
            "id": f"place-{pid}",
            "title": f"{name_en} / {name_tr}" if name_tr else name_en,
            "url": "https://bosphorly.com/explore.html",
            "text": f"{name_en}: {desc_en} | {name_tr}: {desc_tr}".strip(" |"),
        })

    for sid, (name_en, desc_en) in disc_en.get("stops", {}).items():
        name_tr, desc_tr = disc_tr.get("stops", {}).get(sid, ["", ""])
        chunks.append({
            "id": f"route-{sid}",
            "title": f"{name_en} / {name_tr}" if name_tr else name_en,
            "url": "https://bosphorly.com/route.html",
            "text": f"2-Day Istanbul Route stop — {name_en}: {desc_en} | {name_tr}: {desc_tr}".strip(" |"),
        })

    return chunks


def text() -> str:
    return json.dumps(build_chunks(), ensure_ascii=False, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    OUT.write_text(text(), encoding="utf-8")
    print(f"Wrote {len(build_chunks())} knowledge chunks to {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
