-- Gmail credentials never enter browser-readable tables or AI prompts.
create schema if not exists cc_operations_private;
revoke all on schema cc_operations_private from public,anon,authenticated;
create table cc_operations_private.gmail_secrets(slot text primary key,secret_id uuid not null);
alter table cc_operations_private.gmail_secrets enable row level security;
create function public.cc_gmail_secret(p_slot text,p_action text default 'get',p_value jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare sid uuid; value jsonb;
begin
 if p_slot not in ('oauth_config','primary','legacy') then raise exception 'Unsupported credential slot';end if;
 perform pg_advisory_xact_lock(hashtextextended('cc-gmail:'||p_slot,0));
 select secret_id into sid from cc_operations_private.gmail_secrets where slot=p_slot;
 if p_action='set' then
  if p_value is null or jsonb_typeof(p_value)<>'object' then raise exception 'Credential object required';end if;
  if sid is null then
   sid:=vault.create_secret(p_value::text,'cc-gmail:'||p_slot,'Command Center server-only business Gmail credential');
   insert into cc_operations_private.gmail_secrets values(p_slot,sid);
  else perform vault.update_secret(sid,p_value::text);end if;
  return '{"saved":true}'::jsonb;
 elsif p_action='get' then
  if sid is null then return '{}'::jsonb;end if;
  select decrypted_secret::jsonb into value from vault.decrypted_secrets where id=sid;
  return coalesce(value,'{}'::jsonb);
 end if;
 raise exception 'Unsupported credential operation';
end $$;
revoke all on function public.cc_gmail_secret(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.cc_gmail_secret(text,text,jsonb) to service_role;

create table public.cc_gmail_oauth_states (
 state_hash text primary key,verifier text not null,slot text not null check(slot in ('primary','legacy')),
 requested_by uuid not null references auth.users(id),expires_at timestamptz not null default now()+interval '10 minutes'
);
alter table public.cc_gmail_oauth_states enable row level security;
revoke all on public.cc_gmail_oauth_states from public,anon,authenticated;
grant all on public.cc_gmail_oauth_states to service_role;
create policy cc_gmail_states_server on public.cc_gmail_oauth_states to service_role using(true) with check(true);

create table public.cc_email_dispatch_runs (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.cc_workspaces(id),
 message_id uuid not null unique references public.cc_ai_messages(id),requested_by uuid not null references auth.users(id),
 status text not null default 'Working' check(status in ('Working','Completed','Needs attention')),
 approval_ids uuid[] not null default '{}',result jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),finished_at timestamptz
);
alter table public.cc_email_dispatch_runs enable row level security;
revoke all on public.cc_email_dispatch_runs from public,anon,authenticated;
grant select on public.cc_email_dispatch_runs to authenticated;
grant all on public.cc_email_dispatch_runs to service_role;
create policy cc_dispatch_read on public.cc_email_dispatch_runs for select to authenticated using(public.cc_has_access(workspace_id,false));
create policy cc_dispatch_server on public.cc_email_dispatch_runs to service_role using(true) with check(true);

create function public.cc_begin_email_dispatch(p_message_id uuid,p_user_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare m public.cc_ai_messages;r public.cc_email_dispatch_runs;command text;ids uuid[];
begin
 select * into m from public.cc_ai_messages where id=p_message_id and author_id=p_user_id and author_type='human' and workspace_id='c8748032-cdd3-443b-8c56-2e846cc9bf31';
 if not found then raise exception 'A saved request from the signed-in partner is required';end if;
 if m.created_at<now()-interval '10 minutes' then raise exception 'Send command expired. Enter a fresh send command.';end if;
 if not exists(select 1 from public.cc_ai_threads where id=m.thread_id and workspace_id=m.workspace_id and status='Open') then raise exception 'The send command must be in an open conversation';end if;
 if not exists(select 1 from public.cc_members where workspace_id=m.workspace_id and user_id=p_user_id and enabled and role in ('owner','editor')) then raise exception 'Partner editing access required';end if;
 command:=lower(regexp_replace(regexp_replace(trim(m.body),'^nova[, ]+','','i'),'[.!]+$','','g'));
 if command not in ('run the approved email campaign now','run approved email campaign now','send all approved emails','send the approved emails','send all emails currently marked approved to send','run the email campaign now') then raise exception 'Use the explicit command: Run the approved email campaign now.';end if;
 perform pg_advisory_xact_lock(hashtextextended(m.workspace_id::text||':campaign',0));
 select * into r from public.cc_email_dispatch_runs where message_id=m.id;
 if found then return to_jsonb(r)||'{"existing":true}'::jsonb;end if;
 if exists(select 1 from public.cc_email_dispatch_runs where workspace_id=m.workspace_id and status='Working') then raise exception 'Another campaign run is in progress. Reconcile it before starting another.';end if;
 if (select count(*) from public.cc_email_dispatch_runs where workspace_id=m.workspace_id and created_at>now()-interval '1 day')>=10 then raise exception 'Daily campaign-run limit reached';end if;
 select coalesce(array_agg(id),'{}') into ids from (select id from public.cc_email_approvals where workspace_id=m.workspace_id and status='Approved' order by created_at,id limit 10) a;
 insert into public.cc_email_dispatch_runs(workspace_id,message_id,requested_by,approval_ids) values(m.workspace_id,m.id,p_user_id,ids) returning * into r;
 return to_jsonb(r)||'{"existing":false}'::jsonb;
end $$;
revoke all on function public.cc_begin_email_dispatch(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cc_begin_email_dispatch(uuid,uuid) to service_role;

-- Existing dispatch RPCs run as the service role; RLS bypass alone does not grant table access.
grant select on public.cc_members,public.cc_businesses,public.cc_emails,public.cc_tasks,public.cc_listings,public.cc_purchases,public.cc_bi_profiles to service_role;
grant insert on public.cc_emails,public.cc_tasks to service_role;
notify pgrst,'reload schema';

-- Reserve a conservative allowance for bounded tool-assisted chat. This is not a charge.
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
 if v_spend+0.05>8.50 then raise exception 'Monthly chat safety budget reached.'; end if;
 insert into public.cc_ai_reply_runs(message_id,workspace_id,requested_by,agent,status,reserved_usd) values(m.id,m.workspace_id,p_user_id,p_agent,'Working',0.05)
 on conflict(message_id) do update set status='Working',attempts=cc_ai_reply_runs.attempts+1,reserved_usd=cc_ai_reply_runs.reserved_usd+0.05,lease=gen_random_uuid(),claimed_at=now(),last_error=null
 returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.cc_claim_ai_reply(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cc_claim_ai_reply(uuid,uuid,text) to service_role;


create function public.cc_dispatch_actor_active(p_run_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.cc_email_dispatch_runs r join public.cc_members m on m.workspace_id=r.workspace_id and m.user_id=r.requested_by where r.id=p_run_id and r.status='Working' and m.enabled and m.role in ('owner','editor'));
$$;
revoke all on function public.cc_dispatch_actor_active(uuid) from public,anon,authenticated;
grant execute on function public.cc_dispatch_actor_active(uuid) to service_role;
