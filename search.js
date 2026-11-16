'use strict';
/* One search over tours, places to visit, walking routes and guides. Matches every language and common old names
   (e.g. "Vialand" finds Isfanbul, "kapalicarsi" finds the Grand Bazaar). */
(async () => {
  const D = window.BosphorlyDiscover, $ = id => document.getElementById(id), el = D.el, lang = D.lang;
  let pack, tours = [];
  try {
    [pack, tours] = await Promise.all([D.load(), fetch('data/public-market-prices.json', { cache: 'no-cache' }).then(r => r.json()).then(j => j.records || []).catch(() => [])]);
  } catch { $('results').append(el('div', 'empty', 'Could not load the search index. Please reload.')); return; }
  const { data, t } = pack;
  for (const k of ['srTitle', 'srLead']) $(k).textContent = t(k);
  $('q').placeholder = t('searchPh');
  document.title = t('srTitle') + ' | Bosphorly';

  const all = obj => Object.keys(obj).filter(k => k === 'title' || k.startsWith('title_')).map(k => obj[k]);
  const index = [];
  for (const r of tours) {
    const d = r.details || {};
    index.push({ group: 'srTours', title: r['title_' + lang] || r.title, sub: r.operator, href: 'booking.html?service=' + encodeURIComponent(r.id) + '&lang=' + lang,
      text: [...all(r), r.operator, ...(d.highlights || []), ...((d[lang] || {}).highlights || [])].join(' ') });
  }
  for (const p of data.places) index.push({ group: 'srPlaces', title: p.name, sub: p.district, href: 'explore.html#' + p.id, text: [p.name, p.nameEn, p.desc, p.district, ...(p.aliases || [])].join(' ') });
  index.push({ group: 'srRoutes', title: t('rtTitle'), sub: data.stops.map(s => s.name).join(' · '), href: 'route.html',
    text: ['İlber Ortaylı Ilber Ortayli rota route walking yürüyüş', t('rtTitle'), t('routeCardText'), ...data.stops.flatMap(s => [s.name, s.nameEn, s.note])].join(' ') });
  for (const g of data.guides) index.push({ group: 'srGuides', title: g.title, sub: g.lang.toUpperCase(), href: g.href, text: g.title + ' ' + g.keywords });
  index.forEach(x => { x.n = D.norm(x.text + ' ' + x.title); });

  function run(q) {
    const words = D.norm(q).trim().split(/\s+/).filter(Boolean);
    const box = $('results'); box.replaceChildren();
    if (!words.length) { $('count').textContent = ''; return; }
    const hits = index.filter(x => words.every(w => x.n.includes(w)));
    $('count').textContent = hits.length + ' ' + t('results');
    if (!hits.length) { box.append(el('div', 'empty', t('noResults'))); return; }
    for (const g of ['srPlaces', 'srTours', 'srRoutes', 'srGuides']) {
      const items = hits.filter(h => h.group === g);
      if (!items.length) continue;
      const sec = el('section', 'sr-group'); sec.append(el('h2', null, t(g) + ' · ' + items.length));
      for (const h of items.slice(0, 30)) { const a = el('a', 'sr-item'); a.href = h.href; a.append(el('strong', null, h.title), el('small', null, h.sub || '')); sec.append(a); }
      box.append(sec);
    }
  }
  const q0 = new URLSearchParams(location.search).get('q') || '';
  $('q').value = q0; run(q0);
  $('q').addEventListener('input', e => {
    run(e.target.value);
    const u = new URL(location.href); e.target.value ? u.searchParams.set('q', e.target.value) : u.searchParams.delete('q'); history.replaceState(null, '', u);
  });
  $('searchForm').addEventListener('submit', e => e.preventDefault());
})();
