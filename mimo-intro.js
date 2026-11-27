(() => {
  if (window.__bosphorlyMimoIntroInit) return;
  window.__bosphorlyMimoIntroInit = true;
  const eligible = matchMedia('(prefers-reduced-motion:no-preference)');
  function ready() {
    window.__mimoReady = true;
    document.dispatchEvent(new Event('mimo:welcome-end'));
  }
  let scrolled = window.scrollY !== 0;
  const noteScroll = () => { scrolled = true; };
  window.addEventListener('scroll', noteScroll, {once:true, passive:true});
  function start() {
    window.removeEventListener('scroll', noteScroll);
    const launcher = document.querySelector('.bc-launcher');
    if (!launcher) return ready();
    try {
      if (localStorage.getItem('bosphorly.mimo_intro')) return ready();
      localStorage.setItem('bosphorly.mimo_intro','1');
    } catch { return ready(); }
    if (!eligible.matches || scrolled || window.scrollY || document.body.classList.contains('bc-chat-open')) return ready();
    const avatar = launcher.querySelector('img');
    const target = avatar.getBoundingClientRect();
    const intro = document.createElement('div');
    intro.className = 'mimo-intro';
    intro.dir = launcher.dir;
    intro.lang = launcher.lang;
    intro.style.setProperty('--dock-x', (target.x + target.width/2 - innerWidth/2) + 'px');
    intro.style.setProperty('--dock-y', (target.y + target.height/2 - innerHeight/2) + 'px');
    intro.style.setProperty('--dock-scale', target.width / 210);
    const image = new Image();
    image.src = new URL('mimo-wave.webp', avatar.src).href;
    image.loading = 'lazy';
    image.alt = '';
    const bubble = document.createElement('span');
    bubble.setAttribute('aria-live','polite');
    intro.append(image, bubble);
    document.body.append(intro);
    bubble.textContent = launcher.dataset.hello;
    document.body.classList.add('mimo-introducing');
    const events = new AbortController();
    const options = {signal:events.signal, capture:true};
    const timer = setTimeout(end, 2600);
    function end() {
      clearTimeout(timer);
      events.abort();
      intro.remove();
      avatar.classList.add('mimo-docked');
      ready();
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
