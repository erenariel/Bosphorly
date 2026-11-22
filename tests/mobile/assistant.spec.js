import { test, expect } from '@playwright/test';

test('assistant button lazy-loads chat panel on mobile without horizontal overflow', async ({ page }) => {
  await page.goto('/index.html?lang=tr');
  const fab = page.locator('.bc-fab');
  await expect(fab).toBeVisible();

  // Not loaded before click
  await expect(page.locator('script[src*="assistant-chat.js"]')).toHaveCount(0);

  await fab.click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.bc-title')).toHaveText('Bosphorly Asistan');

  // Fits within viewport without horizontal overflow
  const box = await panel.boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);

  // Talk to a human toggles email input
  await panel.locator('.bc-human-btn').click();
  await expect(panel.locator('.bc-handoff')).toBeVisible();
});

test('assistant chat panel renders cleanly in RTL for Arabic without horizontal overflow', async ({ page }) => {
  await page.goto('/index.html?lang=ar');
  const fab = page.locator('.bc-fab');
  await expect(fab).toBeVisible();
  const fabBox = await fab.boundingBox();
  const vp = page.viewportSize();
  expect(fabBox.x).toBeLessThan(vp.width / 2);

  await fab.click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('dir', 'rtl');
  await expect(panel.locator('.bc-title')).toHaveText('مساعد Bosphorly');

  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);

  const tgLink = panel.locator('.bc-tg-link');
  await expect(tgLink).toBeVisible();
  await expect(tgLink).toHaveAttribute('href', 'https://t.me/BosphorlyBot?start=ar');
  await expect(tgLink).toHaveAttribute('target', '_blank');
  await expect(tgLink).toHaveAttribute('rel', /noopener/);
  expect((await tgLink.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

test('Telegram CTAs render with language param, local SVG, >=44px touch target, and RTL alignment', async ({ page }) => {
  // Home page hero + footer in Hebrew (RTL)
  await page.goto('/index.html?lang=he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  for (const sel of ['#heroTelegram', '#footerTelegram']) {
    const link = page.locator(sel);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'https://t.me/BosphorlyBot?start=he');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link.locator('img[src*="assets/brand/telegram.svg"]')).toBeVisible();
    expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

  // FAQ page end + footer in Turkish
  await page.goto('/faq.html?lang=tr');
  await expect(page.locator('#askTelegram')).toBeVisible();
  await expect(page.locator('#askTelegram')).toHaveAttribute('href', 'https://t.me/BosphorlyBot?start=tr');
  await expect(page.locator('#askTelegram')).toContainText("Telegram'da sor");
  expect((await page.locator('#askTelegram').boundingBox()).height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.dc-foot a.tg-foot')).toHaveAttribute('href', 'https://t.me/BosphorlyBot?start=tr');
  expect((await page.locator('.dc-foot a.tg-foot').boundingBox()).height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

  // Assistant panel top link in Turkish
  await page.locator('.bc-fab').click();
  const chatTg = page.locator('.bc-panel .bc-tg-link');
  await expect(chatTg).toHaveAttribute('href', 'https://t.me/BosphorlyBot?start=tr');
  await expect(chatTg).toContainText("Telegram'dan devam et");
  expect((await chatTg.boundingBox()).height).toBeGreaterThanOrEqual(44);

  // Booking confirmation screen shows "Sorun olursa Telegram'dan yaz"
  await page.goto('/booking.html?service=bb-sunset&lang=tr');
  await page.locator('#date').fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  await page.locator('#date').dispatchEvent('change');
  await page.fill('#hotelName', 'Test Hotel');
  await page.fill('#fullName', 'Test Guest');
  await page.fill('#phone', '+90 555 000 00 00');
  await page.check('#ack');
  await page.click('#submit');
  const confirmTg = page.locator('#result a.tg-after');
  await expect(confirmTg).toBeVisible();
  await expect(confirmTg).toHaveAttribute('href', 'https://t.me/BosphorlyBot?start=tr');
  await expect(confirmTg).toContainText("Sorun olursa Telegram'dan yaz");
  expect((await confirmTg.boundingBox()).height).toBeGreaterThanOrEqual(44);
});

test('all Telegram links stay hidden when telegramBot in config/api.js is empty', async ({ page }) => {
  await page.route('**/config/api.js', (r) => r.fulfill({
    contentType: 'text/javascript',
    body: 'window.BOSPHORLY_API=Object.freeze({base:"",transferMailBase:"",turnstileSiteKey:"",telegramBot:""});',
  }));
  await page.goto('/index.html?lang=tr');
  await expect(page.locator('#heroTelegram')).toBeHidden();
  await expect(page.locator('#footerTelegramWrap')).toBeHidden();
  await expect(page.locator('a[href*="t.me"]')).toHaveCount(0);

  await page.goto('/faq.html?lang=tr');
  await expect(page.locator('#askTelegram')).toBeHidden();
  await expect(page.locator('a[href*="t.me"]')).toHaveCount(0);

  await page.goto('/booking.html?service=bb-sunset&lang=tr');
  await page.locator('#date').fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  await page.locator('#date').dispatchEvent('change');
  await page.fill('#hotelName', 'Test Hotel');
  await page.fill('#fullName', 'Test Guest');
  await page.fill('#phone', '+90 555 000 00 00');
  await page.check('#ack');
  await page.click('#submit');
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('a[href*="t.me"]')).toHaveCount(0);
});

