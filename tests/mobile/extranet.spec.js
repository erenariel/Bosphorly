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
      body: JSON.stringify({ token: 'mem-tok-1', extranetTicket:'fresh-proof', member: { email: 'staff@bosphorly.example' } }),
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

  await page.route('https://**/v1/extranet/auth/email',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({authenticated:true,csrfToken:'email-csrf',user:{id:'u1',email:'staff@bosphorly.example',role:'staff'}})}));
  await page.route('https://**/v1/extranet/dashboard',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({periods:{today:{},week:{},month:{}},recentBookings:[],statusBreakdown:{}})}));
  await page.locator('#loginEmail').fill('staff@bosphorly.example');
  await page.locator('#btnSendCode').click();
  await expect(page.locator('#emailVerifyForm')).toBeVisible();
  await page.locator('#loginCode').fill('123456');
  await page.locator('#btnVerifyCode').click();
  await expect(page.locator('#appShell')).toBeVisible();
  await expect(page.locator('#gateScreen')).toBeHidden();

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
        timezone: 'Europe/Istanbul',
        localDate: '2026-11-24',
        periods: {
          today: {
            newRequests: 4,
            confirmed: 2,
            cancelled: 1,
            newMembers: 3,
            estimatedCommission: { EUR: 3240, TRY: 0, USD: 0, GBP: 0 },
            grossCommission: { EUR: 3600, TRY: 0, USD: 0, GBP: 0 },
          },
          week: {
            newRequests: 15,
            confirmed: 9,
            cancelled: 2,
            newMembers: 11,
            estimatedCommission: { EUR: 13050, TRY: 0, USD: 0, GBP: 0 },
            grossCommission: { EUR: 14500, TRY: 0, USD: 0, GBP: 0 },
          },
          month: {
            newRequests: 48,
            confirmed: 31,
            cancelled: 4,
            newMembers: 29,
            estimatedCommission: { EUR: 46800, TRY: 0, USD: 0, GBP: 0 },
            grossCommission: { EUR: 52000, TRY: 0, USD: 0, GBP: 0 },
          },
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
  await expect(page.locator('#btnAddPasskey')).toBeVisible();
  await expect(page.locator('#kpiNewRequests')).toHaveText('4');
  await expect(page.locator('#kpiCommission')).toContainText('€32,4');
  await expect(page.locator('#kpiCommissionGross')).toHaveText('brüt €36');
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

test('Membership manual level and automatic reset use CSRF and remain read-only for staff', async ({page}) => {
  let role='owner', manualTier=null;
  await page.route('https://**/v1/extranet/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let body={};
    if(path.endsWith('/session')) body={authenticated:true,csrfToken:'member-csrf',user:{id:'owner',name:'Owner',email:'owner@test.example',role}};
    else if(path.endsWith('/members/m1/tier')) {
      expect(route.request().headers()['x-csrf-token']).toBe('member-csrf');
      const update=route.request().postDataJSON();expect(update.reason).toBe('Özel misafir');manualTier=update.tier==='automatic'?null:update.tier;
      body={tier:manualTier||'silver'};
    } else if(path.endsWith('/members')) body={members:[{id:'m1',name:'Guest',email:'g***@test.example',tier:manualTier||'silver',automaticTier:'silver',manualTier,fulfilledCount:0}],total:1,page:1,pageSize:20};
    else if(path.endsWith('/dashboard')) body={periods:{today:{},week:{},month:{}},recentBookings:[],statusBreakdown:{}};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/extranet/');await page.locator('#navMembers').click();
  await expect(page.locator('#membersMessage')).toHaveText('1 üye');
  await expect(page.locator('.ex-sidebar .ex-brand')).toHaveAttribute('href','/extranet/');
  await page.locator('.ex-sidebar .ex-brand').click();await expect(page.locator('#viewDashboard')).toBeVisible();expect(new URL(page.url()).pathname).toBe('/extranet/');await page.locator('#navMembers').click();await expect(page.locator('#membersMessage')).toHaveText('1 üye');
  page.on('dialog',dialog=>dialog.accept());
  await page.getByLabel('Üyelik seviyesi',{exact:true}).selectOption('platinum');
  await page.getByLabel('İşlem gerekçesi').fill('Özel misafir');await page.getByRole('button',{name:'Seviyeyi kaydet'}).click();
  await expect(page.locator('#membersList')).toContainText('Elle atandı');
  await page.getByLabel('Üyelik seviyesi',{exact:true}).selectOption('automatic');
  await page.getByLabel('İşlem gerekçesi').fill('Özel misafir');await page.getByRole('button',{name:'Seviyeyi kaydet'}).click();
  await expect(page.locator('#membersList')).toContainText('Geçerli: silver');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  role='staff';await page.reload();await page.locator('#navMembers').click();
  await expect(page.locator('#membersMessage')).toHaveText('1 üye');await expect(page.getByRole('button',{name:'Seviyeyi kaydet'})).toHaveCount(0);
});

test('Stage 2 inbox reply requires preview and second confirmation; mobile layout remains usable',async({page})=>{
 let sent=false;
 const template={subject:'Talebiniz',body:'Merhaba, talebinizi aldık.'};
 await page.route('https://**/v1/extranet/**',async route=>{
  const path=new URL(route.request().url()).pathname;let body={};
  if(path.endsWith('/session'))body={authenticated:true,csrfToken:'stage2-csrf',user:{id:'staff',name:'Staff',email:'staff@test.example',role:'staff'}};
  else if(path.endsWith('/dashboard'))body={periods:{today:{},week:{},month:{}},recentBookings:[],statusBreakdown:{}};
  else if(path.endsWith('/messages'))body={messages:[{id:'inbox1',subject:'Transfer talebi',source:'form',status:sent?'replied':'new',email:'g***@test.example',created_at:'2026-11-25'}],total:1,page:1,pageSize:20};
  else if(path.endsWith('/messages/inbox1'))body={subject:'Transfer talebi',body:'Havalimanı transferi için bilgi istiyorum.',email:'g***@test.example',notes:[],replies:[]};
  else if(path.endsWith('/reply-templates'))body={tr:template,en:template,ru:template};
  else if(path.endsWith('/reply-preview')){expect(route.request().headers()['x-csrf-token']).toBe('stage2-csrf');body={confirmationId:'confirm-mail',preview:{to:'g***@test.example',subject:'Talebiniz',body:'Merhaba, talebinizi aldık.'},requiresConfirmation:true};}
  else if(path.endsWith('/actions/confirm-mail/confirm')){expect(route.request().postDataJSON().confirm).toBe(true);sent=true;body={sent:true};}
  else if(path.endsWith('/members'))body={members:[],total:0,page:1,pageSize:20};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/extranet/');await page.locator('#navInbox').click();await page.getByRole('button',{name:'Mesajı aç'}).click();
 await expect(page.getByLabel('Yanıt metni')).toHaveValue(template.body);
 await page.getByRole('button',{name:'Yanıtı önizle'}).click();await expect(page.locator('dialog[open]')).toContainText(template.body);expect(sent).toBe(false);
 await page.getByRole('button',{name:'Onayla ve uygula'}).click();await expect(page.locator('dialog[open]')).toHaveCount(0);expect(sent).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});

test('Booking email preview never sends before the second confirmation',async({page})=>{
 let sent=false;
 const booking={uid:'mr:BOS-EMAIL',recordType:'member_request',recordId:'BOS-EMAIL',displayRef:'BOS-EMAIL',productId:'bb-sunset',productTitle:'Boğaz turu',serviceDate:'2027-01-01',guests:2,status:'confirmed',allowedNextStatuses:['completed','cancelled'],paymentStatus:'pending',source:'whatsapp',lang:'en',memberTier:'silver',hasEmail:true,guestEmailMasked:'g***@example.com',events:[],internalNotes:[]};
 await page.route('https://**/v1/extranet/**',async route=>{const path=new URL(route.request().url()).pathname;let body={};
 if(path.endsWith('/session'))body={authenticated:true,csrfToken:'booking-csrf',user:{id:'staff',role:'staff'}};
 else if(path.endsWith('/dashboard'))body={periods:{today:{},week:{},month:{}},statusBreakdown:{},recentBookings:[]};
 else if(path.endsWith('/bookings'))body={items:[booking],total:1,page:1,totalPages:1,filterOptions:{products:[],sources:['whatsapp'],languages:['en']}};
 else if(path.endsWith('/email-preview')){expect(route.request().headers()['x-csrf-token']).toBe('booking-csrf');body={confirmationId:'draft',preview:{to:'g***@example.com',subject:'Booking confirmation',body:'Your booking has been confirmed.'}};}
 else if(path.endsWith('/email-confirm')){expect(route.request().postDataJSON()).toEqual({confirmationId:'draft',confirm:true});sent=true;body={sent:true};}
 else body={booking,availableProviders:[]};
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.goto('/extranet/');await page.locator('#navBookings').click();await page.getByRole('button',{name:'Detay →',exact:true}).click();await page.getByRole('button',{name:'E-postayı önizle'}).click();
 await expect(page.locator('dialog.ex-card[open]')).toContainText('Your booking has been confirmed.');expect(sent).toBe(false);await page.getByRole('button',{name:'Onayla ve gönder'}).click();await expect.poll(()=>sent).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
