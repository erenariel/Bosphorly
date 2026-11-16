import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {knownReferenceSubtotal} from '../research-model.js';
const catalog=JSON.parse(readFileSync(new URL('../data/anatolia-research.json',import.meta.url))),rows=catalog.routes.flatMap(x=>x.suppliers);
test('retail reference arithmetic respects basis, currency and from status',()=>{
 assert.deepEqual(knownReferenceSubtotal(rows.find(x=>x.id==='about-red'),2),{minor:14000,currency:'EUR',from:false});
 assert.deepEqual(knownReferenceSubtotal(rows.find(x=>x.id==='adventures-green'),2),{minor:9000,currency:'EUR',from:true});
 assert.deepEqual(knownReferenceSubtotal(rows.find(x=>x.id==='gobekli-private'),2),{minor:49000,currency:'USD',from:false});
 for(const id of ['kaliru-urfa','turkiye-pamukkale','kommagene-nemrut','efesotours-future'])assert.equal(knownReferenceSubtotal(rows.find(x=>x.id===id),2),null);
 assert.equal(knownReferenceSubtotal(rows.find(x=>x.id==='gobekli-private'),3),null);for(const n of [0,1.5,17,NaN])assert.throws(()=>knownReferenceSubtotal(rows[0],n));
});
test('researched operators remain separate from supplier approval, net cost and sales tariffs',()=>{
 assert.equal(catalog.routes.length,6);assert.equal(rows.length,13);for(const row of rows){assert.equal(row.net_cost,null);assert.equal(row.commission,null);assert.equal(row.verification_status,'not_verified_by_bosphorly');assert.equal(row.contract_status,'not_contracted');assert.ok(row.source_url.startsWith('https://'));assert.ok(row.checked_at);}
 const photos=JSON.parse(readFileSync(new URL('../data/anatolia-photos.json',import.meta.url)));assert.equal(Object.keys(photos).length,6);for(const photo of Object.values(photos)){assert.ok(photo.author&&photo.license&&photo.license_url&&photo.source_url&&photo.modifications);assert.ok(readFileSync(new URL('../'+photo.path,import.meta.url)).length>1000);}
});
