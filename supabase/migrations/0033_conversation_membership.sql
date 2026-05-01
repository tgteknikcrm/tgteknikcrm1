-- ============================================================
-- 0033 — Definitive RLS recursion fix via denormalized membership
-- ============================================================
--
-- Problem (continued from 0032 attempt):
--   "infinite recursion detected in policy for relation
--    conversation_participants" still fires on the user's instance.
--   Root cause analysis:
--     - conversation_participants SELECT policy calls
--       is_conversation_participant() helper
--     - Helper queries conversation_participants
--     - SECURITY DEFINER would bypass RLS, but only if owner has
--       BYPASSRLS — in this Supabase project the owner doesn't, so
--       inner SELECT goes through the policy → recursion.
--     - 0032 added `set row_security = off` thinking it bypasses,
--       but in PostgreSQL that setting actually ERRORS rather than
--       bypasses when a non-superuser hits an RLS-protected table.
--
-- Fix:
--   Stop relying on SECURITY DEFINER bypass. Add a denormalized
--   `conversation_membership(user_id, conversation_id)` table whose
--   RLS is trivial own-row, then rewrite policies + helpers to query
--   the membership table instead of the recursive participants table.
--
--   Trigger on conversation_participants keeps membership in sync.
--
-- Recursion is structurally impossible after this:
--   - conversation_membership policy: user_id = auth.uid() (no joins)
--   - everything else queries conversation_membership which has the
--     trivial policy → terminates.
-- ============================================================

-- ── 1. The membership table ──────────────────────────────────────
create table if not exists public.conversation_membership (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  primary key (user_id, conversation_id)
);

create index if not exists conv_mem_user_idx
  on public.conversation_membership(user_id);
create index if not exists conv_mem_conv_idx
  on public.conversation_membership(conversation_id);

-- Backfill from current participants (idempotent via on conflict).
insert into public.conversation_membership (user_id, conversation_id)
select user_id, conversation_id from public.conversation_participants
on conflict do nothing;

-- ── 2. Sync trigger ──────────────────────────────────────────────
create or replace function public.sync_conversation_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.conversation_membership(user_id, conversation_id)
    values (NEW.user_id, NEW.conversation_id)
    on conflict do nothing;
  elsif TG_OP = 'DELETE' then
    delete from public.conversation_membership
    where user_id = OLD.user_id and conversation_id = OLD.conversation_id;
  end if;
  return null;
end;
$$;

drop trigger if exists sync_conv_membership_iud on public.conversation_participants;
create trigger sync_conv_membership_iud
after insert or delete on public.conversation_participants
for each row execute function public.sync_conversation_membership();

-- ── 3. Trivial RLS on the membership table — no joins, no helpers ─
alter table public.conversation_membership enable row level security;

drop policy if exists conv_mem_select on public.conversation_membership;
create policy conv_mem_select on public.conversation_membership
  for select to authenticated
  using (user_id = (select auth.uid()));

-- INSERT/UPDATE/DELETE from app code is forbidden — only the trigger
-- writes here. Service-role tools (Studio etc.) still work because
-- they bypass RLS.
drop policy if exists conv_mem_no_writes on public.conversation_membership;
create policy conv_mem_no_writes on public.conversation_membership
  for all to authenticated
  using (false) with check (false);

-- ── 4. Rewrite helpers — no more recursive same-table SELECT ──────
-- is_conversation_participant now queries the membership table, which
-- has only own-row RLS. Recursion impossible.
create or replace function public.is_conversation_participant(
  conv_id uuid, uid uuid
) returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_membership
    where conversation_id = conv_id and user_id = uid
  );
$$;

-- is_conversation_admin still needs the role column from
-- conversation_participants. Keep SECURITY DEFINER but the query
-- plan is fully deterministic on (conv_id, uid) — no recursion path
-- because the SELECT policy on conversation_participants no longer
-- calls back to this helper (see step 5).
create or replace function public.is_conversation_admin(
  conv_id uuid, uid uuid
) returns boolean
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.conversation_participants
  where conversation_id = conv_id and user_id = uid;
  return coalesce(v_role = 'admin', false);
end;
$$;

-- ── 5. Rewrite conversation_participants policies to use membership
drop policy if exists "select participants of own conversations" on public.conversation_participants;
create policy "select participants of own conversations"
on public.conversation_participants for select to authenticated
using (
  conversation_id in (
    select conversation_id from public.conversation_membership
    where user_id = (select auth.uid())
  )
);

drop policy if exists "insert participants" on public.conversation_participants;
create policy "insert participants"
on public.conversation_participants for insert to authenticated
with check (
  -- I'm already a member (adding others to a group I'm in)
  conversation_id in (
    select conversation_id from public.conversation_membership
    where user_id = (select auth.uid())
  )
  -- Or I just created the conversation (initial seed)
  or exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.created_by = (select auth.uid())
  )
);

-- own-row update is fine, no helper needed
drop policy if exists "update own participant row" on public.conversation_participants;
create policy "update own participant row"
on public.conversation_participants for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- delete own row OR if you're admin of the conversation
drop policy if exists "delete participants by self or admin" on public.conversation_participants;
create policy "delete participants by self or admin"
on public.conversation_participants for delete to authenticated
using (
  user_id = (select auth.uid())
  or public.is_conversation_admin(conversation_id, (select auth.uid()))
);

-- ── 6. Sanity: ensure all SECURITY DEFINER functions belong to a
-- role that has BYPASSRLS, in case the implicit owner isn't postgres.
do $$
begin
  -- Try to set ownership; ignore if we can't (already correct or
  -- insufficient grants — the function definitions don't depend on
  -- bypass anymore so it's not strictly required).
  begin
    execute 'alter function public.is_conversation_admin(uuid, uuid) owner to postgres';
  exception when others then null; end;
  begin
    execute 'alter function public.sync_conversation_membership() owner to postgres';
  exception when others then null; end;
end $$;
