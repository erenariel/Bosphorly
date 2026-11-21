# Transfer taleplerini doğrudan gönderme

Bu servis yalnızca /v1/requests yolunu sunar. Google Workspace gelen posta hizmetini kullanmaya devam eder. Gönderen requests@notify.bosphorly.com, alıcı info@bosphorly.com, Reply-To ise misafirin formda belirttiği adrestir.

1. Bosphorly adına [Resend](https://resend.com/domains) hesabında notify.bosphorly.com alanını ekleyin. GoDaddy’de yalnızca Resend’in bu gönderim alt alanı için verdiği doğrulama kayıtlarını ekleyin. Ana alanın MX, SPF, DKIM veya nameserver kayıtlarını değiştirmeyin. Durum Verified olduğunda bu alanla sınırlı Sending access anahtarı oluşturun.
2. [Cloudflare](https://dash.cloudflare.com/) hesabında Workers & Pages bölümünde workers.dev alt alanını etkinleştirin. Bosphorly alanını Cloudflare DNS’e taşımak gerekmez. Turnstile bölümünde Managed widget oluşturup bosphorly.com ana bilgisayar adına izin verin. Site key herkese açıktır. Secret key yalnızca Worker içindir.
3. Depo kökünden Node 22.12+ ile aşağıdaki komutları çalıştırın. login tarayıcıda Cloudflare yetkilendirmesini açar. secret put değerleri etkileşimli olarak ister. Anahtarları komut satırında argüman olarak yazmayın. Eksik gizli anahtarla servis gönderim yapmaz.

~~~sh
npx --yes wrangler@4.166.0 login
npx --yes wrangler@4.166.0 deploy --config backend/mail/wrangler.jsonc
npx --yes wrangler@4.166.0 secret put RESEND_API_KEY --config backend/mail/wrangler.jsonc
npx --yes wrangler@4.166.0 secret put TURNSTILE_SECRET --config backend/mail/wrangler.jsonc
~~~

4. config/api.js içinde **transferMailBase** değerini dağıtım çıktısındaki https:// ile başlayan workers.dev adresine ve **turnstileSiteKey** değerini widget'ın site key değerine ayarlayın. Üyelik için kullanılan **base** alanı bağımsızdır. GitHub Pages dağıtımını tamamlayın.
5. bosphorly.com üzerinden örnek yolcu verisi ve kontrolünüzde bir yanıt adresi ile oturum açmadan transfer gönderin. 202 yalnızca posta servisinin kabulüdür. Gmail’de BOS referansını arayıp gelen iletinin alıcısını ve Yanıtla hedefini kontrol edin. Gerçek yolcu verisini test için kullanmayın.
6. Gönderimi durdurmak için transferMailBase değerini boşaltıp Pages'i yeniden yayımlayın ve Worker ayarlarında ENABLE_EMAIL_REQUESTS değerini false yapın. Gmail ve mailto taslakları çalışmaya devam eder.
