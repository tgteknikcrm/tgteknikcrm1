# TG Teknik — Üretim Takip Sistemi

**Proje sahibi:** TG Teknik (imalat atölyesi) · Admin e-posta: `tgteknikcrm@outlook.com`
**Proje dili:** Türkçe (UI), kod İngilizce
**İletişim:** Samimi Türkçe ton (kullanıcı "dostum" diye hitap ediyor). Her küçük adımda yes/no sorma — akışı kes, tek onay al, bitir.

---

## Ne Yapar Bu Uygulama?

TG Teknik atölyesi için **web tabanlı PWA** — masaüstünden ve mobilden açılabilen üretim takip sistemi.

**Atölye:** 4 CNC tezgah — **Fanuc, Tekna-1, Tekna-2, BWX**.

**Ana işlevler:**
1. **Dashboard** — günlük üretim özeti, makine durumu, eksik takım uyarısı
2. **Üretim Formları** — günlük vardiya bazlı üretim kayıtları (ana iş akışı)
3. **İşler/Siparişler** — müşteri, parça, adet, teslim tarihi, makine+operatör atama
4. **Makineler** — 4 makinenin durumu + geçmiş üretim
5. **Operatörler** — CRUD, vardiya ataması
6. **Takım Listesi** — takım envanteri (kod, ölçü, stok, durum) + arama
7. **Teknik Resimler** — PDF/görsel upload, Supabase Storage
8. **Raporlar** — tarih aralığı filtresi, makine bazlı özet, **Excel export**
9. **Ayarlar** (admin) — kullanıcı rol yönetimi
10. **PWA** — "Ana Ekrana Ekle" ile mobilde native gibi çalışır

---

## Teknoloji Yığını (Tech Stack)

| Katman | Teknoloji |
|---|---|
| Framework | **Next.js 16.2.4** (App Router, TypeScript, **Turbopack**) |
| UI | **Tailwind CSS v4** (`@theme inline` syntax) + **shadcn/ui "new-york"** |
| Database | **Supabase** (PostgreSQL + RLS + Storage + Auth) |
| Client | `@supabase/supabase-js` + `@supabase/ssr` |
| Forms | react-hook-form + zod |
| Icons | lucide-react |
| Charts | recharts (şu an minimal kullanım) |
| Excel | xlsx (client-side dynamic import) |
| Toast | sonner |
| PWA | Next.js built-in (app/manifest.ts + app/icon.tsx) |
| Deployment | GitHub → **Vercel** (otomatik deploy) |

### ⚠️ Önemli Next.js 16 Özellikleri

- **Turbopack varsayılan** — webpack kullanan eklentiler (`@ducanh2912/next-pwa` gibi) çatışır
- **`middleware.ts` deprecated** → **`proxy.ts`** kullanıyoruz (fonksiyon adı: `proxy`)
- `cookies()`, `params`, `searchParams` hepsi **Promise** — `await` gerekir
- `next/og` built-in → dinamik PWA ikonları için `app/icon.tsx` kullanıyoruz

---

## Klasör Yapısı

