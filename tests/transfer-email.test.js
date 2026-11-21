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
