-- Private event drafts and independently published public calendars.
create function public.cc_validate_business_events(events jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare e jsonb; k text;
begin
 if jsonb_typeof(events) is distinct from 'array' or octet_length(events::text)>1500000 or jsonb_array_length(events)>300 then raise exception 'Use up to 300 events'; end if;
 for e in select value from jsonb_array_elements(events) loop
  if jsonb_typeof(e)<>'object' or e-array['id','title','description','start_date','end_date','start_time','end_time','time_note','location','cost','url','image_url','image_alt','enabled','spotlight']::text[]<>'{}' then raise exception 'Invalid event fields';end if;
  foreach k in array array['id','title','start_date','end_date'] loop if coalesce(e->>k,'')='' then raise exception 'Event title and dates required';end if;end loop;
  foreach k in array array['id','title','description','start_date','end_date','start_time','end_time','time_note','location','cost','url','image_url','image_alt'] loop
   if e?k and (jsonb_typeof(e->k)<>'string' or char_length(e->>k)>case when k in ('url','image_url') then 5000 when k='description' then 2000 when k='location' then 500 else 300 end) then raise exception 'Invalid event text';end if;
  end loop;
  if (e->>'start_date') !~ '^\d{4}-\d{2}-\d{2}$' or (e->>'end_date') !~ '^\d{4}-\d{2}-\d{2}$' or (e->>'start_date')::date>(e->>'end_date')::date then raise exception 'Invalid event dates';end if;
  foreach k in array array['start_time','end_time'] loop if coalesce(e->>k,'')<>'' and (e->>k)!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Invalid event time';end if;end loop;
  if e->>'start_date'=e->>'end_date' and coalesce(e->>'end_time','')<>'' and coalesce(e->>'start_time','')<>'' and e->>'end_time'<e->>'start_time' then raise exception 'End must follow start';end if;
  foreach k in array array['enabled','spotlight'] loop if jsonb_typeof(e->k) is distinct from 'boolean' then raise exception 'Event visibility required';end if;end loop;
  foreach k in array array['url','image_url'] loop if coalesce(e->>k,'')<>'' and (e->>k)!~ '^https://[^[:space:]<>"@]+$' then raise exception 'Use HTTPS event links and images';end if;end loop;
 end loop;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(events)) then raise exception 'Duplicate event IDs';end if;
 return true;
