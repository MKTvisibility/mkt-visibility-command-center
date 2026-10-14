import test from 'node:test'
import assert from 'node:assert/strict'
import {metadata,encodeMetadata} from '../src/lib/portfolio.js'
import {workflowTask,profileTask,SIMPLE_STEPS,taskChoice,taskNotApplicable} from '../src/lib/profile-workflow.js'
import {emptyData} from '../src/lib/domain.js'
test('simple profile checklist reuses completed task IDs and creates only requested missing steps',()=>{
 const data=emptyData(),business={id:'b',name:'Studio'}
 const existing={id:'old-intro',business_id:'b',status:'Done',completed_at:'2026-10-12T00:00:00Z',notes:encodeMetadata({},{businessChecklistKey:'intro',evidenceCompletion:{subject:'Your listing',date:'2026-10-12'}})}
 data.tasks=[existing]
 assert.equal(profileTask(data,business,'intro'),existing)
 assert.equal(profileTask(data,business,'story_request'),undefined)
 const task=workflowTask(business,data,'story_request','Email a request for their business story')
 assert.equal(task.details.suggestion_key,'profile:story_request')
 assert.equal(metadata(task).businessChecklistKey,'story_request')
 assert.equal(task.status,'Open');assert.equal(data.tasks.length,1)
 assert.equal(SIMPLE_STEPS.length,8)
})

test('N/A and complete are exclusive, keep task identity and restore skipped tasks',()=>{
 const task={id:'task-id',status:'Done',notes:encodeMetadata({},{businessChecklistKey:'image',text:'Keep evidence'})}
 const skipped=taskChoice(task,'na');assert.equal(skipped.status,'Cancelled');assert.equal(skipped.id,task.id);assert.equal(taskNotApplicable(skipped),true);assert.equal(metadata(skipped).text,'Keep evidence')
 const completed=taskChoice(skipped,'done');assert.equal(completed.status,'Done');assert.equal(taskNotApplicable(completed),false)
 const restored=taskChoice(skipped,'open');assert.equal(restored.status,'Open');assert.equal(taskNotApplicable(restored),false)
})
