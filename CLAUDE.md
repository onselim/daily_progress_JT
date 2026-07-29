# Proje: Linear Infrastructure Progress Reporting Platform

## 1. Vizyon (Neden Bu Proje Var)

Enerji nakil hattı (OHTL), boru hattı, yol gibi **coğrafyaya yayılmış, doğrusal
(linear) inşaat projelerinde** günlük saha ilerlemesini raporlamak için bir
platform. Uzun vadede:

- Önce kendi şirketimizin 5 farklı projesinde kullanılacak (iç kullanım, Faz 0-1).
- Sonra diğer EPC yüklenicilerine satılabilir bir SaaS ürününe dönüşebilir (Faz 2+).
- Pazar araştırması: TILOS, Vitruvi, RIB Candy gibi oyuncular var ama hepsi
  ağır/kurumsal/pahalı zaman-mesafe planlama araçları. Boşluk: **hafif, günlük
  saha ilerleme + fotoğraf + anlık paylaşım** aracı — orta ölçekli yükleniciler
  için Excel+WhatsApp'tan bir üst seviye, TILOS'tan çok daha basit.

**Kritik ilke:** Sistem "direk" (tower) kavramına kilitli kalmamalı. Baştan
**jenerik bir veri modeli** ile kurulmalı ki ileride boru hattı (weld
joint/spread), yol (chainage segment) gibi farklı varlık tiplerine de
uyarlanabilsin. Ayrıntı için bkz. Bölüm 4.

---

## 2. Bugüne Kadarki Çalışma (Prototip Aşaması — Chat'te Yapıldı)

Bu proje, Claude.ai chat arayüzünde tek bir HTML dosyası üzerinde iteratif
olarak geliştirildi (500 kV SC Jvari–Tskaltubo OHTL projesi, Georgian State
Electrosystem). Referans dosya: `Daily_Progress_Report_2026-04-04.html`
(bu klasörde mevcut — mimariyi ve UI kararlarını anlamak için oku, ama
production kodu olarak KULLANMA, yeniden ve doğru mimariyle inşa edilecek).

### Bu prototipte doğrulanmış / işe yarayan tasarım kararları:

- **Harita:** Leaflet 1.9.4 + Google Satellite tile, UTM→WGS84 dönüşüm
  (proje bazlı UTM zone parametrik olmalı).
- **Direk görselleştirme:** Devre tipi (single/double) ve iletken/topraklama
  hattı sayısına göre görsel farklılaşma gerekiyor (çift devre = 6 iletken,
  tek devre = 3 iletken; OPGW/EW sayısı projeye göre değişir). Bu, config'den
  okunmalı, hardcode edilmemeli.
- **Fiziksel ilerleme formülü** (doğrulanmış, Excel Summary sayfası ile
  bire bir tutan hesap mantığı):
  ```
  Construction% = Σ(iş_kalemi_% × ağırlık) / toplam_ağırlık
  Supply%       = Σ(malzeme_% × ağırlık) / 100
  Overall%      = Supply% × 0.6 + Construction% × 0.4
  ```
  Ağırlıklar ve iş kalemleri **projeye özgü config** olmalı, sabit kod değil.
  (Örnek ağırlıklar bu OHTL projesi için: Concreting=15, Stringing Cond=10,
  Erection=5 vb. — toplamı 61. Bu SADECE bu projenin config'i, evrensel
  şablonun parçası değil.)
- **Print/PDF dashboard:** Tek sayfa A4 landscape, admin "Print PDF"
  bastığında oluşan görsel özet (stat kartları + construction/supply
  breakdown + today's progress / plan for tomorrow tabloları + hava durumu +
  site conditions).
- **Site conditions:** Varsayılan "Normal working day"; olumsuz hava/zemin
  durumunda "Non-working day — unfavourable weather/terrain" + serbest not.
- **Hava durumu:** Aktif direk varsa onun konumuna göre; Windy embed (iframe,
  API key gerektirmeyen embed yöntemi) + Open-Meteo tipi forecast API.

### Bu prototipte BAŞARISIZ olan / terk edilen denemeler (tekrar deneme):

