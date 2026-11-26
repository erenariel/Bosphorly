import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyTelnyx,parseWhatsApp,handleWhatsApp,processWhatsApp,sendWhatsApp,adminWhatsApp,WHATSAPP_POLICY,whatsappActor} from '../backend/whatsapp.js';
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
  assert.equal(f.calls,3);assert.ok(f.controls.get(await whatsappActor(f.env,customer))>Date.now()+11*3600000);
 } finally {globalThis.fetch=old}
});
test('expired service window never sends, unauthorized Telegram cannot change controls',async()=>{
 const f=fixture();assert.equal(await sendWhatsApp(f.env,customer,'hello',Date.now()-86400001),false);
 assert.equal(await adminWhatsApp(f.env,'999','999',`/mimo_off ${customer}`),true);assert.equal(f.controls.size,0);
});
test('confirmation persists WhatsApp source and reuses form delivery without requiring email',async()=>{
 const f=fixture(); const old=globalThis.fetch;const requests=[];
 const proposal={service:'Boğaz turu',date:'2026-12-01',guests:2,pickup:'Hotel Test',name:'Test Guest'};
 f.kv.set(`chat:${await whatsappActor(f.env,customer)}`,JSON.stringify({history:[],pending:proposal,warnings:0}));
 globalThis.fetch=async(url,opts)=>{requests.push({url,body:JSON.parse(opts.body)});return Response.json({ok:true,id:'test'})};
 try {
  await processWhatsApp(f.env,parseWhatsApp(payload('evet','confirmed'),business));
  const mail=requests.find(r=>r.url.includes('resend.com'));
  assert.equal(mail.body.reply_to,undefined);
  assert.equal(JSON.parse(mail.body.text).channel,'whatsapp');
  assert.equal(JSON.parse(mail.body.text).phone,customer);
  assert.equal(JSON.parse(f.kv.get(`chat:${await whatsappActor(f.env,customer)}`)).pending,null);
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
  assert.ok(f.controls.get(await whatsappActor(f.env,customer))>Date.now()+23*3600000);
  const g=fixture();g.kv.set(`chat:${await whatsappActor(g.env,customer)}`,JSON.stringify({history:[],minute:Math.floor(Date.now()/60000),minuteCount:10,day:0}));
  await processWhatsApp(g.env,parseWhatsApp(payload('tour','rate'),business));assert.equal(g.calls,0);
 } finally {globalThis.fetch=old}
});

test('slow model still answers after 8 seconds and does not mute the guest',async t=>{
 const f=fixture(),sent=[];
 t.mock.method(globalThis,'fetch',async(url,opts)=>{if(String(url).includes('telnyx.com'))sent.push(JSON.parse(opts.body));return Response.json({ok:true});});
 f.env.AI.run=async()=>{await new Promise(resolve=>setTimeout(resolve,8200));return{response:JSON.stringify({reply:'I can help you plan your visit to Istanbul.'})};};
 await processWhatsApp(f.env,parseWhatsApp(payload('Can you help me plan an Istanbul visit?','slow-model'),business));
 assert.equal(sent.length,1);assert.match(sent[0].whatsapp_message.text.body,/plan your visit/);assert.equal(f.controls.size,0);
});

test('model rejection sends a localized guest fallback before owner notice, preserves explicit language preference, and permits the next message',async t=>{
 const f=fixture(),requests=[];
 t.mock.method(globalThis,'fetch',async(url,opts)=>{requests.push({url:String(url),body:JSON.parse(opts.body)});return Response.json({ok:true});});
 f.env.AI.run=async()=>{throw Error('private provider message '+customer)};
 f.kv.set('chat:'+await whatsappActor(f.env,customer),JSON.stringify({history:[],languagePreference:'en'}));
 assert.equal(await processWhatsApp(f.env,parseWhatsApp(payload('Nereleri gezebilirim?','model-error'),business)),true);
 const response=requests[0];assert.match(response.url,/telnyx/);assert.match(response.body.whatsapp_message.text.body,/try again shortly/);assert.match(response.body.whatsapp_message.text.body,/info@bosphorly.com/);assert.equal(f.controls.size,0);
 f.env.AI.run=async()=>({response:JSON.stringify({reply:'I can help you plan your visit to Istanbul.'})});
 await processWhatsApp(f.env,parseWhatsApp(payload('Can you help me?','next-message'),business));assert.equal(requests.filter(x=>x.url.includes('telnyx')).length,2);
});

