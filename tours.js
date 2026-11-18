'use strict';
/* Tours on request: themed and faith tours, neighbourhoods, panoramic bus, private guide and car, multi-day Türkiye.
   No company has agreed a price for these yet, so every card asks on WhatsApp instead of showing a price. */
(async () => {
  const D = window.BosphorlyDiscover, $ = id => document.getElementById(id), el = D.el;
  let pack;
  try { pack = await D.load(); } catch { $('grid').append(el('div', 'empty', 'Could not load the list. Please reload.')); return; }
  const { data, t } = pack;
  const tours = data.tours || [];
  for (const k of ['toEyebrow', 'toTitle', 'toLead', 'toSeeAlso', 'toHowTitle', 'toHow1', 'toHow2', 'toHow3', 'toNote']) $(k).textContent = t(k);
  document.title = t('toTitle') + ' | Bosphorly';

  const cats = ['all', 'themed', 'hoods', 'panoramic', 'private', 'multi'];
  const catLabel = c => t('toCat' + c[0].toUpperCase() + c.slice(1));
  let cat = cats.includes(new URLSearchParams(location.search).get('cat')) ? new URLSearchParams(location.search).get('cat') : 'all';
  for (const c of cats) {
    const b = el('button', 'chip', catLabel(c)); b.type = 'button'; b.dataset.cat = c;
    b.addEventListener('click', () => { cat = c; render(); });
    $('chips').append(b);
  }
  const num = n => new Intl.NumberFormat(D.locale).format(Number(n));
  const durText = ([kind, n]) => ({ h: () => t('toDurH', { n: num(n) }), d: () => t('toDurD', { n: num(n) }), half: () => t('toDurHalf'), full: () => t('toDurFull') }[kind] || (() => t('toDurFlex')))();

  const placeName = id => (data.places.find(p => p.id === id) || {}).name || id;
  const basis = s => s.b === 'group' && s.max ? t('toB_groupMax', { n: s.max }) : t('toB_' + s.b);
  const list = (title, keys, cls) => {
    const box = el('div', 'td-block ' + cls); box.append(el('h4', null, title));
    const ul = el('ul'); keys.forEach(k => ul.append(el('li', null, t('toI_' + k)))); box.append(ul); return box;
  };
  function details(s) {
    const d = el('details', 'td'); d.append(el('summary', null, t('toDetails')));
    const body = el('div', 'td-body');
    if (s.time) { const b = el('div', 'td-block'); b.append(el('h4', null, t('toTimes')), el('p', null, s.time)); body.append(b); }
    if (s.route && s.route.length) {
      const b = el('div', 'td-block'); b.append(el('h4', null, t('toRoute')));
      const ol = el('ol', 'td-route'); s.route.forEach(r => ol.append(el('li', null, r[0] === '@' ? placeName(r.slice(1)) : r))); b.append(ol); body.append(b);
    }
    const two = el('div', 'td-two');
    if (s.inc && s.inc.length) two.append(list(t('toInc'), s.inc, 'inc'));
    if (s.exc && s.exc.length) two.append(list(t('toExc'), s.exc, 'exc'));
    if (two.children.length) body.append(two);
    if (s.src && s.src.length) {
      const b = el('div', 'td-block'); b.append(el('h4', null, t('toMarket')));
      const ul = el('ul', 'td-market');
      for (const x of s.src) {
        const li = el('li');
        const a = el('a', null, x.op + ' ↗'); a.href = x.u; a.target = '_blank'; a.rel = 'noopener nofollow';
        const extra = [basis(x), x.h ? t('toHours', { n: new Intl.NumberFormat(D.locale).format(x.h) }) : null, x.note ? t('toN_' + x.note) : null].filter(Boolean).join(' · ');
        li.append(a, el('b', null, (x.from ? t('toFromWord') + ' ' : '') + D.money(x.p, x.c)), el('span', null, extra));
        ul.append(li);
      }
      b.append(ul, el('p', 'td-fine', t('toMarketNote', { date: D.dateText(data.toursChecked || data.checked) }))); body.append(b);
    }
    if (s.tip) body.append(el('p', 'td-tip', '💡 ' + t('toT_' + s.tip)));
    d.append(body);
    return d;
  }

  function card(s) {
    const c = el('article', 'place'); c.id = s.id;
    const top = el('div', 'top');
    top.append(el('h3', null, s.name), el('span', 'tag ' + s.cat, catLabel(s.cat)));
    const meta = el('div', 'meta');
    meta.append(el('span', null, '⏱ ' + durText(s.dur || ['flex'])));
    meta.append(s.from ? el('span', 'from-price', t('toFrom', { price: D.money(s.from[0], s.from[1]) })) : el('span', 'ask-price', '💬 ' + t('toPrice')));
    const act = el('div', 'actions');
    const wa = el('a', 'btn wa', t('toAsk')); wa.href = D.waLink(t('toAskMsg', { tour: s.name })); wa.target = '_blank'; wa.rel = 'noopener';
    act.append(wa);
    c.append(top, el('p', null, s.desc), meta, details(s), act);
    return c;
  }
  function render() {
    document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cat === cat)));
    const list = tours.filter(s => cat === 'all' || s.cat === cat);
    $('grid').replaceChildren(...list.map(card));
    $('count').textContent = list.length + ' · ' + catLabel(cat);
    $('toSeeAlso').hidden = !(cat === 'all' || cat === 'multi');
    const u = new URL(location.href);
    cat === 'all' ? u.searchParams.delete('cat') : u.searchParams.set('cat', cat);
    history.replaceState(null, '', u);
  }
  if (window.BosphorlyCurrency) window.BosphorlyCurrency.onChange(render);
  render();
  if (location.hash) { const target = document.getElementById(location.hash.slice(1)); if (target) target.scrollIntoView(); }
})();
