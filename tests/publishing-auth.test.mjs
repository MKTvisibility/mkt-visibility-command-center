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
  const pub=await handle(request({action:'preview',businessId:'00000000-0000-0000-0000-000000000001',sites:['Loving Longmont','MKT Colorado']}));assert.equal(pub.status,503);assert.ok((await pub.json()).setupRequired)
  assert.ok(calls.every(url=>!String(url).includes('github.com')))
  globalThis.fetch=async()=>new Response('{}',{status:401});assert.equal((await handle(request({action:'status'}))).status,401)
 }finally{globalThis.fetch=oldFetch;globalThis.Deno=oldDeno;rmSync(dir,{recursive:true,force:true})}
})
