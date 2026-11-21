import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const langs = ['tr','en','ru','uk','de','fr','nl','ar','he','az','fa','es','it','pt','hr','hu','bs','zh','ja','ko','hi','bn','id'];
const retired = /WhatsApp|wa\.me|api\.whatsapp\.com|واتساب|וואטסאפ|ווטסאפ/i;

test('all public inquiry pages avoid retired WhatsApp links', () => {
  const pages = ['index.html','booking.html','tours.html','explore.html','route.html','faq.html','prices.html','account.html'];
  for (const page of pages) assert.doesNotMatch(read(page), retired, page);
});

test('all request scripts use the email channel, not a WhatsApp number', () => {
  for (const file of ['booking.js','tours.js','explore.js','route.js','account.js','account-member.js','discover-common.js'])
    assert.doesNotMatch(read(file), /https?:\/\/(?:wa\.me|api\.whatsapp\.com)/i, file);
  const contact = read('config/contact.js');
  assert.match(contact, /info@bosphorly\.com/);
  assert.doesNotMatch(contact, /whatsapp\s*:/i);
});

test('all 23 discover and membership locales offer email rather than WhatsApp', () => {
  for (const lang of langs) {
    const discover = JSON.parse(read('data/discover/' + lang + '.json'));
    const member = JSON.parse(read('data/members/' + lang + '.json'));
    assert.doesNotMatch(JSON.stringify(discover.ui), retired, lang + ' discover');
    assert.doesNotMatch(JSON.stringify(member), retired, lang + ' member');
    assert.ok(discover.ui.toFSend && discover.ui.toFDone && member.mShareWa, lang);
  }
  assert.doesNotMatch(read('data/faq.json'), retired);
});
