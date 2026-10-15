import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {emptyData} from '../src/lib/domain.js'
test('campaign summaries open an alphabetical names-only contact list with business-profile links',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://localhost/'});for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true});Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const {render,screen,fireEvent,within,cleanup}=await import('@testing-library/react'),dir=mkdtempSync(join(process.cwd(),'.ui-test-'));const raw=readFileSync('src/Campaigns.jsx','utf8').replace("import './campaigns.css'",'').replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/');writeFileSync(join(dir,'Campaigns.mjs'),(await transformWithOxc(raw,'Campaigns.jsx',{jsx:{runtime:'automatic'}})).code)
 try{const {default:Campaigns}=await import(pathToFileURL(join(dir,'Campaigns.mjs')).href),data=emptyData();data.businesses=[{id:'z',name:'Zeta Shop',status:'Active'},{id:'a',name:'Alpha Studio',status:'Active'}];data.listings=data.businesses.map(b=>({business_id:b.id,site:'Loving Longmont'}));let viewed;render(React.createElement(Campaigns,{data,brand:'Loving Longmont',onView:id=>{viewed=id},onAdd:()=>{},writable:false}));for(const name of ['Listing Welcome','Business Story','Visibility Check','Listing Upgrade'])assert.ok(screen.getByRole('heading',{name,exact:true}));fireEvent.click(screen.getByRole('button',{name:'Listing Welcome: Still to contact (2)'}));const list=within(screen.getByRole('region',{name:'Campaign business list'}));assert.deepEqual(list.getAllByRole('listitem').map(li=>li.textContent),['Alpha Studio','Zeta Shop']);fireEvent.click(list.getByRole('button',{name:'Alpha Studio',exact:true}));assert.equal(viewed,'a');fireEvent.change(list.getByLabelText('Find a business'),{target:{value:'Zet'}});assert.equal(list.queryByRole('button',{name:'Alpha Studio',exact:true}),null);assert.ok(list.getByRole('button',{name:'Zeta Shop',exact:true}))
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
})
