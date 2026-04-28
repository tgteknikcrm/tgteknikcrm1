-- TG Teknik CRM - QC bubble custom color + breakdown/maintenance fields

-- Per-spec override color for the bubble (null = use measurement-derived color)
alter table public.quality_specs
  add column if not exists bubble_color text;

-- Breakdown / maintenance fields on timeline entries. Only relevant for
-- kind in ('ariza','duzeltme','parca_degisimi') but stored on the same
-- table so the unified feed stays simple.
alter table public.machine_timeline_entries
  add column if not exists severity_level smallint check (severity_level between 0 and 3),
  add column if not exists entry_status text check (entry_status in ('acik','devam','cozuldu')),
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists fix_description text;

create index if not exists idx_mte_status_kind
  on public.machine_timeline_entries(entry_status, kind)
  where entry_status is not null;
