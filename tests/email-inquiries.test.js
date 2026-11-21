import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const langs = ['tr','en','ru','uk','de','fr','nl','ar','he','az','fa','es','it','pt','hr','hu','bs','zh','ja','ko','hi','bn','id'];
const retired = /WhatsApp|wa\.me|api\.whatsapp\.com|واتساب|واتساپ|واتس‌اپ|וואטסאפ|ווטסאפ/i;

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

test('no page or request text names a payment method (cash at reception)', () => {
  const cash = /pay in cash|cash only|cash at (the )?hotel|nakit|resepsiyonda|Barzahlung|bar an der|наличными|готівкою|en efectivo|en espèces|in contanti|contant bij|em dinheiro|gotovinom|készpénzben|nağd|نقدًا|במזומן|现金|現金|현금|नकद|নগদে|tunai/i;
  for (const file of ['index.html','booking.html','booking.js','tours.js','prices.html','prices.js','currency.js','faq.html','data/faq.json'])
    assert.doesNotMatch(read(file), cash, file);
});

test('phone fields are labelled as phone, not "phone / email"', () => {
  for (const file of ['index.html','booking.js','account.js'])
    assert.doesNotMatch(read(file), /[\p{L}\p{N}] ?\/ ?(email|e-mail)\b|telefon-\/email|phone\/email/iu, file);
});
