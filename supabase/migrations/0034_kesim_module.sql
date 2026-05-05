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
