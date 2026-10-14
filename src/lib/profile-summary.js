import {PLATFORMS} from './intelligence.js'
import {profileTask} from './profile-workflow.js'
import {businessMessages,messageSummary,localDay} from './domain.js'
import {metadata} from './portfolio.js'

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
  const done=steps.filter(([key])=>profileTask(data,business,key)?.status==='Done').length
  const scores=Object.values(platforms).filter(p=>p.state==='Rated'&&p.relevant!==false&&Number.isFinite(p.score)&&p.score>=1&&p.score<=5).map(p=>p.score)
  return {steps,done,total:steps.length,percent:Math.round(done/steps.length*100),rating:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null,ratedCount:scores.length}
}
export function contactSummary(business,data,profile,today=localDay()) {
  if(profile?.crm?.do_not_contact)return {label:'Do not contact',tone:'blocked',actions:[]}
  const actions=[]
  const contactKeys=['intro','story_request','offer','report','next']
  for(const task of data.tasks.filter(t=>t.business_id===business.id&&!['Done','Cancelled','Waiting on Client','Blocked'].includes(t.status))) {
    if(contactKeys.includes(metadata(task).businessChecklistKey)||task.type==='Follow-up'||/\b(email|contact|follow.up)\b/i.test(task.title||''))actions.push({title:task.title,date:task.due_date||''})
  }
  for(const email of businessMessages(data,business.id)) {
    const detail=messageSummary(email)
    if(detail.response_status==='Closed')continue
    if(detail.response_status==='Needs our reply'||detail.response_status==='Follow up'||['Draft','Planned'].includes(email.status)||detail.follow_up_on)actions.push({title:detail.next_action||email.subject||'Contact business',date:detail.follow_up_on||''})
  }
  if(profile?.crm?.next_follow_up)actions.push({title:'Sales follow-up',date:profile.crm.next_follow_up})
  actions.sort((a,b)=>(a.date||today).localeCompare(b.date||today))
  const due=actions.filter(a=>!a.date||a.date<=today)
  return due.length?{label:'Contact due',tone:'due',actions:due}:actions.length?{label:`Contact scheduled · ${actions[0].date}`,tone:'scheduled',actions}:{label:'No contact task recorded',tone:'quiet',actions:[]}
}
