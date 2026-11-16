import {test,expect} from '@playwright/test';
test('homepage polish preserves local planning, language and reduced motion',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
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
 // Every page follows the chosen language, including tour contents and right-to-left Arabic.
 await page.goto('/prices.html?lang=ru');
 await expect(page.locator('#heading')).toHaveText('Сравните туры по Стамбулу.');
 await expect(page.locator('.item h2').first()).toHaveText('Утренняя прогулка по Босфору');
 await page.goto('/booking.html?service=alaturka-massage&lang=ar');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('#labelOption')).toHaveText('نوع التدليك');
 await page.locator('.lang-select').selectOption('ru');
 await expect(page.locator('#labelOption')).toHaveText('Вид массажа');
 // Every page carries the shared header; guide articles switch to their counterpart in the other language.
 await page.goto('/en/istanbul-guide.html');
 await expect(page.locator('.site-header .lang-select')).toHaveValue('en');
 await Promise.all([page.waitForURL(/tr\/istanbul-rehberi\.html/),page.locator('.site-header .lang-select').selectOption('tr')]);
 await page.goto('/prices.html?lang=tr');
 await expect(page.locator('.hb-card')).toHaveCount(1);
 await page.goto('/account.html?lang=ar');
 await expect(page.locator('#heading')).toHaveText('حسابي');
 expect(errors).toEqual([]);
});
