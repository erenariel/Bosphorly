"""Render the public, language-specific Mimo entry points from the site's copy."""
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://bosphorly.com/mimo/"


def build():
    copy = json.loads((ROOT / "data/mimo-search.json").read_text())
    faq = json.loads((ROOT / "data/faq.json").read_text())
    if set(copy) != set(faq):
        raise ValueError("Mimo and FAQ languages differ")
    bot = re.search(r"telegramBot: '(\w+)'", (ROOT / "config/api.js").read_text())[1]
    phone = re.search(r"const WHATSAPP_NUMBER = '(\d+)'", (ROOT / "social-links.js").read_text())[1]
    alternates = "\n".join(f'<link rel="alternate" hreflang="{code}" href="{BASE}{code}.html">' for code in copy)
    languages = " · ".join(f'<a lang="{code}" hreflang="{code}" href="{code}.html">{escape(item["language"])}</a>' for code, item in copy.items())
    folder = ROOT / "mimo"
    folder.mkdir(exist_ok=True)
    for code, item in copy.items():
        title, desc, example, chat = (escape(item[k]) for k in ("title", "description", "example", "chat"))
        question, answer = map(escape, faq[code]["qa"][1])
        direction = "rtl" if code in {"ar", "fa", "he"} else "ltr"
        guide_links = {"en":["../en/airport-transfer.html","Airport arrival guide"],"tr":["../tr/havalimani-transferi.html","Havalimanı varış rehberi"],"he":["../he/airport-transfer.html","מדריך הסעות לסולטנאחמט"],"de":["../de/flughafentransfer-istanbul.html","Flughafentransfer Istanbul: Preise und Abholung"],"fr":["../fr/transfert-aeroport-istanbul.html","Transfert aéroport Istanbul : tarifs et prise en charge"]}
        guide = guide_links.get(code)
        guide_link = f'<a href="{escape(guide[0])}">{escape(guide[1])}</a> · ' if guide else ""
        extra = {"en":"<section><h2>What can Mimo help me plan?</h2><p>Mimo can help compare arrival options, plan a first visit, and identify questions to ask a tour provider. For current schedules, availability and booking terms, check the operator's confirmation. AI answers can be mistaken.</p><p><a href=\"../en/istanbul-guide.html\">Three-day Istanbul itinerary</a> · <a href=\"../en/bosphorus-cruises.html\">Compare Bosphorus cruises</a></p></section>","tr":"<section><h2>Mimo hangi konularda yardımcı olur?</h2><p>Mimo ulaşım seçeneklerini karşılaştırmana, ilk İstanbul gezini planlamana ve tur sağlayıcısına soracağın soruları belirlemene yardımcı olabilir. Güncel saatleri, müsaitliği ve rezervasyon koşullarını sağlayıcıdan doğrula. Yapay zekâ cevapları hatalı olabilir.</p><p><a href=\"../tr/istanbul-rehberi.html\">Üç günlük İstanbul planı</a> · <a href=\"../tr/bogaz-turlari.html\">Boğaz turlarını karşılaştır</a></p></section>"}.get(code, "")
        page = f"""<!doctype html>
<html lang="{code}" dir="{direction}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} | Bosphorly</title>
<link rel="canonical" href="{BASE}{code}.html">
<meta name="description" content="{desc}">
{alternates}
<link rel="alternate" hreflang="x-default" href="{BASE}en.html">
<link rel="stylesheet" href="../guide.css">
<link rel="stylesheet" href="../assistant-chat.css">
<link rel="icon" href="../assets/brand/approved-icon.webp">
<script src="../config/api.js" defer></script>
<script src="chat.js" defer></script>
<script src="../assistant-chat.js" defer></script>
</head>
<body>
<header><a class="brand" href="../?lang={code}">Bosphorly</a><span lang="{code}">{escape(item['language'])}</span></header>
<main>
<h1>{title}</h1>
<p class="lede">{desc}</p>
<blockquote>{example}</blockquote>
<p><a id="web-chat" href="../?lang={code}#heroMimoAsk">{chat}</a> · <a href="https://t.me/{bot}?start={code}">Telegram</a> · <a href="https://wa.me/{phone}">WhatsApp</a></p>
<h2>{question}</h2><p>{answer}</p>
<p>{guide_link}<a href="../?lang={code}#booking">{escape(faq[code]['links']['transfer'])}</a> · <a href="../faq.html?lang={code}">{escape(faq[code]['nav'])}</a></p>
{extra}</main>
<footer><nav>{languages}</nav></footer>
</body></html>
"""
        (folder / f"{code}.html").write_text(page)


if __name__ == "__main__":
    build()
