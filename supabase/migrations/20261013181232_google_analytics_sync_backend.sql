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
