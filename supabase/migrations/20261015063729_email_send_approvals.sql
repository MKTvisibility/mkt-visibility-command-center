begin;
create table public.cc_email_approvals (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null default 'c8748032-cdd3-443b-8c56-2e846cc9bf31' references public.cc_workspaces(id),
 business_id uuid not null,
 campaign_key text not null check(campaign_key in ('welcome','story','visibility','upgrade','custom')),
 brand text not null check(brand in ('Loving Longmont','MKT Colorado')),
 sender text not null check(sender in ('hello.lovinglongmont@gmail.com','mktvisibility@gmail.com')),
 recipient text not null check(recipient ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and lower(recipient)<>lower(sender)),
 subject text not null check(char_length(trim(subject)) between 1 and 300),
 body text not null check(char_length(trim(body)) between 1 and 10000),
 variant text not null default '' check(char_length(variant)<=80),
 review_note text not null check(char_length(trim(review_note)) between 1 and 1000),
 review_context jsonb not null,
 follow_up_on date,
 status text not null default 'Approved' check(status in ('Approved','Revoked','Sending','Sent','Needs reconciliation')),
 approved_by_name text not null default '',
 created_by uuid references auth.users(id) default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 claimed_at timestamptz, sent_at timestamptz, source_message_id text not null default '', email_id uuid references public.cc_emails(id), last_error text not null default '',
 foreign key(workspace_id,business_id) references public.cc_businesses(workspace_id,id)
);
create unique index cc_one_pending_email on public.cc_email_approvals(workspace_id,business_id) where status in ('Approved','Sending','Needs reconciliation');
create index cc_approval_queue on public.cc_email_approvals(workspace_id,status,campaign_key);
create index cc_approval_created on public.cc_email_approvals(workspace_id,created_at desc,id);
alter table public.cc_email_approvals enable row level security;
revoke all on public.cc_email_approvals from public,anon,authenticated;
grant select,insert,update on public.cc_email_approvals to authenticated,service_role;
create policy cc_approval_read on public.cc_email_approvals for select to authenticated using(public.cc_has_access(workspace_id));
create policy cc_approval_insert on public.cc_email_approvals for insert to authenticated with check(public.cc_has_access(workspace_id,true));
create policy cc_approval_update on public.cc_email_approvals for update to authenticated using(public.cc_has_access(workspace_id,true)) with check(public.cc_has_access(workspace_id,true));

create function public.cc_email_notes(p_text text) returns jsonb language plpgsql immutable set search_path='' as $$
begin return coalesce(nullif(p_text,'')::jsonb,'{}'::jsonb); exception when others then return '{}'::jsonb; end $$;
create function public.cc_email_campaign_key(p_subject text,p_campaign text,p_notes text) returns text language plpgsql immutable set search_path='' as $$
declare m jsonb:=public.cc_email_notes(p_notes); s text:=lower(coalesce(p_subject,'')); c text:=lower(coalesce(p_campaign,''));
begin
 if m->>'campaignKey' in ('welcome','story','visibility','upgrade','custom') then return m->>'campaignKey';end if;
 if m->>'campaignKey'='unclassified' then return '';end if;
 if s ~ '(has been added|is listed|we added|you.re listed|you are listed|free listing)' then return 'welcome';end if;
 if s ~ '(story behind|share (your|the) story|business stor(y|ies)|your business story)' or c ~ 'business stor(y|ies)' then return 'story';end if;
 if s ~ '(upgrade|upgraded listing|enhanced listing|featured listing)' then return 'upgrade';end if;
 if s ~ 'free (business )?visibility check' and s !~ '(report|results|completed|follow.up|thank|received)' and lower(coalesce(m->>'summary','')) !~ '(completed.{0,50}report|sent.{0,80}report|acknowledged|submission)' and (s||' '||lower(coalesce(m->>'summary',''))) ~ '(invit|offered.{0,30}(free|visibility)|interested in|would you like|offer(ing)? a free)' then return 'visibility';end if;
 return '';
