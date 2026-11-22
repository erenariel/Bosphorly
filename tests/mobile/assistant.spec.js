import { test, expect } from '@playwright/test';

test('assistant button shows Mimo mascot, lazy-loads chat panel on mobile without horizontal overflow, and Hero Mimo card opens panel', async ({ page }) => {
  await page.goto('/index.html?lang=tr');
  const fab = page.locator('.bc-fab');
  await expect(fab).toBeVisible();
  await expect(fab.locator('img.bc-fab-avatar')).toHaveAttribute('src', /assets\/brand\/mimo\/mimo-default\.svg$/);

  // Hero Mimo card is visible in Turkish with button and Telegram link
  const heroMimo = page.locator('#heroMimo');
  await expect(heroMimo).toBeVisible();
  await expect(page.locator('#heroMimoAsk')).toContainText('Sorun mu var? Mimo’ya sor');
  await expect(page.locator('#heroMimoTg')).toContainText('Telegram’da da buradayım');

  // Not loaded before click
  await expect(page.locator('script[src*="assistant-chat.js"]')).toHaveCount(0);

  await page.locator('#heroMimoAsk').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.bc-title')).toHaveText('Mimo · İstanbul asistanın');
  await expect(panel.locator('img.bc-head-avatar')).toBeVisible();
  await expect(panel.locator('img.bc-bot-avatar').first()).toBeVisible();
  const kindNote = panel.locator('.bc-kind-note');
  await expect(kindNote).toBeVisible();
  await expect(kindNote).toContainText('Mimo’ya nazik davrandığın için teşekkürler 💙');

  // 4 quick question buttons are present
  await expect(panel.locator('.bc-quick-btn')).toHaveCount(4);

  // Fits within viewport without horizontal overflow
  const box = await panel.boundingBox();
  const vp = page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);

  // Talk to a human toggles email input
  await panel.locator('.bc-human-btn').click();
  await expect(panel.locator('.bc-handoff')).toBeVisible();
});

