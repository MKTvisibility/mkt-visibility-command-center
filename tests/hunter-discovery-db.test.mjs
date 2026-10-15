import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const w='c8748032-cdd3-443b-8c56-2e846cc9bf31',u='22222222-2222-4222-8222-222222222222',v='33333333-3333-4333-8333-333333333333',t='55555555-5555-4555-8555-555555555555',m='66666666-6666-4666-8666-666666666666'
test('Hunter creates only pending drafts with attributed audits, deduplicates, prevents replay and enforces access and budgets',async()=>{
 const db=new PGlite(),rows=async q=>(await db.query(q)).rows
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`)
 for(const file of ['202610110001_command_center.sql','202610110002_business_profiles.sql','202610110003_message_types.sql','20261015185939_chat_first_ai_replies.sql','20261015191432_ai_service_membership_read.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'))
 await db.exec('create table cc_bi_profiles(business_id uuid,workspace_id uuid,crm jsonb);grant select on cc_bi_profiles to service_role,authenticated');
 for(const file of ['20261015063729_email_send_approvals.sql','20261015204341_hunter_business_discovery.sql'])await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 await db.exec(`grant select on cc_businesses,cc_listings to service_role;insert into auth.users values('${u}'),('${v}');insert into cc_members(workspace_id,user_id,display_name,role) values('${w}','${u}','Michelle','owner'),('${w}','${v}','Tim','editor');insert into cc_ai_threads(id,title,participants,created_by) values('${t}','Research',array['Hunter'],'${u}');select set_config('request.jwt.claim.sub','${u}',false);set role authenticated;insert into cc_ai_messages(id,thread_id,body) values('${m}','${t}','Research five new Colorado artists and create draft profiles.');`)
 await assert.rejects(()=>rows(`select cc_begin_discovery('${m}','${u}')`),/permission denied/)
 await assert.rejects(()=>rows(`insert into cc_discovery_runs(message_id,workspace_id,requested_by) values('${m}','${w}','${u}')`),/permission denied/)
 await db.exec('reset role;set role service_role')
 await assert.rejects(()=>rows(`select cc_begin_discovery('${m}','${u}')`),/active Hunter/)
 await rows(`select cc_claim_ai_reply('${m}','${u}','Hunter')`)
 const run=(await rows(`select cc_begin_discovery('${m}','${u}') as r`))[0].r
 assert.equal(run.existing,false);assert.equal((await rows(`select cc_begin_discovery('${m}','${u}') as r`))[0].r.existing,true)
 const profiles=[{name:'New Longmont Maker',city:'Longmont',website:'https://maker.example/',email:'',phone:'',address:'',description:'A local maker.',reason:'Independent studio.',sources:['https://maker.example/about'],uncertainties:['Contact details not confirmed.']},{name:'New Longmont Maker',city:'Boulder',website:'',description:'Duplicate name.',sources:['https://maker.example/about']},{name:'New Boulder Artist',city:'Boulder',website:'https://artist.example/',description:'A local artist.',sources:['https://artist.example/about']}]
 const save=()=>db.query('select cc_save_discovery($1,$2,$3,$4) as r',[run.id,JSON.stringify(profiles),'[]','{"input_tokens":100}'])
 const result=(await save()).rows[0].r;assert.equal(result.created.length,2);assert.equal(result.skipped.length,1);assert.equal(result.published,false)
 assert.deepEqual((await rows('select site,status from cc_listings order by site')).map(x=>[x.site,x.status]),[['Loving Longmont','Draft'],['MKT Colorado','Draft']])
 await db.exec('reset role;set role authenticated');
 await assert.rejects(()=>rows("update cc_listings set status='Published'"),/must review/);
 assert.match((await rows("select cc_email_send_block((select id from cc_businesses limit 1),'custom','contact@example.com') as reason"))[0].reason,/must review/);
 await db.exec('reset role;set role service_role');
 const businesses=await rows('select notes,created_by from cc_businesses');assert.ok(businesses.every(b=>b.created_by===u&&JSON.parse(b.notes).discovery.status==='Pending review'))
 assert.equal((await save()).rows[0].r.created.length,2);assert.equal((await rows('select count(*)::int as n from cc_businesses'))[0].n,2)
 await db.exec('reset role');assert.ok((await rows("select actor_id from cc_audit_log where table_name='cc_businesses'")).every(x=>x.actor_id===u))
 await db.exec(`update cc_discovery_runs set reserved_usd=8.46;update cc_ai_reply_runs set status='Failed';set role service_role`)
 await assert.rejects(()=>rows(`select cc_claim_ai_reply('${m}','${u}','Hunter')`),/Monthly chat safety budget/)
 await db.exec(`reset role;update cc_members set enabled=false where user_id='${u}';set role service_role`)
 await assert.rejects(()=>rows(`select cc_begin_discovery('${m}','${u}')`),/Partner editing/)
 }finally{await db.close()}
})
