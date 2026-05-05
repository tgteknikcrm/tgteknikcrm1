-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  TG TEKNİK — TÜM BEKLEYEN MIGRATION'LAR (toplu uygulama dosyası) ║
-- ║                                                                  ║
-- ║  KULLANIM (Supabase Dashboard):                                  ║
-- ║    1. Sol menüden "SQL Editor"a git                              ║
-- ║    2. "+ New query" tıkla                                        ║
-- ║    3. Bu dosyanın TAMAMINI kopyala-yapıştır                      ║
-- ║    4. Sağ alttaki "RUN" tuşuna bas                               ║
-- ║    5. Hata yoksa hepsi uygulanmıştır                             ║
-- ║                                                                  ║
-- ║  İÇİNDEKİLER (sırasıyla 4 migration):                            ║
-- ║    0033  machine_inspections      (Temizlik + Yağ checklist)     ║
-- ║    0034  kesim_module             (Hammadde + cut_pieces)        ║
-- ║    0035  setup_overrun_+_cycles   (Per-makine + setup variance)  ║
-- ║    0036  downtime_reason          (Duruş sebep kategorisi)       ║
-- ║                                                                  ║
-- ║  GÜVENLİK: Her şey "if not exists" ya da "drop policy if exists" ║
-- ║  ile yazıldı — birden fazla kez RUN basmak güvenli (idempotent). ║
-- ╚══════════════════════════════════════════════════════════════════╝


-- ┌────────────────────────────────────────────────────────────────┐
-- │  Machine Inspections — structured cleaning + oil-check records │
-- │                                                                │
-- │  Replaces / complements the unstructured `machine_timeline_   │
-- │  entries (kind='temizlik'|'yag_kontrol')` rows. Captures a     │
-- │  checklist (items) + photo evidence (photo_paths in private    │
-- │  storage bucket) + free-form notes per inspection event.       │
-- │                                                                │
-- │  Operator workflow:                                            │
-- │    1. Open machine detail → Temizlik/Yağ Kontrol tab           │
-- │    2. Tap "+ Yeni Temizlik" → modal with 5-6 checklist items   │
-- │    3. Tap items off (with X/✓), add 1-3 photos from camera     │
-- │    4. Save — record lands in tab list with thumbs              │
-- └────────────────────────────────────────────────────────────────┘

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inspection_type') then
    create type public.inspection_type as enum ('temizlik', 'yag_kontrol');
  end if;
end $$;

create table if not exists public.machine_inspections (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  type public.inspection_type not null,
  performed_by uuid references public.profiles(id) on delete set null,
  performed_at timestamptz not null default now(),
  shift public.shift,
  -- items: jsonb array of { key: string, label: string, ok: boolean, na?: boolean }
  items jsonb not null default '[]',
  -- photo_paths: storage paths in 'machine-inspections' private bucket
  photo_paths text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists machine_inspections_machine_idx
  on public.machine_inspections(machine_id, performed_at desc);
create index if not exists machine_inspections_type_idx
  on public.machine_inspections(type, performed_at desc);
create index if not exists machine_inspections_performer_idx
  on public.machine_inspections(performed_by);

-- ─── RLS ───────────────────────────────────────────────────────
alter table public.machine_inspections enable row level security;

drop policy if exists machine_inspections_select on public.machine_inspections;
create policy machine_inspections_select on public.machine_inspections
  for select to authenticated using (true);

drop policy if exists machine_inspections_insert on public.machine_inspections;
create policy machine_inspections_insert on public.machine_inspections
  for insert to authenticated
  with check (performed_by = (select auth.uid()) or performed_by is null);

-- Update + delete: any authenticated user (small team, generous policy
-- aligned with tasks/products/breakdowns).
drop policy if exists machine_inspections_update on public.machine_inspections;
create policy machine_inspections_update on public.machine_inspections
  for update to authenticated using (true) with check (true);

drop policy if exists machine_inspections_delete on public.machine_inspections;
create policy machine_inspections_delete on public.machine_inspections
  for delete to authenticated using (true);

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.machine_inspections;
    exception when duplicate_object then null; end;
  end if;
end $$;

-- ─── Storage bucket: machine-inspections (private) ─────────────
insert into storage.buckets (id, name, public)
values ('machine-inspections', 'machine-inspections', false)
on conflict (id) do nothing;

drop policy if exists "machine-inspections read" on storage.objects;
create policy "machine-inspections read"
  on storage.objects for select to authenticated
  using (bucket_id = 'machine-inspections');

drop policy if exists "machine-inspections insert" on storage.objects;
create policy "machine-inspections insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'machine-inspections'
    and owner = (select auth.uid())
  );

