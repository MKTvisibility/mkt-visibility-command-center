import {BRANDS} from './domain.js'
import {metadata,encodeMetadata,isTownWork,brandOf} from './portfolio.js'
import {canonicalProfileTasks,categoryOf} from './category-profile.js'
import {inactiveBusiness} from './business-report.js'
import {hydrateTask} from './task-evidence.js'
import {plusDays} from './outreach-workflow.js'
export const PROJECT_BRANDS=['MKT Visibility','Loving Longmont','MKT Colorado']
export const isProjectSession=t=>metadata(t).recordType==='workProject'
export function isContactActivity(t){
 const m=metadata(t),key=m.businessChecklistKey||''
 if(isProjectSession(t)||isTownWork(t)||key.startsWith('correspondence:'))return false
 if(m.appointmentManager)return true
 if(key.endsWith(':verify')||/^(verify|review|check)\b.*\b(listing updates|live page|business page)\b/i.test(t.title||''))return false
 return ['Email','Phone call'].includes(m.contactChannel)||['correspondence','maintenance'].includes(categoryOf(t))
}
export function projectGroups(data){
 const sessions=new Map(),tasksByBusiness=new Map(),sites=new Map()
 for(const t of data.tasks){if(isProjectSession(t)){const key=metadata(t).projectKey;if(!sessions.has(key))sessions.set(key,[]);sessions.get(key).push(t);continue}if(!tasksByBusiness.has(t.business_id))tasksByBusiness.set(t.business_id,[]);tasksByBusiness.get(t.business_id).push(hydrateTask(t))}
 for(const l of data.listings){if(l.status==='Archived')continue;if(!sites.has(l.business_id))sites.set(l.business_id,new Set());sites.get(l.business_id).add(l.site)}
 const finish=g=>{const applicable=g.tasks.filter(t=>t.status!=='Cancelled');return {...g,sessions:sessions.get(g.key)||[],total:applicable.length,done:applicable.filter(t=>t.status==='Done').length,remaining:applicable.filter(t=>t.status!=='Done'),complete:applicable.length>0&&applicable.every(t=>t.status==='Done')}}
 const operations=PROJECT_BRANDS.map(brand=>finish({key:'operations:'+brand,name:brand,kind:'Operations',brands:[brand],tasks:data.tasks.filter(t=>{const b=data.businesses.find(b=>b.id===t.business_id),m=metadata(t);return !isProjectSession(t)&&!isTownWork(t)&&!m.deferredTownWork&&!isContactActivity(t)&&(!b||BRANDS.includes(b.name))&&brandOf(t,data)===brand&&(!m.businessChecklistKey||m.operationsTask)}).map(hydrateTask).sort((a,b)=>(metadata(a).projectOrder??1000)-(metadata(b).projectOrder??1000)||a.title.localeCompare(b.title))}))
 const businesses=data.businesses.filter(b=>!BRANDS.includes(b.name)&&b.kind!=='Partner-owned Business'&&!inactiveBusiness(b)&&[...(sites.get(b.id)||[])].some(s=>['Loving Longmont','MKT Colorado'].includes(s))).map(b=>{
  const scoped={...data,tasks:tasksByBusiness.get(b.id)||[],businesses:[b],listings:data.listings.filter(l=>l.business_id===b.id),emails:(data.emails||[]).filter(e=>e.business_id===b.id)}
  return finish({key:'business:'+b.id,name:b.name,businessId:b.id,kind:'Business page',brands:[...(sites.get(b.id)||[])],tasks:canonicalProfileTasks(b,scoped).filter(t=>['research','listing'].includes(categoryOf(t))&&!isContactActivity(t))})
 }).sort((a,b)=>a.name.localeCompare(b.name,'en',{sensitivity:'base',numeric:true}))
 return [...operations,...businesses]
}
export function projectSession(project,date,existing){
 return {...existing,title:project.name,type:'Project',status:'Open',priority:existing?.priority||'Normal',assignee:existing?.assignee||'Michelle',business_id:null,due_date:date||null,notes:encodeMetadata(existing||{},{recordType:'workProject',projectKey:project.key,projectBusinessId:project.businessId||null,brand:project.brands.includes('Loving Longmont')?'Loving Longmont':project.brands[0],text:'Scheduled project work session. Individual checkboxes remain inside the project; contact activities remain in Appointment Manager.'})}
}
export function nextWeekday(date){let d=date;while([0,6].includes(new Date(d+'T12:00:00Z').getUTCDay()))d=plusDays(d,1);return d}
