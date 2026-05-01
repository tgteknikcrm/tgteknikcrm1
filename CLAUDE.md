# TG Teknik — Üretim Takip Sistemi

**Proje sahibi:** TG Teknik (imalat atölyesi) · Admin girişi: telefon `+90 542 646 90 70`
**Proje dili:** Türkçe (UI), kod İngilizce
**İletişim:** Samimi Türkçe ton (kullanıcı "dostum" diye hitap ediyor). Her küçük adımda yes/no sorma — akışı kes, tek onay al, bitir.
**Git:** `https://github.com/tgteknikcrm/tgteknikcrm1` (main branch, push aktif)

---

## 🔁 İki Bilgisayar Arasında Çalışma Rehberi (UNUTMA!)

> **Durum:** Bu proje hem ev hem iş PC'sinde geliştiriliyor. Kod GitHub'da, env Vercel'de, DB Supabase bulutta. Üçü de senkron — sadece **doğru komutları doğru sırada** çalıştırman lazım.

### 🌅 Sabah / Çalışmaya başlarken (her PC'de):

```bash
cd C:\Users\gebze\Desktop\tgteknikcrm1
git pull                    # diğer PC'deki değişiklikleri al
npm install                 # yeni paket eklendiyse kur (yoksa hızlı geçer)
npm run dev                 # http://localhost:3000
```

### 🌙 Akşam / Çalışmayı bitirirken (her PC'de):

```bash
git add -A
git commit -m "wip: bugünkü iş - kısa açıklama"
git push                    # GitHub'a yolla — diğer PC pull ile alacak
```

### 🆕 Yeni bir PC'de SIFIRDAN kurulum (bir kerelik):

```bash
# 1. Repo'yu klonla
cd C:\Users\gebze\Desktop
git clone https://github.com/tgteknikcrm/tgteknikcrm1.git
cd tgteknikcrm1

# 2. Vercel CLI kur ve doğru hesapla giriş
npm install -g vercel
vercel login                # Email ile giriş: tgteknikcrm@outlook.com
vercel whoami               # → "tgteknikcrm" yazmalı
vercel teams ls             # → "tgteknikcrms-projects" görünmeli

# 3. Projeyi link et ve env'leri çek
vercel link                 # scope: tgteknikcrm's projects, project: tgteknikcrm1
vercel env pull .env.local  # .env.local dosyası otomatik oluşur

# 4. Bağımlılıkları kur ve çalıştır
npm install
npm run dev
```

### 🔑 Hesap Bilgileri (referans)

| Servis | Hesap | Notlar |
|---|---|---|
| GitHub | `tgteknikcrm` | Repo: github.com/tgteknikcrm/tgteknikcrm1 (public) |
| Vercel | `tgteknikcrm` (email: tgteknikcrm@outlook.com) | Team: `tgteknikcrms-projects` |
| Supabase | tgteknikcrm@outlook.com | Project: `qikxnbgfaangeyrxzxxl` (Frankfurt) |
| Outlook | tgteknikcrm@outlook.com | Doğrulama mailleri buraya |

### ⚠️ KRİTİK Kurallar

1. **Her zaman `git pull` ile başla** — yoksa eski koddan devam edersin, akşam çakışma çıkar
2. **Her zaman `git push` ile bitir** — yoksa diğer PC'de bugünkü işi göremezsin
3. **`.env.local` git'e gitmez** (`.gitignore`'da) — her PC'de `vercel env pull` ile alınır
4. **Supabase bulutta** — DB her iki PC'de aynı, ekstra kurulum yok
5. **Yarım kalan iş varsa** → `git commit -m "wip: ..."` ile commit et ve push et, çekinme

### 🔧 Yardımcı Komutlar

```bash
git status                  # nelerin değiştiğini gör
git log --oneline -10       # son 10 commit
vercel env pull .env.local --environment=production  # production env'i çek
```

---

## Ne Yapar Bu Uygulama?

TG Teknik atölyesi için **web tabanlı PWA** — masaüstünden ve mobilden açılabilen üretim + satın alma + teknik resim takip sistemi.

**Atölye:** 5 CNC tezgah — Fanuc, Tekna-1, Tekna-2, BWX, Akat.

