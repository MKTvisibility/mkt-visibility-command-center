create table public.cc_partner_messages (
id uuid primary key default gen_random_uuid(),
workspace_id uuid not null references public.cc_workspaces(id),
parent_id uuid,
body text not null check(length(btrim(body))>0 and length(body)<=10000),
author_name text not null default '',
created_by uuid not null default auth.uid() references auth.users(id),
created_at timestamptz not null default now(),
unique(workspace_id,id),
foreign key(workspace_id,parent_id) references public.cc_partner_messages(workspace_id,id)
);
create function public.cc_partner_message_stamp() returns trigger language plpgsql security invoker set search_path='' as $$
begin
select display_name into new.author_name from public.cc_members where workspace_id=new.workspace_id and user_id=auth.uid() and enabled;
if new.author_name is null then raise exception 'Approved membership required'; end if;
new.created_by:=auth.uid();new.created_at:=now();
if new.parent_id is not null and not exists(select 1 from public.cc_partner_messages where id=new.parent_id and workspace_id=new.workspace_id and parent_id is null) then raise exception 'Reply requires a top-level message';end if;
return new;
end $$;
revoke all on function public.cc_partner_message_stamp() from public,anon,authenticated;
create trigger cc_stamp before insert on public.cc_partner_messages for each row execute function public.cc_partner_message_stamp();
alter table public.cc_partner_messages enable row level security;
grant select,insert on public.cc_partner_messages to authenticated;
create policy cc_read on public.cc_partner_messages for select to authenticated using(public.cc_has_access(workspace_id));
create policy cc_insert on public.cc_partner_messages for insert to authenticated with check(public.cc_has_access(workspace_id,true) and created_by=auth.uid());
create index on public.cc_partner_messages(workspace_id,created_at);
create table public.cc_partner_reactions (
id uuid primary key default gen_random_uuid(),
workspace_id uuid not null references public.cc_workspaces(id),
message_id uuid not null,
user_id uuid not null default auth.uid() references auth.users(id),
value smallint not null check(value in(-1,0,1)),
created_at timestamptz not null default now(),
unique(message_id,user_id),
foreign key(workspace_id,message_id) references public.cc_partner_messages(workspace_id,id)
);
alter table public.cc_partner_reactions enable row level security;
grant select,insert,update on public.cc_partner_reactions to authenticated;
create policy cc_read on public.cc_partner_reactions for select to authenticated using(public.cc_has_access(workspace_id));
create policy cc_insert on public.cc_partner_reactions for insert to authenticated with check(public.cc_has_access(workspace_id,true) and user_id=auth.uid());
create policy cc_update on public.cc_partner_reactions for update to authenticated using(public.cc_has_access(workspace_id,true) and user_id=auth.uid()) with check(public.cc_has_access(workspace_id,true) and user_id=auth.uid());
