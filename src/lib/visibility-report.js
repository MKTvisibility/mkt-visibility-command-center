import {metadata} from './portfolio.js'

// A report may only consume research belonging to the profile that opened it.
export function researchMatchesBusiness(run,business){
 if(!run||run.business_id!==business.id)return false
 const research=run.research||{}
 if(research.business_id&&research.business_id!==business.id)return false
 const name=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
 return !research.business||name(research.business)===name(business.name)
}

export function reportAssessment(business,profile,run,tasks=[]){
 const research=researchMatchesBusiness(run,business)?run.research:null
 const draft=research?.assessment||{}
 const approved=profile?.business_id&&profile.business_id!==business.id?{}:profile?.approved||{}
 const platforms=Object.fromEntries(Object.entries(draft.platforms||{}).map(([name,p])=>[name,{...p,explanation:research?.platform_notes?.[name]??p.explanation}]))
 for(const [name,p] of Object.entries(approved.platforms||{})){
  const reviewed=tasks.some(t=>t.business_id===business.id&&metadata(t).businessChecklistKey===`rating:${name}`&&t.status==='Done')
  if(reviewed||p.review_status==='Approved'||p.state==='Not Applicable'||!platforms[name])platforms[name]=p
 }
 return {...approved,...draft,platforms}
}
