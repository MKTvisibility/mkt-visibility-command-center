import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
test('partners save shared prompts, reload them, filter them and retain drafts after save errors',async()=>{
 const dom=new JSDOM('<html><body></body></html>',{url:'https://localhost/'})
 for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true})
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const {render,screen,fireEvent,waitFor,cleanup,within}=await import('@testing-library/react'),dir=mkdtempSync(join(process.cwd(),'.ui-test-'))
 const source=readFileSync('src/AIWorkforce.jsx','utf8').replace("import './AIWorkforce.css'",'').replace("from './lib/campaign-types.js'", "from '"+pathToFileURL(join(process.cwd(),'src/lib/campaign-types.js')).href+"'").replace("import {PartnerMessages} from './PartnerMessages.jsx'",'const PartnerMessages=()=>null')
 writeFileSync(join(dir,'AI.mjs'),(await transformWithOxc(source,'AIWorkforce.jsx',{jsx:{runtime:'automatic'}})).code)
 const rows=[{id:'town',title:'MKT Colorado Town Builder',category:'Colorado town histories',agent:'Nova',effect:'Research & publish with connected tools',command:'Run the town builder for [town].',details:'Research sources and verify the live page. Publishing requires ChatGPT Work tools.'}];let fail=true,saves=0,opened=0
 const repository={loadAIPrompts:async()=>structuredClone(rows),createAIPrompt:async input=>{saves++;if(fail)throw Error('Save unavailable');const row={id:'custom',...input};rows.push(row);return row}}
 try{const {AIPrompts}=await import(pathToFileURL(join(dir,'AI.mjs')).href);const props={repository,member:{display_name:'Michelle'},disabled:false,onUse:()=>opened++};let view=render(React.createElement(AIPrompts,props));await screen.findByRole('article',{name:'MKT Colorado Town Builder'});fireEvent.click(screen.getByRole('button',{name:'+ Add AI Prompt'}))
 for(const [label,value] of [['Prompt title','My new workflow'],['Prompt category','My category'],['What it does','Drafts a local newsletter.'],['Prompt instructions','Draft a newsletter for [town].']])fireEvent.change(screen.getByLabelText(label),{target:{value}})
 fireEvent.click(screen.getByRole('button',{name:'Save AI Prompt'}));await screen.findByRole('alert');assert.equal(screen.getByLabelText('Prompt instructions').value,'Draft a newsletter for [town].');assert.equal(rows.length,1);fail=false;fireEvent.click(screen.getByRole('button',{name:'Save AI Prompt'}));await screen.findByRole('article',{name:'My new workflow'});assert.equal(saves,2);assert.equal(opened,0);view.unmount();view=render(React.createElement(AIPrompts,{...props,member:{display_name:'Tim'}}));await screen.findByRole('article',{name:'My new workflow'});fireEvent.change(screen.getByLabelText('Category'),{target:{value:'My category'}});await waitFor(()=>assert.equal(screen.getAllByRole('article').length,1));fireEvent.click(within(screen.getByRole('article',{name:'My new workflow'})).getByRole('button',{name:'Open with agent'}));assert.equal(opened,1);view.unmount();render(React.createElement(AIPrompts,{...props,disabled:true}));assert.ok(screen.getByRole('button',{name:'+ Add AI Prompt'}).disabled)
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
})
