import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {reportRange,profileFilter,collectBusinessReport} from '../supabase/functions/business-traffic-report/business-report.mjs'
import {initBusinessAnalytics} from '../src/lib/site-business-analytics.mjs'
const id='55555555-5555-4555-8555-555555555555'
test('business report uses direct period totals, isolated routes, Mountain dates and unavailable rather than false zero',async()=>{
 const now=new Date('2026-10-17T07:30:00Z'),bodies=[]
 assert.equal(reportRange('2026-10-12T05:30:00Z',undefined,undefined,now).start,'2026-10-11')
 assert.throws(()=>reportRange(null,'2026-02-30','2026-10-16',now),/valid/)
 assert.throws(()=>reportRange('2026-10-12T12:00:00Z','2026-10-11','2026-10-16',now),/before/)
 const filter=JSON.stringify(profileFilter(['salt-and-bread.html','business.html'],id));assert.ok(filter.includes('/salt-and-bread.html'));assert.ok(!filter.includes('food-drink.html'))
 const fetcher=async(url,options)=>{const body=JSON.parse(options.body);bodies.push(body);if(body.dimensions)return new Response('{}',{status:400});return Response.json({metricHeaders:['activeUsers','screenPageViews','sessions'].map(name=>({name})),rows:[{metricValues:[17,45,20].map(v=>({value:String(v)}))}]});}
 const report=await collectBusinessReport({business:{id,name:'Test Bakery'},firstListed:'2026-10-01T12:00:00Z',firstListedSource:'repository_first_mention',routes:['test-bakery.html'],trackingStart:'2026-10-11T05:55:06Z'},'token',fetcher,now)
 assert.deepEqual(report.site,[17,45,20]);assert.deepEqual(report.profile,[17,45,20]);assert.equal(report.actions,null);assert.equal(report.exposure,null)
 assert.ok(report.notes.some(n=>n.includes('before the recorded Analytics')))
 assert.ok(bodies.every(b=>b.dateRanges[0].startDate==='2026-10-01'&&b.dateRanges[0].endDate==='2026-10-16'))
 assert.ok(JSON.stringify(bodies[1].dimensionFilter).includes('test-bakery.html'))
 await assert.rejects(()=>collectBusinessReport({business:{id,name:'Test'},firstListed:'2026-10-01T12:00:00Z',routes:['test.html']},'token',async()=>new Response('',{status:403}),now),/Google denied/)
})
test('tracking deduplicates profile renders and sends action types without email, phone or destination query strings',async()=>{
 const dom=new JSDOM(`<main id="business-profile" data-ll-profile="${id}"><article class="bp-profile"><h1>Test Bakery</h1><a href="mailto:private@example.com">Email</a><a href="https://example.com/?private=secret">Website</a><a href="tel:1234567890">Phone</a></article></main>`,{url:'https://lovinglongmont.com/test-bakery.html',pretendToBeVisual:true})
 const {window:w}=dom,calls=[];w.gtag=(...args)=>calls.push(args);w.fetch=async()=>Response.json([])
 initBusinessAnalytics(w);initBusinessAnalytics(w);w.document.dispatchEvent(new w.Event('ll-businesses-updated'))
 for(const a of w.document.querySelectorAll('a'))a.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true}))
 assert.equal(calls.filter(c=>c[1]==='ll_profile_view').length,1)
 assert.deepEqual(calls.filter(c=>c[1]==='ll_business_click').map(c=>c[2].action_type),['email','website','phone'])
 assert.ok(!JSON.stringify(calls).includes('private@example.com'));assert.ok(!JSON.stringify(calls).includes('1234567890'));assert.ok(!JSON.stringify(calls).includes('secret'))
 w.close()
})
