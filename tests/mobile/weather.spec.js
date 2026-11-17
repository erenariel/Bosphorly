import { test, expect } from '@playwright/test';

// Open-Meteo is replaced by a stub: 16 days from today, rain likely on day 3.
function stub(page) {
  return page.route('https://api.open-meteo.com/**', r => {
    const time = [], code = [], max = [], min = [], rain = [];
    for (let i = 0; i < 16; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      time.push(d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }));
      code.push(i === 2 ? 63 : 1); max.push(18 + i * 0.1); min.push(11); rain.push(i === 2 ? 85 : 10);
    }
    r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ daily: { time, weather_code: code, temperature_2m_max: max, temperature_2m_min: min, precipitation_probability_max: rain } }) });
  });
}

test('home shows a 7-day Istanbul forecast in the page language', async ({ page }) => {
  await stub(page);
  await page.goto('/index.html?lang=tr');
  const wx = page.locator('#weather');
  await expect(wx).toBeVisible();
  await expect(wx.locator('.wx-title')).toHaveText('İstanbul hava durumu');
  await expect(wx.locator('.wx-day')).toHaveCount(7);
  await expect(wx.locator('.wx-rain.wet')).toHaveCount(1);
  await expect(wx.locator('.wx-rain.wet')).toHaveText('💧 %85');
  await expect(wx.locator('.wx-credit')).toHaveAttribute('href', 'https://open-meteo.com/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('request form shows the chosen day and warns about rain for open-air tours only', async ({ page }) => {
  await stub(page);
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }); };
  await page.goto('/booking.html?service=bb-sunset&lang=en');
  await page.fill('#date', day(2)); await page.dispatchEvent('#date', 'change');
  await expect(page.locator('#dateWeather')).toContainText('Forecast for');
  await expect(page.locator('#dateWeather .wx-warn')).toBeVisible();
  await page.fill('#date', day(1)); await page.dispatchEvent('#date', 'change');
  await expect(page.locator('#dateWeather .wx-warn')).toHaveCount(0);
  await page.goto('/booking.html?service=alaturka&lang=en');
  await page.fill('#date', day(2)); await page.dispatchEvent('#date', 'change');
  await expect(page.locator('#dateWeather')).toContainText('Rain');
  await expect(page.locator('#dateWeather .wx-warn')).toHaveCount(0);
  await page.fill('#date', day(30)); await page.dispatchEvent('#date', 'change');
  await expect(page.locator('#dateWeather')).toContainText('not available yet');
});

test('no forecast, no box: the page still works when Open-Meteo is unreachable', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', r => r.abort());
  await page.goto('/index.html?lang=en');
  await expect(page.locator('#weather')).toBeHidden();
});
