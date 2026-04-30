# R2 + Cloudflare Worker — Kurulum Adımları

Mesaj eki/resim teslimini Cloudflare R2 + Worker üzerinden yapmak için **sadece bu dosyayı** takip et. Kod tarafı zaten hazır; sen 6 manuel adım yapacaksın, ben her şeyi otomatize ettim.

> **NOT (önemli)**: Bu sistemin çalışması için **kendi domain'in olması ve hem Vercel'in hem Worker'ın aynı parent domain altında olması** lazım. `vercel.app` üzerinden çalışmaz çünkü cookie cross-domain bridge'i kurulamaz.
>
> Örn:
> - `tgteknik.com.tr` → Vercel
> - `cdn.tgteknik.com.tr` → Worker
> - Cookie `Domain=.tgteknik.com.tr` → her ikisi de okur

Domain'in yoksa **Adım 0**'ı yap.

---

## 0) Domain (yoksa)

1. **Bir domain al** (Cloudflare Registrar, Namecheap, GoDaddy — herhangi)
2. Cloudflare Dashboard → **Add a Site** → domain'i ekle, **Free plan** seç
3. Cloudflare verdiği 2 nameserver'ı domain registrar'da güncelle (yeni domain ise zaten Cloudflare'in nameserver'larını ver)
4. DNS aktif olunca (5 dk - 24 saat) bir sonraki adıma geç

---

## 1) R2 Bucket

