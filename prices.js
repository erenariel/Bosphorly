'use strict';
/* Operator price and tour-content comparison. Local rendering only: no tracking, no checkout links. */
(() => {
  const $ = id => document.getElementById(id);
  const lang = window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const tr = lang === 'tr';
  document.documentElement.lang = lang;

  const D = {
    tr: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'Hamam paketleri', hbMassages: 'Masajlar', hbBook: 'Hamam veya masaj rezervasyonu yap →', hbHours: 'Her gün 09:30–23:00 · Fatih ve Beyoğlu şubeleri', 
    home: 'Ana sayfa', plan: 'Talep et', map: 'Harita', account: 'Hesabım', footer: 'Bosphorly · Yalnızca karşılaştırma · Talep gönderilmez, ödeme alınmaz.',
    eyebrow: 'TUR KARŞILAŞTIRMA · İSTANBUL', heading: 'İstanbul turlarını karşılaştır.',
    lead: 'Lisanslı firmaların kendi sitelerinde yayımladığı fiyatlar ve tur içerikleri. Neyin dahil olduğunu yan yana gör.',
    noticeTitle: 'Bilgiler firmaların kendi sitelerinden derlenmiştir; Bosphorly teklifi değildir.',
    noticeBody: 'Fiyat ve içerikler tarihe, yaşa ve pakete göre değişebilir. Kesin fiyatı ve müsaitliği firma, talebini kabul ederken teyit eder. Ödeme otel resepsiyonuna yalnızca nakit yapılır; tur firmaları kredi kartı ödemelerinde %10 ek komisyon alır.',
    query: 'Tur veya firma ara…', per: 'kişi başı', from: 'Başlangıç', was: 'önceki',
    request: 'Bosphorly’de talep et →', soon: 'Firma anlaşması bekleniyor', checked: 'Kontrol', none: 'Eşleşen tur bulunamadı.',
    notListed: 'Fiyat sor', records: 'tur', included: 'Dahil', excluded: 'Dahil değil', more: 'Tüm ayrıntılar',
    schedule: 'Saatler', meeting: 'Buluşma', guide: 'Rehber', pickup: 'Transfer', cancel: 'İptal', notes: 'Bilmen gerekenler',
    source: 'Kaynak: firmanın sitesi', noDetails: 'Firma sitesinde ayrıntılı içerik bulunamadı.', englishOnly: '',
    cats: { cruise: 'Boğaz turu', dinner: 'Akşam yemekli tur', city: 'Şehir turu', day: 'Günübirlik tur', islands: 'Adalar', hammam: 'Hamam', transfer: 'Transfer', multi: 'Çok günlü tur' },
    allCompanies: 'Tüm firmalar', allCurrencies: 'Tüm para birimleri', massageTitle: 'Masaj türleri ve fiyatlar', min: 'dk', loadFail: 'Fiyat verisi açılamadı.'
    },
    en: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'Hammam packages', hbMassages: 'Massages', hbBook: 'Book hammam or massage →', hbHours: 'Open daily 09:30–23:00 · Fatih and Beyoğlu branches', 
    home: 'Home', plan: 'Request', map: 'Map',
    eyebrow: 'TOUR COMPARISON · ISTANBUL', heading: 'Compare Istanbul tours.',
    lead: 'Prices and tour contents published by licensed companies on their own websites. See what is included, side by side.',
    noticeTitle: 'Summarised from each company’s own website; not a Bosphorly offer.',
    noticeBody: 'Prices and contents can change by date, age and package. The company confirms the final price and availability when it accepts your request. Payment is cash only at the hotel reception; tour companies charge an extra 10% on credit card payments.',
    query: 'Search tours or companies…', per: 'per person', from: 'From', was: 'was',
    request: 'Request on Bosphorly →', soon: 'Company agreement pending', checked: 'Checked', none: 'No matching tours.',
    notListed: 'Ask for price', records: 'tours', included: 'Included', excluded: 'Not included', more: 'All details',
    schedule: 'Times', meeting: 'Meeting point', guide: 'Guide', pickup: 'Transfer', cancel: 'Cancellation', notes: 'Good to know',
    source: 'Source: company website', noDetails: 'No detailed contents found on the company website.', englishOnly: '',
    cats: { cruise: 'Bosphorus cruise', dinner: 'Dinner cruise', city: 'City tour', day: 'Day trip', islands: 'Islands', hammam: 'Hammam', transfer: 'Transfer', multi: 'Multi-day tour' },
    account: 'My account', allCompanies: 'All companies', allCurrencies: 'All currencies', massageTitle: 'Massage types and prices', min: 'min', loadFail: 'Could not load the price catalog.'
    },
    ru: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'Пакеты хаммама', hbMassages: 'Массажи', hbBook: 'Забронировать хаммам или массаж →', hbHours: 'Ежедневно 09:30–23:00 · филиалы в Фатихе и Бейоглу', 
    home: 'Главная', plan: 'Заявка', map: 'Карта', account: 'Мой аккаунт', footer: 'Bosphorly · Только сравнение · Оплата здесь не принимается.',
    eyebrow: 'СРАВНЕНИЕ ТУРОВ · СТАМБУЛ', heading: 'Сравните туры по Стамбулу.',
    lead: 'Цены и программы, опубликованные лицензированными компаниями на их собственных сайтах. Сравните, что включено.',
    noticeTitle: 'Собрано с сайтов самих компаний; это не предложение Bosphorly.',
    noticeBody: 'Цены и программы зависят от даты, возраста и пакета. Окончательную цену и наличие мест компания подтверждает при принятии заявки. Оплата только наличными на ресепшене отеля; за оплату картой туркомпании берут дополнительно 10%.',
    query: 'Поиск тура или компании…', per: 'с человека', from: 'от', was: 'было',
    request: 'Заявка через Bosphorly →', soon: 'Ожидается договор с компанией', checked: 'Проверено', none: 'Подходящих туров нет.',
    notListed: 'Цена по запросу', records: 'туров', included: 'Включено', excluded: 'Не включено', more: 'Все подробности',
    schedule: 'Время', meeting: 'Место встречи', guide: 'Гид', pickup: 'Трансфер', cancel: 'Отмена', notes: 'Полезно знать',
    source: 'Источник: сайт компании', noDetails: 'Подробной программы на сайте компании нет.', englishOnly: '', allCompanies: 'Все компании', allCurrencies: 'Все валюты', massageTitle: 'Виды массажа и цены', min: 'мин', loadFail: 'Не удалось загрузить каталог.',
    cats: { cruise: 'Прогулка по Босфору', dinner: 'Ужин на теплоходе', city: 'Городской тур', day: 'Однодневный тур', islands: 'Острова', hammam: 'Хаммам', transfer: 'Трансфер', multi: 'Многодневный тур' }
    },
    ar: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'باقات الحمام', hbMassages: 'التدليك', hbBook: 'احجز الحمام أو التدليك ←', hbHours: 'يوميًا 09:30–23:00 · فرعا الفاتح وبيوغلو', 
    home: 'الرئيسية', plan: 'طلب', map: 'الخريطة', account: 'حسابي', footer: 'Bosphorly · للمقارنة فقط · لا يتم الدفع هنا.',
    eyebrow: 'مقارنة الجولات · إسطنبول', heading: 'قارن جولات إسطنبول.',
    lead: 'أسعار وبرامج نشرتها شركات مرخّصة على مواقعها. قارن ما هو مشمول جنبًا إلى جنب.',
    noticeTitle: 'مُلخّص من مواقع الشركات نفسها؛ ليس عرضًا من Bosphorly.',
    noticeBody: 'قد تتغير الأسعار والبرامج حسب التاريخ والعمر والباقة. تؤكد الشركة السعر النهائي والتوفر عند قبول طلبك. الدفع نقدًا فقط في استقبال الفندق؛ تضيف شركات الجولات 10% على الدفع بالبطاقة.',
    query: 'ابحث عن جولة أو شركة…', per: 'للشخص', from: 'ابتداءً من', was: 'كان',
    request: 'اطلب عبر Bosphorly ←', soon: 'بانتظار اتفاق مع الشركة', checked: 'تم التحقق', none: 'لا توجد جولات مطابقة.',
    notListed: 'السعر عند الطلب', records: 'جولة', included: 'مشمول', excluded: 'غير مشمول', more: 'كل التفاصيل',
    schedule: 'الأوقات', meeting: 'نقطة اللقاء', guide: 'المرشد', pickup: 'النقل', cancel: 'الإلغاء', notes: 'معلومات مفيدة',
    source: 'المصدر: موقع الشركة', noDetails: 'لا توجد تفاصيل على موقع الشركة.', englishOnly: '', allCompanies: 'كل الشركات', allCurrencies: 'كل العملات', massageTitle: 'أنواع التدليك والأسعار', min: 'دقيقة', loadFail: 'تعذّر تحميل الكتالوج.',
    cats: { cruise: 'جولة في البوسفور', dinner: 'عشاء على قارب', city: 'جولة في المدينة', day: 'رحلة يوم واحد', islands: 'الجزر', hammam: 'حمام', transfer: 'نقل', multi: 'جولة عدة أيام' }
    },
    de: {
    hbTitle: 'Alaturka Hamam & Spa', hbPackages: 'Hamam-Pakete', hbMassages: 'Massagen', hbBook: 'Hamam oder Massage buchen →', hbHours: 'Täglich 09:30–23:00 · Filialen Fatih und Beyoğlu',
    home: 'Startseite', plan: 'Anfrage', map: 'Karte', account: 'Mein Konto', footer: 'Bosphorly · Nur Vergleich · Hier wird keine Zahlung angenommen.',
    eyebrow: 'TOURENVERGLEICH · ISTANBUL', heading: 'Istanbul-Touren vergleichen.',
    lead: 'Preise und Programme, die lizenzierte Anbieter auf ihren eigenen Websites veröffentlichen. Vergleichen Sie die Leistungen nebeneinander.',
    noticeTitle: 'Zusammengefasst von den Websites der Anbieter; kein Angebot von Bosphorly.',
    noticeBody: 'Preise und Programme können je nach Datum, Alter und Paket variieren. Endpreis und Verfügbarkeit bestätigt der Anbieter bei Annahme Ihrer Anfrage. Zahlung nur bar an der Hotelrezeption; Touranbieter berechnen bei Kartenzahlung 10 % Aufschlag.',
    query: 'Tour oder Anbieter suchen…', per: 'pro Person', from: 'Ab', was: 'vorher',
    request: 'Über Bosphorly anfragen →', soon: 'Vereinbarung mit Anbieter ausstehend', checked: 'Geprüft', none: 'Keine passenden Touren.',
    notListed: 'Preis auf Anfrage', records: 'Touren', included: 'Inklusive', excluded: 'Nicht inklusive', more: 'Alle Details',
    schedule: 'Zeiten', meeting: 'Treffpunkt', guide: 'Guide', pickup: 'Transfer', cancel: 'Stornierung', notes: 'Gut zu wissen',
    source: 'Quelle: Website des Anbieters', noDetails: 'Keine detaillierten Inhalte auf der Website des Anbieters.', englishOnly: '',
    allCompanies: 'Alle Anbieter', allCurrencies: 'Alle Währungen', massageTitle: 'Massagearten und Preise', min: 'Min.', loadFail: 'Katalog konnte nicht geladen werden.',
    cats: { cruise: 'Bosporus-Fahrt', dinner: 'Dinner-Fahrt', city: 'Stadttour', day: 'Tagesausflug', islands: 'Inseln', hammam: 'Hamam', transfer: 'Transfer', multi: 'Mehrtagestour' }
    },
    it: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Pacchetti hammam",
      hbMassages: "Massaggi",
      hbBook: "Prenota hammam o massaggio →",
      hbHours: "Aperto tutti i giorni 09:30–23:00 · sedi di Fatih e Beyoğlu",
      home: "Home",
      plan: "Richiesta",
      map: "Mappa",
      eyebrow: "CONFRONTO TOUR · ISTANBUL",
      heading: "Confronta i tour di Istanbul.",
      lead: "Prezzi e contenuti dei tour pubblicati da aziende autorizzate sui propri siti. Guarda cosa è incluso, fianco a fianco.",
      noticeTitle: "Riassunto dal sito di ciascuna azienda; non è un’offerta di Bosphorly.",
      noticeBody: "Prezzi e contenuti possono cambiare in base a data, età e pacchetto. L’azienda conferma prezzo finale e disponibilità quando accetta la richiesta. Il pagamento è solo in contanti alla reception dell’hotel; le aziende applicano un 10% in più sui pagamenti con carta.",
      query: "Cerca tour o aziende…",
      per: "a persona",
      from: "Da",
      was: "prima",
      request: "Richiedi su Bosphorly →",
      soon: "Accordo con l’azienda in attesa",
      checked: "Verificato",
      none: "Nessun tour corrispondente.",
      notListed: "Prezzo su richiesta",
      records: "tour",
      included: "Incluso",
      excluded: "Non incluso",
      more: "Tutti i dettagli",
      schedule: "Orari",
      meeting: "Punto d’incontro",
      guide: "Guida",
      pickup: "Transfer",
      cancel: "Cancellazione",
      notes: "Buono a sapersi",
      source: "Fonte: sito dell’azienda",
      noDetails: "Nessun contenuto dettagliato sul sito dell’azienda.",
      englishOnly: "",
      cats: {"cruise": "Crociera sul Bosforo", "dinner": "Crociera con cena", "city": "Tour in città", "day": "Gita di un giorno", "islands": "Isole", "hammam": "Hammam", "transfer": "Transfer", "multi": "Tour di più giorni"},
      account: "Il mio account",
      allCompanies: "Tutte le aziende",
      allCurrencies: "Tutte le valute",
      massageTitle: "Tipi di massaggio e prezzi",
      min: "min",
      loadFail: "Impossibile caricare il catalogo prezzi."
    },
    pt: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Pacotes de hamam",
      hbMassages: "Massagens",
      hbBook: "Reservar hamam ou massagem →",
      hbHours: "Aberto todos os dias 09:30–23:00 · unidades de Fatih e Beyoğlu",
      home: "Início",
      plan: "Pedido",
      map: "Mapa",
      eyebrow: "COMPARAÇÃO DE PASSEIOS · ISTAMBUL",
      heading: "Compare passeios em Istambul.",
      lead: "Preços e conteúdos publicados por empresas licenciadas nos próprios sites. Veja lado a lado o que está incluído.",
      noticeTitle: "Resumo do site de cada empresa; não é uma oferta da Bosphorly.",
      noticeBody: "Preços e conteúdos podem mudar conforme a data, a idade e o pacote. A empresa confirma o preço final e a disponibilidade ao aceitar o pedido. O pagamento é só em dinheiro na recepção do hotel; as empresas cobram 10% a mais no cartão.",
      query: "Buscar passeios ou empresas…",
      per: "por pessoa",
      from: "A partir de",
      was: "antes",
      request: "Pedir pela Bosphorly →",
      soon: "Acordo com a empresa pendente",
      checked: "Verificado",
      none: "Nenhum passeio encontrado.",
      notListed: "Preço sob consulta",
      records: "passeios",
      included: "Incluído",
      excluded: "Não incluído",
      more: "Todos os detalhes",
      schedule: "Horários",
      meeting: "Ponto de encontro",
      guide: "Guia",
      pickup: "Traslado",
      cancel: "Cancelamento",
      notes: "Bom saber",
      source: "Fonte: site da empresa",
      noDetails: "Nenhum conteúdo detalhado no site da empresa.",
      englishOnly: "",
      cats: {"cruise": "Cruzeiro pelo Bósforo", "dinner": "Cruzeiro com jantar", "city": "Passeio pela cidade", "day": "Bate-volta", "islands": "Ilhas", "hammam": "Hamam", "transfer": "Traslado", "multi": "Passeio de vários dias"},
      account: "Minha conta",
      allCompanies: "Todas as empresas",
      allCurrencies: "Todas as moedas",
      massageTitle: "Tipos de massagem e preços",
      min: "min",
      loadFail: "Não foi possível carregar o catálogo de preços."
    },
    fr: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Forfaits hammam",
      hbMassages: "Massages",
      hbBook: "Réserver hammam ou massage →",
      hbHours: "Ouvert tous les jours 09:30–23:00 · établissements de Fatih et Beyoğlu",
      home: "Accueil",
      plan: "Demande",
      map: "Plan",
      eyebrow: "COMPARATIF DES VISITES · ISTANBUL",
      heading: "Comparez les visites d’Istanbul.",
      lead: "Prix et contenus publiés par des entreprises agréées sur leurs propres sites. Voyez ce qui est inclus, côte à côte.",
      noticeTitle: "Résumé du site de chaque entreprise ; ce n’est pas une offre Bosphorly.",
      noticeBody: "Prix et contenus peuvent varier selon la date, l’âge et la formule. L’entreprise confirme le prix final et la disponibilité en acceptant votre demande. Paiement uniquement en espèces à la réception de l’hôtel ; les entreprises facturent 10 % de plus par carte.",
      query: "Rechercher une visite ou une entreprise…",
      per: "par personne",
      from: "Dès",
      was: "avant",
      request: "Demander via Bosphorly →",
      soon: "Accord avec l’entreprise en attente",
      checked: "Vérifié",
      none: "Aucune visite correspondante.",
      notListed: "Prix sur demande",
      records: "visites",
      included: "Inclus",
      excluded: "Non inclus",
      more: "Tous les détails",
      schedule: "Horaires",
      meeting: "Point de rendez-vous",
      guide: "Guide",
      pickup: "Transfert",
      cancel: "Annulation",
      notes: "Bon à savoir",
      source: "Source : site de l’entreprise",
      noDetails: "Aucun contenu détaillé sur le site de l’entreprise.",
      englishOnly: "",
      cats: {"cruise": "Croisière sur le Bosphore", "dinner": "Croisière dîner", "city": "Visite de la ville", "day": "Excursion d’une journée", "islands": "Îles", "hammam": "Hammam", "transfer": "Transfert", "multi": "Circuit de plusieurs jours"},
      account: "Mon compte",
      allCompanies: "Toutes les entreprises",
      allCurrencies: "Toutes les devises",
      massageTitle: "Types de massage et prix",
      min: "min",
      loadFail: "Impossible de charger le catalogue des prix."
    },
    es: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Paquetes de hammam",
      hbMassages: "Masajes",
      hbBook: "Reservar hammam o masaje →",
      hbHours: "Abierto a diario 09:30–23:00 · sedes de Fatih y Beyoğlu",
      home: "Inicio",
      plan: "Solicitud",
      map: "Mapa",
      eyebrow: "COMPARATIVA DE TOURS · ESTAMBUL",
      heading: "Compara tours en Estambul.",
      lead: "Precios y contenidos publicados por empresas autorizadas en sus propias webs. Mira lo que incluye cada uno, lado a lado.",
      noticeTitle: "Resumen de la web de cada empresa; no es una oferta de Bosphorly.",
      noticeBody: "Precios y contenidos pueden cambiar según la fecha, la edad y el paquete. La empresa confirma el precio final y la disponibilidad al aceptar tu solicitud. El pago es solo en efectivo en la recepción del hotel; las empresas cobran un 10 % más con tarjeta.",
      query: "Buscar tours o empresas…",
      per: "por persona",
      from: "Desde",
      was: "antes",
      request: "Solicitar en Bosphorly →",
      soon: "Acuerdo con la empresa pendiente",
      checked: "Comprobado",
      none: "No hay tours que coincidan.",
      notListed: "Precio a consultar",
      records: "tours",
      included: "Incluido",
      excluded: "No incluido",
      more: "Todos los detalles",
      schedule: "Horarios",
      meeting: "Punto de encuentro",
      guide: "Guía",
      pickup: "Traslado",
      cancel: "Cancelación",
      notes: "A tener en cuenta",
      source: "Fuente: web de la empresa",
      noDetails: "No hay contenido detallado en la web de la empresa.",
      englishOnly: "",
      cats: {"cruise": "Crucero por el Bósforo", "dinner": "Crucero con cena", "city": "Tour por la ciudad", "day": "Excursión de un día", "islands": "Islas", "hammam": "Hammam", "transfer": "Traslado", "multi": "Tour de varios días"},
      account: "Mi cuenta",
      allCompanies: "Todas las empresas",
      allCurrencies: "Todas las monedas",
      massageTitle: "Tipos de masaje y precios",
      min: "min",
      loadFail: "No se pudo cargar el catálogo de precios."
    },
    uk: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Пакети хамаму",
      hbMassages: "Масажі",
      hbBook: "Забронювати хамам або масаж →",
      hbHours: "Щодня 09:30–23:00 · філії у Фатіху та Бейоглу",
      home: "Головна",
      plan: "Заявка",
      map: "Мапа",
      eyebrow: "ПОРІВНЯННЯ ТУРІВ · СТАМБУЛ",
      heading: "Порівняйте тури Стамбулом.",
      lead: "Ціни й програми, опубліковані ліцензованими компаніями на власних сайтах. Що включено — поруч.",
      noticeTitle: "Стисло із сайту кожної компанії; це не пропозиція Bosphorly.",
      noticeBody: "Ціни й програми можуть змінюватися залежно від дати, віку та пакета. Остаточну ціну й наявність компанія підтверджує, приймаючи заявку. Оплата лише готівкою на рецепції готелю; за оплату карткою компанії беруть +10%.",
      query: "Пошук турів або компаній…",
      per: "за особу",
      from: "Від",
      was: "було",
      request: "Заявка через Bosphorly →",
      soon: "Угода з компанією очікується",
      checked: "Перевірено",
      none: "Турів не знайдено.",
      notListed: "Ціна за запитом",
      records: "турів",
      included: "Включено",
      excluded: "Не включено",
      more: "Усі деталі",
      schedule: "Час",
      meeting: "Місце зустрічі",
      guide: "Гід",
      pickup: "Трансфер",
      cancel: "Скасування",
      notes: "Варто знати",
      source: "Джерело: сайт компанії",
      noDetails: "На сайті компанії немає детального опису.",
      englishOnly: "",
      cats: {"cruise": "Круїз Босфором", "dinner": "Круїз із вечерею", "city": "Міська екскурсія", "day": "Одноденна поїздка", "islands": "Острови", "hammam": "Хамам", "transfer": "Трансфер", "multi": "Багатоденний тур"},
      account: "Мій акаунт",
      allCompanies: "Усі компанії",
      allCurrencies: "Усі валюти",
      massageTitle: "Види масажу та ціни",
      min: "хв",
      loadFail: "Не вдалося завантажити каталог цін."
    },
    nl: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Hamampakketten",
      hbMassages: "Massages",
      hbBook: "Hamam of massage boeken →",
      hbHours: "Dagelijks open 09:30–23:00 · vestigingen in Fatih en Beyoğlu",
      home: "Home",
      plan: "Aanvraag",
      map: "Kaart",
      eyebrow: "TOURS VERGELIJKEN · ISTANBUL",
      heading: "Vergelijk tours in Istanbul.",
      lead: "Prijzen en tourinhoud zoals erkende bedrijven ze op hun eigen websites publiceren. Zie naast elkaar wat inbegrepen is.",
      noticeTitle: "Samengevat van de website van elk bedrijf; geen aanbod van Bosphorly.",
      noticeBody: "Prijzen en inhoud kunnen per datum, leeftijd en pakket verschillen. Het bedrijf bevestigt de definitieve prijs en beschikbaarheid wanneer het je aanvraag accepteert. Betalen kan alleen contant bij de hotelreceptie; bedrijven rekenen 10% extra bij creditcardbetaling.",
      query: "Zoek tours of bedrijven…",
      per: "per persoon",
      from: "Vanaf",
      was: "was",
      request: "Aanvragen via Bosphorly →",
      soon: "Overeenkomst met bedrijf in behandeling",
      checked: "Gecontroleerd",
      none: "Geen passende tours.",
      notListed: "Prijs op aanvraag",
      records: "tours",
      included: "Inbegrepen",
      excluded: "Niet inbegrepen",
      more: "Alle details",
      schedule: "Tijden",
      meeting: "Ontmoetingspunt",
      guide: "Gids",
      pickup: "Transfer",
      cancel: "Annulering",
      notes: "Goed om te weten",
      source: "Bron: website van het bedrijf",
      noDetails: "Geen uitgebreide inhoud op de website van het bedrijf gevonden.",
      englishOnly: "",
      cats: {"cruise": "Bosporuscruise", "dinner": "Dinercruise", "city": "Stadstour", "day": "Dagtocht", "islands": "Eilanden", "hammam": "Hamam", "transfer": "Transfer", "multi": "Meerdaagse tour"},
      account: "Mijn account",
      allCompanies: "Alle bedrijven",
      allCurrencies: "Alle valuta",
      massageTitle: "Soorten massage en prijzen",
      min: "min",
      loadFail: "De prijscatalogus kon niet worden geladen."
    },
    az: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Hamam paketləri",
      hbMassages: "Masajlar",
      hbBook: "Hamam və ya masaj sifariş et →",
      hbHours: "Hər gün 09:30–23:00 · Fateh və Beyoğlu filialları",
      home: "Ana səhifə",
      plan: "Sorğu",
      map: "Xəritə",
      eyebrow: "TUR MÜQAYİSƏSİ · İSTANBUL",
      heading: "İstanbul turlarını müqayisə edin.",
      lead: "Lisenziyalı şirkətlərin öz saytlarında dərc etdiyi qiymətlər və tur məzmunu. Nələrin daxil olduğunu yan-yana görün.",
      noticeTitle: "Hər şirkətin öz saytından xülasə; Bosphorly təklifi deyil.",
      noticeBody: "Qiymət və məzmun tarixə, yaşa və paketə görə dəyişə bilər. Yekun qiyməti və mövcudluğu şirkət sorğunu qəbul edərkən təsdiqləyir. Ödəniş yalnız otel resepşnında nağd; şirkətlər kartla ödənişə əlavə 10% alır.",
      query: "Tur və ya şirkət axtar…",
      per: "nəfər üçün",
      from: "Başlayan",
      was: "əvvəl",
      request: "Bosphorly ilə sorğu →",
      soon: "Şirkətlə razılaşma gözlənilir",
      checked: "Yoxlanılıb",
      none: "Uyğun tur yoxdur.",
      notListed: "Qiyməti soruşun",
      records: "tur",
      included: "Daxildir",
      excluded: "Daxil deyil",
      more: "Bütün detallar",
      schedule: "Vaxtlar",
      meeting: "Görüş nöqtəsi",
      guide: "Bələdçi",
      pickup: "Transfer",
      cancel: "Ləğvetmə",
      notes: "Bilmək faydalıdır",
      source: "Mənbə: şirkətin saytı",
      noDetails: "Şirkətin saytında ətraflı məzmun tapılmadı.",
      englishOnly: "",
      cats: {"cruise": "Boğaz kruizi", "dinner": "Şam yeməyi kruizi", "city": "Şəhər turu", "day": "Günlük səfər", "islands": "Adalar", "hammam": "Hamam", "transfer": "Transfer", "multi": "Çoxgünlük tur"},
      account: "Hesabım",
      allCompanies: "Bütün şirkətlər",
      allCurrencies: "Bütün valyutalar",
      massageTitle: "Masaj növləri və qiymətləri",
      min: "dəq",
      loadFail: "Qiymət kataloqu yüklənmədi."
    },
    he: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "חבילות חמאם",
      hbMassages: "עיסויים",
      hbBook: "הזמנת חמאם או עיסוי ←",
      hbHours: "פתוח כל יום 09:30–23:00 · סניפים בפאתיח ובבֵּיוֹגלוּ",
      home: "דף הבית",
      plan: "בקשה",
      map: "מפה",
      eyebrow: "השוואת סיורים · איסטנבול",
      heading: "השוו סיורים באיסטנבול.",
      lead: "מחירים ותוכן סיורים שפרסמו חברות מורשות באתרים שלהן. ראו זה לצד זה מה כלול.",
      noticeTitle: "תקציר מאתר כל חברה; זו אינה הצעה של Bosphorly.",
      noticeBody: "המחירים והתוכן עשויים להשתנות לפי תאריך, גיל וחבילה. החברה מאשרת את המחיר הסופי והזמינות כשהיא מקבלת את הבקשה. התשלום במזומן בלבד בקבלת המלון; החברות גובות 10% נוספים על תשלום בכרטיס.",
      query: "חיפוש סיורים או חברות…",
      per: "לאדם",
      from: "החל מ-",
      was: "במקום",
      request: "בקשה דרך Bosphorly ←",
      soon: "ההסכם עם החברה בהמתנה",
      checked: "נבדק",
      none: "אין סיורים מתאימים.",
      notListed: "מחיר לפי בקשה",
      records: "סיורים",
      included: "כלול",
      excluded: "לא כלול",
      more: "כל הפרטים",
      schedule: "שעות",
      meeting: "נקודת מפגש",
      guide: "מדריך",
      pickup: "העברה",
      cancel: "ביטול",
      notes: "טוב לדעת",
      source: "מקור: אתר החברה",
      noDetails: "לא נמצא תוכן מפורט באתר החברה.",
      englishOnly: "",
      cats: {"cruise": "שייט בבוספורוס", "dinner": "שייט ארוחת ערב", "city": "סיור בעיר", "day": "טיול יום", "islands": "איים", "hammam": "חמאם", "transfer": "העברה", "multi": "סיור של כמה ימים"},
      account: "החשבון שלי",
      allCompanies: "כל החברות",
      allCurrencies: "כל המטבעות",
      massageTitle: "סוגי עיסוי ומחירים",
      min: "דק'",
      loadFail: "לא ניתן היה לטעון את קטלוג המחירים."
    },
    fa: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "پکیج‌های حمام",
      hbMassages: "ماساژها",
      hbBook: "رزرو حمام یا ماساژ ←",
      hbHours: "هر روز 09:30–23:00 · شعبه‌های فاتح و بی‌اوغلو",
      home: "خانه",
      plan: "درخواست",
      map: "نقشه",
      eyebrow: "مقایسه تورها · استانبول",
      heading: "تورهای استانبول را مقایسه کنید.",
      lead: "قیمت‌ها و محتوای تورها که شرکت‌های دارای مجوز در سایت خود منتشر کرده‌اند. ببینید چه چیزهایی شامل است، کنار هم.",
      noticeTitle: "خلاصه‌ای از سایت هر شرکت؛ پیشنهاد Bosphorly نیست.",
      noticeBody: "قیمت‌ها و محتوا بسته به تاریخ، سن و پکیج ممکن است تغییر کند. شرکت هنگام پذیرش درخواست، قیمت نهایی و ظرفیت را تأیید می‌کند. پرداخت فقط نقدی در پذیرش هتل است؛ شرکت‌ها برای پرداخت با کارت ۱۰٪ بیشتر می‌گیرند.",
      query: "جست‌وجوی تور یا شرکت…",
      per: "هر نفر",
      from: "از",
      was: "قبلاً",
      request: "درخواست از طریق Bosphorly ←",
      soon: "قرارداد با شرکت در انتظار است",
      checked: "بررسی‌شده",
      none: "توری پیدا نشد.",
      notListed: "قیمت را بپرسید",
      records: "تور",
      included: "شامل",
      excluded: "شامل نیست",
      more: "همه جزئیات",
      schedule: "ساعت‌ها",
      meeting: "محل ملاقات",
      guide: "راهنما",
      pickup: "ترانسفر",
      cancel: "لغو",
      notes: "خوب است بدانید",
      source: "منبع: سایت شرکت",
      noDetails: "محتوای دقیقی در سایت شرکت پیدا نشد.",
      englishOnly: "",
      cats: {"cruise": "کروز بسفر", "dinner": "کروز شام", "city": "تور شهری", "day": "سفر یک‌روزه", "islands": "جزایر", "hammam": "حمام", "transfer": "ترانسفر", "multi": "تور چندروزه"},
      account: "حساب من",
      allCompanies: "همه شرکت‌ها",
      allCurrencies: "همه ارزها",
      massageTitle: "انواع ماساژ و قیمت‌ها",
      min: "دقیقه",
      loadFail: "کاتالوگ قیمت‌ها بارگذاری نشد."
    }
  };
  const T = D[lang] || D.en;
  if (D[lang] && window.BosphorlyLang.rtl(lang)) document.documentElement.dir = 'rtl';
  const ICON = { cruise: '⛴️', dinner: '🍽️', city: '🕌', day: '🏞️', islands: '🏝️', hammam: '♨️', transfer: '🚐', multi: '🧭' };

  for (const [id, text] of Object.entries(T)) if (typeof text === 'string' && $(id)) $(id).textContent = text;
  $('operator').options[0].textContent = T.allCompanies; $('currency').options[0].textContent = T.allCurrencies;
  const Q = $('query');
  Q.placeholder = T.query;

  let rows = [];

  function category(r) {
    const t = (r.title + ' ' + r.id).toLowerCase();
    if (/hammam|hamam|massage|masaj/.test(t)) return 'hammam';
    if (/transfer/.test(t)) return 'transfer';
    if (/cappadocia|pamukkale/.test(t)) return 'multi';
    if (/dinner|new year|à la carte|turkish night/.test(t)) return 'dinner';
    if (/island/.test(t)) return 'islands';
    if (/bursa|sapanca|yalova|şile|sile/.test(t)) return 'day';
    if (/cruise|bosphorus/.test(t) && !/old city|city tour|asia|europe|continent/.test(t)) return 'cruise';
    return 'city';
  }

  const fmt = (value, currency) => window.BosphorlyCurrency ? window.BosphorlyCurrency.format(value, currency)
    : new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-latn' : lang, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function list(items, cls, max) {
    const ul = el('ul', cls);
    for (const item of items.slice(0, max ?? items.length)) ul.append(el('li', null, item));
    return ul;
  }

  // Translations live under details.<lang>; any field without one falls back to the English summary.
  function localized(d) {
    const t = d[lang] || {};
    const pick = k => t[k] ?? d[k];
    return { duration: pick('duration'), pickup: pick('pickup'), guide: pick('guide'), highlights: pick('highlights'), included: pick('included'),
      not_included: pick('not_included'), cancellation: pick('cancellation'), notes: pick('notes'), schedule: pick('schedule'),
      meeting_point: pick('meeting_point'), translated: Boolean(t.highlights) };
  }

  function card(r) {
    const cat = category(r);
    const article = el('article', 'item cat-' + cat);
    const head = el('div', 'item-head');
    head.append(el('span', 'item-icon', ICON[cat]), el('span', 'item-cat', T.cats[cat]));
    const body = el('div', 'item-body');
    body.append(el('span', 'operator', r.operator));
    const gRate = window.BosphorlyRatings && window.BosphorlyRatings.forOperator(r.operator);
    if (gRate) body.append(gRate);
    body.append(el('h2', null, r['title_' + lang] || r.title));

    const priceRow = el('div', 'price-row');
    if (Number.isFinite(r.price)) {
      const strong = el('strong', null, (r.basis || '').startsWith('from') ? T.from + ' ' + fmt(r.price, r.currency) : fmt(r.price, r.currency));
      priceRow.append(strong);
      if (Number.isFinite(r.original_price)) priceRow.append(el('s', 'was', fmt(r.original_price, r.currency)));
      if ((r.basis || '').includes('per_person')) priceRow.append(el('span', 'per', T.per));
    } else priceRow.append(el('strong', null, T.notListed));
    body.append(priceRow);

    const d = r.details;
    if (d) {
      const L = localized(d);
      const chips = el('div', 'chips');
      if (L.duration) chips.append(el('span', 'chip', '⏱ ' + L.duration));
      if (L.pickup) chips.append(el('span', 'chip', '🚐 ' + L.pickup));
      if (L.guide) chips.append(el('span', 'chip', '🗣 ' + L.guide));
      if (chips.children.length) body.append(chips);
      if (L.highlights?.length) body.append(list(L.highlights, 'highlights', 3));
      if (L.included?.length) {
        body.append(el('p', 'list-title', T.included));
        body.append(list(L.included, 'ticks', 5));
      }
      const more = el('details', 'more');
      more.append(el('summary', null, T.more));
      const add = (label, value) => { if (value) { const p = el('p', 'kv'); p.append(el('b', null, label + ': '), document.createTextNode(value)); more.append(p); } };
      add(T.schedule, L.schedule);
      add(T.meeting, L.meeting_point);
      add(T.cancel, L.cancellation);
      if (L.highlights?.length > 3) { more.append(list(L.highlights.slice(3), 'highlights')); }
      if (L.included?.length > 5) { more.append(el('p', 'list-title', T.included)); more.append(list(L.included.slice(5), 'ticks')); }
      if (r.options?.length) {
        more.append(el('p', 'list-title', T.massageTitle));
        more.append(list(r.options.map(o => (o['name_' + lang] || o.name) + ': ' + o.durations.map(x => x.min + ' ' + T.min + ' ' + fmt(x.price, r.currency)).join(' · ')), 'notes'));
      }
      if (L.not_included?.length) { more.append(el('p', 'list-title', T.excluded)); more.append(list(L.not_included, 'crosses')); }
      if (L.notes?.length) { more.append(el('p', 'list-title', T.notes)); more.append(list(L.notes, 'notes')); }
      const src = el('p', 'fine');
      const a = el('a', null, T.source);
      a.href = d.source_url; a.target = '_blank'; a.rel = 'noopener nofollow';
      src.append(a, document.createTextNode(' · ' + T.checked + ': ' + d.checked));
      more.append(src);
      body.append(more);
    } else body.append(el('p', 'fine', T.noDetails));

    const a = el('a', 'button', T.request);
    a.href = 'booking.html?service=' + encodeURIComponent(r.id) + '&lang=' + encodeURIComponent(lang);
    body.append(a);
    article.append(head, body);
    return article;
  }

  function hammamCard(items) {
    const article = el('article', 'item cat-hammam hb-card');
    const head = el('div', 'item-head'); head.append(el('span', 'item-icon', ICON.hammam), el('span', 'item-cat', T.cats.hammam));
    const body = el('div', 'item-body');
    body.append(el('span', 'operator', 'Alaturka Hamam'));
    const gRate = window.BosphorlyRatings && window.BosphorlyRatings.forOperator('Alaturka Hamam');
    if (gRate) body.append(gRate);
    body.append(el('h2', null, T.hbTitle));
    const min = Math.min(...items.flatMap(r => r.options ? r.options.flatMap(o => o.durations.map(d => d.price)) : [r.price]));
    const priceRow = el('div', 'price-row'); priceRow.append(el('strong', null, T.from + ' ' + fmt(min, 'EUR')), el('span', 'per', T.per)); body.append(priceRow);
    body.append(el('div', 'chips')); body.lastChild.append(el('span', 'chip', '🕘 ' + T.hbHours));
    const pk = items.filter(r => !r.options);
    body.append(el('p', 'list-title', T.hbPackages));
    body.append(list(pk.map(r => (r['title_' + lang] || r.title) + ' · 60 ' + T.min + ': ' + fmt(r.price, r.currency)), 'ticks'));
    const m = items.find(r => r.options);
    if (m) {
      const more = el('details', 'more'); more.append(el('summary', null, T.hbMassages + ' (' + m.options.length + ')'));
      const tiers = new Map();
      m.options.forEach(o => { const k = o.durations.map(x => x.min + ':' + x.price).join('|'); if (!tiers.has(k)) tiers.set(k, { durations: o.durations, names: [] }); tiers.get(k).names.push(o['name_' + lang] || o.name); });
      tiers.forEach(tier => {
        const box = el('div', 'hb-tier');
        const pr = el('div', 'hb-tier-prices'); tier.durations.forEach(x => pr.append(el('span', null, x.min + ' ' + T.min + ' · ' + fmt(x.price, m.currency))));
        const chips = el('div', 'hb-chips'); tier.names.forEach(n => chips.append(el('span', null, n)));
        box.append(pr, chips); more.append(box);
      });
      const d = pk[0]?.details; const L = d ? Object.assign({}, d, d[lang] || {}) : null;
      if (L?.notes?.length) { more.append(el('p', 'list-title', T.notes)); more.append(list(L.notes, 'notes')); }
      const src = el('p', 'fine'); const a = el('a', null, T.source); a.href = m.details?.source_url || m.source_url; a.target = '_blank'; a.rel = 'noopener nofollow';
      src.append(a, document.createTextNode(' · ' + T.checked + ': ' + (m.details?.checked || ''))); more.append(src);
      body.append(more);
    }
    const a = el('a', 'button', T.hbBook); a.href = 'booking.html?service=alaturka&lang=' + encodeURIComponent(lang); body.append(a);
    article.append(head, body);
    return article;
  }

  function show() {
    const q = Q.value.toLocaleLowerCase();
    const op = $('operator').value, cur = $('currency').value;
    const data = rows.filter(x => (op === 'all' || x.operator === op) && (cur === 'all' || x.currency === cur) &&
      (x.title + ' ' + (x['title_' + lang] || '') + ' ' + x.operator + ' ' + (x.details?.highlights || []).join(' ') + ' ' + (x.details?.[lang]?.highlights || []).join(' ')).toLocaleLowerCase().includes(q));
    const wrap = $('catalog');
    wrap.replaceChildren();
    $('summary').textContent = (data.filter(r => r.operator !== 'Alaturka Hamam').length + (data.some(r => r.operator === 'Alaturka Hamam') ? 1 : 0)) + ' ' + T.records;
    if (!data.length) { wrap.append(el('p', 'empty', T.none)); return; }
    // Records with researched contents first, then the rest.
    data.sort((a, b) => Number(Boolean(b.details?.included)) - Number(Boolean(a.details?.included)));
    // Alaturka Hamam is shown as one card with all packages and massages.
    let hammamDone = false;
    for (const r of data) {
      if (r.operator === 'Alaturka Hamam') { if (!hammamDone) { wrap.append(hammamCard(data.filter(x => x.operator === 'Alaturka Hamam'))); hammamDone = true; } continue; }
      wrap.append(card(r));
    }
  }

  if (window.BosphorlyCurrency) window.BosphorlyCurrency.onChange(() => { show(); $('fxNote').textContent = window.BosphorlyCurrency.note(); });
  $('operator').addEventListener('change', show);
  $('currency').addEventListener('change', show);
  Q.addEventListener('input', show);
  fetch('data/public-market-prices.json')
    .then(r => { if (!r.ok) throw Error('fetch'); return r.json(); })
    .then(d => {
      rows = d.records || [];
      for (const name of [...new Set(rows.map(r => r.operator))].sort()) {
        const o = el('option', null, name); o.value = name; $('operator').append(o);
      }
      show();
    })
    .catch(() => { $('summary').textContent = T.loadFail; });
})();
