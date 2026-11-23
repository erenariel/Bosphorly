import { readFileSync, readdirSync } from 'node:fs';
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

test('no site file in any of the 23 languages tells guests to pay cash or at the hotel reception', () => {
  // Word-bounded so that e.g. Bosnian/Croatian "nakitom" (jewellery) or Italian "in barca" (by boat) do not match.
  const B = '(?<![\\p{L}\\p{N}_])', E = '(?![\\p{L}\\p{N}_])';
  const terms = ['cash','nakit','nakden','resepsiyonda','resepsiyonunda','Barzahlung','bar bezahlen','наличн\\p{L}*','готівк\\p{L}*',
    'efectivo','espèces','contanti','contant','em dinheiro','gotovin\\p{L}*','készpénz\\p{L}*','nağd\\p{L}*','نقد[اًا]?','نقدی','מזומן','במזומן',
    '现金','現金','현금','नकद','নগদ\\p{L}*','tunai'];
  const re = new RegExp(B + '(?:' + terms.join('|') + ')' + E, 'iu');
  const skip = new Set(['node_modules', '.git', 'tests', 'docs', 'test-results', 'playwright-report']);
  const files = [];
  const walk = dir => {
    for (const e of readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = (dir ? dir + '/' : '') + e.name;
      if (e.isDirectory()) walk(p);
      else if (/\.(html|js|json|webmanifest)$/.test(e.name)) files.push(p);
    }
  };
  walk('');
  assert.ok(files.includes('assets/print/bosphorly-qr-poster.html') && files.includes('data/discover/tr.json') && files.includes('tools/discover-src/master.json'));
  for (const file of files) {
    // backend/assistant.js only *detects* payment questions (incl. "cash"); that detector line is not guest-facing text.
    const src = file === 'backend/assistant.js' ? read(file).split('\n').filter(l => !l.includes('how to pay')).join('\n') : read(file);
    const m = src.match(re);
    assert.equal(m, null, file + ': ' + (m && m[0]));
  }
  // Every locale states that the payment method is shared when Bosphorly gets in touch.
  const booking = read('booking.js');
  assert.equal((booking.match(/r_payWhen\s*:/g) || []).length, langs.length);
});

test('phone fields are labelled as phone, not "phone / email"', () => {
  for (const file of ['index.html','booking.js','account.js'])
    assert.doesNotMatch(read(file), /[\p{L}\p{N}] ?\/ ?(email|e-mail)\b|telefon-\/email|phone\/email/iu, file);
});

test('social links publish only the corporate WhatsApp Business line and Instagram', () => {
  const social = read('social-links.js');
  const numbers = [...social.matchAll(/WHATSAPP_NUMBER\s*=\s*'(\d+)'/g)].map(m => m[1]);
  assert.deepEqual(numbers, ['16197386408']);
  assert.match(social, /'https:\/\/wa\.me\/' \+ WHATSAPP_NUMBER/);
  assert.doesNotMatch(social, /wa\.me\/\d/);
  assert.match(social, /INSTAGRAM_HANDLE\s*=\s*'bosphorly'/);
  assert.match(social, /rel = 'noopener'/);
  for (const page of ['index.html','booking.html','account.html','prices.html'])
    assert.match(read(page), /<script defer src="social-links\.js\?v=\w+"><\/script>/, page);
  // Requests still go by email: the social script never builds a prefilled request message.
  assert.doesNotMatch(social, /[?&]text=/);
});

test('Mimo panel links only the corporate WhatsApp Business line', () => {
  const chat = read('assistant-chat.js');
  assert.match(chat, /const WA_NUMBER = '16197386408';/);
  assert.deepEqual([...chat.matchAll(/WA_NUMBER = '(\d+)'/g)].map(m => m[1]), ['16197386408']);
  assert.doesNotMatch(chat, /wa\.me\/\d/);
  assert.doesNotMatch(chat, /wa\.me[^`'"]*[?&]text=/);
});
