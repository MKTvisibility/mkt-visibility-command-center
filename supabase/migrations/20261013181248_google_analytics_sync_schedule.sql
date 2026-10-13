begin;
insert into public.cc_ga_sync_control(workspace_id) select id from public.cc_workspaces where id='c8748032-cdd3-443b-8c56-2e846cc9bf31';
insert into public.cc_ga_sync_state(workspace_id,brand,property_id)
select w.id,p.brand,p.property_id from public.cc_workspaces w cross join (values
 ('Loving Longmont','558375784'),('MKT Colorado','558329947'),('MKT Visibility','558367806'),('Open Theory Cove','558417742'),('Boulder County Photography','558429449')) p(brand,property_id)
where w.id='c8748032-cdd3-443b-8c56-2e846cc9bf31';
-- Two UTC slots make 8 AM Mountain correct in both daylight and standard time.
select cron.schedule('cc-google-analytics-daily','0 13,14 * * *',$job$
 select net.http_post(
  url:='https://gvmwkltwrlqwbqegieum.supabase.co/functions/v1/sync-google-analytics',
  headers:=jsonb_build_object('Content-Type','application/json','x-cc-ga-token',(select decrypted_secret from vault.decrypted_secrets where name='cc_ga_cron_token')),
  body:='{"action":"refresh"}'::jsonb,timeout_milliseconds:=180000)
 where extract(hour from now() at time zone 'America/Denver')=8;
$job$);
commit;
