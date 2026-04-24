-- TG Teknik CRM - Initial Schema
-- Run this once in your Supabase project's SQL editor.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type user_role as enum ('admin', 'operator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type machine_type as enum ('Fanuc', 'Tekna', 'BWX', 'Diger');
exception when duplicate_object then null; end $$;

do $$ begin
  create type machine_status as enum ('aktif', 'durus', 'bakim', 'ariza');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shift as enum ('sabah', 'aksam', 'gece');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('beklemede', 'uretimde', 'tamamlandi', 'iptal');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tool_condition as enum ('yeni', 'iyi', 'kullanilabilir', 'degistirilmeli');
exception when duplicate_object then null; end $$;

-- ============================================================
-- profiles (ties to auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'operator',
  phone text,
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when new.email = 'tgteknikcrm@outlook.com' then 'admin'::user_role
      else 'operator'::user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- machines
-- ============================================================
create table if not exists public.machines (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  type machine_type not null,
  model text,
  serial_no text,
  status machine_status not null default 'aktif',
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- operators (separate from auth — some operators may not login)
-- ============================================================
create table if not exists public.operators (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  employee_no text unique,
  phone text,
  shift shift,
  active boolean not null default true,
  profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- tools (takım listesi)
-- ============================================================
create table if not exists public.tools (
  id uuid primary key default uuid_generate_v4(),
  code text unique,
  name text not null,
  type text,
  size text,
  material text,
  location text,
  quantity integer not null default 0,
  min_quantity integer not null default 0,
  condition tool_condition not null default 'iyi',
  supplier text,
  price numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- jobs / siparişler
-- ============================================================
create table if not exists public.jobs (
  id uuid primary key default uuid_generate_v4(),
  job_no text unique,
  customer text not null,
  part_name text not null,
  part_no text,
  quantity integer not null default 1,
  machine_id uuid references public.machines(id) on delete set null,
  operator_id uuid references public.operators(id) on delete set null,
  status job_status not null default 'beklemede',
  priority integer not null default 3,
  start_date date,
  due_date date,
  completed_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- production_entries (günlük üretim formları)
-- ============================================================
create table if not exists public.production_entries (
  id uuid primary key default uuid_generate_v4(),
  entry_date date not null default current_date,
  shift shift not null,
  machine_id uuid not null references public.machines(id) on delete restrict,
  operator_id uuid references public.operators(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  start_time time,
  end_time time,
  produced_qty integer not null default 0,
  scrap_qty integer not null default 0,
  downtime_minutes integer not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_production_entries_date on public.production_entries(entry_date desc);
create index if not exists idx_production_entries_machine on public.production_entries(machine_id);
create index if not exists idx_production_entries_job on public.production_entries(job_id);

-- ============================================================
-- drawings (teknik resimler)
-- ============================================================
create table if not exists public.drawings (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references public.jobs(id) on delete cascade,
  title text not null,
  file_path text not null, -- storage path
  file_type text,
  file_size bigint,
  revision text,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_drawings_job on public.drawings(job_id);

-- ============================================================
-- job_tools (many-to-many: işler ve kullanılan takımlar)
-- ============================================================
create table if not exists public.job_tools (
  job_id uuid not null references public.jobs(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  quantity_used integer not null default 1,
  notes text,
  primary key (job_id, tool_id)
);

-- ============================================================
-- updated_at triggers
-- ============================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

do $$ declare t text;
begin
  for t in select unnest(array['profiles','machines','operators','tools','jobs','production_entries']) loop
    execute format('drop trigger if exists trg_%1$s_touch on public.%1$s', t);
    execute format('create trigger trg_%1$s_touch before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.machines enable row level security;
alter table public.operators enable row level security;
alter table public.tools enable row level security;
alter table public.jobs enable row level security;
alter table public.production_entries enable row level security;
alter table public.drawings enable row level security;
alter table public.job_tools enable row level security;

-- helper: current user is admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

-- profiles
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin());

-- authenticated-read tables (everybody signed-in can read reference data)
do $$ declare t text;
begin
  for t in select unnest(array['machines','operators','tools','jobs','production_entries','drawings','job_tools']) loop
    execute format('drop policy if exists "%1$s_read_auth" on public.%1$s', t);
    execute format('create policy "%1$s_read_auth" on public.%1$s for select using (auth.uid() is not null)', t);

    execute format('drop policy if exists "%1$s_insert_auth" on public.%1$s', t);
    execute format('create policy "%1$s_insert_auth" on public.%1$s for insert with check (auth.uid() is not null)', t);

    execute format('drop policy if exists "%1$s_update_admin" on public.%1$s', t);
    execute format('create policy "%1$s_update_admin" on public.%1$s for update using (public.is_admin() or auth.uid() is not null)', t);

    execute format('drop policy if exists "%1$s_delete_admin" on public.%1$s', t);
    execute format('create policy "%1$s_delete_admin" on public.%1$s for delete using (public.is_admin())', t);
  end loop;
end $$;

-- ============================================================
-- Seed data (4 machines)
-- ============================================================
insert into public.machines (name, type, status, notes) values
  ('Fanuc', 'Fanuc', 'aktif', 'CNC Tezgah'),
  ('Tekna 1', 'Tekna', 'aktif', 'CNC Tezgah'),
  ('Tekna 2', 'Tekna', 'aktif', 'CNC Tezgah'),
  ('BWX', 'BWX', 'aktif', 'CNC Tezgah')
on conflict (name) do nothing;

-- ============================================================
-- Storage bucket for drawings
-- ============================================================
insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', false)
on conflict (id) do nothing;

-- storage policies
drop policy if exists "drawings_read_auth" on storage.objects;
create policy "drawings_read_auth" on storage.objects
  for select using (bucket_id = 'drawings' and auth.uid() is not null);

drop policy if exists "drawings_upload_auth" on storage.objects;
create policy "drawings_upload_auth" on storage.objects
  for insert with check (bucket_id = 'drawings' and auth.uid() is not null);

drop policy if exists "drawings_update_auth" on storage.objects;
create policy "drawings_update_auth" on storage.objects
  for update using (bucket_id = 'drawings' and auth.uid() is not null);

drop policy if exists "drawings_delete_admin" on storage.objects;
create policy "drawings_delete_admin" on storage.objects
  for delete using (bucket_id = 'drawings' and public.is_admin());

-- ============================================================
-- Helpful views
-- ============================================================
create or replace view public.v_daily_production as
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
