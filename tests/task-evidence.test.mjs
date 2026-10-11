import test from 'node:test'
import assert from 'node:assert/strict'
import { hydrateTask, prepareTask } from '../src/lib/task-evidence.js'
import { encodeMetadata,metadata } from '../src/lib/portfolio.js'
import { demoRepository } from '../src/lib/repository.js'
import { emptyData } from '../src/lib/domain.js'
test('historical evidence stays checked through priority edits, can be reopened, and never invents partner timestamps',async()=>{
 const task={id:'past',title:'Send Free Listing Email',type:'Task',status:'Open',priority:'Normal',notes:encodeMetadata({},{businessChecklistKey:'intro',evidenceCompletion:{subject:'Your site was added',date:'2026-10-10'}})}
 const hydrated=hydrateTask(task)
 assert.equal(hydrated.status,'Done');assert.equal(hydrated.completed_at,undefined)
 const data=emptyData();data.tasks=[task];const repo=demoRepository(data)
 const saved=await repo.save('tasks',{...hydrated,priority:'High'})
 assert.equal(saved.status,'Done');assert.equal(saved.priority,'High');assert.equal(saved.completed_at,null)
 assert.equal((await repo.load()).tasks[0].status,'Done')
 const reopened=await repo.save('tasks',{...saved,status:'Open'})
 assert.equal(reopened.status,'Open');assert.equal(metadata(reopened).evidenceCompletionIgnored,true)
 assert.equal((await repo.load()).tasks[0].status,'Open')
 const realDone={...task,status:'Done',completed_at:'2026-10-09T12:00:00Z',completed_by_name:'Tim'}
 assert.deepEqual(hydrateTask(realDone),realDone);assert.deepEqual(prepareTask(realDone),realDone)
})
