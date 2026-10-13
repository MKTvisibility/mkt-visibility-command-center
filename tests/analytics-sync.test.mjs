import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
import {generateKeyPairSync,verify} from 'node:crypto'
import {dateRange,values,collect,accessToken,PROPERTIES} from '../supabase/functions/sync-google-analytics/core.mjs'
const headers=['activeUsers','screenPageViews','sessions'].map(name=>({name}))
const total={metricHeaders:headers,rowCount:1,rows:[{metricValues:[17,267,38].map(value=>({value:String(value)}))}],metadata:{timeZone:'America/Denver'}}
test('service account signs a short-lived read-only assertion and uses only the official token endpoint',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048})
 const credentials={type:'service_account',client_email:'reporter@test-project.iam.gserviceaccount.com',private_key:privateKey.export({type:'pkcs8',format:'pem'}),token_uri:'https://malicious.example'}
 let calls=0
 const token=await accessToken(credentials,async(url,options)=>{
  calls++;assert.equal(url,'https://oauth2.googleapis.com/token')
  const jwt=options.body.get('assertion').split('.')
  const claims=JSON.parse(Buffer.from(jwt[1],'base64url'))
  assert.equal(claims.scope,'https://www.googleapis.com/auth/analytics.readonly')
  assert.equal(claims.exp-claims.iat,3600)
  assert.equal(claims.iss,credentials.client_email)
  assert.ok(verify('RSA-SHA256',Buffer.from(jwt.slice(0,2).join('.')),publicKey,Buffer.from(jwt[2],'base64url')))
  return Response.json({access_token:'TEST_TOKEN'})
 })
 assert.equal(token,'TEST_TOKEN');assert.equal(calls,1)
 await assert.rejects(()=>accessToken({...credentials,type:'authorized_user'}),/Invalid/)
})
test('property mapping and dates respect Mountain midnight, DST and year boundaries',()=>{
 assert.equal(Object.keys(PROPERTIES).length,5)
 assert.deepEqual(dateRange(new Date('2026-10-13T05:30:00Z')),{start:'2026-10-05',end:'2026-10-11',timezone:'America/Denver'})
 assert.equal(dateRange(new Date('2026-01-01T17:00:00Z')).start,'2025-12-25')
 assert.equal(dateRange(new Date('2026-11-02T06:30:00Z')).end,'2026-10-31')
})
test('missing, malformed or partial responses never become false zero traffic',()=>{
 assert.deepEqual(values(total),[17,267,38])
 assert.deepEqual(values({metricHeaders:headers,rowCount:0}),[0,0,0])
 assert.throws(()=>values({}),/Invalid/)
 assert.throws(()=>values({metricHeaders:headers,rowCount:1}),/Incomplete/)
 assert.throws(()=>values({...total,rows:[{metricValues:[{value:'NaN'}]}]}),/Invalid/)
})
test('import produces seven daily reports and an independent seven-day active-user total',async()=>{
 const calls=[]
 const fetcher=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body})
  assert.equal(options.headers.Authorization,'Bearer TEST_TOKEN')
  if(!body.dimensions)return Response.json(total)
  if(body.dimensions[0].name==='date')return Response.json({dimensionHeaders:[{name:'date'}],metricHeaders:headers,rowCount:2,rows:[{dimensionValues:[{value:'20261011'}],metricValues:[12,200,30].map(value=>({value:String(value)}))},{dimensionValues:[{value:'20261012'}],metricValues:[10,67,8].map(value=>({value:String(value)}))}]})
  return Response.json({metricHeaders:[{name:'activeUsers'}],rows:[{dimensionValues:[{value:'source'},{value:'medium'}],metricValues:[{value:'2'}]}]})
 }
 const report=await collect('Loving Longmont','TEST_TOKEN',fetcher,new Date('2026-10-13T17:00:00Z'))
 assert.equal(report.records.length,24)
 assert.equal(report.records[0].value,17) // NOT 12+10 daily users
 assert.equal(report.records.filter(r=>r.metric==='Visitors'&&r.period_start===r.period_end).reduce((n,r)=>n+r.value,0),22)
 assert.deepEqual(report.range,{start:'2026-10-06',end:'2026-10-12',timezone:'America/Denver'})
 assert.ok(report.records.every(r=>r.automated&&r.source==='Google Analytics'))
 assert.equal(calls.length,4)
 assert.ok(calls.every(c=>c.url.includes('properties/558375784:runReport')))
 assert.equal(report.sources[0].activeUsers,2)
 await assert.rejects(()=>collect('unknown','token',fetcher),/Unknown/)
 await assert.rejects(()=>collect('MKT Colorado','token',async()=>new Response('',{status:403})),/Viewer access/)
})
test('backend rejects anonymous, revoked and viewer refreshes; scheduler secrets are not exposed',async()=>{
 const previousFetch=globalThis.fetch,previousDeno=globalThis.Deno
 let handler,role='editor',configured=false;const calls=[]
 globalThis.Deno={serve:fn=>{handler=fn},env:{get:name=>({SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'SERVICE',SUPABASE_ANON_KEY:'ANON',GA_SERVICE_ACCOUNT_JSON:configured?'{}':undefined})[name]}}
 globalThis.fetch=async(url,options)=>{
  calls.push(url)
  if(url.endsWith('/auth/v1/user'))return Response.json({id:'user'})
  if(url.includes('cc_members?'))return Response.json(role==='revoked'?[]:[{role}])
  if(url.endsWith('/cc_ga_cron_token'))return Response.json('SCHEDULER_SECRET')
  if(url.endsWith('/cc_ga_claim'))return Response.json('11111111-1111-4111-8111-111111111111')
  if(url.includes('cc_ga_sync_state?'))return Response.json([{brand:'Loving Longmont',status:'needs_setup'}])
  if(url.includes('/rpc/'))return new Response(null,{status:204})
  throw Error('Unexpected request')
 }
 const request=(action,extra={})=>new Request('https://edge.test',{method:'POST',headers:{Authorization:'Bearer USER',origin:'https://mktvisibility.github.io',...extra},body:JSON.stringify({action})})
 try{
  await import('../supabase/functions/sync-google-analytics/index.ts')
  assert.equal((await handler(new Request('https://edge.test',{method:'POST'}))).status,401)
  role='viewer';assert.equal((await handler(request('refresh'))).status,403)
  role='revoked';assert.equal((await handler(request('status'))).status,403)
  role='editor';const response=await handler(request('status'));assert.equal(response.status,200);assert.ok(!(await response.text()).includes('SCHEDULER_SECRET'))
  assert.equal((await handler(request('refresh',{'x-cc-ga-token':'WRONG'}))).status,401)
  calls.length=0;const missing=await handler(request('refresh'));assert.equal(missing.status,503);assert.ok(!calls.some(c=>c.endsWith('cc_ga_store')))
 }finally{globalThis.fetch=previousFetch;if(previousDeno===undefined)delete globalThis.Deno;else globalThis.Deno=previousDeno}
})
test('database imports are atomic, deduplicate reporting periods, preserve provenance and enforce access',async()=>{
 const db=new PGlite();const workspace='c8748032-cdd3-443b-8c56-2e846cc9bf31',editor='22222222-2222-4222-8222-222222222222'
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated,anon,service_role;grant execute on all functions in schema auth to authenticated,anon,service_role;`)
  await db.exec(readFileSync(new URL('../supabase/migrations/202610110001_command_center.sql',import.meta.url),'utf8'))
  await db.exec(readFileSync(new URL('../supabase/migrations/202610110006_performance_statistics.sql',import.meta.url),'utf8'))
  // pg_cron/pg_net/Vault are hosted extensions. Exercise the actual application SQL with Vault's documented interface stubbed locally.
  await db.exec(`create schema vault;create table vault.secrets(name text);create view vault.decrypted_secrets as select name,'secret'::text as decrypted_secret from vault.secrets;create function vault.create_secret(text,text,text) returns uuid language plpgsql as $$begin insert into vault.secrets values($2);return gen_random_uuid();end$$;`)
  let sql=readdirSync(new URL('../supabase/migrations/',import.meta.url)).filter(name=>name.includes('_google_analytics_sync_')).sort().map(name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')).join('\n').replace(/create extension if not exists (pg_cron|pg_net);/g,'').replace(/select cron\.schedule\([\s\S]*?\$job\$\);/,'')
  await db.exec(sql)
  await db.exec(`insert into auth.users values('${editor}');insert into cc_members(workspace_id,user_id,display_name,role) values('${workspace}','${editor}','Editor','editor');select set_config('request.jwt.claim.sub','${editor}',false);set role authenticated;`)
  assert.equal((await db.query('select count(*) from cc_ga_sync_state')).rows[0].count,5)
  await assert.rejects(()=>db.exec('select cc_ga_claim()'),/permission denied/)
  await assert.rejects(()=>db.exec('select cc_ga_cron_token()'),/permission denied/)
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);set role service_role;`)
  const lease=(await db.query('select cc_ga_claim() lease')).rows[0].lease;assert.ok(lease);assert.equal((await db.query('select cc_ga_claim() lease')).rows[0].lease,null)
  const records=Array.from({length:8},(_,i)=>['Visitors','Page views','Sessions'].map(metric=>({brand:'Loving Longmont',channel:'Website',source:'Google Analytics',metric,period_start:i===0?'2026-10-06':`2026-10-${String(5+i).padStart(2,'0')}`,period_end:i===0?'2026-10-12':`2026-10-${String(5+i).padStart(2,'0')}`,value:5,source_url:'https://analytics.google.com/',notes:'API report'}))).flat()
  const report={brand:'Loving Longmont',property:'558375784',records,range:{start:'2026-10-06',end:'2026-10-12'},sources:[],locations:[]}
  await db.query('select cc_ga_store($1::jsonb)',[JSON.stringify(report)]);await db.query('select cc_ga_store($1::jsonb)',[JSON.stringify(report)])
  assert.equal((await db.query('select count(*) from cc_statistics')).rows[0].count,24)
  report.records[23].value=-1;await assert.rejects(()=>db.query('select cc_ga_store($1::jsonb)',[JSON.stringify(report)]),/check constraint/)
  assert.equal((await db.query('select min(value) v from cc_statistics')).rows[0].v,'5.00')
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','${editor}',false);set role authenticated;update cc_statistics set value=99;`)
  assert.equal((await db.query('select min(value) v from cc_statistics')).rows[0].v,'5.00')
  await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);set role authenticated;`)
  assert.equal((await db.query('select count(*) from cc_ga_sync_state')).rows[0].count,0)
 }finally{await db.close()}
})
