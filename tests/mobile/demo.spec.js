import {test,expect} from '@playwright/test';
test('local draft, logo, RTL, map fallback and no collection',async({page})=>{
 const writes=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
 await page.goto('/booking.html?lang=en');
 await expect(page.locator('#offer option')).toHaveCount(6);
 await expect(page.locator('.logo img')).toHaveAttribute('src','assets/brand/approved-icon.webp');
 expect(await page.locator('.logo img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBeTruthy();
 await page.locator('#ack').check();await page.locator('#submit').click();
 await expect(page.locator('#error')).toBeVisible();
 await page.locator('#fullName').fill('Test Guest');await page.locator('#phone').fill('+90 555 000 00 00');await page.locator('#submit').click();
 await expect(page.locator('#error')).toBeHidden();
 await expect(page.locator('#result')).toHaveAttribute('data-state','draft');
 await expect(page.locator('#result')).toContainText('NOT SENT');
 for(const dir of ['ltr','rtl']) {
 await page.locator('html').evaluate((e,d)=>e.dir=d,dir);
 expect(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth||e.getBoundingClientRect().left<0).map(e=>e.tagName+'.'+e.className)}))).toMatchObject({scroll:page.viewportSize().width});
 }
 expect(await page.evaluate(()=>localStorage.length+sessionStorage.length)).toBe(0);
 expect(await page.context().cookies()).toHaveLength(0);
 expect(writes).toEqual([]);
 await page.route('https://**/*',r=>r.abort());
 await page.goto('/map.html');
 await expect(page.locator('#mapFallback')).toBeVisible();
 expect(await page.locator('#mapFallback img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBeTruthy();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
