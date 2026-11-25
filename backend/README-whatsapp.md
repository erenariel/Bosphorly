# Mimo WhatsApp / Telnyx kurulumu

Bu değişiklik otomatik deploy yapmaz. Önce test ortamında gerçek imzalı Telnyx teslimatını doğrulayın. Worker adresi mevcut Mimo Worker adresidir; site GitHub Pages adresi değildir.

## Cloudflare

1. `backend/migrations/0013_whatsapp.sql` dahil bekleyen D1 migration'larını mevcut `bosphorly-booking` veritabanına uygulayın.
2. Workers KV namespace oluşturun; `backend/wrangler.jsonc` içine gerçek namespace ID ile `kv_namespaces: [{binding: "WHATSAPP_KV", id: "oluşturulan namespace ID"}]` ekleyin. Yer tutucu ID deploy etmeyin. Mevcut Worker'ın dashboard binding'i varsa aynı namespace'i kullanın. Binding olmadan endpoint 503 döner.
3. Worker secrets: `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY` (Telnyx Developer Center → Public Key, base64 Ed25519), `TELEGRAM_ADMIN_CHAT_ID` (Eren'in özel Telegram user/chat ID'si), `WHATSAPP_PHONE_NUMBER` (gerçek coexistence numarası, E.164). Mevcut `TELEGRAM_BOT_TOKEN`, `RESEND_API_KEY`, `REQUEST_FROM_EMAIL`, Telegram webhook için `CODE_PEPPER` korunmalı. Anahtarları Git'e veya sohbetlere yazmayın.
4. AI binding, mevcut model ve bilgi tabanı kullanılır. Resend üzerinden mevcut form teslim fonksiyonu paylaşılır; yeni e-posta servisi kurulmaz. E-posta opsiyoneldir; verilmediyse Reply-To eklenmez. Rezervasyon talebi D1 `whatsapp_requests` tablosunda `channel: whatsapp` ve tam WhatsApp numarası ile saklanır.
5. Saatlik cron süre dolmuş D1 kayıtlarını temizler. KV son 10 mesaj ve sayaçları 30 günlük TTL, mesaj ID'lerini 24 saat TTL ile tutar. D1 talep kayıtları 30 gün sonra saatlik temizlikte silinir. E-posta/Telegram'a teslim edilen kopyaların saklama politikası ayrıca mevcut sistemlerce yönetilir.

## Eren'in Telnyx panelinde yapacakları

1. Messaging → WhatsApp → Embedded Signup üzerinden **Business App coexistence** seçin. Mevcut uygulama kaydını silmeyin. Telefonda Meta bağlantısını onaylayın. `coexistence_state: active` ve `status: CONNECTED` olmasını bekleyin.
2. Numarayı bir **messaging profile**'a bağlayın. Bu profilin HTTPS webhook URL'si: `https://<mevcut-worker-host>/webhooks/whatsapp/telnyx`. `message.received` ve `message.echo` teslimatlarını etkinleştirin. Echo'lar WABA webhook'una gelmez.
3. WABA `webhook_events` listesinden `messages` aboneliğini kaldırın: aynı inbound'un ayrıca `whatsapp.messages` olarak gelmesini önler. Kod messaging-profile `message.received` şemasını kabul eder.
4. Müşteri numarasından test mesajı gönderin, yanıtı doğrulayın. Telefonda Business App'ten cevap yazınca 12 saat bot susmalıdır. Telegram'da `/mimo_off +ülkekodunumara` süresiz durdurur, `/mimo_on +ülkekodunumara` açar. Yalnızca secret'taki özel Telegram kullanıcısı yetkilidir. `/mimo_on` zorbalık engelini de manuel olarak kaldırabilir.
5. Aynı webhook'u tekrar göndererek çift mesaj olmadığını kontrol edin. Telnyx Ed25519 imzasız istek 401, eski timestamp 401 olmalıdır. Serbest metin sadece müşteri mesajının zamanından itibaren 24 saatte gönderilir; echo bu pencereyi uzatmaz.

