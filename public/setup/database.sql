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

create table public.cc_ll_draft_publications(
 business_id uuid primary key references public.cc_businesses(id),
 workspace_id uuid not null references public.cc_workspaces(id),
 public_content jsonb not null,
 directory boolean not null default true,
 pages text[] not null default array['businesses.html'],
 spotlight_pages text[] not null default '{}',
 spotlight_order integer not null default 0,
 active boolean not null default true,
 published_at timestamptz not null default now(),
 published_by uuid default auth.uid() references auth.users(id),
 check(public_content - array['id','name','description','story','address','phone','website','image_url','social_urls','categories','gallery_images']::text[] = '{}'::jsonb)
);
alter table public.cc_ll_draft_publications enable row level security;
grant select on public.cc_ll_draft_publications to anon,authenticated;
grant insert,update on public.cc_ll_draft_publications to authenticated;
create policy public_read on public.cc_ll_draft_publications for select to anon,authenticated using(true);
create policy partner_insert on public.cc_ll_draft_publications for insert to authenticated with check(public.cc_has_access(workspace_id,true));
create policy partner_update on public.cc_ll_draft_publications for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true));
create function public.cc_publish_ll_draft(p_business_id uuid,p_pages text[],p_directory boolean default true,p_spotlight_pages text[] default '{}',p_order integer default 0,p_active boolean default true)
returns public.cc_ll_draft_publications language plpgsql security invoker set search_path='' as $$
declare b public.cc_businesses; m jsonb; f jsonb; payload jsonb; result public.cc_ll_draft_publications;
begin
 select * into b from public.cc_businesses where id=p_business_id;
 if b.id is null or not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required';end if;
 if cardinality(p_pages)>20 or cardinality(p_spotlight_pages)>20 or exists(select 1 from unnest(p_pages||p_spotlight_pages) r where r not in ('index.html','businesses.html','eat-drink.html','shop-local.html','arts-culture.html','events.html','get-outside.html','things-to-do.html','animals.html','community.html','history.html','jobs.html','spotlight.html')) then raise exception 'Choose an eligible Loving Longmont page';end if;
 begin m:=b.notes::jsonb;exception when others then m:='{}';end;
 if m->>'format' is distinct from 'mkt-portfolio-v1' then m:='{}';end if;
 f:=coalesce(m->'publicationOptions'->'fields','{}');
 payload:=jsonb_build_object('id',b.id,'name',b.name);
 if coalesce((f->>'description')::boolean,true) then payload:=payload||jsonb_build_object('description',coalesce(b.description,''));end if;
 if coalesce((f->>'story')::boolean,true) then payload:=payload||jsonb_build_object('story',coalesce(m->>'businessStory',''));end if;
 if coalesce((f->>'address')::boolean,true) then payload:=payload||jsonb_build_object('address',coalesce(b.address,''));end if;
 if coalesce((f->>'phone')::boolean,true) then payload:=payload||jsonb_build_object('phone',coalesce(b.phone,''));end if;
 if coalesce((f->>'website')::boolean,true) then payload:=payload||jsonb_build_object('website',coalesce(b.website,''));end if;
 if coalesce((f->>'image_url')::boolean,true) then payload:=payload||jsonb_build_object('image_url',coalesce(b.image_url,''));end if;
 if m->'publicationOptions'->>'tier'='Paid' then
 if coalesce((f->>'social_urls')::boolean,false) then payload:=payload||jsonb_build_object('social_urls',coalesce(to_jsonb(b.social_urls),'[]'));end if;
 if coalesce((f->>'categories')::boolean,false) then payload:=payload||jsonb_build_object('categories',coalesce(to_jsonb(b.categories),'[]'));end if;
 if coalesce((f->>'gallery_images')::boolean,false) then payload:=payload||jsonb_build_object('gallery_images',coalesce(m->'listingGalleryUrls','[]'));end if;
 end if;
 insert into public.cc_ll_draft_publications as target(business_id,workspace_id,public_content,directory,pages,spotlight_pages,spotlight_order,active,published_at,published_by)
 values(b.id,b.workspace_id,payload,p_directory,p_pages,p_spotlight_pages,p_order,p_active,now(),auth.uid())
 on conflict(business_id) do update set public_content=excluded.public_content,directory=excluded.directory,pages=excluded.pages,spotlight_pages=excluded.spotlight_pages,spotlight_order=excluded.spotlight_order,active=excluded.active,published_at=excluded.published_at,published_by=excluded.published_by
 returning * into result;
 return result;
end $$;
revoke all on function public.cc_publish_ll_draft(uuid,text[],boolean,text[],integer,boolean) from public,anon;
grant execute on function public.cc_publish_ll_draft(uuid,text[],boolean,text[],integer,boolean) to authenticated;
revoke select on public.cc_ll_draft_publications from anon;
grant select(business_id,public_content,directory,pages,spotlight_pages,spotlight_order,active,published_at) on public.cc_ll_draft_publications to anon;

create or replace function public.cc_publish_ll_draft(p_business_id uuid,p_pages text[],p_directory boolean default true,p_spotlight_pages text[] default '{}',p_order integer default 0,p_active boolean default true)
returns public.cc_ll_draft_publications language plpgsql security invoker set search_path='' as $$
declare b public.cc_businesses; m jsonb; f jsonb; payload jsonb; result public.cc_ll_draft_publications;
begin
 select * into b from public.cc_businesses where id=p_business_id;
 if b.id is null or not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required';end if;
 if cardinality(p_pages)>20 or cardinality(p_spotlight_pages)>20 or exists(select 1 from unnest(p_pages||p_spotlight_pages) r where r not in ('index.html','businesses.html','eat-drink.html','shop-local.html','arts-culture.html','events.html','get-outside.html','things-to-do.html','animals.html','community.html','history.html','jobs.html','spotlight.html')) then raise exception 'Choose an eligible Loving Longmont page';end if;
 begin m:=b.notes::jsonb;exception when others then m:='{}';end;
 if m->>'format' is distinct from 'mkt-portfolio-v1' then m:='{}';end if;
 f:=coalesce(m->'publicationOptions'->'fields','{}');
 payload:=jsonb_build_object('id',b.id,'name',b.name);
 if coalesce((f->>'description')::boolean,true) then payload:=payload||jsonb_build_object('description',coalesce(b.description,''));end if;
 if coalesce((f->>'story')::boolean,true) then payload:=payload||jsonb_build_object('story',coalesce(m->>'businessStory',''));end if;
 if coalesce((f->>'address')::boolean,true) then payload:=payload||jsonb_build_object('address',coalesce(b.address,''));end if;
 if coalesce((f->>'phone')::boolean,true) then payload:=payload||jsonb_build_object('phone',coalesce(b.phone,''));end if;
 if coalesce((f->>'website')::boolean,true) then payload:=payload||jsonb_build_object('website',coalesce(b.website,''));end if;
 if coalesce((f->>'image_url')::boolean,true) then payload:=payload||jsonb_build_object('image_url',coalesce(b.image_url,''));end if;
 if m->'publicationOptions'->>'tier'='Paid' then
 if coalesce((f->>'social_urls')::boolean,false) then payload:=payload||jsonb_build_object('social_urls',coalesce((select jsonb_agg(link order by ord) from unnest(b.social_urls) with ordinality as accounts(link,ord) where coalesce((m->'draftSocialVisibility'->>link)::boolean,true)),'[]'::jsonb));end if;
 if coalesce((f->>'categories')::boolean,false) then payload:=payload||jsonb_build_object('categories',coalesce(to_jsonb(b.categories),'[]'));end if;
 if coalesce((f->>'gallery_images')::boolean,false) then payload:=payload||jsonb_build_object('gallery_images',coalesce(m->'listingGalleryUrls','[]'));end if;
 end if;
 insert into public.cc_ll_draft_publications as target(business_id,workspace_id,public_content,directory,pages,spotlight_pages,spotlight_order,active,published_at,published_by)
 values(b.id,b.workspace_id,payload,p_directory,p_pages,p_spotlight_pages,p_order,p_active,now(),auth.uid())
 on conflict(business_id) do update set public_content=excluded.public_content,directory=excluded.directory,pages=excluded.pages,spotlight_pages=excluded.spotlight_pages,spotlight_order=excluded.spotlight_order,active=excluded.active,published_at=excluded.published_at,published_by=excluded.published_by
 returning * into result;
 return result;
