-- Per-user chat wallpaper. Stored on conversation_participants so each
-- member can pick their own background for the same conversation
-- (WhatsApp-style — your wallpaper is yours).
--
-- Format: a short string like "pattern:dots#3b82f6" or a plain hex like
-- "#1f2937". The UI parses it; null/empty means "default theme".

alter table public.conversation_participants
  add column if not exists wallpaper text;
