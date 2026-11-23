import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { SPEECH_LOCALES, SUPPORTED_LANGS } from '../backend/assistant.js';

const ALL_23 = [...SUPPORTED_LANGS];
const chatJs = readFileSync(new URL('../assistant-chat.js', import.meta.url), 'utf8');
const chatCss = readFileSync(new URL('../assistant-chat.css', import.meta.url), 'utf8');
const privacyHtml = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');

function loadClientHelpers() {
  const fnChoose = chatJs.match(/function chooseTtsVoice\(voices, langCode, localesMap\) \{[\s\S]*?\n  \}/)[0];
  const fnSanitize = chatJs.match(/function sanitizeSpeechText\(raw\) \{[\s\S]*?\n  \}/)[0];
  return new Function(
    'SPEECH_LOCALES',
    `${fnChoose}\n${fnSanitize}\nreturn { chooseTtsVoice, sanitizeSpeechText };`
  )(SPEECH_LOCALES);
}

test('mimo-speaking.svg exists under assets/brand/mimo/, uses #0a1753, and is < 4 KB', () => {
  const url = new URL('../assets/brand/mimo/mimo-speaking.svg', import.meta.url);
  const st = statSync(url);
  assert.ok(st.size > 200 && st.size < 4096, `Expected < 4 KB SVG, got ${st.size}`);
  const svg = readFileSync(url, 'utf8');
  assert.match(svg, /<svg/);
  assert.match(svg, /#0a1753/);
});

test('voice reply UI labels exist for all 23 languages and default state is OFF with try/catch localStorage', () => {
  const ui = new Function(`return ${chatJs.match(/const UI = (\{[\s\S]*?\n  \});/)[1]}`)();
  for (const key of ['voiceToggle', 'speakMsg', 'stopSpeak', 'noVoiceDevice']) {
    for (const lang of ALL_23) {
      assert.ok(ui[key][lang] && ui[key][lang].trim(), `${key}.${lang}`);
    }
  }
  assert.equal(ui.voiceToggle.tr, 'Sesli cevap');
  assert.equal(ui.speakMsg.tr, 'Mesajı sesli oku');
  assert.equal(ui.stopSpeak.tr, 'Okumayı durdur');
  assert.equal(ui.noVoiceDevice.tr, 'Bu dilde cihazında ses yok');

  assert.match(chatJs, /role="switch" aria-checked="false"/);
  assert.match(chatJs, /try \{ return localStorage\.getItem\(TTS_STORE_KEY\) === '1'; \} catch \{ return false; \}/);
  assert.match(chatJs, /try \{ localStorage\.setItem\(TTS_STORE_KEY, on \? '1' : '0'\); \} catch \{\}/);
});

test('voice selection uses SPEECH_LOCALES BCP-47 tags for all 23 langs and returns null if no voice matches language', () => {
  const { chooseTtsVoice } = loadClientHelpers();
  assert.equal(chooseTtsVoice([], 'tr'), null);
  assert.equal(chooseTtsVoice([{ lang: 'en-US', name: 'Sam' }, { lang: 'de-DE', name: 'Anna' }], 'tr'), null);
  assert.equal(chooseTtsVoice([{ lang: 'en-US', name: 'Sam' }], 'he'), null);
  assert.equal(chooseTtsVoice([{ lang: 'en-US', name: 'Sam' }], 'xx'), null);

  for (const lang of ALL_23) {
    const locale = SPEECH_LOCALES[lang];
    const picked = chooseTtsVoice(
      [
        { lang: 'en-US', name: 'WrongFallback', localService: true },
        { lang: locale, name: `Voice-${lang}`, localService: false },
      ],
      lang
    );
    if (lang === 'en') {
      assert.equal(picked.lang, 'en-US');
    } else {
      assert.equal(picked.lang, locale, `${lang} must select ${locale}`);
    }
  }

  // Legacy Chromium Hebrew/Indonesian tags ('iw-IL' / 'in-ID') are recognized as same-language aliases
  assert.equal(chooseTtsVoice([{ lang: 'iw-IL', name: 'HeLegacy' }], 'he').name, 'HeLegacy');
  assert.equal(chooseTtsVoice([{ lang: 'in-ID', name: 'IdLegacy' }], 'id').name, 'IdLegacy');
});

test('sanitizeSpeechText removes emojis, markdown syntax, and URLs without saying "bağlantı" or "link", separates emojis with ". ", and caps at 600 chars', () => {
  const { sanitizeSpeechText } = loadClientHelpers();
  const sample =
    '**Sabah Boğaz Turu** kişi başı yaklaşık *25 EUR* 🌊⛵💙🇹🇷\n' +
    'Detaylar: https://bosphorly.com/booking.html?service=bb-morning&lang=tr\n' +
    'Bize [Telegram üzerinden](https://t.me/BosphorlyBot?start=tr) veya www.bosphorly.com yazabilirsin.\n' +
    '- `BOS-123` referansı ile bilgi al.';
  const clean = sanitizeSpeechText(sample);
  assert.doesNotMatch(clean, /https?:\/\/|bosphorly\.com|t\.me|www\./i);
  assert.doesNotMatch(clean, /\*\*|\*|_|`|#/);
  assert.doesNotMatch(clean, /\p{Extended_Pictographic}/u);
  assert.doesNotMatch(clean.toLowerCase(), /\bbağlantı\b|\blink\b/);
  assert.ok(clean.includes('Sabah Boğaz Turu kişi başı yaklaşık 25 EUR'));
  assert.ok(clean.includes('Telegram üzerinden'));
  assert.ok(clean.includes('BOS-123 referansı ile bilgi al.'));

  assert.equal(sanitizeSpeechText('Merhaba 👋 Boğaz harika 😊✨ Tekne hazır'), 'Merhaba. Boğaz harika. Tekne hazır');
  const cappedWords = sanitizeSpeechText('Tur '.repeat(250));
  assert.ok(cappedWords.length > 500 && cappedWords.length <= 600);
  assert.equal(sanitizeSpeechText('a'.repeat(700)).length, 600);
});

test('TTS sends Bearer chatSession to POST /v1/tts with 4s timeout, falls back silently without session or on error to speechSynthesis (pitch=1.2, rate=1.05), avoids innerHTML on notes, and stops on mic/send/close/pagehide', () => {
  assert.match(chatJs, /fetch\(`\$\{apiBase\}\/v1\/tts`/);
  assert.match(chatJs, /Authorization:\s*`Bearer \$\{chatSession\}`/);
  assert.match(chatJs, /if \(!hasServerTtsForLang\(msgLang\) \|\| !chatSession\) return null;/);
  assert.match(chatJs, /TTS_FETCH_TIMEOUT_MS\s*=\s*4000/);
  assert.match(chatJs, /window\.Audio/);
  assert.match(chatJs, /utter\.pitch\s*=\s*1\.2/);
  assert.match(chatJs, /utter\.rate\s*=\s*1\.05/);
  assert.match(chatJs, /window\.speechSynthesis/);
  assert.match(chatJs, /window\.SpeechSynthesisUtterance/);

  const showTtsNoteFn = chatJs.slice(chatJs.indexOf('function showTtsNote'), chatJs.indexOf('function loadTtsPref'));
  assert.doesNotMatch(showTtsNoteFn, /innerHTML/);
  assert.match(showTtsNoteFn, /ttsNoteEl\.textContent/);

  assert.match(chatCss, /\.bc-speak-btn\{[^}]*min-width:44px;min-height:44px/);
  assert.match(chatCss, /\.bc-tts-toggle\{[^}]*min-height:44px/);
  assert.match(chatCss, /@media \(prefers-reduced-motion:reduce\)\{[^}]*\.bc-speaking[^}]*animation:none/);

  // Stop triggers verified in code paths
  const submitFn = chatJs.slice(chatJs.indexOf('async function submitMessage'), chatJs.indexOf('const toggle ='));
  assert.match(submitFn, /stopSpeaking\(\)/);
  const toggleFn = chatJs.slice(chatJs.indexOf('const toggle ='), chatJs.indexOf('window.__bosphorlyChatToggle'));
  assert.match(toggleFn, /if \(!open\) \{\s*stopSpeaking\(\);/);
  const micHandler = chatJs.slice(chatJs.indexOf("micBtn.addEventListener('click'"), chatJs.indexOf('const TTS_STORE_KEY'));
  assert.match(micHandler, /stopSpeaking\(\)/);
  assert.match(chatJs, /window\.addEventListener\('pagehide', stopSpeaking\)/);
  assert.match(chatJs, /window\.addEventListener\('beforeunload', stopSpeaking\)/);
});

test('privacy.html TR and EN disclose Google Cloud Text-to-Speech, reply-text-only transmission, 30d caching, and browser speechSynthesis fallback', () => {
  assert.match(privacyHtml, /Sesli cevap okuma \(Google Cloud Text-to-Speech ve Tarayıcı SpeechSynthesis\)/);
  assert.match(privacyHtml, /yalnızca asistanın kendi yanıt metni \(kullanıcı mesajları asla gönderilmez\)/);
  assert.match(privacyHtml, /<b>Google Cloud Text-to-Speech<\/b>/);
  assert.match(privacyHtml, /Cloudflare önbelleğinde en fazla 30 gün/);
  assert.match(privacyHtml, /tarayıcının yerleşik konuşma sentezi \(<code>speechSynthesis<\/code>\) ile yerel olarak/);

  assert.match(privacyHtml, /Voice replies \(Google Cloud Text-to-Speech &amp; Browser SpeechSynthesis\)/);
  assert.match(privacyHtml, /only Mimo’s own reply text \(never your guest messages\)/);
  assert.match(privacyHtml, /cached on Cloudflare for up to 30 days/);
  assert.match(privacyHtml, /falls back locally to your browser’s built-in speech synthesis \(<code>speechSynthesis<\/code>\)/);
});

test('sanitizeSpeechText strips [[flags:...]] & thought blocks, chat avoids innerHTML on AI/user text, and config/api.js loads ?v=20261123e/f', () => {
  const { sanitizeSpeechText } = loadClientHelpers();
  const dirty = '<|channel>thought\nplan<channel|><think>secret</think>Akşam turu yaklaşık 20 EUR 💙 https://bosphorly.com/booking.html\n[[flags:abuse=0;handoff=0]]';
  const spoken = sanitizeSpeechText(dirty);
  assert.doesNotMatch(spoken, /\[\[flags|channel>|think>|secret|plan|https?:|bosphorly\.com|\p{Extended_Pictographic}/iu);
  assert.ok(spoken.includes('Akşam turu yaklaşık 20 EUR'));

  const setBodyFn = chatJs.slice(chatJs.indexOf('function setBotMessageBody'), chatJs.indexOf('function appendFeedbackBar'));
  assert.doesNotMatch(setBodyFn, /innerHTML/);
  assert.match(setBodyFn, /textContent/);

  const apiJs = readFileSync(new URL('../config/api.js', import.meta.url), 'utf8');
  assert.match(apiJs, /assistant-chat\.css\?v=20261123f/);
  assert.match(apiJs, /assistant-chat\.js\?v=20261123f/);
});
