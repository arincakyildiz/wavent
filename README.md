# Wavent — İleri Depo Yönetimi, Lot/Seri, Dalga Toplama ve Sevkiyat Kontrol Kulesi

Angular 19 (standalone + Signals) tabanlı ileri seviye WMS kontrol paneli. Birden fazla
depo/lokasyonda ürün, lot/seri, son kullanma, rezervasyon, sayım, dalga toplama, paketleme ve
sevkiyat istisnalarını yönetir.

Backend yoktur: mock transport katmanı gecikme, hata, yetkisiz erişim ve çakışma senaryolarını
simüle eder.

## Kurulum ve Çalıştırma

```bash
npm install
npm start          # http://localhost:4200
npm run build      # production build
npm test           # Karma + Jasmine (watch)
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

Varsayılan demo kullanıcı: **John Doe / Depo Yöneticisi**.

## Mimari Kararlar

- **Standalone components + Signals** — NgModule yok; state Signals ile, asenkron akışlar RxJS ile.
- **Katmanlı, feature-based yapı**:
  ```
  src/app/
    core/      api (mock transport, ApiError, fault injection), auth (rol/izin/guard),
               observability (audit, notification), state (tema, confirm dialog, depo kapsamı)
    shared/    sunum bileşenleri, direktifler, validator'lar, liste/sorgu yardımcıları
    features/advanced-wms/
      pages/        route seviyesi ekranlar
      components/   özellik diyalogları (oluşturma formları)
      data-access/  servisler + mock-data + selectors
      models/       entity/enum tanımları
  ```
- **Tek kaynaklı veri** — `data-access/mock-data.ts` sabit tohumlu bir üreteçle tüm ilişkili veri
  grafiğini kurar (depo → lokasyon → SKU → bakiye → sipariş → **gerçek FEFO/FIFO tahsis motoru** →
  dalga → görev → paket → sevkiyat). Ekranlar arası sayılar bu yüzden tutarlıdır.
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

## Ekranlar

`/wms` altında, tamamı lazy-loaded ve izin guard'lı:

overview · warehouses · locations · inventory · inventory/:sku · lot-serial · stock-movements ·
reservations · receiving · receiving/:id · putaway · waves · waves/:id · picking/tasks · packing ·
shipping · cycle-counts · exceptions · traceability · control-tower · audit-log · settings ·
unauthorized (403)

## Test

Kritik iş kuralları, liste sorgu motoru, validator'lar ve izin sistemi unit testlerle kaplıdır:

- `data-access/selectors.spec.ts` — FEFO, kapasite, tolerans, sayım eşiği, stok tutarlılığı,
  dalga yayınlama kararları
- `shared/utils/list-query.spec.ts` — arama/filtre/sıralama/sayfalama
- `shared/validators/wms-validators.spec.ts` — cross-field ve async validator'lar
- `core/auth/permissions.spec.ts` — izin haritası ve route guard

## Bilinen Eksikler

- Tüm veriler mock; gerçek backend entegrasyonu yok ve oturum içi değişiklikler kalıcı değildir.
- Component/integration testleri (ana akışların uçtan uca DOM testi) henüz yazılmadı; mevcut test
  kapsamı unit seviyesindedir.
- Barkod/tartı gibi fiziksel cihaz entegrasyonları simüle edilmemiştir.
- Offline/IndexedDB önbellek katmanı uygulanmadı.
