import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.route(/^https:\/\//, route => route.abort());
});

test('desktop introduction docks once, then the launcher lazy-loads chat', async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/?lang=tr');
  const intro = page.locator('.mimo-intro');
  const fab = page.locator('.bc-fab');
  await expect(intro.getByText('Merhaba! Ben Mimo')).toBeVisible();
  await expect(page.locator('script[src*="assistant-chat.js"]')).toHaveCount(0);
  await expect(intro).toHaveCount(0, {timeout:3000});
  await expect(fab).toHaveCSS('width','76px');
  await expect(page.locator('.bc-launcher-label')).toHaveText('Mimo’ya sor 💬');
  await fab.click();
  await expect(page.locator('.bc-panel')).toBeVisible();
  await expect(fab).toBeHidden();
  await page.reload();
  await expect(intro).toHaveCount(0);
  await expect(fab).toBeVisible();
});

test('reduced motion opens directly on the desktop launcher', async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('.mimo-intro')).toHaveCount(0);
  await expect(page.locator('.bc-launcher')).toHaveCSS('opacity','1');
  expect(await page.evaluate(() => localStorage.getItem('bosphorly.mimo_intro'))).toBe('1');
});

test('390px corner welcome runs once and yields to the existing greeting', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => { window.__BOSPHORLY_MIMO_BUBBLE_MS = 150; });
  await page.goto('/?lang=tr');
  const note = page.locator('.mimo-intro');
  await expect(note).toHaveText('Merhaba! Ben Mimo');
  await expect(note).toBeVisible();
  await expect(note).toHaveCSS('pointer-events', 'none');
  await expect(note.locator('span')).toHaveAttribute('aria-live', 'polite');
  await expect(note.locator('img')).toHaveAttribute('src', /mimo-wave\.webp$/);
  await expect(page.locator('.bc-fab')).toHaveCSS('width','54px');
  await expect(page.locator('.bc-bubble')).toBeHidden();
  await expect(note).toHaveCount(0, {timeout:3000});
  await expect(page.locator('.bc-bubble')).toBeVisible();
  await page.reload();
  await expect(note).toHaveCount(0);
  await expect(page.locator('.bc-bubble-text')).toHaveText('Tekrar hoş geldin!');
});

test('390px reduced motion bypasses the corner welcome', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('.mimo-intro')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('bosphorly.mimo_intro'))).toBe('1');
});

// Real launcher and chat scripts, with deterministic free/occupied space beside the FAB.
// The production home page may legitimately have no room after its fonts load.
async function openCornerFixture(page, occupied = false) {
  await page.setViewportSize({width:390,height:844});
  await page.route('**/corner-fixture*', route => route.fulfill({
    contentType:'text/html; charset=utf-8',
    body:`<!doctype html><html dir="rtl" lang="ar"><meta name="viewport" content="width=device-width">
      <body>${occupied ? '<button style="position:fixed;bottom:0;left:75px;width:300px;height:165px;background:white">Covered area</button>' : ''}
      <script src="/config/api.js"></script><script defer src="/mimo-intro.js?v=html-entry"></script></body></html>`
  }));
  await page.goto('/corner-fixture?lang=ar');
}

test('390px launcher remains tappable during the RTL welcome', async ({page}) => {
  await openCornerFixture(page);
  const note = page.locator('.mimo-intro');
  await expect(note).toBeVisible();
  const fab = page.locator('.bc-fab');
  const button = await fab.boundingBox();
  expect(button.x + button.width).toBe(390 - 16);
  await page.keyboard.press('Escape');
  await fab.click();
  await expect(page.locator('.bc-panel')).toBeVisible();
  await expect(note).toHaveCount(0);
});

