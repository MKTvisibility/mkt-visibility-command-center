import {metadata,encodeMetadata} from './portfolio.js'
import {profileWork} from './profile-completion.js'
import {taskChoice,taskNotApplicable,workflowTask} from './profile-workflow.js'
export const BUTTERSCOTCH_ID='05e3d0d9-619e-5386-a120-171771e867b0'
export const WORK_CATEGORIES=[['research','Business details & research'],['listing','Images & public listing'],['visibility','Visibility Check assessment'],['services','Client services & payments'],['maintenance','Follow-ups & maintenance']]
export const TOPICS=[['listing','Listing notification / corrections',['intro']],['story','Business story / questionnaire',['story_request','story_questionnaire']],['visibility','Free Visibility Check',['offer','report']],['services','Proposal / paid services',['proposal','service_confirmation','upgrade_offer']]]
export const CONVERSATION_STATES=['Not started','We need to respond','Waiting for client','Follow-up scheduled','Done / Completed','Closed','N/A']
const actionKeys=new Set(TOPICS.flatMap(t=>t[2]))
export function categoryOf(task){
 const m=metadata(task),key=m.businessChecklistKey||''
 if(key.startsWith('correspondence:'))return 'conversation'
 if(actionKeys.has(key)||key==='next'||key==='followup'||key.startsWith('followup_')||key.endsWith(':confirm'))return 'correspondence'
 if(task.type==='Follow-up'||key==='maintenance'||key.startsWith('outreach:')&&!key.endsWith(':verify'))return 'maintenance'
 if(m.profileCategory&&WORK_CATEGORIES.some(([k])=>k===m.profileCategory))return m.profileCategory
 if(['request','audit','prep:rating'].includes(key)||key.startsWith('rating:'))return 'visibility'
 if(['scope','payment','reporting'].includes(key))return 'services'
 if(['image','crop','description','qa','included_listing','coupon'].includes(key)||key.startsWith('listing:')||key.endsWith(':verify'))return 'listing'
 return 'research'
}
export function canonicalProfileTasks(business,data,profile){
 const tasks=profileWork(business,data,profile).tasks,map=new Map()
 for(const t of tasks){const key=metadata(t).businessChecklistKey||t.id||t.title,old=map.get(key);if(!old||score(t)>score(old)||score(t)===score(old)&&(t.updated_at||'')>(old.updated_at||''))map.set(key,t)}
 return [...map.values()]
}
function score(t){const m=metadata(t);return (t.id?1:0)+(m.profileBulkCompletion?0:2)+(m.evidenceCompletion?2:0)+(m.outreachTracking?2:0)}
export function categorySummary(tasks,key){const rows=tasks.filter(t=>categoryOf(t)===key),open=rows.filter(t=>!['Done','Cancelled'].includes(t.status));return {rows,open,done:rows.filter(t=>t.status==='Done').length,na:rows.filter(t=>t.status==='Cancelled').length,complete:rows.length>0&&!open.length}}
export function changeTaskStatus(task,choice){
 const result=taskChoice(task,choice)
 return {...result,notes:encodeMetadata(result,{categoryCompletion:true,statusHistory:[...(metadata(task).statusHistory||[]),{from:task.status,to:result.status,at:new Date().toISOString()}].slice(-5)})}
}
export function conversationTask(business,data,topic){const key=TOPICS.find(t=>t[0]===topic)?.[2][0]||topic;return canonicalProfileTasks(business,data).find(t=>metadata(t).businessChecklistKey===key)||workflowTask(business,data,key,`Correspondence: ${TOPICS.find(t=>t[0]===topic)?.[1]||topic}`)}
export function conversationStatus(business,data,topic,tasks){
 const saved=metadata(conversationTask(business,data,topic)).outreachTracking
 if(saved?.conversationState)return saved.conversationState
 const keys=TOPICS.find(t=>t[0]===topic)?.[2]||[],rows=tasks.filter(t=>keys.includes(metadata(t).businessChecklistKey)),tracking=rows.map(t=>metadata(t).outreachTracking||{})
 if(tracking.some(t=>t.state==='Client is waiting to hear back from us'||t.received&&!t.responded))return 'We need to respond'
 if(tracking.some(t=>t.state==='Waiting to hear back from client'))return 'Waiting for client'
 if(tracking.some(t=>t.state==='No further outreach needed')||topic==='listing'&&tracking.some(t=>t.received&&t.responded))return 'Done / Completed'
 if(rows.some(t=>t.status==='Done'&&!metadata(t).profileBulkCompletion&&!taskNotApplicable(t)))return 'Waiting for client'
 return 'Not started'
}
export function conversationUpdate(task,changes){const c={...metadata(task).outreachTracking,...changes},map={'We need to respond':'Client is waiting to hear back from us','Waiting for client':'Waiting to hear back from client','Follow-up scheduled':'Schedule outreach','Done / Completed':'Completed','Closed':'No further outreach needed','N/A':'No further outreach needed','Not started':'Not set'};return {...task,notes:encodeMetadata(task,{outreachTracking:{...metadata(task).outreachTracking,conversationState:c.state,state:map[c.state],closedReason:c.state==='Closed'?(c.reason||metadata(task).outreachTracking?.closedReason||'Other'):null}})}}
