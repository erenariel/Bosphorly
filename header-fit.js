// Desktop header: one row (logo · menu · tools · sign-in) when it fits; when a language has long menu labels
// or the window is narrower, the menu moves to its own row instead of running under the tools.
(() => {
  const fit = () => {
    for (const h of document.querySelectorAll('.site-header')) {
      const inner = h.querySelector('.sh-inner'), nav = h.querySelector('.sh-nav');
      if (!inner || !nav) continue;
      inner.classList.remove('sh-two-rows');
      if (innerWidth <= 900) continue;
      if (nav.scrollWidth > nav.clientWidth + 1) inner.classList.add('sh-two-rows');
    }
  };
  let t;
  const later = () => { clearTimeout(t); t = setTimeout(fit, 60); };
  addEventListener('resize', later);
  document.addEventListener('bosphorly:lang', later);
  addEventListener('bosphorly:member-changed', later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fit); else fit();
  // The sign-in area appears after the member check; re-measure when it does.
  new MutationObserver(later).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
})();
