import {test,expect} from '@playwright/test';
test('multilingual sample membership has separate optional consent and no PII submission',async({page})=>{
 const writes=[];const errors=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/membership.html?lang=tr');
 await expect(page.locator('#country option')).toHaveCount(250);
 await expect(page.locator('#fullName')).toBeDisabled();await expect(page.locator('#email')).toBeDisabled();
 await expect(page.locator('#marketing')).not.toBeChecked();
 await page.locator('#country').selectOption('TR');await page.locator('#terms').check();await page.locator('#privacy').check();
 await page.locator('#memberForm button').click();await expect(page.locator('#account')).toBeVisible();await expect(page.locator('#preferences')).toContainText('kapalı');
 await page.locator('#reset').click();await page.locator('#country').selectOption('GB');await page.locator('#terms').check();await page.locator('#privacy').check();await page.locator('#marketing').check();await page.locator('#memberForm button').click();await expect(page.locator('#preferences')).toContainText('açık');await page.locator('#withdraw').click();await expect(page.locator('#preferences')).toContainText('kapalı');
 for(const lang of ['en','tr','ar','ru']) {await page.locator('#language').selectOption(lang);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);}
 expect(await page.evaluate(()=>localStorage.length+sessionStorage.length)).toBe(0);expect(writes).toEqual([]);expect(errors).toEqual([]);
});
