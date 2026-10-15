-- On-demand discovery only. No schedule, publication, approval, or email sending.
create table public.cc_discovery_runs (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null unique references public.cc_ai_messages(id),
 workspace_id uuid not null references public.cc_workspaces(id),
 requested_by uuid not null references auth.users(id),
 status text not null default 'Working' check(status in ('Working','Completed','Failed')),
 reserved_usd numeric not null default 0.15,
 result jsonb not null default '{}'::jsonb,
 usage jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),finished_at timestamptz
);
alter table public.cc_discovery_runs enable row level security;
revoke all on public.cc_discovery_runs from public,anon,authenticated;
grant select on public.cc_discovery_runs to authenticated;
grant select,insert,update on public.cc_discovery_runs to service_role;
create policy discovery_partner_read on public.cc_discovery_runs for select to authenticated using(public.cc_has_access(workspace_id,false));
create policy discovery_server on public.cc_discovery_runs to service_role using(true) with check(true);
create index cc_discovery_usage on public.cc_discovery_runs(workspace_id,created_at);
create function public.cc_begin_discovery(p_message_id uuid,p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare m public.cc_ai_messages;r public.cc_discovery_runs; spend numeric;
begin
 select * into m from public.cc_ai_messages where id=p_message_id and author_id=p_user_id and author_type='human' and workspace_id='c8748032-cdd3-443b-8c56-2e846cc9bf31';
 if not found then raise exception 'A saved partner request is required';end if;
 if not exists(select 1 from public.cc_members where workspace_id=m.workspace_id and user_id=p_user_id and enabled and role in ('owner','editor')) then raise exception 'Partner editing access required';end if;
 if not exists(select 1 from public.cc_ai_reply_runs where message_id=m.id and agent='Hunter' and status='Working') then raise exception 'An active Hunter conversation is required';end if;
 perform pg_advisory_xact_lock(hashtextextended(m.workspace_id::text,0));
 select * into r from public.cc_discovery_runs where message_id=m.id;
 if found then return to_jsonb(r)||'{"existing":true}'::jsonb;end if;
 if m.created_at<now()-interval '10 minutes' then raise exception 'Research request expired; enter a new request';end if;
 if (select count(*) from public.cc_discovery_runs where workspace_id=m.workspace_id and created_at>now()-interval '1 day')>=3 then raise exception 'Daily research limit of three batches reached';end if;
 select coalesce(sum(reserved_usd),0) into spend from public.cc_discovery_runs where workspace_id=m.workspace_id and created_at>=date_trunc('month',now());
 if spend+0.15>3.00 then raise exception 'Monthly discovery safety allowance reached';end if;
 select spend+coalesce(sum(reserved_usd),0) into spend from public.cc_ai_reply_runs where workspace_id=m.workspace_id and claimed_at>=date_trunc('month',now());
 if spend+0.15>8.50 then raise exception 'Shared monthly AI safety allowance reached';end if;
 insert into public.cc_discovery_runs(message_id,workspace_id,requested_by) values(m.id,m.workspace_id,p_user_id) returning * into r;
 return to_jsonb(r)||jsonb_build_object('existing',false,'request',m.body);
end $$;
create function public.cc_save_discovery(p_run_id uuid,p_candidates jsonb,p_skipped jsonb,p_usage jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r public.cc_discovery_runs;c jsonb;b public.cc_businesses; duplicate_id uuid;created jsonb:='[]';skipped jsonb:=coalesce(p_skipped,'[]');brand text; n text;
begin
 select * into r from public.cc_discovery_runs where id=p_run_id for update;
 if not found then raise exception 'Research run not found';end if;
 if r.status<>'Working' then return r.result;end if;
 if not exists(select 1 from public.cc_members where workspace_id=r.workspace_id and user_id=r.requested_by and enabled and role in ('owner','editor')) then raise exception 'Partner access was revoked';end if;
 if jsonb_typeof(p_candidates)<>'array' or jsonb_array_length(p_candidates)>5 then raise exception 'At most five drafts may be saved';end if;
 perform pg_advisory_xact_lock(hashtextextended(r.workspace_id::text||':discovery',0));
 perform set_config('request.jwt.claim.sub',r.requested_by::text,true);
 for c in select value from jsonb_array_elements(p_candidates) loop
  n:=trim(c->>'name');
  if length(n) not between 2 and 200 or length(trim(c->>'city'))=0 or jsonb_array_length(c->'sources')<1 then raise exception 'Researched name, city and sources are required';end if;
  brand:=case when lower(trim(c->>'city'))='longmont' then 'Loving Longmont' else 'MKT Colorado' end;
  select id into duplicate_id from public.cc_businesses x where x.workspace_id=r.workspace_id and (
   regexp_replace(lower(x.name),'[^a-z0-9]','','g')=regexp_replace(lower(n),'[^a-z0-9]','','g')
   or (coalesce(c->>'website','')<>'' and regexp_replace(lower(x.website),'^https?://(www\.)?|/+$','','g')=regexp_replace(lower(c->>'website'),'^https?://(www\.)?|/+$','','g'))
   or (coalesce(c->>'email','')<>'' and lower(x.email)=lower(c->>'email'))
   or (length(regexp_replace(coalesce(c->>'phone',''),'[^0-9]','','g'))>=10 and regexp_replace(x.phone,'[^0-9]','','g')=regexp_replace(c->>'phone','[^0-9]','','g'))
  ) limit 1;
  if duplicate_id is not null then skipped:=skipped||jsonb_build_array(jsonb_build_object('name',n,'reason','Possible duplicate in Command Center','businessId',duplicate_id));continue;end if;
  insert into public.cc_businesses(workspace_id,name,city,address,phone,email,website,notes) values(r.workspace_id,n,c->>'city',coalesce(c->>'address',''),coalesce(c->>'phone',''),coalesce(c->>'email',''),coalesce(c->>'website',''),jsonb_build_object('format','mkt-portfolio-v1','brand',brand,'text',c->>'description','discovery',jsonb_build_object('source','Hunter research','status','Pending review','researchedOn',now()::date,'researcher','Hunter','requestedBy',r.requested_by,'runId',r.id,'reviewOwner','Michelle or Tim','reason',c->>'reason','sources',c->'sources','uncertainties',c->'uncertainties','verification','AI extracted from retrieved public sources; human verification required'))::text) returning * into b;
  insert into public.cc_listings(workspace_id,business_id,site,title,city,status,description) values(r.workspace_id,b.id,brand,n,b.city,'Draft',c->>'description');
  created:=created||jsonb_build_array(jsonb_build_object('id',b.id,'name',b.name,'city',b.city,'brand',brand,'status','Pending review'));
 end loop;
 update public.cc_discovery_runs set status='Completed',finished_at=now(),usage=p_usage,result=jsonb_build_object('created',created,'skipped',skipped,'published',false,'contacted',false,'reviewQueue','Dashboard → New businesses to review') where id=r.id returning result into c;
 return c;
end $$;
revoke all on function public.cc_begin_discovery(uuid,uuid),public.cc_save_discovery(uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.cc_begin_discovery(uuid,uuid),public.cc_save_discovery(uuid,jsonb,jsonb,jsonb) to service_role;
grant insert on public.cc_businesses,public.cc_listings to service_role;

create or replace function public.cc_claim_ai_reply(p_message_id uuid,p_user_id uuid,p_agent text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare m public.cc_ai_messages; t public.cc_ai_threads; r public.cc_ai_reply_runs; v_count integer; v_spend numeric;
begin
 select * into m from public.cc_ai_messages where id=p_message_id and author_id=p_user_id and author_type='human';
 if not found then raise exception 'Saved message not found.'; end if;
 if not exists(select 1 from public.cc_members where workspace_id=m.workspace_id and user_id=p_user_id and enabled and role in ('owner','editor')) then raise exception 'Partner access required.'; end if;
 select * into t from public.cc_ai_threads where id=m.thread_id and workspace_id=m.workspace_id and status='Open' and p_agent=any(participants);
 if not found then raise exception 'Open conversation with this employee required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(m.workspace_id::text,0));
 select * into r from public.cc_ai_reply_runs where message_id=p_message_id;
 if found then
  if r.agent<>p_agent then raise exception 'Retry with the original employee.'; end if;
  if r.status='Completed' then return to_jsonb(r); end if;
  if r.status='Working' then raise exception 'A reply is already being processed. Refresh before retrying.'; end if;
  if r.attempts>=3 then raise exception 'Three attempts reached. Start a new message after checking the connection.'; end if;
 end if;
 select coalesce(sum(attempts),0) into v_count from public.cc_ai_reply_runs where workspace_id=m.workspace_id and claimed_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 if v_count>=20 then raise exception 'Daily limit of 20 chat requests reached. Please return tomorrow.'; end if;
 select coalesce(sum(reserved_usd),0) into v_spend from public.cc_ai_reply_runs where workspace_id=m.workspace_id and claimed_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 select v_spend+coalesce(sum(reserved_usd),0) into v_spend from public.cc_discovery_runs where workspace_id=m.workspace_id and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
 if v_spend+0.05>8.50 then raise exception 'Monthly chat safety budget reached.'; end if;
 insert into public.cc_ai_reply_runs(message_id,workspace_id,requested_by,agent,status,reserved_usd) values(m.id,m.workspace_id,p_user_id,p_agent,'Working',0.05)
 on conflict(message_id) do update set status='Working',attempts=cc_ai_reply_runs.attempts+1,reserved_usd=cc_ai_reply_runs.reserved_usd+0.05,lease=gen_random_uuid(),claimed_at=now(),last_error=null
 returning * into r;
 return to_jsonb(r);
end $$;

notify pgrst,'reload schema';

create or replace function public.cc_email_send_block(p_business uuid,p_key text,p_recipient text) returns text language plpgsql stable security invoker set search_path='' as $$
declare b public.cc_businesses; m jsonb;
begin
 select * into b from public.cc_businesses where id=p_business; if b.id is null then return 'Business not found or access lost.';end if;
 m:=public.cc_email_notes(b.notes);
 if m#>>'{discovery,status}'='Pending review' then return 'Michelle or Tim must review this researched business before outreach.';end if;
 if exists(select 1 from public.cc_bi_profiles p where p.business_id=b.id and p.workspace_id=b.workspace_id and p.crm->>'do_not_contact'='true') then return 'Do Not Contact is recorded for this business.';end if;
 if b.status in ('Archived','Paused','Inactive') or m->>'outreachDecision' in ('Stop outreach','Do not contact','No outreach','Not a match') then return 'Outreach is stopped or business inactive.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.status='Bounced' and lower(e.recipient)=lower(p_recipient)) then return 'Recipient has a recorded bounce. Verify a different active contact.';end if;
 if p_key='custom' then return '';end if;
 if public.cc_email_campaign_contacted(b.id,p_key) then return 'This campaign was already contacted. Use a custom follow-up.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.message_type='Human' and e.direction='Outbound' and e.status in ('Sent','Replied','Bounced') and public.cc_email_campaign_key(e.subject,e.campaign,e.notes)='') then return 'Classify the earlier sent messages or prepare a custom email.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.direction='Inbound' and e.message_type='Human' and public.cc_email_notes(e.notes)->>'response_status'='Needs our reply') then return 'A client message needs a custom reply.';end if;
 if p_key='welcome' and exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.message_type='Human' and (e.direction='Outbound' and e.status in ('Sent','Replied','Bounced') or e.direction='Inbound' and e.status='Replied')) then return 'An existing conversation is recorded. Do not send a first introduction.';end if;
 if p_key='story' and not public.cc_email_campaign_contacted(b.id,'welcome') then return 'Listing Welcome is not recorded.';end if;
 if p_key='visibility' and exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.direction='Outbound' and e.message_type='Human' and e.status in ('Sent','Replied','Bounced') and lower(public.cc_email_notes(e.notes)->>'summary') like '%visibility check%') then return 'A Visibility Check offer already appears in earlier outreach. Use a custom follow-up.';end if;
 return '';
end $$;

-- Public snapshots cannot be activated before human discovery review.
create function public.cc_discovery_publication_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare notes jsonb;
begin
 select public.cc_email_notes(b.notes) into notes from public.cc_businesses b where b.id=new.business_id;
 if notes#>>'{discovery,status}'='Pending review' and (to_jsonb(new)->>'active'='true' or to_jsonb(new)->>'status'='Published') then raise exception 'Michelle or Tim must review this researched business before publishing';end if;
 return new;
end $$;
revoke all on function public.cc_discovery_publication_guard() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['cc_listings','cc_ll_live_publications','cc_ll_draft_publications'] loop
  if to_regclass('public.'||t) is not null then execute format('create trigger cc_discovery_hold before insert or update on public.%I for each row execute function public.cc_discovery_publication_guard()',t);end if;
 end loop;
end $$;
