// Currency display. Prices stay in the company's own currency; the visitor can view an
// approximate amount in another currency at the day's TCMB rate. Choice is remembered on this device.
(() => {
  const CURRENCIES = ['TRY', 'EUR', 'USD', 'GBP', 'RUB', 'SAR', 'AED', 'AZN'];
  const KEY = 'bosphorly.currency';
  let rates = null;
  let chosen = 'original';
  try { const s = localStorage.getItem(KEY); if (s === 'original' || CURRENCIES.includes(s)) chosen = s; } catch {}
  const lang = () => (window.BosphorlyLang ? window.BosphorlyLang.pick() : document.documentElement.lang || 'en');
  const tr = () => lang() === 'tr';
  const locale = () => ({ tr: 'tr-TR', en: 'en-GB', ru: 'ru-RU', uk: 'uk-UA', de: 'de-DE', fr: 'fr-FR', nl: 'nl-NL', ar: 'ar-u-nu-latn', he: 'he-IL', az: 'az-Latn-AZ', fa: 'fa-IR', es: 'es-ES', it: 'it-IT', pt: 'pt-BR', hr: "hr-HR", hu: "hu-HU", bs: "bs-BA", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR", hi: "hi-IN", bn: "bn-BD-u-nu-latn", id: "id-ID" }[lang()] || 'en-GB');
  const money = (v, c) => new Intl.NumberFormat(locale(), { style: 'currency', currency: c, maximumFractionDigits: c === 'TRY' || c === 'RUB' ? 0 : 2 }).format(v);
  const tryPer = c => (c === 'TRY' ? 1 : rates?.rates?.[c] ? rates.rates[c].forex_selling / rates.rates[c].unit : null);

  function convert(amount, from) {
    if (!Number.isFinite(amount) || chosen === 'original' || chosen === from) return null;
    const a = tryPer(from), b = tryPer(chosen);
    return a && b ? amount * a / b : null;
  }
  // "≈ ₺1.110 (€20,00)" when converted, otherwise the original price.
  function format(amount, from) {
    const v = convert(amount, from);
    return v === null ? money(amount, from) : '≈ ' + money(v, chosen) + ' (' + money(amount, from) + ')';
  }
  const TXT = {
    tr: { original: '¤ Orijinal', label: 'Para birimi', note: d => `Yaklaşık tutar: TCMB ${d} döviz satış kuru. Ödeme yöntemi, talebiniz alındıktan sonra sizinle iletişime geçtiğimizde paylaşılır.`, title: d => `TCMB ${d} kuru` },
    en: { original: '¤ Original', label: 'Currency', note: d => `Approximate amount at the TCMB ${d} forex selling rate. We share the payment method when we contact you about your request.`, title: d => `TCMB rate of ${d}` },
    ru: { original: '¤ Исходная', label: 'Валюта', note: d => `Примерная сумма по курсу продажи ЦБ Турции (TCMB) на ${d}. Способ оплаты мы сообщим, когда свяжемся с вами по поводу заявки.`, title: d => `Курс TCMB на ${d}` },
    ar: { original: '¤ الأصلية', label: 'العملة', note: d => `مبلغ تقريبي بسعر بيع البنك المركزي التركي (TCMB) بتاريخ ${d}. نخبرك بطريقة الدفع عندما نتواصل معك بخصوص طلبك.`, title: d => `سعر TCMB بتاريخ ${d}` },
    it: { original: "¤ Originale", label: "Valuta", note: d => "Importo indicativo al cambio di vendita TCMB del {d}. Ti comunichiamo il metodo di pagamento quando ti contattiamo per la tua richiesta.".replace('{d}', d), title: d => "Cambio TCMB del {d}".replace('{d}', d) },
    pt: { original: "¤ Original", label: "Moeda", note: d => "Valor aproximado pela taxa de venda do TCMB de {d}. Informamos a forma de pagamento quando entrarmos em contato sobre o seu pedido.".replace('{d}', d), title: d => "Taxa do TCMB de {d}".replace('{d}', d) },
    fr: { original: "¤ Originale", label: "Devise", note: d => "Montant approximatif au taux de vente TCMB du {d}. Nous vous indiquons le mode de paiement lorsque nous vous contactons au sujet de votre demande.".replace('{d}', d), title: d => "Taux TCMB du {d}".replace('{d}', d) },
    es: { original: "¤ Original", label: "Moneda", note: d => "Importe aproximado al tipo de venta del TCMB del {d}. Te indicamos el método de pago cuando nos pongamos en contacto contigo por tu solicitud.".replace('{d}', d), title: d => "Tipo del TCMB del {d}".replace('{d}', d) },
    uk: { original: "¤ Початкова", label: "Валюта", note: d => "Орієнтовна сума за курсом продажу ЦБ Туреччини (TCMB) на {d}. Спосіб оплати ми повідомимо, коли зв’яжемося з вами щодо запиту.".replace('{d}', d), title: d => "Курс TCMB на {d}".replace('{d}', d) },
    nl: { original: "¤ Origineel", label: "Valuta", note: d => "Bedrag bij benadering tegen de TCMB-verkoopkoers van {d}. We delen de betaalmethode wanneer we contact met je opnemen over je aanvraag.".replace('{d}', d), title: d => "TCMB-koers van {d}".replace('{d}', d) },
    az: { original: "¤ Orijinal", label: "Valyuta", note: d => "TCMB-nin {d} tarixli satış məzənnəsi ilə təxmini məbləğ. Ödəniş üsulunu sorğunuzla bağlı sizinlə əlaqə saxlayanda bildiririk.".replace('{d}', d), title: d => "TCMB {d} məzənnəsi".replace('{d}', d) },
    he: { original: "¤ מקורי", label: "מטבע", note: d => "סכום משוער לפי שער המכירה של TCMB מתאריך {d}. את אמצעי התשלום נמסור כשניצור איתכם קשר לגבי הבקשה.".replace('{d}', d), title: d => "שער TCMB מתאריך {d}".replace('{d}', d) },
    fa: { original: "¤ اصلی", label: "ارز", note: d => "مبلغ تقریبی با نرخ فروش TCMB در تاریخ {d}. روش پرداخت را هنگامی که درباره درخواستتان با شما تماس می‌گیریم اعلام می‌کنیم.".replace('{d}', d), title: d => "نرخ TCMB در تاریخ {d}".replace('{d}', d) },
    hr: { original: "¤ Izvorna", label: "Valuta", note: d => "Približan iznos prema prodajnom tečaju TCMB-a od {d}. Način plaćanja javljamo kada vas kontaktiramo u vezi s upitom.".replace('{d}', d), title: d => "Tečaj TCMB-a od {d}".replace('{d}', d) },
    hu: { original: "¤ Eredeti", label: "Pénznem", note: d => "Hozzávetőleges összeg a TCMB {d}-i deviza eladási árfolyamán. A fizetési módot akkor közöljük, amikor az ajánlatkérése ügyében felvesszük Önnel a kapcsolatot.".replace('{d}', d), title: d => "TCMB-árfolyam, {d}".replace('{d}', d) },
    bs: { original: "¤ Izvorna", label: "Valuta", note: d => "Približan iznos prema prodajnom kursu TCMB-a od {d}. Način plaćanja javljamo kada vas kontaktiramo u vezi s upitom.".replace('{d}', d), title: d => "Kurs TCMB-a od {d}".replace('{d}', d) },
    zh: { original: "¤ 原币种", label: "货币", note: d => "按土耳其央行（TCMB）{d} 外汇卖出价换算的近似金额。我们会在就你的申请与你联系时告知付款方式。".replace('{d}', d), title: d => "TCMB {d} 汇率".replace('{d}', d) },
    ja: { original: "¤ 元の通貨", label: "通貨", note: d => "トルコ中央銀行（TCMB）の {d} の外貨売りレートによる概算額です。お支払い方法は、リクエストについてご連絡する際にお知らせします。".replace('{d}', d), title: d => "TCMB レート（{d}）".replace('{d}', d) },
    ko: { original: "¤ 원래 통화", label: "통화", note: d => "튀르키예 중앙은행(TCMB) {d} 외환 매도 환율 기준 대략적인 금액입니다. 결제 방법은 요청과 관련해 연락드릴 때 안내해 드립니다.".replace('{d}', d), title: d => "TCMB 환율({d})".replace('{d}', d) },
    hi: { original: "¤ मूल मुद्रा", label: "मुद्रा", note: d => "TCMB की {d} की विदेशी मुद्रा बिक्री दर पर अनुमानित राशि। आपके अनुरोध के बारे में संपर्क करते समय हम भुगतान का तरीका बताएँगे।".replace('{d}', d), title: d => "TCMB दर, {d}".replace('{d}', d) },
    bn: { original: "¤ মূল মুদ্রা", label: "মুদ্রা", note: d => "TCMB-র {d} তারিখের বৈদেশিক মুদ্রা বিক্রয় হারে আনুমানিক অঙ্ক। আপনার অনুরোধ নিয়ে যোগাযোগ করার সময় আমরা পেমেন্টের পদ্ধতি জানাব।".replace('{d}', d), title: d => "TCMB হার, {d}".replace('{d}', d) },
    id: { original: "¤ Asli", label: "Mata uang", note: d => "Perkiraan jumlah dengan kurs jual TCMB tanggal {d}. Kami memberi tahu metode pembayaran saat menghubungi Anda terkait permintaan Anda.".replace('{d}', d), title: d => "Kurs TCMB tanggal {d}".replace('{d}', d) }
  };
  const txt = () => TXT[lang()] || TXT.en;
  // Wording for market rates (used when the official TCMB bulletin is unavailable or too old).
  const MARKET = {"tr": ["Yaklaşık tutar: {d} tarihli piyasa kuru ({s}). Ödeme yöntemi, talebiniz alındıktan sonra sizinle iletişime geçtiğimizde paylaşılır.", "{d} piyasa kuru ({s})"], "en": ["Approximate amount at the market rate of {d} ({s}). We share the payment method when we contact you about your request.", "Market rate of {d} ({s})"], "ru": ["Примерная сумма по рыночному курсу на {d} ({s}). Способ оплаты мы сообщим, когда свяжемся с вами по поводу заявки.", "Рыночный курс на {d} ({s})"], "uk": ["Орієнтовна сума за ринковим курсом на {d} ({s}). Спосіб оплати ми повідомимо, коли зв’яжемося з вами щодо запиту.", "Ринковий курс на {d} ({s})"], "de": ["Ungefährer Betrag zum Marktkurs vom {d} ({s}). Die Zahlungsart teilen wir Ihnen mit, wenn wir uns wegen Ihrer Anfrage bei Ihnen melden.", "Marktkurs vom {d} ({s})"], "fr": ["Montant approximatif au taux du marché du {d} ({s}). Nous vous indiquons le mode de paiement lorsque nous vous contactons au sujet de votre demande.", "Taux du marché du {d} ({s})"], "nl": ["Bedrag bij benadering tegen de marktkoers van {d} ({s}). We delen de betaalmethode wanneer we contact met je opnemen over je aanvraag.", "Marktkoers van {d} ({s})"], "ar": ["مبلغ تقريبي بسعر السوق بتاريخ {d} ({s}). نخبرك بطريقة الدفع عندما نتواصل معك بخصوص طلبك.", "سعر السوق بتاريخ {d} ({s})"], "he": ["סכום משוער לפי שער השוק מתאריך {d} ({s}). את אמצעי התשלום נמסור כשניצור איתכם קשר לגבי הבקשה.", "שער שוק מתאריך {d} ({s})"], "az": ["{d} tarixli bazar məzənnəsi ilə təxmini məbləğ ({s}). Ödəniş üsulunu sorğunuzla bağlı sizinlə əlaqə saxlayanda bildiririk.", "{d} bazar məzənnəsi ({s})"], "fa": ["مبلغ تقریبی با نرخ بازار در تاریخ {d} ({s}). روش پرداخت را هنگامی که درباره درخواستتان با شما تماس می‌گیریم اعلام می‌کنیم.", "نرخ بازار در تاریخ {d} ({s})"], "es": ["Importe aproximado al tipo de mercado del {d} ({s}). Te indicamos el método de pago cuando nos pongamos en contacto contigo por tu solicitud.", "Tipo de mercado del {d} ({s})"], "it": ["Importo indicativo al cambio di mercato del {d} ({s}). Ti comunichiamo il metodo di pagamento quando ti contattiamo per la tua richiesta.", "Cambio di mercato del {d} ({s})"], "pt": ["Valor aproximado pela taxa de mercado de {d} ({s}). Informamos a forma de pagamento quando entrarmos em contato sobre o seu pedido.", "Taxa de mercado de {d} ({s})"], "hr": ["Približan iznos prema tržišnom tečaju od {d} ({s}). Način plaćanja javljamo kada vas kontaktiramo u vezi s upitom.", "Tržišni tečaj od {d} ({s})"], "hu": ["Hozzávetőleges összeg a {d}-i piaci árfolyamon ({s}). A fizetési módot akkor közöljük, amikor az ajánlatkérése ügyében felvesszük Önnel a kapcsolatot.", "Piaci árfolyam, {d} ({s})"], "bs": ["Približan iznos prema tržišnom kursu od {d} ({s}). Način plaćanja javljamo kada vas kontaktiramo u vezi s upitom.", "Tržišni kurs od {d} ({s})"], "zh": ["按 {d} 的市场汇率（{s}）换算的近似金额。我们会在就你的申请与你联系时告知付款方式。", "{d} 市场汇率（{s}）"], "ja": ["{d} の市場レート（{s}）による概算額です。お支払い方法は、リクエストについてご連絡する際にお知らせします。", "市場レート（{d}、{s}）"], "ko": ["{d} 시장 환율({s}) 기준 대략적인 금액입니다. 결제 방법은 요청과 관련해 연락드릴 때 안내해 드립니다.", "시장 환율({d}, {s})"], "hi": ["{d} की बाज़ार दर ({s}) पर अनुमानित राशि। आपके अनुरोध के बारे में संपर्क करते समय हम भुगतान का तरीका बताएँगे।", "बाज़ार दर, {d} ({s})"], "bn": ["{d} তারিখের বাজারদরে ({s}) আনুমানিক অঙ্ক। আপনার অনুরোধ নিয়ে যোগাযোগ করার সময় আমরা পেমেন্টের পদ্ধতি জানাব।", "বাজারদর, {d} ({s})"], "id": ["Perkiraan jumlah dengan kurs pasar tanggal {d} ({s}). Kami memberi tahu metode pembayaran saat menghubungi Anda terkait permintaan Anda.", "Kurs pasar tanggal {d} ({s})"]};
  const market = () => rates && rates.kind === 'market';
  const fill = (s, d) => s.replace('{d}', d).replace('{s}', (rates && rates.source_name) || '');
  const noteText = () => (market() ? fill((MARKET[lang()] || MARKET.en)[0], rates.date) : txt().note(rates.date));
  const titleText = () => (market() ? fill((MARKET[lang()] || MARKET.en)[1], rates.date) : txt().title(rates.date));
  function note() {
    if (chosen === 'original' || !rates) return '';
    return noteText();
  }
  const listeners = new Set();
  function set(c) { chosen = c; try { localStorage.setItem(KEY, c); } catch {} document.querySelectorAll('.currency-select').forEach(s => { s.value = c; }); listeners.forEach(f => f()); }

  function mount() {
    document.querySelectorAll('[data-currency-mount]').forEach(el => {
      if (el.querySelector('select')) return;
      const s = document.createElement('select');
      s.className = 'currency-select';
      s.setAttribute('aria-label', txt().label);
      const o = document.createElement('option'); o.value = 'original'; o.textContent = txt().original; s.append(o);
      for (const c of CURRENCIES) {
        if (c !== 'TRY' && !rates?.rates?.[c]) continue;
        const op = document.createElement('option'); op.value = c; op.textContent = c; s.append(op);
      }
      s.value = chosen;
      s.title = rates ? titleText() : '';
      s.addEventListener('change', () => set(s.value));
      el.append(s);
    });
  }

  // The site's own file is refreshed several times a day by GitHub Actions (tools/fetch_rates.py). If it is
  // missing or more than MAX_AGE days old (scheduled runs stopped, long holiday), the browser fetches
  // the day's market rates itself, so visitors never see a stale conversion.
  const MAX_AGE = 4;
  const ageDays = d => { const m = /^(\d\d)\.(\d\d)\.(\d{4})$/.exec(d || ''); return m ? (Date.now() - Date.UTC(+m[3], m[2] - 1, +m[1])) / 864e5 : Infinity; };
  const MARKET_URLS = ['https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/try.json',
    'https://latest.currency-api.pages.dev/v1/currencies/try.json'];
  async function marketRates() {
    for (const url of MARKET_URLS) {
      try {
        const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) continue;
        const j = await r.json(); const out = {};
        for (const c of CURRENCIES) { const v = c !== 'TRY' && j.try && j.try[c.toLowerCase()]; if (v) out[c] = { unit: 1, forex_selling: 1 / v }; }
        if (!out.EUR || !out.USD || !/^\d{4}-\d\d-\d\d$/.test(j.date || '')) continue;
        const [y, mo, d] = j.date.split('-');
        return { kind: 'market', source_name: 'currency-api', source_url: url, date: d + '.' + mo + '.' + y, base: 'TRY', rates: out };
      } catch {}
    }
    return null;
  }
  const ready = fetch('data/rates.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null)
    .then(async d => (d && ageDays(d.date) <= MAX_AGE ? d : (await marketRates()) || d)).then(d => {
    rates = d;
    if (!rates && chosen !== 'original') chosen = 'original';
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
    listeners.forEach(f => f());
  });
  window.BosphorlyCurrency = { format, convert, note, money, onChange: f => listeners.add(f), ready, get current() { return chosen; }, get rates() { return rates; } };
})();
