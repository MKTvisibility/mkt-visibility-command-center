import VisibilityWorkflow from './VisibilityWorkflow.jsx'
import {researchMatchesBusiness,reportAssessment} from './lib/visibility-report.js'
import EmailApproval from './EmailApproval.jsx'
import {useEffect,useEffectEvent,useRef,useState} from 'react'
import {metadata,encodeMetadata} from './lib/portfolio.js'
import {businessMessages,messageSummary,safeUrl,localDay,currency} from './lib/domain.js'
import {taskNotApplicable} from './lib/profile-workflow.js'
import {WORK_CATEGORIES,TOPICS,CONVERSATION_STATES,categoryOf,canonicalProfileTasks,categorySummary,changeTaskStatus,conversationTask,conversationStatus,conversationUpdate} from './lib/category-profile.js'

function ProfileSection({title,children,className='',id,open,onToggle,summary}){
 return <details id={id} className={`profile-fold ${className}`} open={open} onToggle={onToggle}><summary><h3>{title}</h3>{summary&&<small>{summary}</small>}<span className="profile-fold-hint" aria-hidden="true">{open?'Collapse':'Expand'}</span></summary><div className="profile-fold-body">{children}</div></details>
}

export default function CategoryProfile({business,client,data,member,writable,onClose,onEdit,onAdd,onSave,repository,onBusinessSaved,onSchedule,components}){
 const {BusinessBasics,ProfileRatings,LiveBusinessPage,OutreachDecision,InternalNotes}=components
 const emailLayoutPilot=true
 const [tab,setTab]=useState('Overview'),[profile,setProfile]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[undo,setUndo]=useState(null),[notice,setNotice]=useState('')
 const [closed,setClosed]=useState({})
 const [seo,setSeo]=useState(null),[seoBusy,setSeoBusy]=useState(false),[seoError,setSeoError]=useState('')
 const [reportOpen,setReportOpen]=useState(false),[reportPayload,setReportPayload]=useState(null)
 const pilotVisibilityBusiness=business.id==='f632d5d8-bf5a-5900-b1d5-40c4035db7cb'
 const [researchRuns,setResearchRuns]=useState([])
 const [researchJob,setResearchJob]=useState(null),[researchBusy,setResearchBusy]=useState(false),[researchError,setResearchError]=useState('')
 const pilotAiTasks=(data.tasks||[]).filter(t=>t.business_id===business.id&&t.title?.startsWith('Have AI Run Visibility Check:'))
 useEffect(()=>{if(!client)return;let active=true;client.from('cc_visibility_research_runs').select('id,business_id,researched_at,status,research').eq('business_id',business.id).order('researched_at',{ascending:false}).limit(20).then(({data,error})=>{if(active){if(error)setError(error.message);else setResearchRuns((data||[]).filter(r=>researchMatchesBusiness(r,business)))}});return()=>{active=false}},[client,business])
 async function runVisibility(platforms){
  if(!repository?.intelligence?.runVisibility){setResearchError('Connect to the live workspace to run automatic research.');return}
  setResearchBusy(true);setResearchError('');setNotice('');setReportOpen(false)
  try{const job=await repository.intelligence.runVisibility(business.id,Array.isArray(platforms)?platforms:undefined);setResearchJob({id:job.job_id,business_id:business.id,status:job.status});if(!platforms&&safeUrl(business.website)&&repository?.seoAudit)runSeoAudit()}
  catch(e){setResearchError(e.message);setResearchBusy(false)}
 }
 const finishResearch=useEffectEvent(async job=>{
  const rows=(await repository.intelligence.visibilityRuns(business.id)).filter(r=>researchMatchesBusiness(r,business))
  const completed=rows.find(r=>r.research?.job_id===job.id)
  if(!completed)throw Error('Research finished but its business-specific report was not found. Please retry.')
  const ordered=[completed,...rows.filter(r=>r.id!==completed.id)]
  setResearchRuns(ordered);setResearchBusy(false);setNotice('Research complete. Your business-specific report is ready.')
  await openCurrentVisibilityReport(ordered)
 })
 useEffect(()=>{
  if(!repository?.intelligence?.visibilityJob)return
  let active=true,timer
  const poll=async()=>{
   try{
    const job=await repository.intelligence.visibilityJob(business.id)
    if(!active)return
    if(!job){setResearchBusy(false);return}
    if(['Queued','Running'].includes(job.status)){
     setResearchBusy(true);setResearchJob(current=>current?.id===job.id?current:job)
     if(job.started_at&&Date.now()-new Date(job.started_at).getTime()>180000){setResearchBusy(false);setResearchError('The research run is taking longer than expected. Reopen this profile to check its status.');return}
     timer=setTimeout(poll,3000);return
    }
    setResearchBusy(false)
    if(researchJob?.id===job.id){
     if(['Failed','Blocked','Canceled'].includes(job.status))setResearchError(job.error||'Research could not finish. Retry the check.')
     else await finishResearch(job)
    }
   }catch(e){if(active){setResearchBusy(false);setResearchError(e.message)}}
  }
  poll()
  return()=>{active=false;clearTimeout(timer)}
 },[repository,business.id,researchJob?.id])
 async function updateResearchDraft(run,research){if(!client)throw Error('Live database connection unavailable');if(run.status!=='draft')throw Error('Approved research cannot be edited.');const {error}=await client.from('cc_visibility_research_runs').update({research}).eq('id',run.id).eq('business_id',business.id).eq('status','draft');if(error)throw error;setResearchRuns(rows=>rows.map(r=>r.id===run.id?{...r,research}:r));}
 const reportFrame=useRef(null)
 useEffect(()=>{
  if(!reportOpen)return
  const send=()=>{if(reportPayload&&reportFrame.current?.contentWindow)reportFrame.current.contentWindow.postMessage({type:'mkt-business-visibility-payload',payload:reportPayload},window.location.origin)}
  const receive=e=>{if(e.origin===window.location.origin&&e.source===reportFrame.current?.contentWindow&&e.data?.type==='mkt-business-visibility-ready')send()}
  window.addEventListener('message',receive)
  send()
  return ()=>window.removeEventListener('message',receive)
 },[reportOpen,reportPayload])
 const foldIds=['approval','campaigns','work','status','details','appointments','recent','correspondence','scheduled','timeline','notes',...WORK_CATEGORIES.map(([key])=>key)]
 const fold=(id,title,className='pilot-panel',summary)=>({id:`profile-category-${id}`,title,className,summary,open:!closed[id],onToggle:e=>{const isClosed=!e.currentTarget.open;setClosed(current=>Boolean(current[id])===isClosed?current:{...current,[id]:isClosed})}})
 function toggleAll(collapse){setClosed(Object.fromEntries(foldIds.map(id=>[id,collapse])))}
 const lock=useRef(false),tasks=canonicalProfileTasks(business,data,profile),messages=businessMessages(data,business.id)
 const groups=WORK_CATEGORIES.map(([key,label])=>({key,label,...categorySummary(tasks,key)})),core=groups.filter(g=>['research','listing'].includes(g.key)),workDone=core.every(g=>g.complete)
 const topics=TOPICS.map(([key,label,keys])=>({key,label,keys,state:conversationStatus(business,data,key,tasks)})),waiting=topics.filter(t=>t.state==='Waiting for client'),owed=topics.filter(t=>t.state==='We need to respond')
 async function run(fn){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn()}catch(e){setError(e.message)}finally{lock.current=false;setBusy(false)}}
 async function runSeoAudit(){
  if(!safeUrl(business.website)){setSeoError('Add a valid public website URL to this business profile first.');return}
  if(!repository?.seoAudit){setSeoError('SEO scanning requires a connected live workspace.');return}
  setSeoBusy(true);setSeoError('')
  try{const result=await repository.seoAudit(business.website);setSeo(result)}
  catch(e){setSeoError(e.message)}
  finally{setSeoBusy(false)}
 }
 async function openCurrentVisibilityReport(completedRuns){
  const runs=(Array.isArray(completedRuns)?completedRuns:researchRuns).filter(r=>researchMatchesBusiness(r,business))
  setError('');setNotice('');setReportPayload(null);setReportOpen(true)
  let payload={business:{id:business.id,name:business.name,city:business.city,website:business.website,contact_name:business.contact_name},assessment:{platforms:{}},reviewed:{},traffic:null,seo:seo,pilot:pilotVisibilityBusiness,aiFindings:[],approved:false,researchDate:runs[0]?.researched_at||null}
  try{
   const saved=repository?.intelligence?await repository.intelligence.profile(business.id):profile
   payload.assessment=reportAssessment(business,saved,runs[0],data.tasks||[])
   payload.aiFindings=runs.length?runs[0].research?.findings?.map((finding,i)=>({platform:'Visibility finding '+(i+1),finding,status:'Research draft · needs human review',source:runs[0].research?.sources?.[i]||''}))||[]:[]
   payload.aiFindings.push(...pilotAiTasks.map(task=>{const m=metadata(task);return {platform:m.aiVisibilityPlatform||task.title.split(': ').pop(),finding:m.aiResearchFinding||'',source:m.aiResearchSource||'',status:m.aiVisibilityStatus||'Queued for AI research',edited:!!m.aiResearchEditedAt}}).filter(f=>f.finding||f.status))
   payload.research=runs[0]?.research||null
   // Merge the most recently saved editable draft notes into the report preview.
   // Human-approved platform data remains authoritative and is never overwritten.
   const notes=payload.research?.platform_notes||{}
   const socials=payload.research?.social_accounts||[]
   const platforms={...(payload.assessment?.platforms||{})}
   const fromUrl=url=>{const u=String(url||'').toLowerCase();if(u.includes('facebook.com'))return 'Facebook';if(u.includes('instagram.com'))return 'Instagram';if(u.includes('tiktok.com'))return 'TikTok';if(u.includes('linkedin.com'))return 'LinkedIn';if(u.includes('youtube.com'))return 'YouTube';if(u.includes('pinterest.com'))return 'Pinterest';return null}
   const researchNotesFor=name=>{
    if(Object.prototype.hasOwnProperty.call(notes,name))return notes[name]
    if(name==='Website')return payload.research?.website?'Website: '+payload.research.website:''
    if(name==='TikTok'&&payload.research?.tiktok_status)return payload.research.tiktok_status
    if(name==='Other')return [...(payload.research?.findings||payload.research?.opportunities||[]),...(payload.research?.third_party_mentions||payload.research?.mentions||[]).map(m=>'Online mention: '+(m.name||m.url)+' — '+m.url)].join('\n')
    return socials.filter(x=>fromUrl(x.url)===name).map(x=>'Account: '+x.url+(x.verification?' — '+x.verification:'')).join('\n')
   }
   for(const name of new Set([...Object.keys(platforms),...Object.keys(notes),'Website','Google Business Profile','Facebook','Instagram','TikTok','LinkedIn','YouTube','Pinterest','Other'])){
    const p=platforms[name]||{}
    if(payload.reviewed?.[name])continue
    const text=researchNotesFor(name)
    if(text&&!p.explanation)platforms[name]={...p,explanation:text,state:p.state||'Not Researched'}
   }
   payload.assessment={...payload.assessment,platforms}
   payload.reportUpdatedAt=new Date().toISOString()
   if(payload.research?.platform_notes){payload.aiFindings=Object.entries(payload.research.platform_notes).filter(([,finding])=>finding).map(([platform,finding])=>({platform,finding,status:'Research draft · needs human review'})).concat(payload.aiFindings)}
   payload.approved=(data.tasks||[]).some(t=>t.business_id===business.id&&metadata(t).businessChecklistKey==='visibility-report:approved'&&t.status==='Done'&&(!runs[0]||new Date(metadata(t).visibilityReportApprovedAt).getTime()>=new Date(runs[0].researched_at).getTime()))
   const reviewTasks=canonicalProfileTasks(business,data,saved||profile)
   for(const task of reviewTasks){
    const key=metadata(task)?.businessChecklistKey
    if(key?.startsWith('rating:'))payload.reviewed[key.slice(7)]=task.status==='Done'
   }
   // Some task records store the checklist key directly instead of in metadata.
   for(const task of data.tasks||[]){
    if(task.business_id!==business.id)continue
    const key=metadata(task)?.businessChecklistKey
    if(key?.startsWith('rating:'))payload.reviewed[key.slice(7)]=task.status==='Done'
   }
   if(repository?.businessTrafficReport){
    try{
     const listing=await repository.businessListingDate?.(business.id)
     const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
     const end=new Date(new Date(today+'T12:00:00Z').getTime()-86400000).toISOString().slice(0,10)
     const start=listing?.first_listed_at?.slice(0,10)||end
     payload.traffic=await repository.businessTrafficReport(business.id,start,end)
     if(payload.traffic){payload.traffic.start=start;payload.traffic.end=end}
    }catch{ /* A missing analytics connection does not block the visibility proposal. */ }
   }
  }catch(e){setReportOpen(false);setError('Unable to load this business’s visibility report: '+e.message);return}
  finally{setBusy(false)}
  setReportPayload({...payload,research:payload.research?{...payload.research,business_id:business.id}:null})
 }
 function deliverReport(){if(reportPayload&&reportFrame.current?.contentWindow)reportFrame.current.contentWindow.postMessage({type:'mkt-business-visibility-payload',payload:reportPayload},window.location.origin)}
 async function change(rows,choice,label){
  const snapshots=[];setUndo(null);setNotice('')
  try{for(const t of rows){const saved=await onSave('tasks',changeTaskStatus(t,choice));snapshots.push({before:t,after:saved})}}
  finally{if(snapshots.length){setUndo({label,snapshots});setNotice(`${snapshots.length} task${snapshots.length===1?'':'s'} updated. Correspondence status is unchanged.`)}}
 }
 async function undoChange(){const action=undo;let remaining=[...action.snapshots];try{for(const snap of [...action.snapshots].reverse()){const current=data.tasks.find(t=>t.id===snap.after.id);if(current?.updated_at&&snap.after.updated_at&&current.updated_at!==snap.after.updated_at)throw Error('A task changed since this action. Reopen it individually to avoid overwriting newer work.');const before={...snap.before,id:snap.after.id};before.notes=encodeMetadata(before,{statusHistory:[...(metadata(before).statusHistory||[]),{from:snap.after.status,to:before.status,at:new Date().toISOString(),action:'Undo'}].slice(-5)});await onSave('tasks',before);remaining=remaining.filter(s=>s!==snap)}setNotice('Previous task statuses restored.')}finally{setUndo(remaining.length?{...action,snapshots:remaining}:null)}}
 async function changeConversation(topic,state){let reason=null;if(state==='Closed'){reason=window.prompt('Reason for closing: Client declined / We declined - not a good fit / Client requested no further contact / Other. Please enter the reason:');if(reason===null)return;if(!reason.trim()){setError('Please enter a reason for closing this conversation.');return}}const t=conversationTask(business,data,topic),saved=await onSave('tasks',conversationUpdate(t,{state,reason}));setUndo({label:TOPICS.find(t=>t[0]===topic)[1],snapshots:[{before:t,after:saved}]});setNotice('Conversation status saved independently of work completion.')}
 function jump(key){setClosed(current=>({...current,[key]:false}));setTab(emailLayoutPilot?({research:'Work',listing:'Public listing',visibility:'Visibility Check',services:'Sales & payments',maintenance:'Appointments',correspondence:'Messages & notes'}[key]||'Work'):'Work & correspondence');requestAnimationFrame(()=>document.getElementById(`profile-category-${key}`)?.scrollIntoView({behavior:'smooth',block:'start'}))}
 function taskRow(t,correspondence=false){return <div className="category-task" key={t.id||metadata(t).businessChecklistKey}><div><label className="check"><input aria-label={`Complete: ${t.title}`} type="checkbox" checked={t.status==='Done'} disabled={!writable||busy} onChange={e=>run(()=>change([t],e.target.checked?'done':'open',t.title))}/><strong>{t.title}</strong></label><small>{taskNotApplicable(t)?'N/A':t.status}{t.due_date&&` · Due ${t.due_date}`}</small></div>{!correspondence&&<label><span className="sr-only">Status: {t.title}</span><select aria-label={`Status: ${t.title}`} disabled={!writable||busy} value={taskNotApplicable(t)?'na':t.status==='Done'?'done':'open'} onChange={e=>run(()=>change([t],e.target.value,t.title))}><option value="open">To do / reopen</option><option value="done">Done</option><option value="na">N/A</option></select></label>}{!correspondence&&writable&&<button className="text-button" disabled={busy} onClick={()=>t.id?onEdit('tasks',t):onAdd('tasks',t)}>Notes / due date</button>}{!correspondence&&metadata(t).statusHistory?.length>0&&<details className="task-status-history"><summary>Status history</summary>{metadata(t).statusHistory.map((h,i)=><small key={i}>{h.at.slice(0,10)} · {h.from} → {h.to}</small>)}</details>}</div>}
 const workSection=g=><ProfileSection key={g.key} {...fold(g.key,g.label,'pilot-panel',g.complete?'Complete':`${g.open.length} tasks remaining`)}>{writable&&g.key!=='maintenance'&&g.open.length>0&&<div className="actions"><button className="secondary" disabled={busy} onClick={()=>run(()=>change(g.open,'done',g.label))}>Complete remaining tasks in this category</button><button className="text-button" disabled={busy} onClick={()=>run(()=>change(g.open,'na',g.label))}>Mark remaining tasks in this category N/A</button></div>}{g.key==='maintenance'&&<p className="fine">Each appointment is completed or rescheduled individually. Other category actions never affect it.</p>}{g.rows.map(taskRow)}{writable&&<button className="secondary" disabled={busy} onClick={()=>onAdd('tasks',{business_id:business.id,title:g.key==='listing'?`Requested listing update — ${localDay()}`:'',notes:JSON.stringify({format:'mkt-portfolio-v1',profileCategory:g.key,text:''}),...(g.key==='maintenance'?{type:'Follow-up'}:{})})}>{g.key==='listing'?'Add a requested update':'Add task to this category'}</button>}</ProfileSection>
 const correspondenceSection=<ProfileSection {...fold('correspondence','Correspondence by topic')}><p className="fine">Done / Completed means the correspondence is finished. Closed means either party decided not to pursue working together and requires a reason. Sending a message and closing a conversation are separate actions. Change each topic individually; more than one can be waiting at once.</p>{topics.map(topic=><section className="conversation-topic" key={topic.key}><div className="section-head"><h4>{topic.label}</h4><label>Conversation status: {topic.label}<select value={topic.state} disabled={!writable||busy} onChange={e=>run(()=>changeConversation(topic.key,e.target.value))}>{CONVERSATION_STATES.map(state=><option key={state}>{state}</option>)}</select></label></div>{tasks.filter(t=>topic.keys.includes(metadata(t).businessChecklistKey)).map(t=>taskRow(t,true))}{writable&&<div className="actions"><button className="secondary" onClick={()=>onAdd('emails',{business_id:business.id,recipient:business.email,direction:'Inbound',status:'Replied'})}>Record reply / message</button>{!emailLayoutPilot&&<button className="secondary" onClick={()=>onAdd('tasks',{business_id:business.id,type:'Follow-up',title:`${topic.label} follow-up`,notes:JSON.stringify({format:'mkt-portfolio-v1',outreachStage:topic.keys[0],text:'Check for a client reply before contacting.'}),contactChannel:'Email'})}>Schedule email / phone call</button>}</div>}</section>)}<details><summary>Other correspondence actions</summary>{tasks.filter(t=>categoryOf(t)==='correspondence'&&!TOPICS.some(topic=>topic[2].includes(metadata(t).businessChecklistKey))).map(t=>taskRow(t,true))}</details></ProfileSection>
 const ratingsSection=<details className="pilot-panel"><summary>Visibility review & ratings editor</summary><ProfileRatings key={researchRuns[0]?.id||business.id} onRunResearch={runVisibility} researchBusy={researchBusy} business={business} data={data} member={member} repository={repository} writable={writable} onSave={onSave} onProfileLoaded={setProfile} researchRuns={researchRuns} onResearchUpdated={updateResearchDraft}/></details>
 const salesSection=<details className="pilot-panel"><summary>Sales & service records</summary>{(data.purchases||[]).filter(p=>p.business_id===business.id).map(p=><p key={p.id}>{p.product} · {currency(p.amount)} · {p.status} {writable&&<button className="text-button" onClick={()=>onEdit('purchases',p)}>Edit</button>}</p>)}{writable&&<button className="secondary" onClick={()=>onAdd('purchases',{business_id:business.id})}>Record purchase</button>}</details>
 const scheduledContacts=<ProfileSection {...fold('appointments','Appointments')}>{tasks.filter(t=>t.type==='Follow-up'&&!['Done','Cancelled'].includes(t.status)&&(!emailLayoutPilot||!metadata(t).appointmentManager)).map(t=><p key={t.id}><button className="text-button" onClick={()=>writable&&onEdit('tasks',t)}>{t.due_date||'No date'} · {metadata(t).contactChannel||'Follow-up'} · {t.title}</button></p>)}{writable&&<button className="secondary" onClick={()=>onAdd('tasks',{business_id:business.id,type:'Follow-up',assignee:'Michelle'})}>Schedule email / phone call</button>}</ProfileSection>
 const managedAppointments=<ProfileSection {...fold('scheduled','Appointments & follow-ups')}><div className="section-head">{writable&&<button className="primary" onClick={()=>onSchedule(business.id)}>＋ Schedule appointment</button>}</div>{data.tasks.filter(t=>t.business_id===business.id&&metadata(t).appointmentManager).sort((a,b)=>(a.due_date||'').localeCompare(b.due_date||'')).map(t=><p key={t.id}><strong>{t.due_date}</strong> · {metadata(t).appointmentManager?.time} · {t.title} · {metadata(t).appointmentManager?.status}</p>)}{!data.tasks.some(t=>t.business_id===business.id&&metadata(t).appointmentManager)&&<p className="fine">No appointments scheduled yet.</p>}</ProfileSection>
 const recentMessages=<ProfileSection {...fold('recent','Recent messages')}>{messages.slice(0,3).map(m=><p key={m.id}>{m.occurred_on} · {m.status} · {m.subject}</p>)}<button className="text-button" onClick={()=>setTab('Messages & notes')}>Full message timeline →</button></ProfileSection>
 return <section className="card business-profile profile-hub category-profile" aria-label="Category business profile"><div className="section-head"><div><div className="eyebrow">BUSINESS PROFILE</div><h2>{business.name}</h2><p>Work completion and client conversations are tracked independently.</p></div><button className="secondary" onClick={onClose}>Back to businesses</button></div>
  <div className="actions profile-fold-actions"><button type="button" className="secondary" onClick={()=>toggleAll(false)}>Expand all sections</button><button type="button" className="secondary" onClick={()=>toggleAll(true)}>Collapse all sections</button></div><ProfileSection {...fold('approval',emailLayoutPilot?'Email campaign':'Next email & approval')}><EmailApproval showFollowUpDate={!emailLayoutPilot} title={emailLayoutPilot?'Email campaign':undefined} repository={repository} business={business} data={data} writable={writable} onSave={onSave} onEdit={onEdit}/>{emailLayoutPilot&&recentMessages}</ProfileSection><div className="category-overview-grid"><ProfileSection {...fold('work',`Profile work: ${workDone?'Complete':'In progress'}`,`category-overview ${workDone?'complete':''}`)}><p className="fine">Core profile work = research and public listing. Assessments, services and future appointments remain separate.</p>{groups.map(g=><button key={g.key} className="category-summary-link" onClick={()=>jump(g.key)}><span>{g.label}</span><strong>{g.complete?'Complete':g.rows.length?`In progress · ${g.open.length} remaining`:'Not started'}</strong></button>)}</ProfileSection><ProfileSection {...fold('status','Correspondence status','category-overview correspondence-overview')}><p>{owed.length} topics need our response · {waiting.length} waiting for client</p>{topics.map(t=><button key={t.key} className="category-summary-link" onClick={()=>jump('correspondence')}><span>{t.label}</span><strong>{t.state}</strong></button>)}<p className="fine">Completing work never closes these conversations or changes appointments.</p></ProfileSection></div>
  {(notice||undo)&&<div className="info" role="status">{notice}{undo&&<button className="text-button" disabled={busy||!writable} onClick={()=>run(undoChange)}>Undo last change: {undo.label}</button>}</div>}{error&&<p className="error" role="alert">{error}</p>}
  <div className={emailLayoutPilot?"pilot-tabs appointment-tabs":"pilot-tabs"} role="tablist" aria-label="Business profile sections">{['Overview',emailLayoutPilot?'Work':'Work & correspondence','Public listing','Messages & notes',...(emailLayoutPilot?['Appointments','Visibility Check','Sales & payments']:[])].map((name,i)=><button key={name} id={`profile-tab-${i}`} role="tab" aria-controls={`profile-panel-${i}`} aria-selected={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</div>
  <div role="tabpanel" id="profile-panel-0" aria-labelledby="profile-tab-0" hidden={tab!=='Overview'}><div className={emailLayoutPilot?"profile-overview-details":"pilot-columns"}><ProfileSection {...fold('details','Business details')}><p>{business.email}<br/>{business.phone}</p>{safeUrl(business.website)&&<a href={safeUrl(business.website)} target="_blank" rel="noreferrer">Official website ↗</a>}<details><summary>Edit / view business details</summary><BusinessBasics business={business} writable={writable} onSave={onSave}/></details><OutreachDecision business={business} writable={writable} onSave={onSave}/></ProfileSection>{!emailLayoutPilot&&scheduledContacts}</div>{!emailLayoutPilot&&recentMessages}</div>
  <div role="tabpanel" id="profile-panel-1" aria-labelledby="profile-tab-1" hidden={tab!==(emailLayoutPilot?'Work':'Work & correspondence')}><p className="fine">Uncheck a task or select To do / reopen to return its category to In progress. N/A excludes it from required work. You can reopen any task later, even after leaving this page.</p>{groups.filter(g=>!emailLayoutPilot||g.key==='research').map(workSection)}
   {!emailLayoutPilot&&correspondenceSection}
   {!emailLayoutPilot&&ratingsSection}{!emailLayoutPilot&&salesSection}
  </div>
  {!emailLayoutPilot&&managedAppointments}<div role="tabpanel" id="profile-panel-2" aria-labelledby="profile-tab-2" hidden={tab!=='Public listing'}>{emailLayoutPilot&&groups.filter(g=>g.key==='listing').map(workSection)}{tab==='Public listing'&&<LiveBusinessPage business={business} repository={repository} writable={writable} onBusinessSaved={onBusinessSaved}/>}</div>
  <div role="tabpanel" id="profile-panel-3" aria-labelledby="profile-tab-3" hidden={tab!=='Messages & notes'}>{emailLayoutPilot&&tab==='Messages & notes'&&correspondenceSection}<ProfileSection {...fold('timeline','Message timeline')}><div className="section-head">{writable&&<button className="primary" onClick={()=>onAdd('emails',{business_id:business.id,recipient:business.email})}>Add message summary</button>}</div>{messages.map(m=>{const d=messageSummary(m);return <article className="pilot-message" key={m.id}><small>{m.occurred_on||'Date unknown'} · {m.direction} · {m.status}</small><h4>{m.subject}</h4><p>From: {d.sender||'Not recorded'} · To: {m.recipient}</p><p>{d.summary}</p>{d.next_action&&<p className="message-next">Next step: {d.next_action}</p>}{writable&&<button className="text-button" onClick={()=>onEdit('emails',m)}>Edit summary</button>}</article>})}</ProfileSection><ProfileSection {...fold('notes','Internal notes')}><InternalNotes business={business} data={data} member={member} writable={writable} onSave={onSave}/></ProfileSection></div>
  {emailLayoutPilot&&<div role="tabpanel" id="profile-panel-4" aria-labelledby="profile-tab-4" hidden={tab!=='Appointments'}>
   {tab==='Appointments'&&scheduledContacts}{tab==='Appointments'&&managedAppointments}
   <ProfileSection {...fold('maintenance','Follow-ups & maintenance')}><p className="fine">Existing dates, notes and statuses are preserved. Open a scheduled email or phone call above to edit it.</p>{groups.find(g=>g.key==='maintenance')?.rows.filter(t=>t.type!=='Follow-up'&&!metadata(t).appointmentManager).map(taskRow)}{writable&&<details><summary>Schedule by correspondence topic</summary>{topics.map(topic=><div className="actions" key={topic.key}><strong>{topic.label}</strong><button className="secondary" onClick={()=>onAdd('tasks',{business_id:business.id,type:'Follow-up',title:`${topic.label} follow-up`,notes:JSON.stringify({format:'mkt-portfolio-v1',outreachStage:topic.keys[0],text:'Check for a client reply before contacting.'}),contactChannel:'Email'})}>Schedule email / phone call</button></div>)}</details>}</ProfileSection>
  </div>}

  {emailLayoutPilot&&<div role="tabpanel" id="profile-panel-5" aria-labelledby="profile-tab-5" hidden={tab!=='Visibility Check'}><section className="pilot-panel" style={{padding:'16px'}}><h3>Visibility Check · {business.name}</h3><p>Research this business’s public website, Google presence, social accounts and reputable local mentions, then generate its report automatically.</p><button className="primary" type="button" disabled={!writable||researchBusy||busy} onClick={()=>runVisibility()}>{researchBusy?'Researching this business…':'Run Free Visibility Check'}</button><p className="fine" role="status">{researchBusy?'Research runs in the cloud. Findings and source links will be saved here; the report opens when ready.':''}</p>{researchError&&<p className="error" role="alert">{researchError}</p>}<p className="fine">Review and save verified ratings below. Approve the visibility check internally before sending a client report.</p><button className="secondary" type="button" disabled={busy} onClick={()=>openCurrentVisibilityReport()}>{pilotVisibilityBusiness?'View complete report · Pricing · Optional performance →':'Open business-specific report & estimate ↗'}</button><div style={{margin:'12px 0',padding:12,border:'1px solid #dce5e8',borderRadius:8}}><h4>Saved AI Visibility Research</h4>{researchRuns.length?researchRuns.map((run,i)=><details key={run.id} open={i===0}><summary>{new Date(run.researched_at).toLocaleDateString()} · {run.status==='draft'?'Draft — needs human review':run.status}</summary><ul>{(run.research?.findings||run.research?.opportunities||[]).map((f,j)=><li key={j}>{f}</li>)}</ul><p><strong>TikTok:</strong> {run.research?.tiktok_status||'Not verified'}</p><h5>Sources and mentions</h5><ul>{(run.research?.third_party_mentions||run.research?.mentions||[]).map((m,j)=><li key={j}><a href={m.url} target="_blank" rel="noreferrer">{m.name||m.url}</a></li>)}</ul><p className="fine">{run.research?.limitations}</p></details>):<p>No research saved for this business yet.</p>}</div><p className="fine">Review the report below, then approve and publish its password-protected client link.</p></section>{tab==='Visibility Check'&&<section className="pilot-panel" style={{padding:'16px',marginTop:12}}><h3>Website SEO · Technical & Content Audit</h3><p className="fine">Scan the business website and up to two internal pages for titles, meta descriptions, headings, canonical tags, structured data, image alt text, indexing signals, and visible content depth. The scores are preliminary HTML checks, not search rankings.</p><p><strong>Website:</strong> {safeUrl(business.website)?<a href={safeUrl(business.website)} target="_blank" rel="noreferrer">{business.website}</a>:'Not provided'}</p><button type="button" className="secondary" disabled={seoBusy||!safeUrl(business.website)} onClick={runSeoAudit}>{seoBusy?'Scanning website…':'Run Website SEO Audit'}</button>{seoError&&<p className="error" role="alert">{seoError}</p>}{seo&&<div style={{marginTop:12}}><p><strong>Technical SEO:</strong> {seo.technical_score}/100 · <strong>Content depth:</strong> {seo.content_score}/100 · <strong>Pages scanned:</strong> {seo.pages?.length||0}</p>{(seo.pages||[]).map(page=><details key={page.url}><summary>{page.title||page.url} · {page.score}/100</summary><p className="fine">{page.url}</p><p>{page.words} visible words · {page.h1} H1 headings · {page.images} images · {page.missingAlt} missing alt text</p><ul>{(page.checks||[]).map(check=><li key={check.name}>{check.pass?'✓':'Needs attention:'} <strong>{check.name}</strong> — {check.detail}</li>)}</ul></details>)}<p className="fine">{seo.limitations}</p><p className="fine">These page-level checks are internal working details. Reopen the report to include a concise client-facing summary. Page speed, live search rankings, and external backlinks require separate data sources.</p></div>}</section>}{tab==='Visibility Check'&&<VisibilityWorkflow key={researchRuns[0]?.id||'no-research'} client={client} business={business} run={researchRuns[0]} onSaveDraft={updateResearchDraft} writable={writable}/>} {tab==='Visibility Check'&&ratingsSection}</div>}
  {emailLayoutPilot&&<div role="tabpanel" id="profile-panel-6" aria-labelledby="profile-tab-6" hidden={tab!=='Sales & payments'}>{tab==='Sales & payments'&&groups.filter(g=>g.key==='services').map(workSection)}{tab==='Sales & payments'&&salesSection}</div>}

 {reportOpen&&<div role="dialog" aria-modal="true" aria-label="Business visibility report" style={{position:'fixed',inset:0,zIndex:9999,background:'#1b252bd9',display:'flex',flexDirection:'column',padding:12,gap:8}}><div style={{background:'white',padding:12,display:'flex',justifyContent:'space-between',alignItems:'center',borderRadius:8}}><strong>Visibility Report — {business.name}</strong><button type="button" onClick={()=>setReportOpen(false)}>Close report ✕</button></div><div style={{fontSize:13,color:'white'}}>If the report area stays blank, <a style={{color:'white',textDecoration:'underline'}} href={`${import.meta.env.BASE_URL}business-visibility-report.html`} target="_blank" rel="noreferrer">open the report template directly</a>. The template alone does not contain private client information.</div><iframe ref={reportFrame} title="Client visibility report and estimate" src={`${import.meta.env.BASE_URL}business-visibility-report.html`} onLoad={deliverReport} style={{flex:1,width:'100%',border:0,borderRadius:8,background:'white'}}/></div>}
 </section>
}
