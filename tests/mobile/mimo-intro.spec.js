import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.route(/^https:\/\//, route => route.abort());
});

test('desktop introduction docks once, then the launcher lazy-loads chat', async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await page.goto('/?lang=tr');
  const intro = page.locator('.mimo-intro');
  const fab = page.locator('.bc-fab');
  await expect(intro.getByText('Hoş geldin, ben Mimo 👋')).toBeVisible();
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
  expect(await page.evaluate(() => sessionStorage.getItem('bosphorly.mimo_intro'))).toBeNull();
});

test('390px corner welcome runs once and yields to the existing greeting', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => { window.__BOSPHORLY_MIMO_BUBBLE_MS = 150; });
  await page.goto('/?lang=tr');
  const note = page.locator('.bc-mobile-welcome');
  await expect(note).toHaveText('Hoş geldin, ben Mimo 👋');
  await expect(note).toBeVisible();
  await expect(note).toHaveCSS('pointer-events', 'none');
  await expect(note).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.bc-fab-avatar')).toHaveCSS('animation-name','mimo-corner-hop');
  await expect(page.locator('.bc-fab')).toHaveCSS('width','54px');
  await expect(page.locator('.mimo-intro')).toHaveCount(0);
  await expect(page.locator('.bc-bubble')).toBeHidden();
  await expect(note).toHaveCount(0, {timeout:3000});
  await expect(page.locator('.bc-bubble')).toBeVisible();
  await page.reload();
  await expect(note).toHaveCount(0);
  await expect(page.locator('.bc-mobile-hop')).toHaveCount(0);
});

test('390px reduced motion bypasses the corner welcome', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');
  await expect(page.locator('.bc-mobile-welcome, .bc-mobile-hop')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('bosphorly.mimo_intro'))).toBeNull();
});

test('390px launcher remains tappable during the RTL welcome', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/?lang=ar');
  const note = page.locator('.bc-mobile-welcome');
  await expect(note).toBeVisible();
  const fab = page.locator('.bc-fab');
  const button = await fab.boundingBox();
  expect((await note.boundingBox()).x).toBeGreaterThan(button.x + button.width);
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
