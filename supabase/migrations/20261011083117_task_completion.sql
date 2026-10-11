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
