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
    const d = el('details', 'td');
    const sum = el('summary');
    sum.append(el('span', 'td-ico', '💶'), el('span', 'td-label', t('toDetails')));
    if (s.src && s.src.length) { const n = el('span', 'td-count', String(s.src.length)); n.setAttribute('aria-hidden', 'true'); sum.append(n); }
    const chev = el('span', 'td-chev', '▾'); chev.setAttribute('aria-hidden', 'true'); sum.append(chev);
    d.append(sum);
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
      // Market range only: no company names or links, so the guest books through Bosphorly.
      const b = el('div', 'td-block'); b.append(el('h4', null, t('toMarketRange')));
      const groups = new Map();
      for (const x of s.src) {
        const key = x.b + '|' + x.c + '|' + (x.max || '');
        if (!groups.has(key)) groups.set(key, { b: x.b, c: x.c, max: x.max, ps: [], notes: new Set() });
        const g = groups.get(key); g.ps.push(x.p); if (x.note) g.notes.add(x.note);
      }
      const ul = el('ul', 'td-market');
      for (const g of groups.values()) {
        const lo = Math.min(...g.ps), hi = Math.max(...g.ps);
        const li = el('li');
        li.append(el('b', null, D.money(lo, g.c) + (hi > lo ? ' – ' + D.money(hi, g.c) : '')),
          el('span', null, [basis(g), ...[...g.notes].map(n => t('toN_' + n))].join(' · ')));
        ul.append(li);
      }
      b.append(ul, el('p', 'td-fine', t('toMarketNote', { date: D.dateText(data.toursChecked || data.checked) }))); body.append(b);
    }
    if (s.tip) body.append(el('p', 'td-tip', '💡 ' + t('toT_' + s.tip)));
    d.append(body);
    return d;
  }

  const account = window.BosphorlyAccount;
  const refCode = () => { const a = new Uint8Array(4); crypto.getRandomValues(a); return 'BOS-' + [...a].map(b => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 6); };
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function field(label, input) { const l = el('label', 'tf-field'); l.append(el('span', null, label), input); return l; }
  function requestForm(s) {
    const box = el('form', 'tf'); box.hidden = true; box.noValidate = true;
    const saved = account ? account.profile() || {} : {};
    const inp = (type, name, attrs = {}) => { const i = el('input'); i.type = type; i.name = name; Object.assign(i, attrs); return i; };
    const date = inp('date', 'date', { min: today(), required: true });
    const guests = inp('number', 'guests', { min: 1, max: 30, value: 2, required: true, inputMode: 'numeric' });
    const hotel = inp('text', 'hotel', { value: saved.hotel || '', autocomplete: 'organization' });
    const name = inp('text', 'name', { value: saved.name || '', autocomplete: 'name', required: true });
    const phone = inp('tel', 'phone', { value: saved.phone || '', autocomplete: 'tel', required: true, placeholder: '+90 …' });
    const notes = el('textarea'); notes.name = 'notes'; notes.rows = 2;
    const ack = inp('checkbox', 'ack'); const ackL = el('label', 'tf-ack'); ackL.append(ack, el('span', null, t('toFAck')));
    const row = el('div', 'tf-row'); row.append(field(t('toFDate'), date), field(t('toFGuests'), guests));
    const err = el('p', 'tf-err'); err.hidden = true; err.setAttribute('role', 'alert');
    const done = el('div', 'tf-done'); done.hidden = true; done.setAttribute('role', 'status');
    const send = el('button', 'btn wa tf-send', t('toFSend')); send.type = 'submit';
    box.append(row, field(t('toFHotel'), hotel), field(t('toFName'), name), field(t('toFPhone'), phone), field(t('toFNotes'), notes), ackL, err, send, done);
    box.addEventListener('submit', e => {
      e.preventDefault();
      const ok = date.value && date.value >= today() && Number(guests.value) >= 1 && name.value.trim().length >= 2 && /^\+?[0-9 ()-]{8,}$/.test(phone.value.trim()) && ack.checked;
      err.hidden = ok; if (!ok) { err.textContent = t('toFErr'); return; }
      const ref = refCode();
      const range = s.from ? t('toFrom', { price: D.money(s.from[0], s.from[1]) }) : '';
      const lines = [t('toWaTitle') + ' · ' + ref, s.name + (range ? ' (' + range + ')' : ''),
        t('toFDate') + ': ' + date.value, t('toFGuests') + ': ' + guests.value,
        hotel.value.trim() ? t('toFHotel') + ': ' + hotel.value.trim() : null,
        t('toFName') + ': ' + name.value.trim(), t('toFPhone').replace(/ \(.*\)$/, '') + ': ' + phone.value.trim(),
        notes.value.trim() ? t('toFNotes').replace(/ \(.*\)$/, '') + ': ' + notes.value.trim() : null].filter(Boolean);
      const url = D.emailLink(lines.join('\n'), t('toWaTitle') + ' · ' + ref);
      if (account) {
        account.saveProfile(Object.assign({}, saved, { name: name.value.trim(), phone: phone.value.trim(), hotel: hotel.value.trim() }));
        account.addRequest({ ref, type: 'tour', title: s.name, operator: 'Bosphorly', date: date.value, guests: Number(guests.value), total: range || t('toPrice'), emailDraftUrl: url });
      }
      done.replaceChildren(el('p', null, '✅ ' + t('toFDone', { ref })));
      const again = el('a', 'btn', document.documentElement.lang === 'tr' ? 'E-posta taslağını aç' : 'Open email draft'); again.href = url; again.target = '_blank'; again.rel = 'noopener';
      const mine = el('a', 'btn', t('toMyReq')); mine.href = 'account.html';
      done.append(again, mine); done.hidden = false; send.hidden = true;

    });
    return box;
  }

  function card(s) {
    const c = el('article', 'place'); c.id = s.id;
    const top = el('div', 'top');
    top.append(el('h3', null, s.name), el('span', 'tag ' + s.cat, catLabel(s.cat)));
    const meta = el('div', 'meta');
    meta.append(el('span', null, '⏱ ' + durText(s.dur || ['flex'])));
    meta.append(s.from ? el('span', 'from-price', t('toFrom', { price: D.money(s.from[0], s.from[1]) })) : el('span', 'ask-price', '💬 ' + t('toPrice')));
    const act = el('div', 'actions');
    const form = requestForm(s);
    const req = el('button', 'btn primary', '📝 ' + t('toReq')); req.type = 'button'; req.setAttribute('aria-expanded', 'false');
    req.addEventListener('click', () => { form.hidden = !form.hidden; req.setAttribute('aria-expanded', String(!form.hidden)); if (!form.hidden) form.querySelector('input').focus(); });
    const wa = el('a', 'btn', '✉ ' + t('toAsk')); wa.href = D.emailLink(t('toAskMsg', { tour: s.name }), 'Bosphorly tour inquiry'); 
    act.append(req, wa);
    c.append(top, el('p', null, s.desc), meta, details(s), act, form);
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
