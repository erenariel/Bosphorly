'use strict';
/* Operator price and tour-content comparison. Local rendering only: no tracking, no checkout links. */
(() => {
  const $ = id => document.getElementById(id);
  const pref = () => {
    let saved = '';
    try { saved = localStorage.getItem('bosphorly.language') || ''; } catch {}
    return saved || navigator.languages?.[0] || navigator.language || 'en';
  };
  const tr = pref().toLowerCase().startsWith('tr');
  document.documentElement.lang = tr ? 'tr' : 'en';

  const T = tr ? {
    home: 'Ana sayfa', plan: 'Talep et', map: 'Harita',
    eyebrow: 'TUR KARŞILAŞTIRMA · İSTANBUL', heading: 'İstanbul turlarını karşılaştır.',
    lead: 'Lisanslı firmaların kendi sitelerinde yayımladığı fiyatlar ve tur içerikleri. Neyin dahil olduğunu yan yana gör.',
    noticeTitle: 'Bilgiler firmaların kendi sitelerinden derlenmiştir; Bosphorly teklifi değildir.',
    noticeBody: 'Fiyat ve içerikler tarihe, yaşa ve pakete göre değişebilir. Bir firma Bosphorly ile anlaşma imzaladığında o firmanın turları buradan talep edilebilir olacak.',
    query: 'Tur veya firma ara…', per: 'kişi başı', from: 'Başlangıç', was: 'önceki',
    request: 'Bosphorly’de talep et →', soon: 'Firma anlaşması bekleniyor', checked: 'Kontrol', none: 'Eşleşen tur bulunamadı.',
    notListed: 'Fiyat sorunuz', records: 'tur', included: 'Dahil', excluded: 'Dahil değil', more: 'Tüm ayrıntılar',
    schedule: 'Saatler', meeting: 'Buluşma', guide: 'Rehber', pickup: 'Transfer', cancel: 'İptal', notes: 'Bilmen gerekenler',
    source: 'Kaynak: firmanın sitesi', noDetails: 'Firma sitesinde ayrıntılı içerik bulunamadı.', englishOnly: 'Ayrıntılar firmanın sitesindeki İngilizce metinden özetlendi.',
    cats: { cruise: 'Boğaz turu', dinner: 'Akşam yemekli tur', city: 'Şehir turu', day: 'Günübirlik tur', islands: 'Adalar', hammam: 'Hamam', transfer: 'Transfer', multi: 'Çok günlü tur' }
  } : {
    home: 'Home', plan: 'Request', map: 'Map',
    eyebrow: 'TOUR COMPARISON · ISTANBUL', heading: 'Compare Istanbul tours.',
    lead: 'Prices and tour contents published by licensed companies on their own websites. See what is included, side by side.',
    noticeTitle: 'Summarised from each company’s own website; not a Bosphorly offer.',
    noticeBody: 'Prices and contents can change by date, age and package. Once a company signs an agreement with Bosphorly, its tours become requestable here.',
    query: 'Search tours or companies…', per: 'per person', from: 'From', was: 'was',
    request: 'Request on Bosphorly →', soon: 'Company agreement pending', checked: 'Checked', none: 'No matching tours.',
    notListed: 'Ask for price', records: 'tours', included: 'Included', excluded: 'Not included', more: 'All details',
    schedule: 'Times', meeting: 'Meeting point', guide: 'Guide', pickup: 'Transfer', cancel: 'Cancellation', notes: 'Good to know',
    source: 'Source: company website', noDetails: 'No detailed contents found on the company website.', englishOnly: '',
    cats: { cruise: 'Bosphorus cruise', dinner: 'Dinner cruise', city: 'City tour', day: 'Day trip', islands: 'Islands', hammam: 'Hammam', transfer: 'Transfer', multi: 'Multi-day tour' }
  };
  const ICON = { cruise: '⛴️', dinner: '🍽️', city: '🕌', day: '🏞️', islands: '🏝️', hammam: '♨️', transfer: '🚐', multi: '🧭' };

  for (const [id, text] of Object.entries(T)) if (typeof text === 'string' && $(id)) $(id).textContent = text;
  const Q = $('query');
  Q.placeholder = T.query;

  const requestable = new Set(['bb-morning', 'bb-sunset', 'bb-oldcity', 'orient-dinner', 'sea-land', 'alaturka']);
  let rows = [];

  function category(r) {
    const t = (r.title + ' ' + r.id).toLowerCase();
    if (/hammam|hamam/.test(t)) return 'hammam';
    if (/transfer/.test(t)) return 'transfer';
    if (/cappadocia|pamukkale/.test(t)) return 'multi';
    if (/dinner|new year|à la carte|turkish night/.test(t)) return 'dinner';
    if (/island/.test(t)) return 'islands';
    if (/bursa|sapanca|yalova|şile|sile/.test(t)) return 'day';
    if (/cruise|bosphorus/.test(t) && !/old city|city tour|asia|europe|continent/.test(t)) return 'cruise';
    return 'city';
  }

  const fmt = (value, currency) => new Intl.NumberFormat(tr ? 'tr-TR' : 'en-GB', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

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

  // Turkish text exists for featured records; other records fall back to the operator's English summary.
  function localized(d) {
    const t = (tr && d.tr) || {};
    const pick = k => t[k] ?? d[k];
    return { duration: pick('duration'), pickup: pick('pickup'), guide: pick('guide'), highlights: pick('highlights'), included: pick('included'),
      not_included: pick('not_included'), cancellation: pick('cancellation'), notes: pick('notes'), translated: Boolean(t.highlights) };
  }

  function card(r) {
    const cat = category(r);
    const article = el('article', 'item cat-' + cat);
    const head = el('div', 'item-head');
    head.append(el('span', 'item-icon', ICON[cat]), el('span', 'item-cat', T.cats[cat]));
    const body = el('div', 'item-body');
    body.append(el('span', 'operator', r.operator), el('h2', null, r.title));

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
      add(T.schedule, d.schedule);
      add(T.meeting, d.meeting_point);
      add(T.cancel, L.cancellation);
      if (L.highlights?.length > 3) { more.append(list(L.highlights.slice(3), 'highlights')); }
      if (L.included?.length > 5) { more.append(el('p', 'list-title', T.included)); more.append(list(L.included.slice(5), 'ticks')); }
      if (L.not_included?.length) { more.append(el('p', 'list-title', T.excluded)); more.append(list(L.not_included, 'crosses')); }
      if (L.notes?.length) { more.append(el('p', 'list-title', T.notes)); more.append(list(L.notes, 'notes')); }
      if (tr && !L.translated && T.englishOnly) more.append(el('p', 'fine', T.englishOnly));
      const src = el('p', 'fine');
      const a = el('a', null, T.source);
      a.href = d.source_url; a.target = '_blank'; a.rel = 'noopener nofollow';
      src.append(a, document.createTextNode(' · ' + T.checked + ': ' + d.checked));
      more.append(src);
      body.append(more);
    } else body.append(el('p', 'fine', T.noDetails));

    if (requestable.has(r.id)) {
      const a = el('a', 'button', T.request);
      a.href = 'booking.html?service=' + encodeURIComponent(r.id) + (tr ? '&lang=tr' : '');
      body.append(a);
    } else body.append(el('div', 'unavailable', T.soon));
    article.append(head, body);
    return article;
  }

  function show() {
    const q = Q.value.toLocaleLowerCase();
    const op = $('operator').value, cur = $('currency').value;
    const data = rows.filter(x => (op === 'all' || x.operator === op) && (cur === 'all' || x.currency === cur) &&
      (x.title + ' ' + x.operator + ' ' + (x.details?.highlights || []).join(' ')).toLocaleLowerCase().includes(q));
    const wrap = $('catalog');
    wrap.replaceChildren();
    $('summary').textContent = data.length + ' ' + T.records;
    if (!data.length) { wrap.append(el('p', 'empty', T.none)); return; }
    // Records with researched contents first, then the rest.
    data.sort((a, b) => Number(Boolean(b.details?.included)) - Number(Boolean(a.details?.included)));
    for (const r of data) wrap.append(card(r));
  }

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
    .catch(() => { $('summary').textContent = tr ? 'Fiyat verisi açılamadı.' : 'Could not load the price catalog.'; });
})();
