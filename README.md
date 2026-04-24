# TG Teknik — Üretim Takip Sistemi

TG Teknik atölyesinin 4 CNC tezgahı için web tabanlı, mobil uyumlu (PWA) üretim takip uygulaması.

## Özellikler

- **Dashboard** · bugünkü üretim, makine durumu, eksik takım uyarısı
- **Üretim Formları** · günlük vardiya bazlı kayıt
- **İşler / Siparişler** · müşteri, parça, makine+operatör atama, teslim takibi
- **Makineler** · Fanuc, Tekna-1, Tekna-2, BWX — durum + geçmiş
- **Operatörler** · CRUD, vardiya
- **Takım Listesi** · envanter, stok uyarısı, arama
- **Teknik Resimler** · PDF/görsel upload (Supabase Storage)
- **Raporlar** · tarih filtresi, makine özeti, Excel export
- **PWA** · mobilde "Ana Ekrana Ekle"

## Teknoloji

- Next.js 16 (App Router, Turbopack) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Supabase (PostgreSQL + Auth + Storage)
- GitHub + Vercel (otomatik deploy)

## Kurulum

```bash
# 1. Supabase proje aç, SQL Editor'de çalıştır:
#    supabase/migrations/0001_init.sql

# 2. .env.local oluştur (.env.example'dan kopyala)
cp .env.example .env.local
# ve Supabase anahtarlarını yaz

# 3. Çalıştır
npm install
npm run dev
# http://localhost:3000
```

İlk kez `tgteknikcrm@outlook.com` ile kayıt olursan otomatik admin olursun.

## Komutlar

```bash
npm run dev        # Geliştirme sunucusu
npm run build      # Üretim build
npm run typecheck  # TypeScript kontrol
npm run lint       # ESLint
```

## Deploy (Vercel)

1. GitHub'a push et
2. vercel.com → New Project → repo'yu seç
3. Environment Variables'a Supabase anahtarlarını gir
4. Deploy — her git push sonrası otomatik yenilenir

Detaylı dokümantasyon: [CLAUDE.md](./CLAUDE.md)
