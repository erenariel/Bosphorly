import {
  ASSISTANT_MESSAGES,
  SUPPORTED_LANGS,
  blockActors,
  detectLanguage,
  forwardConversationEmail,
  getBlockStatus,
  isAbuseAgainstMimo,
  isAffirmative,
  isNegative,
  redactSensitive,
  runAssistant,
  transcribeAudio,
} from './assistant.js';

export const TG_TEXT = {
  welcome: {
    tr: 'Merhaba, ben Mimo 🌊 Bosphorly’nin yapay zekâ asistanıyım. Havalimanı transferleri, Boğaz turları, hamam, şehir turları veya İstanbul gezi önerileri hakkında sorabilir ya da ekibimize ulaşmak için "insanla konuşmak istiyorum" yazabilirsin.\nMimo’ya nazik davrandığın için teşekkürler 💙 Saygısız dil kullanılırsa sohbet sonlanır.',
    en: 'Hello, I am Mimo 🌊 I am Bosphorly’s AI assistant. Ask me about airport transfers, Bosphorus cruises, hammams, city tours, or Istanbul tips—or type "talk to a human" to reach our team.\nThank you for being kind to Mimo 💙 The chat ends if disrespectful language is used.',
    ru: 'Здравствуйте, я Mimo 🌊 ИИ-ассистент Bosphorly по Стамбулу. Спрашивайте о трансферах, круизах по Босфору, хаммамах, турах и советах по городу или напишите «человек», чтобы связаться с командой.\nСпасибо за вежливое общение с Mimo 💙 При неуважительном тоне чат завершается.',
    uk: 'Вітаю, я Mimo 🌊 ШІ-асистент Bosphorly у Стамбулі. Запитуйте про трансфери, круїзи Босфором, хамами, тури та поради щодо міста або напишіть «оператор», щоб зв’язатися з командою.\nДякуємо за ввічливе спілкування з Mimo 💙 У разі неповажного тону чат завершується.',
    de: 'Hallo, ich bin Mimo 🌊 Der KI-Assistent von Bosphorly für Istanbul. Fragen Sie mich nach Flughafentransfers, Bosporus-Fahrten, Hamam, Touren oder Istanbul-Tipps—oder schreiben Sie „Mit Team sprechen“.\nDanke, dass du freundlich zu Mimo bist 💙 Bei respektloser Sprache wird der Chat beendet.',
    fr: 'Bonjour, je suis Mimo 🌊 L’assistant IA de Bosphorly à Istanbul. Posez vos questions sur les transferts, croisières sur le Bosphore, hammams, visites ou conseils locaux—ou écrivez « parler à un humain ».\nMerci d’être bienveillant avec Mimo 💙 Le chat prend fin en cas de langage irrespectueux.',
    nl: 'Hallo, ik ben Mimo 🌊 De AI-assistent van Bosphorly voor Istanbul. Stel vragen over transfers, Bosporuscruises, hamam, tours of tips voor Istanbul—of typ „spreek met een medewerker“.\nBedankt dat je vriendelijk bent tegen Mimo 💙 Bij respectloos taalgebruik stopt de chat.',
    ar: 'مرحبًا، أنا Mimo 🌊 مساعد الذكاء الاصطناعي من Bosphorly في إسطنبول. اسألني عن النقل من المطار، رحلات البوسفور، الحمّام، جولات المدينة أو نصائح السفر—أو اكتب "التحدث مع موظف" للتواصل مع فريقنا.\nشكرًا للطفك مع Mimo 💙 تنتهي المحادثة في حال استخدام لغة غير محترمة.',
    he: 'שלום, אני Mimo 🌊 עוזר הבינה המלאכותית של Bosphorly באיסטנבול. שאלו אותי על הסעות, שייט בבוספורוס, חמאם, סיורים וטיפים—או כתבו "לדבר עם נציג".\nתודה שאתם נחמדים אל Mimo 💙 השיחה מסתיימת במקרה של שפה לא מכבדת.',
    az: 'Salam, mən Mimo 🌊 Bosphorly-nin süni intellekt köməkçisiyəm. Transferlər, Boğaz turları, hamam, şəhər gəzintiləri və ya İstanbul məsləhətləri barədə soruşun, yaxud "insanla danış" yazın.\nMimo ilə nəzakətli davrandığınız üçün təşəkkürlər 💙 Hörmətsiz ifadələr işlədilərsə söhbət sonlanır.',
    fa: 'سلام، من Mimo هستم 🌊 دستیار هوش مصنوعی Bosphorly در استانبول. درباره ترانسفر، کروز بسفر، حمام، تورها یا راهنمای استانبول بپرسید یا برای گفتگو با تیم بنویسید «گفتگو با کارشناس».\nممنون که با Mimo مهربان هستید 💙 در صورت استفاده از لحن نامحترمانه گفتگو پایان می‌یابد.',
    es: '¡Hola, soy Mimo 🌊 El asistente de IA de Bosphorly en Estambul. Pregunta por traslados, cruceros por el Bósforo, hammam, tours o consejos locales—o escribe «hablar con una persona».\nGracias por tratar con amabilidad a Mimo 💙 El chat finaliza si se usa lenguaje irrespetuoso.',
    it: 'Ciao, sono Mimo 🌊 L’assistente IA di Bosphorly a Istanbul. Chiedi pure su transfer, crociere sul Bosforo, hammam, tour o consigli—oppure scrivi «parla con il team».\nGrazie per essere gentile con Mimo 💙 La chat termina in caso di linguaggio irrispettoso.',
    pt: 'Olá, sou Mimo 🌊 O assistente de IA da Bosphorly em Istambul. Pergunte sobre traslados, cruzeiros pelo Bósforo, hammam, passeios ou dicas—ou digite «falar com atendimento».\nObrigado por tratar o Mimo com gentileza 💙 O chat é encerrado se houver linguagem desrespeitosa.',
    hr: 'Pozdrav, ja sam Mimo 🌊 Bosphorlyjev AI asistent za Istanbul. Pitajte o transferima, krstarenjima Bosporom, hamamu, turama ili savjetima—ili napišite „razgovaraj s osobom“.\nHvala što si ljubazan prema Mimu 💙 Razgovor se prekida u slučaju nepoštovanja.',
    hu: 'Szia, Mimo vagyok 🌊 A Bosphorly mesterséges intelligencia asszisztense Isztambulban. Kérdezz transzferekről, boszporuszi hajózásról, hamamról, túrákról vagy tippekről—vagy írd be: „beszélj munkatárssal”.\nKöszönjük, hogy kedves vagy Mimóval 💙 Tiszteletlen hangnem esetén a csevegés véget ér.',
    bs: 'Zdravo, ja sam Mimo 🌊 Bosphorlyjev AI asistent za Istanbul. Pitajte o transferima, krstarenjima Bosporom, hamamu, turama ili savjetima—ili napišite „razgovaraj s osobom“.\nHvala što si ljubazan prema Mimu 💙 Razgovor se prekida u slučaju nepoštovanja.',
    zh: '您好，我是 Mimo 🌊 Bosphorly 的伊斯坦布尔人工智能助手。欢迎咨询机场接送、博斯普鲁斯游船、土耳其浴、城市游览或当地攻略—也可以输入“联系人工客服”。\n感谢您温柔对待 Mimo 💙 若使用不尊重的语言，对话将自动结束。',
    ja: 'こんにちは、Mimoです 🌊 Bosphorlyのイスタンブール案内AIアシスタントです。空港送迎、クルーズ、ハマム、市内ツアーや観光のコツをお気軽にお尋ねください。「スタッフに相談」と入力するとチームにお繋ぎします。\nMimoに優しく接していただきありがとうございます 💙 礼儀を欠く言葉遣いがあった場合、チャットは終了します。',
    ko: '안녕하세요, 저는 Mimo예요 🌊 Bosphorly의 이스탄불 AI 도우미입니다. 공항 픽업, 보스포루스 크루즈, 하맘, 시티 투어나 여행 팁을 물어보세요. 팀 연결은 “상담원 연결”을 입력하세요.\nMimo에게 다정하게 대해 주셔서 고마워요 💙 무례한 표현이 사용되면 대화가 종료됩니다.',
    hi: 'नमस्ते, मैं Mimo हूँ 🌊 Bosphorly का इस्तांबुल AI सहायक। ट्रांसफ़र, बोस्फोरस क्रूज़, हम्माम, सिटी टूर या यात्रा सुझावों के बारे में पूछें—या टीम से जुड़ने के लिए "टीम से बात करें" लिखें।\nMimo के साथ विनम्र रहने के लिए धन्यवाद 💙 अपमानजनक भाषा का प्रयोग होने पर चैट समाप्त हो जाएगी।',
    bn: 'হ্যালো, আমি Mimo 🌊 Bosphorly-এর ইস্তাম্বুল এআই সহায়ক। ট্রান্সফার, বসফরাস ক্রুজ, হামাম, সিটি ট্যুর বা ভ্রমণ টিপস নিয়ে জিজ্ঞাসা করুন—অথবা টিমের সাথে কথা বলতে "মানুষের সাথে কথা বলুন" লিখুন।\nMimo-এর সাথে সদয় আচরণের জন্য ধন্যবাদ 💙 অসম্মানজনক ভাষা ব্যবহার করলে চ্যাট বন্ধ হয়ে যাবে।',
    id: 'Halo, saya Mimo 🌊 Asisten AI Bosphorly untuk Istanbul. Tanyakan tentang transfer bandara, pelayaran Bosphorus, hamam, tur kota, atau tips lokal—atau ketik "bicara dengan tim".\nTerima kasih telah bersikap ramah kepada Mimo 💙 Obrolan akan berakhir jika bahasa tidak sopan digunakan.',
  },
  askEmail: {
    tr: 'Mesajınızı info@bosphorly.com ekibimize iletmem için lütfen e-posta adresinizi yazın (iptal etmek için /cancel).',
    en: 'Please reply with your email address so I can forward your message to our team at info@bosphorly.com (or /cancel).',
    ru: 'Пожалуйста, укажите ваш e-mail, чтобы я передал сообщение нашей команде на info@bosphorly.com (или /cancel).',
    uk: 'Будь ласка, вкажіть ваш e-mail, щоб я передав повідомлення команді на info@bosphorly.com (або /cancel).',
    de: 'Bitte nennen Sie Ihre E-Mail-Adresse, damit ich Ihre Nachricht an info@bosphorly.com weiterleiten kann (oder /cancel).',
    fr: 'Merci d’indiquer votre adresse e-mail afin que je transmette votre message à info@bosphorly.com (ou /cancel).',
    nl: 'Stuur je e-mailadres zodat ik je bericht kan doorsturen naar info@bosphorly.com (of /cancel).',
    ar: 'يرجى إرسال بريدك الإلكتروني لأتمكن من تحويل رسالتك إلى فريقنا على info@bosphorly.com (أو /cancel).',
    he: 'אנא שלחו את כתובת הדוא״ל שלכם כדי שאעביר את הפנייה לצוות ב-info@bosphorly.com (או /cancel).',
    az: 'Mesajınızı info@bosphorly.com komandamıza yönləndirmək üçün e-poçt ünvanınızı yazın (ləğv etmək üçün /cancel).',
    fa: 'لطفاً ایمیل خود را بفرستید تا پیامتان را به تیم ما در info@bosphorly.com ارسال کنم (یا /cancel).',
    es: 'Por favor, responde con tu correo electrónico para enviarlo a info@bosphorly.com (o /cancel).',
    it: 'Rispondi con la tua e-mail così posso inoltrare il messaggio a info@bosphorly.com (o /cancel).',
    pt: 'Responda com seu e-mail para que eu encaminhe sua mensagem para info@bosphorly.com (ou /cancel).',
    hr: 'Odgovorite svojom e-mail adresom kako bih poruku proslijedio timu na info@bosphorly.com (ili /cancel).',
    hu: 'Kérlek, írd meg az e-mail címed, hogy továbbítsam az üzeneted az info@bosphorly.com címre (vagy /cancel).',
    bs: 'Odgovorite svojom e-mail adresom kako bih poruku proslijedio timu na info@bosphorly.com (ili /cancel).',
    zh: '请回复您的电子邮箱地址，以便我将消息转发至 info@bosphorly.com（取消请输入 /cancel）。',
    ja: 'info@bosphorly.com へ引き継ぐためメールアドレスをご返信ください（中止は /cancel）。',
    ko: 'info@bosphorly.com 팀에 전달할 수 있도록 이메일 주소를 입력해 주세요(취소는 /cancel).',
    hi: 'कृपया अपना ईमेल पता लिखें ताकि मैं आपका संदेश info@bosphorly.com पर हमारी टीम को भेज सकूँ (या /cancel)।',
    bn: 'আপনার বার্তা info@bosphorly.com-এ পাঠাতে অনুগ্রহ করে আপনার ইমেইল ঠিকানা লিখুন (বাতিল করতে /cancel)।',
    id: 'Silakan balas dengan alamat email Anda agar saya dapat meneruskannya ke info@bosphorly.com (atau /cancel).',
  },
  forwarded: {
    tr: 'Teşekkürler! Mesajınız ve son konuşmamız info@bosphorly.com ekibimize iletildi. En kısa sürede e-posta ile dönüş yapacağız.',
    en: 'Thank you! Your message and recent conversation have been forwarded to info@bosphorly.com. Our team will reply by email shortly.',
    ru: 'Спасибо! Ваше сообщение и недавняя переписка отправлены на info@bosphorly.com. Наша команда скоро ответит по e-mail.',
    uk: 'Дякуємо! Ваше повідомлення та нещодавнє листування надіслано на info@bosphorly.com. Команда незабаром відповість на e-mail.',
    de: 'Vielen Dank! Ihre Nachricht wurde an info@bosphorly.com weitergeleitet. Unser Team antwortet in Kürze per E-Mail.',
    fr: 'Merci ! Votre message et l’historique récent ont été transmis à info@bosphorly.com. Notre équipe vous répondra rapidement par e-mail.',
    nl: 'Bedankt! Je bericht en recente gesprek zijn doorgestuurd naar info@bosphorly.com. Ons team reageert snel per e-mail.',
    ar: 'شكرًا لك! تم إرسال رسالتك والمحادثة الأخيرة إلى info@bosphorly.com. سيتواصل معك فريقنا عبر البريد الإلكتروني قريبًا.',
    he: 'תודה! הפנייה והשיחה האחרונה הועברו ל-info@bosphorly.com. הצוות שלנו יחזור אליכם בדוא״ל בהקדם.',
    az: 'Təşəkkür edirik! Mesajınız və son söhbət info@bosphorly.com ünvanına göndərildi. Komandamız tezliklə e-poçtla cavab verəcək.',
    fa: 'متشکرم! پیام و گفتگوی اخیر شما به info@bosphorly.com ارسال شد. تیم ما به‌زودی از طریق ایمیل پاسخ می‌دهد.',
    es: '¡Gracias! Tu mensaje y la conversación reciente se enviaron a info@bosphorly.com. Te responderemos pronto por correo.',
    it: 'Grazie! Il messaggio e la conversazione recente sono stati inoltrati a info@bosphorly.com. Il team risponderà presto via e-mail.',
    pt: 'Obrigado! Sua mensagem e a conversa recente foram enviadas para info@bosphorly.com. Nossa equipe responderá por e-mail em breve.',
    hr: 'Hvala! Vaša poruka i nedavni razgovor proslijeđeni su na info@bosphorly.com. Tim će uskoro odgovoriti e-mailom.',
    hu: 'Köszönjük! Üzenetedet és az előzményeket továbbítottuk az info@bosphorly.com címre. Csapatunk hamarosan válaszol.',
    bs: 'Hvala! Vaša poruka i nedavni razgovor proslijeđeni su na info@bosphorly.com. Tim će uskoro odgovoriti e-mailom.',
    zh: '谢谢！您的消息与近期对话已转发至 info@bosphorly.com，我们的团队会尽快通过邮件回复您。',
    ja: 'ありがとうございます！メッセージと直近の会話内容を info@bosphorly.com へ転送しました。担当よりメールでご返信いたします。',
    ko: '감사합니다! 메시지와 최근 대화가 info@bosphorly.com으로 전달되었습니다. 곧 이메일로 답변드리겠습니다.',
    hi: 'धन्यवाद! आपका संदेश और हाल की बातचीत info@bosphorly.com पर भेज दी गई है। हमारी टीम जल्द ईमेल से जवाब देगी।',
    bn: 'ধন্যবাদ! আপনার বার্তা ও সাম্প্রতিক কথোপকথন info@bosphorly.com-এ পাঠানো হয়েছে। আমাদের টিম শীঘ্রই ইমেইলে উত্তর দেবে।',
    id: 'Terima kasih! Pesan dan percakapan terbaru Anda telah diteruskan ke info@bosphorly.com. Tim kami akan segera membalas via email.',
  },
  forwardFailed: {
    tr: 'Şu an e-posta iletiminde sorun oluştu. Lütfen doğrudan info@bosphorly.com adresine yazın.',
    en: 'Could not forward right now. Please email us directly at info@bosphorly.com.',
    ru: 'Не удалось отправить сообщение. Пожалуйста, напишите напрямую на info@bosphorly.com.',
    uk: 'Не вдалося надіслати повідомлення. Будь ласка, напишіть напряму на info@bosphorly.com.',
    de: 'Weiterleitung gerade nicht möglich. Bitte schreiben Sie direkt an info@bosphorly.com.',
    fr: 'Impossible de transmettre pour le moment. Écrivez directement à info@bosphorly.com.',
    nl: 'Doorsturen lukt nu niet. Mail rechtstreeks naar info@bosphorly.com.',
    ar: 'تعذر الإرسال حاليًا. يرجى مراسلتنا مباشرة على info@bosphorly.com.',
    he: 'לא ניתן להעביר כרגע. אנא כתבו ישירות אל info@bosphorly.com.',
    az: 'Hazırda e-poçt göndərilə bilmədi. Zəhmət olmasa birbaşa info@bosphorly.com ünvanına yazın.',
    fa: 'ارسال ایمیل در حال حاضر ممکن نشد. لطفاً مستقیماً به info@bosphorly.com پیام دهید.',
    es: 'No se pudo reenviar ahora. Escríbenos directamente a info@bosphorly.com.',
    it: 'Impossibile inoltrare ora. Scrivi direttamente a info@bosphorly.com.',
    pt: 'Não foi possível encaminhar agora. Escreva diretamente para info@bosphorly.com.',
    hr: 'Trenutačno nije moguće proslijediti. Pišite izravno na info@bosphorly.com.',
    hu: 'Most nem sikerült továbbítani. Kérjük, írj közvetlenül az info@bosphorly.com címre.',
    bs: 'Trenutno nije moguće proslijediti. Pišite direktno na info@bosphorly.com.',
    zh: '暂时无法转发邮件，请直接发送邮件至 info@bosphorly.com。',
    ja: '現在メールを送信できませんでした。直接 info@bosphorly.com までご連絡ください。',
    ko: '지금은 이메일 전달에 실패했습니다. info@bosphorly.com으로 직접 메일을 보내주세요.',
    hi: 'अभी ईमेल नहीं भेजा जा सका। कृपया सीधे info@bosphorly.com पर ईमेल करें।',
    bn: 'এই মুহূর্তে পাঠানো যায়নি। অনুগ্রহ করে সরাসরি info@bosphorly.com-এ ইমেইল করুন।',
    id: 'Gagal meneruskan saat ini. Silakan kirim email langsung ke info@bosphorly.com.',
  },
  voiceTooLong: {
    tr: 'Sesli mesaj en fazla 60 saniye olabilir. Lütfen daha kısa bir kayıt gönderin veya sorunuzu yazın.',
    en: 'Voice messages can be at most 60 seconds. Please send a shorter recording or type your question.',
    ru: 'Голосовые сообщения — не длиннее 60 секунд. Пришлите более короткую запись или напишите вопрос.',
    uk: 'Голосові повідомлення — не довше 60 секунд. Надішліть коротший запис або напишіть запитання.',
    de: 'Sprachnachrichten dürfen höchstens 60 Sekunden lang sein. Bitte senden Sie eine kürzere Aufnahme oder schreiben Sie Ihre Frage.',
    fr: 'Les messages vocaux ne peuvent pas dépasser 60 secondes. Envoyez un enregistrement plus court ou écrivez votre question.',
    nl: 'Spraakberichten mogen maximaal 60 seconden duren. Stuur een kortere opname of typ je vraag.',
    ar: 'الرسائل الصوتية يجب ألا تتجاوز 60 ثانية. يرجى إرسال تسجيل أقصر أو كتابة سؤالك.',
    he: 'הודעות קוליות יכולות להיות עד 60 שניות. שלחו הקלטה קצרה יותר או כתבו את השאלה.',
    az: 'Səsli mesaj ən çox 60 saniyə ola bilər. Zəhmət olmasa daha qısa bir yazı göndərin və ya sualınızı yazın.',
    fa: 'پیام صوتی حداکثر ۶۰ ثانیه است. لطفاً فایل کوتاه‌تری بفرستید یا سؤالتان را بنویسید.',
    es: 'Los mensajes de voz pueden durar como máximo 60 segundos. Envía una grabación más corta o escribe tu pregunta.',
    it: 'I messaggi vocali possono durare al massimo 60 secondi. Invia una registrazione più breve o scrivi la domanda.',
    pt: 'Mensagens de voz podem ter no máximo 60 segundos. Envie uma gravação mais curta ou escreva a sua pergunta.',
    hr: 'Glasovne poruke mogu trajati najviše 60 sekundi. Pošaljite kraći zapis ili upišite pitanje.',
    hu: 'A hangüzenet legfeljebb 60 másodperc lehet. Kérjük, küldjön rövidebb felvételt, vagy írja le a kérdését.',
    bs: 'Glasovne poruke mogu trajati najviše 60 sekundi. Pošaljite kraći zapis ili upišite pitanje.',
    zh: '语音消息最长 60 秒。请发送更短的录音，或直接输入您的问题。',
    ja: 'ボイスメッセージは60秒以内にしてください。短い録音を送るか、質問を入力してください。',
    ko: '음성 메시지는 최대 60초입니다. 더 짧은 녹음을 보내거나 질문을 입력해 주세요.',
    hi: 'वॉइस संदेश अधिकतम 60 सेकंड का हो सकता है। कृपया छोटी रिकॉर्डिंग भेजें या अपना सवाल लिखें।',
    bn: 'ভয়েস মেসেজ সর্বোচ্চ ৬০ সেকেন্ড হতে পারে। অনুগ্রহ করে ছোট রেকর্ডিং পাঠান বা প্রশ্নটি লিখুন।',
    id: 'Pesan suara paling lama 60 detik. Kirim rekaman yang lebih pendek atau ketik pertanyaan Anda.',
  },
  voiceFailed: {
    tr: 'Sesini yazıya çeviremedim. Lütfen yeniden deneyin veya sorunuzu yazın.',
    en: 'I could not turn that voice message into text. Please try again or type your question.',
    ru: 'Не удалось распознать голосовое сообщение. Попробуйте ещё раз или напишите вопрос.',
    uk: 'Не вдалося розпізнати голосове повідомлення. Спробуйте ще раз або напишіть запитання.',
    de: 'Die Sprachnachricht konnte nicht in Text umgewandelt werden. Bitte versuchen Sie es erneut oder schreiben Sie Ihre Frage.',
    fr: 'Impossible de transcrire ce message vocal. Réessayez ou écrivez votre question.',
    nl: 'Dit spraakbericht kon niet naar tekst worden omgezet. Probeer het opnieuw of typ je vraag.',
    ar: 'تعذّر تحويل الرسالة الصوتية إلى نص. يرجى المحاولة مرة أخرى أو كتابة سؤالك.',
    he: 'לא הצלחנו להפוך את ההודעה הקולית לטקסט. נסו שוב או כתבו את השאלה.',
    az: 'Səsli mesajı mətnə çevirə bilmədim. Zəhmət olmasa yenidən yoxlayın və ya sualınızı yazın.',
    fa: 'نتوانستم پیام صوتی را به متن تبدیل کنم. لطفاً دوباره تلاش کنید یا سؤالتان را بنویسید.',
    es: 'No pude convertir ese mensaje de voz en texto. Inténtalo de nuevo o escribe tu pregunta.',
    it: 'Non sono riuscito a trasformare il messaggio vocale in testo. Riprova o scrivi la domanda.',
    pt: 'Não consegui transformar essa mensagem de voz em texto. Tente de novo ou escreva a sua pergunta.',
    hr: 'Nisam uspio pretvoriti glasovnu poruku u tekst. Pokušajte ponovno ili upišite pitanje.',
    hu: 'Nem sikerült szöveggé alakítani a hangüzenetet. Próbálja újra, vagy írja le a kérdését.',
    bs: 'Nisam uspio pretvoriti glasovnu poruku u tekst. Pokušajte ponovo ili upišite pitanje.',
    zh: '无法将这条语音转成文字。请再试一次，或直接输入您的问题。',
    ja: 'ボイスメッセージを文字にできませんでした。もう一度送るか、質問を入力してください。',
    ko: '음성 메시지를 텍스트로 바꾸지 못했습니다. 다시 시도하거나 질문을 입력해 주세요.',
    hi: 'इस वॉइस संदेश को टेक्स्ट में नहीं बदल सका। कृपया फिर कोशिश करें या सवाल लिखें।',
    bn: 'এই ভয়েস মেসেজটি লেখায় রূপান্তর করা যায়নি। আবার চেষ্টা করুন বা প্রশ্নটি লিখুন।',
    id: 'Pesan suara itu tidak bisa diubah menjadi teks. Coba lagi atau ketik pertanyaan Anda.',
  },
  cancelled: {
    tr: 'İletme işlemi iptal edildi. Başka bir sorunuz varsa yazabilirsiniz.',
    en: 'Forwarding cancelled. Feel free to ask another question.',
    ru: 'Отправка отменена. Можете задать другой вопрос.',
    uk: 'Надсилання скасовано. Можете поставити інше запитання.',
    de: 'Weiterleitung abgebrochen. Stellen Sie gerne eine weitere Frage.',
    fr: 'Transfert annulé. N’hésitez pas à poser une autre question.',
    nl: 'Doorsturen geannuleerd. Stel gerust een andere vraag.',
    ar: 'تم إلغاء الإرسال. يمكنك طرح سؤال آخر.',
    he: 'ההעברה בוטלה. מוזמנים לשאול שאלה נוספת.',
    az: 'Yönləndirmə ləğv edildi. Başqa sualınız varsa yaza bilərsiniz.',
    fa: 'ارسال لغو شد. اگر سوال دیگری دارید بفرمایید.',
    es: 'Envío cancelado. Puedes hacer otra pregunta cuando quieras.',
    it: 'Inoltro annullato. Puoi fare un’altra domanda quando vuoi.',
    pt: 'Encaminhamento cancelado. Fique à vontade para fazer outra pergunta.',
    hr: 'Prosljeđivanje otkazano. Slobodno postavite drugo pitanje.',
    hu: 'Továbbítás törölve. Nyugodtan tegyél fel másik kérdést.',
    bs: 'Prosljeđivanje otkazano. Slobodno postavite drugo pitanje.',
    zh: '已取消转发。如有其他问题，欢迎随时提问。',
    ja: '転送をキャンセルしました。他にご質問があればどうぞ。',
    ko: '전달이 취소되었습니다. 다른 질문이 있으시면 말씀해 주세요.',
    hi: 'भेजना रद्द किया गया। कोई अन्य प्रश्न हो तो पूछें।',
    bn: 'পাঠানো বাতিল হয়েছে। অন্য কোনো প্রশ্ন থাকলে জিজ্ঞাসা করতে পারেন।',
    id: 'Penerusan dibatalkan. Silakan ajukan pertanyaan lain.',
  },
};

