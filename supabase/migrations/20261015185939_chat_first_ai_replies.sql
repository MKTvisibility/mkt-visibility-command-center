-- Include the previously deployed AI schema for reproducible fresh installations.
create table if not exists public.cc_ai_threads (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 title text not null check(length(trim(title)) between 1 and 180), participants text[] not null default '{}',
 status text not null default 'Open' check(status in ('Open','Paused','Closed')), created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.cc_ai_messages (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 thread_id uuid not null references public.cc_ai_threads(id), body text not null check(length(trim(body)) between 1 and 10000), author_id uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),author_type text not null default 'human' check(author_type in ('human','agent')),agent text
);
create table if not exists public.cc_ai_tasks (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 agent text not null,title text not null,details text not null default '',status text not null default 'Queued' check(status in ('Queued','In progress','Needs review','Completed','Blocked')),
 created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),deliverable text,completed_at timestamptz,reviewed_by uuid references auth.users(id),reviewed_at timestamptz,last_error text
);
alter table public.cc_ai_threads enable row level security;
alter table public.cc_ai_messages enable row level security;
alter table public.cc_ai_tasks enable row level security;
revoke all on public.cc_ai_threads,public.cc_ai_messages,public.cc_ai_tasks from anon;
grant select,insert,update on public.cc_ai_threads,public.cc_ai_tasks to authenticated;
grant select,insert on public.cc_ai_messages to authenticated;
grant all on public.cc_ai_threads,public.cc_ai_messages,public.cc_ai_tasks to service_role;
do $$declare tbl text;begin
 foreach tbl in array array['cc_ai_threads','cc_ai_tasks'] loop
 if not exists(select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl||'_read') then execute format('create policy %I on public.%I for select to authenticated using(public.cc_has_access(workspace_id,false))',tbl||'_read',tbl);end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl||'_insert') then execute format('create policy %I on public.%I for insert to authenticated with check(public.cc_has_access(workspace_id,true) and created_by=auth.uid())',tbl||'_insert',tbl);end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename=tbl and policyname=tbl||'_update') then execute format('create policy %I on public.%I for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true))',tbl||'_update',tbl);end if;
 end loop;
end $$;

-- Reply claims are server-only. Existing business records and approvals are untouched.
create table public.cc_ai_reply_runs (
 message_id uuid primary key references public.cc_ai_messages(id) on delete restrict,
 workspace_id uuid not null references public.cc_workspaces(id),
 requested_by uuid not null references auth.users(id),
 agent text not null,
 status text not null check (status in ('Working','Failed','Completed')),
 lease uuid not null default gen_random_uuid(),
 attempts integer not null default 1 check (attempts between 1 and 3),
 reserved_usd numeric not null default 0.01,
 usage jsonb not null default '{}'::jsonb,
 reply_id uuid references public.cc_ai_messages(id),
 last_error text,
 created_at timestamptz not null default now(),
 claimed_at timestamptz not null default now()
);
alter table public.cc_ai_reply_runs enable row level security;
revoke all on public.cc_ai_reply_runs from public,anon,authenticated;
grant all on public.cc_ai_reply_runs to service_role;
create policy cc_ai_reply_server on public.cc_ai_reply_runs to service_role using(true) with check(true);
create index cc_ai_reply_runs_usage on public.cc_ai_reply_runs(workspace_id,created_at);

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
 if v_spend+0.01>8.50 then raise exception 'Monthly chat safety budget reached.'; end if;
 insert into public.cc_ai_reply_runs(message_id,workspace_id,requested_by,agent,status) values(m.id,m.workspace_id,p_user_id,p_agent,'Working')
 on conflict(message_id) do update set status='Working',attempts=cc_ai_reply_runs.attempts+1,reserved_usd=cc_ai_reply_runs.reserved_usd+0.01,lease=gen_random_uuid(),claimed_at=now(),last_error=null
 returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.cc_claim_ai_reply(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cc_claim_ai_reply(uuid,uuid,text) to service_role;

create or replace function public.cc_finish_ai_reply(p_message_id uuid,p_lease uuid,p_body text,p_usage jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.cc_ai_reply_runs; m public.cc_ai_messages; reply public.cc_ai_messages;
begin
 select * into r from public.cc_ai_reply_runs where message_id=p_message_id for update;
 if not found or r.lease<>p_lease then raise exception 'Reply lease mismatch.'; end if;
 if r.status='Completed' then select * into reply from public.cc_ai_messages where id=r.reply_id;return to_jsonb(reply);end if;
 if r.status<>'Working' then raise exception 'Reply is not running.';end if;
 select * into m from public.cc_ai_messages where id=p_message_id;
 insert into public.cc_ai_messages(workspace_id,thread_id,body,author_id,author_type,agent) values(r.workspace_id,m.thread_id,p_body,r.requested_by,'agent',r.agent) returning * into reply;
 update public.cc_ai_reply_runs set status='Completed',reply_id=reply.id,usage=p_usage,last_error=null where message_id=p_message_id;
 return to_jsonb(reply);
end $$;
revoke all on function public.cc_finish_ai_reply(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.cc_finish_ai_reply(uuid,uuid,text,jsonb) to service_role;

-- Human clients cannot forge an agent's identity or cross-link workspaces.
drop policy if exists cc_ai_messages_insert on public.cc_ai_messages;
create policy cc_ai_messages_insert on public.cc_ai_messages for insert to authenticated with check (
 public.cc_has_access(workspace_id,true) and author_id=auth.uid() and author_type='human' and agent is null and exists(select 1 from public.cc_ai_threads t where t.id=cc_ai_messages.thread_id and t.workspace_id=cc_ai_messages.workspace_id and t.status='Open')
);
drop policy if exists cc_ai_messages_read on public.cc_ai_messages;
create policy cc_ai_messages_read on public.cc_ai_messages for select to authenticated using (
 public.cc_has_access(workspace_id,false) and exists(select 1 from public.cc_ai_threads t where t.id=cc_ai_messages.thread_id and t.workspace_id=cc_ai_messages.workspace_id)
);
