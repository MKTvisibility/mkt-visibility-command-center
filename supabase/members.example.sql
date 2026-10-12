-- Run as project administrator AFTER creating the approved Auth accounts.
-- In Supabase: Authentication > Users > Add user > Create new user.
-- Do NOT choose "Send invitation" unless email sending is separately authorized.
-- Replace all placeholders with user IDs from Authentication > Users.
-- Check identities before running. No passwords belong in this file.
begin;
insert into public.cc_members(workspace_id,user_id,display_name,role) values
 ('c8748032-cdd3-443b-8c56-2e846cc9bf31','REPLACE_WITH_MICHELLE_USER_UUID','Michelle','owner'),
 ('c8748032-cdd3-443b-8c56-2e846cc9bf31','REPLACE_WITH_TIM_USER_UUID','Tim','editor');
commit;
-- To revoke access, set enabled=false for the specific verified user ID.
-- Never grant INSERT/UPDATE/DELETE on cc_members to authenticated or anon.
