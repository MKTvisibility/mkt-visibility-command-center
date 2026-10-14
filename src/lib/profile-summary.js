import {PLATFORMS} from './intelligence.js'
import {profileTask,taskNotApplicable} from './profile-workflow.js'
import {businessMessages,messageSummary,localDay} from './domain.js'
import {metadata} from './portfolio.js'
import {hydrateTask} from './task-evidence.js'

export function pendingContactTasks(business,data) {
 const records={...data,tasks:data.tasks.filter(t=>t.business_id===business.id).map(hydrateTask)}
 const finished=key=>{const task=profileTask(records,business,key);return task?.status==='Done'&&!taskNotApplicable(task)}
 const prerequisites={report:'audit',followup_email_1:'report',followup_phone_2:'followup_email_1',followup_email_3:'followup_phone_2'}
 return records.tasks.filter(task=>{
  if(['Done','Cancelled','Waiting on Client','Blocked'].includes(task.status)||taskNotApplicable(task))return false
  const key=metadata(task).businessChecklistKey
  if(key&&profileTask(records,business,key)!==task)return false
  if(key&&prerequisites[key]&&!finished(prerequisites[key]))return false
  if(key==='followup'&&!finished('intro'))return false
  if(key)return ['intro','story_request','offer','report','followup','followup_email_1','followup_phone_2','followup_email_3'].includes(key)||key.startsWith('outreach:')&&!key.endsWith(':verify')
  return task.type==='Follow-up'||/\b(send|email|call|contact)\b/i.test(task.title||'')&&!/\b(review|verify|record|research)\b/i.test(task.title||'')
 })
}

export const isProfilePilot = business => String(business.name || '').toLowerCase().replace(/[^a-z0-9]/g,'') === 'apetsplaceanimalhospital'
export const REVIEW_STEPS = [
  ['basics','Verify business name and contact details'],
  ['description','Verify the description and categories'],
  ['image','Check the business image or logo'],
  ['qa','Review their business page on our site'],
]
export function profileSummary(business,data,profile) {
  const platforms=profile?.approved_at ? profile.approved?.platforms || {} : {}
  const names=[...new Set([...PLATFORMS,...Object.keys(platforms)])]
  const steps=[...REVIEW_STEPS,...names.filter(name=>platforms[name]?.state!=='Not Applicable').map(name=>[`rating:${name}`,`Review ${name==='Google Business Profile'?'Google listing & reviews':name}`])]
  const applicableSteps=steps.filter(([key])=>!taskNotApplicable(profileTask(data,business,key)))
  const done=applicableSteps.filter(([key])=>profileTask(data,business,key)?.status==='Done').length
  const scores=Object.values(platforms).filter(p=>p.state==='Rated'&&p.relevant!==false&&Number.isFinite(p.score)&&p.score>=1&&p.score<=5).map(p=>p.score)
  return {steps,done,total:applicableSteps.length,notApplicable:steps.length-applicableSteps.length,percent:applicableSteps.length?Math.round(done/applicableSteps.length*100):100,rating:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,ratedCount:scores.length}
}
export function contactSummary(business,data,profile,today=localDay()) {
  if(profile?.crm?.do_not_contact)return {label:'Do not contact',tone:'blocked',actions:[]}
  const actions=[]
  for(const task of pendingContactTasks(business,data))actions.push({title:task.title,date:task.due_date||''})
  for(const email of businessMessages(data,business.id)) {
    const detail=messageSummary(email)
    if(detail.response_status==='Closed')continue
    if(detail.response_status==='Needs our reply'||detail.response_status==='Follow up'||['Draft','Planned'].includes(email.status)||detail.follow_up_on)actions.push({title:detail.next_action||email.subject||'Contact business',date:detail.follow_up_on||''})
  }
  if(profile?.crm?.next_follow_up)actions.push({title:'Sales follow-up',date:profile.crm.next_follow_up})
  actions.sort((a,b)=>(a.date||today).localeCompare(b.date||today)||a.title.localeCompare(b.title,'en',{numeric:true,sensitivity:'base'}))
  const due=actions.filter(a=>!a.date||a.date<=today)
  return due.length?{label:'Contact due',tone:'due',actions:due}:actions.length?{label:`Contact scheduled · ${actions[0].date}`,tone:'scheduled',actions}:{label:'No contact task recorded',tone:'quiet',actions:[]}
}

