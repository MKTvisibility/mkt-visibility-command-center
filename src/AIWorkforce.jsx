import {useEffect,useState} from 'react'
import {PartnerMessages} from './PartnerMessages.jsx'
import './AIWorkforce.css'

const staff=[
 ['Nova','Chief of Staff & Systems Architect','Coordinates priorities, systems and team handoffs.'],
 ['Code','Web Developer','Websites, GitHub, Supabase, testing and deployments.'],
 ['Hunter','Business Discovery & Lead Generation','Researches prospects and checks duplicate records.'],
 ['Avery','Client Relations & Outreach','Prepares outreach and follows up after approval.'],
 ['Aria','Creative Director & Marketing','Campaigns, graphics, products and visual branding.'],
 ['Eden','Community & Social Media Manager','Community engagement, social plans and events.'],
 ['Quinn','Editorial Director','Business stories, blogs and editorial reviews.'],
 ['Atlas','Research & Business Intelligence','Competitive research, SEO and opportunity analysis.'],
 ['Sterling','Finance & Performance Analyst','Pricing, margins, revenue and performance.'],
 ['Morgan','Operations Manager','Assignments, deadlines, approvals and workflow quality.']
]
const humans=[['Michelle','Co-owner & Business Strategy','Business development, local community projects, client relationships and overall direction.'],['Tim','Co-owner & Business Partner','Collaborates on priorities, business growth and final decisions.']]
const states=['Queued','In progress','Needs review','Completed','Blocked']
function read(key){try{return JSON.parse(localStorage.getItem(key))||[]}catch{return []}}
export default function AIWorkforce({repository,member,writable}){
 const shared=typeof repository.loadAIHeadquarters==='function'
 const key='mkt-ai-workforce-drafts:'+ (member?.user_id||'practice')
 const [tasks,setTasks]=useState(()=>shared?[]:read(key))
 const [threads,setThreads]=useState([])
 const [messages,setMessages]=useState([])
 const [threadTitle,setThreadTitle]=useState('')
 const [threadParticipants,setThreadParticipants]=useState(['Nova'])
 const [selectedThread,setSelectedThread]=useState(null)
 const [messageBody,setMessageBody]=useState('')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 useEffect(()=>{if(!shared)return;let active=true;async function load(){try{const result=await repository.loadAIHeadquarters();if(active){setTasks(result.tasks);setThreads(result.threads);setMessages(result.messages);setError('')}}catch(e){if(active)setError(e.message)}}load();const timer=setInterval(load,30000);return()=>{active=false;clearInterval(timer)}},[repository,shared])
 const [person,setPerson]=useState('Hunter')
 const [title,setTitle]=useState('')
 const [details,setDetails]=useState('')
 const [tab,setTab]=useState('Team')
 const [filter,setFilter]=useState('All')
 function save(next){setTasks(next);try{localStorage.setItem(key,JSON.stringify(next))}catch{}}
 async function add(e){e.preventDefault();if(!title.trim()||busy||!writable)return;setBusy(true);setError('');try{if(shared){const task=await repository.createAITask(person,title.trim(),details.trim());setTasks(t=>[task,...t])}else save([{id:crypto.randomUUID(),person,title:title.trim(),details:details.trim(),status:'Queued',created:new Date().toISOString()},...tasks]);setTitle('');setDetails('');setTab('Assignments')}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function change(id,status){if(!writable)return;setError('');try{if(shared){const task=await repository.updateAITask(id,status);setTasks(t=>t.map(x=>x.id===id?task:x))}else save(tasks.map(t=>t.id===id?{...t,status}:t))}catch(e){setError(e.message)}}
 async function createThread(e){e.preventDefault();if(!shared||!writable||!threadTitle.trim()||busy)return;setBusy(true);setError('');try{const t=await repository.createAIThread(threadTitle.trim(),threadParticipants);setThreads(v=>[t,...v]);setSelectedThread(t.id);setThreadTitle('');setTab('Team discussions')}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function postMessage(e){e.preventDefault();if(!shared||!writable||!selectedThread||!messageBody.trim()||busy)return;setBusy(true);setError('');try{const m=await repository.postAIMessage(selectedThread,messageBody.trim());setMessages(v=>[...v,m]);setMessageBody('')}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function threadStatus(id,status){if(!writable)return;setError('');try{const t=await repository.updateAIThread(id,status);setThreads(v=>v.map(x=>x.id===id?t:x))}catch(e){setError(e.message)}}
 return <div className="ai-workforce">
  <section className="card"><div className="section-head"><div><div className="eyebrow">MKT AI HEADQUARTERS</div><h2>AI Workforce</h2><p>Ten specialized roles, shared planning, and a no-extra-subscription starting point.</p></div><span className="badge blue">Human-controlled</span></div>
  <div className="ai-notice"><strong>No paid AI engine connected.</strong> {shared?'Assignments and discussion notes are shared with authorized Command Center members. AI employees cannot yet autonomously speak, delegate or execute tasks.':'Practice mode: assignments are saved only in this browser.'} External messages and automatic publishing are disabled.</div>{error&&<p role="alert" className="error">{error}</p>}
  <div className="actions">{['Team','Assignments','Team discussions','Partner conversations','AI Brain'].map(t=><button key={t} className={tab===t?'primary':'secondary'} onClick={()=>setTab(t)}>{t}</button>)}</div></section>
  {tab==='Team'&&<section className="ai-grid">{[...staff,...humans].map(([name,role,description])=><article className="card ai-person" key={name}><div className="ai-avatar" aria-hidden="true">{name.slice(0,1)}</div><div><h3>{name}</h3><strong>{role}</strong><p>{description}</p>{staff.some(s=>s[0]===name)&&<button className="secondary" onClick={()=>{setPerson(name);setTab('AI Brain')}}>View role & assign →</button>}</div></article>)}</section>}
  {tab==='Assignments'&&<section className="card"><div className="section-head"><div><h2>Assignment drafts</h2><p>Shared human-managed assignments. Automatic agent execution is not enabled.</p></div><select aria-label="Filter assignment status" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{states.map(s=><option key={s}>{s}</option>)}</select></div>{tasks.filter(t=>filter==='All'||t.status===filter).map(t=><article className="ai-task" key={t.id}><div><strong>{t.title}</strong><p>{t.agent||t.person} · {t.details||'No additional instructions'}</p><small>{new Date(t.created_at||t.created).toLocaleString()}</small></div><label>Status <select disabled={!writable} value={t.status} onChange={e=>change(t.id,e.target.value)}>{states.map(s=><option key={s}>{s}</option>)}</select></label></article>)}{!tasks.length&&<p>No assignment drafts yet. Open AI Brain to create the first one.</p>}</section>}
  {tab==='Team discussions'&&<section className="card"><h2>Team discussions</h2><p>Shared conversation rooms for Michelle and Tim to coordinate with the proposed AI team. Only human members can post until a safe AI runtime is connected.</p>{!shared?<p>Team discussions are unavailable in practice mode.</p>:<><form onSubmit={createThread}><label>Discussion topic<input required maxLength={180} value={threadTitle} onChange={e=>setThreadTitle(e.target.value)} placeholder="Review new opportunities"/></label><fieldset><legend>Invite specialists (planned participants)</legend><div className="ai-checks">{staff.map(([name])=><label key={name}><input type="checkbox" checked={threadParticipants.includes(name)} onChange={e=>setThreadParticipants(v=>e.target.checked?[...v,name]:v.filter(x=>x!==name))}/>{name}</label>)}</div></fieldset><button className="primary" disabled={!writable||busy||!threadTitle.trim()}>Create discussion</button></form><div className="ai-threads">{threads.map(t=><button key={t.id} className={selectedThread===t.id?'primary':'secondary'} onClick={()=>setSelectedThread(t.id)}>{t.title} · {t.status}</button>)}</div>{selectedThread&&(()=>{const t=threads.find(x=>x.id===selectedThread);return t?<div className="ai-thread"><h3>{t.title}</h3><p>Specialists: {t.participants.join(', ')||'None'} · Status: {t.status}</p><div className="actions">{['Open','Paused','Closed'].map(status=><button key={status} className="secondary" disabled={!writable||status===t.status} onClick={()=>threadStatus(t.id,status)}>{status}</button>)}</div>{messages.filter(m=>m.thread_id===t.id).sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(m=><article className="ai-task" key={m.id}><div><strong>Team member</strong><small> · {new Date(m.created_at).toLocaleString()}</small><p>{m.body}</p></div></article>)}{t.status==='Open'&&<form onSubmit={postMessage}><label>Message<textarea required maxLength={10000} value={messageBody} onChange={e=>setMessageBody(e.target.value)}/></label><button className="primary" disabled={!writable||busy||!messageBody.trim()}>Post to team</button></form>}</div>:null})()}</>}</section>}
  {tab==='Partner conversations'&&<PartnerMessages repository={repository} member={member} writable={writable}/>}
  {tab==='AI Brain'&&<section className="card"><div className="section-head"><div><h2>AI Brain · Role assignments</h2><p>Define a task for a specialist. This stage prepares a human-reviewed work order.</p></div></div><form onSubmit={add}><label>Assign to<select value={person} onChange={e=>setPerson(e.target.value)}>{staff.map(([name])=><option key={name}>{name}</option>)}</select></label><p><strong>{staff.find(s=>s[0]===person)?.[1]}</strong> — {staff.find(s=>s[0]===person)?.[2]}</p><label>Assignment title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Research 10 unique Estes Park businesses"/></label><label>Instructions / brainstorming notes<textarea maxLength={10000} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Explain the goal, scope, constraints and approval requirements…"/></label><button className="primary" disabled={!title.trim()||!writable||busy}>Save assignment</button></form><div className="ai-notice">Design preferences: discussions, peer review and internal delegation permitted only after a real agent runtime is authorized; external contact and automatic publishing remain prohibited.  This version does not impersonate AI responses or silently send messages.</div></section>}
 </div>
}
