// A visitor explicitly chooses which account or application to send from.
window.BosphorlyGmailLink = function (mailto) {
  const draft = new URL(mailto);
  const compose = new URL('https://mail.google.com/mail/');
  compose.search = new URLSearchParams({
    view: 'cm', fs: '1', to: decodeURIComponent(draft.pathname),
    su: draft.searchParams.get('subject'), body: draft.searchParams.get('body')
  });
  const link = document.createElement('a');
  link.href = compose.href;
  link.textContent = document.documentElement.lang === 'tr' ? 'Gmail’de aç' : 'Open in Gmail';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'primary';
  return link;
};
