-- WARNING: DESTRUCTIVE DATA RESET
-- This script deletes ALL application data and ALL Supabase auth users.
-- It does NOT drop tables, functions, policies, or schema objects.
--
-- Run in Supabase SQL Editor only when you intentionally want a full reset.

begin;

-- Child tables first
truncate table public.fontana_messages restart identity cascade;
truncate table public.fontana_reviews restart identity cascade;
truncate table public.fontana_payments restart identity cascade;
truncate table public.fontana_reservations restart identity cascade;

-- Reference/content tables
truncate table public.fontana_cottages restart identity cascade;

-- App user profile table
truncate table public.fontana_users restart identity cascade;

-- Remove all auth users as requested.
-- Requires sufficient privileges in Supabase SQL Editor (service role context).
delete from auth.users;

-- Reset reservation reference sequence if present
alter sequence if exists public.fontana_reservation_ref_seq restart with 1;

commit;
