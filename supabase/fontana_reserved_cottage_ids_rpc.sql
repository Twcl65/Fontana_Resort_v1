-- Expose which cottages have at least one Confirmed reservation (for client "Reserved" display).
-- RLS on fontana_reservations only allows users to see their own rows; this function is read-only IDs.
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
