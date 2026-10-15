import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeCandidates,filterWebsiteDuplicates,normalize,websiteInventory} from '../supabase/functions/ai-headquarters/discovery.mjs'
import {toolsFor,executeTool} from '../supabase/functions/ai-headquarters/tools.mjs'
const candidate={name:'Sample & Studio',city:'Longmont',state:'Colorado',website:'https://studio.example/',email:'',phone:'',address:'',description:'An independent studio.',reason:'Local maker.',sources:['https://studio.example/about'],uncertainties:['Hours not confirmed.']}
function response(candidates=[candidate]){return {status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://studio.example/about'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates})}]}]}}
test('discovery requires real completed search and retrieved citations; missing contacts stay empty',()=>{
 const result=normalizeCandidates(response());assert.equal(result.candidates[0].email,'');assert.match(result.candidates[0].uncertainties[0],/verification/)
 assert.equal(normalizeCandidates(response([{...candidate,sources:['https://invented.example/']}])).candidates.length,0)
 assert.equal(normalizeCandidates(response([{...candidate,state:'Texas'}])).candidates.length,0)
 assert.throws(()=>normalizeCandidates({...response(),status:'incomplete'}),/incomplete/)
 assert.throws(()=>normalizeCandidates({status:'completed',output:response().output.slice(1)}),/No successful/)
})
test('website duplicate checks cover both sites and normalize punctuation and accents',()=>{
 const pages=[{path:'Colorado/sample-studio.html',text:normalize('Sample & Studio')}]
 assert.equal(filterWebsiteDuplicates([candidate],pages).candidates.length,0)
 assert.equal(filterWebsiteDuplicates([{...candidate,name:'An entirely new maker'}],pages).candidates.length,1)
})
test('website inventory reads fixed repositories and fails closed on an unavailable page',async()=>{
 await assert.rejects(()=>websiteInventory(async url=>url.includes('api.github.com')?{ok:true,json:async()=>({sha:'fixed',tree:[{type:'blob',path:'index.html'}]})}:{ok:false}),/could not be checked/)
})
test('only Hunter has discovery access; saved caller message supplies provenance',async()=>{
 assert.equal(toolsFor('Hunter').some(t=>t.name==='research_new_businesses'),true)
 assert.equal(toolsFor('Code').some(t=>t.name==='research_new_businesses'),false)
 assert.match((await executeTool('research_new_businesses',{}, {agent:'Avery'})).error,/does not have/)
 let args
 const result=await executeTool('research_new_businesses',{message_id:'forged'},{agent:'Hunter',messageId:'current',userId:'partner',db:{rpc:async(name,values)=>{assert.equal(name,'cc_begin_discovery');args=values;return {data:{existing:true,id:'run',status:'Completed',result:{created:[{id:'profile'}]}}}}}})
 assert.deepEqual(args,{p_message_id:'current',p_user_id:'partner'});assert.equal(result.created[0].id,'profile')
})
