-- ============================================================
-- 0035 — post-membership messaging fixes
-- ============================================================
--
-- 0033 conversation_membership tablosunu kurduktan sonra iki
-- regresyon ortaya çıktı:
--   1) "yeni kişi ile sohbete başlarken hata" — conversations SELECT
--      policy yalnız `is_conversation_participant`'a bakıyordu;
--      yeni oluşturulmuş bir konuşmaya creator'ın daha membership
--      satırı yok (trigger AFTER INSERT olduğu için), policy creator'ı
--      bloklamıyordu kendi conv'ını görmesini → INSERT participant
--      OR-branch zinciri kırılıyordu.
--   2) "mesajı silsem bile DB'de deleted_at NULL kalıyor" —
--      soft_delete_message UPDATE silently RLS-blocked oluyor
--      (SECURITY DEFINER + Supabase'de owner BYPASSRLS değil
--      olabilir), RAISE etmiyor → frontend success sanıyor.
--
-- Fix:
--   - Membership re-backfill (eski conv'lar için sigorta).
--   - soft_delete_message UPDATE'inde RETURNING ile satır kontrolü;
--     0 satır etkilenmişse `rls_blocked_update` exception fırlat.
--   - conversations SELECT + UPDATE policy'lerine `created_by =
--     auth.uid()` OR-branch eklendi.
--   - Helper'ları postgres'e ata (BYPASSRLS için best-effort).
-- ============================================================

-- 1. Re-backfill membership
insert into public.conversation_membership (user_id, conversation_id)
select user_id, conversation_id from public.conversation_participants
on conflict do nothing;

-- 2. soft_delete_message: RLS-blocked UPDATE'i RAISE et
create or replace function public.soft_delete_message(p_message_id uuid)
returns table(message_id uuid, conversation_id uuid, deleted_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_msg record;
  v_now timestamptz := now();
  v_updated uuid;
begin
  if v_uid is null then raise exception 'auth_required' using errcode = '42501'; end if;
  select id, author_id, conversation_id into v_msg
    from public.messages where id = p_message_id;
  if v_msg.id is null then raise exception 'message_not_found' using errcode = 'P0002'; end if;
  if v_msg.author_id is distinct from v_uid then
    raise exception 'not_your_message' using errcode = '42501';
  end if;
  update public.messages set deleted_at = v_now, body = null
    where id = p_message_id
    returning id into v_updated;
  if v_updated is null then
    raise exception 'rls_blocked_update' using errcode = '42501';
  end if;
  return query select v_msg.id, v_msg.conversation_id, v_now;
end;
$$;
grant execute on function public.soft_delete_message(uuid) to authenticated;

-- 3. conversations SELECT + UPDATE: creator de erişsin
drop policy if exists "select conversations as participant" on public.conversations;
create policy "select conversations as participant"
on public.conversations for select to authenticated
using (
  created_by = (select auth.uid())
  or public.is_conversation_participant(id, (select auth.uid()))
);

drop policy if exists "update conversations as participant" on public.conversations;
create policy "update conversations as participant"
on public.conversations for update to authenticated
using (
  created_by = (select auth.uid())
  or public.is_conversation_participant(id, (select auth.uid()))
)
with check (
  created_by = (select auth.uid())
  or public.is_conversation_participant(id, (select auth.uid()))
);

-- 4. Helper'lara postgres ownership (BYPASSRLS için best-effort).
--    İstediğimiz: SECURITY DEFINER fonksiyonların inner SELECT/UPDATE'i
--    RLS'i bypass etsin. Bu, owner'ın BYPASSRLS attribute'una sahip
--    olmasıyla mümkün. Supabase'de postgres bu attribute'a sahip.
do $$ begin
  execute 'alter function public.is_conversation_participant(uuid, uuid) owner to postgres';
exception when others then null; end $$;
do $$ begin
  execute 'alter function public.is_conversation_admin(uuid, uuid) owner to postgres';
exception when others then null; end $$;
do $$ begin
  execute 'alter function public.soft_delete_message(uuid) owner to postgres';
exception when others then null; end $$;
do $$ begin
  execute 'alter function public.complete_job_rpc(uuid, int) owner to postgres';
exception when others then null; end $$;
do $$ begin
  execute 'alter function public.sync_conversation_membership() owner to postgres';
exception when others then null; end $$;
