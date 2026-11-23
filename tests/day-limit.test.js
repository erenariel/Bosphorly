import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAndIncrementLimits, GUEST_DAILY_LIMIT } from '../backend/assistant.js';

const src = readFileSync(new URL('../backend/assistant.js', import.meta.url), 'utf8');
const langs = ['tr','en','ru','uk','de','fr','nl','ar','he','az','fa','es','it','pt','hr','hu','bs','zh','ja','ko','hi','bn','id'];

test('daily quota returns day_limit (not the per-minute reason) once the guest cap is passed', async () => {
  const env = { ASSISTANT_DAILY_LIMIT: '100000' };
  const actorKey = 'ip:203.0.113.77-day';
  // Spread the calls over minutes so the 6/min rule never triggers.
  let last;
  for (let i = 0; i <= GUEST_DAILY_LIMIT; i++) {
    last = await checkAndIncrementLimits({ env, actorKey, tier: 'guest', now: Date.UTC(2026, 10, 23, 8, i) });
  }
  assert.deepEqual(last, { allowed: false, reason: 'day_limit' });
});

test('day-limit messages exist in all 23 languages and never promise unlimited use', () => {
  for (const key of ['dayLimitGuest', 'dayLimitMember']) {
    const start = src.indexOf('  ' + key + ': {');
    assert.ok(start > 0, key);
    const block = src.slice(start, src.indexOf('\n  },', start));
    for (const lang of langs) assert.match(block, new RegExp('\\n    ' + lang + ': "'), key + ' ' + lang);
    assert.doesNotMatch(block, /sınırsız|unlimited|безлимит|unbegrenzt|illimit|ilimitad|無制限|无限|무제한/i, key);
  }
  assert.match(src, /reason === 'day_limit' \|\| limitRes\.reason === 'ip_limit'/);
});
