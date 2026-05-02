-- ============================================================
-- 0037 — timeline_entry_kind enum + 'yag_kontrol'
-- ============================================================
--
-- Yağ kontrol kayıtları için yeni kind. Makine detay sayfasındaki
-- "Yağ Kontrol" sekmesi bunu listeler. Mevcut türler korundu;
-- yalnızca enum genişletildi (IF NOT EXISTS ile idempotent).
-- ============================================================

ALTER TYPE timeline_entry_kind ADD VALUE IF NOT EXISTS 'yag_kontrol';
