-- MKT blog drafts stay private; public releases are immutable content snapshots.
create table public.cc_blog_posts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.cc_workspaces(id),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=120),
 title text not null default '' check(length(title)<=200),
 excerpt text not null default '' check(length(excerpt)<=500),
 body text not null default '' check(length(body)<=100000),
 author text not null default 'MKT Visibility' check(length(author)<=120),
 image_path text, image_alt text not null default '' check(length(image_alt)<=300),
 image_caption text not null default '' check(length(image_caption)<=500),
 revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.cc_blog_releases (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.cc_blog_posts(id) on delete cascade,
 workspace_id uuid not null references public.cc_workspaces(id),
 slug text not null, title text not null check(length(trim(title))>0),
 excerpt text not null, body text not null check(length(trim(body))>0), author text not null,
 image_path text, image_alt text not null, image_caption text not null,
 source_revision integer not null, published_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index cc_blog_releases_due on public.cc_blog_releases(published_at desc,post_id);
alter table public.cc_blog_posts enable row level security;
alter table public.cc_blog_releases enable row level security;
grant select,insert,update on public.cc_blog_posts to authenticated;
grant select,insert,delete on public.cc_blog_releases to authenticated;
grant select on public.cc_blog_releases to anon;
create policy blog_drafts_read on public.cc_blog_posts for select to authenticated using(exists(select 1 from public.cc_members m where m.workspace_id=cc_blog_posts.workspace_id and m.user_id=(select auth.uid()) and m.enabled));
create policy blog_drafts_create on public.cc_blog_posts for insert to authenticated with check(exists(select 1 from public.cc_members m where m.workspace_id=cc_blog_posts.workspace_id and m.user_id=(select auth.uid()) and m.enabled and m.role in ('owner','editor')));
create policy blog_drafts_update on public.cc_blog_posts for update to authenticated using(exists(select 1 from public.cc_members m where m.workspace_id=cc_blog_posts.workspace_id and m.user_id=(select auth.uid()) and m.enabled and m.role in ('owner','editor'))) with check(exists(select 1 from public.cc_members m where m.workspace_id=cc_blog_posts.workspace_id and m.user_id=(select auth.uid()) and m.enabled and m.role in ('owner','editor')));
create policy blog_public_read on public.cc_blog_releases for select to anon,authenticated using(published_at<=now());
create policy blog_release_partner_read on public.cc_blog_releases for select to authenticated using(exists(select 1 from public.cc_members m where m.workspace_id=cc_blog_releases.workspace_id and m.user_id=(select auth.uid()) and m.enabled));
create policy blog_release_create on public.cc_blog_releases for insert to authenticated with check(exists(select 1 from public.cc_members m where m.workspace_id=cc_blog_releases.workspace_id and m.user_id=(select auth.uid()) and m.enabled and m.role in ('owner','editor')) and exists(select 1 from public.cc_blog_posts p where p.id=post_id and p.workspace_id=cc_blog_releases.workspace_id));
create policy blog_release_remove on public.cc_blog_releases for delete to authenticated using(exists(select 1 from public.cc_members m where m.workspace_id=cc_blog_releases.workspace_id and m.user_id=(select auth.uid()) and m.enabled and m.role in ('owner','editor')));
create view public.cc_blog_public with(security_invoker=true) as select distinct on(post_id) post_id,slug,title,excerpt,body,author,image_path,image_alt,image_caption,published_at from public.cc_blog_releases where published_at<=now() order by post_id,published_at desc,created_at desc,id desc;
grant select on public.cc_blog_public to anon,authenticated;
create function public.cc_blog_stamp() returns trigger language plpgsql set search_path='' as $$
begin
 if new.workspace_id<>old.workspace_id then raise exception 'Workspace cannot change'; end if;
 if new.slug<>old.slug and exists(select 1 from public.cc_blog_releases where post_id=old.id) then raise exception 'The URL of a published or scheduled post cannot change'; end if;
 new.revision=old.revision+1;new.updated_at=now();return new;
end $$;
create trigger cc_blog_stamp before update on public.cc_blog_posts for each row execute function public.cc_blog_stamp();
create function public.cc_blog_publish(p_post_id uuid,p_revision integer,p_action text,p_publish_at timestamptz default null) returns void language plpgsql security invoker set search_path='' as $$
declare p public.cc_blog_posts; at_time timestamptz;
begin
 select * into p from public.cc_blog_posts where id=p_post_id for update;
 if not found or not exists(select 1 from public.cc_members m where m.workspace_id=p.workspace_id and m.user_id=auth.uid() and m.enabled and m.role in ('owner','editor')) then raise exception 'Approved editor access required'; end if;
 if p.revision<>p_revision then raise exception 'This draft changed. Reload it before publishing'; end if;
 if p_action='unpublish' then delete from public.cc_blog_releases where post_id=p.id;return;end if;
 if p_action='cancel' then delete from public.cc_blog_releases where post_id=p.id and published_at>now();return;end if;
 if p_action not in ('publish','schedule') then raise exception 'Invalid action';end if;
 if trim(p.title)='' or trim(p.body)='' then raise exception 'Add a title and post text first';end if;
 if p.image_path is not null and trim(p.image_alt)='' then raise exception 'Add image description text first';end if;
 if p.image_path is not null and (p.image_path not like p.workspace_id::text||'/'||p.id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='mkt-blog-images' and name=p.image_path)) then raise exception 'Upload a valid blog image first';end if;
 at_time=now();
 if p_action='schedule' then
  if p_publish_at is null or p_publish_at<=now() then raise exception 'Choose a future publication time';end if;
  at_time=p_publish_at;
 end if;
 delete from public.cc_blog_releases where post_id=p.id and published_at>now();
 insert into public.cc_blog_releases(post_id,workspace_id,slug,title,excerpt,body,author,image_path,image_alt,image_caption,source_revision,published_at)
 values(p.id,p.workspace_id,p.slug,p.title,p.excerpt,p.body,p.author,p.image_path,p.image_alt,p.image_caption,p.revision,at_time);
end $$;
revoke all on function public.cc_blog_publish(uuid,integer,text,timestamptz) from public,anon;
grant execute on function public.cc_blog_publish(uuid,integer,text,timestamptz) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('mkt-blog-images','mkt-blog-images',false,8388608,array['image/jpeg','image/png','image/webp']);
create policy blog_images_partner_read on storage.objects for select to authenticated using(bucket_id='mkt-blog-images' and exists(select 1 from public.cc_members m where m.workspace_id::text=(storage.foldername(name))[1] and m.user_id=(select auth.uid()) and m.enabled));
create policy blog_images_upload on storage.objects for insert to authenticated with check(bucket_id='mkt-blog-images' and exists(select 1 from public.cc_blog_posts p join public.cc_members m on m.workspace_id=p.workspace_id where p.workspace_id::text=(storage.foldername(name))[1] and p.id::text=(storage.foldername(name))[2] and m.user_id=(select auth.uid()) and m.enabled and m.role in ('owner','editor')));
create policy blog_images_public_read on storage.objects for select to anon,authenticated using(bucket_id='mkt-blog-images' and exists(select 1 from public.cc_blog_public b where b.image_path=name));
