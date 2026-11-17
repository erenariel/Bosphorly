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
    },
    hr: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Paketi hamama",
      hbMassages: "Masaže",
      hbBook: "Rezervirajte hamam ili masažu →",
      hbHours: "Otvoreno svaki dan 09:30–23:00 · Podružnice Fatih i Beyoğlu",
      home: "Početna",
      plan: "Upit",
      map: "Karta",
      eyebrow: "USPOREDBA TURA · ISTANBUL",
      heading: "Usporedite ture po Istanbulu.",
      lead: "Cijene i sadržaj tura koje licencirane tvrtke objavljuju na svojim web-stranicama. Pogledajte što je uključeno, jedno uz drugo.",
      noticeTitle: "Sažeto s web-stranice svake tvrtke; nije Bosphorly ponuda.",
      noticeBody: "Cijene i sadržaj mogu se mijenjati ovisno o datumu, dobi i paketu. Tvrtka potvrđuje konačnu cijenu i dostupnost kada prihvati vaš upit. Plaća se samo gotovinom na recepciji hotela; turističke tvrtke za plaćanje karticom naplaćuju dodatnih 10%.",
      query: "Pretražite ture ili tvrtke…",
      per: "po osobi",
      from: "Od",
      was: "prije",
      request: "Pošaljite upit na Bosphorly →",
      soon: "Ugovor s tvrtkom u pripremi",
      checked: "Provjereno",
      none: "Nema odgovarajućih tura.",
      notListed: "Cijena na upit",
      records: "tura",
      included: "Uključeno",
      excluded: "Nije uključeno",
      more: "Svi detalji",
      schedule: "Termini",
      meeting: "Mjesto sastanka",
      guide: "Vodič",
      pickup: "Transfer",
      cancel: "Otkazivanje",
      notes: "Dobro je znati",
      source: "Izvor: web-stranica tvrtke",
      noDetails: "Na web-stranici tvrtke nije pronađen detaljan sadržaj.",
      englishOnly: "",
      cats: {"cruise": "Krstarenje Bosporom", "dinner": "Krstarenje s večerom", "city": "Razgledavanje grada", "day": "Jednodnevni izlet", "islands": "Otoci", "hammam": "Hamam", "transfer": "Transfer", "multi": "Višednevna tura"},
      account: "Moj račun",
      allCompanies: "Sve tvrtke",
      allCurrencies: "Sve valute",
      massageTitle: "Vrste masaža i cijene",
      min: "min",
      loadFail: "Katalog cijena nije bilo moguće učitati."
    },
    hu: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Hamamcsomagok",
      hbMassages: "Masszázsok",
      hbBook: "Hamam vagy masszázs foglalása →",
      hbHours: "Nyitva minden nap 09:30–23:00 · Fatihi és beyoğlui részleg",
      home: "Főoldal",
      plan: "Ajánlatkérés",
      map: "Térkép",
      eyebrow: "TÚRÁK ÖSSZEHASONLÍTÁSA · ISZTAMBUL",
      heading: "Hasonlítsa össze az isztambuli túrákat.",
      lead: "Engedéllyel rendelkező cégek által saját weboldalukon közzétett árak és túratartalmak. Nézze meg egymás mellett, mit tartalmaznak.",
      noticeTitle: "Az egyes cégek saját weboldaláról összefoglalva; nem a Bosphorly ajánlata.",
      noticeBody: "Az árak és a tartalom dátumtól, életkortól és csomagtól függően változhatnak. A végleges árat és az elérhetőséget a cég erősíti meg, amikor elfogadja az ajánlatkérést. Fizetni csak készpénzben lehet a szálloda recepcióján; a túraszervezők bankkártyás fizetésnél 10% felárat számolnak fel.",
      query: "Túrák vagy cégek keresése…",
      per: "személyenként",
      from: "Kezdőár",
      was: "korábban",
      request: "Ajánlatkérés a Bosphorlyn →",
      soon: "Céges szerződés folyamatban",
      checked: "Ellenőrizve",
      none: "Nincs megfelelő túra.",
      notListed: "Ár kérésre",
      records: "túra",
      included: "Benne van",
      excluded: "Nincs benne",
      more: "Minden részlet",
      schedule: "Időpontok",
      meeting: "Találkozási pont",
      guide: "Idegenvezető",
      pickup: "Transzfer",
      cancel: "Lemondás",
      notes: "Jó tudni",
      source: "Forrás: a cég weboldala",
      noDetails: "A cég weboldalán nem találtunk részletes tartalmat.",
      englishOnly: "",
      cats: {"cruise": "Boszporuszi hajókirándulás", "dinner": "Vacsorás hajókirándulás", "city": "Városnézés", "day": "Egynapos kirándulás", "islands": "Szigetek", "hammam": "Hamam", "transfer": "Transzfer", "multi": "Többnapos túra"},
      account: "Fiókom",
      allCompanies: "Minden cég",
      allCurrencies: "Minden pénznem",
      massageTitle: "Masszázsfajták és árak",
      min: "perc",
      loadFail: "Az árkatalógust nem sikerült betölteni."
    },
    bs: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Paketi hamama",
      hbMassages: "Masaže",
      hbBook: "Rezervišite hamam ili masažu →",
      hbHours: "Otvoreno svaki dan 09:30–23:00 · Podružnice Fatih i Beyoğlu",
      home: "Početna",
      plan: "Upit",
      map: "Karta",
      eyebrow: "POREĐENJE TURA · ISTANBUL",
      heading: "Uporedite ture po Istanbulu.",
      lead: "Cijene i sadržaj tura koje licencirane kompanije objavljuju na svojim web-stranicama. Pogledajte šta je uključeno, jedno uz drugo.",
      noticeTitle: "Sažeto s web-stranice svake kompanije; nije Bosphorly ponuda.",
      noticeBody: "Cijene i sadržaj mogu se mijenjati ovisno o datumu, dobi i paketu. Kompanija potvrđuje konačnu cijenu i dostupnost kada prihvati vaš upit. Plaća se samo gotovinom na recepciji hotela; turističke kompanije za plaćanje karticom naplaćuju dodatnih 10%.",
      query: "Pretražite ture ili kompanije…",
      per: "po osobi",
      from: "Od",
      was: "prije",
      request: "Pošaljite upit na Bosphorly →",
      soon: "Ugovor s kompanijom u pripremi",
      checked: "Provjereno",
      none: "Nema odgovarajućih tura.",
      notListed: "Cijena na upit",
      records: "tura",
      included: "Uključeno",
      excluded: "Nije uključeno",
      more: "Svi detalji",
      schedule: "Termini",
      meeting: "Mjesto sastanka",
      guide: "Vodič",
      pickup: "Transfer",
      cancel: "Otkazivanje",
      notes: "Dobro je znati",
      source: "Izvor: web-stranica kompanije",
      noDetails: "Na web-stranici kompanije nije pronađen detaljan sadržaj.",
      englishOnly: "",
      cats: {"cruise": "Krstarenje Bosporom", "dinner": "Krstarenje s večerom", "city": "Razgledavanje grada", "day": "Jednodnevni izlet", "islands": "Otoci", "hammam": "Hamam", "transfer": "Transfer", "multi": "Višednevna tura"},
      account: "Moj račun",
      allCompanies: "Sve kompanije",
      allCurrencies: "Sve valute",
      massageTitle: "Vrste masaža i cijene",
      min: "min",
      loadFail: "Katalog cijena nije bilo moguće učitati."
    },
    zh: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "土耳其浴套餐",
      hbMassages: "按摩",
      hbBook: "预订土耳其浴或按摩 →",
      hbHours: "每日 09:30–23:00 营业 · 法蒂赫和贝伊奥卢分店",
      home: "首页",
      plan: "申请",
      map: "地图",
      eyebrow: "游览比较 · 伊斯坦布尔",
      heading: "比较伊斯坦布尔游览项目。",
      lead: "持证公司在其官方网站上公布的价格和行程内容。并排查看各项目包含什么。",
      noticeTitle: "摘自各公司官方网站；并非 Bosphorly 的报价。",
      noticeBody: "价格和内容可能因日期、年龄和套餐而变化。公司在接受你的申请时确认最终价格和是否可订。仅限在酒店前台以现金支付；游览公司对信用卡付款额外收取 10%。",
      query: "搜索游览项目或公司…",
      per: "每人",
      from: "起价",
      was: "原价",
      request: "在 Bosphorly 申请 →",
      soon: "公司协议待签",
      checked: "核对于",
      none: "没有匹配的游览项目。",
      notListed: "价格请咨询",
      records: "个项目",
      included: "包含",
      excluded: "不包含",
      more: "全部详情",
      schedule: "时间",
      meeting: "集合地点",
      guide: "导游",
      pickup: "接送",
      cancel: "取消政策",
      notes: "注意事项",
      source: "来源：公司官网",
      noDetails: "公司官网上未找到详细内容。",
      englishOnly: "",
      cats: {"cruise": "博斯普鲁斯游船", "dinner": "晚餐游船", "city": "城市游览", "day": "一日游", "islands": "王子群岛", "hammam": "土耳其浴", "transfer": "接送", "multi": "多日游"},
      account: "我的账户",
      allCompanies: "全部公司",
      allCurrencies: "全部货币",
      massageTitle: "按摩类型与价格",
      min: "分钟",
      loadFail: "无法加载价格目录。"
    },
    ja: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "ハマムのパッケージ",
      hbMassages: "マッサージ",
      hbBook: "ハマム・マッサージを予約 →",
      hbHours: "毎日 09:30–23:00 営業 · ファーティフ店とベイオール店",
      home: "ホーム",
      plan: "リクエスト",
      map: "地図",
      eyebrow: "ツアー比較 · イスタンブール",
      heading: "イスタンブールのツアーを比較。",
      lead: "認可を受けた各社が自社サイトで公表している料金とツアー内容。含まれるものを並べて確認できます。",
      noticeTitle: "各社の公式サイトから要約したもので、Bosphorly の提供価格ではありません。",
      noticeBody: "料金と内容は日付、年齢、パッケージによって変わることがあります。最終料金と空き状況は、会社がリクエストを受けた時点で確認します。お支払いはホテルのフロントで現金のみ。ツアー会社はクレジットカード払いに 10% を上乗せします。",
      query: "ツアーや会社を検索…",
      per: "1 名あたり",
      from: "最低料金",
      was: "通常",
      request: "Bosphorly でリクエスト →",
      soon: "会社との契約準備中",
      checked: "確認日",
      none: "該当するツアーはありません。",
      notListed: "料金は要問い合わせ",
      records: "件のツアー",
      included: "含まれるもの",
      excluded: "含まれないもの",
      more: "詳細を見る",
      schedule: "時間",
      meeting: "集合場所",
      guide: "ガイド",
      pickup: "送迎",
      cancel: "キャンセル",
      notes: "知っておきたいこと",
      source: "出典：各社の公式サイト",
      noDetails: "会社のサイトに詳しい内容は見つかりませんでした。",
      englishOnly: "",
      cats: {"cruise": "ボスポラスクルーズ", "dinner": "ディナークルーズ", "city": "市内観光", "day": "日帰りツアー", "islands": "島めぐり", "hammam": "ハマム", "transfer": "送迎", "multi": "複数日ツアー"},
      account: "マイアカウント",
      allCompanies: "すべての会社",
      allCurrencies: "すべての通貨",
      massageTitle: "マッサージの種類と料金",
      min: "分",
      loadFail: "料金カタログを読み込めませんでした。"
    },
    ko: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "하맘 패키지",
      hbMassages: "마사지",
      hbBook: "하맘·마사지 예약 →",
      hbHours: "매일 09:30–23:00 영업 · 파티흐점, 베이오울루점",
      home: "홈",
      plan: "요청",
      map: "지도",
      eyebrow: "투어 비교 · 이스탄불",
      heading: "이스탄불 투어를 비교하세요.",
      lead: "허가받은 업체가 자사 웹사이트에 공개한 가격과 투어 내용입니다. 포함 사항을 나란히 비교해 보세요.",
      noticeTitle: "각 업체 공식 웹사이트를 요약한 것으로, Bosphorly의 제안 가격이 아닙니다.",
      noticeBody: "가격과 내용은 날짜, 나이, 패키지에 따라 달라질 수 있습니다. 최종 요금과 예약 가능 여부는 업체가 요청을 수락할 때 확인합니다. 결제는 호텔 리셉션에서 현금만 가능하며, 투어 업체는 신용카드 결제 시 10%를 추가합니다.",
      query: "투어 또는 업체 검색…",
      per: "1인당",
      from: "최저",
      was: "정가",
      request: "Bosphorly에서 요청 →",
      soon: "업체 계약 대기 중",
      checked: "확인일",
      none: "일치하는 투어가 없습니다.",
      notListed: "가격 문의",
      records: "개 투어",
      included: "포함",
      excluded: "불포함",
      more: "자세히 보기",
      schedule: "시간",
      meeting: "집합 장소",
      guide: "가이드",
      pickup: "픽업",
      cancel: "취소",
      notes: "알아두면 좋은 점",
      source: "출처: 업체 웹사이트",
      noDetails: "업체 웹사이트에서 자세한 내용을 찾지 못했습니다.",
      englishOnly: "",
      cats: {"cruise": "보스포루스 크루즈", "dinner": "디너 크루즈", "city": "시내 투어", "day": "당일 여행", "islands": "섬 투어", "hammam": "하맘", "transfer": "픽업", "multi": "다일 투어"},
      account: "내 계정",
      allCompanies: "모든 업체",
      allCurrencies: "모든 통화",
      massageTitle: "마사지 종류와 가격",
      min: "분",
      loadFail: "가격 카탈로그를 불러올 수 없습니다."
    },
    hi: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "हमाम पैकेज",
      hbMassages: "मसाज",
      hbBook: "हमाम या मसाज बुक करें →",
      hbHours: "रोज़ 09:30–23:00 खुला · फ़ातिह और बेयोग्लू शाखाएँ",
      home: "होम",
      plan: "अनुरोध",
      map: "नक्शा",
      eyebrow: "टूर तुलना · इस्तांबुल",
      heading: "इस्तांबुल के टूर की तुलना करें।",
      lead: "लाइसेंस प्राप्त कंपनियों द्वारा अपनी वेबसाइटों पर प्रकाशित कीमतें और टूर विवरण। देखें किसमें क्या शामिल है, साथ-साथ।",
      noticeTitle: "हर कंपनी की अपनी वेबसाइट से सारांश; यह Bosphorly का ऑफ़र नहीं है।",
      noticeBody: "कीमतें और विवरण तारीख, उम्र और पैकेज के हिसाब से बदल सकते हैं। अंतिम कीमत और उपलब्धता कंपनी आपका अनुरोध स्वीकार करते समय पक्की करती है। भुगतान केवल होटल रिसेप्शन पर नकद; टूर कंपनियाँ क्रेडिट कार्ड भुगतान पर 10% अतिरिक्त लेती हैं।",
      query: "टूर या कंपनी खोजें…",
      per: "प्रति व्यक्ति",
      from: "शुरुआती कीमत",
      was: "पहले",
      request: "Bosphorly पर अनुरोध करें →",
      soon: "कंपनी से समझौता बाकी",
      checked: "जाँचा गया",
      none: "कोई मेल खाता टूर नहीं।",
      notListed: "कीमत पूछें",
      records: "टूर",
      included: "शामिल",
      excluded: "शामिल नहीं",
      more: "सारा विवरण",
      schedule: "समय",
      meeting: "मिलने की जगह",
      guide: "गाइड",
      pickup: "ट्रांसफ़र",
      cancel: "रद्द करना",
      notes: "जानने लायक",
      source: "स्रोत: कंपनी की वेबसाइट",
      noDetails: "कंपनी की वेबसाइट पर विस्तृत विवरण नहीं मिला।",
      englishOnly: "",
      cats: {"cruise": "बॉस्फ़ोरस क्रूज़", "dinner": "डिनर क्रूज़", "city": "शहर का टूर", "day": "एक दिन की यात्रा", "islands": "द्वीप", "hammam": "हमाम", "transfer": "ट्रांसफ़र", "multi": "कई दिन का टूर"},
      account: "मेरा खाता",
      allCompanies: "सभी कंपनियाँ",
      allCurrencies: "सभी मुद्राएँ",
      massageTitle: "मसाज के प्रकार और कीमतें",
      min: "मिनट",
      loadFail: "कीमतों की सूची लोड नहीं हो सकी।"
    },
    bn: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "হামাম প্যাকেজ",
      hbMassages: "ম্যাসাজ",
      hbBook: "হামাম বা ম্যাসাজ বুক করুন →",
      hbHours: "প্রতিদিন 09:30–23:00 খোলা · ফাতিহ ও বেয়োলু শাখা",
      home: "হোম",
      plan: "অনুরোধ",
      map: "মানচিত্র",
      eyebrow: "ট্যুর তুলনা · ইস্তাম্বুল",
      heading: "ইস্তাম্বুলের ট্যুর তুলনা করুন।",
      lead: "লাইসেন্সপ্রাপ্ত কোম্পানিগুলোর নিজস্ব ওয়েবসাইটে প্রকাশিত দাম ও ট্যুরের বিবরণ। কোনটিতে কী আছে, পাশাপাশি দেখুন।",
      noticeTitle: "প্রতিটি কোম্পানির নিজস্ব ওয়েবসাইট থেকে সংক্ষেপিত; এটি Bosphorly-র অফার নয়।",
      noticeBody: "দাম ও বিবরণ তারিখ, বয়স ও প্যাকেজ অনুযায়ী বদলাতে পারে। চূড়ান্ত দাম ও প্রাপ্যতা কোম্পানি আপনার অনুরোধ গ্রহণের সময় নিশ্চিত করে। পেমেন্ট শুধু হোটেল রিসেপশনে নগদে; ট্যুর কোম্পানি ক্রেডিট কার্ডে পেমেন্টে অতিরিক্ত ১০% নেয়।",
      query: "ট্যুর বা কোম্পানি খুঁজুন…",
      per: "জনপ্রতি",
      from: "শুরুর দাম",
      was: "আগে",
      request: "Bosphorly-তে অনুরোধ করুন →",
      soon: "কোম্পানির সঙ্গে চুক্তি বাকি",
      checked: "যাচাই করা",
      none: "মিলে যায় এমন কোনো ট্যুর নেই।",
      notListed: "দাম জিজ্ঞেস করুন",
      records: "টি ট্যুর",
      included: "অন্তর্ভুক্ত",
      excluded: "অন্তর্ভুক্ত নয়",
      more: "সব বিবরণ",
      schedule: "সময়",
      meeting: "মিলনস্থল",
      guide: "গাইড",
      pickup: "ট্রান্সফার",
      cancel: "বাতিল",
      notes: "জেনে রাখুন",
      source: "উৎস: কোম্পানির ওয়েবসাইট",
      noDetails: "কোম্পানির ওয়েবসাইটে বিস্তারিত বিবরণ পাওয়া যায়নি।",
      englishOnly: "",
      cats: {"cruise": "বসফরাস ক্রুজ", "dinner": "ডিনার ক্রুজ", "city": "শহর ভ্রমণ", "day": "দিনব্যাপী ভ্রমণ", "islands": "দ্বীপ", "hammam": "হামাম", "transfer": "ট্রান্সফার", "multi": "বহুদিনের ট্যুর"},
      account: "আমার অ্যাকাউন্ট",
      allCompanies: "সব কোম্পানি",
      allCurrencies: "সব মুদ্রা",
      massageTitle: "ম্যাসাজের ধরন ও দাম",
      min: "মিনিট",
      loadFail: "দামের তালিকা লোড করা যায়নি।"
    },
    id: {
      hbTitle: "Alaturka Hamam & Spa",
      hbPackages: "Paket hamam",
      hbMassages: "Pijat",
      hbBook: "Pesan hamam atau pijat →",
      hbHours: "Buka setiap hari 09:30–23:00 · Cabang Fatih dan Beyoğlu",
      home: "Beranda",
      plan: "Ajukan",
      map: "Peta",
      eyebrow: "PERBANDINGAN TUR · ISTANBUL",
      heading: "Bandingkan tur di Istanbul.",
      lead: "Harga dan isi tur yang diumumkan perusahaan berizin di situs mereka sendiri. Lihat apa saja yang termasuk, berdampingan.",
      noticeTitle: "Diringkas dari situs resmi tiap perusahaan; bukan penawaran Bosphorly.",
      noticeBody: "Harga dan isi dapat berubah menurut tanggal, usia, dan paket. Perusahaan mengonfirmasi harga akhir dan ketersediaan saat menerima permintaan Anda. Pembayaran hanya tunai di resepsionis hotel; perusahaan tur mengenakan tambahan 10% untuk pembayaran kartu kredit.",
      query: "Cari tur atau perusahaan…",
      per: "per orang",
      from: "Mulai",
      was: "sebelumnya",
      request: "Ajukan di Bosphorly →",
      soon: "Perjanjian dengan perusahaan menunggu",
      checked: "Dicek",
      none: "Tidak ada tur yang cocok.",
      notListed: "Tanyakan harga",
      records: "tur",
      included: "Termasuk",
      excluded: "Tidak termasuk",
      more: "Semua detail",
      schedule: "Waktu",
      meeting: "Titik temu",
      guide: "Pemandu",
      pickup: "Penjemputan",
      cancel: "Pembatalan",
      notes: "Perlu diketahui",
      source: "Sumber: situs perusahaan",
      noDetails: "Tidak ditemukan isi terperinci di situs perusahaan.",
      englishOnly: "",
      cats: {"cruise": "Pelayaran Bosporus", "dinner": "Pelayaran makan malam", "city": "Tur kota", "day": "Wisata sehari", "islands": "Pulau", "hammam": "Hamam", "transfer": "Penjemputan", "multi": "Tur beberapa hari"},
      account: "Akun saya",
      allCompanies: "Semua perusahaan",
      allCurrencies: "Semua mata uang",
      massageTitle: "Jenis pijat dan harga",
      min: "menit",
      loadFail: "Katalog harga tidak dapat dimuat."
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
