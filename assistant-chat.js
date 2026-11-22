(() => {
  if (window.__bosphorlyChatInit) return;
  window.__bosphorlyChatInit = true;

  const scriptEl = document.currentScript || document.querySelector('script[src*="assistant-chat.js"]');
  const base = scriptEl && scriptEl.src
    ? new URL('.', scriptEl.src).href
    : ((document.getElementById('siteHeader') && document.getElementById('siteHeader').dataset.base) || '');

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
    title: { tr:'Mimo · İstanbul asistanın', en:'Mimo · Your Istanbul assistant', ru:'Mimo · Твой ассистент по Стамбулу', uk:'Mimo · Твій асистент у Стамбулі', de:'Mimo · Dein Istanbul-Assistent', fr:'Mimo · Ton assistant Istanbul', nl:'Mimo · Je Istanbul-assistent', ar:'Mimo · مساعدك في إسطنبول', he:'Mimo · העוזר שלך באיסטנבול', az:'Mimo · İstanbul köməkçin', fa:'Mimo · دستیار استانبول تو', es:'Mimo · Tu asistente de Estambul', it:'Mimo · Il tuo assistente per Istanbul', pt:'Mimo · Seu assistente em Istambul', hr:'Mimo · Tvoj Istanbul asistent', hu:'Mimo · Isztambuli asszisztensed', bs:'Mimo · Tvoj Istanbul asistent', zh:'Mimo · 你的伊斯坦布尔助手', ja:'Mimo · イスタンブール案内アシスタント', ko:'Mimo · 나의 이스탄불 도우미', hi:'Mimo · तुम्हारा इस्तांबुल सहायक', bn:'Mimo · তোমার ইস্তাম্বুল সহায়ক', id:'Mimo · Asisten Istanbul kamu' },
    sub: { tr:'Bosphorly yapay zekâ asistanı · turlar ve transferler', en:'Bosphorly AI assistant · tours & transfers', ru:'ИИ-ассистент Bosphorly · туры и трансферы', uk:'ШІ-асистент Bosphorly · тури й трансфери', de:'Bosphorly KI-Assistent · Touren & Transfers', fr:'Assistant IA Bosphorly · visites & transferts', nl:'Bosphorly AI-assistent · tours & transfers', ar:'مساعد الذكاء الاصطناعي · الجولات والنقل', he:'עוזר ה-AI של Bosphorly · סיורים והסעות', az:'Bosphorly süni intellekt köməkçisi · turlar və transferlər', fa:'دستیار هوش مصنوعی Bosphorly · تورها و ترانسفر', es:'Asistente IA de Bosphorly · tours y traslados', it:'Assistente IA Bosphorly · tour e transfer', pt:'Assistente IA Bosphorly · passeios e traslados', hr:'Bosphorly AI asistent · ture i transferi', hu:'Bosphorly AI-asszisztens · túrák és transzferek', bs:'Bosphorly AI asistent · ture i transferi', zh:'Bosphorly 人工智能助手 · 游览与接送', ja:'Bosphorly AIアシスタント · ツアー・送迎', ko:'Bosphorly AI 도우미 · 투어 & 픽업', hi:'Bosphorly AI सहायक · टूर और ट्रांसफ़र', bn:'Bosphorly এআই সহায়ক · ট্যুর ও ট্রান্সফার', id:'Asisten AI Bosphorly · tur & transfer' },
    morning: { tr:'Günaydın', en:'Good morning', ru:'Доброе утро', uk:'Добрий ранок', de:'Guten Morgen', fr:'Bonjour', nl:'Goedemorgen', ar:'صباح الخير', he:'בוקר טוב', az:'Sabahın xeyir', fa:'صبح بخیر', es:'Buenos días', it:'Buongiorno', pt:'Bom dia', hr:'Dobro jutro', hu:'Jó reggelt', bs:'Dobro jutro', zh:'早上好', ja:'おはようございます', ko:'좋은 아침이에요', hi:'सुप्रभात', bn:'শুভ সকাল', id:'Selamat pagi' },
    afternoon: { tr:'İyi günler', en:'Good afternoon', ru:'Добрый день', uk:'Добрий день', de:'Guten Tag', fr:'Bonjour', nl:'Goedemiddag', ar:'طاب يومك', he:'צהריים טובים', az:'Günortan xeyir', fa:'روز بخیر', es:'Buenas tardes', it:'Buon pomeriggio', pt:'Boa tarde', hr:'Dobar dan', hu:'Jó napot', bs:'Dobar dan', zh:'下午好', ja:'こんにちは', ko:'좋은 오후예요', hi:'नमस्कार', bn:'শুভ অপরাহ্ন', id:'Selamat siang' },
    evening: { tr:'İyi akşamlar', en:'Good evening', ru:'Добрый вечер', uk:'Добрий вечір', de:'Guten Abend', fr:'Bonsoir', nl:'Goedenavond', ar:'مساء الخير', he:'ערב טוב', az:'Axşamın xeyir', fa:'عصر بخیر', es:'Buenas noches', it:'Buonasera', pt:'Boa noite', hr:'Dobra večer', hu:'Jó estét', bs:'Dobro veče', zh:'晚上好', ja:'こんばんは', ko:'좋은 저녁이에요', hi:'शुभ संध्या', bn:'শুভ সন্ধ্যা', id:'Selamat malam' },
    memberWelcome: { tr:'Tekrar hoş geldin, {name} 💙', en:'Welcome back, {name} 💙', ru:'С возвращением, {name} 💙', uk:'З поверненням, {name} 💙', de:'Willkommen zurück, {name} 💙', fr:'Bon retour, {name} 💙', nl:'Welkom terug, {name} 💙', ar:'أهلاً بعودتك، {name} 💙', he:'ברוך שובך, {name} 💙', az:'Yenidən xoş gəldin, {name} 💙', fa:'خوش برگشتی، {name} 💙', es:'Bienvenido de nuevo, {name} 💙', it:'Bentornato, {name} 💙', pt:'Bem-vindo de volta, {name} 💙', hr:'Dobro došao natrag, {name} 💙', hu:'Üdv újra itt, {name} 💙', bs:'Dobro došao nazad, {name} 💙', zh:'欢迎回来，{name} 💙', ja:'おかえりなさい、{name} 💙', ko:'다시 오신 것을 환영해요, {name} 💙', hi:'वापसी पर स्वागत है, {name} 💙', bn:'ফিরে আসার জন্য স্বাগতম, {name} 💙', id:'Selamat datang kembali, {name} 💙' },
    welcome: { tr:'Merhaba! Ben Bosphorly’nin yapay zekâ asistanı Mimo 🌊 İstanbul turları, Boğaz gezileri, hamam, havalimanı transferleri veya İstanbul gezi önerileri hakkında sorabilirsin.', en:'Hello! I am Mimo, Bosphorly’s AI assistant 🌊 Ask me about Istanbul tours, Bosphorus cruises, hammams, airport transfers, or local Istanbul tips.', ru:'Привет! Я Mimo — ИИ-ассистент Bosphorly 🌊 Спрашивай о турах по Стамбулу, круизах по Босфору, хаммаме, трансферах и советах по городу.', uk:'Привіт! Я Mimo — ШІ-асистент Bosphorly 🌊 Питай про тури Стамбулом, круїзи Босфором, хамам, трансфери та поради щодо міста.', de:'Hallo! Ich bin Mimo, der KI-Assistent von Bosphorly 🌊 Frag mich gern nach Istanbul-Touren, Bosporus-Fahrten, Hamam, Flughafentransfers oder Stadttipps.', fr:'Salut ! Je suis Mimo, l’assistant IA de Bosphorly 🌊 Pose-moi tes questions sur les visites d’Istanbul, croisières, hammams, transferts ou conseils locaux.', nl:'Hallo! Ik ben Mimo, de AI-assistent van Bosphorly 🌊 Stel je vragen over tours, Bosporuscruises, hamam, luchthaventransfers of tips voor Istanbul.', ar:'مرحبًا! أنا Mimo، مساعد الذكاء الاصطناعي من Bosphorly 🌊 اسألني عن جولات إسطنبول ورحلات البوسفور والحمّام والنقل من المطار أو نصائح السفر.', he:'היי! אני Mimo, עוזר ה-AI של Bosphorly 🌊 תשאל אותי על סיורים באיסטנבול, שייט בבוספורוס, חמאם, הסעות או טיפים בעיר.', az:'Salam! Mən Bosphorly-nin süni intellekt köməkçisi Mimo 🌊 İstanbul turları, Boğaz gəzintiləri, hamam, transferlər və ya şəhər məsləhətləri haqqında soruşa bilərsən.', fa:'سلام! من Mimo، دستیار هوش مصنوعی Bosphorly هستم 🌊 درباره تورهای استانبول، کروز بسفر، حمام، ترانسفر فرودگاه یا نکات سفر بپرس.', es:'¡Hola! Soy Mimo, el asistente de IA de Bosphorly 🌊 Pregunta por tours en Estambul, cruceros, hammam, traslados o consejos locales.', it:'Ciao! Sono Mimo, l’assistente IA di Bosphorly 🌊 Chiedi pure su tour a Istanbul, crociere, hammam, transfer o consigli sulla città.', pt:'Oi! Sou Mimo, o assistente de IA da Bosphorly 🌊 Pergunte sobre passeios em Istambul, cruzeiros, hammam, traslados ou dicas locais.', hr:'Bok! Ja sam Mimo, Bosphorlyjev AI asistent 🌊 Pitaj me o turama, krstarenjima, hamamu, transferima ili savjetima za Istanbul.', hu:'Szia! Mimo vagyok, a Bosphorly AI-asszisztense 🌊 Kérdezz az isztambuli túrákról, hajókirándulásokról, hamamról, transzferekről vagy városi tippekről.', bs:'Ćao! Ja sam Mimo, Bosphorlyjev AI asistent 🌊 Pitaj me o turama, krstarenjima, hamamu, transferima ili savjetima za Istanbul.', zh:'你好！我是 Bosphorly 的人工智能助手 Mimo 🌊 欢迎向我咨询伊斯坦布尔游览、博斯普鲁斯游船、土耳其浴、机场接送或当地旅行建议。', ja:'こんにちは！BosphorlyのAIアシスタント、Mimoだよ 🌊 イスタンブールのツアー、クルーズ、ハマム、空港送迎、観光のコツなど気軽に聞いてね。', ko:'안녕! Bosphorly의 AI 도우미 Mimo예요 🌊 이스탄불 투어, 보스포루스 크루즈, 하맘, 공항 픽업이나 여행 팁에 대해 편하게 물어봐요.', hi:'नमस्ते! मैं Bosphorly का AI सहायक Mimo हूँ 🌊 इस्तांबुल टूर, क्रूज़, हम्माम, एयरपोर्ट ट्रांसफ़र या स्थानीय सुझावों के बारे में पूछो।', bn:'হ্যালো! আমি Bosphorly-এর এআই সহায়ক Mimo 🌊 ইস্তাম্বুল ট্যুর, ক্রুজ, হামাম, এয়ারপোর্ট ট্রান্সফার বা ভ্রমণ টিপস সম্পর্কে জিজ্ঞাসা করো।', id:'Halo! Saya Mimo, asisten AI Bosphorly 🌊 Tanya apa saja soal tur Istanbul, pelayaran, hamam, transfer bandara, atau tips lokal.' },
    ctxTransfer: { tr:'Havalimanından otele mi gidiyorsun? ✈️', en:'Heading from the airport to your hotel? ✈️', ru:'Едешь из аэропорта в отель? ✈️', uk:'Їдеш з аеропорту до готелю? ✈️', de:'Geht es vom Flughafen zum Hotel? ✈️', fr:'Tu vas de l’aéroport à ton hôtel ? ✈️', nl:'Ga je van de luchthaven naar je hotel? ✈️', ar:'هل تتجه من المطار إلى الفندق؟ ✈️', he:'נוסע משדה התעופה למלון? ✈️', az:'Hava limanından otelə gedirsən? ✈️', fa:'از فرودگاه به هتل می‌روی؟ ✈️', es:'¿Vas del aeropuerto al hotel? ✈️', it:'Vai dall’aeroporto all’hotel? ✈️', pt:'Vai do aeroporto para o hotel? ✈️', hr:'Ideš li s aerodroma do hotela? ✈️', hu:'A repülőtérről a szállodába tartasz? ✈️', bs:'Ideš li s aerodroma do hotela? ✈️', zh:'你是要从机场去酒店吗？✈️', ja:'空港からホテルへの移動かな？✈️', ko:'공항에서 호텔로 이동하나요? ✈️', hi:'क्या तुम एयरपोर्ट से होटल जा रहे हो? ✈️', bn:'তুমি কি এয়ারপোর্ট থেকে হোটেলে যাচ্ছ? ✈️', id:'Lagi menuju hotel dari bandara? ✈️' },
    ctxTour: { tr:'Hangi Boğaz turu sana uygun, birlikte bakalım mı? ⛵', en:'Shall we see which Bosphorus cruise suits you best? ⛵', ru:'Подберём вместе подходящий круиз по Босфору? ⛵', uk:'Підберемо разом круїз Босфором, який тобі пасує? ⛵', de:'Sollen wir gemeinsam schauen, welche Bosporus-Fahrt zu dir passt? ⛵', fr:'On regarde ensemble quelle croisière sur le Bosphore te convient ? ⛵', nl:'Zullen we samen kijken welke Bosporuscruise bij je past? ⛵', ar:'هل نرى معًا أي جولة في البوسفور تناسبك أكثر؟ ⛵', he:'נבדוק יחד איזה שייט בבוספורוס הכי מתאים לך? ⛵', az:'Hansı Boğaz turunun sənə uyğun olduğuna birlikdə baxaq? ⛵', fa:'باهم ببینیم کدام کروز بسفر برایت مناسب‌تر است؟ ⛵', es:'¿Miramos juntos qué crucero por el Bósforo va mejor contigo? ⛵', it:'Vediamo insieme quale crociera sul Bosforo fa per te? ⛵', pt:'Vamos ver juntos qual cruzeiro pelo Bósforo combina com você? ⛵', hr:'Pogledajmo zajedno koje krstarenje Bosporom ti najviše odgovara? ⛵', hu:'Megnézzük együtt, melyik boszporuszi hajóút illik hozzád? ⛵', bs:'Pogledajmo zajedno koje krstarenje Bosporom ti najviše odgovara? ⛵', zh:'我们一起看看哪条博斯普鲁斯游船路线最适合你吧？⛵', ja:'どのボスポラスクルーズがぴったりか、一緒に見てみようか？⛵', ko:'어떤 보스포루스 크루즈가 잘 맞는지 함께 볼까요? ⛵', hi:'आओ साथ देखें कि कौन-सा बोस्फोरस क्रूज़ तुम्हारे लिए सबसे अच्छा है? ⛵', bn:'কোন বসফরাস ক্রুজটি তোমার জন্য সেরা, একসাথে দেখব কি? ⛵', id:'Yuk kita lihat bersama pelayaran Bosphorus mana yang pas buat kamu? ⛵' },
    ctxHammam: { tr:'İlk hamam deneyimin mi? 🛁', en:'Is this your first hammam experience? 🛁', ru:'Это твой первый опыт в турецком хаммаме? 🛁', uk:'Це твій перший досвід у турецькому хамамі? 🛁', de:'Ist das dein erstes Hamam-Erlebnis? 🛁', fr:'C’est ta première expérience au hammam ? 🛁', nl:'Is dit je eerste hamam-ervaring? 🛁', ar:'هل هذه أول تجربة حمّام تركي لك؟ 🛁', he:'זו חוויית החמאם הראשונה שלך? 🛁', az:'Bu sənin ilk hamam təcrübəndir? 🛁', fa:'این اولین تجربه حمام ترکی توست؟ 🛁', es:'¿Es tu primera experiencia en un hammam? 🛁', it:'È la tua prima esperienza in un hammam? 🛁', pt:'É a sua primeira experiência em um hammam? 🛁', hr:'Je li ti ovo prvo iskustvo u hamamu? 🛁', hu:'Ez az első hamam-élményed? 🛁', bs:'Je li ti ovo prvo iskustvo u hamamu? 🛁', zh:'这是你第一次体验土耳其浴吗？🛁', ja:'トルコ式ハマムは初めて？🛁', ko:'터키식 하맘은 첫 경험인가요? 🛁', hi:'क्या यह तुम्हारा पहला हम्माम अनुभव है? 🛁', bn:'এটি কি তোমার প্রথম হামাম অভিজ্ঞতা? 🛁', id:'Ini pengalaman hamam pertama kamu? 🛁' },
    qTransfer: { tr:'✈️ Havalimanı transferi', en:'✈️ Airport transfer', ru:'✈️ Трансфер из аэропорта', uk:'✈️ Трансфер з аеропорту', de:'✈️ Flughafentransfer', fr:'✈️ Transfert aéroport', nl:'✈️ Luchthaventransfer', ar:'✈️ النقل من المطار', he:'✈️ הסעה משדה התעופה', az:'✈️ Hava limanı transferi', fa:'✈️ ترانسفر فرودگاه', es:'✈️ Traslado aeropuerto', it:'✈️ Transfer aeroporto', pt:'✈️ Traslado aeroporto', hr:'✈️ Prijevoz s aerodroma', hu:'✈️ Reptéri transzfer', bs:'✈️ Transfer s aerodroma', zh:'✈️ 机场接送', ja:'✈️ 空港送迎', ko:'✈️ 공항 픽업', hi:'✈️ एयरपोर्ट ट्रांसफ़र', bn:'✈️ এয়ারপোর্ট ট্রান্সফার', id:'✈️ Transfer bandara' },
    qCruise: { tr:'⛵ Boğaz turu', en:'⛵ Bosphorus cruise', ru:'⛵ Круиз по Босфору', uk:'⛵ Круїз Босфором', de:'⛵ Bosporus-Fahrt', fr:'⛵ Croisière Bosphore', nl:'⛵ Bosporuscruise', ar:'⛵ جولة البوسفور', he:'⛵ שייט בבוספורוס', az:'⛵ Boğaz turu', fa:'⛵ کروز بسفر', es:'⛵ Crucero Bósforo', it:'⛵ Crociera Bosforo', pt:'⛵ Cruzeiro Bósforo', hr:'⛵ Krstarenje Bosporom', hu:'⛵ Boszporuszi hajóút', bs:'⛵ Krstarenje Bosporom', zh:'⛵ 博斯普鲁斯游船', ja:'⛵ ボスポラスクルーズ', ko:'⛵ 보스포루스 크루즈', hi:'⛵ बोस्फोरस क्रूज़', bn:'⛵ বসফরাস ক্রুজ', id:'⛵ Pelayaran Bosphorus' },
    qHammam: { tr:'🛁 Hamam', en:'🛁 Hammam', ru:'🛁 Хаммам', uk:'🛁 Хамам', de:'🛁 Hamam', fr:'🛁 Hammam', nl:'🛁 Hamam', ar:'🛁 الحمّام التركي', he:'🛁 חמאם', az:'🛁 Hamam', fa:'🛁 حمام ترکی', es:'🛁 Hammam', it:'🛁 Hammam', pt:'🛁 Hammam', hr:'🛁 Hamam', hu:'🛁 Hamam', bs:'🛁 Hamam', zh:'🛁 土耳其浴', ja:'🛁 ハマム', ko:'🛁 하맘', hi:'🛁 हम्माम', bn:'🛁 হামাম', id:'🛁 Hamam' },
    qPlan: { tr:'🗺️ 2 günlük plan', en:'🗺️ 2-day plan', ru:'🗺️ План на 2 дня', uk:'🗺️ План на 2 дні', de:'🗺️ 2-Tage-Plan', fr:'🗺️ Plan de 2 jours', nl:'🗺️ 2-daags plan', ar:'🗺️ خطة يومين', he:'🗺️ תוכנית ליומיים', az:'🗺️ 2 günlük plan', fa:'🗺️ برنامه ۲ روزه', es:'🗺️ Plan de 2 días', it:'🗺️ Piano di 2 giorni', pt:'🗺️ Roteiro de 2 dias', hr:'🗺️ 2-dnevni plan', hu:'🗺️ 2 napos terv', bs:'🗺️ 2-dnevni plan', zh:'🗺️ 2日游计划', ja:'🗺️ 2日間プラン', ko:'🗺️ 2일 일정', hi:'🗺️ 2 दिन का प्लान', bn:'🗺️ ২ দিনের প্ল্যান', id:'🗺️ Rencana 2 hari' },
    typing: { tr:'Mimo yazıyor…', en:'Mimo is typing…', ru:'Mimo печатает…', uk:'Mimo пише…', de:'Mimo schreibt…', fr:'Mimo écrit…', nl:'Mimo typt…', ar:'Mimo يكتب…', he:'Mimo מקליד…', az:'Mimo yazır…', fa:'Mimo در حال نوشتن…', es:'Mimo está escribiendo…', it:'Mimo sta scrivendo…', pt:'Mimo está digitando…', hr:'Mimo piše…', hu:'Mimo ír…', bs:'Mimo piše…', zh:'Mimo 正在输入…', ja:'Mimoが入力中…', ko:'Mimo가 입력 중…', hi:'Mimo लिख रहा है…', bn:'Mimo লিখছে…', id:'Mimo sedang mengetik…' },
    thinkingLong: { tr:'Biraz düşünüyorum…', en:'Just thinking for a second…', ru:'Секунду, думаю…', uk:'Секунду, міркую…', de:'Ich überlege kurz…', fr:'Je réfléchis un instant…', nl:'Ik denk heel even na…', ar:'أفكر للحظة…', he:'רק רגע, חושב על זה…', az:'Bir az düşünürəm…', fa:'لحظه‌ای در حال فکرم…', es:'Pensando un momento…', it:'Ci penso un attimo…', pt:'Pensando um instante…', hr:'Razmišljam na trenutak…', hu:'Egy pillanat, gondolkodom…', bs:'Razmišljam na trenutak…', zh:'稍微想一下…', ja:'ちょっと考えてるよ…', ko:'잠시 생각 중이에요…', hi:'बस एक पल, सोच रहा हूँ…', bn:'একটু ভাবছি…', id:'Sebentar, aku mikir dulu…' },
    placeholder: { tr:'Mimo’ya sorunu yaz…', en:'Ask Mimo a question…', ru:'Напиши вопрос Mimo…', uk:'Напиши запитання Mimo…', de:'Frag Mimo etwas…', fr:'Pose ta question à Mimo…', nl:'Stel je vraag aan Mimo…', ar:'اكتب سؤالك لـ Mimo…', he:'כתוב שאלה ל-Mimo…', az:'Mimo-ya sualını yaz…', fa:'سوالت را از Mimo بپرس…', es:'Escribe tu pregunta a Mimo…', it:'Scrivi la tua domanda a Mimo…', pt:'Escreva sua pergunta para Mimo…', hr:'Upiši pitanje za Mima…', hu:'Írd be kérdésedet Mimónak…', bs:'Upiši pitanje za Mima…', zh:'向 Mimo 提问…', ja:'Mimoに質問を入力…', ko:'Mimo에게 질문을 입력해…', hi:'Mimo से अपना सवाल पूछो…', bn:'Mimo-কে তোমার প্রশ্ন লেখো…', id:'Tulis pertanyaan untuk Mimo…' },
    send: { tr:'Gönder', en:'Send', ru:'Отправить', uk:'Надіслати', de:'Senden', fr:'Envoyer', nl:'Verstuur', ar:'إرسال', he:'שליחה', az:'Göndər', fa:'ارسال', es:'Enviar', it:'Invia', pt:'Enviar', hr:'Pošalji', hu:'Küldés', bs:'Pošalji', zh:'发送', ja:'送信', ko:'전송', hi:'भेजें', bn:'পাঠান', id:'Kirim' },
    human: { tr:'İnsanla konuş', en:'Talk to a human', ru:'Связаться с командой', uk:'Зв’язатися з командою', de:'Mit Team sprechen', fr:'Parler à un humain', nl:'Spreek met een medewerker', ar:'التحدث مع موظف', he:'לדבר עם נציג', az:'İnsanla danış', fa:'گفتگو با کارشناس', es:'Hablar con una persona', it:'Parla con il team', pt:'Falar com atendimento', hr:'Razgovaraj s osobom', hu:'Beszélj munkatárssal', bs:'Razgovaraj s osobom', zh:'联系人工客服', ja:'スタッフに相談', ko:'상담원 연결', hi:'टीम से बात करो', bn:'মানুষের সাথে কথা বলো', id:'Bicara dengan tim' },
    emailPh: { tr:'E-posta adresin (yanıt için)', en:'Your email (for our reply)', ru:'Твой e-mail (для ответа)', uk:'Твій e-mail (для відповіді)', de:'Deine E-Mail (für die Antwort)', fr:'Ton e-mail (pour la réponse)', nl:'Je e-mailadres (voor antwoord)', ar:'بريدك الإلكتروني (للرد)', he:'הדוא״ל שלך (לתשובה)', az:'E-poçt ünvanın', fa:'ایمیلت (برای پاسخ)', es:'Tu correo (para responderte)', it:'La tua e-mail (per rispondere)', pt:'Seu e-mail (para resposta)', hr:'Tvoj e-mail (za odgovor)', hu:'E-mail címed (a válaszhoz)', bs:'Tvoj e-mail (za odgovor)', zh:'你的邮箱（用于回复）', ja:'メールアドレス（返信用）', ko:'이메일 주소(회신용)', hi:'तुम्हारा ईमेल (जवाब के लिए)', bn:'তোমার ইমেইল (উত্তরের জন্য)', id:'Email kamu (untuk balasan)' },
    forwardBtn: { tr:'Ekibe ilet', en:'Forward to team', ru:'Отправить', uk:'Надіслати', de:'Weiterleiten', fr:'Transmettre', nl:'Doorsturen', ar:'إرسال للفريق', he:'שלח לצוות', az:'Komandaya göndər', fa:'ارسال به تیم', es:'Enviar al equipo', it:'Inoltra al team', pt:'Enviar à equipe', hr:'Proslijedi timu', hu:'Továbbítás', bs:'Proslijedi timu', zh:'转发给团队', ja:'チームへ送信', ko:'팀에 전달', hi:'टीम को भेजें', bn:'টিমকে পাঠান', id:'Kirim ke tim' },
    yesForward: { tr:'Evet, ilet', en:'Yes, forward', ru:'Да, передать', uk:'Так, передати', de:'Ja, weiterleiten', fr:'Oui, transmettre', nl:'Ja, stuur door', ar:'نعم، أرسلها', he:'כן, להעביר', az:'Bəli, göndər', fa:'بله، ارسال کن', es:'Sí, enviar', it:'Sì, inoltra', pt:'Sim, encaminhar', hr:'Da, proslijedi', hu:'Igen, továbbítsd', bs:'Da, proslijedi', zh:'是的，请转发', ja:'はい、引き継ぐ', ko:'네, 전달해 줘', hi:'हाँ, भेजें', bn:'হ্যাঁ, পাঠান', id:'Ya, teruskan' },
    noThanks: { tr:'Hayır, teşekkürler', en:'No thanks', ru:'Нет, спасибо', uk:'Ні, дякую', de:'Nein, danke', fr:'Non merci', nl:'Nee, bedankt', ar:'لا، شكرًا', he:'לא, תודה', az:'Xeyr, təşəkkür', fa:'خیر، ممنون', es:'No, gracias', it:'No, grazie', pt:'Não, obrigado', hr:'Ne, hvala', hu:'Nem, köszönöm', bs:'Ne, hvala', zh:'不用了，谢谢', ja:'いいえ、結構です', ko:'아니요, 괜찮아요', hi:'नहीं, धन्यवाद', bn:'না, ধন্যবাদ', id:'Tidak, terima kasih' },
    close: { tr:'Kapat', en:'Close', ru:'Закрыть', uk:'Закрити', de:'Schließen', fr:'Fermer', nl:'Sluiten', ar:'إغلاق', he:'סגור', az:'Bağla', fa:'بستن', es:'Cerrar', it:'Chiudi', pt:'Fechar', hr:'Zatvori', hu:'Bezárás', bs:'Zatvori', zh:'关闭', ja:'閉じる', ko:'닫기', hi:'बंद करें', bn:'বন্ধ করুন', id:'Tutup' },
    forwarded: { tr:'Sohbetin info@bosphorly.com adresine iletildi. En kısa sürede e-posta ile dönüş yapacağız.', en:'Your conversation was forwarded to info@bosphorly.com. We will reply by email shortly.', ru:'Переписка отправлена на info@bosphorly.com. Мы скоро ответим по e-mail.', uk:'Розмову надіслано на info@bosphorly.com. Ми скоро відповімо електронною поштою.', de:'Deine Nachricht wurde an info@bosphorly.com weitergeleitet. Wir antworten in Kürze per E-Mail.', fr:'Ta conversation a été transmise à info@bosphorly.com. Nous te répondrons vite par e-mail.', nl:'Je gesprek is doorgestuurd naar info@bosphorly.com. We reageren spoedig per e-mail.', ar:'تم إرسال محادثتك إلى info@bosphorly.com. سنرد عليك عبر البريد الإلكتروني قريبًا.', he:'השיחה הועברה אל info@bosphorly.com. נחזור אליך בדוא״ל בהקדם.', az:'Söhbətin info@bosphorly.com ünvanına göndərildi.', fa:'گفتگویت به info@bosphorly.com ارسال شد. به‌زودی پاسخ می‌دهیم.', es:'Tu conversación se envió a info@bosphorly.com. Responderemos por correo pronto.', it:'La conversazione è stata inoltrata a info@bosphorly.com. Risponderemo via e-mail.', pt:'Sua conversa foi enviada para info@bosphorly.com. Responderemos por e-mail em breve.', hr:'Razgovor je proslijeđen na info@bosphorly.com.', hu:'A beszélgetést továbbítottuk a info@bosphorly.com címre.', bs:'Razgovor je proslijeđen na info@bosphorly.com.', zh:'你的对话已转发至 info@bosphorly.com，我们会尽快邮件回复。', ja:'会話内容を info@bosphorly.com に送信したよ。まもなくメールで返信するね。', ko:'대화 내용이 info@bosphorly.com으로 전달되었어요. 곧 이메일로 회신드릴게요.', hi:'तुम्हारी बातचीत info@bosphorly.com पर भेज दी गई है।', bn:'তোমার কথোপকথন info@bosphorly.com-এ পাঠানো হয়েছে।', id:'Percakapan kamu sudah diteruskan ke info@bosphorly.com.' },
    verifyFirst: { tr:'Lütfen önce güvenlik doğrulamasını tamamla.', en:'Please complete the security check first.', ru:'Пожалуйста, сначала пройди проверку безопасности.', uk:'Будь ласка, спочатку пройди перевірку безпеки.', de:'Bitte schließe zuerst die Sicherheitsprüfung ab.', fr:'Complète d’abord la vérification de sécurité.', nl:'Voltooi eerst de beveiligingscontrole.', ar:'يرجى إكمال التحقق الأمني أولاً.', he:'נא להשלים תחילה את בדיקת האבטחה.', az:'Zəhmət olmasa təhlükəsizlik yoxlamasını tamamla.', fa:'لطفاً ابتدا بررسی امنیتی را تکمیل کن.', es:'Completa primero la verificación de seguridad.', it:'Completa prima la verifica di sicurezza.', pt:'Conclua primeiro a verificação de segurança.', hr:'Molimo dovrši sigurnosnu provjeru.', hu:'Kérjük, először végezd el a biztonsági ellenőrzést.', bs:'Molimo dovrši sigurnosnu provjeru.', zh:'请先完成安全验证。', ja:'先にセキュリティ確認を完了してね。', ko:'먼저 보안 확인을 완료해 주세요.', hi:'कृपया पहले सुरक्षा जांच पूरी करो।', bn:'অনুগ্রহ করে প্রথমে নিরাপত্তা যাচাই সম্পন্ন করো।', id:'Harap selesaikan pemeriksaan keamanan dulu ya.' },
    offline: { tr:'Mimo şu an çevrimdışı; soruların için info@bosphorly.com adresine yazabilirsin.', en:'Mimo is currently offline; please email info@bosphorly.com for help.', ru:'Mimo сейчас недоступен; напиши на info@bosphorly.com.', uk:'Mimo зараз недоступний; напиши на info@bosphorly.com.', de:'Mimo ist offline; schreib uns an info@bosphorly.com.', fr:'Mimo est hors ligne ; écris à info@bosphorly.com.', nl:'Mimo is offline; mail naar info@bosphorly.com.', ar:'Mimo غير متصل حاليًا؛ يرجى مراسلة info@bosphorly.com.', he:'Mimo לא זמין כרגע; כתוב ל-info@bosphorly.com.', az:'Mimo hazırda oflayndır; info@bosphorly.com ünvanına yaz.', fa:'Mimo آفلاین است؛ لطفاً به info@bosphorly.com ایمیل بزن.', es:'Mimo está desconectado; escribe a info@bosphorly.com.', it:'Mimo non è disponibile; scrivi a info@bosphorly.com.', pt:'Mimo está offline; escreva para info@bosphorly.com.', hr:'Mimo je izvan mreže; piši na info@bosphorly.com.', hu:'Mimo jelenleg offline; írj a info@bosphorly.com címre.', bs:'Mimo je van mreže; piši na info@bosphorly.com.', zh:'Mimo 当前离线，请发送邮件至 info@bosphorly.com。', ja:'Mimoは現在オフラインです。info@bosphorly.com までメールで連絡してね。', ko:'Mimo가 현재 오프라인이에요. info@bosphorly.com으로 문의해 주세요.', hi:'Mimo अभी ऑफ़लाइन है; info@bosphorly.com पर ईमेल करो।', bn:'Mimo এখন অফলাইন; info@bosphorly.com-এ ইমেইল করো।', id:'Mimo sedang offline; silakan email ke info@bosphorly.com.' },
    continueTg: { tr:"Telegram'dan devam et", en:'Continue on Telegram', ru:'Продолжить в Telegram', uk:'Продовжити в Telegram', de:'Auf Telegram fortsetzen', fr:'Continuer sur Telegram', nl:'Ga verder op Telegram', ar:'تابع على تيليجرام', he:'המשך בטלגרם', az:'Telegram-da davam et', fa:'در تلگرام ادامه بده', es:'Continuar en Telegram', it:'Continua su Telegram', pt:'Continuar no Telegram', hr:'Nastavi na Telegramu', hu:'Folytatás Telegramon', bs:'Nastavi na Telegramu', zh:'在 Telegram 继续对话', ja:'Telegramで続ける', ko:'Telegram에서 계속하기', hi:'Telegram पर जारी रखो', bn:'Telegram-এ চালিয়ে যাও', id:'Lanjutkan di Telegram' },
    kindNote: { tr:'Mimo’ya nazik davrandığın için teşekkürler 💙 Saygısız dil kullanılırsa sohbet sonlanır.', en:'Thank you for being kind to Mimo 💙 The chat ends if disrespectful language is used.', ru:'Спасибо за вежливое общение с Mimo 💙 При неуважительном тоне чат завершается.', uk:'Дякуємо за ввічливе спілкування з Mimo 💙 У разі неповажного тону чат завершується.', de:'Danke, dass du freundlich zu Mimo bist 💙 Bei respektloser Sprache wird der Chat beendet.', fr:'Merci d’être bienveillant avec Mimo 💙 Le chat prend fin en cas de langage irrespectueux.', nl:'Bedankt dat je vriendelijk bent tegen Mimo 💙 Bij respectloos taalgebruik stopt de chat.', ar:'شكرًا للطفك مع Mimo 💙 تنتهي المحادثة في حال استخدام لغة غير محترمة.', he:'תודה שאתם נחמדים אל Mimo 💙 השיחה מסתיימת במקרה של שפה לא מכבדת.', az:'Mimo ilə nəzakətli davrandığın üçün təşəkkürlər 💙 Hörmətsiz ifadələr işlədilərsə söhbət sonlanır.', fa:'ممنون که با Mimo مهربان هستید 💙 در صورت استفاده از لحن نامحترمانه گفتگو پایان می‌یابد.', es:'Gracias por tratar con amabilidad a Mimo 💙 El chat finaliza si se usa lenguaje irrespetuoso.', it:'Grazie per essere gentile con Mimo 💙 La chat termina in caso di linguaggio irrispettoso.', pt:'Obrigado por tratar o Mimo com gentileza 💙 O chat é encerrado se houver linguagem desrespeitosa.', hr:'Hvala što si ljubazan prema Mimu 💙 Razgovor se prekida u slučaju nepoštovanja.', hu:'Köszönjük, hogy kedves vagy Mimóval 💙 Tiszteletlen hangnem esetén a csevegés véget ér.', bs:'Hvala što si ljubazan prema Mimu 💙 Razgovor se prekida u slučaju nepoštovanja.', zh:'感谢你温柔对待 Mimo 💙 若使用不尊重的语言，对话将自动结束。', ja:'Mimoに優しく接していただきありがとうございます 💙 礼儀を欠く言葉遣いがあった場合、チャットは終了します。', ko:'Mimo에게 다정하게 대해 주셔서 고마워요 💙 무례한 표현이 사용되면 대화가 종료됩니다.', hi:'Mimo के साथ विनम्र रहने के लिए धन्यवाद 💙 अपमानजनक भाषा का प्रयोग होने पर चैट समाप्त हो जाएगी।', bn:'Mimo-এর সাথে সদয় আচরণের জন্য ধন্যবাদ 💙 অসম্মানজনক ভাষা ব্যবহার করলে চ্যাট বন্ধ হয়ে যাবে।', id:'Terima kasih telah bersikap ramah kepada Mimo 💙 Obrolan akan berakhir jika bahasa tidak sopan digunakan.' },
    abuseClose: { tr:'Bu dille konuşmaya devam edemem. Sohbeti burada sonlandırıyorum. Bir sorunun varsa info@bosphorly.com’a yazabilirsin.', en:'I cannot continue the conversation with this language. I am ending the chat here. If you have an issue, you can write to info@bosphorly.com.', ru:'Я не могу продолжать разговор в таком тоне. Завершаю чат здесь. Если у тебя есть вопрос, можешь написать на info@bosphorly.com.', uk:'Я не можу продовжувати розмову в такому тоні. Завершую чат тут. Якщо маєш питання, напиши на info@bosphorly.com.', de:'In diesem Ton kann ich das Gespräch nicht fortsetzen. Ich beende den Chat hier. Bei einem Anliegen kannst du an info@bosphorly.com schreiben.', fr:'Je ne peux pas poursuivre la conversation sur ce ton. Je mets fin au chat ici. En cas de problème, tu peux écrire à info@bosphorly.com.', nl:'Op deze toon kan ik het gesprek niet voortzetten. Ik beëindig de chat hier. Als je een vraag hebt, kun je mailen naar info@bosphorly.com.', ar:'لا يمكنني متابعة المحادثة بهذه اللغة. أنهي المحادثة هنا. إذا كانت لديك مشكلة يمكنك الكتابة إلى info@bosphorly.com.', he:'איני יכול להמשיך את השיחה בשפה כזו. אני מסיים את הצ׳אט כאן. אם יש לך פנייה, ניתן לכתוב אל info@bosphorly.com.', az:'Bu üslubla söhbəti davam etdirə bilmərəm. Söhbəti burada sonlandırıram. Sualın varsa info@bosphorly.com ünvanına yaza bilərsən.', fa:'با این لحن نمی‌توانم گفتگو را ادامه دهم. گفتگو را در اینجا پایان می‌دهم. اگر مشکلی داری می‌توانی به info@bosphorly.com بنویسی.', es:'No puedo continuar la conversación con este lenguaje. Termino el chat aquí. Si tienes algún problema, puedes escribir a info@bosphorly.com.', it:'Non posso continuare la conversazione con questo linguaggio. Chiudo qui la chat. Se hai un problema, puoi scrivere a info@bosphorly.com.', pt:'Não posso continuar a conversa com essa linguagem. Encerro o chat aqui. Se tiver alguma questão, escreva para info@bosphorly.com.', hr:'Ne mogu nastaviti razgovor ovakvim rječnikom. Ovdje završavam razgovor. Ako imaš pitanje, možeš pisati na info@bosphorly.com.', hu:'Ilyen hangnemben nem tudom folytatni a beszélgetést. A csevegést itt lezárom. Ha kérdésed van, írhatsz az info@bosphorly.com címre.', bs:'Ne mogu nastaviti razgovor ovakvim rječnikom. Ovdje završavam razgovor. Ako imaš pitanje, možeš pisati na info@bosphorly.com.', zh:'我无法在这样的语言下继续对话。本次对话到此结束。如有问题，请发邮件至 info@bosphorly.com。', ja:'このような言葉遣いでは会話を続けられません。ここでチャットを終了します。ご用件がある場合は info@bosphorly.com までご連絡ください。', ko:'이러한 표현으로는 대화를 이어갈 수 없습니다. 여기서 대화를 종료합니다. 문의 사항이 있으시면 info@bosphorly.com으로 메일을 보내주세요.', hi:'मैं इस भाषा में बातचीत जारी नहीं रख सकता। मैं यहीं चैट समाप्त कर रहा हूँ। किसी समस्या के लिए तुम info@bosphorly.com पर लिख सकते हो।', bn:'এই ভাষায় আমি কথোপকথন চালিয়ে যেতে পারব না। আমি এখানেই চ্যাট শেষ করছি। কোনো সমস্যা থাকলে info@bosphorly.com-এ লিখতে পারো।', id:'Saya tidak dapat melanjutkan percakapan dengan bahasa seperti ini. Saya mengakhiri obrolan di sini. Jika ada masalah, silakan tulis ke info@bosphorly.com.' },
    mic: { tr:'Sesle yaz', en:'Dictate', ru:'Надиктовать', uk:'Надиктувати', de:'Diktieren', fr:'Dicter', nl:'Dicteren', ar:'إملاء', he:'הכתבה', az:'Səslə yaz', fa:'دیکته', es:'Dictar', it:'Detta', pt:'Ditar', hr:'Diktiraj', hu:'Diktálás', bs:'Diktiranje', zh:'语音输入', ja:'音声入力', ko:'음성 입력', hi:'बोलकर लिखें', bn:'বলে লিখুন', id:'Dikte' },
    listening: { tr:'Dinliyorum…', en:'Listening…', ru:'Слушаю…', uk:'Слухаю…', de:'Ich höre zu…', fr:'J’écoute…', nl:'Ik luister…', ar:'أستمع…', he:'מאזינים…', az:'Dinləyirəm…', fa:'در حال شنیدن…', es:'Escuchando…', it:'Sto ascoltando…', pt:'Ouvindo…', hr:'Slušam…', hu:'Hallgatom…', bs:'Slušam…', zh:'正在听…', ja:'聞いています…', ko:'듣는 중…', hi:'सुन रहा हूँ…', bn:'শুনছি…', id:'Mendengarkan…' },
    micDenied: { tr:'Mikrofon izni verilmedi. İstersen sorunu yazarak gönderebilirsin.', en:'Microphone access was blocked. You can still type your question.', ru:'Доступ к микрофону закрыт. Вы можете написать вопрос текстом.', uk:'Доступ до мікрофона заборонено. Ви можете написати запитання текстом.', de:'Der Mikrofonzugriff wurde abgelehnt. Sie können Ihre Frage auch tippen.', fr:'L’accès au micro a été refusé. Vous pouvez écrire votre question.', nl:'Microfoontoegang is geweigerd. Je kunt je vraag ook typen.', ar:'تم رفض إذن الميكروفون. يمكنك كتابة سؤالك بدلًا من ذلك.', he:'הגישה למיקרופון נחסמה. אפשר עדיין להקליד את השאלה.', az:'Mikrofona icazə verilmədi. Sualınızı yazaraq da göndərə bilərsiniz.', fa:'اجازه میکروفون داده نشد. می‌توانید سؤالتان را تایپ کنید.', es:'Se bloqueó el acceso al micrófono. Aún puedes escribir tu pregunta.', it:'Accesso al microfono negato. Puoi comunque scrivere la domanda.', pt:'O acesso ao microfone foi bloqueado. Você ainda pode digitar a pergunta.', hr:'Pristup mikrofonu je odbijen. Pitanje i dalje možete upisati.', hu:'A mikrofonengedélyt elutasították. A kérdést be is gépelheti.', bs:'Pristup mikrofonu je odbijen. Pitanje i dalje možete upisati.', zh:'麦克风权限被拒绝。您仍可以直接输入问题。', ja:'マイクの使用が拒否されました。質問はキーボードから入力できます。', ko:'마이크 권한이 거부되었습니다. 질문을 직접 입력할 수도 있습니다.', hi:'माइक्रोफ़ोन की अनुमति नहीं मिली। आप सवाल टाइप भी कर सकते हैं।', bn:'মাইক্রোফোনের অনুমতি দেওয়া হয়নি। আপনি প্রশ্নটি লিখেও পাঠাতে পারেন।', id:'Akses mikrofon ditolak. Anda tetap bisa mengetik pertanyaan.' },
    micFailed: { tr:'Sesi yazıya çeviremedim. İstersen sorunu yazarak gönderebilirsin.', en:'I could not turn that into text. You can still type your question.', ru:'Не удалось распознать речь. Вы можете написать вопрос текстом.', uk:'Не вдалося розпізнати мовлення. Ви можете написати запитання текстом.', de:'Die Sprache konnte nicht in Text umgewandelt werden. Sie können Ihre Frage auch tippen.', fr:'Impossible de transcrire la voix. Vous pouvez écrire votre question.', nl:'De spraak kon niet naar tekst worden omgezet. Je kunt je vraag ook typen.', ar:'تعذّر تحويل الصوت إلى نص. يمكنك كتابة سؤالك.', he:'לא הצלחנו להפוך את הדיבור לטקסט. אפשר להקליד את השאלה.', az:'Səsi mətnə çevirə bilmədim. Sualınızı yazaraq göndərə bilərsiniz.', fa:'نتوانستم صدا را به متن تبدیل کنم. می‌توانید سؤالتان را تایپ کنید.', es:'No pude convertir la voz en texto. Aún puedes escribir tu pregunta.', it:'Non sono riuscito a trasformare la voce in testo. Puoi scrivere la domanda.', pt:'Não consegui transformar a voz em texto. Você ainda pode digitar a pergunta.', hr:'Nisam uspio pretvoriti glas u tekst. Pitanje i dalje možete upisati.', hu:'Nem sikerült szöveggé alakítani a beszédet. A kérdést be is gépelheti.', bs:'Nisam uspio pretvoriti glas u tekst. Pitanje i dalje možete upisati.', zh:'无法将语音转成文字。您仍可以直接输入问题。', ja:'音声を文字にできませんでした。質問はキーボードから入力できます。', ko:'음성을 텍스트로 바꾸지 못했습니다. 질문을 직접 입력할 수도 있습니다.', hi:'आवाज़ को टेक्स्ट में नहीं बदल सका। आप सवाल टाइप भी कर सकते हैं।', bn:'কথা লেখায় রূপান্তর করা যায়নি। আপনি প্রশ্নটি লিখেও পাঠাতে পারেন।', id:'Suara tidak bisa diubah menjadi teks. Anda tetap bisa mengetik pertanyaan.' },
    micTooBig: { tr:'Ses kaydı en fazla 30 saniye ve 1 MB olabilir.', en:'A recording can be at most 30 seconds and 1 MB.', ru:'Запись — не длиннее 30 секунд и не больше 1 МБ.', uk:'Запис — не довший за 30 секунд і не більший за 1 МБ.', de:'Eine Aufnahme darf höchstens 30 Sekunden und 1 MB groß sein.', fr:'Un enregistrement ne peut pas dépasser 30 secondes ni 1 Mo.', nl:'Een opname mag maximaal 30 seconden en 1 MB zijn.', ar:'التسجيل يجب ألا يتجاوز 30 ثانية أو 1 ميغابايت.', he:'הקלטה יכולה להיות עד 30 שניות ו-1MB.', az:'Səs yazısı ən çox 30 saniyə və 1 MB ola bilər.', fa:'ضبط صدا حداکثر ۳۰ ثانیه و ۱ مگابایت است.', es:'La grabación puede durar como máximo 30 segundos y pesar 1 MB.', it:'La registrazione può durare al massimo 30 secondi e pesare 1 MB.', pt:'A gravação pode ter no máximo 30 segundos e 1 MB.', hr:'Snimka može trajati najviše 30 sekundi i imati 1 MB.', hu:'A felvétel legfeljebb 30 másodperc és 1 MB lehet.', bs:'Snimak može trajati najviše 30 sekundi i imati 1 MB.', zh:'录音最长 30 秒，且不超过 1 MB。', ja:'録音は30秒以内、1MBまでです。', ko:'녹음은 최대 30초, 1MB까지입니다.', hi:'रिकॉर्डिंग अधिकतम 30 सेकंड और 1 MB हो सकती है।', bn:'রেকর্ডিং সর্বোচ্চ ৩০ সেকেন্ড এবং ১ এমবি হতে পারে।', id:'Rekaman paling lama 30 detik dan 1 MB.' }
  };
  const tr = (k) => (UI[k] && (UI[k][lang] || UI[k].en)) || '';

  const getIstanbulTimeGreeting = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', hour: 'numeric', hour12: false }).formatToParts(new Date());
      const hPart = parts.find((p) => p.type === 'hour');
      const hour = hPart ? Number(hPart.value) % 24 : 12;
      if (hour >= 5 && hour < 12) return tr('morning');
      if (hour >= 12 && hour < 18) return tr('afternoon');
      return tr('evening');
    } catch {
      return tr('afternoon');
    }
  };

  const getMemberNameFromBrowser = () => {
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

  const detectPageContextMessage = () => {
    const path = (location.pathname || '').toLowerCase();
    const hash = (location.hash || '').toLowerCase();
    const sp = new URLSearchParams(location.search);
    const service = (sp.get('service') || '').toLowerCase();
    if (service.startsWith('alaturka') || service.includes('hamam') || service.includes('hammam') || path.includes('hamam') || path.includes('hammam') || hash.includes('wellness') || hash.includes('hamam')) {
      return tr('ctxHammam');
    }
    if (path.includes('airport-transfer') || path.includes('havalimani-transferi') || hash === '#booking' || service.includes('transfer')) {
      return tr('ctxTransfer');
    }
    if (path.includes('tours.html') || path.includes('prices.html') || path.includes('bosphorus-cruises') || path.includes('bogaz-turlari') || path.includes('booking.html')) {
      return tr('ctxTour');
    }
    return '';
  };

  const buildInitialWelcome = () => {
    const memberName = getMemberNameFromBrowser();
    const ctxMsg = detectPageContextMessage();
    const parts = [];
    if (memberName) {
      parts.push(tr('memberWelcome').replace('{name}', memberName));
    } else {
      parts.push(getIstanbulTimeGreeting() + '!');
    }
    parts.push(tr('welcome'));
    if (ctxMsg) parts.push(ctxMsg);
    return parts.join(' ');
  };

  const STORE_KEY = 'bosphorly.assistant_chat';
  const SESSION_ID_KEY = 'bosphorly.assistant_session';
  const CLOSED_KEY = 'bosphorly.assistant_closed';
  const CHAT_SESSION_KEY = 'bosphorly.assistant_chat_session';
  let history = [];
  let sessionId = '';
  let isChatClosed = false;
  try {
    const saved = sessionStorage.getItem(STORE_KEY);
    if (saved) history = JSON.parse(saved);
    if (!Array.isArray(history)) history = [];
  } catch { history = []; }
  try {
    sessionId = sessionStorage.getItem(SESSION_ID_KEY) || '';
    if (!sessionId) {
      sessionId = 's_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_ID_KEY, sessionId);
    }
    isChatClosed = sessionStorage.getItem(CLOSED_KEY) === '1';
  } catch {
    sessionId = 's_' + Math.random().toString(36).slice(2, 10);
  }
  const saveHistory = () => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history.slice(-12))); } catch {}
  };
  let chatSession = '';
  try { chatSession = sessionStorage.getItem(CHAT_SESSION_KEY) || ''; } catch { chatSession = ''; }
  const saveChatSession = (tok) => {
    chatSession = typeof tok === 'string' ? tok : '';
    try {
      if (chatSession) sessionStorage.setItem(CHAT_SESSION_KEY, chatSession);
      else sessionStorage.removeItem(CHAT_SESSION_KEY);
    } catch {}
  };

  const rawBot = window.BOSPHORLY_API && window.BOSPHORLY_API.telegramBot;
  const tgBot = typeof rawBot === 'string' ? rawBot.trim().replace(/^@+/, '') : '';
  const tgUrl = window.BosphorlyTelegram
    ? window.BosphorlyTelegram.url(lang)
    : (tgBot ? `https://t.me/${encodeURIComponent(tgBot)}?start=${encodeURIComponent(lang)}` : '');
  const chatScript = document.currentScript || document.querySelector('script[src*="assistant-chat.js"]');
  const assetBase = chatScript && chatScript.src ? new URL('.', chatScript.src).href : (window.BOSPHORLY_BASE || '');
  const tgBarHtml = tgUrl
    ? `<div class="bc-tg-bar"><a class="bc-tg-link" href="${tgUrl}" target="_blank" rel="noopener"><img class="bc-tg-ico" src="${assetBase}assets/brand/telegram.svg" alt="" aria-hidden="true" width="18" height="18" loading="lazy" decoding="async"><span>${tr('continueTg')}</span></a></div>`
    : '';
  const mimoSrc = (stateName = 'default') => `${base}assets/brand/mimo/mimo-${stateName}.svg`;

  const panel = document.createElement('section');
  panel.className = 'bc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', tr('title'));
  if (isRtl) panel.setAttribute('dir', 'rtl');
  panel.innerHTML =
    `<div class="bc-head"><div class="bc-head-info"><img class="bc-head-avatar" src="${mimoSrc('default')}" alt="Mimo" width="36" height="36" loading="lazy" decoding="async">` +
    `<div><div class="bc-title">${tr('title')}</div><div class="bc-sub">${tr('sub')}</div></div></div>` +
    `<button type="button" class="bc-close" aria-label="${tr('close')}">×</button></div>` +
    tgBarHtml +
    `<div class="bc-log" aria-live="polite"></div>` +
    `<div class="bc-quick">` +
    `<button type="button" class="bc-quick-btn" data-q="transfer">${tr('qTransfer')}</button>` +
    `<button type="button" class="bc-quick-btn" data-q="cruise">${tr('qCruise')}</button>` +
    `<button type="button" class="bc-quick-btn" data-q="hammam">${tr('qHammam')}</button>` +
    `<button type="button" class="bc-quick-btn" data-q="plan">${tr('qPlan')}</button>` +
    `</div>` +
    `<div class="bc-handoff" hidden><div class="bc-handoff-row"><input type="email" placeholder="${tr('emailPh')}" autocomplete="email">` +
    `<button type="button" class="bc-forward-btn">${tr('forwardBtn')}</button></div></div>` +
    `<div class="bc-actions"><button type="button" class="bc-human-btn">💬 ${tr('human')}</button></div>` +
    `<p class="bc-listen" hidden></p><p class="bc-mic-note" hidden></p>` +
    `<form class="bc-form"><input class="bc-input" type="text" maxlength="1000" placeholder="${tr('placeholder')}" autocomplete="off">` +
    `<button type="button" class="bc-mic" aria-label="${tr('mic')}" aria-pressed="false">🎤</button>` +
    `<button class="bc-send" type="submit">${tr('send')}</button></form>` +
    `<div class="bc-turnstile" hidden></div>`;
  document.body.appendChild(panel);

  const headAvatar = panel.querySelector('.bc-head-avatar');
  const logEl = panel.querySelector('.bc-log');
  const quickEl = panel.querySelector('.bc-quick');
  const closeBtn = panel.querySelector('.bc-close');
  const tsMount = panel.querySelector('.bc-turnstile');
  const handoffBox = panel.querySelector('.bc-handoff');
  const emailInput = handoffBox.querySelector('input');
  const forwardBtn = handoffBox.querySelector('.bc-forward-btn');
  const humanBtn = panel.querySelector('.bc-human-btn');
  const form = panel.querySelector('.bc-form');
  const input = panel.querySelector('.bc-input');
  const sendBtn = panel.querySelector('.bc-send');
  const apiBase = window.BOSPHORLY_API && window.BOSPHORLY_API.base;
  const micBtn = panel.querySelector('.bc-mic');
  const listenEl = panel.querySelector('.bc-listen');
  const micNote = panel.querySelector('.bc-mic-note');
  listenEl.textContent = tr('listening');

  let turnstileToken = '';
  let tsWidgetId = null;
  let tsRendered = false;
  let tsInFlight = false;
  let tsWaiters = [];
  let tsScriptLoading = false;

  function lockChatClosed() {
    isChatClosed = true;
    try { sessionStorage.setItem(CLOSED_KEY, '1'); } catch {}
    panel.dataset.closed = 'true';
    panel.classList.add('bc-is-closed');
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    humanBtn.disabled = true;
    forwardBtn.disabled = true;
    emailInput.disabled = true;
    handoffBox.hidden = true;
    panel.querySelectorAll('.bc-quick-btn, .bc-offer-btn').forEach((btn) => {
      btn.disabled = true;
    });
  }

  async function sendFeedback(vote, upBtn, downBtn) {
    upBtn.disabled = true;
    downBtn.disabled = true;
    if (vote === 'up') upBtn.classList.add('active');
    else downBtn.classList.add('active');
    if (!apiBase) return;
    const postFeedback = (authPayload) => fetch(`${apiBase}/v1/assistant/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote, lang, ...authPayload }),
    });
    try {
      const res = await postFeedback(chatSession ? { chatSession } : {});
      if (res.status === 403 && chatSession) {
        saveChatSession('');
        const freshTok = await refreshTurnstileToken();
        if (freshTok) {
          turnstileToken = '';
          const retryRes = await postFeedback({ turnstileToken: freshTok });
          const retryData = await retryRes.json().catch(() => ({}));
          if (retryRes.ok && retryData && typeof retryData.chatSession === 'string' && retryData.chatSession) {
            saveChatSession(retryData.chatSession);
          }
        }
        return;
      }
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && typeof data.chatSession === 'string' && data.chatSession) {
          saveChatSession(data.chatSession);
        }
      }
    } catch {}
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isAllowedHref(rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
      const host = u.hostname.toLowerCase();
      if (host === 'bosphorly.com' || host === 'www.bosphorly.com') return true;
      if (host === 't.me' && /^\/BosphorlyBot\/?$/i.test(u.pathname)) return true;
      return false;
    } catch {
      return false;
    }
  }

  function renderBotHtml(text) {
    const escaped = escapeHtml(text);
    const placeholders = [];
    const makeAnchor = (escapedUrl, escapedLabel) => {
      const candidate = escapedUrl
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      if (!isAllowedHref(candidate)) {
        return escapedLabel && escapedLabel !== escapedUrl ? `${escapedLabel} (${escapedUrl})` : escapedUrl;
      }
      const token = `\u0000L${placeholders.length}\u0000`;
      placeholders.push(`<a href="${escapedUrl}" target="_blank" rel="noopener">${escapedLabel || escapedUrl}</a>`);
      return token;
    };

    let out = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)<]+)\)/gi, (_, label, url) => makeAnchor(url, label));
    out = out.replace(/https?:\/\/[^\s<>\u0000]+/gi, (match) => {
      let clean = match;
      let tail = '';
      const trailing = clean.match(/(?:&quot;|&#39;|&lt;|&gt;|[).,!?;:])+$/);
      if (trailing) {
        clean = clean.slice(0, -trailing[0].length);
        tail = trailing[0];
      }
      if (!clean) return match;
      return makeAnchor(clean, clean) + tail;
    });
    out = out.replace(/\*\*([^\n*][^*\n]*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\r?\n/g, '<br>');
    return out.replace(/\u0000L(\d+)\u0000/g, (_, idx) => placeholders[Number(idx)] || '');
  }

  function setBotMessageBody(div, text, opts = {}) {
    div.innerHTML = renderBotHtml(text);
    if (opts.handoffOffer && !isChatClosed) {
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
  }

  function appendFeedbackBar(wrap) {
    if (!wrap || wrap.querySelector('.bc-feedback')) return;
    const fb = document.createElement('div');
    fb.className = 'bc-feedback';
    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'bc-rate-btn';
    upBtn.dataset.vote = 'up';
    upBtn.setAttribute('aria-label', '👍');
    upBtn.textContent = '👍';
    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'bc-rate-btn';
    downBtn.dataset.vote = 'down';
    downBtn.setAttribute('aria-label', '👎');
    downBtn.textContent = '👎';
    upBtn.addEventListener('click', () => sendFeedback('up', upBtn, downBtn));
    downBtn.addEventListener('click', () => sendFeedback('down', upBtn, downBtn));
    fb.append(upBtn, downBtn);
    wrap.appendChild(fb);
  }

  function renderMsg(role, text, opts = {}) {
    if (role === 'user') quickEl.classList.add('bc-quick-scroll');
    const isFirstBotMsg = role === 'bot' && !logEl.querySelector('.bc-msg-row.bot');
    const row = document.createElement('div');
    row.className = `bc-msg-row ${role === 'user' ? 'user' : 'bot'}`;

    const div = document.createElement('div');
    div.className = `bc-msg ${role === 'user' ? 'user' : 'bot'}`;

    let av = null;
    let wrap = null;
    if (role === 'bot') {
      av = document.createElement('img');
      av.className = 'bc-bot-avatar';
      av.src = mimoSrc(opts.avatarState || 'happy');
      av.alt = 'Mimo';
      av.width = 28;
      av.height = 28;
      av.loading = 'lazy';
      av.decoding = 'async';

      wrap = document.createElement('div');
      wrap.className = 'bc-msg-wrap';

      setBotMessageBody(div, text, opts);
      wrap.appendChild(div);
      if (!opts.noFeedback) appendFeedbackBar(wrap);

      row.append(av, wrap);
    } else {
      div.textContent = text;
      row.appendChild(div);
    }
    logEl.appendChild(row);
    if (isFirstBotMsg && !logEl.querySelector('.bc-kind-note')) {
      const note = document.createElement('div');
      note.className = 'bc-kind-note';
      note.textContent = tr('kindNote');
      logEl.appendChild(note);
    }
    logEl.scrollTop = logEl.scrollHeight;
    return { row, div, wrap, av };
  }

  let typingRow = null;
  let typingTimer = null;
  function showTyping() {
    if (typingRow) return;
    headAvatar.src = mimoSrc('thinking');
    typingRow = document.createElement('div');
    typingRow.className = 'bc-typing';

    const av = document.createElement('img');
    av.className = 'bc-bot-avatar';
    av.src = mimoSrc('thinking');
    av.alt = 'Mimo';
    av.width = 28;
    av.height = 28;
    av.loading = 'lazy';
    av.decoding = 'async';

    const bubble = document.createElement('div');
    bubble.className = 'bc-typing-bubble';

    const dots = document.createElement('span');
    dots.className = 'bc-dots';
    for (let i = 0; i < 3; i++) {
      const d = document.createElement('span');
      d.className = 'bc-dot';
      dots.appendChild(d);
    }

    const label = document.createElement('span');
    label.className = 'bc-typing-label';
    label.textContent = tr('typing');

    bubble.append(dots, label);
    typingRow.append(av, bubble);
    logEl.appendChild(typingRow);
    logEl.scrollTop = logEl.scrollHeight;

    const thinkDelay = Number(window.__BOSPHORLY_MIMO_THINK_MS) > 0 ? Number(window.__BOSPHORLY_MIMO_THINK_MS) : 8000;
    typingTimer = setTimeout(() => {
      if (typingRow && label.isConnected) {
        label.textContent = tr('thinkingLong');
      }
    }, thinkDelay);
  }

  function hideTyping() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    if (typingRow) {
      typingRow.remove();
      typingRow = null;
    }
    headAvatar.src = mimoSrc('happy');
  }

  if (!history.length) {
    renderMsg('bot', buildInitialWelcome(), { avatarState: 'hello' });
  } else {
    for (const m of history) renderMsg(m.role === 'user' ? 'user' : 'bot', m.content);
  }
  if (isChatClosed) lockChatClosed();

  function resolveTurnstileWaiters(tok) {
    const list = tsWaiters;
    tsWaiters = [];
    for (const resolve of list) resolve(tok || '');
  }

  function renderTurnstileWidget() {
    const siteKey = window.BOSPHORLY_API && window.BOSPHORLY_API.turnstileSiteKey;
    if (!siteKey || !window.turnstile || tsRendered) return;
    tsMount.hidden = true;
    tsInFlight = true;
    tsRendered = true;
    try {
      tsWidgetId = window.turnstile.render(tsMount, {
        sitekey: siteKey,
        theme: 'light',
        appearance: 'interaction-only',
        callback: (tok) => {
          tsInFlight = false;
          tsMount.hidden = true;
          turnstileToken = tok || '';
          resolveTurnstileWaiters(turnstileToken);
        },
        'before-interactive-callback': () => {
          tsMount.hidden = false;
        },
        'after-interactive-callback': () => {
          tsMount.hidden = true;
        },
        'expired-callback': () => {
          tsInFlight = false;
          turnstileToken = '';
          if (!panel.hidden && !chatSession && window.turnstile && tsRendered) {
            tsInFlight = true;
            try {
              if (tsWidgetId !== null && tsWidgetId !== undefined) window.turnstile.reset(tsWidgetId);
              else window.turnstile.reset();
            } catch {
              tsInFlight = false;
            }
          }
        },
        'error-callback': () => {
          tsInFlight = false;
          turnstileToken = '';
          tsMount.hidden = true;
          resolveTurnstileWaiters('');
        },
      });
    } catch {
      tsInFlight = false;
      tsRendered = false;
      tsWidgetId = null;
      resolveTurnstileWaiters('');
    }
  }

  function loadTurnstile() {
    const siteKey = window.BOSPHORLY_API && window.BOSPHORLY_API.turnstileSiteKey;
    if (!siteKey) return;
    if (window.turnstile) { renderTurnstileWidget(); return; }
    const existing = document.querySelector('script[data-bc-turnstile]');
    if (existing) {
      if (!tsScriptLoading) {
        tsScriptLoading = true;
        existing.addEventListener('load', () => { tsScriptLoading = false; renderTurnstileWidget(); }, { once: true });
        existing.addEventListener('error', () => { tsScriptLoading = false; existing.remove(); resolveTurnstileWaiters(''); }, { once: true });
      }
      return;
    }
    tsScriptLoading = true;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.dataset.bcTurnstile = '1';
    s.onload = () => { tsScriptLoading = false; renderTurnstileWidget(); };
    s.onerror = () => { tsScriptLoading = false; s.remove(); resolveTurnstileWaiters(''); };
    document.head.appendChild(s);
  }

  function waitForNextTurnstileToken(timeoutMs = 30000) {
    return new Promise((resolve) => {
      let done = false;
      let timer = null;
      const finish = (tok) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        resolve(tok || '');
      };
      timer = setTimeout(() => {
        tsWaiters = tsWaiters.filter((fn) => fn !== finish);
        finish('');
      }, timeoutMs);
      tsWaiters.push(finish);
    });
  }

  async function refreshTurnstileToken() {
    const siteKey = window.BOSPHORLY_API && window.BOSPHORLY_API.turnstileSiteKey;
    if (!siteKey) return '';
    turnstileToken = '';
    tsMount.hidden = true;
    const wait = waitForNextTurnstileToken();
    if (window.turnstile && tsRendered) {
      tsInFlight = true;
      try {
        if (tsWidgetId !== null && tsWidgetId !== undefined) window.turnstile.reset(tsWidgetId);
        else window.turnstile.reset();
      } catch {
        tsInFlight = false;
        tsRendered = false;
        tsWidgetId = null;
        loadTurnstile();
      }
    } else {
      loadTurnstile();
    }
    return wait;
  }

  async function ensureTurnstileToken() {
    const siteKey = window.BOSPHORLY_API && window.BOSPHORLY_API.turnstileSiteKey;
    if (!siteKey) return '';
    if (turnstileToken) return turnstileToken;
    if (window.turnstile && tsRendered && !tsInFlight) {
      return refreshTurnstileToken();
    }
    const wait = waitForNextTurnstileToken();
    loadTurnstile();
    return wait;
  }

  async function submitMessage(rawMessage) {
    const message = String(rawMessage || '').trim();
    if (!message || sendBtn.disabled || isChatClosed) return;
    if (!apiBase) {
      renderMsg('user', message);
      input.value = '';
      renderMsg('bot', tr('offline'));
      return;
    }
    const siteKey = window.BOSPHORLY_API && window.BOSPHORLY_API.turnstileSiteKey;
    const alreadyGreeted = Boolean(logEl.querySelector('.bc-msg-row.bot'));
    renderMsg('user', message);
    input.value = '';
    sendBtn.disabled = true;
    showTyping();
    const recent = history.slice(-6);
    const postAssistant = (authPayload) => fetch(`${apiBase}/v1/assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
      },
      body: JSON.stringify({
        message,
        lang,
        history: recent,
        sessionId,
        greeted: alreadyGreeted,
        stream: true,
        ...authPayload,
      }),
    });

    let streamMsg = null;
    let streamText = '';
    const readAssistantResponse = async (res) => {
      const ct = (res && res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : '') || '';
      if (!ct.toLowerCase().includes('text/event-stream') || !res.body || typeof res.body.getReader !== 'function') {
        return await res.json().catch(() => ({}));
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let eventName = 'message';
      let finalData = null;
      const processLine = (line) => {
        const cleanLine = line.replace(/\r$/, '');
        if (!cleanLine) {
          eventName = 'message';
          return;
        }
        if (cleanLine.startsWith('event:')) {
          eventName = cleanLine.slice(6).trim();
          return;
        }
        if (!cleanLine.startsWith('data:')) return;
        const raw = cleanLine.slice(5).trim();
        if (!raw) return;
        let payload = null;
        try { payload = JSON.parse(raw); } catch { return; }
        if (eventName === 'session' && payload && typeof payload.chatSession === 'string' && payload.chatSession) {
          saveChatSession(payload.chatSession);
        } else if (eventName === 'delta' && payload && typeof payload.t === 'string' && payload.t) {
          if (!streamMsg) {
            hideTyping();
            streamMsg = renderMsg('bot', '', { noFeedback: true, avatarState: 'thinking' });
            headAvatar.src = mimoSrc('thinking');
          }
          streamText += payload.t;
          setBotMessageBody(streamMsg.div, streamText);
          logEl.scrollTop = logEl.scrollHeight;
        } else if (eventName === 'done' && payload) {
          finalData = payload;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) processLine(line);
      }
      buf += decoder.decode();
      if (buf) {
        for (const line of buf.split('\n')) processLine(line);
      }
      return finalData || { reply: streamText };
    };

    try {
      let res;
      let data = {};
      if (chatSession) {
        res = await postAssistant({ chatSession });
        data = await readAssistantResponse(res);
        if (res.status === 403 && !(data.closed || data.status === 'closed') && siteKey) {
          saveChatSession('');
          const freshTok = await refreshTurnstileToken();
          if (!freshTok) {
            hideTyping();
            renderMsg('bot', tr('verifyFirst'), { noFeedback: true });
            return;
          }
          turnstileToken = '';
          res = await postAssistant({ turnstileToken: freshTok });
          data = await readAssistantResponse(res);
        }
      } else {
        const tok = siteKey ? await ensureTurnstileToken() : '';
        if (siteKey && !tok) {
          hideTyping();
          renderMsg('bot', tr('verifyFirst'), { noFeedback: true });
          return;
        }
        turnstileToken = '';
        res = await postAssistant(tok ? { turnstileToken: tok } : {});
        data = await readAssistantResponse(res);
        if (res.status === 403 && !(data.closed || data.status === 'closed') && siteKey) {
          const freshTok = await refreshTurnstileToken();
          if (!freshTok) {
            hideTyping();
            renderMsg('bot', tr('verifyFirst'), { noFeedback: true });
            return;
          }
          turnstileToken = '';
          res = await postAssistant({ turnstileToken: freshTok });
          data = await readAssistantResponse(res);
        }
      }

      if (data && typeof data.chatSession === 'string' && data.chatSession) {
        saveChatSession(data.chatSession);
      }
      if (data.closed || data.status === 'closed') {
        const closeReply = data.reply || tr('abuseClose');
        history.push({ role: 'assistant', content: closeReply });
        saveHistory();
        hideTyping();
        if (streamMsg) {
          setBotMessageBody(streamMsg.div, closeReply);
          if (streamMsg.av) streamMsg.av.src = mimoSrc('default');
        } else {
          renderMsg('bot', closeReply, { noFeedback: true, avatarState: 'default' });
        }
        lockChatClosed();
        return;
      }
      if (res.status === 403) {
        hideTyping();
        if (streamMsg) streamMsg.row.remove();
        renderMsg('bot', tr('verifyFirst'), { noFeedback: true });
        return;
      }
      const reply = data.reply || data.error || tr('offline');
      history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
      saveHistory();
      hideTyping();
      if (streamMsg) {
        setBotMessageBody(streamMsg.div, reply, { handoffOffer: Boolean(data.handoffOffer) });
        appendFeedbackBar(streamMsg.wrap);
        if (streamMsg.av) streamMsg.av.src = mimoSrc('happy');
        logEl.scrollTop = logEl.scrollHeight;
      } else {
        renderMsg('bot', reply, { handoffOffer: Boolean(data.handoffOffer), avatarState: 'happy' });
      }
      if (data.handoff) handoffBox.hidden = false;
    } catch {
      hideTyping();
      if (streamMsg) {
        setBotMessageBody(streamMsg.div, streamText || tr('offline'));
      } else {
        renderMsg('bot', tr('offline'));
      }
    } finally {
      hideTyping();
      sendBtn.disabled = isChatClosed;
    }
  }

  const toggle = (open) => {
    panel.hidden = !open;
    if (open) {
      if (!chatSession && !turnstileToken && !tsInFlight && tsRendered && window.turnstile) {
        refreshTurnstileToken();
      } else {
        loadTurnstile();
      }
      if (!isChatClosed) input.focus();
    }
  };
  window.__bosphorlyChatToggle = () => toggle(panel.hidden);
  window.__bosphorlyChatAsk = (q) => {
    toggle(true);
    if (q && !isChatClosed) submitMessage(q);
  };
  window.__bosphorlyChatOpen = (q) => {
    toggle(true);
    if (q && !isChatClosed) submitMessage(q);
  };

  closeBtn.addEventListener('click', () => { stopDictation(); toggle(false); });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { stopDictation(); toggle(false); } });
  humanBtn.addEventListener('click', () => {
    if (isChatClosed) return;
    handoffBox.hidden = !handoffBox.hidden;
    if (!handoffBox.hidden) emailInput.focus();
  });

  panel.querySelectorAll('.bc-quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isChatClosed) return;
      submitMessage(btn.textContent.trim());
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isChatClosed) return;
    await submitMessage(input.value);
  });

  forwardBtn.addEventListener('click', async () => {
    if (isChatClosed) return;
    const email = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { emailInput.focus(); return; }
    if (!apiBase) { renderMsg('bot', tr('offline')); return; }
    const siteKey = window.BOSPHORLY_API && window.BOSPHORLY_API.turnstileSiteKey;
    forwardBtn.disabled = true;
    const postHandoff = (authPayload) => fetch(`${apiBase}/v1/assistant/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, lang, history: history.slice(-6), sessionId, ...authPayload }),
    });
    try {
      let res;
      let data = {};
      if (chatSession) {
        res = await postHandoff({ chatSession });
        data = await res.json().catch(() => ({}));
        if (res.status === 403 && !(data.closed || data.status === 'closed') && siteKey) {
          saveChatSession('');
          const freshTok = await refreshTurnstileToken();
          if (!freshTok) { renderMsg('bot', tr('verifyFirst'), { noFeedback: true }); return; }
          turnstileToken = '';
          res = await postHandoff({ turnstileToken: freshTok });
          data = await res.json().catch(() => ({}));
        }
      } else {
        const tok = siteKey ? await ensureTurnstileToken() : '';
        if (siteKey && !tok) { renderMsg('bot', tr('verifyFirst'), { noFeedback: true }); return; }
        turnstileToken = '';
        res = await postHandoff(tok ? { turnstileToken: tok } : {});
        data = await res.json().catch(() => ({}));
        if (res.status === 403 && !(data.closed || data.status === 'closed') && siteKey) {
          const freshTok = await refreshTurnstileToken();
          if (!freshTok) { renderMsg('bot', tr('verifyFirst'), { noFeedback: true }); return; }
          turnstileToken = '';
          res = await postHandoff({ turnstileToken: freshTok });
          data = await res.json().catch(() => ({}));
        }
      }
      if (data && typeof data.chatSession === 'string' && data.chatSession) {
        saveChatSession(data.chatSession);
      }
      if (data.closed || data.status === 'closed') {
        lockChatClosed();
        return;
      }
      if (res.ok) {
        handoffBox.hidden = true;
        emailInput.value = '';
        renderMsg('bot', tr('forwarded'));
      } else if (res.status === 403) {
        renderMsg('bot', tr('verifyFirst'), { noFeedback: true });
      } else {
        renderMsg('bot', tr('offline'));
      }
    } catch {
      renderMsg('bot', tr('offline'));
    } finally {
      forwardBtn.disabled = isChatClosed;
    }
  });

  const SPEECH_LOCALES = { ar:'ar-SA', az:'az-AZ', bn:'bn-BD', bs:'bs-BA', de:'de-DE', en:'en-US', es:'es-ES', fa:'fa-IR', fr:'fr-FR', he:'he-IL', hi:'hi-IN', hr:'hr-HR', hu:'hu-HU', id:'id-ID', it:'it-IT', ja:'ja-JP', ko:'ko-KR', nl:'nl-NL', pt:'pt-PT', ru:'ru-RU', tr:'tr-TR', uk:'uk-UA', zh:'zh-CN' };
  const speechLocale = (code) => SPEECH_LOCALES[String(code || '').slice(0, 2)] || 'en-US';
  function chooseDictationMode(caps) {
    if (caps.SpeechRecognition || caps.webkitSpeechRecognition) return 'browser';
    if (caps.MediaRecorder && caps.mediaDevices) return 'whisper';
    return 'none';
  }
  const DICTATION_MAX_MS = 30000;
  const DICTATION_MAX_BYTES = 1024 * 1024;
  let listening = false;
  let activeRec = null;
  let recorder = null;
  let recTimer = 0;
  let recChunks = [];
  let recStream = null;

  function applyDictationText(text) {
    const piece = String(text || '').replace(/\s+/g, ' ').trim();
    if (!piece) return;
    const cur = input.value.replace(/\s+$/, '');
    input.value = (cur ? cur + ' ' : '') + piece;
    input.focus();
  }

  function setListening(on) {
    listening = on;
    micBtn.classList.toggle('listening', on);
    micBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    listenEl.hidden = !on;
  }

  function showMicNote(key) {
    micNote.hidden = false;
    micNote.textContent = tr(key);
  }

  function stopTracks() {
    if (!recStream) return;
    recStream.getTracks().forEach((track) => { try { track.stop(); } catch {} });
    recStream = null;
  }

  function stopDictation() {
    if (recTimer) { clearTimeout(recTimer); recTimer = 0; }
    if (activeRec) {
      const rec = activeRec;
      activeRec = null;
      try { rec.onresult = null; rec.stop(); } catch {}
    }
    if (recorder && recorder.state === 'recording') {
      try { recorder.stop(); return; } catch {}
    }
    setListening(false);
    stopTracks();
  }

  async function uploadDictation(blob) {
    if (!blob || blob.size > DICTATION_MAX_BYTES) { showMicNote('micTooBig'); return; }
    if (!chatSession) { showMicNote('micFailed'); return; }
    try {
      const res = await fetch(`${apiBase}/v1/assistant/transcribe?lang=${encodeURIComponent(lang)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${chatSession}`, 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.text) { showMicNote('micFailed'); return; }
      applyDictationText(data.text);
      micNote.hidden = true;
    } catch {
      showMicNote('micFailed');
    }
  }

  function startBrowser(Rec) {
    let rec;
    try { rec = new Rec(); } catch { showMicNote('micFailed'); return; }
    rec.lang = speechLocale(lang);
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const said = event.results && event.results[0] && event.results[0][0] && event.results[0][0].transcript;
      applyDictationText(said || '');
      micNote.hidden = true;
    };
    rec.onerror = (event) => {
      const code = event && event.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') showMicNote('micDenied');
      else if (code && code !== 'aborted' && code !== 'no-speech') showMicNote('micFailed');
      setListening(false);
    };
    rec.onend = () => { activeRec = null; setListening(false); };
    activeRec = rec;
    setListening(true);
    try { rec.start(); } catch { activeRec = null; setListening(false); showMicNote('micFailed'); }
  }

  async function startRecorder() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      showMicNote('micFailed');
      return;
    }
    try {
      recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err && err.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') showMicNote('micDenied');
      else showMicNote('micFailed');
      return;
    }
    const mime = window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
    recChunks = [];
    let mr;
    try { mr = new MediaRecorder(recStream, mime ? { mimeType: mime } : undefined); }
    catch { stopTracks(); showMicNote('micFailed'); return; }
    mr.ondataavailable = (event) => { if (event.data && event.data.size) recChunks.push(event.data); };
    mr.onstop = () => {
      setListening(false);
      stopTracks();
      const blob = new Blob(recChunks, { type: mr.mimeType || 'audio/webm' });
      recChunks = [];
      recorder = null;
      if (blob.size) uploadDictation(blob);
    };
    recorder = mr;
    try { mr.start(); } catch { recorder = null; stopTracks(); showMicNote('micFailed'); return; }
    setListening(true);
    recTimer = setTimeout(() => {
      if (recorder && recorder.state === 'recording') recorder.stop();
    }, DICTATION_MAX_MS);
  }

  micBtn.addEventListener('click', () => {
    if (listening) { stopDictation(); return; }
    micNote.hidden = true;
    const mode = chooseDictationMode({
      SpeechRecognition: window.SpeechRecognition,
      webkitSpeechRecognition: window.webkitSpeechRecognition,
      MediaRecorder: window.MediaRecorder,
      mediaDevices: navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' ? navigator.mediaDevices : null,
    });
    if (mode === 'browser') startBrowser(window.SpeechRecognition || window.webkitSpeechRecognition);
    else if (mode === 'whisper') startRecorder();
    else showMicNote('micFailed');
  });

  loadTurnstile();
  if (!isChatClosed) input.focus();
  if (window.__bosphorlyInitialQuestion && !isChatClosed) {
    const q = window.__bosphorlyInitialQuestion;
    window.__bosphorlyInitialQuestion = '';
    submitMessage(q);
  }
})();
