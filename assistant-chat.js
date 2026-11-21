(() => {
  if (window.__bosphorlyChatInit) return;
  window.__bosphorlyChatInit = true;

  const pickLang = () => {
    if (window.BOSPHORLY_LANG_ALT) return (document.documentElement.lang || 'en').slice(0, 2);
    if (window.BosphorlyLang) return window.BosphorlyLang.pick();
    const q = new URLSearchParams(location.search).get('lang');
    if (q) return q.slice(0, 2);
    try { const s = localStorage.getItem('bosphorly.language'); if (s) return s.slice(0, 2); } catch {}
    return (document.documentElement.lang || 'en').slice(0, 2) || 'en';
  };
  const lang = pickLang();
  const isRtl = window.BosphorlyLang ? window.BosphorlyLang.rtl(lang) : ['ar', 'he', 'fa'].includes(lang);

  const UI = {
    title: { tr:'Bosphorly Asistan', en:'Bosphorly Assistant', ru:'Ассистент Bosphorly', uk:'Асистент Bosphorly', de:'Bosphorly Assistent', fr:'Assistant Bosphorly', nl:'Bosphorly Assistent', ar:'مساعد Bosphorly', he:'העוזר של Bosphorly', az:'Bosphorly Köməkçi', fa:'دستیار Bosphorly', es:'Asistente Bosphorly', it:'Assistente Bosphorly', pt:'Assistente Bosphorly', hr:'Bosphorly Asistent', hu:'Bosphorly Asszisztens', bs:'Bosphorly Asistent', zh:'Bosphorly 助手', ja:'Bosphorly アシスタント', ko:'Bosphorly 도우미', hi:'Bosphorly सहायक', bn:'Bosphorly সহায়ক', id:'Asisten Bosphorly' },
    sub: { tr:'İstanbul danışmanı · turlar ve transferler', en:'Istanbul advisor · tours & transfers', ru:'Гид по Стамбулу · туры и трансферы', uk:'Гід Стамбулом · тури й трансфери', de:'Istanbul-Berater · Touren & Transfers', fr:'Conseiller Istanbul · visites & transferts', nl:'Istanbul-adviseur · tours & transfers', ar:'مستشار إسطنبول · الجولات والنقل', he:'יועץ איסטנבול · סיורים והסעות', az:'İstanbul məsləhətçisi · turlar və transferlər', fa:'مشاور استانبول · تورها و ترانسفر', es:'Asesor de Estambul · tours y traslados', it:'Consulente Istanbul · tour e transfer', pt:'Consultor Istambul · passeios e traslados', hr:'Savjetnik za Istanbul · ture i transferi', hu:'Isztambul-tanácsadó · túrák és transzferek', bs:'Savjetnik za Istanbul · ture i transferi', zh:'伊斯坦布尔顾问 · 游览与接送', ja:'イスタンブール案内 · ツアー・送迎', ko:'이스탄불 어드바이저 · 투어 & 픽업', hi:'इस्तांबुल सलाहकार · टूर और ट्रांसफ़र', bn:'ইস্তাম্বুল পরামর্শদাতা · ট্যুর ও ট্রান্সফার', id:'Penasihat Istanbul · tur & transfer' },
    welcome: { tr:'Merhaba! İstanbul turları, Boğaz gezileri, hamam, havalimanı transferleri veya İstanbul gezi önerileri hakkında sorabilirsin.', en:'Hello! Ask me about Istanbul tours, Bosphorus cruises, hammams, airport transfers, or local Istanbul tips.', ru:'Здравствуйте! Спрашивайте о турах по Стамбулу, круизах по Босфору, хаммаме, трансферах и советах по городу.', uk:'Вітаю! Запитуйте про тури Стамбулом, круїзи Босфором, хамам, трансфери та поради щодо міста.', de:'Hallo! Fragen Sie nach Istanbul-Touren, Bosporus-Fahrten, Hamam, Flughafentransfers oder Stadttipps.', fr:'Bonjour ! Posez vos questions sur les visites d’Istanbul, croisières, hammams, transferts ou conseils locaux.', nl:'Hallo! Stel je vragen over tours, Bosporuscruises, hamam, luchthaventransfers of tips voor Istanbul.', ar:'مرحبًا! اسألني عن جولات إسطنبول ورحلات البوسفور والحمّام والنقل من المطار أو نصائح السفر.', he:'שלום! שאלו על סיורים באיסטנבול, שייט בבוספורוס, חמאם, הסעות או טיפים מקומיים.', az:'Salam! İstanbul turları, Boğaz gəzintiləri, hamam, transferlər və ya şəhər məsləhətləri haqqında soruşun.', fa:'سلام! درباره تورهای استانبول، کروز بسفر، حمام، ترانسفر فرودگاه یا راهنمای شهر بپرسید.', es:'¡Hola! Pregunta por tours en Estambul, cruceros, hammam, traslados o consejos locales.', it:'Ciao! Chiedi pure su tour a Istanbul, crociere, hammam, transfer o consigli sulla città.', pt:'Olá! Pergunte sobre passeios em Istambul, cruzeiros, hammam, traslados ou dicas locais.', hr:'Pozdrav! Pitajte o turama, krstarenjima, hamamu, transferima ili savjetima za Istanbul.', hu:'Szia! Kérdezz az isztambuli túrákról, hajókirándulásokról, hamamról, transzferekről vagy városi tippekről.', bs:'Zdravo! Pitajte o turama, krstarenjima, hamamu, transferima ili savjetima za Istanbul.', zh:'您好！欢迎咨询伊斯坦布尔游览、博斯普鲁斯游船、土耳其浴、机场接送或当地旅行建议。', ja:'こんにちは！イスタンブールのツアー、クルーズ、ハマム、空港送迎、観光のコツなど何でもどうぞ。', ko:'안녕하세요! 이스탄불 투어, 보스포루스 크루즈, 하맘, 공항 픽업이나 여행 팁에 대해 물어보세요.', hi:'नमस्ते! इस्तांबुल टूर, क्रूज़, हम्माम, एयरपोर्ट ट्रांसफ़र या स्थानीय सुझावों के बारे में पूछें।', bn:'হ্যালো! ইস্তাম্বুল ট্যুর, ক্রুজ, হামাম, এয়ারপোর্ট ট্রান্সফার বা ভ্রমণ টিপস সম্পর্কে জিজ্ঞাসা করুন।', id:'Halo! Tanyakan tentang tur Istanbul, pelayaran, hamam, transfer bandara, atau tips lokal.' },
    placeholder: { tr:'Sorunu yaz…', en:'Type your question…', ru:'Введите вопрос…', uk:'Введіть запитання…', de:'Frage eingeben…', fr:'Écrivez votre question…', nl:'Typ je vraag…', ar:'اكتب سؤالك…', he:'כתבו שאלה…', az:'Sualınızı yazın…', fa:'سؤالتان را بنویسید…', es:'Escribe tu pregunta…', it:'Scrivi la tua domanda…', pt:'Escreva sua pergunta…', hr:'Upišite pitanje…', hu:'Írja be kérdését…', bs:'Upišite pitanje…', zh:'输入问题…', ja:'質問を入力…', ko:'질문을 입력하세요…', hi:'अपना सवाल लिखें…', bn:'আপনার প্রশ্ন লিখুন…', id:'Tulis pertanyaan…' },
    send: { tr:'Gönder', en:'Send', ru:'Отправить', uk:'Надіслати', de:'Senden', fr:'Envoyer', nl:'Verstuur', ar:'إرسال', he:'שליחה', az:'Göndər', fa:'ارسال', es:'Enviar', it:'Invia', pt:'Enviar', hr:'Pošalji', hu:'Küldés', bs:'Pošalji', zh:'发送', ja:'送信', ko:'전송', hi:'भेजें', bn:'পাঠান', id:'Kirim' },
    human: { tr:'İnsanla konuş', en:'Talk to a human', ru:'Связаться с командой', uk:'Зв’язатися з командою', de:'Mit Team sprechen', fr:'Parler à un humain', nl:'Spreek met een medewerker', ar:'التحدث مع موظف', he:'לדבר עם נציג', az:'İnsanla danış', fa:'گفتگو با کارشناس', es:'Hablar con una persona', it:'Parla con il team', pt:'Falar com atendimento', hr:'Razgovaraj s osobom', hu:'Beszélj munkatárssal', bs:'Razgovaraj s osobom', zh:'联系人工客服', ja:'スタッフに相談', ko:'상담원 연결', hi:'टीम से बात करें', bn:'মানুষের সাথে কথা বলুন', id:'Bicara dengan tim' },
    emailPh: { tr:'E-posta adresin (yanıt için)', en:'Your email (for our reply)', ru:'Ваш e-mail (для ответа)', uk:'Ваш e-mail (для відповіді)', de:'Ihre E-Mail (für die Antwort)', fr:'Votre e-mail (pour la réponse)', nl:'Je e-mailadres (voor antwoord)', ar:'بريدك الإلكتروني (للرد)', he:'הדוא״ל שלך (לתשובה)', az:'E-poçt ünvanınız', fa:'ایمیل شما (برای پاسخ)', es:'Tu correo (para responderte)', it:'La tua e-mail (per rispondere)', pt:'Seu e-mail (para resposta)', hr:'Vaš e-mail (za odgovor)', hu:'E-mail címed (a válaszhoz)', bs:'Vaš e-mail (za odgovor)', zh:'您的邮箱（用于回复）', ja:'メールアドレス（返信用）', ko:'이메일 주소(회신용)', hi:'आपका ईमेल (जवाब के लिए)', bn:'আপনার ইমেইল (উত্তরের জন্য)', id:'Email Anda (untuk balasan)' },
    forwardBtn: { tr:'Ekibe ilet', en:'Forward to team', ru:'Отправить', uk:'Надіслати', de:'Weiterleiten', fr:'Transmettre', nl:'Doorsturen', ar:'إرسال للفريق', he:'שלח לצוות', az:'Komandaya göndər', fa:'ارسال به تیم', es:'Enviar al equipo', it:'Inoltra al team', pt:'Enviar à equipe', hr:'Proslijedi timu', hu:'Továbbítás', bs:'Proslijedi timu', zh:'转发给团队', ja:'チームへ送信', ko:'팀에 전달', hi:'टीम को भेजें', bn:'টিমকে পাঠান', id:'Kirim ke tim' },
    yesForward: { tr:'Evet, ilet', en:'Yes, forward', ru:'Да, передать', uk:'Так, передати', de:'Ja, weiterleiten', fr:'Oui, transmettre', nl:'Ja, stuur door', ar:'نعم، أرسلها', he:'כן, להעביר', az:'Bəli, göndər', fa:'بله، ارسال کن', es:'Sí, enviar', it:'Sì, inoltra', pt:'Sim, encaminhar', hr:'Da, proslijedi', hu:'Igen, továbbítsd', bs:'Da, proslijedi', zh:'是的，请转发', ja:'はい、引き継ぐ', ko:'네, 전달해 주세요', hi:'हाँ, भेजें', bn:'হ্যাঁ, পাঠান', id:'Ya, teruskan' },
    noThanks: { tr:'Hayır, teşekkürler', en:'No thanks', ru:'Нет, спасибо', uk:'Ні, дякую', de:'Nein, danke', fr:'Non merci', nl:'Nee, bedankt', ar:'لا، شكرًا', he:'לא, תודה', az:'Xeyr, təşəkkür', fa:'خیر، ممنون', es:'No, gracias', it:'No, grazie', pt:'Não, obrigado', hr:'Ne, hvala', hu:'Nem, köszönöm', bs:'Ne, hvala', zh:'不用了，谢谢', ja:'いいえ、結構です', ko:'아니요, 괜찮습니다', hi:'नहीं, धन्यवाद', bn:'না, ধন্যবাদ', id:'Tidak, terima kasih' },
    close: { tr:'Kapat', en:'Close', ru:'Закрыть', uk:'Закрити', de:'Schließen', fr:'Fermer', nl:'Sluiten', ar:'إغلاق', he:'סגור', az:'Bağla', fa:'بستن', es:'Cerrar', it:'Chiudi', pt:'Fechar', hr:'Zatvori', hu:'Bezárás', bs:'Zatvori', zh:'关闭', ja:'閉じる', ko:'닫기', hi:'बंद करें', bn:'বন্ধ করুন', id:'Tutup' },
    forwarded: { tr:'Sohbetin info@bosphorly.com adresine iletildi. En kısa sürede e-posta ile dönüş yapacağız.', en:'Your conversation was forwarded to info@bosphorly.com. We will reply by email shortly.', ru:'Переписка отправлена на info@bosphorly.com. Мы скоро ответим по e-mail.', uk:'Розмову надіслано на info@bosphorly.com. Ми скоро відповімо електронною поштою.', de:'Ihre Nachricht wurde an info@bosphorly.com weitergeleitet. Wir antworten in Kürze per E-Mail.', fr:'Votre conversation a été transmise à info@bosphorly.com. Nous vous répondrons par e-mail.', nl:'Je gesprek is doorgestuurd naar info@bosphorly.com. We reageren spoedig per e-mail.', ar:'تم إرسال محادثتك إلى info@bosphorly.com. سنرد عليك عبر البريد الإلكتروني قريبًا.', he:'השיחה הועברה אל info@bosphorly.com. נחזור אליך בדוא״ל בהקדם.', az:'Söhbətiniz info@bosphorly.com ünvanına göndərildi.', fa:'گفتگوی شما به info@bosphorly.com ارسال شد. به‌زودی پاسخ می‌دهیم.', es:'Tu conversación se envió a info@bosphorly.com. Responderemos por correo pronto.', it:'La conversazione è stata inoltrata a info@bosphorly.com. Risponderemo via e-mail.', pt:'Sua conversa foi enviada para info@bosphorly.com. Responderemos por e-mail em breve.', hr:'Razgovor je proslijeđen na info@bosphorly.com.', hu:'A beszélgetést továbbítottuk a info@bosphorly.com címre.', bs:'Razgovor je proslijeđen na info@bosphorly.com.', zh:'您的对话已转发至 info@bosphorly.com，我们将尽快通过邮件回复。', ja:'会話内容を info@bosphorly.com に送信しました。まもなくメールでご返信いたします。', ko:'대화 내용이 info@bosphorly.com으로 전달되었습니다. 곧 이메일로 회신드리겠습니다.', hi:'आपकी बातचीत info@bosphorly.com पर भेज दी गई है।', bn:'আপনার কথোপকথন info@bosphorly.com-এ পাঠানো হয়েছে।', id:'Percakapan Anda telah diteruskan ke info@bosphorly.com.' },
    verifyFirst: { tr:'Lütfen güvenlik doğrulamasını tamamlayın.', en:'Please complete the security check first.', ru:'Пожалуйста, пройдите проверку безопасности.', uk:'Будь ласка, пройдіть перевірку безпеки.', de:'Bitte schließen Sie zuerst die Sicherheitsprüfung ab.', fr:'Veuillez d’abord compléter la vérification de sécurité.', nl:'Voltooi eerst de beveiligingscontrole.', ar:'يرجى إكمال التحقق الأمني أولاً.', he:'נא להשלים תחילה את בדיקת האבטחה.', az:'Zəhmət olmasa təhlükəsizlik yoxlamasını tamamlayın.', fa:'لطفاً ابتدا بررسی امنیتی را تکمیل کنید.', es:'Completa primero la verificación de seguridad.', it:'Completa prima la verifica di sicurezza.', pt:'Conclua primeiro a verificação de segurança.', hr:'Molimo dovršite sigurnosnu provjeru.', hu:'Kérjük, először végezze el a biztonsági ellenőrzést.', bs:'Molimo dovršite sigurnosnu provjeru.', zh:'请先完成安全验证。', ja:'先にセキュリティ確認を完了してください。', ko:'먼저 보안 확인을 완료해 주세요.', hi:'कृपया पहले सुरक्षा जांच पूरी करें।', bn:'অনুগ্রহ করে প্রথমে নিরাপত্তা যাচাই সম্পন্ন করুন।', id:'Harap selesaikan pemeriksaan keamanan terlebih dahulu.' },
    offline: { tr:'Asistan şu an çevrimdışı; soruların için info@bosphorly.com adresine yazabilirsin.', en:'Assistant is currently offline; please email info@bosphorly.com for help.', ru:'Ассистент сейчас недоступен; напишите на info@bosphorly.com.', uk:'Асистент зараз недоступний; напишіть на info@bosphorly.com.', de:'Der Assistent ist offline; schreiben Sie an info@bosphorly.com.', fr:'L’assistant est hors ligne ; écrivez à info@bosphorly.com.', nl:'De assistent is offline; mail naar info@bosphorly.com.', ar:'المساعد غير متصل حاليًا؛ يرجى مراسلة info@bosphorly.com.', he:'העוזר לא זמין כרגע; כתבו ל-info@bosphorly.com.', az:'Köməkçi hazırda oflayndır; info@bosphorly.com ünvanına yazın.', fa:'دستیار آفلاین است؛ لطفاً به info@bosphorly.com ایمیل بزنید.', es:'El asistente está desconectado; escribe a info@bosphorly.com.', it:'Assistente non disponibile; scrivi a info@bosphorly.com.', pt:'Assistente offline; escreva para info@bosphorly.com.', hr:'Asistent je izvan mreže; pišite na info@bosphorly.com.', hu:'Az asszisztens offline; írjon a info@bosphorly.com címre.', bs:'Asistent je van mreže; pišite na info@bosphorly.com.', zh:'助手当前离线，请发送邮件至 info@bosphorly.com。', ja:'現在オフラインです。info@bosphorly.com までメールでお問い合わせください。', ko:'현재 오프라인입니다. info@bosphorly.com으로 문의해 주세요.', hi:'सहायक अभी ऑफ़लाइन है; info@bosphorly.com पर ईमेल करें।', bn:'সহায়ক এখন অফলাইন; info@bosphorly.com-এ ইমেইল করুন।', id:'Asisten sedang offline; silakan email ke info@bosphorly.com.' }
  };
  const tr = (k) => (UI[k] && (UI[k][lang] || UI[k].en)) || '';

  const STORE_KEY = 'bosphorly.assistant_chat';
  let history = [];
  try {
    const saved = sessionStorage.getItem(STORE_KEY);
    if (saved) history = JSON.parse(saved);
    if (!Array.isArray(history)) history = [];
  } catch { history = []; }
  const saveHistory = () => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-12))); } catch {}
  };

  const panel = document.createElement('section');
  panel.className = 'bc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', tr('title'));
  if (isRtl) panel.setAttribute('dir', 'rtl');
  panel.innerHTML =
    `<div class="bc-head"><div><div class="bc-title">${tr('title')}</div><div class="bc-sub">${tr('sub')}</div></div>` +
    `<button type="button" class="bc-close" aria-label="${tr('close')}">×</button></div>` +
    `<div class="bc-log" aria-live="polite"></div>` +
    `<div class="bc-turnstile"></div>` +
    `<div class="bc-handoff" hidden><div class="bc-handoff-row"><input type="email" placeholder="${tr('emailPh')}" autocomplete="email">` +
    `<button type="button" class="bc-forward-btn">${tr('forwardBtn')}</button></div></div>` +
    `<div class="bc-actions"><button type="button" class="bc-human-btn">💬 ${tr('human')}</button></div>` +
    `<form class="bc-form"><input class="bc-input" type="text" maxlength="1000" placeholder="${tr('placeholder')}" autocomplete="off">` +
    `<button class="bc-send" type="submit">${tr('send')}</button></form>`;
  document.body.appendChild(panel);

  const logEl = panel.querySelector('.bc-log');
  const closeBtn = panel.querySelector('.bc-close');
  const tsMount = panel.querySelector('.bc-turnstile');
  const handoffBox = panel.querySelector('.bc-handoff');
  const emailInput = handoffBox.querySelector('input');
  const forwardBtn = handoffBox.querySelector('.bc-forward-btn');
  const humanBtn = panel.querySelector('.bc-human-btn');
  const form = panel.querySelector('.bc-form');
  const input = panel.querySelector('.bc-input');
  const sendBtn = panel.querySelector('.bc-send');

  let turnstileToken = '';
  let tsWidgetId = null;

  function renderMsg(role, text, opts = {}) {
    const div = document.createElement('div');
    div.className = `bc-msg ${role === 'user' ? 'user' : 'bot'}`;
    if (role === 'bot') {
      const parts = String(text || '').split(/(https:\/\/bosphorly\.com[^\s)<]*)/gi);
      for (const p of parts) {
        if (/^https:\/\/bosphorly\.com/i.test(p)) {
          const a = document.createElement('a');
          a.href = p;
          a.textContent = p;
          div.appendChild(a);
        } else {
          div.appendChild(document.createTextNode(p));
        }
      }
      if (opts.handoffOffer) {
        const actions = document.createElement('div');
        actions.className = 'bc-offer-actions';
        const yesBtn = document.createElement('button');
        yesBtn.type = 'button';
        yesBtn.className = 'bc-offer-btn';
        yesBtn.textContent = tr('yesForward');
        yesBtn.addEventListener('click', () => {
          actions.remove();
          handoffBox.hidden = false;
          emailInput.focus();
        });
        const noBtn = document.createElement('button');
        noBtn.type = 'button';
        noBtn.className = 'bc-offer-btn secondary';
        noBtn.textContent = tr('noThanks');
        noBtn.addEventListener('click', () => {
          actions.remove();
          handoffBox.hidden = true;
        });
        actions.append(yesBtn, noBtn);
        div.appendChild(actions);
      }
    } else {
      div.textContent = text;
    }
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  if (!history.length) {
    renderMsg('bot', tr('welcome'));
  } else {
    for (const m of history) renderMsg(m.role === 'user' ? 'user' : 'bot', m.content);
  }

  function loadTurnstile() {
    const siteKey = window.BOSPHORLY_API && window.BOSPHORLY_API.turnstileSiteKey;
    if (!siteKey) return;
    const renderWidget = () => {
      if (!window.turnstile || tsWidgetId !== null) return;
      tsWidgetId = window.turnstile.render(tsMount, {
        sitekey: siteKey,
        theme: 'light',
        callback: (tok) => { turnstileToken = tok; },
        'expired-callback': () => { turnstileToken = ''; },
      });
    };
    if (window.turnstile) { renderWidget(); return; }
    if (!document.querySelector('script[data-bc-turnstile]')) {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.defer = true;
      s.dataset.bcTurnstile = '1';
      s.onload = renderWidget;
      document.head.appendChild(s);
    }
  }

  function resetTurnstile() {
    turnstileToken = '';
    if (window.turnstile && tsWidgetId !== null) {
      try { window.turnstile.reset(tsWidgetId); } catch {}
    }
  }

  const toggle = (open) => {
    panel.hidden = !open;
    if (open) {
      loadTurnstile();
      input.focus();
    }
  };
  window.__bosphorlyChatToggle = () => toggle(panel.hidden);

  closeBtn.addEventListener('click', () => toggle(false));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
  humanBtn.addEventListener('click', () => {
    handoffBox.hidden = !handoffBox.hidden;
    if (!handoffBox.hidden) emailInput.focus();
  });

  const apiBase = window.BOSPHORLY_API && window.BOSPHORLY_API.base;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    if (!apiBase) {
      renderMsg('user', message);
      input.value = '';
      renderMsg('bot', tr('offline'));
      return;
    }
    if (window.BOSPHORLY_API.turnstileSiteKey && !turnstileToken) {
      renderMsg('bot', tr('verifyFirst'));
      return;
    }
    renderMsg('user', message);
    input.value = '';
    sendBtn.disabled = true;
    const recent = history.slice(-6);
    try {
      const res = await fetch(`${apiBase}/v1/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, lang, history: recent, turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.reply || data.error || tr('offline');
      history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
      saveHistory();
      renderMsg('bot', reply, { handoffOffer: Boolean(data.handoffOffer) });
      if (data.handoff) handoffBox.hidden = false;
    } catch {
      renderMsg('bot', tr('offline'));
      handoffBox.hidden = false;
    } finally {
      sendBtn.disabled = false;
      resetTurnstile();
    }
  });

  forwardBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailInput.focus(); return; }
    if (!apiBase) { renderMsg('bot', tr('offline')); return; }
    if (window.BOSPHORLY_API.turnstileSiteKey && !turnstileToken) {
      renderMsg('bot', tr('verifyFirst'));
      return;
    }
    forwardBtn.disabled = true;
    try {
      const res = await fetch(`${apiBase}/v1/assistant/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang, history: history.slice(-6), turnstileToken }),
      });
      if (res.ok) {
        handoffBox.hidden = true;
        emailInput.value = '';
        renderMsg('bot', tr('forwarded'));
      } else {
        renderMsg('bot', tr('offline'));
      }
    } catch {
      renderMsg('bot', tr('offline'));
    } finally {
      forwardBtn.disabled = false;
      resetTurnstile();
    }
  });

  loadTurnstile();
  input.focus();
})();
