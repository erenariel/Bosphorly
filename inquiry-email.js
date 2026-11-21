// Intercept Bosphorly inquiries, including links rendered after page load.
document.addEventListener('click', event => {
  const trigger = event.target.closest?.('a[href^="mailto:" i]');
  if (!trigger || trigger.closest('.email-picker') || event.defaultPrevented) return;
  const draft = new URL(trigger.href);
  if (draft.pathname.toLowerCase() !== 'info@bosphorly.com') return;
  event.preventDefault();
  const tr = document.documentElement.lang.startsWith('tr');
  const dialog = document.createElement('dialog');
  dialog.className = 'email-picker';
  dialog.setAttribute('aria-labelledby', 'email-picker-title');
  const title = document.createElement('h2');
  title.id = 'email-picker-title';
  title.textContent = tr ? 'Taslağı nerede açmak istersiniz?' : 'Where would you like to open your draft?';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', tr ? 'Kapat' : 'Close');
  close.onclick = () => dialog.close();
  const gmail = document.createElement('a');
  const url = new URL('https://mail.google.com/mail/');
  url.search = new URLSearchParams({view:'cm', fs:'1', to:draft.pathname,
    su:draft.searchParams.get('subject') || '', body:draft.searchParams.get('body') || ''});
  gmail.href = url.href;
  gmail.target = '_blank';
  gmail.rel = 'noopener noreferrer';
  gmail.textContent = 'Gmail';
  const app = document.createElement('a');
  app.href = draft.href;
  app.textContent = tr ? 'Varsayılan e-posta uygulaması' : 'Default email app';
  for (const link of [gmail, app]) link.addEventListener('click', () => setTimeout(() => dialog.close(), 0));
  dialog.append(title, gmail, app, close);
  dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); }, {once:true});
  document.body.append(dialog);
  dialog.showModal();
  gmail.focus();
});
