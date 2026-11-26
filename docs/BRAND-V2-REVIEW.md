# Bosphorly Brand V2 — İnceleme ve geri dönüş raporu

## Kaynak ve kapsam

Başlangıç main commit: `d1649452337bfe247c5fb63dfce9ad3655a0adec`.
Çalışma dalı: `brand-identity-v2`. Gerçek kaynak kodu üzerinde çalışıldı; 51 HTML sayfasına ortak görsel katman eklendi. Sayfa yerleşimleri, fotoğraflar, tipografi, navigasyon ve animasyonlar korundu.

`brand-v2.css` palet, okunurluk ve işletim sistemi açık/koyu tema tercihlerini uygular. Masaüstü wordmark Bosphorly.com; .com %85 boyuttadır. Mobil SVG B amblemi arka plansızdır. Travel dalga/nokta, Extranet noktalı B kimliğini korur. Marka sloganı başlıkta mevcut duyarlı görünüm kurallarıyla ve ana sayfanın alt bilgisinde yer alır.

## Üretim güvenliği

Korunan backend, Workers/D1 kaynakları, config, Mimo chat/model kodu, API istemcileri, üyelik/Platinum, rezervasyon/ödeme/transfer, Extranet işlev kodu, dil/RTL, analytics, sitemap ve robots dosyalarında değişiklik yoktur. Canonical/hreflang/description/OG/robots metaverileri kaynakta karşılaştırıldı, fark bulunmadı. `protected-systems.json` kanıttır. Mimo'nun 23 dildeki HTML sayfasına yalnızca görsel CSS bağlantısı eklendi.

Main'e push/merge yapılmadı. Mevcut GitHub Pages veya Cloudflare üretim dağıtımı tetiklenmedi. Gerçek rezervasyon, ödeme, müşteri kaydı, mesaj veya e-posta gönderilmedi. Testlerde sahte yanıtlar kullanıldı. Ücretli hizmet satın alınmadı.

## Ayrı demo

Sites üzerinde yeni ve yalnızca hesap sahibine açık bir demo alanı kullanılır; canlı Bosphorly alan adı veya Workers/D1 kaynakları kullanılmaz. Demo 51 asıl sayfayı ve bir inceleme dizinini içerir.

`tools/brand-preview/build.py` sadece ayrı `dist` çıktısında API adreslerini yerel salt okunur fixture'lara çevirir, izleme kodunu etkisizleştirir ve noindex/CSP/guard uygular. POST, XHR yazmaları, beacon, dış pencere ve WhatsApp/Telegram/e-posta gibi harici yönlendirmeler engellenir. Extranet fixture'ı yalnızca `authenticated:false` döndürür; demo yönetici veya oturum token'ı üretmez. Extranet operasyonları yetki verilerek açılmaz.

Bu nedenle demo canlı işlev entegrasyonlarını çalıştırmaz; amaç mevcut sayfaları güvenle görsel olarak incelemektir. Giriş/operasyon ekranlarının gerçek yetki sonrası davranışı mevcut işlev testlerinin taklit ortamında doğrulanır. Demo kullanıcı girdileri bazı mevcut sayfalarda kendi tarayıcısının yerel depolamasına yazılabilir; canlı sisteme gönderilmez.

Rehberlerin mevcut DM Sans yazı tipi, demo CSP'si üçüncü taraf font isteklerini engellediğinden yalnızca demo çıktısında yerel font dosyalarından yüklenir; SIL OFL lisansı dahildir. Üretim guide.css değiştirilmez.

## Başlangıç testleri

- `npm test`: 205 başarılı, 13 atlanan, 0 başarısız (218 toplam); statik site ve SQLite şema kontrolleri başarılı.
- Mevcut Playwright mobil testleri: 186/186 başarılı; 360, 390 ve 768 piksel.
- 390/768/1440 genişliklerinde ana sayfa, fiyatlar ve Extranet için 9 başlangıç ekran görüntüsü alındı.

## Görsel ve erişilebilirlik kontrolleri

- 134 sayfa/tema/dil kontrolünde JavaScript çalışma zamanı hatası görülmedi.
- 51 sayfa mobil ve masaüstü açık temada; ana sayfalar ayrıca koyu temada kontrol edildi.
- TR/RU/AR/HE/FA görünümleri kontrol edildi; AR/HE/FA RTL korundu.
- Kontrol edilen etkileşimli sayfalarda ekran taşması yok. Mevcut baskı amaçlı `assets/print/bosphorly-qr-poster.html`, 390 pikselde 559 piksel genişlik kullanır; baskı yerleşimi değiştirilmedi.
- Ana sayfa, fiyatlar, rezervasyon, hesap, Extranet ve rehber örneklerinin 390 piksel açık/koyu tema axe taramasında renk kontrastı ihlali kalmadı. Önceki sabit renk kaynaklı problemler yalnızca görsel CSS katmanında düzeltildi.
- Ana sayfadaki mevcut `#routeMap` div'inin rol olmadan aria-label kullanımı axe tarafından raporlanır. Bu önceden var olan semantik sorun değiştirilmedi; WCAG uyumluluğu bütünüyle sertifikalandırılmamıştır. Yetkili Extranet iç ekranlarının görsel manuel incelemesi yapılmadı.