```
tgteknikcrm/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx          → ortalanmış auth layout
│   │   └── login/
│   │       ├── page.tsx        → LoginForm sayfası
│   │       ├── login-form.tsx  → client form (Tabs: Giriş/Kayıt)
│   │       └── actions.ts      → signIn, signUp, signOut (server actions)
│   ├── (app)/
│   │   ├── layout.tsx          → sidebar + topbar (auth gerektirir)
│   │   ├── dashboard/page.tsx  → KPI'lar + makine durumu + eksik takım
│   │   ├── machines/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/page.tsx   → detay + son 30 üretim
│   │   │   ├── machine-dialog.tsx (client)
│   │   │   └── actions.ts
│   │   ├── operators/
│   │   │   ├── page.tsx
│   │   │   ├── operator-dialog.tsx
│   │   │   ├── delete-button.tsx → generic silme butonu
│   │   │   └── actions.ts
│   │   ├── tools/ (takım listesi, arama destekli)
│   │   ├── jobs/ (iş/siparişler, status filtresi)
│   │   ├── production/ (günlük üretim formları — ana modül)
│   │   ├── drawings/
│   │   │   ├── page.tsx
│   │   │   ├── upload-dialog.tsx
│   │   │   ├── drawing-actions.tsx  (View, Download, Delete butonları)
│   │   │   └── actions.ts      → uploadDrawing, deleteDrawing, getSignedUrl
│   │   ├── reports/
│   │   │   ├── page.tsx        → tarih filtresi + 3 kart özet + tablo
│   │   │   └── export-button.tsx  → xlsx client-side export
│   │   └── settings/           → admin only (RLS hem DB hem UI)
│   ├── layout.tsx              → root (font, toaster, viewport, theme)
│   ├── page.tsx                → redirect('/dashboard')
│   ├── manifest.ts             → PWA manifest (dinamik)
│   ├── icon.tsx                → 512x512 PWA icon (ImageResponse)
│   ├── apple-icon.tsx          → 180x180 iOS icon
│   └── globals.css             → Tailwind v4 tema değişkenleri + shadcn
├── components/
│   ├── ui/                     → shadcn bileşenleri (Button, Card, Table, Dialog, Sheet, Select, Textarea, Form, Tabs, Badge, Avatar, Checkbox, Dropdown, Separator, Skeleton, Sonner, Input, Label)
│   └── app/
│       ├── sidebar.tsx         → nav (masaüstü + mobil Sheet)
│       ├── topbar.tsx          → kullanıcı menüsü + mobil hamburger
│       ├── nav-config.ts       → nav item listesi (icon + href)
│       ├── page-header.tsx     → ortak sayfa başlığı
│       ├── empty-state.tsx     → boş liste görseli
│       └── search-input.tsx    → debounced URL query param search
├── lib/
│   ├── supabase/
│   │   ├── client.ts           → browser (createBrowserClient)
│   │   ├── server.ts           → server (cookies(), getUser, getProfile, requireUser)
│   │   ├── middleware.ts       → updateSession (proxy'de çağrılır)
│   │   └── types.ts            → Profile, Machine, Operator, Tool, Job, ProductionEntry, Drawing + label maps
│   └── utils.ts                → cn(), formatDate(), formatDateTime()
├── supabase/
│   └── migrations/
│       └── 0001_init.sql       → TÜM şema + RLS + seed (4 makine) + storage bucket
├── public/                     → statik varlıklar (henüz manuel ikon yok — dinamik)
├── proxy.ts                    → Next.js 16 proxy (eski middleware.ts)
├── next.config.ts              → bodySizeLimit: 25mb (teknik resim upload)
├── components.json             → shadcn config (new-york, slate, @/lib/utils)
├── tsconfig.json               → strict, paths: @/* → ./*
├── .env.local                  → gerçek Supabase credentials (gitignore)
├── .env.example                → şablon (git'e girer)
└── CLAUDE.md                   → bu dosya
```

---

## Veritabanı Şeması

### Tablolar (public schema)

| Tablo | Ana alanlar |
|---|---|
| `profiles` | id (auth.users FK), email, full_name, **role** (admin/operator), active |
| `machines` | name (unique), type (Fanuc/Tekna/BWX/Diger), status (aktif/durus/bakim/ariza), model, serial_no, location |
| `operators` | full_name, employee_no, phone, shift (sabah/aksam/gece), active |
| `tools` | code, name, type, size, material, location, quantity, min_quantity, condition (yeni/iyi/kullanilabilir/degistirilmeli), supplier, price |
| `jobs` | job_no, customer, part_name, part_no, quantity, machine_id, operator_id, status (beklemede/uretimde/tamamlandi/iptal), priority, start_date, due_date |
| `production_entries` | entry_date, shift, machine_id, operator_id, job_id, start_time, end_time, **produced_qty**, **scrap_qty**, **downtime_minutes**, notes |
| `drawings` | job_id, title, **file_path** (storage), file_type, file_size, revision |
| `job_tools` | many-to-many (job_id, tool_id, quantity_used) |

### Enums

- `user_role`: admin | operator
- `machine_type`: Fanuc | Tekna | BWX | Diger
- `machine_status`: aktif | durus | bakim | ariza
- `shift`: sabah | aksam | gece
- `job_status`: beklemede | uretimde | tamamlandi | iptal
- `tool_condition`: yeni | iyi | kullanilabilir | degistirilmeli

### RLS (Row Level Security)

- `is_admin()` helper fonksiyonu: kullanıcı role='admin' mi?
- Profiles: kendi kaydını oku/yaz veya admin her şeyi yapar
- Diğer tablolar: authenticated kullanıcı read + insert + update, admin delete
- Storage `drawings` bucket: authenticated read/upload/update, admin delete
- Trigger `on_auth_user_created`: yeni kayıtta profil oluşturur. E-posta `tgteknikcrm@outlook.com` → otomatik admin.

### Storage

