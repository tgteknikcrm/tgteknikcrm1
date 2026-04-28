-- TG Teknik CRM - Quality Reviews (sign-off / approval trail)
-- ALCOA+ uyumlu denetim izi: kim onayladı, ne zaman, hangi rolde, not.
-- Bir iş için birden fazla onay olabilir (operatör + kontrolör + onaylayan).

do $$ begin
  create type qc_reviewer_role as enum (
    'operator',     -- üretimi yapan operatör
    'kontrolor',    -- kalite kontrolör
    'onaylayan'     -- son onay (atölye sahibi / yönetici)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type qc_review_status as enum (
    'onaylandi',    -- OK olarak imzalandı
    'reddedildi',   -- NOK / red
    'koşullu'       -- şartlı kabul (notla)
  );
exception when duplicate_object then null; end $$;

create table if not exists public.quality_reviews (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  reviewer_role qc_reviewer_role not null default 'kontrolor',
  status qc_review_status not null default 'onaylandi',
  notes text,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_qr_job on public.quality_reviews(job_id);
create index if not exists idx_qr_reviewer on public.quality_reviews(reviewer_id);
create index if not exists idx_qr_at on public.quality_reviews(reviewed_at desc);

alter table public.quality_reviews enable row level security;

drop policy if exists "qr_read_auth" on public.quality_reviews;
create policy "qr_read_auth" on public.quality_reviews
  for select using ((select auth.uid()) is not null);

drop policy if exists "qr_insert_auth" on public.quality_reviews;
create policy "qr_insert_auth" on public.quality_reviews
  for insert with check ((select auth.uid()) is not null);

drop policy if exists "qr_update_self_or_admin" on public.quality_reviews;
create policy "qr_update_self_or_admin" on public.quality_reviews
  for update using (
    reviewer_id = (select auth.uid()) or (select public.is_admin())
  );

drop policy if exists "qr_delete_self_or_admin" on public.quality_reviews;
create policy "qr_delete_self_or_admin" on public.quality_reviews
  for delete using (
    reviewer_id = (select auth.uid()) or (select public.is_admin())
  );
