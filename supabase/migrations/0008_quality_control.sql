-- TG Teknik CRM - Quality Control
-- Adds:
--   quality_specs         — per-job dimensional/QC specifications
--                           (FAI Form 3 style: balon no, nominal, tolerance,
--                            measurement tool, critical flag)
--   quality_measurements  — actual measured values for each spec, per part
--                           (auto-evaluated against tolerance: ok/sinirda/nok)

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type qc_characteristic_type as enum (
    'boyut',     -- dimensional (length, diameter, depth...)
    'gdt',       -- geometric tolerance (flatness, concentricity...)
    'yuzey',     -- surface finish (Ra, Rz...)
    'sertlik',   -- hardness (HRC, HB...)
    'agirlik',   -- weight
    'diger'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type qc_result as enum (
    'ok',         -- within tolerance
    'sinirda',    -- borderline (>80% of tolerance band consumed)
    'nok'         -- out of tolerance (reject)
  );
exception when duplicate_object then null; end $$;

-- ============================================================
-- quality_specs
-- ============================================================
create table if not exists public.quality_specs (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  bubble_no integer,
  characteristic_type qc_characteristic_type not null default 'boyut',
  description text not null,
  nominal_value numeric(14,4) not null,
  tolerance_plus numeric(14,4) not null default 0,
  tolerance_minus numeric(14,4) not null default 0,
  unit text not null default 'mm',
  measurement_tool text,
  is_critical boolean not null default false,
  drawing_id uuid references public.drawings(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- bubble_no is unique within a job when set
  unique (job_id, bubble_no)
);

create index if not exists idx_qc_specs_job on public.quality_specs(job_id);
create index if not exists idx_qc_specs_drawing on public.quality_specs(drawing_id);
create index if not exists idx_qc_specs_created_by on public.quality_specs(created_by);

-- ============================================================
-- quality_measurements
-- ============================================================
create table if not exists public.quality_measurements (
  id uuid primary key default uuid_generate_v4(),
  spec_id uuid not null references public.quality_specs(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  part_serial text,
  measured_value numeric(14,4) not null,
  result qc_result not null,
  measurement_tool text,
  measured_by uuid references public.profiles(id) on delete set null,
  measured_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_qc_meas_spec on public.quality_measurements(spec_id);
create index if not exists idx_qc_meas_job on public.quality_measurements(job_id);
create index if not exists idx_qc_meas_by on public.quality_measurements(measured_by);
create index if not exists idx_qc_meas_at on public.quality_measurements(measured_at desc);

-- ============================================================
-- updated_at triggers
-- ============================================================
drop trigger if exists trg_qc_specs_touch on public.quality_specs;
create trigger trg_qc_specs_touch
  before update on public.quality_specs
  for each row execute function public.touch_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.quality_specs enable row level security;
alter table public.quality_measurements enable row level security;

do $$ declare t text;
begin
  for t in select unnest(array['quality_specs','quality_measurements']) loop
    execute format('drop policy if exists "%1$s_read_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_read_auth" on public.%1$s for select using ((select auth.uid()) is not null)',
      t);

    execute format('drop policy if exists "%1$s_insert_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_insert_auth" on public.%1$s for insert with check ((select auth.uid()) is not null)',
      t);

    execute format('drop policy if exists "%1$s_update_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_update_auth" on public.%1$s for update using ((select auth.uid()) is not null)',
      t);

    execute format('drop policy if exists "%1$s_delete_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_delete_auth" on public.%1$s for delete using ((select auth.uid()) is not null)',
      t);
  end loop;
end $$;

-- ============================================================
-- View: per-job quality summary (used by /quality list page)
-- security_invoker so RLS still applies via underlying tables
-- ============================================================
create or replace view public.v_quality_summary
with (security_invoker = true)
as
select
  j.id                                                 as job_id,
  j.job_no,
  j.customer,
  j.part_name,
  j.part_no,
  j.quantity                                           as planned_quantity,
  j.status                                             as job_status,
  count(distinct s.id)                                 as spec_count,
  count(distinct s.id) filter (where s.is_critical)    as critical_spec_count,
  count(m.id)                                          as measurement_count,
  count(m.id) filter (where m.result = 'ok')           as ok_count,
  count(m.id) filter (where m.result = 'sinirda')      as sinirda_count,
  count(m.id) filter (where m.result = 'nok')          as nok_count,
  max(m.measured_at)                                   as last_measured_at
from public.jobs j
left join public.quality_specs s         on s.job_id = j.id
left join public.quality_measurements m  on m.job_id = j.id
group by j.id;

comment on view public.v_quality_summary is
  'Per-job quality control rollup. Used by /quality list page.';
