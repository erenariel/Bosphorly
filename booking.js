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
    },
    it: {
      labelService: "Servizio",
      labelBranch: "Sede",
      r_branch: "Sede",
      headingHammam: "Prenota hammam o massaggio.",
      subHammam: "Scegli un pacchetto o un massaggio, la data e l’orario di inizio. La richiesta arriva ad Alaturka Hamam via WhatsApp; paghi in contanti alla reception dell’hotel.",
      areaOther: "Altro",
      phHotel: "es. Sultanahmet Palace",
      phRoom: "es. 214",
      phName: "es. Giulia Rossi",
      phPhone: "+39 3xx xxx xxxx",
      phEmail: "nome@example.com",
      r_rate: "Cambio",
      rateBasis: "cambio di vendita",
      navAccount: "Il mio account",
      seeRequests: "Vedi le mie richieste →",
      noSlots: "Oggi non ci sono più orari disponibili. Scegli un’altra data.",
      invalidTime: "Scegli un orario di inizio.",
      labelOption: "Tipo di massaggio",
      labelDuration: "Durata",
      minutes: "min",
      openHours: "Aperto tutti i giorni {open}–{close}. Scegli un orario di inizio.",
      r_option: "Opzione",
      r_duration: "Durata",
      r_fx: "Circa in",
      payNote: "Pagamento: solo contanti, alla reception dell’hotel. Aziende come Blue Brothers applicano una commissione extra del 10% sui pagamenti con carta, quindi paga in contanti alla reception.",
      r_pay: "Pagamento",
      r_cash: "Contanti alla reception dell’hotel",
      labelHotel: "Nome dell’hotel",
      labelRoom: "Numero di camera (facoltativo)",
      invalidHotel: "Inserisci il nome dell’hotel, così l’azienda sa dove venirti a prendere.",
      r_hotel: "Hotel",
      r_room: "Camera",
      openWa: "Apri WhatsApp",
      waTitle: "Richiesta di prenotazione Bosphorly",
      eyebrow: "LA TUA ISTANBUL · A MODO TUO",
      heading: "Richiedi la tua esperienza tramite Bosphorly.",
      subheading: "Scegli tour, data e zona dell’hotel. La richiesta passa da Bosphorly all’azienda autorizzata che organizza il tour; paghi in contanti alla reception dell’hotel.",
      stepName: "Dettagli della richiesta",
      formTitle: "La tua richiesta",
      formIntro: "Compila i dati; la richiesta viene inviata via WhatsApp quando premi invio.",
      labelOffer: "Tour",
      labelDate: "Data",
      labelTime: "Orario",
      labelGuests: "Persone",
      labelArea: "Zona dell’hotel",
      labelStatus: "Prezzo a persona",
      labelAvailability: "Totale stimato",
      priceNote: "I prezzi sono quelli pubblicati dall’azienda alla data indicata. L’azienda conferma prezzo finale e disponibilità quando accetta la richiesta.",
      consent: "Ho controllato tour, orario e prezzo qui sopra. Accetto che la mia richiesta e i miei contatti siano inviati a Bosphorly via WhatsApp e che si paghi in contanti alla reception dell’hotel.",
      submit: "Invia la richiesta su WhatsApp →",
      whyTitle: "Confronta qui. Paga in contanti alla reception.",
      whyText: "Bosphorly mette a confronto aziende autorizzate di Istanbul e inoltra la tua richiesta con un codice di riferimento Bosphorly. L’azienda conferma e organizza l’esperienza; paghi in contanti alla reception dell’hotel.",
      item1: "Prezzi delle aziende, senza sovrapprezzo Bosphorly",
      item2: "Il prezzo che hai visto è scritto nella tua richiesta WhatsApp",
      item3: "Codice di riferimento Bosphorly su ogni richiesta",
      mapTitle: "Esplora prima di richiedere",
      mapLink: "Apri la mappa di Istanbul →",
      invalidDate: "Scegli una data futura.",
      invalidGuests: "Scegli da 1 a 16 persone.",
      invalidOffer: "Scegli un tour.",
      invalidConsent: "Conferma di aver controllato tour, orario e prezzo.",
      resultTitle: "La tua richiesta è pronta",
      resultNotice: "Si sta aprendo WhatsApp con la tua richiesta già scritta; premi invio su WhatsApp per inviarla a Bosphorly. Se non si apre, usa il pulsante qui sotto.",
      notAvailable: "Catalogo non disponibile. Ricarica la pagina.",
      protoTag: "PROTOTIPO PUBBLICO",
      protoText: "Richieste via WhatsApp · Nessun pagamento su questo sito",
      labelName: "Nome e cognome",
      labelPhone: "Cellulare / WhatsApp",
      labelEmail: "E-mail (facoltativa)",
      contactNote: "Quando premi invio su WhatsApp, i tuoi dati arrivano alla linea WhatsApp di Bosphorly per organizzare la richiesta. Bosphorly non li salva su un server; una copia resta solo su questo dispositivo, in Il mio account.",
      invalidName: "Inserisci nome e cognome.",
      invalidPhone: "Inserisci un numero di telefono/WhatsApp valido con prefisso internazionale (es. +39…) così l’azienda può confermare.",
      invalidEmail: "L’indirizzo e-mail non sembra valido.",
      navHome: "Home",
      navCompare: "Confronta i tour",
      navMap: "Mappa della città",
      footerText: "Bosphorly · Prototipo · Nulla di ciò che scrivi viene salvato su un server.",
      backHome: "← Torna alla home",
      fixedSlot: "Orario fisso per questo tour",
      flexible: ["Mattina", "Pomeriggio", "Sera", "Flessibile"],
      askPrice: "Prezzo su richiesta",
      from: "Da",
      totalFrom: "da",
      perGroup: "Il prezzo non è a persona; l’azienda conferma il totale.",
      yourChoice: "La tua scelta",
      r_ref: "Riferimento",
      r_shownAt: "Mostrato il",
      r_source: "Fonte del prezzo",
      r_checked: "verificato",
      r_tour: "Esperienza",
      r_company: "Azienda",
      r_date: "Data",
      r_time: "Orario",
      r_guests: "Persone",
      r_area: "Zona",
      r_name: "Nome",
      r_phone: "Telefono",
      r_email: "E-mail",
      r_unit: "Prezzo a persona",
      r_total: "Totale stimato"
    },
    pt: {
      labelService: "Serviço",
      labelBranch: "Unidade",
      r_branch: "Unidade",
      headingHammam: "Reserve seu hamam ou massagem.",
      subHammam: "Escolha um pacote ou massagem, a data e o horário de início. Seu pedido vai para o Alaturka Hamam pelo WhatsApp; você paga em dinheiro na recepção do hotel.",
      areaOther: "Outra",
      phHotel: "ex.: Sultanahmet Palace",
      phRoom: "ex.: 214",
      phName: "ex.: Ana Souza",
      phPhone: "+55 11 9xxxx xxxx",
      phEmail: "nome@example.com",
      r_rate: "Taxa",
      rateBasis: "taxa de venda",
      navAccount: "Minha conta",
      seeRequests: "Ver meus pedidos →",
      noSlots: "Não há mais horários hoje. Escolha outra data.",
      invalidTime: "Escolha um horário de início.",
      labelOption: "Tipo de massagem",
      labelDuration: "Duração",
      minutes: "min",
      openHours: "Aberto todos os dias {open}–{close}. Escolha um horário de início.",
      r_option: "Opção",
      r_duration: "Duração",
      r_fx: "Aprox. em",
      payNote: "Pagamento: só em dinheiro, na recepção do hotel. Empresas como a Blue Brothers cobram 10% a mais em pagamentos com cartão, então pague em dinheiro na recepção.",
      r_pay: "Pagamento",
      r_cash: "Dinheiro na recepção do hotel",
      labelHotel: "Nome do hotel",
      labelRoom: "Número do quarto (opcional)",
      invalidHotel: "Informe o nome do hotel para a empresa saber onde buscar você.",
      r_hotel: "Hotel",
      r_room: "Quarto",
      openWa: "Abrir WhatsApp",
      waTitle: "Pedido de reserva Bosphorly",
      eyebrow: "SUA ISTAMBUL · DO SEU JEITO",
      heading: "Peça sua experiência pela Bosphorly.",
      subheading: "Escolha o passeio, a data e a região do hotel. Seu pedido vai da Bosphorly para a empresa licenciada que opera o passeio; você paga em dinheiro na recepção do hotel.",
      stepName: "Detalhes do pedido",
      formTitle: "Seu pedido",
      formIntro: "Preencha os dados; o pedido é enviado pelo WhatsApp quando você tocar em enviar.",
      labelOffer: "Passeio",
      labelDate: "Data",
      labelTime: "Horário",
      labelGuests: "Pessoas",
      labelArea: "Região do hotel",
      labelStatus: "Preço por pessoa",
      labelAvailability: "Total estimado",
      priceNote: "Os preços são os publicados pela própria empresa na data indicada. A empresa confirma o preço final e a disponibilidade ao aceitar o pedido.",
      consent: "Conferi o passeio, o horário e o preço acima. Concordo que meu pedido e meus contatos sejam enviados à Bosphorly pelo WhatsApp e que o pagamento seja feito em dinheiro na recepção do hotel.",
      submit: "Enviar pedido pelo WhatsApp →",
      whyTitle: "Compare aqui. Pague em dinheiro na recepção.",
      whyText: "A Bosphorly mostra lado a lado empresas licenciadas de Istambul e encaminha seu pedido com um código de referência Bosphorly. A empresa confirma e realiza a experiência; você paga em dinheiro na recepção do hotel.",
      item1: "Preços das empresas, sem acréscimo da Bosphorly",
      item2: "O preço que você viu fica escrito no pedido do WhatsApp",
      item3: "Código de referência Bosphorly em todo pedido",
      mapTitle: "Explore antes de pedir",
      mapLink: "Abrir o mapa de Istambul →",
      invalidDate: "Escolha uma data futura.",
      invalidGuests: "Escolha de 1 a 16 pessoas.",
      invalidOffer: "Escolha um passeio.",
      invalidConsent: "Confirme que conferiu o passeio, o horário e o preço.",
      resultTitle: "Seu pedido está pronto",
      resultNotice: "O WhatsApp está abrindo com seu pedido já escrito; toque em enviar no WhatsApp para mandá-lo à Bosphorly. Se não abrir, use o botão abaixo.",
      notAvailable: "Catálogo indisponível. Recarregue a página.",
      protoTag: "PROTÓTIPO PÚBLICO",
      protoText: "Pedidos pelo WhatsApp · Nenhum pagamento neste site",
      labelName: "Nome completo",
      labelPhone: "Celular / WhatsApp",
      labelEmail: "E-mail (opcional)",
      contactNote: "Quando você toca em enviar no WhatsApp, seus dados vão para a linha de WhatsApp da Bosphorly para organizar o pedido. A Bosphorly não os guarda em servidor; uma cópia fica só neste aparelho, em Minha conta.",
      invalidName: "Informe seu nome completo.",
      invalidPhone: "Informe um telefone/WhatsApp válido com código do país (ex.: +55…) para a empresa poder confirmar.",
      invalidEmail: "O e-mail não parece válido.",
      navHome: "Início",
      navCompare: "Comparar passeios",
      navMap: "Mapa da cidade",
      footerText: "Bosphorly · Protótipo · Nada do que você digita é guardado em servidor.",
      backHome: "← Voltar ao início",
      fixedSlot: "Horário fixo para este passeio",
      flexible: ["Manhã", "Tarde", "Noite", "Flexível"],
      askPrice: "Preço sob consulta",
      from: "A partir de",
      totalFrom: "a partir de",
      perGroup: "O preço não é por pessoa; a empresa confirma o total.",
      yourChoice: "Sua escolha",
      r_ref: "Referência",
      r_shownAt: "Exibido em",
      r_source: "Fonte do preço",
      r_checked: "verificado",
      r_tour: "Experiência",
      r_company: "Empresa",
      r_date: "Data",
      r_time: "Horário",
      r_guests: "Pessoas",
      r_area: "Região",
      r_name: "Nome",
      r_phone: "Telefone",
      r_email: "E-mail",
      r_unit: "Preço por pessoa",
      r_total: "Total estimado"
    },
    fr: {
      labelService: "Prestation",
      labelBranch: "Établissement",
      r_branch: "Établissement",
      headingHammam: "Réservez votre hammam ou massage.",
      subHammam: "Choisissez un forfait ou un massage, la date et l’heure de début. Votre demande part chez Alaturka Hamam via WhatsApp ; vous payez en espèces à la réception de l’hôtel.",
      areaOther: "Autre",
      phHotel: "ex. Sultanahmet Palace",
      phRoom: "ex. 214",
      phName: "ex. Marie Dubois",
      phPhone: "+33 6 xx xx xx xx",
      phEmail: "nom@example.com",
      r_rate: "Taux",
      rateBasis: "taux de vente",
      navAccount: "Mon compte",
      seeRequests: "Voir mes demandes →",
      noSlots: "Plus d’horaires disponibles aujourd’hui. Choisissez une autre date.",
      invalidTime: "Choisissez une heure de début.",
      labelOption: "Type de massage",
      labelDuration: "Durée",
      minutes: "min",
      openHours: "Ouvert tous les jours {open}–{close}. Choisissez une heure de début.",
      r_option: "Option",
      r_duration: "Durée",
      r_fx: "Env. en",
      payNote: "Paiement : en espèces uniquement, à la réception de l’hôtel. Les entreprises comme Blue Brothers facturent 10 % de commission en plus pour la carte bancaire ; payez donc en espèces à la réception.",
      r_pay: "Paiement",
      r_cash: "Espèces à la réception de l’hôtel",
      labelHotel: "Nom de l’hôtel",
      labelRoom: "Numéro de chambre (facultatif)",
      invalidHotel: "Indiquez le nom de votre hôtel pour que l’entreprise sache où venir vous chercher.",
      r_hotel: "Hôtel",
      r_room: "Chambre",
      openWa: "Ouvrir WhatsApp",
      waTitle: "Demande de réservation Bosphorly",
      eyebrow: "VOTRE ISTANBUL · À VOTRE FAÇON",
      heading: "Demandez votre expérience via Bosphorly.",
      subheading: "Choisissez une visite, une date et le quartier de l’hôtel. Votre demande passe de Bosphorly à l’entreprise agréée qui organise la visite ; vous payez en espèces à la réception de l’hôtel.",
      stepName: "Détails de la demande",
      formTitle: "Votre demande",
      formIntro: "Remplissez les informations ; votre demande est envoyée via WhatsApp quand vous appuyez sur envoyer.",
      labelOffer: "Visite",
      labelDate: "Date",
      labelTime: "Heure",
      labelGuests: "Personnes",
      labelArea: "Quartier de l’hôtel",
      labelStatus: "Prix par personne",
      labelAvailability: "Total estimé",
      priceNote: "Les prix sont ceux publiés par l’entreprise à la date indiquée. L’entreprise confirme le prix final et la disponibilité en acceptant votre demande.",
      consent: "J’ai vérifié la visite, l’heure et le prix ci-dessus. J’accepte que ma demande et mes coordonnées soient envoyées à Bosphorly via WhatsApp et de payer en espèces à la réception de l’hôtel.",
      submit: "Envoyer la demande via WhatsApp →",
      whyTitle: "Comparez ici. Payez en espèces à la réception.",
      whyText: "Bosphorly présente côte à côte des entreprises agréées d’Istanbul et transmet votre demande avec un code de référence Bosphorly. L’entreprise confirme et réalise l’expérience ; vous payez en espèces à la réception de l’hôtel.",
      item1: "Prix des entreprises, sans supplément Bosphorly",
      item2: "Le prix affiché est inscrit dans votre demande WhatsApp",
      item3: "Code de référence Bosphorly sur chaque demande",
      mapTitle: "Explorez avant de demander",
      mapLink: "Ouvrir le plan d’Istanbul →",
      invalidDate: "Choisissez une date future.",
      invalidGuests: "Choisissez de 1 à 16 personnes.",
      invalidOffer: "Choisissez une visite.",
      invalidConsent: "Confirmez avoir vérifié la visite, l’heure et le prix.",
      resultTitle: "Votre demande est prête",
      resultNotice: "WhatsApp s’ouvre avec votre demande déjà rédigée ; appuyez sur envoyer dans WhatsApp pour la transmettre à Bosphorly. S’il ne s’ouvre pas, utilisez le bouton ci-dessous.",
      notAvailable: "Catalogue indisponible. Rechargez la page.",
      protoTag: "PROTOTYPE PUBLIC",
      protoText: "Demandes via WhatsApp · Aucun paiement sur ce site",
      labelName: "Nom complet",
      labelPhone: "Mobile / WhatsApp",
      labelEmail: "E-mail (facultatif)",
      contactNote: "Quand vous appuyez sur envoyer dans WhatsApp, vos informations arrivent sur la ligne WhatsApp de Bosphorly pour organiser la demande. Bosphorly ne les enregistre pas sur un serveur ; une copie reste uniquement sur cet appareil, dans Mon compte.",
      invalidName: "Indiquez votre nom complet.",
      invalidPhone: "Indiquez un numéro de téléphone/WhatsApp valide avec l’indicatif (ex. +33…) pour que l’entreprise puisse confirmer.",
      invalidEmail: "L’adresse e-mail ne semble pas valide.",
      navHome: "Accueil",
      navCompare: "Comparer les visites",
      navMap: "Plan de la ville",
      footerText: "Bosphorly · Prototype · Rien de ce que vous saisissez n’est enregistré sur un serveur.",
      backHome: "← Retour à l’accueil",
      fixedSlot: "Horaire fixe pour cette visite",
      flexible: ["Matin", "Après-midi", "Soir", "Flexible"],
      askPrice: "Prix sur demande",
      from: "Dès",
      totalFrom: "dès",
      perGroup: "Le prix n’est pas par personne ; l’entreprise confirme le total.",
      yourChoice: "Votre sélection",
      r_ref: "Référence",
      r_shownAt: "Affiché le",
      r_source: "Source du prix",
      r_checked: "vérifié",
      r_tour: "Expérience",
      r_company: "Entreprise",
      r_date: "Date",
      r_time: "Heure",
      r_guests: "Personnes",
      r_area: "Quartier",
      r_name: "Nom",
      r_phone: "Téléphone",
      r_email: "E-mail",
      r_unit: "Prix par personne",
      r_total: "Total estimé"
    },
    es: {
      labelService: "Servicio",
      labelBranch: "Sede",
      r_branch: "Sede",
      headingHammam: "Reserva tu hammam o masaje.",
      subHammam: "Elige un paquete o masaje, la fecha y la hora de inicio. Tu solicitud llega a Alaturka Hamam por WhatsApp; pagas en efectivo en la recepción del hotel.",
      areaOther: "Otra",
      phHotel: "p. ej. Sultanahmet Palace",
      phRoom: "p. ej. 214",
      phName: "p. ej. Lucía García",
      phPhone: "+34 6xx xxx xxx",
      phEmail: "nombre@example.com",
      r_rate: "Tipo",
      rateBasis: "tipo de venta",
      navAccount: "Mi cuenta",
      seeRequests: "Ver mis solicitudes →",
      noSlots: "Hoy ya no quedan horarios. Elige otra fecha.",
      invalidTime: "Elige una hora de inicio.",
      labelOption: "Tipo de masaje",
      labelDuration: "Duración",
      minutes: "min",
      openHours: "Abierto a diario {open}–{close}. Elige una hora de inicio.",
      r_option: "Opción",
      r_duration: "Duración",
      r_fx: "Aprox. en",
      payNote: "Pago: solo en efectivo, en la recepción del hotel. Empresas como Blue Brothers cobran un 10 % adicional por pagar con tarjeta, así que paga en efectivo en recepción.",
      r_pay: "Pago",
      r_cash: "En efectivo en la recepción del hotel",
      labelHotel: "Nombre del hotel",
      labelRoom: "Número de habitación (opcional)",
      invalidHotel: "Indica el nombre de tu hotel para que la empresa sepa dónde recogerte.",
      r_hotel: "Hotel",
      r_room: "Habitación",
      openWa: "Abrir WhatsApp",
      waTitle: "Solicitud de reserva Bosphorly",
      eyebrow: "TU ESTAMBUL · A TU MANERA",
      heading: "Solicita tu experiencia a través de Bosphorly.",
      subheading: "Elige tour, fecha y zona del hotel. Tu solicitud pasa de Bosphorly a la empresa autorizada que organiza el tour; pagas en efectivo en la recepción del hotel.",
      stepName: "Detalles de la solicitud",
      formTitle: "Tu solicitud",
      formIntro: "Rellena los datos; tu solicitud se envía por WhatsApp cuando pulsas enviar.",
      labelOffer: "Tour",
      labelDate: "Fecha",
      labelTime: "Hora",
      labelGuests: "Personas",
      labelArea: "Zona del hotel",
      labelStatus: "Precio por persona",
      labelAvailability: "Total estimado",
      priceNote: "Los precios son los publicados por la propia empresa en la fecha indicada. La empresa confirma el precio final y la disponibilidad al aceptar tu solicitud.",
      consent: "He comprobado el tour, la hora y el precio de arriba. Acepto que mi solicitud y mis datos de contacto se envíen a Bosphorly por WhatsApp y pagar en efectivo en la recepción del hotel.",
      submit: "Enviar solicitud por WhatsApp →",
      whyTitle: "Compara aquí. Paga en efectivo en recepción.",
      whyText: "Bosphorly muestra empresas autorizadas de Estambul una al lado de otra y reenvía tu solicitud con un código de referencia Bosphorly. La empresa confirma y realiza la experiencia; pagas en efectivo en la recepción del hotel.",
      item1: "Precios de las empresas, sin recargo de Bosphorly",
      item2: "El precio que viste queda escrito en tu solicitud de WhatsApp",
      item3: "Código de referencia Bosphorly en cada solicitud",
      mapTitle: "Explora antes de solicitar",
      mapLink: "Abrir el mapa de Estambul →",
      invalidDate: "Elige una fecha futura.",
      invalidGuests: "Elige de 1 a 16 personas.",
      invalidOffer: "Elige un tour.",
      invalidConsent: "Confirma que has comprobado el tour, la hora y el precio.",
      resultTitle: "Tu solicitud está lista",
      resultNotice: "Se está abriendo WhatsApp con tu solicitud ya escrita; pulsa enviar en WhatsApp para mandarla a Bosphorly. Si no se abre, usa el botón de abajo.",
      notAvailable: "Catálogo no disponible. Recarga la página.",
      protoTag: "PROTOTIPO PÚBLICO",
      protoText: "Solicitudes por WhatsApp · No se cobra nada en esta web",
      labelName: "Nombre completo",
      labelPhone: "Móvil / WhatsApp",
      labelEmail: "Correo electrónico (opcional)",
      contactNote: "Cuando pulsas enviar en WhatsApp, tus datos llegan a la línea de WhatsApp de Bosphorly para gestionar la solicitud. Bosphorly no los guarda en un servidor; solo queda una copia en este dispositivo, en Mi cuenta.",
      invalidName: "Indica tu nombre completo.",
      invalidPhone: "Indica un teléfono/WhatsApp válido con prefijo (p. ej. +34…) para que la empresa pueda confirmar.",
      invalidEmail: "El correo electrónico no parece válido.",
      navHome: "Inicio",
      navCompare: "Comparar tours",
      navMap: "Mapa de la ciudad",
      footerText: "Bosphorly · Prototipo · Nada de lo que escribes se guarda en un servidor.",
      backHome: "← Volver al inicio",
      fixedSlot: "Horario fijo para este tour",
      flexible: ["Mañana", "Tarde", "Noche", "Flexible"],
      askPrice: "Precio a consultar",
      from: "Desde",
      totalFrom: "desde",
      perGroup: "El precio no es por persona; la empresa confirma el total.",
      yourChoice: "Tu selección",
      r_ref: "Referencia",
      r_shownAt: "Mostrado el",
      r_source: "Fuente del precio",
      r_checked: "comprobado",
      r_tour: "Experiencia",
      r_company: "Empresa",
      r_date: "Fecha",
      r_time: "Hora",
      r_guests: "Personas",
      r_area: "Zona",
      r_name: "Nombre",
      r_phone: "Teléfono",
      r_email: "Correo",
      r_unit: "Precio por persona",
      r_total: "Total estimado"
    },
    uk: {
      labelService: "Послуга",
      labelBranch: "Філія",
      r_branch: "Філія",
      headingHammam: "Забронюйте хамам або масаж.",
      subHammam: "Оберіть пакет або масаж, дату й час початку. Заявка надходить до Alaturka Hamam через WhatsApp; оплата готівкою на рецепції готелю.",
      areaOther: "Інший",
      phHotel: "напр. Sultanahmet Palace",
      phRoom: "напр. 214",
      phName: "напр. Олена Коваленко",
      phPhone: "+380 xx xxx xx xx",
      phEmail: "name@example.com",
      r_rate: "Курс",
      rateBasis: "курс продажу",
      navAccount: "Мій акаунт",
      seeRequests: "Мої заявки →",
      noSlots: "На сьогодні вільного часу немає. Оберіть іншу дату.",
      invalidTime: "Оберіть час початку.",
      labelOption: "Вид масажу",
      labelDuration: "Тривалість",
      minutes: "хв",
      openHours: "Щодня {open}–{close}. Оберіть час початку.",
      r_option: "Варіант",
      r_duration: "Тривалість",
      r_fx: "Приблизно в",
      payNote: "Оплата: лише готівкою на рецепції готелю. Такі компанії, як Blue Brothers, беруть додаткові 10% за оплату карткою, тож платіть готівкою на рецепції.",
      r_pay: "Оплата",
      r_cash: "Готівкою на рецепції готелю",
      labelHotel: "Назва готелю",
      labelRoom: "Номер кімнати (необов’язково)",
      invalidHotel: "Введіть назву готелю, щоб компанія знала, звідки вас забрати.",
      r_hotel: "Готель",
      r_room: "Номер",
      openWa: "Відкрити WhatsApp",
      waTitle: "Заявка на бронювання Bosphorly",
      eyebrow: "ВАШ СТАМБУЛ · ПО-ВАШОМУ",
      heading: "Залиште заявку на враження через Bosphorly.",
      subheading: "Оберіть тур, дату й район готелю. Bosphorly передає заявку ліцензованій компанії, що проводить тур; оплата готівкою на рецепції готелю.",
      stepName: "Деталі заявки",
      formTitle: "Ваша заявка",
      formIntro: "Заповніть дані; заявка надсилається через WhatsApp, коли ви натиснете «надіслати».",
      labelOffer: "Тур",
      labelDate: "Дата",
      labelTime: "Час",
      labelGuests: "Гості",
      labelArea: "Район готелю",
      labelStatus: "Ціна за особу",
      labelAvailability: "Орієнтовна сума",
      priceNote: "Ціни опубліковані самою компанією на вказану дату. Остаточну ціну й наявність компанія підтверджує, приймаючи заявку.",
      consent: "Я перевірив(-ла) тур, час і ціну вище. Погоджуюся, що заявку та контакти буде надіслано Bosphorly через WhatsApp і що оплата — готівкою на рецепції готелю.",
      submit: "Надіслати заявку у WhatsApp →",
      whyTitle: "Порівнюйте тут. Платіть готівкою на рецепції.",
      whyText: "Bosphorly показує ліцензовані компанії Стамбула поруч і передає заявку з кодом Bosphorly. Компанія підтверджує та проводить тур; ви платите готівкою на рецепції готелю.",
      item1: "Ціни компаній без націнки Bosphorly",
      item2: "Побачена ціна вказується у вашій заявці у WhatsApp",
      item3: "Код Bosphorly у кожній заявці",
      mapTitle: "Перегляньте перед заявкою",
      mapLink: "Відкрити мапу Стамбула →",
      invalidDate: "Оберіть майбутню дату.",
      invalidGuests: "Оберіть від 1 до 16 гостей.",
      invalidOffer: "Оберіть тур.",
      invalidConsent: "Підтвердьте, що перевірили тур, час і ціну.",
      resultTitle: "Ваша заявка готова",
      resultNotice: "Відкривається WhatsApp із готовим текстом заявки; натисніть «надіслати» у WhatsApp, щоб передати її Bosphorly. Якщо він не відкрився, скористайтеся кнопкою нижче.",
      notAvailable: "Каталог недоступний. Оновіть сторінку.",
      protoTag: "ПУБЛІЧНИЙ ПРОТОТИП",
      protoText: "Заявки через WhatsApp · На цьому сайті оплата не приймається",
      labelName: "Ім’я та прізвище",
      labelPhone: "Мобільний / WhatsApp",
      labelEmail: "Ел. пошта (необов’язково)",
      contactNote: "Коли ви натискаєте «надіслати» у WhatsApp, ваші дані надходять на лінію WhatsApp Bosphorly для обробки заявки. Bosphorly не зберігає їх на сервері; копія лишається лише на цьому пристрої, у розділі «Мій акаунт».",
      invalidName: "Введіть ім’я та прізвище.",
      invalidPhone: "Введіть коректний номер телефону/WhatsApp з кодом країни (напр. +380…), щоб компанія могла підтвердити.",
      invalidEmail: "Адреса електронної пошти виглядає некоректною.",
      navHome: "Головна",
      navCompare: "Порівняти тури",
      navMap: "Мапа міста",
      footerText: "Bosphorly · Прототип · Введені дані не зберігаються на сервері.",
      backHome: "← На головну",
      fixedSlot: "Фіксований час для цього туру",
      flexible: ["Ранок", "День", "Вечір", "Гнучко"],
      askPrice: "Ціна за запитом",
      from: "Від",
      totalFrom: "від",
      perGroup: "Ціна не за особу; загальну суму підтверджує компанія.",
      yourChoice: "Ваш вибір",
      r_ref: "Код",
      r_shownAt: "Показано",
      r_source: "Джерело ціни",
      r_checked: "перевірено",
      r_tour: "Враження",
      r_company: "Компанія",
      r_date: "Дата",
      r_time: "Час",
      r_guests: "Гості",
      r_area: "Район",
      r_name: "Ім’я",
      r_phone: "Телефон",
      r_email: "Ел. пошта",
      r_unit: "Ціна за особу",
      r_total: "Орієнтовна сума"
    },
    nl: {
      labelService: "Dienst",
      labelBranch: "Vestiging",
      r_branch: "Vestiging",
      headingHammam: "Boek je hamam of massage.",
      subHammam: "Kies een pakket of massage, de datum en een begintijd. Je aanvraag gaat via WhatsApp naar Alaturka Hamam; je betaalt contant bij de hotelreceptie.",
      areaOther: "Anders",
      phHotel: "bijv. Sultanahmet Palace",
      phRoom: "bijv. 214",
      phName: "bijv. Sanne de Vries",
      phPhone: "+31 6 xxxx xxxx",
      phEmail: "naam@example.com",
      r_rate: "Koers",
      rateBasis: "verkoopkoers",
      navAccount: "Mijn account",
      seeRequests: "Mijn aanvragen →",
      noSlots: "Vandaag zijn er geen begintijden meer. Kies een andere datum.",
      invalidTime: "Kies een begintijd.",
      labelOption: "Soort massage",
      labelDuration: "Duur",
      minutes: "min",
      openHours: "Dagelijks open {open}–{close}. Kies een begintijd.",
      r_option: "Optie",
      r_duration: "Duur",
      r_fx: "Ca. in",
      payNote: "Betaling: alleen contant, bij de hotelreceptie. Bedrijven zoals Blue Brothers rekenen 10% extra bij betaling met een creditcard, dus betaal contant bij de receptie.",
      r_pay: "Betaling",
      r_cash: "Contant bij de hotelreceptie",
      labelHotel: "Naam van het hotel",
      labelRoom: "Kamernummer (optioneel)",
      invalidHotel: "Vul de naam van je hotel in zodat het bedrijf weet waar het je moet ophalen.",
      r_hotel: "Hotel",
      r_room: "Kamer",
      openWa: "Open WhatsApp",
      waTitle: "Bosphorly-boekingsaanvraag",
      eyebrow: "JOUW ISTANBUL · OP JOUW MANIER",
      heading: "Vraag je ervaring aan via Bosphorly.",
      subheading: "Kies een tour, datum en hotelwijk. Bosphorly stuurt je aanvraag door naar het erkende bedrijf dat de tour uitvoert; je betaalt contant bij de hotelreceptie.",
      stepName: "Aanvraaggegevens",
      formTitle: "Je aanvraag",
      formIntro: "Vul de gegevens in; je aanvraag gaat via WhatsApp zodra je op verzenden drukt.",
      labelOffer: "Tour",
      labelDate: "Datum",
      labelTime: "Tijd",
      labelGuests: "Personen",
      labelArea: "Hotelwijk",
      labelStatus: "Prijs per persoon",
      labelAvailability: "Geschat totaal",
      priceNote: "De prijzen zijn de eigen gepubliceerde prijzen van het bedrijf op de getoonde datum. Het bedrijf bevestigt de definitieve prijs en beschikbaarheid wanneer het je aanvraag accepteert.",
      consent: "Ik heb de tour, tijd en prijs hierboven gecontroleerd. Ik ga ermee akkoord dat mijn aanvraag en contactgegevens via WhatsApp naar Bosphorly gaan en dat ik contant betaal bij de hotelreceptie.",
      submit: "Aanvraag via WhatsApp versturen →",
      whyTitle: "Vergelijk hier. Betaal contant bij de receptie.",
      whyText: "Bosphorly zet erkende bedrijven in Istanbul naast elkaar en stuurt je aanvraag door met een Bosphorly-referentiecode. Het bedrijf bevestigt en voert de ervaring uit; je betaalt contant bij de hotelreceptie.",
      item1: "Prijzen van de bedrijven, zonder toeslag van Bosphorly",
      item2: "De prijs die je zag staat in je WhatsApp-aanvraag",
      item3: "Bosphorly-referentiecode bij elke aanvraag",
      mapTitle: "Verken eerst, vraag dan aan",
      mapLink: "Open de kaart van Istanbul →",
      invalidDate: "Kies een datum in de toekomst.",
      invalidGuests: "Kies 1–16 personen.",
      invalidOffer: "Kies een tour.",
      invalidConsent: "Bevestig dat je de tour, tijd en prijs hebt gecontroleerd.",
      resultTitle: "Je aanvraag is klaar",
      resultNotice: "WhatsApp opent met je aanvraag al uitgeschreven; druk in WhatsApp op verzenden om hem naar Bosphorly te sturen. Opent het niet, gebruik dan de knop hieronder.",
      notAvailable: "Catalogus niet beschikbaar. Laad de pagina opnieuw.",
      protoTag: "OPENBAAR PROTOTYPE",
      protoText: "Aanvragen via WhatsApp · Op deze website wordt niets betaald",
      labelName: "Volledige naam",
      labelPhone: "Mobiel / WhatsApp",
      labelEmail: "E-mail (optioneel)",
      contactNote: "Als je in WhatsApp op verzenden drukt, gaan je gegevens naar de WhatsApp-lijn van Bosphorly om je aanvraag te regelen. Bosphorly slaat ze niet op een server op; er blijft alleen een kopie op dit apparaat, onder Mijn account.",
      invalidName: "Vul je volledige naam in.",
      invalidPhone: "Vul een geldig telefoon-/WhatsAppnummer met landcode in (bijv. +31…) zodat het bedrijf kan bevestigen.",
      invalidEmail: "Het e-mailadres lijkt niet geldig.",
      navHome: "Home",
      navCompare: "Tours vergelijken",
      navMap: "Stadskaart",
      footerText: "Bosphorly · Prototype · Niets wat je typt wordt op een server opgeslagen.",
      backHome: "← Terug naar de homepage",
      fixedSlot: "Vaste tijd voor deze tour",
      flexible: ["Ochtend", "Middag", "Avond", "Flexibel"],
      askPrice: "Prijs op aanvraag",
      from: "Vanaf",
      totalFrom: "vanaf",
      perGroup: "De prijs is niet per persoon; het bedrijf bevestigt het totaal.",
      yourChoice: "Jouw keuze",
      r_ref: "Referentie",
      r_shownAt: "Getoond op",
      r_source: "Prijsbron",
      r_checked: "gecontroleerd",
      r_tour: "Ervaring",
      r_company: "Bedrijf",
      r_date: "Datum",
      r_time: "Tijd",
      r_guests: "Personen",
      r_area: "Wijk",
      r_name: "Naam",
      r_phone: "Telefoon",
      r_email: "E-mail",
      r_unit: "Prijs per persoon",
      r_total: "Geschat totaal"
    },
    az: {
      labelService: "Xidmət",
      labelBranch: "Filial",
      r_branch: "Filial",
      headingHammam: "Hamam və ya masaj sifariş edin.",
      subHammam: "Paket və ya masaj, tarix və başlama vaxtı seçin. Sorğunuz WhatsApp ilə Alaturka Hamama gedir; ödəniş otel resepşnında nağd edilir.",
      areaOther: "Digər",
      phHotel: "məs. Sultanahmet Palace",
      phRoom: "məs. 214",
      phName: "məs. Leyla Məmmədova",
      phPhone: "+994 5x xxx xx xx",
      phEmail: "ad@example.com",
      r_rate: "Məzənnə",
      rateBasis: "satış məzənnəsi",
      navAccount: "Hesabım",
      seeRequests: "Sorğularıma bax →",
      noSlots: "Bu gün üçün boş vaxt qalmayıb. Başqa tarix seçin.",
      invalidTime: "Başlama vaxtı seçin.",
      labelOption: "Masaj növü",
      labelDuration: "Müddət",
      minutes: "dəq",
      openHours: "Hər gün {open}–{close}. Başlama vaxtı seçin.",
      r_option: "Seçim",
      r_duration: "Müddət",
      r_fx: "Təxminən",
      payNote: "Ödəniş: yalnız nağd, otel resepşnında. Blue Brothers kimi şirkətlər kartla ödənişə əlavə 10% komissiya alır, ona görə də resepşnda nağd ödəyin.",
      r_pay: "Ödəniş",
      r_cash: "Otel resepşnında nağd",
      labelHotel: "Otelin adı",
      labelRoom: "Otaq nömrəsi (istəyə bağlı)",
      invalidHotel: "Şirkətin sizi haradan götürəcəyini bilməsi üçün otelin adını yazın.",
      r_hotel: "Otel",
      r_room: "Otaq",
      openWa: "WhatsApp-ı aç",
      waTitle: "Bosphorly rezervasiya sorğusu",
      eyebrow: "SİZİN İSTANBUL · SİZİN YOLUNUZ",
      heading: "Təcrübənizi Bosphorly ilə sorğulayın.",
      subheading: "Tur, tarix və otel rayonunu seçin. Bosphorly sorğunuzu turu keçirən lisenziyalı şirkətə ötürür; ödəniş otel resepşnında nağd edilir.",
      stepName: "Sorğu məlumatları",
      formTitle: "Sorğunuz",
      formIntro: "Məlumatları doldurun; göndər düyməsini basanda sorğunuz WhatsApp ilə göndərilir.",
      labelOffer: "Tur",
      labelDate: "Tarix",
      labelTime: "Vaxt",
      labelGuests: "Nəfər",
      labelArea: "Otel rayonu",
      labelStatus: "Nəfər üçün qiymət",
      labelAvailability: "Təxmini cəm",
      priceNote: "Qiymətlər göstərilən tarixdə şirkətin özünün dərc etdiyi qiymətlərdir. Yekun qiyməti və mövcudluğu şirkət sorğunu qəbul edərkən təsdiqləyir.",
      consent: "Yuxarıdakı turu, vaxtı və qiyməti yoxladım. Sorğumun və əlaqə məlumatlarımın WhatsApp ilə Bosphorly-yə göndərilməsinə və ödənişi otel resepşnında nağd etməyə razıyam.",
      submit: "Sorğunu WhatsApp ilə göndər →",
      whyTitle: "Burada müqayisə edin. Resepşnda nağd ödəyin.",
      whyText: "Bosphorly İstanbulun lisenziyalı şirkətlərini yan-yana göstərir və sorğunuzu Bosphorly istinad kodu ilə ötürür. Şirkət təsdiqləyir və təcrübəni həyata keçirir; ödəniş otel resepşnında nağd edilir.",
      item1: "Şirkət qiymətləri, Bosphorly əlavəsi yoxdur",
      item2: "Gördüyünüz qiymət WhatsApp sorğunuza yazılır",
      item3: "Hər sorğuda Bosphorly istinad kodu",
      mapTitle: "Sorğudan əvvəl kəşf edin",
      mapLink: "İstanbul xəritəsini aç →",
      invalidDate: "Gələcək tarix seçin.",
      invalidGuests: "1–16 nəfər seçin.",
      invalidOffer: "Tur seçin.",
      invalidConsent: "Turu, vaxtı və qiyməti yoxladığınızı təsdiqləyin.",
      resultTitle: "Sorğunuz hazırdır",
      resultNotice: "WhatsApp sorğunuz yazılmış şəkildə açılır; Bosphorly-yə çatdırmaq üçün WhatsApp-da göndər düyməsini basın. Açılmasa, aşağıdakı düymədən istifadə edin.",
      notAvailable: "Kataloq əlçatan deyil. Səhifəni yeniləyin.",
      protoTag: "AÇIQ PROTOTİP",
      protoText: "Sorğular WhatsApp ilə · Bu saytda ödəniş alınmır",
      labelName: "Ad və soyad",
      labelPhone: "Mobil / WhatsApp",
      labelEmail: "E-poçt (istəyə bağlı)",
      contactNote: "WhatsApp-da göndər düyməsini basanda məlumatlarınız sorğunu təşkil etmək üçün Bosphorly-nin WhatsApp xəttinə gedir. Bosphorly onları serverdə saxlamır; surəti yalnız bu cihazda, Hesabım bölməsində qalır.",
      invalidName: "Adınızı və soyadınızı yazın.",
      invalidPhone: "Şirkətin təsdiqləyə bilməsi üçün ölkə kodu ilə düzgün telefon/WhatsApp nömrəsi yazın (məs. +994…).",
      invalidEmail: "E-poçt ünvanı düzgün görünmür.",
      navHome: "Ana səhifə",
      navCompare: "Turları müqayisə et",
      navMap: "Şəhər xəritəsi",
      footerText: "Bosphorly · Prototip · Yazdığınız heç nə serverdə saxlanılmır.",
      backHome: "← Ana səhifəyə qayıt",
      fixedSlot: "Bu tur üçün sabit vaxt",
      flexible: ["Səhər", "Günorta", "Axşam", "Çevik"],
      askPrice: "Qiyməti soruşun",
      from: "Başlayan",
      totalFrom: "başlayan",
      perGroup: "Qiymət nəfər üçün deyil; cəmi şirkət təsdiqləyir.",
      yourChoice: "Seçiminiz",
      r_ref: "İstinad",
      r_shownAt: "Göstərilib",
      r_source: "Qiymət mənbəyi",
      r_checked: "yoxlanılıb",
      r_tour: "Təcrübə",
      r_company: "Şirkət",
      r_date: "Tarix",
      r_time: "Vaxt",
      r_guests: "Nəfər",
      r_area: "Rayon",
      r_name: "Ad",
      r_phone: "Telefon",
      r_email: "E-poçt",
      r_unit: "Nəfər üçün qiymət",
      r_total: "Təxmini cəm"
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
