import {isTown,metadata} from './portfolio.js'
import {profileSummary,contactSummary} from './profile-summary.js'
import {leadScores,PLATFORMS} from './intelligence.js'
import {safeUrl,businessMessages,messageSummary} from './domain.js'

export const REPORT_TYPES=[
 ['overview','Business overview','See all businesses, review progress, ratings, and client decisions.'],
 ['clients','Client opportunities','Find businesses to pursue and the services they may need.'],
 ['networking','Networking opportunities','Review potential partners and discounted or free-service opportunities.'],
 ['gaps','Visibility gaps','Find verified weak or missing websites, Google listings, and social accounts.'],
 ['coverage','Research coverage','See what has been reviewed and what still needs research.'],
 ['outreach','Outreach & follow-through','Review communication history, pending actions, and follow-up dates.'],
]
export const OUTREACH_DECISIONS=['Not decided','Pursue as a client','Stop outreach','Not a match','Potential networking opportunity','Offer a discount','Offer free service']
export function decisionFor(business){const decision=metadata(business).outreachDecision;return ['Do not contact','No outreach'].includes(decision)?'Stop outreach':decision||'Not decided'}
export function reportBusinesses(data){return data.businesses.filter(b=>b.status!=='Archived'&&!isTown(b))}
export function buildBusinessReport(data,bi,options,generatedAt=new Date().toISOString()){
 const tasksByBusiness=new Map(),emailsByBusiness=new Map(),listingsByBusiness=new Map()
 const add=(map,id,row)=>{if(!id)return;if(!map.has(id))map.set(id,[]);map.get(id).push(row)}
 for(const task of data.tasks||[])add(tasksByBusiness,task.business_id,task)
 for(const email of data.emails||[])for(const id of new Set([email.business_id,...email.related_business_ids||[]]))add(emailsByBusiness,id,email)
 for(const listing of data.listings||[])if(listing.status!=='Archived')add(listingsByBusiness,listing.business_id,listing)
 const profiles=new Map((bi.profiles||[]).map(p=>[p.business_id,p])), settings=bi.settings?.[0]?.config||{}
 const latest=new Map();for(const run of [...bi.research||[]].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))))if(!latest.has(run.business_id)&&run.status!=='Rejected')latest.set(run.business_id,run)
 const scoped=reportBusinesses(data).filter(b=>{
  const sites=new Set((listingsByBusiness.get(b.id)||[]).map(l=>l.site))
  return (options.scope==='Both sites'||options.scope==='All businesses'||options.scope==='Selected businesses'||sites.has(options.scope))&&
   (options.scope!=='Both sites'||sites.size>0)&&(options.scope!=='Selected businesses'||options.selected.includes(b.id))&&
   (!options.town||b.city===options.town)&&(!options.category||(b.categories||[]).includes(options.category))&&
   (!options.decision||decisionFor(b)===options.decision)&&(!options.search||[b.name,b.city,b.contact_name,b.email].join(' ').toLowerCase().includes(options.search.toLowerCase()))
 })
 let rows=scoped.map(b=>{
  const profile=profiles.get(b.id),run=latest.get(b.id),assessment=profile?.approved_at?profile.approved||{}:{},decision=decisionFor(b)
  const platforms=[...new Set([...PLATFORMS,...Object.keys(assessment.platforms||{})])].map(name=>({name,...assessment.platforms?.[name]}))
  const gaps=platforms.filter(p=>p.state!=='Not Applicable'&&p.relevant!==false&&(p.state==='Missing'||Number.isFinite(p.score)&&p.score<=2))
  const unknown=platforms.filter(p=>!p.state||['Not Researched','Unable to Verify'].includes(p.state))
  const records={...data,tasks:tasksByBusiness.get(b.id)||[],emails:emailsByBusiness.get(b.id)||[],listings:listingsByBusiness.get(b.id)||[]}
  const review=profileSummary(b,records,profile),scores=leadScores(assessment,profile?.crm,settings),contact=contactSummary(b,records,profile)
  const messages=businessMessages(records,b.id).sort((a,b)=>String(b.occurred_on||'').localeCompare(String(a.occurred_on||''))).map(m=>({...m,...messageSummary(m)}))
  const stopped=decision==='Stop outreach'||profile?.crm?.do_not_contact===true
  const next=stopped?'Stop outreach':decision==='Not a match'?'Directory communication only':contact.actions[0]?.title|| (gaps.length?'Review the visibility gaps with this business':unknown.length?'Complete the missing research':'Review business goals and choose the next step')
  return {business:b,profile,run,assessment,decision,stopped,platforms,gaps,unknown,review,scores,contact,messages,next,sites:[...new Set((listingsByBusiness.get(b.id)||[]).map(l=>l.site))],reason:metadata(b).outreachReason||assessment.summary||''}
 })
 rows=rows.filter(r=>options.type==='clients'? !r.stopped&&r.business.kind!=='Partner-owned Business'&&r.decision!=='Not a match'&&(r.decision==='Pursue as a client'||r.gaps.length>0||r.scores.priority>=60):options.type==='networking'? !r.stopped&&r.decision!=='Not a match'&&['Potential networking opportunity','Offer a discount','Offer free service'].includes(r.decision):options.type==='gaps'?r.gaps.length>0:options.type==='coverage'?r.review.percent<100||r.unknown.length>0:options.type==='outreach'?r.messages.length>0||r.contact.actions.length>0||r.stopped:options.type==='overview')
 rows.sort(options.sort==='Priority'?((a,b)=>(b.scores.priority??-1)-(a.scores.priority??-1)||a.business.name.localeCompare(b.business.name)):options.sort==='Needs review'?((a,b)=>a.review.percent-b.review.percent||a.business.name.localeCompare(b.business.name)):((a,b)=>a.business.name.localeCompare(b.business.name,'en',{numeric:true,sensitivity:'base'})))
 const rated=rows.filter(r=>r.review.rating!==null)
 return {options:structuredClone(options),generatedAt,scopedCount:scoped.length,rows,summary:{businesses:rows.length,reviewed:rows.filter(r=>r.review.percent===100).length,needsResearch:rows.filter(r=>r.unknown.length).length,visibilityGaps:rows.reduce((n,r)=>n+r.gaps.length,0),averageRating:rated.length?rated.reduce((n,r)=>n+r.review.rating,0)/rated.length:null,rated:rated.length,stopped:rows.filter(r=>r.stopped).length,networking:rows.filter(r=>['Potential networking opportunity','Offer a discount','Offer free service'].includes(r.decision)).length}}
}
export function businessReportCsv(report){return report.rows.map(r=>({Business:r.business.name,City:r.business.city,Directories:r.sites.join('; '),'Client decision':r.decision,'Decision notes':r.reason,'Overall rating':r.review.rating??'Not rated','Review complete':`${r.review.percent}%`,'Research gaps':r.unknown.map(p=>p.name).join('; '),'Visibility gaps':r.gaps.map(p=>`${p.name}: ${p.state==='Missing'?'Missing':p.score+'/5'}`).join('; '),'Digital presence':r.platforms.map(p=>`${p.name}: ${p.state==='Not Applicable'?'N/A':p.state==='Missing'?'Missing':Number.isFinite(p.score)?p.score+'/5':p.state||'Not researched'}`).join('; '),'Lead priority':r.scores.priority??'Unknown','Next step':r.next,'Last contact':r.messages[0]?.occurred_on||'Not recorded','Evidence links':r.platforms.flatMap(p=>(p.evidence||[]).map(e=>e.url)).join('; '),'Report generated':report.generatedAt}))}

