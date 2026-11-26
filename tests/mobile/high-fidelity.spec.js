import {test,expect} from '@playwright/test';

test('high fidelity search uses the existing request form without submitting a reservation',async({page})=>{
 await page.route(/^https:\/\//,r=>r.abort());
 const writes=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.url())});
 await page.goto('/?lang=tr');
 await expect(page.locator('script[src*="high-fidelity-ui.js"]')).toHaveCount(1);
 await expect(page.locator('.hf-search')).toBeVisible();
 await expect(page.locator('.hf-experience-layout .tour-card')).toHaveCount(6);
 await expect(page.locator('#hfExperience option')).not.toHaveCount(0);
 const service=await page.locator('#hfExperience').inputValue();
 const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 await page.locator('#hfDate').fill(date);await page.locator('#hfGuests').selectOption('3');
 await Promise.all([page.waitForURL(/booking\.html\?/),page.locator('.hf-search-submit').click()]);
 await expect(page).toHaveURL(new RegExp('service='+service));
 await expect(page.locator('#date')).toHaveValue(date);
 await expect(page.locator('#guests')).toHaveValue('3');
 await expect(page.locator('#ack')).not.toBeChecked();
 await expect(page.locator('#result')).toBeHidden();
 expect(writes).toEqual([]);
});

test('high fidelity responsive menu and keyboard tabs remain usable in RTL',async({page})=>{
 await page.route(/^https:\/\//,r=>r.abort());
 await page.goto('/?lang=ar');
 await expect(page.locator('html')).toHaveAttribute('dir','rtl');
 await page.locator('.hf-menu-toggle').click();
 await expect(page.locator('.hf-menu-toggle')).toHaveAttribute('aria-expanded','true');
 await expect(page.locator('.site-header .lang-select')).toBeVisible();
 await page.locator('.hf-menu-toggle').click();
 const tabs=page.getByRole('tab');
 await tabs.nth(0).focus();await page.keyboard.press('ArrowLeft');
 await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
 await expect(page.locator('#hfExperience')).toHaveValue('IST');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('high fidelity transfer search opens and prefills the existing airport transfer flow',async({page})=>{
 await page.route(/^https:\/\//,r=>r.abort());
 const writes=[];page.on('request',r=>{if(r.method()==='POST')writes.push(r.url())});
 await page.goto('/?lang=tr');
 await page.locator('[data-hf-tab=transfer]').click();
 await page.locator('#hfExperience').selectOption('SAW');
 const date=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
 await page.locator('#hfDate').fill(date);await page.locator('#hfGuests').selectOption('4');
 await page.locator('.hf-search-submit').click();
 await expect(page.locator('#booking')).toBeInViewport();
 await expect(page.locator('#arrivalDate')).toHaveValue(date);
 await expect(page.locator('#passengers')).toHaveValue('4');
 await expect(page.locator('[data-airport=SAW]')).toHaveClass(/selected/);
 expect(writes).toEqual([]);
});