## Performans

Aynı Chromium ve 1440x900 görünümde, sürümler sırayla 5'er kez çalıştırıldı. Kaynak dosyalar yerel yanıtlarla sunuldu, dış istekler engellendi. Gerçek ağ veya üretim Core Web Vitals ölçümü değildir. Zamanlar çalışma ortamı yükünden etkilenir.

| Sayfa | DCL önce → sonra (ms) | CLS önce → sonra |
|---|---:|---:|
| index.html | 1007 → 795.5 | 0.096 → 0.096 |
| prices.html | 389 → 384.4 | 0.131 → 0.14 |
| extranet/index.html | 213.2 → 277.8 | 0 → 0 |

İlk başlık düzenlemesinde artan ana sayfa CLS'si, mevcut başlık satırı kurallarına dönülerek giderildi; slogan alt bilgide de gösterildi. Fiyatlar sayfasındaki küçük fark ve Extranet'in ek görsel stil isteği raporda korunur; hız artışı garantisi verilmez.

## Geri dönüş

Üretime henüz uygulanmadığından canlı sistem için geri alma işlemi gerekmiyor. Görsel değişiklikleri reddetmek için dalı merge etmeyin. Yerel başlangıç görünümü `git switch --detach d1649452337bfe247c5fb63dfce9ad3655a0adec` ile açılabilir. İleride kullanıcı onayıyla merge edilirse ilgili görsel commit'ler `git revert` ile geri alınabilir; veri tabanı migrasyonu veya veri geri yüklemesi gerekmez. Demo kendi Sites alanından ayrı olarak kaldırılabilir; üretimi etkilemez.

## Dosyalar

Tam liste `changed-files.txt` içindedir. Temel değişiklikler: `brand-v2.css`, `assets/brand/b-emblem.svg`, `assets/brand/b-extranet.svg`, `site-header.js`, HTML sayfalarındaki CSS bağlantıları/marka alanları, logo yolunu bekleyen tek test, yalnızca demo çıktısı üreten `tools/brand-preview/` dosyaları. Üretim dağıtım workflow'ları değiştirilmedi.

## Ortam sınırı

Sites yerel preview relay'i 4173 portunda hazır olamadı. Bu nedenle o kanal üzerinden manuel tarayıcı QA yapılamadı. Yukarıdaki otomatik Chromium ve mevcut Playwright testleri ayrı olarak çalıştırıldı. Üretim entegrasyonlarında gerçek işlemler denenmedi.

## Son doğrulamalar

Son kontrollü `npm test`: 205 başarılı, 13 atlanan, 0 başarısız; statik site ve SQLite şema kontrolleri geçti. Önceki yoğun eşzamanlı yük altında, kaynakları değişmeyen iki AI zamanlama testi başarısız oldu; testler veya AI kodu değiştirilmeden kontrollü tekrar geçti. İlgili ilk başarısızlık ve tekrar logları kanıtlarda korunur.

Altı ana sayfa x açık/koyu tema son axe taramasında renk kontrastı ihlali kalmadı. Ana sayfadaki mevcut `#routeMap` elemanının rolü olmayan div üzerinde aria-label kullanması devam eder; bu işlev/semantik değişikliği yapılmadan raporlandı. Otomatik axe taraması tam WCAG uygunluk sertifikası değildir.

Geometri karşılaştırması: 390/768/1440 pikselde ana başlık, ana fotoğraf, hero/tur grid ve Extranet giriş kartının yazı tipi ve boyutları korundu. Masaüstü ana sayfada başlık yenilemesinden kaynaklanan 2 piksel dikey konum farkı var; mobil/tablette konumlar eşit.

Performans: aynı Chromium, 1440x900, sürümler arasında dönüşümlü 5 yerel/mok yanıtlı ölçüm yapıldı. Bunlar üretim Core Web Vitals sonuçları değildir. DCL medyanı ana sayfada 1007→796 ms, fiyatlarda 389→384 ms, Extranet'te 213→278 ms. CLS ana sayfada 0.096→0.096, fiyatlarda 0.131→0.140, Extranet'te 0→0. Ek stil dosyası ve yeni SVG kaynakları dışında sayfa yapısı korunur; Extranet ek marka CSS isteği alır. Ölçümler makine yüküne duyarlıdır; sahada performans artışı iddia edilmez.

Demo statik kontrolü: 52/52 HTML sayfasında noindex, CSP ve guard mevcut. İzolasyon tarayıcı testinde altı temsili sayfa kontrol edildi; canlı ağ isteği kaçışı yok, yazma denemeleri 403 döndü. Tüm 52 sayfa için canlı API entegrasyonlarının işlevsel çalıştığı iddia edilmez.

Son tam Playwright tekrarında 186/186 test geçti. `brand-identity-v2` dalı GitHub'a başarıyla gönderildi. Main'e push/merge veya mevcut üretim workflow'larını çalıştırma yapılmadı. İlk görsel turdaki üç eski-logo beklentisi hatası, yeni SVG yoluna uyarlanan tek test beklentisiyle giderildi; son tam tur başarılıdır.
