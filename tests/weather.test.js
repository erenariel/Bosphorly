import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeForecast,recommendation,istanbulDay,sky} from '../weather-model.js';
import {weatherFixture} from './weather-fixture.js';
const now=Date.parse('2030-04-01T06:30:00Z');
test('seven days and local date use Istanbul rather than browser timezone',()=>{
 const midnight=Date.parse('2030-04-01T21:30:00Z'),f=normalizeForecast(weatherFixture(midnight),midnight);
 assert.equal(f.days.length,7);assert.equal(f.days[0].day,'2030-04-02');assert.equal(f.current.temp,20);
});
test('chooses only future daytime six-hour windows inside seven-day horizon',()=>{
 const f=normalizeForecast(weatherFixture(now),now),best=recommendation(f,'cruise',now);
 assert.ok(best.start>=now+3600000);assert.equal(best.end-best.start,6*3600000);assert.ok(f.days.some(d=>d.day===best.day));
 const local=new Date(best.start+3*3600000);assert.ok(local.getUTCHours()>=9&&local.getUTCHours()+6<=17);
});
test('ranks a calmer, drier, more comfortable future day ahead of the default',()=>{
 const raw=weatherFixture(now,{wind:4,rain:0.5,temp:18}),target='2030-04-03';
 for(const row of raw.properties.timeseries)if(istanbulDay(Date.parse(row.time))===target){row.data.instant.details.air_temperature=22;row.data.instant.details.wind_speed=1;row.data.next_6_hours.details.precipitation_amount=0;}
 const f=normalizeForecast(raw,now);assert.equal(recommendation(f,'cruise',now).day,target);
});
test('cruises use stricter wind and rainfall criteria than city walks',()=>{
 for(const options of [{wind:8},{rain:1.5}]){const f=normalizeForecast(weatherFixture(now,options),now);assert.equal(recommendation(f,'cruise',now),null);assert.ok(recommendation(f,'city',now));}
});
test('unsafe-looking, extreme, unknown or indoor cases never get a best outdoor slot',()=>{
 for(const options of [{wind:15},{rain:5},{temp:40},{symbol:'heavyrainandthunder'},{symbol:'fog'},{symbol:'unknown'}]) assert.equal(recommendation(normalizeForecast(weatherFixture(now,options),now),'city',now),null);
 assert.equal(recommendation(normalizeForecast(weatherFixture(now),now),'wellness',now),null);
});
test('missing values are not interpreted as zero rain or calm wind',()=>{
 for(const field of ['rain','wind']){const raw=weatherFixture(now,{[field]:null}),f=normalizeForecast(raw,now);assert.equal(recommendation(f,'city',now),null);}
});
test('stale models, wrong units and missing days are rejected',()=>{
 const stale=weatherFixture(now);stale.properties.meta.updated_at=new Date(now-13*3600000).toISOString();assert.throws(()=>normalizeForecast(stale,now));
 const wrong=weatherFixture(now);wrong.properties.meta.units.wind_speed='km/h';assert.throws(()=>normalizeForecast(wrong,now));
 const incomplete=weatherFixture(now);incomplete.properties.timeseries=incomplete.properties.timeseries.slice(0,3);assert.throws(()=>normalizeForecast(incomplete,now));
 assert.throws(()=>normalizeForecast(null,now));
 const f=normalizeForecast(weatherFixture(now),now);assert.equal(recommendation(f,'city',now+13*3600000),null);
});
test('unknown weather symbols do not become sunshine',()=>{assert.equal(sky(null),'unknown');assert.equal(sky('new_symbol'),'unknown');assert.equal(sky('heavyrainandthunder'),'storm');});
