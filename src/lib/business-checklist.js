import { listingBenefit } from './business-options.js'
import { BRANDS } from './domain.js'
import { metadata, encodeMetadata, brandOf } from './portfolio.js'

export const BUSINESS_STEPS = [
 ['research','Listing details','Research Business','Research official sources, business offerings and local relevance. Record sources before creating or changing the listing.'],
 ['phone','Listing details','Verify Phone','Confirm the official telephone number and test the listing phone link before a follow-up call.'],
 ['identity','Listing details','Verify Business Name','Confirm the official name, owner/contact, whether it is operating, and whether it is a prospect, paying client or public resource. Record sources and verification date.'],
 ['contact','Listing details','Verify Email','Check official contact information and past bounces. Find a current email or contact form; do not guess an address.'],
 ['location','Listing details','Verify Address','Match official sources; check service area, seasonal hours and appointment requirements. Test telephone and directions links.'],
 ['description','Listing details','Verify Description & Categories','Review accurate offerings, category placement and all applicable directory pages. Remove unsupported claims and duplicated listings.'],
 ['website','Links by type','Verify Website Links','Open the official website; check HTTPS, redirects, correct business identity and mobile behavior. Record missing or broken links and repair them.'],
 ['map','Links by type','Verify Google & Map Links','Confirm the correct location/profile and directions destination. Record unavailable profiles; do not claim or edit a client profile without access and authorization.'],
 ['booking','Links by type','Verify Booking & Shop Links','Test each applicable action link and its destination. Record which types exist and which are not applicable; do not submit an order or appointment.'],
 ['image','Images','Verify Logo or Image on Listing','Use an official image/logo or client-approved photo. Record the source and permission; check stable URL, image loading, resolution and appropriate subject. Loving Longmont uses official images/logos, not AI images.'],
 ['crop','Images','Verify Image Crop & Mobile Layout','Check desktop and phone crops, focal point, aspect ratio, descriptive alt text, compression and loading. Check every page showing this business.'],
 ['history','Outreach','Review Email History','Read saved sent/inbound messages before contacting the business. Record dates, recipient, replies, bounces, opt-outs and any existing next contact date.'],
 ['intro','Outreach','Send Free Listing Email (Your Site Was Added)','After reviewing history and verifying the recipient, prepare a personalized introduction with the live listing link and Free Visibility Check invitation. Send only when authorized; log the actual sent message. If already sent, record the evidence and complete this step without resending.'],

 ['offer','Free Visibility Check','Send Free Visibility Check Email','Record whether the invitation was included in outreach, when and where. Verify the form link. An invitation is not a completed assessment.'],
 ['request','Free Visibility Check','Record Visibility Check Request','Check saved form submissions and replies. Record Requested, Declined, Not requested or Awaiting response with source/date in notes. Do not assume a request from an invitation.'],
 ['audit','Free Visibility Check','Complete Free Visibility Check','Only after a request or agreed assessment: review website, Google profile, social accounts, contact/booking path and visibility. Record findings, sources, date and report location. If not requested, use Cancelled with an explanation.'],
 ['report','Free Visibility Check','Send Visibility Check Report','Record the actual report link, delivery date, recipient and sent-message evidence. Do not mark delivered merely because the report exists.'],
 ['followup_email_1','Report follow-ups','Follow-Up 1: Email','After the Visibility Check report was sent, check for a reply and review previous contact attempts. If follow-up is still needed, send the first email and record its date and outcome. Stop if the client replies, declines or asks not to be contacted.'],
 ['followup_phone_2','Report follow-ups','Follow-Up 2: Phone','Only after the report and first email follow-up, review replies and confirm the phone number. If still appropriate, make one phone attempt and record its date, outcome and any voicemail. Stop on a reply, decline or opt-out.'],
 ['followup_email_3','Report follow-ups','Follow-Up 3: Final Email','Only after the first email and phone attempt, if no reply and continued contact is appropriate, send one final email. Record the outcome and close this sequence. No fourth attempt unless the client re-engages or agrees to further contact.'],
 ['next','Client follow-through','Record Client Response','Record the response, stated needs, next action, responsible partner and due date. Confirm service scope before doing additional work; document no-response or declined status accurately.'],
 ['qa','Listing quality','Review Listing','Check spelling, duplicate records, accurate categories, contacts, images and every link on each live page. Record remaining problems and evidence before marking complete.'],
 ['maintenance','Maintenance','Schedule Listing Review','Set the next review date and owner. Recheck closures, moved locations, hours, expired events, broken links and outdated images. Create a new dated task for each later review.']
]
export function businessChecklistDrafts(business, data) {
 if (BRANDS.includes(business.name) || business.kind==='Partner-owned Business' || business.status === 'Archived') return []
 const listings=data.listings.filter(l=>l.business_id===business.id && l.status!=='Archived')
 const brands=[...new Set(listings.map(l=>l.site))]
 const brand=brands.length===1?brands[0]:brandOf(business,data)||'MKT Visibility'
 const specs=BUSINESS_STEPS.map(([key,group,title,text])=>({key,group,title,text,brand}))
 for(const link of [...new Set(business.social_urls||[])]) {
  let host;try{host=new URL(link).hostname.replace(/^www\./,'')}catch{continue}
  specs.push({key:`social:${link}`,group:'Links by type',title:`Verify Social Media Link: ${host}`,text:`Open ${link}. Confirm this is the official account, its current handle and business identity; test the link on the listing. Record verification date and corrections.`,brand,pageUrl:link})
 }
 for(const l of listings) specs.push({key:`listing:${l.id}`,group:'Website pages',title:`Verify Listing: ${l.site} — ${(l.pages||[]).join(', ')||'page'}`,text:`Review this specific listing: ${l.url||'Record the live page URL'}. Check correct categories, name, description, contacts, images and action links. Record publication or correction date. A saved inventory record does not prove the current live page is complete.`,brand:l.site,pageName:(l.pages||[]).join(', '),pageUrl:l.url})
 if(business.kind==='Client') specs.push(...[
  {key:'scope',group:'Paid client setup',title:'Confirm Client Scope',text:'Record agreed deliverables, client approval, account access, responsible partner and schedule. Store credentials outside task notes.'},
  {key:'payment',group:'Paid client setup',title:'Verify Payment Setup',text:'Confirm agreed pricing, payment link/invoice, billing contact and actual payment status. Record evidence; a free directory listing does not require a payment.'},
  {key:'reporting',group:'Paid client setup',title:'Schedule Client Reports',text:'Agree on update frequency, baseline metrics, report date and renewal/review date; create the next dated task.'}
 ].map(s=>({...s,brand:'MKT Visibility'})))
 const benefit=listingBenefit(business)
 if(benefit) specs.push({key:'included_listing',group:'Included listing benefit',title:benefit.includes('MKT Colorado')?'Add Matching MKT Colorado Listing':'Complete Included Package Listing',brand:benefit.includes('MKT Colorado')?'MKT Colorado':'MKT Visibility',text:`${benefit} Verify payment/package eligibility and the original listing level/value. Publish the included listing, record its live URL and compare the level/value. Keep the final review unchecked for Michelle.`})
 if(metadata(business).listingArrangement==='Coupon') specs.push({key:'coupon',group:'Listing quality',title:'Verify Coupon Details',brand,text:'Confirm the offer, code, redemption link, terms, expiration and client approval. Test the displayed links and schedule removal or renewal at expiration.'})
 return specs.map(s=>({business_id:business.id,title:s.title.slice(0,200),type:'Task',status:'Open',priority:'Normal',assignee:'Unassigned',due_date:null,notes:encodeMetadata({}, {brand:s.brand,area:['Outreach','Free Visibility Check','Client follow-through','Paid client setup','Report follow-ups'].includes(s.group)?'Sales':'Website',businessChecklistKey:s.key,checklistGroup:s.group,pageName:s.pageName||s.group,pageUrl:s.pageUrl||'',text:s.text})}))
}
export function missingBusinessChecklist(business,data) {
 const keys=new Set(data.tasks.filter(t=>t.business_id===business.id).map(t=>metadata(t).businessChecklistKey).filter(Boolean))
 return businessChecklistDrafts(business,data).filter(t=>!keys.has(metadata(t).businessChecklistKey))
}