test('RTL label sits to the left and an intro click reaches the page', async ({page}) => {
  await page.setViewportSize({width:1200,height:800});
  await page.goto('/?lang=ar');
  const intro = page.locator('.mimo-intro');
  await expect(intro).toHaveAttribute('dir','rtl');
  const label = await page.locator('.bc-launcher-label').boundingBox();
  const button = await page.locator('.bc-fab').boundingBox();
  expect(label.x + label.width).toBeLessThanOrEqual(button.x);
  await page.evaluate(() => {
    const control = document.createElement('button');
    control.id = 'intro-click-target';
    control.style.cssText = 'position:fixed;top:50%;left:50%;width:44px;height:44px;z-index:940';
    control.onclick = () => { control.textContent = 'clicked'; };
    document.body.append(control);
  });
  await page.locator('#intro-click-target').click();
  await expect(page.locator('#intro-click-target')).toHaveText('clicked');
  await expect(intro).toHaveCount(0);
});

test('an occupied corner keeps the welcome hidden and the launcher tappable', async ({page}) => {
  await openCornerFixture(page, true);
  await expect(page.locator('.mimo-intro')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.mimo-intro')).toBeHidden();
  await page.locator('.bc-fab').click();
  await expect(page.locator('.bc-panel')).toBeVisible();
});

test('a second script URL cannot start another introduction in the same document', async ({page}) => {
  await openCornerFixture(page);
  await expect(page.locator('.mimo-intro')).toBeVisible();
  // Remove the session guard to exercise the independent document-level guard.
  await page.evaluate(() => localStorage.removeItem('bosphorly.mimo_intro'));
  await page.addScriptTag({url:'/mimo-intro.js?v=another-release'});
  expect(await page.evaluate(() => localStorage.getItem('bosphorly.mimo_intro'))).toBeNull();
  await expect(page.locator('.mimo-intro')).toHaveCount(1);
});

for (const [label, destination] of [['Tur bul', '/tours.html?lang=tr'], ['Transfer', '/index.html?lang=tr#booking'], ['Sadece bakıyorum', null]]) {
  test(label + ' works without loading chat or calling AI', async ({page}) => {
    await page.emulateMedia({reducedMotion:'reduce'});
    const requests = [];
    page.on('request', r => {
      if (/assistant-chat\.js|\/v1\/(?:assistant|mimo|chat)/.test(r.url())) requests.push(r.url());
    });
    await page.goto('/?lang=tr');
    await page.locator('.bc-bubble-chip').filter({hasText:label}).click();
    if (destination) await expect(page).toHaveURL(url => url.pathname + url.search + url.hash === destination);
    else await expect(page.locator('.bc-bubble')).toBeHidden();
    expect(requests).toEqual([]);
  });
}

test('closing welcome suppresses it for the visit even without the intro script', async ({page}) => {
  await page.route('**/mimo-intro.js*', route => route.abort());
  await page.goto('/?lang=tr');
  await page.locator('.bc-bubble-close').click();
  await page.reload();
  await page.waitForTimeout(3500);
  await expect(page.locator('.bc-bubble')).toBeHidden();
});

test('returning visitor gets only a brief greeting, personalized for a signed-in member', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('bosphorly.mimo_intro','1');
    window.__BOSPHORLY_MIMO_COLLAPSE_MS = 900;
  });
  await openCornerFixture(page);
  const bubble = page.locator('.bc-bubble');
  await expect(bubble).toBeVisible();
  await expect(bubble.locator('.bc-bubble-text')).toHaveText('أهلاً بعودتك!');
  await expect(bubble.locator('.bc-bubble-chip')).toHaveCount(0);
  await expect(bubble).toBeHidden();
  await page.addInitScript(() => { window.BosphorlyMember = {signedIn:()=>true, cachedProfile:()=>({name:'Eren'})}; });
  await page.goto('/corner-fixture?lang=tr');
  await expect(bubble.locator('.bc-bubble-text')).toHaveText('Tekrar hoş geldin, Eren 💙');
});

test('launcher stays at its physical bottom-right inset while scrolling', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  for (const width of [390,1280,1440]) {
    await page.setViewportSize({width,height:844});
    await page.goto('/?lang=he');
    const fab = page.locator('.bc-fab');
    const before = await fab.boundingBox();
    const inset = width === 390 ? 16 : 24;
    expect(width - before.x - before.width).toBe(inset);
    expect(844 - before.y - before.height).toBe(inset);
    await page.evaluate(() => window.scrollTo({top:600,behavior:'instant'}));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await fab.boundingBox()).toEqual(before);
  }
});
