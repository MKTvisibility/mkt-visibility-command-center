import {estimateSelection,estimateText} from './pricing.mjs'
import {MAILBOXES} from './gmail.mjs'
export function prepareSelection(d){
 const name=String(d.name||'').trim().slice(0,120),email=String(d.email||'').trim().toLowerCase(),phone=String(d.phone||'').trim().slice(0,80),note=String(d.message||'').trim().slice(0,2500);
 if(!name||email.length>254||!/^[-.!#$%&'*+/=?^_`{|}~a-zA-Z0-9]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email))throw Error('Enter your name and a valid email address.');
 if(!/^[0-9a-f-]{36}$/i.test(String(d.clientKey)))throw Error('Invalid request identifier. Refresh and retry.');
 const estimate=estimateSelection(d.selections,d.months);
 return {name,email,phone,estimate,services:estimate.items.map(x=>x.name),support_type:estimate.monthly?'Ongoing support':'One-time updates',message:estimateText(estimate)+(note?'\n\nClient notes:\n'+note:'')};
}
export function selectionEmail(row,businessName){return {id:'portal-notice-'+row.id,sender:MAILBOXES.primary,recipient:MAILBOXES.primary,subject:'Visibility Check selections: '+String(businessName).replace(/[\r\n]/g,' ').slice(0,140),body:`SERVICE SELECTION REQUEST — REVIEW BEFORE PAYMENT\n\nBusiness: ${businessName}\nRequest: ${row.id}\nContact: ${row.name}\nEmail: ${row.email}\nPhone: ${row.phone||'Not supplied'}\n\n${row.message}\n\nNext step: review the requested scope, then contact the client for their business questionnaire and payment arrangements. No payment has been collected and no service agreement has been accepted.\n\nSaved in Command Center → business profile → Visibility Check → client requests.`}}
export async function saveSelection(admin,l,d,makeGmail){
 const fields=prepareSelection(d);
 let {data:row,error:readError}=await admin.from('cc_client_report_requests').select('*').eq('link_id',l.id).eq('client_key',d.clientKey).maybeSingle();if(readError)throw Error('Unable to check your request. Please retry.');
 if(!row){const {count,error}=await admin.from('cc_client_report_requests').select('id',{count:'exact',head:true}).eq('link_id',l.id).gte('created_at',new Date(Date.now()-3600000).toISOString());if(error||Number(count)>=12)throw Error('Too many requests. Email mktvisibility@gmail.com for help.');
 const result=await admin.from('cc_client_report_requests').upsert({...fields,link_id:l.id,business_id:l.business_id,kind:'services',client_key:d.clientKey},{onConflict:'link_id,client_key',ignoreDuplicates:true}).select('*').maybeSingle();if(result.error)throw Error('Unable to save your selections. Please retry.');row=result.data;if(!row){const again=await admin.from('cc_client_report_requests').select('*').eq('link_id',l.id).eq('client_key',d.clientKey).single();if(again.error)throw Error('Unable to load your saved request.');row=again.data;}}
 const {data:business}=await admin.from('cc_businesses').select('name,workspace_id').eq('id',l.business_id).single();
 if(!row.task_id){const task=await admin.from('cc_tasks').insert({business_id:l.business_id,workspace_id:business?.workspace_id,title:'Review client service selections',type:'Follow-up',priority:'Normal',status:'Open',assignee:'Unassigned',notes:JSON.stringify({format:'mkt-portfolio-v1',portalRequestId:row.id,text:row.name+' submitted service selections. Review scope, then arrange the questionnaire and payment.'})}).select('id').single();if(task.data)await admin.from('cc_client_report_requests').update({task_id:task.data.id}).eq('id',row.id);}
 let notified=row.notification_status==='Sent';
 if(row.notification_status==='Not sent'){
 const claimed=await admin.from('cc_client_report_requests').update({notification_status:'Sending'}).eq('id',row.id).eq('notification_status','Not sent').select('id').maybeSingle();
 if(claimed.data){let sending=false;try{const gmail=await makeGmail(admin,'primary');sending=true;const sent=await gmail.send(selectionEmail(row,business?.name||'Business'));const saved=await admin.from('cc_client_report_requests').update({notification_status:'Sent',notification_id:sent.id}).eq('id',row.id);if(saved.error)throw Error('Notification status could not be saved.');notified=true}catch{await admin.from('cc_client_report_requests').update({notification_status:sending?'Needs reconciliation':'Not sent'}).eq('id',row.id);}}
 }
 return {ok:true,id:row.id,notified,message:notified?'Thank you—your selections have been emailed to Michelle and Tim for review. We will contact you about the business questionnaire and payment after confirming the scope. No payment has been collected.':'Your selections are saved in Command Center, but email delivery could not be confirmed. Please email mktvisibility@gmail.com with request '+row.id+' so we can follow up. No payment has been collected.'};
}