const workflowOrder = {research:0,identity:1,contact:2,phone:3,location:4,description:5,website:6,map:7,booking:8,image:10,crop:11,qa:13,included_listing:12.5,coupon:12.6,history:20,intro:21,followup:22,offer:30,request:31,audit:40,report:41,followup_email_1:50,followup_phone_2:51,followup_email_3:52,next:60,scope:61,payment:62,reporting:63,maintenance:70}
export function businessWorkflowOrder(task) {
 const key=metadata(task).businessChecklistKey||''
 return key.startsWith('social:')?9:key.startsWith('listing:')?12:workflowOrder[key]??75
}
export function compareBusinessWorkflow(a,b) {
 const rank={High:0,Normal:1,Low:2}
 return businessWorkflowOrder(a)-businessWorkflowOrder(b)||(rank[a.priority]??1)-(rank[b.priority]??1)||a.title.localeCompare(b.title)
}
export function businessWorkflowStage(task) {
 const order=businessWorkflowOrder(task)
 return order<20?'1. Research & Listing':order<30?'2. Free Listing Email':order<40?'3. Visibility Check Offer':order<50?'4. Complete & Send Visibility Check':order<60?'5. Follow-Ups: Email → Phone → Final Email':order<70?'6. Response & Client Setup':'7. Ongoing Maintenance'
}
