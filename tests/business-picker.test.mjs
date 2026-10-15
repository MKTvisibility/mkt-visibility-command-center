import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'

test('business picker narrows alphabetical prefixes, selects, clears and reflects external values',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://localhost/'})
 for(const name of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true,writable:true})
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true
 const {render,screen,fireEvent,cleanup}=await import('@testing-library/react'),dir=mkdtempSync(join(process.cwd(),'.ui-test-'))
 try{
  const compiled=await transformWithOxc(readFileSync('src/BusinessPicker.jsx','utf8'),'BusinessPicker.jsx',{jsx:{runtime:'automatic'}}),file=join(dir,'picker.mjs');writeFileSync(file,compiled.code)
  const {default:Picker}=await import(pathToFileURL(file).href)
  const businesses=[{id:'2',name:'Bee Studio'},{id:'3',name:'The Bee'},{id:'1',name:'Beach Shop'}],calls=[]
  const view=render(React.createElement(Picker,{businesses,onChange:id=>calls.push(id)})),input=screen.getByRole('combobox')
  fireEvent.focus(input);assert.equal(screen.queryAllByRole('option').length,0)
  fireEvent.change(input,{target:{value:'bE'}});assert.deepEqual(screen.getAllByRole('option').map(x=>x.textContent),['Beach Shop','Bee Studio'])
  fireEvent.change(input,{target:{value:'Bee'}});assert.deepEqual(screen.getAllByRole('option').map(x=>x.textContent),['Bee Studio'])
  fireEvent.keyDown(input,{key:'Enter'});assert.deepEqual(calls,['2'])
  view.rerender(React.createElement(Picker,{businesses,value:'2',onChange:id=>calls.push(id)}));assert.equal(input.value,'Bee Studio')
  fireEvent.click(screen.getByRole('button',{name:'Clear business'}));assert.equal(calls.at(-1),'')
  view.rerender(React.createElement(Picker,{businesses,value:'',onChange:id=>calls.push(id)}))
  fireEvent.change(input,{target:{value:'zzz'}});assert.ok(screen.getByText('No matching businesses'))
  fireEvent.keyDown(input,{key:'Escape'});assert.equal(input.value,'');assert.equal(screen.queryByRole('listbox'),null)
  view.rerender(React.createElement(Picker,{businesses,value:'1',onChange:id=>calls.push(id)}));assert.equal(input.value,'Beach Shop')
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
})
