# Wavent — İleri Depo Yönetimi, Lot/Seri, Dalga Toplama ve Sevkiyat Kontrol Kulesi

Angular 20 (standalone + Signals) tabanlı ileri seviye WMS kontrol paneli. Birden fazla
depo/lokasyonda ürün, lot/seri, son kullanma, rezervasyon, sayım, dalga toplama, paketleme ve
sevkiyat istisnalarını yönetir.

Backend yoktur: tarayıcıda kalıcı çalışan ilişkisel mock veri katmanı; gecikme, hata, yetkisiz
erişim ve çakışma senaryolarını simüle eder.

## Kurulum ve Çalıştırma

```bash
npm install
npm start          # http://localhost:4200
npm run build      # production build
npm test           # Karma + Jasmine (watch)
npm run lint       # TypeScript ve template lint
npm run test:e2e   # Playwright Chromium E2E
npm run demo:record # Çalışan uygulamadan teslim demosunu yeniden üretir
```

Tek seferlik test çalıştırma:

```bash
npx ng test --watch=false --browsers=ChromeHeadless
```

## Kullanıcı Rolleri

Roller yalnızca etiket değil; menü, route guard'ları, aksiyon butonları ve görülen veri kapsamı
role göre daralır. Settings ekranından rol değiştirilerek uygulama o rolün gözünden önizlenebilir.

| Rol | Yetki | Veri kapsamı |
| --- | --- | --- |
| Depo Operatörü (`warehouse-operator`) | Kabul, putaway, toplama, paketleme, sayım | Kendi deposu |
| Vardiya Lideri (`shift-lead`) | Dalga planı/yayınlama, istisna kararı, ağırlık onayı | Kendi deposu |
| Stok Kontrol Uzmanı (`inventory-controller`) | Lot/seri, sayım, karantina, düzeltme, override | Tüm ağ |
| Sevkiyat Uzmanı (`shipping-specialist`) | Paket, taşıyıcı, yükleme, kapanış | Tüm ağ |
| Planlama Uzmanı (`planner`) | Sipariş önceliği, dalga kuralı, kapasite | Tüm ağ |
| Depo Yöneticisi (`warehouse-manager`) | Tümü + ayarlar + audit | Tüm ağ |

Varsayılan demo kullanıcı: **Murat Çelik / Depo Yöneticisi**.

Yeni bir tarayıcı profili operasyonel veri olmadan, boş çalışma alanıyla açılır. Genel Bakış'taki
**Örnek verileri yükle** düğmesi veya Ayarlar → Örnek Veri Yönetimi alanı, ilişkili demo veri
grafiğini tek işlemle yükler. Seçim tarayıcıda saklanır; aynı alandaki **Tüm verileri temizle**
işlemi çalışma alanını yeniden ilk açılıştaki boş durumuna döndürür.

Depo, lokasyon, ürün ve başlangıç stoğu, satış siparişi, ASN kabul satırı, lot/seri, dalga ve sayım
kayıtları arayüzden oluşturulabilir. Bunlardan türeyen rezervasyon, görev, paket, sevkiyat,
hareket, istisna ve denetim kayıtları ilgili operasyon tamamlandıkça aynı veri grafiğine yazılır.
Başarılı her yazma işlemi tarayıcıdaki sürümlü WMS anlık görüntüsüne kaydedilir ve sayfa yenileme
veya yeniden giriş sonrasında geri yüklenir.

## Mimari Kararlar

- **Standalone components + Signals** — NgModule yok; state Signals ile, asenkron akışlar RxJS ile.
- **Katmanlı, feature-based yapı**:
  ```
  src/app/
    core/      api (mock transport, ApiError, fault injection), auth (rol/izin/guard),
               observability (audit, notification), state (tema, confirm dialog, depo kapsamı),
               storage (localStorage adapter, TTL'li cache)
    shared/    sunum bileşenleri, direktifler, validator'lar, liste/sorgu yardımcıları
    features/advanced-wms/
      pages/        route seviyesi ekranlar
      components/   özellik diyalogları (oluşturma formları)
      data-access/  servisler + mock-data + selectors + saf iş kuralları (stock-rules)
      state/        feature store + selector'lar (WavePlanningStore)
      models/       entity/enum tanımları
  ```
