import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {reviewContext} from '../src/lib/email-approvals.js'
const w='c8748032-cdd3-443b-8c56-2e846cc9bf31',u='22222222-2222-4222-8222-222222222222',v='33333333-3333-4333-8333-333333333333',b='55555555-5555-4555-8555-555555555555'
test('approval lifecycle enforces RLS, immutable exact copy, stale review, exclusive claim and atomic idempotent sent recording',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`)
 for(const f of ['202610110001_command_center.sql','202610110002_business_profiles.sql','202610110003_message_types.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'))
 await db.exec('create table cc_bi_profiles(business_id uuid,workspace_id uuid,crm jsonb)');
 await db.exec(readFileSync(new URL('../supabase/migrations/20261015063729_email_send_approvals.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../supabase/migrations/20261015064518_email_approval_history_evidence.sql',import.meta.url),'utf8'))
 await db.exec(`insert into auth.users values('${u}'),('${v}');insert into cc_members(workspace_id,user_id,display_name,role) values('${w}','${u}','Michelle','editor'),('${w}','${v}','Viewer','viewer');insert into cc_businesses(id,name,email) values('${b}','Sample Studio','owner@example.com');grant select on cc_bi_profiles to authenticated;`)
 const as=async(id,role='authenticated')=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role ${role}`),rows=async sql=>(await db.query(sql)).rows;
 const approve=async(key='welcome')=>rows(`select * from cc_approve_campaign_email(jsonb_build_object('business_id','${b}','campaign_key','${key}','brand','Loving Longmont','sender','hello.lovinglongmont@gmail.com','recipient','owner@example.com','subject','Hello Sample Studio','body','Exact reviewed text.','follow_up_on','2026-12-01','review_note','Public profile, images and history reviewed.','review_context',cc_email_review_context('${b}')))`)
 await as(u);const loaded={};for(const k of ['businesses','emails','tasks','listings','purchases'])loaded[k]=await rows('select * from cc_'+k);const sqlContext=(await rows(`select cc_email_review_context('${b}') as context`))[0].context;assert.deepEqual(reviewContext(loaded.businesses[0],loaded),sqlContext);let a=(await approve())[0];assert.equal(a.approved_by_name,'Michelle');assert.equal((await rows('select * from cc_emails')).length,0);
 await assert.rejects(()=>approve(),/unique/);await assert.rejects(()=>db.exec(`update cc_email_approvals set body='Replaced' where id='${a.id}'`),/immutable/);await assert.rejects(()=>rows(`select cc_claim_email_approval('${a.id}')`),/permission denied/);
 await as(v);assert.equal((await rows('select * from cc_email_approvals')).length,1);await assert.rejects(()=>approve(),/row-level security/);assert.equal((await rows(`select cc_revoke_email_approval('${a.id}')`).catch(e=>{assert.match(e.message,/cannot be withdrawn/);return []})).length,0);
 await as('', 'anon');await assert.rejects(()=>rows('select * from cc_email_approvals'),/permission denied/);
 await as(u);await db.exec(`update cc_businesses set email='new@example.com' where id='${b}'`);await db.exec('reset role');await assert.rejects(()=>rows(`select cc_claim_email_approval('${a.id}')`),/fresh review/);
 await as(u);await rows(`select cc_revoke_email_approval('${a.id}')`);a=(await approve())[0];await db.exec('reset role');await rows(`select cc_claim_email_approval('${a.id}')`);await assert.rejects(()=>rows(`select cc_claim_email_approval('${a.id}')`),/not available/);
 await assert.rejects(()=>rows(`select cc_finish_email_approval('${a.id}','','2026-10-10')`),/Verified/);
 await rows(`select cc_hold_email_approval('${a.id}','Gmail returned an uncertain result; check Sent before retry.')`);assert.equal((await rows(`select status from cc_email_approvals where id='${a.id}'`))[0].status,'Needs reconciliation');
 await rows(`select cc_finish_email_approval('${a.id}','verified-gmail-message',now())`);await rows(`select cc_finish_email_approval('${a.id}','verified-gmail-message',now())`);assert.equal((await rows('select * from cc_emails')).length,1);assert.equal((await rows("select * from cc_tasks where type='Follow-up'")).length,1);assert.equal((await rows(`select status from cc_email_approvals where id='${a.id}'`))[0].status,'Sent');assert.equal((await rows(`select notes::jsonb->>'sender' as sender from cc_emails`))[0].sender,'hello.lovinglongmont@gmail.com');
 await as(u);await assert.rejects(()=>approve(),/already contacted/);assert.equal((await approve('story'))[0].status,'Approved');
 await db.exec('reset role');await db.exec(`insert into cc_bi_profiles values('${b}','${w}','{"do_not_contact":true}')`);await assert.rejects(()=>rows(`select cc_claim_email_approval((select id from cc_email_approvals where status='Approved'))`),/Do Not Contact/)
 }finally{await db.close()}
})
