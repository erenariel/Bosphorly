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
    title: { tr:'Mimo · İstanbul asistanın', en:'Mimo · Your Istanbul assistant', ru:'Mimo · Ваш ассистент по Стамбулу', uk:'Mimo · Ваш асистент у Стамбулі', de:'Mimo · Dein Istanbul-Assistent', fr:'Mimo · Votre assistant Istanbul', nl:'Mimo · Je Istanbul-assistent', ar:'Mimo · مساعدك في إسطنبول', he:'Mimo · העוזר שלך באיסטנבול', az:'Mimo · İstanbul köməkçin', fa:'Mimo · دستیار استانبول شما', es:'Mimo · Tu asistente de Estambul', it:'Mimo · Il tuo assistente per Istanbul', pt:'Mimo · Seu assistente em Istambul', hr:'Mimo · Tvoj Istanbul asistent', hu:'Mimo · Isztambuli asszisztensed', bs:'Mimo · Tvoj Istanbul asistent', zh:'Mimo · 您的伊斯坦布尔助手', ja:'Mimo · イスタンブール案内アシスタント', ko:'Mimo · 나의 이스탄불 도우미', hi:'Mimo · आपका इस्तांबुल सहायक', bn:'Mimo · আপনার ইস্তাম্বুল সহায়ক', id:'Mimo · Asisten Istanbul Anda' },
    sub: { tr:'Bosphorly yapay zekâ asistanı · turlar ve transferler', en:'Bosphorly AI assistant · tours & transfers', ru:'ИИ-ассистент Bosphorly · туры и трансферы', uk:'ШІ-асистент Bosphorly · тури й трансфери', de:'Bosphorly KI-Assistent · Touren & Transfers', fr:'Assistant IA Bosphorly · visites & transferts', nl:'Bosphorly AI-assistent · tours & transfers', ar:'مساعد الذكاء الاصطناعي · الجولات والنقل', he:'עוזר ה-AI של Bosphorly · סיורים והסעות', az:'Bosphorly süni intellekt köməkçisi · turlar və transferlər', fa:'دستیار هوش مصنوعی Bosphorly · تورها و ترانسفر', es:'Asistente IA de Bosphorly · tours y traslados', it:'Assistente IA Bosphorly · tour e transfer', pt:'Assistente IA Bosphorly · passeios e traslados', hr:'Bosphorly AI asistent · ture i transferi', hu:'Bosphorly AI-asszisztens · túrák és transzferek', bs:'Bosphorly AI asistent · ture i transferi', zh:'Bosphorly 人工智能助手 · 游览与接送', ja:'Bosphorly AIアシスタント · ツアー・送迎', ko:'Bosphorly AI 도우미 · 투어 & 픽업', hi:'Bosphorly AI सहायक · टूर और ट्रांसफ़र', bn:'Bosphorly এআই সহায়ক · ট্যুর ও ট্রান্সফার', id:'Asisten AI Bosphorly · tur & transfer' },
    morning: { tr:'Günaydın', en:'Good morning', ru:'Доброе утро', uk:'Добрий ранок', de:'Guten Morgen', fr:'Bonjour', nl:'Goedemorgen', ar:'صباح الخير', he:'בוקר טוב', az:'Sabahınız xeyir', fa:'صبح بخیر', es:'Buenos días', it:'Buongiorno', pt:'Bom dia', hr:'Dobro jutro', hu:'Jó reggelt', bs:'Dobro jutro', zh:'早上好', ja:'おはようございます', ko:'좋은 아침이에요', hi:'सुप्रभात', bn:'শুভ সকাল', id:'Selamat pagi' },
    afternoon: { tr:'İyi günler', en:'Good afternoon', ru:'Добрый день', uk:'Добрий день', de:'Guten Tag', fr:'Bonjour', nl:'Goedemiddag', ar:'طاب يومك', he:'צהריים טובים', az:'Günortanız xeyir', fa:'روز بخیر', es:'Buenas tardes', it:'Buon pomeriggio', pt:'Boa tarde', hr:'Dobar dan', hu:'Jó napot', bs:'Dobar dan', zh:'下午好', ja:'こんにちは', ko:'좋은 오후예요', hi:'नमस्कार', bn:'শুভ অপরাহ্ন', id:'Selamat siang' },
    evening: { tr:'İyi akşamlar', en:'Good evening', ru:'Добрый вечер', uk:'Добрий вечір', de:'Guten Abend', fr:'Bonsoir', nl:'Goedenavond', ar:'مساء الخير', he:'ערב טוב', az:'Axşamınız xeyir', fa:'عصر بخیر', es:'Buenas noches', it:'Buonasera', pt:'Boa noite', hr:'Dobra večer', hu:'Jó estét', bs:'Dobro veče', zh:'晚上好', ja:'こんばんは', ko:'좋은 저녁이에요', hi:'शुभ संध्या', bn:'শুভ সন্ধ্যা', id:'Selamat malam' },
    memberWelcome: { tr:'Tekrar hoş geldin, {name} 💙', en:'Welcome back, {name} 💙', ru:'С возвращением, {name} 💙', uk:'З поверненням, {name} 💙', de:'Willkommen zurück, {name} 💙', fr:'Bon retour, {name} 💙', nl:'Welkom terug, {name} 💙', ar:'أهلاً بعودتك، {name} 💙', he:'ברוך שובך, {name} 💙', az:'Yenidən xoş gəldin, {name} 💙', fa:'خوش برگشتی، {name} 💙', es:'Bienvenido de nuevo, {name} 💙', it:'Bentornato, {name} 💙', pt:'Bem-vindo de volta, {name} 💙', hr:'Dobro došao natrag, {name} 💙', hu:'Üdv újra itt, {name} 💙', bs:'Dobro došao nazad, {name} 💙', zh:'欢迎回来，{name} 💙', ja:'おかえりなさい、{name} 💙', ko:'다시 오신 것을 환영해요, {name} 💙', hi:'वापसी पर स्वागत है, {name} 💙', bn:'ফিরে আসার জন্য স্বাগতম, {name} 💙', id:'Selamat datang kembali, {name} 💙' },
    welcome: { tr:'Merhaba! Ben Bosphorly’nin yapay zekâ asistanı Mimo 🌊 İstanbul turları, Boğaz gezileri, hamam, havalimanı transferleri veya İstanbul gezi önerileri hakkında sorabilirsin.', en:'Hello! I am Mimo, Bosphorly’s AI assistant 🌊 Ask me about Istanbul tours, Bosphorus cruises, hammams, airport transfers, or local Istanbul tips.', ru:'Здравствуйте! Я Mimo — ИИ-ассистент Bosphorly 🌊 Спрашивайте о турах по Стамбулу, круизах по Босфору, хаммаме, трансферах и советах по городу.', uk:'Вітаю! Я Mimo — ШІ-асистент Bosphorly 🌊 Запитуйте про тури Стамбулом, круїзи Босфором, хамам, трансфери та поради щодо міста.', de:'Hallo! Ich bin Mimo, der KI-Assistent von Bosphorly 🌊 Fragen Sie nach Istanbul-Touren, Bosporus-Fahrten, Hamam, Flughafentransfers oder Stadttipps.', fr:'Bonjour ! Je suis Mimo, l’assistant IA de Bosphorly 🌊 Posez vos questions sur les visites d’Istanbul, croisières, hammams, transferts ou conseils locaux.', nl:'Hallo! Ik ben Mimo, de AI-assistent van Bosphorly 🌊 Stel je vragen over tours, Bosporuscruises, hamam, luchthaventransfers of tips voor Istanbul.', ar:'مرحبًا! أنا Mimo، مساعد الذكاء الاصطناعي من Bosphorly 🌊 اسألني عن جولات إسطنبول ورحلات البوسفور والحمّام والنقل من المطار أو نصائح السفر.', he:'שלום! אני Mimo, עוזר הבינה המלאכותית של Bosphorly 🌊 שאלו על סיורים באיסטנבול, שייט בבוספורוס, חמאם, הסעות או טיפים מקומיים.', az:'Salam! Mən Bosphorly-nin süni intellekt köməkçisi Mimo 🌊 İstanbul turları, Boğaz gəzintiləri, hamam, transferlər və ya şəhər məsləhətləri haqqında soruşun.', fa:'سلام! من Mimo، دستیار هوش مصنوعی Bosphorly هستم 🌊 درباره تورهای استانبول، کروز بسفر، حمام، ترانسفر فرودگاه یا راهنمای شهر بپرسید.', es:'¡Hola! Soy Mimo, el asistente de IA de Bosphorly 🌊 Pregunta por tours en Estambul, cruceros, hammam, traslados o consejos locales.', it:'Ciao! Sono Mimo, l’assistente IA di Bosphorly 🌊 Chiedi pure su tour a Istanbul, crociere, hammam, transfer o consigli sulla città.', pt:'Olá! Sou Mimo, o assistente de IA da Bosphorly 🌊 Pergunte sobre passeios em Istambul, cruzeiros, hammam, traslados ou dicas locais.', hr:'Pozdrav! Ja sam Mimo, Bosphorlyjev AI asistent 🌊 Pitajte o turama, krstarenjima, hamamu, transferima ili savjetima za Istanbul.', hu:'Szia! Mimo vagyok, a Bosphorly AI-asszisztense 🌊 Kérdezz az isztambuli túrákról, hajókirándulásokról, hamamról, transzferekről vagy városi tippekről.', bs:'Zdravo! Ja sam Mimo, Bosphorlyjev AI asistent 🌊 Pitajte o turama, krstarenjima, hamamu, transferima ili savjetima za Istanbul.', zh:'您好！我是 Bosphorly 的人工智能助手 Mimo 🌊 欢迎咨询伊斯坦布尔游览、博斯普鲁斯游船、土耳其浴、机场接送或当地旅行建议。', ja:'こんにちは！BosphorlyのAIアシスタント、Mimoです 🌊 イスタンブールのツアー、クルーズ、ハマム、空港送迎、観光のコツなど何でもどうぞ。', ko:'안녕하세요! Bosphorly의 AI 도우미 Mimo예요 🌊 이스탄불 투어, 보스포루스 크루즈, 하맘, 공항 픽업이나 여행 팁에 대해 물어보세요.', hi:'नमस्ते! मैं Bosphorly का AI सहायक Mimo हूँ 🌊 इस्तांबुल टूर, क्रूज़, हम्माम, एयरपोर्ट ट्रांसफ़र या स्थानीय सुझावों के बारे में पूछें।', bn:'হ্যালো! আমি Bosphorly-এর এআই সহায়ক Mimo 🌊 ইস্তাম্বুল ট্যুর, ক্রুজ, হামাম, এয়ারপোর্ট ট্রান্সফার বা ভ্রমণ টিপস সম্পর্কে জিজ্ঞাসা করুন।', id:'Halo! Saya Mimo, asisten AI Bosphorly 🌊 Tanyakan tentang tur Istanbul, pelayaran, hamam, transfer bandara, atau tips lokal.' },
    ctxTransfer: { tr:'Havalimanından otele mi gidiyorsun? ✈️', en:'Heading from the airport to your hotel? ✈️', ru:'Едете из аэропорта в отель? ✈️', uk:'Їдете з аеропорту до готелю? ✈️', de:'Geht es vom Flughafen zum Hotel? ✈️', fr:'Vous allez de l’aéroport à l’hôtel ? ✈️', nl:'Ga je van de luchthaven naar je hotel? ✈️', ar:'هل تتجه من المطار إلى الفندق؟ ✈️', he:'נוסעים משדה התעופה למלון? ✈️', az:'Hava limanından otelə gedirsiniz? ✈️', fa:'از فرودگاه به هتل می‌روید؟ ✈️', es:'¿Vas del aeropuerto al hotel? ✈️', it:'Vai dall’aeroporto all’hotel? ✈️', pt:'Vai do aeroporto para o hotel? ✈️', hr:'Idete li s aerodroma do hotela? ✈️', hu:'A repülőtérről a szállodába tartasz? ✈️', bs:'Idete li s aerodroma do hotela? ✈️', zh:'您是要从机场前往酒店吗？✈️', ja:'空港からホテルへのご移動ですか？✈️', ko:'공항에서 호텔로 이동하시나요? ✈️', hi:'क्या आप एयरपोर्ट से होटल जा रहे हैं? ✈️', bn:'আপনি কি এয়ারপোর্ট থেকে হোটেলে যাচ্ছেন? ✈️', id:'Sedang menuju hotel dari bandara? ✈️' },
    ctxTour: { tr:'Hangi Boğaz turu sana uygun, birlikte bakalım mı? ⛵', en:'Shall we see which Bosphorus cruise suits you best? ⛵', ru:'Подберём вместе подходящий круиз по Босфору? ⛵', uk:'Підберемо разом круїз Босфором, який вам пасує? ⛵', de:'Sollen wir gemeinsam schauen, welche Bosporus-Fahrt zu dir passt? ⛵', fr:'On regarde ensemble quelle croisière sur le Bosphore vous convient ? ⛵', nl:'Zullen we samen kijken welke Bosporuscruise bij je past? ⛵', ar:'هل نرى معًا أي جولة في البوسفور تناسبك أكثر؟ ⛵', he:'נבדוק יחד איזה שייט בבוספורוס הכי מתאים לך? ⛵', az:'Hansı Boğaz turunun sənə uyğun olduğuna birlikdə baxaq? ⛵', fa:'باهم ببینیم کدام کروز بسفر برایتان مناسب‌تر است؟ ⛵', es:'¿Miramos juntos qué crucero por el Bósforo va mejor contigo? ⛵', it:'Vediamo insieme quale crociera sul Bosforo fa per te? ⛵', pt:'Vamos ver juntos qual cruzeiro pelo Bósforo combina com você? ⛵', hr:'Pogledajmo zajedno koje krstarenje Bosporom ti najviše odgovara? ⛵', hu:'Megnézzük együtt, melyik boszporuszi hajóút illik hozzád? ⛵', bs:'Pogledajmo zajedno koje krstarenje Bosporom ti najviše odgovara? ⛵', zh:'我们一起看看哪条博斯普鲁斯游船路线最适合您吧？⛵', ja:'どのボスポラスクルーズがぴったりか、一緒に見てみましょうか？⛵', ko:'어떤 보스포루스 크루즈가 잘 맞는지 함께 볼까요? ⛵', hi:'आइए साथ देखें कि कौन-सा बोस्फोरस क्रूज़ आपके लिए सबसे अच्छा है? ⛵', bn:'কোন বসফরাস ক্রুজটি আপনার জন্য সেরা, একসাথে দেখব কি? ⛵', id:'Mari kita lihat bersama pelayaran Bosphorus mana yang cocok untuk Anda? ⛵' },
    ctxHammam: { tr:'İlk hamam deneyimin mi? 🛁', en:'Is this your first hammam experience? 🛁', ru:'Это ваш первый опыт в турецком хаммаме? 🛁', uk:'Це ваш перший досвід у турецькому хамамі? 🛁', de:'Ist das dein erstes Hamam-Erlebnis? 🛁', fr:'Est-ce votre première expérience au hammam ? 🛁', nl:'Is dit je eerste hamam-ervaring? 🛁', ar:'هل هذه أول تجربة حمّام تركي لك؟ 🛁', he:'זו חוויית החמאם הראשונה שלך? 🛁', az:'Bu sənin ilk hamam təcrübəndir? 🛁', fa:'آیا این اولین تجربه حمام ترکی شماست؟ 🛁', es:'¿Es tu primera experiencia en un hammam? 🛁', it:'È la tua prima esperienza in un hammam? 🛁', pt:'É a sua primeira experiência em um hammam? 🛁', hr:'Je li ti ovo prvo iskustvo u hamamu? 🛁', hu:'Ez az első hamam-élményed? 🛁', bs:'Je li ti ovo prvo iskustvo u hamamu? 🛁', zh:'这是您第一次体验土耳其浴吗？🛁', ja:'トルコ式ハマムは初めての体験ですか？🛁', ko:'터키식 하맘은 첫 경험이신가요? 🛁', hi:'क्या यह आपका पहला हम्माम अनुभव है? 🛁', bn:'এটি কি আপনার প্রথম হামাম অভিজ্ঞতা? 🛁', id:'Apakah ini pengalaman hamam pertama Anda? 🛁' },
    qTransfer: { tr:'✈️ Havalimanı transferi', en:'✈️ Airport transfer', ru:'✈️ Трансфер из аэропорта', uk:'✈️ Трансфер з аеропорту', de:'✈️ Flughafentransfer', fr:'✈️ Transfert aéroport', nl:'✈️ Luchthaventransfer', ar:'✈️ النقل من المطار', he:'✈️ הסעה משדה התעופה', az:'✈️ Hava limanı transferi', fa:'✈️ ترانسفر فرودگاه', es:'✈️ Traslado aeropuerto', it:'✈️ Transfer aeroporto', pt:'✈️ Traslado aeroporto', hr:'✈️ Prijevoz s aerodroma', hu:'✈️ Reptéri transzfer', bs:'✈️ Transfer s aerodroma', zh:'✈️ 机场接送', ja:'✈️ 空港送迎', ko:'✈️ 공항 픽업', hi:'✈️ एयरपोर्ट ट्रांसफ़र', bn:'✈️ এয়ারপোর্ট ট্রান্সফার', id:'✈️ Transfer bandara' },
    qCruise: { tr:'⛵ Boğaz turu', en:'⛵ Bosphorus cruise', ru:'⛵ Круиз по Босфору', uk:'⛵ Круїз Босфором', de:'⛵ Bosporus-Fahrt', fr:'⛵ Croisière Bosphore', nl:'⛵ Bosporuscruise', ar:'⛵ جولة البوسفور', he:'⛵ שייט בבוספורוס', az:'⛵ Boğaz turu', fa:'⛵ کروز بسفر', es:'⛵ Crucero Bósforo', it:'⛵ Crociera Bosforo', pt:'⛵ Cruzeiro Bósforo', hr:'⛵ Krstarenje Bosporom', hu:'⛵ Boszporuszi hajóút', bs:'⛵ Krstarenje Bosporom', zh:'⛵ 博斯普鲁斯游船', ja:'⛵ ボスポラスクルーズ', ko:'⛵ 보스포루스 크루즈', hi:'⛵ बोस्फोरस क्रूज़', bn:'⛵ বসফরাস ক্রুজ', id:'⛵ Pelayaran Bosphorus' },
    qHammam: { tr:'🛁 Hamam', en:'🛁 Hammam', ru:'🛁 Хаммам', uk:'🛁 Хамам', de:'🛁 Hamam', fr:'🛁 Hammam', nl:'🛁 Hamam', ar:'🛁 الحمّام التركي', he:'🛁 חמאם', az:'🛁 Hamam', fa:'🛁 حمام ترکی', es:'🛁 Hammam', it:'🛁 Hammam', pt:'🛁 Hammam', hr:'🛁 Hamam', hu:'🛁 Hamam', bs:'🛁 Hamam', zh:'🛁 土耳其浴', ja:'🛁 ハマム', ko:'🛁 하맘', hi:'🛁 हम्माम', bn:'🛁 হামাম', id:'🛁 Hamam' },
    qPlan: { tr:'🗺️ 2 günlük plan', en:'🗺️ 2-day plan', ru:'🗺️ План на 2 дня', uk:'🗺️ План на 2 дні', de:'🗺️ 2-Tage-Plan', fr:'🗺️ Plan de 2 jours', nl:'🗺️ 2-daags plan', ar:'🗺️ خطة يومين', he:'🗺️ תוכנית ליומיים', az:'🗺️ 2 günlük plan', fa:'🗺️ برنامه ۲ روزه', es:'🗺️ Plan de 2 días', it:'🗺️ Piano di 2 giorni', pt:'🗺️ Roteiro de 2 dias', hr:'🗺️ 2-dnevni plan', hu:'🗺️ 2 napos terv', bs:'🗺️ 2-dnevni plan', zh:'🗺️ 2日游计划', ja:'🗺️ 2日間プラン', ko:'🗺️ 2일 일정', hi:'🗺️ 2 दिन का प्लान', bn:'🗺️ ২ দিনের প্ল্যান', id:'🗺️ Rencana 2 hari' },
    typing: { tr:'Mimo yazıyor…', en:'Mimo is typing…', ru:'Mimo печатает…', uk:'Mimo пише…', de:'Mimo schreibt…', fr:'Mimo écrit…', nl:'Mimo typt…', ar:'Mimo يكتب…', he:'Mimo מקליד…', az:'Mimo yazır…', fa:'Mimo در حال نوشتن…', es:'Mimo está escribiendo…', it:'Mimo sta scrivendo…', pt:'Mimo está digitando…', hr:'Mimo piše…', hu:'Mimo ír…', bs:'Mimo piše…', zh:'Mimo 正在输入…', ja:'Mimoが入力中…', ko:'Mimo가 입력 중…', hi:'Mimo लिख रहा है…', bn:'Mimo লিখছে…', id:'Mimo sedang mengetik…' },
    placeholder: { tr:'Mimo’ya sorunu yaz…', en:'Ask Mimo a question…', ru:'Напишите вопрос Mimo…', uk:'Напишіть запитання Mimo…', de:'Frage an Mimo…', fr:'Posez votre question à Mimo…', nl:'Stel je vraag aan Mimo…', ar:'اكتب سؤالك لـ Mimo…', he:'כתבו שאלה ל-Mimo…', az:'Mimo-ya sualınızı yazın…', fa:'سؤالتان را از Mimo بپرسید…', es:'Escribe tu pregunta a Mimo…', it:'Scrivi la tua domanda a Mimo…', pt:'Escreva sua pergunta para Mimo…', hr:'Upišite pitanje za Mima…', hu:'Írd be kérdésedet Mimónak…', bs:'Upišite pitanje za Mima…', zh:'向 Mimo 提问…', ja:'Mimoに質問を入力…', ko:'Mimo에게 질문을 입력하세요…', hi:'Mimo से अपना सवाल पूछें…', bn:'Mimo-কে আপনার প্রশ্ন লিখুন…', id:'Tulis pertanyaan untuk Mimo…' },
    send: { tr:'Gönder', en:'Send', ru:'Отправить', uk:'Надіслати', de:'Senden', fr:'Envoyer', nl:'Verstuur', ar:'إرسال', he:'שליחה', az:'Göndər', fa:'ارسال', es:'Enviar', it:'Invia', pt:'Enviar', hr:'Pošalji', hu:'Küldés', bs:'Pošalji', zh:'发送', ja:'送信', ko:'전송', hi:'भेजें', bn:'পাঠান', id:'Kirim' },
    human: { tr:'İnsanla konuş', en:'Talk to a human', ru:'Связаться с командой', uk:'Зв’язатися з командою', de:'Mit Team sprechen', fr:'Parler à un humain', nl:'Spreek met een medewerker', ar:'التحدث مع موظف', he:'לדבר עם נציג', az:'İnsanla danış', fa:'گفتگو با کارشناس', es:'Hablar con una persona', it:'Parla con il team', pt:'Falar com atendimento', hr:'Razgovaraj s osobom', hu:'Beszélj munkatárssal', bs:'Razgovaraj s osobom', zh:'联系人工客服', ja:'スタッフに相談', ko:'상담원 연결', hi:'टीम से बात करें', bn:'মানুষের সাথে কথা বলুন', id:'Bicara dengan tim' },
    emailPh: { tr:'E-posta adresin (yanıt için)', en:'Your email (for our reply)', ru:'Ваш e-mail (для ответа)', uk:'Ваш e-mail (для відповіді)', de:'Ihre E-Mail (für die Antwort)', fr:'Votre e-mail (pour la réponse)', nl:'Je e-mailadres (voor antwoord)', ar:'بريدك الإلكتروني (للرد)', he:'הדוא״ל שלך (לתשובה)', az:'E-poçt ünvanınız', fa:'ایمیل شما (برای پاسخ)', es:'Tu correo (para responderte)', it:'La tua e-mail (per rispondere)', pt:'Seu e-mail (para resposta)', hr:'Vaš e-mail (za odgovor)', hu:'E-mail címed (a válaszhoz)', bs:'Vaš e-mail (za odgovor)', zh:'您的邮箱（用于回复）', ja:'メールアドレス（返信用）', ko:'이메일 주소(회신용)', hi:'आपका ईमेल (जवाब के लिए)', bn:'আপনার ইমেইল (উত্তরের জন্য)', id:'Email Anda (untuk balasan)' },
    forwardBtn: { tr:'Ekibe ilet', en:'Forward to team', ru:'Отправить', uk:'Надіслати', de:'Weiterleiten', fr:'Transmettre', nl:'Doorsturen', ar:'إرسال للفريق', he:'שלח לצוות', az:'Komandaya göndər', fa:'ارسال به تیم', es:'Enviar al equipo', it:'Inoltra al team', pt:'Enviar à equipe', hr:'Proslijedi timu', hu:'Továbbítás', bs:'Proslijedi timu', zh:'转发给团队', ja:'チームへ送信', ko:'팀에 전달', hi:'टीम को भेजें', bn:'টিমকে পাঠান', id:'Kirim ke tim' },
    yesForward: { tr:'Evet, ilet', en:'Yes, forward', ru:'Да, передать', uk:'Так, передати', de:'Ja, weiterleiten', fr:'Oui, transmettre', nl:'Ja, stuur door', ar:'نعم، أرسلها', he:'כן, להעביר', az:'Bəli, göndər', fa:'بله، ارسال کن', es:'Sí, enviar', it:'Sì, inoltra', pt:'Sim, encaminhar', hr:'Da, proslijedi', hu:'Igen, továbbítsd', bs:'Da, proslijedi', zh:'是的，请转发', ja:'はい、引き継ぐ', ko:'네, 전달해 주세요', hi:'हाँ, भेजें', bn:'হ্যাঁ, পাঠান', id:'Ya, teruskan' },
    noThanks: { tr:'Hayır, teşekkürler', en:'No thanks', ru:'Нет, спасибо', uk:'Ні, дякую', de:'Nein, danke', fr:'Non merci', nl:'Nee, bedankt', ar:'لا، شكرًا', he:'לא, תודה', az:'Xeyr, təşəkkür', fa:'خیر، ممنون', es:'No, gracias', it:'No, grazie', pt:'Não, obrigado', hr:'Ne, hvala', hu:'Nem, köszönöm', bs:'Ne, hvala', zh:'不用了，谢谢', ja:'いいえ、結構です', ko:'아니요, 괜찮습니다', hi:'नहीं, धन्यवाद', bn:'না, ধন্যবাদ', id:'Tidak, terima kasih' },
    close: { tr:'Kapat', en:'Close', ru:'Закрыть', uk:'Закрити', de:'Schließen', fr:'Fermer', nl:'Sluiten', ar:'إغلاق', he:'סגור', az:'Bağla', fa:'بستن', es:'Cerrar', it:'Chiudi', pt:'Fechar', hr:'Zatvori', hu:'Bezárás', bs:'Zatvori', zh:'关闭', ja:'閉じる', ko:'닫기', hi:'बंद करें', bn:'বন্ধ করুন', id:'Tutup' },
    forwarded: { tr:'Sohbetin info@bosphorly.com adresine iletildi. En kısa sürede e-posta ile dönüş yapacağız.', en:'Your conversation was forwarded to info@bosphorly.com. We will reply by email shortly.', ru:'Переписка отправлена на info@bosphorly.com. Мы скоро ответим по e-mail.', uk:'Розмову надіслано на info@bosphorly.com. Ми скоро відповімо електронною поштою.', de:'Ihre Nachricht wurde an info@bosphorly.com weitergeleitet. Wir antworten in Kürze per E-Mail.', fr:'Votre conversation a été transmise à info@bosphorly.com. Nous vous répondrons par e-mail.', nl:'Je gesprek is doorgestuurd naar info@bosphorly.com. We reageren spoedig per e-mail.', ar:'تم إرسال محادثتك إلى info@bosphorly.com. سنرد عليك عبر البريد الإلكتروني قريبًا.', he:'השיחה הועברה אל info@bosphorly.com. נחזור אליך בדוא״ל בהקדם.', az:'Söhbətiniz info@bosphorly.com ünvanına göndərildi.', fa:'گفتگوی شما به info@bosphorly.com ارسال شد. به‌زودی پاسخ می‌دهیم.', es:'Tu conversación se envió a info@bosphorly.com. Responderemos por correo pronto.', it:'La conversazione è stata inoltrata a info@bosphorly.com. Risponderemo via e-mail.', pt:'Sua conversa foi enviada para info@bosphorly.com. Responderemos por e-mail em breve.', hr:'Razgovor je proslijeđen na info@bosphorly.com.', hu:'A beszélgetést továbbítottuk a info@bosphorly.com címre.', bs:'Razgovor je proslijeđen na info@bosphorly.com.', zh:'您的对话已转发至 info@bosphorly.com，我们将尽快通过邮件回复。', ja:'会話内容を info@bosphorly.com に送信しました。まもなくメールでご返信いたします。', ko:'대화 내용이 info@bosphorly.com으로 전달되었습니다. 곧 이메일로 회신드리겠습니다.', hi:'आपकी बातचीत info@bosphorly.com पर भेज दी गई है।', bn:'আপনার কথোপকথন info@bosphorly.com-এ পাঠানো হয়েছে।', id:'Percakapan Anda telah diteruskan ke info@bosphorly.com.' },
    verifyFirst: { tr:'Lütfen güvenlik doğrulamasını tamamlayın.', en:'Please complete the security check first.', ru:'Пожалуйста, пройдите проверку безопасности.', uk:'Будь ласка, пройдіть перевірку безпеки.', de:'Bitte schließen Sie zuerst die Sicherheitsprüfung ab.', fr:'Veuillez d’abord compléter la vérification de sécurité.', nl:'Voltooi eerst de beveiligingscontrole.', ar:'يرجى إكمال التحقق الأمني أولاً.', he:'נא להשלים תחילה את בדיקת האבטחה.', az:'Zəhmət olmasa təhlükəsizlik yoxlamasını tamamlayın.', fa:'لطفاً ابتدا بررسی امنیتی را تکمیل کنید.', es:'Completa primero la verificación de seguridad.', it:'Completa prima la verifica di sicurezza.', pt:'Conclua primeiro a verificação de segurança.', hr:'Molimo dovršite sigurnosnu provjeru.', hu:'Kérjük, először végezze el a biztonsági ellenőrzést.', bs:'Molimo dovršite sigurnosnu provjeru.', zh:'请先完成安全验证。', ja:'先にセキュリティ確認を完了してください。', ko:'먼저 보안 확인을 완료해 주세요.', hi:'कृपया पहले सुरक्षा जांच पूरी करें।', bn:'অনুগ্রহ করে প্রথমে নিরাপত্তা যাচাই সম্পন্ন করুন।', id:'Harap selesaikan pemeriksaan keamanan terlebih dahulu.' },
    offline: { tr:'Mimo şu an çevrimdışı; soruların için info@bosphorly.com adresine yazabilirsin.', en:'Mimo is currently offline; please email info@bosphorly.com for help.', ru:'Mimo сейчас недоступен; напишите на info@bosphorly.com.', uk:'Mimo зараз недоступний; напишіть на info@bosphorly.com.', de:'Mimo ist offline; schreiben Sie an info@bosphorly.com.', fr:'Mimo est hors ligne ; écrivez à info@bosphorly.com.', nl:'Mimo is offline; mail naar info@bosphorly.com.', ar:'Mimo غير متصل حاليًا؛ يرجى مراسلة info@bosphorly.com.', he:'Mimo לא זמין כרגע; כתבו ל-info@bosphorly.com.', az:'Mimo hazırda oflayndır; info@bosphorly.com ünvanına yazın.', fa:'Mimo آفلاین است؛ لطفاً به info@bosphorly.com ایمیل بزنید.', es:'Mimo está desconectado; escribe a info@bosphorly.com.', it:'Mimo non è disponibile; scrivi a info@bosphorly.com.', pt:'Mimo está offline; escreva para info@bosphorly.com.', hr:'Mimo je izvan mreže; pišite na info@bosphorly.com.', hu:'Mimo jelenleg offline; írj a info@bosphorly.com címre.', bs:'Mimo je van mreže; pišite na info@bosphorly.com.', zh:'Mimo 当前离线，请发送邮件至 info@bosphorly.com。', ja:'Mimoは現在オフラインです。info@bosphorly.com までメールでお問い合わせください。', ko:'Mimo가 현재 오프라인입니다. info@bosphorly.com으로 문의해 주세요.', hi:'Mimo अभी ऑफ़लाइन है; info@bosphorly.com पर ईमेल करें।', bn:'Mimo এখন অফলাইন; info@bosphorly.com-এ ইমেইল করুন।', id:'Mimo sedang offline; silakan email ke info@bosphorly.com.' },
    continueTg: { tr:"Telegram'dan devam et", en:'Continue on Telegram', ru:'Продолжить в Telegram', uk:'Продовжити в Telegram', de:'Auf Telegram fortsetzen', fr:'Continuer sur Telegram', nl:'Ga verder op Telegram', ar:'تابع على تيليجرام', he:'המשיכו בטלגרם', az:'Telegram-da davam et', fa:'در تلگرام ادامه دهید', es:'Continuar en Telegram', it:'Continua su Telegram', pt:'Continuar no Telegram', hr:'Nastavite na Telegramu', hu:'Folytatás Telegramon', bs:'Nastavite na Telegramu', zh:'在 Telegram 继续对话', ja:'Telegramで続ける', ko:'Telegram에서 계속하기', hi:'Telegram पर जारी रखें', bn:'Telegram-এ চালিয়ে যান', id:'Lanjutkan di Telegram' },
    kindNote: { tr:'Mimo’ya nazik davrandığın için teşekkürler 💙 Saygısız dil kullanılırsa sohbet sonlanır.', en:'Thank you for being kind to Mimo 💙 The chat ends if disrespectful language is used.', ru:'Спасибо за вежливое общение с Mimo 💙 При неуважительном тоне чат завершается.', uk:'Дякуємо за ввічливе спілкування з Mimo 💙 У разі неповажного тону чат завершується.', de:'Danke, dass du freundlich zu Mimo bist 💙 Bei respektloser Sprache wird der Chat beendet.', fr:'Merci d’être bienveillant avec Mimo 💙 Le chat prend fin en cas de langage irrespectueux.', nl:'Bedankt dat je vriendelijk bent tegen Mimo 💙 Bij respectloos taalgebruik stopt de chat.', ar:'شكرًا للطفك مع Mimo 💙 تنتهي المحادثة في حال استخدام لغة غير محترمة.', he:'תודה שאתם נחמדים אל Mimo 💙 השיחה מסתיימת במקרה של שפה לא מכבדת.', az:'Mimo ilə nəzakətli davrandığınız üçün təşəkkürlər 💙 Hörmətsiz ifadələr işlədilərsə söhbət sonlanır.', fa:'ممنون که با Mimo مهربان هستید 💙 در صورت استفاده از لحن نامحترمانه گفتگو پایان می‌یابد.', es:'Gracias por tratar con amabilidad a Mimo 💙 El chat finaliza si se usa lenguaje irrespetuoso.', it:'Grazie per essere gentile con Mimo 💙 La chat termina in caso di linguaggio irrispettoso.', pt:'Obrigado por tratar o Mimo com gentileza 💙 O chat é encerrado se houver linguagem desrespeitosa.', hr:'Hvala što si ljubazan prema Mimu 💙 Razgovor se prekida u slučaju nepoštovanja.', hu:'Köszönjük, hogy kedves vagy Mimóval 💙 Tiszteletlen hangnem esetén a csevegés véget ér.', bs:'Hvala što si ljubazan prema Mimu 💙 Razgovor se prekida u slučaju nepoštovanja.', zh:'感谢您温柔对待 Mimo 💙 若使用不尊重的语言，对话将自动结束。', ja:'Mimoに優しく接していただきありがとうございます 💙 礼儀を欠く言葉遣いがあった場合、チャットは終了します。', ko:'Mimo에게 다정하게 대해 주셔서 고마워요 💙 무례한 표현이 사용되면 대화가 종료됩니다.', hi:'Mimo के साथ विनम्र रहने के लिए धन्यवाद 💙 अपमानजनक भाषा का प्रयोग होने पर चैट समाप्त हो जाएगी।', bn:'Mimo-এর সাথে সদয় আচরণের জন্য ধন্যবাদ 💙 অসম্মানজনক ভাষা ব্যবহার করলে চ্যাট বন্ধ হয়ে যাবে।', id:'Terima kasih telah bersikap ramah kepada Mimo 💙 Obrolan akan berakhir jika bahasa tidak sopan digunakan.' },
    abuseClose: { tr:'Bu dille konuşmaya devam edemem. Sohbeti burada sonlandırıyorum. Bir sorunun varsa info@bosphorly.com’a yazabilirsin.', en:'I cannot continue the conversation with this language. I am ending the chat here. If you have an issue, you can write to info@bosphorly.com.', ru:'Я не могу продолжать разговор в таком тоне. Завершаю чат здесь. Если у вас есть вопрос, вы можете написать на info@bosphorly.com.', uk:'Я не можу продовжувати розмову в такому тоні. Завершую чат тут. Якщо маєте питання, напишіть на info@bosphorly.com.', de:'In diesem Ton kann ich das Gespräch nicht fortsetzen. Ich beende den Chat hier. Bei einem Anliegen können Sie an info@bosphorly.com schreiben.', fr:'Je ne peux pas poursuivre la conversation sur ce ton. Je mets fin au chat ici. En cas de problème, vous pouvez écrire à info@bosphorly.com.', nl:'Op deze toon kan ik het gesprek niet voortzetten. Ik beëindig de chat hier. Als je een vraag hebt, kun je mailen naar info@bosphorly.com.', ar:'لا يمكنني متابعة المحادثة بهذه اللغة. أنهي المحادثة هنا. إذا كانت لديك مشكلة يمكنك الكتابة إلى info@bosphorly.com.', he:'איני יכול להמשיך את השיחה בשפה כזו. אני מסיים את הצ׳אט כאן. אם יש לכם פנייה, ניתן לכתוב אל info@bosphorly.com.', az:'Bu üslubla söhbəti davam etdirə bilmərəm. Söhbəti burada sonlandırıram. Sualınız varsa info@bosphorly.com ünvanına yaza bilərsiniz.', fa:'با این لحن نمی‌توانم گفتگو را ادامه دهم. گفتگو را در اینجا پایان می‌دهم. اگر مشکلی دارید می‌توانید به info@bosphorly.com بنویسید.', es:'No puedo continuar la conversación con este lenguaje. Termino el chat aquí. Si tienes algún problema, puedes escribir a info@bosphorly.com.', it:'Non posso continuare la conversazione con questo linguaggio. Chiudo qui la chat. Se hai un problema, puoi scrivere a info@bosphorly.com.', pt:'Não posso continuar a conversa com essa linguagem. Encerro o chat aqui. Se tiver alguma questão, escreva para info@bosphorly.com.', hr:'Ne mogu nastaviti razgovor ovakvim rječnikom. Ovdje završavam razgovor. Ako imate pitanje, možete pisati na info@bosphorly.com.', hu:'Ilyen hangnemben nem tudom folytatni a beszélgetést. A csevegést itt lezárom. Ha kérdésed van, írhatsz az info@bosphorly.com címre.', bs:'Ne mogu nastaviti razgovor ovakvim rječnikom. Ovdje završavam razgovor. Ako imate pitanje, možete pisati na info@bosphorly.com.', zh:'我无法在这样的语言下继续对话。本次对话到此结束。如有问题，请发邮件至 info@bosphorly.com。', ja:'このような言葉遣いでは会話を続けられません。ここでチャットを終了します。ご用件がある場合は info@bosphorly.com までご連絡ください。', ko:'이러한 표현으로는 대화를 이어갈 수 없습니다. 여기서 대화를 종료합니다. 문의 사항이 있으시면 info@bosphorly.com으로 메일을 보내주세요.', hi:'मैं इस भाषा में बातचीत जारी नहीं रख सकता। मैं यहीं चैट समाप्त कर रहा हूँ। किसी समस्या के लिए आप info@bosphorly.com पर लिख सकते हैं।', bn:'এই ভাষায় আমি কথোপকথন চালিয়ে যেতে পারব না। আমি এখানেই চ্যাট শেষ করছি। কোনো সমস্যা থাকলে info@bosphorly.com-এ লিখতে পারেন।', id:'Saya tidak dapat melanjutkan percakapan dengan bahasa seperti ini. Saya mengakhiri obrolan di sini. Jika ada masalah, silakan tulis ke info@bosphorly.com.' }
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
    `<div class="bc-turnstile"></div>` +
    `<div class="bc-handoff" hidden><div class="bc-handoff-row"><input type="email" placeholder="${tr('emailPh')}" autocomplete="email">` +
    `<button type="button" class="bc-forward-btn">${tr('forwardBtn')}</button></div></div>` +
    `<div class="bc-actions"><button type="button" class="bc-human-btn">💬 ${tr('human')}</button></div>` +
    `<form class="bc-form"><input class="bc-input" type="text" maxlength="1000" placeholder="${tr('placeholder')}" autocomplete="off">` +
    `<button class="bc-send" type="submit">${tr('send')}</button></form>`;
  document.body.appendChild(panel);

  const headAvatar = panel.querySelector('.bc-head-avatar');
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
  const apiBase = window.BOSPHORLY_API && window.BOSPHORLY_API.base;

  let turnstileToken = '';
  let tsWidgetId = null;

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

  function sendFeedback(vote, upBtn, downBtn) {
    upBtn.disabled = true;
    downBtn.disabled = true;
    if (vote === 'up') upBtn.classList.add('active');
    else downBtn.classList.add('active');
    if (!apiBase) return;
    fetch(`${apiBase}/v1/assistant/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote, lang }),
    }).catch(() => {});
  }

  function renderMsg(role, text, opts = {}) {
    const isFirstBotMsg = role === 'bot' && !logEl.querySelector('.bc-msg-row.bot');
    const row = document.createElement('div');
    row.className = `bc-msg-row ${role === 'user' ? 'user' : 'bot'}`;

    const div = document.createElement('div');
    div.className = `bc-msg ${role === 'user' ? 'user' : 'bot'}`;

    if (role === 'bot') {
      const av = document.createElement('img');
      av.className = 'bc-bot-avatar';
      av.src = mimoSrc(opts.avatarState || 'happy');
      av.alt = 'Mimo';
      av.width = 28;
      av.height = 28;
      av.loading = 'lazy';
      av.decoding = 'async';

      const wrap = document.createElement('div');
      wrap.className = 'bc-msg-wrap';

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

      wrap.appendChild(div);

      if (!opts.noFeedback) {
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
  }

  let typingRow = null;
  function showTyping() {
    if (typingRow) return;
    headAvatar.src = mimoSrc('thinking');
    typingRow = document.createElement('div');
    typingRow.className = 'bc-typing';
    typingRow.innerHTML =
      `<img class="bc-bot-avatar" src="${mimoSrc('thinking')}" alt="Mimo" width="28" height="28" loading="lazy" decoding="async">` +
      `<div class="bc-typing-bubble"><span class="bc-dots"><span class="bc-dot"></span><span class="bc-dot"></span><span class="bc-dot"></span></span>` +
      `<span class="bc-typing-label">${tr('typing')}</span></div>`;
    logEl.appendChild(typingRow);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function hideTyping() {
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

  async function submitMessage(rawMessage) {
    const message = String(rawMessage || '').trim();
    if (!message || sendBtn.disabled || isChatClosed) return;
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
    showTyping();
    const recent = history.slice(-6);
    try {
      const res = await fetch(`${apiBase}/v1/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, lang, history: recent, sessionId, turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.closed || data.status === 'closed') {
        const closeReply = data.reply || tr('abuseClose');
        history.push({ role: 'assistant', content: closeReply });
        saveHistory();
        hideTyping();
        renderMsg('bot', closeReply, { noFeedback: true, avatarState: 'default' });
        lockChatClosed();
        return;
      }
      const reply = data.reply || data.error || tr('offline');
      history.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
      saveHistory();
      hideTyping();
      renderMsg('bot', reply, { handoffOffer: Boolean(data.handoffOffer), avatarState: 'happy' });
      if (data.handoff) handoffBox.hidden = false;
    } catch {
      hideTyping();
      renderMsg('bot', tr('offline'));
      handoffBox.hidden = false;
    } finally {
      hideTyping();
      sendBtn.disabled = isChatClosed;
      resetTurnstile();
    }
  }

  const toggle = (open) => {
    panel.hidden = !open;
    if (open) {
      loadTurnstile();
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

  closeBtn.addEventListener('click', () => toggle(false));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggle(false); });
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
    if (window.BOSPHORLY_API.turnstileSiteKey && !turnstileToken) {
      renderMsg('bot', tr('verifyFirst'));
      return;
    }
    forwardBtn.disabled = true;
    try {
      const res = await fetch(`${apiBase}/v1/assistant/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang, history: history.slice(-6), sessionId, turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.closed || data.status === 'closed' || res.status === 403) {
        lockChatClosed();
        return;
      }
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
      forwardBtn.disabled = isChatClosed;
      resetTurnstile();
    }
  });

  loadTurnstile();
  if (!isChatClosed) input.focus();
  if (window.__bosphorlyInitialQuestion && !isChatClosed) {
    const q = window.__bosphorlyInitialQuestion;
    window.__bosphorlyInitialQuestion = '';
    submitMessage(q);
  }
})();
