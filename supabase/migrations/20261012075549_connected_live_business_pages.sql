-- Private live-page drafts and explicit public snapshots. No server secret is exposed.
create function public.cc_ll_validate_settings(s jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; item jsonb;
begin
 if jsonb_typeof(s)<>'object' or char_length(s::text)>20000 or s-array['tagline','photographer','service_area','story','services','gallery','fields','social_visibility','directory','spotlight_pages','spotlight_order','active']::text[]<>'{}'::jsonb then raise exception 'Invalid page settings';end if;
 foreach k in array array['tagline','photographer','service_area','story'] loop
  if s?k and (jsonb_typeof(s->k)<>'string' or char_length(s->>k)>case when k='story' then 5000 else 300 end) then raise exception 'Invalid page text';end if;
 end loop;
 if jsonb_typeof(coalesce(s->'fields','{}'))<>'object' or (coalesce(s->'fields','{}')-array['description','address','phone','email','website','image_url','categories','social_urls','tagline','photographer','service_area','story','services','gallery']::text[])<>'{}'::jsonb then raise exception 'Invalid public field selection';end if;
 for k,v in select key,value from jsonb_each(coalesce(s->'fields','{}')) loop if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid public field selection';end if;end loop;
 if jsonb_typeof(coalesce(s->'social_visibility','{}'))<>'object' then raise exception 'Invalid social selections';end if;
 for k,v in select key,value from jsonb_each(coalesce(s->'social_visibility','{}')) loop if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid social selections';end if;end loop;
 foreach k in array array['directory','active'] loop if s?k and jsonb_typeof(s->k)<>'boolean' then raise exception 'Invalid publication setting';end if;end loop;
 if s?'spotlight_order' and ((s->>'spotlight_order') !~ '^[0-9]{1,6}$') then raise exception 'Invalid spotlight order';end if;
 if jsonb_typeof(coalesce(s->'services','[]'))<>'array' or jsonb_array_length(coalesce(s->'services','[]'))>30 then raise exception 'Use up to 30 services';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'services','[]')) loop if jsonb_typeof(item)<>'string' or char_length(item#>>'{}')>200 then raise exception 'Invalid service';end if;end loop;
 if jsonb_typeof(coalesce(s->'gallery','[]'))<>'array' or jsonb_array_length(coalesce(s->'gallery','[]'))>4 then raise exception 'Use up to four photos';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'gallery','[]')) loop
  if jsonb_typeof(item)<>'object' or item-array['url','alt','caption','enabled']::text[]<>'{}'::jsonb or coalesce(item->>'url','') !~ '^https://[^[:space:]<>"@]+$' or (item?'enabled' and jsonb_typeof(item->'enabled')<>'boolean') or char_length(item->>'url')>5000 or char_length(coalesce(item->>'alt',''))>300 or char_length(coalesce(item->>'caption',''))>500 then raise exception 'Invalid photo';end if;
 end loop;
 if jsonb_typeof(coalesce(s->'spotlight_pages','[]'))<>'array' then raise exception 'Invalid spotlight pages';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'spotlight_pages','[]')) loop
  if item#>>'{}' not in ('index.html','businesses.html','things-to-do.html','animals.html','community.html','history.html','jobs.html','events.html','spotlight.html') then raise exception 'Choose an eligible spotlight page';end if;
 end loop;
 return true;