test('retry is skipped when the overall model budget is exhausted, without another model call',async t=>{
 const f=fixture(),sends=[];const realNow=Date.now;let clock=realNow();let calls=0;
 t.mock.method(Date,'now',()=>clock);
 t.mock.method(globalThis,'fetch',async(url,opts)=>{if(String(url).includes('telnyx'))sends.push(JSON.parse(opts.body));return Response.json({ok:true});});
 f.env.AI.run=async()=>{calls++;clock+=24000;return{response:JSON.stringify({reply:'Üzgünüm, sadece Türkçe konuşabiliyorum.'})};};
 await processWhatsApp(f.env,parseWhatsApp(payload('Can you help me plan my Istanbul visit?','skip-retry'),business));assert.equal(calls,1);assert.equal(sends.length,1);assert.ok(!sends[0].whatsapp_message.text.body.includes('sadece'));
});

test('Telnyx diagnostics contain only HTTP status and provider numeric code, never title, detail, phone or message',async t=>{
 const f=fixture(),logs=[];t.mock.method(console,'error',line=>logs.push(line));
 t.mock.method(globalThis,'fetch',async()=>Response.json({errors:[{code:'40001',title:'Private '+customer,detail:'private message content'},{code:customer}]},{status:422}));
 await assert.rejects(sendWhatsApp(f.env,customer,'private outgoing content',Date.now()),/send_failed_422/);
 const event=JSON.parse(logs[0]);assert.equal(event.status,422);assert.deepEqual(event.providerCodes,['40001']);assert.ok(!/Private|private|18655550001/.test(logs.join(' ')));
});

test('a fallback delivery failure is logged, does not reject the background task, and never creates a mute',async t=>{
 const f=fixture(),logs=[];t.mock.method(console,'error',line=>logs.push(line));
 f.env.AI.run=async()=>{throw Error('ai_timeout')};
 t.mock.method(globalThis,'fetch',async url=>String(url).includes('telnyx')?Response.json({errors:[{code:'40001'}]},{status:503}):Response.json({ok:true}));
 assert.equal(await processWhatsApp(f.env,parseWhatsApp(payload('Can you help me?','fallback-send-error'),business)),false);assert.equal(f.controls.size,0);
 assert.ok(logs.some(x=>JSON.parse(x).event==='fallback_failed'));assert.ok(!logs.join(' ').includes(customer));
});

test('a database failure can still send a safe fallback, while a known admin mute remains respected',async t=>{
 const f=fixture();let sends=0;t.mock.method(globalThis,'fetch',async url=>{if(String(url).includes('telnyx'))sends++;return Response.json({ok:true});});
 f.env.DB={prepare(){throw Error('D1_ERROR no such table private-content')}};
 assert.equal(await processWhatsApp(f.env,parseWhatsApp(payload('Can you help me?','sql-error'),business)),true);assert.equal(sends,1);
 const g=fixture();g.controls.set(await whatsappActor(g.env,customer),Number.MAX_SAFE_INTEGER);g.env.AI.run=async()=>{throw Error('must not run')};
 await processWhatsApp(g.env,parseWhatsApp(payload('Can you help me?','intentional-mute'),business));assert.equal(sends,1);
});

test('actual 20-second model timeout delivers a guest fallback rather than a silent 12-hour mute',async t=>{
 const f=fixture(),sent=[];let ready;const started=new Promise(resolve=>{ready=resolve});
 t.mock.timers.enable({apis:['setTimeout']});
 t.mock.method(globalThis,'fetch',async(url,opts)=>{if(String(url).includes('telnyx'))sent.push(JSON.parse(opts.body));return Response.json({ok:true});});
 f.env.AI.run=()=>{ready();return new Promise(()=>{});};
 const task=processWhatsApp(f.env,parseWhatsApp(payload('Can you help me?','actual-timeout'),business));await started;t.mock.timers.tick(20001);assert.equal(await task,true);assert.equal(sent.length,1);assert.match(sent[0].whatsapp_message.text.body,/try again shortly/);assert.equal(f.controls.size,0);
});

