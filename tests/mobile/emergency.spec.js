import { test, expect } from '@playwright/test';

test('fail-closed default: when /v1/public/channels fails (503 or network error), WhatsApp/Telegram/Instagram buttons stay hidden while site & Mimo button still render', async ({ page }) => {
  await page.route('**/v1/public/channels*', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }) })
  );

  await page.goto('/index.html?lang=tr');
  // Tour cards and Mimo 360px button keep working
  await expect(page.locator('.tour-card')).toHaveCount(6);
  await expect(page.locator('.bc-fab')).toBeVisible();
  // All external social/messaging buttons stay hidden on endpoint failure
  await expect(page.locator('.hero .social-hero')).toBeHidden();
  await expect(page.locator('#heroTelegram')).toBeHidden();
  await expect(page.locator('#heroMimoTg')).toBeHidden();
  await expect(page.locator('#footerTelegramWrap')).toBeHidden();
  await expect(page.locator('footer .social-whatsapp')).toBeHidden();
  await expect(page.locator('footer .social-instagram')).toBeHidden();
  await expect(page.locator('#bosphorlyEmergencyBanner')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('individual channel switches hide WhatsApp, Telegram, Instagram links, show Mimo localized maintenance, and render top warning banner cleanly at 360/390/768px', async ({ page }) => {
  // 1) WhatsApp OFF + warning banner ON
  await page.route('**/v1/public/channels*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        whatsapp: false,
        telegram: true,
        instagram: true,
        mimo: true,
        banner: 'WhatsApp hesabımız geçici olarak kapalıdır. Bize yalnızca info@bosphorly.com üzerinden ulaşın.',
      }),
    })
  );

  await page.goto('/index.html?lang=tr');
  const banner = page.locator('#bosphorlyEmergencyBanner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('WhatsApp hesabımız geçici olarak kapalıdır.');
  await expect(banner.locator('a[href="mailto:info@bosphorly.com"]')).toBeVisible();
  await expect(page.locator('.hero .social-hero')).toBeHidden();
  await expect(page.locator('footer .social-whatsapp')).toBeHidden();
  await expect(page.locator('#heroTelegram')).toBeVisible();
  await expect(page.locator('footer .social-instagram')).toBeVisible();

  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.bc-wa-link')).toBeHidden();
  await expect(panel.locator('.bc-tg-link')).toBeVisible();
  await panel.locator('.bc-close').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

  // Mimo static page also hides WhatsApp link + chat header link
  await page.goto('/mimo/tr.html');
  await expect(page.locator('main a[href*="wa.me/"]')).toBeHidden();
  await expect(page.locator('.bc-wa-link')).toBeHidden();
  await expect(page.locator('main a[href*="t.me/"]')).toBeVisible();

  // 2) Telegram OFF + Instagram OFF + Mimo Web OFF (maintenance mode in TR and EN)
  await page.unroute('**/v1/public/channels*');
  await page.route('**/v1/public/channels*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        whatsapp: true,
        telegram: false,
        instagram: false,
        mimo: false,
        banner: '',
      }),
    })
  );

  await page.goto('/index.html?lang=tr');
  await expect(page.locator('#bosphorlyEmergencyBanner')).toHaveCount(0);
  await expect(page.locator('.hero .social-hero')).toBeVisible();
  await expect(page.locator('#heroTelegram')).toBeHidden();
  await expect(page.locator('#heroMimoTg')).toBeHidden();
  await expect(page.locator('footer .social-instagram')).toBeHidden();

  await page.locator('.bc-fab').click();
  await expect(page.locator('.bc-panel')).toBeVisible();
  await expect(page.locator('.bc-panel .bc-maintenance-row')).toContainText(
    'Şu an bakımdayız, bize info@bosphorly.com adresinden ulaşabilirsiniz.'
  );
  await expect(page.locator('.bc-panel .bc-input')).toBeDisabled();
  await expect(page.locator('.bc-panel .bc-send')).toBeDisabled();
  await page.locator('.bc-panel .bc-close').click();

  await page.goto('/index.html?lang=en');
  await page.locator('.bc-fab').click();
  await expect(page.locator('.bc-panel .bc-maintenance-row')).toContainText('info@bosphorly.com');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('Extranet Acil Durum panel is visible ONLY to owner (hidden for admin/staff), supports 1-click close, requires "AÇ" to reopen, and shows env-locked state', async ({ page }) => {
  let state = {
    channels: {
      whatsapp: { enabled: true, stored: true, lockedByEnv: false, envVar: 'WHATSAPP_DISABLED' },
      telegram: { enabled: true, stored: true, lockedByEnv: true, envVar: 'TELEGRAM_DISABLED' },
      instagram: { enabled: true, stored: true, lockedByEnv: false, envVar: 'INSTAGRAM_DISABLED' },
      mimo: { enabled: true, stored: true, lockedByEnv: false, envVar: 'MIMO_DISABLED' },
    },
    banner: '',
    audit: [],
  };
  state.channels.telegram.enabled = false;

  // Admin does NOT see #navEmergency
  await page.route('https://**/v1/extranet/session', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        csrfToken: 'csrf-admin',
        user: { id: 'adm-1', email: 'admin@bosphorly.example', name: 'Admin User', role: 'admin' },
      }),
    })
  );
  await page.route('https://**/v1/extranet/dashboard', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ periods: { today: {}, week: {}, month: {} }, recentBookings: [], statusBreakdown: {} }) })
  );
  await page.goto('/extranet/');
  await expect(page.locator('#appShell')).toBeVisible();
  await expect(page.locator('#navEmergency')).toBeHidden();

  // Owner sees #navEmergency and manages switches
  await page.unroute('https://**/v1/extranet/session');
  await page.route('https://**/v1/extranet/session', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        csrfToken: 'csrf-owner',
        user: { id: 'own-1', email: 'owner@bosphorly.example', name: 'Owner', role: 'owner' },
      }),
    })
  );
  await page.route('https://**/v1/extranet/emergency', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
    }
    const body = JSON.parse(route.request().postData() || '{}');
    if (body.channel) {
      if (body.enabled === true && String(body.confirmText || '').trim() !== 'AÇ') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Kanalı yeniden açmak için onay alanına "AÇ" yazmalısınız.', code: 'OPEN_CONFIRM_REQUIRED' }),
        });
      }
      state.channels[body.channel].enabled = body.enabled;
      state.channels[body.channel].stored = body.enabled;
    }
    if (body.banner !== undefined) state.banner = body.banner;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...state, saved: true, emailSent: true }) });
  });

  await page.goto('/extranet/');
  await expect(page.locator('#navEmergency')).toBeVisible();
  await page.locator('#navEmergency').click();
  await expect(page.locator('#viewEmergency')).toBeVisible();

  // Env-locked Telegram displays "Ortam değişkeniyle kilitli"
  const tgCard = page.locator('.ex-em-card[data-channel="telegram"]');
  await expect(tgCard).toContainText('Ortam değişkeniyle kilitli (TELEGRAM_DISABLED=1)');

  // 1-click close with confirm dialog on WhatsApp
  page.once('dialog', (d) => d.accept());
  const waCard = page.locator('.ex-em-card[data-channel="whatsapp"]');
  await waCard.locator('button[data-action="close-channel"]').click();
  await expect(waCard.locator('.ex-em-badge')).toHaveText('KAPALI');

  // Reopen fails without typing "AÇ", succeeds with "AÇ"
  await waCard.locator('form[data-action="open-channel-form"] input').fill('evet');
  await waCard.locator('form[data-action="open-channel-form"] button[type="submit"]').click();
  await expect(waCard).toContainText('AÇ');
  await expect(waCard.locator('.ex-em-badge')).toHaveText('KAPALI');

  await waCard.locator('form[data-action="open-channel-form"] input').fill('AÇ');
  await waCard.locator('form[data-action="open-channel-form"] button[type="submit"]').click();
  await expect(waCard.locator('.ex-em-badge')).toHaveText('AÇIK');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
