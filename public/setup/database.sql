-- MKT Visibility Command Center: additive, isolated tables; no existing data is changed.
-- Run once as the Supabase project database administrator.
begin;
do $$ begin
  if to_regclass('public.cc_workspaces') is not null or to_regclass('public.cc_members') is not null
     or to_regclass('public.cc_businesses') is not null or to_regclass('public.cc_listings') is not null
     or to_regclass('public.cc_emails') is not null or to_regclass('public.cc_tasks') is not null
     or to_regclass('public.cc_audit_log') is not null then
    raise exception 'Command Center tables already exist. Stop and inspect them; do not overwrite existing work.';
  end if;
end $$;

create table public.cc_workspaces (
 id uuid primary key default gen_random_uuid(), name text not null
);
insert into public.cc_workspaces(id,name) values ('c8748032-cdd3-443b-8c56-2e846cc9bf31','MKT Visibility');
create table public.cc_members (
 workspace_id uuid not null references public.cc_workspaces(id),
 user_id uuid not null references auth.users(id),
 display_name text not null check(char_length(display_name) between 1 and 100),
 role text not null default 'editor' check(role in ('owner','editor','viewer')),
 enabled boolean not null default true,
 primary key(workspace_id,user_id)
);
-- Membership can only be changed through administrator SQL, never browser input or signup metadata.
create or replace function public.cc_has_access(target_workspace uuid, require_write boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.cc_members m where m.workspace_id = target_workspace
   and m.user_id = (select auth.uid()) and m.enabled
   and (not require_write or m.role in ('owner','editor')));
$$;
revoke all on function public.cc_has_access(uuid,boolean) from public, anon;
grant execute on function public.cc_has_access(uuid,boolean) to authenticated;

