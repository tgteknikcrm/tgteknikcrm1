-- Where the attachment binary lives. Existing rows stay on Supabase
-- storage; new uploads go to R2 (when env vars are configured).

alter table public.message_attachments
  add column if not exists provider text not null default 'supabase';

-- Tighten with a check constraint (drop-and-recreate guards re-runs).
alter table public.message_attachments
  drop constraint if exists message_attachments_provider_check;
alter table public.message_attachments
  add constraint message_attachments_provider_check
  check (provider in ('supabase', 'r2'));

create index if not exists message_attachments_provider_idx
  on public.message_attachments(provider);