- PLS-CADD `.tow` dosyalarından otomatik 3D tower geometrisi çıkarma
  (Google Earth KML'e aktarma). Basit simetrik tower'larda (DCB-2T, DBL3)
  çalıştı ama karmaşık tower'larda (B30, BNS) sym-code ve x/y eksen
  sistemi tam çözülemedi, geometri PDF outline ile tutmadı. **Kullanıcı
  vazgeçti.** İleride gerekirse PLS-CADD'den doğrudan DXF/OBJ export
  önerildi — .tow parsing'i yeniden icat etmeye çalışma.
- Google Sheets entegrasyonu — CORS sorunları nedeniyle kaldırıldı, Supabase'e
  geçildi.
- Windy Map API'nin ana haritaya (Leaflet 1.9.4) doğrudan entegrasyonu —
  Windy sadece Leaflet 1.4.x destekliyor, mümkün değil. Embed iframe
  çözümü kullanıldı, bu kalıcı çözüm.

### Daha önce kurulmuş ama devre dışı bırakılmış altyapı:

- Bir Supabase projesi zaten oluşturulmuştu (tablolar: towers, photos; RLS
  kapalı). Kullanıcı isteğiyle devre dışı bırakıldı. **Bu proje yeniden
  kullanılabilir ama şema muhtemelen yetersiz** — Bölüm 4'teki jenerik
  modele göre yeniden tasarlanmalı.

---

## 3. Hedef Mimari (Karar Verildi, İnşa Edilecek)

```
┌─────────────────────────────────────────────┐
│ FRONTEND (Netlify, tek deploy, çoklu proje)  │
│  • /proje-adi  → Public viewer (link ile,    │
│    giriş gerektirmez, salt okunur, kendi     │
│    tarayıcısından Print PDF alabilir)        │
│  • /admin      → Admin paneli (login)        │
│  • /field      → Saha mühendisi paneli       │
│    (login, mobil öncelikli, foto/durum       │
│    güncelleme)                               │
├─────────────────────────────────────────────┤
│ BACKEND (Supabase — tek proje, çoklu tenant) │
│  • Auth (roller: admin, field_engineer,      │
│    viewer — viewer login gerektirmez)        │
│  • Postgres (bkz. Bölüm 4 veri modeli)       │
│  • Row Level Security: kullanıcı sadece      │
│    yetkili olduğu project_id'yi görür/yazar  │
│  • Edge Functions: gün sonu otomatik PDF     │
│    arşivleme, log yazma                      │
├─────────────────────────────────────────────┤
│ STORAGE (Supabase Storage, S3 uyumlu)        │
│  • /projects/{project_id}/{asset_code}/      │
│    {category}/{timestamp}.jpg                │
│  • Maliyet: ücretsiz 1GB, sonrası ~$0.021/   │
│    GB/ay — pratikte "dolar" endişesi yok     │
└─────────────────────────────────────────────┘
```

**Kullanıcı rolleri ve erişim:**

| Rol | Erişim | Yetki |
|---|---|---|
| Admin | Login (email/şifre) | Tüm proje verisini düzenle, export, doküman/foto yükle, kullanıcı davet et |
| Field Engineer (saha mühendisi) | Login | Sadece atandığı proje(ler), kendi güncellemelerini yap, foto/doküman yükle |
| Viewer (paydaş) | **Login yok**, sadece link | Salt okunur, kendi tarayıcısından Print PDF |

**Link modeli:** Tek Netlify sitesi, proje bazlı path (`rapor.domain.com/proje-1`).
Yeni proje eklemek = Supabase'de yeni satır + CSV/Excel import, **yeni deploy
gerekmez.**

**Domain:** Kullanıcının kendi şirket domaini varsa `rapor.sirket.com` alt
alan adı; yoksa yeni domain satın alınacak (~$10-15/yıl). Netlify'ın
`xxx-yyy-zzz.netlify.app` rastgele isimleri kullanılmayacak (profesyonel
görünüm istendi).

---

## 4. Veri Modeli (Jenerik — Bölüm 1'deki İlkeye Göre)

**Kritik tasarım kararı:** "Tower" yerine "Asset" soyutlaması kullan, proje
tipine göre config'den beslenir.

```
projects
  id, name, client, contractor, contract_no, industry_type
    (transmission_line | pipeline | road | rail ...),
  logo_url, utm_zone, coordinate_system, created_at

project_config          -- sektöre özgü parametreler, JSON/key-value
  project_id, key, value
    örnek anahtarlar: voltage, circuit_type, conductor_count,
    ground_wire_config, asset_label ("Tower"/"Weld Joint"/"Chainage"),
    work_items[] (ağırlıklarıyla), supply_items[] (ağırlıklarıyla)

assets                  -- eski adıyla "towers", artık jenerik
  id, project_id, asset_code (örn. "T8", "KM 12+400", "WJ-045"),
  asset_type, x, y, z, station, status, lat, lng, notes

asset_daily_log          -- "today's progress / plan for tomorrow" kaynağı
  id, asset_id, log_date, completed_today, planned_tomorrow,
  site_access_status, updated_by (user_id)

asset_work_items         -- her work item için tamamlanma durumu
  id, asset_id, work_item_key, status (Completed/InProgress/NotStarted),
  completed_at

documents                -- proje dokümanları (dinamik slotlar)
  id, project_id, slot_name (kullanıcı tanımlı, örn "Structure List"),
  file_url, uploaded_by, uploaded_at

photos
  id, project_id, asset_id, category, file_url, gps_lat, gps_lng,
  uploaded_by, uploaded_at

activity_log              -- her CSV güncellemesi / foto yüklemesi burada
  id, project_id, user_id, action_type, details (JSON), created_at

daily_report_snapshots    -- gün sonu otomatik PDF arşivi
  id, project_id, report_date, pdf_url, generated_at

users / user_project_roles
  user_id, project_id, role (admin/field_engineer/viewer)
```

**Neden bu şekilde:** `work_items` ve `supply_items` proje bazlı config'de
tutulduğu için, transmission line projesinde "Concreting/Erection/Stringing",
pipeline projesinde "Trenching/Welding/Coating/Backfill" olabilir — kod
değişmez, sadece config verisi değişir.

---

## 5. Aşamalı Yol Haritası

**Faz 0 — Kanıtla (şimdi başlanacak):**
Kendi şirketimizin 5 projesi için üretime al. Supabase şema kurulumu, auth,
admin paneli, public viewer, saha mühendisi mobil arayüzü, gün sonu otomatik
PDF arşivleme. Referans UI/UX: mevcut HTML prototipi (bu klasörde), ama kod
sıfırdan, düzgün mimariyle yazılacak.

**Faz 1 — Genelleştir:**
Faz 0 stabil çalıştıktan sonra `work_items`/`asset_label` gibi alanları
gerçekten farklı bir sektör (örn. bir pipeline projesi) ile test et.

**Faz 2 — Ürünleştir (henüz karar verilmedi, erken):**
Gerçek multi-tenant (başka şirketler), self-servis kayıt, faturalama,
pazarlama sitesi. Faz 0-1'den gelen gerçek kullanım geri bildirimi olmadan
bu faza girilmeyecek.

---

## 6. Açık Kararlar / Kullanıcıya Sorulacaklar

- [ ] Saha mühendisi sayısı ve güncelleme sıklığı (Supabase ücretsiz plan
      yeterliliğini etkiler)
- [ ] Domain: mevcut şirket domaini var mı, yoksa yeni mi alınacak
- [ ] Fotoğraf/doküman için Supabase Storage mı yoksa Google Drive senkron
      yedek olarak da istenir mi (başlangıçta Supabase Storage tek kaynak
      olarak önerildi)
- [ ] İlk pilot proje olarak hangi 1 proje seçilecek (5 projeden)

---

## 7. Claude Code İçin Çalışma Talimatları

- Bu proje sıfırdan, düzgün bir kod tabanı olarak kurulacak. Mevcut HTML
  dosyasından kod kopyalamak yerine, orada doğrulanmış UI/UX mantığını
  (özellikle print dashboard layout'u ve ilerleme formülleri) referans al.
- Supabase CLI ve migration dosyaları kullan, şemayı elle panelden değil
  koddan (version-controlled) kur.
- Git'i baştan kur, her aşamayı commit'le.
- İlk hedef: Faz 0'daki admin paneli + public viewer + auth iskeleti.
  Foto yükleme ve otomatik PDF arşivleme ikinci sırada.