export function portfolioProfileSummary(data,profiles){
 const byId=new Map(profiles.map(p=>[p.business_id,p])),tasks=new Map(),emails=new Map()
 for(const [records,map] of [[data.tasks,tasks],[data.emails,emails]])for(const r of records){if(!map.has(r.business_id))map.set(r.business_id,[]);map.get(r.business_id).push(r)}
 let reviewed=0,partial=0;const ratings=[]
 const outreach=[['intro','First contact email'],['story_request','Business story request'],['offer','Visibility Check invitation'],['report','Visibility Check report'],['followup','Follow-up emails']].map(([key,label])=>({key,label,count:0,businesses:[]}))
 for(const b of data.businesses){
  const records={...data,tasks:tasks.get(b.id)||[],emails:emails.get(b.id)||[]},p=byId.get(b.id),review=profileSummary(b,records,p)
  if(review.done===review.total)reviewed++;else if(review.done)partial++
  if(review.rating!==null)ratings.push(review.rating)
  if(b.status!=='Archived'&&!p?.crm?.do_not_contact){
   for(const group of outreach){
    const actionable=pendingContactTasks(b,records)
    const matches=group.key==='followup'?records.tasks.map(hydrateTask).filter(t=>t.type==='Follow-up'||/follow.up.*email/i.test(t.title||'')):records.tasks.map(hydrateTask).filter(t=>metadata(t).businessChecklistKey===group.key)
    const pending=matches.filter(t=>!['Done','Cancelled'].includes(t.status))
    if(pending.length){
     const next=pending.filter(t=>actionable.some(a=>a.id?a.id===t.id:a===t)&&(!t.due_date||t.due_date<=localDay())).sort((a,b)=>a.title.localeCompare(b.title,'en',{numeric:true}))[0]
     if(next){group.count++;group.businesses.push({business:b,nextAction:next.title})}
     break
    }
   }
  }
 }
 for(const group of outreach)group.businesses.sort((a,b)=>a.business.name.localeCompare(b.business.name,'en',{numeric:true,sensitivity:'base'}))
 return {total:data.businesses.length,reviewed,partial,contactDue:outreach.reduce((sum,g)=>sum+g.count,0),outreach,rated:ratings.length,rating:ratings.length?ratings.reduce((a,b)=>a+b,0)/ratings.length:null,percent:data.businesses.length?Math.round(reviewed/data.businesses.length*100):0}
}

export function businessRatingGroups(data,profiles){
 const groups=[5,4,3,2,1,0].map(stars=>({stars,label:stars?`${stars} out of 5`:'Not rated yet',businesses:[]})),byId=new Map(profiles.map(p=>[p.business_id,p]))
 for(const business of data.businesses){const rating=profileSummary(business,{...data,tasks:[]},byId.get(business.id)).rating;groups.find(g=>g.stars===(rating===null?0:Math.round(rating))).businesses.push({business,rating})}
 for(const group of groups)group.businesses.sort((a,b)=>a.business.name.localeCompare(b.business.name,'en',{sensitivity:'base',numeric:true}))
 return groups
}

export function siteReviewGroups(data,profiles){
 const byId=new Map(profiles.map(p=>[p.business_id,p])),groups=[]
 for(const site of ['Loving Longmont','MKT Colorado']){
  const ids=new Set(data.listings.filter(l=>l.site===site&&l.status!=='Archived').map(l=>l.business_id)),businesses=[]
  for(const business of data.businesses.filter(b=>ids.has(b.id))){const review=profileSummary(business,{...data,tasks:data.tasks.filter(t=>t.business_id===business.id)},byId.get(business.id));businesses.push({business,reviewText:`${review.done} of ${review.total} steps · ${review.percent}%`,complete:review.done===review.total})}
  businesses.sort((a,b)=>a.business.name.localeCompare(b.business.name,'en',{sensitivity:'base',numeric:true}))
  const reviewed=businesses.filter(r=>r.complete),remaining=businesses.filter(r=>!r.complete)
  groups.push({key:site,label:site,businesses,total:businesses.length,reviewed:reviewed.length},{key:site+':reviewed',label:site+' — reviewed',businesses:reviewed},{key:site+':remaining',label:site+' — needs review',businesses:remaining})
 }
 return groups
}
