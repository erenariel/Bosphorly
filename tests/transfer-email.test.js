import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/mail/worker.js';

test('transfer notification goes to Bosphorly with the guest as Reply-To', async t => {
  const origin = 'https://bosphorly.com';
  const env = {PUBLIC_ORIGIN:origin, RATE_LIMITER:{limit:async()=>({success:true})},
    ENABLE_EMAIL_REQUESTS:'true', RESEND_API_KEY:'test', REQUEST_FROM_EMAIL:'requests@example.org', TURNSTILE_SECRET:'test'};
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.includes('siteverify')) return Response.json({success:true});
    assert.equal(url,'https://api.resend.com/emails');
    sent = JSON.parse(init.body);
    return Response.json({id:'example'});
  });
  const body = {reference:'BOS-TEST',kind:'transfer',name:'Test Guest',phone:'00123456789',
    email:'guest@example.org',service:'Airport transfer',date:'2027-01-01',guests:1,
    message:'Example itinerary',turnstileToken:'test',consent:true};
  const request = new Request(origin+'/v1/requests',{method:'POST',
    headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const response = await worker.fetch(request,env);
  assert.equal(response.status,202);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert.deepEqual(sent.to,['info@bosphorly.com']);
  assert.equal(sent.reply_to,body.email);
  assert.equal(sent.subject,'Bosphorly transfer inquiry · BOS-TEST');
  assert.ok(sent.text.includes('\nExample itinerary'));
});

test('mail deployment does not expose the booking or membership API', async () => {
  const response = await worker.fetch(new Request('https://example.org/v1/quotes', {method:'POST'}), {});
  assert.equal(response.status,404);
});

const origin = 'https://bosphorly.com';
const mailEnv = () => ({PUBLIC_ORIGIN:origin, RATE_LIMITER:{limit:async()=>({success:true})},
  ENABLE_EMAIL_REQUESTS:'true', RESEND_API_KEY:'test', REQUEST_FROM_EMAIL:'requests@example.org', TURNSTILE_SECRET:'test'});
const post = body => new Request(origin+'/v1/requests',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const tourBody = extra => ({reference:'BOS-TOUR1',kind:'tour',name:'Test Guest',phone:'+90 555 000 00 00',
  service:'Bosphorus Sunset Cruise',date:'2027-01-02',guests:2,message:'Tour request text',turnstileToken:'test',consent:true,...extra});

test('tour and hammam requests are delivered with the guest as Reply-To', async t => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.includes('siteverify')) return Response.json({success:true});
    sent.push(JSON.parse(init.body));
    return Response.json({id:'example'});
  });
  let r = await worker.fetch(post(tourBody({email:' guest@example.org '})), mailEnv());
  assert.equal(r.status,202);
  assert.equal(sent[0].reply_to,'guest@example.org');
  assert.equal(sent[0].subject,'Bosphorly tour inquiry · BOS-TOUR1');
  assert.ok(sent[0].text.includes('Email: guest@example.org'));
  r = await worker.fetch(post(tourBody({kind:'hammam',reference:'BOS-HAM1',email:'guest@example.org'})), mailEnv());
  assert.equal(r.status,202);
  assert.equal(sent[1].subject,'Bosphorly hammam inquiry · BOS-HAM1');
});

test('no request is sent without a valid guest email, for any kind', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => { calls.push(url); return Response.json({success:true,id:'x'}); });
  for (const kind of ['transfer','tour','hammam'])
    for (const email of [undefined, '', 'not-an-email', 'a@b'])
      assert.equal((await worker.fetch(post(tourBody({kind, email})), mailEnv())).status, 400, kind + ' ' + email);
  assert.equal((await worker.fetch(post(tourBody({kind:'other', email:'guest@example.org'})), mailEnv())).status, 400);
  assert.deepEqual(calls, [], 'neither Turnstile nor Resend is called for an invalid request');
});
