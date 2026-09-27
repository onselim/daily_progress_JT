# Yol Haritası

Bu dosya, projenin **o anki durumunu ve sıradaki işleri** takip etmek için var —
`CLAUDE.md`'nin tersine (o, kalıcı vizyon/mimari kararları tutar), bu dosya
**sık güncellenir**. Yeni bir özellik eklendiğinde, bir karar verildiğinde ya
da bir şey tamamlandığında burası güncellenir. Amaç: her yeniliğin dağınık
kalmaması, nerede durduğumuzu her seferinde yeniden hatırlamak zorunda
kalmamak.

**Son güncelleme:** 2026-09-27 (admin proje haritası tamamlandı)

---

## 1. Ürün Envanteri (şu an ne var, ne çalışıyor)

### Ana uygulama — `svkdk.com` (Netlify, özel domain, private repo)
- **Roller:** Admin (giriş var), Saha mühendisi (giriş var), Viewer (link ile,
  giriş yok).
- **Admin paneli:** proje listesi (`ProjectPickerPage.tsx`) — artık **Liste /
  Harita** sekmeli (`ProjectMapView.tsx`, `useProjectLocations.ts`): harita
  görünümünde her projenin direklerinin ortalama konumuna göre bir pin +
  isim etiketi var, pin'e basınca o projeye gidiyor, 9 dilde çeviri var.
  Direksiz (henüz içe aktarılmamış) projeler haritada görünmüyor, altta not
  olarak sayılıyor. Ayrıca proje kurulum sihirbazı (`/admin/new`, 3 adım:
  temel bilgiler → iş kalemleri → Excel/CSV ile direk içe aktarma), iş
  kalemi düzenleme, kullanıcı davet.
- **İlerleme sistemi:** Design/Construction/Supply ayrı takip, ağırlıklı
  toplam yüzde, direk bazlı iş kalemi durumu (tap-to-select, yazı girişi
  yok).
- **Harita:** Leaflet, direk durumu renklendirmesi, span çizgileri (iletken/
  OPGW/topraklama), sapma açısı etiketleri, kesme-dolgu/kazı katmanı
  (`stubGeometry.ts` — bkz. Bölüm 4).
- **Print/PDF raporu:** `/print/:slug`, kullanıcının referans PDF'iyle eşleşiyor.
- **Canlı veri:** Jvari-Tskaltubo (500kV, Gürcistan) — 201 direk, gerçek
  kullanımda. Birkaç test projesi de var (aaa, sss, mesut, karsteb vb. —
  gerçek veri değil).

### AR araçları — `svkdk.com/ar-demo/*`, `/nokta-bulutu/`, `/linkler/`
Hepsi **ana React uygulamasından bağımsız**, vanilla JS/HTML statik sayfalar
(bkz. Bölüm 2 — bu, sistematikleştirilmesi gereken en büyük boşluk).

| Araç | Link | Durum |
|---|---|---|
| AR Konum | `/ar-demo/geo/` | Aktif — KMZ hat (çoklu), proje direk katmanı, kazı aplikasyonu, georeferans, yürüyerek hizalama, DEM zemin kotu |
| Kazı Aplikasyonu Demo | `/ar-demo/demo-kazi/` | Aktif — projeden bağımsız, direk tipi seçilebilir (B30, 2S), tanıtım amaçlı |
| Sehim Kontrolü Demo | `/ar-demo/demo-sehim/` | Aktif — sıcaklık/sehim tablosu gir, 2 nokta işaretle, parabolik sehim eğrisi AR'da çizilir |
| AR Masaüstü Model | `/ar-demo/` | Aktif — direk kütüphanesi, masa üstü 3D önizleme |
| AR Sinema | `/ar-demo/sinema/` | Durduruldu — 360° deneyi, su akışı gerçekçi bulunmadı |
| Nokta Bulutu | `/nokta-bulutu/` | Aktif — alan çiz, yükseklik verisinden nokta bulutu üret |
| Linkler | `/linkler/` | Aktif — yukarıdakilerin hepsinin listesi |

### Deploy edilmemiş / bağımsız araçlar
- **Maliyet** (`Maliyet/Maliyet_Programi.html`) — tek dosya, Supabase'siz,
  gerçek maliyet/kar verisi içerdiği için **yayınlanmadı**, kullanıcıya
  dosya olarak veriliyor. GE 500kV verisi işlendi, diğerleri (Bozlar, KRG,
  OldTowers, Mitas) bekliyor.
- **Cutfill** (`cutfill/`) — kazı/dolgu hacim hesabı, tek dosya, test edildi
  ama **yayınlanmadı** (onay bekliyor).
- **Patent başvurusu** (`patent_basvuru/`) — yerel klasör, repoya/deploy'a
  girmiyor, girmemeli.

---

## 2. Entegrasyon Boşlukları (sistematikleştirilmesi gereken kısım)

Bu, kullanıcının "dağınık olmasın" isteğinin asıl karşılığı:

- **AR araçları ana uygulamadan kopuk.** Kendi UTM matematiği, kendi
  Supabase sorguları var. **İki farklı** veri aktarım yöntemi birikti:
  KMZ/proje katmanı → `localStorage` üzerinden (`arPayload.ts`, henüz
  pushlanmadı); kazı aplikasyonu → AR sayfası Supabase'e **doğrudan**
  bağlanıyor. Tek bir yönteme indirilmeli.
- **`/ar/:slug` girişi ve `arPayload.ts`/`ArLaunchPage.tsx` yazıldı, test
  edildi ama commit/push edilmedi** — üretim uygulamasını değiştirdiği için
  kullanıcı onayı bekleniyor. Pushlansa bile hiçbir menüden linklenmiyor,
  ayrıca eklenmesi lazım (Field/Admin panelinde bir "AR" düğmesi).
