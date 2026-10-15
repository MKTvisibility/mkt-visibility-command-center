import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {emptyData} from '../src/lib/domain.js'
import {encodeMetadata} from '../src/lib/portfolio.js'
import {day} from '../src/lib/outreach-workflow.js'
import {projectSession} from '../src/lib/project-calendar.js'
test('calendar opens business profiles and operation checklists, reschedules one project, and saves reversible checkbox changes',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://localhost/'});for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true});Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const {render,screen,fireEvent,waitFor,cleanup}=await import('@testing-library/react'),dir=mkdtempSync(join(process.cwd(),'.ui-test-'));const raw=readFileSync('src/TaskCalendar.jsx','utf8').replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/');writeFileSync(join(dir,'Calendar.mjs'),(await transformWithOxc(raw,'TaskCalendar.jsx',{jsx:{runtime:'automatic'}})).code)
 try{const {default:Calendar}=await import(pathToFileURL(join(dir,'Calendar.mjs')).href),data=emptyData();data.businesses=[{id:'a',name:'Alpha Studio',status:'Active'}];data.listings=[{business_id:'a',site:'Loving Longmont'}];data.tasks=[{id:'ops',title:'Verify checkout',type:'Task',status:'Open',notes:encodeMetadata({},{brand:'Loving Longmont',ownerAction:true})},{...projectSession({key:'business:a',name:'Alpha Studio',businessId:'a',brands:['Loving Longmont']},day()),id:'session'}];let opened,saved;const props={data,writable:true,onSave:async(kind,t)=>{saved=t;return t},onEdit:()=>{},onView:id=>{opened=id},onPage:()=>{}};render(React.createElement(Calendar,props));fireEvent.click(screen.getByRole('button',{name:'Alpha Studio',exact:true}));assert.equal(opened,'a');assert.equal(screen.queryByText('Verify Business Name'),null);fireEvent.click(screen.getByRole('button',{name:'Reschedule',exact:true}));fireEvent.change(screen.getByLabelText('Work date'),{target:{value:'2026-10-26'}});fireEvent.click(screen.getByRole('button',{name:'Save project date'}));await waitFor(()=>assert.equal(saved?.id,'session'));assert.equal(saved.due_date,'2026-10-26');cleanup();render(React.createElement(Calendar,{...props,listOnly:true}));fireEvent.click(screen.getByRole('button',{name:'Loving Longmont',exact:true}));fireEvent.click(screen.getByRole('checkbox',{name:'Complete: Verify checkout'}));await waitFor(()=>assert.equal(saved.status,'Done'));assert.equal(saved.id,'ops');cleanup();data.tasks[0]={...data.tasks[0],status:'Done'};render(React.createElement(Calendar,{...props,listOnly:true}));fireEvent.click(screen.getByRole('checkbox',{name:'Include completed projects'}));fireEvent.click(screen.getByRole('button',{name:'Loving Longmont',exact:true}));fireEvent.click(screen.getByRole('checkbox',{name:'Complete: Verify checkout'}));await waitFor(()=>assert.equal(saved.status,'Open'));assert.equal(saved.id,'ops')
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
})
