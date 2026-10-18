import {awaitingDiscoveryReview} from './discovery.js'
import {validPageFilename} from './page-filename.js'
import {businessMessages,messageSummary} from './domain.js'
import {CAMPAIGNS,classifyCampaign,campaignReport} from './campaigns.js'
import {metadata} from './portfolio.js'
import {inactiveBusiness} from './business-report.js'
export const SENDERS=['mktvisibility@gmail.com']
export const ACTIVE_APPROVALS=['Approved','Sending','Needs reconciliation']
export const approvalName=key=>CAMPAIGNS.find(c=>c.key===key)?.name||'Custom email'
const human=e=>!e.message_type||e.message_type==='Human'
export const wasSent=e=>e.direction==='Outbound'&&['Sent','Replied','Bounced'].includes(e.status)&&human(e)
export function reviewContext(b,data){
 const version=r=>[r.id,new Date(r.updated_at||r.created_at||'').getTime()||0]
 const linked=r=>r.business_id===b.id||(r.related_business_ids||[]).includes(b.id)
 return {business:version(b),emails:data.emails.filter(linked).map(version).sort((a,b)=>a[0].localeCompare(b[0])),tasks:data.tasks.filter(linked).map(version).sort((a,b)=>a[0].localeCompare(b[0])),listings:data.listings.filter(linked).map(version).sort((a,b)=>a[0].localeCompare(b[0])),purchases:(data.purchases||[]).filter(linked).map(version).sort((a,b)=>a[0].localeCompare(b[0]))}
}
export function sameContext(a,b){return Boolean(a&&b)&&['business','emails','tasks','listings','purchases'].every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]))}
export function approvalState(a,b,data){return a.status==='Approved'&&!sameContext(a.review_context,reviewContext(b,data))?'Review again':a.status}
export function contactPlan(b,data){
 const mail=businessMessages(data,b.id),sent=mail.filter(wasSent),replies=mail.filter(e=>human(e)&&e.direction==='Inbound'&&['Replied','Received'].includes(e.status)),report=campaignReport({...data,businesses:[{...b,kind:'Prospect'}]},null)
 const campaigns=CAMPAIGNS.map(c=>{const r=report.campaigns.find(x=>x.key===c.key).rows[0],messages=sent.filter(e=>classifyCampaign(e).key===c.key);return {...c,messages,removed:r.removed,contacted:r.contacted,firstDate:r.firstDate,replied:r.replied}})
 const unresolved=mail.some(e=>e.direction==='Inbound'&&human(e)&&messageSummary(e).response_status==='Needs our reply'),unclear=sent.some(e=>!classifyCampaign(e).key),restricted=awaitingDiscoveryReview(b)||inactiveBusiness(b)||['Stop outreach','Do not contact','No outreach','Not a match'].includes(metadata(b).outreachDecision),latest=sent[0]
 const reason=awaitingDiscoveryReview(b)?'Michelle or Tim must review this newly researched business first.':restricted?'Outreach is stopped or this business is inactive.':unclear?'Earlier sent email needs campaign classification. Review its purpose before approving a standard campaign.':unresolved?'A client message needs your reply. Prepare a custom response.':''
 let suggested=reason?'custom':replies.length||campaigns.slice(1).some(c=>c.contacted)||sent.some(e=>classifyCampaign(e).key==='custom')?'custom':campaigns[0].contacted?'story':'welcome'
 if(campaigns.find(c=>c.key===suggested)?.removed)suggested='custom'
 return {mail,sent,replies,campaigns,unclear,unresolved,restricted,reason,suggested,latest}
}
export function campaignBlock(plan,key){
 if(plan.restricted)return plan.reason
 if(key==='custom')return ''
 if(plan.campaigns.find(c=>c.key===key)?.removed)return 'Removed from this campaign. Add the business back before preparing an email.'
 if(plan.unclear||plan.unresolved)return plan.reason
 if(plan.campaigns.find(c=>c.key===key)?.contacted)return 'Already contacted for this campaign. Use a custom email for a deliberate follow-up.'
 if(key==='welcome'&&(plan.sent.length||plan.replies.length))return 'An existing conversation is recorded. Use the appropriate later campaign or a custom email.'
 if(key==='story'&&!plan.campaigns[0].contacted)return 'Listing Welcome has not been recorded. Review earlier history first.'
 if(key==='visibility'&&plan.campaigns.some(c=>c.messages.some(e=>/visibility check/i.test(messageSummary(e).summary))))return 'A Visibility Check offer was already included in earlier outreach. Use a custom follow-up.'
 return ''
}
export function approvalTemplate(b,data,key,brand='Loving Longmont',verifiedPage=''){
 const page=verifiedPage||data.listings.find(l=>l.business_id===b.id&&l.site===brand&&l.status==='Published'&&/^https?:\/\//.test(l.url||''))?.url||''
 const greeting=`Hello ${b.contact_name||b.name+' team'},`,signature=`Thank you,\nMichelle Skolyak\n${brand} + MKT Visibility\nWe Keep Your Business Visible`
 const link=page?`\n\nYou can review your listing here:\n${page}`:''
 const templates={welcome:{subject:`${b.name} is listed on ${brand}`,body:`${greeting}\n\nWe've included ${b.name} on ${brand} with a free basic listing.${link}\n\nPlease let us know if you would like any corrections or updates. We'd also be happy to offer a free Visibility Check with practical ideas for how customers can find and contact your business online. There's no cost or obligation.\n\nWould you like us to send you more information?\n\n${signature}`},story:{subject:`We'd love to share the story behind ${b.name}`,body:`${greeting}\n\nAt ${brand}, we'd love to introduce the people and stories behind our local businesses. Would you be willing to share the story behind ${b.name}? We can send you a short questionnaire to help us prepare a story for your page at no charge.\n\nWe'd also be happy to offer a free Visibility Check through MKT Visibility, with practical opportunities to improve how customers find you online. There's no cost or obligation.\n\nMay we send you the questionnaire, information about the Visibility Check, or both?\n\n${signature}`},visibility:{subject:`A free Visibility Check for ${b.name}`,body:`${greeting}\n\nWould you be interested in a free Visibility Check for ${b.name}? MKT Visibility can review how your business appears online and share practical opportunities to help customers find and contact you.\n\nThere's no cost or obligation to purchase anything. Let us know if you'd like to take part.\n\n${signature}`},upgrade:{subject:`More visibility for ${b.name} on ${brand}`,body:`${greeting}\n\nWould you be interested in learning about upgraded listing options for ${b.name} on ${brand}? Your basic listing remains free.\n\nWe can explain the available options and pricing so you can decide whether an upgrade would be useful for your business.\n\n${signature}`},custom:{subject:'',body:''}}
 if(brand==='Loving Longmont'&&key==='welcome'){
  const filename=metadata(b).pageFilename,welcomePage=verifiedPage||(validPageFilename(filename)?`https://mktvisibility.github.io/LovingLongmont/${filename}`:page)
  const pageLink=welcomePage?`\n\nView your Loving Longmont page:\n${welcomePage}`:''
  templates.welcome={subject:`${b.name} has been added to Loving Longmont`,body:`${greeting}\n\nMy name is Michelle, and I’m the creator of Loving Longmont, a community website helping residents and visitors discover the local businesses, makers, organizations, and unique places that make Longmont special.\n\nWe’ve added ${b.name} to Loving Longmont—completely free.${pageLink}\n\nYour free listing\n\nWe research listings using publicly available information, but you know your business best. Your free listing can include a photo or logo, description, website link, phone number, and address or service area.\n\nPlease review your page and reply with any corrections or updates. There’s no charge to update your basic listing.\n\nWhy Loving Longmont\n\nWe believe a small business shouldn’t need a large advertising budget to be discovered. Loving Longmont helps people find the storefronts, home-based businesses, artists, farms, independent entrepreneurs, and hidden gems that give our community its character.\n\nOur goal is to help people get to know what’s here—and the people behind it—so more of our community’s support stays local.\n\nA little extra support\n\nLoving Longmont is connected to MKT Visibility, our Colorado-based digital marketing business. We help busy business owners with websites, social media, content, photography, video, and Google Business Profiles.\n\nWe’d also like to offer a Free Business Visibility Check, identifying three practical opportunities to improve how people find your business online.\n\nYou can request yours by replying to this email, or, if you prefer, completing our short form:\nhttps://mktvisibility.com/free-visibility-check.html\nThere’s no cost or obligation.\n\nYou don’t need to use our marketing services to be included on Loving Longmont. Your basic listing remains free.\n\nPlease keep our contact information\n\nSave this email or add us to your contacts. Whenever your hours, contact details, photos, or other information change, simply reply and we’ll help keep your listing current.\n\nThank you for being part of the Longmont community. We look forward to helping more people discover what you do.\n\nMichelle Skolyak\nLoving Longmont + MKT Visibility\nWe Keep Your Business Visible\n\nExplore Loving Longmont: https://lovinglongmont.com\nLearn about MKT Visibility: https://mktvisibility.com`}
 }
 if(brand==='Loving Longmont'&&key==='story'){
  const filename=metadata(b).pageFilename,storyPage=verifiedPage||(validPageFilename(filename)?`https://mktvisibility.github.io/LovingLongmont/${filename}`:page)
  const pageLink=storyPage?`\n\nYou can view your page here:\n${storyPage}`:''
  const about=/\btemple\b/i.test(b.name)?'the temple':'you'
  templates.story={subject:`An invitation to share ${b.name}’s story`,body:`${greeting}\n\nAt Loving Longmont, we want to help our neighbors get to know the people, places, and organizations that make our community special. We’d love to share the story of ${b.name}—your history, the community you serve, and what you’d like people to know about ${about}.${pageLink}\n\nYou’re welcome to write your story in your own words and email it to us. If you’d prefer a short questionnaire to help you get started, just let us know and we’ll email one over. Either way, we’d be happy to feature your story on your Loving Longmont page at no charge.\n\nPlease also let us know if you’d like any corrections or updates to your current page.\n\nWe’d also like to offer a free Visibility Check through MKT Visibility. We’ll review how easily people can find information about ${about==='the temple'?'the temple':'your business or organization'} online and share practical suggestions to help you reach those interested in your community. There’s no cost or obligation.\n\nIf you’re interested in sharing your story, receiving a questionnaire, or learning more about the free Visibility Check, simply reply and let us know.\n\n${signature}`}
 }
 if(brand==='Loving Longmont'&&key==='visibility'){
  templates.visibility={subject:`A free Visibility Check for ${b.name}`,body:`${greeting}\n\nRunning a business takes time, and keeping your information current across websites, Google, and social media can be a lot to manage.\n\nThrough MKT Visibility, we’d like to offer ${b.name} a Free Business Visibility Check. We’ll review how your business appears online and identify three practical opportunities to help customers find you and learn about what you offer.\n\nThere’s no charge or obligation to purchase services. Our goal is to give you useful information you can put to work, whether you make changes yourself or would like help.\n\nIf you’re ready for more support, we also offer packages for social media, content creation, photography and video, website support, and Google Business Profile support. Packages can be customized around your business’s needs, priorities, and budget, whether you need help with one project or ongoing support.\n\nSimply reply to request your free check, ask about our packages, or tell us what you’d like help with. You can also request your Free Visibility Check through our short form:\nhttps://mktvisibility.com/free-visibility-check.html\n\nYou’re always welcome to reply with corrections or updates to your Loving Longmont listing. Your basic listing and updates remain free.\n\nThank you for being part of the Longmont community.\n\nMichelle Skolyak\nLoving Longmont + MKT Visibility\nWe Keep Your Business Visible\n\nExplore Loving Longmont: https://lovinglongmont.com\nLearn about MKT Visibility: https://mktvisibility.com`}
 }
 return {...templates[key],sender:SENDERS[0],recipient:b.email||'',brand,campaign_key:key,variant:key==='custom'?'Custom':brand==='Loving Longmont'&&key==='welcome'?'LL Welcome v2 — community introduction':brand==='Loving Longmont'&&key==='story'?'LL Story v2 — own story or questionnaire':brand==='Loving Longmont'&&key==='visibility'?'LL Visibility v2 — customized packages':'Review template v1',follow_up_on:'',review_note:''}
}
export function validateApproval(d,plan){
 const blocked=campaignBlock(plan,d.campaign_key);if(blocked)throw Error(blocked)
 if(!SENDERS.includes(d.sender))throw Error('Choose a supported sender.')
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.recipient||''))throw Error('Verify the recipient email address.')
 if(d.recipient.toLowerCase()===d.sender.toLowerCase())throw Error('The recipient must be different from the sender.')
 if(!d.subject?.trim()||d.subject.length>300||!d.body?.trim()||d.body.length>10000)throw Error('Enter the exact subject and email text (up to 10,000 characters).')
 if(!d.review_note?.trim())throw Error('Add a brief reason this email is the appropriate next step.')
 if(plan.mail.some(e=>e.status==='Bounced'&&e.recipient?.toLowerCase()===d.recipient.toLowerCase()))throw Error('This address has a recorded bounce. Verify a different active address first.')
 return d
}
