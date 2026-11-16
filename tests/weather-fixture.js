export function weatherFixture(now=Date.now(),{wind=2,rain=0,temp=20,symbol='clearsky_day'}={}){
 const start=Math.floor(now/3600000)*3600000-3600000;
 return {type:'Feature',properties:{meta:{updated_at:new Date(now-60000).toISOString(),units:{air_temperature:'celsius',wind_speed:'m/s',precipitation_amount:'mm'}},timeseries:Array.from({length:9*24},(_,i)=>({time:new Date(start+i*3600000).toISOString(),data:{instant:{details:{air_temperature:temp,wind_speed:wind}},next_1_hours:{summary:{symbol_code:symbol},details:{precipitation_amount:rain/6}},next_6_hours:{summary:{symbol_code:symbol},details:{precipitation_amount:rain}}}}))}};
}
