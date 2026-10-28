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
 let draft,uploads=[],calls=[]
 const client={from(table){let operation='read',payload;const q={select(){return q},eq(){return q},order(){return q},update(p){operation='update';payload=p;return q},insert(p){operation='insert';payload=p;return q},maybeSingle:async()=>{draft={...draft,...payload,revision:(draft?.revision||0)+1,updated_at:new Date().toISOString()};return {data:draft}},then(resolve,reject){return Promise.resolve({data:table==='cc_blog_posts'?(draft?[draft]:[]):[]}).then(resolve,reject)}};return q},rpc:async(name,args)=>{calls.push({name,args});return {}},storage:{from(bucket){return {upload:async(path,file,options)=>{uploads.push({bucket,path,file,options});return {}},createSignedUrl:async()=>({data:{signedUrl:'https://example.test/preview.jpg'}})}}}}
 const raw=readFileSync('src/BlogManager.jsx','utf8').replace("import './blog.css'",'').replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/');writeFileSync(join(dir,'Blog.mjs'),(await transformWithOxc(raw,'BlogManager.jsx',{jsx:{runtime:'automatic'}})).code)
 try{const {default:Blog}=await import(pathToFileURL(join(dir,'Blog.mjs')).href)
  render(React.createElement(Blog,{client,member:{role:'editor',display_name:'Partner'},writable:true}))
  await waitFor(()=>assert.ok(screen.getByText(/No blog posts yet/)))
  fireEvent.click(screen.getByRole('button',{name:'＋ New post'}))
  fireEvent.change(screen.getByLabelText('Title'),{target:{value:'A local story'}})
  fireEvent.change(screen.getByLabelText(/^Post text/),{target:{value:'A helpful business story.'}})
  assert.equal(screen.getByRole('button',{name:'Publish now'}).disabled,true)
  fireEvent.click(screen.getByRole('button',{name:'Save draft'}));await screen.findByText('Draft saved. The public version has not changed.')
  assert.equal(calls.length,0);assert.equal(draft.slug,'a-local-story')
  fireEvent.click(screen.getByRole('button',{name:'Publish now'}));assert.equal(calls.length,0)
  fireEvent.click(screen.getByRole('button',{name:'Confirm publication'}));await screen.findByText('Post published. It is now available on the public blog.');assert.equal(calls[0].args.p_action,'publish')
  fireEvent.change(screen.getByLabelText('Schedule publication — Mountain Time'),{target:{value:'2099-12-01T09:30'}})
  fireEvent.click(screen.getByRole('button',{name:'Schedule post'}));assert.equal(calls.length,1)
  fireEvent.click(screen.getByRole('button',{name:'Confirm schedule'}));await screen.findByText(/Post scheduled for/);assert.equal(calls[1].args.p_publish_at,'2099-12-01T16:30:00.000Z')
  const file=new dom.window.File(['test image'],'photo.png',{type:'image/png'})
  fireEvent.change(screen.getByLabelText(/^Featured image/),{target:{files:[file]}})
  await screen.findByText('Image uploaded and attached to this draft.');assert.equal(uploads.length,1);assert.equal(uploads[0].options.upsert,false);assert.ok(uploads[0].path.includes(draft.id));assert.equal(uploads[0].bucket,'mkt-blog-images')
  fireEvent.click(screen.getByRole('button',{name:'Publish now'}));assert.match(screen.getByRole('alert').textContent,/image description/)
  cleanup();render(React.createElement(Blog,{client,member:{role:'viewer'},writable:false}));await waitFor(()=>assert.ok(screen.getByRole('button',{name:'＋ New post'}).disabled))
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
})
