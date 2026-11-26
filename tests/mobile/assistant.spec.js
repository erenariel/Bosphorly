import { test, expect } from '@playwright/test';

async function expectChatPanelLayout(page, panel) {
  const vp = page.viewportSize();
  const isMobile = vp.width <= 480;
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  if (isMobile) {
    expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.width - vp.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(box.height - vp.height)).toBeLessThanOrEqual(2);
  } else {
    const expectedW = vp.width >= 1440 ? 460 : 420;
    const expectedH = Math.min(640, vp.height * 0.82);
    expect(Math.abs(box.width - expectedW)).toBeLessThanOrEqual(2);
    expect(Math.abs(box.height - expectedH)).toBeLessThanOrEqual(2);
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
  }

  const metrics = await panel.evaluate((el) => {
    const cs = (node) => getComputedStyle(node);
    const panelCs = cs(el);
    const head = el.querySelector('.bc-head');
    const av = el.querySelector('.bc-head-avatar');
    const sub = el.querySelector('.bc-sub');
    const log = el.querySelector('.bc-log');
    const msg = el.querySelector('.bc-msg');
    const msgCs = cs(msg);
    const quick = el.querySelector('.bc-quick');
    const tg = el.querySelector('.bc-tg-link');
    const tgRect = tg.getBoundingClientRect();
    return {
      borderRadius: panelCs.borderRadius,
      headH: head.getBoundingClientRect().height,
      avW: av.getBoundingClientRect().width,
      subDisplay: cs(sub).display,
      visibleTitle: el.querySelector('.bc-title').innerText.trim(),
      logH: log.getBoundingClientRect().height,
      panelH: el.getBoundingClientRect().height,
      titleSize: cs(el.querySelector('.bc-title')).fontSize,
      msg: msgCs.fontSize,
      lineHeight: msgCs.lineHeight,
      input: cs(el.querySelector('.bc-input')).fontSize,
      handoffCount: el.querySelectorAll('.bc-handoff').length,
      tgBarCount: el.querySelectorAll('.bc-tg-bar').length,
      quickWrap: cs(quick).flexWrap,
      tgW: tgRect.width,
      tgH: tgRect.height,
      tgInHead: head.contains(tg),
      fabHidden: getComputedStyle(document.querySelector('.bc-fab')).display === 'none',
      scrollLocked: document.body.classList.contains('bc-scroll-lock'),
    };
  });
  expect(metrics.logH / metrics.panelH).toBeGreaterThanOrEqual(isMobile ? 0.7 : 0.6);
  expect(metrics.titleSize).toBe('16px');
  expect(metrics.msg).toBe('15px');
  expect(parseFloat(metrics.lineHeight) / 15).toBeCloseTo(1.5, 1);
  expect(metrics.input).toBe(isMobile ? '16px' : '15px');
  expect(metrics.handoffCount).toBe(0);
  expect(metrics.tgBarCount).toBe(0);
  expect(metrics.tgInHead).toBe(true);
  expect(metrics.tgW).toBeGreaterThanOrEqual(44);
  expect(metrics.tgH).toBeGreaterThanOrEqual(44);
  if (isMobile) {
    expect(parseFloat(metrics.borderRadius)).toBe(0);
    expect(metrics.headH).toBeLessThanOrEqual(56);
    expect(Math.round(metrics.avW)).toBe(32);
    expect(metrics.visibleTitle).toBe('Mimo');
    expect(metrics.subDisplay).toBe('none');
    expect(metrics.fabHidden).toBe(true);
    expect(metrics.scrollLocked).toBe(true);
  } else {
    expect(metrics.quickWrap).toBe('wrap');
  }
  await expect(panel.locator('.bc-handoff')).toHaveCount(0);
  const closeHit = await panel.locator('.bc-close').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return top === el || el.contains(top);
  });
  expect(closeHit).toBe(true);
  const send = await panel.locator('.bc-send').boundingBox();
  const input = await panel.locator('.bc-input').boundingBox();
  expect(send.y + send.height).toBeLessThanOrEqual(vp.height + 1);
  expect(input.y + input.height).toBeLessThanOrEqual(vp.height + 1);
}

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

  // Panel size, type scale, and email box stay within the mobile layout contract
  await expectChatPanelLayout(page, panel);

  // Talk to a human opens email card inside .bc-log and removes it on close
  await panel.locator('.bc-human-btn').click();
  await expect(panel.locator('.bc-log .bc-handoff')).toBeVisible();
  await expect(panel.locator('.bc-handoff input[type="email"]')).toBeVisible();
  const vp = page.viewportSize();
  const emailSize = await panel.locator('.bc-handoff input[type="email"]').evaluate((el) => getComputedStyle(el).fontSize);
  expect(emailSize).toBe(vp.width <= 480 ? '16px' : '15px');
  await panel.locator('.bc-handoff-close').click();
  await expect(panel.locator('.bc-handoff')).toHaveCount(0);
  const openBox = await panel.boundingBox();
  const logBox = await panel.locator('.bc-log').boundingBox();
  expect(logBox.height / openBox.height).toBeGreaterThanOrEqual(vp.width <= 480 ? 0.7 : 0.6);
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

  await expectChatPanelLayout(page, panel);

  const tgLink = panel.locator('.bc-tg-link');
  await expect(tgLink).toBeVisible();
  await expect(tgLink).toHaveAttribute('href', 'https://t.me/BosphorlyBot?start=ar');
  await expect(tgLink).toHaveAttribute('aria-label', 'تابع على تيليجرام');
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

  // Assistant panel header icon in Turkish (with 44px touch target & localized aria-label)
  await page.locator('.bc-fab').click();
  const chatTg = page.locator('.bc-panel .bc-head .bc-tg-link');
  await expect(chatTg).toHaveAttribute('href', 'https://t.me/BosphorlyBot?start=tr');
  await expect(chatTg).toHaveAttribute('aria-label', "Telegram'dan devam et");
  expect((await chatTg.boundingBox()).width).toBeGreaterThanOrEqual(44);
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

