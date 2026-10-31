import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {JSDOM} from 'jsdom'
import {normalizeResearch,visibilityRun} from '../supabase/functions/research-business/research.mjs'
import {researchMatchesBusiness,reportAssessment} from '../src/lib/visibility-report.js'
const pets={id:'815a9d3a-a929-546d-9720-e461f9d3c05c',name:"A Pet's Place Animal Hospital",website:'https://apetsplacelongmont.com/'},books={id:'f632d5d8-bf5a-5900-b1d5-40c4035db7cb',name:'Barbed Wire Books',website:'https://www.barbedwirebooks.org/'}
function response(b){return {status:'completed',output:[{type:'web_search_call',status:'completed',action:{sources:[{url:b.website},{url:'https://community.example/business'},{url:'https://community.example/another'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({assessment:{business_id:b.id,fields:{name:{value:b.name,verification:'Verified',source:b.website}},summary:b.name+' publishes service information.',platforms:{Website:{state:'Rated',score:4,explanation:b.name+' has clear service information.',evidence:[{url:b.website}]},Instagram:{state:'Rated',score:1,explanation:'Unsubstantiated rating',evidence:[{url:'https://invented.invalid'}]}},third_party_mentions:[{name:'Own website',url:b.website},{name:'Local reference',url:'https://community.example/business'},{url:'https://community.example/another'},{url:'https://invented.invalid'}]},limitations:[]})}]}]}}
test('AI output must match the requested business; unsupported ratings and invented sources are rejected',()=>{
 assert.throws(()=>normalizeResearch(response(books),pets),/identity/)
 const sameId=response(books);const value=JSON.parse(sameId.output[1].content[0].text);value.assessment.business_id=pets.id;sameId.output[1].content[0].text=JSON.stringify(value)
 assert.throws(()=>normalizeResearch(sameId,pets),/different business name/)
 const n=normalizeResearch(response(pets),pets),run=visibilityRun(pets,n,{id:'job1',workspace_id:'workspace'})
 assert.equal(n.assessment.platforms.Website.score,4);assert.equal(n.assessment.platforms.Instagram.score,null)
 assert.equal(run.business_id,pets.id);assert.equal(run.research.business_id,pets.id);assert.equal(run.research.job_id,'job1')
 assert.equal(run.research.backlink_reference_count,1);assert.equal(run.research.third_party_mentions[0].name,'Local reference')
 assert.throws(()=>normalizeResearch({status:'completed',output:[]},pets),/No successful web research/)
})
test('profile report excludes another client’s research and preserves approved edits',()=>{
 const run=visibilityRun(pets,normalizeResearch(response(pets),pets),{id:'job1',workspace_id:'workspace'})
 assert.equal(researchMatchesBusiness(run,pets),true);assert.equal(researchMatchesBusiness(run,books),false)
 assert.equal(researchMatchesBusiness({...run,research:{...run.research,business:'Barbed Wire Books'}},pets),false)
 assert.deepEqual(reportAssessment(books,null,run).platforms,{})
 const edited={state:'Rated',score:5,explanation:'Approved reviewer note',review_status:'Approved'}
 assert.equal(reportAssessment(pets,{approved:{platforms:{Website:edited}}},run,[{business_id:pets.id,status:'Done',notes:JSON.stringify({format:'mkt-portfolio-v1',businessChecklistKey:'rating:Website'})}]).platforms.Website.explanation,edited.explanation)
 run.research.platform_notes.Website='Corrected draft note'
 assert.equal(reportAssessment(pets,null,run).platforms.Website.explanation,'Corrected draft note')
})
test('report renders distinct business findings, no bookstore boilerplate, and blocks mismatched payloads',()=>{
 const dom=new JSDOM(readFileSync('public/business-visibility-report.html','utf8').replace('<script src="business-visibility-report.js"></script>','<script>'+readFileSync('public/business-visibility-report.js','utf8')+'</script>'),{url:'https://example.com/',runScripts:'dangerously'})
 try{
  const run=visibilityRun(pets,normalizeResearch(response(pets),pets),{id:'job1',workspace_id:'workspace'})
  dom.window.fill({business:pets,research:run.research,assessment:run.research.assessment})
  assert.match(dom.window.document.getElementById('bottom').textContent,/A Pet's Place/)
  assert.doesNotMatch(dom.window.document.body.textContent,/Barbed Wire|bookstore|old.*events/i)
  assert.match(dom.window.document.getElementById('channels').textContent,/4\/5/)
  assert.match(dom.window.document.getElementById('channels').textContent,/Local reference/)
  assert.equal(dom.window.document.querySelectorAll('input[data-kind]:checked').length,0)
  dom.window.fill({business:books,research:run.research,assessment:run.research.assessment})
  assert.match(dom.window.document.getElementById('bottom').textContent,/does not match/)
  assert.equal(dom.window.document.getElementById('channels').textContent,'')
  const bookRun=visibilityRun(books,normalizeResearch(response(books),books),{id:'job2',workspace_id:'workspace'})
  dom.window.fill({business:books,research:bookRun.research,assessment:bookRun.research.assessment})
  assert.match(dom.window.document.getElementById('bottom').textContent,/Barbed Wire Books/)
  assert.doesNotMatch(dom.window.document.getElementById('channels').textContent,/A Pet's Place/)
 }finally{dom.window.close()}
})

test('report-level text accidentally nested among platforms is recovered without an infinite polling retry',()=>{
 const r=response(pets),v=JSON.parse(r.output[1].content[0].text);v.assessment.platforms.summary='Recovered summary';delete v.assessment.summary;v.assessment.platforms.Instagram='Public content could not be verified';r.output[1].content[0].text=JSON.stringify(v);const n=normalizeResearch(r,pets);assert.equal(n.assessment.summary,'Recovered summary');assert.equal(n.assessment.platforms.summary,undefined);assert.equal(n.assessment.platforms.Instagram.state,'Unable to Verify');assert.equal(n.assessment.platforms.Instagram.score,null);assert.equal(n.status,'Partial');
})
