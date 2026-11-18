import { test, expect } from '@playwright/test';

test('header Transfer opens the airport transfer form on the home page', async ({ page }) => {
  await page.goto('/prices.html?lang=tr');
  const link = page.locator('.site-header nav a', { hasText: 'Transfer' });
  await expect(link).toHaveAttribute('href', 'index.html#booking');
  await link.click();
  await expect(page).toHaveURL(/index\.html#booking$/);
  await expect(page.locator('#step1')).toBeVisible();
  // The form title is not hidden under the sticky header.
  const gap = await page.evaluate(() => document.querySelector('#booking h2').getBoundingClientRect().top - document.querySelector('.site-header').getBoundingClientRect().bottom);
  expect(gap).toBeGreaterThanOrEqual(0);
});

test('special tours page lists tours on request with a WhatsApp question and category filters', async ({ page }) => {
  await page.goto('/tours.html?lang=tr');
  await expect(page.locator('h1')).toHaveText('Temalı, özel ve çok günlü turlar.');
  await expect(page.locator('.place')).toHaveCount(15);
  await expect(page.locator('.place').first()).toContainText('Fiyat talep üzerine');
  const href = await page.locator('#jewish-heritage .btn.wa').getAttribute('href');
  expect(decodeURIComponent(href)).toContain("İstanbul'un Yahudi mirası");
  await page.locator('.chip[data-cat="private"]').click();
  await expect(page.locator('.place')).toHaveCount(3);
  await expect(page.locator('#toSeeAlso')).toBeHidden();
  await page.locator('.chip[data-cat="multi"]').click();
  await expect(page.locator('#toSeeAlso')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