create table public.cc_businesses (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 name text not null check(char_length(trim(name)) between 1 and 200),
 contact_name text not null default '' check(char_length(contact_name)<=200),
 email text not null default '' check(email='' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text not null default '' check(char_length(phone)<=80),
 address text not null default '' check(char_length(address)<=500),
 city text not null default '' check(char_length(city)<=100),
 website text not null default '' check(website='' or website ~ '^https?://'),
 kind text not null default 'Prospect' check(kind in ('Prospect','Client')),
 status text not null default 'Active' check(status in ('Active','Paused','Archived')),
 stage text not null default 'New' check(stage in ('New','Contacted','Discovery','Proposal','Won','Lost')),
 monthly_fee numeric(12,2) not null default 0 check(monthly_fee between 0 and 100000000),
 deal_value numeric(12,2) not null default 0 check(deal_value between 0 and 100000000),
 notes text not null default '' check(char_length(notes)<=4000),
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id)
);
create table public.cc_listings (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 business_id uuid not null,
 site text not null check(site in ('Loving Longmont','MKT Colorado')),
 title text not null check(char_length(trim(title)) between 1 and 200),
 city text not null default '' check(char_length(city)<=100),
 pages text[] not null default '{}',
 url text not null default '' check(url='' or url ~ '^https?://'),
 status text not null default 'Draft' check(status in ('Draft','Published','Needs update','Archived')),
 description text not null default '' check(char_length(description)<=4000),
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
create table public.cc_emails (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 business_id uuid,
 recipient text not null check(recipient ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 subject text not null check(char_length(trim(subject)) between 1 and 300),
 direction text not null default 'Outbound' check(direction in ('Outbound','Inbound')),
 status text not null default 'Draft' check(status in ('Draft','Planned','Sent','Replied','Bounced')),
 occurred_on date,
 campaign text not null default '' check(char_length(campaign)<=200),
 notes text not null default '' check(char_length(notes)<=4000),
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status not in ('Sent','Replied') or occurred_on is not null),
 check(direction <> 'Inbound' or status <> 'Draft'),
 foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
create table public.cc_tasks (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 business_id uuid,
 title text not null check(char_length(trim(title)) between 1 and 200),
 type text not null default 'Task' check(type in ('Task','Follow-up','Project')),
 status text not null default 'Open' check(status in ('Open','In progress','Done','Cancelled')),
 priority text not null default 'Normal' check(priority in ('Normal','High','Low')),
 due_date date,
 assignee text not null default 'Unassigned' check(char_length(assignee)<=100),
 notes text not null default '' check(char_length(notes)<=4000),
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(type <> 'Follow-up' or due_date is not null),
 foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
create table public.cc_audit_log (
 id bigint generated always as identity primary key,
 workspace_id uuid not null references public.cc_workspaces(id),
 actor_id uuid references auth.users(id), table_name text not null,
 record_id uuid not null, action text not null check(action in ('INSERT','UPDATE')),
 created_at timestamptz not null default now(),
 -- No copies of confidential record contents in the audit log.
 changed_fields text[] not null default '{}'
);

create or replace function public.cc_stamp_record() returns trigger
language plpgsql set search_path = '' as $$
begin
 if tg_op='INSERT' then
   new.created_by := auth.uid(); new.created_at := now();
 else
   if new.workspace_id is distinct from old.workspace_id or new.id is distinct from old.id
      or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
      raise exception 'Record identity and provenance cannot be changed';
   end if;
 end if;
 new.updated_at := now(); return new;
end $$;
revoke all on function public.cc_stamp_record() from public, anon, authenticated;

create or replace function public.cc_audit_record() returns trigger
language plpgsql security definer set search_path = '' as $$
declare changed text[];
begin
 if tg_op='UPDATE' then
   select coalesce(array_agg(n.key),'{}') into changed from jsonb_each(to_jsonb(new)) n
   where n.value is distinct from to_jsonb(old)->n.key and n.key <> 'updated_at';
 else changed := '{}'; end if;
 insert into public.cc_audit_log(workspace_id,actor_id,table_name,record_id,action,changed_fields)
 values(new.workspace_id,auth.uid(),tg_table_name,new.id,tg_op,changed);
 return new;
end $$;
revoke all on function public.cc_audit_record() from public, anon, authenticated;

alter table public.cc_workspaces enable row level security;
alter table public.cc_members enable row level security;
alter table public.cc_audit_log enable row level security;
revoke all on public.cc_workspaces, public.cc_members, public.cc_audit_log from anon, authenticated;
grant select on public.cc_workspaces, public.cc_members, public.cc_audit_log to authenticated;
create policy cc_workspace_read on public.cc_workspaces for select to authenticated using(public.cc_has_access(id));
create policy cc_self_membership on public.cc_members for select to authenticated using(user_id=(select auth.uid()) and enabled);
create policy cc_audit_read on public.cc_audit_log for select to authenticated using(public.cc_has_access(workspace_id));

do $$ declare t text; begin
 foreach t in array array['cc_businesses','cc_listings','cc_emails','cc_tasks'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from anon, authenticated',t);
   execute format('grant select, insert, update on public.%I to authenticated',t);
   execute format('create policy cc_read on public.%I for select to authenticated using(public.cc_has_access(workspace_id))',t);
   execute format('create policy cc_insert on public.%I for insert to authenticated with check(public.cc_has_access(workspace_id,true))',t);
   execute format('create policy cc_update on public.%I for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true))',t);
   execute format('create trigger cc_stamp before insert or update on public.%I for each row execute function public.cc_stamp_record()',t);
   execute format('create trigger cc_audit after insert or update on public.%I for each row execute function public.cc_audit_record()',t);
   execute format('create index on public.%I(workspace_id,created_at desc,id)',t);
 end loop;
end $$;
create index on public.cc_listings(workspace_id,site);
create index on public.cc_tasks(workspace_id,type,status,due_date);
create index on public.cc_businesses(workspace_id,stage,status);
create index on public.cc_emails(workspace_id,business_id,occurred_on);
create index on public.cc_audit_log(workspace_id,created_at desc);
-- No DELETE privilege or policy: archive businesses/listings and cancel tasks instead.
-- No anonymous grants, no public registration bootstrap, no outbound email functions.
commit;

begin;
alter table public.cc_businesses
 add column description text not null default '' check(char_length(description)<=4000),
 add column categories text[] not null default '{}' check(cardinality(categories)<=40 and char_length(array_to_string(categories,','))<=2000),
 add column social_urls text[] not null default '{}' check(cardinality(social_urls)<=30 and char_length(array_to_string(social_urls,','))<=6000),
 add column image_url text not null default '' check(image_url='' or image_url ~ '^https?://');
alter table public.cc_listings add column added_on date;
alter table public.cc_emails
 add column source_message_id text not null default '' check(char_length(source_message_id)<=1000),
 add column related_business_ids uuid[] not null default '{}' check(cardinality(related_business_ids)<=40);
create unique index cc_email_source_unique on public.cc_emails(workspace_id,source_message_id) where source_message_id<>'';
create function public.cc_validate_related_businesses() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from unnest(new.related_business_ids) id where not exists(select 1 from public.cc_businesses b where b.id=id and b.workspace_id=new.workspace_id)) then
  raise exception 'Related businesses must belong to this workspace';
 end if;
 return new;
end $$;
revoke all on function public.cc_validate_related_businesses() from public,anon,authenticated;
create trigger cc_related_businesses before insert or update on public.cc_emails for each row execute function public.cc_validate_related_businesses();
create table public.cc_purchases (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 business_id uuid not null,
 product text not null check(char_length(trim(product)) between 1 and 200),
 purchased_on date not null,
 amount numeric(12,2) not null default 0 check(amount between 0 and 100000000),
 status text not null default 'Ordered' check(status in ('Ordered','Paid','Refunded','Cancelled')),
 notes text not null default '' check(char_length(notes)<=4000),
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
alter table public.cc_purchases enable row level security;
revoke all on public.cc_purchases from anon,authenticated;
grant select,insert,update on public.cc_purchases to authenticated;
create policy cc_read on public.cc_purchases for select to authenticated using(public.cc_has_access(workspace_id));
create policy cc_insert on public.cc_purchases for insert to authenticated with check(public.cc_has_access(workspace_id,true));
create policy cc_update on public.cc_purchases for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true));
create trigger cc_stamp before insert or update on public.cc_purchases for each row execute function public.cc_stamp_record();
create trigger cc_audit after insert or update on public.cc_purchases for each row execute function public.cc_audit_record();
create index on public.cc_purchases(workspace_id,business_id,purchased_on);
commit;

begin;
create or replace function public.cc_validate_related_businesses() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from unnest(new.related_business_ids) as requested(business_id) where not exists(select 1 from public.cc_businesses b where b.id=requested.business_id and b.workspace_id=new.workspace_id)) then raise exception 'Related businesses must belong to this workspace'; end if;
 return new;
end $$;
alter table public.cc_emails add column occurred_at timestamptz,
 add column message_type text not null default 'Human' check(message_type in ('Human','Automatic','Delivery','Form'));
commit;

begin; do $$ begin if to_regprocedure('public.rls_auto_enable()') is not null then revoke execute on function public.rls_auto_enable() from public,anon,authenticated; end if; end $$; commit;

begin; alter table public.cc_businesses add column internal_notes text not null default '' check(char_length(internal_notes)<=10000); commit;

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

begin;
create table public.cc_notes (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 business_id uuid not null,
 parent_id uuid,
 body text not null check(char_length(body)<=10000),
 author_name text not null default '',
 edited_by_name text not null default '',
 deleted_at timestamptz,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,business_id,id),
 foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id),
 foreign key(workspace_id,business_id,parent_id) references public.cc_notes(workspace_id,business_id,id),
 check(parent_id is distinct from id),
 check((deleted_at is null and btrim(body)<>'') or (deleted_at is not null and body=''))
);
-- Preserve legacy text without claiming its original author or writing time is known.
insert into public.cc_notes(workspace_id,business_id,body,author_name)
 select workspace_id,id,internal_notes,'Imported existing note (original author/time not recorded)' from public.cc_businesses where btrim(internal_notes)<>'';
