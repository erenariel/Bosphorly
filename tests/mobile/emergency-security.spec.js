import { test, expect } from '@playwright/test';

test('Public channel fail-closed safety: buttons start hidden before /v1/public/channels resolves and stay hidden on 503 while website and booking work normally', async ({ page }) => {
  let releaseChannels;
  const gatePromise = new Promise((resolve) => {
    releaseChannels = resolve;
  });

  await page.route('**/v1/public/channels', async (route) => {
    await gatePromise;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Channel status temporarily unavailable' }),
    });
  });

  await page.goto('/index.html?lang=tr');

  // 1. Before /v1/public/channels resolves, WhatsApp, Telegram, and Instagram buttons MUST be hidden
  await expect(page.locator('#heroTelegram')).toBeHidden();
  await expect(page.locator('#heroMimoTg')).toBeHidden();
  await expect(page.locator('.hero .social-hero')).toBeHidden();
  await expect(page.locator('#footerTelegramWrap')).toBeHidden();
  await expect(page.locator('footer .social-whatsapp')).toBeHidden();
  await expect(page.locator('footer .social-instagram')).toBeHidden();

  // 2. Release with 503 failure -> buttons remain safely hidden, zero horizontal overflow, and page/booking still works!
  releaseChannels();
  await page.waitForTimeout(150);
  await expect(page.locator('#heroTelegram')).toBeHidden();
  await expect(page.locator('.hero .social-hero')).toBeHidden();
  await expect(page.locator('footer .social-instagram')).toBeHidden();
  await expect(page.locator('h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

  // Booking page works normally even when /v1/public/channels fails
  await page.goto('/booking.html?service=bb-sunset&lang=tr');
  await expect(page.locator('#submit')).toBeVisible();
  await page.locator('#date').fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  await page.locator('#date').dispatchEvent('change');
  await page.fill('#hotelName', 'Sultanahmet Test Hotel');
  await page.fill('#fullName', 'Test Misafir');
  await page.fill('#phone', '+90 555 000 00 00');
  await page.check('#ack');
  await page.click('#submit');
  await expect(page.locator('#result')).toBeVisible();
  await expect(page.locator('#result a.tg-after')).toBeHidden();
});

