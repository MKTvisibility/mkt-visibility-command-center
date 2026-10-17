import {accessToken,WORKSPACE} from '../sync-google-analytics/core.mjs'
import {collectBusinessReport} from './business-report.mjs'
const ORIGINS=['https://mktvisibility.github.io','https://mkt-visibility-command-center.wintryspark17.chatgpt.site']
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||''
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGINS.includes(origin)?origin:ORIGINS[0],'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{headers,status})
 if(origin&&!ORIGINS.includes(origin))return reply({error:'Origin not allowed.'},403)
 if(req.method==='OPTIONS')return new Response(null,{headers,status:204})
 if(req.method!=='POST')return reply({error:'Use POST.'},405)
 // Gateway JWT verification is also enabled. No cron token or anonymous fallback.
 const authorization=req.headers.get('authorization')||''
 if(!authorization.startsWith('Bearer '))return reply({error:'Sign in before running a business report.'},401)
 try{
  const base=Deno.env.get('SUPABASE_URL')||'',apikey=Deno.env.get('SUPABASE_ANON_KEY')||''
  const userHeaders={apikey,Authorization:authorization}
  const user=await fetch(base+'/auth/v1/user',{headers:userHeaders,signal:AbortSignal.timeout(10000)})
  if(!user.ok)return reply({error:'Please sign in again.'},401)
  const identity=await user.json();if(!identity.id)return reply({error:'Please sign in again.'},401)
  // Use the caller's RLS context for every database read, never service-role reads.
  const read=async(table:string,query:string)=>{const response=await fetch(base+'/rest/v1/'+table+'?'+query,{headers:userHeaders,signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Business reporting records could not load.');return response.json()}
  const members=await read('cc_members',`workspace_id=eq.${WORKSPACE}&user_id=eq.${encodeURIComponent(identity.id)}&enabled=eq.true&select=role`)
  if(!['owner','editor','viewer'].includes(members[0]?.role))return reply({error:'Approved workspace access is required.'},403)
  const raw=await req.text();if(raw.length>1000)return reply({error:'Request too large.'},413)
  let body:{businessId?:string,start?:string,end?:string};try{body=JSON.parse(raw)}catch{return reply({error:'Invalid report request.'},400)}
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.businessId||''))return reply({error:'Choose a saved business.'},400)
  const rows=await read('cc_ll_live_publications',`workspace_id=eq.${WORKSPACE}&business_id=eq.${body.businessId}&select=business_id,route,public_content,sites`)
  const row=rows[0];if(!row||!(row.sites||[]).includes('Loving Longmont'))return reply({error:'Publish this business on Loving Longmont before running its report.'},404)
  let dates:Record<string,{first_listed_at?:string,source?:string}>={};try{const response=await fetch('https://raw.githubusercontent.com/MKTvisibility/LovingLongmont/main/assets/reporting/listing-dates.json',{signal:AbortSignal.timeout(10000)});if(response.ok)dates=(await response.json()).businesses||{}}catch{/* The user can enter a verified date when baseline lookup is unavailable. */}
  const baseline=dates[row.business_id]
  const saved=await read('cc_businesses',`workspace_id=eq.${WORKSPACE}&id=eq.${body.businessId}&select=notes`)
  const tracking=await read('cc_tracking_setup',`workspace_id=eq.${WORKSPACE}&brand=eq.Loving%20Longmont&select=installed_at`)
  let notes:Record<string,unknown>={};try{notes=JSON.parse(saved[0]?.notes||'{}')}catch{}
  const routes=[row.route,typeof notes.pageFilename==='string'?notes.pageFilename:'']
  const credentials=Deno.env.get('GA_SERVICE_ACCOUNT_JSON');if(!credentials)return reply({error:'Google reporting connection is not configured.'},503)
  const token=await accessToken(JSON.parse(credentials))
  const result=await collectBusinessReport({business:{id:row.business_id,name:row.public_content.name},firstListed:baseline?.first_listed_at,firstListedSource:baseline?.source,routes,start:body.start,end:body.end,trackingStart:tracking[0]?.installed_at},token)
  return reply(result)
 }catch(error){const message=error instanceof Error?error.message:'';return reply({error:/^(Choose|The report|Google|Invalid Analytics|Expected a single|Analytics value)/.test(message)?message:'Business report could not complete. Please try again.'},400)}
})
