import test from 'node:test'
import assert from 'node:assert/strict'
import {metadata,encodeMetadata} from '../src/lib/portfolio.js'
import {workflowTask,profileTask,SIMPLE_STEPS} from '../src/lib/profile-workflow.js'
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