**Ana işlevler:**
1. **Dashboard** — KPI'lar + makine kartları + göster/gizle + eksik takım + vardiya özeti
2. **Üretim Formları** — günlük vardiya bazlı üretim kayıtları
3. **İşler** — müşteri/parça/adet/teslim, makine+operatör atama, **takım atama** (job_tools), satır içi Kalite kısa yolu
4. **Siparişler** (satın alma) — tedarikçilere verilen siparişler, kategori preset'leri
5. **Tedarikçiler** — firma yönetimi
6. **Makineler** — kart grid + **modernize detay sayfa**: gradient hero, **Durum dropdown** (aktif/duruş/bakım/arıza canlı değişim), **canlı durum kartı** (mock telemetry: spindle RPM, yük, takım, feed, **15 alarm göstergesi yanıp sönen**, **program penceresi** beyaz arka plan + popup tüm kod, **hata logları**, **mock alarm AÇIK/KAPALI** toggle), **QC özet kartı** (aktif iş için), 7g trend, takımlar, tab'lı geçmiş
7. **Operatörler** — CRUD, vardiya ataması
8. **Takım Listesi** — envanter + thumbnail + dialog'da resim yükle/sil
9. **Teknik Resimler** — PDF + görsel upload, Fabric.js annotation editor, PDF export, WhatsApp paylaşım
10. **CAD/CAM** — NC/G-code/STEP/STL/DXF/PDF programları, makine+iş bağlama, signed URL indirme
11. **Kalite Kontrol** — iş bazında spec/ölçüm + **resim üzerinden tıkla-ve-ölç** (bubble_x/y), **canlı sapma + % + OK/NOK**, **onay zinciri** (operatör/kontrolör/onaylayan ALCOA+ stili), FAI raporu (Excel + Yazdır)
12. **Raporlar** — tarih filtresi, makine bazlı özet, Excel export
13. **Ayarlar** (admin) — kullanıcı yönetimi
14. **Global Arama** — Arama FAB ⌘K / Ctrl+K / "/", 8 kaynak paralel
15. **PWA** — service worker + maskable icon + install prompt + Google Sans font

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | **Next.js 16.2.4** (App Router, TypeScript, **Turbopack**) |
| UI | **Tailwind CSS v4** (`@theme inline`) + **shadcn/ui "new-york"** |
| Database | **Supabase** (PostgreSQL + RLS + Storage + Auth) |
| Client | `@supabase/supabase-js` + `@supabase/ssr` |
| Forms | react-hook-form + zod |
| Icons | lucide-react |
| Charts | inline SVG/div bars (recharts kuruluydu, şu an kullanılmıyor) |
| Excel | xlsx (client-side dynamic import) |
| **Annotation** | **fabric** v6 (canvas-based editor) |
| **PDF Export** | **jspdf** (lazy loaded) |
| Toast | sonner |
| PWA | Next.js built-in (app/manifest.ts + app/icon.tsx) |
| Deployment | GitHub → **Vercel** (✅ canlı: https://tgteknikcrm1.vercel.app) |

### ⚠️ Next.js 16 Özellikleri

- **Turbopack varsayılan** — webpack eklentileri (ör. `@ducanh2912/next-pwa`) çatışır
- **`middleware.ts` deprecated** → **`proxy.ts`** kullanıyoruz (fonksiyon adı: `proxy`)
- `cookies()`, `params`, `searchParams` hepsi **Promise** — `await` gerekir
- `next/og` built-in → dinamik PWA ikonları için `app/icon.tsx` kullanıyoruz

---

## Klasör Yapısı (güncel)

```
tgteknikcrm/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   └── login/
│   │       ├── page.tsx
│   │       ├── login-form.tsx       → telefon + parola tabs (kayıt / giriş)
│   │       └── actions.ts           → signIn/signUp/signOut (virtual-email auth)
│   ├── (app)/
│   │   ├── layout.tsx               → sidebar + mobile-nav + <SearchFab/>
│   │   ├── dashboard/
│   │   │   ├── page.tsx             → KPI, MachinesGrid, eksik takım, vardiya özeti
│   │   │   └── machines-grid.tsx    → client, göster/gizle modu, localStorage
│   │   ├── machines/
│   │   │   ├── page.tsx             → kart grid, güncel vardiyadaki operatör
│   │   │   ├── [id]/page.tsx        → profesyonel detay sayfası
│   │   │   ├── machine-dialog.tsx
│   │   │   ├── shift-assignments.tsx → vardiya operatör atama UI (client)
│   │   │   ├── assignments-actions.ts → assignOperator / clearAssignment
│   │   │   └── actions.ts
│   │   ├── operators/
│   │   │   ├── page.tsx
│   │   │   ├── operator-dialog.tsx
│   │   │   ├── delete-button.tsx    → GENERIC, diğer modüller de import eder
│   │   │   └── actions.ts
│   │   ├── tools/
│   │   │   ├── page.tsx             → header: + Yeni Takım + Tedarikçi Ekle + Sipariş Oluştur · listede thumbnail
│   │   │   ├── tool-dialog.tsx      → editlemede Resim bölümü (ToolImageUpload)
│   │   │   ├── image-upload.tsx     → drag-drop, hover'da Değiştir/Sil, maks 8 MB
│   │   │   └── actions.ts           → saveTool (id döner), deleteTool, setToolImage, removeToolImage
│   │   ├── suppliers/
│   │   │   ├── page.tsx
│   │   │   ├── supplier-dialog.tsx
│   │   │   └── actions.ts
│   │   ├── orders/
│   │   │   ├── page.tsx             → sipariş listesi + Yeni Sipariş
│   │   │   ├── [id]/page.tsx        → detay + Düzenle
│   │   │   ├── order-dialog.tsx     → hızlı kategori preset'leri
│   │   │   └── actions.ts           → saveOrder, deleteOrder, updateOrderStatus
│   │   ├── jobs/                    → müşteri işleri (dokunulmadı)
│   │   ├── production/              → günlük vardiya formu (dokunulmadı)
│   │   ├── drawings/
│   │   │   ├── page.tsx             → tür kolonu (PDF/Görsel/Dosya), annotation badge
│   │   │   ├── upload-dialog.tsx
│   │   │   ├── drawing-actions.tsx  → Download, Delete
│   │   │   ├── viewer-dialog.tsx    → PDF iframe / Görsel Fabric read-only
│   │   │   ├── editor-dialog.tsx    → görsel annotation editor
│   │   │   ├── annotation-editor.tsx → Fabric.js toolbar + canvas
│   │   │   └── actions.ts           → upload, delete, saveAnnotations, clearAnnotations
│   │   ├── quality/
│   │   │   ├── page.tsx             → iş kart grid + filtre (v_quality_summary)
│   │   │   ├── [jobId]/page.tsx     → Spec'ler + Ölçümler tabları
│   │   │   ├── [jobId]/report/      → FAI Form 3 stili rapor + Excel/Yazdır
│   │   │   ├── spec-dialog.tsx      → balon+nominal+tolerans+alet+kritik
│   │   │   ├── measurement-dialog.tsx     → tek ölçüm + canlı OK/NOK
│   │   │   ├── bulk-measurement-dialog.tsx → toplu ölçüm (parça serisi otomatik artar)
│   │   │   ├── result-badge.tsx     → renkli OK/Sınırda/NOK rozet
│   │   │   └── actions.ts           → saveSpec/deleteSpec, saveMeasurement, saveBulkMeasurements
│   │   ├── reports/
│   │   │   ├── page.tsx
│   │   │   └── export-button.tsx    → xlsx
│   │   └── settings/                → admin kullanıcı yönetimi
│   │       ├── page.tsx
│   │       ├── actions.ts           → updateUserRole, toggleUserActive, createUser, deleteUser
│   │       ├── role-select.tsx
│   │       ├── create-user-dialog.tsx
│   │       └── user-row-actions.tsx
│   ├── layout.tsx
│   ├── page.tsx                     → redirect('/dashboard')
│   ├── manifest.ts
│   ├── icon.tsx                     → 512x512
│   ├── apple-icon.tsx               → 180x180
│   └── globals.css
├── components/
│   ├── ui/                          → shadcn bileşenleri
│   └── app/
│       ├── sidebar.tsx              → nav + profil bölümü (avatar + telefon + çıkış)
│       ├── mobile-nav.tsx           → mobilde slim sticky bar + hamburger sheet
│       ├── search-fab.tsx           → sağ alt command palette (⌘K)
│       ├── nav-config.ts            → 12 nav item (Ayarlar admin-only)
│       ├── page-header.tsx
│       ├── empty-state.tsx
│       └── search-input.tsx         → debounced URL query search (tools sayfası)
├── lib/
│   ├── supabase/
│   │   ├── client.ts                → browser createBrowserClient
│   │   ├── server.ts                → server (cookies, getUser, getProfile)
│   │   ├── middleware.ts            → updateSession (proxy'de çağrılır)
│   │   ├── admin.ts                 → service_role client (auth.admin API)
│   │   └── types.ts                 → tüm interface'ler + label haritaları +
│   │                                  MACHINE_STATUS_TONE + getCurrentShift()
│   ├── phone.ts                     → normalizePhone, phoneToVirtualEmail,
│   │                                  formatPhoneForDisplay
│   ├── drawings-export.ts           → canvasToPng, downloadCanvasAsPdf,
│   │                                  tryShareFile, whatsappLinkForUrl
│   └── utils.ts                     → cn, formatDate, formatDateTime
├── scripts/
│   └── seed-admin.mjs               → ilk admin bootstrap (idempotent)
├── supabase/migrations/             → 0001 … 0009
├── proxy.ts
├── next.config.ts                   → bodySizeLimit 25mb
├── .env.local                       → Supabase creds + NEXT_PUBLIC_ADMIN_PHONE
├── .env.example
└── CLAUDE.md                        → bu dosya
```

---

## Veritabanı Şeması (tüm migration'lar uygulandı)

### Mevcut tablolar

| Tablo | Ana alanlar |
|---|---|
| `profiles` | id (auth.users FK), **email nullable**, full_name, **phone** (admin tespit için), role, active |
| `machines` | name unique, type, status (aktif/durus/bakim/ariza), model, serial_no, location |
| `operators` | full_name, employee_no, phone, shift, active |
| `tools` | code, name, type, size, location, quantity, min_quantity, condition, supplier, price, **image_path** |
| `jobs` | job_no, customer, part_name, part_no, quantity, machine_id, operator_id, status, priority, start_date, due_date |
| `production_entries` | entry_date, shift, machine_id, operator_id, job_id, start/end_time, produced_qty, scrap_qty, downtime_minutes |
| `drawings` | job_id, title, file_path (storage), file_type, **annotations** (jsonb), **annotated_at**, **annotated_by** |
| `job_tools` | many-to-many (job_id, tool_id, quantity_used) |
| **`suppliers`** | name, contact_person, phone, email, address, notes, active |
| **`purchase_orders`** | order_no (SO-YYYY-NNNN auto), supplier_id, status, order_date, expected_date, notes, created_by |
| **`purchase_order_items`** | order_id, **category** (po_item_category enum), description, tool_id?, quantity, unit, unit_price |
| **`machine_shift_assignments`** | machine_id + shift UNIQUE, operator_id, notes, assigned_by |
| **`quality_specs`** | job_id, bubble_no (UNIQUE per job), characteristic_type, description, nominal_value, tolerance_plus/minus, unit, measurement_tool, is_critical, drawing_id?, **bubble_x/bubble_y** (0..1 normalize, resim üstündeki balon konumu) |
| **`quality_reviews`** | job_id, reviewer_id, reviewer_role (operator/kontrolör/onaylayan), status (onaylandı/reddedildi/şartlı), notes, reviewed_at |
| **`cad_programs`** | title, machine_id?, job_id?, file_path, file_type, file_size, revision, notes, uploaded_by |
| **`quality_measurements`** | spec_id, job_id, part_serial, measured_value, **result** (auto), measurement_tool, measured_by, measured_at |

### Enum'lar

- `user_role`: admin | operator
- `machine_type`: Fanuc | Tekna | BWX | Diger
- `machine_status`: aktif | durus | bakim | ariza
- `shift`: sabah | aksam | gece
- `job_status`: beklemede | uretimde | tamamlandi | iptal
- `tool_condition`: yeni | iyi | kullanilabilir | degistirilmeli
- **`po_status`**: taslak | siparis_verildi | yolda | teslim_alindi | iptal
- **`po_item_category`**: takim | eldiven | kece | yag | kesici | asindirici | bakim_malzemesi | diger
- **`qc_characteristic_type`**: boyut | gdt | yuzey | sertlik | agirlik | diger
- **`qc_result`**: ok | sinirda | nok

### RLS

- `is_admin()` helper (security definer, search_path pinned)
- **Tüm policy'ler `(select auth.uid())` sarmalamalı** (InitPlan optimizasyonu — 0003 migration)
- Profiles: self veya admin okur/yazar
- Diğer tablolar: authenticated CRUD, admin silme
- Storage `drawings` bucket: authenticated read/upload/update, admin delete
- Trigger `on_auth_user_created`: yeni kayıtta profil oluşturur. Telefon `+905426469070` → otomatik admin.

### Storage

- Bucket: **`drawings`** (private) · signed URL 10 dk · path `${user_id}/${ts}_${file}`
- Bucket: **`tool-images`** (public) · direkt URL · path `${user_id}/${tool_id}/${ts}_${file}` · helper `toolImagePublicUrl(path)`

---

## Migration'lar ve workflow

| # | Dosya | Özet |
|---|---|---|
| 0001 | init.sql | şema + RLS + seed + trigger (SQL Editor elle) |
| 0002 | security_fixes.sql | v_daily_production `security_invoker=true` + touch_updated_at search_path |
| 0003 | performance_fixes.sql | RLS initplan optimizasyonu + `profiles_admin_all FOR ALL` split + 8 FK index |
| 0004 | phone_auth.sql | profiles.email nullable + trigger phone okuyor + admin telefon kontrolü |
| 0005 | suppliers_and_purchase_orders.sql | 3 yeni tablo + 2 enum + RLS |
| 0006 | drawing_annotations.sql | drawings.annotations jsonb + annotated_at/by |
| 0007 | machine_shift_assignments.sql | machine↔operator vardiya tablosu |
| 0008 | quality_control.sql | quality_specs + quality_measurements + 2 enum + RLS + v_quality_summary view |
| 0009 | tool_images.sql | tools.image_path kolonu + public `tool-images` storage bucket + RLS politikaları |
| 0010 | quality_reviews.sql | QC sign-off zinciri (operator/kontrolör/onaylayan + onaylandı/reddedildi/şartlı) |
| 0011 | cad_programs.sql | CAD/CAM programları tablosu + private `cad-programs` storage bucket |
| 0012 | qc_spec_bubble_coords.sql | quality_specs.bubble_x/bubble_y (0..1 normalize) — resim üzerinde balon konumlandırma |
| 0013 | activity_events.sql | activity_events + activity_reads + activity_event_type enum (~32 değer) + measurement.nok fail-safe trigger + Realtime publication |
| 0014 | qc_bubble_appearance.sql | quality_specs.bubble_size (sm/md/lg/xl) + bubble_shape (circle/square/diamond/triangle/hexagon/star) — balon görünüm özelleştirme |
| 0015 | messaging.sql | conversations + conversation_participants + messages + message_attachments + RLS (is_conversation_participant helper) + Realtime publication + private `message-attachments` storage bucket |
| 0016 | messaging_rls_widen.sql | INSERT...RETURNING için SELECT politikalarını genişletti (`created_by = auth.uid()` da görsün) |
| 0017 | task_kanban.sql | tasks + task_checklist_items + task_comments + position kolonu (kanban drag-drop) + RLS |
| 0018 | activity_extended.sql | activity_event_type'a task.* + breakdown.* eklendi |
| 0019 | calendar.sql | calendar_events + calendar_event_attendees + RLS |
| 0020 | breakdowns.sql | breakdown reports + machine_status sync trigger |
| 0021 | calendar_rls_split.sql | RLS recursion düzeltmesi: `is_calendar_event_visible` → `is_calendar_event_creator` + `is_calendar_event_attendee` (her policy tek tabloya bakıyor) |
| 0022 | tasks_position_index.sql | task position index (kanban perf) |
| 0023 | breakdowns_severity.sql | breakdown.severity enum + RLS |
| 0024 | delete_constraints_relax.sql | `production_entries.machine_id` ve `quality_reviews.reviewer_id` FK'larını RESTRICT → SET NULL (makine/operatör silmek artık geçmişi yok etmiyor) |
| 0025 | product_master.sql | products + product_tools junction + jobs/drawings/cad_programs.product_id + production_entries.notes (multi-entry için) |
| 0026 | tasks_rls_relax.sql | tasks/task_checklist/task_comments UPDATE+DELETE policy `using(true) with check(true)` — atölyede herkes herkesin kartını taşıyabilsin (kanban drag-drop revert bug fix) |
| 0027 | product_master_extended.sql | products tablosuna 24 yeni kolon (kategori, malzeme, yüzey/ısıl işlem, boyutlar, tolerans, proses, ticari) + product_images tablosu + 'product-images' public storage bucket + 3 enum (product_status / product_process / product_currency) |
| 0028 | jobs_setup_steps.sql | job_status'a 'ayar' eklendi (beklemede ↔ uretimde arası) + jobs.started_at/setup_completed_at + products.parts_per_setup (aynı anda bağlanan adet, setup-count math'i için) |
| 0029 | production_workflow_and_schedule.sql | products.cleanup_time_minutes (parça başı kapı açma+swap+temizlik) + production_entries.setup_minutes (ayar dakikası ayrı kolonda) + app_settings (key text PK, value jsonb) — work_schedule default seed (Pzt-Cum 540 dk + 60 dk yemek) + machine_timeline_entries.production_entry_id + production_entries UNIQUE INDEX (machine,date,shift,job_id) |
| 0030 | machine_downtime_sync.sql | machine_downtime_sessions tablosu + `_close_open_downtime_session` + `_active_job_entry_for_machine` helpers + AFTER UPDATE OF status ON machines trigger — makine `aktif → durus/bakim/ariza` olunca session açar, `aktif`'e dönünce kapatır + elapsed dk'ı active job'ın production_entry.downtime_minutes'ına credit eder. v_machine_active_downtime view (security_invoker). |
| 0031 | complete_job_rpc.sql | İki SECURITY DEFINER RPC: `soft_delete_message(uuid)` — RLS read-after-update sessiz 0-row trap'i bypass + spesifik errcodes (auth_required / not_your_message / message_not_found). `complete_job_rpc(uuid, int)` — atomik jobs.UPDATE + production_entries INSERT/UPDATE + setup backfill (started_at→setup_completed_at delta) + scrap validation. Her ikisi de authenticated grant. |
| 0032 | messaging_rls_recursion_fix.sql | `is_conversation_participant` + yeni `is_conversation_admin` SECURITY DEFINER fonksiyonlarına `set row_security = off` eklendi → "infinite recursion detected in policy for relation conversation_participants" hatası bitti. Calendar 0021'de yapılan recursion fix'in messaging eşdeğeri. Eski "delete participants" + "insert participants" policy'leri inline subquery yerine helper kullanır. |