1. Cloudflare Dashboard → **R2** → **Create bucket**
2. Bucket adı: `tgteknikcrm-attach` (wrangler.toml'da bu kullanılıyor)
3. Location: **EEUR** (Eastern Europe — Türkiye'ye en yakın)
4. **Create**

## 2) R2 API Token

1. R2 sayfasında sağ üstte **Manage R2 API Tokens**
2. **Create API token**
3. **Permissions**: `Object Read & Write`
4. **Specify bucket**: `tgteknikcrm-attach` (sadece o bucket için)
5. TTL: **Forever**
6. **Create**
7. Çıkan ekrandan **Account ID, Access Key ID, Secret Access Key** kopyala (bir daha gösterilmez!)

## 3) Vercel Env Variables

Vercel Dashboard → Settings → Environment Variables. Production + Preview + Development hepsine ekle:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_R2_ENABLED` | `1` |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | `https://cdn.tgteknik.com.tr` (worker domain — adım 6'da kuracaksın) |
| `R2_ACCOUNT_ID` | (adım 2'den) |
| `R2_ACCESS_KEY_ID` | (adım 2'den) |
| `R2_SECRET_ACCESS_KEY` | (adım 2'den) |
| `R2_BUCKET_NAME` | `tgteknikcrm-attach` |
| `R2_COOKIE_DOMAIN` | `.tgteknik.com.tr` (başında nokta!) |

Vercel'in **Production domain'i** de kendi domain'in olmalı (Vercel Dashboard → Domains'ten ekle).

Sonra **redeploy** (Deployments → ⋯ → Redeploy).

## 4) Wrangler kurulumu

PowerShell veya bash:

```bash
cd c:/Users/PC/OneDrive/Desktop/tgteknikcrm/worker
npm install
npx wrangler login
```

Tarayıcı açılır → Cloudflare ile login ol → izin ver.

## 5) Worker config + secret

`worker/wrangler.toml` dosyasını aç ve şu satırları doldur:

```toml
[vars]
SUPABASE_URL = "https://qikxnbgfaangeyrxzxxl.supabase.co"
SUPABASE_ANON_KEY = "eyJ..." # Supabase Dashboard → Settings → API → anon public key
ALLOWED_ORIGINS = "https://tgteknik.com.tr,https://www.tgteknik.com.tr,http://localhost:3000"
```

Sonra **Supabase JWT secret**'ı al:
- Supabase Dashboard → **Project Settings → API → JWT Settings → JWT Secret** → kopyala

Worker'a secret olarak gönder:

```bash
cd worker
npx wrangler secret put SUPABASE_JWT_SECRET
# (yapıştırıp Enter)
```

## 6) Worker deploy + custom domain

```bash
cd worker
npx wrangler deploy
```

Çıkan çıktıda `https://tgteknikcrm-attach.<account>.workers.dev` URL'i göreceksin. Test için:

```bash
curl -I "https://tgteknikcrm-attach.<account>.workers.dev/test/anything"
# → 401 Unauthorized (beklenen — JWT yok)
```

Şimdi **custom domain** bağla:

1. Cloudflare Dashboard → Workers & Pages → `tgteknikcrm-attach` → **Settings → Triggers**
2. **Add Custom Domain** → `cdn.tgteknik.com.tr` (DNS otomatik kurulur, 1 dakika)
3. Vercel env'deki `NEXT_PUBLIC_R2_PUBLIC_URL` değeri **bu URL** olmalı

Bunu yaptıktan sonra:

- `cdn.tgteknik.com.tr` → R2 worker
- `tgteknik.com.tr` → Vercel
- Cookie `Domain=.tgteknik.com.tr` → her ikisi de okur

---

## 7) Test

1. Vercel'de redeploy ol (yeni env'leri alsın)
2. https://tgteknik.com.tr → giriş yap (yeni domain üzerinden!)
3. /messages → bir konuşma aç → resim ekle, gönder
4. DevTools → Network → resme bak:
   - URL: `https://cdn.tgteknik.com.tr/<userId>/<convId>/<ts>_<file>__600.webp`
   - Status: **200**
   - Size: **(memory cache)** veya **(disk cache)** — F5 sonrası
   - Content-Type: `image/webp`
   - Cache-Control: `private, max-age=31536000, immutable`
5. F5 yap → resim **diskten yüklenir, 0 ms**

## 8) Çalışmazsa

| Belirti | Sebep | Çözüm |
|---|---|---|
| Worker URL'i 401 dönüyor (resimler bozuk görünüyor) | `tg_jwt` cookie subdomain'e gitmiyor | Vercel app'i kendi custom domain'inden mi kullanıyorsun? `R2_COOKIE_DOMAIN` doğru mu? `vercel.app` ile çalışmaz |
| 403 Forbidden | RLS — kullanıcı bu mesaj eki participant'ı değil | Doğru kullanıcı ile mi giriş yapmışsın? |
| 404 Not Found | R2'ye dosya yüklenmemiş | Vercel function logs'una bak; R2 access key doğru mu, sharp sorun çıkarmış mı? |
| Worker custom domain 502 | DNS henüz proxy'de değil | Cloudflare DNS sayfasında `cdn` rekordunun **turuncu bulut** ikonuna bak — proxy aktif olmalı |
| Yeni resimler eski davranıyor (Supabase'den geliyor) | `NEXT_PUBLIC_R2_ENABLED=1` redeploy sonrası eklendi mi? | Vercel → Redeploy zorunlu |

---

## 9) Eski Supabase'deki resimler

Eski mesaj ekleri Supabase storage'ta kalır, **bozulmaz**. AttachmentPreview `provider` alanına bakıp doğru URL builder'ı seçer:

- `provider='supabase'` → `/api/attach/[id]` (eski yol, hâlâ çalışıyor)
- `provider='r2'` → `cdn.tgteknik.com.tr/<key>` (yeni yol)

İstersen sonradan **migration script** yazılır (eski dosyaları R2'ye taşır + provider'ı `r2` yapar). Şimdilik ihtiyaç yok.

---

## Mimari özeti

```
[Browser]
   ↓ <img src="https://cdn.tgteknik.com.tr/abc/file__600.webp">
   ↓ Cookie: tg_jwt=eyJ...
[Cloudflare Worker (cdn subdomain)]
   ├─ Cache HIT (CF edge IST)? → 5-15ms, biter
   ├─ JWT verify (HMAC-SHA256, 1ms)
   ├─ Supabase REST: message_attachments WHERE storage_path=... (RLS)
   │   yetki yoksa 403, varsa devam
   └─ R2 BUCKET.get(key) → ReadableStream → response
       Cache-Control: max-age=31536000, immutable
       CF cache'e yazılır (24 saat)
[Browser]
   diske kaydet (1 yıl)
```

**İlk yükleme**: ~30-50ms (CF EU PoP'tan)
**İkinci yükleme** (CF cache hit): ~5-15ms (CF IST PoP)
**Sonraki yüklemeler** (browser cache): 0ms

vs eski Supabase:
- İlk yükleme: ~500-1500ms (Vercel function cold + bandwidth proxy)
- F5 sonrası: ~500ms (token değişiyordu, şimdi /api/attach token-less ile ~200ms)

---

## Maliyet (free tier kapsamı)

- **R2**: 10 GB depolama + 10M Class A (write) + 1M Class B (read) **ücretsiz/ay**
- **Worker**: 100k istek/gün (3M/ay) **ücretsiz**
- **Cloudflare Plan**: Free (Polish/Mirage istemiyoruz, sharp upload zamanı encode ediyor)

Atölyenin tipik kullanımı bu sınırların **çok altında**.

---

## Geri dönmek istersen

`NEXT_PUBLIC_R2_ENABLED=0` yap + redeploy. Yeni eklemeler tekrar Supabase'e gider. Eski R2 dosyaları aynı yerde kalır, AttachmentPreview otomatik handle eder.
