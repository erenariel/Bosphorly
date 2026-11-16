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
  const locale = () => ({ tr: 'tr-TR', en: 'en-GB', ru: 'ru-RU', uk: 'uk-UA', de: 'de-DE', fr: 'fr-FR', nl: 'nl-NL', ar: 'ar', he: 'he-IL', az: 'az-Latn-AZ', fa: 'fa-IR', es: 'es-ES' }[lang()] || 'en-GB');
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
  function note() {
    if (chosen === 'original' || !rates) return '';
    return tr() ? `Yaklaşık tutar: TCMB ${rates.date} döviz satış kuru. Ödeme otel resepsiyonuna nakit yapılır.`
      : `Approximate amount at the TCMB ${rates.date} forex selling rate. Payment is in cash at the hotel reception.`;
  }
  const listeners = new Set();
  function set(c) { chosen = c; try { localStorage.setItem(KEY, c); } catch {} document.querySelectorAll('.currency-select').forEach(s => { s.value = c; }); listeners.forEach(f => f()); }

  function mount() {
    document.querySelectorAll('[data-currency-mount]').forEach(el => {
      if (el.querySelector('select')) return;
      const s = document.createElement('select');
      s.className = 'currency-select';
      s.setAttribute('aria-label', tr() ? 'Para birimi' : 'Currency');
      const o = document.createElement('option'); o.value = 'original'; o.textContent = tr() ? '¤ Orijinal' : '¤ Original'; s.append(o);
      for (const c of CURRENCIES) {
        if (c !== 'TRY' && !rates?.rates?.[c]) continue;
        const op = document.createElement('option'); op.value = c; op.textContent = c; s.append(op);
      }
      s.value = chosen;
      s.title = rates ? (tr() ? `TCMB ${rates.date} kuru` : `TCMB rate of ${rates.date}`) : '';
      s.addEventListener('change', () => set(s.value));
      el.append(s);
    });
  }

  const ready = fetch('data/rates.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null).then(d => {
    rates = d;
    if (!rates && chosen !== 'original') chosen = 'original';
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
    listeners.forEach(f => f());
  });
  window.BosphorlyCurrency = { format, convert, note, money, onChange: f => listeners.add(f), ready, get current() { return chosen; }, get rates() { return rates; } };
})();
