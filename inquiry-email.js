// Intercept Bosphorly inquiries, including links rendered after page load, and prefill recipient/subject/body for Gmail or default email app.
(() => {
  const UI = {
    en: { title: 'Where would you like to open your draft?', to: 'To', subject: 'Subject', app: 'Default email app', copy: 'Copy draft text', copied: 'Draft copied ✓', close: 'Close' },
    tr: { title: 'Taslağı nerede açmak istersiniz?', to: 'Alıcı', subject: 'Konu', app: 'Varsayılan e-posta uygulaması', copy: 'Taslak metnini kopyala', copied: 'Taslak kopyalandı ✓', close: 'Kapat' },
    ru: { title: 'Где открыть черновик письма?', to: 'Кому', subject: 'Тема', app: 'Почтовое приложение', copy: 'Скопировать текст', copied: 'Скопировано ✓', close: 'Закрыть' },
    uk: { title: 'Де відкрити чернетку листа?', to: 'Кому', subject: 'Тема', app: 'Поштовий додаток', copy: 'Скопіювати текст', copied: 'Скопійовано ✓', close: 'Закрити' },
    de: { title: 'Wo möchten Sie den Entwurf öffnen?', to: 'An', subject: 'Betreff', app: 'Standard-Mail-App', copy: 'Entwurf kopieren', copied: 'Kopiert ✓', close: 'Schließen' },
    fr: { title: 'Où ouvrir votre brouillon ?', to: 'À', subject: 'Objet', app: 'Application e-mail', copy: 'Copier le texte', copied: 'Copié ✓', close: 'Fermer' },
    nl: { title: 'Waar wilt u het concept openen?', to: 'Aan', subject: 'Onderwerp', app: 'Standaard e-mailapp', copy: 'Tekst kopiëren', copied: 'Gekopieerd ✓', close: 'Sluiten' },
    ar: { title: 'أين تود فتح مسودة الرسالة؟', to: 'إلى', subject: 'الموضوع', app: 'تطبيق البريد الافتراضي', copy: 'نسخ نص المسودة', copied: 'تم النسخ ✓', close: 'إغلاق' },
    he: { title: 'איפה לפתוח את טיוטת המייל?', to: 'אל', subject: 'נושא', app: 'אפליקציית דוא״ל', copy: 'העתקת הטקסט', copied: 'הועתק ✓', close: 'סגור' },
    az: { title: 'Qaralamanı harada açmaq istəyirsiniz?', to: 'Kimə', subject: 'Mövzu', app: 'Standart e-poçt tətbiqi', copy: 'Mətni kopyala', copied: 'Kopyalandı ✓', close: 'Bağla' },
    fa: { title: 'پیش‌نویس را کجا باز کنیم؟', to: 'به', subject: 'موضوع', app: 'برنامه ایمیل پیش‌فرض', copy: 'کپی متن پیام', copied: 'کپی شد ✓', close: 'بستن' },
    es: { title: '¿Dónde desea abrir su borrador?', to: 'Para', subject: 'Asunto', app: 'Aplicación de correo', copy: 'Copiar borrador', copied: 'Copiado ✓', close: 'Cerrar' },
    it: { title: 'Dove vuoi aprire la bozza?', to: 'A', subject: 'Oggetto', app: 'App email predefinita', copy: 'Copia bozza', copied: 'Copiato ✓', close: 'Chiudi' },
    pt: { title: 'Onde deseja abrir o rascunho?', to: 'Para', subject: 'Assunto', app: 'App de e-mail padrão', copy: 'Copiar rascunho', copied: 'Copiado ✓', close: 'Fechar' },
    hr: { title: 'Gdje želite otvoriti skicu?', to: 'Za', subject: 'Predmet', app: 'Zadana aplikacija e-pošte', copy: 'Kopiraj tekst', copied: 'Kopirano ✓', close: 'Zatvori' },
    hu: { title: 'Hol nyissuk meg a piszkozatot?', to: 'Címzett', subject: 'Tárgy', app: 'Alapértelmezett levelező', copy: 'Szöveg másolása', copied: 'Másolva ✓', close: 'Bezárás' },
    bs: { title: 'Gdje želite otvoriti nacrt?', to: 'Za', subject: 'Predmet', app: 'Zadana aplikacija e-pošte', copy: 'Kopiraj tekst', copied: 'Kopirano ✓', close: 'Zatvori' },
    zh: { title: '要在哪里打开邮件草稿？', to: '收件人', subject: '主题', app: '默认邮件应用', copy: '复制草稿内容', copied: '已复制 ✓', close: '关闭' },
    ja: { title: '下書きをどこで開きますか？', to: '宛先', subject: '件名', app: '既定のメールアプリ', copy: '本文をコピー', copied: 'コピーしました ✓', close: '閉じる' },
    ko: { title: '초안을 어디서 여시겠습니까?', to: '받는 사람', subject: '제목', app: '기본 이메일 앱', copy: '초안 복사', copied: '복사됨 ✓', close: '닫기' },
    hi: { title: 'ड्राफ़्ट कहाँ खोलना चाहेंगे?', to: 'प्राप्तकर्ता', subject: 'विषय', app: 'डिफ़ॉल्ट ईमेल ऐप', copy: 'ड्राफ़्ट कॉपी करें', copied: 'कॉपी हो गया ✓', close: 'बंद करें' },
    bn: { title: 'ড্রাফট কোথায় খুলতে চান?', to: 'প্রাপক', subject: 'বিষয়', app: 'ডিফল্ট ইমেইল অ্যাপ', copy: 'ড্রাফট কপি করুন', copied: 'কপি হয়েছে ✓', close: 'বন্ধ' },
    id: { title: 'Di mana Anda ingin membuka draf?', to: 'Kepada', subject: 'Subjek', app: 'Aplikasi email bawaan', copy: 'Salin teks draf', copied: 'Disalin ✓', close: 'Tutup' }
  };

  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('a[href^="mailto:" i]');
    if (!trigger || trigger.closest('.email-picker') || event.defaultPrevented) return;
    const draft = new URL(trigger.href);
    const contactEmail = ((window.BOSPHORLY_CONTACT && window.BOSPHORLY_CONTACT.email) || 'info@bosphorly.com').toLowerCase();
    const toAddr = draft.pathname.toLowerCase();
    if (toAddr !== 'info@bosphorly.com' && toAddr !== contactEmail) return;
    event.preventDefault();

    const code = (window.BosphorlyLang ? window.BosphorlyLang.pick() : (document.documentElement.lang || 'en').slice(0, 2));
    const u = UI[code] || UI.en;
    const subject = draft.searchParams.get('subject') || '';
    const body = draft.searchParams.get('body') || '';

    const dialog = document.createElement('dialog');
    dialog.className = 'email-picker';
    if (window.BosphorlyLang && window.BosphorlyLang.rtl(code)) dialog.dir = 'rtl';
    dialog.setAttribute('aria-labelledby', 'email-picker-title');

    const title = document.createElement('h2');
    title.id = 'email-picker-title';
    title.textContent = u.title;

    const meta = document.createElement('div');
    meta.className = 'ep-meta';
    const rowTo = document.createElement('div');
    const bTo = document.createElement('b'); bTo.textContent = u.to + ': ';
    rowTo.append(bTo, toAddr);
    meta.append(rowTo);
    if (subject) {
      const rowSu = document.createElement('div');
      const bSu = document.createElement('b'); bSu.textContent = u.subject + ': ';
      rowSu.append(bSu, subject);
      meta.append(rowSu);
    }

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'ep-close';
    close.textContent = '×';
    close.setAttribute('aria-label', u.close);
    close.onclick = () => dialog.close();

    const gmail = document.createElement('a');
    const url = new URL('https://mail.google.com/mail/');
    url.search = new URLSearchParams({ view: 'cm', fs: '1', to: toAddr, su: subject, body });
    gmail.href = url.href;
    gmail.target = '_blank';
    gmail.rel = 'noopener noreferrer';
    gmail.textContent = 'Gmail';

    const app = document.createElement('a');
    app.href = draft.href;
    app.textContent = u.app;

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'ep-copy';
    copyBtn.textContent = u.copy;
    copyBtn.onclick = async () => {
      const full = `${u.to}: ${toAddr}\n${subject ? u.subject + ': ' + subject + '\n\n' : ''}${body}`;
      try { await navigator.clipboard.writeText(full); } catch {}
      copyBtn.textContent = u.copied;
      setTimeout(() => { copyBtn.textContent = u.copy; }, 1800);
    };

    for (const link of [gmail, app]) link.addEventListener('click', () => setTimeout(() => dialog.close(), 0));
    dialog.append(title, meta, gmail, app, copyBtn, close);
    dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    gmail.focus();
  });
})();
