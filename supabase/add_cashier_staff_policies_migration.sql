-- Enable cashier role to use staff modules (reservations, payments, messages, reviews).
-- Run once in Supabase SQL Editor.

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

drop policy if exists "reservations_select" on public.fontana_reservations;
create policy "reservations_select"
on public.fontana_reservations for select to authenticated
using (public.fontana_is_staff() or user_id = auth.uid());

drop policy if exists "reservations_insert" on public.fontana_reservations;
create policy "reservations_insert"
on public.fontana_reservations for insert to authenticated
with check (public.fontana_is_staff() or (user_id is not null and user_id = auth.uid()));

drop policy if exists "reservations_update" on public.fontana_reservations;
create policy "reservations_update"
on public.fontana_reservations for update to authenticated
using (public.fontana_is_staff() or user_id = auth.uid())
with check (public.fontana_is_staff() or user_id = auth.uid());

drop policy if exists "reservations_delete" on public.fontana_reservations;
create policy "reservations_delete"
on public.fontana_reservations for delete to authenticated
using (public.fontana_is_staff());

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

drop policy if exists "messages_select" on public.fontana_messages;
create policy "messages_select"
on public.fontana_messages for select to authenticated
using (client_user_id = auth.uid() or public.fontana_is_staff());

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

drop policy if exists "reviews_update_admin" on public.fontana_reviews;
create policy "reviews_update_admin"
on public.fontana_reviews for update to authenticated
using (public.fontana_is_staff())
with check (public.fontana_is_staff());

drop policy if exists "reviews_delete_admin" on public.fontana_reviews;
create policy "reviews_delete_admin"
on public.fontana_reviews for delete to authenticated
using (public.fontana_is_staff());
