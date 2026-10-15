begin;
-- Match the existing historical completion evidence used by profile checklists.
create or replace function public.cc_email_campaign_contacted(p_business uuid,p_key text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.cc_emails e where (e.business_id=p_business or p_business=any(e.related_business_ids)) and e.direction='Outbound' and e.message_type='Human' and e.status in ('Sent','Replied','Bounced') and public.cc_email_campaign_key(e.subject,e.campaign,e.notes)=p_key)
 or exists(select 1 from public.cc_tasks t where t.business_id=p_business and (
 (public.cc_email_notes(t.notes)->>'businessChecklistKey'=case p_key when 'welcome' then 'intro' when 'story' then 'story_request' when 'visibility' then 'offer' when 'upgrade' then 'upgrade_offer' end and (
 public.cc_email_notes(t.notes)#>>'{campaignTracking,sent}'='true' or (p_key in ('welcome','story') and (t.status='Done' or (t.status='Open' and public.cc_email_notes(t.notes) ? 'evidenceCompletion' and coalesce(public.cc_email_notes(t.notes)->>'evidenceCompletionIgnored','false')<>'true')) and coalesce(public.cc_email_notes(t.notes)->>'profileBulkCompletion','false')<>'true' and coalesce(public.cc_email_notes(t.notes)#>>'{campaignTracking,sent}','true')<>'false' and coalesce(public.cc_email_notes(t.notes)->>'notApplicable','false')<>'true')))
 or (t.status='Done' and public.cc_email_notes(t.notes)#>>'{appointmentManager,status}'='Completed' and public.cc_email_notes(t.notes)#>>'{appointmentManager,campaignKey}'=p_key)));
$$;
notify pgrst,'reload schema';
commit;
