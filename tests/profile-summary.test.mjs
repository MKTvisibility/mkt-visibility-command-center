import {encodeMetadata} from '../src/lib/portfolio.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {outreachProgressGroups,profileSummary,contactSummary,isProfilePilot,portfolioProfileSummary,businessRatingGroups,siteReviewGroups} from '../src/lib/profile-summary.js'
import {workflowTask} from '../src/lib/profile-workflow.js'
import {emptyData} from '../src/lib/domain.js'

test('pilot progress excludes outreach and not applicable platforms; rating uses saved assessments',()=>{
 const business={id:'pilot',name:"A Pet’s Place Animal Hospital"},data=emptyData()
 assert.equal(isProfilePilot(business),true)
 assert.equal(isProfilePilot({name:'Another Hospital'}),false)
 const profile={approved_at:'2026-10-13',approved:{platforms:{Website:{state:'Rated',score:4},Facebook:{state:'Not Applicable',score:1},Instagram:{state:'Rated',score:5}}}}
 data.tasks.push({...workflowTask(business,data,'intro','Send intro'),status:'Done'})
 const initial=profileSummary(business,data,profile)
 assert.equal(initial.done,0);assert.equal(initial.rating,4.5)
 assert.equal(initial.steps.some(([key])=>key==='rating:Facebook'),false)
 for(const [key,title] of initial.steps)data.tasks.push({...workflowTask(business,data,key,title),status:'Done'})
 assert.equal(profileSummary(business,data,profile).percent,100)
 assert.equal(profileSummary(business,data,{approved:profile.approved}).rating,null)
})
test('contact status shows due, scheduled and permanent suppression independently of review progress',()=>{
 const business={id:'pilot'},data=emptyData()
 data.tasks.push({...workflowTask(business,data,'story_request','Request story'),due_date:'2026-10-15'})
 assert.match(contactSummary(business,data,null,'2026-10-13').label,/scheduled/)
 assert.equal(contactSummary(business,data,null,'2026-10-15').label,'Contact due')
 assert.equal(contactSummary(business,data,{crm:{do_not_contact:true}},'2026-10-15').label,'Do not contact')
 data.tasks[0].status='Done'
 assert.equal(contactSummary(business,data,null,'2026-10-15').actions.length,0)
})

test('dashboard counts fully reviewed businesses once and excludes unrated businesses from average',()=>{
 const data=emptyData();data.businesses=[{id:'a'},{id:'b'},{id:'c'}]
 const profiles=[{business_id:'a',approved_at:'today',approved:{platforms:{Website:{state:'Rated',score:2}}}},{business_id:'b',approved_at:'today',approved:{platforms:{Website:{state:'Rated',score:4},Instagram:{state:'Rated',score:4}}}}]
 for(const [key,title] of profileSummary(data.businesses[0],data,profiles[0]).steps)data.tasks.push({...workflowTask(data.businesses[0],data,key,title),status:'Done'})
 data.tasks.push({...workflowTask(data.businesses[1],data,'basics','Verify details'),status:'Done'})
 data.tasks.push(workflowTask(data.businesses[1],data,'intro','Send first contact email'))
 const aggregate=portfolioProfileSummary(data,profiles)
 assert.deepEqual({...aggregate,outreach:aggregate.outreach.map(({key,label,count})=>({key,label,count}))},{total:3,reviewed:1,partial:1,contactDue:1,outreach:[{key:'intro',label:'First contact email',count:1},{key:'story_request',label:'Business story request',count:0},{key:'offer',label:'Visibility Check invitation',count:0},{key:'report',label:'Visibility Check report',count:0},{key:'followup',label:'Follow-up emails',count:0}],rated:2,rating:3,percent:33})
})
test('numbered follow-up emails display in natural sequence',()=>{
 const data=emptyData(),business={id:'a'}
 for(const n of [3,1,2])data.tasks.push({business_id:'a',title:`Follow-up email ${n}`,status:'Open',type:'Follow-up'})
 assert.deepEqual(contactSummary(business,data,null).actions.map(a=>a.title),['Follow-up email 1','Follow-up email 2','Follow-up email 3'])
})

