-- TG Teknik CRM - Phone-based auth support
-- Strategy: virtual email pattern (no SMS provider required).
-- Clients normalize phone to E.164 (+90...), then sign in/up with
--   email = "<digits>@tgteknik.local", password = user password.
-- Real phone is stored in profiles.phone and auth user_meta_data.
-- Admin detection: if phone = ADMIN_PHONE at signup → auto-admin.

-- ============================================================
-- 1) profiles.email must be nullable (virtual emails are fine,
--    but future direct-phone-auth users may not have one).
-- ============================================================
alter table public.profiles alter column email drop not null;

-- ============================================================
-- 2) Rewrite handle_new_user() to support phone-based signup
--    and promote the configured admin phone to admin role.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_phone  text;
  meta_name   text;
  is_admin_u  boolean;
begin
  meta_phone := new.raw_user_meta_data->>'phone';
  meta_name  := new.raw_user_meta_data->>'full_name';

  -- Admin if registered with the admin phone OR the legacy admin email.
  is_admin_u := (
    meta_phone = '+905426469070'
    or new.email = 'tgteknikcrm@outlook.com'
  );

  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(meta_name, meta_phone, new.email),
    meta_phone,
    case when is_admin_u then 'admin'::user_role else 'operator'::user_role end
  )
  on conflict (id) do nothing;

  return new;
end $$;

-- Re-attach trigger (drop-and-create is idempotent).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 3) Index on profiles.phone for fast admin lookup.
-- ============================================================
create index if not exists idx_profiles_phone on public.profiles(phone);
