> Güncel giriş: Passkey isteğe bağlıdır. E-posta kodu doğrulamasından sonra beş dakikalık, tek kullanımlık ve üye token'ına bağlı HMAC kanıtıyla Extranet oturumu açılır. Eski üyelik token'ı tek başına giriş sağlamaz. Cookie, CSRF ve rol kontrolleri korunur.

# Extranet Aşama 2: Üyeler ve Mesajlar

Bu branch `feat/extranet-stage-1` üzerine açılmıştır. Aşama 1'in Passkey, HttpOnly oturum, CSRF, owner/admin/staff, rate limit, PII maskeleme ve değiştirilemez audit yapısını kullanır. Yayın veya canlı D1 işlemi yapılmamıştır.

## Migration sırası ve kurulum

Bağlamdaki numaralar eskiydi: main'de `0013_whatsapp.sql`, Aşama 1'de `0014_extranet_stage1.sql` zaten mevcut. Bu nedenle bu aşama `0015_extranet_stage2.sql` kullanır; numaralar çakıştırılmaz. Önceki dar üyelik PR'ı #110 bu çalışmanın alt kümesidir. İki farklı 0015 şemasını ayrı ayrı uygulamayın: bu tam Aşama 2 şeması seçilmelidir. Mevcut uygulanmış migration dosyaları değiştirilmedi; 0015 henüz yayımlanmamış Aşama 2 dosyasıdır.

Yeni tablolar:

| Tablo | Amaç |
| --- | --- |
| member_tier_overrides | Kalıcı/süreli manuel seviye ve süre sonunda geri dönülecek önceki manuel seviye |
| member_controls | Askıya alma, otomatik kuralı dondurma, günlük Mimo mesaj limiti |
| member_activity | Son başarılı giriş; geçmiş girişler uydurulmaz/backfill edilmez |
| member_tier_history | Eski/yeni seviye, gerekçe, aktör ve tarih |
| extranet_messages | Yalnızca form/handoff/şikâyet/engel kayıtları; varsayılan 24 aylık TTL tarihi |
| extranet_message_notes | Mesaj iç notları |
| extranet_actions | Kullanıcıya bağlı, 10 dakikalık, tek kullanımlık ikinci onay kayıtları |
| extranet_replies | Gönderim denemesi, metni ve sonucu |

Yeni secret gerekmez. Aşama 1'deki `ADMIN_OWNER_EMAIL`, `CODE_PEPPER`, `RESEND_API_KEY`, `REQUEST_FROM_EMAIL`/`MAIL_FROM` kullanılır. Değerler repoya yazılmaz. Yeni değişken: `MESSAGE_RETENTION_MONTHS`, varsayılan `24`, kabul edilen aralık 1–120 ay. Hem ana Worker hem mail Worker aynı değeri kullanmalıdır.

`backend/mail/wrangler.jsonc` aynı mevcut D1 veritabanına DB binding'i ekler: sitedeki gerçek form gönderimleri ayrı mail Worker'ına gittiğinden bu binding gereklidir. Migration sonrasında hem ana Worker hem mail Worker yayımlanmalıdır. Bu aşama mevcut e-posta sağlayıcısını, alıcısını ve form e-posta teslimini korur. Saklama süresi saatlik ana Worker cron'uyla temizlenir; süresi dolmuş kayıtlar temizleme öncesinde de listelenmez.

## Yetkiler ve davranış

