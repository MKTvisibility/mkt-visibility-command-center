CREATE OR REPLACE FUNCTION public.cc_email_send_block(p_business uuid, p_key text, p_recipient text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare b public.cc_businesses; m jsonb;
begin
 select * into b from public.cc_businesses where id=p_business; if b.id is null then return 'Business not found or access lost.';end if;
 m:=public.cc_email_notes(b.notes);
 if exists(select 1 from public.cc_bi_profiles p where p.business_id=b.id and p.workspace_id=b.workspace_id and p.crm->>'do_not_contact'='true') then return 'Do Not Contact is recorded for this business.';end if;
 if b.status in ('Archived','Paused','Inactive') or m->>'outreachDecision' in ('Stop outreach','Do not contact','No outreach','Not a match') then return 'Outreach is stopped or business inactive.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.status='Bounced' and lower(e.recipient)=lower(p_recipient)) then return 'Recipient has a recorded bounce. Verify a different active contact.';end if;
 if p_key='custom' then return '';end if;
 if m#>>array['campaignExclusions',p_key]='true' then return 'Removed from this campaign. Add the business back before approval or sending.';end if;
 if public.cc_email_campaign_contacted(b.id,p_key) then return 'This campaign was already contacted. Use a custom follow-up.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.message_type='Human' and e.direction='Outbound' and e.status in ('Sent','Replied','Bounced') and public.cc_email_campaign_key(e.subject,e.campaign,e.notes)='') then return 'Classify the earlier sent messages or prepare a custom email.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.direction='Inbound' and e.message_type='Human' and public.cc_email_notes(e.notes)->>'response_status'='Needs our reply') then return 'A client message needs a custom reply.';end if;
 if p_key='welcome' and exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.message_type='Human' and (e.direction='Outbound' and e.status in ('Sent','Replied','Bounced') or e.direction='Inbound' and e.status='Replied')) then return 'An existing conversation is recorded. Do not send a first introduction.';end if;
 if p_key='story' and not public.cc_email_campaign_contacted(b.id,'welcome') then return 'Listing Welcome is not recorded.';end if;
 if p_key='visibility' and exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.direction='Outbound' and e.message_type='Human' and e.status in ('Sent','Replied','Bounced') and lower(public.cc_email_notes(e.notes)->>'summary') like '%visibility check%') then return 'A Visibility Check offer already appears in earlier outreach. Use a custom follow-up.';end if;
 return '';
end $function$
;
