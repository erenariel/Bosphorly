import {test,expect} from '/workspace/Bosphorly-Brand-V2/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
test('preview critical pages stay local; noindex, APIs, writes and external links are isolated',async({page})=>{
 test.setTimeout(120000);
 const origin='http://127.0.0.1:8877';const escaped=[];
 await page.route('**/*',r=>{if(!r.request().url().startsWith(origin)){escaped.push(r.request().url());return r.abort();}return r.continue();});
 for(const path of ['index.html','prices.html','booking.html','tours.html','account.html','extranet/']){
  await page.goto(origin+'/'+path,{waitUntil:'domcontentloaded'});
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
  expect(await page.evaluate(async()=>{const r=await fetch('https://api.bosphorly.com/v1/auth/start',{method:'POST',body:'{}'});return r.status;})).toBe(403);
  expect(await page.evaluate(async()=>{const r=await fetch('/__demo_api/v1/requests',{method:'POST',body:'{}'});return r.status;})).toBe(403);
  expect(await page.evaluate(()=>navigator.sendBeacon('https://example.org','test'))).toBe(false);
  expect(await page.evaluate(()=>window.open('https://example.org'))).toBe(null);
 }
 await page.goto(origin+'/extranet/');
 await expect(page.locator('#gateScreen')).toBeVisible();
 expect(await page.evaluate(()=>window.BOSPHORLY_API.base)).toBe(origin+'/__demo_api');
 expect(escaped).toEqual([]);
 fs.writeFileSync('/workspace/high-fidelity-evidence/isolation.json',JSON.stringify({pages:6,escaped,postStatus:403,beacon:false,externalWindow:null,authenticated:false},null,2));
});

test('safe search navigates inside isolated preview without sending a transaction',async({page})=>{
 await page.goto('http://127.0.0.1:8877/?lang=tr');
 await page.locator('#hfExperience').selectOption({index:1});
 await page.locator('#hfDate').fill('2027-02-10');
 await page.locator('#hfSearchForm button[type=submit]').click();
 await expect(page).toHaveURL(/booking.html/);
 await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
});
