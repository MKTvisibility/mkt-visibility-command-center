import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import {transformWithOxc} from 'vite'
import {normalizeResearch,suggestionsFor,visibilityRun} from '../supabase/functions/research-business/research.mjs'
const business={id:'815a9d3a-a929-546d-9720-e461f9d3c05c',name:"A Pet's Place Animal Hospital",website:'https://apetsplacelongmont.com/'}
async function worker({role='owner',key='test-key',existing=false,found=true}={}){
 const writes=[],pending=[],requests=[];let handler;
 const fetch=async(input,options={})=>{
  const url=String(input);requests.push({url,options});const data=options.body?JSON.parse(options.body):undefined;
  const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
  if(url.endsWith('/auth/v1/user'))return json({id:'test-user'});
  if(url.includes('/cc_members?'))return json([{role}]);
  if(url.includes('/cc_businesses?'))return json(found?[business]:[]);
  if(url.includes('/cc_bi_jobs?')&&options.method==='GET')return json(existing?[{id:'old-job',business_id:business.id,status:'Running'}]:[]);
  if(url.endsWith('/cc_bi_jobs')){writes.push({table:'jobs',data});return json([{id:'new-job',...data}])}
  if(url.includes('api.openai.com')){
   assert.equal(data.input.includes(business.id),true);assert.equal(data.input.includes(business.name),true)
   return json({status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url:business.website}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({assessment:{business_id:business.id,fields:{name:{value:business.name,source:business.website}},platforms:{Website:{state:'Rated',score:4,explanation:'Clear service information',evidence:[{url:business.website}]}},summary:'Animal care services are clearly described.'},limitations:[]})}]}]});
  }
  if(url.includes('/rest/v1/')){writes.push({table:url.split('/rest/v1/')[1],data});return json([])}
  throw Error('Unexpected request '+url);
 };
 const code=(await transformWithOxc(readFileSync('supabase/functions/research-business/index.ts','utf8').replace(/^import .*\n/,''),'index.ts')).code;
 vm.runInNewContext(code,{Deno:{env:{get:k=>({SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'anon',OPENAI_API_KEY:key})[k]},serve:fn=>{handler=fn}},EdgeRuntime:{waitUntil:p=>pending.push(p)},fetch,Response,AbortSignal,console,normalizeResearch,suggestionsFor,visibilityRun});
 const call=async(body,auth=true)=>handler(new Request('https://test.supabase.co/functions/v1/research-business',{method:'POST',headers:{...(auth?{Authorization:'Bearer session'}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)}));
 return {call,writes,pending,requests};
}
test('profile research authenticates, requires editor access, and reports missing credentials without creating jobs',async()=>{
 const owner=await worker({key:''});assert.equal((await owner.call({action:'run',business_id:business.id},false)).status,401);
 const missing=await owner.call({action:'run',business_id:business.id});assert.equal(missing.status,503);assert.match((await missing.json()).error,/OPENAI_API_KEY/);assert.equal(owner.writes.length,0);
 const viewer=await worker({role:'viewer'});assert.equal((await viewer.call({action:'run',business_id:business.id})).status,403);assert.equal(viewer.writes.length,0);
 const stranger=await worker({found:false});assert.equal((await stranger.call({action:'run',business_id:business.id})).status,404);
})
test('one profile click launches actual web research in the background and saves a matching report',async()=>{
 const w=await worker();const r=await w.call({action:'run',business_id:business.id});assert.equal(r.status,202);assert.equal((await r.json()).business_id,business.id);assert.equal(w.pending.length,1);
 await Promise.all(w.pending);
 assert.equal(w.requests.filter(x=>x.url.includes('api.openai.com')).length,1);
 const saved=w.writes.find(x=>x.table==='cc_visibility_research_runs').data;
 assert.equal(saved.business_id,business.id);assert.equal(saved.research.business,business.name);assert.equal(saved.research.job_id,'new-job');assert.equal(saved.research.assessment.platforms.Website.score,4);
 assert.equal(w.writes.some(x=>x.table==='cc_bi_profiles'),false);
 assert.equal(w.writes.some(x=>/email|publish/.test(x.table)),false);
 assert.equal(w.writes.at(-1).data.status,'Awaiting Review');
})
test('repeated clicks reuse an active job rather than buying duplicate research',async()=>{
 const w=await worker({existing:true});const r=await w.call({action:'run',business_id:business.id});assert.equal((await r.json()).job_id,'old-job');assert.equal(w.pending.length,0);assert.equal(w.writes.length,0);
})
