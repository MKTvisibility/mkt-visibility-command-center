import {validPageFilename} from './page-filename.mjs'
const WORKSPACE='c8748032-cdd3-443b-8c56-2e846cc9bf31'
const SITES:Record<string,{repo:string,secret:string,url:string}>={
 'Loving Longmont':{repo:'MKTvisibility/LovingLongmont',secret:'CO_GITHUB_TOKEN',url:'https://mktvisibility.github.io/LovingLongmont/'},
 'MKT Colorado':{repo:'MKTvisibility/Colorado',secret:'CO_GITHUB_TOKEN',url:'https://mktcolorado.com/'}
}
const ORIGINS=['https://mktvisibility.github.io','https://mkt-visibility-command-center.wintryspark17.chatgpt.site']
const decode64=(s:string)=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)))
const encode64=(s:string)=>{let result='';for(const n of new TextEncoder().encode(s))result+=String.fromCharCode(n);return btoa(result)}
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||''
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGINS.includes(origin)?origin:ORIGINS[0],'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
 const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{headers,status})
 if(origin&&!ORIGINS.includes(origin))return reply({error:'Origin not allowed.'},403)
 if(req.method==='OPTIONS')return new Response(null,{headers,status:204})
 if(req.method!=='POST')return reply({error:'Use POST.'},405)
 try{
  const auth=req.headers.get('authorization')||''
  if(!auth.startsWith('Bearer '))return reply({error:'Sign in before publishing.'},401)
  const base=Deno.env.get('SUPABASE_URL')||'',apikey=Deno.env.get('SUPABASE_ANON_KEY')||Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}'))[0] as string
  const dbHeaders={apikey,Authorization:auth,'Content-Type':'application/json'}
  const userResponse=await fetch(base+'/auth/v1/user',{headers:dbHeaders});if(!userResponse.ok)return reply({error:'Please sign in again.'},401)
  const user=await userResponse.json();if(!user.id)return reply({error:'Please sign in again.'},401)
  const read=async(table:string,query:string)=>{const r=await fetch(base+'/rest/v1/'+table+'?'+query,{headers:dbHeaders});if(!r.ok)throw Error('Unable to read published workspace records.');return r.json()}
  const members=await read('cc_members',`workspace_id=eq.${WORKSPACE}&user_id=eq.${encodeURIComponent(user.id)}&enabled=eq.true&select=role`)
  if(!members.some((m:{role:string})=>['owner','editor'].includes(m.role)))return reply({error:'Only approved editors can create public business pages.'},403)
  const body=await req.text();if(body.length>1000)return reply({error:'Request too large.'},413)
  const {businessId}=JSON.parse(body);if(!/^[0-9a-f-]{36}$/i.test(businessId||''))throw Error('Choose a saved business.')
  const rows=await read('cc_ll_live_publications',`business_id=eq.${businessId}&workspace_id=eq.${WORKSPACE}&select=business_id,route,public_content,sites,active`)
  const row=rows[0];if(!row)throw Error('Publish the business record before creating its page.')
  if(!row.active)return reply({results:[],unpublished:true})
  const businesses=await read('cc_businesses',`id=eq.${businessId}&workspace_id=eq.${WORKSPACE}&select=notes`);let notes:Record<string,unknown>={};try{notes=JSON.parse(businesses[0]?.notes||'{}')}catch{/* legacy notes */}
  const route=typeof notes.pageFilename==='string'?notes.pageFilename:row.route
  if(!validPageFilename(route))throw Error('Invalid business page filename.')
  const results=[]
  for(const site of row.sites){
   const config=SITES[site];if(!config)continue
   try{
    const token=Deno.env.get(config.secret)||'';if(!token)throw Error('Named page creation needs the secure GitHub publishing connection. Your published profile remains available.')
    const git=async(path:string,method='GET',body?:unknown)=>{const r=await fetch(`https://api.github.com/repos/${config.repo}/${path}`,{method,headers:{Authorization:'Bearer '+token,'User-Agent':'MKT-Command-Center',Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(r.status===404&&method==='GET')return null;if(!r.ok)throw Error(`Page creation failed (${r.status}). Published business information is retained.`);return r.json()}
    const mapFile=await git('contents/assets/live/business-routes.json?ref=main');let routes:Record<string,string>={};if(mapFile){routes=JSON.parse(decode64(mapFile.content));if(!routes||Array.isArray(routes)||typeof routes!=='object')throw Error('Public business route map is invalid.')}
    if(Object.entries(routes).some(([id,path])=>id!==businessId&&path===route))throw Error('That page filename belongs to another business.')
    const existing=await git('contents/'+encodeURIComponent(route)+'?ref=main')
    const marker=`data-ll-profile="${businessId}"`
    if(existing&&!decode64(existing.content).includes(marker))throw Error('That filename already belongs to another page. Choose a different page name.')
    const template=await git('contents/business.html?ref=main');if(!template?.content)throw Error('The public business page template is unavailable.')
    let html=existing?decode64(existing.content):decode64(template.content)
    if(!existing&&!html.includes('data-ll-profile=""'))throw Error('The business template could not be identified safely.')
    html=html.replace('data-ll-profile=""',marker).replace(/<title>[\s\S]*?<\/title>/,`<title>${escapeHtml(row.public_content.name)} | ${escapeHtml(site)}</title>`)
    const result=existing&&decode64(existing.content)===html?{commit:{sha:'unchanged'}}:await git('contents/'+encodeURIComponent(route),'PUT',{message:`Command Center: create page for ${row.public_content.name}`,content:encode64(html),...(existing?{sha:existing.sha}:{}),branch:'main'})
    if(routes[businessId]!==route){routes[businessId]=route;await git('contents/assets/live/business-routes.json','PUT',{message:`Command Center: link named page for ${row.public_content.name}`,content:encode64(JSON.stringify(routes,null,2)),...(mapFile?{sha:mapFile.sha}:{}),branch:'main'})}
    if(site==='Loving Longmont'){
     // Preserve the first known listing date separately from republishing timestamps.
     // A reporting-file failure must not hide a successful page publication.
     try{
      const datePath='contents/assets/reporting/listing-dates.json';const file=await git(datePath+'?ref=main');
      const registry=file?JSON.parse(decode64(file.content)):{version:1,businesses:{}};
      if(!registry.businesses[businessId]){
       registry.businesses[businessId]={name:row.public_content.name,first_listed_at:new Date().toISOString(),source:'first_recorded_page_publication',evidence:'Recorded by Command Center page publisher; earlier unrecorded listing history may be unknown.'};
       await git(datePath,'PUT',{message:`Record first known listing date for ${row.public_content.name}`,content:encode64(JSON.stringify(registry,null,2)+'\n'),...(file?{sha:file.sha}:{}),branch:'main'});
      }
     }catch{console.warn('Page published; listing-date registry needs retry for business',businessId)}
    }
    results.push({site,success:true,url:config.url+route,commit:result.commit.sha,deploymentPending:true})
   }catch(e){results.push({site,success:false,error:(e as Error).message})}
  }
  return reply({results})
 }catch(e){return reply({error:(e as Error).message||'Page creation failed.'},400)}
})
