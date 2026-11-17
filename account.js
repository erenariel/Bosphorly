'use strict';
/* My account: profile and request history from this device (account-store.js). */
(() => {
  const $ = id => document.getElementById(id);
  const lang = window.BosphorlyLang ? window.BosphorlyLang.pick() : 'en';
  const tr = lang === 'tr';
  document.documentElement.lang = lang;
  const D = {
    tr: {
    navHome: 'Ana sayfa', navCompare: 'Tur karşılaştır', navAccount: 'Hesabım', eyebrow: 'BOSPHORLY HESABIM', heading: 'Hesabım',
    lead: 'Bilgilerin ve Bosphorly üzerinden gönderdiğin talepler.',
    deviceNote: 'Yalnızca bu cihazda saklanır. Bosphorly’yi başka bir telefon veya bilgisayarda açarsan bu talepler şimdilik görünmez.',
    reqTitle: 'Taleplerim', tabUpcoming: 'Yaklaşan', tabPast: 'Geçmiş', profileTitle: 'Bilgilerim', lName: 'Ad soyad', lPhone: 'Cep telefonu / WhatsApp',
    lEmail: 'E-posta (isteğe bağlı)', lHotel: 'Otel', lRoom: 'Oda numarası', saveBtn: 'Kaydet', clearBtn: 'Bu cihazdaki her şeyi sil',
    profileNote: 'Kayıtlı bilgilerin talep formlarına otomatik doldurulur.', footer: 'Bosphorly · Prototip · Bu sayfadaki hiçbir bilgi sunucuya gönderilmez.',
    msgSaved: 'Kaydedildi.', confirmClear: 'Bu cihazdaki profilin ve tüm talep geçmişin silinsin mi?', cleared: 'Silindi.',
    emptyUpcoming: 'Yaklaşan talebin yok.', emptyPast: 'Geçmiş talebin yok.', browse: 'Turları keşfet →',
    status: 'WhatsApp’a gönderildi · onay bekleniyor', reopen: 'WhatsApp’ta tekrar aç', remove: 'Listeden kaldır', guests: 'kişi', transfer: 'Havalimanı transferi'
    },
    en: {
    navHome: 'Home', navCompare: 'Compare tours', navAccount: 'My account', eyebrow: 'MY BOSPHORLY', heading: 'My account',
    lead: 'Your details and the requests you sent through Bosphorly.',
    deviceNote: 'Saved on this device only. Opening Bosphorly on another phone or computer will not show these requests yet.',
    reqTitle: 'My requests', tabUpcoming: 'Upcoming', tabPast: 'Past', profileTitle: 'My details', lName: 'Full name', lPhone: 'Mobile / WhatsApp',
    lEmail: 'Email (optional)', lHotel: 'Hotel', lRoom: 'Room number', saveBtn: 'Save', clearBtn: 'Delete everything on this device',
    profileNote: 'Saved details fill in the request forms for you.', footer: 'Bosphorly · Prototype · Nothing on this page is sent to a server.',
    msgSaved: 'Saved.', confirmClear: 'Delete your profile and all request history on this device?', cleared: 'Deleted.',
    emptyUpcoming: 'No upcoming requests.', emptyPast: 'No past requests.', browse: 'Explore tours →',
    status: 'Sent to WhatsApp · awaiting confirmation', reopen: 'Open in WhatsApp again', remove: 'Remove from list', guests: 'guests', transfer: 'Airport transfer'
    },
    ru: {
    navHome: 'Главная', navCompare: 'Сравнить туры', navAccount: 'Мой аккаунт', eyebrow: 'МОЙ BOSPHORLY', heading: 'Мой аккаунт',
    lead: 'Ваши данные и заявки, отправленные через Bosphorly.',
    deviceNote: 'Хранится только на этом устройстве. Если открыть Bosphorly на другом телефоне или компьютере, эти заявки пока не будут видны.',
    reqTitle: 'Мои заявки', tabUpcoming: 'Предстоящие', tabPast: 'Прошедшие', profileTitle: 'Мои данные', lName: 'Имя и фамилия', lPhone: 'Мобильный / WhatsApp',
    lEmail: 'Эл. почта (необязательно)', lHotel: 'Отель', lRoom: 'Номер комнаты', saveBtn: 'Сохранить', clearBtn: 'Удалить всё на этом устройстве',
    profileNote: 'Сохранённые данные подставляются в формы заявок.', footer: 'Bosphorly · Прототип · Данные этой страницы не отправляются на сервер.',
    msgSaved: 'Сохранено.', confirmClear: 'Удалить профиль и всю историю заявок на этом устройстве?', cleared: 'Удалено.',
    emptyUpcoming: 'Предстоящих заявок нет.', emptyPast: 'Прошедших заявок нет.', browse: 'Смотреть туры →',
    status: 'Отправлено в WhatsApp · ожидает подтверждения', reopen: 'Открыть в WhatsApp снова', remove: 'Убрать из списка', guests: 'гост.', transfer: 'Трансфер из аэропорта'
    },
    ar: {
    navHome: 'الرئيسية', navCompare: 'قارن الجولات', navAccount: 'حسابي', eyebrow: 'حسابي في BOSPHORLY', heading: 'حسابي',
    lead: 'بياناتك والطلبات التي أرسلتها عبر Bosphorly.',
    deviceNote: 'محفوظة على هذا الجهاز فقط. إذا فتحت Bosphorly على هاتف أو حاسوب آخر فلن تظهر هذه الطلبات حاليًا.',
    reqTitle: 'طلباتي', tabUpcoming: 'القادمة', tabPast: 'السابقة', profileTitle: 'بياناتي', lName: 'الاسم الكامل', lPhone: 'الجوال / واتساب',
    lEmail: 'البريد الإلكتروني (اختياري)', lHotel: 'الفندق', lRoom: 'رقم الغرفة', saveBtn: 'حفظ', clearBtn: 'احذف كل شيء على هذا الجهاز',
    profileNote: 'تُملأ نماذج الطلب تلقائيًا من بياناتك المحفوظة.', footer: 'Bosphorly · نموذج أولي · لا تُرسل أي معلومات من هذه الصفحة إلى خادم.',
    msgSaved: 'تم الحفظ.', confirmClear: 'هل تريد حذف ملفك وكل سجل الطلبات على هذا الجهاز؟', cleared: 'تم الحذف.',
    emptyUpcoming: 'لا توجد طلبات قادمة.', emptyPast: 'لا توجد طلبات سابقة.', browse: 'استكشف الجولات ←',
    status: 'أُرسل إلى واتساب · بانتظار التأكيد', reopen: 'افتح في واتساب مجددًا', remove: 'إزالة من القائمة', guests: 'ضيوف', transfer: 'النقل من المطار'
    },
    de: {
    navHome: 'Startseite', navCompare: 'Touren vergleichen', navAccount: 'Mein Konto', eyebrow: 'MEIN BOSPHORLY', heading: 'Mein Konto',
    lead: 'Ihre Angaben und die Anfragen, die Sie über Bosphorly gesendet haben.',
    deviceNote: 'Nur auf diesem Gerät gespeichert. Wenn Sie Bosphorly auf einem anderen Handy oder Computer öffnen, sind diese Anfragen dort noch nicht sichtbar.',
    reqTitle: 'Meine Anfragen', tabUpcoming: 'Bevorstehend', tabPast: 'Vergangen', profileTitle: 'Meine Angaben', lName: 'Vollständiger Name', lPhone: 'Mobil / WhatsApp',
    lEmail: 'E-Mail (optional)', lHotel: 'Hotel', lRoom: 'Zimmernummer', saveBtn: 'Speichern', clearBtn: 'Alles auf diesem Gerät löschen',
    profileNote: 'Gespeicherte Angaben füllen die Anfrageformulare für Sie aus.', footer: 'Bosphorly · Prototyp · Nichts auf dieser Seite wird an einen Server gesendet.',
    msgSaved: 'Gespeichert.', confirmClear: 'Profil und gesamten Anfrageverlauf auf diesem Gerät löschen?', cleared: 'Gelöscht.',
    emptyUpcoming: 'Keine bevorstehenden Anfragen.', emptyPast: 'Keine vergangenen Anfragen.', browse: 'Touren entdecken →',
    status: 'An WhatsApp gesendet · Bestätigung ausstehend', reopen: 'Erneut in WhatsApp öffnen', remove: 'Aus der Liste entfernen', guests: 'Gäste', transfer: 'Flughafentransfer'
    },
    it: {
      navHome: "Home",
      navCompare: "Confronta i tour",
      navAccount: "Il mio account",
      eyebrow: "IL MIO BOSPHORLY",
      heading: "Il mio account",
      lead: "I tuoi dati e le richieste che hai inviato tramite Bosphorly.",
      deviceNote: "Salvato solo su questo dispositivo. Se apri Bosphorly su un altro telefono o computer, per ora queste richieste non saranno visibili.",
      reqTitle: "Le mie richieste",
      tabUpcoming: "In programma",
      tabPast: "Passate",
      profileTitle: "I miei dati",
      lName: "Nome e cognome",
      lPhone: "Cellulare / WhatsApp",
      lEmail: "E-mail (facoltativa)",
      lHotel: "Hotel",
      lRoom: "Numero di camera",
      saveBtn: "Salva",
      clearBtn: "Elimina tutto da questo dispositivo",
      profileNote: "I dati salvati compilano per te i moduli di richiesta.",
      footer: "Bosphorly · Prototipo · Nulla di questa pagina viene inviato a un server.",
      msgSaved: "Salvato.",
      confirmClear: "Eliminare il profilo e tutta la cronologia delle richieste da questo dispositivo?",
      cleared: "Eliminato.",
      emptyUpcoming: "Nessuna richiesta in programma.",
      emptyPast: "Nessuna richiesta passata.",
      browse: "Scopri i tour →",
      status: "Inviata su WhatsApp · in attesa di conferma",
      reopen: "Riapri su WhatsApp",
      remove: "Rimuovi dall’elenco",
      guests: "persone",
      transfer: "Transfer aeroportuale"
    },
    pt: {
      navHome: "Início",
      navCompare: "Comparar passeios",
      navAccount: "Minha conta",
      eyebrow: "MINHA BOSPHORLY",
      heading: "Minha conta",
      lead: "Seus dados e os pedidos que você enviou pela Bosphorly.",
      deviceNote: "Salvo só neste aparelho. Se você abrir a Bosphorly em outro celular ou computador, esses pedidos ainda não aparecem lá.",
      reqTitle: "Meus pedidos",
      tabUpcoming: "Próximos",
      tabPast: "Anteriores",
      profileTitle: "Meus dados",
      lName: "Nome completo",
      lPhone: "Celular / WhatsApp",
      lEmail: "E-mail (opcional)",
      lHotel: "Hotel",
      lRoom: "Número do quarto",
      saveBtn: "Salvar",
      clearBtn: "Apagar tudo neste aparelho",
      profileNote: "Os dados salvos preenchem os formulários de pedido para você.",
      footer: "Bosphorly · Protótipo · Nada desta página é enviado a um servidor.",
      msgSaved: "Salvo.",
      confirmClear: "Apagar seu perfil e todo o histórico de pedidos neste aparelho?",
      cleared: "Apagado.",
      emptyUpcoming: "Nenhum pedido próximo.",
      emptyPast: "Nenhum pedido anterior.",
      browse: "Ver passeios →",
      status: "Enviado pelo WhatsApp · aguardando confirmação",
      reopen: "Abrir de novo no WhatsApp",
      remove: "Remover da lista",
      guests: "pessoas",
      transfer: "Traslado do aeroporto"
    },
    fr: {
      navHome: "Accueil",
      navCompare: "Comparer les visites",
      navAccount: "Mon compte",
      eyebrow: "MON BOSPHORLY",
      heading: "Mon compte",
      lead: "Vos informations et les demandes envoyées via Bosphorly.",
      deviceNote: "Enregistré uniquement sur cet appareil. Si vous ouvrez Bosphorly sur un autre téléphone ou ordinateur, ces demandes n’y apparaîtront pas encore.",
      reqTitle: "Mes demandes",
      tabUpcoming: "À venir",
      tabPast: "Passées",
      profileTitle: "Mes informations",
      lName: "Nom complet",
      lPhone: "Mobile / WhatsApp",
      lEmail: "E-mail (facultatif)",
      lHotel: "Hôtel",
      lRoom: "Numéro de chambre",
      saveBtn: "Enregistrer",
      clearBtn: "Tout supprimer sur cet appareil",
      profileNote: "Vos informations enregistrées remplissent les formulaires de demande.",
      footer: "Bosphorly · Prototype · Rien sur cette page n’est envoyé à un serveur.",
      msgSaved: "Enregistré.",
      confirmClear: "Supprimer votre profil et tout l’historique des demandes sur cet appareil ?",
      cleared: "Supprimé.",
      emptyUpcoming: "Aucune demande à venir.",
      emptyPast: "Aucune demande passée.",
      browse: "Découvrir les visites →",
      status: "Envoyée sur WhatsApp · en attente de confirmation",
      reopen: "Rouvrir dans WhatsApp",
      remove: "Retirer de la liste",
      guests: "pers.",
      transfer: "Transfert aéroport"
    },
    es: {
      navHome: "Inicio",
      navCompare: "Comparar tours",
      navAccount: "Mi cuenta",
      eyebrow: "MI BOSPHORLY",
      heading: "Mi cuenta",
      lead: "Tus datos y las solicitudes que enviaste a través de Bosphorly.",
      deviceNote: "Guardado solo en este dispositivo. Si abres Bosphorly en otro móvil u ordenador, estas solicitudes aún no aparecerán allí.",
      reqTitle: "Mis solicitudes",
      tabUpcoming: "Próximas",
      tabPast: "Pasadas",
      profileTitle: "Mis datos",
      lName: "Nombre completo",
      lPhone: "Móvil / WhatsApp",
      lEmail: "Correo electrónico (opcional)",
      lHotel: "Hotel",
      lRoom: "Número de habitación",
      saveBtn: "Guardar",
      clearBtn: "Borrar todo en este dispositivo",
      profileNote: "Tus datos guardados rellenan los formularios de solicitud.",
      footer: "Bosphorly · Prototipo · Nada de esta página se envía a un servidor.",
      msgSaved: "Guardado.",
      confirmClear: "¿Borrar tu perfil y todo el historial de solicitudes en este dispositivo?",
      cleared: "Borrado.",
      emptyUpcoming: "No hay solicitudes próximas.",
      emptyPast: "No hay solicitudes pasadas.",
      browse: "Descubrir tours →",
      status: "Enviada por WhatsApp · pendiente de confirmación",
      reopen: "Abrir de nuevo en WhatsApp",
      remove: "Quitar de la lista",
      guests: "personas",
      transfer: "Traslado del aeropuerto"
    },
    uk: {
      navHome: "Головна",
      navCompare: "Порівняти тури",
      navAccount: "Мій акаунт",
      eyebrow: "МІЙ BOSPHORLY",
      heading: "Мій акаунт",
      lead: "Ваші дані та заявки, надіслані через Bosphorly.",
      deviceNote: "Зберігається лише на цьому пристрої. Якщо відкрити Bosphorly на іншому телефоні чи комп’ютері, ці заявки поки що не буде видно.",
      reqTitle: "Мої заявки",
      tabUpcoming: "Майбутні",
      tabPast: "Минулі",
      profileTitle: "Мої дані",
      lName: "Ім’я та прізвище",
      lPhone: "Мобільний / WhatsApp",
      lEmail: "Ел. пошта (необов’язково)",
      lHotel: "Готель",
      lRoom: "Номер кімнати",
      saveBtn: "Зберегти",
      clearBtn: "Видалити все на цьому пристрої",
      profileNote: "Збережені дані підставляються у форми заявок.",
      footer: "Bosphorly · Прототип · Дані цієї сторінки не надсилаються на сервер.",
      msgSaved: "Збережено.",
      confirmClear: "Видалити профіль і всю історію заявок на цьому пристрої?",
      cleared: "Видалено.",
      emptyUpcoming: "Майбутніх заявок немає.",
      emptyPast: "Минулих заявок немає.",
      browse: "Переглянути тури →",
      status: "Надіслано у WhatsApp · очікує підтвердження",
      reopen: "Знову відкрити у WhatsApp",
      remove: "Прибрати зі списку",
      guests: "гост.",
      transfer: "Трансфер з аеропорту"
    },
    nl: {
      navHome: "Home",
      navCompare: "Tours vergelijken",
      navAccount: "Mijn account",
      eyebrow: "MIJN BOSPHORLY",
      heading: "Mijn account",
      lead: "Je gegevens en de aanvragen die je via Bosphorly hebt verstuurd.",
      deviceNote: "Alleen op dit apparaat opgeslagen. Als je Bosphorly op een andere telefoon of computer opent, zie je deze aanvragen daar nog niet.",
      reqTitle: "Mijn aanvragen",
      tabUpcoming: "Komend",
      tabPast: "Eerder",
      profileTitle: "Mijn gegevens",
      lName: "Volledige naam",
      lPhone: "Mobiel / WhatsApp",
      lEmail: "E-mail (optioneel)",
      lHotel: "Hotel",
      lRoom: "Kamernummer",
      saveBtn: "Opslaan",
      clearBtn: "Alles op dit apparaat wissen",
      profileNote: "Opgeslagen gegevens vullen de aanvraagformulieren voor je in.",
      footer: "Bosphorly · Prototype · Niets op deze pagina wordt naar een server gestuurd.",
      msgSaved: "Opgeslagen.",
      confirmClear: "Je profiel en alle aanvraaggeschiedenis op dit apparaat wissen?",
      cleared: "Gewist.",
      emptyUpcoming: "Geen komende aanvragen.",
      emptyPast: "Geen eerdere aanvragen.",
      browse: "Tours bekijken →",
      status: "Verstuurd via WhatsApp · wacht op bevestiging",
      reopen: "Opnieuw openen in WhatsApp",
      remove: "Uit de lijst verwijderen",
      guests: "personen",
      transfer: "Luchthaventransfer"
    },
    az: {
      navHome: "Ana səhifə",
      navCompare: "Turları müqayisə et",
      navAccount: "Hesabım",
      eyebrow: "MƏNİM BOSPHORLY",
      heading: "Hesabım",
      lead: "Məlumatlarınız və Bosphorly ilə göndərdiyiniz sorğular.",
      deviceNote: "Yalnız bu cihazda saxlanılır. Bosphorly-ni başqa telefon və ya kompüterdə açsanız, bu sorğular hələlik orada görünməyəcək.",
      reqTitle: "Sorğularım",
      tabUpcoming: "Qarşıdakı",
      tabPast: "Keçmiş",
      profileTitle: "Məlumatlarım",
      lName: "Ad və soyad",
      lPhone: "Mobil / WhatsApp",
      lEmail: "E-poçt (istəyə bağlı)",
      lHotel: "Otel",
      lRoom: "Otaq nömrəsi",
      saveBtn: "Yadda saxla",
      clearBtn: "Bu cihazdakı hər şeyi sil",
      profileNote: "Saxlanılan məlumatlar sorğu formalarına avtomatik doldurulur.",
      footer: "Bosphorly · Prototip · Bu səhifədəki heç nə serverə göndərilmir.",
      msgSaved: "Yadda saxlanıldı.",
      confirmClear: "Bu cihazdakı profiliniz və bütün sorğu tarixçəsi silinsin?",
      cleared: "Silindi.",
      emptyUpcoming: "Qarşıdakı sorğu yoxdur.",
      emptyPast: "Keçmiş sorğu yoxdur.",
      browse: "Turları kəşf et →",
      status: "WhatsApp-a göndərildi · təsdiq gözlənilir",
      reopen: "WhatsApp-da yenidən aç",
      remove: "Siyahıdan çıxar",
      guests: "nəfər",
      transfer: "Hava limanı transferi"
    },
    he: {
      navHome: "דף הבית",
      navCompare: "השוואת סיורים",
      navAccount: "החשבון שלי",
      eyebrow: "ה-BOSPHORLY שלי",
      heading: "החשבון שלי",
      lead: "הפרטים שלכם והבקשות ששלחתם דרך Bosphorly.",
      deviceNote: "נשמר רק במכשיר הזה. אם תפתחו את Bosphorly בטלפון או במחשב אחר, הבקשות האלה עדיין לא יופיעו שם.",
      reqTitle: "הבקשות שלי",
      tabUpcoming: "קרובות",
      tabPast: "קודמות",
      profileTitle: "הפרטים שלי",
      lName: "שם מלא",
      lPhone: "נייד / WhatsApp",
      lEmail: "אימייל (לא חובה)",
      lHotel: "מלון",
      lRoom: "מספר חדר",
      saveBtn: "שמירה",
      clearBtn: "מחיקת הכול במכשיר הזה",
      profileNote: "הפרטים השמורים ממלאים עבורכם את טפסי הבקשה.",
      footer: "Bosphorly · אב-טיפוס · שום דבר בדף הזה לא נשלח לשרת.",
      msgSaved: "נשמר.",
      confirmClear: "למחוק את הפרופיל ואת כל היסטוריית הבקשות במכשיר הזה?",
      cleared: "נמחק.",
      emptyUpcoming: "אין בקשות קרובות.",
      emptyPast: "אין בקשות קודמות.",
      browse: "לגלות סיורים ←",
      status: "נשלח ב-WhatsApp · ממתין לאישור",
      reopen: "לפתוח שוב ב-WhatsApp",
      remove: "הסרה מהרשימה",
      guests: "אורחים",
      transfer: "העברה משדה התעופה"
    },
    fa: {
      navHome: "خانه",
      navCompare: "مقایسه تورها",
      navAccount: "حساب من",
      eyebrow: "BOSPHORLY من",
      heading: "حساب من",
      lead: "اطلاعات شما و درخواست‌هایی که از طریق Bosphorly فرستاده‌اید.",
      deviceNote: "فقط روی همین دستگاه ذخیره می‌شود. اگر Bosphorly را روی تلفن یا رایانه دیگری باز کنید، این درخواست‌ها فعلاً آنجا دیده نمی‌شوند.",
      reqTitle: "درخواست‌های من",
      tabUpcoming: "پیش رو",
      tabPast: "گذشته",
      profileTitle: "اطلاعات من",
      lName: "نام و نام خانوادگی",
      lPhone: "موبایل / واتس‌اپ",
      lEmail: "ایمیل (اختیاری)",
      lHotel: "هتل",
      lRoom: "شماره اتاق",
      saveBtn: "ذخیره",
      clearBtn: "پاک کردن همه‌چیز روی این دستگاه",
      profileNote: "اطلاعات ذخیره‌شده فرم‌های درخواست را برایتان پر می‌کند.",
      footer: "Bosphorly · نمونه اولیه · هیچ اطلاعاتی از این صفحه به سرور فرستاده نمی‌شود.",
      msgSaved: "ذخیره شد.",
      confirmClear: "پروفایل و همه سابقه درخواست‌ها روی این دستگاه پاک شود؟",
      cleared: "پاک شد.",
      emptyUpcoming: "درخواست پیش رویی ندارید.",
      emptyPast: "درخواست گذشته‌ای ندارید.",
      browse: "کشف تورها ←",
      status: "به واتس‌اپ فرستاده شد · در انتظار تأیید",
      reopen: "باز کردن دوباره در واتس‌اپ",
      remove: "حذف از فهرست",
      guests: "نفر",
      transfer: "ترانسفر فرودگاه"
    },
    hr: {
      navHome: "Početna",
      navCompare: "Usporedite ture",
      navAccount: "Moj račun",
      eyebrow: "MOJ BOSPHORLY",
      heading: "Moj račun",
      lead: "Vaši podaci i upiti koje ste poslali putem Bosphorlyja.",
      deviceNote: "Spremljeno samo na ovom uređaju. Ako Bosphorly otvorite na drugom mobitelu ili računalu, ti se upiti još neće prikazati.",
      reqTitle: "Moji upiti",
      tabUpcoming: "Nadolazeći",
      tabPast: "Prošli",
      profileTitle: "Moji podaci",
      lName: "Ime i prezime",
      lPhone: "Mobitel / WhatsApp",
      lEmail: "E-pošta (neobavezno)",
      lHotel: "Hotel",
      lRoom: "Broj sobe",
      saveBtn: "Spremi",
      clearBtn: "Izbriši sve s ovog uređaja",
      profileNote: "Spremljeni podaci automatski ispunjavaju obrasce za upit.",
      footer: "Bosphorly · Prototip · Ništa s ove stranice ne šalje se na poslužitelj.",
      msgSaved: "Spremljeno.",
      confirmClear: "Izbrisati profil i cijelu povijest upita s ovog uređaja?",
      cleared: "Izbrisano.",
      emptyUpcoming: "Nema nadolazećih upita.",
      emptyPast: "Nema prošlih upita.",
      browse: "Istražite ture →",
      status: "Poslano na WhatsApp · čeka potvrdu",
      reopen: "Ponovno otvori u WhatsAppu",
      remove: "Ukloni s popisa",
      guests: "osoba",
      transfer: "Transfer iz zračne luke"
    },
    hu: {
      navHome: "Főoldal",
      navCompare: "Túrák összehasonlítása",
      navAccount: "Fiókom",
      eyebrow: "AZ ÉN BOSPHORLYM",
      heading: "Fiókom",
      lead: "Az adatai és a Bosphorlyn keresztül küldött ajánlatkérései.",
      deviceNote: "Csak ezen az eszközön van mentve. Ha másik telefonon vagy számítógépen nyitja meg a Bosphorlyt, ezek az ajánlatkérések még nem jelennek meg.",
      reqTitle: "Ajánlatkéréseim",
      tabUpcoming: "Közelgő",
      tabPast: "Korábbi",
      profileTitle: "Adataim",
      lName: "Teljes név",
      lPhone: "Mobil / WhatsApp",
      lEmail: "E-mail (nem kötelező)",
      lHotel: "Szálloda",
      lRoom: "Szobaszám",
      saveBtn: "Mentés",
      clearBtn: "Minden törlése erről az eszközről",
      profileNote: "A mentett adatok automatikusan kitöltik az ajánlatkérő űrlapokat.",
      footer: "Bosphorly · Prototípus · Erről az oldalról semmi nem kerül szerverre.",
      msgSaved: "Mentve.",
      confirmClear: "Törli a profilját és az összes ajánlatkérés előzményét erről az eszközről?",
      cleared: "Törölve.",
      emptyUpcoming: "Nincs közelgő ajánlatkérés.",
      emptyPast: "Nincs korábbi ajánlatkérés.",
      browse: "Túrák felfedezése →",
      status: "Elküldve WhatsAppra · megerősítésre vár",
      reopen: "Megnyitás újra a WhatsAppban",
      remove: "Eltávolítás a listáról",
      guests: "fő",
      transfer: "Reptéri transzfer"
    },
    bs: {
      navHome: "Početna",
      navCompare: "Uporedite ture",
      navAccount: "Moj račun",
      eyebrow: "MOJ BOSPHORLY",
      heading: "Moj račun",
      lead: "Vaši podaci i upiti koje ste poslali putem Bosphorlyja.",
      deviceNote: "Spremljeno samo na ovom uređaju. Ako Bosphorly otvorite na drugom mobitelu ili računalu, ti se upiti još neće prikazati.",
      reqTitle: "Moji upiti",
      tabUpcoming: "Nadolazeći",
      tabPast: "Prošli",
      profileTitle: "Moji podaci",
      lName: "Ime i prezime",
      lPhone: "Mobitel / WhatsApp",
      lEmail: "E-mail (neobavezno)",
      lHotel: "Hotel",
      lRoom: "Broj sobe",
      saveBtn: "Spremi",
      clearBtn: "Izbriši sve s ovog uređaja",
      profileNote: "Spremljeni podaci automatski ispunjavaju obrasce za upit.",
      footer: "Bosphorly · Prototip · Ništa s ove stranice ne šalje se na server.",
      msgSaved: "Spremljeno.",
      confirmClear: "Izbrisati profil i cijelu historiju upita s ovog uređaja?",
      cleared: "Izbrisano.",
      emptyUpcoming: "Nema nadolazećih upita.",
      emptyPast: "Nema prošlih upita.",
      browse: "Istražite ture →",
      status: "Poslano na WhatsApp · čeka potvrdu",
      reopen: "Ponovo otvori u WhatsAppu",
      remove: "Ukloni s popisa",
      guests: "osoba",
      transfer: "Transfer s aerodroma"
    }
  };
  const T = D[lang] || D.en;
  if (D[lang] && window.BosphorlyLang.rtl(lang)) document.documentElement.dir = 'rtl';
  for (const [id, v] of Object.entries(T)) { const e = $(id); if (e) e.textContent = v; }
  const A = window.BosphorlyAccount;
  let tab = 'upcoming';
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const dateText = d => { try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00')); } catch { return d; } };

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function renderRequests() {
    const all = A.requests();
    const list = all.filter(r => (tab === 'upcoming') === (!r.date || r.date >= today));
    if (tab === 'past') list.reverse();
    const wrap = $('requests'); wrap.replaceChildren();
    if (!list.length) {
      const e = el('div', 'empty', tab === 'upcoming' ? T.emptyUpcoming : T.emptyPast);
      const a = el('a', null, T.browse); a.href = 'prices.html'; e.append(document.createElement('br'), a); wrap.append(e); return;
    }
    for (const r of list) {
      const card = el('article', 'req');
      const top = el('div', 'req-top');
      top.append(el('span', 'req-title', r.title || T.transfer), el('span', 'ref', r.ref));
      const meta = el('div', 'meta', [r.operator, r.date ? dateText(r.date) : null, r.time, r.guests ? r.guests + ' ' + T.guests : null].filter(Boolean).join(' · '));
      card.append(top, meta);
      if (r.total) card.append(el('div', 'meta', r.total));
      card.append(el('span', 'status', T.status));
      const actions = el('div', 'actions');
      if (r.waUrl) { const a = el('a', 'btn wa', T.reopen); a.href = r.waUrl; a.target = '_blank'; a.rel = 'noopener'; actions.append(a); }
      const del = el('button', 'btn ghost', T.remove); del.type = 'button';
      del.addEventListener('click', () => { A.removeRequest(r.ref); renderRequests(); });
      actions.append(del); card.append(actions); wrap.append(card);
    }
  }

  function setTab(t) {
    tab = t;
    $('tabUpcoming').setAttribute('aria-selected', String(t === 'upcoming'));
    $('tabPast').setAttribute('aria-selected', String(t === 'past'));
    renderRequests();
  }
  $('tabUpcoming').addEventListener('click', () => setTab('upcoming'));
  $('tabPast').addEventListener('click', () => setTab('past'));

  const p = A.profile() || {};
  $('pName').value = p.name || ''; $('pPhone').value = p.phone || ''; $('pEmail').value = p.email || ''; $('pHotel').value = p.hotel || ''; $('pRoom').value = p.room || '';
  $('profileForm').addEventListener('submit', e => {
    e.preventDefault();
    A.saveProfile({ name: $('pName').value, phone: $('pPhone').value, email: $('pEmail').value, hotel: $('pHotel').value, room: $('pRoom').value });
    $('saved').textContent = T.msgSaved;
  });
  $('clearBtn').addEventListener('click', () => {
    if (!confirm(T.confirmClear)) return;
    A.clear();
    ['pName', 'pPhone', 'pEmail', 'pHotel', 'pRoom'].forEach(id => { $(id).value = ''; });
    $('saved').textContent = T.cleared; renderRequests();
  });
  renderRequests();
})();
