import {test,expect} from './fixtures.js';
test('homepage polish preserves local planning, language and reduced motion',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('#dismissClub').click();
 await expect(page.locator('.tour-card')).toHaveCount(6);
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
});
