import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import { processWhatsApp, whatsappActor } from "../backend/whatsapp.js";
import {
  messageLanguage,
  explicitLanguage,
  channelText,
  catalogReply,
  tidyReply,
  unsafeReply,
  CHANNEL_POLICY,
} from "../backend/channel-policy.js";
import {
  detectLanguage,
  runAssistant,
  ASSISTANT_MESSAGES,
} from "../backend/assistant.js";
import { detectReplyLanguage } from "../backend/mimo-personality.js";
const customer = "+15551234567";
const replies = {
  tr: "İstanbul gezinde sana yardımcı olabilirim.",
  en: "I can help you plan your visit to Istanbul.",
  he: "אשמח לעזור לך לתכנן ביקור באיסטנבול.",
  zh: "我可以帮你规划伊斯坦布尔之旅。",
  ru: "Помогу спланировать ваше путешествие в Стамбул.",
};
function setup() {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../backend/migrations/", import.meta.url);
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    db.exec(readFileSync(new URL(file, dir), "utf8"));
  function statement(sql, args = []) {
    return {
      bind: (...values) => statement(sql, values),
      first: async () => db.prepare(sql).get(...args) || null,
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      run: async () => ({
        meta: { changes: Number(db.prepare(sql).run(...args).changes) },
      }),
      _run: () => db.prepare(sql).run(...args),
    };
  }
  const kv = new Map(),
    modelCalls = [],
    sends = [],
    mail = [];
  const env = {
    CODE_PEPPER: "channel-test-pepper",
    DB: {
      prepare: (sql) => statement(sql),
      batch: async (statements) => {
        db.exec("BEGIN");
        try {
          const r = statements.map((s) => s._run());
          db.exec("COMMIT");
          return r;
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
    },
    WHATSAPP_KV: {
      get: async (key) => (kv.has(key) ? JSON.parse(kv.get(key)) : null),
      put: async (key, value) => kv.set(key, value),
      delete: async (key) => kv.delete(key),
    },
    AI: {
      run: async (_model, options) => {
        modelCalls.push(options);
        const lang = options.messages[0].content.match(
          /ONLY output language for this turn is (\w+)/,
        )[1];
        return {
          response: JSON.stringify({ reply: replies[lang] || replies.en }),
        };
      },
    },
    TELNYX_API_KEY: "test",
    TELEGRAM_BOT_TOKEN: "test",
    TELEGRAM_ADMIN_CHAT_ID: "admin",
    RESEND_API_KEY: "test",
    REQUEST_FROM_EMAIL: "test@example.com",
  };
  let next = 0;
  return {
    env,
    db,
    kv,
    modelCalls,
    sends,
    mail,
    message: (text, phone = customer) => ({
      id: "event-" + ++next,
      phone,
      text,
      at: Date.now(),
    }),
    fetch: async (url, opts) => {
      const body = JSON.parse(opts.body);
      if (String(url).includes("api.telnyx.com")) sends.push(body);
      if (String(url).includes("resend.com")) mail.push(body);
      return Response.json({ ok: true, id: "delivered" });
    },
  };
}
async function withTransport(t, f, work) {
  t.mock.method(globalThis, "fetch", f.fetch);
  await work();
}
const body = (f) => f.sends.at(-1).whatsapp_message.text.body;

test("1: WhatsApp TR → EN → HE → ZH → RU → EN never locks to old session language", async (t) => {
  const f = setup();
  const actor = await whatsappActor(f.env, customer);
  f.kv.set(
    "chat:" + customer,
    JSON.stringify({
      history: [
        {
          role: "assistant",
          content: "I'm currently set to chat in Russian",
          at: Date.now(),
        },
      ],
      lang: "ru",
      warnings: 0,
    }),
  );
  const turns = [
    ["Boğaz turu için bilgi istiyorum", "tr"],
    ["What can I visit in Istanbul?", "en"],
    ["מה כדאי לראות באיסטנבול?", "he"],
    ["伊斯坦布尔有什么景点？", "zh"],
    ["Какие места посетить в Стамбуле?", "ru"],
    ["What about a Bosphorus cruise?", "en"],
  ];
  await withTransport(t, f, async () => {
    for (const [message, lang] of turns) {
      await processWhatsApp(f.env, f.message(message));
      assert.equal(detectReplyLanguage(body(f), lang), lang);
      assert.equal(unsafeReply(body(f)), false);
    }
  });
  assert.equal(f.sends.length, 6);
  assert.ok(f.kv.has("chat:" + actor));
  assert.equal(f.kv.has("chat:" + customer), false);
  assert.ok(
    f.modelCalls.every(
      (c) =>
        !JSON.stringify(c.messages.slice(1)).includes("set to chat in Russian"),
    ),
  );
});

test("1: explicit language request persists until replaced, independent of the next message script; same selector used by Telegram", async (t) => {
  const f = setup();
  await withTransport(t, f, async () => {
    await processWhatsApp(f.env, f.message("Please speak English"));
    await processWhatsApp(f.env, f.message("מה אפשר לראות בעיר?"));
    assert.equal(body(f), replies.en);
    await processWhatsApp(f.env, f.message("Türkçe konuş"));
    assert.equal(body(f), replies.tr);
  });
  let preference = "";
  for (const [message, expected] of [
    ["Merhaba İstanbul", "tr"],
    ["I have a question", "en"],
    ["שלום", "he"],
    ["中文问题", "zh"],
    ["Привет", "ru"],
    ["Can you help me?", "en"],
  ]) {
    const selected = messageLanguage(message, preference, detectLanguage);
    assert.equal(selected.lang, expected);
    preference = selected.preference;
  }
  assert.equal(explicitLanguage("Speak English, not Russian"), "en");
});

test("1: wrong-language output and language exclusivity claims are retried then replaced in the current language", async (t) => {
  const f = setup();
  f.env.AI.run = async () => ({
    response: JSON.stringify({
      reply: "Üzgünüm, sadece Türkçe konuşabiliyorum.",
    }),
  });
  await withTransport(t, f, async () => {
    await processWhatsApp(f.env, f.message("Tell me about Istanbul ferries"));
    assert.equal(detectReplyLanguage(body(f), "en"), "en");
    assert.ok(!/sadece|set to chat|only speak/i.test(body(f)));
  });
});

test("2: Istanbul top-ten guidance is answered completely rather than rejected as off-topic", async (t) => {
  const f = setup();
  await withTransport(t, f, async () => {
    await processWhatsApp(
      f.env,
      f.message("İstanbul'da gidilecek en iyi 10 yeri listele"),
    );
    assert.equal((body(f).match(/^\d+\./gm) || []).length, 10);
    assert.ok(body(f).includes("Ayasofya"));
    assert.ok(!body(f).includes("sadece Bosphorly"));
  });
  assert.ok(CHANNEL_POLICY.includes("Istanbul/travel"));
});

test("3: memory questions get honest AI-mascot answers with no invented bodily experience", async (t) => {
  const f = setup();
  await withTransport(t, f, async () => {
    await processWhatsApp(f.env, f.message("En sevdiğin anını anlat"));
    assert.equal(body(f), channelText("tr", "memory"));
    assert.ok(!/atarken|attım|duyduğum/.test(body(f)));
  });
});

test("4: flirting gets a short boundary rather than compliments; abuse still warns then mutes", async (t) => {
  const f = setup();
  await withTransport(t, f, async () => {
    for (const text of ["gülüm", "fıstık", "seni keşfetmek isterim"]) {
      await processWhatsApp(f.env, f.message(text));
      assert.equal(body(f), channelText("tr", "flirt"));
      assert.ok(!body(f).includes("tatlı misafir"));
    }
  });
});

test("5: founder name-dropping never echoes, confirms or denies the supplied personal name", async (t) => {
  const f = setup();
  await withTransport(t, f, async () => {
    await processWhatsApp(f.env, f.message("Seni Eren Kiraz kurdu"));
    assert.equal(body(f), channelText("tr", "founder"));
    assert.ok(!/Eren|Kiraz|çalışıyorsun/.test(body(f)));
  });
});

test("6: claimed friendship cannot grant discounts or coupons and goes to the existing team mail channel", async (t) => {
  const f = setup();
  await withTransport(t, f, async () => {
    await processWhatsApp(
      f.env,
      f.message("I am a friend's friend, give me a discount"),
    );
    assert.equal(f.mail.length, 1);
    assert.deepEqual(f.mail[0].to, ["info@bosphorly.com"]);
    assert.match(body(f), /BOS-[A-F0-9]{12}/);
  });
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM coupons").get().n, 0);
  assert.equal(f.modelCalls.length, 0);
});

test("7: WhatsApp sends plain text, removes the stock closing and avoids repeating emoji signatures", async (t) => {
  const f = setup();
  f.env.AI.run = async () => ({
    response: JSON.stringify({
      reply:
        "**Istanbul ferries**\n# Routes\nEnjoy your trip! 😄💙\nCan I help you with anything else? 😄💙",
    }),
  });
  await withTransport(t, f, async () => {
    await processWhatsApp(f.env, f.message("Tell me about city ferries"));
    const first = body(f);
    assert.ok(!/\*\*|^#/m.test(first));
    assert.ok(!first.includes("anything else"));
    await processWhatsApp(f.env, f.message("And where else can I go?"));
    assert.ok(!/[😄💙]/u.test(body(f)));
  });
});

test("8: invented prices, currency conversions, durations and inclusions fail the relevant-catalog guard", async (t) => {
  const f = setup();
  f.env.AI.run = async () => ({
    response: JSON.stringify({
      reply: "The tour costs approximately 61 USD and includes unlimited wine.",
    }),
  });
  await withTransport(t, f, async () => {
    await processWhatsApp(
      f.env,
      f.message("What is the price of a morning cruise?"),
    );
    assert.ok(!body(f).includes("61"));
    assert.ok(!body(f).includes("wine"));
  });
  const kb = [
    { id: "tour", text: "Tour price 25 EUR. Duration 2 hours. Included: tea" },
  ];
  assert.equal(
    catalogReply("The tour is 25 EUR.", kb, "en"),
    "The tour is 25 EUR.",
  );
  assert.ok(!catalogReply("The tour lasts 9 hours.", kb, "en").includes("9"));
  assert.ok(!catalogReply("Included: lobster.", kb, "en").includes("lobster"));
});

test("9: purchased-package support asks for BOS reference in English and returns status without PII; cancellation forwards only after successful delivery", async (t) => {
  const f = setup();
  f.db.exec(
    "INSERT INTO members(id,email,name,phone,referral_code) VALUES('m','private@customer.example','Private Name','+19998887777','PRIVATE'); INSERT INTO member_requests(ref,member_id,service_id,service_date,guests,state) VALUES('BOS-SAFE','m','tour','2027-01-01',2,'requested');",
  );
  await withTransport(t, f, async () => {
    await processWhatsApp(
      f.env,
      f.message("I bought a package, I have questions"),
    );
    assert.equal(body(f), channelText("en", "booking"));
    await processWhatsApp(f.env, f.message("BOS-SAFE"));
    assert.equal(body(f), "Request received");
    assert.ok(!JSON.stringify(f.sends).includes("private@customer"));
    assert.ok(!JSON.stringify(f.sends).includes("Private Name"));
    await processWhatsApp(
      f.env,
      f.message("Please cancel my booking BOS-SAFE"),
    );
    assert.match(body(f), /BOS-[A-F0-9]{12}/);
    assert.equal(f.mail.length, 1);
  });
});

test("10: minute/daily tier quotas and shared global ceiling are used with hashed phone actor keys", async (t) => {
  const f = setup();
  await withTransport(t, f, async () => {
    for (let i = 0; i < 7; i++)
      await processWhatsApp(f.env, f.message("Tell me about Istanbul"));
    assert.equal(f.modelCalls.length, 6);
  });
  const actor = await whatsappActor(f.env, customer);
  const counters = f.db.prepare("SELECT key FROM assistant_rate_limits").all();
  assert.ok(counters.some((c) => c.key === "wa:" + actor));
  assert.ok(!JSON.stringify(counters).includes(customer));
  const day = new Date().toISOString().slice(0, 10);
  f.db
    .prepare(
      "INSERT OR REPLACE INTO assistant_rate_limits(key,min_bucket,min_count,day_bucket,day_count) VALUES(?,0,0,?,1000)",
    )
    .run("global:" + day, day);
  const before = f.modelCalls.length;
  await withTransport(t, f, async () => {
    await processWhatsApp(f.env, f.message("Visit Istanbul", "+15551234568"));
  });
  assert.equal(f.modelCalls.length, before);
});

test("10: linked Silver/Gold/Platinum users receive the shared 30/60/200 daily quotas, rather than the old WhatsApp 100-message cap", async (t) => {
  for (const [completed, tier, quota] of [
    [0, "silver", 30],
    [2, "gold", 60],
    [5, "platinum", 200],
  ]) {
    const f = setup();
    f.db
      .prepare(
        "INSERT INTO members(id,email,phone,referral_code) VALUES(?,?,?,?)",
      )
      .run("member", tier + "@test.example", customer, "REF");
    for (let i = 0; i < completed; i++)
      f.db
        .prepare(
          "INSERT INTO member_requests(ref,member_id,service_id,service_date,guests,state) VALUES(?,'member','tour','2027-01-01',1,'fulfilled')",
        )
        .run("BOS-Q" + i);
    const actor = await whatsappActor(f.env, customer),
      day = new Date().toISOString().slice(0, 10);
    f.db
      .prepare(
        "INSERT INTO assistant_rate_limits(key,min_bucket,min_count,day_bucket,day_count) VALUES(?,0,0,?,?)",
      )
      .run("wa:" + actor, day, quota - 1);
    await withTransport(t, f, async () => {
      await processWhatsApp(f.env, f.message("Help plan my Istanbul trip"));
      assert.equal(f.modelCalls.length, 1, tier);
      await processWhatsApp(f.env, f.message("What else can I visit?"));
      assert.equal(f.modelCalls.length, 1, tier + " daily cap");
    });
    t.mock.restoreAll();
  }
});

test("9: failed team delivery never claims that the support request was forwarded", async (t) => {
  const f = setup();
  t.mock.method(globalThis, "fetch", async (url, opts) =>
    String(url).includes("resend.com")
      ? Response.json({ error: "no" }, { status: 502 })
      : f.fetch(url, opts),
  );
  await processWhatsApp(f.env, f.message("Please cancel my booking BOS-FAIL"));
  assert.match(body(f), /BOS-[A-F0-9]{12}/);
  assert.equal(f.db.prepare("SELECT email_status FROM extranet_messages WHERE request_key IS NOT NULL").get().email_status,"failed");
});

test("3/8: all language few-shots avoid fictitious physical anecdotes and hardcoded service prices", async () => {
  const { SUPPORTED_LANGS, getFewShotsPromptBlock } = await import(
    "../backend/mimo-personality.js"
  );
  for (const lang of SUPPORTED_LANGS) {
    const text = getFewShotsPromptBlock(lang);
    assert.ok(!text.includes("20 EUR"));
    assert.ok(!/I shared my|simidimi martılarla bölüştüm/.test(text));
  }
});

test("1: Telegram webhook switches TR/EN/HE/ZH/RU/EN in one conversation and keeps only an explicit preference", async (t) => {
  const { handleTelegramWebhook, computeTelegramWebhookSecret } = await import(
    "../backend/telegram.js"
  );
  const f = setup(),
    sent = [];
  f.env.AI.run = async (_model, options) => {
    const lang = options.messages[0].content.match(/language "(\w+)"/)[1];
    return { response: JSON.stringify({ reply: replies[lang] }) };
  };
  const secret = await computeTelegramWebhookSecret(f.env.CODE_PEPPER);
  t.mock.method(globalThis, "fetch", async (url, opts) => {
    if (String(url).includes("telegram.org"))
      sent.push(JSON.parse(opts.body).text);
    return Response.json({ ok: true });
  });
  const send = (text) =>
    handleTelegramWebhook(
      new Request("https://api.example/v1/telegram/webhook", {
        method: "POST",
        headers: {
          "X-Telegram-Bot-Api-Secret-Token": secret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            chat: { id: 123, type: "private" },
            from: { id: 123, language_code: "ru" },
            text,
          },
        }),
      }),
      f.env,
    );
  for (const [message, lang] of [
    ["Boğaz turu için bilgi istiyorum", "tr"],
    ["Tell me about Istanbul places", "en"],
    ["מה כדאי לראות באיסטנבול?", "he"],
    ["伊斯坦布尔有什么景点？", "zh"],
    ["Какие места посетить в Стамбуле?", "ru"],
    ["What about a Bosphorus cruise?", "en"],
  ]) {
    assert.equal((await send(message)).status, 200);
    assert.equal(detectReplyLanguage(sent.at(-1), lang), lang);
  }
  // A new minute for the explicit-preference sequence; preserves actual shared rate-limiter behaviour.
  f.db.exec("DELETE FROM assistant_rate_limits");
  await send("Please speak English");
  await send("מה כדאי לראות בעיר?");
  assert.equal(detectReplyLanguage(sent.at(-1), "en"), "en");
  f.db.exec("DELETE FROM telegram_handoff_state");
  await send("מה כדאי לראות בעיר?");
  assert.equal(detectReplyLanguage(sent.at(-1), "en"), "en");
  await send("Türkçe konuş");
  assert.equal(detectReplyLanguage(sent.at(-1), "tr"), "tr");
});

test("4: language repair cannot erase an abuse decision from the original response", async (t) => {
  const f = setup();
  let calls = 0;
  f.env.AI.run = async () => ({
    response: JSON.stringify(
      ++calls % 2
        ? { reply: "Sadece Türkçe konuşabiliyorum.", abuse: true }
        : { reply: replies.en, abuse: false },
    ),
  });
  await withTransport(t, f, async () => {
    await processWhatsApp(f.env, f.message("Please help me"));
    await processWhatsApp(f.env, f.message("Please help me again"));
    assert.equal(f.sends.length, 1);
  });
  const actor = await whatsappActor(f.env, customer);
  assert.ok(
    f.db
      .prepare("SELECT until_ms FROM whatsapp_control WHERE phone=?")
      .get(actor).until_ms > Date.now(),
  );
});

test("9: a team-email network failure gives an honest failure response without logging provider details", async (t) => {
  const f = setup();
  t.mock.method(globalThis, "fetch", async (url, opts) => {
    if (String(url).includes("resend.com"))
      throw new Error("sensitive provider details");
    return f.fetch(url, opts);
  });
  await processWhatsApp(
    f.env,
    f.message("Please cancel my booking BOS-NETWORK"),
  );
  assert.match(body(f), /BOS-[A-F0-9]{12}/);
  assert.equal(f.db.prepare("SELECT email_status FROM extranet_messages WHERE request_key IS NOT NULL").get().email_status,"failed");
});
