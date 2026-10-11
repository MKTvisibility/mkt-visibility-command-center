import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanPayload, dashboard, emptyData, isDue, safeUrl, toCsv, validateConfig } from '../src/lib/domain.js'
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
 assert.equal(data.businesses.length,503);assert.equal(data.tasks.length,503);assert.equal(calls,8)
 const broken={from(){return {select(){return this},eq(){return this},order(){return this},async range(){return {error:new Error('RLS failure')}}}}}
 await assert.rejects(()=>liveRepository(broken).load(),/RLS failure/)
})
test('live membership requires a server-verified user and an approved database membership',async()=>{
 const client={auth:{async getUser(){return {data:{user:{id:'nonmember'}},error:null}}},from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:null,error:null}}}}}
 await assert.rejects(()=>liveRepository(client).membership(),/not been approved/)
})
