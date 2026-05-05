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
