# Migration sırası

- `0013_whatsapp.sql`: main'deki WhatsApp tabloları.
- `0014_extranet_stage1.sql`: Extranet Aşama 1 tabloları.
- `0015_extranet_stage2.sql`: Extranet Aşama 2: üyelik/hak yönetimi, süreli atamalar, hesap kontrolü, mesaj kutusu ve ikinci onay kayıtları. Otomatik tur geçmişi değiştirilmez.

Yeni SQL dosyası eklendiğinde `migrations.lock.json` dosyasına dosya adı ve içeriğinin SHA-256 özeti eklenmelidir. Uygulanmış migration'ların SQL içeriğini değiştirmeyin.
