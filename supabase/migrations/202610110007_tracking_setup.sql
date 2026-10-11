begin;
create table public.cc_tracking_setup (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 brand text not null check(brand in ('MKT Visibility','MKT Colorado','Loving Longmont','Open Theory Cove','Boulder County Photography')),
 measurement_id text not null check(measurement_id ~ '^G-[A-Z0-9]+$'),
 installed_at timestamptz not null check(installed_at<=now()),
 source_url text not null check(source_url ~ '^https://github.com/'),
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_id,brand)
);
alter table public.cc_tracking_setup enable row level security;
revoke all on public.cc_tracking_setup from anon,authenticated;
grant select,insert,update on public.cc_tracking_setup to authenticated;
create policy cc_read on public.cc_tracking_setup for select to authenticated using(public.cc_has_access(workspace_id));
create policy cc_insert on public.cc_tracking_setup for insert to authenticated with check(public.cc_has_access(workspace_id,true));
create policy cc_update on public.cc_tracking_setup for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true));
create trigger cc_stamp before insert or update on public.cc_tracking_setup for each row execute function public.cc_stamp_record();
create trigger cc_audit after insert or update on public.cc_tracking_setup for each row execute function public.cc_audit_record();
create index on public.cc_tracking_setup(workspace_id,brand);
commit;