function t(key, lang) {
  return (TG_TEXT[key] && (TG_TEXT[key][lang] || TG_TEXT[key].en)) || '';
}

function declinedMsg(lang) {
  return (ASSISTANT_MESSAGES.handoffDeclined && (ASSISTANT_MESSAGES.handoffDeclined[lang] || ASSISTANT_MESSAGES.handoffDeclined.en)) || '';
}

export async function computeTelegramWebhookSecret(pepper) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(pepper)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode('tg-webhook'));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const TELEGRAM_VOICE_MAX_SECONDS = 60;
const TELEGRAM_VOICE_MAX_BYTES = 2 * 1024 * 1024;

async function fetchTelegramVoice(env, fileId) {
  if (!env.TELEGRAM_BOT_TOKEN || !fileId) return null;
  const token = env.TELEGRAM_BOT_TOKEN;
  const metaRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  if (!metaRes.ok) return null;
  const meta = await metaRes.json().catch(() => null);
  const path = meta && meta.result && meta.result.file_path;
  const size = meta && meta.result && Number(meta.result.file_size || 0);
  if (!path || (size && size > TELEGRAM_VOICE_MAX_BYTES)) return null;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
  if (!fileRes.ok) return null;
  const buf = await fileRes.arrayBuffer();
  if (!buf || buf.byteLength === 0 || buf.byteLength > TELEGRAM_VOICE_MAX_BYTES) return null;
  return new Uint8Array(buf);
}

