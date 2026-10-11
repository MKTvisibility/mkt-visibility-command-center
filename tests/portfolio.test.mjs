import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyData, cleanPayload } from '../src/lib/domain.js'
import { encodeMetadata, metadata, scopedData, townProfiles, townTasks } from '../src/lib/portfolio.js'
test('business dashboards isolate work and sales while allowing shared directory relationships',()=>{
 const data=emptyData()
 data.businesses=[{id:'a',name:'Shared client',kind:'Client',notes:''}]
 data.listings=[{business_id:'a',site:'MKT Colorado',city:'Burlington'}]
 data.tasks=[{id:'c',title:'Create page',notes:encodeMetadata({},{brand:'MKT Colorado',text:'Page notes'})},{id:'v',title:'Proposal',notes:encodeMetadata({},{brand:'MKT Visibility'})},{id:'u',title:'Unassigned',notes:''}]
 data.purchases=[{id:'sale',business_id:'a',product:'Mug',notes:encodeMetadata({},{brand:'MKT Colorado'})}]
 const colorado=scopedData(data,'MKT Colorado');const visibility=scopedData(data,'MKT Visibility')
 assert.deepEqual(colorado.tasks.map(t=>t.id),['c']);assert.deepEqual(visibility.tasks.map(t=>t.id),['v'])
 assert.equal(colorado.businesses.length,1);assert.equal(visibility.businesses.length,1)
 assert.equal(colorado.purchases.length,1);assert.equal(visibility.purchases.length,0)
})
test('town profiles deduplicate existing towns, preserve links and keep checklist tasks separately linked',()=>{
 const data=emptyData();data.listings=[{site:'MKT Colorado',city:'Burlington',url:'https://example.com/town'},{site:'MKT Colorado',city:'burlington'}]
 const [town]=townProfiles(data);assert.equal(townProfiles(data).length,1)
 data.tasks=[cleanPayload('tasks',{...town,notes:encodeMetadata(town,{text:'History',popupUrl:'https://example.com/mug'})}),{title:'Town step',notes:encodeMetadata({},{brand:'MKT Colorado',townKey:'burlington',checklistItem:'Create town page',text:'Checked'})}]
 assert.equal(townProfiles(data).length,1);assert.equal(metadata(townProfiles(data)[0]).text,'History')
 assert.equal(townTasks(data,town).length,1)
 const step=data.tasks[1];const cleaned=cleanPayload('tasks',{...step,type:'Task',status:'Done',priority:'Normal'})
 assert.equal(metadata(cleaned).townKey,'burlington');assert.equal(metadata(cleaned).checklistItem,'Create town page')
 assert.throws(()=>encodeMetadata({},{text:'x'.repeat(4000)}),/Shorten/)
})
test('legacy tasks linked to internal business profiles appear in the correct dashboard',()=>{
 const data=emptyData();data.businesses=[{id:'otc',name:'Open Theory Cove',kind:'Prospect',notes:''},{id:'photo',name:'Boulder County Photography',kind:'Prospect',notes:''}]
 data.tasks=[{id:'kdp',business_id:'otc',title:'Check publisher messages',status:'Open',notes:''},{id:'image',business_id:'photo',title:'Check image',status:'Open',notes:''}]
 assert.deepEqual(scopedData(data,'Open Theory Cove').tasks.map(t=>t.id),['kdp'])
 assert.deepEqual(scopedData(data,'Boulder County Photography').tasks.map(t=>t.id),['image'])
 assert.equal(scopedData(data,'MKT Visibility').tasks.length,0)
})
test('town profiles normalize accents and preserve metadata after notes change',()=>{
 const data=emptyData();data.tasks=[{title:'Town profile',notes:encodeMetadata({},{recordType:'town',townName:'Cañon City',brand:'MKT Colorado'})}];data.listings=[{site:'MKT Colorado',city:'Canon City'}]
 assert.equal(townProfiles(data).length,1)
 const record={notes:encodeMetadata({},{brand:'MKT Colorado',text:'Initial'})}
 assert.equal(metadata(record).text,'Initial');record.notes=encodeMetadata({},{brand:'MKT Colorado',text:'Changed'});assert.equal(metadata(record).text,'Changed')
})
