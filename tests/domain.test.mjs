import test from 'node:test'
import assert from 'node:assert/strict'
import { businessMessages, messageSummary, cleanPayload, taskOverview, dashboard, emptyData, isDue, safeUrl, toCsv, validateConfig } from '../src/lib/domain.js'
import { demoRepository, liveRepository } from '../src/lib/repository.js'

test('dashboard counts only active clients, open opportunities and uncompleted due follow-ups', () => {
 const data = emptyData()
 data.businesses = [{kind:'Client',status:'Active',stage:'Won',monthly_fee:550}, {kind:'Client',status:'Paused',stage:'Lost',monthly_fee:400}, {kind:'Prospect',status:'Active',stage:'Proposal',deal_value:900}, {kind:'Client',status:'Archived',stage:'New',monthly_fee:1000,deal_value:1000}]
 data.tasks = [{type:'Follow-up',status:'Open',due_date:'2026-10-10'}, {type:'Follow-up',status:'Done',due_date:'2026-10-09'}, {type:'Follow-up',status:'Cancelled',due_date:'2026-10-10'}, {type:'Task',status:'Open',due_date:'2026-10-10'}, {type:'Follow-up',status:'Open',due_date:'2026-10-11'}]
 assert.deepEqual(dashboard(data,'2026-10-10'),{businesses:3,clients:1,due:1,recurring:550,pipeline:900})
 assert.equal(isDue({status:'Open',due_date:null}),false)
})
test('rejects secret keys and invalid project URLs', () => {
 assert.equal(validateConfig({url:'https://project.supabase.co',key:'sb_publishable_example'}),true)
 for(const key of ['sb_' + 'secret_abc','eyJserviceRole','', 'arbitrary']) assert.throws(()=>validateConfig({url:'https://project.supabase.co',key}))
 for(const url of ['http://project.supabase.co','https://evil.example','https://project.supabase.co.evil.example','https://user:password@project.supabase.co','https://project.supabase.co/path']) assert.throws(()=>validateConfig({url,key:'sb_publishable_example'}))
})
test('safe links reject executable URLs', () => {
 assert.equal(safeUrl('javascript:alert(1)'),null)
 assert.equal(safeUrl('data:text/html,hello'),null)
 assert.equal(safeUrl('https://example.com'), 'https://example.com/')
})
test('validates money, required relationships and dates and strips injected columns', () => {
 const valid = {name:' Test business ',kind:'Prospect',status:'Active',stage:'New',monthly_fee:0,deal_value:100}
 const result=cleanPayload('businesses',{...valid,role:'owner',created_by:'fake'})
 assert.equal(result.name,'Test business'); assert.equal(result.role,undefined); assert.equal(result.created_by,undefined)
 for(const amount of [-1,Infinity,'oops',100000001]) assert.throws(()=>cleanPayload('businesses',{...valid,monthly_fee:amount}))
 assert.throws(()=>cleanPayload('businesses',{...valid,website:'javascript:alert(1)'}))
 assert.throws(()=>cleanPayload('listings',{title:'Listing',site:'Loving Longmont'}))
 assert.throws(()=>cleanPayload('emails',{subject:'Message',recipient:'test@example.com',direction:'Outbound',status:'Sent'}))
 assert.throws(()=>cleanPayload('emails',{subject:'Message',recipient:'test@example.com',direction:'Inbound',status:'Draft'}))
 assert.throws(()=>cleanPayload('tasks',{title:'Reminder',type:'Follow-up',status:'Open',priority:'Normal'}))
 assert.throws(()=>cleanPayload('tasks',{title:'Reminder',type:'Follow-up',due_date:'2026-02-30'}))
})
test('CSV escaping prevents spreadsheet formula execution and preserves quoted values', () => {
 const csv=toCsv([{name:'=HYPERLINK("bad")',notes:'a,"b"\nc',workspace_id:'secret',created_by:'private',pages:['A','B']},{name:' \t+SUM(1)',notes:'@bad',pages:[]}])
 assert.match(csv,/"'=HYPERLINK/);assert.match(csv,/"' \t\+SUM/);assert.match(csv,/a,""b""/);assert.doesNotMatch(csv,/secret|private|workspace_id|created_by/)
})
test('practice create and edit persist only within one isolated in-memory repository', async()=>{
 const one=demoRepository(emptyData()),two=demoRepository(emptyData())
 const saved=await one.save('businesses',{name:'Sample',kind:'Prospect',status:'Active',stage:'New'})
 await one.save('businesses',{...saved,name:'Edited sample'})
 assert.equal((await one.load()).businesses.length,1)
 assert.equal((await one.load()).businesses[0].name,'Edited sample')
 assert.equal((await two.load()).businesses.length,0)
})
test('live repository pages beyond the default API cap and surfaces database errors', async()=>{
 let calls=0
 const client={from(){const query={select(){return this},eq(){return this},order(){return this},async range(from){calls++;return {data:Array.from({length:from===0?500:3},(_,i)=>({id:from+i})),error:null}}};return query}}
 const data=await liveRepository(client).load()
 assert.equal(data.businesses.length,503);assert.equal(data.tasks.length,503);assert.equal(calls,18)
 const broken={from(){return {select(){return this},eq(){return this},order(){return this},async range(){return {error:new Error('RLS failure')}}}}}
 await assert.rejects(()=>liveRepository(broken).load(),/RLS failure/)
})
test('live membership requires a server-verified user and an approved database membership',async()=>{
 const client={auth:{async getUser(){return {data:{user:{id:'nonmember'}},error:null}}},from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:null,error:null}}}}}
 await assert.rejects(()=>liveRepository(client).membership(),/not been approved/)
})