end $$;

-- Private live-page drafts and explicit public snapshots. No server secret is exposed.
create function public.cc_ll_validate_settings(s jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; item jsonb;
begin
 if jsonb_typeof(s)<>'object' or char_length(s::text)>20000 or s-array['tagline','photographer','service_area','story','services','gallery','fields','social_visibility','directory','spotlight_pages','spotlight_order','active']::text[]<>'{}'::jsonb then raise exception 'Invalid page settings';end if;
 foreach k in array array['tagline','photographer','service_area','story'] loop
  if s?k and (jsonb_typeof(s->k)<>'string' or char_length(s->>k)>case when k='story' then 5000 else 300 end) then raise exception 'Invalid page text';end if;
 end loop;
 if jsonb_typeof(coalesce(s->'fields','{}'))<>'object' or (coalesce(s->'fields','{}')-array['description','address','phone','email','website','image_url','categories','social_urls','tagline','photographer','service_area','story','services','gallery']::text[])<>'{}'::jsonb then raise exception 'Invalid public field selection';end if;
 for k,v in select key,value from jsonb_each(coalesce(s->'fields','{}')) loop if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid public field selection';end if;end loop;
 if jsonb_typeof(coalesce(s->'social_visibility','{}'))<>'object' then raise exception 'Invalid social selections';end if;
 for k,v in select key,value from jsonb_each(coalesce(s->'social_visibility','{}')) loop if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid social selections';end if;end loop;
 foreach k in array array['directory','active'] loop if s?k and jsonb_typeof(s->k)<>'boolean' then raise exception 'Invalid publication setting';end if;end loop;
 if s?'spotlight_order' and ((s->>'spotlight_order') !~ '^[0-9]{1,6}$') then raise exception 'Invalid spotlight order';end if;
 if jsonb_typeof(coalesce(s->'services','[]'))<>'array' or jsonb_array_length(coalesce(s->'services','[]'))>30 then raise exception 'Use up to 30 services';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'services','[]')) loop if jsonb_typeof(item)<>'string' or char_length(item#>>'{}')>200 then raise exception 'Invalid service';end if;end loop;
 if jsonb_typeof(coalesce(s->'gallery','[]'))<>'array' or jsonb_array_length(coalesce(s->'gallery','[]'))>4 then raise exception 'Use up to four photos';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'gallery','[]')) loop
  if jsonb_typeof(item)<>'object' or item-array['url','alt','caption','enabled']::text[]<>'{}'::jsonb or coalesce(item->>'url','') !~ '^https://[^[:space:]<>"@]+$' or (item?'enabled' and jsonb_typeof(item->'enabled')<>'boolean') or char_length(item->>'url')>5000 or char_length(coalesce(item->>'alt',''))>300 or char_length(coalesce(item->>'caption',''))>500 then raise exception 'Invalid photo';end if;
 end loop;
 if jsonb_typeof(coalesce(s->'spotlight_pages','[]'))<>'array' then raise exception 'Invalid spotlight pages';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'spotlight_pages','[]')) loop
  if item#>>'{}' not in ('index.html','businesses.html','things-to-do.html','animals.html','community.html','history.html','jobs.html','events.html','spotlight.html') then raise exception 'Choose an eligible spotlight page';end if;
 end loop;
 return true;