- **Tek kaynaklı veri** — `data-access/mock-data.ts` sabit tohumlu bir üreteçle tüm ilişkili veri
  grafiğini kurar (depo → lokasyon → SKU → bakiye → sipariş → **gerçek FEFO/FIFO tahsis motoru** →
  dalga → görev → paket → sevkiyat). Ekranlar arası sayılar bu yüzden tutarlıdır.
- **Kalıcı mock veritabanı** — bütün başarılı yazmalar tek ilişkisel grafiği günceller ve
  `DbPersistenceService` tarafından sürümlü olarak `localStorage`'a alınır; uygulama başlatıcısı
  route ve liste isteklerinden önce bu grafiği geri yükler.
- **Tek türetme katmanı** — hesaplanan değerler ve iş kuralı kararları yalnızca
  `data-access/selectors.ts` içinde; Inventory, SKU detayı ve Control Tower asla farklı sayı
  gösteremez.
- **Sunucu benzeri liste sorgusu** — arama, filtre, sıralama ve sayfalama servis tarafında
  uygulanır ve `total` döner; istemci elindeki listeyi dilimlemez.
- **Optimistic concurrency** — yazma çağrıları okunan `version` değerini gönderir; kayıt değiştiyse
  `409 conflict` döner.
- **Sıfır UI bağımlılığı** — ikon, sparkline, donut, bar chart ve noktalı dünya haritası tamamen
  inline SVG.

## Öne Çıkan Özellikler

**İş kuralları** (`selectors.ts` içinde saf fonksiyon, unit testlerle doğrulanır)
- Karantina/hasarlı/bloke stok rezerve edilemez
- Lokasyon kapasitesini aşan putaway onay ister
- FEFO ihlali tespiti ve gerekçeli override
- Sayım farkı eşiği aşılırsa ikinci sayım zorunlu
- Ağırlık toleransı dışındaki paket supervisor onayı olmadan ilerleyemez
- On-hand = available + reserved + quarantine + damaged + blocked

**Kritik işlem akışı** — onay dialogu (gerekçe zorunlu olabilir) → optimistic güncelleme →
başarısızlıkta rollback + "tekrar dene" bildirimi → audit kaydı.

**Dalga yayınlama** — stok yetersizliği olan siparişler dalgada kalır, kalanlar açılır; sonuç
satır bazında raporlanır.

**Tam operasyon akışları** — kabul satırında eksik/fazla/hasar/karantina; barkodlu toplama,
miktar sınırı, kısa toplama, hasar ve görev devri; ilk/ikinci sayım ve stok düzeltmesi; paket
içerik doğrulama, koli ayrıştırma ve tartım; sıralı yükleme, kapı atama ve gerekçeli sevkiyat
kapatma işlemleri aynı ilişkili veri grafiğini günceller. Yayınlanmış dalgaya sipariş ekleme veya
çıkarma yalnız gerekçeli ve version kontrollü akışla yapılır.

**Gerçek zamanlı akış** — Control Tower'da RxJS ile simüle edilmiş görev olayları; sayaçlar sayfa
yenilenmeden güncellenir.

**Hata simülasyonu** — Settings ekranından okuma/yazma hata oranı, ek gecikme ve tek seferlik
`network` / `403` / `409` hataları tetiklenebilir; böylece loading, error, unauthorized ve conflict
durumları gerçek ekranlarda gösterilebilir.

**Erişilebilirlik** — sıralanabilir başlıklar `aria-sort` ile klavyeden çalışır, tıklanabilir tablo
satırları Enter/Space ile açılır, diyaloglar odağı içeri alır, bildirimler `aria-live` ile duyurulur.

**Performans** — Stock Movements CDK sanal kaydırma ile; diğer listeler sunucu benzeri sayfalama ile.

