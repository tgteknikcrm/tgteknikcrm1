-- ============================================================
-- 0032 — conversation_participants RLS recursion kalıcı fix
-- ============================================================
--
-- Problem: kullanıcı mesaj silmeye / liste açmaya çalışırken
-- "infinite recursion detected in policy for relation
-- conversation_participants" alıyor.
--
-- Sebep: is_conversation_participant() SECURITY DEFINER ama
-- Supabase'de fonksiyonun owner'ı BYPASSRLS değil. SECURITY DEFINER
-- inner SELECT'i de policy'i tetikliyor → policy aynı fonksiyonu
-- çağırıyor → sonsuz döngü.
--
-- Çözüm: SECURITY DEFINER fonksiyona `set row_security = off`
-- ekle. Bu, fonksiyonun execution context'inde RLS'i devre dışı
-- bırakır → inner SELECT policy'i tetiklemez → recursion biter.
--
-- Aynı pattern calendar 0021 migration'ında da kullanılmıştı —
-- bu sefer messaging tarafında aynı düzeltmeyi yapıyoruz.
--
-- Ek olarak: "delete participants by self or admin" policy'sinde
-- inline subquery vardı (admin kontrolü için kendi tablosuna
-- bakıyor) → recursion riski. Onu da bir helper'a taşıyoruz.
-- ============================================================

create or replace function public.is_conversation_participant(
  conv_id uuid, uid uuid
) returns boolean
language sql
security definer
stable
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = uid
  );
$$;

-- Yeni helper: aynı recursion-güvenli pattern, admin kontrolü için.
create or replace function public.is_conversation_admin(
  conv_id uuid, uid uuid
) returns boolean
language sql
security definer
stable
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id
      and user_id = uid
      and role = 'admin'
  );
$$;

-- Eski "delete participants by self or admin" policy'si subquery'li
-- — onu helper kullanan haline değiştir.
drop policy if exists "delete participants by self or admin"
  on public.conversation_participants;

create policy "delete participants by self or admin"
on public.conversation_participants for delete to authenticated
using (
  user_id = (select auth.uid())
  or public.is_conversation_admin(
       conversation_id, (select auth.uid())
     )
);

-- Aynısını insert participants policy'si için de sağlamlaştır:
-- önceki sürümde subquery vardı, helper'a alalım.
drop policy if exists "insert participants" on public.conversation_participants;
create policy "insert participants"
on public.conversation_participants for insert to authenticated
with check (
  public.is_conversation_participant(
    conversation_id, (select auth.uid())
  )
  or exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.created_by = (select auth.uid())
  )
);