end $$;
create table public.cc_business_event_drafts(
 business_id uuid primary key references public.cc_businesses(id) on delete cascade,
 workspace_id uuid not null references public.cc_workspaces(id),
 events jsonb not null default '[]' check(public.cc_validate_business_events(events)),
 version integer not null default 1,updated_at timestamptz not null default now()
);
create table public.cc_business_event_publications(
 business_id uuid primary key references public.cc_businesses(id) on delete cascade,
 workspace_id uuid not null references public.cc_workspaces(id),
 name text not null,events jsonb not null default '[]' check(public.cc_validate_business_events(events)),
 revision integer not null default 1,published_at timestamptz not null default now(),published_by uuid references auth.users(id)
);
create index cc_business_event_drafts_workspace on public.cc_business_event_drafts(workspace_id);
create index cc_business_event_publications_workspace on public.cc_business_event_publications(workspace_id);
alter table public.cc_business_event_drafts enable row level security;
alter table public.cc_business_event_publications enable row level security;
revoke all on public.cc_business_event_drafts,public.cc_business_event_publications from anon,authenticated;
grant select,insert,update on public.cc_business_event_drafts,public.cc_business_event_publications to authenticated;
grant select(business_id,name,events,revision,published_at) on public.cc_business_event_publications to anon;
create policy event_draft_read on public.cc_business_event_drafts for select to authenticated using(public.cc_has_access(workspace_id));
create policy event_draft_insert on public.cc_business_event_drafts for insert to authenticated with check(public.cc_has_access(workspace_id,true) and exists(select 1 from public.cc_businesses b where b.id=business_id and b.workspace_id=cc_business_event_drafts.workspace_id));
create policy event_draft_update on public.cc_business_event_drafts for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true) and exists(select 1 from public.cc_businesses b where b.id=business_id and b.workspace_id=cc_business_event_drafts.workspace_id));
create policy event_public_read on public.cc_business_event_publications for select to anon using(true);
create policy event_member_read on public.cc_business_event_publications for select to authenticated using(public.cc_has_access(workspace_id));
create function public.cc_public_business_events(p_business_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(e.value order by e.ordinality),'[]'::jsonb) from public.cc_business_event_drafts d cross join lateral jsonb_array_elements(d.events) with ordinality e where d.business_id=p_business_id and (e.value->>'enabled')::boolean
$$;
create policy event_public_insert on public.cc_business_event_publications for insert to authenticated with check(public.cc_has_access(workspace_id,true) and published_by=auth.uid() and events=public.cc_public_business_events(business_id) and exists(select 1 from public.cc_businesses b where b.id=business_id and b.workspace_id=cc_business_event_publications.workspace_id and b.name=cc_business_event_publications.name));
create policy event_public_update on public.cc_business_event_publications for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true) and published_by=auth.uid() and events=public.cc_public_business_events(business_id) and exists(select 1 from public.cc_businesses b where b.id=business_id and b.workspace_id=cc_business_event_publications.workspace_id and b.name=cc_business_event_publications.name));
create function public.cc_save_business_events(p_business_id uuid,p_events jsonb,p_version integer) returns public.cc_business_event_drafts language plpgsql security invoker set search_path='' as $$
declare b public.cc_businesses; d public.cc_business_event_drafts;
begin
 select * into b from public.cc_businesses where id=p_business_id for update;
 if b.id is null or not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required';end if;
 select * into d from public.cc_business_event_drafts where business_id=b.id for update;
 if coalesce(d.version,0)<>p_version then raise exception 'Events changed. Reload before saving.';end if;
 insert into public.cc_business_event_drafts as target(business_id,workspace_id,events) values(b.id,b.workspace_id,p_events) on conflict(business_id) do update set events=excluded.events,version=target.version+1,updated_at=clock_timestamp() returning * into d;
 return d;
end $$;
create function public.cc_preview_business_events(p_business_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.cc_businesses;d public.cc_business_event_drafts;r integer;payload jsonb;
begin
 select * into b from public.cc_businesses where id=p_business_id;
 if b.id is null or not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required';end if;
 select * into d from public.cc_business_event_drafts where business_id=b.id;
 if d.business_id is null then raise exception 'Save events first';end if;
 select revision into r from public.cc_business_event_publications where business_id=b.id;
 payload:=jsonb_build_object('name',b.name,'events',public.cc_public_business_events(b.id),'version',d.version,'revision',coalesce(r,0));
 return payload||jsonb_build_object('signature',md5(payload::text));
end $$;
create function public.cc_publish_business_events(p_business_id uuid,p_signature text) returns public.cc_business_event_publications language plpgsql security invoker set search_path='' as $$
declare p jsonb;b public.cc_businesses;r public.cc_business_event_publications;
begin
 select * into b from public.cc_businesses where id=p_business_id for update;
 p:=public.cc_preview_business_events(p_business_id);
 if p->>'signature' is distinct from p_signature then raise exception 'Events preview changed. Preview again.';end if;
 insert into public.cc_business_event_publications as target(business_id,workspace_id,name,events,published_by) values(b.id,b.workspace_id,b.name,p->'events',auth.uid()) on conflict(business_id) do update set name=excluded.name,events=excluded.events,revision=target.revision+1,published_at=clock_timestamp(),published_by=auth.uid() returning * into r;
 return r;
end $$;
revoke all on function public.cc_public_business_events(uuid),public.cc_save_business_events(uuid,jsonb,integer),public.cc_preview_business_events(uuid),public.cc_publish_business_events(uuid,text) from public,anon;
grant execute on function public.cc_public_business_events(uuid),public.cc_save_business_events(uuid,jsonb,integer),public.cc_preview_business_events(uuid),public.cc_publish_business_events(uuid,text) to authenticated;
