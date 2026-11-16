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
  const I18N={"ru": {"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "Адрес отеля не проверяется автоматически. Введите название отеля и выберите район вручную.", "You changed the area manually; reselect your hotel to verify its address.": "Вы изменили район вручную; выберите отель снова, чтобы проверить адрес.", "Find your Istanbul hotel…": "Найдите свой отель в Стамбуле…", "Hotel address could not be verified.": "Не удалось проверить адрес отеля.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "Этот результат за пределами Стамбула. Выберите отель в Стамбуле.", "✓ Matched on Google: ": "✓ Найдено в Google: ", "Hotel verification failed; try again.": "Не удалось проверить отель; попробуйте ещё раз.", "Choose your hotel from Google suggestions to populate its address.": "Выберите отель из подсказок Google, чтобы подставить его адрес."}, "ar": {"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "لا يتم التحقق من عنوان الفندق تلقائيًا. اكتب اسم الفندق واختر منطقته يدويًا.", "You changed the area manually; reselect your hotel to verify its address.": "غيّرت المنطقة يدويًا؛ اختر فندقك مجددًا للتحقق من عنوانه.", "Find your Istanbul hotel…": "ابحث عن فندقك في إسطنبول…", "Hotel address could not be verified.": "تعذّر التحقق من عنوان الفندق.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "هذه النتيجة خارج إسطنبول. اختر فندقًا في إسطنبول.", "✓ Matched on Google: ": "✓ تطابق على Google: ", "Hotel verification failed; try again.": "فشل التحقق من الفندق؛ حاول مجددًا.", "Choose your hotel from Google suggestions to populate its address.": "اختر فندقك من اقتراحات Google لإضافة عنوانه."}};
  I18N.it={"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "L’indirizzo dell’hotel non viene verificato automaticamente. Inserisci l’hotel e scegli la zona a mano.", "You changed the area manually; reselect your hotel to verify its address.": "Hai cambiato la zona a mano; seleziona di nuovo l’hotel per verificarne l’indirizzo.", "Find your Istanbul hotel…": "Cerca il tuo hotel a Istanbul…", "Hotel address could not be verified.": "Non è stato possibile verificare l’indirizzo dell’hotel.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "Questo risultato è fuori dall’area di Istanbul. Scegli un hotel a Istanbul.", "✓ Matched on Google: ": "✓ Trovato su Google: ", "Hotel verification failed; try again.": "Verifica dell’hotel non riuscita; riprova.", "Choose your hotel from Google suggestions to populate its address.": "Scegli il tuo hotel dai suggerimenti di Google per inserirne l’indirizzo."};
  I18N.pt={"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "O endereço do hotel não é verificado automaticamente. Digite o hotel e escolha a região manualmente.", "You changed the area manually; reselect your hotel to verify its address.": "Você mudou a região manualmente; selecione o hotel de novo para verificar o endereço.", "Find your Istanbul hotel…": "Busque seu hotel em Istambul…", "Hotel address could not be verified.": "Não foi possível verificar o endereço do hotel.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "Este resultado fica fora da região de Istambul. Escolha um hotel em Istambul.", "✓ Matched on Google: ": "✓ Encontrado no Google: ", "Hotel verification failed; try again.": "A verificação do hotel falhou; tente de novo.", "Choose your hotel from Google suggestions to populate its address.": "Escolha seu hotel nas sugestões do Google para preencher o endereço."};
  I18N.fr={"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "L’adresse de l’hôtel n’est pas vérifiée automatiquement. Saisissez l’hôtel et choisissez son quartier manuellement.", "You changed the area manually; reselect your hotel to verify its address.": "Vous avez changé le quartier manuellement ; sélectionnez à nouveau votre hôtel pour vérifier son adresse.", "Find your Istanbul hotel…": "Trouvez votre hôtel à Istanbul…", "Hotel address could not be verified.": "L’adresse de l’hôtel n’a pas pu être vérifiée.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "Ce résultat est hors de l’agglomération d’Istanbul. Choisissez un hôtel à Istanbul.", "✓ Matched on Google: ": "✓ Trouvé sur Google : ", "Hotel verification failed; try again.": "La vérification de l’hôtel a échoué ; réessayez.", "Choose your hotel from Google suggestions to populate its address.": "Choisissez votre hôtel parmi les suggestions Google pour remplir son adresse."};
  I18N.es={"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "La dirección del hotel no se verifica automáticamente. Escribe el hotel y elige su zona manualmente.", "You changed the area manually; reselect your hotel to verify its address.": "Has cambiado la zona manualmente; vuelve a seleccionar el hotel para verificar su dirección.", "Find your Istanbul hotel…": "Busca tu hotel en Estambul…", "Hotel address could not be verified.": "No se pudo verificar la dirección del hotel.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "Este resultado está fuera del área de Estambul. Elige un hotel en Estambul.", "✓ Matched on Google: ": "✓ Encontrado en Google: ", "Hotel verification failed; try again.": "No se pudo verificar el hotel; inténtalo de nuevo.", "Choose your hotel from Google suggestions to populate its address.": "Elige tu hotel entre las sugerencias de Google para rellenar su dirección."};
  I18N.uk={"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "Адреса готелю не перевіряється автоматично. Введіть назву готелю й оберіть район вручну.", "You changed the area manually; reselect your hotel to verify its address.": "Ви змінили район вручну; оберіть готель ще раз, щоб перевірити адресу.", "Find your Istanbul hotel…": "Знайдіть свій готель у Стамбулі…", "Hotel address could not be verified.": "Не вдалося перевірити адресу готелю.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "Цей результат поза межами Стамбула. Оберіть готель у Стамбулі.", "✓ Matched on Google: ": "✓ Знайдено в Google: ", "Hotel verification failed; try again.": "Не вдалося перевірити готель; спробуйте ще раз.", "Choose your hotel from Google suggestions to populate its address.": "Оберіть готель із підказок Google, щоб підставити його адресу."};
  I18N.nl={"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "Het hoteladres wordt niet automatisch gecontroleerd. Vul het hotel in en kies de wijk zelf.", "You changed the area manually; reselect your hotel to verify its address.": "Je hebt de wijk zelf gewijzigd; kies je hotel opnieuw om het adres te controleren.", "Find your Istanbul hotel…": "Zoek je hotel in Istanbul…", "Hotel address could not be verified.": "Het hoteladres kon niet worden gecontroleerd.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "Dit resultaat ligt buiten Istanbul. Kies een hotel in Istanbul.", "✓ Matched on Google: ": "✓ Gevonden op Google: ", "Hotel verification failed; try again.": "Controle van het hotel mislukt; probeer het opnieuw.", "Choose your hotel from Google suggestions to populate its address.": "Kies je hotel uit de suggesties van Google om het adres in te vullen."};
  I18N.az={"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "Otel ünvanı avtomatik yoxlanılmır. Oteli yazın və rayonu əl ilə seçin.", "You changed the area manually; reselect your hotel to verify its address.": "Rayonu əl ilə dəyişdiniz; ünvanı yoxlamaq üçün oteli yenidən seçin.", "Find your Istanbul hotel…": "İstanbuldakı otelinizi tapın…", "Hotel address could not be verified.": "Otel ünvanını yoxlamaq mümkün olmadı.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "Bu nəticə İstanbuldan kənardadır. İstanbulda otel seçin.", "✓ Matched on Google: ": "✓ Google-da tapıldı: ", "Hotel verification failed; try again.": "Otel yoxlanılmadı; yenidən cəhd edin.", "Choose your hotel from Google suggestions to populate its address.": "Ünvanı doldurmaq üçün oteli Google təkliflərindən seçin."};
  I18N.he={"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "כתובת המלון אינה מאומתת אוטומטית. הזינו את המלון ובחרו את האזור ידנית.", "You changed the area manually; reselect your hotel to verify its address.": "שיניתם את האזור ידנית; בחרו שוב את המלון כדי לאמת את הכתובת.", "Find your Istanbul hotel…": "חפשו את המלון שלכם באיסטנבול…", "Hotel address could not be verified.": "לא ניתן היה לאמת את כתובת המלון.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "התוצאה הזו מחוץ לאיסטנבול רבתי. בחרו מלון באיסטנבול.", "✓ Matched on Google: ": "✓ נמצא ב-Google: ", "Hotel verification failed; try again.": "אימות המלון נכשל; נסו שוב.", "Choose your hotel from Google suggestions to populate its address.": "בחרו את המלון מהצעות Google כדי למלא את הכתובת."};
  I18N.fa={"Hotel address is not verified automatically. You may enter the hotel and select its area manually.": "نشانی هتل به‌صورت خودکار بررسی نمی‌شود. نام هتل را بنویسید و منطقه را دستی انتخاب کنید.", "You changed the area manually; reselect your hotel to verify its address.": "منطقه را دستی تغییر دادید؛ برای بررسی نشانی، هتل را دوباره انتخاب کنید.", "Find your Istanbul hotel…": "هتل خود را در استانبول پیدا کنید…", "Hotel address could not be verified.": "نشانی هتل بررسی نشد.", "This result is outside greater Istanbul. Select a hotel in Istanbul.": "این نتیجه بیرون از استانبول است. هتلی در استانبول انتخاب کنید.", "✓ Matched on Google: ": "✓ در Google پیدا شد: ", "Hotel verification failed; try again.": "بررسی هتل ناموفق بود؛ دوباره امتحان کنید.", "Choose your hotel from Google suggestions to populate its address.": "برای پر شدن نشانی، هتل را از پیشنهادهای Google انتخاب کنید."};
  const pick=(trText,en)=>tr()?trText:((I18N[primaryLanguage()]||{})[en]||en);
  const setInfo=(message,ok=false)=>{
    info.textContent=message;
    info.dataset.verified=ok?'yes':'no';
  };
  const manualNotice=()=>setInfo(pick('Otel adresi otomatik doğrulanmadı. Otel adını ve bölgesini elle seçebilirsin.','Hotel address is not verified automatically. You may enter the hotel and select its area manually.'));
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
  document.addEventListener('bosphorly:lang',()=>{if(!identity)manualNotice()});
  zone.addEventListener('change',()=>{if(identity){identity=null;setInfo(pick('Bölgeyi elle değiştirdin. Google otel eşleşmesini tekrar seçmelisin.','You changed the area manually; reselect your hotel to verify its address.'))}});
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
      autocomplete.placeholder=pick('İstanbul otelini ara…','Find your Istanbul hotel…');
      autocomplete.includedRegionCodes=['tr'];
      // Bias toward greater Istanbul rather than returning hotels from elsewhere.
      autocomplete.locationBias={north:41.75,south:40.5,east:30.2,west:27.65};
      autocomplete.addEventListener('gmp-select',async({placePrediction})=>{
        try{
          const place=placePrediction.toPlace();
          await place.fetchFields({fields:['id','displayName','formattedAddress','location','addressComponents']});
          if(!place.id||!place.formattedAddress||!place.location){
            setInfo(pick('Otelin adresi doğrulanamadı.','Hotel address could not be verified.'));
            return;
          }
          const coords=place.location.toJSON?.()||{lat:place.location.lat(),lng:place.location.lng()};
          if(!(coords.lat>=40.45&&coords.lat<=41.8&&coords.lng>=27.5&&coords.lng<=30.3)){
            setInfo(pick('Bu sonuç İstanbul sınırları dışında. İstanbul oteli seç.','This result is outside greater Istanbul. Select a hotel in Istanbul.'));
            return;
          }
          identity={placeId:place.id,hotelName:place.displayName||'Hotel',address:place.formattedAddress,lat:coords.lat,lng:coords.lng,source:'google_places'};
          input.value=identity.hotelName;
          const recognizedZone=zoneFromLocation(identity.address);
          zone.value=recognizedZone;
          zone.dispatchEvent(new Event('input',{bubbles:true}));
          setInfo((pick('✓ Google tarafından eşleşti: ','✓ Matched on Google: '))+identity.address,true);
          window.dispatchEvent(new CustomEvent('bosphorly:hotel-selected',{detail:{...identity,zone:recognizedZone}}));
        }catch{
          setInfo(pick('Otel doğrulanamadı; tekrar dene.','Hotel verification failed; try again.'));
        }
      });
      container.appendChild(autocomplete);
      input.hidden=true;
      input.removeAttribute('required');
      setInfo(pick('Google üzerinden otelini seç; adres ve konum otomatik eklenecek.','Choose your hotel from Google suggestions to populate its address.'));
    }catch{
      manualNotice();
    }
  };
  document.head.appendChild(script);
})();
