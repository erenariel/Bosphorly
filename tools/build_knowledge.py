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
        "url": "https://bosphorly.com/index.html#booking",
        "text": (
            "Fixed one-way airport transfer rates to Sultanahmet per vehicle: "
            + "; ".join(rate_parts)
            + ". Istanbul Airport (IST) -> Sultanahmet €60, Sabiha Gökçen (SAW) -> Sultanahmet €65. "
            "Other Istanbul zones require an individual quote confirmed upon request. "
            "Diğer bölgeler için güncel fiyat talep sırasında teyit edilir. "
            "Transfer booking form: https://bosphorly.com/index.html#booking"
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
        text = f"{title_en} ({alt_titles}). Operator: {rec.get('operator', '')}. {duration}. {price_str} {summary} Service ID: {rid} (https://bosphorly.com/booking.html?service={rid}).".strip()
        chunks.append({
            "id": f"tour-{rid}",
            "title": f"{title_en} / {title_tr}" if title_tr else title_en,
            "url": f"https://bosphorly.com/booking.html?service={rid}",
            "text": text,
        })

    # 5. Discover places, 2-day route stops, themed/private tours & city guide (data/discover + tools/discover-src)
    master = json.loads((ROOT / "tools/discover-src/master.json").read_text(encoding="utf-8"))
    master_places = {p["id"]: p for p in master.get("places", [])}
    master_tours = {t["id"]: t for t in master.get("tours", [])}
    day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    disc_dir = ROOT / "data/discover"
    disc_en = json.loads((disc_dir / "en.json").read_text(encoding="utf-8"))
    disc_tr = json.loads((disc_dir / "tr.json").read_text(encoding="utf-8"))
    all_disc = {}
    for p in sorted(disc_dir.glob("*.json")):
        if p.stem != "places":
            all_disc[p.stem] = json.loads(p.read_text(encoding="utf-8"))

    for pid, (name_en, desc_en) in disc_en.get("places", {}).items():
        name_tr, desc_tr = disc_tr.get("places", {}).get(pid, ["", ""])
        mp = master_places.get(pid, {})
        meta_parts = []
        if mp.get("district"):
            meta_parts.append(f"District: {mp['district']}")
        if mp.get("price") == "free":
            meta_parts.append("Entry: free")
        elif isinstance(mp.get("price"), dict):
            pr = mp["price"]
            rng = f"{pr.get('min')}–{pr['max']}" if pr.get("max") else f"{pr.get('min')}"
            meta_parts.append(f"Indicative ticket: approx. {rng} {pr.get('cur', 'EUR')} (verify on official site)")
        if mp.get("closed"):
            closed_str = ", ".join(day_names[d] for d in mp["closed"] if 0 <= d < 7)
            if closed_str:
                meta_parts.append(f"Usually closed: {closed_str} (check official site)")
        aliases = list(mp.get("aliases") or [])
        for lc, dpack in all_disc.items():
            if lc in ("en", "tr"):
                continue
            loc_entry = dpack.get("places", {}).get(pid)
            if loc_entry and loc_entry[0] and loc_entry[0] not in aliases:
                aliases.append(loc_entry[0])
        alias_str = f"Aliases: {' | '.join(aliases[:14])}." if aliases else ""
        meta_str = " ".join(meta_parts)
        chunks.append({
            "id": f"place-{pid}",
            "title": f"{name_en} / {name_tr}" if name_tr else name_en,
            "url": "https://bosphorly.com/explore.html",
            "text": f"{name_en}: {desc_en} | {name_tr}: {desc_tr} {meta_str} {alias_str}".strip(" |"),
        })

    for sid, (name_en, desc_en) in disc_en.get("stops", {}).items():
        name_tr, desc_tr = disc_tr.get("stops", {}).get(sid, ["", ""])
        stop_aliases = []
        for lc, dpack in all_disc.items():
            if lc in ("en", "tr"):
                continue
            loc_stop = dpack.get("stops", {}).get(sid)
            if loc_stop and loc_stop[0] and loc_stop[0] not in stop_aliases:
                stop_aliases.append(loc_stop[0])
        alias_str = f" ({' | '.join(stop_aliases[:10])})" if stop_aliases else ""
        chunks.append({
            "id": f"route-{sid}",
            "title": f"{name_en} / {name_tr}" if name_tr else name_en,
            "url": "https://bosphorly.com/route.html",
            "text": f"2-Day Istanbul Walking Route stop — {name_en}: {desc_en} | {name_tr}: {desc_tr}{alias_str}".strip(" |"),
        })

    for tid, (name_en, desc_en) in disc_en.get("tours", {}).items():
        name_tr, desc_tr = disc_tr.get("tours", {}).get(tid, ["", ""])
        mt = master_tours.get(tid, {})
        t_meta = []
        if mt.get("from"):
            t_meta.append(f"Market reference from approx. {mt['from'][0]} {mt['from'][1]} (confirmed upon request)")
        if mt.get("route"):
            t_meta.append(f"Route: {' -> '.join(mt['route'])}")
        if mt.get("inc"):
            t_meta.append(f"Usually included: {', '.join(mt['inc'])}")
        if mt.get("exc"):
            t_meta.append(f"Usually excluded: {', '.join(mt['exc'])}")
        t_aliases = []
        for lc, dpack in all_disc.items():
            if lc in ("en", "tr"):
                continue
            loc_t = dpack.get("tours", {}).get(tid)
            if loc_t and loc_t[0] and loc_t[0] not in t_aliases:
                t_aliases.append(loc_t[0])
        alias_str = f"Aliases: {' | '.join(t_aliases[:10])}." if t_aliases else ""
        chunks.append({
            "id": f"discover-tour-{tid}",
            "title": f"{name_en} / {name_tr}" if name_tr else name_en,
            "url": "https://bosphorly.com/tours.html",
            "text": f"{name_en}: {desc_en} | {name_tr}: {desc_tr} {' '.join(t_meta)} {alias_str}".strip(" |"),
        })

    en_ui = disc_en.get("ui", {})
    tr_ui = disc_tr.get("ui", {})
    chunks.append({
        "id": "city-guide-getting-around",
        "title": "Getting around Istanbul & Route tips / Şehirde ulaşım ve gezi ipuçları",
        "url": "https://bosphorly.com/explore.html",
        "text": (
            f"{en_ui.get('gaTitle', '')}: {en_ui.get('gaIst', '')} {en_ui.get('gaSaw', '')} "
            f"{en_ui.get('gaTram', '')} {en_ui.get('gaFerry', '')} {en_ui.get('gaNote', '')} "
            f"Route tips: {en_ui.get('rtLead', '')} {en_ui.get('rtTip1', '')} {en_ui.get('rtTip2', '')} {en_ui.get('rtTip3', '')} | "
            f"{tr_ui.get('gaTitle', '')}: {tr_ui.get('gaIst', '')} {tr_ui.get('gaSaw', '')} "
            f"{tr_ui.get('gaTram', '')} {tr_ui.get('gaFerry', '')} {tr_ui.get('rtTip1', '')} {tr_ui.get('rtTip2', '')}"
        ).strip(),
    })

    return chunks


def text() -> str:
    return json.dumps(build_chunks(), ensure_ascii=False, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    OUT.write_text(text(), encoding="utf-8")
    print(f"Wrote {len(build_chunks())} knowledge chunks to {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
