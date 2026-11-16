import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import worker from '../backend/worker.js';
import {documents,validateMember,authenticateMember,encryptProfile,saveMember,withdrawMarketing} from '../backend/membership.js';
const identity={issuer:'https://identity.example.invalid',subject:'opaque-subject',email:'synthetic@example.invalid'};
const body={fullName:'Synthetic Guest',email:identity.email,country:'TR',termsVersion:documents.terms,privacyVersion:documents.privacy,marketingEmail:false};
test('required fields, verified email, valid countries and explicit versioned choices',()=>{
 assert.equal(validateMember(body,identity).country,'TR');
 for(const change of [{email:'attacker@example.invalid'},{fullName:''},{country:'ZZ'},{marketingEmail:'true'},{termsVersion:'old'},{privacyVersion:'old'},{passport:'not-allowed'}]) assert.throws(()=>validateMember({...body,...change},identity));
 const {marketingEmail,...missing}=body;assert.throws(()=>validateMember(missing,identity));
 assert.doesNotThrow(()=>validateMember({...body,fullName:'أحمد محمد',country:'PS'},identity));
});
test('profile encryption has unique nonces and no plaintext',async()=>{
 const key=btoa('x'.repeat(32));const a=await encryptProfile(body,key),b=await encryptProfile(body,key);
 assert.notEqual(a,b);assert.ok(!a.includes(identity.email));assert.match(a,/^v1\./);
 await assert.rejects(()=>encryptProfile(body,btoa('bad')));
});
test('signed identity enforces signature, issuer, audience, verified email and expiry',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');
 const env={MEMBER_JWK:JSON.stringify(await exportJWK(publicKey)),MEMBER_ISSUER:identity.issuer,MEMBER_AUDIENCE:'member-client'};
 const token=async changes=>new SignJWT({email:identity.email,email_verified:true,...changes}).setProtectedHeader({alg:'RS256'}).setSubject(identity.subject).setIssuer(identity.issuer).setAudience('member-client').setIssuedAt().setExpirationTime('10m').sign(privateKey);
 const req=t=>new Request('https://api.example',{headers:{Authorization:'Bearer '+t}});
 assert.equal((await authenticateMember(req(await token()),env)).email,identity.email);
 await assert.rejects(async()=>authenticateMember(req(await token({email_verified:false})),env));
 await assert.rejects(async()=>authenticateMember(req(await token()),{...env,MEMBER_AUDIENCE:'another-client'}));
 await assert.rejects(()=>authenticateMember(req('unsigned'),env));
 const expired=await new SignJWT({email:identity.email,email_verified:true}).setProtectedHeader({alg:'RS256'}).setSubject(identity.subject).setIssuer(identity.issuer).setAudience('member-client').setIssuedAt().setExpirationTime(1).sign(privateKey);
 await assert.rejects(()=>authenticateMember(req(expired),env));
 const DB=fakeDB();
 const request=new Request('https://api.example/v1/members/profile',{method:'POST',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json',Origin:'https://bosphorly.example'},body:JSON.stringify(body)});
 const response=await worker.fetch(request,{...env,DB,MEMBER_DATA_KEY:btoa('s'.repeat(32)),MEMBERSHIP_ENABLED:'approved',PUBLIC_ORIGIN:'https://bosphorly.example',RATE_LIMITER:{limit:async()=>({success:true})}});
 assert.equal(response.status,200);assert.equal((await response.json()).marketingEmail,false);
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://bosphorly.example');
});
function fakeDB(){const statements=[];return {statements,prepare(sql){return {bind(...values){const statement={sql,values,first:async()=>null};statements.push(statement);return statement;}};},batch:async items=>items.map(()=>({meta:{changes:1}}))};}
test('membership writes are atomic, encrypted and never require marketing opt-in',async()=>{
 const DB=fakeDB();const env={DB,MEMBER_DATA_KEY:btoa('s'.repeat(32))};
 const result=await saveMember(env,identity,body);assert.equal(result.marketingEmail,false);assert.equal(result.discountStatus,'draft_not_applied');
 assert.equal(DB.statements.filter(s=>s.sql.includes('member_consents')).length,3);
 assert.ok(!JSON.stringify(DB.statements).includes(identity.email));
 assert.ok(!JSON.stringify(DB.statements).includes(body.fullName));
 const opt=DB.statements.find(s=>s.values.includes('marketing_email'));assert.ok(opt.values.includes(0));
 await withdrawMarketing(env,identity);assert.ok(DB.statements.some(s=>s.sql.includes('marketing_email=0')));
});
test('public membership API cannot collect data without configured launch gates',async()=>{
 let touched=false;const env={RATE_LIMITER:{limit:async()=>({success:true})},DB:{prepare(){touched=true;}}};
 const response=await worker.fetch(new Request('https://api.example/v1/members/profile',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}),env);
 assert.equal(response.status,503);assert.equal(touched,false);
});
