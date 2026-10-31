export const MAILBOXES={primary:'mktvisibility@gmail.com',legacy:'hello.lovinglongmont@gmail.com'}
export const SCOPES={primary:['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.send'],legacy:['https://www.googleapis.com/auth/gmail.readonly']}
export function base64url(bytes){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}
export async function digest(text){return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))))}
export function rawMessage(a){
 for(const value of [a.sender,a.recipient,a.subject])if(typeof value!=='string'||/[\r\n]/.test(value))throw Error('Approved message headers are invalid; review this approval.')
 if(a.sender!==MAILBOXES.primary||!/^[-.!#$%&'*+/=?^_`{|}~a-zA-Z0-9]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(a.recipient))throw Error('Only the approved business sender and one exact recipient are supported.')
 const subject=btoa(String.fromCharCode(...new TextEncoder().encode(a.subject)))
 const mime=`From: ${a.sender}\r\nTo: ${a.recipient}\r\nSubject: =?UTF-8?B?${subject}?=\r\nMessage-ID: <cc-${a.id}@mktvisibility.com>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${btoa(String.fromCharCode(...new TextEncoder().encode(a.body))).match(/.{1,76}/g)?.join('\r\n')||''}\r\n`
 return base64url(new TextEncoder().encode(mime))
}
export function address(value=''){return (value.match(/<([^>]+)>/)?.[1]||value).trim().toLowerCase()}
export function messageFacts(m){const headers=Object.fromEntries((m.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));return {id:m.id,rfcId:headers['message-id']||'',from:address(headers.from),to:address(headers.to),subject:headers.subject||'(No subject)',date:new Date(Number(m.internalDate)).toISOString(),sent:(m.labelIds||[]).includes('SENT'),draft:(m.labelIds||[]).includes('DRAFT')}}
export async function secret(db,slot,action='get',value=null){const {data,error}=await db.rpc('cc_gmail_secret',{p_slot:slot,p_action:action,p_value:value});if(error)throw Error('Secure Gmail credential storage is unavailable.');return data}
export async function connectionStatus(db){const config=await secret(db,'oauth_config'),primary=await secret(db,'primary'),legacy=await secret(db,'legacy');return {configured:Boolean(config.client_id&&config.client_secret),primaryConnected:Boolean(primary.refresh_token&&primary.email===MAILBOXES.primary),legacyConnected:Boolean(legacy.refresh_token&&legacy.email===MAILBOXES.legacy),sender:MAILBOXES.primary}}
export async function gmailClient(db,slot,fetcher=fetch){
 const config=await secret(db,'oauth_config'),credential=await secret(db,slot)
 if(!config.client_id||!config.client_secret||!credential.refresh_token||credential.email!==MAILBOXES[slot])throw Error(`${MAILBOXES[slot]} is not connected. Open Email tools to connect it.`)
 const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.client_id,client_secret:config.client_secret,refresh_token:credential.refresh_token,grant_type:'refresh_token'})})
 const token=await response.json();if(!response.ok||!token.access_token)throw Error('Gmail authorization expired or was revoked. Reconnect the business mailbox.')
 async function api(path,options={}){const r=await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{...options,signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token.access_token,'content-type':'application/json'}});if(!r.ok)throw Error(`Gmail request failed (${r.status}).`);return r.json()}
 const profile=await api('profile');if(profile.emailAddress?.toLowerCase()!==MAILBOXES[slot])throw Error('Connected mailbox identity does not match the approved business mailbox.')
 return {email:MAILBOXES[slot],async search(options){if(slot!=='primary')throw Error('Mailbox search is limited to MKT Visibility.');return searchMailbox(api,options)},async read(id){if(slot!=='primary')throw Error('Mailbox reading is limited to MKT Visibility.');if(typeof id!=='string'||!/^[-a-zA-Z0-9_]{1,100}$/.test(id))throw Error('Choose a message ID returned by search.');const m=await api(`messages/${encodeURIComponent(id)}?format=full`);const text=messageText(m.payload);return {...messageFacts(m),threadId:m.threadId,body:text.slice(0,6000),truncated:text.length>6000,attachmentsRead:false}},async history(recipient){if(!/^[^\s<>"{}()\\]+@[^\s<>"{}()\\]+$/.test(recipient))throw Error('Recipient needs review.');const list=await api('messages?'+new URLSearchParams({q:`in:anywhere {from:${recipient} to:${recipient}} -in:drafts`,maxResults:'50'}));if(list.nextPageToken)throw Error('Mailbox history has more than 50 matching messages; review this conversation manually.');const facts=[];for(const m of list.messages||[])facts.push(messageFacts(await api(`messages/${encodeURIComponent(m.id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Message-ID`)));const bounces=await api('messages?'+new URLSearchParams({q:`in:anywhere {from:mailer-daemon from:postmaster} "${recipient}"`,maxResults:'1'}));return {messages:facts,bouncePossible:Boolean(bounces.messages?.length)}},async send(a){if(slot!=='primary')throw Error('Legacy mailbox is read-only.');const result=await api('messages/send',{method:'POST',body:JSON.stringify({raw:rawMessage(a)})});if(!result.id)throw Error('Gmail returned no confirmed message ID.');const confirmed=await api(`messages/${encodeURIComponent(result.id)}?format=metadata`);if(!(confirmed.labelIds||[]).includes('SENT'))throw Error('Gmail did not confirm Sent status.');return {id:result.id,sentAt:new Date(Number(confirmed.internalDate)).toISOString()}}}
}

// Read-only mailbox discovery; it never invokes campaign preflight or writes CRM records.
export async function searchMailbox(api,{query='newer_than:7d',page_token=null}={}){
 if(typeof query!=='string'||query.length>500||typeof page_token!=='string'&&page_token!==null||page_token?.length>2000)throw Error('Invalid mailbox search.');
 const q=query.trim()||'newer_than:7d';
 const params=new URLSearchParams({q,maxResults:'12',includeSpamTrash:'true'});
 if(page_token)params.set('pageToken',page_token);
 const list=await api('messages?'+params);
 const messages=await Promise.all((list.messages||[]).map(async({id})=>{
  const m=await api(`messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Message-ID`);
  return {...messageFacts(m),threadId:m.threadId,unread:(m.labelIds||[]).includes('UNREAD'),snippet:(m.snippet||'').slice(0,250)};
 }));
 return {mailbox:MAILBOXES.primary,query:q,messages,nextPageToken:list.nextPageToken||null,hasMore:Boolean(list.nextPageToken),readOnly:true,notice:'One page only. Use nextPageToken with the same query for more. Snippets are previews; read a message before drawing detailed conclusions. Unread does not mean unanswered. Forwarded mail is searchable only after it arrives in this mailbox. No records were changed.'};
}
export function messageText(part){
 const decode=data=>{try{return new TextDecoder().decode(Uint8Array.from(atob(data.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)))}catch{return '[Message text could not be decoded]'}};
 const collect=(node,type)=>{if(!node||node.filename)return [];return [...(node.mimeType===type&&node.body?.data?[decode(node.body.data)]:[]),...(node.parts||[]).flatMap(p=>collect(p,type))]};
 const plain=collect(part,'text/plain').join('\n');
 return plain||collect(part,'text/html').join('\n').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim()||'[No readable text; attachments were not opened]';
}
