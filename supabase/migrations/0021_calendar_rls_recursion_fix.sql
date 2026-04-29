-- Fix infinite-recursion between calendar_events and
-- calendar_event_attendees RLS policies.
--
-- Original policies:
--   calendar_events SELECT  → joined attendees (so attendees can see events)
--   calendar_event_attendees SELECT  → joined events (via is_calendar_event_visible)
-- Postgres detected the cycle and aborted with 42P17.
--
-- Fix: split visibility into two SECURITY DEFINER helpers, each checking
-- only one table. Each policy then references only one helper, so no
-- cyclic dependency between policies.

create or replace function public.is_calendar_event_creator(
  ev_id uuid, uid uuid
) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.calendar_events e
    where e.id = ev_id and e.created_by = uid
  );
$$;

create or replace function public.is_calendar_event_attendee(
  ev_id uuid, uid uuid
) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.calendar_event_attendees a
    where a.event_id = ev_id and a.user_id = uid
  );
$$;

-- calendar_events SELECT — uses the attendee-only helper (no recursion).
drop policy if exists "select events as creator or attendee" on public.calendar_events;
create policy "select events as creator or attendee"
on public.calendar_events for select to authenticated
using (
  created_by = (select auth.uid())
  or public.is_calendar_event_attendee(id, (select auth.uid()))
);

-- calendar_event_attendees SELECT — uses the creator-only helper.
drop policy if exists "select attendees if visible" on public.calendar_event_attendees;
create policy "select attendees if visible"
on public.calendar_event_attendees for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_calendar_event_creator(event_id, (select auth.uid()))
);

-- The old combined helper is no longer used; drop it for clarity.
drop function if exists public.is_calendar_event_visible(uuid, uuid);
