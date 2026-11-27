import {test,expect} from '@playwright/test';
test('local draft, logo, RTL, map fallback and no collection',async({page})=>{
 const writes=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
 // The form prepares an email draft; an email client must send it. No remote request is made by Bosphorly.
 await page.goto('/booking.html?lang=en');
 await expect(page.locator('#offer option')).toHaveCount(35);
 await page.locator('#offer').selectOption('bb-sunset');
 await expect(page.locator('#time option')).toHaveCount(1);
 await expect(page.locator('#time')).toHaveValue('18:00–21:00');
 await expect(page.locator('#price')).toContainText('20');
 await page.locator('#date').fill(new Date(Date.now()+86400000).toISOString().slice(0,10));await page.locator('#date').dispatchEvent('change');
 // Hammam requests list only Alaturka services and ask for the branch.
 await page.goto('/booking.html?service=alaturka-massage&lang=en');
 await expect(page.locator('#offer option')).toHaveCount(4);
 await expect(page.locator('#branchWrap')).toBeVisible();
 await page.locator('#date').fill(new Date(Date.now()+86400000).toISOString().slice(0,10));await page.locator('#date').dispatchEvent('change');
 await page.locator('#option').selectOption('hotstones');await page.locator('#duration').selectOption('60');
 await expect(page.locator('#price')).toContainText('110');
 await expect(page.locator('#time option').last()).toHaveText('22:00');
 await page.goto('/booking.html?service=bb-sunset&lang=en');
 await expect(page.locator('.sh-brand img')).toHaveAttribute('src',/^assets\/brand\/approved-icon\.webp(\?v=[\w.-]+)?$/);
 await expect.poll(()=>page.locator('.sh-brand img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBeTruthy();
 await page.locator('#ack').check();await page.locator('#submit').click();
 await expect(page.locator('#error')).toBeVisible();
 await page.locator('#hotelName').fill('Test Hotel');await expect(page.locator('#room')).toHaveCount(0);await page.locator('#fullName').fill('Test Guest');await page.locator('#phone').fill('+90 555 000 00 00');await page.locator('#submit').click();
 await expect(page.locator('#error')).toBeHidden();
 await expect(page.locator('#result')).toHaveAttribute('data-state','draft');
 await expect(page.locator('#result')).toContainText('BOS-');
 await expect(page.locator('#result a[href^="mailto:"]')).toHaveAttribute('href',/^mailto:info@bosphorly\.com\?subject=.*&body=.*Test%20Hotel/);
 await page.locator('#result a[href^="mailto:"]').click();
 const picker = page.getByRole('dialog');
 await expect(picker.getByRole('link',{name:'Gmail'})).toHaveAttribute('href',/mail.google.com.*Test\+Hotel/);
 await expect(picker.getByRole('link',{name:'Default email app'})).toHaveAttribute('href',/^mailto:info@bosphorly/);
 await page.keyboard.press('Escape');
 await expect(picker).toHaveCount(0);
 for(const dir of ['ltr','rtl']) {
 await page.locator('html').evaluate((e,d)=>e.dir=d,dir);
 expect(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth||e.getBoundingClientRect().left<0).map(e=>e.tagName+'.'+e.className)}))).toMatchObject({scroll:page.viewportSize().width});
 }
 // The request is kept only on this device for the My account page; nothing is sent to a server.
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bosphorly.account')).requests.length)).toBe(1);
 expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key => key !== 'bosphorly.mimo_greeted'))).toEqual([]);
 await page.goto('/account.html?lang=en');
 await expect(page.locator('.req')).toHaveCount(1);
 await expect(page.locator('.req .ref')).toContainText('BOS-');
 await page.goto('/booking.html?lang=en');
 await expect(page.locator('#fullName')).toHaveValue('Test Guest');
 expect(await page.context().cookies()).toHaveLength(0);
 expect(writes).toEqual([]);
 await page.route('https://**/*',r=>r.abort());
 // The old city map address now opens Discover; offline it still lists places and shows the local schematic map.
 await page.goto('/map.html?lang=en');
 await expect(page).toHaveURL(/explore\.html\?lang=en#getting-around/);
 await expect(page.locator('.place')).toHaveCount(33);
 await page.locator('#map').scrollIntoViewIfNeeded();
 await expect(page.locator('#mapFallback img')).toBeVisible();
 await expect.poll(()=>page.locator('#mapFallback img').evaluate(e=>e.complete&&e.naturalWidth>0)).toBeTruthy();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
