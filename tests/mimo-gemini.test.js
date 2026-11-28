import test from 'node:test';
import { generateKeyPairSync, verify } from 'node:crypto';
import { vertexAccessToken } from '../backend/vertex-auth.js';
import assert from 'node:assert/strict';
import { parseGemini, usesGemini } from '../backend/mimo-gemini.js';
import { runAssistant } from '../backend/assistant.js';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const account = { type: 'service_account', client_email: 'mock@example.invalid',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
const env = { MIMO_MODEL_PROVIDER: 'gemini', GOOGLE_VERTEX_SA_JSON: JSON.stringify(account) };
function mockVertex(t, handler) {
  const model = t.mock.fn(handler);
  t.mock.method(globalThis, 'fetch', (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'mock-token', expires_in: 3600 });
    return model(url, init);
  });
  return model;
}
test('provider selection requires secret and enabled channel', () => {
  assert.equal(usesGemini(env, 'web'), true);
  assert.equal(usesGemini(env, 'telegram'), false);
  assert.equal(usesGemini({ ...env, MIMO_GEMINI_CHANNELS: 'web, telegram' }, 'telegram'), true);
  assert.equal(usesGemini({ ...env, GOOGLE_VERTEX_SA_JSON: '', GEMINI_API_KEY: 'ignored' }, 'web'), false);
  assert.equal(usesGemini({ ...env, MIMO_MODEL_PROVIDER: undefined }, 'web'), false);
});
const payload = text => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] });
test('Gemini accepts only complete structured replies', () => {
  const valid = { reply: 'Merhaba', handoff: false, abuse: false, proposal: null };
  assert.deepEqual(parseGemini(payload(JSON.stringify(valid))), valid);
  for (const invalid of ['text', '{}', JSON.stringify({ ...valid, proposal: {} }), JSON.stringify({ ...valid, reply: ' ' })]) {
    assert.throws(() => parseGemini(payload(invalid)));
  }
});
test('invalid Gemini response falls back to Gemma with original question', async t => {
  const message = 'Tell me about the history of Galata Tower.';
  let calls = 0;
  const fetchMock = mockVertex(t, async () => Response.json(payload('invalid')));
  const AI = { gateway: () => ({ getUrl: () => 'https://gateway.example' }), run: async (_, { messages }) => {
    assert.equal(messages.at(-1).content, message);
    calls++;
    return { response: 'Galata Tower is a historic landmark in Istanbul.' };
  } };
  const result = await runAssistant({ env: { ...env, AI }, message, pageLang: 'en' });
  assert.equal(fetchMock.mock.callCount(), 1);
  assert.equal(calls, 1);
  assert.match(result.reply, /Galata Tower/);
});

for (const channel of ['web', 'telegram']) {
  test('valid Gemini reply and grounding policy for ' + channel, async t => {
    const reply = 'Galata Tower is a historic landmark in Istanbul.';
    const gemma = t.mock.fn();
    const AI = { gateway: id => {
      assert.equal(id, 'mimo');
      return { getUrl: provider => 'https://gateway.example/' + provider };
    }, run: gemma };
    const request = mockVertex(t, async (url, init) => {
      assert.match(url, /google-vertex-ai\/v1\/projects\/bosphorly\/locations\/global\/publishers\/google\/models\/gemini-3\.6-flash:generateContent$/);
      assert.equal(init.headers.Authorization, 'Bearer mock-token');
      const body = JSON.parse(init.body);
      assert.deepEqual(body.tools, channel === 'web' ? [{ googleSearch: {} }, { googleMaps: {} }] : undefined);
      return Response.json(payload(JSON.stringify({ reply, handoff: false, abuse: false, proposal: null })));
    });
    const result = await runAssistant({ env: { ...env, AI, MIMO_GEMINI_CHANNELS: channel }, channel,
      actorKey: 'gemini-' + channel, message: 'Tell me about the history of Galata Tower.', pageLang: 'en' });
    assert.equal(request.mock.callCount(), 1);
    assert.equal(gemma.mock.callCount(), 0);
    assert.match(result.reply, /Galata Tower/);
  });
}

test('Gemini timeout aborts the request and still returns a guest reply', async t => {
  let signal;
  mockVertex(t, (_, init) => {
    signal = init.signal;
    return new Promise(() => {});
  });
  const AI = { gateway: () => ({ getUrl: () => 'https://gateway.example' }),
    run: async () => ({ response: 'Galata Tower overlooks Istanbul.' }) };
  const result = await runAssistant({ env: { ...env, AI }, actorKey: 'gemini-timeout',
    aiTimeoutMs: 40, message: 'Tell me about the history of Galata Tower.', pageLang: 'en' });
  assert.equal(signal.aborted, true);
  assert.match(result.reply, /Galata Tower/);
});

test('Vertex signs the OAuth assertion, reuses the token and refreshes before expiry', async t => {
  const secret = JSON.stringify({ ...account, private_key_id: 'cache-test' });
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const exchange = t.mock.method(globalThis, 'fetch', (url, init) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    const [header, claims, sig] = init.body.get('assertion').split('.');
    assert.ok(verify('RSA-SHA256', Buffer.from(header + '.' + claims), publicKey, Buffer.from(sig, 'base64url')));
    const parsed = JSON.parse(Buffer.from(claims, 'base64url'));
    assert.equal(parsed.iss, account.client_email);
    assert.equal(parsed.aud, url);
    assert.equal(parsed.exp - parsed.iat, 3600);
    return Response.json({ access_token: 'temporary', expires_in: 3600 });
  });
  await vertexAccessToken(secret);
  await vertexAccessToken(secret);
  assert.equal(exchange.mock.callCount(), 1);
  now += 3550 * 1000;
  await vertexAccessToken(secret);
  assert.equal(exchange.mock.callCount(), 2);
});

test('failed OAuth exchange falls straight back to Gemma', async t => {
  const exchange = t.mock.method(globalThis, 'fetch', url => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    return new Response(null, { status: 403 });
  });
  const AI = { gateway: () => ({ getUrl: () => 'https://gateway.example' }),
    run: t.mock.fn(async () => ({ response: 'Galata Tower overlooks Istanbul.' })) };
  const result = await runAssistant({ env: { ...env, AI, GOOGLE_VERTEX_SA_JSON: JSON.stringify({ ...account, private_key_id: 'denied' }) },
    actorKey: 'vertex-denied', message: 'Tell me about the history of Galata Tower.', pageLang: 'en' });
  assert.equal(exchange.mock.callCount(), 1);
  assert.equal(AI.run.mock.callCount(), 1);
  assert.match(result.reply, /Galata Tower/);
});
