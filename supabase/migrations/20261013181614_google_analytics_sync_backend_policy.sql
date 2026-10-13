create policy cc_backend_only on public.cc_ga_sync_control for all to service_role using(true) with check(true);
