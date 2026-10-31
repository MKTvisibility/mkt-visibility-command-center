alter table public.cc_bi_jobs add column if not exists provider_response_id text;
alter table public.cc_bi_jobs add column if not exists processing_until timestamptz;
alter table public.cc_bi_jobs add column if not exists progress text not null default '';
alter table public.cc_bi_research add column if not exists job_id uuid references public.cc_bi_jobs(id);
create unique index if not exists cc_bi_research_job on public.cc_bi_research(job_id);
create unique index if not exists cc_visibility_run_job on public.cc_visibility_research_runs ((research->>'job_id')) where research->>'job_id' is not null;
create or replace function public.cc_bi_claim() returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.cc_bi_jobs;
begin
 update public.cc_bi_jobs set status='Failed',error='Research submission was interrupted. Start a new check to retry.',finished_at=now() where status='Running' and provider_response_id is null and started_at<now()-interval '10 minutes' and (processing_until is null or processing_until<now());
 select * into j from public.cc_bi_jobs where status='Queued' order by created_at for update skip locked limit 1;
 if not found then return null; end if;
 update public.cc_bi_jobs set status='Running',started_at=now(),progress='Starting public web research' where id=j.id returning * into j;
 return to_jsonb(j);
end $$;
revoke all on function public.cc_bi_claim() from public,anon,authenticated;
grant execute on function public.cc_bi_claim() to service_role;
select cron.schedule('cc-business-research-worker','* * * * *',$job$
 select net.http_post(url:='https://gvmwkltwrlqwbqegieum.supabase.co/functions/v1/research-business',
 headers:=jsonb_build_object('Content-Type','application/json','x-cc-bi-token',(select token from cc_bi_private.worker_secret limit 1)),
 body:='{"action":"process"}'::jsonb,timeout_milliseconds:=90000)
 where exists(select 1 from public.cc_bi_jobs where status in ('Queued','Running'));
$job$);
