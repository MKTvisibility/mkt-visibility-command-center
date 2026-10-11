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
