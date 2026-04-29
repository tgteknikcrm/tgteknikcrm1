-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Fix RLS for INSERT...RETURNING on messaging tables.             │
-- │                                                                  │
-- │  PostgREST does INSERT...RETURNING for `.insert().select()`,     │
-- │  which requires *both* the WITH CHECK policy and the SELECT      │
-- │  policy to pass for the new row. Our original policies relied    │
-- │  on `is_conversation_participant`, but at the moment of the      │
-- │  very first insert (creating a conversation, or seeding the      │
-- │  first participant row), that helper still returns false because │
-- │  the participant row hasn't been committed yet.                  │
-- │                                                                  │
-- │  Fix: widen the SELECT policies so the creator/self can read     │
-- │  rows they're authoring even before participants are seeded.     │
-- └──────────────────────────────────────────────────────────────────┘

-- conversations: creator can also see their own conversation
drop policy if exists "select conversations as participant" on public.conversations;
drop policy if exists "select conversations as participant or creator" on public.conversations;
create policy "select conversations as participant or creator"
on public.conversations for select to authenticated
using (
  public.is_conversation_participant(id, (select auth.uid()))
  or created_by = (select auth.uid())
);

-- conversation_participants: I can always see my own participant rows;
-- creators can see all participants of their conversation. This lets the
-- "seed participants right after creating a conversation" flow work.
drop policy if exists "select participants of own conversations" on public.conversation_participants;
drop policy if exists "select participants — self or co-member or creator"
  on public.conversation_participants;
create policy "select participants — self or co-member or creator"
on public.conversation_participants for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_conversation_participant(conversation_id, (select auth.uid()))
  or exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.created_by = (select auth.uid())
  )
);
