import {inactiveBusiness} from './business-report.js'
import {CAMPAIGNS,campaignKey} from './campaign-types.js'
import {messageSummary} from './domain.js'
import {directoryBusinesses,metadata,encodeMetadata} from './portfolio.js'
import {profileTask,workflowTask,taskNotApplicable,taskChoice} from './profile-workflow.js'
import {hydrateTask} from './task-evidence.js'
import {blocked} from './outreach-workflow.js'
export {CAMPAIGNS} from './campaign-types.js'
export function classifyCampaign(email){
 const stored=messageSummary(email).campaignKey
 if(stored==='unclassified')return {key:'',source:'Marked for classification'}
 const explicit=campaignKey(stored)
 if(explicit)return {key:explicit,source:'Recorded campaign'}
 const subject=(email.subject||'').toLowerCase(),name=(email.campaign||'').toLowerCase(),summary=messageSummary(email).summary.toLowerCase()
 // Only distinct historical purposes are recognized. A bundled offer does not
 // create another campaign send, and a generic history label proves nothing.
 if(/\b(has been added|is listed|we added|you(?:'re| are) listed)\b/.test(subject)||/\bfree listing\b/.test(subject))return {key:'welcome',source:'Historical subject'}
 if(/\b(story behind|share (?:your|the) story|business stor(?:y|ies)|your business story)\b/.test(subject)||/business stor(?:y|ies)|business story request/.test(name))return {key:'story',source:'Historical campaign / subject'}
 if(/\b(upgrade|upgraded listing|enhanced listing|featured listing)\b/.test(subject))return {key:'upgrade',source:'Historical subject'}
 if(/\bfree (?:business )?visibility check\b/.test(subject)&&!/(report|results|completed|follow.up|thank|received)/.test(subject)&&!/(completed.{0,50}report|sent.{0,80}report|acknowledged|submission)/.test(summary)&&/(invit|offered.{0,30}(free|visibility)|interested in|would you like|offer(?:ing)? a free)/.test(subject+' '+summary))return {key:'visibility',source:'Historical subject'}
 return {key:'',source:'Needs classification'}
}
const isHuman=e=>!e.message_type||e.message_type==='Human'
const sentEmail=e=>e.direction==='Outbound'&&['Sent','Replied','Bounced'].includes(e.status)&&isHuman(e)
const replyEmail=e=>e.direction==='Inbound'&&['Replied','Received'].includes(e.status)&&isHuman(e)
const subjectKey=e=>(e.subject||'').toLowerCase().replace(/^(?:(?:re|fw|fwd):\s*)+/,'').trim()
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')
export function campaignTask(b,data,key){const c=CAMPAIGNS.find(c=>c.key===key);return profileTask(data,b,c.taskKey)||workflowTask(b,data,c.taskKey,c.name+' contact')}
export const campaignRemoved=(business,key)=>metadata(business).campaignExclusions?.[key]===true
export function setCampaignParticipation(business,key,included){
 if(!CAMPAIGNS.some(c=>c.key===key))throw Error('Choose a known campaign.')
 return {...business,notes:encodeMetadata(business,{campaignExclusions:{...metadata(business).campaignExclusions,[key]:!included}})}
}
export function recordCampaign(task,changes){
 const old=metadata(task).campaignTracking||{},next={...old,...changes,outcomes:{...old.outcomes,...changes.outcomes}}
 if(next.sent&&!validDate(next.date))throw Error('Record the actual contact date.')
 if(!['Email','Phone call'].includes(next.channel))throw Error('Choose Email or Phone call.')
 if(String(next.variant||'').length>80)throw Error('Keep the variant name within 80 characters.')
 // Campaign bookkeeping never completes unrelated work or closes correspondence.
 const base=changes.sent===true?taskChoice(task,'done'):old.sent===true&&changes.sent===false?taskChoice(task,'open'):task
 return {...base,notes:encodeMetadata(base,{campaignTracking:next})}
}
function historicalContact(task,key){const m=metadata(task);return ['welcome','story'].includes(key)&&hydrateTask(task).status==='Done'&&!m.profileBulkCompletion&&!taskNotApplicable(task)}
export function campaignReport(data,brand){
 const businesses=brand?directoryBusinesses(data,brand):data.businesses.filter(b=>b.kind!=='Partner-owned Business'),byTask=new Map(),byMail=new Map(),byPurchase=new Map()
 for(const [rows,map] of [[data.tasks,byTask],[data.emails,byMail],[data.purchases||[],byPurchase]])for(const r of rows){const ids=new Set([r.business_id,...(r.related_business_ids||[])]);for(const id of ids){if(!map.has(id))map.set(id,[]);map.get(id).push(r)}}
 const result=CAMPAIGNS.map(c=>({...c,rows:[],emails:0,calls:0,emailRecords:new Set(),variants:new Map()})),reviews=new Map()
 for(const b of businesses){
  const local={...data,tasks:byTask.get(b.id)||[]},mail=byMail.get(b.id)||[],purchases=byPurchase.get(b.id)||[],humanReplies=mail.filter(replyEmail)
  for(const c of result){
   const task=campaignTask(b,local,c.key),m=metadata(task),tracking=m.campaignTracking||{},legacy=m.outreachTracking||{},contacts=mail.filter(e=>sentEmail(e)&&classifyCampaign(e).key===c.key),calls=local.tasks.filter(t=>metadata(t).appointmentManager?.status==='Completed'&&metadata(t).appointmentManager?.campaignKey===c.key&&hydrateTask(t).status==='Done'),outcomes=tracking.outcomes||{}
   const hasHistorical=tracking.sent!==false&&historicalContact(task,c.key),manual=Boolean(tracking.sent),contacted=contacts.length>0||manual||hasHistorical||calls.length>0
   const manualExtra=(manual||hasHistorical)&&contacts.length===0&&calls.length===0
   const emailCount=contacts.length+(manualExtra&&(tracking.channel||'Email')==='Email'?1:0),callCount=calls.length+(manualExtra&&tracking.channel==='Phone call'?1:0)
   const dates=[...contacts.map(e=>e.occurred_on),...calls.map(t=>t.due_date),...(manual?[tracking.date]:hasHistorical?[m.evidenceCompletion?.date||task.completed_at?.slice(0,10)]:[])].filter(validDate).sort()
   const first=dates[0]
   const replies=humanReplies.filter(e=>{
    if(!first||!validDate(e.occurred_on)||e.occurred_on<first)return false
    const explicit=campaignKey(messageSummary(e).campaignKey)
    if(explicit)return explicit===c.key
    const normalized=subjectKey(e);return normalized&&contacts.some(s=>subjectKey(s)===normalized&&s.occurred_on&&s.occurred_on<=e.occurred_on)
   })
   const replied=contacted&&Boolean(tracking.replied||legacy.received||replies.length||contacts.some(e=>e.status==='Replied'))
   const categories=new Set(legacy.categories||[])
   const checkRequested=Boolean(outcomes.checkRequested||categories.has('check_requested'))
   const storySubmitted=Boolean(outcomes.storySubmitted||categories.has('story_submitted'))
   const linkedSales=purchases.filter(p=>campaignKey(metadata(p).campaignKey)===c.key&&['Ordered','Paid'].includes(p.status))
   const listingOrdered=Boolean(outcomes.listingOrdered||linkedSales.some(p=>metadata(p).saleType==='Upgraded listing'))
   const servicesOrdered=Boolean(outcomes.servicesOrdered||linkedSales.some(p=>metadata(p).saleType==='MKT Visibility services'))
   const notApplicable=taskNotApplicable(task)||task.status==='Cancelled'||['Closed','N/A','Done / Completed'].includes(legacy.conversationState)&&!contacted
   const priorStory=local.tasks.some(t=>metadata(t).campaignTracking?.outcomes?.storySubmitted),checkStatus=metadata(profileTask(local,b,'request')||{}).visibilityCheckStatus,alreadyUpgraded=purchases.some(p=>p.status==='Paid'&&metadata(p).saleType==='Upgraded listing')
   const removed=campaignRemoved(b,c.key)
   const eligible=!removed&&!blocked(b)&&!inactiveBusiness(b)&&!notApplicable&&!contacted&&!(c.key==='story'&&priorStory)&&!(c.key==='visibility'&&['Requested','Declined'].includes(checkStatus))&&!(c.key==='upgrade'&&alreadyUpgraded)&&!(c.key==='story'&&!result.find(g=>g.key==='welcome')?.rows.find(r=>r.business.id===b.id)?.contacted)
   const review=mail.some(e=>sentEmail(e)&&!classifyCampaign(e).key)||humanReplies.some(e=>!campaignKey(messageSummary(e).campaignKey)&&!mail.some(s=>sentEmail(s)&&classifyCampaign(s).key&&subjectKey(e)&&subjectKey(e)===subjectKey(s)&&s.occurred_on&&e.occurred_on>=s.occurred_on))
   if(review)reviews.set(b.id,b)
   const row={business:b,task,tracking,removed,contacted,emailCount,callCount,replied,storySubmitted,checkRequested,listingOrdered,servicesOrdered,needed:eligible,firstDate:first||'',review}
   c.rows.push(row);for(const e of contacts)c.emailRecords.add(e.source_message_id||e.id||e);c.emails+=manualExtra&&(tracking.channel||'Email')==='Email'?1:0;c.calls+=callCount
   const variants=new Set(contacts.map(e=>messageSummary(e).campaignVariant||'Original / unlabelled'))
   if(manualExtra)variants.add(tracking.variant||'Original / unlabelled')
   if(calls.length)for(const call of calls)variants.add(metadata(call).appointmentManager.campaignVariant||'Original / unlabelled')
   for(const variant of variants){if(!c.variants.has(variant))c.variants.set(variant,{name:variant,contacted:new Set(),replied:new Set()});const v=c.variants.get(variant);v.contacted.add(b.id);if(replied&&(variants.size===1||tracking.variant===variant&&tracking.replied||replies.some(e=>messageSummary(e).campaignVariant===variant)))v.replied.add(b.id)}
  }
 }
 for(const c of result){c.emails+=c.emailRecords.size;c.groups={emailed:c.rows.filter(r=>r.emailCount>0).map(r=>r.business),called:c.rows.filter(r=>r.callCount>0).map(r=>r.business)};for(const key of ['contacted','needed','replied','storySubmitted','checkRequested','listingOrdered','servicesOrdered'])c.groups[key]=c.rows.filter(r=>r[key]).map(r=>r.business).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true}));c.rate=c.groups.contacted.length?100*c.groups.replied.length/c.groups.contacted.length:null;c.variants=[...c.variants.values()].map(v=>({name:v.name,contacted:v.contacted.size,replied:v.replied.size,rate:v.contacted.size?100*v.replied.size/v.contacted.size:null}))}
 return {campaigns:result,reviews:[...reviews.values()].sort((a,b)=>a.name.localeCompare(b.name))}
}
