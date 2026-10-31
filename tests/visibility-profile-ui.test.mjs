import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {emptyData} from '../src/lib/domain.js'
test('profile click starts research for its business and automatically opens its completed report; errors allow retry',async()=>{
 const dom=new JSDOM('<html><body></body></html>',{url:'https://localhost/'})
 for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true});Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const {render,screen,fireEvent,waitFor,cleanup}=await import('@testing-library/react'),dir=mkdtempSync(join(process.cwd(),'.ui-test-'))
 const raw=readFileSync('src/CategoryProfile.jsx','utf8').replace("import VisibilityWorkflow from './VisibilityWorkflow.jsx'",'const VisibilityWorkflow=()=>null').replace("import EmailApproval from './EmailApproval.jsx'",'const EmailApproval=()=>null').replaceAll('import.meta.env.BASE_URL',"'/'").replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/')
 writeFileSync(join(dir,'profile.mjs'),(await transformWithOxc(raw,'CategoryProfile.jsx',{jsx:{runtime:'automatic'}})).code)
 try{
  const {default:Profile}=await import(pathToFileURL(join(dir,'profile.mjs')).href),Stub=()=>null,business={id:'pets',name:"A Pet's Place Animal Hospital",status:'Active'},calls=[]
  let job=null,fail=false
  const run={id:'run1',business_id:'pets',researched_at:new Date().toISOString(),research:{business_id:'pets',business:business.name,job_id:'job1',summary:'Animal care services',assessment:{business_id:'pets',platforms:{Website:{score:4,explanation:'Animal care services'}}}}}
  const repository={intelligence:{profile:async()=>null,visibilityJob:async()=>job,visibilityRuns:async()=>[run],runVisibility:async(id,platforms)=>{calls.push({id,platforms});if(fail)throw Error('Automatic research is not configured. Add OPENAI_API_KEY.');job={id:'job1',business_id:id,status:'Awaiting Review'};return {job_id:'job1',business_id:id,status:'Running'}}}}
  const props={business,data:emptyData(),member:{},writable:true,repository,onSave:async()=>{},components:Object.fromEntries(['BusinessBasics','ProfileRatings','LiveBusinessPage','OutreachDecision','InternalNotes'].map(k=>[k,Stub]))}
  render(React.createElement(Profile,props));fireEvent.click(screen.getByRole('tab',{name:'Visibility Check'}));fireEvent.click(screen.getByRole('button',{name:'Run Free Visibility Check'}));await screen.findByRole('dialog',{name:'Business visibility report'});assert.equal(calls.length,1);assert.equal(calls[0].id,'pets');assert.ok(screen.getByText('Visibility Report — '+business.name));assert.ok(screen.getByTitle('Client visibility report and estimate'));cleanup()
  job=null;fail=true;render(React.createElement(Profile,{...props,business:{id:'books',name:'Barbed Wire Books',status:'Active'}}));fireEvent.click(screen.getByRole('tab',{name:'Visibility Check'}));fireEvent.click(screen.getByRole('button',{name:'Run Free Visibility Check'}));await screen.findByText(/Automatic research is not configured/);await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Run Free Visibility Check'}).disabled,false));assert.equal(screen.queryByRole('dialog'),null);assert.equal(calls[1].id,'books')
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
})
