/* Presentation and navigation adapters only. No service, identity or transaction implementation. */
(()=>{
 if(window.__bosphorlyHfReady)return;window.__bosphorlyHfReady=true;
 const short={
 en:['Tours','Transfer','Experiences','Discover','Choose an experience','Date','Guests','Search','Popular experiences','Plan with Mimo','Discover Istanbul with ideas just for you.','Hello, I’m Mimo!','See all','More ways to explore Istanbul'],
 tr:['Turlar','Transfer','Deneyimler','Keşfet','Bir deneyim seçin','Tarih','Katılımcı','Ara','Popüler deneyimler','Mimo ile planla','İstanbul seyahatini sana özel önerilerle keşfet.','Merhaba, ben Mimo!','Tümünü gör','İstanbul’u keşfetmenin diğer yolları'],
 ru:['Туры','Трансфер','Впечатления','Открыть','Выберите впечатление','Дата','Участники','Найти','Популярные впечатления','Планируйте с Mimo','Откройте Стамбул с идеями специально для вас.','Привет, я Mimo!','Смотреть все','Больше о Стамбуле'],
 uk:['Тури','Трансфер','Враження','Відкрити','Оберіть враження','Дата','Учасники','Знайти','Популярні враження','Плануйте з Mimo','Відкрийте Стамбул з ідеями для вас.','Привіт, я Mimo!','Переглянути всі','Більше про Стамбул'],
 de:['Touren','Transfer','Erlebnisse','Entdecken','Erlebnis auswählen','Datum','Personen','Suchen','Beliebte Erlebnisse','Mit Mimo planen','Entdecke Istanbul mit Ideen nur für dich.','Hallo, ich bin Mimo!','Alle ansehen','Mehr von Istanbul entdecken'],
 fr:['Visites','Transfert','Expériences','Découvrir','Choisir une expérience','Date','Participants','Rechercher','Expériences populaires','Planifiez avec Mimo','Découvrez Istanbul avec des idées pour vous.','Bonjour, je suis Mimo !','Tout voir','Découvrir davantage Istanbul'],
 nl:['Tours','Transfer','Ervaringen','Ontdekken','Kies een ervaring','Datum','Deelnemers','Zoeken','Populaire ervaringen','Plan met Mimo','Ontdek Istanbul met ideeën voor jou.','Hallo, ik ben Mimo!','Alles bekijken','Meer van Istanbul ontdekken'],
 ar:['الجولات','النقل','التجارب','اكتشف','اختر تجربة','التاريخ','المشاركون','بحث','تجارب شائعة','خطط مع Mimo','اكتشف إسطنبول بأفكار خاصة بك.','مرحباً، أنا Mimo!','عرض الكل','المزيد لاكتشاف إسطنبول'],
 he:['סיורים','העברה','חוויות','לגלות','בחרו חוויה','תאריך','משתתפים','חיפוש','חוויות פופולריות','תכננו עם Mimo','גלו את איסטנבול עם רעיונות בשבילכם.','שלום, אני Mimo!','הצג הכל','עוד דרכים לגלות את איסטנבול'],
 fa:['تورها','ترانسفر','تجربه‌ها','کشف کنید','یک تجربه انتخاب کنید','تاریخ','شرکت‌کنندگان','جستجو','تجربه‌های محبوب','با Mimo برنامه‌ریزی کنید','استانبول را با ایده‌های ویژه خود کشف کنید.','سلام، من Mimo هستم!','نمایش همه','راه‌های بیشتر برای کشف استانبول'],
 az:['Turlar','Transfer','Təcrübələr','Kəşf et','Təcrübə seçin','Tarix','İştirakçılar','Axtar','Populyar təcrübələr','Mimo ilə planla','İstanbulu sizə özəl təkliflərlə kəşf edin.','Salam, mən Mimo!','Hamısına bax','İstanbulu kəşf etməyin digər yolları'],
 es:['Tours','Traslado','Experiencias','Descubrir','Elige una experiencia','Fecha','Personas','Buscar','Experiencias populares','Planifica con Mimo','Descubre Estambul con ideas para ti.','¡Hola, soy Mimo!','Ver todo','Más formas de descubrir Estambul'],
 it:['Tour','Trasferimento','Esperienze','Scopri','Scegli un’esperienza','Data','Partecipanti','Cerca','Esperienze popolari','Pianifica con Mimo','Scopri Istanbul con idee per te.','Ciao, sono Mimo!','Vedi tutto','Altri modi per scoprire Istanbul'],
 pt:['Passeios','Traslado','Experiências','Descobrir','Escolha uma experiência','Data','Participantes','Buscar','Experiências populares','Planeje com Mimo','Descubra Istambul com ideias para você.','Olá, sou Mimo!','Ver tudo','Mais formas de descobrir Istambul'],
 hr:['Izleti','Transfer','Doživljaji','Istraži','Odaberite doživljaj','Datum','Sudionici','Traži','Popularni doživljaji','Planirajte s Mimo','Otkrijte Istanbul uz ideje za vas.','Bok, ja sam Mimo!','Pogledaj sve','Još načina za istraživanje Istanbula'],
 hu:['Túrák','Transzfer','Élmények','Felfedezés','Válassz élményt','Dátum','Résztvevők','Keresés','Népszerű élmények','Tervezz Mimóval','Fedezd fel Isztambult személyre szabott ötletekkel.','Szia, Mimo vagyok!','Összes','Isztambul további felfedezése'],
 bs:['Izleti','Transfer','Doživljaji','Istraži','Odaberite doživljaj','Datum','Učesnici','Traži','Popularni doživljaji','Planirajte s Mimo','Otkrijte Istanbul uz ideje za vas.','Zdravo, ja sam Mimo!','Pogledaj sve','Još načina za istraživanje Istanbula'],
 zh:['游览','接送','体验','探索','选择体验','日期','人数','搜索','热门体验','与 Mimo 规划','用专属于您的灵感探索伊斯坦布尔。','你好，我是 Mimo！','查看全部','探索伊斯坦布尔的更多方式'],
 ja:['ツアー','送迎','体験','探索','体験を選択','日付','人数','検索','人気の体験','Mimoと計画','あなたのためのアイデアでイスタンブールを発見。','こんにちは、Mimoです！','すべて見る','イスタンブールをもっと探索'],
 ko:['투어','픽업','체험','둘러보기','체험 선택','날짜','인원','검색','인기 체험','Mimo와 계획','당신을 위한 아이디어로 이스탄불을 발견하세요.','안녕하세요, Mimo예요!','모두 보기','이스탄불을 더 알아보기'],
 hi:['टूर','ट्रांसफ़र','अनुभव','घूमिए','अनुभव चुनें','तारीख','यात्री','खोजें','लोकप्रिय अनुभव','Mimo के साथ योजना','आपके लिए खास सुझावों से इस्तांबुल खोजें।','नमस्ते, मैं Mimo हूँ!','सभी देखें','इस्तांबुल खोजने के और तरीके'],
 bn:['ট্যুর','ট্রান্সফার','অভিজ্ঞতা','আবিষ্কার','অভিজ্ঞতা বেছে নিন','তারিখ','অংশগ্রহণকারী','খুঁজুন','জনপ্রিয় অভিজ্ঞতা','Mimo এর সাথে পরিকল্পনা','আপনার জন্য বিশেষ পরামর্শে ইস্তাম্বুল আবিষ্কার করুন।','হ্যালো, আমি Mimo!','সব দেখুন','ইস্তাম্বুল দেখার আরও উপায়'],
 id:['Tur','Transfer','Pengalaman','Jelajahi','Pilih pengalaman','Tanggal','Peserta','Cari','Pengalaman populer','Rencanakan bersama Mimo','Jelajahi Istanbul dengan ide khusus untuk Anda.','Halo, saya Mimo!','Lihat semua','Cara lain menjelajahi Istanbul']
 };
 const keys=['tours','transfer','experiences','discover','experienceLabel','date','guests','search','popular','planTitle','planText','mimoHello','all','moreWays'];
 const locale=()=>String(document.documentElement.lang||'en').slice(0,2);
 const dictionary=()=>Object.fromEntries(keys.map((k,i)=>[k,(short[locale()]||short.en)[i]]));
 let selectedTab='tours';
 const setText=(e,t)=>{if(e&&e.textContent!==t)e.textContent=t};
 function openMimo(){
  const ask=document.getElementById('heroMimoAsk');if(ask){ask.click();return}
  if(window.__bosphorlyOpenMimo){window.__bosphorlyOpenMimo();return}
  const fab=document.querySelector('.bc-fab');if(fab){fab.click();return}
  const base=document.getElementById('siteHeader')?.dataset.base||'';location.href=base+'mimo/'+locale()+'.html';
 }
 function enhancePlainHeaders(){
  const script=document.querySelector('script[src*="high-fidelity-ui.js"]');if(!script)return;
  const root=new URL('assets/high-fidelity/',script.src);
  document.querySelectorAll('header:not(.site-header) a.brand').forEach(brand=>{
   if(brand.dataset.hfReady)return;brand.dataset.hfReady='true';brand.classList.add('hf-plain-brand');brand.dir='ltr';
   const image=new Image(42,42);image.src=new URL('b-emblem.svg',root).href;image.alt='Bosphorly';
   const word=document.createElement('span');word.innerHTML='Bosphorly<span class="hf-com">.com</span><small>Your Intelligent Travel Companion in Istanbul.</small>';brand.replaceChildren(image,word);brand.closest('header').classList.add('hf-plain-header');
  });
  document.querySelectorAll('.sidebar .logo img').forEach(image=>{image.src=new URL('b-emblem.svg',root).href});
  if(location.pathname.includes('/mimo/')&&!document.querySelector('.hf-mimo-character')){
   const main=document.querySelector('main');if(main){document.body.classList.add('hf-mimo-page');const image=new Image(280,350);image.src=new URL('mimo-v2.png',root).href;image.alt='Mimo';image.loading='lazy';image.className='hf-mimo-character';main.append(image)}
  }
 }
 function enhanceHeader(){
  for(const header of document.querySelectorAll('.site-header')){
   if(header.dataset.hfReady)continue;header.dataset.hfReady='true';
   const base=document.getElementById('siteHeader')?.dataset.base||'';
   const brand=header.querySelector('.sh-brand');if(brand){const image=brand.querySelector('img');if(image)image.src=base+'assets/high-fidelity/b-emblem.svg';const text=brand.querySelector(':scope>span');if(text){text.className='hf-wordmark';text.dir='ltr';text.innerHTML='Bosphorly<span class="hf-com">.com</span><small>Your Intelligent Travel Companion in Istanbul.</small>'}}
   const nav=header.querySelector('.sh-nav');if(nav){
    const anchors=[...nav.querySelectorAll(':scope>a')];const tourLinks=anchors.filter(a=>a.getAttribute('href')==='#experiences'||/(?:tours|prices)\.html/.test(a.getAttribute('href')));const transfer=anchors.find(a=>a.getAttribute('href')?.includes('#booking'));const discovery=anchors.filter(a=>!tourLinks.includes(a)&&a!==transfer);
    nav.replaceChildren();
    const group=(key,links)=>{const d=document.createElement('details');d.className='hf-nav-group';const s=document.createElement('summary');s.dataset.hfCopy=key;const menu=document.createElement('div');menu.className='hf-subnav';links.forEach(a=>menu.append(a));d.append(s,menu);nav.append(d)};
    group('tours',tourLinks);if(transfer)nav.append(transfer);group('discover',discovery);
    const mimo=document.createElement('a');mimo.href=base+'mimo/'+locale()+'.html';mimo.textContent='Mimo AI';mimo.addEventListener('click',e=>{e.preventDefault();openMimo()});nav.append(mimo);
    const extra=document.createElement('a');extra.href=base+'extranet/';extra.textContent='Extranet';extra.className='hf-extranet-link';nav.append(extra);
   }
   header.querySelectorAll('.hf-nav-group').forEach(group=>group.addEventListener('toggle',()=>{if(group.open)header.querySelectorAll('.hf-nav-group').forEach(other=>{if(other!==group)other.open=false})}));
   const toggle=document.createElement('button');toggle.type='button';toggle.className='hf-menu-toggle';toggle.textContent='☰';toggle.setAttribute('aria-label','Menu');toggle.setAttribute('aria-expanded','false');toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));header.dataset.hfMenuOpen=String(open)});header.querySelector('.sh-inner')?.append(toggle);
  }
 }
 function options(){
  const select=document.getElementById('hfExperience');if(!select)return;const previous=select.value;
  const records=[];const seen=new Set();
  if(selectedTab==='transfer'){records.push(['IST','Istanbul Airport · IST'],['SAW','Sabiha Gökçen · SAW'])}
  else document.querySelectorAll('#tourGrid a[href*="booking.html?service="]').forEach(a=>{
   const id=new URL(a.href).searchParams.get('service');if(!id||seen.has(id))return;
   if(selectedTab==='tours'&&id.startsWith('alaturka'))return;
   seen.add(id);const card=a.closest('article,section');const title=card?.querySelector('h3,h2')?.textContent||id;records.push([id,title]);
  });
  const signature=JSON.stringify(records);if(select.dataset.hfOptions!==signature){select.replaceChildren(...records.map(([value,label])=>new Option(label,value)));select.dataset.hfOptions=signature;if(records.some(x=>x[0]===previous))select.value=previous}
  document.querySelector('.hf-search-submit')?.toggleAttribute('disabled',!records.length);
 }
 function cards(){
  document.querySelectorAll('#tourGrid .tour-card').forEach(card=>{const link=card.querySelector('a[href*="booking.html?service="]');if(link)card.dataset.hfService=new URL(link.href).searchParams.get('service')||''});options();
 }
 function localize(){
  enhanceHeader();enhancePlainHeaders();const d=dictionary();
  document.querySelectorAll('[data-hf-copy]').forEach(e=>setText(e,d[e.dataset.hfCopy]||e.textContent));
  const title=document.querySelector('[data-i18n=experiencesTitle]');if(title)setText(title,d.popular);
  const trust=({"en": ["Licensed local companies", "Clear published prices", "Multilingual support", "Your Istanbul companion"], "tr": ["Lisanslı yerel firmalar", "Şeffaf fiyatlar", "Çok dilli destek", "İstanbul’un akıllı yol arkadaşı"], "ru": ["Лицензированные компании", "Прозрачные цены", "Поддержка на разных языках", "Ваш помощник в Стамбуле"], "uk": ["Ліцензовані компанії", "Прозорі ціни", "Багатомовна підтримка", "Ваш помічник у Стамбулі"], "de": ["Lizenzierte lokale Anbieter", "Transparente Preise", "Mehrsprachige Unterstützung", "Dein Istanbul-Begleiter"], "fr": ["Prestataires locaux agréés", "Prix transparents", "Assistance multilingue", "Votre compagnon à Istanbul"], "nl": ["Erkende lokale aanbieders", "Duidelijke prijzen", "Meertalige ondersteuning", "Jouw gids in Istanbul"], "ar": ["شركات محلية مرخصة", "أسعار واضحة", "دعم متعدد اللغات", "رفيقك في إسطنبول"], "he": ["חברות מקומיות מורשות", "מחירים שקופים", "תמיכה רב לשונית", "השותף שלך באיסטנבול"], "fa": ["شرکت‌های محلی دارای مجوز", "قیمت‌های شفاف", "پشتیبانی چندزبانه", "همراه شما در استانبول"], "az": ["Lisenziyalı yerli şirkətlər", "Şəffaf qiymətlər", "Çoxdilli dəstək", "İstanbulda yol yoldaşınız"], "es": ["Empresas locales autorizadas", "Precios transparentes", "Asistencia multilingüe", "Tu compañero en Estambul"], "it": ["Operatori locali autorizzati", "Prezzi trasparenti", "Assistenza multilingue", "Il tuo compagno a Istanbul"], "pt": ["Empresas locais licenciadas", "Preços transparentes", "Suporte multilíngue", "Seu companheiro em Istambul"], "hr": ["Licencirane lokalne tvrtke", "Jasne cijene", "Višejezična podrška", "Vaš pratitelj u Istanbulu"], "hu": ["Engedéllyel rendelkező cégek", "Átlátható árak", "Többnyelvű támogatás", "Isztambuli útitársad"], "bs": ["Licencirane lokalne kompanije", "Jasne cijene", "Višejezična podrška", "Vaš pratilac u Istanbulu"], "zh": ["持牌本地公司", "透明价格", "多语言支持", "您的伊斯坦布尔旅伴"], "ja": ["認可された現地企業", "明確な料金", "多言語サポート", "イスタンブールの旅の仲間"], "ko": ["허가된 현지 업체", "명확한 가격", "다국어 지원", "이스탄불 여행 동반자"], "hi": ["लाइसेंस प्राप्त स्थानीय कंपनियाँ", "स्पष्ट कीमतें", "बहुभाषी सहायता", "आपका इस्तांबुल साथी"], "bn": ["অনুমোদিত স্থানীয় কোম্পানি", "স্বচ্ছ মূল্য", "বহুভাষিক সহায়তা", "আপনার ইস্তাম্বুল সঙ্গী"], "id": ["Penyedia lokal berlisensi", "Harga transparan", "Dukungan multibahasa", "Teman perjalanan di Istanbul"]})[locale()]||["Licensed local companies", "Clear published prices", "Multilingual support", "Your Istanbul companion"];
  if(trust)trust.forEach((text,i)=>setText(document.querySelector('[data-hf-copy=trust'+(i+1)+']'),text));
  cards();
 }
 function init(){
  enhanceHeader();
  const utilities=document.getElementById('hfHeroUtilities');if(utilities)requestAnimationFrame(()=>document.querySelectorAll('.hero-copy>:not(h1):not(#heroMimo):not([data-i18n="heroSub"])').forEach(e=>utilities.append(e)));
  const head=document.querySelector('#experiences .section-heading');
  if(head){const filters=document.querySelector('#experiences .filters');if(filters){const menu=document.createElement('details');menu.className='hf-filter-menu';const summary=document.createElement('summary');summary.setAttribute('aria-label','Experience filters');summary.textContent='☷';menu.append(summary,filters);filters.addEventListener('click',e=>{if(e.target.closest('[data-filter]'))menu.open=false});head.append(menu)}}if(head&&!head.querySelector('.hf-view-all')){const all=document.createElement('a');all.href='prices.html';all.className='hf-view-all';all.dataset.hfCopy='all';head.append(all)}
  document.querySelectorAll('[data-hf-open-mimo]').forEach(e=>e.addEventListener('click',openMimo));
  const date=document.getElementById('hfDate');if(date){const today=new Date();today.setMinutes(today.getMinutes()-today.getTimezoneOffset());date.min=today.toISOString().slice(0,10)}
  const tabs=[...document.querySelectorAll('[data-hf-tab]')];
  tabs.forEach((button,i)=>{button.id='hfTab'+i;button.setAttribute('aria-controls','hfSearchForm');button.tabIndex=i===0?0:-1;button.addEventListener('click',()=>{selectedTab=button.dataset.hfTab;tabs.forEach(b=>{b.setAttribute('aria-selected',String(b===button));b.tabIndex=b===button?0:-1});document.getElementById('hfSearchForm')?.setAttribute('aria-labelledby',button.id);options()});button.addEventListener('keydown',e=>{let n;if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else if(['ArrowRight','ArrowLeft'].includes(e.key)){let step=e.key==='ArrowRight'?1:-1;if(document.documentElement.dir==='rtl')step*=-1;n=(i+step+tabs.length)%tabs.length}if(n!==undefined){e.preventDefault();tabs[n].click();tabs[n].focus()}})});
  const searchForm=document.getElementById('hfSearchForm');if(searchForm){searchForm.setAttribute('role','tabpanel');searchForm.setAttribute('aria-labelledby','hfTab0')}
  document.getElementById('hfSearchForm')?.addEventListener('submit',event=>{
   event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
   const service=document.getElementById('hfExperience').value;const dateValue=document.getElementById('hfDate').value;const guests=document.getElementById('hfGuests').value;
   if(selectedTab==='transfer'){
    document.querySelector('[data-airport="'+service+'"]')?.click();const existingDate=document.getElementById('arrivalDate');if(existingDate){existingDate.value=dateValue;existingDate.dispatchEvent(new Event('change',{bubbles:true}))}const passengers=document.getElementById('passengers');if(passengers){passengers.value=guests;passengers.dispatchEvent(new Event('input',{bubbles:true}))}
    document.getElementById('booking')?.scrollIntoView({behavior:'smooth',block:'start'});document.getElementById('hotel')?.focus({preventScroll:true});
   }else{const url=new URL('booking.html',location.href);url.searchParams.set('service',service);url.searchParams.set('date',dateValue);url.searchParams.set('guests',guests);url.searchParams.set('lang',locale());location.assign(url.href)}
  });
  const grid=document.getElementById('tourGrid');if(grid)new MutationObserver(cards).observe(grid,{childList:true});
  // Prefill visible controls only; pricing, limits, validation, consent and sending remain in booking.js.
  if(location.pathname.endsWith('booking.html')){
   const q=new URLSearchParams(location.search),date=q.get('date'),guests=q.get('guests'),offer=document.getElementById('offer');
   if(offer&&(date||guests)){
    let applied=false;
    const apply=()=>{
     if(applied||!offer.options.length)return;applied=true;observer.disconnect();
     const count=document.getElementById('guests'),day=document.getElementById('date');
     if(guests&&/^\d+$/.test(guests)){const n=Number(guests);if(count&&n>=Number(count.min||1)&&n<=Number(count.max||16)){count.value=String(n);count.dispatchEvent(new Event('input',{bubbles:true}))}}
     if(date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&day&&date>=(day.min||'')){day.value=date;day.dispatchEvent(new Event('change',{bubbles:true}))}
    };
    const observer=new MutationObserver(apply);observer.observe(offer,{childList:true,subtree:true});apply();
   }
  }

  localize();document.addEventListener('bosphorly:lang',localize);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
