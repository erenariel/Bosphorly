// Bosphorly's public social channels (corporate WhatsApp Business and Instagram).
// Booking requests still go by email; these links are for quick questions only.
// Only this WhatsApp number may be published; the old line stays retired.
(() => {
  const scriptBase = document.currentScript && document.currentScript.src ? new URL('.', document.currentScript.src).href : '';
  const WHATSAPP_NUMBER = '16197386408';
  const WHATSAPP_DISPLAY = '+1 (619) 738-6408';
  const INSTAGRAM_HANDLE = 'bosphorly';
  const CHANNELS = Object.freeze([
    Object.freeze({ id: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/' + WHATSAPP_NUMBER, icon: 'assets/brand/whatsapp.svg', aria: 'WhatsApp ' + WHATSAPP_DISPLAY }),
    Object.freeze({ id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/' + INSTAGRAM_HANDLE + '/', icon: 'assets/brand/instagram.svg', aria: 'Instagram @' + INSTAGRAM_HANDLE }),
  ]);

  function createLink(channel, base) {
    const a = document.createElement('a');
    a.className = 'social-btn social-' + channel.id;
    a.href = channel.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', channel.aria);
    a.title = channel.aria;
    const img = document.createElement('img');
    img.className = 'social-ico';
    img.src = (base || scriptBase) + channel.icon;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.width = 18;
    img.height = 18;
    img.loading = 'lazy';
    img.decoding = 'async';
    const label = document.createElement('span');
    label.textContent = channel.label;
    a.append(img, label);
    return a;
  }

  function mountFooter() {
    const footer = document.querySelector('footer.footer');
    if (!footer || footer.querySelector('.social-links')) return;
    const wrap = document.createElement('span');
    wrap.className = 'social-links';
    for (const channel of CHANNELS) wrap.append(createLink(channel));
    const first = footer.firstElementChild;
    if (first) first.append(wrap); else footer.append(wrap);
  }

  window.BosphorlySocial = Object.freeze({ CHANNELS, WHATSAPP_NUMBER, INSTAGRAM_HANDLE, createLink });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountFooter);
  else mountFooter();
})();
