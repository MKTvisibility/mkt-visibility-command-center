import {SITES,pageTarget,publicBusiness,updatePage,fingerprint} from './core.mjs'
const WORKSPACE='c8748032-cdd3-443b-8c56-2e846cc9bf31'
const ORIGINS=['https://mktvisibility.github.io','https://mkt-visibility-command-center.wintryspark17.chatgpt.site']
const encode64=(text:string)=>{const bytes=new TextEncoder().encode(text);let result='';for(const n of bytes)result+=String.fromCharCode(n);return btoa(result)}
const decode64=(text:string)=>new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0)))
export async function handle(req:Request){
 const origin=req.headers.get('origin')||''
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':ORIGINS.includes(origin)?origin:ORIGINS[0],'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}
 const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers})
 if(origin&&!ORIGINS.includes(origin))return response({error:'Origin not allowed.'},403)
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers})
 if(req.method!=='POST')return response({error:'Use POST.'},405)
 try {
  const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return response({error:'Sign in before publishing.'},401)
  const base=Deno.env.get('SUPABASE_URL')||''
  const apikey=Deno.env.get('SUPABASE_ANON_KEY')||Object.values(JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}'))[0] as string
  if(!base||!apikey)throw Error('Publishing service configuration is incomplete.')
  const dbHeaders={apikey,Authorization:auth,'Content-Type':'application/json'}
  const userResponse=await fetch(base+'/auth/v1/user',{headers:dbHeaders});if(!userResponse.ok)return response({error:'Please sign in again.'},401)
  const user=await userResponse.json();if(!user.id)return response({error:'Please sign in again.'},401)
  const read=async(table:string,query:string)=>{const r=await fetch(base+'/rest/v1/'+table+'?'+query,{headers:dbHeaders});if(!r.ok)throw Error('Unable to read approved workspace records.');return r.json()}
  const members=await read('cc_members',`workspace_id=eq.${WORKSPACE}&user_id=eq.${encodeURIComponent(user.id)}&enabled=eq.true&select=role,display_name`)
  if(!members.some((m:{role:string})=>['owner','editor'].includes(m.role)))return response({error:'Only approved owners and editors can publish.'},403)
  const bodyText=await req.text();if(bodyText.length>20000)return response({error:'Request too large.'},413)
  const input=JSON.parse(bodyText)
  const ready=Object.fromEntries(Object.entries(SITES).map(([site,c])=>[site,Boolean(Deno.env.get(c.secret))]))
  if(input.action==='status')return response({ready})
  if(!['preview','publish','remove'].includes(input.action))throw Error('Choose preview, publish or remove.')
  if(!/^[0-9a-f-]{36}$/i.test(input.businessId||''))throw Error('Choose a saved business.')
  if(!Array.isArray(input.sites)||input.sites.length<1||input.sites.length>2||new Set(input.sites).size!==input.sites.length||input.sites.some((s:string)=>!SITES[s]))throw Error('Choose Loving Longmont, MKT Colorado or both.')
  if(input.sites.some((s:string)=>!ready[s]))return response({error:'Website publishing needs secure GitHub credentials in Supabase. Image uploads and saving changes are available; live publishing is not connected yet.',setupRequired:true},503)
  const businesses=await read('cc_businesses',`workspace_id=eq.${WORKSPACE}&id=eq.${input.businessId}&select=*`);const raw=businesses[0];if(!raw)return response({error:'Business not found in your workspace.'},404)
  const operation=input.action==='remove'||input.intent==='remove'?'remove':'publish'
  const b=publicBusiness(operation==='remove'?{...raw,image_url:'',website:'',social_urls:[]}:raw);const listings=await read('cc_listings',`workspace_id=eq.${WORKSPACE}&business_id=eq.${input.businessId}&status=neq.Archived&select=site,url,title`)
  let notes={};try{notes=JSON.parse(raw.notes||'{}')||{}}catch{/* legacy plain notes */}
  const plans=[]
  for(const site of input.sites){
   const config=SITES[site];const token=Deno.env.get(config.secret)!
   const git=async(path:string,method='GET',body?:unknown)=>{const r=await fetch(`https://api.github.com/repos/${config.repo}/${path}`,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(`${site}: GitHub operation failed (${r.status}). Check publishing access or retry after reviewing changes.`);return r.json()}
   const targets=new Map();for(const l of listings.filter((l:{site:string})=>l.site===site)){if(l.url){const t=pageTarget(site,l.url);targets.set(t.path,t)}}
   for(const url of [...((notes as any).publicationResults?.[site]?.pages||[]),...(input.extraUrls?.[site]||[])]){const t=pageTarget(site,url);targets.set(t.path,t)}
   if(!targets.size)throw Error(`${site}: add the page URL and category section before publishing.`)
   if(targets.size>15)throw Error('A maximum of 15 pages per site can be published at once.')
   const head=await git('git/ref/heads/main');const parent=head.object.sha;const commit=await git('git/commits/'+parent)
   const files=[]
   for(const target of targets.values()){
    const file=await git('contents/'+encodeURIComponent(target.path)+'?ref='+parent)
    if(file.type!=='file'||file.size>2000000||file.encoding!=='base64')throw Error('Page is too large or unsupported.')
    const old=decode64(file.content)
    const previous=(notes as any).publicationResults?.[site]?.name
    const aliases=[...listings.filter((l:{site:string})=>l.site===site).map((l:{title:string})=>l.title),previous].filter(Boolean)
    const changed=updatePage(old,b,site,target,operation,aliases)
    files.push({...target,oldSha:file.sha,content:changed.html,count:changed.count})
   }
   plans.push({site,repo:config.repo,parent,tree:commit.tree.sha,files,git})
  }
  const signature=await fingerprint({business:b,operation,plans:plans.map(p=>({site:p.site,parent:p.parent,files:p.files.map(f=>({path:f.path,sha:f.oldSha,content:f.content}))}))})
  const preview={signature,business:b,operation,sites:plans.map(p=>({site:p.site,pages:p.files.map(f=>({url:f.url,path:f.path,count:f.count}))}))}
  if(input.action==='preview')return response(preview)
  if(input.signature!==signature)return response({error:'The business or website changed after preview. Preview again before publishing.'},409)
  const results=[]
  for(const plan of plans){
   try{
    const blobs=[];for(const f of plan.files){const blob=await plan.git('git/blobs','POST',{content:encode64(f.content),encoding:'base64'});blobs.push({path:f.path,mode:'100644',type:'blob',sha:blob.sha})}
    const tree=await plan.git('git/trees','POST',{base_tree:plan.tree,tree:blobs})
    const commit=await plan.git('git/commits','POST',{message:`Command Center: ${operation==='remove'?'remove':'publish'} ${b.name}`,tree:tree.sha,parents:[plan.parent]})
    await plan.git('git/refs/heads/main','PATCH',{sha:commit.sha,force:false})
    results.push({site:plan.site,success:true,operation,commit:commit.sha,commitUrl:`https://github.com/${plan.repo}/commit/${commit.sha}`,pages:plan.files.map(f=>f.url),name:b.name,submittedAt:new Date().toISOString()})
   }catch(error){results.push({site:plan.site,success:false,error:(error as Error).message})}
  }
  return response({results,message:'Successful changes were committed. Website hosting still needs to finish its deployment; this is not a verified live-page result.'})
 }catch(error){return response({error:(error as Error).message||'Publishing failed.'},400)}
}
Deno.serve(handle)
