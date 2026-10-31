alter table public.cc_bi_jobs add column if not exists requested_platforms text[];
alter table public.cc_bi_jobs add column if not exists platform_urls jsonb not null default '{}'::jsonb;