end $$;
revoke all on function public.cc_ll_validate_settings(jsonb) from public,anon;grant execute on function public.cc_ll_validate_settings(jsonb) to authenticated;
create table public.cc_ll_live_profiles(
 business_id uuid primary key references public.cc_businesses(id) on delete cascade,
 workspace_id uuid not null references public.cc_workspaces(id),
 route text not null unique check(route ~ '^[a-z0-9-]+\.html$'),
 settings jsonb not null check(public.cc_ll_validate_settings(settings)),
 updated_at timestamptz not null default now()
);
alter table public.cc_ll_live_profiles enable row level security;
revoke all on public.cc_ll_live_profiles from anon,authenticated;
create index cc_ll_live_profiles_workspace_idx on public.cc_ll_live_profiles(workspace_id);
grant select,update(settings,updated_at) on public.cc_ll_live_profiles to authenticated;
create policy live_profile_read on public.cc_ll_live_profiles for select to authenticated using(public.cc_has_access(workspace_id));
create policy live_profile_edit on public.cc_ll_live_profiles for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true));
create table public.cc_ll_live_publications(
 business_id uuid primary key references public.cc_ll_live_profiles(business_id) on delete cascade,
 workspace_id uuid not null references public.cc_workspaces(id),
 route text not null unique,
 public_content jsonb not null check(public_content-array['id','name','description','address','phone','email','website','image_url','categories','social_urls','tagline','photographer','service_area','story','services','gallery']::text[]='{}'::jsonb),
 directory boolean not null default true,
 spotlight_pages text[] not null default '{}',
 spotlight_order integer not null default 0,
 active boolean not null default true,
 revision integer not null default 1,
 published_at timestamptz not null default now(),
 published_by uuid references auth.users(id)
);
alter table public.cc_ll_live_publications enable row level security;
revoke all on public.cc_ll_live_publications from anon,authenticated;
create index cc_ll_live_publications_workspace_idx on public.cc_ll_live_publications(workspace_id);
create index cc_ll_live_publications_publisher_idx on public.cc_ll_live_publications(published_by);
grant select(business_id,route,public_content,directory,spotlight_pages,spotlight_order,active,revision,published_at) on public.cc_ll_live_publications to anon;
grant select,insert,update on public.cc_ll_live_publications to authenticated;
create policy live_public_read on public.cc_ll_live_publications for select to anon using(active);
create policy live_partner_read on public.cc_ll_live_publications for select to authenticated using(public.cc_has_access(workspace_id));
create function public.cc_ll_live_content(p_business_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare b public.cc_businesses; p public.cc_ll_live_profiles; f jsonb; c jsonb; k text; u text;
begin
 select * into b from public.cc_businesses where id=p_business_id;
 select * into p from public.cc_ll_live_profiles where business_id=p_business_id;
 if b.id is null or p.business_id is null or p.workspace_id<>b.workspace_id or not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required';end if;
 f:=coalesce(p.settings->'fields','{}');c:=jsonb_build_object('id',b.id,'name',b.name);
 foreach k in array array['description','address','phone','email','website','image_url','categories'] loop
  if coalesce((f->>k)::boolean,false) then c:=c||jsonb_build_object(k,to_jsonb(b)->k);end if;
 end loop;
 foreach k in array array['tagline','photographer','service_area','story','services'] loop
  if coalesce((f->>k)::boolean,false) then c:=c||jsonb_build_object(k,p.settings->k);end if;
 end loop;
 if coalesce((f->>'gallery')::boolean,false) then c:=c||jsonb_build_object('gallery',coalesce((select jsonb_agg(item-'enabled' order by ord) from jsonb_array_elements(coalesce(p.settings->'gallery','[]')) with ordinality photos(item,ord) where coalesce((item->>'enabled')::boolean,true)),'[]'::jsonb));end if;
 if coalesce((f->>'social_urls')::boolean,false) then
  c:=c||jsonb_build_object('social_urls',coalesce((select jsonb_agg(link order by ord) from unnest(b.social_urls) with ordinality accounts(link,ord) where coalesce((p.settings->'social_visibility'->>link)::boolean,true)),'[]'::jsonb));
 end if;
 foreach k in array array['image_url','website'] loop
  u:=c->>k;
  if coalesce(u,'')<>'' and (u !~ '^https?://[^[:space:]<>"@]+$' or (k='image_url' and u !~ '^https://')) then raise exception 'Use valid public website and HTTPS image URLs';end if;
 end loop;
 return c;
end $$;
revoke all on function public.cc_ll_live_content(uuid) from public,anon;grant execute on function public.cc_ll_live_content(uuid) to authenticated;
create policy live_partner_insert on public.cc_ll_live_publications for insert to authenticated with check(public.cc_has_access(workspace_id,true) and published_by=auth.uid() and public_content=public.cc_ll_live_content(business_id) and exists(select 1 from public.cc_ll_live_profiles p where p.business_id=cc_ll_live_publications.business_id and p.workspace_id=cc_ll_live_publications.workspace_id and p.route=cc_ll_live_publications.route));
create policy live_partner_update on public.cc_ll_live_publications for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true) and published_by=auth.uid() and public_content=public.cc_ll_live_content(business_id) and exists(select 1 from public.cc_ll_live_profiles p where p.business_id=cc_ll_live_publications.business_id and p.workspace_id=cc_ll_live_publications.workspace_id and p.route=cc_ll_live_publications.route));
create function public.cc_save_ll_live_profile(p_business_id uuid,p_business jsonb,p_settings jsonb,p_business_version timestamptz,p_profile_version timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.cc_businesses;p public.cc_ll_live_profiles;
begin
 select * into b from public.cc_businesses where id=p_business_id for update;
 select * into p from public.cc_ll_live_profiles where business_id=p_business_id for update;
 if b.id is null or p.business_id is null or b.workspace_id<>p.workspace_id or not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required';end if;
 if b.updated_at is distinct from p_business_version or p.updated_at is distinct from p_profile_version then raise exception 'This record changed. Reload before saving.';end if;
 if jsonb_typeof(p_business)<>'object' or p_business-array['name','description','phone','email','address','city','website','image_url','categories','social_urls']::text[]<>'{}'::jsonb then raise exception 'Invalid business fields';end if;
 perform public.cc_ll_validate_settings(p_settings);
 if p_business?'categories' and jsonb_typeof(p_business->'categories')<>'array' or p_business?'social_urls' and jsonb_typeof(p_business->'social_urls')<>'array' then raise exception 'Invalid business categories or socials';end if;
 update public.cc_businesses set
 name=case when p_business?'name' then p_business->>'name' else b.name end,
 description=case when p_business?'description' then coalesce(p_business->>'description','') else b.description end,
 phone=case when p_business?'phone' then coalesce(p_business->>'phone','') else b.phone end,
 email=case when p_business?'email' then coalesce(p_business->>'email','') else b.email end,
 address=case when p_business?'address' then coalesce(p_business->>'address','') else b.address end,
 city=case when p_business?'city' then coalesce(p_business->>'city','') else b.city end,
 website=case when p_business?'website' then coalesce(p_business->>'website','') else b.website end,
 image_url=case when p_business?'image_url' then coalesce(p_business->>'image_url','') else b.image_url end,
 categories=case when p_business?'categories' then array(select jsonb_array_elements_text(p_business->'categories')) else b.categories end,
 social_urls=case when p_business?'social_urls' then array(select jsonb_array_elements_text(p_business->'social_urls')) else b.social_urls end
 where id=b.id returning * into b;
 update public.cc_ll_live_profiles set settings=p_settings,updated_at=clock_timestamp() where business_id=b.id returning * into p;
 return jsonb_build_object('profile',to_jsonb(p),'business_version',b.updated_at);
end $$;
revoke all on function public.cc_save_ll_live_profile(uuid,jsonb,jsonb,timestamptz,timestamptz) from public,anon;grant execute on function public.cc_save_ll_live_profile(uuid,jsonb,jsonb,timestamptz,timestamptz) to authenticated;
create function public.cc_preview_ll_live_profile(p_business_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare b public.cc_businesses;p public.cc_ll_live_profiles;c jsonb;r integer;result jsonb;
begin
 c:=public.cc_ll_live_content(p_business_id);
 select * into b from public.cc_businesses where id=p_business_id;
 select * into p from public.cc_ll_live_profiles where business_id=p_business_id;
 select revision into r from public.cc_ll_live_publications where business_id=p_business_id;
 result:=jsonb_build_object('business_id',b.id,'route',p.route,'public_content',c,'directory',coalesce((p.settings->>'directory')::boolean,true),'spotlight_pages',coalesce(p.settings->'spotlight_pages','[]'::jsonb),'spotlight_order',coalesce((p.settings->>'spotlight_order')::integer,0),'active',coalesce((p.settings->>'active')::boolean,true),'revision',coalesce(r,0));
 return result||jsonb_build_object('signature',md5(result::text||b.updated_at::text||p.updated_at::text));
end $$;
revoke all on function public.cc_preview_ll_live_profile(uuid) from public,anon;grant execute on function public.cc_preview_ll_live_profile(uuid) to authenticated;
create function public.cc_publish_ll_live_profile(p_business_id uuid,p_signature text) returns public.cc_ll_live_publications language plpgsql security invoker set search_path='' as $$
declare preview jsonb;w uuid;result public.cc_ll_live_publications;
begin
 perform 1 from public.cc_businesses where id=p_business_id for update;
 perform 1 from public.cc_ll_live_profiles where business_id=p_business_id for update;
 perform 1 from public.cc_ll_live_publications where business_id=p_business_id for update;
 preview:=public.cc_preview_ll_live_profile(p_business_id);
 if p_signature is distinct from preview->>'signature' then raise exception 'The preview changed. Preview again before publishing.';end if;
 select workspace_id into w from public.cc_ll_live_profiles where business_id=p_business_id;
 insert into public.cc_ll_live_publications as target(business_id,workspace_id,route,public_content,directory,spotlight_pages,spotlight_order,active,revision,published_at,published_by)
 values(p_business_id,w,preview->>'route',preview->'public_content',(preview->>'directory')::boolean,array(select jsonb_array_elements_text(preview->'spotlight_pages')),(preview->>'spotlight_order')::integer,(preview->>'active')::boolean,1,clock_timestamp(),auth.uid())
 on conflict(business_id) do update set public_content=excluded.public_content,directory=excluded.directory,spotlight_pages=excluded.spotlight_pages,spotlight_order=excluded.spotlight_order,active=excluded.active,revision=target.revision+1,published_at=excluded.published_at,published_by=excluded.published_by returning * into result;
 return result;
end $$;
revoke all on function public.cc_publish_ll_live_profile(uuid,text) from public,anon;grant execute on function public.cc_publish_ll_live_profile(uuid,text) to authenticated;
