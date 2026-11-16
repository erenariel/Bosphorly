import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/worker.js';
import {plan,publicQuote,transition,transitions} from '../backend/domain.js';
const future='2099-01-01';
test('strict plan validation rejects amounts, PII and impossible dates',()=>{
 assert.equal(plan({experienceId:'bb-morning',date:future,guests:2}).guests,2);
 for(const extra of [{total:1},{email:'test@example.com'},{date:'2099-02-30'},{guests:0},{guests:17},{guests:1.5}]) assert.throws(()=>plan({experienceId:'bb-morning',date:future,guests:2,...extra}));
});
test('quote explicitly allowlists public fields',()=>{
 assert.deepEqual(publicQuote(null,2),{status:'quote_required',availability:'unverified'});
 const q=publicQuote({unit_minor:1234,currency:'TRY',wholesale:100,commission_bps:500},2);
 assert.equal(q.totalMinor,2468);assert.equal(q.reservationConfirmed,false);assert.equal(q.wholesale,undefined);assert.equal(q.commission_bps,undefined);
});
test('all booking transitions require operator authority and evidence',()=>{
 for(const [from,next] of Object.entries(transitions)) for(const to of Object.keys(transitions)) {
 if(next.includes(to)) assert.equal(transition(from,to,'operator','acceptance-ref'),to);
 else assert.throws(()=>transition(from,to,'operator','ref'));
 assert.throws(()=>transition(from,to,'traveler','ref'));
 assert.throws(()=>transition(from,to,'admin',''));
 }
});
const req=(path,body={},headers={})=>new Request('https://api.example'+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
const env={PUBLIC_ORIGIN:'https://example.com',RATE_LIMITER:{limit:async()=>({success:true})}};
test('API denies cross-origin requests, unauthenticated admin and missing limiter',async()=>{
 assert.equal((await worker.fetch(req('/v1/quotes',{}, {Origin:'https://evil.example'}),env)).status,403);
 assert.equal((await worker.fetch(req('/v1/admin/prices'),env)).status,401);
 assert.equal((await worker.fetch(req('/v1/quotes'),{})).status,429);
});
test('request collection is unconditionally disabled even if flags are supplied',async()=>{
 const response=await worker.fetch(req('/v1/requests',{email:'never-store'}),{...env,BOOKINGS_ENABLED:true,DB:{prepare(){throw Error('must not access DB');}}});
 assert.equal(response.status,503);
});
test('quote API binds validated plan and strips private fields',async()=>{
 let bindings;
 const db={prepare(sql){assert.match(sql,/pr.status='verified'/);assert.match(sql,/a.verified_until/);return {bind(...args){bindings=args;return {first:async()=>({unit_minor:100,currency:'EUR',commission_bps:1000})};}};}};
 const response=await worker.fetch(req('/v1/quotes',{experienceId:'bb-morning',date:future,guests:2},{Origin:env.PUBLIC_ORIGIN}),{...env,DB:db});
 assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),env.PUBLIC_ORIGIN);assert.equal((await response.json()).totalMinor,200);assert.equal(bindings[4],2);
});
test('admin mutation is authenticated, validated and batched with audit',async()=>{
 const statements=[];
 const DB={prepare(sql){return {bind(...values){const s={sql,values};statements.push(s);return s;}};},async batch(items){assert.equal(items.length,2);assert.match(items[1].sql,/booking_events/);return [{meta:{changes:1}}];}};
 const body={id:'rate',experienceId:'bb-morning',currency:'EUR',unitMinor:100,validFrom:'2099-01-01',validUntil:'2099-12-31',sourceReference:'contract-id'};
 const config={...env,ADMIN_TOKEN:'synthetic-test-only',DB};
 const headers={Authorization:'Bearer synthetic-test-only'};
 assert.equal((await worker.fetch(req('/v1/admin/prices',body,headers),config)).status,200);
 assert.match(statements[0].sql,/p.currency=\?/);
 assert.equal((await worker.fetch(req('/v1/admin/prices',{...body,unitMinor:-1},headers),config)).status,400);
 assert.equal((await worker.fetch(req('/v1/admin/providers/verify',{id:'p',licenseReference:'license-id',sourceReference:'review-id'},headers),config)).status,200);
});
