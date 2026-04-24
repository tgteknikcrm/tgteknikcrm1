-- TG Teknik CRM - Security Advisor Fixes
-- Fixes two issues raised by Supabase security linter:
--   1) v_daily_production view was SECURITY DEFINER (bypassed RLS)
--   2) touch_updated_at() had a mutable search_path (injection risk)

-- ============================================================
-- 1) Recreate v_daily_production with security_invoker
--    Runs with the querying user's permissions, so RLS on the
--    underlying tables is properly enforced.
-- ============================================================
drop view if exists public.v_daily_production;

create view public.v_daily_production
with (security_invoker = true) as
select
  pe.entry_date,
  pe.shift,
  m.name as machine_name,
  o.full_name as operator_name,
  j.job_no,
  j.customer,
  j.part_name,
  pe.produced_qty,
  pe.scrap_qty,
  pe.downtime_minutes,
  pe.notes
from public.production_entries pe
left join public.machines m on m.id = pe.machine_id
left join public.operators o on o.id = pe.operator_id
left join public.jobs j on j.id = pe.job_id
order by pe.entry_date desc, pe.shift;

-- ============================================================
-- 2) Pin search_path on touch_updated_at()
--    Prevents search_path hijacking. Function body is unchanged.
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end $$;
