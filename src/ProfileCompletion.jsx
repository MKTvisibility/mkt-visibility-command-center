import {useState} from 'react'
import {profileWork,closeProfileTask} from './lib/profile-completion.js'

export default function ProfileCompletion({business,data,profile,writable,onSave}) {
 const [choice,setChoice]=useState('na'),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const work=profileWork(business,data,profile)
 async function complete(){
  setBusy(true);setError('')
  try{for(const task of work.remaining)await onSave('tasks',closeProfileTask(task,choice))}
  catch(e){setError(`Some work could not be saved. Saved changes are kept; retry to finish. ${e.message}`)}
  finally{setBusy(false)}
 }
 return <section className={`profile-completion ${work.complete?'complete':''}`} aria-label="All profile work status">
  <strong role="status">{work.complete?'✓ All profile work completed':`Work remaining · ${work.remaining.length} tasks`}</strong>
  <small>{work.done} completed · {work.closed-work.done} N/A or cancelled · {work.tasks.length} total</small>
  {writable&&!work.complete&&<div className="actions"><label>Remaining tasks<select value={choice} disabled={busy} onChange={e=>setChoice(e.target.value)}><option value="na">Mark N/A</option><option value="done">Mark Completed</option></select></label><button className="primary" disabled={busy} onClick={complete}>{busy?'Saving profile work…':'All profile work completed'}</button></div>}
  <p className="fine">Closes all remaining profile checklist items and assigned tasks, including follow-ups. Completed work is kept. Choose Completed only for work actually performed; choose N/A for work you do not need. Reopening a task or adding new work updates this status.</p>
  {error&&<p className="error" role="alert">{error}</p>}
 </section>
}
