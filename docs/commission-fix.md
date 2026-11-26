# Kesinleşmiş komisyon düzeltmesi (A)

Panelde kesinleşmiş net/brüt komisyon yalnız tamamlanan ve ödenen rezervasyonlardan hesaplanır. İptal, reddedilme, iade bekleme, tam iade ve `is_test=1` kayıtları hariçtir. Onaylı ancak tamamlanmamış rezervasyonların beklenen net komisyonu ayrı gösterilir. API'deki eski `estimatedCommission` alanı uyumluluk için kesinleşmiş net toplamı döndürür; yeni alanlar `finalizedCommission` ve `expectedCommission`'dır.

Kısmi iadede toplam komisyon, kalan satış tutarı / toplam satış tutarı oranında azaltılır; net komisyon kupon indirimi sonrasındaki tutardır. Kuruş altı sonuç aşağı yuvarlanır. Ödeme bölümündeki iade alanı, rezervasyonun kendi para biriminde **kümülatif minor unit** tutarıdır (EUR/USD için cent, TRY için kuruş). Bu alan gerçek banka iadesi başlatmaz. Owner/admin değişikliği mevcut CSRF ve rol kontrollerinden geçer; önceki/yeni tutar audit log'a ödeme değişikliğiyle aynı batch içinde yazılır.

## Migration ve yayınlama

`0021_commission_basis.sql` mevcut tabloları/verileri korur; iki rezervasyon tablosuna `is_test` ve operasyonel metadata'ya `refunded_minor` ekler. Eski kayıtlar `is_test=0`, iade tutarı sıfır olarak korunur. Önce migration, sonra Worker ve frontend yayınlanmalıdır. Bu çalışma canlı ortamda migration veya deploy çalıştırmaz.

Mevcut test kayıtları otomatik tahminle işaretlenmez. Tam iade edilmiş kayıtlar işaretlenmese de kesinleşmiş komisyona girmez. İade tutarları bu PR'de operasyonel kayıttır; ödeme sağlayıcısından otomatik senkronizasyon eklenmemiştir. Dönemler mevcut paneldeki güncelleme tarihi mantığını kullanır; muhasebe hareket defteri değildir.

## Kalan kapsam

B tamamlanmadı: owner rezervasyonlarına otomatik test işareti, işareti değiştirme API/arayüzü, üye/kupon test alanları, tüm rapor/Mimo/kademe filtreleri, arşiv önizlemesi, TEMİZLE onayı, 30 günlük geri alma ve kalıcı temizleme.

C ve D bu PR'nin kapsamında uygulanmadı. Ayrı uygulama ve test çalışması gerekir. OWNER_EMAILS, ASSISTANT_DAILY_LIMIT ve TTS_MONTHLY_CHAR_CAP mantığı değiştirilmedi.
