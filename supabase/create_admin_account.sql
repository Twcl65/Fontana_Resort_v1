-- Create a new Admin account (Auth + fontana_users profile)
-- Run in Supabase SQL Editor.
--
-- 1) Edit these values before running:
--    v_email      -> admin login email
--    v_password   -> admin login password (min 6 chars)
--    v_full_name  -> display name
--
-- 2) This script creates:
--    - auth.users row
--    - auth.identities row (email provider)
--    - public.fontana_users row with role='admin'

do $$
declare
  v_email text := 'admin@gmail.com';
  v_password text := 'admin';
  v_full_name text := 'Fontana Owner Admin';
  v_user_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users u where lower(u.email) = lower(v_email)) then
    raise exception 'Auth user with email % already exists.', v_email;
  end if;

  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    'authenticated',
    'authenticated',
    lower(v_email),
    crypt(v_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', v_full_name),
    now(),
    now()
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', lower(v_email)),
    'email',
    v_user_id::text,
    now(),
    now()
  );

  insert into public.fontana_users (id, full_name, email, role, status)
  values (v_user_id, v_full_name, lower(v_email), 'admin', 'active')
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    role = 'admin',
    status = 'active';

  raise notice 'Admin account created: % (id=%)', lower(v_email), v_user_id;
end $$;