- Bucket: **`drawings`** (private)
- Path: `${user_id}/${timestamp}_${sanitized_filename}`
- Maks dosya: Supabase free tier'da 50MB/dosya, 1GB toplam (next.config'de serverActions bodyLimit 25MB)
- Erişim: `createSignedUrl(path, 600)` → 10 dakikalık signed URL

---

## Kurulum / Deploy

### 1. Supabase Proje Açma

1. https://app.supabase.com → **New Project**
2. İsim: `tgteknikcrm`, parola gir, bölge `Europe (Frankfurt)` öner
3. Proje açıldıktan sonra **Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (GİZLİ)

### 2. Migration Çalıştırma

Supabase **SQL Editor** → "New query" → `supabase/migrations/0001_init.sql` içeriğini yapıştır → **Run**.

Bu komutla:
- Tüm tablolar oluşur
- RLS policy'leri aktif olur
- 4 makine seed edilir (Fanuc, Tekna 1, Tekna 2, BWX)
- `drawings` storage bucket'ı oluşur
- `on_auth_user_created` trigger kurulur

### 3. Local Geliştirme

```bash
# .env.local dosyasını düzenle (Supabase anahtarlarını yaz)
npm install
npm run dev
# http://localhost:3000
```

İlk kayıt `tgteknikcrm@outlook.com` e-postası ile yapılırsa otomatik admin olur.

### 4. GitHub + Vercel Deploy

1. GitHub'da **private** repo aç: `tgteknikcrm`
2. Local:
   ```bash
   git init
   git add .
   git commit -m "Initial: TG Teknik Üretim Takip"
   git remote add origin git@github.com:USER/tgteknikcrm.git
   git push -u origin main
   ```
3. https://vercel.com → **New Project** → GitHub repo'yu import et
4. Vercel **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. **Deploy** — birkaç dk sonra `https://tgteknikcrm.vercel.app` canlı
6. Sonraki `git push`'larda Vercel otomatik yeni versiyon yayınlar

---

## Geliştirme Notları

### Yeni modül eklemek için pattern

1. `app/(app)/X/` klasörü aç
2. `actions.ts` — server actions (`"use server"`)
3. `X-dialog.tsx` — client dialog (oluşturma/düzenleme)
4. `page.tsx` — Server Component, Supabase'den veri çeker, try/catch
5. Nav'a eklemek için `components/app/nav-config.ts` güncelle

### Server Action + Client Component pattern

Silme butonu gibi client component'lar için inline server action şablonu:

```tsx
<DeleteButton
  action={async () => {
    "use server";
    return deleteX(id);
  }}
/>
```

### Supabase client kullanımı

- **Server Component:** `const supabase = await createClient()` (lib/supabase/server)
- **Client Component:** `const supabase = createClient()` (lib/supabase/client)
- **Server Action:** `const supabase = await createClient()` — cookies otomatik

### Auth koruması

- `proxy.ts` — tüm routeları guardlar, `/login`'a yönlendirir
- `(app)/layout.tsx` — ayrıca `getProfile()` çağırır, yoksa redirect
- Admin-only: `if (profile.role !== "admin") redirect("/dashboard")`

### Çalıştırma komutları

```bash
npm run dev         # dev server (Turbopack)
npm run build       # production build
npm run start       # production server
npm run typecheck   # TypeScript kontrolü
npm run lint        # ESLint
```

---

## Bilinen Durumlar / TODO

- [ ] **Supabase gerçek creds** kullanıcı tarafından girilecek → `.env.local`'de placeholder şu an
- [ ] Dashboard'da recharts ile haftalık üretim grafiği eklenebilir (şu an sadece KPI'lar)
- [ ] Bildirim sistemi (stok azalınca, iş gecikince)
- [ ] İş detay sayfası (production_entries ilişkili liste + drawings)
- [ ] Offline mod (service worker) — şu an sadece installable, offline yok
- [ ] Dark mode toggle (sistem teması zaten destekleniyor)
- [ ] Vercel Analytics entegrasyonu
- [ ] Test suite (vitest + playwright önerilir)

---

## Kullanıcı Bilgileri (hafıza)

- Kullanıcı bir **imalat işletmesi** işletiyor, Türkçe iletişim kuruyor
- "Dostum" diye hitap eder, samimi ton ister
- Sürekli yes/no onayından rahatsız olur — bir kere onay, akış bitene kadar durma
- GitHub + Vercel + Supabase hesapları `tgteknikcrm@outlook.com` e-postası altında
- İzinler `.claude/settings.local.json`'da kurulu (acceptEdits default, geniş Bash allow list, PowerShell ile elle oluşturuldu 2026-04-24)
