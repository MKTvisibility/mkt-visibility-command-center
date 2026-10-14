import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyData} from '../src/lib/domain.js'
import {workflowTask,taskChoice} from '../src/lib/profile-workflow.js'
import {encodeMetadata} from '../src/lib/portfolio.js'
import {activityReport,dueEmailStages,salesReport,directoryBusinesses} from '../src/lib/dashboard-reports.js'
const b={id:'b',name:'Zulu',status:'Active',kind:'Prospect'}
const setup=()=>({...emptyData(),businesses:[b]})
test('directory sorts only nonarchived businesses by name',()=>{
 const d=setup();d.businesses.push({id:'a',name:'Alpha'},{id:'c',name:'Hidden',status:'Archived'})
 assert.deepEqual(directoryBusinesses(d).map(b=>b.name),['Alpha','Zulu'])
})
test('reply categories are explicit, overlap without double-counting clients, and request recording is not a request',()=>{
 const d=setup(),intro=taskChoice(workflowTask(b,d,'intro','Intro'),'done')
 d.tasks=[{...intro,notes:encodeMetadata(intro,{outreachTracking:{received:true,categories:['updates','questionnaire']}})},taskChoice(workflowTask(b,d,'request','Record request'),'done')]
 const report=activityReport(d)
 assert.equal(report.engaged.length,1)
 for(const key of ['replies','updates','questionnaire'])assert.equal(report.groups.find(g=>g.key===key).businesses.length,1)
 assert.equal(report.groups.find(g=>g.key==='check_requested').businesses.length,0)
 assert.equal(report.groups.find(g=>g.key==='check_received').businesses.length,0)
})
test('due stages respect completed emails, pending replies, waiting, delivery prerequisites and future reminders',()=>{
 const d=setup();const intro=taskChoice(workflowTask(b,d,'intro','Intro'),'done')
 d.tasks=[intro,taskChoice(workflowTask(b,d,'offer','Offer'),'done'),taskChoice(workflowTask(b,d,'story_request','Story'),'na')]
 assert.equal(dueEmailStages(d,'2026-10-14').length,0)
 d.tasks[0]={...intro,notes:encodeMetadata(intro,{outreachTracking:{received:true,responded:false}})}
 assert.deepEqual(dueEmailStages(d,'2026-10-14').map(r=>r.key),['intro'])
 d.tasks.push({business_id:'b',type:'Follow-up',status:'Open',due_date:'2026-10-20',notes:encodeMetadata({},{outreachStage:'intro'})})
 assert.equal(dueEmailStages(d,'2026-10-14').length,0)
 assert.equal(dueEmailStages(d,'2026-10-20').length,1)
 d.tasks.push(taskChoice(workflowTask(b,d,'audit','Audit'),'done'))
 assert.ok(dueEmailStages(d,'2026-10-20').some(r=>r.key==='report'))
})
test('paid monthly revenue excludes other months and uncollected, refunded, cancelled purchases',()=>{
 const d=setup();d.purchases=[{id:'p1',business_id:'b',status:'Paid',purchased_on:'2026-10-01',amount:100,notes:encodeMetadata({},{saleSource:'Square',saleType:'Upgraded listing'})},{id:'p2',business_id:'b',status:'Paid',purchased_on:'2026-10-10',amount:250,notes:encodeMetadata({},{saleSource:'Etsy'})},...['Ordered','Refunded','Cancelled'].map(status=>({status,purchased_on:'2026-10-12',amount:1000})),{status:'Paid',purchased_on:'2026-09-20',amount:999}]
 const report=salesReport(d,'2026-10');assert.equal(report.total,350);assert.equal(report.paid.length,2);assert.deepEqual(report.sources,[['Etsy',250],['Square',100]])
 assert.equal(activityReport(d).groups.find(g=>g.key==='paid_listing').businesses.length,1)
})
