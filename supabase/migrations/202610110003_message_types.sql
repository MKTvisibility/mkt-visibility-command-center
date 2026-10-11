begin;
create or replace function public.cc_validate_related_businesses() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from unnest(new.related_business_ids) as requested(business_id) where not exists(select 1 from public.cc_businesses b where b.id=requested.business_id and b.workspace_id=new.workspace_id)) then raise exception 'Related businesses must belong to this workspace'; end if;
 return new;
end $$;
alter table public.cc_emails add column occurred_at timestamptz,
 add column message_type text not null default 'Human' check(message_type in ('Human','Automatic','Delivery','Form'));
commit;
