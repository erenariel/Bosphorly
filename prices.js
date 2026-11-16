'use strict';
/* Operator price and tour-content comparison. Local rendering only: no tracking, no checkout links. */
(() => {
  const $ = id => document.getElementById(id);
  const lang = window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const tr = lang === 'tr';
  document.documentElement.lang = lang;

  const D = {
    tr: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'Hamam paketleri', hbMassages: 'Masajlar', hbBook: 'Hamam veya masaj rezervasyonu yap →', hbHours: 'Her gün 09:30–23:00 · Fatih ve Beyoğlu şubeleri', 
    home: 'Ana sayfa', plan: 'Talep et', map: 'Harita', account: 'Hesabım', footer: 'Bosphorly · Yalnızca karşılaştırma · Talep gönderilmez, ödeme alınmaz.',
    eyebrow: 'TUR KARŞILAŞTIRMA · İSTANBUL', heading: 'İstanbul turlarını karşılaştır.',
    lead: 'Lisanslı firmaların kendi sitelerinde yayımladığı fiyatlar ve tur içerikleri. Neyin dahil olduğunu yan yana gör.',
    noticeTitle: 'Bilgiler firmaların kendi sitelerinden derlenmiştir; Bosphorly teklifi değildir.',
    noticeBody: 'Fiyat ve içerikler tarihe, yaşa ve pakete göre değişebilir. Kesin fiyatı ve müsaitliği firma, talebini kabul ederken teyit eder. Ödeme otel resepsiyonuna yalnızca nakit yapılır; tur firmaları kredi kartı ödemelerinde %10 ek komisyon alır.',
    query: 'Tur veya firma ara…', per: 'kişi başı', from: 'Başlangıç', was: 'önceki',
    request: 'Bosphorly’de talep et →', soon: 'Firma anlaşması bekleniyor', checked: 'Kontrol', none: 'Eşleşen tur bulunamadı.',
    notListed: 'Fiyat sor', records: 'tur', included: 'Dahil', excluded: 'Dahil değil', more: 'Tüm ayrıntılar',
    schedule: 'Saatler', meeting: 'Buluşma', guide: 'Rehber', pickup: 'Transfer', cancel: 'İptal', notes: 'Bilmen gerekenler',
    source: 'Kaynak: firmanın sitesi', noDetails: 'Firma sitesinde ayrıntılı içerik bulunamadı.', englishOnly: '',
    cats: { cruise: 'Boğaz turu', dinner: 'Akşam yemekli tur', city: 'Şehir turu', day: 'Günübirlik tur', islands: 'Adalar', hammam: 'Hamam', transfer: 'Transfer', multi: 'Çok günlü tur' },
    allCompanies: 'Tüm firmalar', allCurrencies: 'Tüm para birimleri', massageTitle: 'Masaj türleri ve fiyatlar', min: 'dk', loadFail: 'Fiyat verisi açılamadı.'
    },
    en: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'Hammam packages', hbMassages: 'Massages', hbBook: 'Book hammam or massage →', hbHours: 'Open daily 09:30–23:00 · Fatih and Beyoğlu branches', 
    home: 'Home', plan: 'Request', map: 'Map',
    eyebrow: 'TOUR COMPARISON · ISTANBUL', heading: 'Compare Istanbul tours.',
    lead: 'Prices and tour contents published by licensed companies on their own websites. See what is included, side by side.',
    noticeTitle: 'Summarised from each company’s own website; not a Bosphorly offer.',
    noticeBody: 'Prices and contents can change by date, age and package. The company confirms the final price and availability when it accepts your request. Payment is cash only at the hotel reception; tour companies charge an extra 10% on credit card payments.',
    query: 'Search tours or companies…', per: 'per person', from: 'From', was: 'was',
    request: 'Request on Bosphorly →', soon: 'Company agreement pending', checked: 'Checked', none: 'No matching tours.',
    notListed: 'Ask for price', records: 'tours', included: 'Included', excluded: 'Not included', more: 'All details',
    schedule: 'Times', meeting: 'Meeting point', guide: 'Guide', pickup: 'Transfer', cancel: 'Cancellation', notes: 'Good to know',
    source: 'Source: company website', noDetails: 'No detailed contents found on the company website.', englishOnly: '',
    cats: { cruise: 'Bosphorus cruise', dinner: 'Dinner cruise', city: 'City tour', day: 'Day trip', islands: 'Islands', hammam: 'Hammam', transfer: 'Transfer', multi: 'Multi-day tour' },
    account: 'My account', allCompanies: 'All companies', allCurrencies: 'All currencies', massageTitle: 'Massage types and prices', min: 'min', loadFail: 'Could not load the price catalog.'
    },
    ru: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'Пакеты хаммама', hbMassages: 'Массажи', hbBook: 'Забронировать хаммам или массаж →', hbHours: 'Ежедневно 09:30–23:00 · филиалы в Фатихе и Бейоглу', 
    home: 'Главная', plan: 'Заявка', map: 'Карта', account: 'Мой аккаунт', footer: 'Bosphorly · Только сравнение · Оплата здесь не принимается.',
    eyebrow: 'СРАВНЕНИЕ ТУРОВ · СТАМБУЛ', heading: 'Сравните туры по Стамбулу.',
    lead: 'Цены и программы, опубликованные лицензированными компаниями на их собственных сайтах. Сравните, что включено.',
    noticeTitle: 'Собрано с сайтов самих компаний; это не предложение Bosphorly.',
    noticeBody: 'Цены и программы зависят от даты, возраста и пакета. Окончательную цену и наличие мест компания подтверждает при принятии заявки. Оплата только наличными на ресепшене отеля; за оплату картой туркомпании берут дополнительно 10%.',
    query: 'Поиск тура или компании…', per: 'с человека', from: 'от', was: 'было',
    request: 'Заявка через Bosphorly →', soon: 'Ожидается договор с компанией', checked: 'Проверено', none: 'Подходящих туров нет.',
    notListed: 'Цена по запросу', records: 'туров', included: 'Включено', excluded: 'Не включено', more: 'Все подробности',
    schedule: 'Время', meeting: 'Место встречи', guide: 'Гид', pickup: 'Трансфер', cancel: 'Отмена', notes: 'Полезно знать',
    source: 'Источник: сайт компании', noDetails: 'Подробной программы на сайте компании нет.', englishOnly: '', allCompanies: 'Все компании', allCurrencies: 'Все валюты', massageTitle: 'Виды массажа и цены', min: 'мин', loadFail: 'Не удалось загрузить каталог.',
    cats: { cruise: 'Прогулка по Босфору', dinner: 'Ужин на теплоходе', city: 'Городской тур', day: 'Однодневный тур', islands: 'Острова', hammam: 'Хаммам', transfer: 'Трансфер', multi: 'Многодневный тур' }
    },
    ar: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'باقات الحمام', hbMassages: 'التدليك', hbBook: 'احجز الحمام أو التدليك ←', hbHours: 'يوميًا 09:30–23:00 · فرعا الفاتح وبيوغلو', 
    home: 'الرئيسية', plan: 'طلب', map: 'الخريطة', account: 'حسابي', footer: 'Bosphorly · للمقارنة فقط · لا يتم الدفع هنا.',
    eyebrow: 'مقارنة الجولات · إسطنبول', heading: 'قارن جولات إسطنبول.',
    lead: 'أسعار وبرامج نشرتها شركات مرخّصة على مواقعها. قارن ما هو مشمول جنبًا إلى جنب.',
    noticeTitle: 'مُلخّص من مواقع الشركات نفسها؛ ليس عرضًا من Bosphorly.',
    noticeBody: 'قد تتغير الأسعار والبرامج حسب التاريخ والعمر والباقة. تؤكد الشركة السعر النهائي والتوفر عند قبول طلبك. الدفع نقدًا فقط في استقبال الفندق؛ تضيف شركات الجولات 10% على الدفع بالبطاقة.',
    query: 'ابحث عن جولة أو شركة…', per: 'للشخص', from: 'ابتداءً من', was: 'كان',
    request: 'اطلب عبر Bosphorly ←', soon: 'بانتظار اتفاق مع الشركة', checked: 'تم التحقق', none: 'لا توجد جولات مطابقة.',
    notListed: 'السعر عند الطلب', records: 'جولة', included: 'مشمول', excluded: 'غير مشمول', more: 'كل التفاصيل',
    schedule: 'الأوقات', meeting: 'نقطة اللقاء', guide: 'المرشد', pickup: 'النقل', cancel: 'الإلغاء', notes: 'معلومات مفيدة',
    source: 'المصدر: موقع الشركة', noDetails: 'لا توجد تفاصيل على موقع الشركة.', englishOnly: '', allCompanies: 'كل الشركات', allCurrencies: 'كل العملات', massageTitle: 'أنواع التدليك والأسعار', min: 'دقيقة', loadFail: 'تعذّر تحميل الكتالوج.',
    cats: { cruise: 'جولة في البوسفور', dinner: 'عشاء على قارب', city: 'جولة في المدينة', day: 'رحلة يوم واحد', islands: 'الجزر', hammam: 'حمام', transfer: 'نقل', multi: 'جولة عدة أيام' }
    },
    de: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'Hamam-Pakete', hbMassages: 'Massagen', hbBook: 'Hamam oder Massage buchen →', hbHours: 'Täglich 09:30–23:00 · Filialen Fatih und Beyoğlu',
    home: 'Startseite', plan: 'Anfrage', map: 'Karte', account: 'Mein Konto', footer: 'Bosphorly · Nur Vergleich · Hier wird keine Zahlung angenommen.',
    eyebrow: 'TOURENVERGLEICH · ISTANBUL', heading: 'Istanbul-Touren vergleichen.',
    lead: 'Preise und Programme, die lizenzierte Anbieter auf ihren eigenen Websites veröffentlichen. Vergleichen Sie die Leistungen nebeneinander.',
    noticeTitle: 'Zusammengefasst von den Websites der Anbieter; kein Angebot von Bosphorly.',
    noticeBody: 'Preise und Programme können je nach Datum, Alter und Paket variieren. Endpreis und Verfügbarkeit bestätigt der Anbieter bei Annahme Ihrer Anfrage. Zahlung nur bar an der Hotelrezeption; Touranbieter berechnen bei Kartenzahlung 10 % Aufschlag.',
    query: 'Tour oder Anbieter suchen…', per: 'pro Person', from: 'Ab', was: 'vorher',
    request: 'Über Bosphorly anfragen →', soon: 'Vereinbarung mit Anbieter ausstehend', checked: 'Geprüft', none: 'Keine passenden Touren.',
    notListed: 'Preis auf Anfrage', records: 'Touren', included: 'Inklusive', excluded: 'Nicht inklusive', more: 'Alle Details',
    schedule: 'Zeiten', meeting: 'Treffpunkt', guide: 'Guide', pickup: 'Transfer', cancel: 'Stornierung', notes: 'Gut zu wissen',
    source: 'Quelle: Website des Anbieters', noDetails: 'Keine detaillierten Inhalte auf der Website des Anbieters.', englishOnly: '',
    allCompanies: 'Alle Anbieter', allCurrencies: 'Alle Währungen', massageTitle: 'Massagearten und Preise', min: 'Min.', loadFail: 'Katalog konnte nicht geladen werden.',
    cats: { cruise: 'Bosporus-Fahrt', dinner: 'Dinner-Fahrt', city: 'Stadttour', day: 'Tagesausflug', islands: 'Inseln', hammam: 'Hamam', transfer: 'Transfer', multi: 'Mehrtagestour' }
    }
  };
  const T = D[lang] || D.en;
  if (D[lang] && window.BosphorlyLang.rtl(lang)) document.documentElement.dir = 'rtl';
  const ICON = { cruise: '⛴️', dinner: '🍽️', city: '🕌', day: '🏞️', islands: '🏝️', hammam: '♨️', transfer: '🚐', multi: '🧭' };

  for (const [id, text] of Object.entries(T)) if (typeof text === 'string' && $(id)) $(id).textContent = text;
  $('operator').options[0].textContent = T.allCompanies; $('currency').options[0].textContent = T.allCurrencies;
  const Q = $('query');
  Q.placeholder = T.query;

  let rows = [];

  function category(r) {
    const t = (r.title + ' ' + r.id).toLowerCase();
    if (/hammam|hamam|massage|masaj/.test(t)) return 'hammam';
    if (/transfer/.test(t)) return 'transfer';
    if (/cappadocia|pamukkale/.test(t)) return 'multi';
    if (/dinner|new year|à la carte|turkish night/.test(t)) return 'dinner';
    if (/island/.test(t)) return 'islands';
    if (/bursa|sapanca|yalova|şile|sile/.test(t)) return 'day';
    if (/cruise|bosphorus/.test(t) && !/old city|city tour|asia|europe|continent/.test(t)) return 'cruise';
    return 'city';
  }

  const fmt = (value, currency) => window.BosphorlyCurrency ? window.BosphorlyCurrency.format(value, currency)
    : new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-latn' : lang, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function list(items, cls, max) {
    const ul = el('ul', cls);
    for (const item of items.slice(0, max ?? items.length)) ul.append(el('li', null, item));
    return ul;
  }

  // Translations live under details.<lang>; any field without one falls back to the English summary.
  function localized(d) {
    const t = d[lang] || {};
    const pick = k => t[k] ?? d[k];
    return { duration: pick('duration'), pickup: pick('pickup'), guide: pick('guide'), highlights: pick('highlights'), included: pick('included'),
      not_included: pick('not_included'), cancellation: pick('cancellation'), notes: pick('notes'), schedule: pick('schedule'),
      meeting_point: pick('meeting_point'), translated: Boolean(t.highlights) };
  }

  function card(r) {
    const cat = category(r);
    const article = el('article', 'item cat-' + cat);
    const head = el('div', 'item-head');
    head.append(el('span', 'item-icon', ICON[cat]), el('span', 'item-cat', T.cats[cat]));
    const body = el('div', 'item-body');
    body.append(el('span', 'operator', r.operator), el('h2', null, r['title_' + lang] || r.title));

    const priceRow = el('div', 'price-row');
    if (Number.isFinite(r.price)) {
      const strong = el('strong', null, (r.basis || '').startsWith('from') ? T.from + ' ' + fmt(r.price, r.currency) : fmt(r.price, r.currency));
      priceRow.append(strong);
      if (Number.isFinite(r.original_price)) priceRow.append(el('s', 'was', fmt(r.original_price, r.currency)));
      if ((r.basis || '').includes('per_person')) priceRow.append(el('span', 'per', T.per));
    } else priceRow.append(el('strong', null, T.notListed));
    body.append(priceRow);

    const d = r.details;
    if (d) {
      const L = localized(d);
      const chips = el('div', 'chips');
      if (L.duration) chips.append(el('span', 'chip', '⏱ ' + L.duration));
      if (L.pickup) chips.append(el('span', 'chip', '🚐 ' + L.pickup));
      if (L.guide) chips.append(el('span', 'chip', '🗣 ' + L.guide));
      if (chips.children.length) body.append(chips);
      if (L.highlights?.length) body.append(list(L.highlights, 'highlights', 3));
      if (L.included?.length) {
        body.append(el('p', 'list-title', T.included));
        body.append(list(L.included, 'ticks', 5));
      }
      const more = el('details', 'more');
      more.append(el('summary', null, T.more));
      const add = (label, value) => { if (value) { const p = el('p', 'kv'); p.append(el('b', null, label + ': '), document.createTextNode(value)); more.append(p); } };
      add(T.schedule, L.schedule);
      add(T.meeting, L.meeting_point);
      add(T.cancel, L.cancellation);
      if (L.highlights?.length > 3) { more.append(list(L.highlights.slice(3), 'highlights')); }
      if (L.included?.length > 5) { more.append(el('p', 'list-title', T.included)); more.append(list(L.included.slice(5), 'ticks')); }
      if (r.options?.length) {
        more.append(el('p', 'list-title', T.massageTitle));
        more.append(list(r.options.map(o => (o['name_' + lang] || o.name) + ': ' + o.durations.map(x => x.min + ' ' + T.min + ' ' + fmt(x.price, r.currency)).join(' · ')), 'notes'));
      }
      if (L.not_included?.length) { more.append(el('p', 'list-title', T.excluded)); more.append(list(L.not_included, 'crosses')); }
      if (L.notes?.length) { more.append(el('p', 'list-title', T.notes)); more.append(list(L.notes, 'notes')); }
      const src = el('p', 'fine');
      const a = el('a', null, T.source);
      a.href = d.source_url; a.target = '_blank'; a.rel = 'noopener nofollow';
      src.append(a, document.createTextNode(' · ' + T.checked + ': ' + d.checked));
      more.append(src);
      body.append(more);
    } else body.append(el('p', 'fine', T.noDetails));

    const a = el('a', 'button', T.request);
    a.href = 'booking.html?service=' + encodeURIComponent(r.id) + '&lang=' + encodeURIComponent(lang);
    body.append(a);
    article.append(head, body);
    return article;
  }

  function hammamCard(items) {
    const article = el('article', 'item cat-hammam hb-card');
    const head = el('div', 'item-head'); head.append(el('span', 'item-icon', ICON.hammam), el('span', 'item-cat', T.cats.hammam));
    const body = el('div', 'item-body');
    body.append(el('span', 'operator', 'Alaturka Hamam'), el('h2', null, T.hbTitle));
    const min = Math.min(...items.flatMap(r => r.options ? r.options.flatMap(o => o.durations.map(d => d.price)) : [r.price]));
    const priceRow = el('div', 'price-row'); priceRow.append(el('strong', null, T.from + ' ' + fmt(min, 'EUR')), el('span', 'per', T.per)); body.append(priceRow);
    body.append(el('div', 'chips')); body.lastChild.append(el('span', 'chip', '🕘 ' + T.hbHours));
    const pk = items.filter(r => !r.options);
    body.append(el('p', 'list-title', T.hbPackages));
    body.append(list(pk.map(r => (r['title_' + lang] || r.title) + ' · 60 ' + T.min + ': ' + fmt(r.price, r.currency)), 'ticks'));
    const m = items.find(r => r.options);
    if (m) {
      const more = el('details', 'more'); more.append(el('summary', null, T.hbMassages + ' (' + m.options.length + ')'));
      const tiers = new Map();
      m.options.forEach(o => { const k = o.durations.map(x => x.min + ':' + x.price).join('|'); if (!tiers.has(k)) tiers.set(k, { durations: o.durations, names: [] }); tiers.get(k).names.push(o['name_' + lang] || o.name); });
      tiers.forEach(tier => {
        const box = el('div', 'hb-tier');
        const pr = el('div', 'hb-tier-prices'); tier.durations.forEach(x => pr.append(el('span', null, x.min + ' ' + T.min + ' · ' + fmt(x.price, m.currency))));
        const chips = el('div', 'hb-chips'); tier.names.forEach(n => chips.append(el('span', null, n)));
        box.append(pr, chips); more.append(box);
      });
      const d = pk[0]?.details; const L = d ? Object.assign({}, d, d[lang] || {}) : null;
      if (L?.notes?.length) { more.append(el('p', 'list-title', T.notes)); more.append(list(L.notes, 'notes')); }
      const src = el('p', 'fine'); const a = el('a', null, T.source); a.href = m.details?.source_url || m.source_url; a.target = '_blank'; a.rel = 'noopener nofollow';
      src.append(a, document.createTextNode(' · ' + T.checked + ': ' + (m.details?.checked || ''))); more.append(src);
      body.append(more);
    }
    const a = el('a', 'button', T.hbBook); a.href = 'booking.html?service=alaturka&lang=' + encodeURIComponent(lang); body.append(a);
    article.append(head, body);
    return article;
  }

  function show() {
    const q = Q.value.toLocaleLowerCase();
    const op = $('operator').value, cur = $('currency').value;
    const data = rows.filter(x => (op === 'all' || x.operator === op) && (cur === 'all' || x.currency === cur) &&
      (x.title + ' ' + (x['title_' + lang] || '') + ' ' + x.operator + ' ' + (x.details?.highlights || []).join(' ') + ' ' + (x.details?.[lang]?.highlights || []).join(' ')).toLocaleLowerCase().includes(q));
    const wrap = $('catalog');
    wrap.replaceChildren();
    $('summary').textContent = (data.filter(r => r.operator !== 'Alaturka Hamam').length + (data.some(r => r.operator === 'Alaturka Hamam') ? 1 : 0)) + ' ' + T.records;
    if (!data.length) { wrap.append(el('p', 'empty', T.none)); return; }
    // Records with researched contents first, then the rest.
    data.sort((a, b) => Number(Boolean(b.details?.included)) - Number(Boolean(a.details?.included)));
    // Alaturka Hamam is shown as one card with all packages and massages.
    let hammamDone = false;
    for (const r of data) {
      if (r.operator === 'Alaturka Hamam') { if (!hammamDone) { wrap.append(hammamCard(data.filter(x => x.operator === 'Alaturka Hamam'))); hammamDone = true; } continue; }
      wrap.append(card(r));
    }
  }

  if (window.BosphorlyCurrency) window.BosphorlyCurrency.onChange(() => { show(); $('fxNote').textContent = window.BosphorlyCurrency.note(); });
  $('operator').addEventListener('change', show);
  $('currency').addEventListener('change', show);
  Q.addEventListener('input', show);
  fetch('data/public-market-prices.json')
    .then(r => { if (!r.ok) throw Error('fetch'); return r.json(); })
    .then(d => {
      rows = d.records || [];
      for (const name of [...new Set(rows.map(r => r.operator))].sort()) {
        const o = el('option', null, name); o.value = name; $('operator').append(o);
      }
      show();
    })
    .catch(() => { $('summary').textContent = T.loadFail; });
})();