test('summary metadata round trips safely and preserves old notes on unrelated edits', () => {
 const old = {subject:'Old message',recipient:'client@example.com',direction:'Outbound',status:'Sent',occurred_on:'2026-10-09',notes:'Original notes'}
 assert.equal(messageSummary(old).summary,'Original notes')
 assert.equal(messageSummary(old).verification,'Unverified')
 assert.equal(cleanPayload('emails',old).notes,'Original notes')
 const saved=cleanPayload('emails',{...old,sender:'mkt@example.com',summary:'A brief summary',next_action:'Prepare quote',follow_up_on:'2026-10-15',response_status:'Needs our reply',verification:'Reviewed'})
 assert.equal(messageSummary(saved).sender,'mkt@example.com')
 assert.equal(messageSummary(saved).summary,'A brief summary')
 assert.equal(messageSummary(saved).follow_up_on,'2026-10-15')
 assert.equal(cleanPayload('emails',saved).notes,saved.notes)
 assert.throws(()=>cleanPayload('emails',{...old,summary:'Test',sender:'invalid'}),/valid email/)
 assert.throws(()=>cleanPayload('emails',{...old,summary:'Test',follow_up_on:'2026-02-30'}),/valid follow-up/)
 assert.throws(()=>cleanPayload('emails',{...old,summary:'\\'.repeat(2500)}),/Shorten/)
 assert.match(toCsv([saved]),/sender/)
 assert.match(toCsv([saved]),/A brief summary/)
 assert.doesNotMatch(toCsv([saved]),/mkt-message-summary-v1/)
})
test('client timeline isolates business records and sorts message dates without inventing dates', () => {
 const data=emptyData();data.emails=[{id:'a',business_id:'one',occurred_on:null},{id:'b',business_id:'two',occurred_on:'2026-10-20'},{id:'c',business_id:'one',occurred_on:'2026-10-09'},{id:'d',business_id:'one',occurred_on:'2026-10-10'}]
 assert.deepEqual(businessMessages(data,'one').map(e=>e.id),['d','c','a'])
 assert.equal(data.emails[0].occurred_on,null)
})

