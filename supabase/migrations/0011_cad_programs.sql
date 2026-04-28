-- TG Teknik CRM - CAD/CAM Programs
-- Stores NC/G-code programs and CAD source files (PDF, STEP, STL, DXF...).
-- Optional links to a machine and/or job for context.
-- Private bucket: NC/G-code may contain customer IP, signed URLs only.

create table if not exists public.cad_programs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  machine_id uuid references public.machines(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  file_path text not null,
  file_type text,
  file_size bigint,
  revision text,
  notes text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cad_machine on public.cad_programs(machine_id);
create index if not exists idx_cad_job on public.cad_programs(job_id);
create index if not exists idx_cad_uploader on public.cad_programs(uploaded_by);

drop trigger if exists trg_cad_touch on public.cad_programs;
create trigger trg_cad_touch
  before update on public.cad_programs
  for each row execute function public.touch_updated_at();

alter table public.cad_programs enable row level security;

drop policy if exists "cad_read_auth" on public.cad_programs;
create policy "cad_read_auth" on public.cad_programs
  for select using ((select auth.uid()) is not null);

drop policy if exists "cad_insert_auth" on public.cad_programs;
create policy "cad_insert_auth" on public.cad_programs
  for insert with check ((select auth.uid()) is not null);

drop policy if exists "cad_update_auth" on public.cad_programs;
create policy "cad_update_auth" on public.cad_programs
  for update using ((select auth.uid()) is not null);

drop policy if exists "cad_delete_auth" on public.cad_programs;
create policy "cad_delete_auth" on public.cad_programs
  for delete using ((select auth.uid()) is not null);

insert into storage.buckets (id, name, public)
values ('cad-programs', 'cad-programs', false)
on conflict (id) do nothing;

drop policy if exists "cad_storage_read_auth" on storage.objects;
create policy "cad_storage_read_auth" on storage.objects
  for select using (
    bucket_id = 'cad-programs' and (select auth.uid()) is not null
  );

drop policy if exists "cad_storage_insert_auth" on storage.objects;
create policy "cad_storage_insert_auth" on storage.objects
  for insert with check (
    bucket_id = 'cad-programs' and (select auth.uid()) is not null
  );

drop policy if exists "cad_storage_update_auth" on storage.objects;
create policy "cad_storage_update_auth" on storage.objects
  for update using (
    bucket_id = 'cad-programs' and (select auth.uid()) is not null
  );

drop policy if exists "cad_storage_delete_admin" on storage.objects;
create policy "cad_storage_delete_admin" on storage.objects
  for delete using (
    bucket_id = 'cad-programs' and (select public.is_admin())
  );