end $$;
revoke all on function public.cc_ll_validate_settings(jsonb) from public,anon;grant execute on function public.cc_ll_validate_settings(jsonb) to authenticated;
create table public.cc_ll_live_profiles(
 business_id uuid primary key references public.cc_businesses(id) on delete cascade,
 workspace_id uuid not null references public.cc_workspaces(id),
 route text not null unique check(route ~ '^[a-z0-9-]+\.html$'),
 settings jsonb not null check(public.cc_ll_validate_settings(settings)),
 updated_at timestamptz not null default now()
);
alter table public.cc_ll_live_profiles enable row level security;
revoke all on public.cc_ll_live_profiles from anon,authenticated;
create index cc_ll_live_profiles_workspace_idx on public.cc_ll_live_profiles(workspace_id);
grant select,update(settings,updated_at) on public.cc_ll_live_profiles to authenticated;
create policy live_profile_read on public.cc_ll_live_profiles for select to authenticated using(public.cc_has_access(workspace_id));
create policy live_profile_edit on public.cc_ll_live_profiles for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true));
create table public.cc_ll_live_publications(
 business_id uuid primary key references public.cc_ll_live_profiles(business_id) on delete cascade,
 workspace_id uuid not null references public.cc_workspaces(id),
 route text not null unique,
 public_content jsonb not null check(public_content-array['id','name','description','address','phone','email','website','image_url','categories','social_urls','tagline','photographer','service_area','story','services','gallery']::text[]='{}'::jsonb),
 directory boolean not null default true,
 spotlight_pages text[] not null default '{}',
 spotlight_order integer not null default 0,
 active boolean not null default true,
 revision integer not null default 1,
 published_at timestamptz not null default now(),
 published_by uuid references auth.users(id)
);
alter table public.cc_ll_live_publications enable row level security;
revoke all on public.cc_ll_live_publications from anon,authenticated;
create index cc_ll_live_publications_workspace_idx on public.cc_ll_live_publications(workspace_id);
create index cc_ll_live_publications_publisher_idx on public.cc_ll_live_publications(published_by);
grant select(business_id,route,public_content,directory,spotlight_pages,spotlight_order,active,revision,published_at) on public.cc_ll_live_publications to anon;
grant select,insert,update on public.cc_ll_live_publications to authenticated;
create policy live_public_read on public.cc_ll_live_publications for select to anon using(active);
create policy live_partner_read on public.cc_ll_live_publications for select to authenticated using(public.cc_has_access(workspace_id));
create function public.cc_ll_live_content(p_business_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare b public.cc_businesses; p public.cc_ll_live_profiles; f jsonb; c jsonb; k text; u text;
begin
 select * into b from public.cc_businesses where id=p_business_id;
 select * into p from public.cc_ll_live_profiles where business_id=p_business_id;
 if b.id is null or p.business_id is null or p.workspace_id<>b.workspace_id or not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required';end if;
 f:=coalesce(p.settings->'fields','{}');c:=jsonb_build_object('id',b.id,'name',b.name);
 foreach k in array array['description','address','phone','email','website','image_url','categories'] loop
  if coalesce((f->>k)::boolean,false) then c:=c||jsonb_build_object(k,to_jsonb(b)->k);end if;
 end loop;
 foreach k in array array['tagline','photographer','service_area','story','services'] loop
  if coalesce((f->>k)::boolean,false) then c:=c||jsonb_build_object(k,p.settings->k);end if;
 end loop;
 if coalesce((f->>'gallery')::boolean,false) then c:=c||jsonb_build_object('gallery',coalesce((select jsonb_agg(item-'enabled' order by ord) from jsonb_array_elements(coalesce(p.settings->'gallery','[]')) with ordinality photos(item,ord) where coalesce((item->>'enabled')::boolean,true)),'[]'::jsonb));end if;
 if coalesce((f->>'social_urls')::boolean,false) then
  c:=c||jsonb_build_object('social_urls',coalesce((select jsonb_agg(link order by ord) from unnest(b.social_urls) with ordinality accounts(link,ord) where coalesce((p.settings->'social_visibility'->>link)::boolean,true)),'[]'::jsonb));
 end if;
 foreach k in array array['image_url','website'] loop
  u:=c->>k;
  if coalesce(u,'')<>'' and (u !~ '^https?://[^[:space:]<>"@]+$' or (k='image_url' and u !~ '^https://')) then raise exception 'Use valid public website and HTTPS image URLs';end if;
 end loop;
 return c;
end $$;
revoke all on function public.cc_ll_live_content(uuid) from public,anon;grant execute on function public.cc_ll_live_content(uuid) to authenticated;
create policy live_partner_insert on public.cc_ll_live_publications for insert to authenticated with check(public.cc_has_access(workspace_id,true) and published_by=auth.uid() and public_content=public.cc_ll_live_content(business_id) and exists(select 1 from public.cc_ll_live_profiles p where p.business_id=cc_ll_live_publications.business_id and p.workspace_id=cc_ll_live_publications.workspace_id and p.route=cc_ll_live_publications.route));
create policy live_partner_update on public.cc_ll_live_publications for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true) and published_by=auth.uid() and public_content=public.cc_ll_live_content(business_id) and exists(select 1 from public.cc_ll_live_profiles p where p.business_id=cc_ll_live_publications.business_id and p.workspace_id=cc_ll_live_publications.workspace_id and p.route=cc_ll_live_publications.route));
create function public.cc_save_ll_live_profile(p_business_id uuid,p_business jsonb,p_settings jsonb,p_business_version timestamptz,p_profile_version timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare b public.cc_businesses;p public.cc_ll_live_profiles;
begin
 select * into b from public.cc_businesses where id=p_business_id for update;
 select * into p from public.cc_ll_live_profiles where business_id=p_business_id for update;
 if b.id is null or p.business_id is null or b.workspace_id<>p.workspace_id or not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required';end if;
 if b.updated_at is distinct from p_business_version or p.updated_at is distinct from p_profile_version then raise exception 'This record changed. Reload before saving.';end if;
 if jsonb_typeof(p_business)<>'object' or p_business-array['name','description','phone','email','address','city','website','image_url','categories','social_urls']::text[]<>'{}'::jsonb then raise exception 'Invalid business fields';end if;
 perform public.cc_ll_validate_settings(p_settings);
 if p_business?'categories' and jsonb_typeof(p_business->'categories')<>'array' or p_business?'social_urls' and jsonb_typeof(p_business->'social_urls')<>'array' then raise exception 'Invalid business categories or socials';end if;
 update public.cc_businesses set
 name=case when p_business?'name' then p_business->>'name' else b.name end,
 description=case when p_business?'description' then coalesce(p_business->>'description','') else b.description end,
 phone=case when p_business?'phone' then coalesce(p_business->>'phone','') else b.phone end,
 email=case when p_business?'email' then coalesce(p_business->>'email','') else b.email end,
 address=case when p_business?'address' then coalesce(p_business->>'address','') else b.address end,
 city=case when p_business?'city' then coalesce(p_business->>'city','') else b.city end,
 website=case when p_business?'website' then coalesce(p_business->>'website','') else b.website end,
 image_url=case when p_business?'image_url' then coalesce(p_business->>'image_url','') else b.image_url end,
 categories=case when p_business?'categories' then array(select jsonb_array_elements_text(p_business->'categories')) else b.categories end,
 social_urls=case when p_business?'social_urls' then array(select jsonb_array_elements_text(p_business->'social_urls')) else b.social_urls end
 where id=b.id returning * into b;
 update public.cc_ll_live_profiles set settings=p_settings,updated_at=clock_timestamp() where business_id=b.id returning * into p;
 return jsonb_build_object('profile',to_jsonb(p),'business_version',b.updated_at);
end $$;
revoke all on function public.cc_save_ll_live_profile(uuid,jsonb,jsonb,timestamptz,timestamptz) from public,anon;grant execute on function public.cc_save_ll_live_profile(uuid,jsonb,jsonb,timestamptz,timestamptz) to authenticated;
create function public.cc_preview_ll_live_profile(p_business_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare b public.cc_businesses;p public.cc_ll_live_profiles;c jsonb;r integer;result jsonb;
begin
 c:=public.cc_ll_live_content(p_business_id);
 select * into b from public.cc_businesses where id=p_business_id;
 select * into p from public.cc_ll_live_profiles where business_id=p_business_id;
 select revision into r from public.cc_ll_live_publications where business_id=p_business_id;
 result:=jsonb_build_object('business_id',b.id,'route',p.route,'public_content',c,'directory',coalesce((p.settings->>'directory')::boolean,true),'spotlight_pages',coalesce(p.settings->'spotlight_pages','[]'::jsonb),'spotlight_order',coalesce((p.settings->>'spotlight_order')::integer,0),'active',coalesce((p.settings->>'active')::boolean,true),'revision',coalesce(r,0));
 return result||jsonb_build_object('signature',md5(result::text||b.updated_at::text||p.updated_at::text));
end $$;
revoke all on function public.cc_preview_ll_live_profile(uuid) from public,anon;grant execute on function public.cc_preview_ll_live_profile(uuid) to authenticated;
create function public.cc_publish_ll_live_profile(p_business_id uuid,p_signature text) returns public.cc_ll_live_publications language plpgsql security invoker set search_path='' as $$
declare preview jsonb;w uuid;result public.cc_ll_live_publications;
begin
 perform 1 from public.cc_businesses where id=p_business_id for update;
 perform 1 from public.cc_ll_live_profiles where business_id=p_business_id for update;
 perform 1 from public.cc_ll_live_publications where business_id=p_business_id for update;
 preview:=public.cc_preview_ll_live_profile(p_business_id);
 if p_signature is distinct from preview->>'signature' then raise exception 'The preview changed. Preview again before publishing.';end if;
 select workspace_id into w from public.cc_ll_live_profiles where business_id=p_business_id;
 insert into public.cc_ll_live_publications as target(business_id,workspace_id,route,public_content,directory,spotlight_pages,spotlight_order,active,revision,published_at,published_by)
 values(p_business_id,w,preview->>'route',preview->'public_content',(preview->>'directory')::boolean,array(select jsonb_array_elements_text(preview->'spotlight_pages')),(preview->>'spotlight_order')::integer,(preview->>'active')::boolean,1,clock_timestamp(),auth.uid())
 on conflict(business_id) do update set public_content=excluded.public_content,directory=excluded.directory,spotlight_pages=excluded.spotlight_pages,spotlight_order=excluded.spotlight_order,active=excluded.active,revision=target.revision+1,published_at=excluded.published_at,published_by=excluded.published_by returning * into result;
 return result;
end $$;
revoke all on function public.cc_publish_ll_live_profile(uuid,text) from public,anon;grant execute on function public.cc_publish_ll_live_profile(uuid,text) to authenticated;

create or replace function public.cc_ll_validate_settings(s jsonb) returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; item jsonb;
begin
 if jsonb_typeof(s)<>'object' or char_length(s::text)>20000 or s-array['tagline','photographer','service_area','story','services','gallery','fields','social_visibility','directory','spotlight_pages','spotlight_order','active','sites']::text[]<>'{}'::jsonb then raise exception 'Invalid page settings';end if;
 foreach k in array array['tagline','photographer','service_area','story'] loop
  if s?k and (jsonb_typeof(s->k)<>'string' or char_length(s->>k)>case when k='story' then 5000 else 300 end) then raise exception 'Invalid page text';end if;
 end loop;
 if jsonb_typeof(coalesce(s->'fields','{}'))<>'object' or (coalesce(s->'fields','{}')-array['description','address','phone','email','website','image_url','categories','social_urls','tagline','photographer','service_area','story','services','gallery']::text[])<>'{}'::jsonb then raise exception 'Invalid public field selection';end if;
 for k,v in select key,value from jsonb_each(coalesce(s->'fields','{}')) loop if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid public field selection';end if;end loop;
 if jsonb_typeof(coalesce(s->'social_visibility','{}'))<>'object' then raise exception 'Invalid social selections';end if;
 for k,v in select key,value from jsonb_each(coalesce(s->'social_visibility','{}')) loop if jsonb_typeof(v)<>'boolean' then raise exception 'Invalid social selections';end if;end loop;
 foreach k in array array['directory','active'] loop if s?k and jsonb_typeof(s->k)<>'boolean' then raise exception 'Invalid publication setting';end if;end loop;
 if s?'spotlight_order' and ((s->>'spotlight_order') !~ '^[0-9]{1,6}$') then raise exception 'Invalid spotlight order';end if;
 if jsonb_typeof(coalesce(s->'services','[]'))<>'array' or jsonb_array_length(coalesce(s->'services','[]'))>30 then raise exception 'Use up to 30 services';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'services','[]')) loop if jsonb_typeof(item)<>'string' or char_length(item#>>'{}')>200 then raise exception 'Invalid service';end if;end loop;
 if jsonb_typeof(coalesce(s->'gallery','[]'))<>'array' or jsonb_array_length(coalesce(s->'gallery','[]'))>4 then raise exception 'Use up to four photos';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'gallery','[]')) loop
  if jsonb_typeof(item)<>'object' or item-array['url','alt','caption','enabled']::text[]<>'{}'::jsonb or coalesce(item->>'url','') !~ '^https://[^[:space:]<>"@]+$' or (item?'enabled' and jsonb_typeof(item->'enabled')<>'boolean') or char_length(item->>'url')>5000 or char_length(coalesce(item->>'alt',''))>300 or char_length(coalesce(item->>'caption',''))>500 then raise exception 'Invalid photo';end if;
 end loop;
 if jsonb_typeof(coalesce(s->'spotlight_pages','[]'))<>'array' then raise exception 'Invalid spotlight pages';end if;
 for item in select value from jsonb_array_elements(coalesce(s->'spotlight_pages','[]')) loop
  if item#>>'{}' not in ('index.html','businesses.html','things-to-do.html','animals.html','community.html','history.html','jobs.html','events.html','spotlight.html') then raise exception 'Choose an eligible spotlight page';end if;
 end loop;
 if s?'sites' and (jsonb_typeof(s->'sites')<>'array' or jsonb_array_length(s->'sites')<1 or jsonb_array_length(s->'sites')>2 or exists(select 1 from jsonb_array_elements_text(s->'sites') x where x not in ('Loving Longmont','MKT Colorado'))) then raise exception 'Choose at least one supported website';end if;
 return true;
