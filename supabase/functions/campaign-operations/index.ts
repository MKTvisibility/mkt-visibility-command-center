import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {MAILBOXES,SCOPES,base64url,digest,secret,connectionStatus,gmailClient} from './gmail.mjs';
import {rpc,loadQueue,runCampaign,isSendCommand,preflight} from './core.mjs';
const WORKSPACE='c8748032-cdd3-443b-8c56-2e846cc9bf31',APP='https://mktvisibility.github.io/mkt-visibility-command-center/';
const ORIGINS=['https://mktvisibility.github.io','https://mkt-visibility-command-center.wintryspark17.chatgpt.site'];
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin')||'',cors={'Access-Control-Allow-Origin':ORIGINS.includes(origin)?origin:ORIGINS[0],'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const respond=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'content-type':'application/json','cache-control':'no-store'}});
 const page=(text:string,status=200)=>new Response(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Business Gmail connection</title><body><h1>Business Gmail connection</h1><p>${text}</p><a href="${APP}">Return to Command Center</a></body></html>`,{status,headers:{'content-type':'text/html;charset=UTF-8','cache-control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; base-uri 'none'; frame-ancestors 'none'"}});
 if(origin&&!ORIGINS.includes(origin))return respond({error:'Origin not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,redirect=url+'/functions/v1/campaign-operations?oauth=callback';
 const db=createClient(url,service);
 // OAuth callback has no Supabase JWT. A one-use, expiring, owner-bound state plus PKCE authenticates this path.
 if(req.method==='GET'&&new URL(req.url).searchParams.get('oauth')==='callback'){
  try{const q=new URL(req.url).searchParams,state=q.get('state')||'';if(state.length<32||state.length>128)return page('Connection request is invalid or expired.',400);
   const {data:pending,error}=await db.from('cc_gmail_oauth_states').delete().eq('state_hash',await digest(state)).gt('expires_at',new Date().toISOString()).select().maybeSingle();
   if(error||!pending)return page('Connection request is invalid, expired, or already used. Start again in Command Center.',400);
   const {data:owner}=await db.from('cc_members').select('role').eq('workspace_id',WORKSPACE).eq('user_id',pending.requested_by).eq('enabled',true).maybeSingle();if(owner?.role!=='owner')return page('An enabled workspace owner must connect this mailbox.',403);
   if(q.get('error')||!q.get('code'))return page('Google authorization was cancelled. Nothing was connected.',400);
   const config=await secret(db,'oauth_config');const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.client_id,client_secret:config.client_secret,code:q.get('code')!,code_verifier:pending.verifier,redirect_uri:redirect,grant_type:'authorization_code'})});
   const token=await response.json();if(!response.ok||!token.access_token||!token.refresh_token)return page('Google did not grant persistent access. Start again and approve the required permissions.',400);
   const granted=new Set(String(token.scope||'').split(' '));if(SCOPES[pending.slot].some((s:string)=>!granted.has(s)))return page('Required mailbox permissions were not granted. Nothing was connected.',400);
   const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});const profile=await r.json();
   if(!r.ok||profile.emailAddress?.toLowerCase()!==MAILBOXES[pending.slot]){await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:token.refresh_token}),signal:AbortSignal.timeout(10000)}).catch(()=>{});return page('The selected Google account was not the requested business mailbox. Nothing was connected.',400)}
   await secret(db,pending.slot,'set',{refresh_token:token.refresh_token,email:MAILBOXES[pending.slot],scopes:[...granted],connected_by:pending.requested_by,connected_at:new Date().toISOString()});return page('Your business mailbox is connected. No campaign email was sent. Return to Command Center and refresh Email tools.');
  }catch{return page('The connection could not be completed. Start again in Command Center. No campaign email was sent.',503)}
 }
 if(req.method!=='POST')return respond({error:'Use an authenticated POST request.'},405);
 const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return respond({error:'Sign in first.'},401);
 const caller=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user},error:authError}=await caller.auth.getUser();if(authError||!user)return respond({error:'Please sign in again.'},401);
 const {data:member,error:memberError}=await db.from('cc_members').select('role').eq('workspace_id',WORKSPACE).eq('user_id',user.id).eq('enabled',true).maybeSingle();if(memberError)return respond({error:'Workspace access could not be verified.'},503);if(!member||!['owner','editor'].includes(member.role))return respond({error:'Approved partner editing access is required.'},403);
 let body:any;try{const raw=await req.text();if(raw.length>16000)return respond({error:'Request too large.'},413);body=JSON.parse(raw)}catch{return respond({error:'Invalid request.'},400)}
 try{
  if(body.action==='status'||body.action==='history'){
   const {data:runs,error}=await db.from('cc_email_dispatch_runs').select('id,status,result,created_at,finished_at,requested_by').eq('workspace_id',WORKSPACE).order('created_at',{ascending:false}).limit(5);if(error)throw Error('Campaign history could not be loaded.');
   const {data:partners}=await db.from('cc_members').select('user_id,display_name').eq('workspace_id',WORKSPACE);
   const history=(runs||[]).map(({requested_by,...run}:any)=>({...run,requestedBy:partners?.find((p:any)=>p.user_id===requested_by)?.display_name||'Business partner'}));
   if(body.action==='history')return respond({runs:history});
   return respond({...await connectionStatus(db),owner:member.role==='owner',redirectUri:redirect,recentRuns:history});
  }
  if(body.action==='configure'){
   if(member.role!=='owner')return respond({error:'Only the workspace owner can configure Gmail.'},403);
   if(!/^[a-zA-Z0-9_.-]+\.apps\.googleusercontent\.com$/.test(body.client_id||'')||typeof body.client_secret!=='string'||body.client_secret.length<10||body.client_secret.length>500)return respond({error:'Enter a valid Google web OAuth client ID and client secret.'},400);
   const current=await connectionStatus(db);if(current.primaryConnected||current.legacyConnected)return respond({error:'Disconnect mailboxes before replacing the OAuth application.'},409);
   await secret(db,'oauth_config','set',{client_id:body.client_id,client_secret:body.client_secret});return respond({saved:true});
  }
  if(body.action==='connect'){
   if(member.role!=='owner')return respond({error:'Only the workspace owner can connect Gmail.'},403);
   const slot=body.slot==='legacy'?'legacy':'primary',config=await secret(db,'oauth_config');if(!config.client_id||!config.client_secret)return respond({error:'Configure the Google OAuth application first.'},409);
   const state=base64url(crypto.getRandomValues(new Uint8Array(32))),verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
   await db.from('cc_gmail_oauth_states').delete().lt('expires_at',new Date().toISOString());
   const {error}=await db.from('cc_gmail_oauth_states').insert({state_hash:await digest(state),verifier,slot,requested_by:user.id});if(error)throw Error('Could not create a secure connection request.');
   const query=new URLSearchParams({client_id:config.client_id,redirect_uri:redirect,response_type:'code',scope:SCOPES[slot].join(' '),state,code_challenge:await digest(verifier),code_challenge_method:'S256',access_type:'offline',prompt:'consent select_account',login_hint:MAILBOXES[slot]});return respond({url:'https://accounts.google.com/o/oauth2/v2/auth?'+query});
  }
  if(body.action==='disconnect'){
   if(member.role!=='owner')return respond({error:'Only the workspace owner can disconnect Gmail.'},403);
   const slot=body.slot==='legacy'?'legacy':'primary',old=await secret(db,slot);if(old.refresh_token){const revoke=await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:old.refresh_token}),signal:AbortSignal.timeout(15000)});if(!revoke.ok&&revoke.status!==400)throw Error('Google did not confirm revocation; disconnect was not completed.');}await secret(db,slot,'set',{});return respond({disconnected:true});
  }
  if(body.action==='search_mailbox'||body.action==='read_mailbox_message'){
   const primary=await gmailClient(db,'primary');
   return respond(body.action==='search_mailbox'?await primary.search({query:body.query,page_token:body.page_token}):{mailbox:MAILBOXES.primary,message:await primary.read(body.message_id),readOnly:true});
  }
  if(body.action==='queue')return respond({queue:await loadQueue(db,WORKSPACE),connection:await connectionStatus(db)});
  if(body.action==='check'){
   const primary=await gmailClient(db,'primary'),status=await connectionStatus(db),legacy=status.legacyConnected?await gmailClient(db,'legacy'):null;
   const {data:approvals,error}=await db.from('cc_email_approvals').select('*').eq('workspace_id',WORKSPACE).eq('status','Approved').order('created_at').limit(10);if(error)throw Error('Could not read approved campaign recipients.');
   const checks=[];for(const a of approvals){try{await preflight(db,a,{primary,legacy},WORKSPACE);checks.push({approvalId:a.id,recipient:a.recipient,status:'History checked; no unrecorded correspondence found.'})}catch(e){checks.push({approvalId:a.id,recipient:a.recipient,status:'Needs review',reason:e instanceof Error?e.message:'History could not be verified.'})}}return respond({checks,sent:0});
  }
  if(body.action==='send'){
   if(typeof body.message_id!=='string')return respond({error:'A saved explicit send command is required.'},400);
   const {data:message}=await db.from('cc_ai_messages').select('body').eq('id',body.message_id).eq('workspace_id',WORKSPACE).eq('author_id',user.id).eq('author_type','human').maybeSingle();if(!message||!isSendCommand(message.body))return respond({error:'Use the explicit command: Run the approved email campaign now.'},403);
   const primary=await gmailClient(db,'primary'),status=await connectionStatus(db);const legacy=status.legacyConnected?await gmailClient(db,'legacy'):null;
   const run=await rpc(db,'cc_begin_email_dispatch',{p_message_id:body.message_id,p_user_id:user.id});if(run.existing)return respond({runId:run.id,status:run.status,result:run.result,message:'This command already has a dispatch record. It was not sent again.'});
   try{const result=await runCampaign(db,run,{primary,legacy},WORKSPACE);return respond({runId:run.id,status:result.needsReconciliation.length?'Needs attention':'Completed',result})}catch(e){await db.from('cc_email_dispatch_runs').update({status:'Needs attention',finished_at:new Date().toISOString()}).eq('id',run.id);return respond({error:'Campaign run needs reconciliation. Do not repeat it without checking its saved results.'},503)}
  }
  return respond({error:'Unsupported operation.'},400);
 }catch(e){return respond({error:e instanceof Error?e.message:'Business email operation failed.'},503)}
});
