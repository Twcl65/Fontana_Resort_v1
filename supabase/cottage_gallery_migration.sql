-- Gallery images (JSON array of public URLs) + storage for uploads.
-- *** RUN IN THE CUSTOMER SUPABASE PROJECT (ifofofolamthemtywvor), NOT THE ADMIN PROJECT ***
-- Run after resort_schema.sql in that same customer project.

alter table public.fontana_cottages
  add column if not exists image_urls jsonb not null default '[]'::jsonb;

comment on column public.fontana_cottages.image_urls is 'Ordered list of cottage photo URLs (public). image_url remains first image for legacy clients.';

-- ---------------------------------------------------------------------------
-- Storage: public bucket for cottage + amenity images (uploaded from admin)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cottage-images', 'cottage-images', true)
on conflict (id) do nothing;

drop policy if exists "cottage_images_public_read" on storage.objects;
create policy "cottage_images_public_read"
on storage.objects for select
to public
using (bucket_id = 'cottage-images');

drop policy if exists "cottage_images_admin_insert" on storage.objects;
create policy "cottage_images_admin_insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'cottage-images'
  and public.fontana_is_admin()
);

drop policy if exists "cottage_images_admin_update" on storage.objects;
create policy "cottage_images_admin_update"
on storage.objects for update
to authenticated
using (bucket_id = 'cottage-images' and public.fontana_is_admin())
with check (bucket_id = 'cottage-images' and public.fontana_is_admin());

drop policy if exists "cottage_images_admin_delete" on storage.objects;
create policy "cottage_images_admin_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'cottage-images' and public.fontana_is_admin());
