begin;
-- Private, server-only rollback checkpoint; no data is exported into Git.
create schema cc_bi_private;
revoke all on schema cc_bi_private from public,anon,authenticated;
create table cc_bi_private.backup_20261014(table_name text not null, record jsonb not null, captured_at timestamptz not null default now());
revoke all on all tables in schema cc_bi_private from public,anon,authenticated;
insert into cc_bi_private.backup_20261014(table_name,record) select 'cc_businesses',to_jsonb(t) from public.cc_businesses t union all select 'cc_tasks',to_jsonb(t) from public.cc_tasks t union all select 'cc_listings',to_jsonb(t) from public.cc_listings t;

create table public.cc_bi_profiles(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.cc_workspaces(id), business_id uuid not null,
 approved jsonb not null default '{}' check(jsonb_typeof(approved)='object'), approved_at timestamptz, approved_by uuid references auth.users(id),
 crm jsonb not null default '{}' check(jsonb_typeof(crm)='object'),
 created_by uuid references auth.users(id) default auth.uid(), created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_id,business_id), foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
create table public.cc_bi_research(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.cc_workspaces(id),business_id uuid not null,
 assessment jsonb not null default '{}' check(jsonb_typeof(assessment)='object'),
 status text not null default 'Awaiting Review' check(status in ('Awaiting Review','Approved','Rejected','Partial','Failed')),
 method text not null default 'Manual',limitations text not null default '',reviewed_at timestamptz,reviewed_by uuid references auth.users(id),
 created_by uuid references auth.users(id) default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
create table public.cc_bi_jobs(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.cc_workspaces(id), business_id uuid not null,
 status text not null default 'Queued' check(status in ('Queued','Running','Awaiting Review','Partial','Blocked','Failed','Canceled')),
 error text not null default '',started_at timestamptz, finished_at timestamptz,
 created_by uuid references auth.users(id) default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
create unique index cc_bi_one_active_job on public.cc_bi_jobs(workspace_id,business_id) where status in ('Queued','Running');
create table public.cc_bi_suggestions(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.cc_workspaces(id),business_id uuid not null,
 dedup_key text not null,title text not null,category text not null default 'Verification',execution text not null default 'Human Review' check(execution in ('AI-executable','Human Review','External Action')),
 reason text not null default '',status text not null default 'Suggested' check(status in ('Suggested','Accepted','Rejected')),task_id uuid references public.cc_tasks(id),
 created_by uuid references auth.users(id) default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_id,business_id,dedup_key),foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
create table public.cc_bi_settings(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null unique references public.cc_workspaces(id),
 config jsonb not null default '{"weights":{"need":40,"potential":35,"contact":15,"engagement":10}}' check(jsonb_typeof(config)='object'),
 created_by uuid references auth.users(id) default auth.uid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.cc_tasks add column details jsonb not null default '{}' check(jsonb_typeof(details)='object');
alter table public.cc_tasks drop constraint cc_tasks_status_check;
alter table public.cc_tasks add constraint cc_tasks_status_check check(status in ('Open','In progress','Awaiting Review','Waiting on Client','Blocked','Done','Cancelled'));
create unique index cc_bi_task_dedup on public.cc_tasks(workspace_id,business_id,(details->>'suggestion_key')) where details ? 'suggestion_key';

do $$ declare t text; begin
 foreach t in array array['cc_bi_profiles','cc_bi_research','cc_bi_jobs','cc_bi_suggestions','cc_bi_settings'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy bi_read on public.%I for select to authenticated using(public.cc_has_access(workspace_id))',t);
  execute format('create policy bi_write_insert on public.%I for insert to authenticated with check(public.cc_has_access(workspace_id,true))',t);
  execute format('create policy bi_write_update on public.%I for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true))',t);
  execute format('create trigger cc_stamp before insert or update on public.%I for each row execute function public.cc_stamp_record()',t);
  execute format('create trigger cc_audit after insert or update on public.%I for each row execute function public.cc_audit_record()',t);
  execute format('create index on public.%I(workspace_id,created_at desc,id)',t);
 end loop;
end $$;
grant insert on public.cc_bi_jobs to authenticated;
-- The UI routes writes through validated commands; database guards also protect Data API writes.
create function public.cc_bi_command(p_action text,p_data jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w uuid; b uuid; r public.cc_bi_profiles; run public.cc_bi_research; s public.cc_bi_suggestions; tid uuid; result jsonb; target uuid; cfg jsonb;
begin
 w:=(p_data->>'workspace_id')::uuid;
 if not public.cc_has_access(w,true) then raise exception 'Approved editor access required'; end if;
 if octet_length(p_data::text)>200000 then raise exception 'Request too large'; end if;
 if p_action='settings' then
  cfg:=p_data->'config';
  if jsonb_typeof(cfg)<>'object' or exists(select 1 from jsonb_each_text(cfg->'weights') where value::numeric<0 or value::numeric>100) or (select sum(value::numeric) from jsonb_each_text(cfg->'weights'))<>100 then raise exception 'Priority weights must total 100'; end if;
  insert into public.cc_bi_settings(workspace_id,config) values(w,cfg) on conflict(workspace_id) do update set config=excluded.config returning to_jsonb(cc_bi_settings) into result; return result;
 end if;
 b:=(p_data->>'business_id')::uuid;
 if not exists(select 1 from public.cc_businesses where workspace_id=w and id=b) then raise exception 'Business not found in your workspace'; end if;
 if p_action='suggest' then
  insert into public.cc_bi_suggestions(workspace_id,business_id,dedup_key,title,category,execution,reason) values(w,b,p_data->>'key',p_data->>'title',coalesce(p_data->>'category','Verification'),coalesce(p_data->>'execution','Human Review'),coalesce(p_data->>'reason','')) on conflict(workspace_id,business_id,dedup_key) do nothing;
  return jsonb_build_object('success',true);
 elsif p_action='suggestion' then
  select * into s from public.cc_bi_suggestions where id=(p_data->>'id')::uuid and workspace_id=w and business_id=b for update;
  if not found then raise exception 'Suggestion not found'; end if;
  if s.status<>'Suggested' then return to_jsonb(s); end if;
  if p_data->>'decision'='Accept' then
   select id into tid from public.cc_tasks where workspace_id=w and business_id=b and (details->>'suggestion_key'=s.dedup_key or lower(title)=lower(s.title)) and status<>'Cancelled' limit 1;
   if tid is null then insert into public.cc_tasks(workspace_id,business_id,title,type,status,priority,assignee,notes,details) values(w,b,s.title,'Task','Open','Normal','Unassigned',left(s.reason,4000),jsonb_build_object('company','MKT Visibility','category',s.category,'execution',s.execution,'suggestion_key',s.dedup_key)) returning id into tid; end if;
   update public.cc_bi_suggestions set status='Accepted',task_id=tid where id=s.id returning to_jsonb(cc_bi_suggestions) into result;
  elsif p_data->>'decision'='Reject' then update public.cc_bi_suggestions set status='Rejected' where id=s.id returning to_jsonb(cc_bi_suggestions) into result;
  else raise exception 'Choose Accept or Reject'; end if;
  return result;
 elsif p_action='research_save' then
  insert into public.cc_bi_research(workspace_id,business_id,assessment,method,limitations,status) values(w,b,p_data->'assessment','Manual',coalesce(p_data->>'limitations',''),'Awaiting Review') returning to_jsonb(cc_bi_research) into result; return result;
 elsif p_action='research_reject' then
  update public.cc_bi_research set status='Rejected',reviewed_at=now(),reviewed_by=auth.uid() where id=(p_data->>'id')::uuid and workspace_id=w and business_id=b returning to_jsonb(cc_bi_research) into result; return result;
 end if;
 insert into public.cc_bi_profiles(workspace_id,business_id) values(w,b) on conflict do nothing;
 select * into r from public.cc_bi_profiles where workspace_id=w and business_id=b for update;
 if (p_data->>'version') is distinct from r.updated_at::text and p_data->>'version' is not null and (p_data->>'version')::timestamptz<>r.updated_at then raise exception 'Assessment changed. Reload before saving'; end if;
 if p_action='crm' then
  cfg:=p_data->'crm';
  if coalesce(cfg->>'stage','Researching') not in ('Researching','Qualified','Ready to Contact','Contacted','Interested','Proposal Sent','Client Won','Closed / Not a Fit') then raise exception 'Invalid sales stage'; end if;
  if coalesce((r.crm->>'do_not_contact')::boolean,false) and not coalesce((cfg->>'do_not_contact')::boolean,false) then raise exception 'Do Not Contact is permanent'; end if;
  if coalesce((cfg->>'do_not_contact')::boolean,false) and cfg->>'stage' in ('Ready to Contact','Contacted','Interested','Proposal Sent') then raise exception 'Do Not Contact businesses cannot enter outreach stages'; end if;
  update public.cc_bi_profiles set crm=cfg where id=r.id returning to_jsonb(cc_bi_profiles) into result;
  update public.cc_businesses set stage=case cfg->>'stage' when 'Contacted' then 'Contacted' when 'Interested' then 'Discovery' when 'Proposal Sent' then 'Proposal' when 'Client Won' then 'Won' when 'Closed / Not a Fit' then 'Lost' else 'New' end where id=b and workspace_id=w;
 elsif p_action='approve' then
  cfg:=p_data->'assessment';
  if jsonb_typeof(cfg)<>'object' then raise exception 'Assessment required'; end if;
  if exists(select 1 from jsonb_each(cfg->'platforms') p where p.value->>'score' is not null and ((p.value->>'score')::numeric not between 1 and 5 or (p.value->>'score')::numeric<>trunc((p.value->>'score')::numeric))) then raise exception 'Ratings must be integers 1 to 5'; end if;
  if exists(select 1 from jsonb_each(cfg->'platforms') p where (p.value->>'score' is not null or p.value->>'state'='Missing') and (length(trim(coalesce(p.value->>'explanation','')))=0 or not exists(select 1 from jsonb_array_elements(coalesce(p.value->'evidence','[]')) e where e->>'url' ~ '^https?://'))) then raise exception 'Rated or missing platforms require explanations and source URLs'; end if;
  if exists(select 1 from jsonb_each(cfg->'signals') p where p.value->>'value' is not null and ((p.value->>'value')::numeric not between 0 and 100 or length(trim(coalesce(p.value->>'explanation','')))=0)) then raise exception 'Lead signals require 0 to 100 scores and explanations'; end if;
  update public.cc_bi_profiles set approved=cfg||jsonb_build_object('review_status','Approved'),approved_at=now(),approved_by=auth.uid() where id=r.id returning to_jsonb(cc_bi_profiles) into result;
  if p_data->>'research_id' is not null then update public.cc_bi_research set status='Approved',reviewed_at=now(),reviewed_by=auth.uid() where id=(p_data->>'research_id')::uuid and workspace_id=w and business_id=b; end if;
 else raise exception 'Unknown command'; end if;
 return result;
end $$;
-- Invoker RPC needs table grants; guards below validate direct client writes too.
-- RLS still bounds every command to an authorized workspace.
grant insert,update on public.cc_bi_profiles,public.cc_bi_research,public.cc_bi_suggestions,public.cc_bi_settings to authenticated;
revoke all on function public.cc_bi_command(text,jsonb) from public,anon;
grant execute on function public.cc_bi_command(text,jsonb) to authenticated;
-- Maintain protected provenance and permanent suppression even for direct Data API writes.
create function public.cc_bi_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and tg_table_name='cc_bi_profiles' then
  if old.business_id<>new.business_id then raise exception 'Business identity cannot change'; end if;
  if coalesce((old.crm->>'do_not_contact')::boolean,false) and not coalesce((new.crm->>'do_not_contact')::boolean,false) then raise exception 'Do Not Contact is permanent'; end if;
 end if;
 if tg_table_name='cc_bi_profiles' and coalesce((new.crm->>'do_not_contact')::boolean,false) and new.crm->>'stage' in ('Ready to Contact','Contacted','Interested','Proposal Sent') then raise exception 'Do Not Contact excludes outreach'; end if;
 return new;
end $$;
revoke all on function public.cc_bi_guard() from public,anon,authenticated;
create trigger cc_bi_guard before insert or update on public.cc_bi_profiles for each row execute function public.cc_bi_guard();

-- Cloud worker claim uses a row lock and can only be called by server credentials.
create function public.cc_bi_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.cc_bi_jobs;
begin
 update public.cc_bi_jobs set status='Failed',error='Worker timed out. Queue Research Again to retry.',finished_at=now() where status='Running' and started_at<now()-interval '10 minutes';
 select * into j from public.cc_bi_jobs where status='Queued' order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.cc_bi_jobs set status='Running',started_at=now() where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
revoke all on function public.cc_bi_claim() from public,anon,authenticated;
grant execute on function public.cc_bi_claim() to service_role;

insert into public.cc_bi_profiles(workspace_id,business_id,crm)
select workspace_id,id,jsonb_build_object('stage',case stage when 'Won' then 'Client Won' when 'Lost' then 'Closed / Not a Fit' when 'Proposal' then 'Proposal Sent' when 'Discovery' then 'Interested' when 'Contacted' then 'Contacted' else 'Researching' end,'do_not_contact',false) from public.cc_businesses;
insert into public.cc_bi_settings(workspace_id) select id from public.cc_workspaces;
-- Queue is a filtered view of connected businesses, not duplicate business records or 373 active tasks.
commit;
begin;
create or replace function public.cc_bi_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare cfg jsonb; d jsonb; dep text;
begin
 if tg_table_name='cc_bi_profiles' then
  if tg_op='UPDATE' then
   if old.business_id<>new.business_id then raise exception 'Business identity cannot change'; end if;
   if coalesce((old.crm->>'do_not_contact')::boolean,false) and not coalesce((new.crm->>'do_not_contact')::boolean,false) then raise exception 'Do Not Contact is permanent'; end if;
  end if;
  if coalesce((new.crm->>'do_not_contact')::boolean,false) and new.crm->>'stage' in ('Ready to Contact','Contacted','Interested','Proposal Sent') then raise exception 'Do Not Contact excludes outreach'; end if;
  if new.crm ? 'stage' and new.crm->>'stage' not in ('Researching','Qualified','Ready to Contact','Contacted','Interested','Proposal Sent','Client Won','Closed / Not a Fit') then raise exception 'Invalid pipeline stage'; end if;
  if (tg_op='INSERT' and new.approved<>'{}') or (tg_op='UPDATE' and new.approved is distinct from old.approved) then
   cfg:=new.approved;
   if exists(select 1 from jsonb_each(cfg->'platforms') p where p.value->>'score' is not null and ((p.value->>'score')::numeric not between 1 and 5 or (p.value->>'score')::numeric<>trunc((p.value->>'score')::numeric))) then raise exception 'Ratings must be integers 1 to 5'; end if;
   if exists(select 1 from jsonb_each(cfg->'platforms') p where (p.value->>'score' is not null or p.value->>'state'='Missing') and (length(trim(coalesce(p.value->>'explanation','')))=0 or not exists(select 1 from jsonb_array_elements(coalesce(p.value->'evidence','[]')) e where e->>'url' ~ '^https?://'))) then raise exception 'Rated or missing platforms require explanations and source URLs'; end if;
   if exists(select 1 from jsonb_each(cfg->'signals') p where p.value->>'value' is not null and ((p.value->>'value')::numeric not between 0 and 100 or length(trim(coalesce(p.value->>'explanation','')))=0)) then raise exception 'Lead signals require scores and explanations'; end if;
   new.approved_at:=now();new.approved_by:=auth.uid();new.approved:=new.approved||jsonb_build_object('review_status','Approved');
  elsif tg_op='UPDATE' then new.approved_at:=old.approved_at;new.approved_by:=old.approved_by;
  end if;
 elsif tg_table_name='cc_bi_jobs' and tg_op='INSERT' and current_user<>'service_role' then
  new.status:='Queued';new.error:='';new.started_at:=null;new.finished_at:=null;
 elsif tg_table_name='cc_tasks' then
  cfg:=new.details;
  if cfg ? 'recurrence' and cfg->>'recurrence' not in ('None','Daily','Weekly','Monthly') then raise exception 'Invalid task recurrence'; end if;
  if cfg ? 'company' and cfg->>'company' not in ('Unassigned','MKT Visibility','Loving Longmont','MKT Colorado','Open Theory Cove','Boulder County Photography') then raise exception 'Invalid company'; end if;
  if octet_length(cfg::text)>40000 then raise exception 'Task details too large'; end if;
  if cfg ? 'dependencies' then
   for dep in select jsonb_array_elements_text(cfg->'dependencies') loop
    if dep=new.id::text or not exists(select 1 from public.cc_tasks where id=dep::uuid and workspace_id=new.workspace_id) then raise exception 'Invalid dependency task'; end if;
    if new.status='Done' and exists(select 1 from public.cc_tasks where id=dep::uuid and status<>'Done') then raise exception 'Complete dependencies first'; end if;
   end loop;
  end if;
  if cfg ? 'attachments' and exists(select 1 from jsonb_array_elements_text(cfg->'attachments') a where a !~ '^https?://') then raise exception 'Attachment links must use HTTP or HTTPS'; end if;
 end if;
 return new;
end $$;
create trigger cc_bi_jobs_guard before insert on public.cc_bi_jobs for each row execute function public.cc_bi_guard();
create trigger cc_bi_task_guard before insert or update on public.cc_tasks for each row execute function public.cc_bi_guard();
create function public.cc_bi_task_recurrence() returns trigger language plpgsql security invoker set search_path='' as $$
declare due date; interval_value interval; d jsonb;
begin
 if new.status='Done' and (tg_op='INSERT' or old.status<>'Done') and new.details->>'recurrence' in ('Daily','Weekly','Monthly') then
  interval_value:=case new.details->>'recurrence' when 'Daily' then interval '1 day' when 'Weekly' then interval '7 days' else interval '1 month' end;
  due:=(coalesce(new.due_date,(now() at time zone 'America/Denver')::date)+interval_value)::date;
  d:=(new.details-'dependencies'-'suggestion_key')||jsonb_build_object('suggestion_key','recurrence:'||new.id::text,'previous_occurrence',new.id);
  insert into public.cc_tasks(workspace_id,business_id,title,type,status,priority,due_date,assignee,notes,details)
  values(new.workspace_id,new.business_id,new.title,new.type,'Open',new.priority,due,new.assignee,new.notes,d) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.cc_bi_task_recurrence() from public,anon,authenticated;
create trigger cc_bi_task_recurrence after insert or update on public.cc_tasks for each row execute function public.cc_bi_task_recurrence();
commit;
begin;
-- Preserve each replaced approved assessment as a protected research snapshot.
create function public.cc_bi_assessment_history() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.approved_at is not null and new.approved is distinct from old.approved then
  insert into public.cc_bi_research(workspace_id,business_id,assessment,status,method,reviewed_at,reviewed_by)
  values(old.workspace_id,old.business_id,old.approved||jsonb_build_object('original_approved_at',old.approved_at),'Approved','Previous approved assessment',old.approved_at,old.approved_by);
 end if;
 return new;
end $$;
revoke all on function public.cc_bi_assessment_history() from public,anon,authenticated;
create trigger cc_bi_assessment_history before update on public.cc_bi_profiles for each row execute function public.cc_bi_assessment_history();
create function public.cc_bi_auto_suggest() returns trigger language plpgsql security invoker set search_path='' as $$
declare a jsonb; p record; name text; key text; title text; cat text; reason text;
begin
 if tg_table_name='cc_bi_research' then
  if new.method='Previous approved assessment' or new.status in ('Rejected','Failed','Approved') then return new; end if;
  a:=new.assessment;
  insert into public.cc_bi_suggestions(workspace_id,business_id,dedup_key,title,category,reason) values(new.workspace_id,new.business_id,'assessment-review','Review and Approve Assessment','Business Research','Review the public sources and provisional ratings before approving.') on conflict do nothing;
  for p in select * from jsonb_each(coalesce(a->'fields','{}')) loop
   if coalesce(p.value->>'value','')='' or coalesce(p.value->>'verification','Unverified')<>'Verified' then
    insert into public.cc_bi_suggestions(workspace_id,business_id,dedup_key,title,category,reason) values(new.workspace_id,new.business_id,'verify:'||p.key,'Verify '||case p.key when 'email' then 'Contact Information' else p.key end,'Verification',p.key||' is missing or not verified. Unknown information is not a negative finding.') on conflict do nothing;
   end if;
  end loop;
  for p in select * from jsonb_each(coalesce(a->'platforms','{}')) loop
   if p.value->>'relevant'='true' and (p.value->>'state'='Missing' or (p.value->>'score')::numeric<=2) then
    insert into public.cc_bi_suggestions(workspace_id,business_id,dedup_key,title,category,reason) values(new.workspace_id,new.business_id,'opportunity:'||p.key,p.key||' Optimization Opportunity',case when p.key='Website' then 'Website' when p.key='Google Business Profile' then p.key else 'Social Media' end,coalesce(p.value->>'explanation','Review this marketing opportunity.')) on conflict do nothing;
   end if;
  end loop;
 elsif tg_table_name='cc_bi_profiles' then
  if coalesce((new.crm->>'do_not_contact')::boolean,false) then return new; end if;
  if new.crm->>'stage' in ('Qualified','Ready to Contact') then key:='outreach-review';title:='Review Outreach Opportunity';cat:='Outreach';reason:='A qualified lead needs a reviewed contact approach before any external action.';
  elsif new.crm->>'stage'='Client Won' then key:='client-onboarding';title:='Create Client Onboarding Tasks';cat:='Client Work';reason:='Verify the accepted agreement and prepare client onboarding.';
  else return new; end if;
  insert into public.cc_bi_suggestions(workspace_id,business_id,dedup_key,title,category,reason) values(new.workspace_id,new.business_id,key,title,cat,reason) on conflict do nothing;
 elsif tg_table_name='cc_emails' then
  if new.business_id is null or new.direction<>'Inbound' or new.message_type<>'Human' then return new; end if;
  if exists(select 1 from public.cc_bi_profiles where workspace_id=new.workspace_id and business_id=new.business_id and crm->>'do_not_contact'='true') then return new; end if;
  insert into public.cc_bi_suggestions(workspace_id,business_id,dedup_key,title,category,reason) values(new.workspace_id,new.business_id,'reply:'||new.id::text,'Follow Up With Business','Follow-up','A human inbound message was logged: '||new.subject||'. Review the communication before replying.') on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.cc_bi_auto_suggest() from public,anon,authenticated;
create trigger cc_bi_research_suggestions after insert on public.cc_bi_research for each row execute function public.cc_bi_auto_suggest();
create trigger cc_bi_crm_suggestions after insert or update of crm on public.cc_bi_profiles for each row execute function public.cc_bi_auto_suggest();
create trigger cc_bi_reply_suggestions after insert or update on public.cc_emails for each row execute function public.cc_bi_auto_suggest();
commit;
