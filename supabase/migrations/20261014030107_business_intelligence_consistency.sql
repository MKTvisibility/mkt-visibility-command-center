begin;
create function public.cc_bi_stage_from_business() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.cc_bi_profiles; expected text; mapped text;
begin
 select * into p from public.cc_bi_profiles where business_id=new.id and workspace_id=new.workspace_id for update;
 if not found then
  insert into public.cc_bi_profiles(workspace_id,business_id,crm) values(new.workspace_id,new.id,jsonb_build_object('stage',case new.stage when 'Contacted' then 'Contacted' when 'Discovery' then 'Interested' when 'Proposal' then 'Proposal Sent' when 'Won' then 'Client Won' when 'Lost' then 'Closed / Not a Fit' else 'Researching' end,'do_not_contact',false));return new;
 end if;
 if coalesce((p.crm->>'do_not_contact')::boolean,false) and new.stage not in ('New','Lost') then raise exception 'Do Not Contact excludes outreach'; end if;
 expected:=case p.crm->>'stage' when 'Contacted' then 'Contacted' when 'Interested' then 'Discovery' when 'Proposal Sent' then 'Proposal' when 'Client Won' then 'Won' when 'Closed / Not a Fit' then 'Lost' else 'New' end;
 if expected<>new.stage then
  mapped:=case new.stage when 'Contacted' then 'Contacted' when 'Discovery' then 'Interested' when 'Proposal' then 'Proposal Sent' when 'Won' then 'Client Won' when 'Lost' then 'Closed / Not a Fit' else 'Researching' end;
  update public.cc_bi_profiles set crm=crm||jsonb_build_object('stage',mapped) where id=p.id;
 end if;
 return new;
end $$;
revoke all on function public.cc_bi_stage_from_business() from public,anon,authenticated;
create trigger cc_bi_new_business after insert on public.cc_businesses for each row execute function public.cc_bi_stage_from_business();
create trigger cc_bi_legacy_stage after update of stage on public.cc_businesses for each row when(old.stage is distinct from new.stage) execute function public.cc_bi_stage_from_business();
create function public.cc_bi_settings_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(new.config->'weights') is distinct from 'object' or not (new.config->'weights' ?& array['need','potential','contact','engagement']) or (new.config->'weights'-array['need','potential','contact','engagement'])<>'{}' then raise exception 'Configure all four priority weights'; end if;
 if exists(select 1 from jsonb_each_text(new.config->'weights') where value::numeric<0 or value::numeric>100) or (select sum(value::numeric) from jsonb_each_text(new.config->'weights'))<>100 then raise exception 'Priority weights must total 100'; end if;
 if new.config ? 'platformWeights' and exists(select 1 from jsonb_each_text(new.config->'platformWeights') where value::numeric<0 or value::numeric>100) then raise exception 'Platform weights must be from 0 to 100'; end if;
 return new;
end $$;
revoke all on function public.cc_bi_settings_guard() from public,anon,authenticated;
create trigger cc_bi_settings_guard before insert or update on public.cc_bi_settings for each row execute function public.cc_bi_settings_guard();
commit;
