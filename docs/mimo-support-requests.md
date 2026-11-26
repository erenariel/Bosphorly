# Mimo talep kaydı ve gerçek iletim

## Kök neden

Web ve Telegram'ın normal AI cevabı bir metindi: ortak bir talep oluşturma aracı yoktu. Web'deki e-posta aktarımı ancak ayrı `/v1/assistant/handoff` isteğinde çalışıyordu; modelin “ilettim” demesi bu isteği tetiklemiyordu. WhatsApp onaylı talepleri ayrı `whatsapp_requests` tablosuna yazıyordu; bu tablo Extranet mesaj kutusuna bağlı değildi. WhatsApp insana devir e-postası hataları bazı yollarda yakalanıp loglanmıyordu. Web/Telegram'ın eski aktarımında da e-posta başarıdan sonra mesaj kutusu kaydı oluşturuluyordu; bu nedenle e-posta hatası kalıcı talep bırakmıyordu.

## Yeni akış

Ortak `createSupportRequest` önce mevcut `extranet_messages` tablosuna kalıcı yeni kayıt ve audit olayı yazar. Kayıt başına benzersiz BOS referansı, kanal, dil, hash'lenmiş konuşma kimliği, Türkçe özet alanları ve son konuşma mesajları bulunur. Konuşma kimliği + normalize talep içeriğinin hash'i benzersizdir. SQL trigger aynı konuşmada kayan bir saat içinde en fazla üç yeni talep oluşturulmasını sağlar. Tekrarlanan aynı talep mevcut referansı döndürür ve kotayı tüketmez.

AI çıktısındaki `supportRequest` JSON nesnesi uygulama tarafından dispatch edilen araç çağrısıdır. Alanlar sunucuda doğrulanır; tur, isim, tarih, kişi sayısı ve misafirin verdiği iletişim bilgisi kullanıcı mesajlarına dayanmalıdır. WhatsApp/Telegram iletişim tercihi o kanalsa numara/konuşma adresi sunucudan gelir. Eski WhatsApp teklif/onay akışı ve web/Telegram'ın açık insana devir isteği de aynı fonksiyonu kullanır. Genel destek talepleri rezervasyon alanları uydurmaz.

Başarılı kayıt sonrasında sunucu 23 dilde sabit referanslı alındı cevabı üretir. E-postanın teslim edildiğini veya rezervasyonun onaylandığını iddia etmez. D1 başarısızsa dürüst hata ve destek e-posta adresi gösterilir. Araç çağırmadan üretilen iletim/kayıt iddiaları cevap korumasından geçer. SSE taslakları tamamlanmadan gösterilmez; doğrulanmış son cevap delta olaylarıyla iletilir. Bu, ilk kelimenin görünmesini model tamamlanana kadar geciktirir.

Birer birer toplanan bilgiler kaybolmasın diye geçmiş 24 mesajla sınırlıdır; web isteğinde geçmiş ayrıca 9 KB ile sınırlandırılır. Sadece son altı mesaj kalıcı talebe bağlanır. Kart/CVV kalıpları temizlenir; ham konuşma dökümleri ekip e-postasına eklenmez, yetkili Extranet kutusunda kalır.

## E-posta ve tekrar deneme

E-posta alıcıları yalnız `SUPPORT_EMAILS` Worker secret/env alanından okunur (virgülle ayrılmış); boşsa `info@bosphorly.com`. Konuşma içeriği alıcı/konu/URL veya gönderim sayısını belirleyemez. İstenen yayın yapılandırması: `info@bosphorly.com,cafer@bosphorly.com`.

Resend başarısız olsa bile talep ve referans korunur. Aynı satırda outbox durumu/deneme sayısı saklanır; Extranet “E-posta gönderilemedi” uyarısı gösterir. İlk gönderim ve saatlik mevcut Cron ile toplam en fazla beş deneme yapılır. Atomik 60 saniyelik lease ve sabit Resend Idempotency-Key yarışan gönderimleri sınırlar. Beş denemeden sonra hata kutuda görünür kalır; otomatik sonsuz tekrar yapılmaz. Gönderim hataları PII içermeyen olay kodu/referansla loglanır. E-postadaki bağlantı girişten sonra doğrudan ilgili mesajı açar.

## Yetki ve yayın hazırlığı

Cafer, yeni hesapta admin olarak tanınır. Migration mevcut aktif staff/partner hesabını audit kaydıyla admin'e yükseltir; owner veya devre dışı hesaplara dokunmaz. Owner denetimi önce gelir; OWNER_EMAILS ve owner'a özel ayar/kampanya onay yetkisi genişletilmez. Mesaj API'leri mevcut sunucu rol ve CSRF kontrollerini kullanır; ham support JSON'u istemciye verilmez, iletişim bilgileri maskelenir.

`0022_support_requests.sql` eklemelidir; eski mesajlar ve rezervasyonlar korunur. Yayın sırası: migration → Worker → frontend. Deployment workflow'u GitHub `SUPPORT_EMAILS` secret'ını Worker'a taşır. GitHub bağlantısı secrets/variables yazımını HTTP 403 ile reddettiği için bu değer bu çalışma sırasında ayarlanamadı. Yayın öncesi repo Settings → Secrets and variables → Actions altında `SUPPORT_EMAILS` secret'ına yukarıdaki liste eklenmelidir. Boş bırakılırsa yalnız varsayılan info adresi kullanılır.

Bu dalda canlı D1 migration, canlı Worker secret değişikliği, merge ve deploy yapılmadı. OWNER_EMAILS, ASSISTANT_DAILY_LIMIT ve TTS_MONTHLY_CHAR_CAP mantığı korunur.
