import { test, expect } from '@playwright/test';

// "Send without opening email" on tour/hammam and special tour requests. The mail Worker and
// Turnstile are replaced by stubs, so nothing leaves the test.
async function stubMail(page, sent) {
  await page.route('**/config/api.js', r => r.fulfill({ contentType: 'text/javascript',
    body: "window.BOSPHORLY_API=Object.freeze({base:'',transferMailBase:'https://mail.example.test',turnstileSiteKey:'test-site-key'});" }));
  await page.route('https://challenges.cloudflare.com/**', r => r.fulfill({ contentType: 'text/javascript',
    body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("test-token"));return 1},remove(){}};' }));
  await page.route('https://mail.example.test/v1/requests', r => { sent.push(r.request().postDataJSON());
    r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true }) }); });
}

test('tour request: direct send needs the guest email and posts kind tour with Reply-To', async ({ page }) => {
  const sent = []; await stubMail(page, sent);
  await page.goto('/booking.html?service=bb-sunset&lang=tr');
  await page.locator('#date').fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)); await page.locator('#date').dispatchEvent('change');
  await page.fill('#hotelName', 'Test Hotel'); await page.fill('#fullName', 'Test Guest'); await page.fill('#phone', '+90 555 000 00 00');
  await page.check('#ack'); await page.click('#submit');
  const btn = page.locator('#result .direct-send');
  await expect(btn).toHaveText(/E-posta hesabı açmadan gönder/);
  await expect(btn).toBeDisabled();                       // no email: no direct send
  await expect(page.locator('#result .direct-send-note')).toContainText('e-posta');
  await page.fill('#email', 'guest@example.org'); await page.click('#submit');
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect(page.locator('#result .direct-send-note')).toHaveAttribute('data-state', 'ok');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ kind: 'tour', email: 'guest@example.org', consent: true, turnstileToken: 'test-token' });
  expect(sent[0].reference).toMatch(/^BOS-/);
  expect(sent[0].message).not.toMatch(/nakit|cash/i);
});

test('special tour request offers direct send in the visitor language', async ({ page }) => {
  const sent = []; await stubMail(page, sent);
  await page.goto('/tours.html?lang=de&cat=hoods');
  const card = page.locator('#kadikoy-moda');
  await card.locator('.actions .btn.primary').click();
  const d = new Date(); d.setDate(d.getDate() + 5);
  await card.locator('input[name=date]').fill(d.toLocaleDateString('sv-SE'));
  await card.locator('input[name=name]').fill('Max Muster');
  await card.locator('input[name=phone]').fill('+49 170 0000000');
  await card.locator('input[name=email]').fill('max@example.org');
  await card.locator('input[name=ack]').check();
  await card.locator('.tf-send').click();
  const btn = card.locator('.direct-send');
  await expect(btn).toHaveText(/Senden, ohne E-Mail zu öffnen/);
  await btn.click();
  await expect(card.locator('.direct-send-note')).toHaveAttribute('data-state', 'ok');
  expect(sent[0]).toMatchObject({ kind: 'tour', email: 'max@example.org' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