test('assistant chat panel and Hero Mimo card render cleanly in RTL for Arabic without horizontal overflow', async ({ page }) => {
  await page.goto('/index.html?lang=ar');
  const fab = page.locator('.bc-fab');
  await expect(fab).toBeVisible();
  const fabBox = await fab.boundingBox();
  const vp = page.viewportSize();
  expect(fabBox.x).toBeLessThan(vp.width / 2);

  await expect(page.locator('#heroMimoAsk')).toContainText('لديك سؤال؟ اسأل Mimo');

  await fab.click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('dir', 'rtl');
  await expect(panel.locator('.bc-title')).toHaveText('Mimo · مساعدك في إسطنبول');
  const arKindNote = panel.locator('.bc-kind-note');
  await expect(arKindNote).toBeVisible();
  await expect(arKindNote).toContainText('💙');

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


test('greeting bubble shows once per session, does NOT contain kindNote, does not cover mobile reservation buttons, hides on input focus, and closes on Escape', async ({ page }) => {
  await page.addInitScript(() => {
    window.__BOSPHORLY_MIMO_BUBBLE_MS = 250;
    window.__BOSPHORLY_MIMO_COLLAPSE_MS = 8000;
  });

  await page.goto('/index.html?lang=tr');
  const bubble = page.locator('.bc-bubble');
  await expect(bubble).toBeVisible({ timeout: 3000 });
  await expect(bubble).toHaveAttribute('aria-live', 'polite');
  await expect(bubble.locator('.bc-bubble-text')).toContainText('Merhaba, ben Mimo 👋');
  await expect(bubble).not.toContainText('Saygısız dil');
  await expect(bubble.locator('.bc-kind-note')).toHaveCount(0);
  await expect(bubble.locator('.bc-bubble-chip')).toHaveCount(2);

  // Verify Playwright bounding box: bubble does NOT overlap the reservation button (#toStep2)
  const reserveBtn = page.locator('#toStep2');
  await reserveBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const bBox = await bubble.boundingBox();
  const rBox = await reserveBtn.boundingBox();
  expect(bBox).not.toBeNull();
  expect(rBox).not.toBeNull();
  const overlaps =
    bBox.x < rBox.x + rBox.width &&
    bBox.x + bBox.width > rBox.x &&
    bBox.y < rBox.y + rBox.height &&
    bBox.y + bBox.height > rBox.y;
  expect(overlaps).toBe(false);

  // Focusing a form input (virtual keyboard open) hides the bubble
  await page.locator('#hotel').focus();
  await expect(bubble).toBeHidden();

  // Reloading in the same session: bubble must NOT appear again because sessionStorage recorded it
  const seenFlag = await page.evaluate(() => sessionStorage.getItem('bosphorly.mimo_greeted'));
  expect(seenFlag).toBe('1');
  await page.reload();
  await page.waitForTimeout(500);
  await expect(page.locator('.bc-bubble')).toBeHidden();
});

test('prefers-reduced-motion disables Mimo entrance and blink animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.__BOSPHORLY_MIMO_POP_MS = 100;
  });
  await page.goto('/index.html?lang=tr');
  await page.waitForTimeout(250);

  const fab = page.locator('.bc-fab');
  const fabAvatar = page.locator('.bc-fab-avatar');
  expect(await fab.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await fabAvatar.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

  await fab.click();
  const headAvatar = page.locator('.bc-head-avatar');
  await expect(headAvatar).toBeVisible();
  expect(await headAvatar.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('contextual first messages, member greeting, quick question send, and 👍/👎 feedback without message content', async ({ page }) => {
  const feedbackPayloads = [];
  await page.route('**/v1/assistant/feedback', async (route) => {
    feedbackPayloads.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, count: 1 }) });
  });
  await page.route('**/v1/assistant', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'IST havalimanından Sultanahmet transferi €60.', handoff: false, lang: 'tr' }),
    });
  });
  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("ts-tok"),10);return 1},reset(){}};',
    });
  });

  // 1. Transfer context + signed-in member personal greeting
  await page.addInitScript(() => {
    try {
      localStorage.setItem('bosphorly.session', 'tok-test');
      localStorage.setItem('bosphorly.member_cache', JSON.stringify({ name: 'Eren', email: 'eren@example.com', tier: 'gold' }));
      sessionStorage.removeItem('bosphorly.assistant_chat');
    } catch {}
  });
  await page.goto('/index.html?lang=tr#booking');
  await page.locator('.bc-fab').click();
  const firstBotMsg = page.locator('.bc-msg.bot').first();
  await expect(firstBotMsg).toContainText('Tekrar hoş geldin, Eren 💙');
  await expect(firstBotMsg).toContainText('Havalimanından otele mi gidiyorsun? ✈️');

  // Clicking 👍 sends only vote & lang (no message content)
  await page.locator('.bc-rate-btn[data-vote="up"]').first().click();
  await expect.poll(() => feedbackPayloads.length).toBe(1);
  expect(feedbackPayloads[0]).toEqual({ vote: 'up', lang: 'tr' });

  // 2. Tour page contextual message
  await page.addInitScript(() => {
    try { sessionStorage.removeItem('bosphorly.assistant_chat'); } catch {}
  });
  await page.goto('/tours.html?lang=tr');
  await page.locator('.bc-fab').click();
  await expect(page.locator('.bc-msg.bot').first()).toContainText('Hangi Boğaz turu sana uygun, birlikte bakalım mı? ⛵');

  // 3. Hammam page contextual message
  await page.goto('/booking.html?service=alaturka&lang=tr');
  await page.locator('.bc-fab').click();
  await expect(page.locator('.bc-msg.bot').first()).toContainText('İlk hamam deneyimin mi? 🛁');
});

test('zero-tolerance closure locks input box and all panel buttons immediately on closed response', async ({ page }) => {
  await page.route('**/v1/assistant', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        closed: true,
        status: 'closed',
        handoff: false,
        lang: 'tr',
        reply: 'Bu dille konuşmaya devam edemem. Sohbeti burada sonlandırıyorum. Bir sorunun varsa info@bosphorly.com’a yazabilirsin.',
      }),
    });
  });
  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("ts-tok"),10);return 1},reset(){}};',
    });
  });

  await page.goto('/index.html?lang=tr');
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.bc-kind-note')).toBeVisible();

  // Wait for Turnstile token before submitting
  await page.waitForTimeout(80);
  await panel.locator('.bc-input').fill('Sen çok aptalsın');
  await panel.locator('.bc-send').click();

  await expect(panel.locator('.bc-msg.bot').last()).toContainText('Bu dille konuşmaya devam edemem.');
  await expect(panel).toHaveAttribute('data-closed', 'true');
  await expect(panel.locator('.bc-input')).toBeDisabled();
  await expect(panel.locator('.bc-send')).toBeDisabled();
  await expect(panel.locator('.bc-human-btn')).toBeDisabled();
  for (let i = 0; i < 4; i++) {
    await expect(panel.locator('.bc-quick-btn').nth(i)).toBeDisabled();
  }
});
