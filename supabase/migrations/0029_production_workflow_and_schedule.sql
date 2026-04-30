-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Production workflow + work schedule                             │
-- │                                                                   │
-- │  When the operator clicks "Ayara Başla" / "Üretime Başla" on a    │
-- │  job, the system should auto-create today's production_entry so    │
-- │  the form isn't a separate manual step. To support that:          │
-- │                                                                   │
-- │   - products.cleanup_time_minutes — operator-side per-piece time  │
-- │     (door open + part swap + cleanup). effective_cycle = cycle    │
-- │     + cleanup. Drives ETA math.                                   │
-- │   - production_entries.setup_minutes — separate from downtime so   │
-- │     setup time has its own column on the daily form.              │
-- │   - production_entries one-per (machine, date, shift, job_id)     │
-- │     UNIQUE — UPSERT-friendly auto-create.                         │
-- │   - app_settings (key/value) — work_schedule jsonb config:        │
-- │     7 days × {enabled, shift_start, work_minutes, lunch_minutes}  │
-- │     Pzt-Cum açık, Cmt-Pzr kapalı (default). Kullanıcı /settings/  │
-- │     work-hours üzerinden değiştirebilir.                          │
-- │   - machine_timeline_entries.production_entry_id — open breakdown │
-- │     auto-links to today's running entry for downtime aggregation. │
-- └──────────────────────────────────────────────────────────────────┘

alter table public.products
  add column if not exists cleanup_time_minutes numeric
    check (cleanup_time_minutes is null or cleanup_time_minutes >= 0);

alter table public.production_entries
  add column if not exists setup_minutes int default 0
    check (setup_minutes >= 0);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_modify on public.app_settings;
create policy app_settings_modify on public.app_settings
  for all to authenticated using (true) with check (true);

insert into public.app_settings (key, value)
values (
  'work_schedule',
  jsonb_build_object(
    'days', jsonb_build_array(
      jsonb_build_object('day', 1, 'enabled', true,  'shift_start', '08:00', 'work_minutes', 540, 'lunch_minutes', 60),
      jsonb_build_object('day', 2, 'enabled', true,  'shift_start', '08:00', 'work_minutes', 540, 'lunch_minutes', 60),
      jsonb_build_object('day', 3, 'enabled', true,  'shift_start', '08:00', 'work_minutes', 540, 'lunch_minutes', 60),
      jsonb_build_object('day', 4, 'enabled', true,  'shift_start', '08:00', 'work_minutes', 540, 'lunch_minutes', 60),
      jsonb_build_object('day', 5, 'enabled', true,  'shift_start', '08:00', 'work_minutes', 540, 'lunch_minutes', 60),
      jsonb_build_object('day', 6, 'enabled', false, 'shift_start', '08:00', 'work_minutes', 480, 'lunch_minutes', 60),
      jsonb_build_object('day', 7, 'enabled', false, 'shift_start', '08:00', 'work_minutes', 480, 'lunch_minutes', 60)
    )
  )
)
on conflict (key) do nothing;

alter table public.machine_timeline_entries
  add column if not exists production_entry_id uuid
    references public.production_entries(id) on delete set null;

create index if not exists machine_timeline_production_entry_idx
  on public.machine_timeline_entries(production_entry_id);

drop index if exists production_entries_one_per_machine_date_shift_job;
create unique index production_entries_one_per_machine_date_shift_job
  on public.production_entries(machine_id, entry_date, shift, job_id)
  where job_id is not null;
