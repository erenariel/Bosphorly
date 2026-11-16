import {test,expect} from './fixtures.js';
async function open(page){await page.goto('/?lang=tr');await expect(page.locator('dialog[open]')).toHaveCount(0);await expect(page.locator('#membershipLink')).toHaveText('Üye ol');}

test('direction, addresses, Vito rows and return dates work without sending PII',async({page})=>{
 const writes=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
 await open(page);
 await expect(page.locator('#airportTransferMode')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#pickupField')).toBeHidden();await expect(page.locator('#dropoffField')).toBeVisible();await expect(page.locator('#direction option:not([hidden])')).toHaveCount(2);await expect(page.locator('.transfer-area')).not.toHaveAttribute('open','');
 if(process.env.CAPTURE_REVIEW&&[390,1440].includes(page.viewportSize().width))await page.locator('#booking').screenshot({path:`docs/review/${page.viewportSize().width===1440?'desktop':'mobile'}-airport-simple.jpg`,animations:'disabled'});
 await expect(page.locator('.transfer-map')).not.toHaveAttribute('open','');
 await page.locator('.transfer-map summary').click();await expect(page.locator('.transfer-map img')).toBeVisible();await page.locator('.transfer-map summary').click();
 await expect(page.locator('#pickupAddress')).toHaveValue('İstanbul Havalimanı (IST)');await expect(page.locator('#pickupAddress')).toHaveAttribute('readonly','');
 await page.locator('#airport').selectOption('SAW');await expect(page.locator('#pickupAddress')).toHaveValue('Sabiha Gökçen (SAW)');
 await page.locator('#hotel').fill('Synthetic Hotel');await page.locator('#dropoffAddress').fill('Synthetic street, Istanbul');
 await page.locator('#direction').selectOption('hotel-airport');await expect(page.locator('#pickupAddress')).toHaveValue('Synthetic street, Istanbul');await expect(page.locator('#dropoffAddress')).toHaveValue('Sabiha Gökçen (SAW)');await expect(page.locator('#price')).toHaveText('Fiyat teklifi gerekli');
 await page.locator('#privateTransferMode').click();await expect(page.locator('#privateTransferMode')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#direction option:not([hidden])')).toHaveCount(2);await page.locator('#direction').selectOption('hotel-region');await expect(page.locator('#airportField')).toBeHidden();await page.locator('#dropoffAddress').fill('Synthetic destination');
 await page.locator('#tripType').selectOption('return');await page.locator('#routeNext').click();await page.locator('#passengers').selectOption('7');await expect(page.locator('.passenger-row')).toHaveCount(7);
 await expect(page.locator('#passenger-1-nationality option')).toHaveCount(250);
 for(let i=1;i<=7;i++){await page.locator(`#passenger-${i}-nationality`).selectOption('TR');await page.locator(`#passenger-${i}-gender`).selectOption(i%2?'male':'female');await page.locator(`#passenger-${i}-firstName`).fill('Synthetic');await page.locator(`#passenger-${i}-lastName`).fill('Guest');await page.locator(`#passenger-${i}-passport`).fill('TEST-NOT-REAL');}
 await page.locator('#passengersNext').click();await expect(page.locator('#returnLeg')).toBeVisible();await expect(page.locator('#returnRoute')).toHaveText('Synthetic destination → Synthetic street, Istanbul');await expect(page.locator('#flight')).toBeDisabled();
 await page.locator('#arrivalDate').fill('2099-02-01');await page.locator('#arrivalTime').fill('12:00');await page.locator('#returnDate').fill('2099-02-01');await page.locator('#returnTime').fill('11:00');await page.locator('#transferAck').check();await page.locator('#reviewTransfer').click();await expect(page.locator('#result')).toBeHidden();
 await page.locator('#returnTime').fill('13:00');await page.locator('#reviewTransfer').click();await expect(page.locator('#result')).toContainText('REZERVASYON YAPILMADI');await expect(page.locator('#result')).not.toContainText('TEST-NOT-REAL');
 await page.locator('#tripBack').click();await page.locator('#passengers').selectOption('2');await expect(page.locator('.passenger-row')).toHaveCount(2);await expect(page.locator('#passenger-1-firstName')).toHaveValue('Synthetic');
 await expect(page.locator('input[type=tel], #phone, #babySeat')).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.length+sessionStorage.length)).toBe(0);expect(writes).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(page.viewportSize().width);
});
test('configured Google selection fills hotel endpoint and clears stale addresses',async({page})=>{
 await page.route('**/config/maps-public.js',r=>r.fulfill({contentType:'application/javascript',body:'window.BOSPHORLY_PUBLIC_CONFIG={googleMapsBrowserKey:"synthetic-test-key"};'}));
 await page.route('https://maps.googleapis.com/**',r=>r.fulfill({contentType:'application/javascript',body:`class FakeAutocomplete extends HTMLElement{};customElements.define('fake-places',FakeAutocomplete);window.google={maps:{importLibrary:async()=>({PlaceAutocompleteElement:FakeAutocomplete})}};`}));
 await open(page);await expect(page.locator('fake-places')).toBeAttached();
 await page.locator('fake-places').evaluate(e=>{const event=new Event('gmp-select');event.placePrediction={toPlace:()=>({id:'synthetic-place',displayName:'Synthetic Hotel',formattedAddress:'Synthetic street, Sultanahmet, Istanbul',location:{toJSON:()=>({lat:41.01,lng:28.97})},fetchFields:async()=>{}})};e.dispatchEvent(event);});
 await expect(page.locator('#dropoffAddress')).toHaveValue('Synthetic street, Sultanahmet, Istanbul');await expect(page.locator('#hotelVerification')).toHaveAttribute('data-verified','yes');await expect(page.locator('#zone')).toHaveValue('sultanahmet');
 await page.locator('#direction').selectOption('hotel-airport');await expect(page.locator('#pickupAddress')).toHaveValue('Synthetic street, Sultanahmet, Istanbul');
 await page.locator('fake-places').evaluate(e=>e.dispatchEvent(new Event('input',{bubbles:true})));await expect(page.locator('#pickupAddress')).toHaveValue('');
});
