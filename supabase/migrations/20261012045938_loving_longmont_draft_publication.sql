create table public.cc_ll_draft_publications(
 business_id uuid primary key references public.cc_businesses(id),
 workspace_id uuid not null references public.cc_workspaces(id),
 public_content jsonb not null,
 directory boolean not null default true,
 pages text[] not null default array['businesses.html'],
 spotlight_pages text[] not null default '{}',
 spotlight_order integer not null default 0,
 active boolean not null default true,
 published_at timestamptz not null default now(),
 published_by uuid default auth.uid() references auth.users(id),
 check(public_content - array['id','name','description','story','address','phone','website','image_url','social_urls','categories','gallery_images']::text[] = '{}'::jsonb)
);
alter table public.cc_ll_draft_publications enable row level security;
grant select on public.cc_ll_draft_publications to anon,authenticated;
grant insert,update on public.cc_ll_draft_publications to authenticated;
create policy public_read on public.cc_ll_draft_publications for select to anon,authenticated using(true);
create policy partner_insert on public.cc_ll_draft_publications for insert to authenticated with check(public.cc_has_access(workspace_id,true));
create policy partner_update on public.cc_ll_draft_publications for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true));
create function public.cc_publish_ll_draft(p_business_id uuid,p_pages text[],p_directory boolean default true,p_spotlight_pages text[] default '{}',p_order integer default 0,p_active boolean default true)
returns public.cc_ll_draft_publications language plpgsql security invoker set search_path='' as $$
declare b public.cc_businesses; m jsonb; f jsonb; payload jsonb; result public.cc_ll_draft_publications;
begin
 select * into b from public.cc_businesses where id=p_business_id;
 if b.id is null or not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required';end if;
 if cardinality(p_pages)>20 or cardinality(p_spotlight_pages)>20 or exists(select 1 from unnest(p_pages||p_spotlight_pages) r where r not in ('index.html','businesses.html','eat-drink.html','shop-local.html','arts-culture.html','events.html','get-outside.html','things-to-do.html','animals.html','community.html','history.html','jobs.html','spotlight.html')) then raise exception 'Choose an eligible Loving Longmont page';end if;
 begin m:=b.notes::jsonb;exception when others then m:='{}';end;
 if m->>'format' is distinct from 'mkt-portfolio-v1' then m:='{}';end if;
 f:=coalesce(m->'publicationOptions'->'fields','{}');
 payload:=jsonb_build_object('id',b.id,'name',b.name);
 if coalesce((f->>'description')::boolean,true) then payload:=payload||jsonb_build_object('description',coalesce(b.description,''));end if;
 if coalesce((f->>'story')::boolean,true) then payload:=payload||jsonb_build_object('story',coalesce(m->>'businessStory',''));end if;
 if coalesce((f->>'address')::boolean,true) then payload:=payload||jsonb_build_object('address',coalesce(b.address,''));end if;
 if coalesce((f->>'phone')::boolean,true) then payload:=payload||jsonb_build_object('phone',coalesce(b.phone,''));end if;
 if coalesce((f->>'website')::boolean,true) then payload:=payload||jsonb_build_object('website',coalesce(b.website,''));end if;
 if coalesce((f->>'image_url')::boolean,true) then payload:=payload||jsonb_build_object('image_url',coalesce(b.image_url,''));end if;
 if m->'publicationOptions'->>'tier'='Paid' then
 if coalesce((f->>'social_urls')::boolean,false) then payload:=payload||jsonb_build_object('social_urls',coalesce(to_jsonb(b.social_urls),'[]'));end if;
 if coalesce((f->>'categories')::boolean,false) then payload:=payload||jsonb_build_object('categories',coalesce(to_jsonb(b.categories),'[]'));end if;
 if coalesce((f->>'gallery_images')::boolean,false) then payload:=payload||jsonb_build_object('gallery_images',coalesce(m->'listingGalleryUrls','[]'));end if;
 end if;
 insert into public.cc_ll_draft_publications as target(business_id,workspace_id,public_content,directory,pages,spotlight_pages,spotlight_order,active,published_at,published_by)
 values(b.id,b.workspace_id,payload,p_directory,p_pages,p_spotlight_pages,p_order,p_active,now(),auth.uid())
 on conflict(business_id) do update set public_content=excluded.public_content,directory=excluded.directory,pages=excluded.pages,spotlight_pages=excluded.spotlight_pages,spotlight_order=excluded.spotlight_order,active=excluded.active,published_at=excluded.published_at,published_by=excluded.published_by
 returning * into result;
 return result;
end $$;
revoke all on function public.cc_publish_ll_draft(uuid,text[],boolean,text[],integer,boolean) from public,anon;
grant execute on function public.cc_publish_ll_draft(uuid,text[],boolean,text[],integer,boolean) to authenticated;
revoke select on public.cc_ll_draft_publications from anon;
grant select(business_id,public_content,directory,pages,spotlight_pages,spotlight_order,active,published_at) on public.cc_ll_draft_publications to anon;
