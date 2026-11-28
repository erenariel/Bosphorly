import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGemini, usesGemini } from '../backend/mimo-gemini.js';
import { runAssistant } from '../backend/assistant.js';

const env = { MIMO_MODEL_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-placeholder' };
test('provider selection requires secret and enabled channel', () => {
  assert.equal(usesGemini(env, 'web'), true);
  assert.equal(usesGemini(env, 'telegram'), false);
  assert.equal(usesGemini({ ...env, MIMO_GEMINI_CHANNELS: 'web, telegram' }, 'telegram'), true);
  assert.equal(usesGemini({ ...env, GEMINI_API_KEY: '' }, 'web'), false);
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
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => Response.json(payload('invalid')));
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
    const request = t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.match(url, /google-ai-studio\/v1beta\/models\/gemini-3\.6-flash:generateContent$/);
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
  t.mock.method(globalThis, 'fetch', (_, init) => {
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
