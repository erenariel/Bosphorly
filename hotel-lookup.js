'use strict';
/* Hotel identity + address enrichment via Google Places (New). Google key is optional.
   The fallback requires manual entry without claiming automatic verification.
   No guest data is stored or sent to Bosphorly servers by this prototype. */
(() => {
  const input=document.getElementById('hotel');
  const container=document.getElementById('hotelPlacesMount');
  const info=document.getElementById('hotelVerification');
  const zone=document.getElementById('zone');
  if(!input||!container||!info||!zone)return;
  let identity=null;
  const primaryLanguage=()=>document.documentElement.lang||'en';
  const tr=()=>primaryLanguage()==='tr';
  const setInfo=(message,ok=false)=>{
    info.textContent=message;
    info.dataset.verified=ok?'yes':'no';
  };
  const manualNotice=()=>setInfo(tr()?
    'Otel adresi otomatik doğrulanmadı. Otel adını ve bölgesini elle seçebilirsin.':
    'Hotel address is not verified automatically. You may enter the hotel and select its area manually.');
  function zoneFromLocation(address=''){
    const normalized=address.toLocaleLowerCase('tr-TR');
    if(/sultanahmet|cankurtaran|binbirdirek|kucuk ayasofya|küçük ayasofya|ale mdar|alemd ar/.test(normalized))return 'sultanahmet';
    if(/sirkeci|eminönü|eminonu|hobyar/.test(normalized))return 'sirkeci';
    if(/taksim|beyoğlu|beyoglu|cihangir|galata/.test(normalized))return 'taksim';
    if(/kadıköy|kadikoy|moda|caferağa/.test(normalized))return 'kadikoy';
    return 'other';
  }
  window.BosphorlyHotel=Object.freeze({
    current:()=>identity?{...identity}:null,
    isVerified:()=>Boolean(identity),
  });
  input.addEventListener('input',()=>{identity=null;manualNotice()});
  zone.addEventListener('change',()=>{if(identity){identity=null;setInfo(tr()?
    'Bölgeyi elle değiştirdin. Google otel eşleşmesini tekrar seçmelisin.':
    'You changed the area manually; reselect your hotel to verify its address.')}});
  manualNotice();
  const key=window.BOSPHORLY_PUBLIC_CONFIG?.googleMapsBrowserKey?.trim();
  if(!key)return;
  const script=document.createElement('script');
  script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&v=weekly&loading=async';
  script.async=true;
  script.onerror=()=>{
    manualNotice();
    container.textContent='';
  };
  script.onload=async()=>{
    try{
      const {PlaceAutocompleteElement}=await google.maps.importLibrary('places');
      const autocomplete=new PlaceAutocompleteElement();
      autocomplete.placeholder=tr()?'İstanbul otelini ara…':'Find your Istanbul hotel…';
      autocomplete.includedRegionCodes=['tr'];
      // Bias toward greater Istanbul rather than returning hotels from elsewhere.
      autocomplete.locationBias={north:41.75,south:40.5,east:30.2,west:27.65};
      autocomplete.addEventListener('gmp-select',async({placePrediction})=>{
        try{
          const place=placePrediction.toPlace();
          await place.fetchFields({fields:['id','displayName','formattedAddress','location','addressComponents']});
          if(!place.id||!place.formattedAddress||!place.location){
            setInfo(tr()?'Otelin adresi doğrulanamadı.':'Hotel address could not be verified.');
            return;
          }
          const coords=place.location.toJSON?.()||{lat:place.location.lat(),lng:place.location.lng()};
          if(!(coords.lat>=40.45&&coords.lat<=41.8&&coords.lng>=27.5&&coords.lng<=30.3)){
            setInfo(tr()?'Bu sonuç İstanbul sınırları dışında. İstanbul oteli seç.':'This result is outside greater Istanbul. Select a hotel in Istanbul.');
            return;
          }
          identity={placeId:place.id,hotelName:place.displayName||'Hotel',address:place.formattedAddress,lat:coords.lat,lng:coords.lng,source:'google_places'};
          input.value=identity.hotelName;
          const recognizedZone=zoneFromLocation(identity.address);
          zone.value=recognizedZone;
          zone.dispatchEvent(new Event('input',{bubbles:true}));
          setInfo((tr()?'✓ Google tarafından eşleşti: ':'✓ Matched on Google: ')+identity.address,true);
          window.dispatchEvent(new CustomEvent('bosphorly:hotel-selected',{detail:{...identity,zone:recognizedZone}}));
        }catch{
          setInfo(tr()?'Otel doğrulanamadı; tekrar dene.':'Hotel verification failed; try again.');
        }
      });
      container.appendChild(autocomplete);
      input.hidden=true;
      input.removeAttribute('required');
      setInfo(tr()?'Google üzerinden otelini seç; adres ve konum otomatik eklenecek.':'Choose your hotel from Google suggestions to populate its address.');
    }catch{
      manualNotice();
    }
  };
  document.head.appendChild(script);
})();
