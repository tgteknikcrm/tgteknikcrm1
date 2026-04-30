-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Jobs: setup-vs-production step tracking + parts-per-setup        │
-- │                                                                   │
-- │  The Jobs page splits jobs by machine and shows a 4-step          │
-- │  progress indicator: Beklemede → Ayar → Üretimde → Tamamlandı.    │
-- │  We need three new pieces of state to drive that:                 │
-- │                                                                   │
-- │   - job_status enum gets 'ayar' (setup in progress) inserted      │
-- │     between 'beklemede' and 'uretimde'.                           │
-- │   - jobs.started_at / setup_completed_at — wall-clock timestamps  │
-- │     so the step indicator can show "started X min ago" etc.       │
-- │   - products.parts_per_setup — how many pieces are clamped at     │
-- │     once. Drives the setup-count math:                            │
-- │       setups_left = ceil(remaining / parts_per_setup)             │
-- │       remaining_minutes = setups_left × setup_time                │
-- │                          + remaining × cycle_time                  │
-- └──────────────────────────────────────────────────────────────────┘

do $$ begin
  alter type public.job_status add value if not exists 'ayar' before 'uretimde';
exception when duplicate_object then null;
end $$;

alter table public.jobs
  add column if not exists started_at timestamptz,
  add column if not exists setup_completed_at timestamptz;

create index if not exists jobs_started_at_idx on public.jobs(started_at);

alter table public.products
  add column if not exists parts_per_setup int check (parts_per_setup is null or parts_per_setup > 0);