- **Direk mühendislik verisi proje bazlı, elle SQL ile giriliyor**
  (`insert_jvari_*.sql`). Yeni proje sihirbazında bu adım yok. Bkz. Bölüm 4.
- **AR araçlarının teması ana uygulamadan farklı** (koyu tema benzer ama
  bileşenler/fontlar ortak değil) — pazarlanabilirlik için tutarlılık
  gerekebilir.

---

## 3. Sırada Ne Var (öncelik sırasına göre)

1. **Direk Kütüphanesi** (`tower_type_library`) — proje bazlı yerine hesap
   bazlı, adlandırılmış, opt-in paylaşımlı kütüphane. Detay Bölüm 4.
2. **Bestana ailesinin tamamı** — 2T1/2T2/2TT + Good/Soft/Rock zemin
   varyantları (2S zaten çözüldü, formül doğrulandı).
3. **Erbil 132kV'nin verisini çıkarma** — formül artık çözüldü (bkz. Bölüm
   4), sadece `Foundations Construction Drawings/` altındaki her tip × her
   zemin çizimini okumak kaldı.
4. **`/ar/:slug` entegrasyonunu pushlama** — kullanıcı onayı bekleniyor.
5. **Irak 400kV eski tip** — henüz hiç doküman yok, kullanıcı ekleyecek.

**Tamamlandı (2026-09-27):** Admin proje haritası — bkz. Bölüm 1, Ana
uygulama. Konum verisi asset'lerden türetiliyor (proje tablosunda kendi
konum alanı yok); ileride gerçek bir proje-merkezi alanı eklenmek istenirse
bu ayrı bir iş.

---

## 4. Direk Kütüphanesi (aktif iş, ayrıntı)

**Karar (2026-09-27):** Proje bazlı tekrar veri girmek yerine, hesap
bazlı, **adlandırılmış, opt-in** bir kütüphane. Kod eşleşmesiyle otomatik
paylaşım YOK (yanlış direk tipi sessizce eşleşebilir, güvenlik riski) —
kullanıcı "kütüphaneden seç" ya da "yeni gir + adlandırarak kaydet" yapar.

**Kaynak dokümanlar** `Direk Kutuphanesi/` altında, aile aile:

| Aile | Durum |
|---|---|
| 500kV Jvari (B30/B60/B90/B90C/BNS/BLS/BLC) | Zaten Supabase'de, doğrulanmış (804/804 satır, 0.5mm) |
| 33kV Bestana/Mitas (2S/2T1/2T2/2TT) | 2S çözüldü ve demoya eklendi; diğerleri bekliyor |
| 132kV Erbil DC ailesi | 3D geometri var (`.tow`→`towers.json`); kazı formülü çözüldü (Z1-Z5, Bestana ile aynı yöntem), veri henüz çıkarılmadı |
| 400kV Irak yeni tip (Besmaya) | Dokümanlar temiz/okunabilir, henüz işlenmedi |
| 400kV Irak eski tip | Doküman yok |

**İki farklı veri şekli bulundu, ikisi de artık kodda destekleniyor
(`demo-kazi/index.html`'deki `TOWERS` objesi, `kind: 'angle'` vs `'z'`):**
- **Jvari tipi:** `angleFactor {a,j,k}` + tablo, 804 gerçek noktadan
  doğrulanmış formülle.
- **Bestana/Erbil tipi:** çizimin kendi Z1/Z2 tablosundan doğrudan okunuyor
  (`legM = (Z1+Z2)/2`, B = Z1−Z2), formül fit etmeye gerek yok. Erbil'in
  Z3/Z4/Z5'i aynı formülün √2'li çapraz kontrol halleri (doğrulandı).

**Henüz yapılmadı:** `tower_type_library` tablosu (migration), admin
arayüzü (kütüphaneden seç / yeni gir + kaydet), mevcut Jvari verisinin bu
yeni tabloya taşınması.

---

## 5. Pazarlama / Hedef Kitle

**Patent:** Kullanıcı 2026-09'un 3. haftasında Türk Patent Enstitüsü'ne bu
platformun fikri hakları için başvurdu. Hedef: yazılımı olabildiğince
kullanışlı ve **pazarlanabilir** hale getirmek.

**Olası müşteriler (henüz kesin karar değil, yön belirleyici):**
- TEİAŞ / Elektrik Bakanlığı (büyük devlet kurumları)
- Aynı anda 20-30 şantiyesi olan EPC firmaları

Bu, hangi admin özelliğinin öncelikli olduğunu etkiliyor: **çok proje
birden yöneten** bir admin için değerli olan şeyler (proje haritası, çapraz
proje panosu) artık daha yüksek öncelikli.

**Faz yol haritası (CLAUDE.md'den):**
- **Faz 0-1 (şu an):** Kendi 5 proje, kanıtlama + genelleştirme.
- **Faz 2 (henüz karar verilmedi):** Gerçek çoklu kiracı, self-servis kayıt,
  faturalama, pazarlama sitesi — Faz 0-1'den gerçek kullanım geri bildirimi
  olmadan girilmeyecek.

---

## 6. Nasıl güncellenir

Her önemli iş bittiğinde (yeni özellik, önemli karar, bir aşamanın
tamamlanması) bu dosyaya kısa bir not eklenir — Bölüm 3 (sırada ne var)
güncellenir, biten madde Bölüm 1'e (envanter) taşınır. Ayrıntılı teknik
notlar burada değil, Claude'un hafızasında kalmaya devam eder; bu dosya
**özet ve öncelik** için.
