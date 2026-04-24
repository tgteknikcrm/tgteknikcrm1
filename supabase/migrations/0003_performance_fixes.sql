-- TG Teknik CRM - Performance Advisor Fixes
-- Addresses Supabase performance linter warnings:
--   1) auth_rls_initplan    → wrap auth.uid()/is_admin() in (select ...)
--   2) multiple_permissive_policies on profiles → split FOR ALL
--   3) unindexed_foreign_keys → add covering indexes
-- No functional behavior change. All policies are rewritten 1:1.

-- ============================================================
-- 1) profiles — optimize and remove overlapping FOR ALL
-- ============================================================
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
  for select using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
  for update using ((select auth.uid()) = id or (select public.is_admin()));

-- Replace profiles_admin_all (FOR ALL) with narrow INSERT + DELETE
-- SELECT and UPDATE are already covered by the policies above.
drop policy if exists "profiles_admin_all" on public.profiles;

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert" on public.profiles
  for insert with check ((select public.is_admin()));

drop policy if exists "profiles_admin_delete" on public.profiles;
create policy "profiles_admin_delete" on public.profiles
  for delete using ((select public.is_admin()));

-- ============================================================
-- 2) authenticated-read tables — rewrap auth.uid()/is_admin()
-- ============================================================
do $$ declare t text;
begin
  for t in select unnest(array['machines','operators','tools','jobs','production_entries','drawings','job_tools']) loop
    execute format('drop policy if exists "%1$s_read_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_read_auth" on public.%1$s for select using ((select auth.uid()) is not null)',
      t);

    execute format('drop policy if exists "%1$s_insert_auth" on public.%1$s', t);
    execute format(
      'create policy "%1$s_insert_auth" on public.%1$s for insert with check ((select auth.uid()) is not null)',
      t);

    execute format('drop policy if exists "%1$s_update_admin" on public.%1$s', t);
    execute format(
      'create policy "%1$s_update_admin" on public.%1$s for update using ((select public.is_admin()) or (select auth.uid()) is not null)',
      t);

    execute format('drop policy if exists "%1$s_delete_admin" on public.%1$s', t);
    execute format(
      'create policy "%1$s_delete_admin" on public.%1$s for delete using ((select public.is_admin()))',
      t);
  end loop;
end $$;

-- ============================================================
-- 3) storage.objects (drawings bucket) — same rewrap
-- ============================================================
drop policy if exists "drawings_read_auth" on storage.objects;
create policy "drawings_read_auth" on storage.objects
  for select using (bucket_id = 'drawings' and (select auth.uid()) is not null);

drop policy if exists "drawings_upload_auth" on storage.objects;
create policy "drawings_upload_auth" on storage.objects
  for insert with check (bucket_id = 'drawings' and (select auth.uid()) is not null);

drop policy if exists "drawings_update_auth" on storage.objects;
create policy "drawings_update_auth" on storage.objects
  for update using (bucket_id = 'drawings' and (select auth.uid()) is not null);

drop policy if exists "drawings_delete_admin" on storage.objects;
create policy "drawings_delete_admin" on storage.objects
  for delete using (bucket_id = 'drawings' and (select public.is_admin()));

-- ============================================================
-- 4) Covering indexes for foreign keys
-- ============================================================
create index if not exists idx_drawings_uploaded_by on public.drawings(uploaded_by);
create index if not exists idx_jobs_created_by on public.jobs(created_by);
create index if not exists idx_jobs_machine_id on public.jobs(machine_id);
create index if not exists idx_jobs_operator_id on public.jobs(operator_id);
create index if not exists idx_operators_profile_id on public.operators(profile_id);
create index if not exists idx_production_entries_created_by on public.production_entries(created_by);
create index if not exists idx_production_entries_operator_id on public.production_entries(operator_id);
create index if not exists idx_job_tools_tool_id on public.job_tools(tool_id);
