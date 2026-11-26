import {test,expect} from '@playwright/test';
test('managed catalog updates public tour prices and the booking form; eSIM affiliate label follows settings',async({page})=>{
 const record={id:'bb-morning',operator:'Bosphorly',title:'Managed Morning Cruise',title_tr:'Yönetilen Sabah Turu',price:42,currency:'EUR',basis:'per_person',details:{duration:'2 hours',summary:'A catalog visit',included:[],tr:{duration:'2 saat',summary:'Katalog gezisi'}},active:true,photos:[]};
 await page.route('https://**/v1/catalog',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({managed:true,records:[record],esim:{url:'https://airalo.pxf.io/bosphorly',comingSoon:false}})}));
 await page.goto('/?lang=tr');await expect(page.locator('.tour-card')).toHaveCount(1);await expect(page.locator('.tour-card h3')).toHaveText('Yönetilen Sabah Turu');await expect(page.locator('.tour-card .tour-meta')).toContainText('42');await expect(page.locator('#esimSection a')).toHaveAttribute('href','https://airalo.pxf.io/bosphorly');await expect(page.locator('#esimSection')).not.toContainText('Yakında');
 await page.goto('/booking.html?service=bb-morning&lang=en');await expect(page.locator('#offer option')).toHaveCount(1);await expect(page.locator('#offer option')).toContainText('42');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
