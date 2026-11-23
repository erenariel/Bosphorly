import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAndIncrementLimits } from '../backend/assistant.js';

test('verified owner tier bypasses application chat counters', async () => {
  const result = await checkAndIncrementLimits({
    env: { ASSISTANT_DAILY_LIMIT: '1' },
    actorKey: 'member:verified-owner',
    ipActorKey: 'ip:203.0.113.10',
    tier: 'owner',
  });
  assert.deepEqual(result, { allowed: true });
});

test('ordinary member tiers still use the application limits', async () => {
  const env = { ASSISTANT_DAILY_LIMIT: '1000' };
  const actorKey = 'member:regular-test-' + Date.now();
  const first = await checkAndIncrementLimits({ env, actorKey, tier: 'silver', dayLimit: 1 });
  const second = await checkAndIncrementLimits({ env, actorKey, tier: 'silver', dayLimit: 1 });
  assert.equal(first.allowed, true);
  assert.deepEqual(second, { allowed: false, reason: 'day_limit' });
});