test('Hero WhatsApp link matches Telegram link aesthetics and footer channel pills share identical dimensions', async ({ page }) => {
  await page.goto('/index.html?lang=tr');
  const heroTg = page.locator('#heroTelegram');
  const heroWa = page.locator('.hero .social-hero');
  const heroMap = page.locator('.hero .hero-map').first();
  await expect(heroTg).toBeVisible();
  await expect(heroWa).toBeVisible();
  await expect(heroWa).toHaveAttribute('href', 'https://wa.me/16197386408');
  await expect(heroWa).toHaveAttribute('target', '_blank');
  await expect(heroWa).toHaveAttribute('rel', /noopener/);
  await expect(heroWa).toContainText("WhatsApp'ta sor");
  await expect(heroWa.locator('img[src*="assets/brand/whatsapp.svg"]')).toBeVisible();
  const [tgBox, waBox, mapBox] = await Promise.all([heroTg.boundingBox(), heroWa.boundingBox(), heroMap.boundingBox()]);
  expect(waBox.height).toBeGreaterThanOrEqual(44);
  expect(Math.abs(waBox.height - tgBox.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(waBox.height - mapBox.height)).toBeLessThanOrEqual(1);
  const [waStyle, tgStyle, mapStyle] = await page.evaluate(() => {
    const pick = sel => {
      const cs = getComputedStyle(document.querySelector(sel));
      return { fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, bg: cs.backgroundColor };
    };
    return [pick('.hero .social-hero'), pick('#heroTelegram'), pick('.hero .hero-map')];
  });
  expect(waStyle).toEqual(tgStyle);
  expect(waStyle).toEqual(mapStyle);

  // Language switch updates hero WhatsApp label cleanly (including RTL Hebrew).
  await page.locator('#language').selectOption('he');
  await expect(heroWa).toContainText('שאלו בוואטסאפ');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();

  // Footer Telegram, WhatsApp and Instagram pills share identical height and border styling.
  const footButtons = page.locator('footer .tg-foot, footer .social-btn');
  await expect(footButtons).toHaveCount(3);
  const footBoxes = await Promise.all([0, 1, 2].map(i => footButtons.nth(i).boundingBox()));
  for (const box of footBoxes) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(box.height - footBoxes[0].height)).toBeLessThanOrEqual(1);
  }
});