**Paylaşılabilir görünüm** — liste ekranlarındaki arama/filtre/sayfa durumu URL query
parametrelerinde tutulur.

**Çift dil (TR / EN)** — sol menünün altındaki TR/EN düğmesi dili sayfa yenilemeden değiştirir ve
seçim `localStorage`'da saklanır. Angular'ın yerleşik i18n'i derleme zamanlıdır (her dil için ayrı
bundle) ve yeniden yüklemeden geçiş yapamaz; bu yüzden çeviri sinyal tabanlı bir servistir
(`core/i18n`). `i18n.t()` şablondan çağrıldığında locale sinyalini okur, dolayısıyla dil
değiştiğinde ekrandaki her metin kendiliğinden yeniden çizilir — pipe gerekmez.

Ekrana çıkan metinlerin tamamı (başlıklar, sütunlar, durum etiketleri, form doğrulama mesajları,
servis hataları, iş kuralı ihlalleri, bildirimler ve onay diyalogları) katalogdan gelir. İki
katalog `i18n.spec.ts` ile kilitlidir: bir dile eklenip diğerine eklenmeyen anahtar, boş çeviri,
uyuşmayan `{placeholder}` veya İngilizce katalogda kalmış Türkçe karakter testi düşürür. Ayrı bir
test, dili değiştirdiğinde gerçekten render edilmiş metnin değiştiğini doğrular.

Sayı ve tarih biçimi de dile bağlıdır: Angular'ın `DecimalPipe`/`DatePipe`'ı bootstrap'ta sabitlenen
`LOCALE_ID`'yi okur ve çalışma anında değişemez, bu yüzden `i18n.n()` / `i18n.d()` kullanılır —
`Intl` üzerinden biçimlendirir ve locale sinyalini okuduğu için hücre dil değişince yeniden çizilir
(TR `1.234.567`, EN `1,234,567`).

## Ekranlar

`/wms` altında, tamamı lazy-loaded ve izin guard'lı:

overview · warehouses · locations · inventory · inventory/:sku · lot-serial · stock-movements ·
reservations · receiving · receiving/:id · putaway · waves · waves/:id · picking/tasks · packing ·
shipping · cycle-counts · exceptions · traceability · control-tower · audit-log · settings ·
unauthorized (403)

## Test

Kritik iş kuralları, liste sorgu motoru, validator'lar, izin sistemi ve seçili ekranlar
unit/component testlerle kaplıdır:

- `data-access/selectors.spec.ts` — FEFO, kapasite (ağırlık/hacim/ürün sınıfı/sıcaklık), seri
  benzersizliği, tolerans, sayım eşiği, stok tutarlılığı, dalga yayınlama kararları
- `shared/utils/list-query.spec.ts` — arama/filtre/sıralama/sayfalama
- `shared/validators/wms-validators.spec.ts` — cross-field ve async validator'lar
- `core/auth/permissions.spec.ts` — izin haritası ve route guard
- `data-access/waves.service.spec.ts` — optimistic concurrency (`version` çakışması)
- `data-access/reservations.service.spec.ts` — eşzamanlı rezervasyonda version **ve** miktar
  çakışması (§11)
- `data-access/lot-serial.service.spec.ts` — seri numarasının yazma anında benzersizliği (§10)
- `data-access/packing.service.spec.ts` — tartı okuması beklentiyi değiştirmez; tolerans dışı
  okuma paketi weight-hold'a alır (§2/§10)
- `shared/components/scale-input/scale-input.component.spec.ts` — tartı oturma davranışı;
  kararsız okuma kaydedilemez
- `core/storage/indexed-db.service.spec.ts` — offline anlık görüntü önbelleği ve yaş kontrolü

Beş ana kullanıcı akışı component/integration seviyesinde uçtan uca kaplıdır:

- `pages/exceptions/exceptions.component.spec.ts` — istisna çözme (zorunlu gerekçe → servis →
  audit → bildirim)
