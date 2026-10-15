import test from 'node:test'
import assert from 'node:assert/strict'
import {emptyData,cleanPayload,messageSummary} from '../src/lib/domain.js'
import {directoryBusinesses,directoryEmails,encodeMetadata,scopedData} from '../src/lib/portfolio.js'
test('Longmont has its own client and email views even when a business is listed on both sites',()=>{
 const data=emptyData();data.businesses=[{id:'shared',name:'Shared',city:'Longmont'},{id:'co',name:'Colorado shop',city:'Agate'},{id:'city',name:'Longmont by city',city:'Longmont, CO'},{id:'brand',name:'New Longmont prospect',notes:encodeMetadata({},{brand:'Loving Longmont'})},{id:'internal',name:'MKT Colorado',kind:'Partner-owned Business'}];data.listings=[{business_id:'shared',site:'Loving Longmont'},{business_id:'shared',site:'MKT Colorado'},{business_id:'co',site:'MKT Colorado'},{business_id:'city',site:'MKT Colorado'},{business_id:'internal',site:'MKT Colorado'}];data.emails=[{id:'shared-mail',business_id:'shared'},{id:'co-mail',business_id:'co'},{id:'city-mail',business_id:'city'},{id:'brand-mail',business_id:'brand'},{id:'unlinked-ll',notes:encodeMetadata({},{brand:'Loving Longmont'})},{id:'unlinked-co',notes:encodeMetadata({},{brand:'MKT Colorado'})},{id:'unassigned'}]
 const before=JSON.stringify(data);assert.deepEqual(directoryBusinesses(data,'Loving Longmont').map(b=>b.id),['shared','city','brand']);assert.deepEqual(directoryBusinesses(data,'MKT Colorado').map(b=>b.id),['co']);assert.deepEqual(directoryEmails(data,'Loving Longmont').map(e=>e.id),['shared-mail','city-mail','brand-mail','unlinked-ll']);assert.deepEqual(directoryEmails(data,'MKT Colorado').map(e=>e.id),['co-mail','unlinked-co']);assert.deepEqual(scopedData(data,'MKT Colorado').businesses.map(b=>b.id),['co']);assert.equal(JSON.stringify(data),before)
})
test('new Colorado prospects appear before their listing is created; Longmont listing city takes precedence',()=>{
 const data=emptyData();data.businesses=[{id:'co',name:'New Colorado',notes:encodeMetadata({},{brand:'MKT Colorado'})},{id:'ll',name:'Listing in Longmont'}];data.listings=[{business_id:'ll',site:'MKT Colorado',city:'Longmont'}];assert.deepEqual(directoryBusinesses(data,'MKT Colorado').map(b=>b.id),['co']);assert.deepEqual(directoryBusinesses(data,'Loving Longmont').map(b=>b.id),['ll'])
})

test('unlinked campaign records retain their website through saving and editing',()=>{
 const data=emptyData();const draft={recipient:'owner@example.com',subject:'Campaign draft',direction:'Outbound',status:'Draft',summary:'A useful update',directoryBrand:'Loving Longmont'};const saved=cleanPayload('emails',draft);data.emails=[saved];assert.equal(directoryEmails(data,'Loving Longmont').length,1);assert.equal(directoryEmails(data,'MKT Colorado').length,0);const edited=cleanPayload('emails',{...saved,...messageSummary(saved),summary:'Updated summary'});assert.equal(messageSummary(edited).directoryBrand,'Loving Longmont');assert.equal(messageSummary(edited).summary,'Updated summary')
})
