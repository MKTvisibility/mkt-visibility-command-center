-- Server-side AI handlers and reply RPCs verify current membership.
-- This grants no new browser or user permissions and does not bypass membership checks.
grant select on public.cc_members to service_role;
