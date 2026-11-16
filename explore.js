'use strict';
/* Discover Istanbul: searchable, filterable catalogue of places with a map. */
(async () => {
  const D = window.BosphorlyDiscover, $ = id => document.getElementById(id), el = D.el;
  let pack;
  try { pack = await D.load(); } catch { $('grid').append(el('div', 'empty', 'Could not load the list. Please reload.')); return; }
  const { data, t } = pack;
  for (const k of ['exEyebrow', 'exTitle', 'exLead', 'routeCardEyebrow', 'routeCardTitle', 'routeCardText', 'routeOpen']) $(k).textContent = t(k);
  $('q').placeholder = t('searchPh');
  document.title = t('exTitle') + ' | Bosphorly';

  const cats = ['all', 'history', 'museum', 'family', 'experience', 'walk'];
  const catLabel = c => t('cat' + c[0].toUpperCase() + c.slice(1));
  const params = new URLSearchParams(location.search);
  let cat = cats.includes(params.get('cat')) ? params.get('cat') : 'all';
  let query = params.get('q') || '';
  $('q').value = query;

  for (const c of cats) {
    const b = el('button', 'chip', catLabel(c)); b.type = 'button'; b.dataset.cat = c;
    b.addEventListener('click', () => { cat = c; render(); });
    $('chips').append(b);
  }

  const hay = p => D.norm([p.name, p.nameEn, p.desc, p.district, ...(p.aliases || [])].join(' '));
  let markers = new Map(), map = null, L = null;

  function card(p) {
    const c = el('article', 'place'); c.id = p.id;
    const top = el('div', 'top');
    top.append(el('h3', null, p.name), el('span', 'tag ' + p.cat, catLabel(p.cat)));
    c.append(top, el('div', 'district', p.district), el('p', null, p.desc));
    const facts = el('div', 'facts');
    facts.append(el('span', 'price' + (p.price === 'free' ? ' free' : ''), D.priceText(p, t)));
    const closed = D.closedText(p, t); if (closed) facts.append(el('span', 'closed', closed));
    c.append(facts);
    const act = el('div', 'actions');
    const dir = el('a', 'btn', '📍 ' + t('directions')); dir.href = D.mapsLink(p.lat, p.lng); dir.target = '_blank'; dir.rel = 'noopener';
    act.append(dir);
    if (p.official) { const o = el('a', 'btn', t('official') + ' ↗'); o.href = p.official; o.target = '_blank'; o.rel = 'noopener'; act.append(o); }
    const wa = el('a', 'btn wa', t('ask')); wa.href = D.waLink(t('askMsg', { place: p.name })); wa.target = '_blank'; wa.rel = 'noopener';
    act.append(wa);
    c.append(act);
    if (p.source) { const s = el('a', null, t('priceSource') + ' ↗'); s.href = p.source; s.target = '_blank'; s.rel = 'noopener nofollow'; s.style.fontSize = '12px'; c.append(s); }
    return c;
  }

  function render() {
    document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
    const q = D.norm(query.trim());
    const list = data.places.filter(p => (cat === 'all' || p.cat === cat) && (!q || q.split(/\s+/).every(w => hay(p).includes(w))));
    $('grid').replaceChildren(...(list.length ? list.map(card) : [el('div', 'empty', t('noResults'))]));
    $('count').textContent = list.length + ' ' + t('results');
    const u = new URL(location.href);
    cat === 'all' ? u.searchParams.delete('cat') : u.searchParams.set('cat', cat);
    query ? u.searchParams.set('q', query) : u.searchParams.delete('q');
    history.replaceState(null, '', u);
    if (map) {
      markers.forEach((m, id) => { const show = list.some(p => p.id === id); show ? m.addTo(map) : m.remove(); });
      if (list.length) map.fitBounds(L.latLngBounds(list.map(p => [p.lat, p.lng])), { padding: [24, 24], maxZoom: 15 });
    }
  }

  $('q').addEventListener('input', e => { query = e.target.value; render(); });
  $('searchForm').addEventListener('submit', e => e.preventDefault());
  if (window.BosphorlyCurrency) window.BosphorlyCurrency.onChange(render);
  $('priceNote').textContent = t('priceNote', { date: D.dateText(data.checked) });
  render();

  // The map loads after the list so the page is usable at once, even offline.
  const mapNode = $('map');
  const start = () => D.leaflet().then(Lf => {
    L = Lf; $('mapFallback').remove();
    map = D.baseMap(L, mapNode);
    for (const p of data.places) {
      const m = L.marker([p.lat, p.lng], { title: p.name, alt: p.name });
      m.bindPopup(() => { const a = el('a', null, p.name); a.href = '#' + p.id; a.style.fontWeight = '700'; return a; });
      markers.set(p.id, m);
    }
    render();
  }).catch(() => { $('mapFallback').textContent = '🗺️'; });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: '200px' });
    io.observe(mapNode);
  } else start();
})();
