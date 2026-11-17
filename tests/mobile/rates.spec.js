import { test, expect } from '@playwright/test';

// When the site's rates file is stale, the browser takes the day's market rates instead and says so.
test('stale rates file falls back to live market rates with an honest note', async ({ page }) => {
  await page.route('**/data/rates.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({
    kind: 'tcmb', source_name: 'TCMB', date: '01.01.2020', base: 'TRY', rates: { EUR: { unit: 1, forex_selling: 30 }, USD: { unit: 1, forex_selling: 28 } } }) }));
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ date: '2026-11-17', try: { eur: 0.02, usd: 0.025, gbp: 0.015 } }) }));
  await page.goto('/prices.html?lang=en');
  const sel = page.locator('.currency-select').first();
  await expect(sel).toHaveAttribute('title', 'Market rate of 17.11.2026 (currency-api)');
  expect(await page.evaluate(() => window.BosphorlyCurrency.rates.rates.EUR.forex_selling)).toBe(50);
});

test('fresh TCMB file is used as is, without calling the market source', async ({ page }) => {
  const d = new Date(); const date = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  await page.route('**/data/rates.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({
    kind: 'tcmb', source_name: 'TCMB', date, base: 'TRY', rates: { EUR: { unit: 1, forex_selling: 55 }, USD: { unit: 1, forex_selling: 50 } } }) }));
  let market = 0;
  await page.route('https://cdn.jsdelivr.net/**', r => { market++; r.abort(); });
  await page.goto('/prices.html?lang=tr');
  await expect(page.locator('.currency-select').first()).toHaveAttribute('title', 'TCMB ' + date + ' kuru');
  expect(market).toBe(0);
});
