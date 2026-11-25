/* Optional advertising measurement. Basic consent mode: no Google request before opt-in. */
(() => {
  'use strict';
  if (window.BosphorlyAdsConsent) return;
  const key = 'bosphorly.adsConsent.v1', ttl = 180 * 86400000;
  let choice = null, loaded = false;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && typeof saved.allowed === 'boolean' && Date.now() < saved.expires) choice = saved.allowed;
  } catch {}
  const clearCookies = () => {
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0].trim();
      if (!/^(_gcl_|_ga(?:_|$)|_gid$|_gac_)/.test(name)) continue;
      for (const domain of ['', '; domain=bosphorly.com', '; domain=.bosphorly.com']) {
        document.cookie = name + '=; Max-Age=0; path=/' + domain + '; SameSite=Lax; Secure';
      }
    }
  };
  const load = () => {
    if (loaded || choice !== true) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    function consent() { window.dataLayer.push(arguments); }
    consent('consent', 'default', {ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
    consent('consent', 'update', {ad_storage:'granted',ad_user_data:'granted',ad_personalization:'denied',analytics_storage:'denied'});
    consent('set', 'ads_data_redaction', true);
    window.dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});
    const tag = document.createElement('script');
    tag.async = true; tag.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-WCTCCKD3';
    document.head.append(tag);
  };
  window.BosphorlyAdsConsent = Object.freeze({allowed: () => choice === true});
  if (choice === true) load(); else clearCookies();
  const words = {
    en:['Privacy settings','Optional advertising measurement','With your permission, Google Ads uses cookies and device/advertising identifiers to measure successful booking requests. Data may be processed outside your country. No personalized advertising is enabled. Refusing does not affect booking.','Allow measurement','Reject','Privacy notice'],
    tr:['Gizlilik tercihleri','İsteğe bağlı reklam ölçümü','İzninizle Google Ads, başarılı rezervasyon taleplerini ölçmek için çerezler ve cihaz/reklam tanımlayıcıları kullanır. Veriler ülkeniz dışında işlenebilir. Kişiselleştirilmiş reklam etkin değildir. Reddetmek rezervasyonu etkilemez.','Ölçüme izin ver','Reddet','Gizlilik bildirimi'],
    he:['הגדרות פרטיות','מדידת פרסום אופציונלית','בהסכמתכם Google Ads משתמש בעוגיות ובמזהי מכשיר ופרסום למדידת בקשות הזמנה מוצלחות. הנתונים עשויים להיות מעובדים מחוץ למדינתכם. אין פרסום מותאם אישית. סירוב לא ישפיע על ההזמנה.','אפשר מדידה','דחה','הודעת פרטיות'],
    de:['Datenschutzeinstellungen','Optionale Werbemessung','Mit Ihrer Einwilligung verwendet Google Ads Cookies und Geräte-/Werbe-IDs zur Messung erfolgreicher Buchungsanfragen. Daten können außerhalb Ihres Landes verarbeitet werden. Keine personalisierte Werbung. Ablehnen beeinträchtigt die Buchung nicht.','Messung erlauben','Ablehnen','Datenschutzhinweise'],
    fr:['Paramètres de confidentialité','Mesure publicitaire facultative','Avec votre accord, Google Ads utilise des cookies et des identifiants d’appareil/publicitaires pour mesurer les demandes de réservation réussies. Les données peuvent être traitées hors de votre pays. Pas de publicité personnalisée. Le refus ne change pas la réservation.','Autoriser la mesure','Refuser','Confidentialité'],
    es:['Ajustes de privacidad','Medición publicitaria opcional','Con tu permiso, Google Ads utiliza cookies e identificadores de dispositivo/publicidad para medir solicitudes de reserva exitosas. Los datos pueden tratarse fuera de tu país. Sin publicidad personalizada. Rechazar no afecta la reserva.','Permitir medición','Rechazar','Privacidad'],
    it:['Impostazioni privacy','Misurazione pubblicitaria facoltativa','Con il tuo consenso, Google Ads usa cookie e identificatori di dispositivo/pubblicità per misurare le richieste di prenotazione riuscite. I dati possono essere trattati fuori dal tuo paese. Nessuna pubblicità personalizzata. Il rifiuto non influisce sulla prenotazione.','Consenti misurazione','Rifiuta','Informativa privacy'],
    nl:['Privacy-instellingen','Optionele advertentiemeting','Met je toestemming gebruikt Google Ads cookies en apparaat-/advertentie-ID’s om succesvolle boekingsaanvragen te meten. Gegevens kunnen buiten je land worden verwerkt. Geen gepersonaliseerde advertenties. Weigeren heeft geen invloed op de boeking.','Meting toestaan','Weigeren','Privacyverklaring'],
    ru:['Настройки конфиденциальности','Необязательное измерение рекламы','С вашего согласия Google Ads использует файлы cookie и идентификаторы устройств/рекламы для измерения успешных запросов бронирования. Данные могут обрабатываться за пределами вашей страны. Персонализированная реклама отключена. Отказ не влияет на бронирование.','Разрешить измерение','Отклонить','Конфиденциальность'],
    uk:['Налаштування конфіденційності','Необов’язкове вимірювання реклами','За вашою згодою Google Ads використовує cookie та ідентифікатори пристроїв/реклами для вимірювання успішних запитів бронювання. Дані можуть оброблятися за межами вашої країни. Персоналізована реклама вимкнена. Відмова не впливає на бронювання.','Дозволити вимірювання','Відхилити','Конфіденційність'],
    ar:['إعدادات الخصوصية','قياس الإعلانات اختياري','بموافقتك يستخدم Google Ads ملفات تعريف الارتباط ومعرّفات الأجهزة والإعلانات لقياس طلبات الحجز الناجحة. قد تتم معالجة البيانات خارج بلدك. لا إعلانات مخصصة. الرفض لا يؤثر على الحجز.','السماح بالقياس','رفض','إشعار الخصوصية']
  };
  const start = () => {
    const host = document.createElement('div'); host.id = 'bosphorly-privacy-controls';
    const shadow = host.attachShadow({mode:'open'});
    const css = document.createElement('style');
    css.textContent = ':host{display:block;padding:10px;text-align:center}button,a{font:inherit;color:#164b60}button{cursor:pointer;border:1px solid #69818c;border-radius:7px;background:#fff;padding:9px 13px}section{position:fixed;bottom:12px;left:12px;right:12px;max-width:580px;margin:auto;z-index:2147483000;background:#fff;color:#142d36;border:1px solid #69818c;border-radius:12px;padding:16px;text-align:start;box-shadow:0 5px 28px #0003;font:14px/1.5 system-ui;max-height:80vh;overflow:auto}section[hidden]{display:none}.actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}h2{font-size:17px;margin:0}p{margin:8px 0}';
    const settings = document.createElement('button'); settings.type='button';
    const panel = document.createElement('section'); panel.setAttribute('aria-label','Privacy settings'); panel.hidden = choice !== null;
    const h = document.createElement('h2'), p = document.createElement('p'), actions = document.createElement('div'); actions.className='actions';
    const allow = document.createElement('button'), deny = document.createElement('button'); allow.type=deny.type='button';
    const policy = document.createElement('a'); policy.href='/privacy.html'; actions.append(allow,deny); panel.append(h,p,actions,policy); shadow.append(css,settings,panel); document.body.append(host);
    const update = () => {
      const lang=(document.documentElement.lang || navigator.language || 'en').toLowerCase().split('-')[0], t=words[lang] || words.en;
      [settings.textContent,h.textContent,p.textContent,allow.textContent,deny.textContent,policy.textContent]=t;
      panel.dir=lang==='he'||lang==='ar'?'rtl':'ltr'; panel.setAttribute('aria-label',t[0]);
    };
    update(); new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    settings.onclick=()=>{panel.hidden=!panel.hidden;if(!panel.hidden) allow.focus();};
    const select = allowed => {
      choice=allowed;
      try {localStorage.setItem(key,JSON.stringify({allowed,expires:Date.now()+ttl}));}catch{}
      panel.hidden=true;
      if(allowed) load(); else {
        clearCookies();
        if(loaded) {
          function consent(){window.dataLayer.push(arguments);}
          consent('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});
          location.reload();
        }
      }
    };
    allow.onclick=()=>select(true); deny.onclick=()=>select(false);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