- `pages/wave-detail/wave-detail.component.spec.ts` — dalga yayınlama (kısmi sonuç, zorunlu
  gerekçe, version çakışması, store senkronu)
- `pages/putaway/putaway.component.spec.ts` — putaway kabulü (optimistic update, hata halinde
  rollback + retry, kapasite override, yanlış barkod istisnası)
- `pages/reservations/reservations.component.spec.ts` — lot override (zorunlu gerekçe, miktar
  çakışması, version çakışması)
- `pages/overview/overview.component.spec.ts` — offline fallback (servis hatasında önbellekten
  "çevrimdışı" etiketiyle sunum, önbellek yokken düz hata, bağlantı dönünce etiketin kalkması)
- `data-access/putaway.service.spec.ts` — kapasite override gerekçesinin servis sınırında doğrulanması
- `shared/utils/list-resource.spec.ts` — ilk istek ve yeniden yüklemede loading durumunun doğruluğu

Playwright E2E paketi; canlı dil geçişi, gerekçeli kapasite override, sanal listeden toplama görevi,
zorunlu ikinci sayım ve hiyerarşik lokasyon oluşturma akışlarını gerçek Chromium üzerinde doğrular.
Aynı build, lint, unit, audit ve E2E adımları `.github/workflows/ci.yml` ile her push ve pull
request'te çalışır.

## Demo Videosu

Teslim demosu: [`docs/wavent-demo.webm`](docs/wavent-demo.webm). Video ana dashboard, dalga,
toplama, gerçek zamanlı kontrol kulesi, audit, rol bazlı menü daralması ve zorunlu ağ hatası
sonrası optimistic rollback/retry bildirimini gösterir. Uygulama `npm start` ile çalışırken
`npm run demo:record` komutu videoyu deterministik olarak yeniden üretir.

## Paylaşılan Bileşenler

Şartnamedeki sekiz bileşenin tamamı `shared/components/` altında ayrı birer bileşendir ve ilgili
ekranda kullanılır; bunlara ek olarak tartı simülasyonu için `ScaleInput` (Packing) vardır:
`WarehouseTree` (Locations · hiyerarşi görünümü), `BarcodeInput` (Putaway),
`InventoryLedger` (Inventory Detail), `AllocationBreakdown` (Reservations · lot override),
`WaveCapacityBoard` (Waves · kapasite panosu), `PickRouteViewer` (Picking · rota),
`ExceptionWorkbench` (Exceptions · kanıt + yeniden atama + karar), `TraceabilityTimeline`
(Traceability).

## Bilinen Sınırlar

- Tüm veriler tarayıcıda kalıcı mock veridir; gerçek bir uzak backend, çok kullanıcılı ortak
  veritabanı veya cihazlar arası senkronizasyon yoktur. Tarayıcı verisi temizlenirse yerel çalışma
  alanı da sıfırlanır.
- Fiziksel cihaz **bağlantısı** yoktur; cihazlar yazılımda simüle edilir: barkod okuma Putaway'de
  `BarcodeInput` (yinelenen okumaları yutar, eşleşmeyen barkod istisna üretir), tartı Packing'de
  `ScaleInput` (load cell oturma süresi, kalibrasyon sapması; kararsız okuma kaydedilemez),
  gerçek zamanlı görev olayları Control Tower'da RxJS akışı.
- Demo kullanıcı adları ve şehir/depo adları veri olarak sabittir; dil değişiminde çevrilmez.
- Offline desteği **okuma yönlüdür**: IndexedDB'deki anlık görüntü, servis hata verdiğinde
  Overview'de "çevrimdışı veri" etiketiyle gösterilir. Çevrimdışıyken yapılan yazmaların
  kuyruklanıp bağlantı gelince gönderilmesi (background sync) uygulanmadı.

Bu sınırlar şartnamenin backend ve fiziksel cihaz entegrasyonunu zorunlu tutmayan simülasyon
kapsamıyla uyumludur; kullanıcıya gösterilen WMS iş akışlarının tamamı mock transport üzerinden
çalışır.