test('all Telegram links stay hidden when telegramBot in config/api.js is empty', async ({ page }) => {
  await page.route('**/config/api.js*', (r) => r.fulfill({
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


test('email handoff stays out of DOM until requested, opens inline under matching Mimo reply, and closes/hides quick actions on mobile after first message', async ({ page }) => {
  let calls = 0;
  await page.route('**/v1/assistant/handoff', async (route) => {
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true, reference: 'BOS-CARD-1' }) });
  });
  await page.route('**/v1/assistant', async (route) => {
    calls += 1;
    const handoff = calls > 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: handoff ? 'Ekibimize iletiyorum.' : 'Boğaz turu sabah kalkıyor.',
        handoff,
        lang: 'tr',
        chatSession: 'sess-layout',
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
  const vp = page.viewportSize();
  const isMobile = vp.width <= 480;
  await expect(panel).toBeVisible();
  await expect(panel.locator('.bc-handoff')).toHaveCount(0);
  await expect(panel.locator('.bc-quick')).not.toHaveClass(/bc-quick-scroll/);
  await expect(panel.locator('.bc-quick-toggle')).toBeHidden();

  const input = panel.locator('.bc-input');
  const sendBtn = panel.locator('.bc-send');
  await page.waitForTimeout(80);
  await input.fill('Boğaz turu saat kaçta?');
  await sendBtn.click();
  await expect(panel.locator('.bc-msg.user')).toContainText('Boğaz turu saat kaçta?');
  await expect(panel.locator('.bc-handoff')).toHaveCount(0);

  const quick = panel.locator('.bc-quick');
  const quickToggle = panel.locator('.bc-quick-toggle');
  await expect(quick).toHaveClass(/bc-quick-scroll/);
  if (isMobile) {
    await expect(quick).toBeHidden();
    await expect(quickToggle).toBeVisible();
    await quickToggle.click();
    await expect(quick).toBeVisible();
    await quickToggle.click();
    await expect(quick).toBeHidden();
  } else {
    await expect(quickToggle).toBeHidden();
    const quickStyle = await quick.evaluate((el) => {
      const cs = getComputedStyle(el);
      const btn = getComputedStyle(el.querySelector('.bc-quick-btn'));
      return {
        wrap: cs.flexWrap,
        overflowX: cs.overflowX,
        whiteSpace: btn.whiteSpace,
        shrink: btn.flexShrink,
      };
    });
    expect(quickStyle.wrap).toBe('nowrap');
    expect(quickStyle.overflowX).toBe('auto');
    expect(quickStyle.whiteSpace).toBe('nowrap');
    expect(quickStyle.shrink).toBe('0');
  }

  await input.fill('Bir insana bağla');
  await sendBtn.click();
  await expect(panel.locator('.bc-msg.bot').last()).toContainText('Ekibimize iletiyorum.');
  const card = panel.locator('.bc-log .bc-handoff');
  await expect(card).toBeVisible();
  // Handoff card sits directly under the matching Mimo bot row inside .bc-log
  const isImmediatelyAfterBot = await panel.locator('.bc-log').evaluate((log) => {
    const botRows = log.querySelectorAll('.bc-msg-row.bot');
    const lastBot = botRows[botRows.length - 1];
    return Boolean(lastBot && lastBot.nextElementSibling && lastBot.nextElementSibling.classList.contains('bc-handoff'));
  });
  expect(isImmediatelyAfterBot).toBe(true);

  const logRatio = await panel.evaluate((el) => {
    const log = el.querySelector('.bc-log').getBoundingClientRect().height;
    return log / el.getBoundingClientRect().height;
  });
  expect(logRatio).toBeGreaterThanOrEqual(isMobile ? 0.7 : 0.6);

  // Sending handoff removes the inline card from the chat list
  await card.locator('input[type="email"]').fill('guest@example.org');
  await card.locator('.bc-forward-btn').click();
  await expect(panel.locator('.bc-handoff')).toHaveCount(0);
  await expect(panel.locator('.bc-msg.bot').last()).toContainText('info@bosphorly.com');
});

test('RTL chat panels for Hebrew, Arabic and Persian keep the email box hidden and the message area dominant', async ({ page }) => {
  for (const lang of ['he', 'ar', 'fa']) {
    await page.goto(`/index.html?lang=${lang}`);
    await page.locator('.bc-fab').click();
    const panel = page.locator('.bc-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('dir', 'rtl');
    await expectChatPanelLayout(page, panel);
    await expect(panel.locator('.bc-tg-link')).toHaveAttribute('href', `https://t.me/BosphorlyBot?start=${lang}`);
    expect((await panel.locator('.bc-tg-link').boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.locator('.bc-close').click();
    await expect(panel).toBeHidden();
    await expect(page.locator('.bc-fab')).toBeVisible();
    expect(await page.evaluate(() => document.body.classList.contains('bc-scroll-lock'))).toBe(false);
  }
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

test('Turnstile renders interaction-only in hidden footer container, stays invisible across 3 consecutive messages, and silently resets/retries on expired chatSession', async ({ page }) => {
  const assistantRequests = [];
  const feedbackPayloads = [];
  const handoffPayloads = [];
  let messageCallIdx = 0;

  await page.route('**/v1/assistant/feedback', async (route) => {
    feedbackPayloads.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, count: 1 }) });
  });
  await page.route('**/v1/assistant/handoff', async (route) => {
    handoffPayloads.push(route.request().postDataJSON());
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ accepted: true, reference: 'BOS-CHAT-1' }) });
  });
  await page.route('**/v1/assistant', async (route) => {
    const body = route.request().postDataJSON();
    assistantRequests.push(body);
    messageCallIdx += 1;
    if (messageCallIdx === 1) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: 'Birinci yanıt 🌊', handoff: false, lang: 'tr', chatSession: 'sess-1' }),
      });
    }
    if (messageCallIdx === 2) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ reply: 'İkinci yanıt ⛵', handoff: false, lang: 'tr' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'Üçüncü yanıt 🛁', handoff: false, lang: 'tr' }),
    });
  });

  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: `
        window.__tsStats = { renders: [], resets: 0, tokenSeq: 0, opts: null };
        window.turnstile = {
          render(el, opts) {
            window.__tsStats.renders.push({
              appearance: opts.appearance,
              theme: opts.theme,
              hasBeforeInteractive: typeof opts['before-interactive-callback'] === 'function',
              hasAfterInteractive: typeof opts['after-interactive-callback'] === 'function',
              className: el.className,
              isLastChild: el === el.parentElement.lastElementChild,
            });
            window.__tsStats.opts = opts;
            const child = document.createElement('div');
            child.style.height = '65px';
            child.textContent = 'Turnstile widget';
            el.appendChild(child);
            const tok = 'ts-tok-' + (++window.__tsStats.tokenSeq);
            setTimeout(() => opts.callback(tok), 10);
            return 1;
          },
          reset() {
            window.__tsStats.resets += 1;
            const tok = 'ts-tok-' + (++window.__tsStats.tokenSeq);
            setTimeout(() => window.__tsStats.opts.callback(tok), 10);
          }
        };
      `,
    });
  });

  await page.goto('/index.html?lang=tr');
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();

  const tsBox = panel.locator('.bc-turnstile');
  await expect(tsBox).toBeHidden();

  // Wait for Turnstile script & render to run
  await expect.poll(async () => page.evaluate(() => window.__tsStats?.renders?.length || 0)).toBe(1);
  const renderInfo = await page.evaluate(() => window.__tsStats.renders[0]);
  expect(renderInfo.appearance).toBe('interaction-only');
  expect(renderInfo.isLastChild).toBe(true);
  expect(renderInfo.hasBeforeInteractive).toBe(true);
  expect(renderInfo.hasAfterInteractive).toBe(true);
  await expect(tsBox).toBeHidden();

  // Send 3 consecutive messages: Turnstile box must remain hidden for all 3
  const input = panel.locator('.bc-input');
  const sendBtn = panel.locator('.bc-send');

  await input.fill('Boğaz turu saat kaçta?');
  await sendBtn.click();
  await expect(panel.locator('.bc-msg.bot')).toContainText(['Birinci yanıt 🌊']);
  await expect(tsBox).toBeHidden();

  await input.fill('Transfer fiyatı nedir?');
  await sendBtn.click();
  await expect(panel.locator('.bc-msg.bot')).toContainText(['İkinci yanıt ⛵']);
  await expect(tsBox).toBeHidden();

  await input.fill('Hamam rezervasyonu nasıl yapılır?');
  await sendBtn.click();
  await expect(panel.locator('.bc-msg.bot')).toContainText(['Üçüncü yanıt 🛁']);
  await expect(tsBox).toBeHidden();

  // Only message 1 carried turnstileToken; messages 2 and 3 carried chatSession without turnstileToken
  expect(assistantRequests).toHaveLength(3);
  expect(assistantRequests[0].turnstileToken).toBe('ts-tok-1');
  expect(assistantRequests[0].chatSession).toBeUndefined();
  expect(assistantRequests[1].chatSession).toBe('sess-1');
  expect(assistantRequests[1].turnstileToken).toBeUndefined();
  expect(assistantRequests[2].chatSession).toBe('sess-1');
  expect(assistantRequests[2].turnstileToken).toBeUndefined();
  expect(await page.evaluate(() => window.__tsStats.resets)).toBe(0);

  // Subsequent feedback & handoff reuse chatSession without Turnstile
  await panel.locator('.bc-rate-btn[data-vote="up"]').last().click();
  await expect.poll(() => feedbackPayloads.length).toBe(1);
  expect(feedbackPayloads[0]).toEqual({ vote: 'up', lang: 'tr', chatSession: 'sess-1' });

  await panel.locator('.bc-human-btn').click();
  await panel.locator('.bc-handoff input[type="email"]').fill('guest@example.org');
  await panel.locator('.bc-forward-btn').click();
  await expect.poll(() => handoffPayloads.length).toBe(1);
  expect(handoffPayloads[0].chatSession).toBe('sess-1');
  expect(handoffPayloads[0].turnstileToken).toBeUndefined();

  // Now simulate expired/invalid chatSession on message 4: server returns 403 once, client resets Turnstile silently and retries
  await page.unroute('**/v1/assistant');
  const retryRequests = [];
  await page.route('**/v1/assistant', async (route) => {
    const body = route.request().postDataJSON();
    retryRequests.push(body);
    if (body.chatSession === 'sess-1') {
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Bot verification failed' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'Yenilenmiş yanıt ✅', handoff: false, lang: 'tr', chatSession: 'sess-2' }),
    });
  });

  await input.fill('Dördüncü mesaj');
  await sendBtn.click();
  await expect(panel.locator('.bc-msg.bot').last()).toContainText('Yenilenmiş yanıt ✅');
  await expect(tsBox).toBeHidden();

  // Verify silent turnstile.reset + auto retry with no duplicate user message or error shown
  expect(retryRequests).toHaveLength(2);
  expect(retryRequests[0].chatSession).toBe('sess-1');
  expect(retryRequests[1].turnstileToken).toBe('ts-tok-2');
  expect(retryRequests[1].chatSession).toBeUndefined();
  expect(await page.evaluate(() => window.__tsStats.resets)).toBe(1);
  expect(await panel.locator('.bc-msg.user').filter({ hasText: 'Dördüncü mesaj' }).count()).toBe(1);
  const allBotTexts = await panel.locator('.bc-msg.bot').allInnerTexts();
  expect(allBotTexts.join(' ')).not.toContain('güvenlik doğrulamasını');
  expect(allBotTexts.join(' ')).not.toContain('çevrimdışı');

  // If interaction IS required by Cloudflare (before-interactive-callback), container becomes visible at bottom then hides on solve
  await page.evaluate(() => window.__tsStats.opts['before-interactive-callback']());
  await expect(tsBox).toBeVisible();
  await page.evaluate(() => {
    window.__tsStats.opts['after-interactive-callback']();
    window.__tsStats.opts.callback('ts-tok-3');
  });
  await expect(tsBox).toBeHidden();
});

