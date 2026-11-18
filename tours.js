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

  function card(s) {
    const c = el('article', 'place'); c.id = s.id;
    const top = el('div', 'top');
    top.append(el('h3', null, s.name), el('span', 'tag ' + s.cat, catLabel(s.cat)));
    const meta = el('div', 'meta');
    meta.append(el('span', null, '⏱ ' + durText(s.dur || ['flex'])), el('span', 'ask-price', '💬 ' + t('toPrice')));
    const act = el('div', 'actions');
    const wa = el('a', 'btn wa', t('toAsk')); wa.href = D.waLink(t('toAskMsg', { tour: s.name })); wa.target = '_blank'; wa.rel = 'noopener';
    act.append(wa);
    c.append(top, el('p', null, s.desc), meta, act);
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
  render();
  if (location.hash) { const target = document.getElementById(location.hash.slice(1)); if (target) target.scrollIntoView(); }
})();
