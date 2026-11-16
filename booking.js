'use strict';
/* Public, local-only demonstration: no PII, payment, API submission or request forwarding. */
(()=>{
 const $=id=>document.getElementById(id);
 const query=new URLSearchParams(location.search);
 const tr=query.get('lang')==='tr'||(!query.has('lang')&&navigator.language.toLowerCase().startsWith('tr'));
 document.documentElement.lang=tr?'tr':'en';
 const i18n={
  en:{eyebrow:'YOUR ISTANBUL · YOUR WAY',heading:'Request your experience through Bosphorly.',subheading:'Choose your activity, preferred date and hotel area. Your request goes from Bosphorly to the licensed company that runs the experience; you pay the company directly.',stepName:'Request details',formTitle:'Your request',formIntro:'A preview of the future request form. Nothing is sent to any company.',labelOffer:'Experience',labelDate:'Preferred date',labelTime:'Preferred time',labelGuests:'Guests',labelArea:'Hotel area',labelStatus:'Price status',labelAvailability:'Availability',price:'Price set by the company',availability:'Confirmed by the company',priceNote:'Requestable prices are the ones each licensed company approves for Bosphorly, never higher than booking with the company directly. This public prototype does not send requests.',consent:'I understand this is a preview only: no request is sent to any company and no payment is taken.',submit:'Preview my request →',whyTitle:'Compare here. Pay the company.',whyText:'Bosphorly lists licensed Istanbul companies side by side and forwards your request with a Bosphorly reference code. The company confirms, runs the experience and collects payment.',item1:'Company prices, no Bosphorly surcharge',item2:'Company licence checked before listing',item3:'Bosphorly reference code on every request',mapTitle:'Explore before you request',mapLink:'Open Istanbul city map →',invalidDate:'Choose a future date.',invalidGuests:'Select 1–16 guests.',invalidOffer:'Select an experience.',invalidConsent:'Acknowledge that this is a preview only.',resultTitle:'Request preview created — NOT SENT',resultNotice:'No request was sent. When requests open, this form will send your request with a Bosphorly reference code to the company, which confirms it and collects payment directly.',notAvailable:'Catalog not available. Please reload.',protoTag:'PUBLIC PROTOTYPE',protoText:'No request is sent and no payment is taken by this website',navHome:'Home',navCompare:'Compare tours',navMap:'City map',footerText:'Bosphorly · Public demonstration · No personal identity or payment data is collected in this prototype.',backHome:'← Back to homepage'},
  tr:{eyebrow:'İSTANBUL · SENİN PLANIN',heading:'Deneyimini Bosphorly üzerinden talep et.',subheading:'Etkinliğini, tarihini ve otel bölgeni seç. Talebin Bosphorly’den deneyimi düzenleyen lisanslı firmaya iletilir; ödemeyi doğrudan firmaya yaparsın.',stepName:'Talep detayları',formTitle:'Talebin',formIntro:'Gelecekteki talep formunun önizlemesi. Hiçbir firmaya bir şey gönderilmez.',labelOffer:'Deneyim',labelDate:'Tercih edilen tarih',labelTime:'Tercih edilen saat',labelGuests:'Kişi sayısı',labelArea:'Otel bölgesi',labelStatus:'Fiyat durumu',labelAvailability:'Müsaitlik',price:'Fiyatı firma belirler',availability:'Firma tarafından teyit edilir',priceNote:'Talep edilebilir fiyatlar, her lisanslı firmanın Bosphorly için onayladığı fiyatlardır ve firmadan doğrudan alacağın fiyattan yüksek olamaz. Bu açık prototip talep göndermez.',consent:'Bunun yalnızca önizleme olduğunu, hiçbir firmaya talep gönderilmeyeceğini ve ödeme alınmayacağını biliyorum.',submit:'Talebimi önizle →',whyTitle:'Burada karşılaştır. Ödemeyi firmaya yap.',whyText:'Bosphorly lisanslı İstanbul firmalarını yan yana gösterir ve talebini bir Bosphorly referans koduyla iletir. Onayı veren, hizmeti sunan ve ödemeyi alan firmadır.',item1:'Firma fiyatı, Bosphorly ek ücreti yok',item2:'Listelemeden önce firma lisansı kontrolü',item3:'Her talepte Bosphorly referans kodu',mapTitle:'Talep etmeden önce keşfet',mapLink:'İstanbul haritasını aç →',invalidDate:'İleri bir tarih seç.',invalidGuests:'1–16 kişi seç.',invalidOffer:'Bir deneyim seç.',invalidConsent:'Önizleme koşulunu onayla.',resultTitle:'Talep önizlemesi oluşturuldu — GÖNDERİLMEDİ',resultNotice:'Hiçbir talep gönderilmedi. Talepler açıldığında bu form talebini Bosphorly referans koduyla firmaya iletecek; onayı ve ödemeyi firma doğrudan alacak.',notAvailable:'Katalog açılamadı. Sayfayı yenile.',protoTag:'AÇIK PROTOTİP',protoText:'Bu site talep göndermez, ödeme almaz',navHome:'Ana sayfa',navCompare:'Tur karşılaştır',navMap:'Şehir haritası',footerText:'Bosphorly · Açık demo · Bu prototipte kimlik veya ödeme bilgisi toplanmaz.',backHome:'← Ana sayfaya dön'}
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
   box.textContent=tr?'Firmanın yayımlanmış fiyatı bulunamadı. Firma henüz Bosphorly için fiyat onaylamadı.':'No published company price found yet. The company has not approved a price for Bosphorly.';
   return;
  }
  const p=new Intl.NumberFormat(tr?'tr-TR':'en-GB',{style:'currency',currency:r.currency,maximumFractionDigits:2}).format(r.price);
  const prefix=r.basis?.startsWith('from')?(tr?'Başlangıç ':'From '):'';
  box.textContent=(tr?'Firmanın yayımladığı fiyat: ':'Company published price: ')+prefix+p+' · '+(tr?'Firma ile anlaşma imzalanana kadar talep edilemez.':'Requestable only after the company signs an agreement with Bosphorly.');
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