import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyData} from '../src/lib/domain.js'
import {encodeMetadata} from '../src/lib/portfolio.js'
import {businessOverview,businessStatusMatches} from '../src/lib/business-report.js'
test('all includes not a match, paused and archived; active excludes them without editing records',()=>{
 const d=emptyData();d.businesses=[{id:'a',name:'Alpha',status:'Active'},{id:'n',name:'No match',status:'Active',notes:encodeMetadata({},{outreachDecision:'Not a match'})},{id:'p',name:'Paused',status:'Paused'},{id:'z',name:'Archived',status:'Archived'}]
 assert.equal(businessOverview(d).groups[0].businesses.length,4)
 assert.deepEqual(businessOverview(d,'Active').groups[0].businesses.map(b=>b.id),['a'])
 assert.equal(businessOverview(d,'Inactive').groups[0].businesses.length,3)
 assert.equal(businessStatusMatches(d.businesses[1],'Inactive'),true)
 assert.equal(d.businesses[1].status,'Active')
})
test('report deduplicates listings, replies, paying clients and package purchases',()=>{
 const d=emptyData();d.businesses=[{id:'a',name:'Alpha',status:'Active'},{id:'b',name:'Beta',status:'Active'}]
 d.listings=[{business_id:'a',status:'Published'},{business_id:'a',status:'Published'},{business_id:'b',status:'Draft'}]
 d.emails=[{business_id:'a',direction:'Inbound',status:'Replied',message_type:'Human'},{business_id:'b',direction:'Inbound',status:'Received',message_type:'Automatic'}]
 d.purchases=[...Array.from({length:2},(_,i)=>({id:String(i),business_id:'a',status:'Paid',product:'Annual listing',notes:encodeMetadata({},{saleType:'Upgraded listing',salePackage:'Annual'})})),{business_id:'a',status:'Paid',product:'Social management',notes:encodeMetadata({},{saleType:'MKT Visibility services',salePackage:'Visibility Plus'})},{business_id:'b',status:'Ordered',product:'Annual listing'}]
 const r=businessOverview(d)
 for(const key of ['listed','responded','buyers','upgrades','services'])assert.equal(r.groups.find(g=>g.key===key).businesses.length,1)
 assert.equal(r.packages.find(g=>g.label==='Annual').businesses.length,1)
 assert.equal(r.packages.length,2)
})
