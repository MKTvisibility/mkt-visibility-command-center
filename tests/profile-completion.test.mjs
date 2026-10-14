import test from 'node:test'
import assert from 'node:assert/strict'
import {profileWork,closeProfileTask} from '../src/lib/profile-completion.js'
import {metadata,encodeMetadata} from '../src/lib/portfolio.js'
import {taskChoice} from '../src/lib/profile-workflow.js'
const business={id:'b',name:'Local business',status:'Active'}
const data={businesses:[business],tasks:[],listings:[],emails:[]}
test('covers unsaved checklist, platform reviews and outreach preparation',()=>{
 const work=profileWork(business,data)
 const keys=work.tasks.map(t=>metadata(t).businessChecklistKey)
 assert.ok(keys.includes('prep:message'));assert.ok(keys.includes('rating:Website'));assert.ok(keys.includes('story_request'))
 assert.equal(new Set(keys).size,keys.length);assert.equal(work.complete,false)
})
test('bulk N/A resolves required work without inventing completed emails; new work reopens status',()=>{
 const tasks=profileWork(business,data).remaining.map((t,i)=>({...closeProfileTask(t,'na'),id:String(i)}))
 const saved={...data,tasks}
 assert.equal(profileWork(business,saved).complete,true)
 assert.ok(tasks.every(t=>t.status==='Cancelled'&&metadata(t).notApplicable))
 assert.equal(profileWork(business,{...saved,tasks:[...tasks,{id:'extra',business_id:'b',status:'Open',title:'New work'}]}).complete,false)
 assert.equal(profileWork(business,{...saved,tasks:tasks.map((t,i)=>i===0?taskChoice(t,'open'):t)}).complete,false)
})
test('keeps completed, cancelled, other business and town work out of bulk changes',()=>{
 const tasks=[{id:'done',business_id:'b',status:'Done'},{id:'cancelled',business_id:'b',status:'Cancelled'},{id:'other',business_id:'other',status:'Open'},{id:'town',business_id:'b',status:'Open',notes:encodeMetadata({},{townKey:'akron'})}]
 assert.ok(profileWork(business,{...data,tasks}).remaining.every(t=>!t.id))
 const marked=closeProfileTask({business_id:'b',status:'Open'},'done')
 assert.equal(marked.status,'Done');assert.equal(metadata(marked).profileBulkCompletion,true)
 assert.equal(metadata(taskChoice(marked,'open')).profileBulkCompletion,false)
})
