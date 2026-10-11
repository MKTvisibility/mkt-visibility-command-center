import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const workspace='c8748032-cdd3-443b-8c56-2e846cc9bf31'
const otherWorkspace='11111111-1111-4111-8111-111111111111'
const editor='22222222-2222-4222-8222-222222222222'
const viewer='33333333-3333-4333-8333-333333333333'
const stranger='44444444-4444-4444-8444-444444444444'
const business='55555555-5555-4555-8555-555555555555'

test('real PostgreSQL migration and RLS exercise approved, anonymous, revoked and viewer access',async t=>{
 const db=new PGlite()
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`)
 const migration=readFileSync(new URL('../supabase/migrations/202610110001_command_center.sql',import.meta.url),'utf8')
 await db.exec(migration)
 await db.exec(readFileSync(new URL('../supabase/migrations/202610110002_business_profiles.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../supabase/migrations/202610110003_message_types.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../supabase/migrations/202610110004_restrict_event_trigger.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../supabase/migrations/202610110005_internal_notes.sql',import.meta.url),'utf8'))
 await db.exec(`insert into auth.users values('${editor}'),('${viewer}'),('${stranger}'); insert into public.cc_workspaces values('${otherWorkspace}','Other workspace'); insert into public.cc_members(workspace_id,user_id,display_name,role) values ('${workspace}','${editor}','Editor','editor'),('${workspace}','${viewer}','Viewer','viewer');`)
 await db.exec(readFileSync(new URL('../supabase/migrations/202610110006_performance_statistics.sql',import.meta.url),'utf8'))
 await db.exec(readFileSync(new URL('../supabase/migrations/202610110007_tracking_setup.sql',import.meta.url),'utf8'))
 const asUser=async(user,role='authenticated')=>{await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false); set role ${role};`)}
 const rows=async(query)=> (await db.query(query)).rows
 await t.test('all ten application tables have row-level security',async()=>{
  const result=await rows("select relname from pg_class where relname like 'cc_%' and relkind='r' and relrowsecurity")
  assert.equal(result.length,10)
 })
 await t.test('tracking setup is audited, unique per brand and protected from viewer changes',async()=>{
  await asUser(editor)
  const sql="insert into cc_tracking_setup(brand,measurement_id,installed_at,source_url) values('MKT Visibility','G-TEST123','2026-10-11T05:53:20Z','https://github.com/example/run')"
  await db.exec(sql)
  await assert.rejects(()=>db.exec(sql),/unique/)
  await asUser(viewer)
  assert.equal((await rows('select * from cc_tracking_setup')).length,1)
  await assert.rejects(()=>db.exec(sql),/row-level security/)
  await db.exec("update cc_tracking_setup set measurement_id='G-BLOCKED'")
  assert.equal((await rows('select measurement_id from cc_tracking_setup'))[0].measurement_id,'G-TEST123')
  await asUser('', 'anon')
  await assert.rejects(()=>db.exec('select * from cc_tracking_setup'),/permission denied/)
 })
 await t.test('approved editor can create, read, update and trigger an immutable audit entry',async()=>{
  await asUser(editor)
  await db.exec(`insert into cc_businesses(id,name,monthly_fee,created_by) values('${business}','Sample business',100,'${stranger}');`)
  assert.equal((await rows('select created_by from cc_businesses'))[0].created_by,editor)
  await db.exec(`update cc_businesses set monthly_fee=200 where id='${business}'`)
  assert.equal(Number((await rows('select monthly_fee from cc_businesses'))[0].monthly_fee),200)
  const audit=await rows("select actor_id,action,changed_fields from cc_audit_log where table_name='cc_businesses' order by id")
  assert.equal(audit.length,2);assert.equal(audit[0].actor_id,editor);assert.equal(audit[1].action,'UPDATE');assert.ok(audit[1].changed_fields.includes('monthly_fee'))
 })
 await t.test('read-only viewer can read but cannot insert or update',async()=>{
  await asUser(viewer)
  assert.equal((await rows('select * from cc_businesses')).length,1)
  await assert.rejects(()=>db.exec("insert into cc_businesses(name) values('Blocked')"),/row-level security/)
  await db.exec("update cc_businesses set name='Blocked'")
  assert.equal((await rows('select name from cc_businesses'))[0].name,'Sample business')
 })
 await t.test('unapproved user cannot read or write records, audit log or workspace',async()=>{
  await asUser(stranger)
  for(const table of ['cc_businesses','cc_listings','cc_emails','cc_tasks','cc_purchases','cc_statistics','cc_tracking_setup','cc_audit_log','cc_workspaces','cc_members'])assert.equal((await rows(`select * from ${table}`)).length,0)
  await assert.rejects(()=>db.exec("insert into cc_businesses(name) values('Blocked')"),/row-level security/)
 })
 await t.test('anonymous callers have no table or access-function privileges',async()=>{
  await asUser('', 'anon')
  await assert.rejects(()=>db.exec('select * from cc_businesses'),/permission denied/)
  await assert.rejects(()=>db.exec(`select cc_has_access('${workspace}')`),/permission denied/)
 })
 await t.test('editor cannot self-promote, delete records or mutate audit entries',async()=>{
  await asUser(editor)
  await assert.rejects(()=>db.exec("update cc_members set role='owner'"),/permission denied/)
  await assert.rejects(()=>db.exec('delete from cc_businesses'),/permission denied/)
  await assert.rejects(()=>db.exec('delete from cc_audit_log'),/permission denied/)
  await assert.rejects(()=>db.exec(`insert into cc_audit_log(workspace_id,record_id,table_name,action) values('${workspace}','${business}','fake','INSERT')`),/permission denied/)
 })
 await t.test('workspace boundaries and immutable record identity block cross-workspace writes',async()=>{
  await asUser(editor)
  await assert.rejects(()=>db.exec(`insert into cc_businesses(workspace_id,name) values('${otherWorkspace}','Blocked')`),/row-level security/)
  await assert.rejects(()=>db.exec(`update cc_businesses set workspace_id='${otherWorkspace}' where id='${business}'`),/identity and provenance/)
  await assert.rejects(()=>db.exec(`update cc_businesses set created_by='${stranger}' where id='${business}'`),/identity and provenance/)
 })
 await t.test('linked records, valid follow-ups and email records can be created',async()=>{
  await asUser(editor)
  await db.exec(`insert into cc_listings(business_id,site,title,pages) values('${business}','Loving Longmont','Sample listing',array['Arts','Local Businesses']); insert into cc_tasks(business_id,title,type,due_date) values('${business}','Follow up','Follow-up','2026-10-11'); insert into cc_emails(business_id,recipient,subject,status,occurred_on) values('${business}','test@example.com','Sample email','Sent','2026-10-11');`)
  for(const table of ['cc_listings','cc_tasks','cc_emails'])assert.equal((await rows(`select * from ${table}`)).length,1)
 })
 await t.test('database constraints reject negative fees, unsafe links, missing dates and invalid relationships',async()=>{
  await asUser(editor)
  await assert.rejects(()=>db.exec("insert into cc_businesses(name,monthly_fee) values('Bad',-1)"),/check constraint/)
  await assert.rejects(()=>db.exec("insert into cc_businesses(name,website) values('Bad','javascript:alert(1)')"),/check constraint/)
  await assert.rejects(()=>db.exec("insert into cc_tasks(title,type) values('Bad','Follow-up')"),/check constraint/)
  await assert.rejects(()=>db.exec("insert into cc_emails(recipient,subject,status) values('test@example.com','Bad','Sent')"),/check constraint/)
  await assert.rejects(()=>db.exec(`insert into cc_listings(business_id,site,title) values('${stranger}','MKT Colorado','Bad')`),/foreign key constraint/)
 })
 await t.test('profile fields, purchases and message deduplication preserve workspace boundaries',async()=>{
  await asUser(editor)
  await db.exec(`update cc_businesses set internal_notes='Team notes only',description='Website description',categories=array['Restaurants','Pizza'],social_urls=array['https://instagram.com/example'] where id='${business}'; insert into cc_purchases(business_id,product,purchased_on,amount,status) values('${business}','Listing upgrade','2026-10-10',50,'Paid'); insert into cc_emails(business_id,related_business_ids,source_message_id,recipient,subject,status,occurred_on) values('${business}',array['${business}']::uuid[],'unique-message','test@example.com','Source message','Sent','2026-10-10');`)
  await assert.rejects(()=>db.exec(`insert into cc_emails(source_message_id,recipient,subject) values('unique-message','test@example.com','Duplicate')`),/unique constraint/)
  await assert.rejects(()=>db.exec(`insert into cc_emails(related_business_ids,recipient,subject) values(array['${stranger}']::uuid[],'test@example.com','Invalid link')`),/Related businesses/)
  await asUser(viewer)
  assert.equal((await rows('select * from cc_purchases')).length,1)
  assert.equal((await rows('select internal_notes from cc_businesses'))[0].internal_notes,'Team notes only')
  await db.exec("update cc_businesses set internal_notes='Blocked'")
  assert.equal((await rows('select internal_notes from cc_businesses'))[0].internal_notes,'Team notes only')
  await assert.rejects(()=>db.exec(`insert into cc_purchases(business_id,product,purchased_on) values('${business}','Blocked','2026-10-10')`),/row-level security/)
 })
 await t.test('statistics require approved editors, reject duplicates and preserve viewer read-only access',async()=>{
  await asUser(editor)
  const insert="insert into cc_statistics(brand,channel,metric,period_start,period_end,value,source) values('MKT Visibility','Website','Visitors','2026-10-01','2026-10-09',0,'Manual report')"
  await db.exec(insert)
  await assert.rejects(()=>db.exec(insert),/unique constraint/)
  await assert.rejects(()=>db.exec(insert.replace(",0,'Manual report'",",-1,'Manual report'")),/check constraint/)
  await asUser(viewer)
  assert.equal(Number((await rows('select value from cc_statistics'))[0].value),0)
  await db.exec('update cc_statistics set value=999')
  assert.equal(Number((await rows('select value from cc_statistics'))[0].value),0)
  await assert.rejects(()=>db.exec(insert),/row-level security/)
  await asUser(stranger)
  assert.equal((await rows('select * from cc_statistics')).length,0)
 })
 await t.test('revoking membership blocks subsequent reads and writes',async()=>{
  await db.exec(`reset role; update cc_members set enabled=false where user_id='${editor}';`)
  await asUser(editor)
  assert.equal((await rows('select * from cc_businesses')).length,0)
  await assert.rejects(()=>db.exec("insert into cc_businesses(name) values('Blocked')"),/row-level security/)
 })
 await t.test('running the initial migration twice stops without overwriting data',async()=>{
  await db.exec('reset role')
  await assert.rejects(()=>db.exec(migration),/already exist/)
  await db.exec('rollback')
  assert.equal((await rows('select * from cc_businesses')).length,1)
 })
 await db.close()
})