test('mini-Markdown escapes HTML/XSS first, renders **bold** and <br>, and restricts clickable links with rel=noopener', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: `window.turnstile = { render(el, opts) { setTimeout(() => opts.callback('ts-md-1'), 5); return 1; }, reset() {} };`,
    });
  });

  let capturedReq = null;
  await page.route('**/v1/assistant', async (route) => {
    capturedReq = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply:
          '**Sabah Boğaz Turu** kişi başı yaklaşık **25 EUR**.\n' +
          'Detaylar: https://bosphorly.com/booking.html?service=bb-morning&lang=tr\n' +
          'Telegram: https://t.me/BosphorlyBot?start=tr\n' +
          'Saldırı: <img src=x onerror="window.__xssTriggered=1"> https://evil.com https://t.me/OtherBot',
        handoff: false,
        lang: 'tr',
        chatSession: 'sess-md',
      }),
    });
  });

  await page.goto('/index.html?lang=tr');
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();

  await panel.locator('.bc-input').fill('<b>merhaba</b> Tur fiyatı?');
  await panel.locator('.bc-send').click();

  const lastBot = panel.locator('.bc-msg.bot').last();
  await expect(lastBot).toContainText('Sabah Boğaz Turu');
  await expect(lastBot).toContainText('<img src=x');

  // Verify no XSS executed and no injected img/script/b DOM nodes exist
  expect(await page.evaluate(() => window.__xssTriggered)).toBeUndefined();
  expect(await lastBot.locator('img, script').count()).toBe(0);
  expect(await panel.locator('.bc-msg.user').last().locator('b').count()).toBe(0);
  expect(await lastBot.locator('strong').allInnerTexts()).toEqual(['Sabah Boğaz Turu', '25 EUR']);
  expect(await lastBot.locator('br').count()).toBeGreaterThanOrEqual(3);

  // Only bosphorly.com and t.me/BosphorlyBot are clickable links with rel=noopener
  const links = await lastBot.locator('a').evaluateAll((els) =>
    els.map((a) => ({ href: a.getAttribute('href'), rel: a.getAttribute('rel') }))
  );
  expect(links).toEqual([
    { href: 'https://bosphorly.com/booking.html?service=bb-morning&lang=tr', rel: 'noopener' },
    { href: 'https://t.me/BosphorlyBot?start=tr', rel: 'noopener' },
  ]);
  expect(capturedReq.greeted).toBe(true);
  expect(capturedReq.stream).toBe(true);
});

test('panel open pre-warms Turnstile token in background, shows 8s intermediate status, and streams SSE deltas word-by-word', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: `
        window.__tsStats = { renders: 0, resets: 0, resolvedAtOpen: false };
        window.turnstile = {
          render(el, opts) {
            window.__tsStats.renders += 1;
            setTimeout(() => {
              window.__tsStats.resolvedAtOpen = true;
              opts.callback('ts-prewarmed-1');
            }, 15);
            return 1;
          },
          reset() { window.__tsStats.resets += 1; }
        };
      `,
    });
  });

  await page.goto('/index.html?lang=tr');
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();

  // Turnstile resolved in background purely from opening panel (no message sent yet)
  await expect.poll(async () => page.evaluate(() => Boolean(window.__tsStats?.resolvedAtOpen))).toBe(true);
  expect(await page.evaluate(() => window.__tsStats.renders)).toBe(1);
  expect(await page.evaluate(() => window.__tsStats.resets)).toBe(0);

  // Override 8s intermediate threshold for deterministic fast test execution & return SSE from Browser fetch mock
  await page.evaluate(() => {
    window.__BOSPHORLY_MIMO_THINK_MS = 100;
    const origFetch = window.fetch.bind(window);
    window.__sseReq = null;
    window.fetch = async (url, init) => {
      if (String(url).includes('/v1/assistant')) {
        window.__sseReq = JSON.parse(init.body);
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(enc.encode('event: session\ndata: {"chatSession":"sess-sse-1"}\n\n'));
            await new Promise((r) => setTimeout(r, 240));
            controller.enqueue(enc.encode('event: delta\ndata: {"t":"**Sabah turu** "}\n\n'));
            await new Promise((r) => setTimeout(r, 40));
            controller.enqueue(enc.encode('event: delta\ndata: {"t":"yaklaşık 25 EUR."}\n\n'));
            controller.enqueue(
              enc.encode(
                'event: done\ndata: {"reply":"**Sabah turu** yaklaşık 25 EUR. https://bosphorly.com/booking.html?service=bb-morning&lang=tr","handoff":false,"handoffOffer":false,"lang":"tr","chatSession":"sess-sse-1"}\n\n'
              )
            );
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        });
      }
      return origFetch(url, init);
    };
  });

  await panel.locator('.bc-input').fill('Boğaz turu fiyatı nedir?');
  await panel.locator('.bc-send').click();

  const typingLabel = panel.locator('.bc-typing-label');
  await expect(typingLabel).toHaveText('Mimo yazıyor…');
  await expect(typingLabel).toHaveText('Biraz düşünüyorum…', { timeout: 2000 });

  const lastBot = panel.locator('.bc-msg.bot').last();
  await expect(lastBot).toContainText('Sabah turu yaklaşık 25 EUR.');
  await expect(lastBot.locator('strong')).toHaveText('Sabah turu');
  await expect(lastBot.locator('a')).toHaveAttribute('href', 'https://bosphorly.com/booking.html?service=bb-morning&lang=tr');
  expect(await page.evaluate(() => window.__sseReq.turnstileToken)).toBe('ts-prewarmed-1');
  expect(await page.evaluate(() => window.__tsStats.resets)).toBe(0);
});