end $$;
alter table public.cc_ll_live_publications add column sites text[] not null default array['Loving Longmont'] check(cardinality(sites) between 1 and 2 and sites <@ array['Loving Longmont','MKT Colorado']::text[]);
grant select(sites) on public.cc_ll_live_publications to anon;
create or replace function public.cc_preview_ll_live_profile(p_business_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare b public.cc_businesses;p public.cc_ll_live_profiles;c jsonb;r integer;result jsonb;
begin
 c:=public.cc_ll_live_content(p_business_id);
 select * into b from public.cc_businesses where id=p_business_id;
 select * into p from public.cc_ll_live_profiles where business_id=p_business_id;
 select revision into r from public.cc_ll_live_publications where business_id=p_business_id;
 result:=jsonb_build_object('business_id',b.id,'route',p.route,'public_content',c,'directory',coalesce((p.settings->>'directory')::boolean,true),'spotlight_pages',coalesce(p.settings->'spotlight_pages','[]'::jsonb),'spotlight_order',coalesce((p.settings->>'spotlight_order')::integer,0),'active',coalesce((p.settings->>'active')::boolean,true),'sites',coalesce(p.settings->'sites','["Loving Longmont"]'::jsonb),'revision',coalesce(r,0));
 return result||jsonb_build_object('signature',md5(result::text||b.updated_at::text||p.updated_at::text));
end $$;
create or replace function public.cc_publish_ll_live_profile(p_business_id uuid,p_signature text) returns public.cc_ll_live_publications language plpgsql security invoker set search_path='' as $$
declare preview jsonb;w uuid;result public.cc_ll_live_publications;
begin
 perform 1 from public.cc_businesses where id=p_business_id for update;
 perform 1 from public.cc_ll_live_profiles where business_id=p_business_id for update;
 perform 1 from public.cc_ll_live_publications where business_id=p_business_id for update;
 preview:=public.cc_preview_ll_live_profile(p_business_id);
 if p_signature is distinct from preview->>'signature' then raise exception 'The preview changed. Preview again before publishing.';end if;
 select workspace_id into w from public.cc_ll_live_profiles where business_id=p_business_id;
 insert into public.cc_ll_live_publications as target(business_id,workspace_id,route,public_content,directory,spotlight_pages,spotlight_order,active,revision,published_at,published_by,sites)
 values(p_business_id,w,preview->>'route',preview->'public_content',(preview->>'directory')::boolean,array(select jsonb_array_elements_text(preview->'spotlight_pages')),(preview->>'spotlight_order')::integer,(preview->>'active')::boolean,1,clock_timestamp(),auth.uid(),array(select jsonb_array_elements_text(preview->'sites')))
 on conflict(business_id) do update set public_content=excluded.public_content,directory=excluded.directory,spotlight_pages=excluded.spotlight_pages,spotlight_order=excluded.spotlight_order,active=excluded.active,revision=target.revision+1,published_at=excluded.published_at,published_by=excluded.published_by,sites=excluded.sites returning * into result;
 return result;
end $$;
create function public.cc_ensure_live_profile(p_business_id uuid) returns public.cc_ll_live_profiles language plpgsql security invoker set search_path='' as $$
declare b public.cc_businesses; result public.cc_ll_live_profiles; destinations text[];
begin
 select * into b from public.cc_businesses where id=p_business_id;
 if b.id is null or not public.cc_has_access(b.workspace_id) then raise exception 'Approved workspace member required';end if;
 select * into result from public.cc_ll_live_profiles where business_id=b.id;
 if result.business_id is not null then return result;end if;
 if not public.cc_has_access(b.workspace_id,true) then raise exception 'Approved editor required to create a page draft';end if;
 select array_agg(distinct site) into destinations from public.cc_listings where business_id=b.id and site in ('Loving Longmont','MKT Colorado') and status<>'Archived';
 insert into public.cc_ll_live_profiles(business_id,workspace_id,route,settings) values(b.id,b.workspace_id,'business-'||b.id::text||'.html',jsonb_build_object('sites',to_jsonb(coalesce(destinations,array['Loving Longmont'])),'story','','services','[]'::jsonb,'gallery','[]'::jsonb,'social_visibility','{}'::jsonb,'directory',false,'active',false,'spotlight_pages','[]'::jsonb,'spotlight_order',0,'fields',jsonb_build_object('description',true,'image_url',true,'address',false,'phone',false,'email',false,'website',true,'categories',true,'social_urls',false,'story',false,'gallery',false))) on conflict(business_id) do nothing;
 select * into result from public.cc_ll_live_profiles where business_id=b.id;
 return result;
end $$;
revoke all on function public.cc_ensure_live_profile(uuid) from public,anon;grant execute on function public.cc_ensure_live_profile(uuid) to authenticated;
grant insert on public.cc_ll_live_profiles to authenticated;
create policy live_profile_create on public.cc_ll_live_profiles for insert to authenticated with check(public.cc_has_access(workspace_id,true) and exists(select 1 from public.cc_businesses b where b.id=cc_ll_live_profiles.business_id and b.workspace_id=cc_ll_live_profiles.workspace_id));

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

begin;
-- Only the backend can obtain this scheduler token. It never enters browser code.
do $$ begin
 if not exists(select 1 from vault.secrets where name='cc_ga_cron_token') then
  perform vault.create_secret(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),'cc_ga_cron_token','Command Center Analytics scheduler');
 end if;
