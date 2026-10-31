-- Additive portal workflow; public visitors access only the authenticated Edge Function.
alter table public.cc_visibility_report_archives add column if not exists research_run_id uuid references public.cc_visibility_research_runs(id);
create unique index if not exists cc_report_one_approved_run on public.cc_visibility_report_archives(research_run_id) where research_run_id is not null;
create table if not exists public.cc_client_report_sessions (
 token_hash text primary key, link_id uuid not null references public.cc_client_report_links(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '1 hour'
);
alter table public.cc_client_report_sessions enable row level security;
revoke all on public.cc_client_report_sessions from anon,authenticated;
grant all on public.cc_client_report_sessions to service_role;
create table if not exists public.cc_client_report_requests (
 id uuid primary key default gen_random_uuid(),link_id uuid not null references public.cc_client_report_links(id),
 business_id uuid not null references public.cc_businesses(id),kind text not null check(kind in ('call','question','services','cancellation')),
 name text not null,email text not null,phone text not null default '',message text not null default '',services jsonb not null default '[]',
 support_type text not null default '',requested_date date,requested_time text,slot_start timestamptz,after_hours boolean not null default false,
 status text not null default 'Requested' check(status in ('Requested','Confirmed','Alternative offered','Closed')),
 staff_reply text not null default '',assignee text not null default 'Michelle',task_id uuid references public.cc_tasks(id),
 policy_version text,policy_accepted_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 client_key uuid not null,unique(link_id,client_key),email_status text not null default 'Not sent',email_id text,email_sent_at timestamptz
);
alter table public.cc_client_report_requests enable row level security;
revoke all on public.cc_client_report_requests from anon,authenticated;
grant all on public.cc_client_report_requests to service_role;
create index if not exists cc_portal_requests_business on public.cc_client_report_requests(business_id,created_at desc);
create index if not exists cc_portal_sessions_expiry on public.cc_client_report_sessions(expires_at);
-- Service-only atomic appointment confirmation, including existing Appointment Manager tasks.
create or replace function public.cc_confirm_portal_call(p_id uuid,p_actor uuid,p_assignee text,p_start timestamptz,p_date date,p_time text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare r cc_client_report_requests; t uuid; meta jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('mkt-portal-appointments'));
 select * into r from cc_client_report_requests where id=p_id for update;
 if r.id is null or r.kind<>'call' then raise exception 'Call request not found';end if;
 if r.status='Confirmed' then return r.task_id;end if;
 if p_assignee not in ('Michelle','Tim') or p_start<=now() then raise exception 'Choose a future appointment and team member';end if;
 if exists(select 1 from cc_client_report_requests where status='Confirmed' and assignee=p_assignee and id<>p_id and slot_start<p_start+interval '30 minutes' and slot_start+interval '30 minutes'>p_start)
 then raise exception 'This time is already booked';end if;
 if exists(select 1 from cc_tasks q where q.assignee=p_assignee and q.due_date=p_date and q.status not in ('Done','Cancelled') and q.notes like '%"appointmentManager"%' and (q.notes::jsonb->'appointmentManager'->>'time') ~ '^\d{2}:\d{2}$' and (q.notes::jsonb->'appointmentManager'->>'time')::time < p_time::time+interval '30 minutes' and (q.notes::jsonb->'appointmentManager'->>'time')::time + make_interval(mins=>coalesce((q.notes::jsonb->'appointmentManager'->>'duration')::integer,30)) > p_time::time)
 then raise exception 'Appointment Manager has a conflict';end if;
 meta=jsonb_build_object('format','mkt-portfolio-v1','contactChannel','Phone call','portalRequestId',r.id,'appointmentManager',jsonb_build_object('type','Phone call','date',p_date,'time',p_time,'duration',30,'status','Confirmed','notes',r.message,'reminder',30));
 if r.task_id is not null then update cc_tasks set status='Done' where id=r.task_id and status='Open';end if;
 insert into cc_tasks(business_id,title,type,status,assignee,due_date,notes,created_by) values(r.business_id,'Phone call — client visibility report','Task','Open',p_assignee,p_date,meta::text,p_actor) returning id into t;
 update cc_client_report_requests set status='Confirmed',assignee=p_assignee,slot_start=p_start,requested_date=p_date,requested_time=p_time,task_id=t,updated_at=now() where id=p_id;
 return t;
end $$;
revoke all on function public.cc_confirm_portal_call(uuid,uuid,text,timestamptz,date,text) from public,anon,authenticated;
grant execute on function public.cc_confirm_portal_call(uuid,uuid,text,timestamptz,date,text) to service_role;
