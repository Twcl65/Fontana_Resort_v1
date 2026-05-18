-- Fontana Blue Cold Spring: cottages, reservations, payments, messages, reviews
-- Run in Supabase SQL Editor AFTER fontana_users.sql exists.
-- Enables RLS and seeds sample cottages.

-- ---------------------------------------------------------------------------
-- Helper: active admin check (uses fontana_users)
-- ---------------------------------------------------------------------------
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

create or replace function public.fontana_is_staff()
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
      and u.role in ('admin', 'cashier')
      and u.status = 'active'
  );
$$;

grant execute on function public.fontana_is_staff() to authenticated;

-- ---------------------------------------------------------------------------
-- Cottages
-- ---------------------------------------------------------------------------
create table if not exists public.fontana_cottages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('A-House', 'Cottages', 'Function Hall')),
  capacity int not null default 1 check (capacity > 0),
  rate_night numeric(12, 2) not null check (rate_night >= 0),
  status text not null default 'Available' check (status in ('Available', 'Maintenance', 'Archived')),
  amenities jsonb not null default '[]'::jsonb,
  image_url text,
  image_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fontana_cottages_category on public.fontana_cottages (category);
create index if not exists idx_fontana_cottages_status on public.fontana_cottages (status);

alter table public.fontana_cottages enable row level security;

drop policy if exists "cottages_select_auth" on public.fontana_cottages;
drop policy if exists "cottages_select_public" on public.fontana_cottages;
create policy "cottages_select_public"
on public.fontana_cottages for select to anon, authenticated
using (true);

drop policy if exists "cottages_insert_admin" on public.fontana_cottages;
create policy "cottages_insert_admin"
on public.fontana_cottages for insert to authenticated
with check (public.fontana_is_admin());

drop policy if exists "cottages_update_admin" on public.fontana_cottages;
create policy "cottages_update_admin"
on public.fontana_cottages for update to authenticated
using (public.fontana_is_admin())
with check (public.fontana_is_admin());

drop policy if exists "cottages_delete_admin" on public.fontana_cottages;
create policy "cottages_delete_admin"
on public.fontana_cottages for delete to authenticated
using (public.fontana_is_admin());

-- ---------------------------------------------------------------------------
-- Reservations
-- ---------------------------------------------------------------------------
create sequence if not exists public.fontana_reservation_ref_seq;

