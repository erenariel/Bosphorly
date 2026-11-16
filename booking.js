'use strict';
/* Public, local-only demonstration: no PII, payment, API submission or booking creation. */
(()=>{
 const $=id=>document.getElementById(id);
 const query=new URLSearchParams(location.search);
 const tr=query.get('lang')==='tr'||(!query.has('lang')&&navigator.language.toLowerCase().startsWith('tr'));
 document.documentElement.lang=tr?'tr':'en';
 const i18n={
  en:{eyebrow:'YOUR ISTANBUL · YOUR WAY',heading:'Plan your experience with Bosphorly.',subheading:'Choose your activity, preferred date and hotel area. You stay on Bosphorly throughout the journey—no supplier-site redirection.',stepName:'Experience details',formTitle:'Your experience',formIntro:'A preview of our future reservation journey. No booking is sent.',labelOffer:'Experience',labelDate:'Preferred date',labelTime:'Preferred time',labelGuests:'Guests',labelArea:'Hotel area',labelStatus:'Price status',labelAvailability:'Availability',price:'Quote required',availability:'Not yet connected',priceNote:'Bosphorly will publish only rates approved by its contracted suppliers. The public prototype does not accept reservations.',consent:'I understand this is a preview only and no reservation is sent or confirmed.',submit:'Review my plan →',whyTitle:'One platform. Transparent planning.',whyText:'Your future booking, supplier confirmation and cancellation rules will be managed in one clear journey, not by sending you to another website.',item1:'Bosphorly-controlled prices',item2:'Supplier status verified before sale',item3:'Hotel referral attribution in the future partner system',mapTitle:'Explore before booking',mapLink:'Open Istanbul city map →',invalidDate:'Choose a future date.',invalidGuests:'Select 1–16 guests.',invalidOffer:'Select an experience.',invalidConsent:'Acknowledge that this is a preview only.',resultTitle:'Plan preview created — NOT BOOKED',resultNotice:'No reservation was sent. When the booking service launches, these steps will lead to a verified quotation and confirmation.',notAvailable:'Catalog not available. Please reload.'},
  tr:{eyebrow:'İSTANBUL · SENİN PLANIN',heading:'Deneyimini Bosphorly ile planla.',subheading:'Etkinliğini, tarihini ve otel bölgeni seç. Acente sitesine yönlendirilmeden Bosphorly içinde kal.',stepName:'Deneyim detayları',formTitle:'Deneyimin',formIntro:'Gelecekteki rezervasyon sürecimizin önizlemesi. Rezervasyon gönderilmez.',labelOffer:'Deneyim',labelDate:'Tercih edilen tarih',labelTime:'Tercih edilen saat',labelGuests:'Kişi sayısı',labelArea:'Otel bölgesi',labelStatus:'Fiyat durumu',labelAvailability:'Müsaitlik',price:'Fiyat teklifi gerekli',availability:'Henüz bağlı değil',priceNote:'Bosphorly yalnızca sözleşmeli tedarikçilerinden onaylanmış tarifeleri yayımlayacak. Bu açık prototip gerçek rezervasyon almıyor.',consent:'Bunun yalnızca önizleme olduğunu ve herhangi bir rezervasyon gönderilmeyeceğini biliyorum.',submit:'Planımı incele →',whyTitle:'Tek platform. Şeffaf süreç.',whyText:'İleride rezervasyonun, tedarikçi onayı ve iptal şartların başka siteye gönderilmeden tek akışta yönetilecek.',item1:'Bosphorly tarafından belirlenen fiyatlar',item2:'Satış öncesi tedarikçi doğrulaması',item3:'Otel yönlendirme komisyonu kaydı',mapTitle:'Rezervasyon öncesi keşfet',mapLink:'İstanbul haritasını aç →',invalidDate:'İleri bir tarih seç.',invalidGuests:'1–16 kişi seç.',invalidOffer:'Bir deneyim seç.',invalidConsent:'Önizleme koşulunu onayla.',resultTitle:'Plan önizlemesi oluşturuldu — REZERVASYON DEĞİL',resultNotice:'Hiçbir rezervasyon gönderilmedi. Rezervasyon altyapısı açıldığında bu akış doğrulanmış fiyat ve onayla tamamlanacak.',notAvailable:'Katalog açılamadı. Sayfayı yenile.'}
 };
 const t=i18n[tr?'tr':'en'];
 for(const [id,val] of Object.entries(t)){const e=$(id);if(e)e.textContent=val}
 const time=$('time');if(tr)[...time.options].forEach((o,i)=>o.textContent=['Sabah','Öğleden sonra','Akşam','Esnek'][i]);
 const area=$('area');if(tr)[...area.options].at(-1).textContent='Diğer';
 const iso=new Date();const local=new Date(iso.getTime()-iso.getTimezoneOffset()*60000).toISOString().slice(0,10);$('date').min=local;$('date').value=local;
 let offers=[];
 let marketPrices=new Map();
 const renderMarketPrice=()=>{
  const r=marketPrices.get($('offer').value);
  const box=$('marketPrice');if(!box)return;
  if(!r||typeof r.price!=='number'){
   box.textContent=tr?'Acentenin yayımlanmış fiyatı bulunamadı. Bosphorly satış fiyatı henüz belirlenmedi.':'No verified published supplier rate yet. Bosphorly selling price has not been approved.';
   return;
  }
  const p=new Intl.NumberFormat(tr?'tr-TR':'en-GB',{style:'currency',currency:r.currency,maximumFractionDigits:2}).format(r.price);
  const prefix=r.basis?.startsWith('from')?(tr?'Başlangıç ':'From '):'';
  box.textContent=(tr?'Acentenin yayımladığı fiyat: ':'Supplier published price: ')+prefix+p+' · '+(tr?'Bosphorly satış fiyatı değildir; işlem için sözleşme ve onay gerekir.':'Not a Bosphorly selling tariff; contract and approval required.');
 };
 async function loadMarketPrices(){
  try{const r=await fetch('data/public-market-prices.json',{cache:'no-store'});if(!r.ok)return;const data=await r.json();marketPrices=new Map((data.records||[]).map(x=>[x.id,x]));renderMarketPrice();}catch{}
 }
 
 const namesTr={'bb-morning':'Sabah Boğaz Turu','bb-sunset':'Gün Batımı Boğaz Turu','bb-oldcity':'Bizans ve Osmanlı Mirası Turu','orient-dinner':'Boğaz’da Akşam Yemeği','sea-land':'Boğaz Gezi Turu','alaturka':'Geleneksel Türk Hamamı'};
 const getOffer=()=>offers.find(x=>x.id===$('offer').value);
 const labels=()=>{$('price').textContent=t.price;$('availability').textContent=t.availability;renderMarketPrice();};
 async function load(){
  try{
   const resp=await fetch('data/offers.json',{cache:'no-store'});if(!resp.ok)throw new Error('Cannot load offers');
   const data=await resp.json();offers=(Array.isArray(data.offers)?data.offers:[]).filter(x=>x&&typeof x.id==='string');
   $('offer').replaceChildren(...offers.map(x=>{const op=document.createElement('option');op.value=x.id;op.textContent=(tr&&namesTr[x.id])||x.name;return op;}));
   const fromQuery=query.get('service');if(offers.some(o=>o.id===fromQuery))$('offer').value=fromQuery;
   labels();
  }catch(err){$('error').hidden=false;$('error').textContent=t.notAvailable;$('submit').disabled=true;}
 }
 $('offer').addEventListener('change',labels);
 $('bookingForm').addEventListener('submit',event=>{
  event.preventDefault();const offer=getOffer();const num=$('guests').valueAsNumber;
  const msg=!offer?t.invalidOffer:!$('date').value||$('date').value<local?t.invalidDate:!Number.isInteger(num)||num<1||num>16?t.invalidGuests:!$('ack').checked?t.invalidConsent:null;
  $('error').hidden=!msg;$('error').textContent=msg||'';if(msg)return;
  const preview=window.BosphorlyBooking.preview({experienceId:offer.id,date:$('date').value,guests:num});
  const r=$('result');r.dataset.state=preview.state;r.replaceChildren();const h=document.createElement('h3');h.textContent=t.resultTitle;const p=document.createElement('p');p.textContent=t.resultNotice;
  const d=document.createElement('dl');d.className='draft';
  const fields=[[tr?'Deneyim':'Experience',tr&&namesTr[offer.id]||offer.name],[tr?'Tarih':'Date',$('date').value],[tr?'Zaman':'Time',time.selectedOptions[0].textContent],[tr?'Kişi':'Guests',String(num)],[tr?'Bölge':'Area',area.selectedOptions[0].textContent],[tr?'Fiyat':'Price',$('price').textContent]];
  fields.forEach(([key,val])=>{const dt=document.createElement('dt');dt.textContent=key;const dd=document.createElement('dd');dd.textContent=val;d.append(dt,dd)});
  r.append(h,p,d);r.hidden=false;r.focus();
 });
 load();loadMarketPrices();
})();