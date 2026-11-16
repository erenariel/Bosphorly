// Derived planning suggestions from MET Norway forecasts, not marine safety or availability advice.
export const FORECAST_URL='https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=41.01&lon=28.97';
export const CACHE_MS=3*60*60*1000;
export const MAX_MODEL_AGE_MS=12*60*60*1000;
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'});
export function istanbulDay(time){const p=Object.fromEntries(dayFormat.formatToParts(new Date(time)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function normalizeForecast(raw,now=Date.now()){
 const meta=raw?.properties?.meta,updated=Date.parse(meta?.updated_at);
 if(!Number.isFinite(updated)||now-updated>MAX_MODEL_AGE_MS||updated-now>300000||meta?.units?.air_temperature!=='celsius'||meta?.units?.wind_speed!=='m/s'||meta?.units?.precipitation_amount!=='mm'||!Array.isArray(raw?.properties?.timeseries))throw Error('Invalid or stale forecast');
 const points=raw.properties.timeseries.map(row=>{
 const time=Date.parse(row?.time),details=row?.data?.instant?.details;
 if(!Number.isFinite(time)||!finite(details?.air_temperature,-60,65))return null;
 const six=row.data.next_6_hours,one=row.data.next_1_hours;
 return {time,temp:details.air_temperature,wind:finite(details.wind_speed,0,100)?details.wind_speed:null,rain:finite(six?.details?.precipitation_amount,0,1000)?six.details.precipitation_amount:null,symbol:six?.summary?.symbol_code||null,currentSymbol:one?.summary?.symbol_code||six?.summary?.symbol_code||null};
 }).filter(Boolean).sort((a,b)=>a.time-b.time);
 if(points.length<7||new Set(points.map(p=>p.time)).size!==points.length)throw Error('Incomplete forecast');
 const today=istanbulDay(now),days=[];
 for(let i=0;i<7;i++){const day=istanbulDay(Date.parse(today+'T12:00:00+03:00')+i*86400000);const samples=points.filter(p=>istanbulDay(p.time)===day);if(!samples.length)throw Error('Missing forecast day');
 const noon=Date.parse(day+'T12:00:00+03:00');const representative=samples.reduce((a,b)=>Math.abs(a.time-noon)<=Math.abs(b.time-noon)?a:b);
 days.push({day,min:Math.min(...samples.map(p=>p.temp)),max:Math.max(...samples.map(p=>p.temp)),symbol:representative.currentSymbol});}
 const current=points.reduce((a,b)=>Math.abs(a.time-now)<=Math.abs(b.time-now)?a:b);
 if(Math.abs(current.time-now)>90*60000)throw Error('No current forecast point');
 return {updated,points,days,current};
}
export function recommendation(forecast,activity,now=Date.now()){
 if(!forecast||!['cruise','city'].includes(activity)||now-forecast.updated>MAX_MODEL_AGE_MS)return null;
 const allowed=new Set(forecast.days.map(d=>d.day));let best=null;
 for(const point of forecast.points){
 const end=point.time+6*3600000,local=new Date(point.time+3*3600000),hour=local.getUTCHours();
 if(!allowed.has(istanbulDay(point.time))||point.time<now+3600000||hour<9||hour+6>17||point.rain===null||!/^((clearsky|fair|partlycloudy)(_(day|night|polartwilight))?|cloudy)$/.test(point.symbol||''))continue;
 if(point.symbol?.endsWith('_night'))continue;
 const samples=forecast.points.filter(p=>p.time>=point.time&&p.time<=end);
 if(samples.length<2||samples.at(-1).time!==end||samples.some(p=>p.wind===null))continue;
 const wind=Math.max(...samples.map(p=>p.wind)),low=Math.min(...samples.map(p=>p.temp)),high=Math.max(...samples.map(p=>p.temp));
 const minTemp=activity==='cruise'?10:8,maxTemp=activity==='cruise'?30:32,maxWind=activity==='cruise'?7:10,maxRain=activity==='cruise'?1:2;
 if(wind>maxWind||point.rain>maxRain||low<minTemp||high>maxTemp)continue;
 const mean=samples.reduce((sum,p)=>sum+p.temp,0)/samples.length,score=point.rain*12+wind*2+Math.abs(mean-22);
 if(!best||score<best.score)best={start:point.time,end,day:istanbulDay(point.time),wind,rain:point.rain,low,high,score};
 }
 return best;
}
export function sky(symbol){if(typeof symbol!=='string')return 'unknown';if(/thunder/.test(symbol))return 'storm';if(/snow|sleet/.test(symbol))return 'snow';if(/rain/.test(symbol))return 'rain';if(/fog/.test(symbol))return 'fog';if(/clearsky/.test(symbol))return 'clear';if(/fair|partlycloudy/.test(symbol))return 'partly';if(symbol==='cloudy')return 'cloudy';return 'unknown';}
