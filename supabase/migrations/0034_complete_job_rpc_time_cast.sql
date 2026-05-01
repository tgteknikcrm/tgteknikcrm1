-- ============================================================
-- 0034 — complete_job_rpc end_time/start_time tip uyumu fix
-- ============================================================
--
-- Bug: production_entries.start_time / end_time kolonları
-- `time without time zone`. RPC içinde `to_char(...)` text
-- döndürüyordu → INSERT/UPDATE'te
--   "column end_time is of type time without time zone but
--    expression is of type text"
-- hatası fırlıyor, iş tamamlanamıyor.
--
-- Fix: variable tipini `time` yap, doğrudan `(now() at time zone
-- 'Europe/Istanbul')::time` ile cast et.
-- ============================================================

create or replace function public.complete_job_rpc(p_job_id uuid, p_scrap int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job record;
  v_already int;
  v_remaining int;
  v_final int;
  v_extra_setup int := 0;
  v_today date;
  v_shift_text text;
  v_now_time time without time zone;
  v_existing record;
  v_entry_id uuid;
  v_hour int;
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '42501'; end if;
  if p_scrap is null or p_scrap < 0 then p_scrap := 0; end if;

  select id, machine_id, operator_id, quantity, status, started_at, setup_completed_at
    into v_job from public.jobs where id = p_job_id;
  if v_job.id is null then raise exception 'job_not_found' using errcode = 'P0002'; end if;
  if v_job.machine_id is null then raise exception 'job_no_machine' using errcode = '22023'; end if;
  if v_job.status = 'tamamlandi' then raise exception 'job_already_done' using errcode = '23514'; end if;

  select coalesce(sum(produced_qty), 0)::int into v_already
    from public.production_entries where job_id = p_job_id;
  v_remaining := greatest(0, v_job.quantity - v_already);
  if p_scrap > v_remaining then raise exception 'scrap_exceeds_remaining' using errcode = '23514'; end if;
  v_final := greatest(0, v_remaining - p_scrap);

  v_today := (now() at time zone 'Europe/Istanbul')::date;
  v_hour := extract(hour from (now() at time zone 'Europe/Istanbul'))::int;
  v_shift_text := case when v_hour >= 8 and v_hour < 16 then 'sabah'
                       when v_hour >= 16 then 'aksam' else 'gece' end;
  v_now_time := (now() at time zone 'Europe/Istanbul')::time without time zone;

  select id, end_time, setup_minutes into v_existing
    from public.production_entries
    where machine_id = v_job.machine_id and entry_date = v_today
      and shift = v_shift_text::shift and job_id = p_job_id
    order by created_at desc limit 1;

  if v_existing.id is null then
    if v_job.started_at is not null and v_job.setup_completed_at is not null then
      v_extra_setup := greatest(0,
        extract(epoch from (v_job.setup_completed_at - v_job.started_at)) / 60)::int;
    end if;
    insert into public.production_entries
      (entry_date, shift, machine_id, operator_id, job_id,
       start_time, end_time, produced_qty, scrap_qty,
       downtime_minutes, setup_minutes, created_by)
    values (v_today, v_shift_text::shift, v_job.machine_id, v_job.operator_id, p_job_id,
            v_now_time, v_now_time, v_final, p_scrap, 0, v_extra_setup, v_uid)
    returning id into v_entry_id;
  else
    v_entry_id := v_existing.id;
    if coalesce(v_existing.setup_minutes, 0) = 0
       and v_job.started_at is not null and v_job.setup_completed_at is not null then
      v_extra_setup := greatest(0,
        extract(epoch from (v_job.setup_completed_at - v_job.started_at)) / 60)::int;
    end if;
    update public.production_entries
      set produced_qty = coalesce(produced_qty, 0) + v_final,
          scrap_qty = coalesce(scrap_qty, 0) + p_scrap,
          setup_minutes = coalesce(setup_minutes, 0) + v_extra_setup,
          end_time = v_now_time
      where id = v_entry_id;
  end if;

  update public.jobs set status = 'tamamlandi', completed_at = now() where id = p_job_id;

  return jsonb_build_object('success', true, 'entry_id', v_entry_id,
    'produced', v_final, 'scrap', p_scrap, 'setup_minutes_added', v_extra_setup);
end;
$$;

grant execute on function public.complete_job_rpc(uuid, int) to authenticated;
