// Use the language of this static page even if a visitor previously browsed in another language.
window.BOSPHORLY_LANG_ALT = {};
document.getElementById('web-chat').addEventListener('click', event => {
  if (typeof window.__bosphorlyChatOpen === 'function') {
    event.preventDefault();
    window.__bosphorlyChatOpen();
  }
});