create table if not exists public.fontana_reservations (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  cottage_id uuid not null references public.fontana_cottages (id) on delete restrict,
  user_id uuid references public.fontana_users (id) on delete set null,
  guest_name text not null,
  guest_email text,
  check_in date not null,
  check_out date not null,
  guest_count int not null default 1 check (guest_count > 0),
  total_amount numeric(12, 2) not null default 0,
  payment_status text not null default 'Unpaid'
    check (payment_status in ('Paid', 'Unpaid', 'Refunded')),
  reservation_status text not null default 'Pending'
    check (reservation_status in ('Pending', 'Confirmed', 'Cancelled', 'Archived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_reservation_dates check (check_out >= check_in)
);

create index if not exists idx_fontana_reservations_user on public.fontana_reservations (user_id);
create index if not exists idx_fontana_reservations_cottage on public.fontana_reservations (cottage_id);
create index if not exists idx_fontana_reservations_dates on public.fontana_reservations (check_in, check_out);

create or replace function public.fontana_set_reservation_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference_code is null or btrim(new.reference_code) = '' then
    new.reference_code := 'RSV-' || lpad(nextval('public.fontana_reservation_ref_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fontana_reservation_ref on public.fontana_reservations;
create trigger trg_fontana_reservation_ref
before insert on public.fontana_reservations
for each row
execute function public.fontana_set_reservation_reference();

alter table public.fontana_reservations enable row level security;

drop policy if exists "reservations_select" on public.fontana_reservations;
create policy "reservations_select"
on public.fontana_reservations for select to authenticated
using (
  public.fontana_is_staff()
  or user_id = auth.uid()
);

drop policy if exists "reservations_insert" on public.fontana_reservations;
create policy "reservations_insert"
on public.fontana_reservations for insert to authenticated
with check (
  public.fontana_is_staff()
  or (user_id is not null and user_id = auth.uid())
);

drop policy if exists "reservations_update" on public.fontana_reservations;
create policy "reservations_update"
on public.fontana_reservations for update to authenticated
using (public.fontana_is_staff() or user_id = auth.uid())
with check (public.fontana_is_staff() or user_id = auth.uid());

drop policy if exists "reservations_delete" on public.fontana_reservations;
create policy "reservations_delete"
on public.fontana_reservations for delete to authenticated
using (public.fontana_is_staff());

-- ---------------------------------------------------------------------------
-- Payments (one row per reservation; proof optional)
-- ---------------------------------------------------------------------------
create table if not exists public.fontana_payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.fontana_reservations (id) on delete cascade,
  amount numeric(12, 2) not null,
  method text not null default 'GCash',
  status text not null default 'Pending' check (status in ('Pending', 'Verified', 'Rejected')),
  proof_file_name text,
  proof_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fontana_payments_reservation on public.fontana_payments (reservation_id);
create index if not exists idx_fontana_payments_status on public.fontana_payments (status);

alter table public.fontana_payments enable row level security;

drop policy if exists "payments_select" on public.fontana_payments;
create policy "payments_select"
on public.fontana_payments for select to authenticated
using (
  exists (
    select 1
    from public.fontana_reservations r
    where r.id = fontana_payments.reservation_id
      and (public.fontana_is_staff() or r.user_id = auth.uid())
  )
);

drop policy if exists "payments_insert" on public.fontana_payments;
create policy "payments_insert"
on public.fontana_payments for insert to authenticated
with check (
  public.fontana_is_staff()
  or exists (
    select 1
    from public.fontana_reservations r
    where r.id = reservation_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists "payments_update" on public.fontana_payments;
create policy "payments_update"
on public.fontana_payments for update to authenticated
using (public.fontana_is_staff())
with check (public.fontana_is_staff());

-- ---------------------------------------------------------------------------
-- Messages (thread key = client_user_id)
-- ---------------------------------------------------------------------------
create table if not exists public.fontana_messages (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references public.fontana_users (id) on delete cascade,
  sender_user_id uuid not null references public.fontana_users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fontana_messages_client on public.fontana_messages (client_user_id, created_at desc);
create index if not exists idx_fontana_messages_created on public.fontana_messages (created_at);

alter table public.fontana_messages enable row level security;

drop policy if exists "messages_select" on public.fontana_messages;
create policy "messages_select"
on public.fontana_messages for select to authenticated
using (
  client_user_id = auth.uid()
  or public.fontana_is_staff()
);

drop policy if exists "messages_insert" on public.fontana_messages;
create policy "messages_insert"
on public.fontana_messages for insert to authenticated
with check (
  sender_user_id = auth.uid()
  and (
    (client_user_id = auth.uid() and not public.fontana_is_staff())
    or public.fontana_is_staff()
  )
);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------
create table if not exists public.fontana_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cottage_id uuid references public.fontana_cottages (id) on delete set null,
  rating int not null check (rating >= 1 and rating <= 5),
  title text,
  comment text not null default '',
  admin_reply text,
  created_at timestamptz not null default now()
);

create index if not exists idx_fontana_reviews_cottage on public.fontana_reviews (cottage_id);

alter table public.fontana_reviews enable row level security;

drop policy if exists "reviews_select" on public.fontana_reviews;
create policy "reviews_select"
on public.fontana_reviews for select to authenticated
using (true);

drop policy if exists "reviews_insert" on public.fontana_reviews;
create policy "reviews_insert"
on public.fontana_reviews for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "reviews_update_admin" on public.fontana_reviews;
create policy "reviews_update_admin"
on public.fontana_reviews for update to authenticated
using (public.fontana_is_staff())
with check (public.fontana_is_staff());

drop policy if exists "reviews_delete_admin" on public.fontana_reviews;
create policy "reviews_delete_admin"
on public.fontana_reviews for delete to authenticated
using (public.fontana_is_staff());

-- ---------------------------------------------------------------------------
-- Seed cottages (idempotent by name — only insert if empty)
-- ---------------------------------------------------------------------------
insert into public.fontana_cottages (name, category, capacity, rate_night, status, amenities, image_url)
select v.name, v.category, v.capacity, v.rate_night, v.status, v.amenities::jsonb, v.image_url
from (
  values
    (
      'Cottage A - Pool View',
      'Cottages',
      20,
      8500,
      'Available',
      '["Fan","Grill","Tables"]',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80'
    ),
    (
      'A-House Deluxe',
      'A-House',
      15,
      7200,
      'Available',
      '["Fan","Tables","Karaoke"]',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
    ),
    (
      'Ocean View Cottage',
      'Cottages',
      10,
      9000,
      'Maintenance',
      '["Fan","Grill"]',
      'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=1200&q=80'
    ),
    (
      'Pickleball Hall',
      'Function Hall',
      80,
      15000,
      'Available',
      '["Tables","Karaoke"]',
      'https://images.unsplash.com/photo-1519167758481-83f29daada0f?auto=format&fit=crop&w=1200&q=80'
    )
) as v(name, category, capacity, rate_night, status, amenities, image_url)
where not exists (select 1 from public.fontana_cottages limit 1);

-- ---------------------------------------------------------------------------
-- Client: cottage IDs with a Confirmed reservation (must run after reservations table).
-- ---------------------------------------------------------------------------
create or replace function public.fontana_reserved_cottage_ids()
returns table (cottage_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct r.cottage_id
  from public.fontana_reservations r
  where r.reservation_status = 'Confirmed';
$$;

grant execute on function public.fontana_reserved_cottage_ids() to authenticated;
grant execute on function public.fontana_reserved_cottage_ids() to anon;

-- ---------------------------------------------------------------------------
-- Manual resort calendar events (see fontana_events_migration.sql for standalone apply)
-- ---------------------------------------------------------------------------
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

alter table public.fontana_events enable row level security;

drop policy if exists "events_select_staff" on public.fontana_events;
create policy "events_select_staff"
on public.fontana_events for select to authenticated
using (public.fontana_is_staff());

drop policy if exists "events_select_public" on public.fontana_events;
create policy "events_select_public"
on public.fontana_events for select to authenticated
using (visibility = 'public' and status = 'scheduled');

drop policy if exists "events_select_public_anon" on public.fontana_events;
create policy "events_select_public_anon"
on public.fontana_events for select to anon
using (visibility = 'public' and status = 'scheduled');

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
