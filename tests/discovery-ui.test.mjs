import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {encodeMetadata} from '../src/lib/portfolio.js'
test('review card opens names, profile selection and review/reopen preserve the record',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://localhost/'})
 for(const key of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true,writable:true})
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const {render,screen,fireEvent,waitFor,cleanup}=await import('@testing-library/react')
 const dir=mkdtempSync(join(process.cwd(),'.ui-test-'))
 try{
 const raw=readFileSync('src/Discovery.jsx','utf8').replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/')
 writeFileSync(join(dir,'Discovery.mjs'),(await transformWithOxc(raw,'Discovery.jsx',{jsx:{runtime:'automatic'}})).code)
 const {DiscoverySummary,DiscoveryList,DiscoveryReview}=await import(pathToFileURL(join(dir,'Discovery.mjs')).href)
 let b={id:'artist',name:'New Artist',city:'Longmont',notes:encodeMetadata({},{brand:'Loving Longmont',discovery:{source:'Hunter research',researcher:'Hunter',uncertainties:['Hours need verification.'],status:'Pending review',sources:['https://example.com/contact']}})},opened=false,viewed
 render(React.createElement(DiscoverySummary,{data:{businesses:[b,{name:'Existing'}]},onOpen:()=>opened=true}))
 assert.ok(screen.getByText(/1 awaiting.*1 researched/));fireEvent.click(screen.getByRole('button'));assert.equal(opened,true);cleanup()
 render(React.createElement(DiscoveryList,{data:{businesses:[b]},onView:id=>viewed=id,onClose:()=>{}}))
 fireEvent.click(screen.getByRole('button',{name:'New Artist',exact:true}));assert.equal(viewed,'artist');cleanup()
 const props=()=>({business:b,member:{display_name:'Tim'},writable:true,onSave:async(kind,next)=>{assert.equal(kind,'businesses');b=next}})
 const ui=render(React.createElement(DiscoveryReview,props()));assert.ok(screen.getByText(/Researched by Hunter/));assert.ok(screen.getByText('Hours need verification.'))
 fireEvent.click(screen.getByRole('button',{name:'Mark reviewed'}));await waitFor(()=>assert.ok(b.notes.includes('"status":"Reviewed"')))
 ui.rerender(React.createElement(DiscoveryReview,props()));fireEvent.click(screen.getByRole('button',{name:'Return to review queue'}));await waitFor(()=>assert.ok(b.notes.includes('"status":"Pending review"')))
 }finally{cleanup();dom.window.close();rmSync(dir,{recursive:true,force:true})}
})
