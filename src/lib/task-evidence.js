import { metadata, encodeMetadata } from './portfolio.js'
// Historical evidence has its own date/source; it does not invent a partner or exact completion time.
export function hydrateTask(task) {
 const m=metadata(task)
 if(task.status==='Open'&&m.evidenceCompletion&&!m.evidenceCompletionIgnored) return {...task,status:'Done',_evidenceChecked:true}
 return task
}
export function prepareTask(task) {
 if(!task._evidenceChecked) return task
 if(task.status==='Done') return {...task,status:'Open'}
 return {...task,notes:encodeMetadata(task,{evidenceCompletionIgnored:true})}
}
