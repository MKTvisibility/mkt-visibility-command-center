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
