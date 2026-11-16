import {test,expect} from './fixtures.js';
import {weatherFixture} from '../weather-fixture.js';
test('forecast, automatic recommendation and nonpersonal cache work across languages',async({page})=>{
 let calls=0;await page.route('https://api.met.no/**',r=>{calls++;return r.fulfill({json:weatherFixture()});});
 await page.goto('/?lang=tr');await expect(page.locator('#weatherDays li')).toHaveCount(7);await expect(page.locator('#weatherTemperature')).toHaveText('20°C');await expect(page.locator('#weatherBest')).toContainText('daha uygun');await expect(page.locator('#weatherDays [data-best=true]')).toHaveCount(1);
 const keys=await page.evaluate(()=>Object.keys(localStorage));expect(keys).toEqual(['bosphorly.weather.v1']);
 await page.reload();await expect(page.locator('#weatherDays li')).toHaveCount(7);expect(calls).toBe(1);
 await page.locator('#weatherActivity').selectOption('wellness');await expect(page.locator('#weatherBest')).toContainText('Kapalı alan');await expect(page.locator('#weatherDays [data-best=true]')).toHaveCount(0);
 await page.locator('#weatherActivity').selectOption('city');await page.locator('#weatherTours').click();await expect(page.locator('[data-filter=city]')).toHaveClass(/active/);expect(calls).toBe(1);
 for(const lang of ['tr','en','ar','ru']){await page.locator('#language').selectOption(lang);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);}
});
test('high wind shows a real forecast but never invents an appropriate outdoor window',async({page})=>{
 await page.route('https://api.met.no/**',r=>r.fulfill({json:weatherFixture(Date.now(),{wind:15})}));await page.goto('/?lang=tr');await expect(page.locator('#weatherDays li')).toHaveCount(7);await expect(page.locator('#weatherBest')).toContainText('bulunamadı');await expect(page.locator('#weatherDays [data-best=true]')).toHaveCount(0);
});
test('provider errors and stale responses hide data and timing recommendations',async({page})=>{
 await page.route('https://api.met.no/**',r=>r.fulfill({status:503,body:'Unavailable'}));await page.goto('/?lang=tr');await expect(page.locator('#weatherStatus')).toContainText('alınamadı');await expect(page.locator('#weatherContent')).toBeHidden();await expect(page.locator('#weatherBest')).toHaveText('');
 await page.route('https://api.met.no/**',r=>{const raw=weatherFixture();raw.properties.meta.updated_at=new Date(Date.now()-13*3600000).toISOString();return r.fulfill({json:raw});});await page.reload();await expect(page.locator('#weatherStatus')).toContainText('güncel değil');await expect(page.locator('#weatherContent')).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('bosphorly.weather.v1'))).toBeNull();
 await page.route('https://api.met.no/**',r=>r.fulfill({status:203,json:weatherFixture()}));await page.reload();await expect(page.locator('#weatherContent')).toBeHidden();await expect(page.locator('#weatherStatus')).toContainText('alınamadı');
});
