import {messageSummary} from './domain.js'
import {CAMPAIGNS,campaignKey} from './campaign-types.js'
import { metadata, encodeMetadata } from './portfolio.js'
// Historical evidence has its own date/source; it does not invent a partner or exact completion time.
export function hydrateTask(task) {
 const m=metadata(task)
 if(task.status==='Open'&&m.evidenceCompletion&&!m.evidenceCompletionIgnored) return {...task,status:'Done',_evidenceChecked:true}
 return task
}
export function prepareTask(task) {
 if(!task._evidenceChecked) return task
 if(task.status==='Done') return {...task,status:'Open'}
 return {...task,notes:encodeMetadata(task,{evidenceCompletionIgnored:true})}
}

// Confirmed message receipts drive both profile checkboxes and dashboard totals.
export function hydrateCampaignTask(raw,messages) {
 const task=hydrateTask(raw),m=metadata(task),key=m.businessChecklistKey
 if(!key||task.status!=='Open'||m.evidenceCompletionIgnored||m.categoryCompletion)return task
 const email=messages.find(e=>e.direction==='Outbound'&&['Sent','Replied'].includes(e.status)&&e.message_type!=='Automatic'&&e.source_message_id&&CAMPAIGNS.some(c=>c.taskKey===key&&c.key===campaignKey(messageSummary(e).campaignKey||e.campaign)))
 if(!email)return task
 return {...task,status:'Done',_evidenceChecked:true,notes:encodeMetadata(task,{evidenceCompletion:{messageId:email.source_message_id,date:email.occurred_on,source:'Confirmed campaign send'}})}
}
