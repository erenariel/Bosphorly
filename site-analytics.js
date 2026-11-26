(() => {
  if (window.bosphorlyAnalyticsReady) return;
  window.bosphorlyAnalyticsReady = true;
  const id = 'G-YGVBPKGXRR';
  const key = 'bosphorly.analytics.preference.v2';
  const legacyKey = 'bosphorly.analytics.preference';
  const container = 'GTM-WCTCCKD3';
  const labels = {
    en: ['Allow Google Analytics cookies to measure visits?', 'Allow', 'Decline', 'Analytics settings'],
    tr: ['Ziyaretleri ölçmek için Google Analytics çerezlerine izin veriyor musun?', 'İzin ver', 'Reddet', 'Analiz tercihleri'],
    he: ['לאפשר עוגיות Google Analytics למדידת ביקורים?', 'אישור', 'דחייה', 'העדפות מדידה'],
    ar: ['هل تسمح بملفات تعريف ارتباط Google Analytics لقياس الزيارات؟', 'السماح', 'رفض', 'إعدادات التحليلات'],
    ru: ['Разрешить Google Analytics использовать файлы cookie для подсчёта посещений?', 'Разрешить', 'Отклонить', 'Настройки аналитики'],
    uk: ['Дозволити файли cookie Google Analytics для вимірювання відвідувань?', 'Дозволити', 'Відхилити', 'Налаштування аналітики'],
    fr: ['Autoriser les cookies Google Analytics pour mesurer les visites ?', 'Autoriser', 'Refuser', 'Préférences de mesure'],
    de: ['Google-Analytics-Cookies zur Besuchsmessung zulassen?', 'Zulassen', 'Ablehnen', 'Analyse-Einstellungen'],
    nl: ['Google Analytics-cookies toestaan om bezoeken te meten?', 'Toestaan', 'Weigeren', 'Analyse-instellingen'],
    es: ['¿Permitir cookies de Google Analytics para medir visitas?', 'Permitir', 'Rechazar', 'Preferencias de analítica'],
    it: ['Consentire i cookie di Google Analytics per misurare le visite?', 'Consenti', 'Rifiuta', 'Preferenze di analisi'],
    pt: ['Permitir cookies do Google Analytics para medir visitas?', 'Permitir', 'Recusar', 'Preferências de análise'],
    az: ['Ziyarətləri ölçmək üçün Google Analytics kukilərinə icazə verilsin?', 'İcazə ver', 'Rədd et', 'Analitika ayarları'],
    fa: ['کوکی‌های Google Analytics برای سنجش بازدیدها فعال شوند؟', 'اجازه می‌دهم', 'رد', 'تنظیمات آمار'],
    hr: ['Dopuštate li kolačiće Google Analyticsa za mjerenje posjeta?', 'Dopusti', 'Odbij', 'Postavke analitike'],
    hu: ['Engedélyezed a Google Analytics sütiket a látogatások méréséhez?', 'Engedélyezem', 'Elutasítom', 'Analitikai beállítások'],
    bs: ['Dozvoljavate li kolačiće Google Analyticsa za mjerenje posjeta?', 'Dozvoli', 'Odbij', 'Postavke analitike'],
    zh: ['允许使用 Google Analytics Cookie 统计访问量吗？', '允许', '拒绝', '统计设置'],
    ja: ['訪問数を計測するための Google Analytics の Cookie を許可しますか？', '許可する', '拒否する', 'アクセス解析の設定'],
    ko: ['방문 측정을 위한 Google 애널리틱스 쿠키를 허용할까요?', '허용', '거부', '분석 설정'],
    hi: ['क्या विज़िट मापने के लिए Google Analytics कुकी की अनुमति है?', 'अनुमति दें', 'अस्वीकार करें', 'विश्लेषण सेटिंग'],
    bn: ['ভিজিট পরিমাপের জন্য Google Analytics কুকি ব্যবহার করতে দেবেন?', 'অনুমতি দিন', 'প্রত্যাখ্যান', 'বিশ্লেষণ সেটিংস'],
    id: ['Izinkan cookie Google Analytics untuk mengukur kunjungan?', 'Izinkan', 'Tolak', 'Pengaturan analitik']
  };
  const adLabels = {
  "en": [
    "Also allow Google Ads measurement of successful requests (cookies and advertising identifiers; no personalized ads).",
    "Allow analytics + ad measurement"
  ],
  "tr": [
    "Başarılı talepler için Google Ads ölçümüne de izin ver (çerezler ve reklam tanımlayıcıları; kişiselleştirilmiş reklam yok).",
    "Analiz + reklam ölçümüne izin ver"
  ],
  "he": [
    "לאפשר גם מדידת בקשות מוצלחות ב-Google Ads (עוגיות ומזהי פרסום; ללא פרסום מותאם אישית).",
    "אפשר ניתוח ומדידת פרסום"
  ],
  "ar": [
    "السماح أيضًا بقياس الطلبات الناجحة عبر Google Ads (ملفات تعريف الارتباط ومعرفات الإعلانات، دون إعلانات مخصصة).",
    "السماح بالتحليلات وقياس الإعلانات"
  ],
  "ru": [
    "Также разрешить измерение успешных заявок в Google Ads (cookie и рекламные идентификаторы, без персонализированной рекламы).",
    "Разрешить аналитику и измерение рекламы"
  ],
  "uk": [
    "Також дозволити вимірювання успішних заявок у Google Ads (cookie та рекламні ідентифікатори, без персоналізованої реклами).",
    "Дозволити аналітику та вимірювання реклами"
  ],
  "fr": [
    "Autoriser aussi la mesure des demandes réussies par Google Ads (cookies et identifiants publicitaires, sans publicité personnalisée).",
    "Autoriser analyse et mesure publicitaire"
  ],
  "de": [
    "Auch erfolgreiche Anfragen mit Google Ads messen (Cookies und Werbe-IDs, keine personalisierte Werbung).",
    "Analyse und Werbemessung erlauben"
  ],
  "nl": [
    "Ook succesvolle aanvragen meten met Google Ads (cookies en advertentie-ID’s, geen gepersonaliseerde advertenties).",
    "Analyse en advertentiemeting toestaan"
  ],
  "es": [
    "Permitir también medir solicitudes exitosas con Google Ads (cookies e identificadores publicitarios, sin anuncios personalizados).",
    "Permitir análisis y medición publicitaria"
  ],
  "it": [
    "Consentire anche la misurazione delle richieste riuscite con Google Ads (cookie e identificativi pubblicitari, senza annunci personalizzati).",
    "Consenti analisi e misurazione pubblicitaria"
  ],
  "pt": [
    "Permitir também medir pedidos bem-sucedidos com Google Ads (cookies e identificadores publicitários, sem anúncios personalizados).",
    "Permitir análise e medição publicitária"
  ],
  "az": [
    "Uğurlu sorğuları Google Ads ilə ölçməyə də icazə ver (kukilər və reklam identifikatorları; fərdiləşdirilmiş reklam yoxdur).",
    "Analitika və reklam ölçümünə icazə ver"
  ],
  "fa": [
    "اندازه‌گیری درخواست‌های موفق با Google Ads نیز مجاز باشد (کوکی‌ها و شناسه‌های تبلیغاتی؛ بدون تبلیغات شخصی‌سازی‌شده).",
    "اجازه تحلیل و اندازه‌گیری تبلیغات"
  ],
  "hr": [
    "Dopusti i mjerenje uspješnih zahtjeva putem Google Adsa (kolačići i oglasni identifikatori; bez personaliziranih oglasa).",
    "Dopusti analitiku i mjerenje oglasa"
  ],
  "hu": [
    "A sikeres kérések Google Ads-mérésének engedélyezése is (sütik és hirdetési azonosítók; személyre szabott hirdetések nélkül).",
    "Elemzés és hirdetésmérés engedélyezése"
  ],
  "bs": [
    "Dopusti i mjerenje uspješnih zahtjeva putem Google Adsa (kolačići i identifikatori oglasa; bez personaliziranih oglasa).",
    "Dopusti analitiku i mjerenje oglasa"
  ],
  "zh": [
    "同时允许 Google Ads 衡量成功请求（Cookie 和广告标识符；不启用个性化广告）。",
    "允许分析和广告衡量"
  ],
  "ja": [
    "Google Ads による成功したリクエストの測定も許可する（Cookie と広告識別子、パーソナライズ広告なし）。",
    "分析と広告測定を許可"
  ],
  "ko": [
    "Google Ads의 성공한 요청 측정도 허용합니다(쿠키 및 광고 식별자, 개인 맞춤 광고 없음).",
    "분석 및 광고 측정 허용"
  ],
  "hi": [
    "Google Ads से सफल अनुरोधों का मापन भी अनुमति दें (कुकी और विज्ञापन पहचानकर्ता; वैयक्तिकृत विज्ञापन नहीं)।",
    "विश्लेषण और विज्ञापन मापन की अनुमति"
  ],
  "bn": [
    "Google Ads দিয়ে সফল অনুরোধের পরিমাপও অনুমোদন করুন (কুকি ও বিজ্ঞাপন শনাক্তকারী; ব্যক্তিগতকৃত বিজ্ঞাপন নয়)।",
    "বিশ্লেষণ ও বিজ্ঞাপন পরিমাপ অনুমোদন"
  ],
  "id": [
    "Izinkan juga pengukuran permintaan berhasil melalui Google Ads (cookie dan pengenal iklan; tanpa iklan yang dipersonalisasi).",
    "Izinkan analitik dan pengukuran iklan"
  ]
};
  let mode = 'no', loaded = false;
  const send = function () { window.dataLayer.push(arguments); };
  const consent = (analytics, ads) => ({
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: ads ? 'granted' : 'denied',
    ad_user_data: ads ? 'granted' : 'denied',
    ad_personalization: 'denied'
  });
  function clearCookies(adsOnly = false) {
    for (const part of document.cookie.split(';')) {
      const name = part.trim().split('=')[0];
      if (!(adsOnly ? /^(_gcl_|_gac_)/ : /^(_gcl_|_gac_|_ga(?:_|$)|_gid$)/).test(name)) continue;
      for (const domain of ['', '; Domain=' + location.hostname, '; Domain=.' + location.hostname]) {
        document.cookie = name + '=; Max-Age=0; Path=/' + domain + '; SameSite=Lax; Secure';
      }
    }
  }
  function start(choice) {
    if (loaded || !['analytics','both'].includes(choice)) return;
    loaded = true;
    mode = choice;
    const ads = choice === 'both';
    window.dataLayer = window.dataLayer || [];
    send('consent', 'default', consent(false, false));
    send('consent', 'update', consent(true, ads));
    send('set', 'allow_google_signals', false);
    send('set', 'allow_ad_personalization_signals', false);
    send('set', 'ads_data_redaction', true);
    const safeLocation = location.origin + location.pathname;
    const safeReferrer = document.referrer ? new URL(document.referrer).origin : '';
    send('set', 'page_location', safeLocation);
    send('set', 'page_referrer', safeReferrer);
    const tag = document.createElement('script');
    tag.async = true;
    if (ads) {
      // The published container owns GA4 and Ads; never load a second GA4 config.
      window.dataLayer.push({'gtm.start': Date.now(), event: 'gtm.js'});
      tag.src = 'https://www.googletagmanager.com/gtm.js?id=' + container;
    } else {
      clearCookies(true);
      send('js', new Date());
      send('config', id, {page_location: safeLocation, page_referrer: safeReferrer,
        allow_google_signals: false, allow_ad_personalization_signals: false, cookie_domain: location.hostname});
      tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    }
    document.head.append(tag);
  }
  window.BosphorlyMeasurement = Object.freeze({
    acceptedRequest() {
      if (!loaded || mode === 'no') return;
      if (mode === 'both') window.dataLayer.push({event: 'bosphorly_booking_request_accepted'});
      else send('event', 'generate_lead', {send_to: id});
    }
  });
  function mount() {
    let choice, legacy;
    try { choice = localStorage.getItem(key); legacy = localStorage.getItem(legacyKey); } catch {}
    const valid = ['analytics','both','no'].includes(choice);
    const initial = valid ? choice : legacy === 'yes' ? 'analytics' : 'no';
    const footer = document.querySelector('footer') || document.body;
    const settings = document.createElement('button');
    const panel = document.createElement('aside');
    const message = document.createElement('span');
    const adsMessage = document.createElement('span');
    const allow = document.createElement('button');
    const both = document.createElement('button');
    const decline = document.createElement('button');
    for (const btn of [settings, allow, both, decline]) {
      btn.type = 'button';
      btn.style.cssText = 'font:inherit;cursor:pointer;color:#123b48;background:#fff;border:1px solid #78949b;border-radius:8px;padding:.45em .75em;margin:.2em';
    }
    panel.id = 'analytics-choice';
    settings.setAttribute('aria-controls', panel.id);
    panel.style.cssText = 'position:fixed;inset-inline-start:12px;bottom:12px;z-index:9999;max-width:min(350px,calc(100vw - 24px));max-height:80vh;overflow:auto;box-sizing:border-box;background:white;color:#183c49;padding:12px;border:1px solid #a7bdc4;border-radius:12px;font:14px/1.4 system-ui;box-shadow:0 4px 20px #0002';
    message.style.display = adsMessage.style.display = 'block';
    const translate = () => {
      const code = document.documentElement.lang.split('-')[0];
      const l = labels[code] || labels.en;
      [message.textContent, allow.textContent, decline.textContent, settings.textContent] = l;
      [adsMessage.textContent, both.textContent] = adLabels[code] || adLabels.en;
      panel.setAttribute('aria-label', l[3]);
    };
    translate();
    new MutationObserver(translate).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
    panel.append(message, allow, adsMessage, both, decline);
    document.body.append(panel);
    footer.append(settings);
    panel.hidden = valid || legacy === 'no';
    if (initial !== 'no') start(initial); else clearCookies();
    settings.onclick = () => { panel.hidden = false; allow.focus(); };
    function save(next) {
      let persisted = false;
      try { localStorage.setItem(key, next); localStorage.removeItem(legacyKey); persisted = localStorage.getItem(key) === next; } catch {}
      panel.hidden = true;
      if (loaded && next !== mode) {
        mode = 'no';
        window['ga-disable-' + id] = true;
        send('consent', 'update', consent(false, false));
        clearCookies();
        // Switching loaders requires a clean page; do not start a second one.
        if (persisted) location.reload();
        return;
      }
      if (next !== 'no') start(next); else clearCookies();
    }
    allow.onclick = () => save('analytics');
    both.onclick = () => save('both');
    decline.onclick = () => save('no');
    window.addEventListener('storage', e => {
      if (e.key !== key && e.key !== legacyKey && e.key !== null) return;
      if (loaded) {
        mode = 'no';
        window['ga-disable-' + id] = true;
        send('consent', 'update', consent(false, false));
        clearCookies();
      }
      location.reload();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
