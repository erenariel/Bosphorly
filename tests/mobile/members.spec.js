import { test, expect } from '@playwright/test';

test('without an API, My account shows membership as coming soon', async ({ page }) => {
  await page.route('**/config/api.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.BOSPHORLY_API=Object.freeze({base:""});' }));
  await page.goto('/account.html?lang=tr');
  await expect(page.locator('#member h2')).toContainText('Bosphorly üyeliği');
  await expect(page.locator('#member .m-soon')).toBeVisible();
  await page.goto('/booking.html?service=bb-sunset&lang=en');
  await expect(page.locator('#couponWrap')).toBeHidden();
  await expect(page.locator('#couponHint')).toBeHidden();
});

// A stand-in API that follows backend/members.js responses.
async function mockApi(page, calls) {
  await page.route('**/config/api.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.BOSPHORLY_API=Object.freeze({base:"https://api.test"});' }));
  const coupon = { code: 'BOS-WELC-OME2', kind: 'welcome', percentBps: 500, status: 'issued', expiresAt: '2099-03-01 00:00:00', heldFor: null };
  const me = { email: 'guest@example.com', name: 'Jane Smith', lang: 'en', referralCode: 'ABCD2345', marketing: false, stamps: 2, stampsGoal: 5, coupons: [coupon], requests: [] };
  await page.route('https://api.test/**', async r => {
    const url = new URL(r.request().url()); const body = r.request().postDataJSON?.() ?? null;
    calls.push({ path: url.pathname, body, auth: r.request().headers().authorization || null });
    const json = (data, status = 200) => r.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) });
    if (url.pathname === '/v1/auth/start') return json({ sent: true });
    if (url.pathname === '/v1/auth/verify') return body.code === '123456' ? json({ token: 'tok', created: true, member: me }) : json({ error: 'Invalid or expired code' }, 400);
    if (url.pathname === '/v1/me') return json(me);
    if (url.pathname === '/v1/me/requests') return json({ ref: body.ref, coupon: body.couponCode ? { code: body.couponCode, percentBps: 500 } : null });
    return json({ error: 'Not found' }, 404);
  });
}

test('sign in with an e-mailed code, see coupons and stamps, then use a coupon on a request', async ({ page }) => {
  const calls = [];
  await mockApi(page, calls);
  // Arriving through a friend's invite link and a partner hotel's QR code.
  await page.goto('/index.html?lang=en&ref=friend123&h=hotel-a');
  await page.goto('/account.html?lang=en#signup');
  await expect(page.locator('#tabSignUp')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#mName')).toBeVisible();
  await page.locator('#tabSignIn').click();
  await expect(page.locator('#tabSignIn')).toHaveAttribute('aria-selected', 'true');
  await page.fill('#mEmail', 'guest@example.com');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.locator('.m-sent')).toContainText('guest@example.com');
  await expect(page.locator('#mMarketing')).not.toBeChecked();
  await page.fill('#mCode', '000000');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.m-msg')).toHaveText('The code is wrong or has expired.');
  await page.fill('#mCode', '123456');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('#member h2')).toHaveText('Hello, Jane');
  const verify = calls.find(c => c.path === '/v1/auth/verify' && c.body.code === '123456');
  expect(verify.body).toMatchObject({ ref: 'FRIEND123', hotel: 'hotel-a', marketing: false });
  await expect(page.locator('.m-coupon')).toHaveCount(1);
  await expect(page.locator('.m-coupon .m-pct')).toHaveText('5% off');
  await expect(page.locator('.m-dots .on')).toHaveCount(2);
  await expect(page.locator('.m-invite input')).toHaveValue(/index\.html\?ref=ABCD2345$/);

  // The request form offers the coupon, shows the discounted estimate and reserves it before WhatsApp.
  await page.goto('/booking.html?service=bb-sunset&lang=en');
  await expect(page.locator('#couponWrap')).toBeVisible();
  await expect(page.locator('#coupon')).toHaveValue('BOS-WELC-OME2');
  await expect(page.locator('#couponAfter')).toContainText('Estimated total with coupon');
  const d = new Date(); d.setDate(d.getDate() + 3);
  await page.fill('#date', d.toLocaleDateString('sv-SE')); await page.dispatchEvent('#date', 'change');
  await page.fill('#hotelName', 'Sultanahmet Palace'); await page.fill('#fullName', 'Jane Smith'); await page.fill('#phone', '+44 7700 900123');
  await page.check('#ack');
  await page.locator('#bookingForm').evaluate(f => f.requestSubmit());
  const wa = page.locator('#result a[href^="mailto:"]');
  await expect(wa).toBeVisible();
  const reg = calls.find(c => c.path === '/v1/me/requests');
  expect(reg.auth).toBe('Bearer tok');
  expect(reg.body).toMatchObject({ serviceId: 'bb-sunset', guests: 2, couponCode: 'BOS-WELC-OME2' });
  expect(reg.body.ref).toMatch(/^BOS-[A-Z0-9]{6}$/);
  const text = decodeURIComponent((await wa.getAttribute('href')).split('&body=')[1]);
  expect(text).toContain('Coupon: BOS-WELC-OME2 (−5%)');
  expect(text).toContain('Estimated total with coupon');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('partner check-in looks up a request, shows the coupon and marks the tour completed', async ({ page }) => {
  const calls = [];
  await page.route('**/config/api.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.BOSPHORLY_API=Object.freeze({base:"https://api.test"});' }));
  await page.route('https://api.test/**', async r => {
    const path = new URL(r.request().url()).pathname; calls.push({ path, auth: r.request().headers().authorization, body: r.request().postDataJSON() });
    const ok = r.request().headers().authorization === 'Bearer partner-secret';
    const view = { ref: 'BOS-7K2M9Q', serviceId: 'bb-sunset', date: '2099-05-01', guests: 2, state: path.endsWith('fulfil') ? 'fulfilled' : 'requested', firstName: 'Ayşe',
      coupon: { code: 'BOS-WELC-OME2', percentBps: 500, status: path.endsWith('fulfil') ? 'redeemed' : 'held' } };
    r.fulfill({ status: ok ? 200 : 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ok ? view : { error: 'Unauthorized' }) });
  });
  page.on('dialog', d => d.accept());
  await page.goto('/partner.html?lang=tr');
  await page.fill('#key', 'wrong'); await page.fill('#ref', 'bos-7k2m9q');
  await page.click('#find');
  await expect(page.locator('#msg')).toHaveText('Bulunamadı ya da anahtar hatalı.');
  await page.fill('#key', 'partner-secret'); await page.click('#find');
  await expect(page.locator('#result .coupon')).toContainText('BOS-WELC-OME2 · %5 indirim');
  expect(calls.at(-1).body).toEqual({ ref: 'BOS-7K2M9Q' });
  await page.getByRole('button', { name: '✓ Tur tamamlandı' }).click();
  await expect(page.locator('#result dd').last()).toHaveText('Tamamlandı');
  await expect(page.locator('#result .coupon')).toContainText('kullanıldı');
  expect(calls.at(-1).path).toBe('/v1/partner/fulfil');
});
