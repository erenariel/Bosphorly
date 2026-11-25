# Extranet üyelik yönetimi

Bu çalışma Aşama 1 (#106) üzerine kuruludur. Aşama 1 migration'ı `0014_extranet_stage1.sql`, üyelik yönetimi migration'ı `0015_extranet_stage2.sql` sırasıyla uygulanmalıdır. Bu PR canlı migration veya yayın yapmaz.

Panelde **Üyeler ve Seviyeler** altında isim/e-posta araması ve 20 kayıtlık sayfalama bulunur. E-posta listede maskelenir. Staff yalnızca okur; owner/admin seviye değiştirebilir. Değişiklikte gerekçe ve kullanıcı onayı gerekir. Sunucu cookie, Passkey tabanlı Extranet oturumu, CSRF ve rol kontrolünü Aşama 1'den kullanır. Atama ve eski/yeni değerlerin audit kaydı aynı D1 transaction içinde yazılır.

İki çalışma biçimi:

- **Otomatik:** tamamlanan 0–1 tur Silver, 2–4 tur Gold, 5 ve üzeri Platinum.
- **Elle atama:** Silver/Gold/Platinum seçimi otomatik seviyenin önüne geçer. Süresizdir; otomatiğe dön seçeneğiyle kaldırılır. Yeni turlar otomatik seviyeyi hesaplamaya devam eder, manuel seçimi değiştirmez.

Panel ikisini ve geçerli seviyeyi birlikte gösterir. İşletme sahibi hesabı korunur: üye seviyesi ayarı yönetici yetkisi kazandırmaz ve owner limitlerini değiştirmez.

Geçerli seviye üye profili, partner rezervasyon sorgusu, Extranet rezervasyon filtreleri, bülten seviye seçimi, web/Telegram Mimo ve TTS üyelik yetkilerinde ortak hesaplanır. Tamamlanan tur sayısı, damgalar, kazanılmış kuponlar ve tur tamamlama ödülleri gerçeğe bağlı kalır; manuel atama geçmişe dönük kupon üretmez. Bu ücretli/abonelik tahsilatı eklemez.

API:

- `GET /v1/extranet/members?q=...&page=1`
- `POST /v1/extranet/members/:id/tier`, JSON: `{"tier":"platinum","reason":"Özel misafir"}` veya `{"tier":"automatic","reason":"Otomatik hesaba dönüş"}`.

Migration 0015 eksikse mevcut üye profil/AI hesapları eski otomatik davranışı korur. Yeni Extranet üyelik ekranı ve rezervasyon sorguları, 0015 uygulanmadan yayımlanmamalıdır.
