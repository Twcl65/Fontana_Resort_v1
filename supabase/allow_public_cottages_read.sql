-- Allow landing page visitors (anon) to view cottages without logging in.
-- Run once in Supabase SQL Editor.

drop policy if exists "cottages_select_auth" on public.fontana_cottages;
drop policy if exists "cottages_select_public" on public.fontana_cottages;

create policy "cottages_select_public"
on public.fontana_cottages
for select
to anon, authenticated
using (true);
