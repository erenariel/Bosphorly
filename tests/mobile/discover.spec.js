import { test, expect } from '@playwright/test';

// The Discover, Route and Search pages work from local data, even when the map tiles cannot load.
test('discover catalogue filters, searches and links to WhatsApp', async ({ page }) => {
  await page.route('https://**/*', r => r.abort());
  await page.goto('/explore.html?lang=en');
  await expect(page.locator('.place')).toHaveCount(33);
  await page.getByRole('button', { name: 'Family & fun' }).click();
  await expect(page.locator('.place')).toHaveCount(6);
  await page.fill('#q', 'vialand');
  await expect(page.locator('.place')).toHaveCount(1);
  await expect(page.locator('.place h3')).toContainText('Isfanbul');
  const wa = await page.locator('.place .btn.wa').getAttribute('href');
  expect(wa).toContain('https://wa.me/905333407776?text=');
  expect(decodeURIComponent(wa)).toContain('Isfanbul');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('route page lists 13 stops over two days, in Turkish too', async ({ page }) => {
  await page.route('https://**/*', r => r.abort());
  await page.goto('/route.html?lang=tr');
  await expect(page.locator('.stop')).toHaveCount(13);
  await expect(page.locator('.rt-day')).toHaveCount(2);
  await expect(page.locator('h1')).toContainText('İlber Ortaylı');
  await expect(page.locator('.rt-day .btn.primary').first()).toHaveAttribute('href', /travelmode=walking/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('site search finds places by old names and the route by the historian’s name', async ({ page }) => {
  await page.route('https://**/*', r => r.abort());
  await page.goto('/search.html?lang=en&q=aqua%20florya');
  await expect(page.locator('.sr-item').first()).toContainText('Istanbul Aquarium');
  await page.fill('#q', 'ilber ortayli');
  await expect(page.locator('.sr-item[href="route.html"]')).toHaveCount(1);
  await page.fill('#q', 'bosphorus');
  await expect(page.locator('.sr-group')).not.toHaveCount(0);
});
