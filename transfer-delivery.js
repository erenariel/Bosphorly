// Public configuration is populated only after the mail Worker is deployed.
let transferChallenge;
function loadTransferChallenge() {
  if (!transferChallenge) transferChallenge = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => { transferChallenge = null; reject(new Error('Challenge unavailable')); };
    document.head.append(script);
  });
  return transferChallenge;
}
function addTransferDelivery(box, request, tr) {
  const config = window.BOSPHORLY_API;
  if (!config?.transferMailBase || !config.turnstileSiteKey) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = tr ? 'E-posta hesabı açmadan gönder' : 'Send without opening email';
  const challenge = document.createElement('div');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  box.append(button, challenge, status);
  button.onclick = async () => {
    button.disabled = true;
    let widget;
    try {
      const api = await loadTransferChallenge();
      const token = await new Promise((resolve, reject) => {
        widget = api.render(challenge, {sitekey: config.turnstileSiteKey, callback: resolve,
          'error-callback': reject, 'expired-callback': reject});
      });
      const response = await fetch(config.transferMailBase.replace(/\/$/, '') + '/v1/requests', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({...request, turnstileToken:token})
      });
      if (response.status !== 202 || !(await response.json()).accepted) throw new Error();
      status.textContent = tr ? 'Talep e-posta servisine iletildi. Rezervasyon onayı ayrıca gönderilecektir.' : 'The email service accepted your request. Booking confirmation is separate.';
    } catch {
      button.disabled = false;
      status.textContent = tr ? 'Gönderim doğrulanamadı. Yeniden deneyin veya e-posta taslağını kullanın.' : 'Delivery could not be confirmed. Retry or use the email draft.';
    } finally {
      if (widget !== undefined) window.turnstile.remove(widget);
    }
  };
}
