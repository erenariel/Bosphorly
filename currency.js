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
  const locale = () => ({ tr: 'tr-TR', en: 'en-GB', ru: 'ru-RU', uk: 'uk-UA', de: 'de-DE', fr: 'fr-FR', nl: 'nl-NL', ar: 'ar-u-nu-latn', he: 'he-IL', az: 'az-Latn-AZ', fa: 'fa-IR', es: 'es-ES', it: 'it-IT', pt: 'pt-BR' }[lang()] || 'en-GB');
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
    tr: { original: '¤ Orijinal', label: 'Para birimi', note: d => `Yaklaşık tutar: TCMB ${d} döviz satış kuru. Ödeme otel resepsiyonuna nakit yapılır.`, title: d => `TCMB ${d} kuru` },
    en: { original: '¤ Original', label: 'Currency', note: d => `Approximate amount at the TCMB ${d} forex selling rate. Payment is in cash at the hotel reception.`, title: d => `TCMB rate of ${d}` },
    ru: { original: '¤ Исходная', label: 'Валюта', note: d => `Примерная сумма по курсу продажи ЦБ Турции (TCMB) на ${d}. Оплата наличными на ресепшене отеля.`, title: d => `Курс TCMB на ${d}` },
    ar: { original: '¤ الأصلية', label: 'العملة', note: d => `مبلغ تقريبي بسعر بيع البنك المركزي التركي (TCMB) بتاريخ ${d}. الدفع نقدًا في استقبال الفندق.`, title: d => `سعر TCMB بتاريخ ${d}` },
    it: { original: "¤ Originale", label: "Valuta", note: d => "Importo indicativo al cambio di vendita TCMB del {d}. Il pagamento avviene in contanti alla reception dell’hotel.".replace('{d}', d), title: d => "Cambio TCMB del {d}".replace('{d}', d) },
    pt: { original: "¤ Original", label: "Moeda", note: d => "Valor aproximado pela taxa de venda do TCMB de {d}. O pagamento é feito em dinheiro na recepção do hotel.".replace('{d}', d), title: d => "Taxa do TCMB de {d}".replace('{d}', d) },
    fr: { original: "¤ Originale", label: "Devise", note: d => "Montant approximatif au taux de vente TCMB du {d}. Le paiement se fait en espèces à la réception de l’hôtel.".replace('{d}', d), title: d => "Taux TCMB du {d}".replace('{d}', d) },
    es: { original: "¤ Original", label: "Moneda", note: d => "Importe aproximado al tipo de venta del TCMB del {d}. El pago se hace en efectivo en la recepción del hotel.".replace('{d}', d), title: d => "Tipo del TCMB del {d}".replace('{d}', d) },
    uk: { original: "¤ Початкова", label: "Валюта", note: d => "Орієнтовна сума за курсом продажу ЦБ Туреччини (TCMB) на {d}. Оплата готівкою на рецепції готелю.".replace('{d}', d), title: d => "Курс TCMB на {d}".replace('{d}', d) },
    nl: { original: "¤ Origineel", label: "Valuta", note: d => "Bedrag bij benadering tegen de TCMB-verkoopkoers van {d}. Betalen gebeurt contant bij de hotelreceptie.".replace('{d}', d), title: d => "TCMB-koers van {d}".replace('{d}', d) },
    az: { original: "¤ Orijinal", label: "Valyuta", note: d => "TCMB-nin {d} tarixli satış məzənnəsi ilə təxmini məbləğ. Ödəniş otel resepşnında nağd edilir.".replace('{d}', d), title: d => "TCMB {d} məzənnəsi".replace('{d}', d) },
    he: { original: "¤ מקורי", label: "מטבע", note: d => "סכום משוער לפי שער המכירה של TCMB מתאריך {d}. התשלום במזומן בקבלת המלון.".replace('{d}', d), title: d => "שער TCMB מתאריך {d}".replace('{d}', d) },
    fa: { original: "¤ اصلی", label: "ارز", note: d => "مبلغ تقریبی با نرخ فروش TCMB در تاریخ {d}. پرداخت به‌صورت نقدی در پذیرش هتل انجام می‌شود.".replace('{d}', d), title: d => "نرخ TCMB در تاریخ {d}".replace('{d}', d) }
  };
  const txt = () => TXT[lang()] || TXT.en;
  // Wording for market rates (used when the official TCMB bulletin is unavailable or too old).
  const MARKET = {"tr": ["Yaklaşık tutar: {d} tarihli piyasa kuru ({s}). Ödeme otel resepsiyonuna nakit yapılır.", "{d} piyasa kuru ({s})"], "en": ["Approximate amount at the market rate of {d} ({s}). Payment is in cash at the hotel reception.", "Market rate of {d} ({s})"], "ru": ["Примерная сумма по рыночному курсу на {d} ({s}). Оплата наличными на ресепшене отеля.", "Рыночный курс на {d} ({s})"], "uk": ["Орієнтовна сума за ринковим курсом на {d} ({s}). Оплата готівкою на рецепції готелю.", "Ринковий курс на {d} ({s})"], "de": ["Ungefährer Betrag zum Marktkurs vom {d} ({s}). Bezahlt wird bar an der Hotelrezeption.", "Marktkurs vom {d} ({s})"], "fr": ["Montant approximatif au taux du marché du {d} ({s}). Le paiement se fait en espèces à la réception de l’hôtel.", "Taux du marché du {d} ({s})"], "nl": ["Bedrag bij benadering tegen de marktkoers van {d} ({s}). Betalen gebeurt contant bij de hotelreceptie.", "Marktkoers van {d} ({s})"], "ar": ["مبلغ تقريبي بسعر السوق بتاريخ {d} ({s}). الدفع نقدًا في استقبال الفندق.", "سعر السوق بتاريخ {d} ({s})"], "he": ["סכום משוער לפי שער השוק מתאריך {d} ({s}). התשלום במזומן בקבלת המלון.", "שער שוק מתאריך {d} ({s})"], "az": ["{d} tarixli bazar məzənnəsi ilə təxmini məbləğ ({s}). Ödəniş otel resepşnında nağd edilir.", "{d} bazar məzənnəsi ({s})"], "fa": ["مبلغ تقریبی با نرخ بازار در تاریخ {d} ({s}). پرداخت به‌صورت نقدی در پذیرش هتل انجام می‌شود.", "نرخ بازار در تاریخ {d} ({s})"], "es": ["Importe aproximado al tipo de mercado del {d} ({s}). El pago se hace en efectivo en la recepción del hotel.", "Tipo de mercado del {d} ({s})"], "it": ["Importo indicativo al cambio di mercato del {d} ({s}). Il pagamento avviene in contanti alla reception dell’hotel.", "Cambio di mercato del {d} ({s})"], "pt": ["Valor aproximado pela taxa de mercado de {d} ({s}). O pagamento é feito em dinheiro na recepção do hotel.", "Taxa de mercado de {d} ({s})"]};
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