test('375x667 (iPhone SE) & 393x852 (iPhone 15) fullscreen layout, keyboard visualViewport, single-line kindNote, FAB hide/restore & dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.addInitScript(() => {
    const vvListeners = { resize: [], scroll: [] };
    let mockH = 0;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        get width() { return window.innerWidth; },
        get height() { return mockH || window.innerHeight; },
        get offsetTop() { return 0; },
        get offsetLeft() { return 0; },
        addEventListener(type, fn) { (vvListeners[type] = vvListeners[type] || []).push(fn); },
        removeEventListener(type, fn) { vvListeners[type] = (vvListeners[type] || []).filter((f) => f !== fn); },
      },
    });
    window.__setMockVvHeight = (h) => {
      mockH = h;
      (vvListeners.resize || []).forEach((fn) => fn());
    };
  });

  for (const vp of [{ width: 375, height: 667 }, { width: 393, height: 852 }]) {
    await page.setViewportSize(vp);
    if (page.url() !== 'about:blank') {
      await page.evaluate(() => { sessionStorage.clear(); window.__setMockVvHeight(0); });
    }

    await page.goto('/index.html?lang=tr');
    await page.locator('.bc-fab').click();
    const panel = page.locator('.bc-panel');
    await expect(panel).toBeVisible();
    await expectChatPanelLayout(page, panel);

    const initialMetrics = await panel.evaluate((el) => {
      const note = el.querySelector('.bc-kind-note');
      const noteCs = getComputedStyle(note);
      const panelCs = getComputedStyle(el);
      const botCs = getComputedStyle(el.querySelector('.bc-msg.bot'));
      return {
        noteH: note.getBoundingClientRect().height,
        noteWrap: noteCs.whiteSpace,
        panelBg: panelCs.backgroundColor,
        botBg: botCs.backgroundColor,
      };
    });
    expect(initialMetrics.noteWrap).toBe('nowrap');
    expect(initialMetrics.noteH).toBeLessThanOrEqual(24);
    expect(initialMetrics.panelBg).not.toBe('rgb(255, 255, 255)');
    expect(initialMetrics.botBg).not.toBe('rgb(255, 255, 255)');

    await page.reload();
    await page.locator('.bc-fab').click();
    await expect(page.locator('.bc-panel')).toBeVisible();
    await expect(page.locator('.bc-panel .bc-kind-note')).toHaveCount(0);

    await page.evaluate(() => window.__setMockVvHeight(360));
    const inputBox = await page.locator('.bc-panel .bc-input').boundingBox();
    expect(inputBox.y).toBeGreaterThanOrEqual(0);
    expect(inputBox.y + inputBox.height).toBeLessThanOrEqual(361);
    const panelBox = await page.locator('.bc-panel').boundingBox();
    expect(Math.abs(panelBox.height - 360)).toBeLessThanOrEqual(2);

    await page.evaluate(() => window.__setMockVvHeight(0));
    await page.locator('.bc-panel .bc-close').click();
    await expect(page.locator('.bc-panel')).toBeHidden();
    await expect(page.locator('.bc-fab')).toBeVisible();
    expect(await page.evaluate(() => document.body.classList.contains('bc-scroll-lock'))).toBe(false);
  }
});

test('375x667 RTL layout (he, ar, fa) keeps input in viewport, >=70% log area, and no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  for (const lang of ['he', 'ar', 'fa']) {
    await page.goto(`/index.html?lang=${lang}`);
    await page.locator('.bc-fab').click();
    const panel = page.locator('.bc-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('dir', 'rtl');
    await expectChatPanelLayout(page, panel);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.bc-close').click();
    await expect(page.locator('.bc-fab')).toBeVisible();
  }
});

test('Mimo 2.0: client enforces 25s SSE upper cap with tryAgain recovery, retains bounded request history, strips leaked tags, and shows happy Mimo on booking confirmation', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: `window.__tsCb = null; window.__tsN = 0; window.turnstile = { render(_el, o){ window.__tsCb = o.callback; setTimeout(() => o.callback('ts-cap-' + (++window.__tsN)), 10); return 1; }, reset(){ setTimeout(() => window.__tsCb && window.__tsCb('ts-cap-' + (++window.__tsN)), 10); } };`,
    });
  });

  await page.addInitScript(() => {
    sessionStorage.setItem(
      'bosphorly.assistant_chat',
      JSON.stringify([
        { role: 'user', content: 'u1' },
        { role: 'assistant', content: 'a1' },
        { role: 'user', content: 'u2' },
        { role: 'assistant', content: 'a2' },
        { role: 'user', content: 'u3' },
        { role: 'assistant', content: 'a3' },
      ]),
    );
  });

  await page.goto('/index.html?lang=tr');
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();

  await page.evaluate(() => {
    window.__BOSPHORLY_MIMO_CAP_MS = 180;
    window.__capturedHistLens = [];
    let callN = 0;
    const origFetch = window.fetch.bind(window);
    window.fetch = async (url, init) => {
      if (String(url).includes('/v1/assistant')) {
        const body = JSON.parse(init.body);
        window.__capturedHistLens.push(Array.isArray(body.history) ? body.history.length : -1);
        callN += 1;
        if (callN === 1) {
          // Hang stream forever without closing until client cap triggers abort
          const stream = new ReadableStream({
            start() {},
          });
          return new Response(stream, {
            status: 200,
            headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
          });
        }
        return Response.json({
          reply: '<|channel>thought\nhidden<channel|>Harika! Benim favorim gün batımı turu 💙\n[[flags:abuse=0;handoff=0]]',
          handoff: false,
          lang: 'tr',
        });
      }
      return origFetch(url, init);
    };
  });

  await panel.locator('.bc-input').fill('Merhaba Mimo');
  await panel.locator('.bc-send').click();

  // Client upper cap aborts stalling SSE cleanly and renders localized tryAgain
  await expect(panel.locator('.bc-msg.bot').last()).toContainText('martılar kafamı karıştırdı', { timeout: 3000 });
  await expect(panel.locator('.bc-send')).toBeEnabled();
  expect(await page.evaluate(() => window.__capturedHistLens[0])).toBe(6);

  // Second turn verifies client strips any stray <|channel>thought or [[flags:...]]
  await panel.locator('.bc-input').fill('Favorin hangisi?');
  await panel.locator('.bc-send').click();
  const botMsg = panel.locator('.bc-msg.bot').last();
  await expect(botMsg).toContainText('gün batımı turu');
  const botText = await botMsg.innerText();
  expect(botText).not.toContain('hidden');
  expect(botText).not.toContain('[[flags:');

  // Reservation confirmation displays Mimo happy thank-you message and mimo-happy.svg
  await page.goto('/booking.html?service=bb-sunset&lang=tr');
  await page.locator('#date').fill(new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10));
  await page.locator('#date').dispatchEvent('change');
  await page.fill('#hotelName', 'Test Sultanahmet Hotel');
  await page.fill('#fullName', 'Deniz Kaya');
  await page.fill('#phone', '+905551112233');
  await page.fill('#email', 'deniz@example.org');
  await page.check('#ack');
  await page.click('#submit');

  const thanks = page.locator('#result .mimo-thanks');
  await expect(thanks).toBeVisible();
  await expect(thanks.locator('.mimo-thanks-text')).toContainText('Harika seçim');
  const thanksImg = thanks.locator('img.mimo-thanks-img');
  await expect(thanksImg).toHaveAttribute('src', /mimo-happy\.svg$/);
});

