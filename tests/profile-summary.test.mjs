import test from 'node:test'
import assert from 'node:assert/strict'
import {profileSummary,contactSummary,isProfilePilot} from '../src/lib/profile-summary.js'
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
