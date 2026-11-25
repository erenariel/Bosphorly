(() => {
  if (window.bosphorlyAnalyticsReady) return;
  window.bosphorlyAnalyticsReady = true;
  const id = 'G-YGVBPKGXRR';
  const key = 'bosphorly.analytics.preference';
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
  let loaded = false;
  function start() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('consent', 'default', {analytics_storage:'granted', ad_storage:'denied', ad_user_data:'denied', ad_personalization:'denied'});
    gtag('js', new Date());
    gtag('config', id, {
      page_location: location.origin + location.pathname,
      page_referrer: document.referrer ? new URL(document.referrer).origin : '',
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_domain: location.hostname
    });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.append(tag);
  }
  function mount() {
    let choice;
    try { choice = localStorage.getItem(key); } catch {}
    const footer = document.querySelector('footer') || document.body;
    const settings = document.createElement('button');
    const panel = document.createElement('aside');
    const message = document.createElement('span');
    const allow = document.createElement('button');
    const decline = document.createElement('button');
    for (const btn of [settings, allow, decline]) {
      btn.type = 'button';
      btn.style.cssText = 'font:inherit;cursor:pointer;color:#123b48;background:#fff;border:1px solid #78949b;border-radius:8px;padding:.45em .75em;margin:.2em';
    }
    panel.id = 'analytics-choice';
    settings.setAttribute('aria-controls', panel.id);
    panel.style.cssText = 'position:fixed;inset-inline-start:12px;bottom:12px;z-index:9999;max-width:min(350px,calc(100vw - 24px));box-sizing:border-box;background:white;color:#183c49;padding:12px;border:1px solid #a7bdc4;border-radius:12px;font:14px/1.4 system-ui;box-shadow:0 4px 20px #0002';
    message.style.display = 'block';
    const translate = () => {
      const l = labels[document.documentElement.lang.split('-')[0]] || labels.en;
      [message.textContent, allow.textContent, decline.textContent, settings.textContent] = l;
      panel.setAttribute('aria-label', l[3]);
    };
    translate();
    new MutationObserver(translate).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
    panel.append(message, allow, decline);
    document.body.append(panel);
    footer.append(settings);
    panel.hidden = ['yes','no'].includes(choice);
    if (choice === 'yes') start();
    settings.onclick = () => { panel.hidden = false; allow.focus(); };
    function save(next) {
      try { localStorage.setItem(key, next); } catch {}
      panel.hidden = true;
      if (next === 'yes') { window['ga-disable-' + id] = false; start(); }
      else if (loaded) {
        window['ga-disable-' + id] = true;
        for (const part of document.cookie.split(';')) {
          const name = part.trim().split('=')[0];
          if (name === '_ga' || name.startsWith('_ga_')) {
            document.cookie = name + '=; Max-Age=0; Path=/; Domain=' + location.hostname;
          }
        }
      }
    }
    allow.onclick = () => save('yes');
    decline.onclick = () => save('no');
    window.addEventListener('storage', e => {
      if (e.key === key || e.key === null) {
        if (e.newValue === 'yes' && !loaded) { panel.hidden = true; start(); }
        else if (loaded) location.reload();
        else panel.hidden = e.newValue === 'no';
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