test('Mimo voice reply: default off, persists toggle, plays /v1/tts Audio MP3, animates avatar, stops Audio on mic/send/close/pagehide', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ttsMock = {
      voices: [
        { lang: 'en-US', name: 'English', localService: true },
        { lang: 'tr-TR', name: 'Yelda', localService: true },
      ],
      spoken: [],
      cancels: 0,
      lastUtterance: null,
    };
    window.__audioMock = { played: 0, paused: 0, srcs: [], failPlay: false, last: null };
    window.Audio = class MockAudio {
      constructor(src) {
        this.src = src;
        this.onended = null;
        this.onerror = null;
        window.__audioMock.srcs.push(src);
        window.__audioMock.last = this;
      }
      play() {
        if (window.__audioMock.failPlay) {
          return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
        }
        window.__audioMock.played += 1;
        return Promise.resolve();
      }
      pause() { window.__audioMock.paused += 1; }
      removeAttribute() {}
      load() {}
    };
    class MockUtterance {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.voice = null;
        this.pitch = 1;
        this.rate = 1;
        this.onend = null;
        this.onerror = null;
      }
    }
    window.SpeechSynthesisUtterance = MockUtterance;
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices() { return window.__ttsMock.voices; },
        speak(u) {
          window.__ttsMock.spoken.push({ text: u.text, lang: u.lang, voiceLang: u.voice && u.voice.lang, pitch: u.pitch, rate: u.rate });
          window.__ttsMock.lastUtterance = u;
        },
        cancel() {
          window.__ttsMock.cancels += 1;
        },
        addEventListener() {},
      },
    });
    window.SpeechRecognition = class {
      start() {}
      stop() {}
    };
  });

  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("ts-tts-1"),5);return 1},reset(){}};',
    });
  });

  const ttsBodies = [];
  const ttsAuths = [];
  await page.route('**/v1/tts', async (route) => {
    ttsBodies.push(route.request().postDataJSON());
    ttsAuths.push(route.request().headers().authorization || '');
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
      body: Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x01, 0x02, 0x03]),
    });
  });

  let n = 0;
  await page.route('**/v1/assistant', async (route) => {
    n += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reply: n === 1
          ? '**Sabah Boğaz Turu** kişi başı **25 EUR** 🌊⛵ Detaylar: https://bosphorly.com/booking.html?service=bb-morning&lang=tr\n[[flags:abuse=0;handoff=0]]'
          : 'IST transferi **60 EUR** [Bilgi](https://bosphorly.com/index.html#booking) 💙',
        handoff: false,
        lang: 'tr',
        chatSession: 'sess-tts',
      }),
    });
  });

  await page.goto('/index.html?lang=tr');
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();

  // Default state is OFF
  const ttsToggle = panel.locator('.bc-tts-toggle');
  await expect(ttsToggle).toBeVisible();
  await expect(ttsToggle).toHaveAttribute('role', 'switch');
  await expect(ttsToggle).toHaveAttribute('aria-checked', 'false');
  await expect(ttsToggle).toContainText('Sesli cevap');
  const toggleBox = await ttsToggle.boundingBox();
  expect(toggleBox.height).toBeGreaterThanOrEqual(44);

  // Sending a message does NOT auto-speak while switch is OFF
  await panel.locator('.bc-input').fill('Boğaz turu fiyatı nedir?');
  await panel.locator('.bc-send').click();
  const botMsg = panel.locator('.bc-msg.bot').last();
  await expect(botMsg).toContainText('25 EUR');
  expect(await page.evaluate(() => window.__audioMock.played)).toBe(0);
  expect(await page.evaluate(() => window.__ttsMock.spoken.length)).toBe(0);

  // Per-message 🔊 button has >= 44px touch target & localized aria-label
  const speakBtn = panel.locator('.bc-speak-btn').last();
  await expect(speakBtn).toBeVisible();
  await expect(speakBtn).toHaveAttribute('aria-label', 'Mesajı sesli oku');
  const sbBox = await speakBtn.boundingBox();
  expect(sbBox.width).toBeGreaterThanOrEqual(44);
  expect(sbBox.height).toBeGreaterThanOrEqual(44);

  // Click 🔊 -> requests /v1/tts with Bearer chatSession and plays Audio MP3, keeps speechSynthesis idle, switches Mimo avatar
  await speakBtn.click();
  await expect.poll(async () => page.evaluate(() => window.__audioMock.played)).toBe(1);
  expect(await page.evaluate(() => window.__ttsMock.spoken.length)).toBe(0);
  expect(ttsAuths[0]).toBe('Bearer sess-tts');
  expect(ttsBodies[0].lang).toBe('tr');
  expect(ttsBodies[0].text).toContain('Sabah Boğaz Turu kişi başı 25 EUR');
  expect(ttsBodies[0].text).not.toMatch(/\*\*|🌊|⛵|https?:|bosphorly\.com|bağlantı|\[\[flags/i);

  await expect(speakBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(speakBtn).toHaveAttribute('aria-label', 'Okumayı durdur');
  await expect(panel.locator('.bc-head-avatar')).toHaveAttribute('src', /mimo-speaking\.svg$/);
  await expect(panel.locator('.bc-head-avatar')).toHaveClass(/bc-speaking/);
  await expect(panel.locator('.bc-bot-avatar').last()).toHaveAttribute('src', /mimo-speaking\.svg$/);

  // Click again -> pauses Audio, cancels speech, resets avatar
  await speakBtn.click();
  expect(await page.evaluate(() => window.__audioMock.paused)).toBeGreaterThanOrEqual(1);
  await expect(speakBtn).toHaveAttribute('aria-pressed', 'false');
  await expect(panel.locator('.bc-head-avatar')).not.toHaveClass(/bc-speaking/);

  // Clicking mic button stops active Audio immediately
  await speakBtn.click();
  await expect.poll(async () => page.evaluate(() => window.__audioMock.played)).toBe(2);
  const pausedBeforeMic = await page.evaluate(() => window.__audioMock.paused);
  await panel.locator('.bc-mic').click();
  expect(await page.evaluate(() => window.__audioMock.paused)).toBeGreaterThan(pausedBeforeMic);
  await expect(panel.locator('.bc-head-avatar')).not.toHaveClass(/bc-speaking/);
  await panel.locator('.bc-mic').click();

  // Sending a new message stops active Audio immediately
  await speakBtn.click();
  await expect.poll(async () => page.evaluate(() => window.__audioMock.played)).toBe(3);
  const pausedBeforeSend = await page.evaluate(() => window.__audioMock.paused);
  await panel.locator('.bc-input').fill('Transfer fiyatı nedir?');
  await panel.locator('.bc-send').click();
  expect(await page.evaluate(() => window.__audioMock.paused)).toBeGreaterThan(pausedBeforeSend);
  await expect(panel.locator('.bc-msg.bot').last()).toContainText('60 EUR');

  // Enable "Sesli cevap" switch -> stored in localStorage and persists across reload
  await ttsToggle.click();
  await expect(ttsToggle).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => localStorage.getItem('bosphorly.mimo_tts'))).toBe('1');

  await page.reload();
  await page.locator('.bc-fab').click();
  await expect(panel.locator('.bc-tts-toggle')).toHaveAttribute('aria-checked', 'true');

  // Auto-speaks new reply via /v1/tts Audio; closing panel & pagehide stop Audio
  await panel.locator('.bc-input').fill('Transfer fiyatı tekrar?');
  await panel.locator('.bc-send').click();
  await expect.poll(async () => page.evaluate(() => window.__audioMock.played)).toBe(1);
  expect(ttsBodies[ttsBodies.length - 1].text).toContain('IST transferi 60 EUR Bilgi');

  const pausedBeforeClose = await page.evaluate(() => window.__audioMock.paused);
  await panel.locator('.bc-close').click();
  expect(await page.evaluate(() => window.__audioMock.paused)).toBeGreaterThan(pausedBeforeClose);

  await page.locator('.bc-fab').click();
  await panel.locator('.bc-speak-btn').last().click();
  await expect.poll(async () => page.evaluate(() => window.__audioMock.played)).toBe(2);
  const pausedBeforeUnload = await page.evaluate(() => window.__audioMock.paused);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => window.__audioMock.paused)).toBeGreaterThan(pausedBeforeUnload);
});

