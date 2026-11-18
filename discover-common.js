'use strict';
/* Shared helpers for the Discover, Route and Search pages.
   Texts live in data/discover/<lang>.json (falls back to English); places, stops and prices in data/discover/places.json. */
(() => {
  const lang = window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const rtl = window.BosphorlyLang ? window.BosphorlyLang.rtl(lang) : false;
  document.documentElement.lang = lang;
  if (rtl) document.documentElement.dir = 'rtl';
  const locale = lang === 'ar' ? 'ar-u-nu-latn' : lang;

  const getJSON = url => fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); });
  async function load(base = '') {
    const [data, en, own] = await Promise.all([
      getJSON(base + 'data/discover/places.json'),
      getJSON(base + 'data/discover/en.json'),
      lang === 'en' ? null : getJSON(base + 'data/discover/' + lang + '.json').catch(() => null)
    ]);
    const pick = (sect, id) => (own && own[sect] && own[sect][id]) || en[sect][id];
    const ui = Object.assign({}, en.ui, own ? own.ui : {});
    data.places.forEach(p => { [p.name, p.desc] = pick('places', p.id); p.nameEn = en.places[p.id][0]; });
    data.stops.forEach(s => { [s.name, s.note] = pick('stops', s.id); s.nameEn = en.stops[s.id][0]; });
    (data.tours || []).forEach(s => { [s.name, s.desc] = pick('tours', s.id); s.nameEn = en.tours[s.id][0]; });
    return { data, ui, t: (k, vars) => (ui[k] || k).replace(/\{(\w+)\}/g, (_, v) => (vars && vars[v] != null ? vars[v] : '')) };
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const money = (v, c) => (window.BosphorlyCurrency ? window.BosphorlyCurrency.format(v, c)
    : new Intl.NumberFormat(locale, { style: 'currency', currency: c, maximumFractionDigits: c === 'TRY' ? 0 : 2 }).format(v));
  function priceText(p, t) {
    if (p.price === 'free') return t('free');
    if (!p.price) return t('priceUnknown');
    const { min, max, cur } = p.price;
    return t('approx') + ' ' + money(min, cur) + (max ? ' – ' + money(max, cur) : '');
  }
  // Weekday names come from the browser, so no translation is needed (0 = Sunday).
  const dayName = d => new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(Date.UTC(2026, 10, 15 + d, 12)));
  const closedText = (p, t) => (p.closed && p.closed.length ? t('closedOn', { days: p.closed.map(dayName).join(', ') }) : '');
  const dateText = d => { try { return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00')); } catch { return d; } };

  const contact = window.BOSPHORLY_CONTACT || { whatsapp: '905333407776' };
  const waLink = msg => 'https://wa.me/' + contact.whatsapp + '?text=' + encodeURIComponent(msg);
  const mapsLink = (lat, lng) => 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
  const walkLink = pts => 'https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=' + pts[0].lat + ',' + pts[0].lng +
    '&destination=' + pts[pts.length - 1].lat + ',' + pts[pts.length - 1].lng +
    (pts.length > 2 ? '&waypoints=' + pts.slice(1, -1).map(p => p.lat + ',' + p.lng).join('|') : '');

  // Lower-case, without accents or dotted/dotless i differences, so "kapalicarsi" finds "Kapalıçarşı".
  const norm = s => String(s || '').toLocaleLowerCase('tr').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '');

  // Leaflet is only fetched on pages that show a map, and only when needed.
  let leafletPromise = null;
  function leaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      css.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='; css.crossOrigin = '';
      const js = document.createElement('script');
      js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='; js.crossOrigin = '';
      js.onload = () => resolve(window.L); js.onerror = reject;
      document.head.append(css, js);
    });
    return leafletPromise;
  }
  function baseMap(L, node) {
    const map = L.map(node, { scrollWheelZoom: false, tap: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
    return map;
  }

  window.BosphorlyDiscover = Object.freeze({ lang, rtl, locale, load, el, money, priceText, closedText, dateText, waLink, mapsLink, walkLink, norm, leaflet, baseMap });
})();
