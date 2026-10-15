import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const w='c8748032-cdd3-443b-8c56-2e846cc9bf31',u='22222222-2222-4222-8222-222222222222',v='33333333-3333-4333-8333-333333333333',t='44444444-4444-4444-8444-444444444444',m='55555555-5555-4555-8555-555555555555'
test('chat protects agent identity, claims each message once, saves replies atomically, and enforces server-only usage limits',async()=>{
 const db=new PGlite();const rows=async sql=>(await db.query(sql)).rows
 try{await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated,anon,service_role;`)
 await db.exec(readFileSync('supabase/migrations/202610110001_command_center.sql','utf8'))
 await db.exec(readFileSync('supabase/migrations/20261015185939_chat_first_ai_replies.sql','utf8'))
 await db.exec(`insert into auth.users values('${u}'),('${v}');insert into cc_members(workspace_id,user_id,display_name,role) values('${w}','${u}','Michelle','owner'),('${w}','${v}','Other user','viewer');insert into cc_ai_threads(id,title,participants,created_by) values('${t}','Client drafts',array['Nova','Willow'],'${u}');select set_config('request.jwt.claim.sub','${u}',false);set role authenticated;insert into cc_ai_messages(id,thread_id,body) values('${m}','${t}','Draft a follow-up');`)
 await assert.rejects(()=>db.exec(`insert into cc_ai_messages(thread_id,body,author_type,agent) values('${t}','Fake response','agent','Nova')`),/row-level security/)
 await assert.rejects(()=>rows(`select cc_claim_ai_reply('${m}','${u}','Nova')`),/permission denied/)
 await db.exec('reset role');await db.exec('grant select on cc_members to service_role');await db.exec('set role service_role')
 let claim=(await rows(`select cc_claim_ai_reply('${m}','${u}','Nova') as c`))[0].c;assert.equal(claim.status,'Working')
 await assert.rejects(()=>rows(`select cc_claim_ai_reply('${m}','${u}','Nova')`),/already being processed/)
 const reply=(await rows(`select cc_finish_ai_reply('${m}','${claim.lease}','A useful draft','{"input_tokens":100}') as r`))[0].r;assert.equal(reply.agent,'Nova')
 const again=(await rows(`select cc_finish_ai_reply('${m}','${claim.lease}','Duplicate','{}') as r`))[0].r;assert.equal(again.id,reply.id)
 claim=(await rows(`select cc_claim_ai_reply('${m}','${u}','Nova') as c`))[0].c;assert.equal(claim.status,'Completed');assert.equal((await rows("select count(*)::int as n from cc_ai_messages where author_type='agent'"))[0].n,1)
 await assert.rejects(()=>rows(`select cc_claim_ai_reply('${m}','${v}','Nova')`),/Saved message/)
 await db.exec('reset role');await db.exec(`insert into cc_ai_messages(id,thread_id,body,author_id) values('66666666-6666-4666-8666-666666666666','${t}','Another draft','${u}');update cc_ai_reply_runs set reserved_usd=8.50;set role service_role;`)
 await assert.rejects(()=>rows(`select cc_claim_ai_reply('66666666-6666-4666-8666-666666666666','${u}','Willow')`),/Monthly chat safety budget/)
 }finally{await db.close()}
})