test('Mimo voice reply falls back silently to speechSynthesis (pitch=1.2, rate=1.05) on {fallback:true} or autoplay reject, and stops on new message', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.addInitScript(() => {
    window.__fbTts = { spoken: [], cancels: 0 };
    window.__fbAudio = { failPlay: false };
    window.Audio = class MockAudio {
      play() {
        if (window.__fbAudio.failPlay) {
          return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
        }
        return Promise.resolve();
      }
      pause() {}
      removeAttribute() {}
      load() {}
    };
    window.SpeechSynthesisUtterance = class {
      constructor(t) { this.text = t; this.lang = ''; this.voice = null; this.pitch = 1; this.rate = 1; }
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices() { return [{ lang: 'tr-TR', name: 'Yelda', localService: true }]; },
        speak(u) { window.__fbTts.spoken.push({ text: u.text, lang: u.lang, pitch: u.pitch, rate: u.rate }); },
        cancel() { window.__fbTts.cancels += 1; },
        addEventListener() {},
      },
    });
  });

  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("ts-fb-1"),5);return 1},reset(){}};',
    });
  });

  let ttsMode = 'fallback';
  const fbAuths = [];
  await page.route('**/v1/tts', async (route) => {
    fbAuths.push(route.request().headers().authorization || '');
    if (ttsMode === 'unauth') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Chat session required' }) });
      return;
    }
    if (ttsMode === 'fallback') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fallback: true }) });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' },
      body: Buffer.from([0x49, 0x44, 0x33, 0x04]),
    });
  });

  await page.route('**/v1/assistant', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'Boğaz sabah turu 25 EUR 😊 Hadi çıkalım!', handoff: false, lang: 'tr', chatSession: 'sess-fb' }),
    });
  });

  await page.goto('/index.html?lang=tr');
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');

  // Before any chatSession exists, clicking 🔊 skips /v1/tts and falls back silently to browser speechSynthesis
  await panel.locator('.bc-speak-btn').first().click();
  await expect.poll(async () => page.evaluate(() => window.__fbTts.spoken.length)).toBe(1);
  expect(fbAuths.length).toBe(0);
  const s1 = await page.evaluate(() => window.__fbTts.spoken[0]);
  expect(s1.lang).toBe('tr-TR');
  expect(s1.pitch).toBeCloseTo(1.2, 2);
  expect(s1.rate).toBeCloseTo(1.05, 2);

  // Sending a new message cancels browser speechSynthesis immediately and receives chatSession
  const cancelsBeforeNewMsg = await page.evaluate(() => window.__fbTts.cancels);
  await panel.locator('.bc-input').fill('Yeni soru');
  await panel.locator('.bc-send').click();
  expect(await page.evaluate(() => window.__fbTts.cancels)).toBeGreaterThan(cancelsBeforeNewMsg);
  await expect(panel.locator('.bc-msg.bot').last()).toContainText('25 EUR');

  // Now with chatSession, /v1/tts gets Bearer token; { fallback: true } falls back silently
  await panel.locator('.bc-speak-btn').last().click();
  await expect.poll(async () => page.evaluate(() => window.__fbTts.spoken.length)).toBe(2);
  expect(fbAuths[0]).toBe('Bearer sess-fb');

  // Stop active playback UI, then verify 401 from /v1/tts also falls back silently to speechSynthesis
  await panel.locator('.bc-speak-btn').last().click();
  ttsMode = 'unauth';
  await panel.locator('.bc-speak-btn').last().click();
  await expect.poll(async () => page.evaluate(() => window.__fbTts.spoken.length)).toBe(3);

  // When /v1/tts returns MP3 but Audio.play() is blocked, falls back silently without pageerror
  await panel.locator('.bc-speak-btn').last().click();
  ttsMode = 'mp3';
  await page.evaluate(() => { window.__fbAudio.failPlay = true; });
  await panel.locator('.bc-speak-btn').last().click();
  await expect.poll(async () => page.evaluate(() => window.__fbTts.spoken.length)).toBe(4);
  const s4 = await page.evaluate(() => window.__fbTts.spoken[3]);
  expect(s4.text).toBe('Boğaz sabah turu 25 EUR. Hadi çıkalım!');
  expect(s4.pitch).toBeCloseTo(1.2, 2);
  expect(s4.rate).toBeCloseTo(1.05, 2);
  expect(pageErrors).toEqual([]);
});

