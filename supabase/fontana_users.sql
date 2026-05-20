-- Run in Supabase SQL Editor.
--
-- ADMIN project: run full script (includes auth trigger on auth.users).
-- CUSTOMER project: run full script (trigger section is safe — drops auth trigger; no auth.users dependency).
--
-- id must always match the auth user id from the ADMIN project.

create table if not exists public.fontana_users (
  id uuid primary key,
  full_name text,
  email text not null unique,
  role text not null default 'client' check (role in ('admin', 'cashier', 'client')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- Ensure old broken objects do not interfere with auth signup/oauth flows.
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists trg_handle_new_auth_user on auth.users;
drop function if exists public.handle_new_auth_user();

alter table public.fontana_users enable row level security;

-- Read own profile row
drop policy if exists "fontana_users_select_own" on public.fontana_users;
create policy "fontana_users_select_own"
on public.fontana_users
for select
to authenticated
using (auth.uid() = id);

-- Insert own profile row only, using auth uid as id
drop policy if exists "fontana_users_insert_own" on public.fontana_users;
create policy "fontana_users_insert_own"
on public.fontana_users
for insert
to authenticated
with check (auth.uid() = id);

-- Update own profile row only
drop policy if exists "fontana_users_update_own" on public.fontana_users;
create policy "fontana_users_update_own"
on public.fontana_users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Admin checks must NOT subquery fontana_users inside policies (that re-enters RLS → infinite recursion).
-- SECURITY DEFINER reads the role with table-owner privileges, bypassing RLS.
create or replace function public.fontana_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fontana_users u
    where u.id = auth.uid()
      and u.role = 'admin'
      and u.status = 'active'
  );
$$;

grant execute on function public.fontana_is_admin() to authenticated;

-- Admin: read all users for admin user management page
drop policy if exists "fontana_users_admin_select_all" on public.fontana_users;
create policy "fontana_users_admin_select_all"
on public.fontana_users
for select
to authenticated
using (public.fontana_is_admin());

-- Admin: update any user role/status/profile
drop policy if exists "fontana_users_admin_update_all" on public.fontana_users;
create policy "fontana_users_admin_update_all"
on public.fontana_users
for update
to authenticated
using (public.fontana_is_admin())
with check (public.fontana_is_admin());

-- Admin: delete users from admin user management page
drop policy if exists "fontana_users_admin_delete_all" on public.fontana_users;
create policy "fontana_users_admin_delete_all"
on public.fontana_users
for delete
to authenticated
using (public.fontana_is_admin());

-- Auto-create/refresh profile row when a new auth user is created.
-- This runs inside the database and does not depend on frontend session state.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.fontana_users (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.email,
    'client',
    'active'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.fontana_users.full_name, excluded.full_name);

  return new;
end;
$$;

create trigger trg_handle_new_auth_user
after insert on auth.users
for each row
execute function public.handle_new_auth_user();
