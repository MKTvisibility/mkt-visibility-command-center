import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyData} from '../src/lib/domain.js'
import {metadata,encodeMetadata} from '../src/lib/portfolio.js'
import {projectGroups,projectSession,isContactActivity,nextWeekday} from '../src/lib/project-calendar.js'
import {contactAppointments} from '../src/lib/contact-calendar.js'
const task=(id,key,status='Open',extra={})=>({id,business_id:'a',title:key,type:'Task',status,notes:encodeMetadata({},{businessChecklistKey:key}),...extra})
test('one business project across both directories; town work and contacts do not change page progress',()=>{
 const data=emptyData();data.businesses=[{id:'a',name:'Alpha',status:'Active'},{id:'internal',name:'Loving Longmont',kind:'Partner-owned Business'},{id:'z',name:'Archived shop',status:'Archived'}];data.listings=[{business_id:'a',site:'Loving Longmont'},{business_id:'a',site:'MKT Colorado'},{business_id:'z',site:'MKT Colorado'}]
 data.tasks=[task('done','image','Done'),task('qa','qa'),task('contact','intro'),task('town','qa','Open',{notes:encodeMetadata({},{townKey:'agate',businessChecklistKey:'qa'})}),{id:'square',business_id:'internal',title:'Connect checkout',type:'Task',status:'Open',notes:encodeMetadata({},{brand:'Loving Longmont'})}]
 const initial=projectGroups(data),alpha=initial.find(p=>p.businessId==='a');assert.equal(initial.filter(p=>p.businessId).length,1);assert.deepEqual(alpha.brands,['Loving Longmont','MKT Colorado']);assert.equal(alpha.done,1);assert.ok(!alpha.tasks.some(t=>['contact','town'].includes(t.id)));assert.equal(initial.find(p=>p.name==='Loving Longmont').tasks.length,1)
 const session=projectSession(alpha,'2026-10-15');data.tasks.push({...session,id:'session'});assert.equal(projectGroups(data).find(p=>p.businessId==='a').sessions.length,1);assert.equal(session.business_id,null);assert.equal(metadata(session).projectBusinessId,'a');assert.equal(isContactActivity(session),false)
 data.tasks[0]={...data.tasks[0],status:'Open'};assert.equal(projectGroups(data).find(p=>p.businessId==='a').done,0)
})
test('legacy follow-ups and new appointments share one contact schedule without inventing times or changing completion',()=>{
 const legacy=task('legacy','outreach:listing_reminder','Open',{type:'Follow-up',title:'Email reminder',due_date:'2026-10-20'}),verify=task('verify','outreach:story:verify','Open',{type:'Follow-up'}),finished=task('finished','intro','Done'),appointment=task('appointment','', 'Open',{notes:encodeMetadata({},{appointmentManager:{type:'Phone call',date:'2026-10-21',time:'10:00',status:'Confirmed'}})})
 const rows=contactAppointments([legacy,verify,finished,appointment]);assert.equal(rows.length,3);assert.equal(rows.find(t=>t.id==='legacy').date,'2026-10-20');assert.equal(rows.find(t=>t.id==='legacy').time,'');assert.equal(rows.find(t=>t.id==='finished').status,'Completed');assert.equal(rows.find(t=>t.id==='appointment').status,'Confirmed');assert.equal(rows.find(t=>t.id==='appointment').time,'10:00')
})
test('work dates skip weekends and rescheduling preserves project identity',()=>{
 assert.equal(nextWeekday('2026-10-17'),'2026-10-19');const p={name:'Alpha',key:'business:a',businessId:'a',brands:['MKT Colorado']},old={...projectSession(p,'2026-10-16'),id:'saved'};const changed=projectSession(p,'2026-10-19',old);assert.equal(changed.id,'saved');assert.equal(metadata(changed).projectKey,'business:a');assert.equal(changed.due_date,'2026-10-19')
})