- Staff: maskeli üye listesi/profili, talepler, kuponlar ve yalnızca sayısal Mimo özeti; mesaj görüntüleme, durum, not ve e-posta yanıtı. Seviye ayarları, seviye geçmişi ve kontrol alanları staff API yanıtlarında verilmez. Seviye/kupon/askıya alma mutasyonları 403 verir.
- Owner/admin: seviye atama, otomatiğe dönüş, günlük Mimo limitini değiştirme, otomatik kuralı dondurma, kupon, askıya alma/yeniden açma, tüm oturumları sonlandırma. Mimo limiti sadece günlük üye sohbet sayacıdır; mevcut dakika/IP/global maliyet ve TTS korumaları kaldırılmaz.
- Yalnız owner: KVKK silme önizlemesi ve ikinci onayı. Üye verileri, talepleri, kuponları, oturumları, kimlikleri ve ilişkilendirilebilen inbox/e-posta kayıtları D1'de temizlenir. Finansal rezervasyon/audit referanslarının kişisel ilişkilendirmeleri FK kurallarına göre kaldırılır; değiştirilemez audit silinmez. Harici e-posta alıcılarındaki kopyalar bu işlemle silinemez.
- `ADMIN_OWNER_EMAIL` hesabı Platinum/owner limitlerinde kalır. Tekil değişiklik ve askıya alma reddedilir; toplu listede atlanır. Seviye atama yönetici rolü kazandırmaz.
- Otomatik seviyeler 0–1 tur Silver, 2–4 Gold, 5+ Platinum. Manuel atama önceliklidir. Süreli atama 1–730 gün; süre bitişi her istekte değerlendirilir, önceki kalıcı manuel seviyeye veya güncel otomatik/dondurulmuş seviyeye döner. Üst üste aktif süreli atamalar 409 ile reddedilir; önce mevcut atama kaldırılmalıdır. Kupon kazanımı ve tur geçmişi değiştirilmez.
- Otomatik kuralı durdurma anahtarı o anki seviyeyi dondurur. Geri açma veya otomatiğe dönüş ile tur hesabı yeniden etkinleşir.
- Toplu işlem en fazla 100 seçili üye; önizleme etkilenecek/atlanacak sayısını gösterir. Onay aynı kullanıcının güncel yetkisi ve CSRF ile tekrar kontrol edilir. Seviye ve audit/geçmiş aynı D1 batch işleminde yazılır.
- İsteğe bağlı seviye bildirim e-postası profil ekranından önizlenir, ikinci onayla gönderilir. Mesaj yanıtlarında TR/EN/RU şablonları düzenlenebilir. E-posta gönderim kaydı önce `sending`, sonra `sent/failed` olur. Onay tekrar kullanılamaz; belirsiz sağlayıcı hatasında otomatik yeniden gönderim yapılmaz.

## Gizlilik

Normal Mimo sohbetleri inbox'a alınmaz ve hiçbir yeni Extranet endpoint'i Telegram geçici konuşma tablosunu veya WhatsApp KV geçmişini okumaz. Form talepleri, açık handoff iletileri, hizmet şikâyeti ve engellemeye yol açan mesaj/engel metadatası alınır. Handoff dışında geçmişteki normal konuşmalar bütünüyle kopyalanmaz. Yeni kayıtlar geriye dönük normal sohbetlerden doldurulmaz. Kaynak seçimi sunucu tarafındadır; normal sohbet kaynağı tablo CHECK'i ve capture fonksiyonu tarafından reddedilir.

Kart benzeri 13–19 basamaklı Luhn-geçerli içerik inbox, not ve yanıt önizlemesinde maskelenir; yönetim gerekçesinde reddedilir. Paneldeki mesaj gövdelerinde e-posta ve telefonlar da maskelenir. Gerçek alıcı adresi e-posta sağlayıcısına yalnız sunucudan gönderilir. Mimo özeti sadece mevcut günlük sayacın sayısı/günüdür, transcript değildir.

## Uç noktalar

Tümü `/v1/extranet` altında, Aşama 1 auth ve rol kontrollerinden geçer:

