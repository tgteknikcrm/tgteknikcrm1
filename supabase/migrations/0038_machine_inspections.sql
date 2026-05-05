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
