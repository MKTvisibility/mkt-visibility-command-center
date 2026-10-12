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
