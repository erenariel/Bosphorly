import { test, expect } from '@playwright/test';

test('Extranet gate, passkey setup prompt, mobile responsiveness (360/390/768), and owner vs staff UI', async ({ page }) => {
  // 1. Unauthenticated gate view
  await page.route('https://**/v1/extranet/session', (r) =>
    r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ authenticated: false }) })
  );

  await page.goto('/extranet/');
  await expect(page.locator('#gateScreen')).toBeVisible();
  await expect(page.locator('#appShell')).toBeHidden();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('.bc-fab')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

  // 2. First-time member sign-in prompts mandatory Passkey setup
  await page.route('https://**/v1/auth/start', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sent: true }) })
  );
  await page.route('https://**/v1/auth/verify', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'mem-tok-1', member: { email: 'staff@bosphorly.example' } }),
    })
  );
  await page.route('https://**/v1/extranet/auth/status', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authorized: true,
        hasPasskey: false,
        step: 'setup_passkey',
        user: { id: 'u1', email: 'staff@bosphorly.example', role: 'staff' },
      }),
    })
  );

  await page.locator('#loginEmail').fill('staff@bosphorly.example');
  await page.locator('#btnSendCode').click();
  await expect(page.locator('#emailVerifyForm')).toBeVisible();
  await page.locator('#loginCode').fill('123456');
  await page.locator('#btnVerifyCode').click();
  await expect(page.locator('#stepSetupPasskey')).toBeVisible();
  await expect(page.locator('#btnEnrollPasskey')).toBeVisible();

  // 3. Authenticated Workspace (Owner role): Dashboard, Bookings, Masked PII reveal with X-CSRF-Token, and zero overflow
  let sentCsrfHeader = '';
  await page.unroute('https://**/v1/extranet/session');
  await page.route('https://**/v1/extranet/session', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        csrfToken: 'csrf-test-999',
        idleTimeoutSeconds: 1800,
        user: { id: 'owner-1', email: 'owner@bosphorly.example', name: 'Proje Sahibi', role: 'owner' },
      }),
    })
  );
  await page.route('https://**/v1/extranet/dashboard', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-11-24 12:00:00',
        periods: {
          today: { newRequests: 4, confirmed: 2, cancelled: 1, newMembers: 3, estimatedCommission: { EUR: 3600, TRY: 0, USD: 0, GBP: 0 } },
          week: { newRequests: 15, confirmed: 9, cancelled: 2, newMembers: 11, estimatedCommission: { EUR: 14500, TRY: 0, USD: 0, GBP: 0 } },
          month: { newRequests: 48, confirmed: 31, cancelled: 4, newMembers: 29, estimatedCommission: { EUR: 52000, TRY: 0, USD: 0, GBP: 0 } },
        },
        statusBreakdown: { new: 2, in_progress: 1, confirmed: 2, completed: 5, cancelled: 1 },
        recentBookings: [
          {
            uid: 'mr:BOS-MOB001',
            recordType: 'member_request',
            recordId: 'BOS-MOB001',
            displayRef: 'BOS-MOB001',
            productId: 'bb-sunset',
            productTitle: 'Boğaz Gün Batımı Turu',
            serviceDate: '2026-12-20',
            serviceTime: '18:00',
            guests: 2,
            priceDisplay: '€120',
            currency: 'EUR',
            status: 'new',
            allowedNextStatuses: ['in_progress', 'cancelled'],
            paymentStatus: 'pending',
            providerId: 'prov-bosphorus',
            source: 'member',
            lang: 'tr',
            memberTier: 'platinum',
            guestName: 'Elif Demir',
            guestEmailMasked: 'e***r@example.com',
            guestPhoneMasked: '+90 *** ** 88',
            hasEmail: true,
            hasPhone: true,
            coupon: { code: 'BOS-PLAT-10', percentBps: 1000, status: 'held', kind: 'platinum' },
            createdAt: '2026-11-24 10:30:00',
          },
        ],
      }),
    })
  );
  await page.route('https://**/v1/extranet/bookings?**', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            uid: 'mr:BOS-MOB001',
            recordType: 'member_request',
            recordId: 'BOS-MOB001',
            displayRef: 'BOS-MOB001',
            productId: 'bb-sunset',
            productTitle: 'Boğaz Gün Batımı Turu',
            serviceDate: '2026-12-20',
            guests: 2,
            priceDisplay: '€120',
            currency: 'EUR',
            status: 'new',
            paymentStatus: 'pending',
            providerId: 'prov-bosphorus',
            source: 'member',
            lang: 'tr',
            memberTier: 'platinum',
            guestName: 'Elif Demir',
            guestEmailMasked: 'e***r@example.com',
            hasEmail: true,
            createdAt: '2026-11-24 10:30:00',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        filterOptions: { products: [{ id: 'bb-sunset', title: 'Boğaz Gün Batımı Turu' }], sources: ['member'], languages: ['tr'] },
      }),
    })
  );
  await page.route('https://**/v1/extranet/bookings/mr%3ABOS-MOB001', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        booking: {
          uid: 'mr:BOS-MOB001',
          recordType: 'member_request',
          recordId: 'BOS-MOB001',
          displayRef: 'BOS-MOB001',
          productId: 'bb-sunset',
          productTitle: 'Boğaz Gün Batımı Turu',
          serviceDate: '2026-12-20',
          guests: 2,
          priceDisplay: '€120',
          currency: 'EUR',
          status: 'new',
          allowedNextStatuses: ['in_progress', 'cancelled'],
          paymentStatus: 'pending',
          providerId: 'prov-bosphorus',
          provider: { id: 'prov-bosphorus', status: 'verified', currency: 'EUR' },
          source: 'member',
          lang: 'tr',
          memberTier: 'platinum',
          guestName: 'Elif Demir',
          guestEmailMasked: 'e***r@example.com',
          guestPhoneMasked: '+90 *** ** 88',
          hasEmail: true,
          hasPhone: true,
          coupon: { code: 'BOS-PLAT-10', percentBps: 1000, status: 'held', kind: 'platinum' },
          events: [],
          internalNotes: [],
          createdAt: '2026-11-24 10:30:00',
        },
        availableProviders: [{ id: 'prov-bosphorus', status: 'verified', currency: 'EUR' }],
      }),
    })
  );
  await page.route('https://**/v1/extranet/bookings/mr%3ABOS-MOB001/reveal-pii', (r) => {
    sentCsrfHeader = r.request().headers()['x-csrf-token'] || '';
    return r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ field: 'email', value: 'elif.demir@example.com' }),
    });
  });

  await page.goto('/extranet/');
  await expect(page.locator('#appShell')).toBeVisible();
  await expect(page.locator('#kpiNewRequests')).toHaveText('4');
  await expect(page.locator('#kpiCommission')).toContainText('€36');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

  // Switch to Reservations view & check Owner CSV button
  await page.locator('#navBookings').click();
  await expect(page.locator('#viewBookings')).toBeVisible();
  await expect(page.locator('#btnExportCsv')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();

  // Open detail drawer & reveal masked email
  await page.locator('#bookingsTableContainer button', { hasText: 'Detay' }).click();
  await expect(page.locator('#bookingDetailDrawer')).toBeVisible();
  await expect(page.locator('#drawerBody')).toContainText('e***r@example.com');
  await page.locator('#drawerBody button', { hasText: 'Göster' }).first().click();
  await expect(page.locator('#drawerBody')).toContainText('elif.demir@example.com');
  expect(sentCsrfHeader).toBe('csrf-test-999');

  // 4. Staff role UI hides CSV export and shows read-only payment/provider controls
  await page.unroute('https://**/v1/extranet/session');
  await page.route('https://**/v1/extranet/session', (r) =>
    r.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        csrfToken: 'csrf-staff-1',
        idleTimeoutSeconds: 1800,
        user: { id: 'staff-1', email: 'staff@bosphorly.example', name: 'Operasyon Ekibi', role: 'staff' },
      }),
    })
  );
  await page.goto('/extranet/');
  await page.locator('#navBookings').click();
  await expect(page.locator('#btnExportCsv')).toBeHidden();
  await page.locator('#bookingsTableContainer button', { hasText: 'Detay' }).click();
  await expect(page.locator('#drawerBody')).toContainText('yalnızca Owner ve Admin rolleri değiştirebilir');
});
