// All submissions use the existing chat launcher or booking controls.
(() => {
  const root = document.querySelector('.ai-hero');
  const byId = id => document.getElementById('ai-' + id);
  const field = byId('question');
  const box = byId('box');
  const chips = [...root.querySelectorAll('.ai-chips button')];
  const tabs = [...root.querySelectorAll('[data-tab]')];
  const mobile = matchMedia('(max-width:767px)');
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  let active = 'transfer';
  let expanded = false;
  let channel = 'unknown';
  let timer;
  const track = (name, value) => window.BosphorlyMeasurement?.heroEvent(name, value);

  function placeholders() {
    clearInterval(timer);
    let index = 0;
    const advance = () => { field.placeholder = chips[index++ % chips.length].textContent; };
    advance();
    if (!reduced.matches && !document.hidden && channel !== 'off') timer = setInterval(advance, 2600);
  }
  function translate() {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    const title = byId('title');
    const [first] = title.textContent.match(/^[^.!?。！？؟]+[.!?。！？؟]?/u) || [''];
    const accent = document.createElement('span');
    accent.textContent = first;
    title.replaceChildren(accent, title.textContent.slice(first.length));
    placeholders();
    syncOffers();
  }
  function syncOffers() {
    if (active === 'transfer') return;
    const category = active === 'cruise' ? 'cruise' : 'city';
    const select = byId('offer');
    const selected = select.value;
    select.replaceChildren();
    for (const tour of tours.filter(item => item.category === category)) {
      const market = MARKET_PRICES.get(tour.id);
      if (MARKET_CATALOG_MANAGED && !market) continue;
      select.add(new Option(market?.['title_' + state.lang] || market?.title || ux(tour.name), tour.id));
    }
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
    byId('quick').querySelector('button').disabled = !select.length;
  }
  function syncTabs() {
    const visible = !mobile.matches || expanded;
    byId('quick').hidden = !visible;
    tabs.forEach(button => {
      const current = visible && button.dataset.tab === active;
      button.setAttribute('aria-pressed', String(current));
      button.setAttribute('aria-expanded', String(current));
    });
    byId('origin').hidden = byId('when').hidden = active !== 'transfer';
    byId('product').hidden = active === 'transfer';
    byId('quick').querySelector('button').disabled = false;
    syncOffers();
  }
  tabs.forEach(button => button.addEventListener('click', () => {
    expanded = active !== button.dataset.tab || !expanded;
    active = button.dataset.tab;
    syncTabs();
  }));
  byId('quick').addEventListener('submit', event => {
    event.preventDefault();
    track('hero_quick_search', active);
    if (active !== 'transfer') {
      location.href = 'booking.html?' + new URLSearchParams({service:byId('offer').value, lang:state.lang});
      return;
    }
    showStep(1);
    document.querySelector('[data-airport="' + byId('airport').value + '"]').click();
    if (byId('date').value) {
      const date = document.getElementById('arrivalDate');
      date.value = byId('date').value;
      date.dispatchEvent(new Event('change', {bubbles:true}));
    }
    location.hash = 'booking';
    document.getElementById('booking').scrollIntoView();
  });
  byId('date').min = document.getElementById('arrivalDate').min;
  function ask(question, source) {
    if (!question.trim() || channel === 'off' || !window.__bosphorlyOpenMimo) return;
    track('hero_ask_mimo', source);
    window.__bosphorlyOpenMimo(question.trim());
    field.value = '';
  }
  byId('ask').addEventListener('submit', event => { event.preventDefault(); ask(field.value, 'typed'); });
  chips.forEach(button => button.addEventListener('click', () => ask(button.textContent, 'chip')));
  document.addEventListener('bosphorly:mimo-limit', () => {
    if (!window.BosphorlyMember?.signedIn?.() && !localStorage.getItem('bosphorly.session')) byId('limit').hidden = false;
  });
  async function channelStatus() {
    const key = 'bosphorly.hero.mimo-status';
    try {
      const cached = sessionStorage.getItem(key);
      if (['on','off','unknown'].includes(cached)) return cached;
    } catch {}
    let status = 'unknown';
    try {
      const base = window.BOSPHORLY_API?.base;
      if (base) {
        const response = await fetch(base + '/v1/public/channels', {signal:AbortSignal.timeout(5000)});
        if (response.ok) {
          const enabled = (await response.json()).channels?.mimo;
          if (typeof enabled === 'boolean') status = enabled ? 'on' : 'off';
        }
      }
    } catch {}
    try { sessionStorage.setItem(key, status); } catch {}
    return status;
  }
  channelStatus().then(status => {
    channel = status;
    byId('online').hidden = status !== 'on';
    byId('ask').hidden = status === 'off';
    byId('team').hidden = status !== 'off';
    if (status === 'off') track('hero_mimo_unavailable');
    placeholders();
  });
  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => {
    document.body.classList.toggle('ai-box-visible', entry.isIntersecting);
  }).observe(box);

  // Attribute any live Google rating to the operator whose tour provides it.
  function syncRating() {
    const badge = document.querySelector('#tourGrid .g-rating:not([hidden])');
    const host = byId('rating');
    host.replaceChildren();
    if (badge) {
      const operator = badge.closest('.tour-content')?.querySelector('.tour-operator')?.textContent;
      if (operator) host.append(' · ' + operator + ' ', badge.cloneNode(true));
    }
  }
  new MutationObserver(() => { syncRating(); syncOffers(); }).observe(document.getElementById('tourGrid'),
    {subtree:true,childList:true,attributes:true,attributeFilter:['hidden']});
  document.addEventListener('bosphorly:lang', translate);
  mobile.addEventListener('change', syncTabs);
  reduced.addEventListener('change', placeholders);
  document.addEventListener('visibilitychange', placeholders);
  translate();
  syncTabs();
  syncRating();
})();
