# Extranet aşamaları ve yayın kontrolü

Bu seri yalnız PR'lar hazırlar; canlı ortamı değiştirmez. PR'lar bağımlı olarak 0 → 1 → 2 → 3 → 4 sırasıyla incelenmelidir. Önceki PR squash merge edildiğinde sonraki PR'ın base'i main'e alınmalı ve tekrar test edilmelidir. Ayrı Mimo PR #124 bu seriye dahil değildir; ortak assistant/WhatsApp dosyaları birlikte yayınlanacaksa ayrıca birleştirme testi gerekir.

| Aşama | İçerik | Migration |
|---|---|---|
| 0 | OWNER_EMAILS erişimi, partner rolü, taze OTP ile ilk passkey, atomik rate limit, append-only audit | 0016_extranet_security.sql |
| 1 | Dashboard dönüşüm/dağılımlar, tekil tamamlama, önizlemeli ve ikinci onaylı rezervasyon e-postası | 0017_extranet_booking_emails.sql |
| 2 | Owner onaylı kampanyalar, sabit verilmiş kupon oranı, KVKK export ve detay PII açma | 0018_extranet_campaign_approval.sql |
| 3 | Kanal/atama ve öncelikli handoff, kişisel partner hesapları ve komisyon takibi | 0019_extranet_partners_inbox.sql |
| 4 | Sürümlü katalog, 23 dil editörü/eksik uyarısı, Mimo/public katalog, ayarlar/kullanım ve Airalo | 0020_extranet_catalog_settings.sql |

Migration'lar yeni dosyalardır; eski migration hash'leri korunur. 0016, rol CHECK kısıtını genişletmek için tabloları tüm satırlarını kopyalayarak yeniden kurar ve audit değişiklik/silme trigger'larını ekler. 0020 mevcut yayınlanmış 39 turu ve çevirilerini kopyalar; eski rezervasyon fiyatlarını değiştirmez. Uzak D1'e uygulanmamıştır.

## Roller ve giriş

Owner tespiti mevcut `isOwnerEmail` yardımcı fonksiyonunu kullanır: OWNER_EMAILS ve mevcut ADMIN_OWNER_EMAIL desteği korunur. DB'ye tek başına owner rolü yazmak yetmez. Diğer roller aktif extranet_users kaydı gerektirir. Taze e-posta kodu veya passkey ile Extranet cookie'si alınır; üye bearer tokenı operasyon uçlarına yetmez. İlk passkey kurulumu da taze OTP kanıtı ister. Oturum 30 dakika hareketsizlikte, en geç 12 saatte biter. Partner yalnız kendi atamalarını görür; genel dashboard/üyeler/mesajlar/kampanyalar/ayarlar kapalıdır.

## Yayından önce hazırlanacaklar

- Kullanıcı merge/deploy ve migration uygulamasını ayrıca onaylamalıdır. Şema hazır olmadan ilgili backend sürümü yayınlanmamalıdır.
- Partnerler normal üye hesabı oluşturduktan sonra owner/admin bu üye ID'sini doğrulanmış tedarikçiye bağlar ve rezervasyonu atar. Yeni partner akışı `/extranet/` üzerinden giriş yapar.
- Ortak PARTNER_TOKEN varsayılan olarak kabul edilmez. Sadece açık geçiş ihtiyacı varsa `ALLOW_LEGACY_PARTNER_TOKEN=1` ve `/partner.html?legacy=1` birlikte kullanılır; geçiş sonunda kaldırılır. Yeni bir secret gerekmez.
- Gönderim mevcut RESEND_API_KEY ve REQUEST_FROM_EMAIL'i kullanır. Gerçek e-posta gönderimi bu çalışmada yapılmadı. Onay/hatırlatma yalnız uygun rezervasyon durumlarında, ikinci onayla gönderilir.
- info@bosphorly.com için alıcı mailbox entegrasyonu mevcut değil. Otomatik gelen e-posta içe aktarımı eklenmedi. Site formları ve yalnız Mimo'nun aktarılan/şikâyet/engellenmiş kayıtları alınır; normal sohbetler gösterilmez.
- Maliyet varsayımları sağlayıcının geçerli AI giriş/çıkış tokenı ve TTS karakter birim fiyatlarıyla owner tarafından girilmelidir. Fiyatlar yoksa maliyet bilinmiyor görünür. Varsayılan hedef $9/ay, uyarı eşiği %80'dir. Ölçüm bu sürümden itibaren başlar; token verisi yoksa karakterden tahmin edilir. Fatura mutabakatı değildir.
- OWNER_EMAILS, ASSISTANT_DAILY_LIMIT ve TTS_MONTHLY_CHAR_CAP değerleri/mantığı kaldırılmadı. Runtime operational ayarları mevcut deployment tavanını yalnız düşürebilir. Owner'ın mevcut limit ayrıcalıkları korunur.
- Kamuya açık fiyat/rezervasyon sayfaları `/v1/catalog` kullanır. API erişilemezse mevcut statik katalog snapshot'ına döner; bu yedek son panel düzenlemesini içermeyebilir. Mimo, yönetilen katalog okunurken eski statik tur parçalarını çıkarır; veritabanı hatasında model çağrısına eski fiyat enjekte etmez.
- Airalo alanı HTTPS airalo.com veya airalo.pxf.io bağlantılarını kabul eder; bağlantı kullanıcı tarafından girilmelidir. Partner hesabı/affiliate kaydı otomatik oluşturulmaz.

Ödeme/POS entegrasyonu yoktur. Kart/CVV alanı eklenmedi. Partner komisyonundaki “ödendi” yalnız operasyonel kayıt ve banka/sağlayıcı referansıdır; para transferi yapmaz. Gerçek tahsilat ancak bankanın/POS sağlayıcısının barındırdığı sayfa/ödeme bağlantısı ile ayrıca uygulanmalıdır.

## Doğrulama

Son seri: npm test 185/185, site/SQLite kontrolleri; mevcut tüm mobil testler 180/180 ve yeni katalog/editör testleri 6/6 (360/390/768). Testler gerçek SQLite migration'ları ve sahte dış sağlayıcılarla çalışır. Canlı D1, gerçek WebAuthn cihazları, gerçek e-posta, Telnyx ve üretim LLM uçtan uca test edilmedi.