async function sendTelegramMessage(env, chatId, text) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function findLinkedMemberEmail(env, telegramId) {
  if (!env || !env.DB || !telegramId) return null;
  try {
    const row = await env.DB.prepare(
      `SELECT m.email FROM member_identities mi
       JOIN members m ON m.id = mi.member_id
       WHERE mi.provider = 'telegram' AND mi.subject = ?`
    ).bind(String(telegramId)).first();
    return row && row.email ? String(row.email) : null;
  } catch {
    return null;
  }
}

async function getState(env, chatId, now = Date.now()) {
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    'SELECT pending_handoff, lang, context_json, updated_at FROM telegram_handoff_state WHERE chat_id = ?'
  ).bind(String(chatId)).first();
  if (!row) return null;
  if (now - Number(row.updated_at || 0) > 30 * 60 * 1000) {
    await env.DB.prepare('DELETE FROM telegram_handoff_state WHERE chat_id = ?').bind(String(chatId)).run();
    return null;
  }
  let history = [];
  try { history = JSON.parse(row.context_json || '[]'); } catch {}
  return {
    pendingHandoff: Number(row.pending_handoff || 0),
    lang: row.lang || 'en',
    history: Array.isArray(history) ? history : [],
  };
}

async function saveState(env, chatId, pendingHandoff, lang, history, now = Date.now()) {
  if (!env.DB) return;
  const trimmed = (Array.isArray(history) ? history : []).slice(-6);
  const mode = typeof pendingHandoff === 'number' ? pendingHandoff : (pendingHandoff ? 1 : 0);
  await env.DB.prepare(
    `INSERT INTO telegram_handoff_state (chat_id, pending_handoff, lang, context_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(chat_id) DO UPDATE SET pending_handoff = excluded.pending_handoff, lang = excluded.lang,
       context_json = excluded.context_json, updated_at = excluded.updated_at`
  ).bind(String(chatId), mode, lang, JSON.stringify(trimmed), now).run();
}