end $$;
create function public.cc_ga_cron_token() returns text language plpgsql security definer set search_path='' as $$
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then raise exception 'Backend access required'; end if;
 return (select decrypted_secret from vault.decrypted_secrets where name='cc_ga_cron_token');
end $$;
revoke all on function public.cc_ga_cron_token() from public,anon,authenticated;
grant execute on function public.cc_ga_cron_token() to service_role;

create function public.cc_ga_claim() returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 update public.cc_ga_sync_control set lease=gen_random_uuid(),lease_until=now()+interval '5 minutes',last_requested_at=now()
 where workspace_id='c8748032-cdd3-443b-8c56-2e846cc9bf31' and (lease_until is null or lease_until<now()) and (last_requested_at is null or last_requested_at<now()-interval '1 minute') returning lease into result;
 return result;
end $$;
create function public.cc_ga_release(p_lease uuid) returns void language sql security invoker set search_path='' as $$
 update public.cc_ga_sync_control set lease=null,lease_until=null where lease=p_lease and workspace_id='c8748032-cdd3-443b-8c56-2e846cc9bf31';
$$;
create function public.cc_ga_failure(p_brand text,p_error text,p_status text default 'error') returns void language sql security invoker set search_path='' as $$
 update public.cc_ga_sync_state set status=p_status,last_attempt_at=now(),last_error=left(p_error,500) where workspace_id='c8748032-cdd3-443b-8c56-2e846cc9bf31' and brand=p_brand;
$$;
create function public.cc_ga_store(p_report jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare r jsonb; expected_property text;
begin
 select property_id into expected_property from public.cc_ga_sync_state where workspace_id='c8748032-cdd3-443b-8c56-2e846cc9bf31' and brand=p_report->>'brand';
 if expected_property is null or expected_property is distinct from p_report->>'property' or jsonb_array_length(p_report->'records')<>24 then raise exception 'Invalid Analytics property report'; end if;
 for r in select value from jsonb_array_elements(p_report->'records') loop
  if r->>'brand' is distinct from p_report->>'brand' or r->>'channel'<>'Website' or r->>'source'<>'Google Analytics' or r->>'metric' not in ('Visitors','Page views','Sessions') then raise exception 'Invalid Analytics statistic'; end if;
  insert into public.cc_statistics(workspace_id,brand,channel,metric,period_start,period_end,value,source,source_url,notes,automated)
  values('c8748032-cdd3-443b-8c56-2e846cc9bf31',r->>'brand','Website',r->>'metric',(r->>'period_start')::date,(r->>'period_end')::date,(r->>'value')::numeric,'Google Analytics',r->>'source_url',r->>'notes',true)
  on conflict(workspace_id,brand,channel,metric,period_start,period_end,source) do update set value=excluded.value,source_url=excluded.source_url,notes=excluded.notes,automated=true;
 end loop;
 update public.cc_ga_sync_state set status='success',last_attempt_at=now(),last_success_at=now(),last_error='',period_start=(p_report->'range'->>'start')::date,period_end=(p_report->'range'->>'end')::date,sources=p_report->'sources',locations=p_report->'locations'
 where workspace_id='c8748032-cdd3-443b-8c56-2e846cc9bf31' and brand=p_report->>'brand';
end $$;
revoke all on function public.cc_ga_claim(),public.cc_ga_release(uuid),public.cc_ga_failure(text,text,text),public.cc_ga_store(jsonb) from public,anon,authenticated;
grant execute on function public.cc_ga_claim(),public.cc_ga_release(uuid),public.cc_ga_failure(text,text,text),public.cc_ga_store(jsonb) to service_role;
grant insert,update,select on public.cc_statistics to service_role;

commit;

begin;
insert into public.cc_ga_sync_control(workspace_id) select id from public.cc_workspaces where id='c8748032-cdd3-443b-8c56-2e846cc9bf31';
insert into public.cc_ga_sync_state(workspace_id,brand,property_id)
select w.id,p.brand,p.property_id from public.cc_workspaces w cross join (values
 ('Loving Longmont','558375784'),('MKT Colorado','558329947'),('MKT Visibility','558367806'),('Open Theory Cove','558417742'),('Boulder County Photography','558429449')) p(brand,property_id)
where w.id='c8748032-cdd3-443b-8c56-2e846cc9bf31';
-- Two UTC slots make 8 AM Mountain correct in both daylight and standard time.
select cron.schedule('cc-google-analytics-daily','0 13,14 * * *',$job$
 select net.http_post(
  url:='https://gvmwkltwrlqwbqegieum.supabase.co/functions/v1/sync-google-analytics',
  headers:=jsonb_build_object('Content-Type','application/json','x-cc-ga-token',(select decrypted_secret from vault.decrypted_secrets where name='cc_ga_cron_token')),
  body:='{"action":"refresh"}'::jsonb,timeout_milliseconds:=180000)
 where extract(hour from now() at time zone 'America/Denver')=8;
$job$);
commit;

create policy cc_backend_only on public.cc_ga_sync_control for all to service_role using(true) with check(true);

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

begin;
create table cc_bi_private.worker_secret(token text not null);
insert into cc_bi_private.worker_secret values(replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''));
revoke all on cc_bi_private.worker_secret from public,anon,authenticated;
grant usage on schema cc_bi_private to service_role;
grant select on cc_bi_private.worker_secret to service_role;
create function public.cc_bi_worker_token() returns text language sql stable security invoker set search_path='' as $$select token from cc_bi_private.worker_secret limit 1$$;
revoke all on function public.cc_bi_worker_token() from public,anon,authenticated;
grant execute on function public.cc_bi_worker_token() to service_role;
select cron.schedule('cc-business-research-worker','* * * * *',$job$
 select net.http_post(url:='https://gvmwkltwrlqwbqegieum.supabase.co/functions/v1/research-business',
 headers:=jsonb_build_object('Content-Type','application/json','x-cc-bi-token',(select token from cc_bi_private.worker_secret limit 1)),
 body:='{"action":"process"}'::jsonb,timeout_milliseconds:=120000)
 where exists(select 1 from public.cc_bi_jobs where status='Queued');
$job$);
commit;