drop policy if exists "machine-inspections delete own" on storage.objects;
create policy "machine-inspections delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'machine-inspections'
    and (
      owner = (select auth.uid())
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'admin'
      )
    )
  );
-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Kesim (Cutting / Stock Prep) Module                             │
-- │                                                                  │
-- │  Manufacturing reality: before CNC machining starts, raw bar     │
-- │  stock has to be cut to length. This module tracks both:         │
-- │                                                                  │
-- │  1. raw_materials  — incoming stock from supplier (e.g. 6m       │
-- │                       Ø50 1040 round bar, 12 boy at raf-A3)      │
-- │  2. cut_pieces     — pre-cut blanks ready for machining          │
-- │                       (e.g. Ø50×120mm, 50 adet for "Flanş Ø50")  │
-- │                                                                  │
-- │  When operator cuts:                                             │
-- │    raw_material.quantity ↓ by bars consumed                      │
-- │    cut_pieces row inserted (qty_cut = qty_remaining initially)   │
-- │                                                                  │
-- │  When operator uses a cut piece for a job:                       │
-- │    cut_pieces.quantity_remaining ↓                               │
-- │    (consumption recorded indirectly — qty_remaining is the       │
-- │     authoritative live counter)                                  │
-- └──────────────────────────────────────────────────────────────────┘

do $$
begin
  if not exists (select 1 from pg_type where typname = 'raw_material_shape') then
    create type public.raw_material_shape as enum (
      'round', 'square', 'rectangular', 'plate', 'tube', 'diger'
    );
  end if;
end $$;

-- ── raw_materials ────────────────────────────────────────────────────
create table if not exists public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  material_grade text,
  shape public.raw_material_shape not null default 'round',
  diameter_mm numeric(10,2),
  width_mm numeric(10,2),
  height_mm numeric(10,2),
  thickness_mm numeric(10,2),
  bar_length_mm numeric(10,2) default 6000,
  -- Authoritative live count of available bars/pieces of this stock.
  quantity numeric(12,2) not null default 0,
  unit text not null default 'boy',
  supplier text,
  location text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists raw_materials_code_idx on public.raw_materials(code);
create index if not exists raw_materials_active_idx on public.raw_materials(active);

