# Bosphorly V2 — High-fidelity inceleme teslimatı

26 Kasım 2026. Çalışma dalı: `brand-v2-high-fidelity`.
Başlangıç main SHA: `d1649452337bfe247c5fb63dfce9ad3655a0adec`.

## Durum ve kapsam

Yeni görsel uygulama güncel main kaynaklarından ayrı worktree üzerinde geliştirildi. Önceki demo tasarımı temel alınmadı; yalnızca izolasyon/test araçlarının güvenlik yaklaşımı yeniden kullanıldı. Gerçek HTML, CSS ve mevcut uygulama bileşenleri kullanıldı. Referans ekran görüntüsü arka plan yapılmadı. Bu sürüm tasarım inceleme demosudur; referansla birebir eşleştiği veya nihai tasarım onayı aldığı iddia edilmez.

Yeni ortak marka sistemi mevcut 50 uygulama HTML ekranına bağlandı; basılı QR posterinin kaynak tasarımı değiştirilmedi. Ana sayfa ayrı masaüstü/mobil yerleşim, gerçek katalog kartları, 3D Mimo, arama sekmeleri, yerel dil/RTL ve mevcut rezervasyon/transfer alanlarına güvenli ön doldurma içerir. Ortak header, giriş/hesap, katalog, detay/karşılaştırma, şehir rehberi, Mimo sayfaları ve Extranet giriş ekranı aynı marka paletini kullanır. Mevcut sayfa yapıları/iş mantıkları korunur; tüm ikincil ekranlar yeniden çizilmiş referans maketi değildir.

## Referans karşılaştırması ve kalan farklar

| Unsur | Uygulama ve kalan fark |
| --- | --- |
| Üst menü | Gece mavisi, şeffaf B, mercan .com, slogan, gerçek navigasyon ve mobil hamburger uygulandı. Mevcut dil/para birimi ve hesap işlevleri korundu. |
| Başlık | Kırık beyaz serif başlık ve destek satırı; Türkçe referans metni kullanıldı. Tarayıcı font ölçüleri/kırılımlar birebir aynı değildir. |
| Manzara | Lisanslı gerçek Pexels İstanbul fotoğrafı kullanıldı. Referanstaki Galata–köprü–vapur bileşimiyle aynı fotoğraf değildir; bu en belirgin kalan görsel farktır. |
| Mimo | Şeffaf, ayrı 3D varlık üretildi; kırık beyaz gövde, turkuaz kulaklar, mercan anten, navy yüz ve B göğüs amblemi var. Referans karakterinin kaynak modeli olmadığı için poz, yüz ve gövde oranları tamamen aynı değildir. |
| Arama | Gerçek sekmeler/select/tarih/katılımcı kontrolleri; masaüstü yatay, mobil dikey panel. Native tarih kontrolü işletim sistemine göre görünür. İşlem modeli nedeniyle CTA arama/ön doldurmadır; rezervasyonu kesinleştirmez. |
| Güven satırı | Gerçek hizmet bilgileri korundu. 4 alan masaüstü yatay, mobil 2×2. Referansın her küçük dekoratif işareti birebir kopyalanmadı. |
| Kartlar | Dört sütun + dikey Mimo paneli; mobil iki sütun + yatay planlama kartı. Mevcut doğrulanmış katalog, fiyat ve fotoğraf kredileri korundu. Bu nedenle referansın kısa kart metinlerinden daha uzundur. Temsili yıldız/yorum sayıları eklenmedi. |
| Renk/kontrast | Merkezi dört renk; AA için bazı metinlerde daha koyu turkuaz ve mercan buton üzerinde navy metin kullanıldı. |

Altı gerçek viewport görüntüsü ve tam sayfa sürümleri evidence paketindedir. `/design-review/` sayfası bunları yan yana karşılaştırmak için hazırdır. Sohbetteki orijinal referans görseli yerel dosya olarak sunulmadığından otomatik piksel farkı veya referansı gömülü bir birleşik görsel üretilemedi. Karşılaştırma sayfasında referans dosyasını cihazınızdan seçebilirsiniz; dosya sunucuya gönderilmez. Görsel değerlendirme sohbetteki referans ve gerçek tarayıcı çıktıları üzerinden yapıldı. Bu sınır nedeniyle birebir görsel kabul tamamlanmış sayılmıyor.

## Regresyon ve kalite kanıtları

