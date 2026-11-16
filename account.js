'use strict';
/* My account: profile and request history from this device (account-store.js). */
(() => {
  const $ = id => document.getElementById(id);
  const lang = window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const tr = lang === 'tr';
  document.documentElement.lang = lang;
  const T = tr ? {
    navHome: 'Ana sayfa', navCompare: 'Tur karşılaştır', navAccount: 'Hesabım', eyebrow: 'BOSPHORLY HESABIM', heading: 'Hesabım',
    lead: 'Bilgilerin ve Bosphorly üzerinden gönderdiğin talepler.',
    deviceNote: 'Yalnızca bu cihazda saklanır. Bosphorly’yi başka bir telefon veya bilgisayarda açarsan bu talepler şimdilik görünmez.',
    reqTitle: 'Taleplerim', tabUpcoming: 'Yaklaşan', tabPast: 'Geçmiş', profileTitle: 'Bilgilerim', lName: 'Ad soyad', lPhone: 'Cep telefonu / WhatsApp',
    lEmail: 'E-posta (isteğe bağlı)', lHotel: 'Otel', lRoom: 'Oda numarası', saveBtn: 'Kaydet', clearBtn: 'Bu cihazdaki her şeyi sil',
    profileNote: 'Kayıtlı bilgilerin talep formlarına otomatik doldurulur.', footer: 'Bosphorly · Prototip · Bu sayfadaki hiçbir bilgi sunucuya gönderilmez.',
    msgSaved: 'Kaydedildi.', confirmClear: 'Bu cihazdaki profilin ve tüm talep geçmişin silinsin mi?', cleared: 'Silindi.',
    emptyUpcoming: 'Yaklaşan talebin yok.', emptyPast: 'Geçmiş talebin yok.', browse: 'Turları keşfet →',
    status: 'WhatsApp’a gönderildi · onay bekleniyor', reopen: 'WhatsApp’ta tekrar aç', remove: 'Listeden kaldır', guests: 'kişi', transfer: 'Havalimanı transferi'
  } : {
    navHome: 'Home', navCompare: 'Compare tours', navAccount: 'My account', eyebrow: 'MY BOSPHORLY', heading: 'My account',
    lead: 'Your details and the requests you sent through Bosphorly.',
    deviceNote: 'Saved on this device only. Opening Bosphorly on another phone or computer will not show these requests yet.',
    reqTitle: 'My requests', tabUpcoming: 'Upcoming', tabPast: 'Past', profileTitle: 'My details', lName: 'Full name', lPhone: 'Mobile / WhatsApp',
    lEmail: 'Email (optional)', lHotel: 'Hotel', lRoom: 'Room number', saveBtn: 'Save', clearBtn: 'Delete everything on this device',
    profileNote: 'Saved details fill in the request forms for you.', footer: 'Bosphorly · Prototype · Nothing on this page is sent to a server.',
    msgSaved: 'Saved.', confirmClear: 'Delete your profile and all request history on this device?', cleared: 'Deleted.',
    emptyUpcoming: 'No upcoming requests.', emptyPast: 'No past requests.', browse: 'Explore tours →',
    status: 'Sent to WhatsApp · awaiting confirmation', reopen: 'Open in WhatsApp again', remove: 'Remove from list', guests: 'guests', transfer: 'Airport transfer'
  };
  for (const [id, v] of Object.entries(T)) { const e = $(id); if (e) e.textContent = v; }
  const A = window.BosphorlyAccount;
  let tab = 'upcoming';
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const dateText = d => { try { return new Intl.DateTimeFormat(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00')); } catch { return d; } };

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function renderRequests() {
    const all = A.requests();
    const list = all.filter(r => (tab === 'upcoming') === (!r.date || r.date >= today));
    if (tab === 'past') list.reverse();
    const wrap = $('requests'); wrap.replaceChildren();
    if (!list.length) {
      const e = el('div', 'empty', tab === 'upcoming' ? T.emptyUpcoming : T.emptyPast);
      const a = el('a', null, T.browse); a.href = 'prices.html'; e.append(document.createElement('br'), a); wrap.append(e); return;
    }
    for (const r of list) {
      const card = el('article', 'req');
      const top = el('div', 'req-top');
      top.append(el('span', 'req-title', r.title || T.transfer), el('span', 'ref', r.ref));
      const meta = el('div', 'meta', [r.operator, r.date ? dateText(r.date) : null, r.time, r.guests ? r.guests + ' ' + T.guests : null].filter(Boolean).join(' · '));
      card.append(top, meta);
      if (r.total) card.append(el('div', 'meta', r.total));
      card.append(el('span', 'status', T.status));
      const actions = el('div', 'actions');
      if (r.waUrl) { const a = el('a', 'btn wa', T.reopen); a.href = r.waUrl; a.target = '_blank'; a.rel = 'noopener'; actions.append(a); }
      const del = el('button', 'btn ghost', T.remove); del.type = 'button';
      del.addEventListener('click', () => { A.removeRequest(r.ref); renderRequests(); });
      actions.append(del); card.append(actions); wrap.append(card);
    }
  }

  function setTab(t) {
    tab = t;
    $('tabUpcoming').setAttribute('aria-selected', String(t === 'upcoming'));
    $('tabPast').setAttribute('aria-selected', String(t === 'past'));
    renderRequests();
  }
  $('tabUpcoming').addEventListener('click', () => setTab('upcoming'));
  $('tabPast').addEventListener('click', () => setTab('past'));

  const p = A.profile() || {};
  $('pName').value = p.name || ''; $('pPhone').value = p.phone || ''; $('pEmail').value = p.email || ''; $('pHotel').value = p.hotel || ''; $('pRoom').value = p.room || '';
  $('profileForm').addEventListener('submit', e => {
    e.preventDefault();
    A.saveProfile({ name: $('pName').value, phone: $('pPhone').value, email: $('pEmail').value, hotel: $('pHotel').value, room: $('pRoom').value });
    $('saved').textContent = T.msgSaved;
  });
  $('clearBtn').addEventListener('click', () => {
    if (!confirm(T.confirmClear)) return;
    A.clear();
    ['pName', 'pPhone', 'pEmail', 'pHotel', 'pRoom'].forEach(id => { $(id).value = ''; });
    $('saved').textContent = T.cleared; renderRequests();
  });
  renderRequests();
})();
