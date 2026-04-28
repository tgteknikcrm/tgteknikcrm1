-- TG Teknik CRM - Tool Images
-- Adds:
--   tools.image_path  — single optional image per tool (storage path)
--   storage bucket    — public 'tool-images' bucket (not sensitive, simpler URLs)

-- ============================================================
-- Schema change
-- ============================================================
alter table public.tools
  add column if not exists image_path text;

-- ============================================================
-- Public bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('tool-images', 'tool-images', true)
on conflict (id) do update set public = true;

-- ============================================================
-- Storage RLS policies
-- Public read · authenticated write/update · admin delete
-- ============================================================
drop policy if exists "tool_images_public_read" on storage.objects;
create policy "tool_images_public_read" on storage.objects
  for select using (bucket_id = 'tool-images');

drop policy if exists "tool_images_auth_insert" on storage.objects;
create policy "tool_images_auth_insert" on storage.objects
  for insert with check (
    bucket_id = 'tool-images'
    and (select auth.uid()) is not null
  );

drop policy if exists "tool_images_auth_update" on storage.objects;
create policy "tool_images_auth_update" on storage.objects
  for update using (
    bucket_id = 'tool-images'
    and (select auth.uid()) is not null
  );

drop policy if exists "tool_images_auth_delete" on storage.objects;
create policy "tool_images_auth_delete" on storage.objects
  for delete using (
    bucket_id = 'tool-images'
    and (select auth.uid()) is not null
  );
