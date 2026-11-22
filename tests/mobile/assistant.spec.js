import { test, expect } from '@playwright/test';

async function expectChatPanelLayout(page, panel) {
  const vp = page.viewportSize();
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  const expectedW = vp.width <= 480 ? vp.width - 24 : (vp.width >= 1440 ? 460 : 420);
  const expectedH = vp.width <= 480 ? vp.height * 0.85 : Math.min(640, vp.height * 0.82);
  expect(Math.abs(box.width - expectedW)).toBeLessThanOrEqual(2);
  expect(Math.abs(box.height - expectedH)).toBeLessThanOrEqual(2);
  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);

  const metrics = await panel.evaluate((el) => {
    const cs = (node) => getComputedStyle(node);
    const log = el.querySelector('.bc-log');
    const msg = el.querySelector('.bc-msg');
    const msgCs = cs(msg);
    const handoff = el.querySelector('.bc-handoff');
    const quick = el.querySelector('.bc-quick');
    return {
      logH: log.getBoundingClientRect().height,
      panelH: el.getBoundingClientRect().height,
      title: cs(el.querySelector('.bc-title')).fontSize,
      msg: msgCs.fontSize,
      lineHeight: msgCs.lineHeight,
      input: cs(el.querySelector('.bc-input')).fontSize,
      handoffHidden: handoff.hidden || cs(handoff).display === 'none',
      quickWrap: cs(quick).flexWrap,
      tgMin: parseFloat(cs(el.querySelector('.bc-tg-link')).minHeight),
    };
  });
  expect(metrics.logH / metrics.panelH).toBeGreaterThanOrEqual(0.6);
  expect(metrics.title).toBe('16px');
  expect(metrics.msg).toBe('15px');
  expect(parseFloat(metrics.lineHeight) / 15).toBeCloseTo(1.5, 1);
  expect(metrics.input).toBe(vp.width <= 480 ? '16px' : '15px');
  expect(metrics.handoffHidden).toBe(true);
  expect(metrics.quickWrap).toBe('wrap');
  expect(metrics.tgMin).toBeGreaterThanOrEqual(44);
  await expect(panel.locator('.bc-handoff')).toBeHidden();
  const closeHit = await panel.locator('.bc-close').evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return top === el || el.contains(top);
  });
  expect(closeHit).toBe(true);
  const send = await panel.locator('.bc-send').boundingBox();
  const input = await panel.locator('.bc-input').boundingBox();
  expect(send.y + send.height).toBeLessThanOrEqual(box.y + box.height + 1);
  expect(input.y + input.height).toBeLessThanOrEqual(box.y + box.height + 1);
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

  // Talk to a human toggles email input
  await panel.locator('.bc-human-btn').click();
  await expect(panel.locator('.bc-handoff')).toBeVisible();
  await expect(panel.locator('.bc-handoff input[type="email"]')).toBeVisible();
  const vp = page.viewportSize();
  const emailSize = await panel.locator('.bc-handoff input[type="email"]').evaluate((el) => getComputedStyle(el).fontSize);
  expect(emailSize).toBe(vp.width <= 480 ? '16px' : '15px');
  const openBox = await panel.boundingBox();
  const logBox = await panel.locator('.bc-log').boundingBox();
  expect(logBox.height / openBox.height).toBeGreaterThanOrEqual(0.6);
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


test('email handoff stays hidden until a human is requested, and quick actions scroll on one line after the first message', async ({ page }) => {
  let calls = 0;
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
  await expect(panel).toBeVisible();
  await expect(panel.locator('.bc-handoff')).toBeHidden();
  await expect(panel.locator('.bc-quick')).not.toHaveClass(/bc-quick-scroll/);

  const input = panel.locator('.bc-input');
  const sendBtn = panel.locator('.bc-send');
  await page.waitForTimeout(80);
  await input.fill('Boğaz turu saat kaçta?');
  await sendBtn.click();
  await expect(panel.locator('.bc-msg.user')).toContainText('Boğaz turu saat kaçta?');
  await expect(panel.locator('.bc-handoff')).toBeHidden();

  const quick = panel.locator('.bc-quick');
  await expect(quick).toHaveClass(/bc-quick-scroll/);
  const quickStyle = await quick.evaluate((el) => {
    const cs = getComputedStyle(el);
    const btn = getComputedStyle(el.querySelector('.bc-quick-btn'));
    return {
      wrap: cs.flexWrap,
      overflowX: cs.overflowX,
      whiteSpace: btn.whiteSpace,
      shrink: btn.flexShrink,
      scrolls: el.scrollWidth > el.clientWidth + 1,
    };
  });
  expect(quickStyle.wrap).toBe('nowrap');
  expect(quickStyle.overflowX).toBe('auto');
  expect(quickStyle.whiteSpace).toBe('nowrap');
  expect(quickStyle.shrink).toBe('0');
  if (page.viewportSize().width <= 480) expect(quickStyle.scrolls).toBe(true);

  await input.fill('Bir insana bağla');
  await sendBtn.click();
  await expect(panel.locator('.bc-msg.bot').last()).toContainText('Ekibimize iletiyorum.');
  await expect(panel.locator('.bc-handoff')).toBeVisible();
  const logRatio = await panel.evaluate((el) => {
    const log = el.querySelector('.bc-log').getBoundingClientRect().height;
    return log / el.getBoundingClientRect().height;
  });
  expect(logRatio).toBeGreaterThanOrEqual(0.6);
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
