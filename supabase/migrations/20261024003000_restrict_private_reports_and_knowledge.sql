begin;
do $fix$
declare p record; cond text; stmt text;
begin
 for p in select * from pg_policies where schemaname='public' and tablename in ('cc_knowledge_notes','cc_knowledge_topics','cc_visibility_report_archives','cc_visibility_research_runs')
 loop
  cond:=case when p.tablename='cc_visibility_research_runs' then 'public.cc_has_access(workspace_id,'||case when p.cmd='SELECT' then 'false' else 'true' end||')'
   when p.tablename='cc_visibility_report_archives' then 'exists(select 1 from public.cc_businesses b where b.id=business_id and public.cc_has_access(b.workspace_id,'||case when p.cmd='SELECT' then 'false' else 'true' end||'))'
   else 'exists(select 1 from public.cc_members m where m.user_id=(select auth.uid()) and m.enabled'||case when p.cmd='SELECT' then '' else ' and m.role in (''owner'',''editor'')' end||')' end;
  stmt:=format('alter policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  if p.cmd in ('SELECT','UPDATE','DELETE','ALL') then stmt:=stmt||' using (('||coalesce(p.qual,'true')||') and ('||cond||'))'; end if;
  if p.cmd in ('INSERT','UPDATE','ALL') then stmt:=stmt||' with check (('||coalesce(p.with_check,p.qual,'true')||') and ('||cond||'))'; end if;
  execute stmt;
 end loop;
 for p in select * from pg_policies where schemaname='storage' and tablename='objects' and policyname in ('knowledge files partner delete','knowledge files partner read','knowledge files partner upload','visibility archives pdf insert','visibility archives pdf read')
 loop
  cond:='exists(select 1 from public.cc_members m where m.user_id=(select auth.uid()) and m.enabled'||case when p.cmd='SELECT' then '' else ' and m.role in (''owner'',''editor'')' end||')';
  stmt:=format('alter policy %I on storage.objects',p.policyname);
  if p.cmd in ('SELECT','DELETE','UPDATE','ALL') then stmt:=stmt||' using (('||coalesce(p.qual,'true')||') and ('||cond||'))'; end if;
  if p.cmd in ('INSERT','UPDATE','ALL') then stmt:=stmt||' with check (('||coalesce(p.with_check,p.qual,'true')||') and ('||cond||'))'; end if;
  execute stmt;
 end loop;
end $fix$;
commit;