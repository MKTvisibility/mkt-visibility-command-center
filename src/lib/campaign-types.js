export const CAMPAIGNS=[
 {key:'welcome',name:'Listing Welcome',taskKey:'intro',description:'Announce the free listing, invite corrections and offer a Free Visibility Check.'},
 {key:'story',name:'Business Story',taskKey:'story_request',description:'Ask for the story behind the business and offer a Free Visibility Check.'},
 {key:'visibility',name:'Visibility Check',taskKey:'offer',description:'A separate email or phone invitation for a Free Visibility Check.'},
 {key:'upgrade',name:'Listing Upgrade',taskKey:'upgrade_offer',description:'Offer an upgraded directory listing and explain its benefits.'},
 {key:'introductory',name:'Introductory Offer',taskKey:'introductory_offer',description:'Optional $149 Small Business Online Visibility Refresh. Draft outreach only; review and approve before sending.'},
]
export const campaignKey=value=>CAMPAIGNS.find(c=>c.key===value||c.name===value)?.key||''
export const campaignName=value=>CAMPAIGNS.find(c=>c.key===value)?.name||'Not classified'
