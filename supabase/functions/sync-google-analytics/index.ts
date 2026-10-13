import {WORKSPACE,PROPERTIES,accessToken,collect} from './core.mjs'
const ORIGINS=['https://mktvisibility.github.io','https://mkt-visibility-command-center.wintryspark17.chatgpt.site']
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||''
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGINS.includes(origin)?origin:ORIGINS[0],'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status})
 if(origin&&!ORIGINS.includes(origin))return reply({error:'Origin not allowed.'},403)
 if(req.method==='OPTIONS')return new Response(null,{headers,status:204})
 if(req.method!=='POST')return reply({error:'Use POST.'},405)
 const base=Deno.env.get('SUPABASE_URL')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''
 const serviceHeaders={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'}
 const rpc=async(name:string,input:unknown={})=>{
  const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:serviceHeaders,body:JSON.stringify(input),signal:AbortSignal.timeout(15000)})
  if(!r.ok){console.error('Analytics database RPC failed',name,r.status);throw Error('Analytics database operation failed.')} 
  const text=await r.text();return text?JSON.parse(text):null
 }
 let lease:string|null=null
 try{
  const cronHeader=req.headers.get('x-cc-ga-token')||''
  let scheduled=false,role=''
  if(cronHeader){const secret=await rpc('cc_ga_cron_token');if(!secret||cronHeader!==secret)return reply({error:'Invalid scheduler authorization.'},401);scheduled=true}
  else{
   const auth=req.headers.get('authorization')||''
   if(!auth.startsWith('Bearer '))return reply({error:'Sign in before refreshing Analytics.'},401)
   const anon=Deno.env.get('SUPABASE_ANON_KEY')||''
   const userHeaders={apikey:anon,Authorization:auth}
   const userResponse=await fetch(base+'/auth/v1/user',{headers:userHeaders,signal:AbortSignal.timeout(10000)})
   if(!userResponse.ok)return reply({error:'Please sign in again.'},401)
   const user=await userResponse.json()
   const memberResponse=await fetch(base+`/rest/v1/cc_members?workspace_id=eq.${WORKSPACE}&user_id=eq.${encodeURIComponent(user.id)}&enabled=eq.true&select=role`,{headers:userHeaders,signal:AbortSignal.timeout(10000)})
   if(!memberResponse.ok)return reply({error:'Workspace access could not be checked.'},403)
   const members=await memberResponse.json();role=members[0]?.role||''
   if(!['owner','editor','viewer'].includes(role))return reply({error:'Approved workspace access is required.'},403)
  }
  const raw=await req.text();if(raw.length>1000)return reply({error:'Request too large.'},413)
  let body:{action?:string,brand?:string}={};try{body=raw?JSON.parse(raw):{}}catch{return reply({error:'Invalid request.'},400)}
  const action=body.action||'refresh'
  if(action==='status'){
   if(scheduled)return reply({error:'Scheduler cannot read interactive status.'},403)
   const r=await fetch(base+`/rest/v1/cc_ga_sync_state?workspace_id=eq.${WORKSPACE}&select=brand,property_id,status,last_attempt_at,last_success_at,last_error,period_start,period_end,sources,locations`,{headers:serviceHeaders})
   if(!r.ok)throw Error('Analytics status could not be loaded.')
   return reply({configured:Boolean(Deno.env.get('GA_SERVICE_ACCOUNT_JSON')),schedule:'Daily at 8:00 AM America/Denver',states:await r.json()})
  }
  if(action!=='refresh')return reply({error:'Unknown Analytics action.'},400)
  if(!scheduled&&!['owner','editor'].includes(role))return reply({error:'Only approved editors can refresh Analytics.'},403)
  if(body.brand&&!Object.hasOwn(PROPERTIES,body.brand))return reply({error:'Unknown Analytics brand.'},400)
  lease=await rpc('cc_ga_claim');if(!lease)return reply({error:'An import is already running or was requested in the last minute. Try again shortly.'},409)
  const brands=body.brand?[body.brand]:Object.keys(PROPERTIES)
  const rawCredentials=Deno.env.get('GA_SERVICE_ACCOUNT_JSON')
  if(!rawCredentials){for(const brand of brands)await rpc('cc_ga_failure',{p_brand:brand,p_error:'One-time Google reporting connection is needed. Add GA_SERVICE_ACCOUNT_JSON to the server secrets after granting Viewer access.',p_status:'needs_setup'});return reply({error:'Google reporting connection is not configured yet. Your saved statistics are unchanged.',setupNeeded:true},503)}
  let token:string
  try{token=await accessToken(JSON.parse(rawCredentials))}catch{for(const brand of brands)await rpc('cc_ga_failure',{p_brand:brand,p_error:'Google reporting credentials could not be used. Check GA_SERVICE_ACCOUNT_JSON and the service account key.',p_status:'error'});return reply({error:'Google reporting credentials could not be used. Previous statistics are unchanged.'},502)}
  // Each property runs independently; four sequential requests per property.
  // Parallel properties keep the whole import within Edge Function wall-time limits.
  const results=await Promise.all(brands.map(async brand=>{
   try{const report=await collect(brand,token);await rpc('cc_ga_store',{p_report:report});return {brand,success:true,records:report.records.length,period:report.range}}
   catch(error){const message=error instanceof Error?error.message:'Analytics import failed.';const safe=/^(Google|Invalid Analytics|Invalid daily Analytics|Unexpected Analytics|Incomplete Analytics|Expected a single Analytics|Analytics value)/.test(message)?message:'Analytics import failed; previous saved statistics are unchanged.';await rpc('cc_ga_failure',{p_brand:brand,p_error:safe,p_status:'error'});return {brand,success:false,error:safe}}
  }))
  return reply({results,success:results.every(r=>r.success)})
 }catch(error){console.error('Analytics sync failed',error instanceof Error?error.message:'unknown');return reply({error:'Analytics synchronization could not complete. Check connection status and try again.'},500)}
 finally{if(lease){try{await rpc('cc_ga_release',{p_lease:lease})}catch{/* Lease expires automatically after five minutes. */}}}
})
