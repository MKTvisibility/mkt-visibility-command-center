import test from 'node:test'
import assert from 'node:assert/strict'
test('business traffic reports require a verified signed-in workspace member and use the caller RLS context',async()=>{
 const previousFetch=globalThis.fetch,previousDeno=globalThis.Deno;let handler,role='editor',calls=[]
 globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'PUBLIC'})[name]},serve:fn=>{handler=fn}}
 globalThis.fetch=async(url,options={})=>{calls.push({url,options});if(url.includes('/auth/v1/user'))return Response.json({id:'approved-user'});if(url.includes('cc_members?'))return Response.json(role==='revoked'?[]:[{role}]);if(url.includes('cc_ll_live_publications?'))return Response.json([]);throw Error('Unexpected private read')}
 try{
  await import('../supabase/functions/business-traffic-report/index.ts')
  const request=auth=>new Request('https://edge.test',{method:'POST',headers:{origin:'https://mktvisibility.github.io',...(auth?{Authorization:'Bearer USER_SESSION'}:{})},body:JSON.stringify({businessId:'55555555-5555-4555-8555-555555555555'})})
  assert.equal((await handler(request(false))).status,401);assert.equal(calls.length,0)
  role='revoked';assert.equal((await handler(request(true))).status,403);assert.ok(!calls.some(c=>c.url.includes('cc_ll_live_publications')))
  role='viewer';calls=[];assert.equal((await handler(request(true))).status,404)
  assert.ok(calls.every(c=>c.options.headers.Authorization==='Bearer USER_SESSION'))
  assert.ok(!calls.some(c=>c.url.includes('analyticsdata.googleapis.com')))
 }finally{globalThis.fetch=previousFetch;if(previousDeno===undefined)delete globalThis.Deno;else globalThis.Deno=previousDeno}
})
