create or replace function public.cc_ll_validate_settings(s jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; item jsonb;
begin
 if jsonb_typeof(s)<>'object' or char_length(s::text)>20000 or s-array['tagline','photographer','service_area','story','services','gallery','fields','social_visibility','directory','spotlight_pages','spotlight_order','active','sites']::text[]<>'{}'::jsonb then raise exception 'Invalid page settings';end if;
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
 if s?'sites' and (jsonb_typeof(s->'sites')<>'array' or jsonb_array_length(s->'sites')<1 or jsonb_array_length(s->'sites')>2 or exists(select 1 from jsonb_array_elements_text(s->'sites') x where x not in ('Loving Longmont','MKT Colorado'))) then raise exception 'Choose at least one supported website';end if;
 return true;
end $$;
alter table public.cc_ll_live_publications add column sites text[] not null default array['Loving Longmont'] check(cardinality(sites) between 1 and 2 and sites <@ array['Loving Longmont','MKT Colorado']::text[]);
grant select(sites) on public.cc_ll_live_publications to anon;
create or replace function public.cc_preview_ll_live_profile(p_business_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare b public.cc_businesses;p public.cc_ll_live_profiles;c jsonb;r integer;result jsonb;
begin
 c:=public.cc_ll_live_content(p_business_id);
 select * into b from public.cc_businesses where id=p_business_id;
 select * into p from public.cc_ll_live_profiles where business_id=p_business_id;
 select revision into r from public.cc_ll_live_publications where business_id=p_business_id;
 result:=jsonb_build_object('business_id',b.id,'route',p.route,'public_content',c,'directory',coalesce((p.settings->>'directory')::boolean,true),'spotlight_pages',coalesce(p.settings->'spotlight_pages','[]'::jsonb),'spotlight_order',coalesce((p.settings->>'spotlight_order')::integer,0),'active',coalesce((p.settings->>'active')::boolean,true),'sites',coalesce(p.settings->'sites','["Loving Longmont"]'::jsonb),'revision',coalesce(r,0));
 return result||jsonb_build_object('signature',md5(result::text||b.updated_at::text||p.updated_at::text));
end $$;
create or replace function public.cc_publish_ll_live_profile(p_business_id uuid,p_signature text) returns public.cc_ll_live_publications language plpgsql security invoker set search_path='' as $$
declare preview jsonb;w uuid;result public.cc_ll_live_publications;
begin
 perform 1 from public.cc_businesses where id=p_business_id for update;
 perform 1 from public.cc_ll_live_profiles where business_id=p_business_id for update;
 perform 1 from public.cc_ll_live_publications where business_id=p_business_id for update;
 preview:=public.cc_preview_ll_live_profile(p_business_id);
 if p_signature is distinct from preview->>'signature' then raise exception 'The preview changed. Preview again before publishing.';end if;
 select workspace_id into w from public.cc_ll_live_profiles where business_id=p_business_id;
 insert into public.cc_ll_live_publications as target(business_id,workspace_id,route,public_content,directory,spotlight_pages,spotlight_order,active,revision,published_at,published_by,sites)
 values(p_business_id,w,preview->>'route',preview->'public_content',(preview->>'directory')::boolean,array(select jsonb_array_elements_text(preview->'spotlight_pages')),(preview->>'spotlight_order')::integer,(preview->>'active')::boolean,1,clock_timestamp(),auth.uid(),array(select jsonb_array_elements_text(preview->'sites')))
 on conflict(business_id) do update set public_content=excluded.public_content,directory=excluded.directory,spotlight_pages=excluded.spotlight_pages,spotlight_order=excluded.spotlight_order,active=excluded.active,revision=target.revision+1,published_at=excluded.published_at,published_by=excluded.published_by,sites=excluded.sites returning * into result;
 return result;
end $$;
create function public.cc_ensure_live_profile(p_business_id uuid) returns public.cc_ll_live_profiles language plpgsql security invoker set search_path='' as $$
declare b public.cc_businesses; result public.cc_ll_live_profiles; destinations text[];
begin
 select * into b from public.cc_businesses where id=p_business_id;
 if b.id is null or not public.cc_has_access(b.workspace_id) then raise exception 'Approved workspace member required';end if;
 select * into result from public.cc_ll_live_profiles where business_id=b.id;
 if result.business_id is not null then return result;end if;
 if not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required to create a page draft';end if;
 select array_agg(distinct site) into destinations from public.cc_listings where business_id=b.id and site in ('Loving Longmont','MKT Colorado') and status<>'Archived';
 insert into public.cc_ll_live_profiles(business_id,workspace_id,route,settings) values(b.id,b.workspace_id,'business-'||b.id::text||'.html',jsonb_build_object('sites',to_jsonb(coalesce(destinations,array['Loving Longmont'])),'story','','services','[]'::jsonb,'gallery','[]'::jsonb,'social_visibility','{}'::jsonb,'directory',false,'active',false,'spotlight_pages','[]'::jsonb,'spotlight_order',0,'fields',jsonb_build_object('description',true,'image_url',true,'address',false,'phone',false,'email',false,'website',true,'categories',true,'social_urls',false,'story',false,'gallery',false))) on conflict(business_id) do nothing;
 select * into result from public.cc_ll_live_profiles where business_id=b.id;
 return result;
end $$;
revoke all on function public.cc_ensure_live_profile(uuid) from public,anon;grant execute on function public.cc_ensure_live_profile(uuid) to authenticated;
grant insert on public.cc_ll_live_profiles to authenticated;
create policy live_profile_create on public.cc_ll_live_profiles for insert to authenticated with check(public.cc_has_access(workspace_id,true) and exists(select 1 from public.cc_businesses b where b.id=cc_ll_live_profiles.business_id and b.workspace_id=cc_ll_live_profiles.workspace_id));
