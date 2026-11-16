// Public taxi-reference mathematics only. Never used as a Bosphorly booking quote.
export const inIstanbul=(lon,lat)=>Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=27.5&&lon<=30.3&&lat>=40.45&&lat<=41.8;
export function locations(raw){
 if(!Array.isArray(raw?.features))throw Error('Invalid geocoder response');
 const seen=new Set();return raw.features.flatMap(f=>{const p=f?.properties,c=f?.geometry?.coordinates;
 if(f?.geometry?.type!=='Point'||!Array.isArray(c)||!inIstanbul(c[0],c[1])||typeof p?.countrycode!=='string'||p.countrycode.toLowerCase()!=='tr'||typeof p.state!=='string'||!/^istanbul$/i.test(p.state.normalize('NFD').replace(/[\u0300-\u036f]/g,'')))return [];
 const label=[p.name,[p.street,p.housenumber].filter(Boolean).join(' '),p.locality,p.district,p.city,p.state].filter(x=>typeof x==='string'&&x.trim()).filter((x,i,a)=>a.indexOf(x)===i).join(', ');
 const key=c.join(',');if(!label||seen.has(key))return [];seen.add(key);return [{lon:c[0],lat:c[1],label:label.slice(0,400)}];
 }).slice(0,5);
}
export function roadRoute(raw){
 const r=raw?.routes?.[0],waypoints=raw?.waypoints;
 if(raw?.code!=='Ok'||!r||!Number.isFinite(r.distance)||r.distance<1||r.distance>500000||!Number.isFinite(r.duration)||r.duration<=0||r.duration>86400||!Array.isArray(waypoints)||waypoints.length!==2||waypoints.some(w=>!Array.isArray(w.location)||!inIstanbul(...w.location)||!Number.isFinite(w.distance)||w.distance<0||w.distance>1500)||!Array.isArray(r.legs)||r.legs.length!==1||!Array.isArray(r.legs[0].steps)||!r.legs[0].steps.length||r.legs[0].steps.some(s=>s.mode!=='driving'))throw Error('No supported road route');
 return {meters:r.distance,seconds:r.duration};
}
export function validTariff(catalog,now=Date.now()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));const day=parts.year+'-'+parts.month+'-'+parts.day;
 return catalog?.status==='PUBLIC_TAXIMETER_REFERENCE_NOT_BOSPHORLY_QUOTES'&&catalog.currency==='TRY'&&['effective_from','verified_at','review_after'].every(k=>/^\d{4}-\d{2}-\d{2}$/.test(catalog[k])&&Number.isFinite(Date.parse(catalog[k]))&&new Date(catalog[k]).toISOString().slice(0,10)===catalog[k])&&catalog.effective_from<=day&&catalog.verified_at<=day&&catalog.review_after>=day&&catalog.review_after>catalog.verified_at&&Date.parse(catalog.review_after)-Date.parse(catalog.verified_at)<=31*86400000;
}
export function taxiScenario(catalog,category,meters,waitingMinutes,now=Date.now()){
 if(!validTariff(catalog,now))throw Error('Tariff needs verification');
 const rate=catalog.categories?.[category];
 if(!rate||!Object.values(rate).every(v=>Number.isSafeInteger(v)&&v>0)||!['opening_minor','per_km_minor','minimum_minor','stationary_minute_minor'].every(k=>Number.isSafeInteger(rate[k]))||!Number.isFinite(meters)||meters<1||meters>500000||!Number.isInteger(waitingMinutes)||waitingMinutes<0||waitingMinutes>120)throw Error('Invalid taxi scenario');
 const base=rate.opening_minor+meters*rate.per_km_minor/1000;
 return {lowMinor:Math.max(rate.minimum_minor,Math.round(base)),highMinor:Math.max(rate.minimum_minor,Math.round(base+waitingMinutes*rate.stationary_minute_minor))};
}
