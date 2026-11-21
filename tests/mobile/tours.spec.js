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

test('special tours page lists tours on request with an email question and category filters', async ({ page }) => {
  await page.goto('/tours.html?lang=tr');
  await expect(page.locator('h1')).toHaveText('Temalı, özel ve çok günlü turlar.');
  await expect(page.locator('.place')).toHaveCount(15);
  await expect(page.locator('#jewish-heritage .from-price')).toContainText('Başlangıç');
  // Details: route, what is usually included and the prices other companies publish, with their sources.
  await page.locator('#jewish-heritage summary').click();
  await expect(page.locator('#jewish-heritage .td-route li')).toHaveCount(6);
  await expect(page.locator('#jewish-heritage .td-block.inc li').first()).toHaveText('Lisanslı rehber');
  // Market price range only: no company names and no links to other companies' websites.
  await expect(page.locator('#jewish-heritage .td-market li')).toHaveCount(3);
  await expect(page.locator('#jewish-heritage .td-market li').first()).toContainText('özel tur');
  await expect(page.locator('#jewish-heritage .td-fine')).toContainText('Bosphorly üzerinden talep edin');
  const outside = await page.locator('main a[href^="http"]').evaluateAll(as => as.map(a => a.href));
  expect(outside).toEqual([]);
  expect(await page.locator('main').innerText()).not.toContain('Les Arts Turcs');
  const href = await page.locator('#jewish-heritage .actions a[href^="mailto:"]').getAttribute('href');
  expect(decodeURIComponent(href)).toContain("İstanbul'un Yahudi mirası");
  await page.locator('.chip[data-cat="private"]').click();
  await expect(page.locator('.place')).toHaveCount(3);
  await expect(page.locator('#toSeeAlso')).toBeHidden();
  await page.locator('.chip[data-cat="multi"]').click();
  await expect(page.locator('#toSeeAlso')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('a special tour is requested through Bosphorly with a reference code and kept in My account', async ({ page }) => {
  
  await page.goto('/tours.html?lang=tr&cat=hoods');
  const card = page.locator('#kadikoy-moda');
  await card.getByRole('button', { name: /Bu turu talep et/ }).click();
  await expect(card.locator('form.tf')).toBeVisible();
  await card.locator('.tf-send').click();
  await expect(card.locator('.tf-err')).toBeVisible();
  const d = new Date(); d.setDate(d.getDate() + 5);
  await card.locator('input[name=date]').fill(d.toLocaleDateString('sv-SE'));
  await card.locator('input[name=guests]').fill('3');
  await card.locator('input[name=hotel]').fill('Sultanahmet Palace');
  await card.locator('input[name=name]').fill('Ayşe Yılmaz');
  await card.locator('input[name=phone]').fill('+90 555 000 00 00');
  await card.locator('input[name=ack]').check();
  await card.locator('.tf-send').click();
  const emailHref = await card.locator('.tf-done a[href^="mailto:"]').getAttribute('href');
  expect(emailHref).toContain('info@bosphorly.com');
  const text = decodeURIComponent(emailHref.split('&body=')[1]);
  expect(text).toMatch(/^Bosphorly tur talebi · BOS-[A-Z0-9]{6}/);
  expect(text).toContain('Kadıköy ve Moda lezzet yürüyüşü');
  expect(text).toContain('Kişi sayısı: 3');
  await expect(card.locator('.tf-done')).toContainText('BOS-');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bosphorly.account')));
  expect(saved.requests).toHaveLength(1);
  expect(saved.requests[0]).toMatchObject({ type: 'tour', title: 'Kadıköy ve Moda lezzet yürüyüşü', guests: 3, status: 'email_draft_prepared' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
