import { test, expect } from '@playwright/test';

// Hotel pickups (hotel → airport, or both ways) need a room number; an area that is not on the list needs an address.
test('transfer direction: room number required for hotel pickups, address for unlisted areas', async ({ page }) => {
  await page.route('https://**/*', r => r.abort());
  await page.goto('/index.html?lang=en');
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

  await page.click('[data-dir="both"]');
  await page.fill('#hotel', 'Test Hotel');
  await page.selectOption('#zone', 'other');
  await page.fill('#arrivalDate', day(5));
  await page.click('#toStep2');
  await expect(page.locator('#formError')).toContainText('address');
  await page.fill('#hotelAddress', 'Example Street 12');
  await page.fill('#returnDate', day(9));
  await page.click('#toStep2');
  await expect(page.locator('#step2')).toBeVisible();
  await expect(page.locator('#room')).toBeVisible();

  await page.fill('#guestName', 'Test Guest');
  await page.fill('#phone', '+44 7700 900123');
  await page.fill('#email', 'guest@example.com');
  for (const f of await page.locator('#passengerList input').all()) await f.fill('Test');
  await page.fill('#pickupTime', '06:30');
  await page.click('#toStep3');
  await expect(page.locator('#formError')).toContainText('room number');
  await page.fill('#room', '214');
  await page.click('#toStep3');
  await page.check('#terms');
  await page.click('#submitDemo');
  const text = await page.locator('#result pre').textContent();
  expect(text).toContain('Room: 214');
  expect(text).toContain('Address: Example Street 12');
  expect(text).toContain('Hotel pickup:');

  // Airport → hotel asks for no room number.
  await page.goto('/index.html?lang=en');
  await expect(page.locator('#roomWrap')).toBeHidden();
});
