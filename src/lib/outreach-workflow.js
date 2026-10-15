import {awaitingDiscoveryReview} from './discovery.js'
import {businessMessages, BRANDS} from './domain.js'
import {metadata,encodeMetadata} from './portfolio.js'
import {profileTask,workflowTask,taskNotApplicable} from './profile-workflow.js'
export const PRE_CONTACT=[['research','Review official website and social profiles'],['basics','Verify business name, contact person and contact information'],['qa','Check the live listing, images and links'],['history','Review previous messages and contact restrictions'],['prep:rating','Complete visibility review and lead rating'],['prep:opportunity','Record a specific opportunity we can help with'],['prep:message','Prepare a personalized first message']]
export const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
export function plusDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
export function blocked(b,p){return awaitingDiscoveryReview(b)||b.status==='Archived'||BRANDS.includes(b.name)||b.kind==='Partner-owned Business'||p?.crm?.do_not_contact||['Stop outreach','Do not contact','No outreach','Not a match'].includes(metadata(b).outreachDecision)}
export function firstContact(b,data){const intro=profileTask(data,b,'intro');if(intro?.status==='Done'&&!taskNotApplicable(intro))return metadata(intro).evidenceCompletion?.date||intro.due_date||intro.completed_at?.slice(0,10)||null;return businessMessages(data,b.id).filter(e=>e.direction==='Outbound'&&e.status==='Sent'&&e.message_type!=='Automatic'&&e.occurred_on).map(e=>e.occurred_on).sort()[0]||null}
export function hasContact(b,data){return Boolean(firstContact(b,data))||profileTask(data,b,'intro')?.status==='Done'}
export function ready(b,data,p){return !blocked(b,p)&&!hasContact(b,data)&&metadata(b).outreachDecision&&metadata(b).outreachDecision!=='Not decided'&&PRE_CONTACT.every(([key])=>{const t=profileTask(data,b,key);return t?.status==='Done'||taskNotApplicable(t)})}
export function followupTask(b,data,key,title,date,status='Open'){return {...workflowTask(b,data,key,title),type:'Follow-up',status,assignee:'Michelle',due_date:date,notes:encodeMetadata({},{businessChecklistKey:key,checklistGroup:'First contact follow-through',area:'Sales',text:'Complete only after the actual work or contact. Scheduled emails are reminders, not automatic sends.'})}}
export function sequence(b,data,date=day()){
 if(businessMessages(data,b.id).some(e=>e.direction==='Inbound'&&e.status==='Received'&&e.message_type!=='Automatic'&&e.occurred_on>=date))return []
 const rows=[followupTask(b,data,'story_request','Email business story request if no response',plusDays(date,7)),followupTask(b,data,'outreach:listing_reminder','Email reminder to verify listing if no response to anything',plusDays(date,21))]
 return rows.flatMap(t=>{const existing=profileTask(data,b,metadata(t).businessChecklistKey);return !existing?[t]:!existing.due_date&&!['Done','Cancelled'].includes(existing.status)?[{...existing,type:'Follow-up',due_date:t.due_date}]:[]})
}
export function responseSequence(b,data,kind,date=day()){
 const key=`outreach:${kind}`
 return [followupTask(b,data,`${key}:verify`,kind==='story'?'Verify business story is added to the live page':'Verify requested listing updates are live',date),followupTask(b,data,`${key}:confirm`,kind==='story'?'Email live story link and invite a Free Visibility Check':'Email confirmation of listing changes and invite a Free Visibility Check',date,'Blocked')].filter(t=>!profileTask(data,b,metadata(t).businessChecklistKey))
}