async function clearState(env, chatId) {
  if (!env.DB) return;
  await env.DB.prepare('DELETE FROM telegram_handoff_state WHERE chat_id = ?').bind(String(chatId)).run();
}

export function parseStartPayloadLang(text) {
  const m = String(text || '').trim().match(/^\/start(?:@\w+)?(?:\s+([^\s]+))?/i);
  if (!m || !m[1]) return '';
  let code = m[1].trim().toLowerCase().split(/[-_]/)[0];
  if (code === 'in') code = 'id';
  return SUPPORTED_LANGS.has(code) ? code : '';
}

export async function handleTelegramWebhook(request, env, now = Date.now()) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }
  if (!env || !env.CODE_PEPPER) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const sig = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  const expected = await computeTelegramWebhookSecret(env.CODE_PEPPER);
  if (!sig || !constantTimeEqual(sig, expected)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const msg = update && update.message;
  if (!msg || !msg.chat || msg.chat.type !== 'private') {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const chatId = String(msg.chat.id);
  const actorKey = `tg:${chatId}`;

  const blockStatus = await getBlockStatus({ env, actorKeys: [actorKey], now });
  if (blockStatus.blocked) {
    return new Response(JSON.stringify({ ok: true, blocked: true }), { status: 200 });
  }

  const telegramId = String((msg.from && msg.from.id) || chatId);
  const tgUser = msg.from && msg.from.username ? `@${msg.from.username}` : '';
  const telegramLang = (msg.from && msg.from.language_code) || '';
  let text = typeof msg.text === 'string' ? msg.text.trim() : '';

  if (!text && msg.voice && typeof msg.voice.file_id === 'string') {
    const voiceLang = detectLanguage({ message: '', telegramLang });
    const duration = Number(msg.voice.duration);
    if (Number.isFinite(duration) && duration > TELEGRAM_VOICE_MAX_SECONDS) {
      await sendTelegramMessage(env, chatId, t('voiceTooLong', voiceLang));
      return new Response(JSON.stringify({ ok: true, voice: 'too_long' }), { status: 200 });
    }
    const audio = await fetchTelegramVoice(env, msg.voice.file_id);
    const transcribed = audio
      ? await transcribeAudio({
        env,
        audioBytes: audio,
        lang: voiceLang,
        actorKey: `tg:${chatId}`,
        maxBytes: TELEGRAM_VOICE_MAX_BYTES,
      })
      : { ok: false };
    text = transcribed && transcribed.ok ? String(transcribed.text || '').trim() : '';
    if (!text) {
      await sendTelegramMessage(env, chatId, t('voiceFailed', voiceLang));
      return new Response(JSON.stringify({ ok: true, voice: 'failed' }), { status: 200 });
    }
  }

  if (!text) {
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
    const payloadLang = parseStartPayloadLang(text);
    const welcomeLang = payloadLang || detectLanguage({ message: '', telegramLang });
    await saveState(env, chatId, 0, welcomeLang, []);
    await sendTelegramMessage(env, chatId, t('welcome', welcomeLang));
    return new Response(JSON.stringify({ ok: true, lang: welcomeLang }), { status: 200 });
  }

  const state = await getState(env, chatId, now);
  const savedLang = state && state.lang ? state.lang : '';
  const lang = detectLanguage({ message: text, pageLang: savedLang, telegramLang });

  if (isAbuseAgainstMimo(text)) {
    await clearState(env, chatId);
    await blockActors({ env, actorKeys: [actorKey], channel: 'telegram', now });
    const closeMsg = (ASSISTANT_MESSAGES.abuseClose && (ASSISTANT_MESSAGES.abuseClose[lang] || ASSISTANT_MESSAGES.abuseClose.en)) || '';
    await sendTelegramMessage(env, chatId, closeMsg);
    return new Response(JSON.stringify({ ok: true, closed: true }), { status: 200 });
  }

  if (/^\/help(?:@\w+)?(?:\s|$)/i.test(text)) {
    const helpLang = savedLang || detectLanguage({ message: '', telegramLang });
    await saveState(env, chatId, 0, helpLang, []);
    await sendTelegramMessage(env, chatId, t('welcome', helpLang));
    return new Response(JSON.stringify({ ok: true, lang: helpLang }), { status: 200 });
  }

  if (/^\/cancel\b|^iptal$/i.test(text) && state && state.pendingHandoff > 0) {
    await clearState(env, chatId);
    await sendTelegramMessage(env, chatId, t('cancelled', state.lang || lang));
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (state && state.pendingHandoff === 1) {
    const emailMatch = text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (!emailMatch) {
      await sendTelegramMessage(env, chatId, t('askEmail', state.lang || lang));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    const guestEmail = emailMatch[0];
    const forwarded = await forwardConversationEmail({
      env,
      email: guestEmail,
      lang: state.lang || lang,
      history: state.history,
      message: text,
      source: 'telegram',
      meta: { telegramUser: tgUser },
    });
    await clearState(env, chatId);
    await sendTelegramMessage(env, chatId, forwarded.ok ? t('forwarded', state.lang || lang) : t('forwardFailed', state.lang || lang));
    return new Response(JSON.stringify({ ok: true, forwarded: forwarded.ok }), { status: 200 });
  }

  if (state && state.pendingHandoff === 2) {
    const activeLang = state.lang || lang;
    if (isAffirmative(text)) {
      const linkedEmail = await findLinkedMemberEmail(env, telegramId);
      if (linkedEmail) {
        const forwarded = await forwardConversationEmail({
          env,
          email: linkedEmail,
          lang: activeLang,
          history: state.history,
          message: text,
          source: 'telegram',
          meta: { telegramUser: tgUser },
        });
        await clearState(env, chatId);
        await sendTelegramMessage(env, chatId, forwarded.ok ? t('forwarded', activeLang) : t('forwardFailed', activeLang));
        return new Response(JSON.stringify({ ok: true, handoff: true, forwarded: forwarded.ok }), { status: 200 });
      }
      await saveState(env, chatId, 1, activeLang, state.history, now);
      await sendTelegramMessage(env, chatId, t('askEmail', activeLang));
      return new Response(JSON.stringify({ ok: true, handoff: true }), { status: 200 });
    }
    if (isNegative(text)) {
      const reply = declinedMsg(activeLang);
      const nextHistory = [
        ...state.history,
        { role: 'user', content: redactSensitive(text).text },
        { role: 'assistant', content: reply },
      ].slice(-6);
      await saveState(env, chatId, 0, activeLang, nextHistory, now);
      await sendTelegramMessage(env, chatId, reply);
      return new Response(JSON.stringify({ ok: true, handoff: false }), { status: 200 });
    }
  }

  const history = state ? state.history : [];
  const res = await runAssistant({
    message: text,
    pageLang: savedLang,
    telegramLang,
    history,
    env,
    actorKey,
    actorKeys: [actorKey],
    channel: 'telegram',
    now,
  });

  if (res.closed) {
    await clearState(env, chatId);
    await sendTelegramMessage(env, chatId, res.reply);
    return new Response(JSON.stringify({ ok: true, closed: true }), { status: 200 });
  }

  const cleanUser = redactSensitive(text).text;
  const nextHistory = [
    ...history,
    { role: 'user', content: cleanUser },
    { role: 'assistant', content: res.reply },
  ].slice(-6);

  if (res.handoffOffer) {
    await saveState(env, chatId, 2, res.lang || lang, nextHistory, now);
    await sendTelegramMessage(env, chatId, res.reply);
    return new Response(JSON.stringify({ ok: true, handoffOffer: true }), { status: 200 });
  }

  if (res.handoff) {
    const linkedEmail = await findLinkedMemberEmail(env, telegramId);
    if (linkedEmail) {
      const forwarded = await forwardConversationEmail({
        env,
        email: linkedEmail,
        lang: res.lang || lang,
        history,
        message: cleanUser,
        source: 'telegram',
        meta: { telegramUser: tgUser },
      });
      await clearState(env, chatId);
      await sendTelegramMessage(env, chatId, forwarded.ok ? t('forwarded', res.lang || lang) : t('forwardFailed', res.lang || lang));
      return new Response(JSON.stringify({ ok: true, handoff: true, forwarded: forwarded.ok }), { status: 200 });
    }
    await saveState(env, chatId, 1, res.lang || lang, nextHistory, now);
    await sendTelegramMessage(env, chatId, `${res.reply}\n\n${t('askEmail', res.lang || lang)}`);
  } else {
    await saveState(env, chatId, 0, res.lang || lang, nextHistory, now);
    await sendTelegramMessage(env, chatId, res.reply);
  }

  return new Response(JSON.stringify({ ok: true, handoff: Boolean(res.handoff) }), { status: 200 });
}
