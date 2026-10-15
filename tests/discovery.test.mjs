import test from 'node:test'
import assert from 'node:assert/strict'
import {encodeMetadata,metadata} from '../src/lib/portfolio.js'
import {awaitingDiscoveryReview,discoveryReview,discoveredBusinesses} from '../src/lib/discovery.js'
import {blocked} from '../src/lib/outreach-workflow.js'
const b={id:'new',name:'Z artist',website:'https://example.com',email:'artist@example.com',notes:encodeMetadata({},{brand:'MKT Colorado',text:'Preserve these notes',discovery:{source:'Nova research',status:'Pending review',sources:['https://example.com/contact']}})}
test('pending discovery is held out of outreach until a recorded human review',()=>{
 assert.equal(awaitingDiscoveryReview(b),true);assert.equal(blocked(b),true)
 const reviewed=discoveryReview(b,'Reviewed','Tim')
 assert.equal(blocked(reviewed),false);assert.equal(metadata(reviewed).discovery.reviewedBy,'Tim')
 assert.equal(metadata(reviewed).text,'Preserve these notes')
 assert.deepEqual(metadata(reviewed).discovery.sources,['https://example.com/contact'])
 assert.equal(blocked(discoveryReview(reviewed,'Pending review','Michelle')),true)
 assert.equal(blocked(discoveryReview(b,'Not a match','Michelle')),true)
})
test('discovery counts exclude existing and imported profiles and sort by name',()=>{
 assert.deepEqual(discoveredBusinesses({businesses:[{name:'Old'},b,{...b,id:'a',name:'A musician'}]}).map(x=>x.id),['a','new'])
 assert.throws(()=>discoveryReview(b,'Published','Tim'))
 assert.throws(()=>discoveryReview(b,'Reviewed',''))
})

test('Hunter drafts appear alongside Nova research and require the same review',()=>{const hunter={...b,id:'hunter',notes:encodeMetadata(b,{discovery:{...metadata(b).discovery,source:'Hunter research'}})};assert.equal(discoveredBusinesses({businesses:[hunter]}).length,1);assert.equal(blocked(hunter),true)})
