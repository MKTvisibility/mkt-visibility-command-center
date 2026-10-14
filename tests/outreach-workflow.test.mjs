import test from 'node:test'
import assert from 'node:assert/strict'
import {PRE_CONTACT,ready,sequence,responseSequence,plusDays} from '../src/lib/outreach-workflow.js'
import {workflowTask,taskChoice} from '../src/lib/profile-workflow.js'
import {encodeMetadata} from '../src/lib/portfolio.js'
const b={id:'b',name:'Example',kind:'Prospect',status:'Active',notes:encodeMetadata({},{outreachDecision:'Pursue as a client'})}
const data={businesses:[b],tasks:[],emails:[],listings:[]}
test('ready requires every preparation step, a decision, no contact and no opt-out',()=>{
 assert.equal(ready(b,data),false)
 const done={...data,tasks:PRE_CONTACT.map(([key,title])=>taskChoice(workflowTask(b,data,key,title),'done'))}
 assert.equal(ready(b,done),true)
 assert.equal(ready(b,done,{crm:{do_not_contact:true}}),false)
 assert.equal(ready({...b,notes:encodeMetadata(b,{outreachDecision:'Not a match'})},done),false)
 assert.equal(ready({...b,notes:encodeMetadata(b,{outreachDecision:'Not decided'})},done),false)
 assert.equal(ready(b,{...done,emails:[{business_id:'b',direction:'Outbound',status:'Sent',occurred_on:'2026-10-14'}]}),false)
 assert.equal(ready(b,{...done,tasks:[...done.tasks,taskChoice(workflowTask(b,data,'intro','First email'),'done')]}),false)
})
test('follow-up dates and deduplication survive month/year boundaries',()=>{
 const tasks=sequence(b,data,'2026-12-20')
 assert.deepEqual(tasks.map(t=>t.due_date),['2026-12-27','2027-01-10'])
 assert.equal(sequence(b,{...data,tasks},'2026-12-20').length,0)
 assert.equal(plusDays('2028-02-28',1),'2028-02-29')
})
test('received story or changes require verification before confirmation email',()=>{
 for(const kind of ['story','updates']){const tasks=responseSequence(b,data,kind,'2026-10-14');assert.equal(tasks[0].status,'Open');assert.equal(tasks[1].status,'Blocked');assert.match(tasks[1].title,/Free Visibility Check/);assert.equal(responseSequence(b,{...data,tasks},kind).length,0)}
})

test('existing unscheduled story request gets a calendar date without duplication',()=>{const existing={...workflowTask(b,data,'story_request','Story request'),id:'existing'};const tasks=sequence(b,{...data,tasks:[existing]},'2026-10-14');assert.equal(tasks[0].id,'existing');assert.equal(tasks[0].due_date,'2026-10-21');assert.equal(tasks[0].type,'Follow-up')})
