-- TG Teknik CRM - Machine ↔ Operator shift assignments
-- Each machine can have one operator per shift (sabah/aksam/gece).
-- Shift windows used by UI:
--   sabah  08:00–16:00
--   aksam  16:00–24:00
--   gece   00:00–08:00

create table if not exists public.machine_shift_assignments (
  id uuid primary key default uuid_generate_v4(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  shift shift not null,
  operator_id uuid not null references public.operators(id) on delete cascade,
  notes text,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (machine_id, shift)
);

create index if not exists idx_msa_machine on public.machine_shift_assignments(machine_id);
create index if not exists idx_msa_operator on public.machine_shift_assignments(operator_id);
create index if not exists idx_msa_assigned_by on public.machine_shift_assignments(assigned_by);

-- updated_at trigger
drop trigger if exists trg_msa_touch on public.machine_shift_assignments;
create trigger trg_msa_touch
  before update on public.machine_shift_assignments
  for each row execute function public.touch_updated_at();

-- RLS
alter table public.machine_shift_assignments enable row level security;

drop policy if exists "msa_read_auth" on public.machine_shift_assignments;
create policy "msa_read_auth" on public.machine_shift_assignments
  for select using ((select auth.uid()) is not null);

drop policy if exists "msa_insert_auth" on public.machine_shift_assignments;
create policy "msa_insert_auth" on public.machine_shift_assignments
  for insert with check ((select auth.uid()) is not null);

drop policy if exists "msa_update_auth" on public.machine_shift_assignments;
create policy "msa_update_auth" on public.machine_shift_assignments
  for update using ((select auth.uid()) is not null);

drop policy if exists "msa_delete_auth" on public.machine_shift_assignments;
create policy "msa_delete_auth" on public.machine_shift_assignments
  for delete using ((select auth.uid()) is not null);
