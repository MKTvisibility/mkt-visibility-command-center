import {localDay,businessMessages} from './domain.js'
import {metadata,brandOf,isTownWork} from './portfolio.js'
import {profileTask,workflowTask,taskNotApplicable} from './profile-workflow.js'
import {hydrateTask} from './task-evidence.js'
import {blocked} from './outreach-workflow.js'
export const EMAIL_STAGES=[['intro','Free Listing Notification','Includes a Free Visibility Check offer'],['story_request','Business Story Request','Includes a Free Visibility Check offer'],['offer','Free Visibility Check invitation','Offer and request tracking'],['report','Free Visibility Check report delivery','Send the completed report']]
export const REPLY_CATEGORIES=[['updates','Requested listing updates'],['thanks','Thank-you / acknowledgment'],['check_requested','Requested a Free Visibility Check'],['story_reply','Replied to the story request'],['questionnaire','Requested a story questionnaire']]
export const OUTREACH_STATES=['Not set','Waiting to hear back from client','Client is waiting to hear back from us','No further outreach needed','Schedule outreach']
export const directoryBusinesses=data=>data.businesses.filter(b=>b.status!=='Archived').sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true}))
export function stageTask(b,data,key){return profileTask({...data,tasks:(data._businessTasks?.get(b.id)||data.tasks.filter(t=>t.business_id===b.id)).map(hydrateTask)},b,key)||workflowTask(b,data,key,EMAIL_STAGES.find(s=>s[0]===key)?.[1]||key)}
export function stageTracking(task){return metadata(task).outreachTracking||{}}
const done=t=>t?.status==='Done'&&!taskNotApplicable(t)
function indexed(data){const map=new Map();for(const t of data.tasks){if(!map.has(t.business_id))map.set(t.business_id,[]);map.get(t.business_id).push(t)}return {...data,_businessTasks:map}}
export function dueEmailStages(data,today=localDay()){
 data=indexed(data)
 const rows=[]
 for(const b of directoryBusinesses(data)){
  if(blocked(b))continue
  for(const [key,label] of EMAIL_STAGES){
   const t=stageTask(b,data,key),r=stageTracking(t)
   const reminders=(data._businessTasks.get(b.id)||[]).filter(t=>metadata(t).outreachStage===key&&!['Done','Cancelled'].includes(t.status))
   const scheduled=reminders.some(t=>t.due_date&&t.due_date>today),reminderDue=reminders.some(t=>t.due_date&&t.due_date<=today)
   if(scheduled&&!reminderDue)continue
   if(taskNotApplicable(t)||t.status==='Cancelled'||['Blocked','Waiting on Client'].includes(t.status)||['Waiting to hear back from client','No further outreach needed'].includes(r.state)||t.due_date&&t.due_date>today)continue
   const needsReply=r.received&&!r.responded||r.state==='Client is waiting to hear back from us'
   if(done(t)&&!needsReply&&!reminderDue&&r.state!=='Schedule outreach')continue
   if(!needsReply&&key==='story_request'&&!done(stageTask(b,data,'intro')))continue
   if(!needsReply&&key==='report'&&!done(stageTask(b,data,'audit')))continue
   rows.push({business:b,key,label,task:t,needsReply})
  }
 }
 return rows
}
export function salesReport(data,month=localDay().slice(0,7)){
 const purchases=(data.purchases||[]).filter(p=>p.purchased_on?.startsWith(month)).sort((a,b)=>b.purchased_on.localeCompare(a.purchased_on))
 const paid=purchases.filter(p=>p.status==='Paid'),sources=new Map()
 for(const p of paid){const source=metadata(p).saleSource||brandOf(p,data)||'Source not recorded';sources.set(source,(sources.get(source)||0)+Number(p.amount||0))}
 return {purchases,paid,total:paid.reduce((s,p)=>s+Number(p.amount||0),0),sources:[...sources].sort((a,b)=>a[0].localeCompare(b[0])),recurring:data.businesses.filter(b=>b.kind==='Client'&&b.status==='Active').reduce((s,b)=>s+Number(b.monthly_fee||0),0)}
}
export function activityReport(data){
 data=indexed(data)
 const groups=[['replies','Replied after listing notification'],...REPLY_CATEGORIES,['check_completed','Visibility Check completed'],['check_received','Received a Visibility Check report'],['paid_listing','Paid upgraded listing'],['paid_services','Paid MKT Visibility services'],['unclassified','Replies needing category review']].map(([key,label])=>({key,label,businesses:[]}))
 const engaged=[]
 for(const b of directoryBusinesses(data)){
  const tasks=(data._businessTasks.get(b.id)||[]).map(hydrateTask),tracking=tasks.map(stageTracking),emails=businessMessages(data,b.id)
  const inbound=emails.filter(e=>e.direction==='Inbound'&&['Replied','Received'].includes(e.status)&&!['Automatic','Delivery'].includes(e.message_type))
  const intro=stageTask(b,data,'intro'),introDate=metadata(intro).evidenceCompletion?.date||intro.completed_at?.slice(0,10)||intro.due_date
  const replies=Boolean(stageTracking(intro).received)||done(intro)&&inbound.some(e=>!introDate||e.occurred_on>=introDate)
  const categories=new Set(tracking.flatMap(t=>t.categories||[]))
  const paid=(data.purchases||[]).filter(p=>p.business_id===b.id&&p.status==='Paid')
  const flags={replies,check_completed:done(stageTask(b,data,'audit')),check_received:done(stageTask(b,data,'report')),paid_listing:paid.some(p=>metadata(p).saleType==='Upgraded listing'),paid_services:paid.some(p=>metadata(p).saleType==='MKT Visibility services'),unclassified:(inbound.length>0||tracking.some(t=>t.received))&&categories.size===0}
  for(const [key]of REPLY_CATEGORIES)flags[key]=categories.has(key)
  if(metadata(stageTask(b,data,'request')).visibilityCheckStatus==='Requested')flags.check_requested=true
  if(tracking.some(t=>t.received)||inbound.length||paid.length||b.kind==='Client'&&b.status==='Active'||categories.size)engaged.push(b)
  for(const g of groups)if(flags[g.key])g.businesses.push(b)
 }
 return {groups,engaged}
}
export function scheduledContacts(data,today=localDay()){return data.tasks.filter(t=>!isTownWork(t)&&t.type==='Follow-up'&&!['Done','Cancelled'].includes(t.status)&&t.due_date&&t.due_date>today)}
export const SALES_SOURCES=['Source not recorded','Loving Longmont','MKT Colorado','MKT Visibility','Open Theory Cove','Boulder County Photography','Etsy','Printify','Amazon KDP','Square','Other']
export const SALE_TYPES=['Not classified','Upgraded listing','MKT Visibility services','Product sale','Other']
