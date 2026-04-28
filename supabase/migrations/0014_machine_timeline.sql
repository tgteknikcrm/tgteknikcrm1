-- TG Teknik CRM - Machine Timeline (per-machine social feed)
-- Manual entries with photos, comments, like/dislike reactions.
-- Read-only system events (production_entries, quality_reviews,
-- activity_events) are merged in at query time on the page.

do $$ begin
  create type timeline_entry_kind as enum (
    'manuel',
    'bakim',
    'temizlik',
    'ariza',
    'duzeltme',
    'parca_degisimi',
    'sayim',
    'gozlem'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.machine_timeline_entries (
  id uuid primary key default uuid_generate_v4(),
  machine_id uuid not null references public.machines(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  kind timeline_entry_kind not null default 'manuel',
  title text,
  body text,
  photo_paths jsonb not null default '[]'::jsonb,
  duration_minutes int,
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mte_machine_at
  on public.machine_timeline_entries(machine_id, happened_at desc);
create index if not exists idx_mte_author
  on public.machine_timeline_entries(author_id);

drop trigger if exists trg_mte_touch on public.machine_timeline_entries;
create trigger trg_mte_touch
  before update on public.machine_timeline_entries
  for each row execute function public.touch_updated_at();

create table if not exists public.timeline_comments (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references public.machine_timeline_entries(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tc_entry on public.timeline_comments(entry_id, created_at);

create table if not exists public.timeline_reactions (
  id uuid primary key default uuid_generate_v4(),
  entry_id uuid not null references public.machine_timeline_entries(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('like','dislike')),
  created_at timestamptz not null default now(),
  unique (entry_id, author_id)
);

create index if not exists idx_tr_entry on public.timeline_reactions(entry_id);

alter table public.machine_timeline_entries enable row level security;
alter table public.timeline_comments enable row level security;
alter table public.timeline_reactions enable row level security;

do $$ declare t text;
begin
  for t in select unnest(array['machine_timeline_entries','timeline_comments','timeline_reactions']) loop
    execute format('drop policy if exists "%1$s_read_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_read_auth" on public.%1$s for select using ((select auth.uid()) is not null)', t);
    execute format('drop policy if exists "%1$s_insert_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_insert_auth" on public.%1$s for insert with check ((select auth.uid()) is not null)', t);
  end loop;
end $$;

drop policy if exists "mte_update_self_admin" on public.machine_timeline_entries;
create policy "mte_update_self_admin" on public.machine_timeline_entries
  for update using (author_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "mte_delete_self_admin" on public.machine_timeline_entries;
create policy "mte_delete_self_admin" on public.machine_timeline_entries
  for delete using (author_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "tc_delete_self_admin" on public.timeline_comments;
create policy "tc_delete_self_admin" on public.timeline_comments
  for delete using (author_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "tr_update_self" on public.timeline_reactions;
create policy "tr_update_self" on public.timeline_reactions
  for update using (author_id = (select auth.uid()));

drop policy if exists "tr_delete_self" on public.timeline_reactions;
create policy "tr_delete_self" on public.timeline_reactions
  for delete using (author_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('timeline-photos', 'timeline-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "tlp_public_read" on storage.objects;
create policy "tlp_public_read" on storage.objects
  for select using (bucket_id = 'timeline-photos');

drop policy if exists "tlp_auth_insert" on storage.objects;
create policy "tlp_auth_insert" on storage.objects
  for insert with check (
    bucket_id = 'timeline-photos' and (select auth.uid()) is not null
  );

drop policy if exists "tlp_auth_update" on storage.objects;
create policy "tlp_auth_update" on storage.objects
  for update using (
    bucket_id = 'timeline-photos' and (select auth.uid()) is not null
  );

drop policy if exists "tlp_auth_delete" on storage.objects;
create policy "tlp_auth_delete" on storage.objects
  for delete using (
    bucket_id = 'timeline-photos' and (select auth.uid()) is not null
  );
