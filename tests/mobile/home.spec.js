import {test,expect} from '@playwright/test';

async function openHeaderMenu(page){
 const toggle=page.locator('.hf-menu-toggle');
 if(await toggle.isVisible() && await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
}
test('homepage polish preserves local planning, language and reduced motion',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await expect(page.locator('.tour-card')).toHaveCount(6);
 await expect(page.locator('.hero-cta')).toHaveAttribute('href','#experiences');
 await expect(page.locator('.hero-photo img')).toBeVisible();
 await page.locator('.hf-filter-menu summary').click();
 await page.locator('.filter[data-filter="city"]').click();
 await expect(page.locator('.tour-card')).toHaveCount(1);
 await expect(page.locator('.tour-card a[href*="booking.html"]')).toHaveAttribute('href',/booking.html\?service=bb-oldcity/);
 await openHeaderMenu(page);
 await page.locator('#language').selectOption('tr');
 await expect(page.locator('.hero-cta')).toHaveText('Deneyimleri keşfet');
 for(const lang of ['en','tr','ar']) {
 await openHeaderMenu(page);
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
 await openHeaderMenu(page);
 await page.locator('.lang-select').selectOption('ru');
 await expect(page.locator('#labelOption')).toHaveText('Вид массажа');
 // Every page carries the shared header; guide articles switch to their counterpart in the other language.
 await page.goto('/en/istanbul-guide.html');
 await expect(page.locator('.site-header .lang-select')).toHaveValue('en');
 await openHeaderMenu(page);
 await Promise.all([page.waitForURL(/tr\/istanbul-rehberi\.html/),page.locator('.site-header .lang-select').selectOption('tr')]);
 await page.goto('/prices.html?lang=tr');
 await expect(page.locator('.hb-card')).toHaveCount(1);
 await page.goto('/account.html?lang=ar');
 await expect(page.locator('#heading')).toHaveText('حسابي');
 expect(errors).toEqual([]);
});
test('guest pages invite requests: no prototype labels, no partner pitch, no coupon promise while membership is off',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/config/api.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.BOSPHORLY_API=Object.freeze({base:""});'}));
 for(const lang of ['tr','en','de','ar','zh']) {
 await page.goto('/?lang='+lang);
 await expect(page.locator('.tour-card')).toHaveCount(6);
 const text=await page.locator('body').innerText();
 expect(text).not.toMatch(/Prototype|Prototip|Prototyp|Прототип|نموذج أولي|原型|Concept MVP|aktif değil|not live|nicht aktiv|尚未正式开放/);
 // Membership is not live (no API address), so its rewards block, coupon promise and the partner pitch stay off the page.
 await expect(page.locator('#rewards')).toBeHidden();
 await expect(page.locator('.partner-panel')).toHaveCount(0);
 await expect(page.locator('a[href="dashboard.html"]')).toHaveCount(0);
 }
 await page.goto('/?lang=tr');
 await expect(page.locator('footer .privacy-link')).toHaveText('🔒 Gizlilik · KVKK');
 await expect(page.locator('[data-i18n="terms"]')).toContainText('ödeme yönteminin, talebim alındıktan sonra benimle iletişime geçildiğinde paylaşılacağını');
 // Other guest pages: no prototype wording, localized privacy link.
 for(const p of ['booking.html','prices.html','tours.html','explore.html','account.html']) {
 await page.goto('/'+p+'?lang=tr');
 await expect(page.locator('.privacy-link').first()).toHaveText('🔒 Gizlilik · KVKK');
 expect(await page.locator('body').innerText()).not.toMatch(/Prototype|Prototip|PROTOTİP|Yalnızca karşılaştırma/);
 }
 expect(errors).toEqual([]);
});
test('FAQ page answers in the visitor language and asks by email',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/faq.html?lang=tr');
 await expect(page.locator('h1')).toHaveText('Sıkça sorulan sorular');
 await expect(page.locator('.qa')).toHaveCount(9);
 await expect(page.locator('.qa').nth(8).locator('a.more')).toHaveAttribute('href','mailto:info@bosphorly.com');
 await expect(page.locator('.qa').nth(2)).toContainText('60 €');
 await expect(page.locator('#ask')).toHaveAttribute('href',/^mailto:info@bosphorly.com\?subject=/);
 await expect(page.locator('.site-header a[href="faq.html"]')).toHaveAttribute('aria-current','page');
 await page.goto('/faq.html?lang=ar');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await expect(page.locator('h1')).toHaveText('الأسئلة الشائعة');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.goto('/?lang=de');
 await expect(page.locator('footer a[href="faq.html"]')).toHaveText('FAQ');
 await expect(page.locator('footer a[href="mailto:info@bosphorly.com"]')).toHaveCount(1);
 // Other pages get the corporate email next to the privacy link, once.
 for(const p of ['tours.html','prices.html','booking.html']) { await page.goto('/'+p+'?lang=tr'); await expect(page.locator('a.mail-link')).toHaveCount(1); }
 expect(errors).toEqual([]);
});
