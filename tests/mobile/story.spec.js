import {test,expect} from './fixtures.js';
test('story cards filter experiences and localized FAQ stays usable',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/?lang=tr');await page.locator('#dismissClub').click();
 await expect(page.locator('.hero-transfer')).toHaveAttribute('href','#booking');
 for(const [category,count] of [['cruise',4],['city',1],['wellness',1]]) {await page.locator(`[data-theme="${category}"]`).click();await expect(page.locator('.tour-card')).toHaveCount(count);await expect(page.locator(`[data-filter="${category}"]`)).toHaveClass(/active/);}
 for(const lang of ['tr','en','ar','ru']){await page.locator('#language').selectOption(lang);await page.locator('.story-faq details').nth(2).evaluate(e=>e.open=true);await expect(page.locator('.story-faq [data-story="a3"]')).toBeVisible();const layout=await page.evaluate(()=>({lang:document.documentElement.lang,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().left<0||e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,60),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));expect(layout.scroll,JSON.stringify(layout)).toBe(page.viewportSize().width);}
 await page.locator('#language').selectOption('tr');await expect(page.locator('.story-faq [data-story="a3"]')).toContainText('kesin rezervasyon oluşturmaz');await expect(page.locator('[data-story="a4"]')).toContainText('taslak');
 expect(errors).toEqual([]);
});
