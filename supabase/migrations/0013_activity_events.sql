-- TG Teknik CRM - Activity / Audit Events
-- One central append-only table captures every meaningful workshop action.
-- UI subscribes via Supabase Realtime for live notifications.
-- A dedicated activity_reads table tracks per-user "last read" timestamp
-- so each user has their own unread count.

do $$ begin
  create type activity_event_type as enum (
    'job.created', 'job.updated', 'job.deleted', 'job.status_changed', 'job.tools_assigned',
    'production.created',
    'spec.created', 'spec.deleted',
    'measurement.created', 'measurement.nok',
    'review.created',
    'tool.created', 'tool.deleted', 'tool.image_set',
    'operator.created', 'operator.updated', 'operator.deleted',
    'machine.created', 'machine.status_changed', 'machine.deleted', 'machine.shift_assigned',
    'drawing.uploaded', 'drawing.deleted', 'drawing.annotated',
    'order.created', 'order.status_changed', 'order.deleted',
    'supplier.created',
    'cad.uploaded', 'cad.deleted',
    'user.created', 'user.deleted', 'user.role_changed'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.activity_events (
  id uuid primary key default uuid_generate_v4(),
  event_type activity_event_type not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text,
  entity_type text,
  entity_id uuid,
  entity_label text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_created
  on public.activity_events(created_at desc);
create index if not exists idx_activity_actor
  on public.activity_events(actor_id);
create index if not exists idx_activity_type
  on public.activity_events(event_type);

create table if not exists public.activity_reads (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_activity_reads_touch on public.activity_reads;
create trigger trg_activity_reads_touch
  before update on public.activity_reads
  for each row execute function public.touch_updated_at();

alter table public.activity_events enable row level security;
alter table public.activity_reads enable row level security;

drop policy if exists "ae_read_auth" on public.activity_events;
create policy "ae_read_auth" on public.activity_events
  for select using ((select auth.uid()) is not null);

drop policy if exists "ae_insert_auth" on public.activity_events;
create policy "ae_insert_auth" on public.activity_events
  for insert with check ((select auth.uid()) is not null);

-- Immutable: no UPDATE / DELETE policies on activity_events.

drop policy if exists "ar_read_self" on public.activity_reads;
create policy "ar_read_self" on public.activity_reads
  for select using (user_id = (select auth.uid()));

drop policy if exists "ar_upsert_self" on public.activity_reads;
create policy "ar_upsert_self" on public.activity_reads
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "ar_update_self" on public.activity_reads;
create policy "ar_update_self" on public.activity_reads
  for update using (user_id = (select auth.uid()));

-- Fail-safe trigger: NOK measurements always emit an event automatically,
-- even if a future code path forgets to. Keeps quality alarms reliable.
create or replace function public.emit_measurement_nok_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.result = 'nok' then
    insert into public.activity_events
      (event_type, actor_id, entity_type, entity_id, entity_label, metadata)
    values (
      'measurement.nok',
      new.measured_by,
      'measurement',
      new.id,
      coalesce(new.part_serial, '—'),
      jsonb_build_object(
        'spec_id', new.spec_id,
        'measured_value', new.measured_value
      )
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_meas_nok_event on public.quality_measurements;
create trigger trg_meas_nok_event
  after insert on public.quality_measurements
  for each row execute function public.emit_measurement_nok_event();

-- Add to Realtime publication so the client can subscribe
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'activity_events'
  ) then
    alter publication supabase_realtime add table public.activity_events;
  end if;
exception when undefined_object then null;
end $$;
