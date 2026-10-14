import {metadata,encodeMetadata,brandOf} from './portfolio.js'
export const SIMPLE_STEPS=[
 ['intro','First contact','Send first contact email — let them know they have a free listing'],
 ['story_request','First contact','Email a request for their business story'],
 ['offer','MKT Visibility','Email the Free Visibility Check invitation'],
 ['report','MKT Visibility','Email their completed Visibility Check report'],
 ['qa','Directory page','Review their business page on our site'],
 ['description','Directory page','Verify the description and categories'],
 ['image','Directory page','Check the business image or logo'],
 ['next','Follow-up','Record their reply and next step'],
]
export function workflowTask(business,data,key,title){
 const brand=brandOf(business,data)||'MKT Visibility'
 return {business_id:business.id,title,type:'Task',status:'Open',priority:'Normal',assignee:'Unassigned',due_date:null,notes:encodeMetadata({},{brand,businessChecklistKey:key,checklistGroup:'Business profile',text:'Check this off after you complete the work. Existing email and completion evidence is kept.'}),details:{company:brand,category:key.startsWith('rating:')?'Verification':key==='intro'||key==='story_request'?'Outreach':'Other',suggestion_key:`profile:${key}`}}
}
export function profileTask(data,business,key){return data.tasks.find(t=>t.business_id===business.id&&metadata(t).businessChecklistKey===key&&t.status!=='Cancelled')||data.tasks.find(t=>t.business_id===business.id&&metadata(t).businessChecklistKey===key)}
