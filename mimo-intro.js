(() => {
  const eligible = matchMedia('(min-width:1024px) and (prefers-reduced-motion:no-preference)');
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
    bubble.textContent = (welcome[launcher.lang] || welcome.en) + ' 👋';
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
