import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
test('blog saves drafts without publication, requires reviewed confirmation, schedules and uploads with protected storage',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://localhost/'})
 for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true})
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const {render,screen,fireEvent,waitFor,cleanup}=await import('@testing-library/react'),dir=mkdtempSync(join(process.cwd(),'.ui-test-'))
 let draft,uploads=[],calls=[],releases=[]
 const client={from(table){let operation='read',payload;const q={select(){return q},eq(){return q},order(){return q},update(p){operation='update';payload=p;return q},insert(p){operation='insert';payload=p;return q},maybeSingle:async()=>{draft={...draft,...payload,revision:(draft?.revision||0)+1,updated_at:new Date().toISOString()};return {data:draft}},then(resolve,reject){return Promise.resolve({data:table==='cc_blog_posts'?(draft?[draft]:[]):releases}).then(resolve,reject)}};return q},rpc:async(name,args)=>{calls.push({name,args});if(args.p_action==='unpublish')releases=[];else if(['publish','schedule'].includes(args.p_action))releases.push({post_id:draft.id,published_at:args.p_publish_at||new Date().toISOString(),source_revision:args.p_revision});return {}},storage:{from(bucket){return {upload:async(path,file,options)=>{uploads.push({bucket,path,file,options});return {}},createSignedUrl:async()=>({data:{signedUrl:'https://example.test/preview.jpg'}})}}}}
 const editorRaw=readFileSync('src/BlogTextEditor.jsx','utf8').replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/');writeFileSync(join(dir,'BlogTextEditor.mjs'),(await transformWithOxc(editorRaw,'BlogTextEditor.jsx',{jsx:{runtime:'automatic'}})).code)
 const raw=readFileSync('src/BlogManager.jsx','utf8').replace("import './blog.css'",'').replace("from './BlogTextEditor.jsx'","from '"+pathToFileURL(join(dir,'BlogTextEditor.mjs')).href+"'").replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/');writeFileSync(join(dir,'Blog.mjs'),(await transformWithOxc(raw,'BlogManager.jsx',{jsx:{runtime:'automatic'}})).code)
 try{const {default:Blog}=await import(pathToFileURL(join(dir,'Blog.mjs')).href)
  render(React.createElement(Blog,{client,member:{role:'editor',display_name:'Partner'},writable:true}))
  await waitFor(()=>assert.ok(screen.getByText(/No blog posts yet/)))
  fireEvent.click(screen.getByRole('button',{name:'＋ New post'}))
  fireEvent.change(screen.getByLabelText('Title'),{target:{value:'A local story'}})
  const textEditor=screen.getByRole('textbox',{name:'Post text'});textEditor.innerHTML='<p>A <b>helpful</b> business story.</p>';fireEvent.input(textEditor)
  assert.equal(screen.getByRole('button',{name:'Publish now'}).disabled,true)
  fireEvent.click(screen.getByRole('button',{name:'Save draft'}));await screen.findByText('Draft saved. The public version has not changed.')
  assert.equal(calls.length,0);assert.equal(draft.slug,'a-local-story');assert.equal(screen.queryByLabelText('Short introduction'),null);assert.ok(screen.getByRole('combobox',{name:'Font size'}));assert.ok(screen.getByRole('combobox',{name:'Font family'}));fireEvent.click(screen.getByRole('tab',{name:'HTML',exact:true}));fireEvent.change(screen.getByRole('textbox',{name:'Post HTML'}),{target:{value:'<h2>From HTML</h2><p><span style="font-size:24px;color:#336699"><b>helpful</b> text</span></p>'}});fireEvent.click(screen.getByRole('tab',{name:'Visual (WYSIWYG)',exact:true}));assert.match(screen.getByRole('textbox',{name:'Post text'}).innerHTML,/font-size: 24px/);fireEvent.click(screen.getByRole('button',{name:'Save draft'}));await screen.findByText('Draft saved. The public version has not changed.');assert.match(draft.body,/font-size: 24px/);assert.match(draft.body,/<b>helpful<\/b>/);fireEvent.click(screen.getByRole('button',{name:'Preview on website'}));const frame=screen.getByTitle('Website preview of blog post');assert.match(frame.getAttribute('srcdoc'),/<b>helpful<\/b>/);assert.equal(frame.getAttribute('sandbox'),'');fireEvent.click(screen.getByRole('button',{name:'Mobile'}));assert.ok(frame.className.includes('mobile'));fireEvent.click(screen.getByRole('button',{name:'Back to editor'}))
  fireEvent.click(screen.getByRole('button',{name:'Publish now'}));assert.equal(calls.length,0)
  fireEvent.click(screen.getByRole('button',{name:'Confirm publication'}));await screen.findByText('Post published. It is now available on the public blog.');assert.equal(calls[0].args.p_action,'publish')
  fireEvent.change(screen.getByLabelText('Schedule publication — Mountain Time'),{target:{value:'2099-12-01T09:30'}})
  fireEvent.click(screen.getByRole('button',{name:'Schedule post'}));assert.equal(calls.length,1)
  fireEvent.click(screen.getByRole('button',{name:'Confirm schedule'}));await screen.findByText(/Post scheduled for/);assert.equal(calls[1].args.p_publish_at,'2099-12-01T16:30:00.000Z')
  const file=new dom.window.File(['test image'],'photo.png',{type:'image/png'})
  fireEvent.change(screen.getByLabelText(/^Featured image/),{target:{files:[file]}})
  await screen.findByText('Image uploaded and attached to this draft.');assert.equal(uploads.length,1);assert.equal(uploads[0].options.upsert,false);assert.ok(uploads[0].path.includes(draft.id));assert.equal(uploads[0].bucket,'mkt-blog-images')
  fireEvent.click(screen.getByRole('button',{name:'Publish now'}));assert.match(screen.getByRole('alert').textContent,/image description/)
  fireEvent.click(screen.getByRole('button',{name:'Unpublish — hide from website'}));assert.ok(screen.getByRole('region',{name:'Confirm publication'}));fireEvent.click(screen.getByRole('button',{name:'Confirm unpublish'}));await screen.findByText(/Hidden from the website. Your post and image remain saved/);assert.ok(draft.body);assert.ok(draft.image_path);assert.equal(releases.length,0);assert.ok(screen.getByRole('button',{name:'Unpublish — hide from website'}).disabled);assert.ok(!screen.getByRole('button',{name:'Publish now'}).disabled)
  cleanup();render(React.createElement(Blog,{client,member:{role:'viewer'},writable:false}));await waitFor(()=>assert.ok(screen.getByRole('button',{name:'＋ New post'}).disabled))
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
})
