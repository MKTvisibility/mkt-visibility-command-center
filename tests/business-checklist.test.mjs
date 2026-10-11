import test from 'node:test'
import assert from 'node:assert/strict'
import { businessChecklistDrafts, missingBusinessChecklist, BUSINESS_STEPS } from '../src/lib/business-checklist.js'
import { metadata } from '../src/lib/portfolio.js'
import { emptyData, cleanPayload } from '../src/lib/domain.js'
test('business checklist includes core, distinct social and page checks without inventing completed work',()=>{
 const business={id:'b',name:'Test shop',kind:'Prospect',status:'Active',social_urls:['https://facebook.com/shop','https://instagram.com/shop']}
 const data=emptyData();data.businesses=[business];data.listings=[{id:'l1',business_id:'b',site:'Loving Longmont',pages:['Shopping'],url:'https://lovinglongmont.com/businesses.html'},{id:'l2',business_id:'b',site:'MKT Colorado',pages:['Longmont'],url:'https://mktcolorado.com/longmont.html'}]
 const tasks=businessChecklistDrafts(business,data)
 assert.equal(tasks.length,BUSINESS_STEPS.length+4)
 assert.ok(tasks.every(t=>t.status==='Open'&&t.business_id==='b'&&t.due_date===null))
 assert.equal(tasks.filter(t=>metadata(t).checklistGroup==='Free Visibility Check').length,4)
 data.tasks=[{...tasks[0],status:'Done'},tasks[1]]
 assert.equal(missingBusinessChecklist(business,data).length,tasks.length-2)
 assert.equal(data.tasks[0].status,'Done')
 const draft=tasks[5];const saved=cleanPayload('tasks',{...draft,priority:'Medium'})
 assert.equal(saved.priority,'Normal');assert.equal(metadata(saved).businessChecklistKey,metadata(draft).businessChecklistKey)
 assert.equal(businessChecklistDrafts({...business,name:'MKT Visibility'},data).length,0)
 assert.equal(businessChecklistDrafts({...business,kind:'Client'},data).length,tasks.length+3)
})

test('business workflow places listing work before outreach and keeps email-phone-email after the report',async()=>{
 const {compareBusinessWorkflow,businessWorkflowStage}=await import('../src/lib/business-checklist.js')
 const b={id:'b',name:'Shop',status:'Active',kind:'Prospect'}
 const data=emptyData();data.businesses=[b]
 const tasks=businessChecklistDrafts(b,data)
 tasks.find(t=>metadata(t).businessChecklistKey==='followup_email_3').priority='High'
 const sorted=tasks.reverse().sort(compareBusinessWorkflow)
 const keys=sorted.map(t=>metadata(t).businessChecklistKey)
 assert.equal(keys[0],'research')
 assert.ok(keys.indexOf('qa')<keys.indexOf('intro'))
 assert.ok(keys.indexOf('intro')<keys.indexOf('offer'))
 assert.ok(keys.indexOf('offer')<keys.indexOf('audit'))
 assert.deepEqual(keys.slice(keys.indexOf('report'),keys.indexOf('report')+4),['report','followup_email_1','followup_phone_2','followup_email_3'])
 assert.match(businessWorkflowStage(sorted[0]),/Research & Listing/)
})