test('dashboard outreach places each business in only its next unfinished email step',()=>{
 const data=emptyData(),business={id:'a'};data.businesses=[business]
 for(const key of ['intro','story_request','offer','report'])data.tasks.push(workflowTask(business,data,key,key))
 let groups=portfolioProfileSummary(data,[]).outreach
 assert.equal(groups.find(g=>g.key==='intro').count,1)
 assert.equal(groups.reduce((sum,g)=>sum+g.count,0),1)
 data.tasks[0].status='Done'
 groups=portfolioProfileSummary(data,[]).outreach
 assert.equal(groups.find(g=>g.key==='intro').count,0)
 assert.equal(groups.find(g=>g.key==='story_request').count,1)
 assert.equal(groups.find(g=>g.key==='story_request').businesses[0].business.id,'a')
 assert.equal(groups.reduce((sum,g)=>sum+g.count,0),1)
 data.tasks[1].status='Waiting on Client'
 assert.equal(portfolioProfileSummary(data,[]).outreach.reduce((sum,g)=>sum+g.count,0),0)
})

test('rating lists partition businesses once, preserving exact decimal ratings',()=>{
 const data=emptyData();data.businesses=[{id:'a',name:'Alpha'},{id:'b',name:'Beta'}]
 const groups=businessRatingGroups(data,[{business_id:'a',approved_at:'today',approved:{platforms:{Website:{state:'Rated',score:3},Facebook:{state:'Rated',score:4}}}}])
 assert.equal(groups.find(g=>g.stars===4).businesses[0].rating,3.5)
 assert.equal(groups.find(g=>g.stars===0).businesses[0].business.id,'b')
 assert.equal(groups.reduce((sum,g)=>sum+g.businesses.length,0),2)
})

test('site review totals deduplicate placements within a site and include shared businesses in both',()=>{
 const data=emptyData();data.businesses=[{id:'a',name:'Shared'},{id:'b',name:'Colorado only'}];data.listings=[{business_id:'a',site:'Loving Longmont'},{business_id:'a',site:'Loving Longmont'},{business_id:'a',site:'MKT Colorado'},{business_id:'b',site:'MKT Colorado'}]
 for(const [key,title] of profileSummary(data.businesses[0],data,null).steps)data.tasks.push({...workflowTask(data.businesses[0],data,key,title),status:'Done'})
 const groups=siteReviewGroups(data,[])
 assert.equal(groups.find(g=>g.key==='Loving Longmont').total,1)
 assert.equal(groups.find(g=>g.key==='MKT Colorado').total,2)
 assert.equal(groups.find(g=>g.key==='Loving Longmont:reviewed').businesses[0].business.id,'a')
 assert.equal(groups.find(g=>g.key==='MKT Colorado:reviewed').businesses[0].business.id,'a')
 assert.equal(groups.find(g=>g.key==='MKT Colorado:remaining').businesses[0].business.id,'b')
})

test('N/A review tasks are excluded from the total without counting as completed',()=>{
 const business={id:'na-business'},data={tasks:[{business_id:'na-business',status:'Cancelled',notes:encodeMetadata({},{businessChecklistKey:'image',notApplicable:true})}],emails:[],businesses:[],listings:[]}
 const result=profileSummary(business,data,null)
 assert.equal(result.notApplicable,1);assert.equal(result.done,0);assert.equal(result.total,result.steps.length-1);assert.equal(result.percent,0)
})

