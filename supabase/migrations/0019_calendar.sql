-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Calendar — Google-Calendar-style events with attendees, RSVP,   │
-- │  optional all-day flag, and color tags. Event creator can invite │
-- │  any active user; invitees can accept/decline.                   │
-- └──────────────────────────────────────────────────────────────────┘

-- Visual tag for an event (mirrors Google Calendar's "color" idea).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'calendar_event_color') then
    create type public.calendar_event_color as enum (
      'blue', 'cyan', 'green', 'amber', 'orange', 'red', 'pink', 'violet', 'gray'
    );
  end if;
end $$;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  color public.calendar_event_color not null default 'blue',
  -- Soft links to first-class entities (so an event can be tied to a job
  -- or machine for context, optional).
  job_id uuid references public.jobs(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at >= starts_at)
);
create index if not exists calendar_events_starts_at_idx
  on public.calendar_events(starts_at);
create index if not exists calendar_events_created_by_idx
  on public.calendar_events(created_by);

-- Per-user invitee row. Lets each invitee accept/decline independently.
create table if not exists public.calendar_event_attendees (
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'tentative')),
  responded_at timestamptz,
  primary key (event_id, user_id)
);
create index if not exists calendar_event_attendees_user_idx
  on public.calendar_event_attendees(user_id);

-- Touch trigger
create or replace function public.calendar_events_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists trg_calendar_events_touch on public.calendar_events;
create trigger trg_calendar_events_touch
before update on public.calendar_events
for each row execute function public.calendar_events_touch();

-- ─── RLS ──────────────────────────────────────────────────────────
alter table public.calendar_events enable row level security;
alter table public.calendar_event_attendees enable row level security;

-- Helper: am I either the creator or an attendee of this event?
create or replace function public.is_calendar_event_visible(
  ev_id uuid, uid uuid
) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.calendar_events e
    where e.id = ev_id and e.created_by = uid
  ) or exists (
    select 1 from public.calendar_event_attendees a
    where a.event_id = ev_id and a.user_id = uid
  );
$$;

-- Visibility: creator + attendees. (We could also let all authed users
-- see all events, but per-user invite list is cleaner.)
drop policy if exists "select events as creator or attendee" on public.calendar_events;
create policy "select events as creator or attendee"
on public.calendar_events for select to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.calendar_event_attendees a
    where a.event_id = id and a.user_id = (select auth.uid())
  )
);

drop policy if exists "insert events as self" on public.calendar_events;
create policy "insert events as self"
on public.calendar_events for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "update events as creator" on public.calendar_events;
create policy "update events as creator"
on public.calendar_events for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

drop policy if exists "delete events as creator" on public.calendar_events;
create policy "delete events as creator"
on public.calendar_events for delete to authenticated
using (created_by = (select auth.uid()));

-- Attendees: everyone involved with the event can see all rows.
drop policy if exists "select attendees if visible" on public.calendar_event_attendees;
create policy "select attendees if visible"
on public.calendar_event_attendees for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_calendar_event_visible(event_id, (select auth.uid()))
);

-- Insert: only the event creator seeds attendees (during create).
drop policy if exists "insert attendees as creator" on public.calendar_event_attendees;
create policy "insert attendees as creator"
on public.calendar_event_attendees for insert to authenticated
with check (
  exists (
    select 1 from public.calendar_events e
    where e.id = event_id and e.created_by = (select auth.uid())
  )
);

-- Update: I can update my own RSVP; creator can also patch.
drop policy if exists "update attendees self or creator" on public.calendar_event_attendees;
create policy "update attendees self or creator"
on public.calendar_event_attendees for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.calendar_events e
    where e.id = event_id and e.created_by = (select auth.uid())
  )
)
with check (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.calendar_events e
    where e.id = event_id and e.created_by = (select auth.uid())
  )
);

-- Delete: creator can remove attendees.
drop policy if exists "delete attendees as creator" on public.calendar_event_attendees;
create policy "delete attendees as creator"
on public.calendar_event_attendees for delete to authenticated
using (
  exists (
    select 1 from public.calendar_events e
    where e.id = event_id and e.created_by = (select auth.uid())
  )
  or user_id = (select auth.uid())
);

-- Realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.calendar_events;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.calendar_event_attendees;
    exception when duplicate_object then null; end;
  end if;
end $$;
