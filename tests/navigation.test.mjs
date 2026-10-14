import test from 'node:test'
import assert from 'node:assert/strict'
import {readNavigation,saveNavigation} from '../src/lib/navigation.js'
test('reload restores section and business without sharing another account location',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}
 saveNavigation(storage,'partner-a','Loving Longmont','business-123')
 assert.deepEqual(readNavigation(storage,'partner-a',['Dashboard','Loving Longmont']),{page:'Loving Longmont',profileId:'business-123'})
 assert.deepEqual(readNavigation(storage,'partner-b',['Dashboard']),{page:'Dashboard',profileId:null})
 saveNavigation(storage,'partner-a','Loving Longmont',null)
 assert.equal(readNavigation(storage,'partner-a',['Dashboard','Loving Longmont']).profileId,null)
})
test('invalid or unavailable storage safely falls back',()=>{
 assert.deepEqual(readNavigation({getItem:()=>'{broken'},'key',[]),{page:'Dashboard',profileId:null})
 assert.deepEqual(readNavigation({getItem:()=>'{"page":"Removed page","profileId":42}'},'key',['Dashboard']),{page:'Dashboard',profileId:null})
 saveNavigation({setItem:()=>{throw Error('blocked')}},'key','Dashboard',null)
})
