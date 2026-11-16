import {test,expect} from '@playwright/test';
test('editable multilingual membership validates inputs without transmitting personal data',async({page})=>{
 const writes=[];const errors=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/membership.html?lang=tr');
 await expect(page.locator('#country option')).toHaveCount(250);
 await expect(page.locator('#fullName')).toBeEditable();await expect(page.locator('#email')).toBeEditable();
 await expect(page.locator('#fullName')).toHaveValue('');await expect(page.locator('#email')).toHaveValue('');
 await page.locator('#continueMembership').click();await expect(page.locator('#account')).toBeHidden();
 await page.locator('#fullName').fill('Synthetic Guest');await page.locator('#email').fill('synthetic@example.invalid');
 await expect(page.locator('#preferredLanguage')).toHaveValue('tr');
 await expect(page.locator('#marketing')).not.toBeChecked();
 await page.locator('#country').selectOption('TR');await page.locator('#terms').check();await page.locator('#privacy').check();
 await page.locator('#memberForm button').click();await expect(page.locator('#account')).toBeVisible();await expect(page.locator('#account')).toContainText('bilgileriniz gönderilmedi');await expect(page.locator('#memberForm')).toBeVisible();await expect(page.locator('#preferences')).toContainText('kapalı');
 await page.locator('#reset').click();await expect(page.locator('#fullName')).toHaveValue('');await page.locator('#fullName').fill('Synthetic Guest');await page.locator('#email').fill('synthetic@example.invalid');await page.locator('#country').selectOption('GB');await page.locator('#terms').check();await page.locator('#privacy').check();await page.locator('#marketing').check();await page.locator('#memberForm button').click();await expect(page.locator('#preferences')).toContainText('açık');await page.locator('#withdraw').click();await expect(page.locator('#preferences')).toContainText('kapalı');
 for(const lang of ['en','tr','ar','ru']) {await page.locator('#language').selectOption(lang);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);await expect(page.locator('body')).not.toContainText(/demo|sample|örnek|демонстрац|تجريبي/i);}
 expect(await page.evaluate(()=>localStorage.length+sessionStorage.length)).toBe(0);expect(writes).toEqual([]);expect(errors).toEqual([]);
});
