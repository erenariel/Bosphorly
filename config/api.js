// Address of the Bosphorly API (backend/worker.js on Cloudflare Workers), e.g. "https://api.bosphorly.com".
// Leave empty until the API is deployed: membership and coupons then show as "coming soon" and the site
// keeps working with device-only requests.
window.BOSPHORLY_API = Object.freeze({ base: 'https://bosphorly-booking.erennkirazz98.workers.dev', transferMailBase: 'https://bosphorly-transfer-mail.erennkirazz98.workers.dev', turnstileSiteKey: '0x4AAAAAAGLGiuSp0XpkdcLs', telegramBot: 'BosphorlyBot' });

// Lightweight floating assistant button (lazy-loads assistant-chat.js & CSS only when clicked).
(() => {
  const base = document.currentScript && document.currentScript.src
    ? new URL('..', document.currentScript.src).href
    : '';
  const pickLang = () => {
    if (window.BOSPHORLY_LANG_ALT) return (document.documentElement.lang || 'en').slice(0, 2);
    if (window.BosphorlyLang) return window.BosphorlyLang.pick();
    const q = new URLSearchParams(location.search).get('lang');
    return q || (document.documentElement.lang || 'en').slice(0, 2) || 'en';
  };
  const LABELS = { tr:'Asistana sor', en:'Ask assistant', ru:'Спросить ассистента', uk:'Запитати асистента', de:'Assistent fragen', fr:'Demander à l’assistant', nl:'Vraag assistent', ar:'اسأل المساعد', he:'שאל את העוזר', az:'Köməkçidən soruş', fa:'از دستیار بپرسید', es:'Preguntar al asistente', it:'Chiedi all’assistente', pt:'Perguntar ao assistente', hr:'Pitaj asistenta', hu:'Kérdezz az asszisztenstől', bs:'Pitaj asistenta', zh:'咨询助手', ja:'アシスタントに質問', ko:'도우미에게 질문', hi:'सहायक से पूछें', bn:'সহায়ককে জিজ্ঞাসা করুন', id:'Tanya asisten' };
  const mountFab = () => {
    if (!document.body || document.querySelector('.bc-fab')) return;
    const lang = pickLang();
    const rtl = ['ar', 'he', 'fa'].includes(lang);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bc-fab';
    btn.setAttribute('aria-label', LABELS[lang] || LABELS.en);
    btn.title = LABELS[lang] || LABELS.en;
    btn.textContent = '💬';
    btn.style.cssText = 'position:fixed;bottom:16px;' + (rtl ? 'left:16px;' : 'right:16px;') + 'z-index:940;width:50px;height:50px;border-radius:50%;border:0;background:#0a1753;color:#fff;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 8px 24px rgba(10,23,83,.28)';
    let loaded = false;
    btn.addEventListener('click', () => {
      if (window.__bosphorlyChatToggle) { window.__bosphorlyChatToggle(); return; }
      if (loaded) return;
      loaded = true;
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = base + 'assistant-chat.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = base + 'assistant-chat.js';
      js.defer = true;
      document.body.appendChild(js);
    });
    document.body.appendChild(btn);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountFab); else mountFab();
})();
