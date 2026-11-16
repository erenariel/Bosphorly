/* Bosphorly demo console: fabricated sample figures only, no API calls. */
(()=>{const $=id=>document.getElementById(id);const tabs=[...document.querySelectorAll('.tab[data-tab]')];const panes=[...document.querySelectorAll('.pane')];function show(tab){tabs.forEach(x=>{const on=x.dataset.tab===tab;x.classList.toggle('active',on);x.setAttribute('aria-selected',String(on));});panes.forEach(x=>x.classList.toggle('hidden',x.id!=='pane-'+tab));}tabs.forEach(x=>x.addEventListener('click',()=>show(x.dataset.tab)));const values={week:{clicks:128,sales:18,gross:1540,commission:154,bar:[31,47,58,42,73,91]},month:{clicks:573,sales:81,gross:6940,commission:694,bar:[55,72,68,82,90,100]}};function showRange(range){let d=values[range]||values.week;for(let id of ['clicks','sales'])$(id).textContent=d[id].toLocaleString('en');for(let id of ['gross','commission'])$(id).textContent='€'+d[id].toLocaleString('en');$('bar-chart').replaceChildren(...d.bar.map((v,i)=>{const e=document.createElement('div');e.style.height=v+'%';e.title='Illustrative value '+(i+1);return e;}));}const range=$('range');range.addEventListener('change',()=>showRange(range.value));showRange(range.value);show('overview');
(async()=>{
  const rows=$('priceRows');if(!rows)return;
  try{
    const response=await fetch('data/offers.json',{cache:'no-store'});
    if(!response.ok)throw Error('Catalog unavailable');
    const data=await response.json();
    rows.replaceChildren();
    for(const offer of data.offers||[]){
      const tr=document.createElement('tr');
      const cells=[offer.name,'Quote required','Contract pending','Demo only'];
      for(const value of cells){const cell=document.createElement('td');cell.textContent=value;tr.append(cell);}
      rows.append(tr);
    }
  }catch{
    rows.replaceChildren();const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent='Catalog unavailable. Please retry.';tr.append(td);rows.append(tr);
  }
})();})();