-- The imported entries preserve all text; clear the former box to avoid stale duplicates.
update public.cc_businesses set internal_notes='' where btrim(internal_notes)<>'';
create function public.cc_note_stamp() returns trigger language plpgsql security invoker set search_path='' as $$
declare member_name text;
begin
 select display_name into member_name from public.cc_members where workspace_id=new.workspace_id and user_id=auth.uid() and enabled;
 if member_name is null then raise exception 'Approved membership required'; end if;
 if tg_op='INSERT' then
  new.author_name:=member_name; new.edited_by_name:=''; new.created_by:=auth.uid(); new.created_at:=now(); new.deleted_at:=null;
  if new.parent_id is not null and not exists(select 1 from public.cc_notes n where n.id=new.parent_id and n.workspace_id=new.workspace_id and n.business_id=new.business_id and n.parent_id is null and n.deleted_at is null) then raise exception 'Reply requires an active note on this business'; end if;
 else
  if new.workspace_id is distinct from old.workspace_id or new.id is distinct from old.id or new.business_id is distinct from old.business_id or new.parent_id is distinct from old.parent_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at or new.author_name is distinct from old.author_name then raise exception 'Note identity and attribution cannot change'; end if;
  if old.deleted_at is not null then raise exception 'Deleted notes cannot be edited'; end if;
  new.edited_by_name:=member_name;
  if new.deleted_at is not null then new.deleted_at:=now(); new.body:=''; end if;
 end if;
 new.updated_at:=now(); return new;
