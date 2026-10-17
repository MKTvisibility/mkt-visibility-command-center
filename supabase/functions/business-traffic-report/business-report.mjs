import {values,googleError,dateRange} from '../sync-google-analytics/core.mjs'
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const exact=(fieldName,value)=>({filter:{fieldName,stringFilter:{matchType:'EXACT',value}}})
const both=(...expressions)=>({andGroup:{expressions}})
export function reportRange(firstListed,start,end,now=new Date()){
 const through=dateRange(now).end,first=firstListed?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(firstListed)):null;
 start=start||first;end=end||through;
 if(!day(start)||!day(end)||start>end||end>through||start<'2020-01-01')throw Error('Choose valid report dates ending no later than yesterday.');
 if(first&&start<first)throw Error('The report cannot begin before the recorded listing date.');
 return {start,end,timezone:'America/Denver',firstListedDate:first};
}
export function profileFilter(routes,id){
 const paths=routes.filter(r=>/^[a-z0-9-]+\.html$/.test(r)&&r!=='business.html');
 const values=[...new Set(paths.flatMap(r=>['/'+r,'/LovingLongmont/'+r,'/loving-longmont-website/'+r]))];
 const named=values.length?{filter:{fieldName:'pagePath',inListFilter:{values}}}:null;
 // The standard page dimension contains query strings, but never URL fragments.
 const generic={filter:{fieldName:'pagePathPlusQueryString',stringFilter:{matchType:'FULL_REGEXP',value:`.*/business[.]html[?](.*&)?id=${id}(&.*)?`}}};
 return named?{orGroup:{expressions:[named,generic]}}:generic;
}
export async function collectBusinessReport({business,firstListed,firstListedSource,routes,start,end,trackingStart},token,fetcher=fetch,now=new Date()){
 if(!uuid.test(business.id))throw Error('Choose a saved business.');
 const range=reportRange(firstListed,start,end,now);
 const host={filter:{fieldName:'hostName',inListFilter:{values:['lovinglongmont.com','www.lovinglongmont.com','mktvisibility.github.io','lovinglongmont.github.io']}}};
 const page=profileFilter(routes,business.id),filters=both(host,page);
 const query=async body=>{const r=await fetcher('https://analyticsdata.googleapis.com/v1beta/properties/558375784:runReport',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({dateRanges:[{startDate:range.start,endDate:range.end}],...body}),signal:AbortSignal.timeout(20000)});if(!r.ok){const error=new Error(googleError(r.status));error.status=r.status;throw error;}return r.json();};
 const metrics=['activeUsers','screenPageViews','sessions'].map(name=>({name}));
 const [site,profile]=await Promise.all([query({metrics,dimensionFilter:host}),query({metrics,dimensionFilter:filters})]);
 const result={business,range,firstListed,firstListedSource,trackingStart,generatedAt:now.toISOString(),site:values(site),profile:values(profile),actions:null,exposure:null,metadata:{site:site.metadata||{},profile:profile.metadata||{}},notes:[
  'Visitors means GA4 active users, measured separately for the whole site and this profile. Do not add daily users or business totals to estimate unique site visitors.',
  'Whole-site traffic is audience context; it does not mean those visitors saw this business. Page views can include repeat visits. Clicks are interactions, not confirmed customers or sales.',
  'Owner visits, blockers, consent choices, processing delays and Google privacy thresholds can affect totals. Previous URL fragments cannot be separated in historical page-path reports.',
  firstListedSource==='repository_first_mention'?'Listing start uses earliest available website repository evidence; the listing may have existed earlier.':'Listing start uses the earliest recorded publication available; an earlier listing date may be unknown.'
 ]};
 if(trackingStart&&range.start<trackingStart.slice(0,10))result.notes.push('This reporting period begins before the recorded Analytics installation; traffic before tracking began is unavailable.');
 try{
  const actions=await query({dimensions:[{name:'customEvent:action_type'}],metrics:[{name:'eventCount'}],dimensionFilter:both(filters,exact('eventName','ll_business_click')),limit:20});
  result.actions={website:0,phone:0,email:0,social:0};
  for(const r of actions.rows||[]){const key=r.dimensionValues?.[0]?.value,value=Number(r.metricValues?.[0]?.value);if(Object.hasOwn(result.actions,key)&&Number.isSafeInteger(value)&&value>=0)result.actions[key]+=value;}
 }catch(e){if(e.status!==400)throw e;result.notes.push('Contact-click breakdown awaits the action_type event-scoped custom dimension in Google Analytics; unavailable is not zero.');}
 try{
  const exposure=await query({dimensions:[{name:'eventName'}],metrics:[{name:'eventCount'}],dimensionFilter:both(host,exact('customEvent:business_id',business.id),{filter:{fieldName:'eventName',inListFilter:{values:['ll_listing_impression','ll_profile_open','ll_profile_view']}}}),limit:10});
  result.exposure={ll_listing_impression:0,ll_profile_open:0,ll_profile_view:0};
  for(const r of exposure.rows||[]){const key=r.dimensionValues?.[0]?.value,value=Number(r.metricValues?.[0]?.value);if(Object.hasOwn(result.exposure,key)&&Number.isSafeInteger(value)&&value>=0)result.exposure[key]+=value;}
 }catch(e){if(e.status!==400)throw e;result.notes.push('Business-specific exposure awaits the business_id event-scoped custom dimension. New interaction tracking starts October 17, 2026; it cannot reconstruct earlier activity.');}
 return result;
}
