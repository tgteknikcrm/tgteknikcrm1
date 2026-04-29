-- Last-seen heartbeat for messenger-style "online / 5 min ago" hints.
-- Updated periodically from the client (PresenceHeartbeat).

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_last_seen_idx
  on public.profiles(last_seen_at desc nulls last);