-- ── cut_pieces ───────────────────────────────────────────────────────
-- One row per cutting batch. quantity_cut is fixed at insert; quantity_
-- remaining is the live counter that decreases as pieces are used in
-- jobs. We don't keep a separate 'consumptions' table — that's deliberate
-- (atölye scale: the join table would carry no extra info).
create table if not exists public.cut_pieces (
  id uuid primary key default gen_random_uuid(),
  raw_material_id uuid not null references public.raw_materials(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  cut_length_mm numeric(10,2) not null,
  quantity_cut int not null check (quantity_cut > 0),
  quantity_remaining int not null check (quantity_remaining >= 0),
  cut_at timestamptz not null default now(),
  cut_by uuid references public.profiles(id) on delete set null,
  lot_no text,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists cut_pieces_raw_idx on public.cut_pieces(raw_material_id);
create index if not exists cut_pieces_product_idx on public.cut_pieces(product_id);
create index if not exists cut_pieces_remaining_idx on public.cut_pieces(quantity_remaining)
  where quantity_remaining > 0;

-- ── Touch trigger for updated_at on raw_materials ────────────────────
drop trigger if exists trg_raw_materials_touch on public.raw_materials;
create trigger trg_raw_materials_touch
  before update on public.raw_materials
  for each row execute function public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────
alter table public.raw_materials enable row level security;
alter table public.cut_pieces enable row level security;

do $$ declare t text;
begin
  for t in select unnest(array['raw_materials','cut_pieces']) loop
    execute format('drop policy if exists "%1$s_select" on public.%1$s', t);
    execute format(
      'create policy "%1$s_select" on public.%1$s for select to authenticated using (true)',
      t);

    execute format('drop policy if exists "%1$s_insert" on public.%1$s', t);
    execute format(
      'create policy "%1$s_insert" on public.%1$s for insert to authenticated with check (true)',
      t);

    execute format('drop policy if exists "%1$s_update" on public.%1$s', t);
    execute format(
      'create policy "%1$s_update" on public.%1$s for update to authenticated using (true) with check (true)',
      t);

    execute format('drop policy if exists "%1$s_delete" on public.%1$s', t);
    execute format(
      'create policy "%1$s_delete" on public.%1$s for delete to authenticated using (true)',
      t);
  end loop;
end $$;

-- ── Realtime ─────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.raw_materials;
    exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.cut_pieces;
    exception when duplicate_object then null; end;
  end if;
end $$;
-- ┌────────────────────────────────────────────────────────────────────┐
-- │  Setup Overrun + Per-Machine Cycle Override                        │
-- │                                                                    │
-- │  Two related changes for the new manufacturing time model:         │
-- │                                                                    │
-- │  1. production_entries.setup_planned_minutes / setup_overrun_reason│
-- │     - When operator clicks "Üretime Başla" the system measures     │
-- │       actual setup minutes (started_at → setup_completed_at).      │
-- │     - If actual > planned + threshold, popup asks for the reason.  │
-- │     - We store BOTH the planned (snapshot at the time) and the     │
-- │       reason text on the production entry so reports can show      │
-- │       "+15 dk uzadı · Program hatası".                             │
-- │                                                                    │
-- │  2. product_machine_cycles                                         │
-- │     - Same product takes different times on different machines     │
-- │       (Fanuc 5:00, BWX 1:00, twin-spindle 2:30, etc).              │
-- │     - This table stores per-machine overrides for cycle / swap /   │
-- │       parts_per_setup / setup. NULL fields fall back to the        │
-- │       product's default.                                           │
-- │     - Job creation reads this table when picking a machine to set  │
-- │       a realistic ETA.                                             │
-- │                                                                    │
-- │  Cycle interpretation also changes app-side:                       │
-- │     - Before: cycle was "per batch" (fixture load)                 │
-- │     - After:  cycle is "per piece" (operator divides controller    │
-- │                elapsed by the number of parts in the batch)        │
-- │     This makes twin-spindle / parallel pallet machines easy to     │
-- │     model: enter cycle/piece and set swap=0 for parallel-load.     │
-- └────────────────────────────────────────────────────────────────────┘

-- ─── 1. production_entries: setup audit columns ──────────────────────
alter table public.production_entries
  add column if not exists setup_planned_minutes numeric(10,2),
  add column if not exists setup_overrun_reason text;

-- Optional categorical reason (for reports). Free-form `setup_overrun_reason`
-- still wins when set; this column lets us aggregate.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'setup_overrun_category') then
    create type public.setup_overrun_category as enum (
      'program_hatasi',
      'mengene_fixture',
      'sifirlama_uzadi',
      'ilk_parca_kontrolu',
      'takim_eksik_degisti',
      'ariza_durus',
      'numune_takim_yoktu',
      'diger'
    );
  end if;
end $$;

alter table public.production_entries
  add column if not exists setup_overrun_category public.setup_overrun_category;

-- ─── 2. product_machine_cycles: per-machine override ─────────────────
create table if not exists public.product_machine_cycles (
  product_id uuid not null references public.products(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  -- All NULL → fall back to product defaults. NOT NULL would force the
  -- user to fill every field on every machine row.
  -- Stored in seconds for precision; UI converts to/from min:sec.
  cycle_seconds int,
  swap_seconds int,
  setup_seconds int,
  parts_per_setup int,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (product_id, machine_id)
);

create index if not exists pmc_machine_idx
  on public.product_machine_cycles(machine_id);

-- Touch trigger
drop trigger if exists trg_pmc_touch on public.product_machine_cycles;
create trigger trg_pmc_touch
  before update on public.product_machine_cycles
  for each row execute function public.touch_updated_at();

alter table public.product_machine_cycles enable row level security;

drop policy if exists pmc_select on public.product_machine_cycles;
create policy pmc_select on public.product_machine_cycles
  for select to authenticated using (true);

drop policy if exists pmc_insert on public.product_machine_cycles;
create policy pmc_insert on public.product_machine_cycles
  for insert to authenticated with check (true);

drop policy if exists pmc_update on public.product_machine_cycles;
create policy pmc_update on public.product_machine_cycles
  for update to authenticated using (true) with check (true);

drop policy if exists pmc_delete on public.product_machine_cycles;
create policy pmc_delete on public.product_machine_cycles
  for delete to authenticated using (true);

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.product_machine_cycles;
    exception when duplicate_object then null; end;
  end if;
end $$;
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
