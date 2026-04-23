-- Fix: "infinite recursion detected in policy for relation fontana_users"
-- Cause: admin policies used EXISTS (SELECT ... FROM fontana_users ...), which re-applies RLS.
-- Run once in Supabase SQL Editor if you already applied the older fontana_users.sql.

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

drop policy if exists "fontana_users_admin_select_all" on public.fontana_users;
create policy "fontana_users_admin_select_all"
on public.fontana_users
for select
to authenticated
using (public.fontana_is_admin());

drop policy if exists "fontana_users_admin_update_all" on public.fontana_users;
create policy "fontana_users_admin_update_all"
on public.fontana_users
for update
to authenticated
using (public.fontana_is_admin())
with check (public.fontana_is_admin());

drop policy if exists "fontana_users_admin_delete_all" on public.fontana_users;
create policy "fontana_users_admin_delete_all"
on public.fontana_users
for delete
to authenticated
using (public.fontana_is_admin());