end $$;
create function public.cc_email_review_context(p_business_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'business',jsonb_build_array(b.id,floor(extract(epoch from b.updated_at)*1000)),
 'emails',(select coalesce(jsonb_agg(jsonb_build_array(e.id,floor(extract(epoch from e.updated_at)*1000)) order by e.id),'[]') from public.cc_emails e where e.workspace_id=b.workspace_id and (e.business_id=b.id or b.id=any(e.related_business_ids))),
 'tasks',(select coalesce(jsonb_agg(jsonb_build_array(t.id,floor(extract(epoch from t.updated_at)*1000)) order by t.id),'[]') from public.cc_tasks t where t.workspace_id=b.workspace_id and t.business_id=b.id),
 'listings',(select coalesce(jsonb_agg(jsonb_build_array(l.id,floor(extract(epoch from l.updated_at)*1000)) order by l.id),'[]') from public.cc_listings l where l.workspace_id=b.workspace_id and l.business_id=b.id),
 'purchases',(select coalesce(jsonb_agg(jsonb_build_array(p.id,floor(extract(epoch from p.updated_at)*1000)) order by p.id),'[]') from public.cc_purchases p where p.workspace_id=b.workspace_id and p.business_id=b.id))
 from public.cc_businesses b where b.id=p_business_id;
