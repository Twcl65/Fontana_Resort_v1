-- Add 'Archived' to cottage and reservation status (run once in Supabase SQL Editor).
-- Replaces hard-delete with soft archive from admin UI.

alter table public.fontana_cottages drop constraint if exists fontana_cottages_status_check;
alter table public.fontana_cottages add constraint fontana_cottages_status_check
  check (status in ('Available', 'Maintenance', 'Archived'));

alter table public.fontana_reservations drop constraint if exists fontana_reservations_reservation_status_check;
alter table public.fontana_reservations add constraint fontana_reservations_reservation_status_check
  check (reservation_status in ('Pending', 'Confirmed', 'Cancelled', 'Archived'));
