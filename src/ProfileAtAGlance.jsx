import {useState} from 'react'
import {profileSummary,contactSummary} from './lib/profile-summary.js'
import {profileTask,workflowTask} from './lib/profile-workflow.js'

export default function ProfileAtAGlance({business,data,profile,writable,onSave}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const review=profileSummary(business,data,profile),contact=contactSummary(business,data,profile)
 async function check(key,title,checked){setBusy(true);setError('');try{await onSave('tasks',{...(profileTask(data,business,key)||workflowTask(business,data,key,title)),status:checked?'Done':'Open'})}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="profile-glance" aria-label="Business status at a glance">
  <span className="glance-rating" title="Average of your saved platform ratings; not the public Google review score">{review.rating===null?'☆ Not rated yet':`★ ${review.rating.toFixed(1)} / 5`}<small>Your overall rating{review.ratedCount?` · ${review.ratedCount} platforms`:''}</small></span>
  <details className={`glance-review ${review.percent===100?'complete':''}`}><summary>{review.percent===100?'✓ Profile reviewed':`${review.done} of ${review.total} reviewed`} · {review.percent}%</summary><progress aria-label="Profile review progress" max="100" value={review.percent}/><p className="fine">Review completion only. Not applicable platforms are excluded. Emails are tracked separately.</p>{review.steps.map(([key,title])=><label className="check" key={key}><input type="checkbox" checked={profileTask(data,business,key)?.status==='Done'} disabled={!writable||busy} onChange={e=>check(key,title,e.target.checked)}/>{title}</label>)}{error&&<p role="alert" className="error">{error}</p>}</details>
  <details className={`glance-contact ${contact.tone}`}><summary>{contact.label}</summary>{contact.actions.length?<ul>{contact.actions.map((a,i)=><li key={i}>{a.title}{a.date&&` · ${a.date}`}</li>)}</ul>:<p className="fine">{contact.tone==='blocked'?'Outreach is blocked by the saved Do Not Contact flag.':'No pending outreach is recorded. Add an email or follow-up task to track the next contact.'}</p>}</details>
 </div>
}
