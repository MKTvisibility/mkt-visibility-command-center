import {hydrateCampaignTask} from './task-evidence.js'
import {businessMessages} from './domain.js'
import {missingBusinessChecklist} from './business-checklist.js'
import {profileSummary} from './profile-summary.js'
import {PRE_CONTACT} from './outreach-workflow.js'
import {SIMPLE_STEPS,workflowTask,taskChoice} from './profile-workflow.js'
import {metadata,encodeMetadata,isTownWork} from './portfolio.js'

export function profileWork(business,data,profile) {
 const tasks=data.tasks.filter(t=>t.business_id===business.id&&!isTownWork(t))
 const keys=new Set(tasks.map(t=>metadata(t).businessChecklistKey).filter(Boolean))
 const missing=missingBusinessChecklist(business,data)
 for(const t of missing)keys.add(metadata(t).businessChecklistKey)
 const steps=[...profileSummary(business,data,profile).steps,...PRE_CONTACT,...SIMPLE_STEPS.map(([key,,title])=>[key,title])]
 for(const [key,title] of steps)if(!keys.has(key)){missing.push(workflowTask(business,data,key,title));keys.add(key)}
 const messages=businessMessages(data,business.id)
 const all=[...tasks,...missing].map(task=>hydrateCampaignTask(task,messages))
 const remaining=all.filter(t=>!['Done','Cancelled'].includes(t.status))
 return {tasks:all,remaining,done:all.filter(t=>t.status==='Done').length,closed:all.length-remaining.length,complete:all.length>0&&!remaining.length}
}
export function closeProfileTask(task,choice) {
 const updated=taskChoice(task,choice)
 return {...updated,notes:encodeMetadata(updated,{profileBulkCompletion:true,profileBulkCompletionAt:new Date().toISOString()})}
}
