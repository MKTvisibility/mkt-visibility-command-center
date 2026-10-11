begin;
create table public.cc_statistics (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 brand text not null check(brand in ('MKT Visibility','MKT Colorado','Loving Longmont','Open Theory Cove','Boulder County Photography')),
 channel text not null check(channel in ('Website','Google Search','Facebook','Instagram','LinkedIn','YouTube','TikTok','Pinterest','Etsy')),
 metric text not null check(metric in ('Visitors','Page views','Sessions','Search clicks','Search impressions','Followers','Content views','Interactions','Posts published','Link clicks','Inquiries','Orders','Revenue')),
 period_start date not null,period_end date not null check(period_end>=period_start and period_end<=current_date),
 value numeric(16,2) not null check(value between 0 and 100000000),
 source text not null check(source in ('Manual report','Google Analytics','Google Search Console','Metricool','Platform report')),
 source_url text not null default '' check(source_url='' or source_url ~ '^https?://'),
 notes text not null default '' check(char_length(notes)<=4000),
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(workspace_id,brand,channel,metric,period_start,period_end,source)
);
alter table public.cc_statistics enable row level security;
revoke all on public.cc_statistics from anon,authenticated;
grant select,insert,update on public.cc_statistics to authenticated;
create policy cc_read on public.cc_statistics for select to authenticated using(public.cc_has_access(workspace_id));
create policy cc_insert on public.cc_statistics for insert to authenticated with check(public.cc_has_access(workspace_id,true));
create policy cc_update on public.cc_statistics for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true));
create trigger cc_stamp before insert or update on public.cc_statistics for each row execute function public.cc_stamp_record();
create trigger cc_audit after insert or update on public.cc_statistics for each row execute function public.cc_audit_record();
create index on public.cc_statistics(workspace_id,brand,channel,period_end);
commit;
