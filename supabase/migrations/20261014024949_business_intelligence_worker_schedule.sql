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
