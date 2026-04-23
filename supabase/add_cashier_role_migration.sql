-- Add `cashier` to allowed roles for existing databases.
-- Run once in Supabase SQL Editor.

alter table public.fontana_users
drop constraint if exists fontana_users_role_check;

alter table public.fontana_users
add constraint fontana_users_role_check
check (role in ('admin', 'cashier', 'client'));
