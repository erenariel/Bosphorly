'use strict';
/* Nothing is stored or sent by this page. On submit it opens WhatsApp with the request pre-filled;
   the guest presses send in WhatsApp.
   Each request carries a price snapshot (tour, time slot, unit price, total, source, check date)
   so that what the guest saw can be shown later. In production the server stores this snapshot. */
(() => {
  const $ = id => document.getElementById(id);
  const query = new URLSearchParams(location.search);
  const lang = window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const tr = lang === 'tr';
  document.documentElement.lang = lang;

  const i18n = {
    en: {
      navAccount: 'My account', seeRequests: 'See my requests →', noSlots: 'No start times left today. Please choose another date.', invalidTime: 'Choose a start time.', labelOption: 'Massage type', labelDuration: 'Duration', minutes: 'min', openHours: 'Open daily {open}–{close}. Choose a start time.', r_option: 'Option', r_duration: 'Duration', r_fx: 'Approx. in',
      payNote: 'Payment: cash only, at the hotel reception. Tour companies such as Blue Brothers charge an extra 10% commission on credit card payments, so please pay in cash at reception.', r_pay: 'Payment', r_cash: 'Cash at the hotel reception',
      labelHotel: 'Hotel name', labelRoom: 'Room number (optional)', invalidHotel: 'Please enter your hotel name so the company knows where to pick you up.', r_hotel: 'Hotel', r_room: 'Room', openWa: 'Open WhatsApp', waTitle: 'Bosphorly booking request',
      eyebrow: 'YOUR ISTANBUL · YOUR WAY', heading: 'Request your experience through Bosphorly.',
      subheading: 'Choose a tour, date and hotel area. Your request goes from Bosphorly to the licensed company that runs it; you pay in cash at the hotel reception.',
      stepName: 'Request details', formTitle: 'Your request', formIntro: 'A preview of the request form. Nothing is sent to any company.',
      labelOffer: 'Tour', labelDate: 'Date', labelTime: 'Time', labelGuests: 'Guests', labelArea: 'Hotel area',
      labelStatus: 'Price per person', labelAvailability: 'Estimated total',
      priceNote: 'Prices are the company’s own published prices on the date shown. The company confirms the final price and availability when it accepts your request.',
      consent: 'I have checked the tour, time and price above. I agree that my request and contact details are sent via WhatsApp to Bosphorly, and that I pay in cash at the hotel reception.',
      submit: 'Send request via WhatsApp →', whyTitle: 'Compare here. Pay cash at reception.',
      whyText: 'Bosphorly lists licensed Istanbul companies side by side and forwards your request with a Bosphorly reference code. The company confirms and runs the experience; you pay in cash at the hotel reception.',
      item1: 'Company prices, no Bosphorly surcharge', item2: 'The price you saw is written into your WhatsApp request', item3: 'Bosphorly reference code on every request',
      mapTitle: 'Explore before you request', mapLink: 'Open Istanbul city map →',
      invalidDate: 'Choose a future date.', invalidGuests: 'Select 1–16 guests.', invalidOffer: 'Select a tour.', invalidConsent: 'Please confirm you have checked the tour, time and price.',
      resultTitle: 'Your request is ready', resultNotice: 'WhatsApp is opening with your request written out; press send in WhatsApp to deliver it to Bosphorly. If it does not open, use the button below.',
      notAvailable: 'Catalog not available. Please reload.', protoTag: 'PUBLIC PROTOTYPE', protoText: 'Requests go via WhatsApp · No payment is taken on this website',
      labelName: 'Full name', labelPhone: 'Mobile / WhatsApp', labelEmail: 'Email (optional)',
      contactNote: 'When you press send in WhatsApp, your details go to the Bosphorly WhatsApp line to arrange your request. Bosphorly does not store them on a server; a copy stays only on this device, under My account.',
      invalidName: 'Please enter your full name.', invalidPhone: 'Enter a valid phone/WhatsApp number with country code (e.g. +44…) so the company can confirm.', invalidEmail: 'The email address does not look valid.',
      navHome: 'Home', navCompare: 'Compare tours', navMap: 'City map',
      footerText: 'Bosphorly · Prototype · Nothing you type is stored on a server.', backHome: '← Back to homepage',
      fixedSlot: 'Fixed time for this tour', flexible: ['Morning', 'Afternoon', 'Evening', 'Flexible'], askPrice: 'Ask for price', from: 'From',
      totalFrom: 'from', perGroup: 'Price is not per person; the company confirms the total.', yourChoice: 'Your selection',
      r_ref: 'Reference', r_shownAt: 'Shown at', r_source: 'Price source', r_checked: 'checked', r_tour: 'Experience', r_company: 'Company', r_date: 'Date', r_time: 'Time', r_guests: 'Guests', r_area: 'Area', r_name: 'Name', r_phone: 'Phone', r_email: 'Email', r_unit: 'Price per person', r_total: 'Estimated total'
    },
    tr: {
      navAccount: 'Hesabım', seeRequests: 'Taleplerimi gör →', noSlots: 'Bugün için uygun saat kalmadı. Lütfen başka bir tarih seç.', invalidTime: 'Bir başlangıç saati seç.', labelOption: 'Masaj türü', labelDuration: 'Süre', minutes: 'dk', openHours: 'Her gün {open}–{close} açık. Başlangıç saatini seç.', r_option: 'Seçenek', r_duration: 'Süre', r_fx: 'Yaklaşık',
      payNote: 'Ödeme: yalnızca nakit, otel resepsiyonuna. Blue Brothers gibi tur firmaları kredi kartı ödemelerinde %10 ek komisyon alır; bu yüzden ödemeyi resepsiyona nakit yapman gerekir.', r_pay: 'Ödeme', r_cash: 'Otel resepsiyonuna nakit',
      labelHotel: 'Otel adı', labelRoom: 'Oda numarası (isteğe bağlı)', invalidHotel: 'Firmanın seni nereden alacağını bilmesi için otel adını yaz.', r_hotel: 'Otel', r_room: 'Oda', openWa: 'WhatsApp’ı aç', waTitle: 'Bosphorly rezervasyon talebi',
      eyebrow: 'İSTANBUL · SENİN PLANIN', heading: 'Deneyimini Bosphorly üzerinden talep et.',
      subheading: 'Turu, tarihi ve otel bölgeni seç. Talebin Bosphorly’den turu düzenleyen lisanslı firmaya iletilir; ödemeyi otel resepsiyonuna nakit yaparsın.',
      stepName: 'Talep detayları', formTitle: 'Talebin', formIntro: 'Talep formunun önizlemesi. Hiçbir firmaya bir şey gönderilmez.',
      labelOffer: 'Tur', labelDate: 'Tarih', labelTime: 'Saat', labelGuests: 'Kişi sayısı', labelArea: 'Otel bölgesi',
      labelStatus: 'Kişi başı fiyat', labelAvailability: 'Tahmini toplam',
      priceNote: 'Fiyatlar, firmanın belirtilen tarihte kendi sitesinde yayımladığı fiyatlardır. Kesin fiyatı ve müsaitliği firma, talebini kabul ederken teyit eder.',
      consent: 'Yukarıdaki tur, saat ve fiyatı kontrol ettim. Talebimin ve iletişim bilgilerimin WhatsApp ile Bosphorly’ye iletilmesini ve ödemeyi otel resepsiyonuna nakit yapacağımı kabul ediyorum.',
      submit: 'Talebi WhatsApp ile gönder →', whyTitle: 'Burada karşılaştır. Resepsiyona nakit öde.',
      whyText: 'Bosphorly lisanslı İstanbul firmalarını yan yana gösterir ve talebini bir Bosphorly referans koduyla iletir. Turu firma onaylar ve düzenler; ödemeyi otel resepsiyonuna nakit yaparsın.',
      item1: 'Firma fiyatı, Bosphorly ek ücreti yok', item2: 'Gördüğün fiyat WhatsApp talebine yazılır', item3: 'Her talepte Bosphorly referans kodu',
      mapTitle: 'Talep etmeden önce keşfet', mapLink: 'İstanbul haritasını aç →',
      invalidDate: 'İleri bir tarih seç.', invalidGuests: '1–16 kişi seç.', invalidOffer: 'Bir tur seç.', invalidConsent: 'Tur, saat ve fiyatı kontrol ettiğini onayla.',
      resultTitle: 'Talebin hazır', resultNotice: 'WhatsApp, talebin yazılı olarak açılıyor; Bosphorly’ye iletmek için WhatsApp’ta “Gönder”e bas. Açılmazsa aşağıdaki butonu kullan.',
      notAvailable: 'Katalog açılamadı. Sayfayı yenile.', protoTag: 'AÇIK PROTOTİP', protoText: 'Talepler WhatsApp ile iletilir · Bu sitede ödeme alınmaz',
      labelName: 'Ad soyad', labelPhone: 'Cep telefonu / WhatsApp', labelEmail: 'E-posta (isteğe bağlı)',
      contactNote: 'WhatsApp’ta gönder’e bastığında bilgilerin, talebini ayarlamak için Bosphorly WhatsApp hattına iletilir. Bosphorly bunları sunucuda saklamaz; bir kopyası yalnızca bu cihazda, Hesabım sayfasında kalır.',
      invalidName: 'Adını ve soyadını yaz.', invalidPhone: 'Firmanın teyit edebilmesi için ülke koduyla geçerli bir telefon/WhatsApp numarası yaz (örn. +90…).', invalidEmail: 'E-posta adresi geçerli görünmüyor.',
      navHome: 'Ana sayfa', navCompare: 'Tur karşılaştır', navMap: 'Şehir haritası',
      footerText: 'Bosphorly · Prototip · Yazdıkların sunucuda saklanmaz.', backHome: '← Ana sayfaya dön',
      fixedSlot: 'Bu turun saati sabittir', flexible: ['Sabah', 'Öğleden sonra', 'Akşam', 'Esnek'], askPrice: 'Fiyat sor', from: 'Başlangıç',
      totalFrom: 'başlangıç', perGroup: 'Fiyat kişi başı değil; toplamı firma teyit eder.', yourChoice: 'Seçimin',
      r_ref: 'Referans', r_shownAt: 'Gösterildiği an', r_source: 'Fiyat kaynağı', r_checked: 'kontrol', r_tour: 'Deneyim', r_company: 'Firma', r_date: 'Tarih', r_time: 'Saat', r_guests: 'Kişi', r_area: 'Bölge', r_name: 'Ad soyad', r_phone: 'Telefon', r_email: 'E-posta', r_unit: 'Kişi başı fiyat', r_total: 'Tahmini toplam'
    }
  };
  const t = i18n[lang] || i18n.en;
  if (i18n[lang] && window.BosphorlyLang.rtl(lang)) document.documentElement.dir = 'rtl';
  for (const [id, val] of Object.entries(t)) { const e = $(id); if (e && typeof val === 'string') e.textContent = val; }
  const area = $('area');
  if (tr) [...area.options].at(-1).textContent = 'Diğer';
  if (tr) { $('hotelName').placeholder = 'örn. Sultanahmet Palace'; $('room').placeholder = 'örn. 214'; $('fullName').placeholder = 'örn. Ayşe Yılmaz'; $('phone').placeholder = '+90 5xx xxx xx xx'; $('email').placeholder = 'ornek@eposta.com'; }
  const saved = window.BosphorlyAccount?.profile();
  if (saved) { $('hotelName').value = saved.hotel || ''; $('room').value = saved.room || ''; $('fullName').value = saved.name || ''; $('phone').value = saved.phone || ''; $('email').value = saved.email || ''; }
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('date').min = local; $('date').value = local;

  let records = [];
  const byId = new Map();
  const plain = (v, c) => new Intl.NumberFormat(tr ? 'tr-TR' : 'en-GB', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(v);
  const fmt = (v, c) => window.BosphorlyCurrency ? window.BosphorlyCurrency.format(v, c) : plain(v, c);
  const title = r => (tr && r.title_tr) || r.title;
  const current = () => byId.get($('offer').value);
  const perPerson = r => (r.basis || '').includes('per_person');
  const isFrom = r => (r.basis || '').startsWith('from');

  // Options (e.g. massage type) and durations each carry their own price.
  let optionsFor = null;
  const optName = o => (tr && o.name_tr) || o.name;
  const selOption = r => r?.options?.find(o => o.id === $('option').value) || null;
  const durationsOf = r => selOption(r)?.durations || r?.durations || null;
  const selDuration = r => { const list = durationsOf(r); return list ? list.find(x => String(x.min) === $('duration').value) || list[0] : null; };
  const unitPrice = r => selDuration(r)?.price ?? r?.price;
  const exact = r => !r?.options || Boolean(selOption(r)); // a chosen option has an exact price

  function renderOptions(r) {
    if (optionsFor === r.id) return;
    optionsFor = r.id;
    $('optionWrap').hidden = !r.options;
    if (r.options) $('option').replaceChildren(...r.options.map(o => { const el = document.createElement('option'); el.value = o.id; el.textContent = optName(o) + ' — ' + plain(o.durations[0].price, r.currency) + '+'; return el; }));
    renderDurations(r);
  }
  function renderDurations(r) {
    const list = durationsOf(r);
    $('durationWrap').hidden = !list || list.length < 2 && !r.options;
    if (list) $('duration').replaceChildren(...list.map(x => { const el = document.createElement('option'); el.value = String(x.min); el.textContent = x.min + ' ' + t.minutes + ' — ' + plain(x.price, r.currency); return el; }));
    const o = selOption(r);
    $('optionDesc').textContent = o ? ((tr && o.desc_tr) || o.desc) : '';
  }

  // Venues with opening hours offer start times that finish before closing.
  function hourSlots(r) {
    const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const dur = selDuration(r)?.min || 60, step = r.hours.step_min || 30;
    const out = [];
    const d = new Date(), today = $('date').value === local;
    const earliest = today ? d.getHours() * 60 + d.getMinutes() + 30 : 0; // same-day: at least 30 minutes ahead
    for (let m = toMin(r.hours.open); m + dur <= toMin(r.hours.close); m += step) if (m >= earliest) out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
    return out;
  }

  // A tour with a fixed schedule offers only that slot, so the time can never contradict the price.
  function renderTime(r) {
    const sel = $('time');
    if (r?.hours) {
      const keep = sel.value;
      const slots = hourSlots(r);
      sel.replaceChildren(...slots.map(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; return o; }));
      if (slots.includes(keep)) sel.value = keep;
      $('timeNote').textContent = slots.length ? t.openHours.replace('{open}', r.hours.open).replace('{close}', r.hours.close) : t.noSlots;
      return;
    }
    const slot = r?.details && ((tr && r.details.tr?.schedule) || r.details.schedule);
    const fixed = slot && /\d{1,2}:\d{2}/.test(slot) ? slot : null;
    sel.replaceChildren();
    if (fixed) {
      const o = document.createElement('option'); o.value = fixed; o.textContent = fixed; sel.append(o);
      $('timeNote').textContent = t.fixedSlot;
    } else {
      ['morning', 'afternoon', 'evening', 'flexible'].forEach((v, i) => { const o = document.createElement('option'); o.value = v; o.textContent = t.flexible[i]; sel.append(o); });
      $('timeNote').textContent = '';
    }
  }

  function quote(r) {
    const guests = $('guests').valueAsNumber;
    const price = unitPrice(r);
    if (!r || !Number.isFinite(price)) return { unit: t.askPrice, total: t.askPrice, unitMinor: null, totalMinor: null, price: null };
    const from = isFrom(r) && !exact(r);
    const unit = (from ? t.from + ' ' : '') + fmt(price, r.currency);
    if (!perPerson(r) || !Number.isInteger(guests) || guests < 1) return { unit, total: t.perGroup, unitMinor: Math.round(price * 100), totalMinor: null, price };
    const total = price * guests;
    return { unit, total: (from ? t.totalFrom + ' ' : '') + fmt(total, r.currency) + ' (' + guests + ' × ' + plain(price, r.currency) + ')',
      unitMinor: Math.round(price * 100), totalMinor: Math.round(total * 100), price, totalValue: total };
  }

  function render() {
    const r = current();
    if (!r) return;
    renderOptions(r);
    renderTime(r);
    const q = quote(r);
    $('price').textContent = q.unit;
    $('availability').textContent = q.total;
    const box = $('marketPrice');
    box.replaceChildren();
    const head = document.createElement('strong');
    head.textContent = t.yourChoice + ': ' + title(r) + ' · ' + r.operator;
    const L = r.details ? Object.assign({}, r.details, (tr && r.details.tr) || {}) : null;
    const info = document.createElement('div');
    const o = selOption(r), dd = selDuration(r);
    info.textContent = [o ? optName(o) : null, dd ? dd.min + ' ' + t.minutes : L?.duration, $('time').selectedOptions[0]?.textContent].filter(Boolean).join(' · ');
    if (window.BosphorlyCurrency?.note()) { const fx = document.createElement('small'); fx.textContent = window.BosphorlyCurrency.note(); box.append(fx); }
    box.append(head, info);
    if (L?.included?.length) {
      const ul = document.createElement('ul'); ul.className = 'mini-includes';
      L.included.slice(0, 4).forEach(i => { const li = document.createElement('li'); li.textContent = '✓ ' + i; ul.append(li); });
      box.append(ul);
    }
    const src = document.createElement('small');
    src.textContent = t.r_source + ': ' + r.operator + ' · ' + t.r_checked + ' ' + (r.details?.checked || '');
    box.append(src);
    $('ack').checked = false; // any change to the selection requires a fresh confirmation
  }

  function referenceCode() {
    const a = new Uint8Array(4); crypto.getRandomValues(a);
    return 'BOS-' + [...a].map(b => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 6);
  }

  async function load() {
    try {
      const resp = await fetch('data/public-market-prices.json', { cache: 'no-store' });
      if (!resp.ok) throw new Error('catalog');
      const data = await resp.json();
      records = (data.records || []).filter(x => x && typeof x.id === 'string');
      records.forEach(r => byId.set(r.id, r));
      const groups = new Map();
      for (const r of records) { if (!groups.has(r.operator)) groups.set(r.operator, []); groups.get(r.operator).push(r); }
      $('offer').replaceChildren(...[...groups].map(([op, list]) => {
        const g = document.createElement('optgroup'); g.label = op;
        list.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = title(r) + ' — ' + (Number.isFinite(r.price) ? (isFrom(r) ? t.from + ' ' : '') + fmt(r.price, r.currency) : t.askPrice); g.append(o); });
        return g;
      }));
      const fromQuery = query.get('service');
      if (byId.has(fromQuery)) $('offer').value = fromQuery;
      render();
    } catch { $('error').hidden = false; $('error').textContent = t.notAvailable; $('submit').disabled = true; }
  }

  $('offer').addEventListener('change', render);
  $('option').addEventListener('change', () => { renderDurations(current()); render(); });
  $('duration').addEventListener('change', render);
  if (window.BosphorlyCurrency) window.BosphorlyCurrency.onChange(render);
  $('guests').addEventListener('input', render);
  $('date').addEventListener('change', render);
  $('time').addEventListener('change', () => { $('ack').checked = false; });

  $('bookingForm').addEventListener('submit', event => {
    event.preventDefault();
    const r = current(); const num = $('guests').valueAsNumber;
    const hotel = $('hotelName').value.trim(), room = $('room').value.trim(), name = $('fullName').value.trim(), phone = $('phone').value.trim(), email = $('email').value.trim();
    const phoneOk = /^\+?[0-9 ()-]{7,20}$/.test(phone) && phone.replace(/\D/g, '').length >= 7;
    const msg = !r ? t.invalidOffer : !$('date').value || $('date').value < local ? t.invalidDate : !Number.isInteger(num) || num < 1 || num > 16 ? t.invalidGuests : !$('time').value ? t.invalidTime :
      hotel.length < 2 ? t.invalidHotel : name.length < 2 ? t.invalidName : !phoneOk ? t.invalidPhone : email && !$('email').checkValidity() ? t.invalidEmail : !$('ack').checked ? t.invalidConsent : null;
    $('error').hidden = !msg; $('error').textContent = msg || '';
    if (msg) return;
    const q = quote(r);
    const shownAt = new Date();
    // The snapshot is what a server would store unchanged with the request.
    const snapshot = { reference: referenceCode(), recordId: r.id, operator: r.operator, tour: r.title, option: selOption(r)?.name || null, durationMin: selDuration(r)?.min || null, time: $('time').value,
      date: $('date').value, guests: num, currency: r.currency ?? null, unitMinor: q.unitMinor, totalMinor: q.totalMinor,
      basis: r.basis ?? null, priceSource: r.details?.source_url || r.source_url, priceChecked: r.details?.checked || null, shownAt: shownAt.toISOString() };
    const preview = window.BosphorlyBooking.preview({ experienceId: r.id, date: snapshot.date, guests: num });
    const box = $('result'); box.dataset.state = preview.state; box.replaceChildren();
    const h = document.createElement('h3'); h.textContent = t.resultTitle + ' · ' + snapshot.reference;
    const p = document.createElement('p'); p.textContent = t.resultNotice;
    const d = document.createElement('dl'); d.className = 'draft';
    const dateText = new Intl.DateTimeFormat(tr ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(snapshot.date + 'T12:00'));
    const rows = [[t.r_ref, snapshot.reference], [t.r_tour, title(r)], ...(selOption(r) ? [[t.r_option, optName(selOption(r))]] : []), ...(selDuration(r) ? [[t.r_duration, selDuration(r).min + ' ' + t.minutes]] : []), [t.r_company, r.operator], [t.r_date, dateText], [t.r_time, $('time').selectedOptions[0].textContent],
      [t.r_guests, String(num)], [t.r_unit, q.unit], [t.r_total, q.total], [t.r_pay, t.r_cash], ...(window.BosphorlyCurrency?.convert(1, r.currency) ? [[tr ? 'Kur' : 'Rate', 'TCMB ' + window.BosphorlyCurrency.rates.date + (tr ? ' döviz satış' : ' forex selling')]] : []), [t.r_hotel, hotel + ' (' + area.selectedOptions[0].textContent + ')'], ...(room ? [[t.r_room, room]] : []), [t.r_name, name], [t.r_phone, phone],
      ...(email ? [[t.r_email, email]] : []), [t.r_source, r.operator + ' · ' + t.r_checked + ' ' + (snapshot.priceChecked || '')],
      [t.r_shownAt, new Intl.DateTimeFormat(tr ? 'tr-TR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(shownAt)]];
    rows.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; d.append(dt, dd); });
    const lines = [t.waTitle + ' · ' + snapshot.reference, ...rows.filter(([k]) => k !== t.r_ref).map(([k, v]) => k + ': ' + v)];
    const c = window.BOSPHORLY_CONTACT || {};
    const url = 'https://wa.me/' + c.whatsapp + '?text=' + encodeURIComponent(lines.join('\n'));
    const a = document.createElement('a'); a.className = 'primary wa-button'; a.href = url; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = t.openWa + ' · ' + (c.whatsappDisplay || '');
    const mine = document.createElement('a'); mine.href = 'account.html'; mine.textContent = t.seeRequests; mine.style.cssText = 'display:inline-block;margin:12px 0 0 12px;font-weight:800';
    box.append(h, p, d, a, mine); box.hidden = false; box.focus();
    if (window.BosphorlyAccount) {
      window.BosphorlyAccount.saveProfile({ name, phone, email, hotel, room });
      window.BosphorlyAccount.addRequest({ ref: snapshot.reference, type: 'tour', title: title(r) + (selOption(r) ? ' · ' + optName(selOption(r)) : ''), operator: r.operator,
        date: snapshot.date, time: $('time').selectedOptions[0]?.textContent || '', guests: num, total: q.total, waUrl: url, snapshot });
    }
    window.open(url, '_blank', 'noopener');
  });
  load();
})();
