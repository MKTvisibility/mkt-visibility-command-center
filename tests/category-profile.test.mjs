import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyData} from '../src/lib/domain.js'
import {metadata,encodeMetadata} from '../src/lib/portfolio.js'
import {workflowTask} from '../src/lib/profile-workflow.js'
import {categoryOf,categorySummary,canonicalProfileTasks,changeTaskStatus,conversationStatus,conversationTask,conversationUpdate,BUTTERSCOTCH_ID} from '../src/lib/category-profile.js'
const b={id:BUTTERSCOTCH_ID,name:'Butterscotch Studios',status:'Active'},d=()=>({...emptyData(),businesses:[b]})
test('category completion excludes correspondence and every appointment; reopening and N/A recompute progress',()=>{
 const data=d(),listing={...workflowTask(b,data,'qa','Review listing'),id:'page',status:'Done'},story={...workflowTask(b,data,'story_request','Send story invitation'),status:'Done',notes:encodeMetadata(workflowTask(b,data,'story_request','Story'),{outreachTracking:{state:'Waiting to hear back from client'}})},appointment={business_id:b.id,id:'appointment',title:'Follow up',type:'Follow-up',status:'Open',due_date:'2026-10-28'}
 data.tasks=[listing,story,appointment]
 assert.equal(categoryOf(story),'correspondence');assert.equal(categoryOf(appointment),'maintenance')
 assert.equal(categorySummary(data.tasks,'listing').complete,true)
 const opened=changeTaskStatus(listing,'open');data.tasks[0]=opened
 assert.equal(categorySummary(data.tasks,'listing').complete,false)
 assert.equal(metadata(opened).statusHistory.at(-1).from,'Done')
 assert.equal(conversationStatus(b,data,'story',data.tasks),'Waiting for client')
 data.tasks[0]=changeTaskStatus(opened,'na');assert.equal(categorySummary(data.tasks,'listing').complete,true)
 assert.equal(appointment.status,'Open')
})
test('conversation changes never complete or reopen sent actions and have independent statuses',()=>{
 const data=d(),intro={...workflowTask(b,data,'intro','Intro'),status:'Done'};data.tasks=[intro]
 const waiting=conversationUpdate(intro,{state:'Waiting for client'})
 assert.equal(waiting.status,'Done');data.tasks=[waiting]
 const story=conversationTask(b,data,'story'),closed=conversationUpdate(story,{state:'Closed'});data.tasks.push(closed)
 assert.equal(closed.status,'Open')
 assert.equal(conversationStatus(b,data,'listing',data.tasks),'Waiting for client')
 assert.equal(conversationStatus(b,data,'story',data.tasks),'Closed')
 assert.equal(metadata(waiting).outreachTracking.state,'Waiting to hear back from client')
})
test('verified sent evidence wins over a duplicate from old all-profile bulk completion',()=>{
 const data=d(),original=workflowTask(b,data,'story_request','Story')
 data.tasks=[{...original,id:'bulk',status:'Done',notes:encodeMetadata(original,{profileBulkCompletion:true})},{...original,id:'verified',status:'Done',notes:encodeMetadata(original,{evidenceCompletion:{messageId:'sent'},outreachTracking:{state:'Waiting to hear back from client'}})}]
 const tasks=canonicalProfileTasks(b,data)
 assert.equal(tasks.filter(t=>metadata(t).businessChecklistKey==='story_request').length,1)
 assert.equal(tasks.find(t=>metadata(t).businessChecklistKey==='story_request').id,'verified')
})

test('confirmed campaign sends check only their matching action, leave drafts open and allow reopening',()=>{
 const data=d()
 data.emails=[{id:'mail',business_id:b.id,direction:'Outbound',status:'Sent',message_type:'Human',source_message_id:'gmail-1',occurred_on:'2026-10-15',notes:JSON.stringify({format:'mkt-message-summary-v1',campaignKey:'story'})}]
 let tasks=canonicalProfileTasks(b,data),story=tasks.find(t=>metadata(t).businessChecklistKey==='story_request')
 assert.equal(story.status,'Done');assert.equal(conversationStatus(b,data,'story',tasks),'Waiting for client')
 assert.equal(tasks.find(t=>metadata(t).businessChecklistKey==='offer').status,'Open')
 data.tasks=[changeTaskStatus(story,'open')]
 assert.equal(canonicalProfileTasks(b,data).find(t=>metadata(t).businessChecklistKey==='story_request').status,'Open')
 data.tasks=[];data.emails[0].status='Draft'
 assert.equal(canonicalProfileTasks(b,data).find(t=>metadata(t).businessChecklistKey==='story_request').status,'Open')
})
