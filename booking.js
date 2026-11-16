'use strict';
/* Nothing is stored or sent by this page. On submit it opens WhatsApp with the request pre-filled;
   the guest presses send in WhatsApp.
   Each request carries a price snapshot (tour, time slot, unit price, total, source, check date)
   so that what the guest saw can be shown later. In production the server stores this snapshot. */
(() => {
  const $ = id => document.getElementById(id);
  const query = new URLSearchParams(location.search);
  const lang = window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const tr = lang === 'tr';
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : lang; // Latin digits keep prices and times unambiguous
  document.documentElement.lang = lang;

  const i18n = {
    en: {
      labelService: 'Service', labelBranch: 'Branch', r_branch: 'Branch', headingHammam: 'Book your hammam or massage.', subHammam: 'Choose a package or massage, the date and a start time. Your request goes to Alaturka Hamam via WhatsApp; you pay in cash at the hotel reception.', areaOther: 'Other', phHotel: 'e.g. Sultanahmet Palace', phRoom: 'e.g. 214', phName: 'e.g. Jane Smith', phPhone: '+44 7700 900123', phEmail: 'name@example.com', r_rate: 'Rate', rateBasis: 'forex selling',
      navAccount: 'My account', seeRequests: 'See my requests →', noSlots: 'No start times left today. Please choose another date.', invalidTime: 'Choose a start time.', labelOption: 'Massage type', labelDuration: 'Duration', minutes: 'min', openHours: 'Open daily {open}–{close}. Choose a start time.', r_option: 'Option', r_duration: 'Duration', r_fx: 'Approx. in',
      payNote: 'Payment: cash only, at the hotel reception. Tour companies such as Blue Brothers charge an extra 10% commission on credit card payments, so please pay in cash at reception.', r_pay: 'Payment', r_cash: 'Cash at the hotel reception',
      labelHotel: 'Hotel name', labelRoom: 'Room number (optional)', invalidHotel: 'Please enter your hotel name so the company knows where to pick you up.', r_hotel: 'Hotel', r_room: 'Room', openWa: 'Open WhatsApp', waTitle: 'Bosphorly booking request',
      eyebrow: 'YOUR ISTANBUL · YOUR WAY', heading: 'Request your experience through Bosphorly.',
      subheading: 'Choose a tour, date and hotel area. Your request goes from Bosphorly to the licensed company that runs it; you pay in cash at the hotel reception.',
      stepName: 'Request details', formTitle: 'Your request', formIntro: 'Fill in the details; your request is sent via WhatsApp when you press send.',
      labelOffer: 'Tour', labelDate: 'Date', labelTime: 'Time', labelGuests: 'Guests', labelArea: 'Hotel area',
      labelStatus: 'Price per person', labelAvailability: 'Estimated total',
      priceNote: 'Prices are the company’s own published prices on the date shown. The company confirms the final price and availability when it accepts your request.',
      consent: 'I have checked the tour, time and price above. I agree that my request and contact details are sent via WhatsApp to Bosphorly, and that I pay in cash at the hotel reception.',
      submit: 'Send request via WhatsApp →', whyTitle: 'Compare here. Pay cash at reception.',
      whyText: 'Bosphorly lists licensed Istanbul companies side by side and forwards your request with a Bosphorly reference code. The company confirms and runs the experience; you pay in cash at the hotel reception.',
      item1: 'Company prices, no Bosphorly surcharge', item2: 'The price you saw is written into your WhatsApp request', item3: 'Bosphorly reference code on every request',
      mapTitle: 'Explore before you request', mapLink: 'Open Istanbul city map →',
      invalidDate: 'Choose a future date.', invalidGuests: 'Select 1–16 guests.', invalidOffer: 'Select a tour.', invalidConsent: 'Please confirm you have checked the tour, time and price.',
      resultTitle: 'Your request is ready', resultNotice: 'WhatsApp is opening with your request written out; press send in WhatsApp to deliver it to Bosphorly. If it does not open, use the button below.',
      notAvailable: 'Catalog not available. Please reload.', protoTag: 'PUBLIC PROTOTYPE', protoText: 'Requests go via WhatsApp · No payment is taken on this website',
      labelName: 'Full name', labelPhone: 'Mobile / WhatsApp', labelEmail: 'Email (optional)',
      contactNote: 'When you press send in WhatsApp, your details go to the Bosphorly WhatsApp line to arrange your request. Bosphorly does not store them on a server; a copy stays only on this device, under My account.',
      invalidName: 'Please enter your full name.', invalidPhone: 'Enter a valid phone/WhatsApp number with country code (e.g. +44…) so the company can confirm.', invalidEmail: 'The email address does not look valid.',
      navHome: 'Home', navCompare: 'Compare tours', navMap: 'City map',
      footerText: 'Bosphorly · Prototype · Nothing you type is stored on a server.', backHome: '← Back to homepage',
      fixedSlot: 'Fixed time for this tour', flexible: ['Morning', 'Afternoon', 'Evening', 'Flexible'], askPrice: 'Ask for price', from: 'From',
      totalFrom: 'from', perGroup: 'Price is not per person; the company confirms the total.', yourChoice: 'Your selection',
      r_ref: 'Reference', r_shownAt: 'Shown at', r_source: 'Price source', r_checked: 'checked', r_tour: 'Experience', r_company: 'Company', r_date: 'Date', r_time: 'Time', r_guests: 'Guests', r_area: 'Area', r_name: 'Name', r_phone: 'Phone', r_email: 'Email', r_unit: 'Price per person', r_total: 'Estimated total'
    },
    tr: {
      labelService: 'Hizmet', labelBranch: 'Şube', r_branch: 'Şube', headingHammam: 'Hamam veya masaj rezervasyonu yap.', subHammam: 'Paketi veya masajı, tarihi ve başlangıç saatini seç. Talebin WhatsApp ile Alaturka Hamam’a iletilir; ödemeyi otel resepsiyonuna nakit yaparsın.', areaOther: 'Diğer', phHotel: 'örn. Sultanahmet Palace', phRoom: 'örn. 214', phName: 'örn. Ayşe Yılmaz', phPhone: '+90 5xx xxx xx xx', phEmail: 'ornek@eposta.com', r_rate: 'Kur', rateBasis: 'döviz satış',
      navAccount: 'Hesabım', seeRequests: 'Taleplerimi gör →', noSlots: 'Bugün için uygun saat kalmadı. Lütfen başka bir tarih seç.', invalidTime: 'Bir başlangıç saati seç.', labelOption: 'Masaj türü', labelDuration: 'Süre', minutes: 'dk', openHours: 'Her gün {open}–{close} açık. Başlangıç saatini seç.', r_option: 'Seçenek', r_duration: 'Süre', r_fx: 'Yaklaşık',
      payNote: 'Ödeme: yalnızca nakit, otel resepsiyonuna. Blue Brothers gibi tur firmaları kredi kartı ödemelerinde %10 ek komisyon alır; bu yüzden ödemeyi resepsiyona nakit yapman gerekir.', r_pay: 'Ödeme', r_cash: 'Otel resepsiyonuna nakit',
      labelHotel: 'Otel adı', labelRoom: 'Oda numarası (isteğe bağlı)', invalidHotel: 'Firmanın seni nereden alacağını bilmesi için otel adını yaz.', r_hotel: 'Otel', r_room: 'Oda', openWa: 'WhatsApp’ı aç', waTitle: 'Bosphorly rezervasyon talebi',
      eyebrow: 'İSTANBUL · SENİN PLANIN', heading: 'Deneyimini Bosphorly üzerinden talep et.',
      subheading: 'Turu, tarihi ve otel bölgeni seç. Talebin Bosphorly’den turu düzenleyen lisanslı firmaya iletilir; ödemeyi otel resepsiyonuna nakit yaparsın.',
      stepName: 'Talep detayları', formTitle: 'Talebin', formIntro: 'Bilgileri doldur; talebin, WhatsApp’ta gönder’e bastığında iletilir.',
      labelOffer: 'Tur', labelDate: 'Tarih', labelTime: 'Saat', labelGuests: 'Kişi sayısı', labelArea: 'Otel bölgesi',
      labelStatus: 'Kişi başı fiyat', labelAvailability: 'Tahmini toplam',
      priceNote: 'Fiyatlar, firmanın belirtilen tarihte kendi sitesinde yayımladığı fiyatlardır. Kesin fiyatı ve müsaitliği firma, talebini kabul ederken teyit eder.',
      consent: 'Yukarıdaki tur, saat ve fiyatı kontrol ettim. Talebimin ve iletişim bilgilerimin WhatsApp ile Bosphorly’ye iletilmesini ve ödemeyi otel resepsiyonuna nakit yapacağımı kabul ediyorum.',
      submit: 'Talebi WhatsApp ile gönder →', whyTitle: 'Burada karşılaştır. Resepsiyona nakit öde.',
      whyText: 'Bosphorly lisanslı İstanbul firmalarını yan yana gösterir ve talebini bir Bosphorly referans koduyla iletir. Turu firma onaylar ve düzenler; ödemeyi otel resepsiyonuna nakit yaparsın.',
      item1: 'Firma fiyatı, Bosphorly ek ücreti yok', item2: 'Gördüğün fiyat WhatsApp talebine yazılır', item3: 'Her talepte Bosphorly referans kodu',
      mapTitle: 'Talep etmeden önce keşfet', mapLink: 'İstanbul haritasını aç →',
      invalidDate: 'İleri bir tarih seç.', invalidGuests: '1–16 kişi seç.', invalidOffer: 'Bir tur seç.', invalidConsent: 'Tur, saat ve fiyatı kontrol ettiğini onayla.',
      resultTitle: 'Talebin hazır', resultNotice: 'WhatsApp, talebin yazılı olarak açılıyor; Bosphorly’ye iletmek için WhatsApp’ta “Gönder”e bas. Açılmazsa aşağıdaki butonu kullan.',
      notAvailable: 'Katalog açılamadı. Sayfayı yenile.', protoTag: 'AÇIK PROTOTİP', protoText: 'Talepler WhatsApp ile iletilir · Bu sitede ödeme alınmaz',
      labelName: 'Ad soyad', labelPhone: 'Cep telefonu / WhatsApp', labelEmail: 'E-posta (isteğe bağlı)',
      contactNote: 'WhatsApp’ta gönder’e bastığında bilgilerin, talebini ayarlamak için Bosphorly WhatsApp hattına iletilir. Bosphorly bunları sunucuda saklamaz; bir kopyası yalnızca bu cihazda, Hesabım sayfasında kalır.',
      invalidName: 'Adını ve soyadını yaz.', invalidPhone: 'Firmanın teyit edebilmesi için ülke koduyla geçerli bir telefon/WhatsApp numarası yaz (örn. +90…).', invalidEmail: 'E-posta adresi geçerli görünmüyor.',
      navHome: 'Ana sayfa', navCompare: 'Tur karşılaştır', navMap: 'Şehir haritası',
      footerText: 'Bosphorly · Prototip · Yazdıkların sunucuda saklanmaz.', backHome: '← Ana sayfaya dön',
      fixedSlot: 'Bu turun saati sabittir', flexible: ['Sabah', 'Öğleden sonra', 'Akşam', 'Esnek'], askPrice: 'Fiyat sor', from: 'Başlangıç',
      totalFrom: 'başlangıç', perGroup: 'Fiyat kişi başı değil; toplamı firma teyit eder.', yourChoice: 'Seçimin',
      r_ref: 'Referans', r_shownAt: 'Gösterildiği an', r_source: 'Fiyat kaynağı', r_checked: 'kontrol', r_tour: 'Deneyim', r_company: 'Firma', r_date: 'Tarih', r_time: 'Saat', r_guests: 'Kişi', r_area: 'Bölge', r_name: 'Ad soyad', r_phone: 'Telefon', r_email: 'E-posta', r_unit: 'Kişi başı fiyat', r_total: 'Tahmini toplam'
    },
    ru: {
      labelService: 'Услуга', labelBranch: 'Филиал', r_branch: 'Филиал', headingHammam: 'Забронируйте хаммам или массаж.', subHammam: 'Выберите пакет или массаж, дату и время начала. Заявка уходит в Alaturka Hamam через WhatsApp; оплата наличными на ресепшене отеля.', navAccount: 'Мой аккаунт', seeRequests: 'Мои заявки →', noSlots: 'На сегодня свободного времени не осталось. Выберите другую дату.', invalidTime: 'Выберите время начала.',
      labelOption: 'Вид массажа', labelDuration: 'Длительность', minutes: 'мин', openHours: 'Открыто ежедневно {open}–{close}. Выберите время начала.',
      r_option: 'Вариант', r_duration: 'Длительность', r_fx: 'Примерно в',
      payNote: 'Оплата: только наличными на ресепшене отеля. Туркомпании, например Blue Brothers, берут 10% комиссии за оплату картой, поэтому оплачивайте наличными на ресепшене.',
      r_pay: 'Оплата', r_cash: 'Наличными на ресепшене отеля', labelHotel: 'Название отеля', labelRoom: 'Номер комнаты (необязательно)',
      invalidHotel: 'Укажите название отеля, чтобы компания знала, откуда вас забрать.', r_hotel: 'Отель', r_room: 'Номер', openWa: 'Открыть WhatsApp', waTitle: 'Заявка Bosphorly',
      eyebrow: 'ВАШ СТАМБУЛ · ПО-ВАШЕМУ', heading: 'Оставьте заявку через Bosphorly.',
      subheading: 'Выберите тур, дату и район отеля. Заявка уходит от Bosphorly лицензированной компании, которая проводит тур; оплата наличными на ресепшене отеля.',
      stepName: 'Детали заявки', formTitle: 'Ваша заявка', formIntro: 'Заполните данные; заявка отправится через WhatsApp, когда вы нажмёте «Отправить».',
      labelOffer: 'Тур', labelDate: 'Дата', labelTime: 'Время', labelGuests: 'Гости', labelArea: 'Район отеля', labelStatus: 'Цена с человека', labelAvailability: 'Примерная сумма',
      priceNote: 'Цены — это собственные цены компании на указанную дату. Окончательную цену и наличие мест компания подтверждает при принятии заявки.',
      consent: 'Я проверил(а) тур, время и цену выше. Я согласен(на), что заявка и контакты отправляются в Bosphorly через WhatsApp и что я оплачу наличными на ресепшене отеля.',
      submit: 'Отправить заявку в WhatsApp →', whyTitle: 'Сравните здесь. Оплата наличными на ресепшене.',
      whyText: 'Bosphorly показывает лицензированные компании Стамбула рядом и передаёт вашу заявку с кодом Bosphorly. Компания подтверждает и проводит тур; вы платите наличными на ресепшене отеля.',
      item1: 'Цены компаний, без наценки Bosphorly', item2: 'Увиденная цена записывается в заявку WhatsApp', item3: 'Код Bosphorly в каждой заявке',
      mapTitle: 'Изучите город до заявки', mapLink: 'Открыть карту Стамбула →',
      invalidDate: 'Выберите будущую дату.', invalidGuests: 'Выберите от 1 до 16 гостей.', invalidOffer: 'Выберите тур.', invalidConsent: 'Подтвердите, что проверили тур, время и цену.',
      resultTitle: 'Заявка готова', resultNotice: 'Открывается WhatsApp с готовым текстом заявки; нажмите «Отправить» в WhatsApp, чтобы передать её Bosphorly. Если не открылось, используйте кнопку ниже.',
      notAvailable: 'Каталог недоступен. Обновите страницу.', protoTag: 'ПРОТОТИП', protoText: 'Заявки через WhatsApp · На сайте оплата не принимается',
      labelName: 'Имя и фамилия', labelPhone: 'Мобильный / WhatsApp', labelEmail: 'Эл. почта (необязательно)',
      contactNote: 'Когда вы нажмёте «Отправить» в WhatsApp, данные уйдут на линию Bosphorly для оформления заявки. Bosphorly не хранит их на сервере; копия остаётся только на этом устройстве, в разделе «Мой аккаунт».',
      invalidName: 'Укажите имя и фамилию.', invalidPhone: 'Укажите действующий номер телефона/WhatsApp с кодом страны (например, +7…), чтобы компания могла подтвердить.', invalidEmail: 'Адрес эл. почты выглядит неверно.',
      navHome: 'Главная', navCompare: 'Сравнить туры', navMap: 'Карта города', footerText: 'Bosphorly · Прототип · Введённые данные не хранятся на сервере.', backHome: '← На главную',
      fixedSlot: 'У этого тура фиксированное время', flexible: ['Утро', 'День', 'Вечер', 'Любое'], askPrice: 'Цена по запросу', from: 'от', totalFrom: 'от',
      perGroup: 'Цена не за человека; сумму подтверждает компания.', yourChoice: 'Ваш выбор',
      r_ref: 'Код', r_shownAt: 'Цена показана', r_source: 'Источник цены', r_checked: 'проверено', r_tour: 'Услуга', r_company: 'Компания', r_date: 'Дата', r_time: 'Время',
      r_guests: 'Гости', r_area: 'Район', r_name: 'Имя', r_phone: 'Телефон', r_email: 'Эл. почта', r_unit: 'Цена с человека', r_total: 'Примерная сумма',
      areaOther: 'Другой', phHotel: 'например, Sultanahmet Palace', phRoom: 'например, 214', phName: 'например, Анна Иванова', phPhone: '+7 9xx xxx xx xx', phEmail: 'name@example.com', r_rate: 'Курс', rateBasis: 'продажа валюты'
    },
    ar: {
      labelService: 'الخدمة', labelBranch: 'الفرع', r_branch: 'الفرع', headingHammam: 'احجز الحمام أو التدليك.', subHammam: 'اختر الباقة أو التدليك والتاريخ ووقت البدء. يُرسل طلبك إلى Alaturka Hamam عبر واتساب؛ والدفع نقدًا في استقبال الفندق.', navAccount: 'حسابي', seeRequests: 'عرض طلباتي ←', noSlots: 'لا توجد أوقات متاحة اليوم. اختر تاريخًا آخر.', invalidTime: 'اختر وقت البدء.',
      labelOption: 'نوع التدليك', labelDuration: 'المدة', minutes: 'دقيقة', openHours: 'مفتوح يوميًا {open}–{close}. اختر وقت البدء.',
      r_option: 'الخيار', r_duration: 'المدة', r_fx: 'تقريبًا بـ',
      payNote: 'الدفع: نقدًا فقط في استقبال الفندق. تأخذ شركات الجولات مثل Blue Brothers عمولة 10% على الدفع بالبطاقة، لذا يُرجى الدفع نقدًا في الاستقبال.',
      r_pay: 'الدفع', r_cash: 'نقدًا في استقبال الفندق', labelHotel: 'اسم الفندق', labelRoom: 'رقم الغرفة (اختياري)',
      invalidHotel: 'اكتب اسم فندقك لتعرف الشركة من أين تستلمك.', r_hotel: 'الفندق', r_room: 'الغرفة', openWa: 'افتح واتساب', waTitle: 'طلب حجز Bosphorly',
      eyebrow: 'إسطنبول على طريقتك', heading: 'اطلب تجربتك عبر Bosphorly.',
      subheading: 'اختر الجولة والتاريخ ومنطقة الفندق. يُرسل طلبك من Bosphorly إلى الشركة المرخّصة التي تنظم الجولة؛ والدفع نقدًا في استقبال الفندق.',
      stepName: 'تفاصيل الطلب', formTitle: 'طلبك', formIntro: 'املأ البيانات؛ يُرسل طلبك عبر واتساب عند الضغط على إرسال.',
      labelOffer: 'الجولة', labelDate: 'التاريخ', labelTime: 'الوقت', labelGuests: 'عدد الضيوف', labelArea: 'منطقة الفندق', labelStatus: 'السعر للشخص', labelAvailability: 'المجموع التقريبي',
      priceNote: 'الأسعار هي الأسعار التي تنشرها الشركة في التاريخ المذكور. تؤكد الشركة السعر النهائي والتوفر عند قبول طلبك.',
      consent: 'راجعت الجولة والوقت والسعر أعلاه. أوافق على إرسال طلبي وبيانات التواصل إلى Bosphorly عبر واتساب، وعلى الدفع نقدًا في استقبال الفندق.',
      submit: 'أرسل الطلب عبر واتساب ←', whyTitle: 'قارن هنا. ادفع نقدًا في الاستقبال.',
      whyText: 'تعرض Bosphorly شركات إسطنبول المرخّصة جنبًا إلى جنب وترسل طلبك برمز مرجعي. تؤكد الشركة الجولة وتنظمها؛ وتدفع نقدًا في استقبال الفندق.',
      item1: 'أسعار الشركات دون رسوم إضافية من Bosphorly', item2: 'يُكتب السعر الذي رأيته في طلب واتساب', item3: 'رمز مرجعي من Bosphorly لكل طلب',
      mapTitle: 'استكشف قبل الطلب', mapLink: 'افتح خريطة إسطنبول ←',
      invalidDate: 'اختر تاريخًا قادمًا.', invalidGuests: 'اختر من 1 إلى 16 ضيفًا.', invalidOffer: 'اختر جولة.', invalidConsent: 'أكّد أنك راجعت الجولة والوقت والسعر.',
      resultTitle: 'طلبك جاهز', resultNotice: 'يُفتح واتساب ونص طلبك جاهز؛ اضغط إرسال في واتساب لإيصاله إلى Bosphorly. إن لم يُفتح، استخدم الزر أدناه.',
      notAvailable: 'الكتالوج غير متاح. أعد تحميل الصفحة.', protoTag: 'نموذج أولي', protoText: 'الطلبات عبر واتساب · لا يتم الدفع على هذا الموقع',
      labelName: 'الاسم الكامل', labelPhone: 'الجوال / واتساب', labelEmail: 'البريد الإلكتروني (اختياري)',
      contactNote: 'عند الضغط على إرسال في واتساب تُرسل بياناتك إلى خط Bosphorly لترتيب طلبك. لا تحفظها Bosphorly على أي خادم؛ تبقى نسخة على هذا الجهاز فقط في صفحة حسابي.',
      invalidName: 'اكتب اسمك الكامل.', invalidPhone: 'اكتب رقم هاتف/واتساب صحيحًا مع رمز الدولة (مثل ‎+966…) لتتمكن الشركة من التأكيد.', invalidEmail: 'يبدو أن البريد الإلكتروني غير صحيح.',
      navHome: 'الرئيسية', navCompare: 'قارن الجولات', navMap: 'خريطة المدينة', footerText: 'Bosphorly · نموذج أولي · لا يُحفظ ما تكتبه على أي خادم.', backHome: 'العودة إلى الرئيسية →',
      fixedSlot: 'وقت هذه الجولة ثابت', flexible: ['صباحًا', 'بعد الظهر', 'مساءً', 'مرن'], askPrice: 'السعر عند الطلب', from: 'ابتداءً من', totalFrom: 'ابتداءً من',
      perGroup: 'السعر ليس للشخص؛ تؤكد الشركة المجموع.', yourChoice: 'اختيارك',
      r_ref: 'المرجع', r_shownAt: 'وقت عرض السعر', r_source: 'مصدر السعر', r_checked: 'تحقق في', r_tour: 'الخدمة', r_company: 'الشركة', r_date: 'التاريخ', r_time: 'الوقت',
      r_guests: 'الضيوف', r_area: 'المنطقة', r_name: 'الاسم', r_phone: 'الهاتف', r_email: 'البريد الإلكتروني', r_unit: 'السعر للشخص', r_total: 'المجموع التقريبي',
      areaOther: 'أخرى', phHotel: 'مثال: Sultanahmet Palace', phRoom: 'مثال: 214', phName: 'مثال: محمد أحمد', phPhone: '+966 5x xxx xxxx', phEmail: 'name@example.com', r_rate: 'سعر الصرف', rateBasis: 'سعر البيع'
    },
    de: {
      labelService: 'Leistung', labelBranch: 'Filiale', r_branch: 'Filiale', headingHammam: 'Hamam oder Massage buchen.',
      subHammam: 'Wählen Sie ein Paket oder eine Massage, das Datum und eine Startzeit. Ihre Anfrage geht per WhatsApp an Alaturka Hamam; Sie bezahlen bar an der Hotelrezeption.',
      areaOther: 'Andere', phHotel: 'z. B. Sultanahmet Palace', phRoom: 'z. B. 214', phName: 'z. B. Anna Schmidt', phPhone: '+49 151 23456789', phEmail: 'name@example.com',
      r_rate: 'Kurs', rateBasis: 'Devisenverkauf', navAccount: 'Mein Konto', seeRequests: 'Meine Anfragen ansehen →',
      noSlots: 'Für heute sind keine Startzeiten mehr frei. Bitte wählen Sie ein anderes Datum.', invalidTime: 'Wählen Sie eine Startzeit.',
      labelOption: 'Massageart', labelDuration: 'Dauer', minutes: 'Min.', openHours: 'Täglich {open}–{close} geöffnet. Wählen Sie eine Startzeit.',
      r_option: 'Option', r_duration: 'Dauer', r_fx: 'Ca. in',
      payNote: 'Zahlung: nur bar an der Hotelrezeption. Touranbieter wie Blue Brothers berechnen bei Kreditkartenzahlung 10 % Aufschlag, bitte zahlen Sie daher bar an der Rezeption.',
      r_pay: 'Zahlung', r_cash: 'Bar an der Hotelrezeption', labelHotel: 'Hotelname', labelRoom: 'Zimmernummer (optional)',
      invalidHotel: 'Bitte geben Sie Ihr Hotel an, damit der Anbieter weiß, wo er Sie abholt.', r_hotel: 'Hotel', r_room: 'Zimmer', openWa: 'WhatsApp öffnen', waTitle: 'Bosphorly-Buchungsanfrage',
      eyebrow: 'IHR ISTANBUL · IHR WEG', heading: 'Fragen Sie Ihr Erlebnis über Bosphorly an.',
      subheading: 'Wählen Sie Tour, Datum und Hotelgegend. Ihre Anfrage geht von Bosphorly an den lizenzierten Anbieter der Tour; Sie bezahlen bar an der Hotelrezeption.',
      stepName: 'Anfragedetails', formTitle: 'Ihre Anfrage', formIntro: 'Füllen Sie die Angaben aus; Ihre Anfrage wird per WhatsApp gesendet, wenn Sie auf Senden tippen.',
      labelOffer: 'Tour', labelDate: 'Datum', labelTime: 'Uhrzeit', labelGuests: 'Gäste', labelArea: 'Hotelgegend', labelStatus: 'Preis pro Person', labelAvailability: 'Geschätzte Summe',
      priceNote: 'Die Preise sind die eigenen, am angegebenen Datum veröffentlichten Preise des Anbieters. Endpreis und Verfügbarkeit bestätigt der Anbieter, wenn er Ihre Anfrage annimmt.',
      consent: 'Ich habe Tour, Uhrzeit und Preis oben geprüft. Ich bin einverstanden, dass meine Anfrage und Kontaktdaten per WhatsApp an Bosphorly gehen und dass ich bar an der Hotelrezeption bezahle.',
      submit: 'Anfrage per WhatsApp senden →', whyTitle: 'Hier vergleichen. Bar an der Rezeption zahlen.',
      whyText: 'Bosphorly zeigt lizenzierte Istanbuler Anbieter nebeneinander und leitet Ihre Anfrage mit einem Bosphorly-Referenzcode weiter. Der Anbieter bestätigt und führt das Erlebnis durch; Sie bezahlen bar an der Hotelrezeption.',
      item1: 'Preise der Anbieter, ohne Bosphorly-Aufschlag', item2: 'Der gesehene Preis steht in Ihrer WhatsApp-Anfrage', item3: 'Bosphorly-Referenzcode bei jeder Anfrage',
      mapTitle: 'Vor der Anfrage erkunden', mapLink: 'Istanbul-Karte öffnen →',
      invalidDate: 'Wählen Sie ein zukünftiges Datum.', invalidGuests: 'Wählen Sie 1–16 Gäste.', invalidOffer: 'Wählen Sie eine Tour.', invalidConsent: 'Bitte bestätigen Sie, dass Sie Tour, Uhrzeit und Preis geprüft haben.',
      resultTitle: 'Ihre Anfrage ist bereit', resultNotice: 'WhatsApp öffnet sich mit Ihrer ausgefüllten Anfrage; tippen Sie in WhatsApp auf Senden, um sie an Bosphorly zu schicken. Falls es sich nicht öffnet, nutzen Sie die Schaltfläche unten.',
      notAvailable: 'Katalog nicht verfügbar. Bitte neu laden.', protoTag: 'ÖFFENTLICHER PROTOTYP', protoText: 'Anfragen per WhatsApp · Auf dieser Website wird keine Zahlung angenommen',
      labelName: 'Vollständiger Name', labelPhone: 'Mobil / WhatsApp', labelEmail: 'E-Mail (optional)',
      contactNote: 'Wenn Sie in WhatsApp auf Senden tippen, gehen Ihre Angaben an die Bosphorly-WhatsApp-Linie, um Ihre Anfrage zu bearbeiten. Bosphorly speichert sie auf keinem Server; eine Kopie bleibt nur auf diesem Gerät unter Mein Konto.',
      invalidName: 'Bitte geben Sie Ihren vollständigen Namen ein.', invalidPhone: 'Geben Sie eine gültige Telefon-/WhatsApp-Nummer mit Ländervorwahl ein (z. B. +49…), damit der Anbieter bestätigen kann.', invalidEmail: 'Die E-Mail-Adresse scheint ungültig zu sein.',
      navHome: 'Startseite', navCompare: 'Touren vergleichen', navMap: 'Stadtplan', footerText: 'Bosphorly · Prototyp · Ihre Eingaben werden auf keinem Server gespeichert.', backHome: '← Zur Startseite',
      fixedSlot: 'Feste Uhrzeit für diese Tour', flexible: ['Vormittag', 'Nachmittag', 'Abend', 'Flexibel'], askPrice: 'Preis auf Anfrage', from: 'Ab', totalFrom: 'ab',
      perGroup: 'Der Preis gilt nicht pro Person; die Summe bestätigt der Anbieter.', yourChoice: 'Ihre Auswahl',
      r_ref: 'Referenz', r_shownAt: 'Angezeigt am', r_source: 'Preisquelle', r_checked: 'geprüft', r_tour: 'Erlebnis', r_company: 'Anbieter', r_date: 'Datum', r_time: 'Uhrzeit',
      r_guests: 'Gäste', r_area: 'Gegend', r_name: 'Name', r_phone: 'Telefon', r_email: 'E-Mail', r_unit: 'Preis pro Person', r_total: 'Geschätzte Summe'
    }
  };
  const t = i18n[lang] || i18n.en;
  if (i18n[lang] && window.BosphorlyLang.rtl(lang)) document.documentElement.dir = 'rtl';
  for (const [id, val] of Object.entries(t)) { const e = $(id); if (e && typeof val === 'string') e.textContent = val; }
  const area = $('area');
  [...area.options].at(-1).textContent = t.areaOther;
  $('hotelName').placeholder = t.phHotel; $('room').placeholder = t.phRoom; $('fullName').placeholder = t.phName; $('phone').placeholder = t.phPhone; $('email').placeholder = t.phEmail;
  const saved = window.BosphorlyAccount?.profile();
  if (saved) { $('hotelName').value = saved.hotel || ''; $('room').value = saved.room || ''; $('fullName').value = saved.name || ''; $('phone').value = saved.phone || ''; $('email').value = saved.email || ''; }
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('date').min = local; $('date').value = local;

  let records = [];
  const byId = new Map();
  const plain = (v, c) => new Intl.NumberFormat(loc, { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(v);
  const fmt = (v, c) => window.BosphorlyCurrency ? window.BosphorlyCurrency.format(v, c) : plain(v, c);
  const title = r => r['title_' + lang] || r.title;
  const current = () => byId.get($('offer').value);
  const perPerson = r => (r.basis || '').includes('per_person');
  const isFrom = r => (r.basis || '').startsWith('from');

  // Options (e.g. massage type) and durations each carry their own price.
  let optionsFor = null;
  const optName = o => o['name_' + lang] || o.name;
  const selOption = r => r?.options?.find(o => o.id === $('option').value) || null;
  const durationsOf = r => selOption(r)?.durations || r?.durations || null;
  const selDuration = r => { const list = durationsOf(r); return list ? list.find(x => String(x.min) === $('duration').value) || list[0] : null; };
  const unitPrice = r => selDuration(r)?.price ?? r?.price;
  const exact = r => !r?.options || Boolean(selOption(r)); // a chosen option has an exact price

  function renderOptions(r) {
    if (optionsFor === r.id) return;
    optionsFor = r.id;
    $('optionWrap').hidden = !r.options;
    if (r.options) $('option').replaceChildren(...r.options.map(o => { const el = document.createElement('option'); el.value = o.id; el.textContent = optName(o) + ' — ' + plain(o.durations[0].price, r.currency) + '+'; return el; }));
    renderDurations(r);
  }
  function renderDurations(r) {
    const list = durationsOf(r);
    $('durationWrap').hidden = !list || list.length < 2 && !r.options;
    if (list) $('duration').replaceChildren(...list.map(x => { const el = document.createElement('option'); el.value = String(x.min); el.textContent = x.min + ' ' + t.minutes + ' — ' + plain(x.price, r.currency); return el; }));
    const o = selOption(r);
    $('optionDesc').textContent = o ? (o['desc_' + lang] || o.desc) : '';
  }

  // Venues with opening hours offer start times that finish before closing.
  function hourSlots(r) {
    const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const dur = selDuration(r)?.min || 60, step = r.hours.step_min || 30;
    const out = [];
    const d = new Date(), today = $('date').value === local;
    const earliest = today ? d.getHours() * 60 + d.getMinutes() + 30 : 0; // same-day: at least 30 minutes ahead
    for (let m = toMin(r.hours.open); m + dur <= toMin(r.hours.close); m += step) if (m >= earliest) out.push(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
    return out;
  }

  // A tour with a fixed schedule offers only that slot, so the time can never contradict the price.
  function renderTime(r) {
    const sel = $('time');
    if (r?.hours) {
      const keep = sel.value;
      const slots = hourSlots(r);
      sel.replaceChildren(...slots.map(s => { const o = document.createElement('option'); o.value = s; o.textContent = s; return o; }));
      if (slots.includes(keep)) sel.value = keep;
      $('timeNote').textContent = slots.length ? t.openHours.replace('{open}', r.hours.open).replace('{close}', r.hours.close) : t.noSlots;
      return;
    }
    const slot = r?.details && (r.details[lang]?.schedule || r.details.schedule);
    const fixed = slot && /\d{1,2}:\d{2}/.test(slot) ? slot : null;
    sel.replaceChildren();
    if (fixed) {
      const o = document.createElement('option'); o.value = fixed; o.textContent = fixed; sel.append(o);
      $('timeNote').textContent = t.fixedSlot;
    } else {
      ['morning', 'afternoon', 'evening', 'flexible'].forEach((v, i) => { const o = document.createElement('option'); o.value = v; o.textContent = t.flexible[i]; sel.append(o); });
      $('timeNote').textContent = '';
    }
  }

  function quote(r) {
    const guests = $('guests').valueAsNumber;
    const price = unitPrice(r);
    if (!r || !Number.isFinite(price)) return { unit: t.askPrice, total: t.askPrice, unitMinor: null, totalMinor: null, price: null };
    const from = isFrom(r) && !exact(r);
    const unit = (from ? t.from + ' ' : '') + fmt(price, r.currency);
    if (!perPerson(r) || !Number.isInteger(guests) || guests < 1) return { unit, total: t.perGroup, unitMinor: Math.round(price * 100), totalMinor: null, price };
    const total = price * guests;
    return { unit, total: (from ? t.totalFrom + ' ' : '') + fmt(total, r.currency) + ' (' + guests + ' × ' + plain(price, r.currency) + ')',
      unitMinor: Math.round(price * 100), totalMinor: Math.round(total * 100), price, totalValue: total };
  }

  function render() {
    const r = current();
    if (!r) return;
    renderOptions(r);
    renderTime(r);
    const q = quote(r);
    $('price').textContent = q.unit;
    $('availability').textContent = q.total;
    const box = $('marketPrice');
    box.replaceChildren();
    const head = document.createElement('strong');
    head.textContent = t.yourChoice + ': ' + title(r) + ' · ' + r.operator;
    const L = r.details ? Object.assign({}, r.details, r.details[lang] || {}) : null;
    const info = document.createElement('div');
    const o = selOption(r), dd = selDuration(r);
    info.textContent = [o ? optName(o) : null, dd ? dd.min + ' ' + t.minutes : L?.duration, $('time').selectedOptions[0]?.textContent].filter(Boolean).join(' · ');
    if (window.BosphorlyCurrency?.note()) { const fx = document.createElement('small'); fx.textContent = window.BosphorlyCurrency.note(); box.append(fx); }
    box.append(head, info);
    if (L?.included?.length) {
      const ul = document.createElement('ul'); ul.className = 'mini-includes';
      L.included.slice(0, 4).forEach(i => { const li = document.createElement('li'); li.textContent = '✓ ' + i; ul.append(li); });
      box.append(ul);
    }
    const src = document.createElement('small');
    src.textContent = t.r_source + ': ' + r.operator + ' · ' + t.r_checked + ' ' + (r.details?.checked || '');
    box.append(src);
    $('ack').checked = false; // any change to the selection requires a fresh confirmation
  }

  // Hammam bookings list only Alaturka services and ask for the branch instead of the hotel area.
  let hammamMode = false;
  const isHammam = r => r.operator === 'Alaturka Hamam';
  function applyMode() {
    $('branchWrap').hidden = !hammamMode;
    $('areaWrap').hidden = hammamMode;
    if (!hammamMode) return;
    $('labelOffer').textContent = t.labelService;
    $('heading').textContent = t.headingHammam;
    $('subheading').textContent = t.subHammam;
    $('hotelName').required = false;
  }

  function referenceCode() {
    const a = new Uint8Array(4); crypto.getRandomValues(a);
    return 'BOS-' + [...a].map(b => b.toString(36).padStart(2, '0')).join('').toUpperCase().slice(0, 6);
  }

  async function load() {
    try {
      const resp = await fetch('data/public-market-prices.json', { cache: 'no-store' });
      if (!resp.ok) throw new Error('catalog');
      const data = await resp.json();
      records = (data.records || []).filter(x => x && typeof x.id === 'string');
      records.forEach(r => byId.set(r.id, r));
      const fromQuery = query.get('service');
      hammamMode = byId.has(fromQuery) && isHammam(byId.get(fromQuery));
      const shown = records.filter(r => isHammam(r) === hammamMode);
      applyMode();
      const groups = new Map();
      for (const r of shown) { if (!groups.has(r.operator)) groups.set(r.operator, []); groups.get(r.operator).push(r); }
      $('offer').replaceChildren(...[...groups].map(([op, list]) => {
        const g = document.createElement('optgroup'); g.label = op;
        list.forEach(r => { const o = document.createElement('option'); o.value = r.id; o.textContent = title(r) + ' — ' + (Number.isFinite(r.price) ? (isFrom(r) ? t.from + ' ' : '') + fmt(r.price, r.currency) : t.askPrice); g.append(o); });
        return g;
      }));
      if (byId.has(fromQuery)) $('offer').value = fromQuery;
      render();
    } catch { $('error').hidden = false; $('error').textContent = t.notAvailable; $('submit').disabled = true; }
  }

  $('offer').addEventListener('change', render);
  $('option').addEventListener('change', () => { renderDurations(current()); render(); });
  $('duration').addEventListener('change', render);
  if (window.BosphorlyCurrency) window.BosphorlyCurrency.onChange(render);
  $('guests').addEventListener('input', render);
  $('date').addEventListener('change', render);
  $('time').addEventListener('change', () => { $('ack').checked = false; });

  $('bookingForm').addEventListener('submit', event => {
    event.preventDefault();
    const r = current(); const num = $('guests').valueAsNumber;
    const hotel = $('hotelName').value.trim(), room = $('room').value.trim(), name = $('fullName').value.trim(), phone = $('phone').value.trim(), email = $('email').value.trim();
    const phoneOk = /^\+?[0-9 ()-]{7,20}$/.test(phone) && phone.replace(/\D/g, '').length >= 7;
    const msg = !r ? t.invalidOffer : !$('date').value || $('date').value < local ? t.invalidDate : !Number.isInteger(num) || num < 1 || num > 16 ? t.invalidGuests : !$('time').value ? t.invalidTime :
      !hammamMode && hotel.length < 2 ? t.invalidHotel : name.length < 2 ? t.invalidName : !phoneOk ? t.invalidPhone : email && !$('email').checkValidity() ? t.invalidEmail : !$('ack').checked ? t.invalidConsent : null;
    $('error').hidden = !msg; $('error').textContent = msg || '';
    if (msg) return;
    const q = quote(r);
    const shownAt = new Date();
    // The snapshot is what a server would store unchanged with the request.
    const snapshot = { reference: referenceCode(), recordId: r.id, operator: r.operator, tour: r.title, option: selOption(r)?.name || null, durationMin: selDuration(r)?.min || null, time: $('time').value,
      date: $('date').value, guests: num, currency: r.currency ?? null, unitMinor: q.unitMinor, totalMinor: q.totalMinor,
      basis: r.basis ?? null, priceSource: r.details?.source_url || r.source_url, priceChecked: r.details?.checked || null, shownAt: shownAt.toISOString() };
    const preview = window.BosphorlyBooking.preview({ experienceId: r.id, date: snapshot.date, guests: num });
    const box = $('result'); box.dataset.state = preview.state; box.replaceChildren();
    const h = document.createElement('h3'); h.textContent = t.resultTitle + ' · ' + snapshot.reference;
    const p = document.createElement('p'); p.textContent = t.resultNotice;
    const d = document.createElement('dl'); d.className = 'draft';
    const dateText = new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(snapshot.date + 'T12:00'));
    const rows = [[t.r_ref, snapshot.reference], [t.r_tour, title(r)], ...(selOption(r) ? [[t.r_option, optName(selOption(r))]] : []), ...(selDuration(r) ? [[t.r_duration, selDuration(r).min + ' ' + t.minutes]] : []), [t.r_company, r.operator], [t.r_date, dateText], [t.r_time, $('time').selectedOptions[0].textContent],
      [t.r_guests, String(num)], [t.r_unit, q.unit], [t.r_total, q.total], [t.r_pay, t.r_cash], ...(window.BosphorlyCurrency?.convert(1, r.currency) ? [[t.r_rate, 'TCMB ' + window.BosphorlyCurrency.rates.date + ' ' + t.rateBasis]] : []), ...(hammamMode ? [[t.r_branch, $('branch').selectedOptions[0].textContent]] : []), ...(hotel ? [[t.r_hotel, hotel + (hammamMode ? '' : ' (' + area.selectedOptions[0].textContent + ')')]] : []), ...(room ? [[t.r_room, room]] : []), [t.r_name, name], [t.r_phone, phone],
      ...(email ? [[t.r_email, email]] : []), [t.r_source, r.operator + ' · ' + t.r_checked + ' ' + (snapshot.priceChecked || '')],
      [t.r_shownAt, new Intl.DateTimeFormat(loc, { dateStyle: 'medium', timeStyle: 'short' }).format(shownAt)]];
    rows.forEach(([k, v]) => { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; d.append(dt, dd); });
    const lines = [t.waTitle + ' · ' + snapshot.reference, ...rows.filter(([k]) => k !== t.r_ref).map(([k, v]) => k + ': ' + v)];
    const c = window.BOSPHORLY_CONTACT || {};
    const url = 'https://wa.me/' + c.whatsapp + '?text=' + encodeURIComponent(lines.join('\n'));
    const a = document.createElement('a'); a.className = 'primary wa-button'; a.href = url; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = t.openWa + ' · ' + (c.whatsappDisplay || '');
    const mine = document.createElement('a'); mine.href = 'account.html'; mine.textContent = t.seeRequests; mine.style.cssText = 'display:inline-block;margin:12px 0 0 12px;font-weight:800';
    box.append(h, p, d, a, mine); box.hidden = false; box.focus();
    if (window.BosphorlyAccount) {
      window.BosphorlyAccount.saveProfile({ name, phone, email, hotel, room });
      window.BosphorlyAccount.addRequest({ ref: snapshot.reference, type: 'tour', title: title(r) + (selOption(r) ? ' · ' + optName(selOption(r)) : ''), operator: r.operator,
        date: snapshot.date, time: $('time').selectedOptions[0]?.textContent || '', guests: num, total: q.total, waUrl: url, snapshot });
    }
    window.open(url, '_blank', 'noopener');
  });
  load();
})();
