// Desktop header stays on one aligned horizontal row (logo · menu · tools · sign-in).
(() => {
  const fit = () => {
    for (const h of document.querySelectorAll('.site-header')) {
      const inner = h.querySelector('.sh-inner');
      if (inner) inner.classList.remove('sh-two-rows');
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fit); else fit();
})();
