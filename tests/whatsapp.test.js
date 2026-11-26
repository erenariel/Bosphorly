import {supportDb} from './support-db.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyTelnyx,parseWhatsApp,handleWhatsApp,processWhatsApp,sendWhatsApp,adminWhatsApp,WHATSAPP_POLICY,DEFAULT_TELNYX_MESSAGING_PROFILE_ID} from '../backend/whatsapp.js';
const business='+13125551234', customer='+18655550001';
function payload(text='Boğaz turu istiyorum',id='message-1') {return {data:{event_type:'message.received',payload:{id,type:'WHATSAPP',direction:'inbound',from:{phone_number:customer},to:business,body:{type:'text',timestamp:String(Math.floor(Date.now()/1000)),text:{body:text}}}}};}
function fixture() {
 const kv=new Map(), seen=new Set(), controls=new Map(); let calls=0; const outputs=[];
 const env={WHATSAPP_PHONE_NUMBER:business,WHATSAPP_KV:{async get(k){return kv.has(k)?JSON.parse(kv.get(k)):null},async put(k,v,opts){assert.ok(opts.expirationTtl<=2592000);kv.set(k,v)}},DB:{prepare(sql){let args;return {bind(...v){args=v;return this},async first(){if(sql.includes('SELECT until_ms'))return {until_ms:controls.get(args[0])||0};if(sql.includes('whatsapp_leases'))return {phone:args[0]};if(sql.includes('whatsapp_seen')) {if(seen.has(args[0]))return null;seen.add(args[0]);return {id:args[0]}}},async run(){if(sql.includes('INSERT INTO whatsapp_control'))controls.set(args[0],args[1]);return {success:true}}}}},AI:{async run(_model,options){calls++;outputs.push(options);return {response:JSON.stringify({reply:'Hangi tarih için düşünüyorsunuz?',handoff:false,abuse:false,proposal:null})}}},TELNYX_API_KEY:'test',TELEGRAM_BOT_TOKEN:'test',TELEGRAM_ADMIN_CHAT_ID:'123',RESEND_API_KEY:'test',REQUEST_FROM_EMAIL:'test@example.com'};
 env.DB=supportDb(env.DB);
 return {env,kv,controls,outputs,get calls(){return calls}};
}
test('signed raw payload, tampering, stale/future timestamps and invalid key',async()=>{
 const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 const pub=Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey)).toString('base64');
 const raw=JSON.stringify(payload()),ts=String(Math.floor(Date.now()/1000));
 const sig=Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(`${ts}|${raw}`))).toString('base64');
 const h=new Headers({'telnyx-timestamp':ts,'telnyx-signature-ed25519':sig});
 assert.equal(await verifyTelnyx(raw,h,pub),true);
 assert.equal(await verifyTelnyx(raw+' ',h,pub),false);
 assert.equal(await verifyTelnyx(raw,h,pub,Number(ts)*1000+301000),false);
 assert.equal(await verifyTelnyx(raw,h,pub,Number(ts)*1000-301000),false);
 assert.equal(await verifyTelnyx(raw,h,'invalid'),false);
 assert.equal((await handleWhatsApp(new Request('https://example.com',{method:'POST',body:raw}),{},{})).status,401);
});
test('documented inbound and echo shapes; ignore edits, SMS and other business numbers',()=>{
 assert.equal(parseWhatsApp(payload(),business).text,'Boğaz turu istiyorum');
 const e=payload();Object.assign(e.data,{event_type:'message.echo'});Object.assign(e.data.payload,{origin:'whatsapp_business_app',direction:'outbound',from:{phone_number:business},to:customer});
 assert.equal(parseWhatsApp(e,business).echo,true);
 const p=payload();p.data.payload.body.type='edit';assert.equal(parseWhatsApp(p,business),null);
 assert.equal(parseWhatsApp(payload(),'+19999999999'),null);
});
test('normal tour, repeated message ID, card redaction, off-topic policy and echo suppression',async()=>{
 const f=fixture(); const old=globalThis.fetch;let sends=0;
 globalThis.fetch=async()=>{sends++;return Response.json({ok:true})};
 try {
  const m=parseWhatsApp(payload(),business);await processWhatsApp(f.env,m);await processWhatsApp(f.env,m);
  assert.equal(f.calls,1);assert.equal(sends,1);
  await processWhatsApp(f.env,parseWhatsApp(payload('4111 1111 1111 1111','card'),business));
  assert.ok(!JSON.stringify([...f.kv]).includes('4111'));assert.ok(!JSON.stringify(f.outputs).includes('4111'));
  await processWhatsApp(f.env,parseWhatsApp(payload('Write my coding homework','offtopic'),business));
  assert.ok(f.outputs.at(-1).messages[0].content.includes(WHATSAPP_POLICY));
  await processWhatsApp(f.env,{echo:true,phone:customer,id:'echo'});
  await processWhatsApp(f.env,parseWhatsApp(payload('hello','after-echo'),business));
  assert.equal(f.calls,3);assert.ok(f.controls.get(customer)>Date.now()+11*3600000);
 } finally {globalThis.fetch=old}
});
test('expired service window never sends, unauthorized Telegram cannot change controls',async()=>{
 const f=fixture();assert.equal(await sendWhatsApp(f.env,customer,'hello',Date.now()-86400001),false);
 assert.equal(await adminWhatsApp(f.env,'999','999',`/mimo_off ${customer}`),true);assert.equal(f.controls.size,0);
});
test('confirmation persists WhatsApp source and reuses form delivery without requiring email',async()=>{
 const f=fixture(); const old=globalThis.fetch;const requests=[];
 const proposal={service:'Boğaz turu',date:'2026-12-01',guests:2,pickup:'Hotel Test',name:'Test Guest'};
 f.kv.set(`chat:${customer}`,JSON.stringify({history:[],pending:proposal,warnings:0}));
 globalThis.fetch=async(url,opts)=>{requests.push({url,body:JSON.parse(opts.body)});return Response.json({ok:true,id:'test'})};
 try {
  await processWhatsApp(f.env,parseWhatsApp(payload('evet','confirmed'),business));
  const mail=requests.find(r=>r.url.includes('resend.com'));
  assert.equal(mail.body.reply_to,undefined);
  assert.match(mail.body.text,/Kanal: whatsapp/);
  assert.ok(mail.body.text.includes(customer));
  assert.equal(JSON.parse(f.kv.get(`chat:${customer}`)).pending,null);
  await processWhatsApp(f.env,parseWhatsApp(payload('evet','confirmed'),business));
  assert.equal(requests.filter(r=>r.url.includes('resend.com')).length,1);
 } finally {globalThis.fetch=old}
});
test('abuse warning then 24-hour suppression and per-number rate limit',async()=>{
 const f=fixture(); const old=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({ok:true});
 f.env.AI.run=async()=>({response:JSON.stringify({reply:'Lütfen nazik olun.',abuse:true})});
 try {
  await processWhatsApp(f.env,parseWhatsApp(payload('rude','abuse1'),business));
  assert.equal(f.controls.size,0);
  await processWhatsApp(f.env,parseWhatsApp(payload('rude','abuse2'),business));
  assert.ok(f.controls.get(customer)>Date.now()+23*3600000);
  const g=fixture();g.kv.set(`chat:${customer}`,JSON.stringify({history:[],minute:Math.floor(Date.now()/60000),minuteCount:10,day:0}));
  await processWhatsApp(g.env,parseWhatsApp(payload('tour','rate'),business));assert.equal(g.calls,0);
 } finally {globalThis.fetch=old}
});
test('Telnyx send keeps the WhatsApp type and messaging profile',async()=>{
 const f=fixture(); const old=globalThis.fetch; let sent;
 globalThis.fetch=async(url,opts)=>{sent={url,headers:opts.headers,body:JSON.parse(opts.body)};return Response.json({data:{id:'out'}});};
 try {
  assert.equal(await sendWhatsApp(f.env,customer,'Merhaba',Date.now()),true);
  assert.equal(sent.url,'https://api.telnyx.com/v2/messages/whatsapp');
  assert.equal(sent.body.type,'WHATSAPP');
  assert.equal(sent.body.from,business);
  assert.equal(sent.body.to,customer);
  assert.equal(sent.body.messaging_profile_id,DEFAULT_TELNYX_MESSAGING_PROFILE_ID);
  assert.equal(sent.body.whatsapp_message.text.preview_url,false);
  assert.equal(sent.body.whatsapp_message.text.body,'Merhaba');
  f.env.TELNYX_MESSAGING_PROFILE_ID='profile-override';
  await sendWhatsApp(f.env,customer,'Merhaba',Date.now());
  assert.equal(sent.body.messaging_profile_id,'profile-override');
 } finally {globalThis.fetch=old}
});
test('a model that answers after 12 seconds still sends',async()=>{
 const f=fixture(); const old=globalThis.fetch; let sent=0;
 globalThis.fetch=async()=>{sent++;return Response.json({ok:true});};
 f.env.AI.run=()=>new Promise(resolve=>setTimeout(()=>resolve({response:JSON.stringify({reply:'Hangi tarih için düşünüyorsunuz?',handoff:false,abuse:false,proposal:null})}),12000));
 try {
  assert.equal(await processWhatsApp(f.env,parseWhatsApp(payload('Boğaz turu','slow-12'),business)),true);
  assert.equal(sent,1);
 } finally {globalThis.fetch=old}
});
test('a model failure still replies and does not mute the guest',async()=>{
 const f=fixture();
 const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 f.env.TELNYX_PUBLIC_KEY=Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey)).toString('base64');
 f.env.AI.run=async()=>{throw new Error('ai_timeout');};
 const raw=JSON.stringify(payload('Merhaba','fallback'));
 const ts=String(Math.floor(Date.now()/1000));
 const sig=Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(`${ts}|${raw}`))).toString('base64');
 const old=globalThis.fetch; const sent=[];
 globalThis.fetch=async(url,opts)=>{sent.push(JSON.parse(opts.body));return Response.json({ok:true});};
 const jobs=[];
 try {
  const res=await handleWhatsApp(new Request('https://example.com/webhooks/whatsapp/telnyx',{method:'POST',body:raw,headers:{'telnyx-timestamp':ts,'telnyx-signature-ed25519':sig}}),f.env,{waitUntil(p){jobs.push(p)}});
  assert.equal(res.status,200);
  await Promise.all(jobs);
  assert.equal(sent.length,1);
  assert.match(sent[0].whatsapp_message.text.body,/info@bosphorly.com/);
  assert.equal(sent[0].type,'WHATSAPP');
  assert.equal(f.controls.size,0);
 } finally {globalThis.fetch=old}
});
