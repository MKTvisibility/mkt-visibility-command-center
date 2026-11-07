grant select,insert,update,delete on public.cc_client_report_links,public.cc_client_report_attempts,public.cc_visibility_report_archives to service_role;
grant usage,select on sequence public.cc_client_report_attempts_id_seq to service_role;