## İşleyiş ve sınırlar

- WhatsApp'a özel sistem talimatı Mimo'yu Bosphorly hizmetleriyle sınırlar; 23 dilde mevcut kişilik ve katalog kullanılır. Model cevabı yapılandırılmış JSON olarak alınır. Tek tek bilgi toplar, özet ve onay ister; yalnızca geçerli bekleyen özetin ardından olumlu müşteri mesajı gelince kayıt yapılır. Kesin rezervasyon onayı verilmez.
- Kart benzeri sayılar modele, KV'ye, D1'e ve bildirimlere geçmeden maskelenir. Ham webhook/payload veya istisna içeriği loglanmaz. Telefon loglarda maskelenir. Hassas veri uyarısı mevcut 23 dil metinleriyle eklenir.
- Numara başına dakika 10 / gün 100 AI turu. D1 atomik mesaj claim'i KV'nin eventual consistency kaynaklı duplicate yarışını engeller. D1 konuşma lease'i eşzamanlı inbound'ları engeller. Echo, gönderim öncesi D1 kontrolünde yeniden okunur.
- İşlem veya eşzamanlı konuşma hatasında bot 12 saat susar, Telegram'a manuel kontrol bildirimi gider; onaylanmış talep D1'de kalır. Arka plan işlerinde otomatik yeniden deneme kuyruğu yoktur. Bu bilinçli at-most-once davranış aynı müşteriye ikinci satış/yanıt riskini önler, fakat hata alan mesaj için ekip müdahalesi gerekir.
- Telnyx echo best-effort'tür: desteklenmeyen companion cihaz mesajı echo üretmeyebilir. İnsan devralmadan önce `/mimo_off` kullanmak en güvenilir yoldur. API gönderimi başladıktan sonra gelen echo, başlamış HTTP isteğini geri alamaz.
- Cevap metni üretildikten sonra gönderim `POST https://api.telnyx.com/v2/messages/whatsapp` ile yapılır. Gövde `type: WHATSAPP`, `from: +16197386408`, `to` (gelen mesajın `from.phone_number` değeri), `messaging_profile_id: 4001a210-1b06-40b0-be85-2cc64e97452d` ve `whatsapp_message.text` (`preview_url: false`) içerir. `TELNYX_API_KEY` yalnızca Worker secret'ıdır. Webhook 200 döner; gönderim `waitUntil` içindedir. Durum kodu ve maskelenmiş gövde loglanır. 24 saatlik pencere dışında Telnyx `40008` döner; bu durumda bot 12 saat susmaz.
- Dil algılama, konu sınırlama, alan çıkarımı, pazarlık/özel istek tespiti model ve mevcut Mimo yardımcılarına dayanır. Çok dilli gerçek hesap testleri canlıya alma kontrolüdür; mock testler modelin gerçek yanıt kalitesini doğrulamaz.

## Belgeler (24 Kasım 2026)

- https://developers.telnyx.com/docs/messaging/whatsapp/coexistence
- https://developers.telnyx.com/docs/messaging/whatsapp/coexistence/webhooks
- https://developers.telnyx.com/docs/messaging/whatsapp/quickstart (inbound `payload.body.text.body`)
- https://developers.telnyx.com/docs/messaging/whatsapp/sending-messages (`POST /v2/messages/whatsapp`, `whatsapp_message.text.body`)
- https://developers.telnyx.com/docs/development/api-fundamentals/webhooks/receiving-webhooks (ham gövde, Ed25519)
- https://developers.cloudflare.com/kv/api/write-key-value-pairs/ (expirationTtl)
- https://developers.cloudflare.com/workers/runtime-apis/context/ (waitUntil)

Test: `node --test tests/whatsapp.test.js`; tüm depo: `npm test`.
