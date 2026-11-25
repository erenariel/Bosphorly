// Direct delivery of a request to info@bosphorly.com through the mail Worker (backend/mail), without the
// guest opening an email app. Used by the airport transfer, tour/hammam and special tour forms.
// The guest's email becomes Reply-To, so the button stays disabled without a valid address.
// Passenger details travel only in the POST body, never in a URL.
// Public configuration (config/api.js) is populated only after the mail Worker is deployed.
const DIRECT_DELIVERY_TEXT = {
"tr": {
"send": "E-posta hesabı açmadan gönder",
"ok": "Talep e-posta servisine iletildi. Rezervasyon onayı ayrıca gönderilecektir.",
"fail": "Gönderim doğrulanamadı. Yeniden deneyin veya e-posta taslağını kullanın.",
"needEmail": "Doğrudan göndermek için geçerli bir e-posta adresi yazın; yanıtı oraya göndereceğiz.",
"sending": "Gönderiliyor…"
},
"en": {
"send": "Send without opening email",
"ok": "The email service accepted your request. Booking confirmation is separate.",
"fail": "Delivery could not be confirmed. Retry or use the email draft.",
"needEmail": "Enter a valid email address to send directly; we reply to it.",
"sending": "Sending…"
},
"ru": {
"send": "Отправить, не открывая почту",
"ok": "Почтовый сервис принял вашу заявку. Подтверждение брони придёт отдельно.",
"fail": "Не удалось подтвердить отправку. Повторите попытку или используйте черновик письма.",
"needEmail": "Чтобы отправить напрямую, укажите действующий адрес эл. почты — ответ придёт на него.",
"sending": "Отправка…"
},
"uk": {
"send": "Надіслати, не відкриваючи пошту",
"ok": "Поштовий сервіс прийняв ваш запит. Підтвердження бронювання надійде окремо.",
"fail": "Не вдалося підтвердити надсилання. Спробуйте ще раз або скористайтеся чернеткою листа.",
"needEmail": "Щоб надіслати напряму, вкажіть дійсну адресу е-пошти — відповідь надійде на неї.",
"sending": "Надсилання…"
},
"de": {
"send": "Senden, ohne E-Mail zu öffnen",
"ok": "Der E-Mail-Dienst hat Ihre Anfrage angenommen. Die Buchungsbestätigung folgt separat.",
"fail": "Der Versand konnte nicht bestätigt werden. Bitte erneut versuchen oder den E-Mail-Entwurf verwenden.",
"needEmail": "Für den direkten Versand bitte eine gültige E-Mail-Adresse angeben – wir antworten dorthin.",
"sending": "Wird gesendet…"
},
"fr": {
"send": "Envoyer sans ouvrir ma messagerie",
"ok": "Le service e-mail a accepté votre demande. La confirmation de réservation suit séparément.",
"fail": "L’envoi n’a pas pu être confirmé. Réessayez ou utilisez le brouillon d’e-mail.",
"needEmail": "Pour envoyer directement, indiquez une adresse e-mail valide : nous y répondrons.",
"sending": "Envoi…"
},
"nl": {
"send": "Versturen zonder e-mail te openen",
"ok": "De e-maildienst heeft je aanvraag aangenomen. De boekingsbevestiging volgt apart.",
"fail": "Verzending kon niet worden bevestigd. Probeer opnieuw of gebruik het e-mailconcept.",
"needEmail": "Vul een geldig e-mailadres in om direct te versturen; we antwoorden daarop.",
"sending": "Versturen…"
},
"ar": {
"send": "أرسل دون فتح البريد",
"ok": "قبلت خدمة البريد طلبك. يصل تأكيد الحجز بشكل منفصل.",
"fail": "تعذّر تأكيد الإرسال. أعد المحاولة أو استخدم مسودة البريد.",
"needEmail": "للإرسال المباشر أدخل بريدًا إلكترونيًا صالحًا؛ سنرد عليه.",
"sending": "جارٍ الإرسال…"
},
"he": {
"send": "שליחה בלי לפתוח מייל",
"ok": "שירות הדואר קיבל את הבקשה. אישור ההזמנה יישלח בנפרד.",
"fail": "לא ניתן היה לאשר את השליחה. נסו שוב או השתמשו בטיוטת המייל.",
"needEmail": "כדי לשלוח ישירות, הזינו כתובת אימייל תקינה; נשיב אליה.",
"sending": "שולח…"
},
"az": {
"send": "E-poçtu açmadan göndər",
"ok": "E-poçt xidməti sorğunuzu qəbul etdi. Rezervasiya təsdiqi ayrıca göndəriləcək.",
"fail": "Göndərmə təsdiqlənmədi. Yenidən cəhd edin və ya e-poçt qaralamasından istifadə edin.",
"needEmail": "Birbaşa göndərmək üçün düzgün e-poçt ünvanı yazın; cavabı ora göndərəcəyik.",
"sending": "Göndərilir…"
},
"fa": {
"send": "ارسال بدون باز کردن ایمیل",
"ok": "سرویس ایمیل درخواست شما را پذیرفت. تأیید رزرو جداگانه ارسال می‌شود.",
"fail": "ارسال تأیید نشد. دوباره تلاش کنید یا از پیش‌نویس ایمیل استفاده کنید.",
"needEmail": "برای ارسال مستقیم، یک ایمیل معتبر وارد کنید؛ پاسخ را به آن می‌فرستیم.",
"sending": "در حال ارسال…"
},
"es": {
"send": "Enviar sin abrir el correo",
"ok": "El servicio de correo aceptó tu solicitud. La confirmación de la reserva llega aparte.",
"fail": "No se pudo confirmar el envío. Vuelve a intentarlo o usa el borrador de correo.",
"needEmail": "Para enviar directamente, escribe un correo electrónico válido; te responderemos ahí.",
"sending": "Enviando…"
},
"it": {
"send": "Invia senza aprire la posta",
"ok": "Il servizio e-mail ha accettato la tua richiesta. La conferma della prenotazione arriva a parte.",
"fail": "Non è stato possibile confermare l’invio. Riprova o usa la bozza e-mail.",
"needEmail": "Per inviare direttamente inserisci un indirizzo e-mail valido: ti risponderemo lì.",
"sending": "Invio in corso…"
},
"pt": {
"send": "Enviar sem abrir o e-mail",
"ok": "O serviço de e-mail aceitou seu pedido. A confirmação da reserva vem separadamente.",
"fail": "Não foi possível confirmar o envio. Tente de novo ou use o rascunho de e-mail.",
"needEmail": "Para enviar diretamente, informe um e-mail válido; responderemos nele.",
"sending": "Enviando…"
},
"hr": {
"send": "Pošalji bez otvaranja e-pošte",
"ok": "Servis e-pošte prihvatio je vaš upit. Potvrda rezervacije stiže zasebno.",
"fail": "Slanje nije potvrđeno. Pokušajte ponovno ili upotrijebite nacrt e-pošte.",
"needEmail": "Za izravno slanje upišite valjanu e-adresu; na nju ćemo odgovoriti.",
"sending": "Slanje…"
},
"hu": {
"send": "Küldés levelező megnyitása nélkül",
"ok": "Az e-mail-szolgáltatás fogadta az ajánlatkérését. A foglalás visszaigazolása külön érkezik.",
"fail": "A küldést nem sikerült megerősíteni. Próbálja újra, vagy használja az e-mail-piszkozatot.",
"needEmail": "A közvetlen küldéshez adjon meg érvényes e-mail-címet; oda válaszolunk.",
"sending": "Küldés…"
},
"bs": {
"send": "Pošalji bez otvaranja e-maila",
"ok": "Servis za e-mail prihvatio je vaš upit. Potvrda rezervacije stiže posebno.",
"fail": "Slanje nije potvrđeno. Pokušajte ponovo ili koristite nacrt e-maila.",
"needEmail": "Za direktno slanje upišite ispravnu e-mail adresu; na nju ćemo odgovoriti.",
"sending": "Slanje…"
},
"zh": {
"send": "无需打开邮箱直接发送",
"ok": "邮件服务已接收你的申请。预订确认将另行发送。",
"fail": "无法确认已发送。请重试或使用邮件草稿。",
"needEmail": "如需直接发送，请填写有效的电子邮件地址，我们会回复到该地址。",
"sending": "正在发送…"
},
"ja": {
"send": "メールを開かずに送信",
"ok": "メールサービスがリクエストを受け付けました。予約確定のご連絡は別途お送りします。",
"fail": "送信を確認できませんでした。もう一度お試しいただくか、メールの下書きをご利用ください。",
"needEmail": "直接送信するには有効なメールアドレスを入力してください。返信はそのアドレスに届きます。",
"sending": "送信中…"
},
"ko": {
"send": "메일 앱 없이 보내기",
"ok": "메일 서비스가 요청을 접수했습니다. 예약 확정은 별도로 안내됩니다.",
"fail": "전송을 확인하지 못했습니다. 다시 시도하거나 이메일 초안을 사용해 주세요.",
"needEmail": "바로 보내려면 유효한 이메일 주소를 입력해 주세요. 답변은 그 주소로 보내 드립니다.",
"sending": "보내는 중…"
},
"hi": {
"send": "ईमेल खोले बिना भेजें",
"ok": "ईमेल सेवा ने आपका अनुरोध स्वीकार कर लिया है। बुकिंग की पुष्टि अलग से भेजी जाएगी।",
"fail": "भेजना पक्का नहीं हो सका। दोबारा कोशिश करें या ईमेल ड्राफ़्ट इस्तेमाल करें।",
"needEmail": "सीधे भेजने के लिए सही ईमेल पता लिखें; जवाब उसी पर आएगा।",
"sending": "भेजा जा रहा है…"
},
"bn": {
"send": "ইমেল না খুলেই পাঠান",
"ok": "ইমেল সেবা আপনার অনুরোধ গ্রহণ করেছে। বুকিং নিশ্চিতকরণ আলাদাভাবে পাঠানো হবে।",
"fail": "পাঠানো নিশ্চিত করা যায়নি। আবার চেষ্টা করুন বা ইমেলের খসড়া ব্যবহার করুন।",
"needEmail": "সরাসরি পাঠাতে একটি সঠিক ইমেল ঠিকানা লিখুন; আমরা সেখানেই উত্তর দেব।",
"sending": "পাঠানো হচ্ছে…"
},
"id": {
"send": "Kirim tanpa membuka email",
"ok": "Layanan email telah menerima permintaan Anda. Konfirmasi pemesanan dikirim terpisah.",
"fail": "Pengiriman tidak dapat dipastikan. Coba lagi atau gunakan draf email.",
"needEmail": "Untuk mengirim langsung, isi alamat email yang valid; kami akan membalas ke sana.",
"sending": "Mengirim…"
}
};
const DIRECT_MEMBER_TEXT = {"tr": "Üyelik zorunlu değil. Ücretsiz üyelere hoş geldin kuponu, damga ve tüm cihazlarda talep geçmişi →", "en": "No account needed. Free members get a welcome coupon, stamps and their requests on every device →", "ru": "Аккаунт не обязателен. Бесплатные участники получают приветственный купон, штампы и историю заявок на всех устройствах →", "uk": "Акаунт не обов’язковий. Безкоштовні учасники отримують вітальний купон, штампи та історію запитів на всіх пристроях →", "de": "Kein Konto nötig. Kostenlose Mitglieder erhalten einen Willkommensgutschein, Stempel und ihre Anfragen auf jedem Gerät →", "fr": "Aucun compte requis. Les membres gratuits reçoivent un coupon de bienvenue, des tampons et leurs demandes sur tous leurs appareils →", "nl": "Geen account nodig. Gratis leden krijgen een welkomstcoupon, stempels en hun aanvragen op elk apparaat →", "ar": "لا يلزم حساب. يحصل الأعضاء مجانًا على قسيمة ترحيب وطوابع وطلباتهم على كل أجهزتهم ←", "he": "לא צריך חשבון. חברים בחינם מקבלים קופון פתיחה, חותמות ואת הבקשות שלהם בכל מכשיר ←", "az": "Hesab tələb olunmur. Pulsuz üzvlər xoş gəldin kuponu, möhürlər və bütün cihazlarda sorğularını alır →", "fa": "حساب لازم نیست. اعضای رایگان کوپن خوشامد، مهر و درخواست‌هایشان را در همه دستگاه‌ها دارند ←", "es": "No hace falta cuenta. Los miembros gratuitos reciben un cupón de bienvenida, sellos y sus solicitudes en todos sus dispositivos →", "it": "Nessun account necessario. I membri gratuiti ricevono un coupon di benvenuto, timbri e le proprie richieste su ogni dispositivo →", "pt": "Não precisa de conta. Membros gratuitos ganham cupom de boas-vindas, selos e seus pedidos em todos os aparelhos →", "hr": "Račun nije potreban. Besplatni članovi dobivaju kupon dobrodošlice, pečate i svoje upite na svakom uređaju →", "hu": "Fiók nem kell. Az ingyenes tagok üdvözlő kupont, pecséteket és minden eszközön elérhető ajánlatkéréseket kapnak →", "bs": "Račun nije potreban. Besplatni članovi dobijaju kupon dobrodošlice, pečate i svoje upite na svakom uređaju →", "zh": "无需注册。免费会员可获得欢迎优惠券、印章，并在所有设备上查看申请 →", "ja": "アカウントは不要です。無料会員にはウェルカムクーポン、スタンプ、全端末でのリクエスト履歴があります →", "ko": "계정이 없어도 됩니다. 무료 회원은 환영 쿠폰, 스탬프, 모든 기기에서 요청 내역을 받습니다 →", "hi": "खाता ज़रूरी नहीं। मुफ़्त सदस्यों को वेलकम कूपन, स्टैम्प और हर डिवाइस पर अपने अनुरोध मिलते हैं →", "bn": "অ্যাকাউন্ট লাগবে না। ফ্রি সদস্যরা স্বাগত কুপন, স্ট্যাম্প ও সব ডিভাইসে নিজেদের অনুরোধ পান →", "id": "Tidak perlu akun. Anggota gratis mendapat kupon sambutan, stempel, dan permintaan mereka di semua perangkat →"};
const DIRECT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let transferChallenge;
function loadTransferChallenge() {
  if (!transferChallenge) transferChallenge = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => { transferChallenge = null; reject(new Error('Challenge unavailable')); };
    document.head.append(script);
  });
  return transferChallenge;
}
function directDeliveryStyle() {
  if (document.getElementById('direct-delivery-style')) return;
  const css = document.createElement('style');
  css.id = 'direct-delivery-style';
  css.textContent = '.direct-send{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;margin:12px 8px 0 0;padding:11px 18px;border:0;border-radius:12px;background:#0a1753;color:#fff;font:800 15px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;text-decoration:none}' +
    '.direct-send:hover{background:#164da3}.direct-send:focus-visible{outline:3px solid #00bed9;outline-offset:2px}.direct-send:disabled{background:#9aa6bf;cursor:not-allowed}' +
    '.direct-send-join{display:block;margin:10px 0 0;font-size:13px;font-weight:700;color:#164da3;text-decoration:none}.direct-send-join:hover{text-decoration:underline}' +
    '.direct-send-note{margin:8px 0 0;font-size:13px;color:#5b6b85}.direct-send-note[data-state=ok]{color:#0b6b3a;font-weight:700}.direct-send-note[data-state=error]{color:#a3262b;font-weight:700}';
  document.head.append(css);
}
// request: {reference, kind:'transfer'|'tour'|'hammam', service, name, phone, email, date, guests, message, consent:true}
function addDirectDelivery(box, request, lang) {
  const config = window.BOSPHORLY_API;
  if (!config?.transferMailBase || !config.turnstileSiteKey) return null;
  const code = String(lang || document.documentElement.lang || 'en').slice(0, 2);
  const T = DIRECT_DELIVERY_TEXT[code] || DIRECT_DELIVERY_TEXT.en;
  directDeliveryStyle();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'direct-send';
  button.textContent = '✉ ' + T.send;
  const challenge = document.createElement('div');
  const status = document.createElement('p');
  status.className = 'direct-send-note';
  status.setAttribute('role', 'status');
  const hasEmail = typeof request.email === 'string' && DIRECT_EMAIL_RE.test(request.email.trim());
  if (!hasEmail) { button.disabled = true; status.textContent = T.needEmail; }
  box.append(button, challenge, status);
  // Membership is optional: a quiet note on its perks for guests who are not signed in.
  const M = window.BosphorlyMember;
  if (M && M.enabled() && !M.signedIn()) {
    const join = document.createElement('a');
    join.className = 'direct-send-join'; join.href = 'account.html#signup';
    join.textContent = '🎁 ' + (DIRECT_MEMBER_TEXT[code] || DIRECT_MEMBER_TEXT.en);
    box.append(join);
  }
  button.onclick = async () => {
    if (!hasEmail) return;
    button.disabled = true;
    const label = button.textContent; button.textContent = T.sending;
    status.removeAttribute('data-state'); status.textContent = '';
    let widget;
    try {
      const api = await loadTransferChallenge();
      const token = await new Promise((resolve, reject) => {
        widget = api.render(challenge, {sitekey: config.turnstileSiteKey, callback: resolve,
          'error-callback': reject, 'expired-callback': reject});
      });
      const response = await fetch(config.transferMailBase.replace(/\/$/, '') + '/v1/requests', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({...request, email: request.email.trim(), turnstileToken:token})
      });
      if (response.status !== 202 || !(await response.json()).accepted) throw new Error();
      button.textContent = label; button.hidden = true;
      status.dataset.state = 'ok'; status.textContent = '✅ ' + T.ok;
      // Signal accepted requests only; no contact details or booking references.
      // Does not load analytics or grant tracking consent.
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({event: 'bosphorly_booking_request_accepted'});
      } catch { /* Measurement must never affect request delivery. */ }
    } catch {
      button.disabled = false; button.textContent = label;
      status.dataset.state = 'error'; status.textContent = T.fail;
    } finally {
      if (widget !== undefined) window.turnstile.remove(widget);
    }
  };
  return button;
}
// Kept for the home page transfer form: the third argument used to be "is Turkish".
function addTransferDelivery(box, request, tr) {
  return addDirectDelivery(box, request, typeof tr === 'string' ? tr : (tr ? 'tr' : document.documentElement.lang));
}
