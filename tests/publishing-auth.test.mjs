import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {transformWithOxc} from 'vite'
test('publication service validates Auth and membership before any GitHub access',async()=>{
 const dir=mkdtempSync('/tmp/cc-publish-');const oldFetch=globalThis.fetch,oldDeno=globalThis.Deno
 let calls=[];let role='viewer'
 globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://example.supabase.co':key==='SUPABASE_ANON_KEY'?'public-test-key':''},serve:()=>{}}
 globalThis.fetch=async(url)=>{calls.push(url);if(String(url).includes('/auth/v1/user'))return new Response(JSON.stringify({id:'user'}),{status:200});if(String(url).includes('/cc_members?'))return new Response(JSON.stringify([{role,display_name:'Test'}]),{status:200});throw Error('Unexpected external access')}
 try{
  const raw=readFileSync('supabase/functions/publish-listing/index.ts','utf8').replace("from './core.mjs'",`from '${pathToFileURL(join(process.cwd(),'supabase/functions/publish-listing/core.mjs')).href}'`)
  const transformed=await transformWithOxc(raw,'index.ts');const file=join(dir,'handler.mjs');writeFileSync(file,transformed.code);const {handle}=await import(pathToFileURL(file).href)
  const request=(body,auth=true,origin='https://mktvisibility.github.io')=>new Request('https://example.test',{method:'POST',headers:{Origin:origin,...auth?{Authorization:'Bearer test-session'}:{},'Content-Type':'application/json'},body:JSON.stringify(body)})
  assert.equal((await handle(request({action:'publish'},false))).status,401);assert.equal(calls.length,0)
  assert.equal((await handle(request({action:'publish'},true,'https://evil.test'))).status,403);assert.equal(calls.length,0)
  assert.equal((await handle(request({action:'publish'}))).status,403);assert.equal(calls.length,2)
  role='owner';const status=await handle(request({action:'status'}));assert.equal(status.status,200);assert.deepEqual((await status.json()).ready,{'Loving Longmont':false,'MKT Colorado':false})
  const pub=await handle(request({action:'publish',businessId:'00000000-0000-0000-0000-000000000001',sites:['Loving Longmont','MKT Colorado']}));assert.equal(pub.status,503);assert.ok((await pub.json()).setupRequired)
  assert.ok(calls.every(url=>!String(url).includes('github.com')))
  globalThis.fetch=async()=>new Response('{}',{status:401});assert.equal((await handle(request({action:'status'}))).status,401)
  const githubCalls=[]
  globalThis.fetch=async(url,options)=>{
   url=String(url);let data
   if(url.includes('/auth/v1/user'))data={id:'user'}
   else if(url.includes('/cc_members?'))data=[{role:'owner',display_name:'Test'}]
   else if(url.includes('/cc_businesses?'))data=[{id:'00000000-0000-0000-0000-000000000001',name:'Preview Shop',description:'Public description',email:'internal@example.com',notes:'Private notes'}]
   else if(url.includes('/cc_listings?'))data=[{site:'Loving Longmont',url:'https://lovinglongmont.com/businesses.html#shops',title:'Preview Shop'}]
   else if(url.includes('api.github.com')){
    githubCalls.push({url,options})
    if(url.includes('/git/ref/heads/main'))data={object:{sha:'head'}}
    else if(url.includes('/git/commits/head'))data={tree:{sha:'tree'}}
    else if(url.includes('/contents/businesses.html'))data={type:'file',size:200,encoding:'base64',sha:'oldsha',content:btoa('<article class="business-card"><h3>Preview Shop</h3><p>Old description</p></article>')}
    else throw Error('Unexpected GitHub operation')
   }else throw Error('Unexpected request')
   return new Response(JSON.stringify(data),{status:200})
  }
  const preview=await handle(request({action:'preview',businessId:'00000000-0000-0000-0000-000000000001',sites:['Loving Longmont']}))
  assert.equal(preview.status,200);const content=await preview.json()
  assert.equal(content.business.name,'Preview Shop');assert.equal(content.business.email,'');assert.ok(!Object.hasOwn(content.business,'notes'))
  assert.equal(content.canPublish,false);assert.equal(content.sites[0].pages[0].count,1);assert.ok(content.signature)
  assert.equal(githubCalls.length,3);assert.ok(githubCalls.every(c=>c.options.method==='GET'&&!c.options.headers.Authorization))
  assert.equal((await handle(request({action:'publish',businessId:'00000000-0000-0000-0000-000000000001',sites:['Loving Longmont'],signature:content.signature}))).status,503)
  assert.equal(githubCalls.length,3)

 }finally{globalThis.fetch=oldFetch;globalThis.Deno=oldDeno;rmSync(dir,{recursive:true,force:true})}
})
