import test from 'node:test'
import assert from 'node:assert/strict'
import {profileSummary,contactSummary,isProfilePilot,portfolioProfileSummary} from '../src/lib/profile-summary.js'
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
 assert.deepEqual(portfolioProfileSummary(data,profiles),{total:3,reviewed:1,partial:1,contactDue:1,outreach:[{key:'intro',label:'First contact email',count:1},{key:'story_request',label:'Business story request',count:0},{key:'offer',label:'Visibility Check invitation',count:0},{key:'report',label:'Visibility Check report',count:0},{key:'followup',label:'Follow-up emails',count:0}],rated:2,rating:3,percent:33})
})
test('numbered follow-up emails display in natural sequence',()=>{
 const data=emptyData(),business={id:'a'}
 for(const n of [3,1,2])data.tasks.push({business_id:'a',title:`Follow-up email ${n}`,status:'Open',type:'Follow-up'})
 assert.deepEqual(contactSummary(business,data,null).actions.map(a=>a.title),['Follow-up email 1','Follow-up email 2','Follow-up email 3'])
})
