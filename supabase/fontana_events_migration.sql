-- Fontana resort manual calendar events + upcoming-events helpers
-- Run once in Supabase SQL Editor after resort_schema.sql

create table if not exists public.fontana_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_type text not null default 'Other'
    check (event_type in ('Maintenance', 'Promotion', 'Entertainment', 'Operations', 'Other')),
  start_date date not null,
  end_date date not null,
  start_time time,
  end_time time,
  cottage_id uuid references public.fontana_cottages (id) on delete set null,
  visibility text not null default 'public'
    check (visibility in ('public', 'staff_only')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'cancelled', 'completed')),
  created_by uuid references public.fontana_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_fontana_events_dates check (end_date >= start_date)
);

create index if not exists idx_fontana_events_dates on public.fontana_events (start_date, end_date);
create index if not exists idx_fontana_events_visibility on public.fontana_events (visibility);
create index if not exists idx_fontana_events_status on public.fontana_events (status);

alter table public.fontana_events enable row level security;

drop policy if exists "events_select_staff" on public.fontana_events;
create policy "events_select_staff"
on public.fontana_events for select to authenticated
using (public.fontana_is_staff());

drop policy if exists "events_select_public" on public.fontana_events;
create policy "events_select_public"
on public.fontana_events for select to authenticated
using (
  visibility = 'public'
  and status = 'scheduled'
);

drop policy if exists "events_insert_admin" on public.fontana_events;
create policy "events_insert_admin"
on public.fontana_events for insert to authenticated
with check (public.fontana_is_admin());

drop policy if exists "events_update_admin" on public.fontana_events;
create policy "events_update_admin"
on public.fontana_events for update to authenticated
using (public.fontana_is_admin())
with check (public.fontana_is_admin());

drop policy if exists "events_delete_admin" on public.fontana_events;
create policy "events_delete_admin"
on public.fontana_events for delete to authenticated
using (public.fontana_is_admin());

-- Allow anonymous read of public scheduled events (landing / future use)
drop policy if exists "events_select_public_anon" on public.fontana_events;
create policy "events_select_public_anon"
on public.fontana_events for select to anon
using (visibility = 'public' and status = 'scheduled');
