import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyTelnyx,parseWhatsApp,whatsAppSkip,handleWhatsApp,processWhatsApp,sendWhatsApp,adminWhatsApp,WHATSAPP_POLICY,WHATSAPP_FROM,TELNYX_MESSAGING_PROFILE_ID} from '../backend/whatsapp.js';
const business='+13125551234', customer='+18655550001';
function payload(text='Boğaz turu istiyorum',id='message-1') {return {data:{event_type:'message.received',payload:{id,type:'WHATSAPP',direction:'inbound',from:{phone_number:customer},to:business,body:{type:'text',timestamp:String(Math.floor(Date.now()/1000)),text:{body:text}}}}};}
function fixture() {
 const kv=new Map(), seen=new Set(), controls=new Map(); let calls=0; const outputs=[];
 const env={WHATSAPP_PHONE_NUMBER:business,WHATSAPP_KV:{async get(k){return kv.has(k)?JSON.parse(kv.get(k)):null},async put(k,v,opts){assert.ok(opts.expirationTtl<=2592000);kv.set(k,v)}},DB:{prepare(sql){let args;return {bind(...v){args=v;return this},async first(){if(sql.includes('SELECT until_ms'))return {until_ms:controls.get(args[0])||0};if(sql.includes('whatsapp_leases'))return {phone:args[0]};if(sql.includes('whatsapp_seen')) {if(seen.has(args[0]))return null;seen.add(args[0]);return {id:args[0]}}},async run(){if(sql.includes('INSERT INTO whatsapp_control'))controls.set(args[0],args[1]);return {success:true}}}}},AI:{async run(_model,options){calls++;outputs.push(options);return {response:JSON.stringify({reply:'Hangi tarih için düşünüyorsunuz?',handoff:false,abuse:false,proposal:null})}}},TELNYX_API_KEY:'test',TELEGRAM_BOT_TOKEN:'test',TELEGRAM_ADMIN_CHAT_ID:'123',RESEND_API_KEY:'test',REQUEST_FROM_EMAIL:'test@example.com'};
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
test('a hidden WhatsApp number is answered at its BSUID, and an array recipient still matches',()=>{
 const id='US.13491208655302741918';
 const hidden=payload('Merhaba','hidden-1');
 hidden.data.payload.from={phone_number:''};
 hidden.data.payload.body.from='';
 hidden.data.payload.body.from_user_id=id;
 assert.equal(parseWhatsApp(hidden,business).phone,id);
 assert.equal(parseWhatsApp(hidden,business).text,'Merhaba');
 const shortId='US.13491208';
 const short=payload('Merhaba','short-bsuid');
 short.data.payload.from={phone_number:shortId};
 short.data.payload.body.from='';
 short.data.payload.body.from_user_id=shortId;
 assert.equal(parseWhatsApp(short,business).phone,shortId);
 const echo=payload();
 Object.assign(echo.data,{event_type:'message.echo'});
 Object.assign(echo.data.payload,{origin:'whatsapp_business_app',direction:'outbound',from:{phone_number:business},to:id});
 assert.equal(parseWhatsApp(echo,business).phone,id);
 const listed=payload('Merhaba','listed-to');
 listed.data.payload.to=[{phone_number:business}];
 assert.equal(parseWhatsApp(listed,business).phone,customer);
 const other=payload();
 other.data.payload.to=[{phone_number:'+19998887777'}];
 assert.equal(parseWhatsApp(other,business),null);
 const skip=whatsAppSkip(other,business);
 assert.equal(skip.to_match,false);
 assert.equal(skip.from_kind,'e164');
 assert.equal(JSON.stringify(skip).includes('Boğaz'),false);
 assert.equal(JSON.stringify(skip).includes(customer),false);
 assert.equal(whatsAppSkip({data:{event_type:'message.sent',payload:{id:'s',type:'WHATSAPP'}}},business),null);
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
test('reply is posted to Telnyx with the business number, sender and messaging profile',async()=>{
 const f=fixture(); const old=globalThis.fetch; let captured;
 globalThis.fetch=async(url,opts)=>{captured={url,headers:opts.headers,body:JSON.parse(opts.body)};return Response.json({data:{id:'out-1'}});};
 try {
  assert.equal(await sendWhatsApp(f.env,customer,'Merhaba\n\nBoğaz turu için tarih bakar mısınız?',Date.now()),true);
  assert.equal(captured.url,'https://api.telnyx.com/v2/messages/whatsapp');
  assert.equal(captured.headers.Authorization,'Bearer test');
  assert.equal(captured.headers['Content-Type'],'application/json');
  assert.deepEqual(captured.body,{
   type:'WHATSAPP',
   from:WHATSAPP_FROM,
   to:customer,
   messaging_profile_id:TELNYX_MESSAGING_PROFILE_ID,
   whatsapp_message:{type:'text',text:{body:'Merhaba\n\nBoğaz turu için tarih bakar mısınız?',preview_url:false}},
  });
  assert.equal(captured.body.from,'+16197386408');
  assert.notEqual(captured.body.from,f.env.WHATSAPP_PHONE_NUMBER);
  assert.equal(TELNYX_MESSAGING_PROFILE_ID,'4001a210-1b06-40b0-be85-2cc64e97452d');
  const bsuid='US.ENT.13491208655302741918';
  assert.equal(await sendWhatsApp(f.env,bsuid,'Merhaba',Date.now()),true);
  assert.equal(captured.body.to,bsuid);
  assert.equal(captured.body.messaging_profile_id,TELNYX_MESSAGING_PROFILE_ID);
 } finally {globalThis.fetch=old}
});
test('a rejected Telnyx send does not mute the customer for 12 hours',async()=>{
 const f=fixture();
 const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 f.env.TELNYX_PUBLIC_KEY=Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey)).toString('base64');
 const raw=JSON.stringify(payload('Merhaba','retry-after-reject'));
 const ts=String(Math.floor(Date.now()/1000));
 const sig=Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(`${ts}|${raw}`))).toString('base64');
 const old=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({errors:[{code:'10004',title:'Missing required parameter',detail:'Invalid source number'}]},{status:400});
 const jobs=[];
 try {
  const res=await handleWhatsApp(new Request('https://example.com/webhooks/whatsapp/telnyx',{method:'POST',body:raw,headers:{'telnyx-timestamp':ts,'telnyx-signature-ed25519':sig}}),f.env,{waitUntil(p){jobs.push(p)}});
  assert.equal(res.status,200);
  await Promise.all(jobs);
  assert.equal(f.controls.size,0);
 } finally {globalThis.fetch=old}
});
test('Telnyx 40008 outside the 24-hour window is logged and does not throw',async()=>{
 const f=fixture(); const old=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({errors:[{code:'40008',title:'WhatsApp delivery failed',detail:'Outside the 24 hour window'}]},{status:400});
 try { assert.equal(await sendWhatsApp(f.env,customer,'Merhaba',Date.now()),false); }
 finally {globalThis.fetch=old}
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
  assert.equal(JSON.parse(mail.body.text).channel,'whatsapp');
  assert.equal(JSON.parse(mail.body.text).phone,customer);
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
