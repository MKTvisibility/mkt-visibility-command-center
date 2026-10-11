insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cc-listing-images','cc-listing-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists cc_listing_image_upload on storage.objects;
create policy cc_listing_image_upload on storage.objects for insert to authenticated
with check(bucket_id='cc-listing-images' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.cc_businesses b where b.id::text=(storage.foldername(name))[2]
 and public.cc_has_access(b.workspace_id,true)));
-- Images use unique names. No overwrite/delete privileges are granted.
