# Wavent — İleri Depo Yönetimi, Lot/Seri, Dalga Toplama ve Sevkiyat Kontrol Kulesi

Angular 17+ (standalone) tabanlı ileri seviye WMS kontrol paneli. Birden fazla depo/lokasyonda ürün, lot/seri,
son kullanma, rezervasyon, sayım, dalga toplama, paketleme ve sevkiyat istisnalarını yönetir.

> Bu proje aktif geliştirme aşamasındadır. Mevcut durum ve yol haritası aşağıdadır.

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
npm start
```

`http://localhost:4200` adresinde açılır.

## Test

```bash
ng test
```

## Kullanıcı Rolleri (Demo)

Şu anda `AuthService` sabit bir demo kullanıcıyla (Warehouse Manager) çalışır. Aşağıdaki roller veri modelinde tanımlıdır:

- Depo Operatörü (`warehouse-operator`)
- Vardiya Lideri (`shift-lead`)
- Stok Kontrol Uzmanı (`inventory-controller`)
- Sevkiyat Uzmanı (`shipping-specialist`)
- Planlama Uzmanı (`planner`)
- Depo Yöneticisi (`warehouse-manager`)

## Mimari Kararlar

- **Standalone components + Signals**: NgModule kullanılmadı; state yönetimi Angular Signals ile yapılır.
- **Feature-based klasör yapısı**:
  ```
  src/app/
    core/           // api (mock transport), auth, state, storage, observability
    shared/         // components, directives, validators, utils
    features/advanced-wms/
      pages/        // route seviyesi ekranlar
      components/   // modüle özel bileşenler
      data-access/  // facade/servisler (mock API'ye bağlı)
      state/        // feature store/selectors
      models/       // entity/enum modelleri (bkz. entities.ts)
  ```
- **Mock API**: `core/api/mock-api.service.ts` gecikme ve hata oranı simülasyonu destekler; gerçek bir backend
  bağlanana kadar tüm data-access servisleri bu katmanı kullanır.
- **Routing**: Tüm WMS ekranları `/wms` altında lazy-loaded (`loadComponent`/`loadChildren`) olarak tanımlıdır.
- **Sıfır UI bağımlılığı**: Tasarım sistemi (ikonlar, sparkline, donut, bar chart, dünya haritası) tamamen
  inline SVG ile yazıldı — ikon fontu, chart kütüphanesi veya CSS framework'ü yok. `shared/components/` altında.
- **Tema**: `core/state/theme.service.ts` `data-theme` attribute'unu kök elemente yazar; koyu/açık paletler
  `src/styles.scss` içinde CSS değişkeni olarak tanımlıdır ve seçim `localStorage`'da saklanır.

## Mevcut Durum

- [x] Proje iskeleti, klasör mimarisi, routing (21 ekran, lazy-loaded)
- [x] Veri modelleri (`features/advanced-wms/models/entities.ts`)
- [x] Shell — ikonlu gruplu sidebar (daraltılabilir), arama + bildirim/mesaj/dil aksiyonları, kullanıcı kartı,
      koyu/açık tema toggle
- [x] Overview kontrol kulesi — ikon + sparkline'lı KPI kartları, noktalı dünya haritası (depo bazlı envanter),
      dalga donut grafiği, istisna akışı, operasyon zaman çizelgesi, operatör performans bar grafiği,
      sevkiyat tablosu, günlük sayaç kartları ve canlı saat göstergesi
- [x] Warehouses, Locations — depo/lokasyon listeleri, kapasite göstergeleri, arama/filtre
- [x] Lot / Serial — SKT yaklaşan, bloke ve geri çağrılan lotlar, seri no takibi
- [x] Stock Movements — giriş/çıkış hareketleri, tip filtresi, pagination
- [x] Control Tower — RxJS ile simüle edilmiş canlı görev akışı, sayaçlar olay geldikçe güncellenir, aktif uyarılar
- [x] Settings — rol önizleme, tema seçimi, iş kuralı anahtarları ve eşik ayarları
- [x] Inventory + Inventory Detail — SKU listesi (arama, pagination), lot/lokasyon dağılımı, stok hareketleri (ledger)
- [x] Reservations — FEFO/FIFO, kısmi rezervasyon, backorder, manuel override gerekçesi
- [x] Receiving + Receiving Detail — ASN listesi, kabul satırları (eksik/fazla/hasar/karantina)
- [x] Putaway — puanlanmış öneriler, kabul akışı
- [x] Waves + Wave Detail — dalga listesi, kapasite, yayınlama akışı, satır bazlı sonuç (risk/stok yetersizliği)
- [x] Picking Tasks — single/batch/zone görevler, ilerleme, istisna nedeni
- [x] Packing — içerik doğrulama, ağırlık toleransı, supervisor onay akışı
- [x] Shipping — kapı, taşıyıcı, ilerleme, kapanış
- [x] Cycle Counts — beklenen/sayılan/fark, ikinci sayım eşiği
- [x] Exceptions — istisna workbench, inline çözüm formu
- [x] Traceability — lot bazlı uçtan uca zaman çizelgesi
- [x] Audit Log — işlem geçmişi, arama
- [x] Gerçek zamanlı akış simülasyonu (Control Tower canlı olay akışı + Overview canlı saat)
- [ ] Rol/izin bazlı route ve aksiyon kısıtları (route guard + directive)
- [ ] Reactive Forms + cross-field/async validasyonlar (yeni kayıt/düzenleme formları)
- [ ] Unit ve component/integration testleri

## Bilinen Eksikler

- Tüm modüller mock veri ile çalışır; gerçek backend entegrasyonu yok.
- "+ Add / New" butonları şu an aksiyon tetiklemiyor (form akışları bir sonraki iterasyonda eklenecek).
- Rol bazlı erişim kısıtları henüz uygulanmadı; Settings ekranındaki rol seçimi yalnızca aktif rolü değiştirir,
  route/aksiyon seviyesinde kısıtlama yapmaz.
- Overview'daki tarih aralığı ve depo seçici henüz veriyi filtrelemiyor (görsel yerleşim hazır).
- Otomatik testler henüz eklenmedi.
- `/wms/locations` route'u geçerlidir ancak sidebar'da yer almaz (referans tasarımda bulunmuyor); doğrudan URL ile
  veya Warehouses ekranından erişilir.
- Control Tower'daki sayaç hareketleri simüle edilmiş olay akışından türetilir; sunucu tarafı bir gerçek kaynakla
  senkronize değildir.