test('signed webhook acknowledges immediately and its waitUntil task recovers from model failure',async t=>{
 const f=fixture(),waits=[],sent=[];const pair=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']);f.env.TELNYX_PUBLIC_KEY=Buffer.from(await crypto.subtle.exportKey('raw',pair.publicKey)).toString('base64');
 f.env.AI.run=async()=>{throw Error('ai_timeout')};t.mock.method(globalThis,'fetch',async(url,opts)=>{if(String(url).includes('telnyx'))sent.push(JSON.parse(opts.body));return Response.json({ok:true});});
 const raw=JSON.stringify(payload('Can you help me?','webhook-failure')),ts=String(Math.floor(Date.now()/1000)),signature=Buffer.from(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(ts+'|'+raw))).toString('base64');
 const ack=await handleWhatsApp(new Request('https://api.example/webhooks/whatsapp/telnyx',{method:'POST',headers:{'telnyx-timestamp':ts,'telnyx-signature-ed25519':signature},body:raw}),f.env,{waitUntil:p=>waits.push(p)});
 assert.equal(ack.status,200);await Promise.all(waits);assert.equal(sent.length,1);assert.match(sent[0].whatsapp_message.text.body,/info@bosphorly.com/);assert.equal(f.controls.size,0);
});

test('WhatsApp send includes the Telnyx channel type and the verified messaging profile required by the non-SMS sender',async t=>{
 const {DEFAULT_TELNYX_MESSAGING_PROFILE_ID}=await import('../backend/whatsapp.js');const f=fixture();let sent;
 t.mock.method(globalThis,'fetch',async(_url,options)=>{sent={headers:options.headers,body:JSON.parse(options.body)};return Response.json({data:{id:'accepted'}});});
 assert.equal(await sendWhatsApp(f.env,customer,'Hello',Date.now()),true);
 assert.equal(sent.body.type,'WHATSAPP');assert.equal(sent.body.from,f.env.WHATSAPP_PHONE_NUMBER);assert.equal(sent.body.to,customer);
 assert.equal(sent.body.messaging_profile_id,DEFAULT_TELNYX_MESSAGING_PROFILE_ID);assert.equal(DEFAULT_TELNYX_MESSAGING_PROFILE_ID,'4001a210-1b06-40b0-be85-2cc64e97452d');
 assert.equal(sent.body.whatsapp_message.text.preview_url,false);assert.equal(sent.headers.Authorization,'Bearer test');
 f.env.TELNYX_MESSAGING_PROFILE_ID='profile-for-a-different-environment';await sendWhatsApp(f.env,customer,'Hello',Date.now());assert.equal(sent.body.messaging_profile_id,f.env.TELNYX_MESSAGING_PROFILE_ID);
});

test('both normal and recovery sends use the same WhatsApp messaging profile',async t=>{
 const f=fixture(),attempts=[];f.env.TELNYX_MESSAGING_PROFILE_ID='profile-test';f.env.AI.run=async()=>{throw Error('ai_timeout')};
 t.mock.method(globalThis,'fetch',async(url,options)=>{if(String(url).includes('telnyx')){const body=JSON.parse(options.body);attempts.push(body);return body.type==='WHATSAPP'&&body.messaging_profile_id==='profile-test'?Response.json({data:{id:'accepted'}}):Response.json({errors:[{code:'10004'}]},{status:400});}return Response.json({ok:true});});
 assert.equal(await processWhatsApp(f.env,parseWhatsApp(payload('Can you help me?','recovery-profile'),business)),true);assert.equal(attempts.length,1);assert.equal(attempts[0].messaging_profile_id,'profile-test');
});
