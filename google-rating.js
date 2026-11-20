'use strict';
/* Google rating badge: "★ 4.7 (12,345) · Google reviews", linking straight to the place's Google reviews.
   Tour companies get a plain badge instead: no link (their Google page lists their own phone and website,
   and guests should book through Bosphorly), and it only appears once a real rating has been fetched.
   Rating and count are fetched live from Google (Places, via the Maps JavaScript API) only when the badge
   scrolls into view, and kept in memory for this page view only: Google's terms do not allow storing them.
   Without a browser key (config/maps-public.js) the badge is a plain link to the place on Google Maps. */
(() => {
  const T = {
    en: ['Google reviews', 'Average {r} from {n} Google reviews'], tr: ['Google yorumları', 'Google’da {n} yorumdan ortalama {r}'],
    ru: ['Отзывы в Google', 'Средняя оценка {r} по {n} отзывам в Google'], uk: ['Відгуки в Google', 'Середня оцінка {r} за {n} відгуками в Google'],
    de: ['Google-Bewertungen', 'Durchschnitt {r} aus {n} Google-Bewertungen'], fr: ['Avis Google', 'Moyenne de {r} sur {n} avis Google'],
    nl: ['Google-reviews', 'Gemiddeld {r} uit {n} Google-reviews'], ar: ['تقييمات Google', 'متوسط {r} من {n} تقييمًا على Google'],
    he: ['ביקורות בגוגל', 'ממוצע {r} מתוך {n} ביקורות בגוגל'], az: ['Google rəyləri', 'Google-da {n} rəydən orta {r}'],
    fa: ['نظرات گوگل', 'میانگین {r} از {n} نظر در گوگل'], es: ['Reseñas de Google', 'Media de {r} en {n} reseñas de Google'],
    it: ['Recensioni Google', 'Media di {r} su {n} recensioni Google'], pt: ['Avaliações no Google', 'Média {r} em {n} avaliações no Google'],
    hr: ["Google recenzije", "Prosjek {r} iz {n} Google recenzija"],
    hu: ["Google-értékelések", "{r} átlag {n} Google-értékelés alapján"],
    bs: ["Google recenzije", "Prosjek {r} iz {n} Google recenzija"],
    zh: ["Google 评价", "{n} 条 Google 评价，平均 {r} 分"],
    ja: ["Google のクチコミ", "Google のクチコミ {n} 件の平均 {r}"],
    ko: ["Google 리뷰", "Google 리뷰 {n}개 평균 {r}"],
    hi: ["Google समीक्षाएँ", "{n} Google समीक्षाओं का औसत {r}"],
    bn: ["Google রিভিউ", "{n}টি Google রিভিউয়ের গড় {r}"],
    id: ["Ulasan Google", "Rata-rata {r} dari {n} ulasan Google"]
  };
  const lang = () => (window.BosphorlyLang ? window.BosphorlyLang.pick() : (document.documentElement.lang || 'en').slice(0, 2));
  const txt = () => T[lang()] || T.en;
  const locale = () => (lang() === 'ar' ? 'ar-u-nu-latn' : lang());
  const key = () => (window.BOSPHORLY_PUBLIC_CONFIG && window.BOSPHORLY_PUBLIC_CONFIG.googleMapsBrowserKey || '').trim();

  // Google's own links: the reviews panel when the place ID is known, otherwise a Maps search for the place.
  const reviewsUrl = id => 'https://search.google.com/local/reviews?placeid=' + encodeURIComponent(id);
  const searchUrl = (q, id) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q) + (id ? '&query_place_id=' + encodeURIComponent(id) : '');

  let mapsReady = null;
  function maps() {
    if (mapsReady) return mapsReady;
    mapsReady = new Promise((resolve, reject) => {
      const done = () => window.google && google.maps && google.maps.importLibrary;
      if (done()) return resolve();
      // Another script on the page (hotel search) may already be loading the Maps API: wait for it.
      if (!document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
        const s = document.createElement('script');
        s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(key()) + '&v=weekly&loading=async';
        s.async = true; s.onerror = reject; document.head.append(s);
      }
      let n = 0; const t = setInterval(() => { if (done()) { clearInterval(t); resolve(); } else if (++n > 100) { clearInterval(t); reject(new Error('maps timeout')); } }, 100);
    });
    return mapsReady;
  }

  const cache = new Map(); // query -> Promise<{rating, count, id}>, this page view only
  function lookup(t) {
    const k = t.placeId || t.query;
    if (!cache.has(k)) cache.set(k, (async () => {
      await maps();
      const { Place } = await google.maps.importLibrary('places');
      const fields = ['id', 'rating', 'userRatingCount'];
      let place;
      if (t.placeId) { place = new Place({ id: t.placeId }); await place.fetchFields({ fields }); }
      else {
        const req = { textQuery: t.query, fields, maxResultCount: 1 };
        if (t.lat != null) req.locationBias = { center: { lat: t.lat, lng: t.lng }, radius: 3000 };
        const r = await Place.searchByText(req); place = r.places && r.places[0];
      }
      return place && place.rating ? { rating: place.rating, count: place.userRatingCount || 0, id: place.id } : null;
    })().catch(() => null));
    return cache.get(k);
  }

  // target: { query: 'Topkapı Palace, Istanbul', placeId?, lat?, lng? }; plain: no link, hidden until a rating is known
  function badge(target, plain) {
    const a = document.createElement(plain ? 'span' : 'a');
    a.className = 'g-rating';
    if (plain) a.hidden = true;
    else { a.target = '_blank'; a.rel = 'noopener'; a.href = target.placeId ? reviewsUrl(target.placeId) : searchUrl(target.query); }
    a.innerHTML = '<span class="g-star" aria-hidden="true">★</span><span class="g-text"></span>';
    a.querySelector('.g-text').textContent = txt()[0];
    if (!key()) return plain ? null : a;
    const fill = () => lookup(target).then(r => {
      if (!r) return;
      const nf = new Intl.NumberFormat(locale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 });
      const cf = new Intl.NumberFormat(locale());
      a.querySelector('.g-text').textContent = nf.format(r.rating) + ' (' + cf.format(r.count) + ') · ' + txt()[0];
      a.setAttribute(plain ? 'title' : 'aria-label', txt()[1].replace('{r}', nf.format(r.rating)).replace('{n}', cf.format(r.count)));
      if (plain) a.hidden = false; else a.href = reviewsUrl(r.id);
    });
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io.disconnect(); fill(); } }, { rootMargin: '150px' });
      // A hidden badge has no size, so watch the card it sits in.
      requestAnimationFrame(() => io.observe(plain ? (a.parentElement || a) : a));
    } else fill();
    return a;
  }

  // Tour companies: one Google listing per company, so every tour of a company shows the company's rating.
  const OPERATORS = {
    'Blue Brothers': { query: 'Blue Brothers Tour, Istanbul' },
    'Orient Bosphorus': { query: 'Orient Bosphorus Dinner Cruise, Istanbul' },
    'Sea & Land': { query: 'Sea & Land Trip, Eminönü, Istanbul' },
    'Azure Tour': { query: 'Azure Turizm, Istanbul' },
    'Alaturka Hamam': { query: 'Alaturka Hamam & Spa, Istanbul' }
  };
  const forOperator = name => (OPERATORS[name] ? badge(OPERATORS[name], true) : null);

  const css = document.createElement('style');
  css.textContent = '.g-rating{display:inline-flex;align-items:center;gap:5px;font:700 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f3b6e;background:#fff;border:1px solid #dfe6f3;border-radius:999px;padding:5px 10px 5px 8px;text-decoration:none;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}.g-rating:hover{border-color:#fbbc04;background:#fffaf0}.g-rating:focus-visible{outline:3px solid #00bed9;outline-offset:2px}.g-star{color:#f4b400;font-size:14px;line-height:1}.g-rating[hidden]{display:none}span.g-rating:hover{border-color:#dfe6f3;background:#fff}';
  document.head.append(css);

  window.BosphorlyRatings = Object.freeze({ badge, forOperator, OPERATORS });
})();
