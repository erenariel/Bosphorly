import test from 'node:test';
import assert from 'node:assert/strict';
import { isOwnerEmail } from '../backend/mimo.js';
import { chatDailyLimitForTier, PLATINUM_DAILY_LIMIT, checkAndIncrementLimits } from '../backend/assistant.js';
import { ttsDailyLimitForTier } from '../backend/tts.js';

test('isOwnerEmail matches the OWNER_EMAILS secret case-insensitively', () => {
  const env = { OWNER_EMAILS: ' Owner@Example.com , second@example.com' };
  assert.equal(isOwnerEmail(env, 'owner@example.com'), true);
  assert.equal(isOwnerEmail(env, 'SECOND@example.com'), true);
  assert.equal(isOwnerEmail(env, 'someone@example.com'), false);
  assert.equal(isOwnerEmail({}, 'owner@example.com'), false);
  assert.equal(isOwnerEmail(env, ''), false);
});

test('owner tier gets far more than platinum for chat and TTS', () => {
  assert.ok(chatDailyLimitForTier('owner') > PLATINUM_DAILY_LIMIT);
  assert.ok(ttsDailyLimitForTier('owner') > ttsDailyLimitForTier('platinum'));
});

test('owner is not stopped by the daily or global limit', async () => {
  const env = { ASSISTANT_DAILY_LIMIT: '1' };
  let now = Date.UTC(2026, 10, 23, 0, 0, 0);
  for (let i = 0; i < 20; i++) {
    now += 61000; // stay under the per-minute brake
    const r = await checkAndIncrementLimits({ env, actorKey: 'member:owner-test', ipActorKey: 'ip:owner-test', tier: 'owner', now });
    assert.equal(r.allowed, true, `request ${i} should pass`);
  }
});

test('owner chat keeps the six-per-minute brake even with the daily exemption', async () => {
  const opts = { env: {}, actorKey: 'member:owner-minute', tier: 'owner', dayLimit: 1, now: Date.UTC(2026, 10, 23) };
  for (let i = 0; i < 6; i++) assert.equal((await checkAndIncrementLimits(opts)).allowed, true);
  assert.deepEqual(await checkAndIncrementLimits(opts), { allowed: false, reason: 'actor_limit' });
});
