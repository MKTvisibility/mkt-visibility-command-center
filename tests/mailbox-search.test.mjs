import test from 'node:test'
import assert from 'node:assert/strict'
import {searchMailbox,messageText,gmailClient,MAILBOXES} from '../supabase/functions/campaign-operations/gmail.mjs'
import {toolsFor,executeTool} from '../supabase/functions/ai-headquarters/tools.mjs'
test('mailbox search is independent of campaigns, paginated, and read-only',async()=>{
 const calls=[];const api=async path=>{calls.push(path);if(path.startsWith('messages?'))return {messages:[{id:'abc'}],nextPageToken:'next'};return {id:'abc',threadId:'thread',internalDate:'1792080000000',snippet:'Please update our listing',labelIds:['UNREAD'],payload:{headers:[{name:'From',value:'New Client <new@example.com>'}]}}};
 const result=await searchMailbox(api,{query:'in:anywhere newer_than:7d',page_token:'page2'});
 assert.equal(result.messages[0].from,'new@example.com');assert.equal(result.hasMore,true);assert.equal(result.nextPageToken,'next');assert.equal(result.readOnly,true);
 const params=new URLSearchParams(calls[0].split('?')[1]);assert.equal(params.get('pageToken'),'page2');assert.equal(params.get('includeSpamTrash'),'true');assert.equal(params.get('q'),'in:anywhere newer_than:7d');assert.ok(calls.every(p=>!p.includes('send')));
 await assert.rejects(()=>searchMailbox(api,{query:123}),/Invalid/);
});
test('message extraction preserves Unicode and excludes attachments',()=>{
 const part=(mimeType,text,extra={})=>({mimeType,body:{data:Buffer.from(text).toString('base64url')},...extra});
 assert.equal(messageText({parts:[part('text/plain','Hello café'),part('text/plain','secret attachment',{filename:'private.txt'})]}),'Hello café');
 assert.equal(messageText(part('text/html','<style>hidden</style><p>Hello &amp; welcome</p>')),'Hello & welcome');
});
test('only Nova and Avery receive mailbox tools and routing cannot send',async()=>{
 assert.ok(toolsFor('Nova').some(t=>t.name==='search_business_mailbox'));assert.ok(toolsFor('Avery').some(t=>t.name==='read_business_mailbox_message'));assert.ok(!toolsFor('Hunter').some(t=>t.name==='search_business_mailbox'));
 let request;await executeTool('search_business_mailbox',{query:'from:client@example.com',page_token:null,action:'send'},{agent:'Nova',url:'https://example.test',authorization:'Bearer user',anon:'public',fetcher:async(url,init)=>{request=JSON.parse(init.body);return {ok:true,json:async()=>({messages:[]})}}});assert.deepEqual(request,{action:'search_mailbox',query:'from:client@example.com',page_token:null});
});
test('Gmail client validates account identity and reads with GET only',async()=>{
 const db={rpc:async(name,{p_slot})=>({data:p_slot==='oauth_config'?{client_id:'id',client_secret:'secret'}:{refresh_token:'test',email:MAILBOXES.primary}})};
 const requests=[];const fetcher=async(url,options={})=>{requests.push({url,method:options.method||'GET'});return {ok:true,json:async()=>url.includes('oauth2')?{access_token:'test'}:url.endsWith('profile')?{emailAddress:MAILBOXES.primary}:{id:'abc',internalDate:'1792080000000',payload:{mimeType:'text/plain',body:{data:Buffer.from('Please call us').toString('base64url')}}}}};
 const client=await gmailClient(db,'primary',fetcher);const m=await client.read('abc');assert.equal(m.body,'Please call us');assert.equal(m.attachmentsRead,false);assert.ok(requests.filter(r=>r.url.includes('gmail.googleapis.com')).every(r=>r.method==='GET'));await assert.rejects(()=>client.read('../send'),/message ID/);
});
