import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {emptyAssessment} from '../src/lib/intelligence.js'
import {emptyData} from '../src/lib/domain.js'
test('profile rating dropdowns save to protected assessments while preserving other ratings and facts',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://localhost/'})
 for(const name of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true,writable:true});Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const {render,screen,fireEvent,waitFor,cleanup}=await import('@testing-library/react'),dir=mkdtempSync(join(process.cwd(),'.ui-test-'))
 try{
 const raw=readFileSync(new URL('../src/ProfileRatings.jsx',import.meta.url),'utf8').replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/')
 const code=await transformWithOxc(raw,'ProfileRatings.jsx',{jsx:{runtime:'automatic'}}),file=join(dir,'ProfileRatings.mjs');writeFileSync(file,code.code)
 const {default:Ratings,SimpleProfileChecklist}=await import(pathToFileURL(file).href)
 const business={id:'b',name:'Fictional Studio',city:'Longmont',website:'https://example.com',social_urls:['https://www.instagram.com/example']},a=emptyAssessment(business)
 a.summary='Existing private assessment';a.platforms.Instagram={score:5,state:'Rated',url:'https://www.instagram.com/example',explanation:'Reviewed',evidence:[{url:'https://www.instagram.com/example'}]}
 const calls=[],tasks=[],repository={intelligence:{profile:async()=>({approved_at:'2026-10-13',updated_at:'version1',approved:a}),command:async(action,data)=>{calls.push({action,data});return {approved:data.assessment,approved_at:'2026-10-14',updated_at:'version2'}}}}
 render(React.createElement(Ratings,{business,data:emptyData(),repository,writable:true,member:{display_name:'Michelle'},onSave:async(kind,draft)=>{tasks.push(draft);return draft}}))
 await screen.findByLabelText('Website rating');fireEvent.change(screen.getByLabelText('Website rating'),{target:{value:'4'}});fireEvent.click(screen.getByRole('button',{name:'Save ratings'}));await waitFor(()=>assert.equal(calls.length,1));assert.equal(calls[0].action,'approve');assert.equal(calls[0].data.version,'version1');assert.equal(calls[0].data.assessment.platforms.Website.score,4);assert.equal(calls[0].data.assessment.platforms.Instagram.score,5);assert.equal(calls[0].data.assessment.summary,'Existing private assessment')
 fireEvent.change(screen.getByLabelText('TikTok rating'),{target:{value:'Missing'}});fireEvent.click(screen.getByRole('button',{name:'Save ratings'}));await waitFor(()=>assert.equal(calls.length,2));assert.equal(calls[1].data.assessment.platforms.TikTok.state,'Missing');assert.ok(calls[1].data.assessment.platforms.TikTok.evidence[0].url.startsWith('https://www.google.com/search'))
 fireEvent.click(screen.getByLabelText('Reviewed Website'));await waitFor(()=>assert.equal(tasks.length,1));assert.equal(tasks[0].status,'Done');assert.equal(tasks[0].details.suggestion_key,'profile:rating:Website');cleanup()
 render(React.createElement(SimpleProfileChecklist,{business,data:emptyData(),writable:true,onSave:async(kind,draft)=>{tasks.push(draft);return draft}}));fireEvent.click(screen.getByLabelText('Email a request for their business story'));await waitFor(()=>assert.equal(tasks.length,2));assert.equal(tasks[1].details.suggestion_key,'profile:story_request');cleanup()
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
})
