import {test,expect} from './fixtures.js';
import {readFileSync} from 'node:fs';
const places=(name,coordinates)=>({features:[{geometry:{type:'Point',coordinates},properties:{name,city:'İstanbul',state:'İstanbul',countrycode:'TR'}}]});
const result={code:'Ok',routes:[{distance:10000,duration:1200,legs:[{steps:[{mode:'driving'}]}]}],waypoints:[{location:[28.99,41.05],distance:10},{location:[28.9,41.04],distance:20}]};
async function setup(page,{expired=false}={}){
 const tariff=JSON.parse(readFileSync(new URL('../../data/taxi-reference.json',import.meta.url)));const day=new Date().toISOString().slice(0,10);tariff.effective_from=day;tariff.verified_at=day;tariff.review_after=expired?'2000-01-01':new Date(Date.now()+30*86400000).toISOString().slice(0,10);
 await page.route('**/data/taxi-reference.json',r=>r.fulfill({json:tariff}));
 await page.route('https://photon.komoot.io/**',r=>r.fulfill({json:places(new URL(r.request().url()).searchParams.get('q').startsWith('Synthetic A')?'Synthetic A':'Synthetic B',new URL(r.request().url()).searchParams.get('q').startsWith('Synthetic A')?[28.99,41.05]:[28.9,41.04])}));
 await page.goto('/?lang=tr');await expect(page.locator('#routeEstimator')).toBeVisible();expect(await page.locator('#booking #routeEstimator').count()).toBe(0);
 if(process.env.CAPTURE_REVIEW&&[390,1440].includes(page.viewportSize().width))await page.locator('#routeEstimator').screenshot({path:`docs/review/${page.viewportSize().width===1440?'desktop':'mobile'}-journey-section.jpg`,animations:'disabled'});
 await page.locator('#journeyFrom').fill('Synthetic A');await page.locator('#journeyTo').fill('Synthetic B');await page.locator('#findRoutePlaces').click();await expect(page.locator('#routeMatches')).toBeVisible();await page.locator('#routeFromMatch').selectOption('0');await page.locator('#routeToMatch').selectOption('0');
}
test('typed addresses calculate a one-way road route and explicit taxi scenario, never a Vito price',async({page})=>{
 let routeCalls=0;await page.route('https://routing.openstreetmap.de/**',r=>{routeCalls++;return r.fulfill({json:result});});await setup(page);
 await expect(page.locator('#roadDistance')).toHaveText('10 km');await expect(page.locator('#taxiScenarioAmount')).toContainText('551,14');await expect(page.locator('#taxiScenarioAmount')).toContainText('700,84');await expect(page.locator('.private-vito')).toContainText('onaylı tarife henüz yok');await expect(page.locator('#pickupAddress')).toHaveValue('İstanbul Havalimanı (IST)');await expect(page.locator('#dropoffAddress')).toHaveValue('');
 await page.locator('.journey-options summary').click();await page.locator('#stationaryMinutes').fill('0');await expect(page.locator('#taxiScenarioAmount')).not.toContainText('700,84');expect(routeCalls).toBe(1);
 for(const lang of ['en','tr','ar','ru']){await page.locator('#language').selectOption(lang);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);}expect(routeCalls).toBe(1);
 await page.locator('#direction').selectOption('point-point');await page.locator('#pickupAddress').fill('Independent transfer address');await expect(page.locator('#roadDistance')).toBeVisible();await expect(page.locator('#journeyFrom')).toHaveValue('Synthetic A');expect(routeCalls).toBe(1);
 await page.locator('#journeyFrom').fill('Changed address');await expect(page.locator('#routeEstimateOutput')).toBeHidden();await expect(page.locator('#routeMatches')).toBeHidden();
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k!=='bosphorly.language'))).toEqual([]);
});
test('routing service failure never becomes a straight-line fallback or price',async({page})=>{await page.route('https://routing.openstreetmap.de/**',r=>r.fulfill({status:503,body:'Unavailable'}));await setup(page);await expect(page.locator('#routeEstimateStatus')).toContainText('ulaşılamadı');await expect(page.locator('#routeEstimateOutput')).toBeHidden();await expect(page.locator('#roadDistance')).toHaveText('');});
test('stale tariff permits distance but hides the monetary estimate',async({page})=>{
 await page.route('https://routing.openstreetmap.de/**',r=>r.fulfill({json:result}));await setup(page,{expired:true});await expect(page.locator('#roadDistance')).toHaveText('10 km');await expect(page.locator('#taxiScenarioAmount')).toContainText('yeniden kontrol');
});
test('clearing a selected match cancels an in-flight route and cannot resurrect old prices',async({page})=>{
 let release,completed=false;await page.route('https://routing.openstreetmap.de/**',async r=>{await new Promise(resolve=>release=resolve);try{await r.fulfill({json:result});}catch{}completed=true;});
 await setup(page);await expect.poll(()=>Boolean(release)).toBe(true);await page.locator('#routeToMatch').selectOption('');release();await expect.poll(()=>completed).toBe(true);await expect(page.locator('#routeEstimateOutput')).toBeHidden();await expect(page.locator('#routeEstimateStatus')).toContainText('iki noktayı doğrula');
});