test('Independent channel switches, open-tab <=60s polling, Mimo Web AI localized maintenance mode, and XSS-safe security banner across mobile & RTL', async ({ page }) => {
  await page.addInitScript(() => {
    window.__BOSPHORLY_CHANNELS_POLL_MS = 1200;
  });

  let state = {
    channels: { whatsapp: false, telegram: true, instagram: true, mimo: true },
    banner: {
      enabled: true,
      text: 'WhatsApp hesabımız geçici olarak kapalıdır. <img src=x onerror="window.__bannerXss=1">',
      translations: {
        tr: 'WhatsApp hesabımız geçici olarak kapalıdır. Başka numaralardan gelen mesajlara itibar etmeyin. Bize yalnızca info@bosphorly.com üzerinden ulaşın.',
        ar: 'حسابنا على واتساب مغلق مؤقتًا. تواصلوا معنا فقط عبر info@bosphorly.com.',
      },
    },
  };

  await page.route('**/v1/public/channels', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state),
    })
  );

  await page.goto('/index.html?lang=tr');

  // WhatsApp is hidden, while Telegram and Instagram remain visible!
  await expect(page.locator('.hero .social-hero')).toBeHidden();
  await expect(page.locator('footer .social-whatsapp')).toBeHidden();
  await expect(page.locator('#heroTelegram')).toBeVisible();
  await expect(page.locator('footer .social-instagram')).toBeVisible();

  // Security banner is visible, XSS-safe, and switches to RTL Arabic cleanly
  const banner = page.locator('#bosphorlySecurityBanner');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('WhatsApp hesabımız geçici olarak kapalıdır');
  expect(await page.evaluate(() => window.__bannerXss)).toBeUndefined();
  expect(await banner.locator('img, script').count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

  // Switch to custom XSS payload without preset to prove raw text is rendered solely via textContent
  state = {
    channels: { whatsapp: false, telegram: false, instagram: true, mimo: false },
    banner: {
      enabled: true,
      text: '<img src=x onerror="window.__bannerXss=2">Güvenlik duyurusu: info@bosphorly.com',
    },
  };

  // Open tab automatically polls within 1.2s (<=60s production requirement) and hides newly closed Telegram + switches Mimo to maintenance!
  await expect(page.locator('#heroTelegram')).toBeHidden({ timeout: 4000 });
  await expect(page.locator('#heroMimoTg')).toBeHidden();
  await expect(page.locator('footer .social-instagram')).toBeVisible();
  await expect(banner).toContainText('<img src=x onerror="window.__bannerXss=2">Güvenlik duyurusu: info@bosphorly.com');
  expect(await page.evaluate(() => window.__bannerXss)).toBeUndefined();
  expect(await banner.locator('img, script').count()).toBe(0);

  // Opening Mimo Web AI while mimo=false shows localized Turkish maintenance message and disables chat input
  await page.locator('.bc-fab').click();
  const panel = page.locator('.bc-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.bc-wa-link')).toBeHidden();
  await expect(panel.locator('.bc-tg-link')).toBeHidden();
  await expect(panel.locator('.bc-log')).toContainText(
    'Şu anda bakımdayız. Bize info@bosphorly.com adresinden ulaşabilirsiniz.'
  );
  await expect(panel.locator('.bc-input')).toBeDisabled();
  await expect(panel.locator('.bc-send')).toBeDisabled();

  // Check static Mimo page (mimo/ar.html) in RTL Arabic: WhatsApp & Telegram links + separators hidden, Arabic maintenance shown
  await page.goto('/mimo/ar.html');
  await expect(page.locator('main a[href*="wa.me"]')).toBeHidden();
  await expect(page.locator('main a[href*="t.me/"]')).toBeHidden();
  await expect(page.locator('a[href*="wa.me"]:visible')).toHaveCount(0);
  await expect(page.locator('a[href*="t.me/"]:visible')).toHaveCount(0);
  await expect(page.locator('.bc-panel .bc-log')).toContainText(
    'نحن في وضع الصيانة حاليًا. يمكنكم التواصل معنا عبر info@bosphorly.com.'
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test('Extranet Emergency & Security Center UI: visible ONLY to info@bosphorly.com owner, supports Close + "AÇ" Reopen OTP flows and env-lock indicator on mobile without overflow', async ({ page }) => {
  let sessionUser = { id: 'adm-1', email: 'other-owner@bosphorly.example', name: 'Diğer Owner', role: 'owner' };

  await page.route('https://**/v1/extranet/session', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        csrfToken: 'csrf-emg-1',
        idleTimeoutSeconds: 1800,
        user: sessionUser,
      }),
    })
  );
  await page.route('https://**/v1/extranet/dashboard', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        periods: { today: {}, week: {}, month: {} },
        statusBreakdown: {},
        recentBookings: [],
      }),
    })
  );

  // 1. Even another 'owner' account MUST NOT see #navEmergency
  await page.goto('/extranet/');
  await expect(page.locator('#appShell')).toBeVisible();
  await expect(page.locator('#navEmergency')).toBeHidden();

  // 2. Sign in as exclusive owner info@bosphorly.com
  sessionUser = { id: 'emg-owner', email: 'info@bosphorly.com', name: 'Bosphorly Owner', role: 'owner' };
  let waEnabled = true;
  let waPending = false;

  await page.route('https://**/v1/extranet/emergency/status', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        channels: [
          {
            id: 'whatsapp',
            label: 'WhatsApp',
            enabled: waEnabled,
            d1Enabled: waEnabled,
            envLocked: false,
            envVarName: 'WHATSAPP_DISABLED',
            lockWarning: null,
            pendingVerification: waPending,
            updatedAt: '2026-11-27 09:00:00',
            updatedBy: 'info@bosphorly.com',
          },
          {
            id: 'telegram',
            label: 'Telegram',
            enabled: false,
            d1Enabled: true,
            envLocked: true,
            envVarName: 'TELEGRAM_DISABLED',
            lockWarning: 'Ortam değişkeniyle güvenlik kilidi uygulanmış',
            pendingVerification: false,
            updatedAt: null,
            updatedBy: null,
          },
          {
            id: 'instagram',
            label: 'Instagram',
            enabled: true,
            d1Enabled: true,
            envLocked: false,
            envVarName: 'INSTAGRAM_DISABLED',
            lockWarning: null,
            pendingVerification: false,
            updatedAt: null,
            updatedBy: null,
          },
          {
            id: 'mimo',
            label: 'Mimo Web AI',
            enabled: true,
            d1Enabled: true,
            envLocked: false,
            envVarName: 'MIMO_DISABLED',
            lockWarning: null,
            pendingVerification: false,
            updatedAt: null,
            updatedBy: null,
          },
        ],
        banner: { enabled: false, text: '', preset: '', pendingVerification: false },
        presets: [{ key: 'whatsapp_closed', textTr: 'WhatsApp hesabımız geçici olarak kapalıdır.' }],
        pendingVerification: null,
        cooldownRemainingSec: 0,
        telegramRequests: [],
        recentOperations: [],
        auditLogs: [
          {
            id: 'aud-1',
            operation_id: 'op-init',
            created_at: '2026-11-27 08:55:00',
            actor_email: 'admin@bosphorly.example',
            actor_role: 'admin',
            channel: 'security_center',
            action_type: 'unauthorized_access_attempt',
            source: 'extranet',
            outcome: 'failed',
            reason: 'not_exclusive_emergency_owner',
          },
        ],
        configStatus: {
          verifyEmailConfigured: true,
          maskedVerifyEmail: 'p***y@gmail.example',
          emailProviderConfigured: true,
          pendingNotifications: 0,
        },
      }),
    })
  );

  let lastRequestCodePayload = null;
  let lastVerifyPayload = null;

  await page.route('https://**/v1/extranet/emergency/request-code', async (r) => {
    lastRequestCodePayload = r.request().postDataJSON();
    waPending = true;
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        operationId: 'op-live-1',
        targetChannel: lastRequestCodePayload.targetChannel,
        actionType: lastRequestCodePayload.actionType,
        expiresAtMs: Date.now() + 300_000,
        cooldownSec: 60,
        maskedVerifyEmail: 'p***y@gmail.example',
      }),
    });
  });

  await page.route('https://**/v1/extranet/emergency/verify', async (r) => {
    lastVerifyPayload = r.request().postDataJSON();
    waPending = false;
    waEnabled = lastVerifyPayload.actionType === 'reopen';
    await r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        operationId: 'op-live-1',
        targetChannel: 'whatsapp',
        actionType: lastVerifyPayload.actionType,
      }),
    });
  });

  await page.reload();
  await expect(page.locator('#navEmergency')).toBeVisible();
  await page.locator('#navEmergency').click();
  await expect(page.locator('#viewEmergency')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

  // Verify env-locked Telegram card displays lock warning and disables Yeniden Aç button
  const tgCard = page.locator('.emg-channel-card[data-channel="telegram"]');
  await expect(tgCard).toContainText('Ortam değişkeniyle güvenlik kilidi uygulanmış');
  await expect(tgCard.locator('[data-emg-action="reopen-telegram"]')).toBeDisabled();

  // 3. Close WhatsApp flow -> Confirm -> OTP -> Closed
  const waCard = page.locator('.emg-channel-card[data-channel="whatsapp"]');
  await expect(waCard).toContainText('Açık');
  await waCard.locator('[data-emg-action="close-whatsapp"]').click();
  await expect(page.locator('#emergencyVerifyModal')).toBeVisible();
  await page.locator('#btnRequestEmgCode').click();
  await expect(page.locator('#emgVerifyForm')).toBeVisible();
  await expect(waCard).toContainText('Doğrulama bekleniyor');

  await page.locator('#emgOtpInput').fill('654321');
  await page.locator('#btnSubmitEmgOtp').click();
  await expect(waCard).toContainText('Kapalı');
  expect(lastVerifyPayload).toEqual({
    operationId: 'op-live-1',
    code: '654321',
    targetChannel: 'whatsapp',
    actionType: 'close',
  });

  // 4. Reopen WhatsApp flow -> Requires typing exact "AÇ" -> OTP -> Reopened
  await waCard.locator('[data-emg-action="reopen-whatsapp"]').click();
  await expect(page.locator('#emgReopenAcWrap')).toBeVisible();

  // Typing lowercase "aç" is rejected before sending OTP
  await page.locator('#emgReopenConfirmInput').fill('aç');
  await page.locator('#btnRequestEmgCode').click();
  await expect(page.locator('#emgModalAlert')).toContainText('"AÇ"');
  await expect(page.locator('#emgVerifyForm')).toBeHidden();

  // Typing exact "AÇ" sends fresh OTP and verifies reopen
  await page.locator('#emgReopenConfirmInput').fill('AÇ');
  await page.locator('#btnRequestEmgCode').click();
  await expect(page.locator('#emgVerifyForm')).toBeVisible();
  expect(lastRequestCodePayload.confirmReopenText).toBe('AÇ');

  await page.locator('#emgOtpInput').fill('987654');
  await page.locator('#btnSubmitEmgOtp').click();
  await expect(waCard).toContainText('Açık');
  expect(lastVerifyPayload.confirmReopenText).toBe('AÇ');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
