(() => {
  if (window.__bosphorlyMimoIntroInit) return;
  window.__bosphorlyMimoIntroInit = true;
  const mobile = matchMedia('(max-width: 1023.98px)').matches;
  const eligible = matchMedia((mobile ? '(max-width: 1023.98px)' : '(min-width:1024px)') +
    ' and (prefers-reduced-motion:no-preference)');
  if (!eligible.matches) return;
  const welcome = {
    tr:'Hoş geldin, ben Mimo', en:'Welcome, I’m Mimo', ru:'Добро пожаловать, я Мимо',
    uk:'Вітаю, я Мімо', de:'Willkommen, ich bin Mimo', fr:'Bienvenue, moi c’est Mimo',
    nl:'Welkom, ik ben Mimo', ar:'أهلًا بك، أنا ميمو', he:'ברוכים הבאים, אני מימו',
    az:'Xoş gəlmisən, mən Mimoyam', fa:'خوش آمدید، من میمو هستم', es:'Bienvenido, soy Mimo',
    it:'Benvenuto, sono Mimo', pt:'Boas-vindas, sou Mimo', hr:'Dobro došli, ja sam Mimo',
    hu:'Üdvözöllek, Mimo vagyok', bs:'Dobro došli, ja sam Mimo', zh:'欢迎，我是 Mimo',
    ja:'ようこそ、ミモです', ko:'반가워요, 저는 미모예요', hi:'स्वागत है, मैं मीमो हूँ',
    bn:'স্বাগতম, আমি মিমো', id:'Selamat datang, aku Mimo'
  };
  // Look only in the corner around the FAB. If that area is busy, skip the
  // note instead of covering text, a control or an image.
  function placeCornerNote(note, launcher) {
    const box = note.getBoundingClientRect();
    const obstacles = [];
    const nearby = new Set();
    // Sample the note footprint and its vertical travel, then measure each hit once.
    for (const x of [box.left + 1, box.left + box.width / 2, box.right - 1]) {
      for (let y = box.top - 54; y <= box.bottom + 12; y += 8) {
        for (const el of document.elementsFromPoint(x, y)) nearby.add(el);
      }
    }
    const near = r => r.width && r.height && r.right > box.left && r.left < box.right &&
      r.bottom > box.top - 54 && r.top < box.bottom + 12;
    const range = document.createRange();
    for (const el of nearby) {
      if (launcher.contains(el) || el.closest('.bc-bubble')) continue;
      const rect = el.getBoundingClientRect();
      if (!near(rect)) continue;
      const paintedControl = el.matches('a, button, [role="button"]') &&
        getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)';
      if (paintedControl || el.matches('input, select, textarea, img, video, iframe, svg')) obstacles.push(rect);
      else for (const child of el.childNodes) {
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent.trim()) continue;
        range.selectNodeContents(child);
        obstacles.push(...Array.from(range.getClientRects()).filter(near));
      }
    }
    for (let offset = 0; offset <= 66; offset++) {
      const shift = offset <= 54 ? -offset : offset - 54;
      if (box.top + shift < 0 || box.bottom + shift > innerHeight) continue;
      if (!obstacles.some(r => r.bottom + 2 > box.top + shift && r.top - 2 < box.bottom + shift)) {
        note.style.transform = 'translateY(' + shift + 'px)';
        return true;
      }
    }
    return false;
  }
  let scrolled = window.scrollY !== 0;
  const noteScroll = () => { scrolled = true; };
  window.addEventListener('scroll', noteScroll, {once:true, passive:true});
  function start() {
    window.removeEventListener('scroll', noteScroll);
    const launcher = document.querySelector('.bc-launcher');
    if (!launcher || !eligible.matches || scrolled || window.scrollY || document.body.classList.contains('bc-chat-open')) return;
    try {
      if (sessionStorage.getItem('bosphorly.mimo_intro')) return;
      sessionStorage.setItem('bosphorly.mimo_intro','1');
    } catch { return; }
    const avatar = launcher.querySelector('img');
    if (mobile) {
      const note = document.createElement('span');
      note.className = 'bc-mobile-welcome';
      note.setAttribute('aria-live', 'polite');
      launcher.append(note);
      note.textContent = (welcome[launcher.lang] || welcome.en);
      if (!placeCornerNote(note, launcher)) note.hidden = true;
      avatar.classList.add('bc-mobile-hop');
      const events = new AbortController();
      const options = {signal:events.signal, capture:true};
      const timer = setTimeout(finish, 2450);
      function finish() {
        events.abort();
        clearTimeout(timer);
        avatar.classList.remove('bc-mobile-hop');
        note.remove();
        document.dispatchEvent(new Event('mimo:welcome-end'));
      }
      note.addEventListener('animationend', finish, options);
      window.addEventListener('click', finish, options);
      window.addEventListener('scroll', finish, options);
      window.addEventListener('keydown', e => { if (e.key === 'Escape') finish(); }, options);
      eligible.addEventListener('change', finish, options);
      return;
    }
    const target = avatar.getBoundingClientRect();
    const intro = document.createElement('div');
    intro.className = 'mimo-intro';
    intro.dir = launcher.dir;
    intro.lang = launcher.lang;
    intro.style.setProperty('--dock-x', (target.x + target.width/2 - innerWidth/2) + 'px');
    intro.style.setProperty('--dock-y', (target.y + target.height/2 - innerHeight/2) + 'px');
    intro.style.setProperty('--dock-scale', target.width / 144);
    const image = new Image();
    image.src = avatar.src;
    image.alt = '';
    const bubble = document.createElement('span');
    bubble.setAttribute('aria-live','polite');
    intro.append(image, bubble);
    document.body.append(intro);
    bubble.textContent = (welcome[launcher.lang] || welcome.en);
    document.body.classList.add('mimo-introducing');
    const events = new AbortController();
    const options = {signal:events.signal, capture:true};
    const timer = setTimeout(end, 2600);
    function end() {
      clearTimeout(timer);
      events.abort();
      intro.remove();
      document.body.classList.remove('mimo-introducing');
    }
    intro.addEventListener('animationend', e => { if (e.animationName === 'mimo-dock') end(); }, options);
    window.addEventListener('click', end, options);
    window.addEventListener('keydown', e => { if (e.key === 'Escape' || e.key === 'Tab') end(); }, options);
    window.addEventListener('resize', end, options);
    window.addEventListener('scroll', end, options);
    eligible.addEventListener('change', end, options);
  }
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, {once:true});
})();
