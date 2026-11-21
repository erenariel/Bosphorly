'use strict';
/* Prof. İlber Ortaylı's Istanbul walking route: numbered stops, two days, map. */
(async () => {
  const D = window.BosphorlyDiscover, $ = id => document.getElementById(id), el = D.el;
  let pack;
  try { pack = await D.load(); } catch { $('days').append(el('div', 'empty', 'Could not load the route. Please reload.')); return; }
  const { data, t } = pack;
  for (const k of ['rtEyebrow', 'rtTitle', 'rtLead', 'rtQuote', 'rtQuoteBy', 'rtTipsTitle', 'rtSources', 'rtDisclaimer', 'rtMapNote']) $(k).textContent = t(k);
  document.title = t('rtTitle') + ' | Bosphorly';
  const stops = data.stops;
  $('facts').append(el('span', null, stops.length + ' ' + t('rtFactStops')), el('span', null, t('rtFactKm')), el('span', null, t('rtFactDays')));
  for (const k of ['rtTip1', 'rtTip2', 'rtTip3']) $('tips').append(el('li', null, t(k)));
  const GUIDE_SUB = {
    en: 'Bosphorly guide inquiry', tr: 'Bosphorly rehber talebi', ru: 'Запрос гида · Bosphorly', uk: 'Запит гіда · Bosphorly',
    de: 'Bosphorly Reiseführer-Anfrage', fr: 'Demande de guide · Bosphorly', nl: 'Vraag over gids · Bosphorly', ar: 'طلب مرشد سياحي · Bosphorly',
    he: 'שאלה על מדריך · Bosphorly', az: 'Bosphorly bələdçi sorğusu', fa: 'درخواست راهنما · Bosphorly', es: 'Consulta de guía · Bosphorly',
    it: 'Richiesta guida · Bosphorly', pt: 'Pedido de guia · Bosphorly', hr: 'Upit za vodiča · Bosphorly', hu: 'Bosphorly idegenvezető kérdés',
    bs: 'Upit za vodiča · Bosphorly', zh: 'Bosphorly 导游咨询', ja: 'Bosphorly ガイドのお問い合わせ', ko: 'Bosphorly 가이드 문의',
    hi: 'Bosphorly गाइड पूछताछ', bn: 'Bosphorly গাইড জিজ্ঞাসা', id: 'Pertanyaan pemandu · Bosphorly'
  };
  const M = window.BosphorlyMember;
  const mp = M && M.signedIn() ? M.cachedProfile() : null;
  const rtLines = [
    t('rtAskMsg'),
    mp && (mp.name || mp.email) ? [mp.name, mp.email, mp.tier ? mp.tier.toUpperCase() : null].filter(Boolean).join(' · ') : null,
    'Language: ' + D.lang.toUpperCase()
  ].filter(Boolean);
  $('askGuide').textContent = t('rtAskGuide') + ' →';
  $('askGuide').href = D.emailLink(rtLines.join('\n'), GUIDE_SUB[D.lang] || GUIDE_SUB.en);

  for (const day of [1, 2]) {
    const box = el('section', 'rt-day');
    box.append(el('h2', null, t('rtDay' + day)));
    const ol = el('ol', 'stops');
    stops.forEach((s, i) => {
      if (s.day !== day) return;
      const li = el('li', 'stop'); li.id = 'stop-' + s.id;
      const body = el('div');
      const a = el('a', null, '📍 ' + t('directions')); a.href = D.mapsLink(s.lat, s.lng); a.target = '_blank'; a.rel = 'noopener';
      body.append(el('strong', null, s.name), el('p', null, s.note), a);
      li.append(el('span', 'num', String(i + 1)), body);
      ol.append(li);
    });
    // Each day starts where the previous one ended.
    const pts = stops.filter(s => s.day === day);
    if (day === 2) pts.unshift(stops.filter(s => s.day === 1).pop());
    const walk = el('a', 'btn primary', '🚶 ' + t('rtDirections')); walk.href = D.walkLink(pts); walk.target = '_blank'; walk.rel = 'noopener';
    walk.style.marginTop = '10px';
    box.append(ol, walk);
    $('days').append(box);
  }

  const node = $('map');
  const start = () => D.leaflet().then(L => {
    $('mapFallback').remove();
    const map = D.baseMap(L, node);
    const line = stops.map(s => [s.lat, s.lng]);
    L.polyline(line, { color: '#0a1753', weight: 4, opacity: .75, dashArray: '6 8' }).addTo(map);
    stops.forEach((s, i) => {
      const icon = L.divIcon({ className: 'pin' + (s.day === 2 ? ' d2' : ''), html: String(i + 1), iconSize: [28, 28] });
      L.marker([s.lat, s.lng], { icon, title: s.name, alt: (i + 1) + '. ' + s.name }).addTo(map)
        .bindPopup(() => { const a = el('a', null, (i + 1) + '. ' + s.name); a.href = '#stop-' + s.id; return a; });
    });
    map.fitBounds(L.latLngBounds(line), { padding: [26, 26] });
  }).catch(() => { $('mapFallback').textContent = '🗺️ ' + t('rtMapNote'); });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '200px' });
    io.observe(node);
  } else start();
})();