begin;
create function public.cc_bi_stage_from_business() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.cc_bi_profiles; expected text; mapped text;
begin
 select * into p from public.cc_bi_profiles where business_id=new.id and workspace_id=new.workspace_id for update;
 if not found then
  insert into public.cc_bi_profiles(workspace_id,business_id,crm) values(new.workspace_id,new.id,jsonb_build_object('stage',case new.stage when 'Contacted' then 'Contacted' when 'Discovery' then 'Interested' when 'Proposal' then 'Proposal Sent' when 'Won' then 'Client Won' when 'Lost' then 'Closed / Not a Fit' else 'Researching' end,'do_not_contact',false));return new;
 end if;
 if coalesce((p.crm->>'do_not_contact')::boolean,false) and new.stage not in ('New','Lost') then raise exception 'Do Not Contact excludes outreach'; end if;
 expected:=case p.crm->>'stage' when 'Contacted' then 'Contacted' when 'Interested' then 'Discovery' when 'Proposal Sent' then 'Proposal' when 'Client Won' then 'Won' when 'Closed / Not a Fit' then 'Lost' else 'New' end;
 if expected<>new.stage then
  mapped:=case new.stage when 'Contacted' then 'Contacted' when 'Discovery' then 'Interested' when 'Proposal' then 'Proposal Sent' when 'Won' then 'Client Won' when 'Lost' then 'Closed / Not a Fit' else 'Researching' end;
  update public.cc_bi_profiles set crm=crm||jsonb_build_object('stage',mapped) where id=p.id;
 end if;
 return new;
end $$;
revoke all on function public.cc_bi_stage_from_business() from public,anon,authenticated;
create trigger cc_bi_new_business after insert on public.cc_businesses for each row execute function public.cc_bi_stage_from_business();
create trigger cc_bi_legacy_stage after update of stage on public.cc_businesses for each row when(old.stage is distinct from new.stage) execute function public.cc_bi_stage_from_business();
create function public.cc_bi_settings_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(new.config->'weights') is distinct from 'object' or not (new.config->'weights' ?& array['need','potential','contact','engagement']) or (new.config->'weights'-array['need','potential','contact','engagement'])<>'{}' then raise exception 'Configure all four priority weights'; end if;
 if exists(select 1 from jsonb_each_text(new.config->'weights') where value::numeric<0 or value::numeric>100) or (select sum(value::numeric) from jsonb_each_text(new.config->'weights'))<>100 then raise exception 'Priority weights must total 100'; end if;
 if new.config ? 'platformWeights' and exists(select 1 from jsonb_each_text(new.config->'platformWeights') where value::numeric<0 or value::numeric>100) then raise exception 'Platform weights must be from 0 to 100'; end if;
 return new;
end $$;
revoke all on function public.cc_bi_settings_guard() from public,anon,authenticated;
create trigger cc_bi_settings_guard before insert or update on public.cc_bi_settings for each row execute function public.cc_bi_settings_guard();
commit;

begin;
create table public.cc_email_approvals (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 business_id uuid not null,
 campaign_key text not null check(campaign_key in ('welcome','story','visibility','upgrade','custom')),
 brand text not null check(brand in ('Loving Longmont','MKT Colorado')),
 sender text not null check(sender in ('hello.lovinglongmont@gmail.com','mktvisibility@gmail.com')),
 recipient text not null check(recipient ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and lower(recipient)<>lower(sender)),
 subject text not null check(char_length(trim(subject)) between 1 and 300),
 body text not null check(char_length(trim(body)) between 1 and 10000),
 variant text not null default '' check(char_length(variant)<=80),
 review_note text not null check(char_length(trim(review_note)) between 1 and 1000),
 review_context jsonb not null,
 follow_up_on date,
 status text not null default 'Approved' check(status in ('Approved','Revoked','Sending','Sent','Needs reconciliation')),
 approved_by_name text not null default '',
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 claimed_at timestamptz, sent_at timestamptz, source_message_id text not null default '', email_id uuid references public.cc_emails(id), last_error text not null default '',
 foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
create unique index cc_one_pending_email on public.cc_email_approvals(workspace_id,business_id) where status in ('Approved','Sending','Needs reconciliation');
create index cc_approval_queue on public.cc_email_approvals(workspace_id,status,campaign_key);
create index cc_approval_created on public.cc_email_approvals(workspace_id,created_at desc,id);
alter table public.cc_email_approvals enable row level security;
revoke all on public.cc_email_approvals from public,anon,authenticated;
grant select,insert,update on public.cc_email_approvals to authenticated,service_role;
create policy cc_approval_read on public.cc_email_approvals for select to authenticated using(public.cc_has_access(workspace_id));
create policy cc_approval_insert on public.cc_email_approvals for insert to authenticated with check(public.cc_has_access(workspace_id,true));
create policy cc_approval_update on public.cc_email_approvals for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true));

create function public.cc_email_notes(p_text text) returns jsonb language plpgsql immutable set search_path='' as $$
begin return coalesce(nullif(p_text,'')::jsonb,'{}'::jsonb); exception when others then return '{}'::jsonb; end $$;
create function public.cc_email_campaign_key(p_subject text,p_campaign text,p_notes text) returns text language plpgsql immutable set search_path='' as $$
declare m jsonb:=public.cc_email_notes(p_notes); s text:=lower(coalesce(p_subject,'')); c text:=lower(coalesce(p_campaign,''));
begin
 if m->>'campaignKey' in ('welcome','story','visibility','upgrade','custom') then return m->>'campaignKey';end if;
 if m->>'campaignKey'='unclassified' then return '';end if;
 if s ~ '(has been added|is listed|we added|you.re listed|you are listed|free listing)' then return 'welcome';end if;
 if s ~ '(story behind|share (your|the) story|business stor(y|ies)|your business story)' or c ~ 'business stor(y|ies)' then return 'story';end if;
 if s ~ '(upgrade|upgraded listing|enhanced listing|featured listing)' then return 'upgrade';end if;
 if s ~ 'free (business )?visibility check' and s !~ '(report|results|completed|follow.up|thank|received)' and lower(coalesce(m->>'summary','')) !~ '(completed.{0,50}report|sent.{0,80}report|acknowledged|submission)' and (s||' '||lower(coalesce(m->>'summary',''))) ~ '(invit|offered.{0,30}(free|visibility)|interested in|would you like|offer(ing)? a free)' then return 'visibility';end if;
 return '';
end $$;
create function public.cc_email_review_context(p_business_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'business',jsonb_build_array(b.id,floor(extract(epoch from b.updated_at)*1000)),
 'emails',(select coalesce(jsonb_agg(jsonb_build_array(e.id,floor(extract(epoch from e.updated_at)*1000)) order by e.id),'[]') from public.cc_emails e where e.workspace_id=b.workspace_id and (e.business_id=b.id or b.id=any(e.related_business_ids))),
 'tasks',(select coalesce(jsonb_agg(jsonb_build_array(t.id,floor(extract(epoch from t.updated_at)*1000)) order by t.id),'[]') from public.cc_tasks t where t.workspace_id=b.workspace_id and t.business_id=b.id),
 'listings',(select coalesce(jsonb_agg(jsonb_build_array(l.id,floor(extract(epoch from l.updated_at)*1000)) order by l.id),'[]') from public.cc_listings l where l.workspace_id=b.workspace_id and l.business_id=b.id),
 'purchases',(select coalesce(jsonb_agg(jsonb_build_array(p.id,floor(extract(epoch from p.updated_at)*1000)) order by p.id),'[]') from public.cc_purchases p where p.workspace_id=b.workspace_id and p.business_id=b.id))
 from public.cc_businesses b where b.id=p_business_id;