test('Mimo voice reply waits for full SSE completion (never chunk-by-chunk), strips [[flags]], and supports RTL header layout', async ({ page }) => {
  await page.addInitScript(() => {
    window.__sseTts = { spoken: [], cancels: 0 };
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ''; this.voice = null; this.pitch = 1; this.rate = 1; } };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices() {
          return [
            { lang: 'tr-TR', name: 'Yelda', localService: true },
            { lang: 'he-IL', name: 'Carmit', localService: true },
            { lang: 'ar-SA', name: 'Maged', localService: true },
            { lang: 'fa-IR', name: 'Dariush', localService: true },
          ];
        },
        speak(u) { window.__sseTts.spoken.push({ text: u.text, lang: u.lang, voiceLang: u.voice && u.voice.lang }); },
        cancel() { window.__sseTts.cancels += 1; },
        addEventListener() {},
      },
    });
    try { localStorage.setItem('bosphorly.mimo_tts', '1'); } catch {}
  });
  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("ts-sse-tts"),5);return 1},reset(){}};',
    });
  });
  await page.route('**/v1/tts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fallback: true }) });
  });

  await page.goto('/index.html?lang=tr');
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();

  await page.evaluate(() => {
    const enc = new TextEncoder();
    const origFetch = window.fetch.bind(window);
    window.fetch = async (url, init) => {
      if (String(url).includes('/v1/assistant')) {
        const stream = new ReadableStream({
          async start(c) {
            c.enqueue(enc.encode('event: session\ndata: {"chatSession":"sess-sse"}\n\n'));
            c.enqueue(enc.encode('event: delta\ndata: {"t":"Gün batımı turu "}\n\n'));
            await new Promise((r) => setTimeout(r, 40));
            window.__spokenMidStream = window.__sseTts.spoken.length;
            c.enqueue(enc.encode('event: delta\ndata: {"t":"yaklaşık 20 EUR ⛵ "}\n\n'));
            await new Promise((r) => setTimeout(r, 40));
            c.enqueue(enc.encode('event: done\ndata: {"reply":"Gün batımı turu yaklaşık 20 EUR ⛵ https://bosphorly.com/booking.html?service=bb-sunset&lang=tr\\n[[flags:abuse=0;handoff=0]]","handoff":false,"lang":"tr","chatSession":"sess-sse"}\n\n'));
            c.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        });
      }
      return origFetch(url, init);
    };
  });

  await panel.locator('.bc-input').fill('Akşam turu');
  await panel.locator('.bc-send').click();
  await expect.poll(async () => page.evaluate(() => window.__sseTts.spoken.length)).toBe(1);
  expect(await page.evaluate(() => window.__spokenMidStream)).toBe(0);
  const spokenDone = await page.evaluate(() => window.__sseTts.spoken[0]);
  expect(spokenDone.lang).toBe('tr-TR');
  expect(spokenDone.text).toBe('Gün batımı turu yaklaşık 20 EUR');
  expect(spokenDone.text).not.toMatch(/flags|https?:|bosphorly\.com|⛵/);

  // Verify RTL languages (he, ar, fa) keep header and voice controls inside viewport with zero overflow
  for (const lang of ['he', 'ar', 'fa']) {
    await page.goto(`/index.html?lang=${lang}`);
    await page.locator('.bc-fab').click();
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute('dir', 'rtl');
    await expect(panel.locator('.bc-tts-toggle')).toBeVisible();
    await expect(panel.locator('.bc-speak-btn').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.locator('.bc-close').click();
  }
});

test('Mimo voice reply shows localized noVoiceDevice note when /v1/tts falls back without local voice, hides fa controls, and disables animation in reduced-motion', async ({ page }) => {
  await page.addInitScript(() => {
    window.__ttsSpokenNoVoice = 0;
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices() { return [{ lang: 'en-US', name: 'EnglishOnly', localService: true }]; },
        speak() { window.__ttsSpokenNoVoice += 1; },
        cancel() {},
        addEventListener() {},
      },
    });
  });
  await page.route('https://challenges.cloudflare.com/**', async (route) => {
    await route.fulfill({
      contentType: 'text/javascript',
      body: 'window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback("ts-tts-2"),5);return 1},reset(){}};',
    });
  });
  await page.route('**/v1/tts', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ fallback: true }) });
  });
  await page.route('**/v1/assistant', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'Transfer kostet 60 EUR.', handoff: false, lang: 'de', chatSession: 'sess-de' }),
    });
  });

  // Chirp supports DE, so controls show; if /v1/tts returns fallback and device has no DE voice, .bc-tts-note explains cleanly
  await page.goto('/index.html?lang=de');
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.bc-tts-toggle')).toBeVisible();
  await expect(panel.locator('.bc-speak-btn').first()).toBeVisible();

  await panel.locator('.bc-input').fill('Transfer Preis?');
  await panel.locator('.bc-send').click();
  await expect(panel.locator('.bc-msg.bot').last()).toContainText('60 EUR');
  await panel.locator('.bc-speak-btn').last().click();
  const ttsNote = panel.locator('.bc-tts-note');
  await expect(ttsNote).toBeVisible();
  await expect(ttsNote).toContainText('Auf deinem Gerät ist keine Stimme für diese Sprache verfügbar');
  await expect(panel.locator('.bc-head-avatar')).not.toHaveClass(/bc-speaking/);
  expect(await page.evaluate(() => window.__ttsSpokenNoVoice)).toBe(0);

  // Chirp does NOT support fa; when device also lacks Persian voice, controls remain hidden
  await page.goto('/index.html?lang=fa');
  await page.locator('.bc-fab').click();
  await expect(panel.locator('.bc-tts-toggle')).toBeHidden();
  await expect(panel.locator('.bc-speak-btn').first()).toBeHidden();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.Audio = class MockAudio {
      play() { return Promise.resolve(); }
      pause() {}
      removeAttribute() {}
      load() {}
    };
    window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices() { return [{ lang: 'tr-TR', name: 'Yelda', localService: true }]; },
        speak() {},
        cancel() {},
        addEventListener() {},
      },
    });
  });
  await page.goto('/index.html?lang=tr');
  await page.locator('.bc-fab').click();
  await expect(panel.locator('.bc-tts-toggle')).toBeVisible();
  await panel.locator('.bc-speak-btn').first().click();
  const headAv = panel.locator('.bc-head-avatar');
  await expect(headAv).toHaveClass(/bc-speaking/);
  expect(await headAv.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});
