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
});
