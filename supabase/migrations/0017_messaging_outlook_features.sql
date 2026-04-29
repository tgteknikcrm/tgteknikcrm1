-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Outlook-style messaging extras: archive, pin, tags.             │
-- │  All per-user (stored on conversation_participants) so each      │
-- │  member archives/pins/tags their own copy of the conversation.   │
-- └──────────────────────────────────────────────────────────────────┘

alter table public.conversation_participants
  add column if not exists archived_at timestamptz,
  add column if not exists pinned_at timestamptz,
  add column if not exists tags text[] not null default '{}';

create index if not exists conversation_participants_archived_idx
  on public.conversation_participants(user_id) where archived_at is null;

create index if not exists conversation_participants_pinned_idx
  on public.conversation_participants(user_id, pinned_at desc nulls last);
