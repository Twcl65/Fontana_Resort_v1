-- Allow service role to manage fontana_users without RLS restrictions
-- Run in CUSTOMER Supabase project

-- Service role can select all users
drop policy if exists "fontana_users_select_service_role" on public.fontana_users;
create policy "fontana_users_select_service_role"
on public.fontana_users
for select
to service_role
using (true);

-- Service role can insert/upsert users
drop policy if exists "fontana_users_insert_service_role" on public.fontana_users;
create policy "fontana_users_insert_service_role"
on public.fontana_users
for insert
to service_role
with check (true);

-- Service role can update users
drop policy if exists "fontana_users_update_service_role" on public.fontana_users;
create policy "fontana_users_update_service_role"
on public.fontana_users
for update
to service_role
using (true)
with check (true);