end $$;
revoke all on function public.cc_note_stamp() from public,anon,authenticated;
alter table public.cc_notes enable row level security;
revoke all on public.cc_notes from anon,authenticated;
grant select,insert,update on public.cc_notes to authenticated;
create policy cc_read on public.cc_notes for select to authenticated using(public.cc_has_access(workspace_id));
create policy cc_insert on public.cc_notes for insert to authenticated with check(public.cc_has_access(workspace_id,true));
create policy cc_update on public.cc_notes for update to authenticated using(public.cc_has_access(workspace_id,true) and (created_by=auth.uid() or exists(select 1 from public.cc_members m where m.workspace_id=cc_notes.workspace_id and m.user_id=auth.uid() and m.enabled and m.role='owner'))) with check(public.cc_has_access(workspace_id,true) and (created_by=auth.uid() or exists(select 1 from public.cc_members m where m.workspace_id=cc_notes.workspace_id and m.user_id=auth.uid() and m.enabled and m.role='owner')));
create trigger cc_stamp before insert or update on public.cc_notes for each row execute function public.cc_note_stamp();
create trigger cc_audit after insert or update on public.cc_notes for each row execute function public.cc_audit_record();
create index on public.cc_notes(workspace_id,business_id,created_at);
create index on public.cc_notes(workspace_id,business_id,parent_id);
commit;

begin;
alter table public.cc_tasks add column completed_at timestamptz, add column completed_by uuid references auth.users(id), add column completed_by_name text;
-- Recover existing completions only where an authenticated audit event supplies evidence.
update public.cc_tasks t set completed_at=a.created_at, completed_by=a.actor_id, completed_by_name=m.display_name
from (select distinct on(record_id) record_id,actor_id,created_at from public.cc_audit_log where table_name='cc_tasks' and (action='INSERT' or 'status'=any(changed_fields)) order by record_id,id desc) a
join public.cc_members m on m.user_id=a.actor_id
where t.id=a.record_id and t.workspace_id=m.workspace_id and t.status='Done';
create function public.cc_task_completion_stamp() returns trigger language plpgsql security invoker set search_path='' as $$
declare member_name text;
begin
 if new.status='Done' and (tg_op='INSERT' or old.status is distinct from 'Done') then
  select display_name into member_name from public.cc_members where workspace_id=new.workspace_id and user_id=auth.uid() and enabled;
  if member_name is null then raise exception 'Approved membership required'; end if;
  new.completed_at:=clock_timestamp(); new.completed_by:=auth.uid(); new.completed_by_name:=member_name;
 elsif tg_op='UPDATE' then
  new.completed_at:=old.completed_at; new.completed_by:=old.completed_by; new.completed_by_name:=old.completed_by_name;
 else
  new.completed_at:=null; new.completed_by:=null; new.completed_by_name:=null;
 end if;
 return new;
end $$;
revoke all on function public.cc_task_completion_stamp() from public,anon,authenticated;
create trigger cc_task_completion before insert or update on public.cc_tasks for each row execute function public.cc_task_completion_stamp();
commit;

-- Already applied to the live workspace. Apply only if missing.
alter table public.cc_businesses drop constraint if exists cc_businesses_kind_check;
alter table public.cc_businesses add constraint cc_businesses_kind_check check (kind in ('Prospect','Client','Non-profit','Partner-owned Business'));
