import {metadata} from './portfolio.js'
import {isContactActivity} from './project-calendar.js'
import {hydrateTask} from './task-evidence.js'
export function contactAppointments(tasks){return tasks.filter(isContactActivity).map(raw=>{
 const task=hydrateTask(raw),m=metadata(task),a=m.appointmentManager||{}
 return {...a,id:task.id,business_id:task.business_id||'',title:task.title,type:a.type||(['Phone call'].includes(m.contactChannel)||/\b(call|phone)\b/i.test(task.title)?'Phone call':'Email follow-up'),date:a.date||task.due_date||'',time:a.time||m.appointmentTime||'',duration:a.duration||30,assignee:task.assignee||'Unassigned',status:task.status==='Done'?'Completed':task.status==='Cancelled'?'Canceled by us':a.status||'Scheduled',notes:a.notes||m.text||'',history:a.history||[],reminder:a.reminder??0,recurrence:a.recurrence||'None',outcome:a.outcome||''}
})}
