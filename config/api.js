// Address of the Bosphorly API (backend/worker.js on Cloudflare Workers), e.g. "https://api.bosphorly.com".
// Leave empty until the API is deployed: membership and coupons then show as "coming soon" and the site
// keeps working with device-only requests.
window.BOSPHORLY_API = Object.freeze({ base: 'https://bosphorly-booking.erennkirazz98.workers.dev', transferMailBase: 'https://bosphorly-transfer-mail.erennkirazz98.workers.dev', turnstileSiteKey: '0x4AAAAAAGLGiuSp0XpkdcLs', telegramBot: 'BosphorlyBot' });

// Lightweight floating Mimo assistant button + non-intrusive greeting bubble (lazy-loads assistant-chat.js & CSS when opened).
(() => {
  const base = document.currentScript && document.currentScript.src
    ? new URL('..', document.currentScript.src).href
    : '';
  const pickLang = () => {
    if (window.BOSPHORLY_LANG_ALT) return (document.documentElement.lang || 'en').slice(0, 2);
    if (window.BosphorlyLang) return window.BosphorlyLang.pick();
    const q = new URLSearchParams(location.search).get('lang');
    if (q) return q.slice(0, 2);
    try { const s = localStorage.getItem('bosphorly.language'); if (s) return s.slice(0, 2); } catch {}
    return (document.documentElement.lang || 'en').slice(0, 2) || 'en';
  };
  const LABELS = { tr:'Mimo’ya sor · İstanbul asistanın', en:'Ask Mimo · Your Istanbul assistant', ru:'Спросить Mimo · Твой ассистент по Стамбулу', uk:'Запитати Mimo · Твій асистент у Стамбулі', de:'Mimo fragen · Dein Istanbul-Assistent', fr:'Demander à Mimo · Ton assistant Istanbul', nl:'Vraag Mimo · Je Istanbul-assistent', ar:'اسأل Mimo · مساعدك في إسطنبول', he:'שאל את Mimo · העוזר שלך באיסטנבול', az:'Mimo-dan soruş · İstanbul köməkçin', fa:'از Mimo بپرس · دستیار استانبول تو', es:'Preguntar a Mimo · Tu asistente de Estambul', it:'Chiedi a Mimo · Il tuo assistente per Istanbul', pt:'Perguntar ao Mimo · Seu assistente em Istambul', hr:'Pitaj Mima · Tvoj Istanbul asistent', hu:'Kérdezd Mimót · Isztambuli asszisztensed', bs:'Pitaj Mima · Tvoj Istanbul asistent', zh:'咨询 Mimo · 你的伊斯坦布尔助手', ja:'Mimoに質問 · イスタンブール案内アシスタント', ko:'Mimo에게 질문 · 나의 이스탄불 도우미', hi:'Mimo से पूछो · तुम्हारा इस्तांबुल सहायक', bn:'Mimo-কে জিজ্ঞাসা করো · তোমার ইস্তাম্বুল সহায়ক', id:'Tanya Mimo · Asisten Istanbul kamu' };
  const BUBBLE_GREET = { tr:'Merhaba, ben Mimo 👋 İstanbul’da sana nasıl yardım edebilirim?', en:'Hi, I’m Mimo 👋 How can I help you in Istanbul?', ru:'Привет, я Mimo 👋 Чем помочь тебе в Стамбуле?', uk:'Привіт, я Mimo 👋 Чим допомогти тобі у Стамбулі?', de:'Hallo, ich bin Mimo 👋 Wie kann ich dir in Istanbul helfen?', fr:'Salut, je suis Mimo 👋 Comment t’aider à Istanbul ?', nl:'Hoi, ik ben Mimo 👋 Hoe kan ik je helpen in Istanbul?', ar:'مرحبًا، أنا Mimo 👋 كيف يمكنني مساعدتك في إسطنبول؟', he:'היי, אני Mimo 👋 איך אוכל לעזור לך באיסטנבול?', az:'Salam, mən Mimo 👋 İstanbulda sənə necə kömək edə bilərəm?', fa:'سلام، من Mimo هستم 👋 در استانبول چطور کمکت کنم؟', es:'Hola, soy Mimo 👋 ¿Cómo puedo ayudarte en Estambul?', it:'Ciao, sono Mimo 👋 Come posso aiutarti a Istanbul?', pt:'Oi, sou Mimo 👋 Como posso ajudar você em Istambul?', hr:'Bok, ja sam Mimo 👋 Kako ti mogu pomoći u Istanbulu?', hu:'Szia, Mimo vagyok 👋 Miben segíthetek Isztambulban?', bs:'Ćao, ja sam Mimo 👋 Kako ti mogu pomoći u Istanbulu?', zh:'你好，我是 Mimo 👋 在伊斯坦布尔有什么可以帮你？', ja:'こんにちは、Mimoだよ 👋 イスタンブールで何かお手伝いしようか？', ko:'안녕, Mimo예요 👋 이스탄불에서 무엇을 도와줄까요?', hi:'नमस्ते, मैं Mimo हूँ 👋 इस्तांबुल में मैं तुम्हारी कैसे मदद कर सकता हूँ?', bn:'হ্যালো, আমি Mimo 👋 ইস্তাম্বুলে তোমাকে কীভাবে সাহায্য করতে পারি?', id:'Halo, aku Mimo 👋 Ada yang bisa aku bantu di Istanbul?' };
  const MEMBER_GREET = { tr:'Tekrar hoş geldin, {name} 💙', en:'Welcome back, {name} 💙', ru:'С возвращением, {name} 💙', uk:'З поверненням, {name} 💙', de:'Willkommen zurück, {name} 💙', fr:'Bon retour, {name} 💙', nl:'Welkom terug, {name} 💙', ar:'أهلاً بعودتك، {name} 💙', he:'ברוך שובך, {name} 💙', az:'Yenidən xoş gəldin, {name} 💙', fa:'خوش برگشتی، {name} 💙', es:'Bienvenido de nuevo, {name} 💙', it:'Bentornato, {name} 💙', pt:'Bem-vindo de volta, {name} 💙', hr:'Dobro došao natrag, {name} 💙', hu:'Üdv újra itt, {name} 💙', bs:'Dobro došao nazad, {name} 💙', zh:'欢迎回来，{name} 💙', ja:'おかえりなさい、{name} 💙', ko:'다시 오신 것을 환영해요, {name} 💙', hi:'वापसी पर स्वागत है, {name} 💙', bn:'ফিরে আসার জন্য স্বাগতম, {name} 💙', id:'Selamat datang kembali, {name} 💙' };
  const Q_TRANSFER = { tr:'✈️ Havalimanı transferi', en:'✈️ Airport transfer', ru:'✈️ Трансфер из аэропорта', uk:'✈️ Трансфер з аеропорту', de:'✈️ Flughafentransfer', fr:'✈️ Transfert aéroport', nl:'✈️ Luchthaventransfer', ar:'✈️ النقل من المطار', he:'✈️ הסעה משדה התעופה', az:'✈️ Hava limanı transferi', fa:'✈️ ترانسفر فرودگاه', es:'✈️ Traslado aeropuerto', it:'✈️ Transfer aeroporto', pt:'✈️ Traslado aeroporto', hr:'✈️ Prijevoz s aerodroma', hu:'✈️ Reptéri transzfer', bs:'✈️ Transfer s aerodroma', zh:'✈️ 机场接送', ja:'✈️ 空港送迎', ko:'✈️ 공항 픽업', hi:'✈️ एयरपोर्ट ट्रांसफ़र', bn:'✈️ এয়ারপোর্ট ট্রান্সফার', id:'✈️ Transfer bandara' };
  const Q_CRUISE = { tr:'⛵ Boğaz turu', en:'⛵ Bosphorus cruise', ru:'⛵ Круиз по Босфору', uk:'⛵ Круїз Босфором', de:'⛵ Bosporus-Fahrt', fr:'⛵ Croisière Bosphore', nl:'⛵ Bosporuscruise', ar:'⛵ جولة البوسفور', he:'⛵ שייט בבוספורוס', az:'⛵ Boğaz turu', fa:'⛵ کروز بسفر', es:'⛵ Crucero Bósforo', it:'⛵ Crociera Bosforo', pt:'⛵ Cruzeiro Bósforo', hr:'⛵ Krstarenje Bosporom', hu:'⛵ Boszporuszi hajóút', bs:'⛵ Krstarenje Bosporom', zh:'⛵ 博斯普鲁斯游船', ja:'⛵ ボスポラスクルーズ', ko:'⛵ 보스포루스 크루즈', hi:'⛵ बोस्फोरस क्रूज़', bn:'⛵ বসফরাস ক্রুজ', id:'⛵ Pelayaran Bosphorus' };
  const CLOSE_LBL = { tr:'Kapat', en:'Close', ru:'Закрыть', uk:'Закрити', de:'Schließen', fr:'Fermer', nl:'Sluiten', ar:'إغلاق', he:'סגור', az:'Bağla', fa:'بستن', es:'Cerrar', it:'Chiudi', pt:'Fechar', hr:'Zatvori', hu:'Bezárás', bs:'Zatvori', zh:'关闭', ja:'閉じる', ko:'닫기', hi:'बंद करें', bn:'বন্ধ করুন', id:'Tutup' };

  const BUBBLE_KEY = 'bosphorly.mimo_greeted';
  const hasSeenBubble = () => {
    try { return sessionStorage.getItem(BUBBLE_KEY) === '1'; } catch { return true; }
  };
  const markBubbleSeen = () => {
    try { sessionStorage.setItem(BUBBLE_KEY, '1'); } catch {}
  };

  const getSignedInMemberName = () => {
    try {
      const M = window.BosphorlyMember;
      const signedIn = M ? M.signedIn() : !!(window.BOSPHORLY_API && window.BOSPHORLY_API.base && localStorage.getItem('bosphorly.session'));
      if (!signedIn) return '';
      const prof = (M && M.cachedProfile && M.cachedProfile()) || JSON.parse(localStorage.getItem('bosphorly.member_cache') || 'null');
      const acct = (window.BosphorlyAccount && window.BosphorlyAccount.profile && window.BosphorlyAccount.profile()) || null;
      const raw = (prof && prof.name) || (acct && acct.name) || '';
      return String(raw || '').trim();
    } catch {
      return '';
    }
  };

  const injectFabStyles = () => {
    if (document.getElementById('bc-fab-styles')) return;
    const st = document.createElement('style');
    st.id = 'bc-fab-styles';
    st.textContent =
      '@keyframes bc-mimo-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.92)}}' +
      '.bc-fab{position:fixed;bottom:16px;right:16px;z-index:940;width:54px;height:54px;padding:3px;border-radius:50%;border:2px solid #ffd565;background:#0a1753;color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(10,23,83,.32);display:grid;place-items:center;transition:transform .2s}' +
      '.bc-launcher{display:contents}.bc-launcher-label{display:none}body.bc-chat-open .bc-launcher{display:none}' +
      '@media(min-width:1024px){.bc-launcher{position:fixed;bottom:16px;right:16px;z-index:940;display:flex;align-items:center;gap:8px}.bc-launcher .bc-fab{position:static;box-sizing:border-box;width:76px;height:76px}.bc-launcher .bc-fab-avatar{width:62px;height:62px}.bc-launcher-label{display:block;cursor:pointer;border-radius:999px;padding:8px 12px;background:#0a1753;color:#fff;font:600 14px/1.3 system-ui;box-shadow:0 4px 16px #0a175333}.bc-bubble,.bc-bubble[dir="rtl"]{bottom:102px;right:16px;left:auto}}' +
      '.bc-fab:hover{transform:scale(1.05)}' +
      '.bc-fab[dir="rtl"]{right:auto;left:16px}' +
      '.bc-fab-avatar{width:44px;height:44px;display:block;border-radius:50%;animation:bc-mimo-blink 5.5s ease-in-out infinite;transform-origin:center 48%}' +
      '.bc-bubble{position:fixed;bottom:18px;right:78px;z-index:939;max-width:320px;background:#fff;color:#111d35;border:1.5px solid #ffd565;border-radius:16px;box-shadow:0 12px 32px rgba(10,23,83,.2);padding:11px 13px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:13px;line-height:1.4;box-sizing:border-box}' +
      '.bc-bubble[dir="rtl"]{right:auto;left:78px;text-align:right}' +
      '.bc-bubble[hidden]{display:none!important}' +
      '.bc-bubble-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}' +
      '.bc-bubble-text{cursor:pointer;font-weight:600;color:#0a1753}' +
      '.bc-bubble-close{background:transparent;border:0;color:#5d6f8a;font-size:16px;line-height:1;padding:0 2px;cursor:pointer;flex-shrink:0}' +
      '.bc-bubble-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
      '.bc-bubble-chip{background:#f0f5ff;border:1px solid #c9daf6;color:#0a1753;border-radius:999px;padding:4px 10px;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap}' +
      '.bc-bubble-chip:hover{background:#e1ecff}' +
      '@media(max-width:480px){' +
      'body.bc-chat-open .bc-fab,body.bc-chat-open .bc-bubble{display:none!important}' +
      '}' +
      '@media(max-width:768px){' +
      '.bc-bubble{bottom:auto;top:64px;right:12px;left:12px;max-width:calc(100vw - 24px);padding:6px 10px;border-radius:999px;display:flex;align-items:center;justify-content:space-between;gap:6px;white-space:nowrap;overflow:hidden}' +
      '.bc-bubble[dir="rtl"]{right:12px;left:12px}' +
      '.bc-bubble-top{display:flex;align-items:center;gap:6px;min-width:0;flex:1;overflow:hidden}' +
      '.bc-bubble-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}' +
      '.bc-bubble-chips{margin-top:0;flex-wrap:nowrap;gap:4px;flex-shrink:0}' +
      '.bc-bubble-chip{padding:3px 8px;font-size:11px}' +
      '}' +
      '@media(prefers-color-scheme:dark){' +
      '.bc-bubble{background:#111d3e;color:#e8eefc;border-color:#ffd565}' +
      '.bc-bubble-text{color:#f2f6ff}' +
      '.bc-bubble-close{color:#a9bad8}' +
      '.bc-bubble-chip{background:#1b2c5e;border-color:#344c8c;color:#e8eefc}' +
      '.bc-bubble-chip:hover{background:#243a78}' +
      '}' +
      '@media(prefers-reduced-motion:reduce){' +
      '.bc-fab,.bc-fab-avatar,.bc-bubble{animation:none!important;transition:none!important;transform:none!important}' +
      '}';
    document.head.appendChild(st);
  };

  const mountFab = () => {
    if (!document.body || document.querySelector('.bc-fab')) return;
    injectFabStyles();
    const lang = pickLang();
    const rtl = ['ar', 'he', 'fa'].includes(lang);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bc-fab';
    if (rtl) btn.setAttribute('dir', 'rtl');
    btn.setAttribute('aria-label', LABELS[lang] || LABELS.en);
    btn.title = LABELS[lang] || LABELS.en;

    const avatar = document.createElement('img');
    avatar.className = 'bc-fab-avatar';
    avatar.src = base + 'assets/brand/mimo/mimo-default.svg';
    avatar.alt = 'Mimo';
    avatar.width = 44;
    avatar.height = 44;
    avatar.decoding = 'async';
    btn.appendChild(avatar);

    const bubble = document.createElement('aside');
    bubble.className = 'bc-bubble';
    bubble.setAttribute('aria-live', 'polite');
    if (rtl) bubble.setAttribute('dir', 'rtl');
    bubble.hidden = true;

    const buildBubbleText = () => {
      const l = pickLang();
      const mName = getSignedInMemberName();
      const greet = BUBBLE_GREET[l] || BUBBLE_GREET.en;
      if (mName) {
        const wb = (MEMBER_GREET[l] || MEMBER_GREET.en).replace('{name}', mName);
        return wb + ' · ' + greet;
      }
      return greet;
    };

    bubble.innerHTML =
      `<div class="bc-bubble-top"><span class="bc-bubble-text"></span>` +
      `<button type="button" class="bc-bubble-close" aria-label="${CLOSE_LBL[lang] || CLOSE_LBL.en}">×</button></div>` +
      `<div class="bc-bubble-chips">` +
      `<button type="button" class="bc-bubble-chip" data-q="transfer">${Q_TRANSFER[lang] || Q_TRANSFER.en}</button>` +
      `<button type="button" class="bc-bubble-chip" data-q="cruise">${Q_CRUISE[lang] || Q_CRUISE.en}</button>` +
      `</div>`;

    const bubbleTextEl = bubble.querySelector('.bc-bubble-text');
    bubbleTextEl.textContent = buildBubbleText();

    let collapseTimer = null;
    const hideBubble = (markSeen = true) => {
      if (collapseTimer) { clearTimeout(collapseTimer); collapseTimer = null; }
      bubble.hidden = true;
      if (markSeen) markBubbleSeen();
    };

    const ensureSafeMobilePosition = () => {
      if (bubble.hidden) return;
      if (window.innerWidth > 768) {
        bubble.style.top = '';
        bubble.style.bottom = '';
        return;
      }
      bubble.style.bottom = 'auto';
      bubble.style.top = '64px';
      const targets = document.querySelectorAll('#toStep2, #toStep3, #submitDemo, #submit, .tf-send, #reservation-form input:focus, #bookingForm input:focus');
      const bRect = bubble.getBoundingClientRect();
      for (const t of targets) {
        const r = t.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const overlaps = bRect.left < r.right && bRect.right > r.left && bRect.top < r.bottom && bRect.bottom > r.top;
        if (overlaps) {
          if (r.top > 70) {
            bubble.style.top = Math.max(8, Math.floor(r.top - bRect.height - 8)) + 'px';
          } else {
            bubble.style.top = Math.min(window.innerHeight - bRect.height - 76, Math.ceil(r.bottom + 8)) + 'px';
          }
          break;
        }
      }
    };

    let loaded = false;
    let pendingQuestion = '';
    const openChatPanel = (questionToSend = '') => {
      hideBubble(true);
      if (questionToSend) pendingQuestion = questionToSend;
      if (window.__bosphorlyChatOpen) {
        window.__bosphorlyChatOpen(pendingQuestion);
        pendingQuestion = '';
        return;
      }
      if (window.__bosphorlyChatToggle) {
        window.__bosphorlyChatToggle();
        if (pendingQuestion && window.__bosphorlyChatAsk) {
          window.__bosphorlyChatAsk(pendingQuestion);
          pendingQuestion = '';
        }
        return;
      }
      if (loaded) return;
      loaded = true;
      if ( pendingQuestion ) window.__bosphorlyInitialQuestion = pendingQuestion;
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = base + 'assistant-chat.css?v=20261123e';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = base + 'assistant-chat.js?v=20261123e';
      js.defer = true;
      document.body.appendChild(js);
    };

    window.__bosphorlyOpenMimo = (q = '') => openChatPanel(q);

    btn.addEventListener('click', () => {
      if (window.__bosphorlyChatToggle) {
        hideBubble(true);
        window.__bosphorlyChatToggle();
        return;
      }
      openChatPanel('');
    });

    bubbleTextEl.addEventListener('click', () => openChatPanel(''));
    bubble.querySelector('.bc-bubble-close').addEventListener('click', (e) => {
      e.stopPropagation();
      hideBubble(true);
    });
    bubble.querySelectorAll('.bc-bubble-chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        openChatPanel(chip.textContent.trim());
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !bubble.hidden) {
        hideBubble(true);
      }
    });

    let formInteracted = false;
    const isFormField = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !el.closest('.bc-panel');
    document.addEventListener('focusin', (e) => {
      if (isFormField(e.target)) {
        formInteracted = true;
        if (!bubble.hidden) bubble.hidden = true;
      }
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        if (window.visualViewport.height < window.innerHeight * 0.78 && !bubble.hidden) {
          bubble.hidden = true;
        }
      });
    }
    window.addEventListener('scroll', ensureSafeMobilePosition, { passive: true });
    window.addEventListener('resize', ensureSafeMobilePosition, { passive: true });

    document.body.appendChild(bubble);
    const launcher = document.createElement('div');
    launcher.className = 'bc-launcher';
    launcher.dir = rtl ? 'rtl' : 'ltr';
    launcher.lang = lang;
    btn.id = 'bc-launch-button';
    const label = document.createElement('label');
    label.htmlFor = btn.id;
    label.className = 'bc-launcher-label';
    label.textContent = btn.title.split(' · ')[0] + ' 💬';
    launcher.append(btn, label);
    document.body.appendChild(launcher);

    const mobile = matchMedia('(max-width: 1023.98px)');
    if (mobile.matches) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.media = mobile.media;
      css.href = base + 'mimo-intro.css?v=20261123c';
      document.head.appendChild(css);
      const script = document.createElement('script');
      script.src = base + 'mimo-intro.js?v=20261123c';
      script.defer = true;
      document.head.appendChild(script);
    }

    if (!hasSeenBubble()) {
      const bubbleDelay = typeof window.__BOSPHORLY_MIMO_BUBBLE_MS === 'number' ? window.__BOSPHORLY_MIMO_BUBBLE_MS : 5000;
      const collapseDelay = typeof window.__BOSPHORLY_MIMO_COLLAPSE_MS === 'number' ? window.__BOSPHORLY_MIMO_COLLAPSE_MS : 10000;
      function showGreeting() {
        if (document.querySelector('.bc-mobile-welcome')) {
          document.addEventListener('mimo:welcome-end', showGreeting, {once:true});
          return;
        }
        if (hasSeenBubble() || loaded) return;
        if (formInteracted || isFormField(document.activeElement)) return;
        const panel = document.querySelector('.bc-panel');
        if (panel && !panel.hidden) return;
        bubbleTextEl.textContent = buildBubbleText();
        markBubbleSeen();
        bubble.hidden = false;
        ensureSafeMobilePosition();
        collapseTimer = setTimeout(() => {
          bubble.hidden = true;
        }, collapseDelay);
      }
      setTimeout(() => {
        if (mobile.matches && document.readyState !== 'complete') {
          window.addEventListener('load', () => setTimeout(showGreeting, 0), {once:true});
        } else showGreeting();
      }, bubbleDelay);
    }
  };
  const THANKS_MSG = {
    tr: 'Harika seçim! Talebini kaptım, hemen ekibe uçuruyorum — e-posta kutunu kontrol et 💙',
    en: 'Awesome choice! Your request is ready — check your email and enjoy Istanbul 💙',
    ru: 'Отличный выбор! Я уже передал заявку — проверь почту и чудесных прогулок по Стамбулу 💙',
    uk: 'Чудовий вибір! Я вже передав запит — перевір пошту й гарних прогулянок Стамбулом 💙',
    de: 'Tolle Wahl! Deine Anfrage ist bereit — schau in dein Postfach und hab viel Spaß in Istanbul 💙',
    fr: 'Super choix ! Ta demande est prête — jette un œil à tes e-mails et profite d’Istanbul 💙',
    nl: 'Topkeuze! Je aanvraag staat klaar — check je e-mail en veel plezier in Istanbul 💙',
    ar: 'اختيار رائع! طلبك جاهز — راجع بريدك الإلكتروني واستمتع بإسطنبول 💙',
    he: 'בחירה נהדרת! הבקשה מוכנה — בדוק את הדוא״ל ותהנה מאיסטנבול 💙',
    az: 'Əla seçim! Sorğun hazırdır — e-poçtunu yoxla və İstanbulda xoş gəzintilər 💙',
    fa: 'انتخاب عالی! درخواستت آماده است — ایمیلت را چک کن و در استانبول خوش بگذران 💙',
    es: '¡Gran elección! Tu solicitud está lista — revisa tu correo y disfruta Estambul 💙',
    it: 'Ottima scelta! La tua richiesta è pronta — controlla la mail e goditi Istanbul 💙',
    pt: 'Ótima escolha! Seu pedido está pronto — confira seu e-mail e aproveite Istambul 💙',
    hr: 'Sjajan izbor! Tvoj zahtjev je spreman — provjeri e-mail i uživaj u Istanbulu 💙',
    hu: 'Remek választás! Az igénylésed elkészült — nézd meg az e-mailedet és jó utat 💙',
    bs: 'Odličan izbor! Tvoj zahtjev je spreman — provjeri e-mail i uživaj u Istanbulu 💙',
    zh: '太棒的选择！你的预订请求已准备好——记得查看邮箱，祝你在伊斯坦布尔玩得开心 💙',
    ja: '素敵な選択だね！リクエストの準備ができたよ — メールを確認してイスタンブールを楽しんで 💙',
    ko: '멋진 선택이야! 요청서가 준비됐어 — 이메일을 확인하고 이스탄불 여행 즐겁게 해 💙',
    hi: 'शानदार पसंद! तुम्हारा अनुरोध तैयार है — अपना ईमेल देखो और इस्तांबुल का मज़ा लो 💙',
    bn: 'দারুণ পছন্দ! তোমার অনুরোধ তৈরি হয়েছে — ইমেইল দেখো আর ইস্তাম্বুল উপভোগ করো 💙',
    id: 'Pilihan keren! Permintaanmu sudah siap — cek emailmu dan selamat menikmati Istanbul 💙',
  };
  window.BosphorlyMimoThanks = {
    message(lang) {
      const code = String(lang || pickLang() || 'en').slice(0, 2).toLowerCase();
      return THANKS_MSG[code] || THANKS_MSG.en;
    },
    append(box, lang) {
      if (!box || box.querySelector('.mimo-thanks')) return null;
      const code = String(lang || pickLang() || 'en').slice(0, 2).toLowerCase();
      const wrap = document.createElement('div');
      wrap.className = 'mimo-thanks';
      wrap.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;margin:10px 0 8px;border-radius:12px;background:#f0f7ff;border:1px solid #d5e6fb;color:#11314d;font-size:.93rem;line-height:1.4;font-weight:600';
      const img = document.createElement('img');
      img.className = 'mimo-thanks-img';
      img.src = base + 'assets/brand/mimo/mimo-happy.svg';
      img.alt = 'Mimo';
      img.width = 38;
      img.height = 38;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.cssText = 'flex-shrink:0;width:38px;height:38px';
      const span = document.createElement('span');
      span.className = 'mimo-thanks-text';
      span.textContent = THANKS_MSG[code] || THANKS_MSG.en;
      wrap.append(img, span);
      box.appendChild(wrap);
      return wrap;
    },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountFab); else mountFab();
})();
