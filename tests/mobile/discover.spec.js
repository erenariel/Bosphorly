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

test('Google rating badge links places to Google; tour companies get an unlinked rating only when one is known', async ({ page }) => {
  await page.route('https://**/*', r => r.abort());
  await page.goto('/explore.html?lang=en&cat=family');
  const first = page.locator('.place .g-rating').first();
  await expect(first).toHaveText(/Google reviews/);
  await expect(first).toHaveAttribute('href', /google\.com\/maps\/search/);

  // Tour companies: their Google page lists their own phone and website, so there is no link, and
  // without a key (no rating to show) there is no badge at all.
  await page.goto('/prices.html?lang=tr');
  await expect(page.locator('article.item').first()).toBeVisible();
  await expect(page.locator('.g-rating:visible')).toHaveCount(0);
  await expect(page.locator('a.g-rating')).toHaveCount(0);

  // With a key, the live lookup fills the badge. Google is replaced by a stub, so no request leaves the test.
  await page.route('**/config/maps-public.js', r => r.fulfill({ contentType: 'text/javascript', body: 'window.BOSPHORLY_PUBLIC_CONFIG=Object.freeze({googleMapsBrowserKey:"test-key"});' }));
  await page.addInitScript(() => {
    class Place { static async searchByText() { return { places: [{ id: 'ChIJtest', rating: 4.66, userRatingCount: 12345 }] }; } }
    window.google = { maps: { importLibrary: async () => ({ Place }) } };
  });
  await page.goto('/prices.html?lang=tr');
  const badge = page.locator('.g-rating').first();
  await badge.evaluate(e => e.parentElement.scrollIntoView());
  await expect(badge).toHaveText(/4,7 \(12\.345\) · Google yorumları/);
  await expect(badge).toBeVisible();
  await expect(badge).not.toHaveAttribute('href', /.+/);
  await expect(badge).toHaveAttribute('title', 'Google’da 12.345 yorumdan ortalama 4,7');
  await expect(page.locator('a.g-rating')).toHaveCount(0);
});
