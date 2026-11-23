#!/usr/bin/env python3
"""Build compact site knowledge chunks for the Bosphorly AI assistant (RAG).

Mimo does not edit this file or backend/knowledge.json by itself.
Additions are made only with the site owner's approval by running this script.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "backend/knowledge.json"

PRICE_KEYWORDS_23 = (
    "fiyat fiyatı fiyatlar ücreti kaç para kaç euro ne kadar "
    "price prices cost rate fare fee how much "
    "цена стоимость сколько стоит тариф "
    "ціна вартість скільки коштує тариф "
    "preis preise kosten wie viel tarif "
    "prix tarif coût combien "
    "prijs prijzen kosten tarief hoeveel "
    "سعر الأسعار تكلفة كم سعر بكم "
    "מחיר מחירים עלות כמה עולה "
    "qiymət qiyməti neçəyədir "
    "قیمت هزینه چقدر است "
    "precio precios tarifa cuánto cuesta "
    "prezzo prezzi tariffa quanto costa "
    "preço preços tarifa quanto custa "
    "cijena cijene koliko košta "
    "ár árak díj mennyibe kerül "
    "cijena cijene koliko košta "
    "价格 多少钱 费用 价钱 "
    "料金 価格 いくら 費用 "
    "가격 요금 얼마 비용 "
    "कीमत दाम किराया कितना है "
    "দাম ভাড়া খরচ কত "
    "harga biaya tarif berapa"
)

TRANSFER_KEYWORDS_23 = (
    "IST SAW istanbul airport sabiha gokcen gökçen sultanahmet airport transfer "
    "havalimanı transferi havaalanı transfer özel araç shuttle otel "
    "трансфер аэропорт аэропорта стамбул сабиха гекчен султанахмет "
    "трансфер аеропорт аеропорту стамбул сабіха султанахмет "
    "flughafentransfer flughafen transfer fahrzeug "
    "transfert aéroport aeroport véhicule navette "
    "luchthaventransfer luchthaven vliegveld transfer "
    "نقل المطار توصيل مطار اسطنبول صبيحة جوكشن السلطان أحمد سلطان احمد سيارة "
    "הסעה משדה התעופה העברה שדה תעופה נמל התעופה איסטנבול סביחה גוקצן סולטן אחמט "
    "hava limanı transferi istanbul sultanəhməd "
    "ترانسفر فرودگاه فرودگاهی استانبول صبیحه سلطان احمد "
    "traslado aeropuerto estambul vehículo "
    "transfer aeroporto trasferimento istanbul "
    "traslado aeroporto transfer istambul "
    "transfer zračna luka aerodrom prijevoz "
    "reptéri transzfer repülőtér isztambul szálloda "
    "transfer aerodrom prevoz "
    "机场接送 接送 伊斯坦布尔机场 萨比哈 苏丹艾哈迈德 "
    "空港送迎 送迎 イスタンブール空港 サビハ スルタンアフメット "
    "공항 픽업 샌딩 이동 이스탄불 공항 사비하 술탄아흐메트 "
    "एयरपोर्ट ट्रांसफ़र ट्रांसफर इस्तांबुल एयरपोर्ट सबीहा सुल्तानअहमत "
    "এয়ারপোর্ট ট্রান্সফার ইস্তাম্বুল এয়ারপোর্ট সাবিহা সুলতানআহমেত "
    "transfer bandara antar jemput bandara istanbul"
)

CRUISE_KEYWORDS_23 = (
    "boğaz turu boğaziçi tekne yat gezisi gemi "
    "bosphorus cruise boat tour yacht sightseeing "
    "круиз по босфору босфор прогулка теплоход яхта "
    "круїз босфором босфор прогулянка теплохід яхта "
    "bosporus fahrt schifffahrt bootstour kreuzfahrt "
    "croisière bosphore promenade bateau "
    "bosporus cruise rondvaart boottocht "
    "رحلة البوسفور جولة بوسفور سفينة قارب يخت كروز "
    "שייט בבוספורוס שיט בוספורוס הפלגה סירה "
    "boğaz turu bosfor kruiz gəmi gəzintisi "
    "کروز بسفر گشت دریایی قایق کشتی تنگه بسفر "
    "crucero bósforo paseo barco "
    "crociera bosforo giro barca "
    "cruzeiro bósforo passeio barco "
    "krstarenje bosporom bospor brod "
    "boszporusz hajóút hajókirándulás sétahajó "
    "krstarenje bosporom bospor brod "
    "博斯普鲁斯 海峡 游船 观光船 "
    "ボスポラス クルーズ 遊覧船 "
    "보스포루스 크루즈 유람선 투어 "
    "बोस्फोरस क्रूज़ बोट टूर "
    "বসফরাস ক্রুজ নৌভ্রমণ "
    "pelayaran bosporus bosphorus kapal pesiar"
)

HAMMAM_KEYWORDS_23 = (
    "hamam türk hamamı kese köpük masaj "
    "hammam turkish bath massage spa "
    "хаммам хамам турецкая баня массаж "
    "хамам турецька лазня масаж "
    "hamam türkisches bad massage "
    "hammam bain turc massage "
    "hamam turks bad massage "
    "حمام تركي الحمّام التركي تدليك مساج "
    "חמאם חמאם טורקי עיסוי ספא "
    "hamam türk hamamı masaj "
    "حمام ترکی حمام ماساژ "
    "hammam baño turco masaje "
    "hammam bagno turco massaggio "
    "hammam banho turco massagem "
    "hamam turska kupelj masaža "
    "hamam törökfürdő masszázs "
    "hamam tursko kupatilo masaža "
    "土耳其浴 土耳其浴室 按摩 "
    "ハマム トルコ式風呂 マッサージ "
    "하맘 터키식 목욕 마사지 "
    "हम्माम तुर्की स्नान मसाज "
    "হামাম তুর্কি স্নান ম্যাসাজ "
    "hamam pemandian turki pijat"
)

CRUISE_FLAGSHIP_IDS = {
    "bb-morning",
    "bb-afternoon",
    "bb-sunset",
    "orient-classic",
    "orient-dinner",
    "sea-land",
    "sl-sunset",
    "sl-generic-cruise",
    "azure-bosphorus",
    "azure-halfbosphorus",
}

TOUR_CATEGORY_MAP = {
    "bb-morning": "cruise",
    "bb-afternoon": "cruise",
    "bb-sunset": "cruise",
    "bb-oldcity": "city",
    "bb-europeasia": "city",
    "orient-classic": "cruise",
    "orient-dinner": "dinner",
    "orient-alacarte": "dinner",
    "orient-private-newyear": "dinner",
    "orient-newyear-special": "dinner",
    "sea-land": "cruise",
    "sl-afternoon": "cruise",
    "sl-sunset": "cruise",
    "sl-generic-cruise": "cruise",
    "sl-privateyacht": "cruise",
    "sl-two-continents": "city",
    "sl-oldcity": "city",
    "sl-asia-half": "city",
    "sl-asia-afternoon": "city",
    "sl-islands": "islands",
    "sl-turkish-breakfast": "dinner",
    "sl-dinner": "dinner",
    "azure-bosphorus": "cruise",
    "azure-halfbosphorus": "cruise",
    "azure-two-continents": "city",
    "azure-city": "city",
    "azure-dinner": "dinner",
    "azure-islands": "islands",
    "azure-bursa": "day",
    "azure-sapanca": "day",
    "azure-sileagva": "day",
    "azure-yalova": "day",
    "azure-triple-eurplane": "day",
    "azure-triple-eurbus": "day",
    "azure-transfer": "transfer",
    "alaturka": "wellness",
    "alaturka-peeling": "wellness",
    "alaturka-sultan": "wellness",
    "alaturka-massage": "wellness",
}

MIMO_FAVORITE_BY_CATEGORY = {
    "transfer": "transfer-rates",
    "cruise": "tour-bb-sunset",
    "dinner": "tour-orient-dinner",
    "city": "tour-bb-oldcity",
    "wellness": "tour-alaturka",
    "islands": "tour-azure-islands",
    "day": "tour-azure-bursa",
    "themed": "discover-tour-ottoman-imperial",
    "hoods": "discover-tour-kadikoy-moda",
    "panoramic": "discover-tour-panoramic-bus",
    "private": "discover-tour-private-guide",
    "multi": "discover-tour-anatolian-civilizations",
}

MIMO_FAVORITE_IDS = set(MIMO_FAVORITE_BY_CATEGORY.values())



def build_chunks() -> list[dict[str, str]]:
    chunks: list[dict[str, str]] = []

    # 1. Core service, payment process & contact info
    chunks.append({
        "id": "contact-info",
        "title": "Bosphorly contact & service overview / İletişim",
        "url": "https://bosphorly.com/faq.html",
        "text": (
            "Bosphorly is an independent request service in Istanbul (not a tour agency). "
            "We pass guest requests for airport transfers, Bosphorus cruises, tours, and hammams "
            "to licensed local companies and confirm details by email (info@bosphorly.com). "
            "Telegram bot: @BosphorlyBot."
        ),
        "keywords": "bosphorly contact email info@bosphorly.com telegram @BosphorlyBot iletişim hakkında",
    })

    chunks.append({
        "id": "payment-process",
        "title": "Payment process / Ödeme süreci",
        "url": "https://bosphorly.com/faq.html",
        "text": (
            "Nothing is paid on the Bosphorly website. "
            "Ödeme yöntemi talebinden sonra seninle iletişime geçtiğimizde paylaşılır. "
            "We share the payment method when we contact you about your request. "
            "Never share card or passport numbers in chat."
        ),
        "keywords": "payment method ödeme yöntemi nasıl ödenir pay how to pay",
    })

    chunks.append({
        "id": "booking-changes-cancellations",
        "title": "Booking changes, cancellations & refunds / Değişiklik ve iptal",
        "url": "https://bosphorly.com/faq.html",
        "text": (
            "To change or cancel a booking, write to info@bosphorly.com early with your BOS- reference code. "
            "Cancellation terms are provided by email with your confirmation."
        ),
        "keywords": "change cancel refund değişiklik iptal iade referans BOS",
    })

    # 2. FAQ (EN and TR)
    faq = json.loads((ROOT / "data/faq.json").read_text(encoding="utf-8"))
    for lang in ("en", "tr"):
        qa_list = faq.get(lang, {}).get("qa", [])
        for idx, (q, a) in enumerate(qa_list):
            chunk = {
                "id": f"faq-{lang}-{idx}",
                "title": q,
                "url": f"https://bosphorly.com/faq.html?lang={lang}",
                "text": f"Q: {q} A: {a}",
            }
            if idx == 2:
                chunk["keywords"] = f"{PRICE_KEYWORDS_23} IST SAW Sultanahmet €60 €65"
            chunks.append(chunk)

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
        "category": "transfer",
        "favorite": True,
        "text": (
            "Mimo'nun favorisi 💙 (Transfer): Fixed one-way airport transfer rates to Sultanahmet per vehicle (confirmed upon request): "
            + "; ".join(rate_parts)
            + ". Istanbul Airport (IST) -> Sultanahmet €60, Sabiha Gökçen (SAW) -> Sultanahmet €65. "
            "Other zones require an individual quote. "
            "Form: https://bosphorly.com/index.html#booking"
        ),
        "keywords": f"{TRANSFER_KEYWORDS_23} {PRICE_KEYWORDS_23} €60 €65 60 65",
    })

    market = json.loads((ROOT / "data/public-market-prices.json").read_text(encoding="utf-8"))
    market_ids = {rec.get("id", "") for rec in market.get("records", [])}

    for offer in offers.get("offers", []):
        if offer.get("id") in market_ids:
            continue
        chunks.append({
            "id": f"offer-{offer['id']}",
            "title": offer["name"],
            "url": f"https://bosphorly.com/booking.html?service={offer['id']}",
            "category": offer.get("category", ""),
            "text": (
                f"{offer['name']} ({offer.get('category', '')}, {offer.get('duration', '')}): "
                f"{offer.get('description', '')} Confirmed upon request."
            ),
            "keywords": offer.get("slug", "").replace("-", " "),
        })

    # 4. Public market prices (tours & hammam) — compact text + 23-language keywords
    for rec in market.get("records", []):
        rid = rec.get("id", "")
        chunk_id = f"tour-{rid}"
        cat = TOUR_CATEGORY_MAP.get(rid, "cruise")
        is_fav = chunk_id in MIMO_FAVORITE_IDS
        title_en = rec.get("title", "")
        title_tr = rec.get("title_tr", "")
        price = rec.get("price")
        currency = rec.get("currency", "EUR")
        basis = rec.get("basis", "per_person")
        dur_prices = sorted({
            d.get("price")
            for opt in (rec.get("options") or [])
            for d in (opt.get("durations") or [])
            if d.get("price") is not None
        })
        extra_price = ""
        if dur_prices:
            extra_price = " Options: " + "/".join(str(p) for p in dur_prices) + f" {currency}."
        price_str = (
            f"Approx. {price} {currency} ({basis}); confirmed upon request.{extra_price}"
            if price is not None
            else f"Confirmed upon request.{extra_price}"
        )
        details = rec.get("details") or {}
        en_det = details.get("en") or {}
        tr_det = details.get("tr") or {}
        summary = en_det.get("summary") or tr_det.get("summary") or ""
        if len(summary) > 180:
            summary = summary[:177].rsplit(" ", 1)[0] + "…"
        duration = en_det.get("duration") or tr_det.get("duration") or ""
        fav_prefix = "Mimo'nun favorisi 💙: " if is_fav else ""
        text = (
            f"{fav_prefix}{title_en}. Operator: {rec.get('operator', '')}. {duration}. "
            f"{price_str} {summary} Booking: https://bosphorly.com/booking.html?service={rid}"
        ).strip()

        all_titles = [
            str(rec[k]) for k in sorted(rec) if k.startswith("title_") and rec.get(k)
        ]
        kw_parts = list(all_titles)
        if price is not None:
            kw_parts.append(PRICE_KEYWORDS_23)
        if rid in CRUISE_FLAGSHIP_IDS:
            kw_parts.append(CRUISE_KEYWORDS_23)
        if rid.startswith("alaturka") or "hammam" in title_en.lower():
            kw_parts.append(HAMMAM_KEYWORDS_23)
        if rid == "azure-transfer":
            kw_parts.append("airport transfer")
        chunk_obj = {
            "id": chunk_id,
            "title": f"{title_en} / {title_tr}" if title_tr else title_en,
            "url": f"https://bosphorly.com/booking.html?service={rid}",
            "category": cat,
            "text": text,
            "keywords": " | ".join(dict.fromkeys(kw_parts)),
        }
        if is_fav:
            chunk_obj["favorite"] = True
        chunks.append(chunk_obj)

    # 5. Discover places, 2-day route stops, themed/private tours & city guide
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
        meta_str = " ".join(meta_parts)
        chunks.append({
            "id": f"place-{pid}",
            "title": f"{name_en} / {name_tr}" if name_tr else name_en,
            "url": "https://bosphorly.com/explore.html",
            "text": f"{name_en}: {desc_en} | {name_tr}: {desc_tr} {meta_str}".strip(" |"),
            "keywords": " | ".join(aliases),
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
        chunks.append({
            "id": f"route-{sid}",
            "title": f"{name_en} / {name_tr}" if name_tr else name_en,
            "url": "https://bosphorly.com/route.html",
            "text": f"2-Day Istanbul Walking Route stop — {name_en}: {desc_en} | {name_tr}: {desc_tr}".strip(" |"),
            "keywords": " | ".join(stop_aliases),
        })

    for tid, (name_en, desc_en) in disc_en.get("tours", {}).items():
        chunk_id = f"discover-tour-{tid}"
        name_tr, desc_tr = disc_tr.get("tours", {}).get(tid, ["", ""])
        mt = master_tours.get(tid, {})
        t_cat = mt.get("cat") or ""
        is_fav = chunk_id in MIMO_FAVORITE_IDS
        t_meta = []
        if mt.get("from"):
            t_meta.append(f"Market reference from approx. {mt['from'][0]} {mt['from'][1]} (confirmed upon request)")
        if mt.get("route"):
            t_meta.append(f"Route: {' -> '.join(mt['route'])}")
        if mt.get("inc"):
            t_meta.append(f"Included: {', '.join(mt['inc'])}")
        if mt.get("exc"):
            t_meta.append(f"Excluded: {', '.join(mt['exc'])}")
        t_aliases = []
        for lc, dpack in all_disc.items():
            if lc in ("en", "tr"):
                continue
            loc_t = dpack.get("tours", {}).get(tid)
            if loc_t and loc_t[0] and loc_t[0] not in t_aliases:
                t_aliases.append(loc_t[0])
        fav_prefix = "Mimo'nun favorisi 💙: " if is_fav else ""
        t_chunk = {
            "id": chunk_id,
            "title": f"{name_en} / {name_tr}" if name_tr else name_en,
            "url": "https://bosphorly.com/tours.html",
            "text": f"{fav_prefix}{name_en}: {desc_en} | {name_tr}: {desc_tr} {' '.join(t_meta)}".strip(" |"),
            "keywords": " | ".join(t_aliases),
        }
        if t_cat:
            t_chunk["category"] = t_cat
        if is_fav:
            t_chunk["favorite"] = True
        chunks.append(t_chunk)

    en_ui = disc_en.get("ui", {})
    tr_ui = disc_tr.get("ui", {})
    chunks.append({
        "id": "city-guide-getting-around",
        "title": "Getting around Istanbul & Route tips / Şehirde ulaşım",
        "url": "https://bosphorly.com/explore.html",
        "text": (
            f"{en_ui.get('gaIst', '')} {en_ui.get('gaSaw', '')} "
            f"{en_ui.get('gaTram', '')} {en_ui.get('gaFerry', '')} "
            f"{tr_ui.get('gaIst', '')} {tr_ui.get('gaTram', '')} "
            "Verify lines and schedules on official operator sites."
        ).strip(),
        "keywords": "M11 M2 M4 T1 tram metro ferry İstanbulkart vapur ulaşım transit route",
    })

    return chunks


def text() -> str:
    return json.dumps(build_chunks(), ensure_ascii=False, separators=(",", ":")) + "\n"


if __name__ == "__main__":
    OUT.write_text(text(), encoding="utf-8")
    print(f"Wrote {len(build_chunks())} knowledge chunks to {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
