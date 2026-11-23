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
    micTooBig: { tr:'Ses kaydı en fazla 30 saniye ve 1 MB olabilir.', en:'A recording can be at most 30 seconds and 1 MB.', ru:'Запись — не длиннее 30 секунд и не больше 1 МБ.', uk:'Запис — не довший за 30 секунд і не більший за 1 МБ.', de:'Eine Aufnahme darf höchstens 30 Sekunden und 1 MB groß sein.', fr:'Un enregistrement ne peut pas dépasser 30 secondes ni 1 Mo.', nl:'Een opname mag maximaal 30 seconden en 1 MB zijn.', ar:'التسجيل يجب ألا يتجاوز 30 ثانية أو 1 ميغابايت.', he:'הקלטה יכולה להיות עד 30 שניות ו-1MB.', az:'Səs yazısı ən çox 30 saniyə və 1 MB ola bilər.', fa:'ضبط صدا حداکثر ۳۰ ثانیه و ۱ مگابایت است.', es:'La grabación puede durar como máximo 30 segundos y pesar 1 MB.', it:'La registrazione può durare al massimo 30 secondi e pesare 1 MB.', pt:'A gravação pode ter no máximo 30 segundos e 1 MB.', hr:'Snimka može trajati najviše 30 sekundi i imati 1 MB.', hu:'A felvétel legfeljebb 30 másodperc és 1 MB lehet.', bs:'Snimak može trajati najviše 30 sekundi i imati 1 MB.', zh:'录音最长 30 秒，且不超过 1 MB。', ja:'録音は30秒以内、1MBまでです。', ko:'녹음은 최대 30초, 1MB까지입니다.', hi:'रिकॉर्डिंग अधिकतम 30 सेकंड और 1 MB हो सकती है।', bn:'রেকর্ডিং সর্বোচ্চ ৩০ সেকেন্ড এবং ১ এমবি হতে পারে।', id:'Rekaman paling lama 30 detik dan 1 MB.' },
    quickToggle: { tr:'Hızlı sorular', en:'Quick prompts', ru:'Быстрые вопросы', uk:'Швидкі запитання', de:'Schnellfragen', fr:'Questions rapides', nl:'Snelle vragen', ar:'أسئلة سريعة', he:'שאלות מהירות', az:'Sürətli suallar', fa:'پرسش‌های سریع', es:'Preguntas rápidas', it:'Domande rapide', pt:'Perguntas rápidas', hr:'Brza pitanja', hu:'Gyors kérdések', bs:'Brza pitanja', zh:'快捷提问', ja:'クイック質問', ko:'빠른 질문', hi:'त्वरित प्रश्न', bn:'দ্রুত প্রশ্ন', id:'Pertanyaan cepat' },
    tryAgain: { tr:'Bir saniye, martılar kafamı karıştırdı 😅 Tekrar yazar mısın?', en:'One second, the seagulls distracted me 😅 Could you write that again?', ru:'Секунду, чайки сбили меня с толку 😅 Напишешь ещё раз?', uk:'Секунду, чайки збили мене з пантелику 😅 Напишеш ще раз?', de:'Eine Sekunde, die Möwen haben mich abgelenkt 😅 Schreibst du es noch einmal?', fr:'Une seconde, les mouettes m’ont distrait 😅 Tu peux réécrire ?', nl:'Een seconde, de meeuwen leidden me af 😅 Schrijf je het nog een keer?', ar:'لحظة، شتتني النوارس 😅 هل تعيد كتابة رسالتك؟', he:'רגע, השחפים בלבלו אותי 😅 אפשר לכתוב שוב?', az:'Bir saniyə, qağayılar fikrimi yayındırdı 😅 Bir daha yazarsan?', fa:'یک لحظه، مرغ‌های دریایی حواسم را پرت کردند 😅 دوباره می‌نویسید؟', es:'Un segundo, las gaviotas me distrajeron 😅 ¿Lo escribes otra vez?', it:'Un secondo, i gabbiani mi hanno distratto 😅 Lo riscrivi?', pt:'Um segundo, as gaivotas me distraíram 😅 Pode escrever de novo?', hr:'Sekundu, galebovi su me zbunili 😅 Možeš li napisati ponovno?', hu:'Egy pillanat, a sirályok elvonták a figyelmemet 😅 Megírnád még egyszer?', bs:'Sekundu, galebovi su me zbunili 😅 Možeš li napisati ponovo?', zh:'等一下，海鸥把我弄糊涂了 😅 可以再写一遍吗？', ja:'ちょっと待って、カモメに気を取られちゃった 😅 もう一度書いてもらえる？', ko:'잠깐, 갈매기 때문에 정신이 팔렸어요 😅 다시 한 번 적어 주실래요?', hi:'एक सेकंड, सीगल ने मुझे भटका दिया 😅 क्या फिर से लिखोगे?', bn:'এক সেকেন্ড, সিগালগুলো আমাকে বিভ্রান্ত করেছে 😅 আবার লিখবে?', id:'Sebentar, burung camar mengalihkan perhatianku 😅 Bisa tulis lagi?' },
    humorMorning: { tr:'Sabah simidi taze çıktı, martılar da kahvaltıya göz dikmiş!', en:'Fresh morning simit just landed and the seagulls already spotted it!', ru:'Утренний симит ещё тёплый, а чайки уже присматриваются!', uk:'Ранковий симіт ще теплий, а чайки вже чатують!', de:'Frischer Morgen-Simit duftet schon und die Möwen schauen zu!', fr:'Le simit du matin est tout chaud et les mouettes veillent !', nl:'De ochtendsimit is nog warm en de meeuwen kijken mee!', ar:'السميت الصباحي طازج والنوارس تراقبه بشغف!', he:'הסימיט של הבוקר עוד חם והשחפים כבר עוקבים!', az:'Səhər simiti hələ istidir, qağayılar da göz qoyub!', fa:'سیمیت صبح هنوز داغه و مرغ‌های دریایی چشم دوختن!', es:'El simit de la mañana sigue calentito y las gaviotas ya miran!', it:'Il simit del mattino è ancora caldo e i gabbiani già guardano!', pt:'O simit da manhã está quentinho e as gaivotas já estão de olho!', hr:'Jutarnji simit je još topao, a galebovi ga već merkaju!', hu:'A reggeli szimit még meleg, és a sirályok már lesik!', bs:'Jutarnji simit je još topao, a galebovi ga već gledaju!', zh:'早晨的芝麻圈还热乎着，海鸥已经盯上啦！', ja:'朝のシミットが焼きたてでカモメが狙ってるよ！', ko:'아침 시미트가 갓 나왔는데 갈매기가 벌써 노리고 있어!', hi:'सुबह का सिमित अभी गरम है और सीगल भी ताक में हैं!', bn:'সকালের সিমিত এখনো গরম, সিগালরাও তাকিয়ে আছে!', id:'Simit pagi masih hangat dan burung camar sudah mengincar!' },
    humorAfternoon: { tr:'Vapur düdüğü çaldı, Boğaz esintisi serin serin esiyor!', en:'A ferry whistle just echoed across the Bosphorus breeze!', ru:'Слышен гудок паромчика и свежий ветер с Босфора!', uk:'Лунає гудок порома й свіжий вітер з Босфору!', de:'Eine Fähre tutet gerade über den Bosporus!', fr:'Le sifflet du ferry résonne sur le Bosphore !', nl:'Een veerboot toetert net over de Bosporus!', ar:'صافرة العبارة تعلو فوق نسيم البوسفور!', he:'שריקת המעבורת נשמעת מעל רוח הבוספורוס!', az:'Bərə səsi Boğazdan gəlir, meh sərin əsir!', fa:'سوت کشتی روی بسفر پیچیده و نسیم خنکی می‌وزد!', es:'¡Suena la sirena del ferri con la brisa del Bósforo!', it:'Si sente il fischio del traghetto nella brezza del Bosforo!', pt:'A buzina da balsa ecoa na brisa do Bósforo!', hr:'Čuje se sirena trajekta uz bosforski povjetarac!', hu:'Most szólalt meg a komp kürtje a boszporuszi szellőben!', bs:'Čuje se sirena trajekta uz bosforski povjetarac!', zh:'博斯普鲁斯的渡轮汽笛刚刚响起！', ja:'ボスポラスの潮風と一緒にフェリーの汽笛が聞こえるよ！', ko:'보스포루스 바람을 타고 페리 뱃고동이 울리고 있어!', hi:'बोस्फोरस की हवा के साथ फेरी की सीटी गूँज रही है!', bn:'বসফরাসের বাতাসে ফেরির হুইসেল বাজছে!', id:'Peluit feri baru saja terdengar bersama angin Bosporus!' },
    humorEvening: { tr:'Boğaz’da gün batımı kızıllığı çıktı, martılar eve dönüyor!', en:'Sunset colors are warming up the Bosphorus while seagulls glide home!', ru:'Закат раскрасил Босфор, а чайки уже летят домой!', uk:'Захід сонця розфарбував Босфор, а чайки летять додому!', de:'Die Abendsonne taucht den Bosporus in Gold!', fr:'Le soleil se couche sur le Bosphore et les mouettes rentrent !', nl:'De avondzon kleurt de Bosporus goud!', ar:'شفق الغروب يلوّن البوسفور والنوارس تعود لأعشاشها!', he:'שקיעה יפה צובעת את הבוספורוס והשחפים חוזרים!', az:'Boğazda gün batımı qızarıb, qağayılar yuvaya dönür!', fa:'غروب بسفر طلایی شده و مرغ‌های دریایی برمی‌گردن!', es:'¡El atardecer tiñe de oro el Bósforo y las gaviotas vuelven a casa!', it:'Il tramonto accende il Bosforo e i gabbiani rientrano!', pt:'O pôr do sol tinge o Bósforo de dourado!', hr:'Zalazak sunca boji Bospor, a galebovi se vraćaju!', hu:'Aranyló naplemente borul a Boszporuszra!', bs:'Zalazak sunca boji Bosfor, a galebovi se vraćaju!', zh:'夕阳把博斯普鲁斯染成了金色，海鸥也回家啦！', ja:'ボスポラスが夕焼けに染まってカモメたちもお帰りの時間だよ！', ko:'보스포루스가 노을빛으로 물들고 갈매기들도 집으로 가네!', hi:'बोस्फोरस पर शाम का सुनहरा नज़ारा है और सीगल घर लौट रहे हैं!', bn:'বসফরাসে গোধূলির রঙ লেগেছে, সিগালরা ঘরে ফিরছে!', id:'Senja mewarnai Bosporus dan burung camar mulai pulang!' },
    voiceToggle: { tr:'Sesli cevap', en:'Voice reply', ru:'Голосовой ответ', uk:'Голосова відповідь', de:'Sprachantwort', fr:'Réponse vocale', nl:'Spraakantwoord', ar:'رد صوتي', he:'מענה קולי', az:'Səsli cavab', fa:'پاسخ صوتی', es:'Respuesta de voz', it:'Risposta vocale', pt:'Resposta por voz', hr:'Glasovni odgovor', hu:'Hangos válasz', bs:'Glasovni odgovor', zh:'语音朗读', ja:'音声読み上げ', ko:'음성 답변', hi:'वॉइस उत्तर', bn:'ভয়েস উত্তর', id:'Balasan suara' },
    speakMsg: { tr:'Mesajı sesli oku', en:'Read message aloud', ru:'Озвучить сообщение', uk:'Озвучити повідомлення', de:'Nachricht vorlesen', fr:'Lire le message à voix haute', nl:'Bericht voorlezen', ar:'قراءة الرسالة بصوت عالٍ', he:'הקראת ההודעה בקול', az:'Mesajı səslə oxu', fa:'خواندن پیام با صدا', es:'Leer mensaje en voz alta', it:'Leggi il messaggio ad alta voce', pt:'Ler mensagem em voz alta', hr:'Pročitaj poruku naglas', hu:'Üzenet felolvasása', bs:'Pročitaj poruku naglas', zh:'朗读消息', ja:'メッセージを読み上げる', ko:'메시지 소리 내어 읽기', hi:'संदेश ज़ोर से पढ़ें', bn:'বার্তাটি পড়ে শোনান', id:'Bacakan pesan' },
    stopSpeak: { tr:'Okumayı durdur', en:'Stop reading', ru:'Остановить чтение', uk:'Зупинити читання', de:'Vorlesen stoppen', fr:'Arrêter la lecture', nl:'Stop met voorlezen', ar:'إيقاف القراءة', he:'עצירת ההקראה', az:'Oxumağı dayandır', fa:'توقف خواندن', es:'Detener lectura', it:'Interrompi lettura', pt:'Parar leitura', hr:'Zaustavi čitanje', hu:'Felolvasás leállítása', bs:'Zaustavi čitanje', zh:'停止朗读', ja:'読み上げを停止', ko:'읽기 중지', hi:'पढ़ना रोकें', bn:'পড়া বন্ধ করুন', id:'Hentikan pembacaan' },
    noVoiceDevice: { tr:'Bu dilde cihazında ses yok', en:'No voice available on your device for this language', ru:'На устройстве нет голоса для этого языка', uk:'На пристрої немає голосу для цієї мови', de:'Auf deinem Gerät ist keine Stimme für diese Sprache verfügbar', fr:'Aucune voix disponible sur votre appareil pour cette langue', nl:'Geen stem beschikbaar op je apparaat voor deze taal', ar:'لا يتوفر صوت لهذه اللغة على جهازك', he:'אין קול זמין במכשיר שלך לשפה זו', az:'Cihazınızda bu dil üçün səs yoxdur', fa:'صدایی برای این زبان روی دستگاه شما موجود نیست', es:'No hay una voz disponible en tu dispositivo para este idioma', it:'Nessuna voce disponibile sul tuo dispositivo per questa lingua', pt:'Nenhuma voz disponível no seu dispositivo para este idioma', hr:'Na tvom uređaju nema glasa za ovaj jezik', hu:'Nincs elérhető hang az eszközödön ehhez a nyelvhez', bs:'Na tvom uređaju nema glasa za ovaj jezik', zh:'你的设备上没有此语言的语音', ja:'この言語の音声はこの端末にありません', ko:'이 기기에서 이 언어의 음성을 사용할 수 없습니다', hi:'आपके डिवाइस पर इस भाषा के लिए कोई आवाज़ उपलब्ध नहीं है', bn:'এই ভাষার জন্য আপনার ডিভাইসে কোনো ভয়েস নেই', id:'Tidak ada suara di perangkatmu untuk bahasa ini' }
  };
  const tr = (k) => (UI[k] && (UI[k][lang] || UI[k].en)) || '';
  const SPEECH_LOCALES = { ar:'ar-SA', az:'az-AZ', bn:'bn-BD', bs:'bs-BA', de:'de-DE', en:'en-US', es:'es-ES', fa:'fa-IR', fr:'fr-FR', he:'he-IL', hi:'hi-IN', hr:'hr-HR', hu:'hu-HU', id:'id-ID', it:'it-IT', ja:'ja-JP', ko:'ko-KR', nl:'nl-NL', pt:'pt-PT', ru:'ru-RU', tr:'tr-TR', uk:'uk-UA', zh:'zh-CN' };
  const PUCK_UNSUPPORTED = new Set(['fa', 'az', 'bs']);
  const TTS_FETCH_TIMEOUT_MS = 4000;
  const speechLocale = (code) => SPEECH_LOCALES[String(code || '').slice(0, 2)] || 'en-US';

  const getIstanbulTimeSlot = () => {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', hour: 'numeric', hour12: false }).formatToParts(new Date());
      const hPart = parts.find((p) => p.type === 'hour');
      const hour = hPart ? Number(hPart.value) % 24 : 12;
      if (hour >= 5 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 18) return 'afternoon';
      return 'evening';
    } catch {
      return 'afternoon';
    }
  };

  const getIstanbulTimeGreeting = () => tr(getIstanbulTimeSlot());
  const getIstanbulTimeHumor = () => {
    const slot = getIstanbulTimeSlot();
    return tr(slot === 'morning' ? 'humorMorning' : slot === 'afternoon' ? 'humorAfternoon' : 'humorEvening');
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
    const humor = getIstanbulTimeHumor();
    if (humor) parts.push(humor);
    if (ctxMsg) parts.push(ctxMsg);
    return parts.join(' ');
  };

  const STORE_KEY = 'bosphorly.assistant_chat';
  const SESSION_ID_KEY = 'bosphorly.assistant_session';
  const CLOSED_KEY = 'bosphorly.assistant_closed';
  const CHAT_SESSION_KEY = 'bosphorly.assistant_chat_session';
  const KIND_NOTE_KEY = 'bosphorly.assistant_kind_note_seen';
  let history = [];
  let sessionId = '';
  let isChatClosed = false;
  let kindNoteSeen = false;
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
    kindNoteSeen = sessionStorage.getItem(KIND_NOTE_KEY) === '1';
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
  const rawTitle = tr('title');
  const titleHtml = rawTitle.startsWith('Mimo')
    ? `<span class="bc-title-name">Mimo</span><span class="bc-title-rest">${rawTitle.slice(4)}</span>`
    : `<span class="bc-title-name">${rawTitle}</span>`;
  const tgHeadHtml = tgUrl
    ? `<a class="bc-tg-link bc-tg-head" href="${tgUrl}" target="_blank" rel="noopener" aria-label="${tr('continueTg')}" title="${tr('continueTg')}"><img class="bc-tg-ico" src="${assetBase}assets/brand/telegram.svg" alt="" aria-hidden="true" width="22" height="22" loading="lazy" decoding="async"></a>`
    : '';
  // Corporate WhatsApp Business line (quick questions only; requests stay on email). Keep in sync with social-links.js.
  const WA_NUMBER = '16197386408';
  const waHeadHtml = `<a class="bc-wa-link bc-wa-head" href="https://wa.me/${WA_NUMBER}" target="_blank" rel="noopener" aria-label="WhatsApp +1 (619) 738-6408" title="WhatsApp +1 (619) 738-6408"><img class="bc-wa-ico" src="${assetBase}assets/brand/whatsapp.svg" alt="" aria-hidden="true" width="22" height="22" loading="lazy" decoding="async"></a>`;
  const mimoSrc = (stateName = 'default') => `${base}assets/brand/mimo/mimo-${stateName}.svg`;

  const panel = document.createElement('section');
  panel.className = 'bc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', rawTitle);
  if (isRtl) panel.setAttribute('dir', 'rtl');
  panel.innerHTML =
    `<div class="bc-head"><div class="bc-head-info"><img class="bc-head-avatar" src="${mimoSrc('default')}" data-state="default" alt="Mimo" width="36" height="36" loading="lazy" decoding="async">` +
    `<div class="bc-head-text"><div class="bc-title">${titleHtml}</div><div class="bc-sub">${tr('sub')}</div></div></div>` +
    `<div class="bc-head-actions"><button type="button" class="bc-tts-toggle" role="switch" aria-checked="false" hidden><span class="bc-tts-ico" aria-hidden="true">🔇</span><span class="bc-tts-lbl"></span><span class="bc-tts-switch" aria-hidden="true"></span></button>${tgHeadHtml}${waHeadHtml}<button type="button" class="bc-close" aria-label="${tr('close')}">×</button></div></div>` +
    `<div class="bc-log" aria-live="polite"></div>` +
    `<div class="bc-quick">` +
    `<button type="button" class="bc-quick-btn" data-q="transfer">${tr('qTransfer')}</button>` +
    `<button type="button" class="bc-quick-btn" data-q="cruise">${tr('qCruise')}</button>` +
    `<button type="button" class="bc-quick-btn" data-q="hammam">${tr('qHammam')}</button>` +
    `<button type="button" class="bc-quick-btn" data-q="plan">${tr('qPlan')}</button>` +
    `</div>` +
    `<div class="bc-actions"><button type="button" class="bc-human-btn">💬 ${tr('human')}</button></div>` +
    `<p class="bc-listen" hidden></p><p class="bc-mic-note" hidden></p><p class="bc-tts-note" hidden></p>` +
    `<form class="bc-form"><button type="button" class="bc-quick-toggle" aria-label="${tr('quickToggle')}" title="${tr('quickToggle')}" aria-expanded="false" hidden>✨</button>` +
    `<input class="bc-input" type="text" maxlength="1000" placeholder="${tr('placeholder')}" autocomplete="off">` +
    `<button type="button" class="bc-mic" aria-label="${tr('mic')}" aria-pressed="false">🎤</button>` +
    `<button class="bc-send" type="submit">${tr('send')}</button></form>` +
    `<div class="bc-turnstile" hidden></div>`;
  document.body.appendChild(panel);

  const headAvatar = panel.querySelector('.bc-head-avatar');
  const ttsToggleBtn = panel.querySelector('.bc-tts-toggle');
  const ttsToggleIco = panel.querySelector('.bc-tts-ico');
  const ttsToggleLbl = panel.querySelector('.bc-tts-lbl');
  ttsToggleLbl.textContent = tr('voiceToggle');
  const logEl = panel.querySelector('.bc-log');
  const quickEl = panel.querySelector('.bc-quick');
  const quickToggleBtn = panel.querySelector('.bc-quick-toggle');
  const closeBtn = panel.querySelector('.bc-close');
  const tsMount = panel.querySelector('.bc-turnstile');
  const humanBtn = panel.querySelector('.bc-human-btn');
  const form = panel.querySelector('.bc-form');
  const input = panel.querySelector('.bc-input');
  const sendBtn = panel.querySelector('.bc-send');
  const apiBase = window.BOSPHORLY_API && window.BOSPHORLY_API.base;
  const micBtn = panel.querySelector('.bc-mic');
  const listenEl = panel.querySelector('.bc-listen');
  const micNote = panel.querySelector('.bc-mic-note');
  const ttsNoteEl = panel.querySelector('.bc-tts-note');
  listenEl.textContent = tr('listening');
  const botItems = [];
  let ttsAvailable = false;
  let ttsAutoEnabled = false;

  let turnstileToken = '';
  let tsWidgetId = null;
  let tsRendered = false;
  let tsInFlight = false;
  let tsWaiters = [];
  let tsScriptLoading = false;
  let hasUserMessage = false;
  let savedScrollY = null;

  function syncPageLock() {
    const isOpen = !panel.hidden;
    document.body.classList.toggle('bc-chat-open', isOpen);
    const isMobile = window.innerWidth <= 480;
    if (isOpen && isMobile) {
      if (savedScrollY === null) {
        savedScrollY = window.scrollY || window.pageYOffset || 0;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${savedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
      }
      document.documentElement.classList.add('bc-scroll-lock');
      document.body.classList.add('bc-scroll-lock');
    } else {
      document.documentElement.classList.remove('bc-scroll-lock');
      document.body.classList.remove('bc-scroll-lock');
      if (savedScrollY !== null) {
        const restoreY = savedScrollY;
        savedScrollY = null;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        window.scrollTo(0, restoreY);
      }
    }
  }

  function syncMobileViewport() {
    if (panel.hidden || window.innerWidth > 480) {
      panel.style.top = '';
      panel.style.bottom = '';
      panel.style.height = '';
      panel.style.maxHeight = '';
      return;
    }
    const vv = window.visualViewport;
    if (vv && vv.height > 0) {
      panel.style.top = `${Math.max(0, Math.round(vv.offsetTop))}px`;
      panel.style.bottom = 'auto';
      panel.style.height = `${Math.round(vv.height)}px`;
      panel.style.maxHeight = `${Math.round(vv.height)}px`;
    }
    logEl.scrollTop = logEl.scrollHeight;
  }

  function syncQuickActions(collapsed = true) {
    if (!hasUserMessage) {
      panel.classList.remove('bc-has-chatted');
      quickEl.classList.remove('bc-quick-scroll', 'bc-quick-open');
      quickToggleBtn.hidden = true;
      quickToggleBtn.setAttribute('aria-expanded', 'false');
      return;
    }
    panel.classList.add('bc-has-chatted');
    quickEl.classList.add('bc-quick-scroll');
    quickToggleBtn.hidden = false;
    if (collapsed) {
      quickEl.classList.remove('bc-quick-open');
      quickToggleBtn.setAttribute('aria-expanded', 'false');
    }
  }

  function removeHandoffCard() {
    panel.querySelectorAll('.bc-handoff').forEach((card) => card.remove());
  }

  function openHandoffCard(anchorRow = null) {
    if (isChatClosed) return null;
    removeHandoffCard();
    const card = document.createElement('div');
    card.className = 'bc-handoff';
    card.innerHTML =
      `<div class="bc-handoff-head"><span>✉️ ${tr('human')}</span>` +
      `<button type="button" class="bc-handoff-close" aria-label="${tr('close')}">×</button></div>` +
      `<div class="bc-handoff-row"><input type="email" placeholder="${tr('emailPh')}" autocomplete="email">` +
      `<button type="button" class="bc-forward-btn">${tr('forwardBtn')}</button></div>`;
    const cardEmail = card.querySelector('input');
    const cardForward = card.querySelector('.bc-forward-btn');
    const cardClose = card.querySelector('.bc-handoff-close');
    cardClose.addEventListener('click', () => card.remove());
    cardForward.addEventListener('click', () => handleHandoffSubmit(card, cardEmail, cardForward));
    cardEmail.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleHandoffSubmit(card, cardEmail, cardForward);
      }
    });

    let targetRow = anchorRow && logEl.contains(anchorRow) ? anchorRow : null;
    if (!targetRow) {
      const botRows = logEl.querySelectorAll('.bc-msg-row.bot');
      if (botRows.length) targetRow = botRows[botRows.length - 1];
    }
    if (targetRow) {
      const nextEl = targetRow.nextElementSibling;
      if (nextEl && nextEl.classList.contains('bc-kind-note')) nextEl.insertAdjacentElement('afterend', card);
      else targetRow.insertAdjacentElement('afterend', card);
    } else {
      logEl.appendChild(card);
    }
    logEl.scrollTop = logEl.scrollHeight;
    cardEmail.focus();
    return card;
  }

  function lockChatClosed() {
    isChatClosed = true;
    try { sessionStorage.setItem(CLOSED_KEY, '1'); } catch {}
    panel.dataset.closed = 'true';
    panel.classList.add('bc-is-closed');
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    humanBtn.disabled = true;
    quickToggleBtn.disabled = true;
    removeHandoffCard();
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

  function sanitizeClientText(str) {
    return String(str || '')
      .replace(/<\|channel>thought[\s\S]*?(?:<channel\|>|$)/gi, '')
      .replace(/<\|channel>(?:thought)?|<channel\|>/gi, '')
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .replace(/\[\[\s*flags\s*:[\s\S]*?(?:\]\]|$)/gi, '')
      .trim();
  }

  function appendAllowedLinkOrText(parent, url, label) {
    if (isAllowedHref(url)) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = label || url;
      parent.appendChild(a);
    } else {
      const txt = label && label !== url ? `${label} (${url})` : url;
      parent.appendChild(document.createTextNode(txt));
    }
  }

  function appendFormattedLine(parent, line) {
    const tokenRe = /\[([^\]]+)\]\((https?:\/\/[^\s)<]+)\)|(https?:\/\/[^\s<>]+)|\*\*([^\n*][^*\n]*?)\*\*/gi;
    let lastIdx = 0;
    let m;
    while ((m = tokenRe.exec(line)) !== null) {
      if (m.index > lastIdx) {
        parent.appendChild(document.createTextNode(line.slice(lastIdx, m.index)));
      }
      if (m[2]) {
        appendAllowedLinkOrText(parent, m[2], m[1]);
      } else if (m[3]) {
        let clean = m[3];
        let tail = '';
        const trailing = clean.match(/[).,!?;:"'<>]+$/);
        if (trailing) {
          clean = clean.slice(0, -trailing[0].length);
          tail = trailing[0];
        }
        if (clean) {
          appendAllowedLinkOrText(parent, clean, clean);
          if (tail) parent.appendChild(document.createTextNode(tail));
        } else {
          parent.appendChild(document.createTextNode(m[3]));
        }
      } else if (m[4]) {
        const strong = document.createElement('strong');
        strong.textContent = m[4];
        parent.appendChild(strong);
      }
      lastIdx = tokenRe.lastIndex;
    }
    if (lastIdx < line.length) {
      parent.appendChild(document.createTextNode(line.slice(lastIdx)));
    }
  }

  function setBotMessageBody(div, text, opts = {}) {
    div.textContent = '';
    const lines = sanitizeClientText(text).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) div.appendChild(document.createElement('br'));
      appendFormattedLine(div, lines[i]);
    }
    if (opts.handoffOffer && !isChatClosed) {
      const actions = document.createElement('div');
      actions.className = 'bc-offer-actions';
      const yesBtn = document.createElement('button');
      yesBtn.type = 'button';
      yesBtn.className = 'bc-offer-btn';
      yesBtn.textContent = tr('yesForward');
      yesBtn.addEventListener('click', () => {
        actions.remove();
        openHandoffCard(div.closest('.bc-msg-row.bot'));
      });
      const noBtn = document.createElement('button');
      noBtn.type = 'button';
      noBtn.className = 'bc-offer-btn secondary';
      noBtn.textContent = tr('noThanks');
      noBtn.addEventListener('click', () => {
        actions.remove();
        removeHandoffCard();
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
    if (role === 'user') {
      hasUserMessage = true;
      syncQuickActions(true);
    }
    const isFirstBotMsg = role === 'bot' && !logEl.querySelector('.bc-msg-row.bot');
    const row = document.createElement('div');
    row.className = `bc-msg-row ${role === 'user' ? 'user' : 'bot'}`;

    const div = document.createElement('div');
    div.className = `bc-msg ${role === 'user' ? 'user' : 'bot'}`;

    const item = {
      row,
      div,
      wrap: null,
      av: null,
      speakBtn: null,
      text: String(text || ''),
      baseAvatarState: opts.avatarState || 'happy',
      lang: opts.lang || lang,
      streaming: Boolean(opts.streaming),
    };

    if (role === 'bot') {
      const av = document.createElement('img');
      av.className = 'bc-bot-avatar';
      av.src = mimoSrc(item.baseAvatarState);
      av.dataset.state = item.baseAvatarState;
      av.alt = 'Mimo';
      av.width = 28;
      av.height = 28;
      av.loading = 'lazy';
      av.decoding = 'async';
      item.av = av;

      const wrap = document.createElement('div');
      wrap.className = 'bc-msg-wrap';
      item.wrap = wrap;

      const mainRow = document.createElement('div');
      mainRow.className = 'bc-msg-main';

      setBotMessageBody(div, text, opts);

      const speakBtn = document.createElement('button');
      speakBtn.type = 'button';
      speakBtn.className = 'bc-speak-btn';
      speakBtn.textContent = '🔊';
      speakBtn.setAttribute('aria-label', tr('speakMsg'));
      speakBtn.setAttribute('aria-pressed', 'false');
      speakBtn.disabled = item.streaming;
      speakBtn.hidden = !hasTtsForLang(item.lang);
      speakBtn.addEventListener('click', () => { toggleSpeakItem(item); });
      item.speakBtn = speakBtn;
      botItems.push(item);

      mainRow.append(div, speakBtn);
      wrap.appendChild(mainRow);
      if (!opts.noFeedback) appendFeedbackBar(wrap);

      row.append(av, wrap);
    } else {
      div.textContent = text;
      row.appendChild(div);
    }
    logEl.appendChild(row);
    if (isFirstBotMsg && !kindNoteSeen && !history.length && !logEl.querySelector('.bc-kind-note')) {
      const note = document.createElement('div');
      note.className = 'bc-kind-note';
      note.textContent = tr('kindNote');
      note.title = tr('kindNote');
      logEl.appendChild(note);
      kindNoteSeen = true;
      try { sessionStorage.setItem(KIND_NOTE_KEY, '1'); } catch {}
    }
    logEl.scrollTop = logEl.scrollHeight;
    return item;
  }

  let typingRow = null;
  let typingTimer = null;
  function showTyping() {
    if (typingRow) return;
    headAvatar.classList.remove('bc-speaking');
    headAvatar.src = mimoSrc('thinking');
    headAvatar.dataset.state = 'thinking';
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
    if (!headAvatar.classList.contains('bc-speaking')) {
      headAvatar.src = mimoSrc('happy');
      headAvatar.dataset.state = 'happy';
    }
  }

  if (!history.length) {
    renderMsg('bot', buildInitialWelcome(), { avatarState: 'hello' });
  } else {
    for (const m of history) renderMsg(m.role === 'user' ? 'user' : 'bot', m.content);
  }
  syncQuickActions(true);
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
    stopSpeaking();
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
    const CLIENT_CAP_MS = Number(window.__BOSPHORLY_MIMO_CAP_MS) > 0 ? Number(window.__BOSPHORLY_MIMO_CAP_MS) : 25000;
    const recent = history.slice(-4);
    const abortCtrl = typeof AbortController === 'function' ? new AbortController() : null;
    const capTimer = setTimeout(() => {
      if (abortCtrl) abortCtrl.abort(new Error('stream_timeout'));
    }, CLIENT_CAP_MS);
    const postAssistant = (authPayload) => fetch(`${apiBase}/v1/assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream, application/json',
      },
      ...(abortCtrl ? { signal: abortCtrl.signal } : {}),
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
    const turnDeadline = Date.now() + CLIENT_CAP_MS;
    const raceStreamCap = (promise) => {
      const rem = turnDeadline - Date.now();
      if (rem <= 0) return Promise.reject(new Error('stream_timeout'));
      let t;
      const timerPromise = new Promise((_, rej) => {
        t = setTimeout(() => rej(new Error('stream_timeout')), rem);
      });
      return Promise.race([promise, timerPromise]).finally(() => clearTimeout(t));
    };

    const readAssistantResponse = async (res) => {
      const ct = (res && res.headers && typeof res.headers.get === 'function' ? res.headers.get('content-type') : '') || '';
      if (!ct.toLowerCase().includes('text/event-stream') || !res.body || typeof res.body.getReader !== 'function') {
        return await raceStreamCap(res.json().catch(() => ({})));
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
            streamMsg = renderMsg('bot', '', { noFeedback: true, avatarState: 'thinking', streaming: true });
            headAvatar.src = mimoSrc('thinking');
            headAvatar.dataset.state = 'thinking';
          }
          streamText += payload.t;
          setBotMessageBody(streamMsg.div, sanitizeClientText(streamText));
          logEl.scrollTop = logEl.scrollHeight;
        } else if (eventName === 'done' && payload) {
          finalData = payload;
        }
      };

      try {
        while (true) {
          const { done, value } = await raceStreamCap(reader.read());
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
      } catch (err) {
        try { await reader.cancel(); } catch {}
        throw err;
      }
      if (!finalData && !sanitizeClientText(streamText)) {
        throw new Error('stream_incomplete');
      }
      return finalData || { reply: sanitizeClientText(streamText) };
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
      const msgLang = (data && typeof data.lang === 'string' && data.lang) ? data.lang : lang;
      if (data.closed || data.status === 'closed') {
        const closeReply = data.reply || tr('abuseClose');
        history.push({ role: 'assistant', content: closeReply });
        saveHistory();
        hideTyping();
        if (streamMsg) {
          streamMsg.text = sanitizeClientText(closeReply);
          streamMsg.lang = msgLang;
          streamMsg.streaming = false;
          setBotMessageBody(streamMsg.div, closeReply);
          if (streamMsg.av) {
            streamMsg.baseAvatarState = 'default';
            streamMsg.av.src = mimoSrc('default');
            streamMsg.av.dataset.state = 'default';
          }
          if (streamMsg.speakBtn) {
            streamMsg.speakBtn.disabled = false;
            streamMsg.speakBtn.hidden = !hasTtsForLang(msgLang);
          }
        } else {
          renderMsg('bot', closeReply, { noFeedback: true, avatarState: 'default', lang: msgLang });
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
      const reply = sanitizeClientText(data.reply || data.error || '') || tr('offline');
      history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
      saveHistory();
      hideTyping();
      let replyItem = null;
      if (streamMsg) {
        streamMsg.text = reply;
        streamMsg.lang = msgLang;
        streamMsg.streaming = false;
        setBotMessageBody(streamMsg.div, reply, { handoffOffer: Boolean(data.handoffOffer) });
        appendFeedbackBar(streamMsg.wrap);
        if (streamMsg.av) {
          streamMsg.baseAvatarState = 'happy';
          streamMsg.av.src = mimoSrc('happy');
          streamMsg.av.dataset.state = 'happy';
        }
        if (streamMsg.speakBtn) {
          streamMsg.speakBtn.disabled = false;
          streamMsg.speakBtn.hidden = !hasTtsForLang(msgLang);
        }
        logEl.scrollTop = logEl.scrollHeight;
        replyItem = streamMsg;
        if (data.handoff) openHandoffCard(streamMsg.row);
      } else {
        replyItem = renderMsg('bot', reply, { handoffOffer: Boolean(data.handoffOffer), avatarState: 'happy', lang: msgLang });
        if (data.handoff) openHandoffCard(replyItem.row);
      }
      if (ttsAutoEnabled && replyItem) speakItem(replyItem);
    } catch (err) {
      hideTyping();
      const isStreamTimeout = Boolean(
        err && (err.name === 'AbortError' || err.message === 'stream_timeout' || err.message === 'stream_incomplete')
      );
      const fallbackText = tr(isStreamTimeout ? 'tryAgain' : 'offline');
      const partialClean = sanitizeClientText(streamText);
      if (streamMsg) {
        const recovered = partialClean || fallbackText;
        streamMsg.text = recovered;
        streamMsg.streaming = false;
        setBotMessageBody(streamMsg.div, recovered);
        if (streamMsg.av) {
          streamMsg.baseAvatarState = 'default';
          streamMsg.av.src = mimoSrc('default');
          streamMsg.av.dataset.state = 'default';
        }
        if (streamMsg.speakBtn) {
          streamMsg.speakBtn.disabled = false;
          streamMsg.speakBtn.hidden = !hasTtsForLang(streamMsg.lang || lang);
        }
      } else {
        renderMsg('bot', fallbackText);
      }
    } finally {
      clearTimeout(capTimer);
      hideTyping();
      sendBtn.disabled = isChatClosed;
    }
  }

  function applyOpenState(isOpen) {
    panel.hidden = !isOpen;
    syncPageLock();
    syncMobileViewport();
  }

  const toggle = (open) => {
    if (!open) {
      stopSpeaking();
    }
    const nextOpen = Boolean(open);
    applyOpenState(nextOpen);
    if (nextOpen) {
      if (!chatSession && !turnstileToken && !tsInFlight && tsRendered && window.turnstile) {
        refreshTurnstileToken();
      } else {
        loadTurnstile();
      }
      logEl.scrollTop = logEl.scrollHeight;
      if (!isChatClosed && window.innerWidth > 480) input.focus();
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
    if (logEl.querySelector('.bc-handoff')) {
      removeHandoffCard();
      return;
    }
    openHandoffCard();
  });

  quickToggleBtn.addEventListener('click', () => {
    if (isChatClosed || !hasUserMessage) return;
    const nextOpen = !quickEl.classList.contains('bc-quick-open');
    quickEl.classList.toggle('bc-quick-open', nextOpen);
    quickToggleBtn.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    logEl.scrollTop = logEl.scrollHeight;
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

  async function handleHandoffSubmit(card, cardEmail, cardForward) {
    if (isChatClosed) return;
    const email = cardEmail.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { cardEmail.focus(); return; }
    if (!apiBase) { renderMsg('bot', tr('offline')); return; }
    const siteKey = window.BOSPHORLY_API && window.BOSPHORLY_API.turnstileSiteKey;
    cardForward.disabled = true;
    const postHandoff = (authPayload) => fetch(`${apiBase}/v1/assistant/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, lang, history: history.slice(-4), sessionId, ...authPayload }),
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
        card.remove();
        renderMsg('bot', tr('forwarded'));
      } else if (res.status === 403) {
        renderMsg('bot', tr('verifyFirst'), { noFeedback: true });
      } else {
        renderMsg('bot', tr('offline'));
      }
    } catch {
      renderMsg('bot', tr('offline'));
    } finally {
      cardForward.disabled = isChatClosed;
    }
  }

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
    stopSpeaking();
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
    stopSpeaking();
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
    stopSpeaking();
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

  const TTS_STORE_KEY = 'bosphorly.mimo_tts';
  function chooseTtsVoice(voices, langCode, localesMap) {
    const map = localesMap || SPEECH_LOCALES;
    if (!Array.isArray(voices) || !voices.length) return null;
    const short = String(langCode || '').toLowerCase().replace(/_/g, '-').split('-')[0];
    const target = map[short];
    if (!target) return null;
    const targetLower = target.toLowerCase();
    const aliases = short === 'he' ? ['he', 'iw'] : (short === 'id' ? ['id', 'in'] : [short]);
    const bases = new Set(aliases);
    const norm = (v) => String(v && v.lang ? v.lang : '').toLowerCase().replace(/_/g, '-');
    const exact = voices.filter((v) => norm(v) === targetLower);
    if (exact.length) return exact.find((v) => v.localService) || exact[0];
    const byBase = voices.filter((v) => {
      const base = norm(v).split('-')[0];
      return base && bases.has(base);
    });
    if (byBase.length) return byBase.find((v) => v.localService) || byBase[0];
    return null;
  }

  function sanitizeSpeechText(raw) {
    let s = String(raw || '');
    s = s
      .replace(/<\|channel>thought[\s\S]*?(?:<channel\|>|$)/gi, '')
      .replace(/<\|channel>(?:thought)?|<channel\|>/gi, '')
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
      .replace(/\[\[\s*flags\s*:[\s\S]*?(?:\]\]|$)/gi, '');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/gi, (_, label) => {
      const lbl = String(label || '').trim();
      if (!lbl || /^https?:\/\//i.test(lbl) || /^www\./i.test(lbl)) return '';
      return lbl;
    });
    s = s.replace(/https?:\/\/[^\s<>\)\]"']+/gi, '');
    s = s.replace(/\bwww\.[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<>\)\]"']*)?/gi, '');
    s = s.replace(/\bt\.me\/[A-Za-z0-9_]+(?:\/[^\s<>\)\]"']*)?/gi, '');
    s = s.replace(/\bbosphorly\.com(?:\/[^\s<>\)\]"']*)?/gi, '');
    s = s.replace(/\(\s*\)|\[\s*\]/g, '');
    s = s.replace(
      /(?:[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*|[\u200D\uFE0F\uFE0E\u20E3])+(?=\s*[\p{L}\p{N}])/gu,
      '. '
    );
    s = s.replace(
      /(?:[\u{1F1E6}-\u{1F1FF}]{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*|[\u200D\uFE0F\uFE0E\u20E3])+/gu,
      ' '
    );
    s = s.replace(/```[\s\S]*?```/g, ' ');
    s = s.replace(/`([^`]*)`/g, '$1');
    s = s.replace(/^[\t ]{0,3}#{1,6}[\t ]+/gm, '');
    s = s.replace(/^[\t ]{0,3}(?:[-*•]+|\d+\.)[\t ]+/gm, '');
    s = s.replace(/^[\t ]{0,3}>[\t ]?/gm, '');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '$1');
    s = s.replace(/__([^_\n]+)__/g, '$1');
    s = s.replace(/\*([^*\n]+)\*/g, '$1');
    s = s.replace(/_([^_\n]+)_/g, '$1');
    s = s.replace(/[*_`~]+/g, '');
    s = s.replace(/\s*[:\-–—]\s*(?=$|\n)/gm, '');
    s = s.replace(/([.!?…,:;])\s*\.+/g, '$1');
    s = s.replace(/\s*\r?\n+\s*/g, '. ');
    s = s.replace(/([.!?…])\s*\./g, '$1');
    s = s.replace(/\s+([,.;!?…])/g, '$1');
    s = s.replace(/[ \t]{2,}/g, ' ');
    s = s.replace(/^[\s.,;:!?-]+(?=\S)/, '').trim();
    if (s.length > 600) s = s.slice(0, 600).trim();
    return s;
  }

  let ttsVoice = null;
  let ttsActiveItem = null;
  let ttsToken = 0;
  let preSpeakHeadState = 'default';
  let activeAudio = null;
  let activeAudioUrl = '';
  let ttsFetchCtrl = null;
  let ttsNoteTimer = null;

  function hideTtsNote() {
    if (ttsNoteTimer) { clearTimeout(ttsNoteTimer); ttsNoteTimer = null; }
    if (ttsNoteEl) { ttsNoteEl.hidden = true; ttsNoteEl.textContent = ''; }
  }
  function showTtsNote(key) {
    if (!ttsNoteEl) return;
    if (ttsNoteTimer) { clearTimeout(ttsNoteTimer); ttsNoteTimer = null; }
    ttsNoteEl.textContent = tr(key);
    ttsNoteEl.hidden = false;
    ttsNoteTimer = setTimeout(() => { hideTtsNote(); }, 4500);
  }

  function loadTtsPref() {
    try { return localStorage.getItem(TTS_STORE_KEY) === '1'; } catch { return false; }
  }
  function saveTtsPref(on) {
    try { localStorage.setItem(TTS_STORE_KEY, on ? '1' : '0'); } catch {}
  }
  function syncTtsToggleUi() {
    ttsToggleBtn.setAttribute('aria-checked', ttsAutoEnabled ? 'true' : 'false');
    ttsToggleIco.textContent = ttsAutoEnabled ? '🔊' : '🔇';
  }
  ttsAutoEnabled = loadTtsPref();
  syncTtsToggleUi();

  function clearSpeakingVisual() {
    if (ttsActiveItem) {
      const prev = ttsActiveItem;
      ttsActiveItem = null;
      if (prev.speakBtn) {
        prev.speakBtn.classList.remove('is-speaking');
        prev.speakBtn.setAttribute('aria-pressed', 'false');
        prev.speakBtn.setAttribute('aria-label', tr('speakMsg'));
        prev.speakBtn.textContent = '🔊';
      }
      if (prev.av) {
        prev.av.classList.remove('bc-speaking');
        const restoreState = prev.baseAvatarState || 'happy';
        prev.av.src = mimoSrc(restoreState);
        prev.av.dataset.state = restoreState;
      }
    }
    headAvatar.classList.remove('bc-speaking');
    const targetState = typingRow ? 'thinking' : (isChatClosed ? 'default' : (preSpeakHeadState || 'happy'));
    headAvatar.src = mimoSrc(targetState);
    headAvatar.dataset.state = targetState;
  }

  function setSpeakingVisual(item) {
    if (!headAvatar.classList.contains('bc-speaking')) {
      preSpeakHeadState = headAvatar.dataset.state || (typingRow ? 'thinking' : 'happy');
    }
    headAvatar.src = mimoSrc('speaking');
    headAvatar.dataset.state = 'speaking';
    headAvatar.classList.add('bc-speaking');
    ttsActiveItem = item || null;
    if (item && item.speakBtn) {
      item.speakBtn.classList.add('is-speaking');
      item.speakBtn.setAttribute('aria-pressed', 'true');
      item.speakBtn.setAttribute('aria-label', tr('stopSpeak'));
      item.speakBtn.textContent = '⏹️';
    }
    if (item && item.av) {
      item.av.src = mimoSrc('speaking');
      item.av.dataset.state = 'speaking';
      item.av.classList.add('bc-speaking');
    }
  }

  function stopSpeaking() {
    ttsToken += 1;
    if (ttsFetchCtrl) {
      try { ttsFetchCtrl.abort(); } catch {}
      ttsFetchCtrl = null;
    }
    if (activeAudio) {
      const audio = activeAudio;
      activeAudio = null;
      try {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
        audio.removeAttribute('src');
        if (typeof audio.load === 'function') audio.load();
      } catch {}
    }
    if (activeAudioUrl) {
      try { URL.revokeObjectURL(activeAudioUrl); } catch {}
      activeAudioUrl = '';
    }
    clearSpeakingVisual();
    try {
      if (window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
        window.speechSynthesis.cancel();
      }
    } catch {}
  }

  function resolveVoiceForLang(code) {
    try {
      const synth = window.speechSynthesis;
      const Utter = window.SpeechSynthesisUtterance;
      if (!synth || !Utter || typeof synth.getVoices !== 'function') return null;
      return chooseTtsVoice(synth.getVoices(), code || lang);
    } catch {
      return null;
    }
  }

  function hasServerTtsForLang(code) {
    if (!apiBase) return false;
    const short = String(code || lang || '').trim().toLowerCase().replace(/_/g, '-').split('-')[0];
    return Boolean(short && SPEECH_LOCALES[short] && !PUCK_UNSUPPORTED.has(short));
  }

  function hasTtsForLang(code) {
    return hasServerTtsForLang(code) || Boolean(resolveVoiceForLang(code));
  }

  function refreshTtsAvailability() {
    ttsVoice = resolveVoiceForLang(lang);
    ttsAvailable = hasTtsForLang(lang);
    ttsToggleBtn.hidden = !ttsAvailable;
    for (const item of botItems) {
      if (item && item.speakBtn) {
        item.speakBtn.hidden = !hasTtsForLang(item.lang || lang);
      }
    }
    if (!ttsAvailable && ttsActiveItem && !hasTtsForLang(ttsActiveItem.lang || lang)) {
      stopSpeaking();
    }
  }

  function speakWithBrowser(clean, msgLang, item, myToken) {
    if (ttsToken !== myToken) return true;
    const voice = resolveVoiceForLang(msgLang);
    const synth = window.speechSynthesis;
    const Utter = window.SpeechSynthesisUtterance;
    if (!voice || !synth || !Utter) {
      if (ttsToken === myToken) {
        clearSpeakingVisual();
        showTtsNote('noVoiceDevice');
      }
      return false;
    }
    const utter = new Utter(clean);
    utter.lang = voice.lang || speechLocale(msgLang);
    utter.pitch = 1.2;
    utter.rate = 1.05;
    try { utter.voice = voice; } catch {}
    utter.onend = () => {
      if (ttsToken !== myToken) return;
      clearSpeakingVisual();
    };
    utter.onerror = () => {
      if (ttsToken !== myToken) return;
      clearSpeakingVisual();
    };
    setSpeakingVisual(item);
    try {
      synth.speak(utter);
      return true;
    } catch {
      if (ttsToken === myToken) clearSpeakingVisual();
      return false;
    }
  }

  async function fetchPuckAudioBlob(clean, msgLang, myToken) {
    if (!hasServerTtsForLang(msgLang) || !chatSession) return null;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    ttsFetchCtrl = ctrl;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (ctrl) ctrl.abort();
    }, TTS_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${apiBase}/v1/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${chatSession}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: clean, lang: String(msgLang || lang || 'en').slice(0, 10) }),
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (ttsToken !== myToken || timedOut) return null;
      if (!res || !res.ok) return null;
      const ctype = String((res.headers && res.headers.get('Content-Type')) || '').toLowerCase();
      if (!ctype.includes('audio/')) return null;
      const blob = await res.blob();
      if (ttsToken !== myToken || !blob || !blob.size) return null;
      return blob;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      if (ttsFetchCtrl === ctrl) ttsFetchCtrl = null;
    }
  }

  async function speakItem(item) {
    if (!item || item.streaming) return;
    const msgLang = item.lang || lang;
    const clean = sanitizeSpeechText(item.text);
    if (!clean) return;
    hideTtsNote();
    stopSpeaking();
    const myToken = ttsToken;

    if (hasServerTtsForLang(msgLang) && chatSession) {
      setSpeakingVisual(item);
      const blob = await fetchPuckAudioBlob(clean, msgLang, myToken);
      if (ttsToken !== myToken) return;
      if (blob && typeof window.Audio === 'function' && typeof URL.createObjectURL === 'function') {
        const objUrl = URL.createObjectURL(blob);
        const audio = new window.Audio(objUrl);
        activeAudio = audio;
        activeAudioUrl = objUrl;
        const cleanupAudio = () => {
          if (activeAudio === audio) activeAudio = null;
          if (activeAudioUrl === objUrl) {
            activeAudioUrl = '';
          }
          try { URL.revokeObjectURL(objUrl); } catch {}
        };
        audio.onended = () => {
          cleanupAudio();
          if (ttsToken !== myToken) return;
          clearSpeakingVisual();
        };
        audio.onerror = () => {
          cleanupAudio();
          if (ttsToken !== myToken) return;
          speakWithBrowser(clean, msgLang, item, myToken);
        };
        try {
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.then === 'function') {
            await playPromise;
          }
          if (ttsToken !== myToken) {
            try { audio.pause(); } catch {}
            cleanupAudio();
            return;
          }
          return;
        } catch {
          cleanupAudio();
          if (ttsToken !== myToken) return;
          speakWithBrowser(clean, msgLang, item, myToken);
          return;
        }
      }
    }

    if (ttsToken !== myToken) return;
    speakWithBrowser(clean, msgLang, item, myToken);
  }

  function toggleSpeakItem(item) {
    if (!item || item.streaming) return;
    if (ttsActiveItem === item) {
      stopSpeaking();
      return;
    }
    speakItem(item);
  }

  ttsToggleBtn.addEventListener('click', () => {
    ttsAutoEnabled = !ttsAutoEnabled;
    saveTtsPref(ttsAutoEnabled);
    syncTtsToggleUi();
    hideTtsNote();
    if (!ttsAutoEnabled) stopSpeaking();
  });

  if (window.speechSynthesis && typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', refreshTtsAvailability);
  } else if (window.speechSynthesis && 'onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = refreshTtsAvailability;
  }
  refreshTtsAvailability();
  window.addEventListener('pagehide', stopSpeaking);
  window.addEventListener('beforeunload', stopSpeaking);


  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncMobileViewport);
    window.visualViewport.addEventListener('scroll', syncMobileViewport);
  }
  window.addEventListener('resize', () => {
    syncPageLock();
    syncMobileViewport();
  });
  input.addEventListener('focus', () => {
    setTimeout(syncMobileViewport, 60);
  });

  applyOpenState(true);
  loadTurnstile();
  if (!isChatClosed && window.innerWidth > 480) input.focus();
  if (window.__bosphorlyInitialQuestion && !isChatClosed) {
    const q = window.__bosphorlyInitialQuestion;
    window.__bosphorlyInitialQuestion = '';
    submitMessage(q);
  }
})();
