import test from 'node:test'
import assert from 'node:assert/strict'
const id='55555555-5555-4555-8555-555555555555'
test('named-page publishing uses approved records, protects existing pages and reports missing credentials',async()=>{
 const originalFetch=globalThis.fetch,originalDeno=globalThis.Deno;let handler,mode='success',writes=[]
 const env={SUPABASE_URL:'https://db.example',SUPABASE_ANON_KEY:'public-key',CO_GITHUB_TOKEN:'server-only-token'}
 globalThis.Deno={env:{get:k=>env[k]},serve:fn=>{handler=fn}}
 globalThis.fetch=async(url,options={})=>{
  if(url.includes('/auth/v1/user'))return Response.json({id:'editor'})
  if(url.includes('/rest/v1/cc_members'))return Response.json([{role:mode==='viewer'?'viewer':'editor'}])
  if(url.includes('/rest/v1/cc_ll_live_publications'))return Response.json([{business_id:id,route:'business-'+id+'.html',public_content:{name:'Recovery Café Longmont'},sites:['Loving Longmont'],active:true}])
  if(url.includes('/rest/v1/cc_businesses'))return Response.json([{notes:JSON.stringify({pageFilename:'recovery-cafe-longmont.html',internal:'NEVER PUBLIC'})}])
  if(url.includes('/contents/')&&options.method==='PUT'){writes.push({url,body:JSON.parse(options.body)});return Response.json({commit:{sha:'commit'}})}
  if(url.includes('/contents/business.html'))return Response.json({content:Buffer.from('<title>Local Business</title><main data-ll-profile=""></main>').toString('base64')})
  if(url.includes('/contents/recovery-cafe-longmont.html')&&mode==='collision')return Response.json({sha:'existing',content:Buffer.from('<main>Another business</main>').toString('base64')})
  return new Response('',{status:404})
 }
 try{
  await import('../supabase/functions/publish-business-page/index.ts')
  const request=(auth=true)=>new Request('https://function.example',{method:'POST',headers:{origin:'https://mktvisibility.github.io',...(auth?{authorization:'Bearer valid-session'}:{})},body:JSON.stringify({businessId:id})})
  assert.equal((await handler(request(false))).status,401)
  mode='viewer';assert.equal((await handler(request())).status,403);assert.equal(writes.length,0)
  mode='collision';const collision=await (await handler(request())).json();assert.equal(collision.results[0].success,false);assert.match(collision.results[0].error,/already belongs/);assert.equal(writes.length,0)
  mode='success';const success=await (await handler(request())).json();assert.equal(success.results[0].success,true);assert.ok(success.results[0].url.startsWith('https://mktvisibility.github.io/LovingLongmont/'));assert.ok(writes.every(w=>w.url.includes('/MKTvisibility/LovingLongmont/')));assert.equal(success.results[0].deploymentPending,true);assert.equal(success.results[0].url,'https://mktvisibility.github.io/LovingLongmont/recovery-cafe-longmont.html');assert.equal(writes.length,2)
  const html=Buffer.from(writes[0].body.content,'base64').toString();assert.match(html,new RegExp('data-ll-profile="'+id+'"'));assert.match(html,/Recovery Café Longmont/);assert.ok(!html.includes('NEVER PUBLIC'))
  assert.equal(JSON.parse(Buffer.from(writes[1].body.content,'base64').toString())[id],'recovery-cafe-longmont.html')
  delete env.CO_GITHUB_TOKEN;writes=[];const unavailable=await (await handler(request())).json();assert.equal(unavailable.results[0].success,false);assert.match(unavailable.results[0].error,/secure GitHub/);assert.equal(writes.length,0)
 }finally{globalThis.fetch=originalFetch;if(originalDeno===undefined)delete globalThis.Deno;else globalThis.Deno=originalDeno}
})