$$;
create function public.cc_email_campaign_contacted(p_business uuid,p_key text) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.cc_emails e where (e.business_id=p_business or p_business=any(e.related_business_ids)) and e.direction='Outbound' and e.message_type='Human' and e.status in ('Sent','Replied','Bounced') and public.cc_email_campaign_key(e.subject,e.campaign,e.notes)=p_key)
 or exists(select 1 from public.cc_tasks t where t.business_id=p_business and (
 (public.cc_email_notes(t.notes)->>'businessChecklistKey'=case p_key when 'welcome' then 'intro' when 'story' then 'story_request' when 'visibility' then 'offer' when 'upgrade' then 'upgrade_offer' end and (
 public.cc_email_notes(t.notes)#>>'{campaignTracking,sent}'='true' or (p_key in ('welcome','story') and t.status='Done' and coalesce(public.cc_email_notes(t.notes)->>'profileBulkCompletion','false')<>'true' and coalesce(public.cc_email_notes(t.notes)#>>'{campaignTracking,sent}','true')<>'false' and coalesce(public.cc_email_notes(t.notes)->>'notApplicable','false')<>'true')))
 or (t.status='Done' and public.cc_email_notes(t.notes)#>>'{appointmentManager,status}'='Completed' and public.cc_email_notes(t.notes)#>>'{appointmentManager,campaignKey}'=p_key)));
$$;
create function public.cc_email_send_block(p_business uuid,p_key text,p_recipient text) returns text language plpgsql stable security invoker set search_path='' as $$
declare b public.cc_businesses; m jsonb;
begin
 select * into b from public.cc_businesses where id=p_business; if b.id is null then return 'Business not found or access lost.';end if;
 m:=public.cc_email_notes(b.notes);
 if exists(select 1 from public.cc_bi_profiles p where p.business_id=b.id and p.workspace_id=b.workspace_id and p.crm->>'do_not_contact'='true') then return 'Do Not Contact is recorded for this business.';end if;
 if b.status in ('Archived','Paused','Inactive') or m->>'outreachDecision' in ('Stop outreach','Do not contact','No outreach','Not a match') then return 'Outreach is stopped or business inactive.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.status='Bounced' and lower(e.recipient)=lower(p_recipient)) then return 'Recipient has a recorded bounce. Verify a different active contact.';end if;
 if p_key='custom' then return '';end if;
 if public.cc_email_campaign_contacted(b.id,p_key) then return 'This campaign was already contacted. Use a custom follow-up.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.message_type='Human' and e.direction='Outbound' and e.status in ('Sent','Replied','Bounced') and public.cc_email_campaign_key(e.subject,e.campaign,e.notes)='') then return 'Classify the earlier sent messages or prepare a custom email.';end if;
 if exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.direction='Inbound' and e.message_type='Human' and public.cc_email_notes(e.notes)->>'response_status'='Needs our reply') then return 'A client message needs a custom reply.';end if;
 if p_key='welcome' and exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.message_type='Human' and (e.direction='Outbound' and e.status in ('Sent','Replied','Bounced') or e.direction='Inbound' and e.status='Replied')) then return 'An existing conversation is recorded. Do not send a first introduction.';end if;
 if p_key='story' and not public.cc_email_campaign_contacted(b.id,'welcome') then return 'Listing Welcome is not recorded.';end if;
 if p_key='visibility' and exists(select 1 from public.cc_emails e where (e.business_id=b.id or b.id=any(e.related_business_ids)) and e.direction='Outbound' and e.message_type='Human' and e.status in ('Sent','Replied','Bounced') and lower(public.cc_email_notes(e.notes)->>'summary') like '%visibility check%') then return 'A Visibility Check offer already appears in earlier outreach. Use a custom follow-up.';end if;
 return '';
end $$;
create function public.cc_guard_email_approval() returns trigger language plpgsql security invoker set search_path='' as $$
declare reason text;
begin
 if tg_op='INSERT' then
  if new.status<>'Approved' or new.email_id is not null or new.sent_at is not null or new.claimed_at is not null or new.source_message_id<>'' then raise exception 'New approvals must be unsent';end if;
  if new.review_context is distinct from public.cc_email_review_context(new.business_id) then raise exception 'Profile or history changed. Reload and review again.';end if;
  reason:=public.cc_email_send_block(new.business_id,new.campaign_key,new.recipient);if reason<>'' then raise exception '%',reason;end if;
  new.approved_by_name:=coalesce((select display_name from public.cc_members where workspace_id=new.workspace_id and user_id=auth.uid() and enabled),'Workspace administrator');
 else
  if (to_jsonb(new)-array['status','updated_at','claimed_at','sent_at','source_message_id','email_id','last_error']) is distinct from (to_jsonb(old)-array['status','updated_at','claimed_at','sent_at','source_message_id','email_id','last_error']) then raise exception 'Approved wording is immutable. Withdraw and approve a new email.';end if;
  if current_user not in ('postgres','service_role','supabase_admin') then
   if old.status<>'Approved' or new.status<>'Revoked' or new.claimed_at is distinct from old.claimed_at or new.sent_at is distinct from old.sent_at or new.email_id is distinct from old.email_id or new.source_message_id is distinct from old.source_message_id or new.last_error is distinct from old.last_error then raise exception 'Partners may only withdraw an unsent approval';end if;
  end if;
  if old.status='Sent' then raise exception 'A sent approval cannot be reused';end if;
 end if;
 return new;
end $$;
create trigger cc_approval_guard before insert or update on public.cc_email_approvals for each row execute function public.cc_guard_email_approval();
create trigger cc_stamp before insert or update on public.cc_email_approvals for each row execute function public.cc_stamp_record();
create trigger cc_audit after insert or update on public.cc_email_approvals for each row execute function public.cc_audit_record();
create function public.cc_approve_campaign_email(p_input jsonb) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;
begin
 insert into public.cc_email_approvals(business_id,campaign_key,brand,sender,recipient,subject,body,variant,review_note,review_context,follow_up_on)
 values((p_input->>'business_id')::uuid,p_input->>'campaign_key',p_input->>'brand',p_input->>'sender',trim(p_input->>'recipient'),trim(p_input->>'subject'),trim(p_input->>'body'),coalesce(p_input->>'variant',''),p_input->>'review_note',p_input->'review_context',nullif(p_input->>'follow_up_on','')::date) returning * into a;return a;
end $$;
create function public.cc_revoke_email_approval(p_id uuid) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;
begin update public.cc_email_approvals set status='Revoked' where id=p_id and status='Approved' returning * into a;if a.id is null then raise exception 'Approval changed or cannot be withdrawn';end if;return a;end $$;

-- Agent-only dispatch lifecycle. No browser send button, stored Gmail credentials or background sender.
create function public.cc_claim_email_approval(p_id uuid) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals; reason text;
begin
 select * into a from public.cc_email_approvals where id=p_id for update;
 if a.id is null or a.status<>'Approved' then raise exception 'Approval is not available to claim. Reconcile any existing attempt before retrying.';end if;
 if a.review_context is distinct from public.cc_email_review_context(a.business_id) then raise exception 'Profile or correspondence changed; approval needs a fresh review.';end if;
 reason:=public.cc_email_send_block(a.business_id,a.campaign_key,a.recipient);if reason<>'' then raise exception '%',reason;end if;
 update public.cc_email_approvals set status='Sending',claimed_at=now() where id=p_id returning * into a;return a;
end $$;
create function public.cc_finish_email_approval(p_id uuid,p_source_message_id text,p_sent_at timestamptz) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;e public.cc_emails;campaign_name text;
begin
 select * into a from public.cc_email_approvals where id=p_id for update;
 if a.id is null then raise exception 'Approval not found';end if;
 if a.status='Sent' then if a.source_message_id=p_source_message_id then return a;else raise exception 'This approval was already sent';end if;end if;
 if a.status not in ('Sending','Needs reconciliation') then raise exception 'Claim the approval before recording the sent result';end if;
 if coalesce(trim(p_source_message_id),'')='' or p_sent_at is null or p_sent_at>now()+interval '5 minutes' or p_sent_at<a.claimed_at-interval '5 minutes' then raise exception 'Verified Gmail message ID and actual send time are required';end if;
 campaign_name:=case a.campaign_key when 'welcome' then 'Listing Welcome' when 'story' then 'Business Story' when 'visibility' then 'Visibility Check' when 'upgrade' then 'Listing Upgrade' else 'Custom email' end;
 select * into e from public.cc_emails where workspace_id=a.workspace_id and source_message_id=p_source_message_id;
 if e.id is not null then
  if e.business_id is distinct from a.business_id or lower(e.recipient)<>lower(a.recipient) or e.subject<>a.subject or e.direction<>'Outbound' or e.status not in ('Sent','Replied','Bounced') then raise exception 'Existing sent record does not match this approval';end if;
 else
  insert into public.cc_emails(workspace_id,business_id,recipient,subject,direction,status,occurred_on,occurred_at,campaign,source_message_id,message_type,notes)
  values(a.workspace_id,a.business_id,a.recipient,a.subject,'Outbound','Sent',(p_sent_at at time zone 'America/Denver')::date,p_sent_at,campaign_name,p_source_message_id,'Human',jsonb_build_object('format','mkt-message-summary-v1','sender',a.sender,'summary','Sent the exact reviewed email. Approved wording is retained in approval '||a.id::text||'.','next_action',case when a.follow_up_on is null then 'Await reply; review history before any further contact.' else 'Await reply; follow up on '||a.follow_up_on::text||' if still appropriate.' end,'follow_up_on',coalesce(a.follow_up_on::text,''),'response_status','Waiting for reply','verification','Reviewed','directoryBrand',a.brand,'campaignKey',case when a.campaign_key='custom' then 'unclassified' else a.campaign_key end,'campaignVariant',a.variant,'approvalId',a.id)::text) returning * into e;
 end if;
 if a.follow_up_on is not null then
  insert into public.cc_tasks(workspace_id,business_id,title,type,status,due_date,assignee,priority,notes)
  values(a.workspace_id,a.business_id,'Review reply / follow up — '||campaign_name,'Follow-up','Open',a.follow_up_on,'Michelle','Normal',jsonb_build_object('format','mkt-portfolio-v1','brand',a.brand,'area','Sales','contactChannel','Email','text','Review replies, opt-outs and the saved message before further contact. Created after verified send.','emailApprovalId',a.id)::text);
 end if;
 update public.cc_email_approvals set status='Sent',sent_at=p_sent_at,source_message_id=p_source_message_id,email_id=e.id,last_error='' where id=a.id returning * into a;
 return a;
end $$;
create function public.cc_hold_email_approval(p_id uuid,p_reason text) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;
begin update public.cc_email_approvals set status='Needs reconciliation',last_error=left(p_reason,2000) where id=p_id and status in ('Sending','Needs reconciliation') returning * into a;if a.id is null then raise exception 'No sending attempt to reconcile';end if;return a;end $$;
create function public.cc_resolve_unsent_email_approval(p_id uuid,p_reason text) returns public.cc_email_approvals language plpgsql security invoker set search_path='' as $$
declare a public.cc_email_approvals;
begin
 if char_length(trim(coalesce(p_reason,'')))<10 then raise exception 'Record how Sent mail was checked and why no message was sent';end if;
 update public.cc_email_approvals set status='Revoked',last_error=left(p_reason,2000) where id=p_id and status in ('Sending','Needs reconciliation') returning * into a;
 if a.id is null then raise exception 'No unsent attempt to resolve';end if;return a;
end $$;
revoke all on function public.cc_resolve_unsent_email_approval(uuid,text) from public,anon,authenticated;
grant execute on function public.cc_resolve_unsent_email_approval(uuid,text) to service_role;
revoke all on function public.cc_guard_email_approval() from public,anon,authenticated;
revoke all on function public.cc_email_notes(text),public.cc_email_campaign_key(text,text,text),public.cc_email_review_context(uuid),public.cc_email_campaign_contacted(uuid,text),public.cc_email_send_block(uuid,text,text),public.cc_approve_campaign_email(jsonb),public.cc_revoke_email_approval(uuid),public.cc_claim_email_approval(uuid),public.cc_finish_email_approval(uuid,text,timestamptz),public.cc_hold_email_approval(uuid,text) from public,anon,authenticated;
grant execute on function public.cc_email_notes(text),public.cc_email_campaign_key(text,text,text),public.cc_email_review_context(uuid),public.cc_email_campaign_contacted(uuid,text),public.cc_email_send_block(uuid,text,text),public.cc_approve_campaign_email(jsonb),public.cc_revoke_email_approval(uuid) to authenticated,service_role;
grant execute on function public.cc_claim_email_approval(uuid),public.cc_finish_email_approval(uuid,text,timestamptz),public.cc_hold_email_approval(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
