import test from 'node:test'
import assert from 'node:assert/strict'
import {websiteReport,statisticNumber} from '../src/lib/website-statistics.js'
const record=(metric,value,start,end,extras={})=>({brand:'Loving Longmont',channel:'Website',source:'Google Analytics',metric,value,period_start:start,period_end:end,updated_at:'2026-10-15',...extras})
test('dashboard uses exact weekly totals rather than summing daily or overlapping visitor counts',()=>{
 const rows=[record('Visitors',30,'2026-10-07','2026-10-13'),record('Page views',495,'2026-10-07','2026-10-13'),record('Sessions',40,'2026-10-07','2026-10-13'),record('Visitors',9,'2026-10-13','2026-10-13'),record('Visitors',999,'2026-10-07','2026-10-13',{brand:'MKT Colorado'})]
 assert.deepEqual(websiteReport(rows,'Loving Longmont'),{start:'2026-10-07',end:'2026-10-13',visitors:30,views:495,sessions:40})
 assert.equal(websiteReport(rows,'Loving Longmont',true).visitors,9)
 assert.equal(websiteReport(rows,'Open Theory Cove'),null)
})
test('zero stays zero, missing values stay missing, and social or manual records do not override Google totals',()=>{
 const rows=[record('Visitors',0,'2026-10-07','2026-10-13'),record('Page views',999,'2026-10-07','2026-10-13',{source:'Manual'})]
 const result=websiteReport(rows,'Loving Longmont')
 assert.equal(result.visitors,0);assert.equal(result.views,null)
 assert.equal(statisticNumber(result.visitors),'0');assert.equal(statisticNumber(result.views),'—')
})