**Workflow:** Yeni migration:
1. `supabase/migrations/00NN_name.sql` dosyasına yaz
2. Supabase MCP `apply_migration` tool'uyla uygula (hem DB'ye işler hem migrations tablosuna kayıt düşer)
3. Commit et

---

## Auth Sistemi

**Telefon + parola** — Supabase native phone auth SMS provider gerektirdiği için **virtual-email pattern** kullanılıyor:

1. Kullanıcı telefon girer (ör. `0542 646 90 70`, `+90 542 646 90 70`, `05426469070` — hepsi kabul)
2. `normalizePhone()` → `+905426469070` (E.164)
3. `phoneToVirtualEmail()` → `905426469070@tgteknik.local`
4. Supabase email/password auth — SMS gerekmez
5. Gerçek telefon `auth.users.raw_user_meta_data.phone` ve `profiles.phone`'da
6. `handle_new_user()` trigger: telefon `+905426469070` ise otomatik admin

Admin API (service_role) ile kullanıcı oluşturma/silme: `lib/supabase/admin.ts` · `settings/actions.ts`

---

## Ana Özellikler

### Dashboard makine kartları (göster/gizle modu)
- `app/(app)/dashboard/machines-grid.tsx` (client) — tercih localStorage: `tg.dashboard.hiddenMachines`
- Başlık sağında **Göster / Gizle** tuşu → düzenleme modu
- Düzenleme modunda her kartın sağ üstünde göz ikonu → kart gizle/göster
- Accent strip üstte, pulse animasyonu aktif makinede
- Empty states: arıza/bakım/duruş/boşta için farklı ikon+metin

### Annotation Editor (Fabric.js)
- `app/(app)/drawings/annotation-editor.tsx`
- Toolbar: Seç, Yazı, Kare, Daire, Ok, Çiz (free draw), Numara (1,2,3...), Harf (A,B,C...)
- Renk paleti (7 hazır + özel color picker) · kalınlık slider 1-20 · font (5 seçenek) + boyut
- Undo/Redo (50 adım) · Delete/Backspace ile seçileni sil · Esc seçimi iptal · Tümünü temizle
- Annotations `drawings.annotations` jsonb'de; **orijinal dosya değişmiyor**
- Yalnızca görseller — PDF'ler annotation'sız (iframe ile native render)
- Export: PNG / PDF (annotation'lı) / Orijinal PDF (annotationsız) / WhatsApp (Web Share API + wa.me fallback)

### Vardiya Operatör Ataması
- Tablo: `machine_shift_assignments` (UNIQUE machine_id+shift) — **makine detayından kaldırıldı (2026-04-28)**
- `getCurrentShift()` helper: 08-16 sabah / 16-24 akşam / 00-08 gece (hâlâ kullanılıyor — makine listesi)
- Makine listesi kartlarında: güncel vardiya operatörü avatar + ad ile gösterilir

### Takım Resmi
- Bucket: `tool-images` (public, direkt URL)
- Tek resim per takım (`tools.image_path`)
- Yüklenme akışı: yeni takım önce kaydedilir → düzenleyince Resim bölümü açılır → tıklayıp seç / drag-drop
- `image-upload.tsx`: client component, hover'da Değiştir/Sil, JPG/PNG/WebP, maks 8 MB
- Eski resim sessizce silinir (storage temiz kalır), takım silininde de resim silinir

### Global Arama FAB
- `components/app/search-fab.tsx` — sağ alt `bottom-[50px] right-[50px]`
- Kısayollar: ⌘K / Ctrl+K / "/"
- 8 kaynakta paralel ilike arama: machines, operators, tools, jobs, purchase_orders, suppliers, drawings, quality_specs
- 200ms debounce · gruplandırılmış sonuçlar · tıklayınca ilgili sayfa

### Ürün Master Modülü (yeni — migration 0025)
- **Klasör:** `app/(app)/products/` — page (liste + bulk select), product-dialog (CRUD + bulk tool picker), products-table (client wrapper), actions.ts
- **Tablolar:** `products` (code unique, name, customer, default_quantity) + `product_tools` (junction: product_id + tool_id + quantity_used)
- **Job ile entegrasyon:** `JobDialog` üst kısımda ürün picker — seçince customer/part_name/quantity otomatik dolar, save sonrası `materializeProductIntoJob(jobId, productId)` çalışır → ürünün takım listesi `job_tools`'a kopyalanır
- **Drawings/CAD bağlama:** upload dialog'larında ürün picker (opsiyonel, job_id'ye alternatif). Ürün filtresi ile dosyaları geri çekebilirsin
- **Mantık:** "X malzemesi 2 haftada bir geliyor, her seferinde teknik resim/takım/CAD-CAM tekrar bağlama" derdine çözüm. Bir kere ürün tanımla, işler bu üründen instantiate olsun