- Başlangıç ve değişiklik sonrası `npm test`: 205 geçti, 13 atlandı; statik site ve SQLite şema kontrolleri geçti.
- Ağır paralel tarayıcı yükü altında bir tekrarında iki mevcut AI zamanlama/retry testi başarısız oldu. İş mantığı veya bu testler değiştirilmedi. Dosyalar seri çalıştırıldığında `node --test --test-concurrency=1 tests/*.test.js`: 205 geçti, 13 atlandı. Başarısız tekrarın logu da pakette tutuldu.
- Tam Playwright regresyonu: 195/195 geçti (mevcut 186 + yeni 9). Son başlık/destek satırı düzeltmesi sonrası ilgili home/arama testleri: 18/18 geçti.
- Zorunlu 1920×1080, 1440×900, 1280×800, 430×932, 390×844, 375×667 görüntüleri: 0 JavaScript hatası, 0 yatay taşma; altı gerçek katalog kartı ve beş tur arama seçeneği mevcut.
- Geniş sayfa/dil/tema taraması: 134 kontrol. Etkileşimli ekranlarda taşma görülmedi; mevcut basılı poster mobil viewporta göre tasarlanmamış. TR/RU/AR/HE/FA ve RTL ekranları tarandı.
- Son axe taraması: ana sayfa, fiyatlar, rezervasyon, hesap, Extranet ve rehber × açık/koyu tema = 12 kontrol; test edilen WCAG 2 A/AA ve 2.1 AA kurallarında 0 ihlal. Bu otomatik tarama tam WCAG 2.2 sertifikasyonu veya eksiksiz manuel denetim değildir.
- Native bulut tarayıcısı başlatılamadı (altyapı sandbox hatası). Manuel native tarayıcı kontrolü yapılamadı; ekran görüntüleri gerçek headless Chromium/Playwright ile alındı.
- `git diff --check` temiz.

## İzolasyon ve güvenlik

Kaynak projedeki 77 korunan altyapı/config/auth/rezervasyon/Mimo/Extranet/analytics dosyası başlangıç SHA ile byte karşılaştırmasında aynı. Kaynak canonical/hreflang/description/OG/Twitter/robots meta etiketleri değişmedi. Worker/D1/.github yapılandırması değiştirilmedi. Main uzak SHA aynı kaldı.

Bağımsız demo 51 özgün sayfa + sayfa dizini + görsel karşılaştırma olmak üzere 53 HTML içerir. Yalnızca üretilen `dist` içinde API uçları aynı originli salt okunur fixture alanına yönlendirildi; analytics devre dışı. Tüm sayfalarda noindex/nofollow/noarchive, robots Disallow, dış bağlantı/çerçeve/worker erişimini kapatan CSP, yazmaları engelleyen ilk yüklenen guard var. Gerçek site metadata/config dosyaları değiştirilmedi. Secret, API anahtarı, yönetici şifresi veya otomatik yetki yok.

İzolasyon E2E: 2/2 geçti. Altı kritik ekranda harici istek girişimi 0; dış/same-origin POST 403; beacon false; harici pencere açma null. Extranet authenticated=false ve gate görünür. Arama yerel booking ekranına yönlenir; form izinleri işaretlenmez ve gerçek talep gönderilmez. Giriş, Mimo cevap üretimi, OTP, e-posta/ödeme/rezervasyon gönderimi demoda bilinçli kapalıdır. Yetkili Extranet/hesap iç ekranları gerçek oturumla test edilmedi; güvenlik aşılmadı.

## Performans

Aynı Chromium, 1440×900, beş dönüşümlü yerel ölçüm; dış ağ kapalı. Üretim Core Web Vitals veya gerçek telefon ağ ölçümü değildir. Medyan load (ms): ana sayfa 539→592, fiyatlar 292→406, Extranet 176→153. CLS: ana sayfa .096→.033, fiyatlar .137→.118, Extranet 0→0. Ana sayfa yükleme süresi görsel maliyetiyle arttı; fiyatlar CLS değeri hâlâ .1 hedefinin üzerinde. Yeni Mimo PNG yaklaşık 1.1 MB, panorama yaklaşık 357 KB; daha ileri görsel sıkıştırma sonraki performans iyileştirmesidir. Performans üstünlüğü iddia edilmez.

## Geri dönüş ve canlı sistem

Bosphorly main dalına push/merge yapılmadı; bosphorly.com, canlı Extranet, Workers/D1, API, analytics/DNS veya gerçek işlem servislerine dağıtım/yazma yapılmadı. Ayrı inceleme dalı ve ayrı owner-private Sites projesi kullanılır. Demo erişimi hesap sahibiyle sınırlıdır. Önceki demo yeni tasarım olarak yeniden yayınlanmaz.

Geri dönüş: bağımsız demo yayından kaldırılabilir ve inceleme dalı korunabilir/silinebilir; canlıda değişiklik olmadığı için canlıya rollback gerekmez. Bu dal ileride ancak açık onayınızla değerlendirilmeli. Canlıya alma öncesi kalan kompozisyon/karakter farkları, gerçek yetkili akışlar, daha kapsamlı erişilebilirlik ve telefon/ağ performansı ayrıca onaylanmalıdır.

## Yeniden çalıştırma

`npm test`; `npx playwright test --config .brand-qa.config.js` (yerel iki worker ve dış ağ engelli test ayarı); `python tools/high-fidelity-preview/capture.py`; `python tools/high-fidelity-preview/build.py /workspace/sites/bosphorly-high-fidelity/dist`. QA Python araçları Python Playwright + sistem Chromium gerektirir. Contrast aracı yerel axe-core kurulumunu kullanır. İş akışı mevcut müşteri/ödeme servislerine yazmaz.

Değişen dosyalar `CHANGED-FILES.txt` içinde tam olarak listelenir. Asset lisansları `assets/high-fidelity/CREDITS.md` ve yerel fontların OFL dosyalarındadır. Yayın sonucu ve kesin kaynak SHA teslimat manifestine ayrıca kaydedilir.
