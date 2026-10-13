begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
alter table public.cc_statistics add column automated boolean not null default false;
drop policy cc_insert on public.cc_statistics;
drop policy cc_update on public.cc_statistics;
create policy cc_insert on public.cc_statistics for insert to authenticated with check(public.cc_has_access(workspace_id,true) and not automated);
create policy cc_update on public.cc_statistics for update to authenticated using(public.cc_has_access(workspace_id,true) and not automated) with check(public.cc_has_access(workspace_id,true) and not automated);

create table public.cc_ga_sync_state (
 workspace_id uuid not null references public.cc_workspaces(id),
 brand text not null,
 property_id text not null check(property_id ~ '^\d+$'),
 status text not null default 'needs_setup' check(status in ('needs_setup','success','error')),
 last_attempt_at timestamptz,last_success_at timestamptz,last_error text not null default '',
 period_start date,period_end date,sources jsonb not null default '[]',locations jsonb not null default '[]',
 primary key(workspace_id,brand)
);
alter table public.cc_ga_sync_state enable row level security;
revoke all on public.cc_ga_sync_state from public,anon,authenticated;
grant select on public.cc_ga_sync_state to authenticated;
grant all on public.cc_ga_sync_state to service_role;
create policy cc_read on public.cc_ga_sync_state for select to authenticated using(public.cc_has_access(workspace_id));
create table public.cc_ga_sync_control (
 workspace_id uuid primary key references public.cc_workspaces(id),lease uuid,lease_until timestamptz,last_requested_at timestamptz
);
alter table public.cc_ga_sync_control enable row level security;
revoke all on public.cc_ga_sync_control from public,anon,authenticated;
grant all on public.cc_ga_sync_control to service_role;

commit;
