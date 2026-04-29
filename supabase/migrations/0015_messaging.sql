-- ┌──────────────────────────────────────────────────────────────────┐
-- │  Messaging system — direct + group conversations, attachments,   │
-- │  realtime, and storage. Modeled after Messenger/WhatsApp.        │
-- └──────────────────────────────────────────────────────────────────┘

-- Enum for conversation type
do $$
begin
  if not exists (select 1 from pg_type where typname = 'conversation_kind') then
    create type public.conversation_kind as enum ('direct', 'group');
  end if;
end $$;

-- Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind public.conversation_kind not null default 'direct',
  title text,
  color text default '#3b82f6',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  last_message_preview text
);
create index if not exists conversations_last_message_at_idx
  on public.conversations(last_message_at desc nulls last);

-- Participants
create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists conversation_participants_user_id_idx
  on public.conversation_participants(user_id);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text,
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at desc);

-- Attachments
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists message_attachments_message_id_idx
  on public.message_attachments(message_id);

-- ─── Helper: SECURITY DEFINER lookup avoids RLS recursion ───────────
create or replace function public.is_conversation_participant(
  conv_id uuid, uid uuid
) returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = uid
  );
$$;

-- Bump conversation metadata on each new message
create or replace function public.bump_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message_at = NEW.created_at,
    last_message_preview = coalesce(
      nullif(NEW.body, ''),
      '[Dosya]'
    ),
    updated_at = NEW.created_at
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists after_insert_message_bump_convo on public.messages;
create trigger after_insert_message_bump_convo
after insert on public.messages
for each row execute function public.bump_conversation_after_message();

-- ─── Row Level Security ───────────────────────────────────────────
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_attachments enable row level security;

-- conversations
drop policy if exists "select conversations as participant" on public.conversations;
create policy "select conversations as participant"
on public.conversations for select to authenticated
using (public.is_conversation_participant(id, (select auth.uid())));

drop policy if exists "insert conversations as creator" on public.conversations;
create policy "insert conversations as creator"
on public.conversations for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "update conversations as participant" on public.conversations;
create policy "update conversations as participant"
on public.conversations for update to authenticated
using (public.is_conversation_participant(id, (select auth.uid())))
with check (public.is_conversation_participant(id, (select auth.uid())));

-- conversation_participants
drop policy if exists "select participants of own conversations" on public.conversation_participants;
create policy "select participants of own conversations"
on public.conversation_participants for select to authenticated
using (public.is_conversation_participant(conversation_id, (select auth.uid())));

drop policy if exists "insert participants" on public.conversation_participants;
create policy "insert participants"
on public.conversation_participants for insert to authenticated
with check (
  -- Either you're already a participant (adding others) or you just created
  -- the conversation (initial seed of yourself + recipients).
  public.is_conversation_participant(conversation_id, (select auth.uid()))
  or exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.created_by = (select auth.uid())
  )
);

drop policy if exists "update own participant row" on public.conversation_participants;
create policy "update own participant row"
on public.conversation_participants for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "delete participants by self or admin" on public.conversation_participants;
create policy "delete participants by self or admin"
on public.conversation_participants for delete to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversation_participants.conversation_id
    and cp.user_id = (select auth.uid())
    and cp.role = 'admin'
  )
);

-- messages
drop policy if exists "select messages as participant" on public.messages;
create policy "select messages as participant"
on public.messages for select to authenticated
using (public.is_conversation_participant(conversation_id, (select auth.uid())));

drop policy if exists "insert messages as participant" on public.messages;
create policy "insert messages as participant"
on public.messages for insert to authenticated
with check (
  public.is_conversation_participant(conversation_id, (select auth.uid()))
  and author_id = (select auth.uid())
);

drop policy if exists "update own messages" on public.messages;
create policy "update own messages"
on public.messages for update to authenticated
using (author_id = (select auth.uid()))
with check (author_id = (select auth.uid()));

-- message_attachments
drop policy if exists "select attachments as participant" on public.message_attachments;
create policy "select attachments as participant"
on public.message_attachments for select to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id = message_id
    and public.is_conversation_participant(m.conversation_id, (select auth.uid()))
  )
);

drop policy if exists "insert attachments for own message" on public.message_attachments;
create policy "insert attachments for own message"
on public.message_attachments for insert to authenticated
with check (
  exists (
    select 1 from public.messages m
    where m.id = message_id and m.author_id = (select auth.uid())
  )
);

-- ─── Profiles: allow authenticated users to see other active users
-- so we can populate the "start new conversation" picker.
drop policy if exists profiles_select_active_visible on public.profiles;
create policy profiles_select_active_visible
on public.profiles for select to authenticated
using (active = true);

-- ─── Realtime publication ────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- Add tables one by one, ignoring if they're already in the publication
    begin
      alter publication supabase_realtime add table public.messages;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.conversations;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.conversation_participants;
    exception when duplicate_object then null; end;
    begin
      alter publication supabase_realtime add table public.message_attachments;
    exception when duplicate_object then null; end;
  end if;
end $$;

-- ─── Storage bucket + policies ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('message-attachments', 'message-attachments', false)
on conflict (id) do nothing;

drop policy if exists "Message attachments — read as participant" on storage.objects;
create policy "Message attachments — read as participant"
on storage.objects for select to authenticated
using (
  bucket_id = 'message-attachments'
  and exists (
    select 1
    from public.message_attachments ma
    join public.messages m on m.id = ma.message_id
    where ma.storage_path = name
    and public.is_conversation_participant(m.conversation_id, (select auth.uid()))
  )
);

drop policy if exists "Message attachments — upload to own folder" on storage.objects;
create policy "Message attachments — upload to own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Message attachments — delete own folder" on storage.objects;
create policy "Message attachments — delete own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
