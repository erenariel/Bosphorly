// Keep application controllers mounted. The new presentation reads their current
// catalog and delegates actions back to the same controls as the original page.
addEventListener('load', () => {
  const source = selector => document.querySelector(selector);
  const host = document.createElement('bosphorly-home');
  const ui = host.attachShadow({mode:'open'});
  const hero = source('section.hero');
  if (!hero) return;
  document.body.prepend(host);
  ui.innerHTML = `<link rel="stylesheet" href="assets/home-review/home.css">
    <main><section class="scene"><div class="land"><article><h1></h1><i></i><p></p></article><button class="bubble"></button><img class="mimo" src="assets/high-fidelity/mimo-v2.png" alt="Mimo"></div>
    <div class="finder"><div class="tabs"></div><div class="fields"><label><b>⌖</b><span></span><select id="service"></select></label><label><b>▦</b><span></span><input id="day" type="date" required><small class="date-hint" aria-hidden="true"></small></label><label><b>♧</b><span></span><select id="count"></select></label><button class="search"></button></div></div>
    <div class="trust"></div></section><section class="offers"><div class="heading"><h2></h2><a href="prices.html"></a></div><div class="cards"></div><details class="credits"><summary>©</summary><a href="assets/images/tours/CREDITS.md">Wikimedia Commons · Authors &amp; licences</a></details><button class="plan"><strong></strong><span></span><b>→</b><img src="assets/high-fidelity/mimo-v2.png" alt=""></button></section></main>`;
  const get = s => ui.querySelector(s);
  const text = s => source(s)?.textContent.trim() || '';
  const button = (parent, label, action) => {
    const b = document.createElement('button'); b.textContent=label;
    b.addEventListener('click',action);parent.append(b);return b;
  };
  const hide = node => {if(node)node.style.setProperty('display','none','important')};
  const header = source('.site-header');
  header.after(host);
  header.addEventListener('click', event => {
    if(event.target.closest('a')?.getAttribute('href') === '#experiences'){
      event.preventDefault(); get('.offers').scrollIntoView();
    }
  });
  const oldOffers = source('#experiences');
  [hero, source('.hf-trust'), oldOffers].forEach(hide);
  const openMimo = () => source('#heroMimoAsk').click();
  get('.bubble').onclick = get('.plan').onclick = openMimo;
  function mirrorSelect(original, target) {
    if (!original) return;
    target.replaceChildren(...Array.from(original.options,o=>o.cloneNode(true)));
    target.value=original.value;
    target.onchange=()=>{original.value=target.value;original.dispatchEvent(new Event('change',{bubbles:true}))};
  }
  function sync(){
    const tr=document.documentElement.lang.startsWith('tr');
    get('.credits summary').textContent=tr?'Fotoğraf kaynakları':'Photo credits';get('.credits a').textContent=tr?'Wikimedia Commons · Fotoğrafçılar ve lisanslar':'Wikimedia Commons · Authors and licences';
    get('h1').textContent=text('.hero h1');get('article p').textContent=text('[data-i18n=heroSub]');
    get('.bubble').textContent=tr?'Merhaba, ben Mimo! İstanbul seyahatin için sana nasıl yardımcı olabilirim?':text('.hf-mimo-hello')+' '+text('#heroMimoAsk');
    const tabs=get('.tabs');tabs.replaceChildren();
    for(const tab of document.querySelectorAll('[data-hf-tab]')){
      const b=button(tabs,tab.textContent,()=>{tab.click();sync()});b.dataset.active=tab.getAttribute('aria-selected');
    }
    for(const [i,n] of Array.from(ui.querySelectorAll('label span')).entries())n.textContent=tr?['Deneyim / Tur','Tarih','Katılımcı'][i]:text(['[data-hf-copy=experienceLabel]','[data-hf-copy=date]','[data-hf-copy=guests]'][i]);
    mirrorSelect(source('#hfExperience'),get('#service'));mirrorSelect(source('#hfGuests'),get('#count'));
    if(tr)for(const opt of get('#count').options)opt.textContent=opt.value+' yetişkin';
    get('#day').min=source('#hfDate').min;get('#day').lang=document.documentElement.lang;get('.date-hint').textContent=tr?'Tarih seçin':text('[data-hf-copy=date]');
    get('.search').textContent=(tr?'Ara ve Rezervasyon Yap':text('[data-hf-copy=search]'));
    get('.trust').replaceChildren();
    [2,1,3,4].forEach((k,i)=>{const s=document.createElement('span');const icon=document.createElement('b');icon.innerHTML=window.brandIcon(['shield','award','support','bolt'][i]);s.append(icon,text('[data-hf-copy=trust'+k+']'));get('.trust').append(s)});
    get('h2').textContent=tr?'İstanbul’da popüler deneyimler':text('[data-hf-copy=popular]');get('.heading a').textContent=text('.hf-view-all');
    if(tr && matchMedia('(max-width:720px)').matches)get('h2').textContent='Popüler deneyimler';
    get('.plan b').innerHTML=window.brandIcon('arrow');
    get('.plan strong').textContent=text('[data-hf-copy=plan]')||text('.hf-planner h3');get('.plan span').textContent=text('.hf-planner p');
    const cards=get('.cards');cards.replaceChildren();
    const records=Array.from(document.querySelectorAll('#tourGrid .tour-card')).sort((a,b)=>Number(getComputedStyle(a).order)-Number(getComputedStyle(b).order));
    for(const card of records.slice(0,4)){
      const link=card.querySelector('a[href*="booking.html"]'),image=card.querySelector('img');if(!link||!image)continue;
      const item=document.createElement('a');item.href=link.href;
      const photo=image.cloneNode(true),title=document.createElement('strong'),desc=document.createElement('p'),action=document.createElement('span');
      title.textContent=card.querySelector('h3')?.textContent;desc.textContent=card.querySelector('.tour-content p')?.textContent;action.textContent=link.textContent;
      item.append(photo,title,desc,action);cards.append(item);
    }
  }
  ui.addEventListener('click',e=>{if(e.target.closest('a')?.hash==='#home-catalog'){e.preventDefault();get('.offers').scrollIntoView()}});
  get('.search').onclick=()=>{const day=get('#day');if(!day.reportValidity())return;source('#hfDate').value=day.value;source('#hfSearchForm').requestSubmit()};
  const floating = source('.bc-fab');
  if (floating) new IntersectionObserver(entries=>{
    floating.style.visibility=entries[0].isIntersecting?'hidden':'visible';
  }).observe(host);
  ui.querySelectorAll('.fields label b').forEach((b,i)=>b.innerHTML=window.brandIcon(['pin','calendar','users'][i]));
  sync();document.addEventListener('bosphorly:lang',()=>requestAnimationFrame(sync));
  new MutationObserver(sync).observe(source('#tourGrid'),{childList:true});
  if(header)new MutationObserver(sync).observe(header,{attributes:true,subtree:true,attributeFilter:['hidden']});
},{once:true});
