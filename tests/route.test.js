import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {locations,roadRoute,taxiScenario,validTariff} from '../route-model.js';
const tariff=JSON.parse(readFileSync(new URL('../data/taxi-reference.json',import.meta.url)));
const now=Date.parse('2026-11-16T12:00:00+03:00');
const feature=(state='İstanbul',coordinates=[28.99,41.05])=>({geometry:{type:'Point',coordinates},properties:{name:'Synthetic place',city:'Şişli',state,countrycode:'TR'}});
const route=()=>({code:'Ok',routes:[{distance:10000,duration:1200,legs:[{steps:[{mode:'driving'}]}]}],waypoints:[{location:[28.99,41.05],distance:10},{location:[28.9,41.04],distance:20}]});
test('requires explicit Istanbul point matches and removes duplicates',()=>{
 assert.equal(locations({features:[feature(),feature(),feature('Ankara'),feature('İstanbul',[32,39]),feature('İstanbul',['28.99',41])]}).length,1);
 assert.equal(locations({features:[feature('Istanbul')]}).length,1);assert.throws(()=>locations({}));
});
test('requires a driving road result, valid metre units and nearby snapped endpoints',()=>{
 assert.deepEqual(roadRoute(route()),{meters:10000,seconds:1200});
 for(const change of [r=>r.code='NoRoute',r=>r.routes[0].distance=NaN,r=>r.routes[0].distance=0,r=>r.routes[0].legs[0].steps[0].mode='ferry',r=>r.waypoints[0].distance=3000,r=>r.routes[0].legs=[]]){const r=route();change(r);assert.throws(()=>roadRoute(r));}
});
test('official yellow taxi distance and stationary waiting scenarios use integer kuruş',()=>{
 assert.deepEqual(taxiScenario(tariff,'yellow',10000,15,now),{lowMinor:55114,highMinor:70084});
 assert.deepEqual(taxiScenario(tariff,'yellow',1000,15,now),{lowMinor:23000,highMinor:26956});
 assert.deepEqual(taxiScenario(tariff,'yellow',1000,0,now),{lowMinor:23000,highMinor:23000});
});
test('unrounded metres drive the calculation and minimum applies after all components',()=>{
 assert.equal(taxiScenario(tariff,'yellow',1001,0,now).lowMinor,23000);
 assert.equal(taxiScenario(tariff,'yellow',10001,0,now).lowMinor,55119);
 assert.equal(taxiScenario(tariff,'licensed_eight',10000,0,now).lowMinor,71642);
});
test('private Vito prices are never inferred from a licensed taxi tier',()=>{assert.equal(tariff.private_vito.approved_rates,null);assert.throws(()=>taxiScenario(tariff,'private_vito',10000,0,now));});
test('expired, future and malformed tariffs never produce reference prices',()=>{
 assert.equal(validTariff(tariff,now),true);assert.equal(validTariff(tariff,Date.parse('2026-12-17T12:00Z')),false);
 for(const changed of [{verified_at:'2026-11-17'},{review_after:'2030-01-01'},{currency:'EUR'},{effective_from:'2030-01-01'}])assert.throws(()=>taxiScenario({...tariff,...changed},'yellow',10000,0,now));
});
test('rejects negative, nonfinite or out-of-range distance and waiting',()=>{
 for(const meters of [-1,0,Infinity,NaN,600000])assert.throws(()=>taxiScenario(tariff,'yellow',meters,0,now));
 for(const waiting of [-1,121,0.5,NaN])assert.throws(()=>taxiScenario(tariff,'yellow',10000,waiting,now));
});