$$;
create function public.cc_email_campaign_contacted(p_business uuid,p_key text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.cc_emails e where (e.business_id=p_business or p_business=any(e.related_business_ids)) and e.direction='Outbound' and e.message_type='Human' and e.status in ('Sent','Replied','Bounced') and public.cc_email_campaign_key(e.subject,e.campaign,e.notes)=p_key)
 or exists(select 1 from public.cc_tasks t where t.business_id=p_business and (
 (public.cc_email_notes(t.notes)->>'businessChecklistKey'=case p_key when 'welcome' then 'intro' when 'story' then 'story_request' when 'visibility' then 'offer' when 'upgrade' then 'upgrade_offer' end and (
 public.cc_email_notes(t.notes)#>>'{campaignTracking,sent}'='true' or (p_key in ('welcome','story') and t.status='Done' and coalesce(public.cc_email_notes(t.notes)->>'profileBulkCompletion','false')<>'true' and coalesce(public.cc_email_notes(t.notes)#>>'{campaignTracking,sent}','true')<>'false' and coalesce(public.cc_email_notes(t.notes)->>'notApplicable','false')<>'true')))
 or (t.status='Done' and public.cc_email_notes(t.notes)#>>'{appointmentManager,status}'='Completed' and public.cc_email_notes(t.notes)#>>'{appointmentManager,campaignKey}'=p_key)));
$$;
create function public.cc_email_send_block(p_business uuid,p_key text,p_recipient text) returns text language plpgsql stable security invoker set search_path='' as $$
declare b public.cc_businesses; m jsonb;
begin
 select * into b from public.cc_businesses where id=p_business; if b.id is null then return 'Business not found or access lost.';end if;
 m:=public.cc_email_notes(b.notes);
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
create function public.cc_guard_email_approval() returns trigger language plpgsql security invoker set search_path='' as $$
declare reason text;
begin
 if tg_op='INSERT' then
  if new.status<>'Approved' or new.email_id is not null or new.sent_at is not null or new.claimed_at is not null or new.source_message_id<>'' then raise exception 'New approvals must be unsent';end if;
  if new.review_context is distinct from public.cc_email_review_context(new.business_id) then raise exception 'Profile or history changed. Reload and review again.';end if;
  reason:=public.cc_email_send_block(new.business_id,new.campaign_key,new.recipient);if reason<>'' then raise exception '%',reason;end if;
  new.approved_by_name:=coalesce((select display_name from public.cc_members where workspace_id=new.workspace_id and user_id=auth.uid() and enabled),'Workspace administrator');
 else
  if (to_jsonb(new)-array['status','updated_at','claimed_at','sent_at','source_message_id','email_id','last_error']) is distinct from (to_jsonb(old)-array['status','updated_at','claimed_at','sent_at','source_message_id','email_id','last_error']) then raise exception 'Approved wording is immutable. Withdraw and approve a new email.';end if;
  if current_user not in ('postgres','service_role','supabase_admin') then
   if old.status<>'Approved' or new.status<>'Revoked' or new.claimed_at is distinct from old.claimed_at or new.sent_at is distinct from old.sent_at or new.email_id is distinct from old.email_id or new.source_message_id is distinct from old.source_message_id or new.last_error is distinct from old.last_error then raise exception 'Partners may only withdraw an unsent approval';end if;
  end if;
  if old.status='Sent' then raise exception 'A sent approval cannot be reused';end if;
 end if;
 return new;
end $$;
create trigger cc_approval_guard before insert or update on public.cc_email_approvals for each row execute function public.cc_guard_email_approval();
create trigger cc_stamp before insert or update on public.cc_email_approvals for each row execute function public.cc_stamp_record();
create trigger cc_audit after insert or update on public.cc_email_approvals for each row execute function public.cc_audit_record();
create function public.cc_approve_campaign_email(p_input jsonb) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;
begin
 insert into public.cc_email_approvals(business_id,campaign_key,brand,sender,recipient,subject,body,variant,review_note,review_context,follow_up_on)
 values((p_input->>'business_id')::uuid,p_input->>'campaign_key',p_input->>'brand',p_input->>'sender',trim(p_input->>'recipient'),trim(p_input->>'subject'),trim(p_input->>'body'),coalesce(p_input->>'variant',''),p_input->>'review_note',p_input->'review_context',nullif(p_input->>'follow_up_on','')::date) returning * into a;return a;
end $$;
create function public.cc_revoke_email_approval(p_id uuid) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;
begin update public.cc_email_approvals set status='Revoked' where id=p_id and status='Approved' returning * into a;if a.id is null then raise exception 'Approval changed or cannot be withdrawn';end if;return a;end $$;

-- Agent-only dispatch lifecycle. No browser send button, stored Gmail credentials or background sender.
create function public.cc_claim_email_approval(p_id uuid) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals; reason text;
begin
 select * into a from public.cc_email_approvals where id=p_id for update;
 if a.id is null or a.status<>'Approved' then raise exception 'Approval is not available to claim. Reconcile any existing attempt before retrying.';end if;
 if a.review_context is distinct from public.cc_email_review_context(a.business_id) then raise exception 'Profile or correspondence changed; approval needs a fresh review.';end if;
 reason:=public.cc_email_send_block(a.business_id,a.campaign_key,a.recipient);if reason<>'' then raise exception '%',reason;end if;
 update public.cc_email_approvals set status='Sending',claimed_at=now() where id=p_id returning * into a;return a;
end $$;
create function public.cc_finish_email_approval(p_id uuid,p_source_message_id text,p_sent_at timestamptz) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;e public.cc_emails;campaign_name text;
begin
 select * into a from public.cc_email_approvals where id=p_id for update;
 if a.id is null then raise exception 'Approval not found';end if;
 if a.status='Sent' then if a.source_message_id=p_source_message_id then return a;else raise exception 'This approval was already sent';end if;end if;
 if a.status not in ('Sending','Needs reconciliation') then raise exception 'Claim the approval before recording the sent result';end if;
 if coalesce(trim(p_source_message_id),'')='' or p_sent_at is null or p_sent_at>now()+interval '5 minutes' or p_sent_at<a.claimed_at-interval '5 minutes' then raise exception 'Verified Gmail message ID and actual send time are required';end if;
 campaign_name:=case a.campaign_key when 'welcome' then 'Listing Welcome' when 'story' then 'Business Story' when 'visibility' then 'Visibility Check' when 'upgrade' then 'Listing Upgrade' else 'Custom email' end;
 select * into e from public.cc_emails where workspace_id=a.workspace_id and source_message_id=p_source_message_id;
 if e.id is not null then
  if e.business_id is distinct from a.business_id or lower(e.recipient)<>lower(a.recipient) or e.subject<>a.subject or e.direction<>'Outbound' or e.status not in ('Sent','Replied','Bounced') then raise exception 'Existing sent record does not match this approval';end if;
 else
  insert into public.cc_emails(workspace_id,business_id,recipient,subject,direction,status,occurred_on,occurred_at,campaign,source_message_id,message_type,notes)
  values(a.workspace_id,a.business_id,a.recipient,a.subject,'Outbound','Sent',(p_sent_at at time zone 'America/Denver')::date,p_sent_at,campaign_name,p_source_message_id,'Human',jsonb_build_object('format','mkt-message-summary-v1','sender',a.sender,'summary','Sent the exact reviewed email. Approved wording is retained in approval '||a.id::text||'.','next_action',case when a.follow_up_on is null then 'Await reply; review history before any further contact.' else 'Await reply; follow up on '||a.follow_up_on::text||' if still appropriate.' end,'follow_up_on',coalesce(a.follow_up_on::text,''),'response_status','Waiting for reply','verification','Reviewed','directoryBrand',a.brand,'campaignKey',case when a.campaign_key='custom' then 'unclassified' else a.campaign_key end,'campaignVariant',a.variant,'approvalId',a.id)::text) returning * into e;
 end if;
 if a.follow_up_on is not null then
  insert into public.cc_tasks(workspace_id,business_id,title,type,status,due_date,assignee,priority,notes)
  values(a.workspace_id,a.business_id,'Review reply / follow up — '||campaign_name,'Follow-up','Open',a.follow_up_on,'Michelle','Normal',jsonb_build_object('format','mkt-portfolio-v1','brand',a.brand,'area','Sales','contactChannel','Email','text','Review replies, opt-outs and the saved message before further contact. Created after verified send.','emailApprovalId',a.id)::text);
 end if;
 update public.cc_email_approvals set status='Sent',sent_at=p_sent_at,source_message_id=p_source_message_id,email_id=e.id,last_error='' where id=a.id returning * into a;
 return a;
end $$;
create function public.cc_hold_email_approval(p_id uuid,p_reason text) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;
begin update public.cc_email_approvals set status='Needs reconciliation',last_error=left(p_reason,2000) where id=p_id and status in ('Sending','Needs reconciliation') returning * into a;if a.id is null then raise exception 'No sending attempt to reconcile';end if;return a;end $$;
create function public.cc_resolve_unsent_email_approval(p_id uuid,p_reason text) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;
begin
 if char_length(trim(coalesce(p_reason,'')))<10 then raise exception 'Record how Sent mail was checked and why no message was sent';end if;
 update public.cc_email_approvals set status='Revoked',last_error=left(p_reason,2000) where id=p_id and status in ('Sending','Needs reconciliation') returning * into a;
 if a.id is null then raise exception 'No unsent attempt to resolve';end if;return a;
end $$;
revoke all on function public.cc_resolve_unsent_email_approval(uuid,text) from public,anon,authenticated;
grant execute on function public.cc_resolve_unsent_email_approval(uuid,text) to service_role;
revoke all on function public.cc_guard_email_approval() from public,anon,authenticated;
revoke all on function public.cc_email_notes(text),public.cc_email_campaign_key(text,text,text),public.cc_email_review_context(uuid),public.cc_email_campaign_contacted(uuid,text),public.cc_email_send_block(uuid,text,text),public.cc_approve_campaign_email(jsonb),public.cc_revoke_email_approval(uuid),public.cc_claim_email_approval(uuid),public.cc_finish_email_approval(uuid,text,timestamptz),public.cc_hold_email_approval(uuid,text) from public,anon,authenticated;
grant execute on function public.cc_email_notes(text),public.cc_email_campaign_key(text,text,text),public.cc_email_review_context(uuid),public.cc_email_campaign_contacted(uuid,text),public.cc_email_send_block(uuid,text,text),public.cc_approve_campaign_email(jsonb),public.cc_revoke_email_approval(uuid) to authenticated,service_role;
grant execute on function public.cc_claim_email_approval(uuid),public.cc_finish_email_approval(uuid,text,timestamptz),public.cc_hold_email_approval(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;

begin;
-- Match the existing historical completion evidence used by profile checklists.
create or replace function public.cc_email_campaign_contacted(p_business uuid,p_key text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.cc_emails e where (e.business_id=p_business or p_business=any(e.related_business_ids)) and e.direction='Outbound' and e.message_type='Human' and e.status in ('Sent','Replied','Bounced') and public.cc_email_campaign_key(e.subject,e.campaign,e.notes)=p_key)
 or exists(select 1 from public.cc_tasks t where t.business_id=p_business and (
 (public.cc_email_notes(t.notes)->>'businessChecklistKey'=case p_key when 'welcome' then 'intro' when 'story' then 'story_request' when 'visibility' then 'offer' when 'upgrade' then 'upgrade_offer' end and (
 public.cc_email_notes(t.notes)#>>'{campaignTracking,sent}'='true' or (p_key in ('welcome','story') and (t.status='Done' or (t.status='Open' and public.cc_email_notes(t.notes) ? 'evidenceCompletion' and coalesce(public.cc_email_notes(t.notes)->>'evidenceCompletionIgnored','false')<>'true')) and coalesce(public.cc_email_notes(t.notes)->>'profileBulkCompletion','false')<>'true' and coalesce(public.cc_email_notes(t.notes)#>>'{campaignTracking,sent}','true')<>'false' and coalesce(public.cc_email_notes(t.notes)->>'notApplicable','false')<>'true')))
 or (t.status='Done' and public.cc_email_notes(t.notes)#>>'{appointmentManager,status}'='Completed' and public.cc_email_notes(t.notes)#>>'{appointmentManager,campaignKey}'=p_key)));
$$;
notify pgrst,'reload schema';
commit;

CREATE OR REPLACE FUNCTION public.cc_email_send_block(p_business uuid, p_key text, p_recipient text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare b public.cc_businesses; m jsonb;
begin
 select * into b from public.cc_businesses where id=p_business; if b.id is null then return 'Business not found or access lost.';end if;
 m:=public.cc_email_notes(b.notes);
 if exists(select 1 from public.cc_bi_profiles p where p.business_id=b.id and p.workspace_id=b.workspace_id and p.crm->>'do_not_contact'='true') then return 'Do Not Contact is recorded for this business.';end if;
 if b.status in ('Archived','Paused','Inactive') or m->>'outreachDecision' in ('Stop outreach','Do not contact','No outreach','Not a match') then return 'Outreach is stopped or business inactive.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.status='Bounced' and lower(e.recipient)=lower(p_recipient)) then return 'Recipient has a recorded bounce. Verify a different active contact.';end if;
 if p_key='custom' then return '';end if;
 if m#>>array['campaignExclusions',p_key]='true' then return 'Removed from this campaign. Add the business back before approval or sending.';end if;
 if public.cc_email_campaign_contacted(b.id,p_key) then return 'This campaign was already contacted. Use a custom follow-up.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.message_type='Human' and e.direction='Outbound' and e.status in ('Sent','Replied','Bounced') and public.cc_email_campaign_key(e.subject,e.campaign,e.notes)='') then return 'Classify the earlier sent messages or prepare a custom email.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.direction='Inbound' and e.message_type='Human' and public.cc_email_notes(e.notes)->>'response_status'='Needs our reply') then return 'A client message needs a custom reply.';end if;
 if p_key='welcome' and exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.message_type='Human' and (e.direction='Outbound' and e.status in ('Sent','Replied','Bounced') or e.direction='Inbound' and e.status='Replied')) then return 'An existing conversation is recorded. Do not send a first introduction.';end if;
 if p_key='story' and not public.cc_email_campaign_contacted(b.id,'welcome') then return 'Listing Welcome is not recorded.';end if;
 if p_key='visibility' and exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.direction='Outbound' and e.message_type='Human' and e.status in ('Sent','Replied','Bounced') and lower(public.cc_email_notes(e.notes)->>'summary') like '%visibility check%') then return 'A Visibility Check offer already appears in earlier outreach. Use a custom follow-up.';end if;
 return '';
end $function$
;

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

-- Server-side AI handlers and reply RPCs verify current membership.
-- This grants no new browser or user permissions and does not bypass membership checks.
grant select on public.cc_members to service_role;

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
