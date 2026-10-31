import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {emptyData} from '../src/lib/domain.js'
test('test profile consolidates scheduling into Appointments and retains record actions',async()=>{
 const dom=new JSDOM('<html><body></body></html>',{url:'https://localhost/'});
 for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true});Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {render,screen,fireEvent,within,cleanup}=await import('@testing-library/react');const dir=mkdtempSync(join(process.cwd(),'.ui-test-'));
 const raw=readFileSync('src/CategoryProfile.jsx','utf8').replace("import VisibilityWorkflow from './VisibilityWorkflow.jsx'",'const VisibilityWorkflow=()=>null').replace("import EmailApproval from './EmailApproval.jsx'","const EmailApproval=()=>null").replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/');writeFileSync(join(dir,'profile.mjs'),(await transformWithOxc(raw,'CategoryProfile.jsx',{jsx:{runtime:'automatic'}})).code);
 try{
  const {default:Profile}=await import(pathToFileURL(join(dir,'profile.mjs')).href);const business={id:'pet',name:"A Pet's Place Animal Hospital",status:'Active'},data=emptyData();data.businesses=[business];
  const contact={id:'call',business_id:'pet',title:'Discuss business story',type:'Follow-up',status:'Open',due_date:'2026-10-29'};data.tasks=[contact,{id:'visit',business_id:'pet',title:'Client appointment',type:'Follow-up',status:'Open',due_date:'2026-10-30',notes:JSON.stringify({format:'mkt-portfolio-v1',appointmentManager:{time:'10:00',status:'Scheduled'}})}];
  let edited,scheduled,added;const Stub=()=>null;const props={business,data,member:{},writable:true,onClose:()=>{},onEdit:(kind,row)=>{edited=row},onAdd:(kind,row)=>{added=row},onSave:async()=>{},onSchedule:id=>{scheduled=id},components:Object.fromEntries(['BusinessBasics','ProfileRatings','LiveBusinessPage','OutreachDecision','InternalNotes'].map(k=>[k,Stub]))};
  const view=render(React.createElement(Profile,props));assert.ok(screen.getByRole('tab',{name:'Appointments'}));const panel=document.getElementById('profile-panel-4');assert.equal(panel.hidden,true);assert.equal(document.getElementById('profile-panel-0').querySelector('#profile-category-appointments'),null);
  assert.equal(screen.getAllByRole('tab').length,7);assert.ok(screen.getByRole('tab',{name:'Work'}));
  fireEvent.click(screen.getByRole('tab',{name:'Visibility Check'}));const visibility=document.getElementById('profile-panel-5');assert.equal(visibility.hidden,false);assert.ok(within(visibility).getByText('Visibility Check · Report Preview'));assert.ok(within(visibility).getByRole('link',{name:/Open webpage report and PDF preview/}));
  fireEvent.click(screen.getByRole('tab',{name:'Sales & payments'}));const sales=document.getElementById('profile-panel-6');assert.equal(sales.hidden,false);assert.ok(sales.querySelector('#profile-category-services'));assert.ok(within(sales).getByText('Sales & service records'));
  fireEvent.click(screen.getByRole('tab',{name:'Public listing'}));assert.ok(document.getElementById('profile-panel-2').querySelector('#profile-category-listing'));
  fireEvent.click(screen.getByRole('tab',{name:'Messages & notes'}));assert.ok(document.getElementById('profile-panel-3').querySelector('#profile-category-correspondence'));
  assert.equal(document.getElementById('profile-panel-1').querySelector('#profile-category-visibility'),null);
  fireEvent.click(screen.getByRole('tab',{name:'Appointments'}));assert.equal(panel.hidden,false);assert.ok(within(panel).getByText(/2026-10-29/));assert.ok(within(panel).getByText(/Client appointment/));
  fireEvent.click(within(panel).getByRole('button',{name:/Discuss business story/}));assert.equal(edited.id,'call');fireEvent.click(within(panel).getByRole('button',{name:/Schedule appointment/}));assert.equal(scheduled,'pet');fireEvent.click(within(panel).getAllByRole('button',{name:'Schedule email / phone call'})[0]);assert.equal(added.business_id,'pet');assert.equal(added.type,'Follow-up');assert.equal(contact.due_date,'2026-10-29');assert.equal(contact.status,'Open');
  view.rerender(React.createElement(Profile,{...props,business:{...business,name:'Other business'}}));assert.equal(screen.queryByRole('tab',{name:'Appointments'}),null);
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
});