### Görev / Kanban Modülü (migration 0017)
- **Klasör:** `app/(app)/tasks/` — kanban (HTML5 drag-drop), liste, checklist, comments
- **Optimistik UI:** kart sürüklerken `statusOverrides` Map ile anında yeni kolona düşer, server cevabı beklenmez (geri gelirse rollback)
- **Realtime:** `postgres_changes` ile diğer kullanıcılar canlı görür

### Mesajlaşma (migrations 0015 + 0016)
- **Klasör:** `app/(app)/messages/` — facebook messenger benzeri layout (sol konuşma listesi + sağ aktif konuşma)
- **Optimistik gönderim:** UI kilidlenmez, fire-and-forget; server hatası toast'la geri gelir
- **Görsel cache:** `/api/attach/[id]` route handler — token-less stable URL + 1 yıl `Cache-Control: immutable` → mesajlar arası geçişte resim ASLA tekrar yüklenmez
- **Realtime:** broadcast ile typing indicator + `postgres_changes` ile yeni mesaj ekleme

### Takvim Modülü (migrations 0019 + 0021)
- **Klasör:** `app/(app)/calendar/` — Google Calendar benzeri ay grid + etkinlik dialog
- **RLS recursion fix (0021):** `is_calendar_event_visible` ikiye bölündü (`creator` + `attendee` ayrı SECURITY DEFINER helper'lar) — her policy tek tabloya bakar, recursion biter
- **Geniş ön-yükleme:** ay geçişi anında olsun diye 3 ay geri + 9 ay ileri tek seferde çekilir, navigation client-state ile

### Bulk Select / Toplu Seçme
- **6 liste sayfasında aktif:** operators, tools, suppliers, jobs, orders, products
- **Pattern:** `lib/use-bulk-selection.ts` (hook) + `components/app/bulk-actions-bar.tsx` (sticky toolbar)
- **Shift+click ile range select**, "Tümünü Seç", indeterminate state
- **Server:** her modülde `bulkDeleteX(ids: string[])` action

### Kalite Kontrol Modülü
- **Klasör:** `app/(app)/quality/` — actions, spec-dialog, measurement-dialog, bulk-measurement-dialog, result-badge
- **Sayfalar:**
  - `/quality` — iş bazında kart grid (spec sayısı, ölçüm sayısı, OK%, NOK), filtreler (Tümü/Spec yok/Bekliyor/Tamamlandı/NOK var), arama, `v_quality_summary` view'ından okur
  - `/quality/[jobId]` — Spec'ler + Ölçümler tabları, KPI'lar (kabul oranı, NOK), CRUD'lar, "Toplu Ölçüm" + "Yeni Spec" + "Kalite Raporu" butonları
  - `/quality/[jobId]/report` — FAI Form 3 stili rapor (spec × parça matrisi ≤10 parça için yan yana, fazlasında özet + ayrı detay tablosu), imza alanları, Excel + Yazdır/PDF export
- **`calculateQcResult` helper** (`lib/supabase/types.ts`): nominal ± tolerans kontrolü, kullanılan toleransın %80'ini aşan değerler "sinirda" (sarı uyarı) verir. Sonuç DB'ye yazılırken server-side tekrar hesaplanır (client'a güvenilmez).
- **Tolerans preset'leri:** ISO 2768 fine/medium uyumlu — ±0.005, ±0.01, ±0.02, ±0.05, ±0.1, ±0.2, ±0.5
- **Ölçüm aleti preset'leri:** Kumpas, Dijital Kumpas, Mikrometre, Mastar, Komparatör, Pasametre, CMM, Pürüzlülük/Sertlik Cihazı vs.
- **Toplu ölçüm:** parça serisi otomatik artar (Numune-1 → Numune-2), TAB ile spec'ler arası gezinti, canlı renkli OK/Sınırda/NOK rozet
- **Print:** `globals.css`'te `@media print` kuralları sidebar/dialog'ları gizler, rapor sayfası temiz PDF olarak yazdırılır

---

## Kurulum / Deploy

### 1. Local Geliştirme

```bash
npm install
npm run dev       # http://localhost:3000
```

`.env.local` zaten dolu (gerçek Supabase creds + admin phone).

### 2. İlk admin
- Script: `node scripts/seed-admin.mjs` (idempotent, zaten çalıştırıldı)
- Veya: login ekranında `0542 646 90 70` + `80148014` ile giriş

### 3. Vercel Deploy (canlı)
- **URL:** https://tgteknikcrm1.vercel.app
- **Vercel project:** `tgteknikcrms-projects/tgteknikcrm1` (org `team_zf1VsHzRhUAlFGdpy3cSEjZP`, project `prj_oJUuPORkT99ICGugAdnw88hIzZMN`)
- Local repo Vercel CLI ile linklendi (`.vercel/project.json`, gitignored)
- ENV var'lar (Production + Preview + Development hepsinde):
  - ✅ `NEXT_PUBLIC_SUPABASE_URL`
  - ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - ⏳ `SUPABASE_SERVICE_ROLE_KEY` — kullanıcı eklemeli; yoksa Ayarlar admin user CRUD çalışmaz, geri kalan her şey çalışır
  - ✅ `NEXT_PUBLIC_ADMIN_PHONE`
- **Supabase Auth URL Config** kullanıcı tarafında ayarlanmalı:
  - Site URL: `https://tgteknikcrm1.vercel.app`
  - Redirect URLs: `https://tgteknikcrm1.vercel.app/**`, `https://*.tgteknikcrms-projects.vercel.app/**`, `http://localhost:3000/**`
- Yeniden deploy: `npx vercel deploy --prod --yes --token=$VERCEL_TOKEN`

### Komutlar

```bash
npm run dev         # dev server (Turbopack)
npm run build       # production build
npm run start       # production server
npm run typecheck   # TypeScript kontrolü
npm run lint        # ESLint
```

---

## Geliştirme Pattern'leri

### Yeni modül ekleme
1. `app/(app)/X/` klasörü aç
2. `actions.ts` — server actions (`"use server"`)
3. `X-dialog.tsx` — client dialog (oluşturma/düzenleme)
4. `page.tsx` — Server Component, Supabase'den veri çeker, try/catch
5. `components/app/nav-config.ts`'e nav item ekle

### Server Action + Client Component pattern

⚠️ **Önemli (Next 16 davranışı):** **Client component** içinde inline `"use server"` arrow function tanımlanamaz — SWC `"use client" must be at top` hatası verir (yanıltıcı mesaj, gerçek sebep `"use server"` çakışması). Çözüm: server action zaten `"use server"` dosyasında export edilmişse doğrudan çağır:

```tsx
// ✅ DOĞRU — client component içinde
<DeleteButton
  action={() => deleteX(id)}
  confirmText={`'${item.name}' silinsin mi?`}
/>

// ❌ YANLIŞ — Next 16'da build hatası verir
<DeleteButton
  action={async () => {
    "use server";
    return deleteX(id);
  }}
/>
```

Inline `"use server"` SADECE **server component**'lerde çalışır (bkz. `(app)/production/page.tsx`). Liste sayfaları artık `*-table.tsx` (client) wrapper'ına ayrıldı, hepsi doğrudan çağırma pattern'ini kullanır.

`DeleteButton` `app/(app)/operators/delete-button.tsx` — generic, diğer modüller buradan import eder.

### Bulk select pattern (toplu seçme/silme)

Tüm liste sayfalarında ortak hook + sticky toolbar:

- **Hook:** `lib/use-bulk-selection.ts` → `sel.has/toggle/toggleRange/selectAll/clear/ids/size/allSelected/someSelected`
- **Toolbar:** `components/app/bulk-actions-bar.tsx` → sayı + Tümünü Seç + Sil + Kapat (Gmail/Outlook stili)
- **Server action konvansiyonu:** her modülün `actions.ts`'inde `bulkDeleteX(ids: string[])` var (operators, tools, suppliers, jobs, orders, production_entries, products)
- **Pages → table split:** liste sayfaları `app/(app)/X/page.tsx` (server, veri çeker) + `app/(app)/X/X-table.tsx` (client, checkbox + toolbar)
- **Shift+click:** `<Checkbox onClick>` içinde `e.shiftKey` kontrolüyle range select
- **Türkçe mesaj:** `BulkActionsBar` `itemLabel` prop'u alır (ör. `"takım"`, `"sipariş"`) — confirm + toast'larda kullanılır

### URL-driven filtreler

`components/app/product-filter.tsx` — `?product=<id>` URL paramı yazan dropdown. Drawings ve CAD/CAM sayfalarında kullanılıyor. Aynı pattern başka filtreler için de tekrarlanabilir (paramKey prop). Server page `searchParams`'tan okur, Supabase `.eq("product_id", id)` ile filtreler.

### Supabase client kullanımı

- **Server Component:** `const supabase = await createClient()` (lib/supabase/server)
- **Client Component:** `const supabase = createClient()` (lib/supabase/client)
- **Server Action:** `const supabase = await createClient()` — cookies otomatik
- **Admin API (service_role):** `const admin = createAdminClient()` (lib/supabase/admin) — `auth.admin.createUser` gibi işlemler için

### Auth koruması

- `proxy.ts` — tüm routeları guardlar, `/login`'a yönlendirir
- `(app)/layout.tsx` — ayrıca `getProfile()` çağırır, yoksa redirect
- Admin-only: `if (profile.role !== "admin") redirect("/dashboard")` (settings sayfasında)

---

## Advisor durumu

- **Security (son)**: 1 WARN — `leaked_password_protection` (dashboard'dan açılır, MCP'den ayarlanamaz)
- **Performance (son)**: sadece `unused_index` INFO'ları (veri az/yok, beklenen)

---

## Son commitler (2026-05-01 — 4 turluk büyük revizyon)

**Hepsi tek session'da yapıldı:** mesaj silme + iş tamamlama + canlı sayım + makine arıza anlık durdurma + RLS recursion fix.

### Commit `19c3984` — Round 1: temel bug fix turu
- **Mesajlar router.refresh-during-render** (`Cannot update a component while rendering a different component` console hatası): `setConversations` updater içinden `router.refresh()` çağrılıyordu, `queueMicrotask` ile dışına taşındı.
- **Mesaj silme cache patch**: `MessagesClient`'a `applyMessageMutation(convId, msgId, patch)` callback eklendi, ChatPanel `onApplyMessageMutation` prop'uyla alıyor → silinince Realtime'a bel bağlamadan cache anında patch'leniyor.
- **Scroll jitter** (geçişte yukarı-aşağı): `lastMsgCountRef` ile cache geç dolma case'i tespit edildi → 0→N geçişinde **smooth değil INSTANT** scroll.
- **JobCard sil butonu** kart sağ üstüne eklendi (kırmızı çöp kutusu).
- **"+ Üretim" + "Vardiya Kapat" kaldırıldı** — auto akışla yer değiştirdi.
- **CompletionDialog** (yeni): Tamamla → modal SADECE hurda sorar → otomatik özet (planlanan/üretilen/ayar/duruş) gösterir → `produced = remaining - scrap`.
- **setJobStep auto setup_minutes**: ayar→üretimde geçişinde elapsed dakikayı otomatik bugünkü entry'ye ekliyor.
- **Migration 0030** (`machine_downtime_sync.sql`): machine_downtime_sessions tablosu + sync trigger.

### Commit `862923f` — Round 2: canlı sayım + delete RLS-trap
- **`calcLiveProduced` v1** types.ts'e: `setup_completed_at` + cycle + cleanup'tan client-side hesap.
- **`useTick(10s)` hook**: üretimdeki kart 10 sn'de bir kendi kendine refresh.
- **"Üretilen" stat'ı** üretimde'yken **"Canlı"** rozetiyle değişiyor; "Bugün" satırına CANLI rozeti + parça başına cycle ilerleme barı.
- **deleteMessage** `.select().maybeSingle()` çıkarıldı (silent RLS read-after-update 0-row → haksız "yetki yok" toast'u veriyordu).

### Commit `ec1f9a4` — Round 3: bulletproof RPC + makine-bilinçli ticker
- **Migration 0031**: iki SECURITY DEFINER RPC.
  - `soft_delete_message(uuid)` — RPC üzerinden silme, spesifik errcodes (auth_required / not_your_message / message_not_found). Client RPC çağırıp Türkçe çeviriyor.
  - `complete_job_rpc(uuid, int)` — atomik jobs.UPDATE + production_entries INSERT/UPDATE + setup backfill + scrap validation.
- **`calcLiveProduced` v2** machine-aware:
  - `machineStatus`, `creditedDowntimeMinutes`, `openDowntimeStartedAt` parametreleri.
  - Makine `aktif` değilse ticker `openDowntimeStartedAt`'te DONUYOR (sayfa refresh beklemeden).
  - Cycle hesabı `entry.downtime_minutes`'ı çıkarıyor → kapanmış duruşları doğru hesaplar.
  - "DURDU · Arızalı/Bakımda/Duruşta" rozeti CANLI yerine geçiyor.
- **JobsShell Realtime**: `machines` + `machine_downtime_sessions` + `production_entries` herhangi birinde değişiklik → `router.refresh()`. Anlık güncellenir.
- **Tamamlandı kart özeti**: yeni mavi şerit "Tamamlandı: X parça · Y fire · ⚙ Z dk ayar · ⏸ W dk duruş · tarih" — cross-shift toplam (user'ın "iş bittiğinde duruş süresi orada yazmalı" isteği).
- **machines/actions.ts** `updateMachineStatus` `revalidatePath('/jobs')` ekledi (Realtime'ın backup'ı).
- **JobsShell `activeDowntime` prop**: `v_machine_active_downtime` view'ından açık session'lar.

### Commit (Round 4 — bu turda) — RLS recursion fix
- **Migration 0032** (`messaging_rls_recursion_fix.sql`):
  - User mesaj silmeye çalışırken "infinite recursion detected in policy for relation conversation_participants" alıyordu.
  - Sebep: `is_conversation_participant` SECURITY DEFINER ama Supabase function owner BYPASSRLS değil → inner SELECT policy'i yine tetikliyor → recursion.
  - Çözüm: function'a `set row_security = off` eklendi (calendar 0021 ile aynı pattern).
  - Yeni `is_conversation_admin(conv_id, uid)` helper (admin kontrolü).
  - `delete participants` + `insert participants` policy'leri inline subquery yerine helper kullanıyor.

---

## Önceki commit (a3befa6 — 2026-04-30)

**İş akışı: auto-create üretim formu + cleanup time + takvim-bilinçli ETA + çalışma saatleri ayarı**

User isteği: "Üretime başla dediğimde üretim formu kendi oluşmalı. Ayar 20 dk, cycle 2 dk + temizlik (kapı açma + parça swap) 1 dk. Pzt-Cum 10 saat / 9 net, Cmt-Pzr bazen mesai. ETA hesabı bunlara uymalı."

### Migration 0029
- `products.cleanup_time_minutes` — operatör tarafı per-piece (kapı açma + parça koy/al + temizlik). `effective_cycle = cycle + cleanup`
- `production_entries.setup_minutes` — ayar dakikası ayrı kolon (downtime'dan ayrı)
- `app_settings (key text PK, value jsonb)` — generic settings store. `work_schedule` default seed (Pzt-Cum 540 dk + 60 dk yemek, Cmt-Pzr kapalı)
- `machine_timeline_entries.production_entry_id` — açık arıza bugünkü entry'ye linklenebilsin
- `production_entries` partial UNIQUE INDEX (machine, date, shift, job_id) — UPSERT-friendly auto-create

### Yeni hesap mantığı
```
effective_cycle = cycle + cleanup
remaining_total_min = ⌈remaining/pps⌉ × setup + remaining × effective_cycle
ETA = calcEtaCalendarAware(remaining, schedule, now)
       (yemek + hafta sonu + custom days bilen wall-clock walk)
```

### Yeni server actions
- `openTodayEntryForJob({machine, job, operator, shift?})` — bugünkü açık entry'yi bul/aç (UPSERT semantics partial unique index ile). `setJobStep`'in `ayar`/`uretimde` transition'ında otomatik çağrılır.
- `appendProduction({machine, job, produced, scrap, downtime, setup_minutes})` — bugünkü entry'ye additif (UPSERT idempotent)
- `closeShiftForMachine(machineId)` — bugünkü açık entry'leri `end_time` stamp ile kapat

### `/settings/work-hours` (admin-only)
- 7 günlük çizelge formu: Switch toggle + shift_start time input + work_minutes (net) + lunch_minutes
- Her gün ayrı kart, toplam vardiya hesabı + yemek rozet
- Haftalık net çalışma KPI üstte
- `saveWorkSchedule` action sanitize + upsert
- Yeni shadcn component: `components/ui/switch.tsx`
- `/settings` ana sayfasına link kart eklendi

### Job Card UI
- "Bugün" mini-stat satırı: parça/fire/ayar/duruş (sadece ayar/üretimde iken)
- Yeni butonlar: **+ Üretim** (modal — appendProduction), **Arıza** (/breakdowns linki), **Vardiya Kapat** (closeShiftForMachine)
- ETA artık `calcEtaCalendarAware` kullanıyor — yemek/hafta sonu skipping

### Product Form
- "Temizlik (dk)" alanı (manufacturing section)
- Hesap açıklama kutusu güncellendi: "Etkin cycle = cycle + temizlik" + "ETA çalışma çizelgesini bilir"

---

## Önceki commit (768607a — 2026-04-30)

**3 küçük düzeltme: mesaj silme + jobs alt alta + dashboard temizlik**

1. **Mesaj silme UI yansıması** — deleteMessage server'da `deleted_at` set ediyor, Realtime UPDATE event'i messages-client cache'ini güncelliyor. Ama websocket flaky olunca UI hiç güncellenmiyordu, kullanıcı "hata alıyorum" sanıyordu. Optimistic delete eklendi:
   - Chat-panel'de `optimisticDeletedIds: Set<string>` state
   - MessageBubble `onDelete`: önce optimistic mark (bubble hemen "Bu mesaj silindi"), sonra server action; hata olursa rollback
   - Sync `useEffect`: server prop deleted_at döndürünce Set'ten çıkar (drag-fix ile aynı race-free pattern)
   - `deleteMessage` success'inde `router.refresh()` (websocket drop olsa bile çekiyor)
   - Optimistic mesaj (id "temp_") silme engellendi: "Mesaj henüz gönderilmedi" toast

2. **Jobs layout single-column** — `grid-cols-1 lg:grid-cols-2` → `space-y-4`. Makineler alt alta, full-width.

3. **Dashboard temizlik** — "Stokta Azalan Takımlar" kartı kaldırıldı + toolsLow query/type/filter cleanup + Wrench/CardHeader/CardTitle gereksiz import'lar silindi. Dashboard sadece MachinesGrid gösteriyor.

---

## Önceki commit (b5a32d9 — 2026-04-30)

**Hot-fix: /jobs runtime error + ProductForm sections görünür**

### 1. `/jobs` runtime error
`'use client'` dosyada export edilen `computeJobsRange()` server component'ten çağrılamadı:
> Attempted to call computeJobsRange() from the server but computeJobsRange is on the client.

**Next.js App Router kuralı:** `'use client'` dosyasından sadece React component export edebilirsin; saf utility fonksiyonlar bile server'dan çağrılamaz. Çözüm: yeni dosya `app/(app)/jobs/jobs-range.ts` (NO 'use client'); `computeJobsRange` + `JobsPeriod` + `JobsRange` buraya taşındı. `date-range-filter.tsx` sadece type re-export ediyor. Memory: `feedback_use_client_export.md`.

### 2. ProductForm görünmüyordu
Sadece "Tanımlama" `defaultOpen` idi → kullanıcı **diğer 8 bölümün** açıldığından habersizdi (özellikle Takım Listesi). Hepsi `defaultOpen=true` yapıldı.

### 3. `/products/new` onboarding hint
"Kaydettikten sonra detay sayfasından eklenecekler" kartı eklendi: 4 tile (Görseller / Teknik Resim / CAD/CAM / Takımlar) + açıklama. Form save → `/products/[id]` redirect olunca kullanıcı tab'larda neyi nereye yükleyeceğini anında biliyor.

---

## Önceki commit (7c67fdb — 2026-04-30)

**İşler: makine bazlı kart grid + 4-step + tahmini bitiş + tarih filtresi**

User isteği: işlerde makine ayrımı, modern kartlar, 4 adımlı durum takibi, % bar, tahmini bitiş süresi, ürün master'da "kaç adet bağlanıyor", gün/hafta/ay/yıl/tüm + özel tarih aralığı.

### Migration 0028
- `job_status` enum'una **`ayar`** eklendi (beklemede ↔ uretimde arası)
- `jobs.started_at`, `jobs.setup_completed_at` — step indicator anchor'ları
- `products.parts_per_setup` — aynı bağlamada işlenen adet

### Hesap mantığı (calcJobTimeline helper, types.ts)

```
remaining = quantity - produced
setupsLeft = ceil(remaining / parts_per_setup)
remainingMinutes = setupsLeft × setup_time + remaining × cycle_time
ETA = now + remainingMinutes
```

Plus `formatMinutes()` ("2 sa 30 dk" / "1 g 4 sa") ve `JOB_STEPS` array, `jobStepIndex()` helper, `JOB_STATUS_TONE` 5-step renk paleti.

### 4 yeni component (jobs/)

1. **`date-range-filter.tsx`** — 5 preset (Bugün/Hafta/Ay/Yıl/Tümü) + Özel range (input[type=date] from→to). `computeJobsRange()` server+client share.
2. **`job-card.tsx`** — modern kart:
   - Top row: job_no + ürün kodu link + status badge + öncelik + Geç riski
   - **4-step progress**: yatay 4 bar (aktif animate-pulse, tamamlanmış emerald, bekleyen muted)
   - **4 KPI mini-stat**: Adet / Üretilen (%) / Kalan / Tahmini Bitiş + ETA tarihi
   - Progress bar 0-100% (gradient emerald)
   - **Timeline math line**: "Cycle: 5 dk · Ayar: 20 dk × 3 · Bağlama: 4 adet · Toplam: 8 sa 35 dk"
   - Bottom: due date + operatör avatar + primary action button (**Ayara Başla → Üretime Başla → Tamamla**)
3. **`machine-group.tsx`** — makine kart wrapper:
   - Header: status-renk ring border, ikon kutusu (Cog/Pause/Wrench/AlertOctagon)
   - Sayım: üretimde/ayar/beklemede + makine için toplam kalan süre
   - Body: işler status priority + created_at sırasıyla sorted
4. **`jobs-shell.tsx`** — orchestrator:
   - 5 KPI strip (Üretimde/Beklemede/Tamamlanan/Geç Riski/Toplam Kalan)
   - DateRangeFilter + Search input
   - Machine grouping (sidebar order) + "Atanmamış" group
   - URL sync (period/from/to query params)

### Server action

`setJobStep(jobId, step)` — status değişince `started_at` / `setup_completed_at` / `completed_at` otomatik stamp; `.select().maybeSingle()` defansif. JobCard'da "Ayara Başla → Üretime Başla → Tamamla" buton akışı.

### ProductForm güncellemesi
"Bağlanan Adet" alanı eklendi. "Setup Süresi → Ayar Süresi" rename + hint. Açıklayıcı dashed kutu: hesabın nasıl yapıldığını gösteriyor.

### Geriye uyum
Tüm `STATUS_VARIANT` / `STATUS_CLS` map'lere `ayar` fallback (jobs-table, machines/[id], products linked-jobs, product-quality-tab, quality/page). TypeScript exhaustiveness sağlandı.

---

## Önceki commit (7c65bd0 — 2026-04-30)

**Ürün detayı modernize: 7 tab full CRUD + modern hero + sticky tabs**

User isteği: ürün hakkında **her şey tek sayfada** — takım ekleme/silme/düzenleme, CAD ve teknik resim inline yükleme, kalite görünümü.

### Yeni tab'lar (4 yeni component, hepsi inline CRUD)

1. **Teknik Resim** (`product-drawings-tab.tsx`) — Yükle dialog'undan PDF/görsel atılır (`uploadDrawing` action'a `product_id` pre-fill). Hover'da İndir + Sil. Empty state büyük dashed-border CTA.
2. **CAD/CAM** (`product-cad-tab.tsx`) — Aynı pattern, dialog'da makine de seçilebilir. kindKey rengine göre ikon kutusu (G-code yeşil / CAD mavi).
3. **Takımlar** (`product-tools-tab.tsx`) — **Full CRUD inline:** thumbnail + ad + adet input (onBlur'da kayıt) + Sil. Yeni server actions: `addProductTool`, `removeProductTool`, `updateProductToolQty` (`.select().maybeSingle()` defansif). Picker dialog'unda arama + checkbox + selected badge.
4. **Kalite** (`product-quality-tab.tsx`) — Bu üründen açılan işlerin `quality_specs` + `quality_measurements` aggregation. 4 KPI strip (Spec / Ölçüm / OK% / NOK) + iş bazında detay tablosu, `/quality/[jobId]`'ye link.

### Modern hero (page.tsx redesign)

- Full-width gradient hero (`from-primary/5` + radial highlight)
- Sol: 256px aspect-square hero görsel + "+N görsel" overlay
- Sağ: kod chip + rev/durum badge + 3xl başlık + müşteri/parça no
- Quick stats: 8 alan (kategori/malzeme/boyut/ağırlık/tolerans/sertlik/proses/fiyat) — backdrop-blur kartlar
- Meta strip: makine + cycle time + yüzey işlemi + tags

### Sticky tabs

`TabsList` sticky top-0 backdrop-blur. 7 tab: Bilgiler · Görseller · Teknik Resim · CAD/CAM · Takımlar · Kalite · İşler — her birinde count badge.

### Defansif

- Tool CRUD actions `.select().maybeSingle()` (silent RLS trap)
- `onConflict: "product_id,tool_id"` upsert ile idempotent add

---

## Önceki commit (111e871 — 2026-04-30)

**Ürün master kütüğü: ayrı sayfa + kapsamlı detay (popup kaldırıldı)**

Önceki popup ProductDialog yetersizdi (kullanıcı "aşırı kapsamlı bir ürün ekleme alanı" istedi). Manufacturing master data seviyesinde tam kütük kuruldu.

### Yeni sayfa yapısı
- **`/products`** — liste (kapak görsel + kod + ad + kategori + müşteri + malzeme + durum + takım sayısı kolonları)
- **`/products/new`** — ayrı oluşturma sayfası (ProductForm)
- **`/products/[id]`** — detay sayfası: hero card + 6 tab (Bilgiler · Görseller · Teknik Resimler · CAD/CAM · Takımlar · İşler)

### Migration 0027 — products tablosu büyütüldü
- 3 enum: `product_status` (aktif/taslak/pasif), `product_process` (tornalama/frezeleme/kombinasyon/taşlama/erozyon/lazer/diğer), `product_currency` (TRY/USD/EUR)
- 24 yeni kolon (kategori, müşteri parça no, çizim ref, status, revision, tags, malzeme, yüzey/ısıl işlem, sertlik, boyutlar 5 alan, tolerans, Ra, proses, makine FK, setup/cycle time, min sipariş, fiyat, currency)
- `product_images` tablosu (multi-image gallery, primary unique partial index)
- `product-images` public storage bucket + 4 RLS policy (select/insert/update/delete)
- Realtime publication eklendi

### Yeni component'ler

**`ProductForm`** (`product-form.tsx`) — 9 collapsible bölüm:
1. Tanımlama, 2. Sınıflandırma, 3. Malzeme & Yüzey, 4. Boyutlar, 5. İmalat, 6. Ticari, 7. Takım Listesi, 8. Notlar
- ComboBox (Input + datalist) preset autocomplete; SSR-safe (datalist id useRef + post-mount stamping)
- Sticky Save/İptal footer
- Tek form hem create hem edit; create sonrası `/products/[id]`'ye redirect

**`ProductImageGallery`** — multi-upload, drag-drop, primary toggle, delete, hover overlay actions, animate-pulse loading

### Detay sayfası tabları
- **Bilgiler** — ProductForm in-place edit
- **Görseller** — ImageGallery (multi-image)
- **Teknik Resimler** / **CAD/CAM** — `drawings` / `cad_programs` tabloları product_id ile filtrelenir; "+" buton sayfaya `?product=<id>` ile atlatır
- **Takımlar** — read-only liste
- **İşler** — bu üründen açılmış jobs tablosu

### Kaldırıldı
`product-dialog.tsx` — popup completely removed. Tüm "Düzenle" / "Yeni" tıklamaları artık page navigation.

### Defansif
`saveProduct` + `deleteProduct` `.select().maybeSingle()` ile 0-row fallback (Supabase silent RLS trap pattern).

### Pattern öğrenmesi
`PageHeader.description: string → ReactNode` — Badge/span karma description için type genişletildi. Bu pattern detail sayfaları için tekrar kullanılabilir.

---

## Önceki commit (9715b10 — 2026-04-30)

**Mesajlar: konuşma sil + yazar info popover + jitter fix + loading skeleton**

4 UX iyileştirmesi:

1. **Konuşma satırı hover'da "Sil" butonu** — Pin/Archive yanına kırmızı çöp kutusu. `leaveConversation` çağırır → kullanıcı `conversation_participants`'tan çıkar, listeden düşer. Confirm + toast.

2. **Mesaj yazarı info popover** — Avatar / isim hover'da 200ms sonra açılan HoverCard: ad, telefon, online/last-seen. Yeni `components/ui/hover-card.tsx` (Radix HoverCard sarmalı) — gelecekteki tüm hover-tooltip'lar için reusable.

3. **Scroll jitter kalıcı fix** — Geçen turda `useEffect + requestAnimationFrame` denemiştim ama rAF paint'ten SONRA çalışıyor → kullanıcı bir frame için scroll-üstte yeni mesaj listesini görüp sonra alta atılmayı izliyordu (raporlanan "yukarı gidip alta dönüyor" titreme). Çözüm: `useLayoutEffect` (synchronous, paint'ten ÖNCE). Tek effect, 3 kural (conv switch instant / kendi gönderdiğim instant / dipte ise smooth). rAF tamamen kaldırıldı.

4. **Konuşma değişiminde loading skeleton** — sidebar navigation loading'i ile aynı UX. `messages-client.tsx`'te `loadingConvIds: Set<string>` state'i (`fetchConversationDetail` başlangıç/bitişinde update). ChatPanel `isLoading` prop'u + `<FeedSkeleton />` (6 placeholder bubble, animate-pulse). Boş white pane flash'ı yok.

---

## Önceki commit (ff6dfa9 — 2026-04-30)

**Mesajlar: scroll davranışı + silme UX + defansif delete action**

3 messaging UX bug'ı düzeltildi:

1. **Scroll konuşma geçişinde pozisyonda kalıyordu.** Eski kod `useEffect([messages.length])` ile tetikleniyordu — yeni konuşma aynı sayıdaysa scroll tetiklenmiyordu. Yeni mantık:
   - Konuşma id değişince **INSTANT** jump-to-bottom (rAF içinde, animasyon yok)
   - Yeni mesaj gelirse, kullanıcı zaten dipte ise smooth scroll; yukarı kaydırmışsa pozisyonu bırak (120px tolerance, `atBottomRef` ile takip ediliyor)
   - Optimistic mesaj eklenince (kendi gönderdim) **her zaman** dibe kaydır
   - `onScroll` handler `atBottomRef`'i günceller

2. **Mesaj silme görünmüyor sanılıyordu.** Trigger `bg-background/70 + opacity-70` ile çok soluktu. Şimdi tam opak `bg-background` + border + shadow + hover'da primary ring. Title'a da "yanıtla, düzenle, sil" eklendi. Mesaj silme aslında zaten vardı (kendi mesajının yanındaki üç-nokta menüsünde) sadece keşfedilebilir değildi.

3. **`deleteMessage` defansif** — `.select("id").maybeSingle()` ile affected row kontrol. RLS reddederse veya yanlış id ise sessiz success yerine açık hata ("Bu mesaj silinemedi"). Tasks fix'iyle aynı pattern (Supabase silent RLS trap).

---

## Önceki commit (3719b56 — 2026-04-30)

**Hydration kalıcı fix: MessageNotifier localStorage useState init**

`454639e`'de dialog initializer'larındaki `Math.random` + `new Date`'leri düzelttik — ama hydration error /products'ta tekrar çıktı. **Asıl kök neden bu değildi:** topbar'da mount edilen `components/app/message-notifier.tsx` `useState` lazy initializer'ı doğrudan localStorage okuyordu:

```tsx
// ❌ HATALI
const [enabled, setEnabled] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
});
```

Server'da `window` yok → `enabled=false` → BellOff render. Client'ta localStorage "1" ise → `enabled=true` → Bell render. **İkon farklı = React tree shape farklı → useId() offset → ardından mount edilen TÜM Radix Dialog trigger'larında `aria-controls` mismatch.**

MessageNotifier topbar'da, topbar (app)/layout.tsx'te → her sayfada mount → her sayfada hydration error tetikleniyordu. Bu yüzden /orders'ta ve /products'ta aynı semptom çıkıyordu.

**Fix:** `useState(false)` ile başla (server ile birebir aynı), `useEffect` içinde localStorage oku + setEnabled. Standart deferred hydration. İlk frame'de BellOff görünür, sonra duruma sıçrar — ama hydration başarılı.

**Önemli ders:** Sadece dialog/form içlerini değil, **global mount edilen component'lerin** initial state'lerini de SSR-safe yap. Aksi halde bir component'teki tek bir hydration mismatch alttaki TÜM dialog'ları kırar.

---

## Önceki commit (454639e — 2026-04-30)

**Dialog'larda Math.random + new Date hydration fix**

User /orders'da hydration error aldı: `aria-controls` farkı. Kök neden — `'use client'` component Next.js App Router'da hem server'da (SSR) hem client'ta (hydration) render olur, `useState` initializer her iki render'da çalışır. `Math.random()` ve `new Date()` initializer içinde çağrılınca server/client farklı değer üretir → React tree ayrışır → `useId()` farklı id döndürür → aria mismatch.

**Düzeltilen:**
- `orders/order-dialog.tsx` — `rowKey()` Math.random'dan `useRef` counter'a; `orderDate` `useEffect` post-mount backfill
- `production/entry-dialog.tsx` — `today` post-mount backfill
- `production/multi-entry-dialog.tsx` — row `_key` counter ref, `entryDate` post-mount backfill, `reset()` aynı disipline uydu

**Pattern (gelecekte yeni dialog yazarken):** Client component `useState` initializer'larında non-deterministic değer (Math.random, Date.now, new Date, crypto.randomUUID) çağırma. Stabil seed (counter ref ya da prop'taki id) kullan; gerçekten bir tarih veya rastgelelik gerekiyorsa boş başlat + `useEffect` ile mount sonrası doldur. Memory'de `feedback_ssr_useState_init.md`.

---

## Önceki commit (a64d5be — 2026-04-30)

**Tasks: yeni görev oluşturma artık ANINDA görünüyor (optimistic insert)**

Önceden "Oluştur" tıklayınca dialog kapanıyor → server roundtrip → router.refresh → ~500-800ms sonra kart görünüyordu ("düşmüyor" hissi). Optimistic insert + race-free reconciliation eklendi:

1. **TaskDialog** "Oluştur"a basınca client-side temp Task üretiyor (`id="temp-…"`, form değerleri, `created_at=now`). `onOptimisticCreate()` ile shell'e veriyor, dialog ANINDA kapanıyor. Server `saveTask` arka planda fire-and-forget.
2. **TasksShell** `pendingCreates: Task[]` state'i, `tasksWithOverride` memo'sunda `livePending` olarak server tasks'ın başına ekleniyor → kart o anda kolonda görünüyor.
3. **Resolve** — server başarılı dönünce dialog `onOptimisticResolve(tempId, realId)` çağırıyor, shell mapping'i tutuyor, `router.refresh`.
4. **Sync effect** (`tasks` prop değişince) — pendingCreates'i tarar, resolved temp için real id artık server'da varsa temp row'u bırakır. Status-override sync ile aynı pattern, race-condition free.
5. **Reject** — server hata dönerse `onOptimisticReject(tempId)` → temp row hemen silinir, toast.error.
6. Temp row görsel olarak farklı: `ring-2 ring-primary/40` pulse, drag ve click disabled.

---

## Önceki commit (5ad5961 — 2026-04-30)

**Tasks drag-drop kalıcı fix: RLS gevşetme + server-data sync override**

Önceki "drag revert" fix (commit f82e9b2) yeterli değildi. **Asıl kök neden:** `tasks_update` RLS policy `(created_by = auth.uid()) OR (assigned_to = auth.uid())` ile sınırlıydı. **Supabase JS RLS-bloklu update'lerde hata fırlatmıyor** — 0 row etkiler ama `error: null, success: true` döner. Yani:

1. User başkasının task'ını sürükler → optimistic UI kartı taşır
2. `setTaskStatus` çağrılır → DB write 0 row affects (RLS reddeder)
3. Action `{ success: true }` döner (sessiz başarısızlık!)
4. `router.refresh` server'dan ESKI status'u çeker
5. Sync effect: server eski + override yeni → eşit değil → override KALIR
6. Kart yeni kolonda görünür ama DB'de değişmedi → bir sonraki refresh'te geri zıplar

**Düzeltmeler:**

1. **Migration 0026** — tasks/task_checklist/task_comments UPDATE+DELETE policy'leri `using(true) with check(true)`. CLAUDE.md zaten "small team, generous policy" diyor; suppliers/products gibi diğer modüllerle hizalandı.
2. **`setTaskStatus` defansif** — `.select("id").maybeSingle()` ile affected row kontrol. 0 row ise açık hata: `"Görev güncellenemedi (yetki yok ya da silindi)"`. Sessiz başarısızlık imkânsız.
3. **Override sync stratejisi (race-free)** — Önceki kod `setTimeout(1500ms)` ile override siliyor, network yavaşsa override zamansız temizleniyordu → kart geri zıplıyordu. Yeni yaklaşım: `useEffect([tasks])` server prop'u izler, server status override status'una EŞİTSE override'ı sil. Timing değil, mutation propagation'a bağlı. Hiçbir koşulda race olmaz.
4. **Pending visual feedback** — Kayıt halindeki kartta `ring-2 ring-primary/40` pulse. Kullanıcı drag bittiği gibi feedback alır.
5. **Realtime debouncer 250→80ms** — Cascading update'leri hâlâ batch'liyor ama UI çok daha responsive.

---

## Önceki commit (f82e9b2 — 2026-04-30)

**Hydration + drag revert + dialog form wipe bug fix**

3 kritik bug düzeltildi:

1. **Calendar hydration error** — `<button>` içinde `<button>` (gün hücresi içinde EventChip) HTML nested button kuralını ihlal ediyordu. Dış element `<div role="button" tabIndex={0}>` + keyboard handler'a çevrildi. Console'da hydration mismatch çıkıyordu.

2. **Tasks kanban drag-drop revert** — Kart sürükleyip bırakınca eski kolona snap back atıyordu. Sebep: optimistic `statusOverrides` 1500ms sonra temizleniyor ama `router.refresh()` açıkça çağrılmıyordu. `revalidatePath` server'da cache'i invalidate ediyor ama client'ı zorla refetch'e yönlendirmiyor; Realtime websocket flaky olabilir → override silindiğinde server tasks hâlâ eski. Çözüm: `setTaskStatus` success callback'inde `router.refresh()` eklendi.

3. **Product dialog form input wipe** — Yeni ürün eklerken form alanlarına yazılan değerler kayboluyordu. Sebep: `useEffect([open, product, existingTools])` deps'te `existingTools` array ref'i parent her render'da değişiyordu (filter yeni array dönüyor) → router.refresh / Realtime parent rerender'ı effect'i tekrar tetikliyordu, init kodu state'i sıfırlıyordu. Çözüm: `wasOpenRef` ile init'i `open: false → true` transition'a sabitledik.

---

## Önceki commit (882781e — 2026-04-30)

**Build düzeltme + bulk select tüm liste sayfalarına + ürün filtresi**

Bu turda yapılanlar:

### 1. Build hatası kök neden (Next 16'da yeni davranış)
Önceki commit (770f010) production'da Vercel build'i kırmıştı. SWC hatası `"use client" must be placed before other expressions` çıkıyordu — yanıltıcıydı. Gerçek sebep:

> Next 16'da **client component** içinde inline `"use server"` arrow function tanımlanamaz. Eskiden çalışan `<DeleteButton action={async () => { "use server"; return deleteX(id); }} />` artık SWC'yi vuruyor.

`deleteX` zaten ayrı `actions.ts` dosyasında `"use server"` ile export edildiği için doğrudan çağırmak yeterli: `action={() => deleteX(id)}`. Tüm liste sayfalarında uygulandı.

### 2. Bulk select tüm liste sayfalarına yayıldı (6 sayfa)
- **Yeni dosyalar:** `suppliers-table.tsx`, `jobs-table.tsx`, `orders-table.tsx`, `products-table.tsx` (operators ve tools zaten vardı)
- Her sayfa: server `page.tsx` (veri çek) + client `*-table.tsx` (checkbox + sticky `BulkActionsBar`)
- Shift+click range, "Tümünü seç", canlı sayaç + Türkçe `itemLabel`
- Server actions: `bulkDeleteSuppliers`, `bulkDeleteJobs`, `bulkDeleteOrders`, `bulkDeleteProducts` (zaten yazılmıştı, sadece UI bağlandı)

### 3. Ürün filtresi — Drawings + CAD/CAM
- **Yeni component:** `components/app/product-filter.tsx` — URL-driven dropdown (`?product=<id>`), generic, başka modüllerde de kullanılabilir
- `Drawing` ve `CadProgram` TypeScript tiplerine `product_id: string | null` eklendi (DB'de migration 0025'te zaten vardı, type'larda eksikti)
- Page'ler `searchParams.product`'ı okuyor → Supabase `.eq("product_id", id)` ile filtreliyor

### 4. Multi-entry'de ürün picker EKLENMEDİ
Bilinçli karar: her job zaten `product_id`'ye bağlı. Multi-entry dialog'unda iş seçince ürün otomatik gelir, satır başına ürün picker over-engineering olur.

Önceki commit'lerin özeti için `git log --oneline` ya da memory'deki `project_tgteknikcrm.md`.

---

## Bekleyen / Geliştirilebilir

- [x] ~~Vercel deploy~~ — ✅ canlı (2026-04-28): https://tgteknikcrm1.vercel.app
- [ ] Vercel'e `SUPABASE_SERVICE_ROLE_KEY` env eklenmeli (admin Ayarlar sayfası için)
- [ ] Supabase Auth → URL Configuration: Site URL + Redirect URLs (Vercel domain'i tanıt)
- [ ] Supabase Dashboard → Leaked Password Protection açma
- [ ] Tools sayfasında bir takıma tıklayıp → direkt o takım için sipariş oluşturma akışı (şu an defaultCategory=takim ile boş dialog açılıyor)
- [ ] Dashboard makine kartları henüz `machine_shift_assignments`'tan okumuyor — production_entries'teki operatöre bakıyor. İstenirse shift assignment da gösterilebilir
- [ ] PDF annotation (pdf.js) — user istemişti ama öncelik vermedi
- [ ] Dashboard "Eksik Takım" ve "Vardiya Özeti" kartları modern redesign'a çekilmedi
- [ ] Dashboard'a "Kalite" mini widget (bugün ölçülen, NOK oranı, son NOK)
- [ ] Drawings annotation balon numaralarını → quality_specs.bubble_no ile bağla (tıklayınca spec'e atla)
- [ ] Cp/Cpk istatistiksel proses yeteneği (kalite raporunda)
- [ ] Yeni takım eklerken aynı dialog'da resim yükleme (şu an önce kaydetmek gerekiyor)
- [ ] Search FAB sonuçlarında takım küçük thumb'ı gösterimi
- [ ] Dark mode toggle (sistem teması destekleniyor ama manuel toggle yok)
- [ ] Test suite (vitest + playwright)

---

## Kullanıcı Bilgileri (hafıza)

- **Dostum** diye hitap eder, samimi ton ister
- Sürekli yes/no onayından rahatsız olur — bir kere onay, akış bitene kadar durma
- "Detaylı düşün planla yap" modunda iş verir — büyük feature'ları bir seferde isteyebilir
- GitHub + Vercel + Supabase hesapları `tgteknikcrm@outlook.com` e-postası altında
- Uygulamaya telefon `+90 542 646 90 70` + parola `80148014` ile giriyor
- İzinler `.claude/settings.local.json`'da kurulu (acceptEdits default, geniş Bash allow list)
- Supabase MCP bağlı — apply_migration / execute_sql / get_advisors kullanılıyor
