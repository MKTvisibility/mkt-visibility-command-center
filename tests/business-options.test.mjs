import test from 'node:test'
import assert from 'node:assert/strict'
import { listingBenefit, businessListingMetadata, PARTNERSHIP } from '../src/lib/business-options.js'
import { encodeMetadata, metadata, scopedData, townTasks } from '../src/lib/portfolio.js'
import { businessChecklistDrafts, missingBusinessChecklist } from '../src/lib/business-checklist.js'
import { emptyData } from '../src/lib/domain.js'
test('paid and bundled listings have explicit entitlements without granting them to prospects',()=>{
 const b={id:'b',name:'Shop',kind:'Client',status:'Active',notes:encodeMetadata({},{brand:'Loving Longmont',listingArrangement:'Paid listing',listingLevel:'Featured',listingValue:350})}
 const data=emptyData();data.businesses=[b]
 assert.match(listingBenefit(b),/same level and value/)
 const tasks=businessChecklistDrafts(b,data)
 const included=tasks.find(t=>metadata(t).businessChecklistKey==='included_listing')
 assert.equal(included.status,'Open');assert.equal(metadata(included).brand,'MKT Colorado')
 data.tasks=[{...included,status:'Done'}];assert.ok(!missingBusinessChecklist(b,data).some(t=>metadata(t).businessChecklistKey==='included_listing'))
 assert.equal(listingBenefit({...b,notes:''}),'')
 assert.equal(businessChecklistDrafts({...b,kind:'Partner-owned Business'},data).length,0)
 const coupon={...b,notes:encodeMetadata({},{listingArrangement:'Coupon'})}
 assert.ok(businessChecklistDrafts(coupon,data).some(t=>metadata(t).businessChecklistKey==='coupon'))
 assert.deepEqual(businessListingMetadata({listingArrangement:'Free basic listing',listingLevel:'Basic',listingValue:'0'}),{listingArrangement:'Free basic listing',listingLevel:'Basic',listingValue:0,couponDetails:''})
 assert.match(PARTNERSHIP,/Michelle and Tim/)
})
test('town tasks remain on their individual profiles and are excluded from brand task lists',()=>{
 const data=emptyData();const town={notes:encodeMetadata({},{recordType:'town',townName:'Burlington',brand:'MKT Colorado'})}
 const t={id:'t',status:'Done',notes:encodeMetadata({},{townKey:'burlington',brand:'MKT Colorado',checklistItem:'Create town page'})}
 const general={id:'g',notes:encodeMetadata({},{brand:'MKT Colorado'})}
 data.tasks=[town,t,general]
 assert.deepEqual(scopedData(data,'MKT Colorado').tasks,[general])
 assert.deepEqual(townTasks(data,town),[t]);assert.equal(t.status,'Done')
})