- `GET /members?q=&page=&status=&tier=&provider=`; `GET /members/:id`.
- `POST /members/:id/tier` (`tier`, `reason`, opsiyonel `days`).
- `POST /members/:id/tier-preview`, `/members/tier-bulk-preview` (`ids`, `tier`, `reason`, `days`).
- `POST /members/:id/controls` (`suspended`, `automaticDisabled`, `mimoDailyLimit`, `revokeSessions`, `reason`).
- `POST /members/:id/coupon` (`percentBps`, `validDays`, `reason`). İndirim mevcut MAX_DISCOUNT_BPS sınırını aşamaz.
- `POST /members/:id/delete-preview`, `/members/:id/tier-mail-preview`.
- `GET /messages?page=&status=&source=`; `GET /messages/:id`.
- `POST /messages/:id/status`, `/note`, `/reply-preview`; `GET /reply-templates`.
- `POST /actions/:confirmationId/confirm` (`confirm: true`).

## Doğrulama

- `npm test`: 169/169; site/JS/SQLite kontrolleri başarılı.
- Tam Playwright paketi: 171 senaryo, 170 ilk seferde başarılı; mevcut Aşama 2 dışı `direct-send` Almanca özel tur / mobile-768 testi 30 saniyelik zaman aşımı aldı. Aynı test tek başına yeniden çalıştırıldığında başarılı (1/1), ürün koduna müdahale edilmedi.
- Extranet'in 9 mobil senaryosu (360/390/768): atama/otomatiğe dönüş/staff görünümü ve mesaj önizleme/ikinci onay dahil başarılı.
- Tüm SQL migration zinciri boş SQLite'a uygulanır; SHA-256 lock ve FK kontrolü doğrulanır.
- İstenen güvenlik senaryoları: staff 403, admin owner koruması, süre sonunda dönüş (hem hesaplama hem profil isteği), toplu owner atlama, ikinci onay/tekrar kullanımı, audit başarısızsa rollback, kart maskeleme, normal sohbet okunamaması, günlük Mimo limiti/owner muafiyeti, suspend-login ve owner KVKK onayı.
- Önceden mevcut kısa AI timeout testinde paralel çalışmada bir kez zamanlama sapması görüldü; seri tüm paket ve son `npm test` yeniden çalıştırması 169/169 başarılıdır.

## Bu aşamada bilinçli olarak yapılmayanlar

- Main merge, canlı yayın, canlı migration ve gerçek misafire e-posta gönderimi yapılmadı.
- Aşama 3: ürün/fiyat/müsaitlik, tedarikçi doğrulama, muhasebe/komisyon mutabakatı ve genel rol yönetimi eklenmedi.
- Ödeme tahsilatı/ücretli abonelik, normal sohbet arşivi veya eski normal sohbetlerin içe aktarımı yok.
- Harici e-posta/Telegram arşivleri ve hukuken saklanması gereken finansal/audit kayıtları için otomatik küresel silme taahhüdü yok.

## Sorular (geliştirmeyi engellemeyen yayın kararları)

1. 24 aylık mesaj saklama süresi işletmenin KVKK metniyle uyumlu mu; daha kısa süre isteniyor mu?
2. Süreli üyelik e-postalarının marka metinleri ve imzası için tercih edilen ifadeler var mı?
3. Canlıya alma öncesi hangi yetkili hesaplarla owner/admin/staff kabul testi yapılacak? E-posta adresleri secret/yetkili yapılandırmada tutulmalıdır.
4. Finansal/audit kayıtlarında yasal saklama zorunluluğu ve harici iletişim kopyalarının silme süreci nasıl işletilecek?

## İlk yönetici erişimi

`ADMIN_OWNER_EMAIL` doğrulanmış ilk üye girişinde owner rolünü oluşturur. İsteğe bağlı `EXTRANET_ADMIN_EMAILS` Worker secret'ı virgülle ayrılmış ek admin adreslerini kabul eder. Bu adresler sadece başarılı üye e-posta doğrulamasından sonra, daha önce Extranet rol kaydı yoksa admin olarak başlatılır; kapatılmış bir rolü yeniden açmaz. İki durumda da yeni e-posta kodu veya kayıtlı Passkey ile doğrulama gerekir. Adresleri kaynak koda yazmayın.
