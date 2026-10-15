import {useState} from 'react'
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
const states=['Queued','In progress','Needs review','Completed','Blocked']
function read(key){try{return JSON.parse(localStorage.getItem(key))||[]}catch{return []}}
export default function AIWorkforce({repository,member,writable}){
 const key='mkt-ai-workforce-drafts:'+ (member?.user_id||'practice')
 const [tasks,setTasks]=useState(()=>read(key))
 const [person,setPerson]=useState('Hunter')
 const [title,setTitle]=useState('')
 const [details,setDetails]=useState('')
 const [tab,setTab]=useState('Team')
 const [filter,setFilter]=useState('All')
 function save(next){setTasks(next);try{localStorage.setItem(key,JSON.stringify(next))}catch{}}
 function add(e){e.preventDefault();if(!title.trim())return;save([{id:crypto.randomUUID(),person,title:title.trim(),details:details.trim(),status:'Queued',created:new Date().toISOString()},...tasks]);setTitle('');setDetails('');setTab('Assignments')}
 function change(id,status){save(tasks.map(t=>t.id===id?{...t,status}:t))}
 return <div className="ai-workforce">
  <section className="card"><div className="section-head"><div><div className="eyebrow">MKT AI HEADQUARTERS</div><h2>AI Workforce</h2><p>Ten specialized roles, shared planning, and a no-extra-subscription starting point.</p></div><span className="badge blue">Phase 1</span></div>
  <div className="ai-notice"><strong>AI execution is not connected yet.</strong> Assignments here are local planning drafts saved in this browser, not shared with Tim and not automatically performed. No paid API is used.</div>
  <div className="actions">{['Team','Assignments','Partner conversations','AI Brain'].map(t=><button key={t} className={tab===t?'primary':'secondary'} onClick={()=>setTab(t)}>{t}</button>)}</div></section>
  {tab==='Team'&&<section className="ai-grid">{staff.map(([name,role,description])=><article className="card ai-person" key={name}><div className="ai-avatar" aria-hidden="true">{name.slice(0,1)}</div><div><h3>{name}</h3><strong>{role}</strong><p>{description}</p><button className="secondary" onClick={()=>{setPerson(name);setTab('AI Brain')}}>View role & assign →</button></div></article>)}</section>}
  {tab==='Assignments'&&<section className="card"><div className="section-head"><div><h2>Assignment drafts</h2><p>Plan and track proposed AI work. No agent will execute these tasks automatically.</p></div><select aria-label="Filter assignment status" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{states.map(s=><option key={s}>{s}</option>)}</select></div>{tasks.filter(t=>filter==='All'||t.status===filter).map(t=><article className="ai-task" key={t.id}><div><strong>{t.title}</strong><p>{t.person} · {t.details||'No additional instructions'}</p><small>{new Date(t.created).toLocaleString()}</small></div><label>Status <select value={t.status} onChange={e=>change(t.id,e.target.value)}>{states.map(s=><option key={s}>{s}</option>)}</select></label></article>)}{!tasks.length&&<p>No assignment drafts yet. Open AI Brain to create the first one.</p>}</section>}
  {tab==='Partner conversations'&&<PartnerMessages repository={repository} member={member} writable={writable}/>}
  {tab==='AI Brain'&&<section className="card"><div className="section-head"><div><h2>AI Brain · Role assignments</h2><p>Define a task for a specialist. This stage prepares a human-reviewed work order.</p></div></div><form onSubmit={add}><label>Assign to<select value={person} onChange={e=>setPerson(e.target.value)}>{staff.map(([name])=><option key={name}>{name}</option>)}</select></label><p><strong>{staff.find(s=>s[0]===person)?.[1]}</strong> — {staff.find(s=>s[0]===person)?.[2]}</p><label>Assignment title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Research 10 unique Estes Park businesses"/></label><label>Instructions / brainstorming notes<textarea maxLength={10000} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Explain the goal, scope, constraints and approval requirements…"/></label><button className="primary" disabled={!title.trim()}>Save assignment draft</button></form><div className="ai-notice">Next integration: secured shared database tables, permanent approved portraits, agent conversations and verified tool execution. This version does not impersonate AI responses or silently send messages.</div></section>}
 </div>
}
