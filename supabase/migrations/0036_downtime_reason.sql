-- ┌────────────────────────────────────────────────────────────────────┐
-- │  Downtime reason (sebep) — every duruş, bakım or arıza needs a     │
-- │  category so Pareto/MTBF reports can group them.                   │
-- │                                                                    │
-- │  When operator changes machine status from aktif → durus/bakim/    │
-- │  ariza, the existing 0030 trigger opens a row in                   │
-- │  machine_downtime_sessions. After the trigger, the UI patches the  │
-- │  open session with the picked category + free-form text.           │
-- │                                                                    │
-- │  Categories are intentionally cross-status (one enum) so the same  │
-- │  Pareto chart works for all kinds of stoppage. Free-form text      │
-- │  remains in `notes` for nuance.                                    │
-- └────────────────────────────────────────────────────────────────────┘

do $$
begin
  if not exists (select 1 from pg_type where typname = 'downtime_reason_category') then
    create type public.downtime_reason_category as enum (
      'mola',                   -- Mola / yemek
      'operator_yok',           -- Operatör yok / değişimi
      'malzeme_bekliyor',       -- Malzeme/hammadde bekliyor
      'ayar_program',           -- Program / takım ayarı
      'vardiya_degisimi',       -- Vardiya değişimi
      'bakim_planli',           -- Planlı bakım (yağ, filtre, periyodik)
      'bakim_plansiz',          -- Plansız bakım
      'ariza_mekanik',          -- Mekanik arıza (mengene, fixture, kayış)
      'ariza_elektrik',         -- Elektrik / kumanda arıza
      'ariza_yazilim',          -- Yazılım / CNC arıza
      'kalite_sorunu',          -- Kalite kontrol sapması — durdu
      'diger'                   -- Serbest açıklama gerekir
    );
  end if;
end $$;

alter table public.machine_downtime_sessions
  add column if not exists reason_category public.downtime_reason_category;

create index if not exists machine_downtime_reason_idx
  on public.machine_downtime_sessions(reason_category);

-- Realtime: tablo zaten publication'a 0030'da eklendi.
