import {test,expect} from './fixtures.js';
test('homepage polish preserves local planning, language and reduced motion',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');

 await expect(page.locator('dialog')).toHaveCount(0);
 await expect(page.locator('#membershipLink')).toBeVisible();
 await expect(page.locator('.tour-card')).toHaveCount(12);
 await expect(page.locator('.hero-cta')).toHaveAttribute('href','#experiences');
 await expect(page.locator('.hero-photo img')).toBeVisible();
 await page.locator('.filter[data-filter="city"]').click();
 await expect(page.locator('.tour-card')).toHaveCount(1);
 await expect(page.locator('.tour-card a')).toHaveAttribute('href',/booking.html\?service=bb-oldcity/);
 await page.locator('#language').selectOption('tr');
 await expect(page.locator('.hero-cta')).toHaveText('Deneyimleri keşfet');
 for(const lang of ['en','tr','ar']) {
 await page.locator('#language').selectOption(lang);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 expect(await page.locator('.hero-photo').evaluate(e=>getComputedStyle(e).animationName)).toBe('none');
 expect(errors).toEqual([]);
 await page.locator('#language').selectOption('tr');await expect(page.locator('#membershipLink')).toHaveText('Üye ol');await page.locator('#membershipLink').click();await expect(page).toHaveURL(/membership.html\?lang=tr$/);await expect(page.locator('#memberForm')).toBeVisible();
});

test('Anatolia route proposals filter, translate and stay inside the local booking preview',async({page})=>{
 await page.goto('/?lang=tr');await page.locator('[data-filter="anatolia"]').click();await expect(page.locator('.tour-card')).toHaveCount(6);await expect(page.locator('#anatoliaNotice')).toContainText('ayrıca teklif ve onay');await expect(page.locator('.tour-card').first()).toContainText('Kapadokya');await expect(page.locator('.tour-card').first()).toContainText('Teklif gerekli');
 for(const lang of ['en','ar','ru','tr']){await page.locator('#language').selectOption(lang);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);}
 if(process.env.CAPTURE_REVIEW&&[390,1440].includes(page.viewportSize().width))await page.locator('#experiences').screenshot({path:`docs/review/${page.viewportSize().width===1440?'desktop':'mobile'}-anatolia.jpg`,animations:'disabled'});
 const href=await page.locator('.tour-content a').first().getAttribute('href');expect(href).toMatch(/^anatolia.html\?route=anatolia-cappadocia&lang=tr$/);await page.locator('.tour-content a').first().click();await expect(page.locator('#routeTitle')).toHaveText('Kapadokya: Vadiler ve Miras');await page.locator('#planRoute').click();await expect(page.locator('#offer')).toHaveValue('anatolia-cappadocia');await expect(page.locator('#offer option:checked')).toHaveText('Kapadokya: Vadiler ve Miras');await expect(page.locator('#routeProposal')).toContainText('Balon uçuşu dahil veya garantili değildir');await expect(page.locator('#price')).toHaveText('Fiyat teklifi gerekli');await page.locator('#ack').check();await page.locator('#submit').click();await expect(page.locator('#result')).toContainText('REZERVASYON DEĞİL');
});
