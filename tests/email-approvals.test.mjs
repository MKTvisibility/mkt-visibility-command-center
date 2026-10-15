import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyData} from '../src/lib/domain.js'
import {contactPlan,campaignBlock,reviewContext,sameContext,approvalState,approvalTemplate,validateApproval} from '../src/lib/email-approvals.js'
import {demoRepository} from '../src/lib/repository.js'
const setup=()=>{const data=emptyData(),b={id:'business',name:'Boulder County Photography',kind:'Partner-owned Business',status:'Active',email:'client@example.com',updated_at:'2026-10-10T12:00:00Z'};data.businesses=[b];return {data,b}}
const welcome=b=>({id:'welcome',business_id:b.id,direction:'Outbound',status:'Sent',message_type:'Human',subject:b.name+' is listed on Loving Longmont',occurred_on:'2026-10-10',updated_at:'2026-10-10T13:00:00Z',notes:JSON.stringify({format:'mkt-message-summary-v1',summary:'Invited updates and offered a free Visibility Check.'})})
test('historical welcome suggests story; advanced conversations suggest custom and duplicate campaigns are blocked',()=>{
 const {data,b}=setup();assert.equal(contactPlan(b,data).suggested,'welcome');data.emails=[welcome(b)];let p=contactPlan(b,data);assert.equal(p.suggested,'story');assert.match(campaignBlock(p,'welcome'),/Already/);assert.equal(campaignBlock(p,'story'),'');assert.match(campaignBlock(p,'visibility'),/already included/);
 data.emails.push({...welcome(b),id:'story',subject:'The story behind '+b.name,occurred_on:'2026-10-11'});p=contactPlan(b,data);assert.equal(p.suggested,'custom');assert.match(campaignBlock(p,'story'),/Already/)
})
test('unclear history and outstanding human replies require custom handling; automatic replies do not change the next stage',()=>{
 const {data,b}=setup();data.emails=[{...welcome(b),subject:'Hello'}];let p=contactPlan(b,data);assert.equal(p.suggested,'custom');assert.match(campaignBlock(p,'story'),/classification/);assert.equal(campaignBlock(p,'custom'),'');
 data.emails=[welcome(b),{id:'r',business_id:b.id,direction:'Inbound',status:'Replied',message_type:'Automatic'}];assert.equal(contactPlan(b,data).suggested,'story');data.emails[1].message_type='Human';data.emails[1].notes=JSON.stringify({format:'mkt-message-summary-v1',response_status:'Needs our reply'});assert.match(campaignBlock(contactPlan(b,data),'story'),/needs your reply/)
})
test('approval becomes stale after profile, listing, task, purchase or shared conversation changes; JSON key order is irrelevant',()=>{
 const {data,b}=setup(),ctx=reviewContext(b,data),a={status:'Approved',review_context:ctx};assert.equal(approvalState(a,b,data),'Approved');assert.ok(sameContext(ctx,Object.fromEntries(Object.entries(ctx).reverse())));
 for(const key of ['emails','tasks','listings','purchases']){data[key].push({id:key,business_id:b.id,updated_at:'2026-10-10T15:00:00Z'});assert.equal(approvalState(a,b,data),'Review again');data[key]=[]}
 data.emails=[{id:'shared',business_id:'other',related_business_ids:[b.id]}];assert.equal(approvalState(a,b,data),'Review again');data.emails=[];b.updated_at='2026-10-11T12:00:00Z';assert.equal(approvalState(a,b,data),'Review again')
})
test('one pending exact email per business; withdrawal retains history; drafts and approvals never create sent messages',async()=>{
 const {data,b}=setup(),repo=demoRepository(data),draft={...approvalTemplate(b,data,'welcome'),business_id:b.id,review_note:'Public listing and history reviewed.',review_context:reviewContext(b,data)};assert.doesNotThrow(()=>validateApproval(draft,contactPlan(b,data)));const a=await repo.save('approvals',draft);assert.equal(a.status,'Approved');assert.equal((await repo.load()).emails.length,0);await assert.rejects(()=>repo.save('approvals',draft),/already has/);await repo.save('approvals',{id:a.id,action:'revoke'});assert.equal((await repo.load()).approvals[0].status,'Revoked');await repo.save('approvals',draft);assert.equal((await repo.load()).approvals.length,2)
})
test('bounced recipients, self-mail, inactive contacts and empty custom messages are rejected',()=>{
 const {data,b}=setup(),draft={...approvalTemplate(b,data,'custom'),review_note:'Reviewed'};assert.throws(()=>validateApproval(draft,contactPlan(b,data)),/exact subject/);Object.assign(draft,{subject:'Follow-up',body:'A tailored reply.'});data.emails=[{...welcome(b),status:'Bounced',recipient:b.email}];assert.throws(()=>validateApproval(draft,contactPlan(b,data)),/bounce/);data.emails=[];draft.recipient=draft.sender;assert.throws(()=>validateApproval(draft,contactPlan(b,data)),/different/);b.status='Paused';assert.match(campaignBlock(contactPlan(b,data),'custom'),/stopped/)
})

test('all directory campaign drafts use the MKT Visibility sender',()=>{
 const {data,b}=setup();for(const brand of ['Loving Longmont','MKT Colorado'])for(const campaign of ['welcome','story','visibility','upgrade','custom'])assert.equal(approvalTemplate(b,data,campaign,brand).sender,'mktvisibility@gmail.com')
})