test('internal notes are isolated and stale edits cannot overwrite another save',async()=>{
 const repo=demoRepository({businesses:[{id:'notes-business',name:'Sample',kind:'Prospect',status:'Active',stage:'New',notes:'Research preserved',internal_notes:''}],listings:[],emails:[],tasks:[],purchases:[]})
 const updated=await repo.save('business_notes',{id:'notes-business',previous_notes:'',internal_notes:'Team only\nSecond line'})
 assert.equal(updated.notes,'Research preserved');assert.equal(updated.internal_notes,'Team only\nSecond line')
 await assert.rejects(()=>repo.save('business_notes',{id:'notes-business',previous_notes:'',internal_notes:'Stale overwrite'}),/notes changed/)
 await repo.save('businesses',{...updated,name:'Renamed'})
 assert.equal((await repo.load()).businesses[0].internal_notes,'Team only\nSecond line')
 assert.deepEqual(cleanPayload('business_notes',{internal_notes:'Note',description:'Do not change'}),{internal_notes:'Note'})
 assert.throws(()=>cleanPayload('business_notes',{internal_notes:'x'.repeat(10001)}),/10,000/)
})


test('performance reports validate periods, preserve a real zero and reject missing values',()=>{
 const record={brand:'MKT Visibility',channel:'Website',metric:'Visitors',source:'Manual report',period_start:'2026-10-01',period_end:'2026-10-09',value:0,notes:'No visitors reported'}
 assert.equal(cleanPayload('statistics',record).value,0)
 assert.throws(()=>cleanPayload('statistics',{...record,value:''}),/reported value/)
 assert.throws(()=>cleanPayload('statistics',{...record,value:-1}),/reported value/)
 assert.throws(()=>cleanPayload('statistics',{...record,period_start:'2026-10-10'}),/reporting period/)
 assert.throws(()=>cleanPayload('statistics',{...record,brand:'Other brand'}),/valid brand/)
 assert.throws(()=>cleanPayload('statistics',{...record,source_url:'javascript:alert(1)'}),/Source links/)
})

test('tracking dates preserve Mountain time and the 48-hour day boundary',async()=>{
 const {trackingDates}=await import('../src/lib/domain.js')
 const dates=trackingDates('2026-10-11T05:53:20Z')
 assert.match(dates.installed,/Oct 10, 2026/)
 assert.match(dates.check,/Oct 12, 2026/)
 assert.match(dates.check,/11:53 PM MDT/)
 assert.equal(trackingDates('invalid'),null)
})

test('individual notes strip forged attribution and support explicit deletion',()=>{
 const clean=cleanPayload('notes',{business_id:'one',body:' A note ',author_name:'Fake',created_by:'fake'})
 assert.deepEqual(clean,{business_id:'one',parent_id:null,body:'A note'})
 assert.throws(()=>cleanPayload('notes',{business_id:'one',body:''}),/Enter a note/)
 assert.throws(()=>cleanPayload('notes',{business_id:'one',remove:true}),/saved note/)
 assert.equal(cleanPayload('notes',{id:'n',business_id:'one',remove:true}).body,'')
})

test('task overview counts active items and ranks High priority before Medium and Low regardless of due date', () => {
 const tasks = [
  {id:'future',title:'Future high',status:'Open',priority:'High',due_date:'2026-10-12'},
  {id:'overdue',title:'Overdue low',status:'Open',priority:'Low',due_date:'2026-10-09'},
  {id:'normal',title:'Today normal',status:'In progress',priority:'Normal',due_date:'2026-10-11'},
  {id:'high',title:'Today high',status:'Open',priority:'High',due_date:'2026-10-11'},
  {id:'none',title:'No date',status:'Open',priority:'High'},
  {id:'six',title:'Later',status:'Open',priority:'Low',due_date:'2026-11-01'},
  {id:'done',title:'Done',status:'Done',due_date:'2026-10-09'},
  {id:'cancelled',title:'Cancelled',status:'Cancelled',due_date:'2026-10-11'}
 ]
 const result = taskOverview(tasks,'2026-10-11')
 assert.equal(result.open,6); assert.equal(result.overdue,1); assert.equal(result.today,2)
 assert.deepEqual(result.urgent.map(t=>t.id),['high','future','none','normal','overdue'])
 assert.deepEqual(tasks.map(t=>t.id),['future','overdue','normal','high','none','six','done','cancelled'])
})
