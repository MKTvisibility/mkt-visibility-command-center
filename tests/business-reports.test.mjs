import test from 'node:test'
import assert from 'node:assert/strict'
import {buildBusinessReport,businessReportCsv} from '../src/lib/business-reports.js'
import {emptyData} from '../src/lib/domain.js'
import {encodeMetadata} from '../src/lib/portfolio.js'
const options={type:'overview',scope:'Both sites',selected:[],town:'',category:'',decision:'',search:'',sort:'Name'}
function fixture(){const data=emptyData();data.businesses=[{id:'a',name:'Alpha',city:'Longmont',categories:['Art'],notes:encodeMetadata({},{outreachDecision:'Potential networking opportunity'})},{id:'b',name:'Beta',city:'Boulder',categories:['Food'],notes:encodeMetadata({},{outreachDecision:'Stop outreach'})},{id:'c',name:'Gamma',city:'Longmont',notes:encodeMetadata({},{outreachDecision:'Pursue as a client'})},{id:'d',name:'Delta',notes:encodeMetadata({},{outreachDecision:'Not a match'})}];data.listings=[{business_id:'a',site:'Loving Longmont'},{business_id:'a',site:'Loving Longmont'},{business_id:'a',site:'MKT Colorado'},{business_id:'b',site:'MKT Colorado'},{business_id:'c',site:'Loving Longmont'},{business_id:'d',site:'MKT Colorado'}];return data}
const bi={settings:[],research:[{business_id:'c',created_at:'2026-10-14',assessment:{platforms:{Website:{state:'Missing'}}}}],profiles:[{business_id:'a',approved_at:'2026-10-14',approved:{platforms:{Website:{state:'Rated',score:2,relevant:true},Facebook:{state:'Not Applicable'}}}},{business_id:'b',approved_at:'2026-10-14',approved:{platforms:{Website:{state:'Missing',relevant:true}}}}]}
test('reports deduplicate shared businesses, respect site and selection scope, and keep unreviewed research unknown',()=>{
 const data=fixture(),report=buildBusinessReport(data,bi,options,'2026-10-14T07:00:00Z');assert.equal(report.rows.length,4);assert.equal(report.summary.visibilityGaps,2);assert.equal(report.rows.find(r=>r.business.id==='c').gaps.length,0);assert.equal(report.rows.find(r=>r.business.id==='a').unknown.some(p=>p.name==='Facebook'),false)
 assert.equal(buildBusinessReport(data,bi,{...options,scope:'Loving Longmont'}).rows.length,2);assert.deepEqual(buildBusinessReport(data,bi,{...options,scope:'Selected businesses',selected:['c']}).rows.map(r=>r.business.id),['c'])
 assert.equal(buildBusinessReport(data,bi,{...options,town:'Boulder',category:'Food'}).rows[0].business.id,'b');assert.equal(businessReportCsv(report).length,4)
})
test('opportunity reports respect outreach choices and networking decisions',()=>{
 const data=fixture();assert.deepEqual(buildBusinessReport(data,bi,{...options,type:'clients'}).rows.map(r=>r.business.id),['a','c']);assert.deepEqual(buildBusinessReport(data,bi,{...options,type:'networking'}).rows.map(r=>r.business.id),['a']);assert.deepEqual(buildBusinessReport(data,bi,{...options,type:'gaps'}).rows.map(r=>r.business.id),['a','b']);assert.equal(buildBusinessReport(data,bi,options).rows.find(r=>r.business.id==='b').next,'Stop outreach')
})