test('outreach box hides completed emails, internal review work and premature follow-ups',()=>{
 const data=emptyData(),business={id:'a'};data.businesses=[business]
 const add=(key,status='Open')=>data.tasks.push({...workflowTask(business,data,key,key),status})
 add('intro','Done');add('story_request','Done');add('offer','Done');add('history');add('next');add('report');add('followup_email_1');add('followup_phone_2');add('followup_email_3')
 assert.equal(contactSummary(business,data,null).actions.length,0)
 add('audit','Done')
 assert.deepEqual(contactSummary(business,data,null).actions.map(a=>a.title),['report'])
 data.tasks.find(t=>t.title==='report').status='Done'
 assert.deepEqual(contactSummary(business,data,null).actions.map(a=>a.title),['followup_email_1'])
 data.tasks.find(t=>t.title==='followup_email_1').status='Done'
 assert.deepEqual(contactSummary(business,data,null).actions.map(a=>a.title),['followup_phone_2'])
})
test('historical sent evidence removes an open storage record from the pending summary',()=>{
 const data=emptyData(),business={id:'a'};data.businesses=[business]
 const task=workflowTask(business,data,'intro','Send introduction')
 data.tasks.push({...task,notes:encodeMetadata(task,{evidenceCompletion:{date:'2026-10-10',type:'Sent email'}})})
 assert.equal(contactSummary(business,data,null).actions.length,0)
 assert.equal(portfolioProfileSummary(data,[]).contactDue,0)
 data.tasks[0].notes=encodeMetadata(data.tasks[0],{evidenceCompletionIgnored:true})
 assert.equal(contactSummary(business,data,null).actions.length,1)
})

test('dashboard outreach reconciles confirmed campaign receipts and keeps future follow-ups out of due counts',()=>{
 const data=emptyData(),business={id:'a',name:'Alpha'};data.businesses=[business]
 for(const key of ['intro','story_request'])data.tasks.push({...workflowTask(business,data,key,key),id:key})
 const sent=(key,id)=>({id,business_id:business.id,direction:'Outbound',status:'Sent',message_type:'Human',source_message_id:id,occurred_on:'2026-10-15',notes:JSON.stringify({format:'mkt-message-summary-v1',campaignKey:key})})
 data.emails=[sent('welcome','welcome')]
 let summary=portfolioProfileSummary(data,[])
 assert.equal(summary.outreach.find(g=>g.key==='intro').count,0)
 assert.equal(summary.outreach.find(g=>g.key==='story_request').count,1)
 data.emails.push({...sent('story','story'),status:'Draft'})
 assert.equal(portfolioProfileSummary(data,[]).contactDue,1)
 data.emails[1].status='Sent'
 data.tasks.push({id:'follow',business_id:business.id,type:'Follow-up',title:'Review reply / follow up',status:'Open',due_date:'2999-01-01'})
 assert.equal(portfolioProfileSummary(data,[]).contactDue,0)
 assert.match(contactSummary(business,data,null).label,/scheduled/)
 data.tasks.at(-1).due_date='2000-01-01'
 summary=portfolioProfileSummary(data,[])
 assert.equal(summary.contactDue,1);assert.equal(summary.outreach.find(g=>g.key==='followup').count,1)
 assert.equal(data.tasks[0].status,'Open')
})


test('outreach progress separates completed sends from future and blocked steps, excluding N/A and stopped contacts',()=>{
 const data=emptyData();data.businesses=['sent','future','blocked','na','stopped'].map(id=>({id,name:id,status:'Active'}))
 for(const b of data.businesses)data.tasks.push({...workflowTask(b,data,'intro','First contact email'),status:b.id==='sent'?'Done':b.id==='blocked'?'Blocked':'Open',due_date:b.id==='future'?'2099-01-01':''})
 const na=data.tasks.find(t=>t.business_id==='na');na.notes=encodeMetadata(na,{notApplicable:true})
 const groups=outreachProgressGroups(data,[{business_id:'stopped',crm:{do_not_contact:true}}]),intro=groups.find(g=>g.key==='intro')
 assert.equal(intro.sent.length,1)
 assert.equal(intro.total,3)
 assert.ok(!intro.remaining.some(r=>r.business.id==='na'))
 assert.ok(intro.remaining.some(r=>r.business.id==='future'))
 assert.ok(intro.remaining.some(r=>r.business.id==='blocked'))
 assert.ok(!intro.remaining.some(r=>r.business.id==='stopped'))
 assert.equal(intro.total,intro.sent.length+intro.remaining.length)
})
