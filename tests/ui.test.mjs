import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { transformWithOxc } from 'vite'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import React from 'react'

// DOM simulation, not a real-browser or live-Supabase test.
test('application workflow: setup, practice CRUD, directories, email log, reminders, reports and reset', async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://localhost/'})
 for(const name of ['window','document','HTMLElement','HTMLDialogElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true,writable:true})
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true})
 globalThis.IS_REACT_ACT_ENVIRONMENT=true
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true}
 dom.window.HTMLDialogElement.prototype.close=function(){this.open=false}
 const {render,screen,fireEvent,waitFor,within,cleanup}=await import('@testing-library/react')
 const directory=mkdtempSync(join(process.cwd(),'.ui-test-'))
 const raw=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8').replace("import './App.css'",'').replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/')
 const transformed=await transformWithOxc(raw,'App.jsx',{jsx:{runtime:'automatic'}})
 const filename=join(directory,'App.mjs');writeFileSync(filename,transformed.code)
 let networkCalls=0
 const oldFetch=globalThis.fetch;globalThis.fetch=()=>{networkCalls++;throw new Error('Practice must not use the network')}
 try{
  const {default:App}=await import(pathToFileURL(filename).href)
  render(React.createElement(App))
  assert.ok(screen.getByText('Connect your Command Center'))
  fireEvent.change(screen.getByLabelText('Supabase project URL'),{target:{value:'https://example.supabase.co'}})
  fireEvent.change(screen.getByLabelText('Supabase publishable key'),{target:{value:'sb_' + 'secret_blocked'}})
  fireEvent.click(screen.getByRole('button',{name:'Connect workspace →'}))
  assert.match(screen.getByRole('alert').textContent,/Secret and service-role keys are not accepted/)
  fireEvent.click(screen.getByRole('button',{name:'Try the practice workspace'}))
  await screen.findByText('Your next opportunity starts here.')
  fireEvent.click(screen.getByRole('button',{name:'＋ Add a business'}))
  let editor=within(screen.getByRole('dialog'))
  fireEvent.change(editor.getByLabelText('Business name *'),{target:{value:'UI Test Shop'}})
  fireEvent.change(editor.getByLabelText('City'),{target:{value:'Longmont'}})
  fireEvent.change(editor.getByLabelText('Email'),{target:{value:'test@example.com'}})
  fireEvent.click(editor.getByRole('button',{name:'Save record'}))
  await waitFor(()=>assert.ok(!screen.queryByRole('dialog')))
  fireEvent.click(screen.getByRole('button',{name:'Clients & Prospects',exact:true}))
  assert.ok(screen.getByText('UI Test Shop'))
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'UI Test Shop'}})
  fireEvent.click(screen.getByRole('button',{name:'Edit',exact:true}))
  editor=within(screen.getByRole('dialog'))
  fireEvent.change(editor.getByLabelText('Business name *'),{target:{value:'UI Edited Shop'}})
  fireEvent.change(editor.getByLabelText('Relationship'),{target:{value:'Client'}})
  fireEvent.change(editor.getByLabelText('Monthly recurring fee ($)'),{target:{value:'250'}})
  fireEvent.click(editor.getByRole('button',{name:'Save record'}))
  await waitFor(()=>assert.ok(!screen.queryByRole('dialog')))
  fireEvent.change(screen.getByRole('searchbox'),{target:{value:'UI Edited'}})
  assert.ok(screen.getByText('UI Edited Shop'))
  for(const site of ['Loving Longmont','MKT Colorado']){
   fireEvent.click(screen.getByRole('button',{name:site,exact:true}))
   fireEvent.click(screen.getByRole('button',{name:'＋ Add listing'}))
   editor=within(screen.getByRole('dialog'))
   fireEvent.change(editor.getByLabelText('Listing title *'),{target:{value:`UI ${site} listing`}})
   const option=editor.getByRole('option',{name:'UI Edited Shop'})
   fireEvent.change(editor.getByLabelText('Business *'),{target:{value:option.value}})
   fireEvent.change(editor.getByLabelText('Pages (separate with commas)'),{target:{value:'Arts, Local Businesses'}})
   fireEvent.click(editor.getByRole('button',{name:'Save record'}))
   await waitFor(()=>assert.ok(!screen.queryByRole('dialog')))
   assert.ok(screen.getByText(`UI ${site} listing`))
   assert.ok(screen.getByText('Arts, Local Businesses'))
  }
  fireEvent.click(screen.getByRole('button',{name:'Email Campaigns',exact:true}))
  fireEvent.click(screen.getByRole('button',{name:'＋ Add record'}))
  editor=within(screen.getByRole('dialog'))
  fireEvent.change(editor.getByLabelText('Subject *'),{target:{value:'UI tracking draft'}})
  fireEvent.change(editor.getByLabelText('Contact email *'),{target:{value:'test@example.com'}})
  fireEvent.click(editor.getByRole('button',{name:'Save record'}))
  await waitFor(()=>assert.ok(!screen.queryByRole('dialog')))
  assert.ok(screen.getByText('UI tracking draft'));assert.ok(screen.getByText(/No emails are sent and no inbox is connected/))
  fireEvent.click(screen.getByRole('button',{name:/^Follow-Ups/}))
  fireEvent.click(screen.getByRole('button',{name:'＋ Add task'}))
  editor=within(screen.getByRole('dialog'))
  fireEvent.change(editor.getByLabelText('Title *'),{target:{value:'UI follow up'}})
  fireEvent.click(editor.getByRole('button',{name:'Save record'}))
  await waitFor(()=>assert.ok(!screen.queryByRole('dialog')))
  const row=screen.getByText('UI follow up').closest('tr')
  fireEvent.click(within(row).getByRole('button',{name:'Complete'}))
  await waitFor(()=>assert.ok(within(row).getByText('Done')))
  fireEvent.click(screen.getByRole('button',{name:'Sales Pipeline',exact:true}))
  const deal=screen.getByText('UI Edited Shop').closest('article')
  fireEvent.change(within(deal).getByLabelText('Stage for UI Edited Shop'),{target:{value:'Proposal'}})
  await waitFor(()=>assert.equal(screen.getByText('UI Edited Shop').closest('section').querySelector('h3').textContent,'Proposal'))
  fireEvent.click(screen.getByRole('button',{name:'Reports',exact:true}))
  assert.ok(screen.getByText('$800'))
  fireEvent.click(screen.getByRole('button',{name:'Leave practice mode'}))
  await screen.findByText('Connect your Command Center')
  fireEvent.click(screen.getByRole('button',{name:'Try the practice workspace'}))
  await screen.findByText('Your next opportunity starts here.')
  fireEvent.click(screen.getByRole('button',{name:'Clients & Prospects',exact:true}))
  assert.ok(!screen.queryByText('UI Edited Shop'))
  assert.equal(networkCalls,0)
 }finally{cleanup();globalThis.fetch=oldFetch;rmSync(directory,{recursive:true,force:true});dom.window.close()}
})