export function printableBusinessReport(report){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
 const title=REPORT_TYPES.find(([key])=>key===report.options.type)?.[1]||'Business report'
 const blocks=report.rows.map(r=>`<article><h2>${escape(r.business.name)}</h2><p>${escape(r.business.city)} · ${escape(r.sites.join(' · '))}</p><p><strong>${escape(r.decision)}</strong> · Rating: ${r.review.rating===null?'Not rated':escape(r.review.rating.toFixed(1)+' / 5')} · Review: ${r.review.percent}%</p><p>Next: ${escape(r.next)}</p>${r.reason?`<p>${escape(r.reason)}</p>`:''}<h3>Ratings &amp; evidence</h3>${r.platforms.map(p=>`<section><strong>${escape(p.name)}</strong>: ${escape(p.state==='Not Applicable'?'N/A':p.state==='Missing'?'Missing':Number.isFinite(p.score)?p.score+' / 5':p.state||'Not researched')}${p.explanation?`<p>${escape(p.explanation)}</p>`:''}${(p.evidence||[]).filter(e=>safeUrl(e.url)).map(e=>`<p><a href="${escape(safeUrl(e.url))}">${escape(e.url)}</a>${e.note?' · '+escape(e.note):''}</p>`).join('')}</section>`).join('')}<h3>Communication</h3>${r.messages.length?r.messages.map(m=>`<p><strong>${escape(m.subject||'Message')}</strong> · ${escape(m.occurred_on||'Date unknown')} · ${escape(m.direction)} · ${escape(m.status)}<br>${escape(m.summary||'')}${m.next_action?'<br>Next: '+escape(m.next_action):''}</p>`).join(''):'<p>No messages recorded.</p>'}</article>`).join('')
 return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)} — MKT Visibility</title><style>body{font:13px Arial,sans-serif;color:#203847;line-height:1.5;max-width:900px;margin:30px auto;padding:0 20px}h1,h2{color:#244c62}article{border-top:1px solid #cedde4;margin-top:30px;padding-top:15px}section{margin:12px 0;break-inside:avoid}a{color:#235747;overflow-wrap:anywhere}@media print{article{break-before:page}article:first-of-type{break-before:auto}body{margin:0}}</style></head><body><h1>${escape(title)}</h1><p>MKT Visibility · ${escape(report.options.scope)} · ${report.rows.length} businesses</p><p>Generated ${escape(report.generatedAt)} · Saved reviews only</p><p>${report.summary.reviewed} fully reviewed · ${report.summary.needsResearch} need research · ${report.summary.visibilityGaps} reviewed visibility gaps</p><p>Unknown information is not a poor score. N/A steps are excluded from review progress.</p>${blocks}</body></html>`
}
