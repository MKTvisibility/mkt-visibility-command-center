import test from 'node:test'
import assert from 'node:assert/strict'
import {publicBusiness,pageTarget,cardHtml,updatePage,fingerprint} from '../supabase/functions/publish-listing/core.mjs'
const raw={id:'123',name:'Test & Shop',description:'<script>alert(1)</script>',image_url:'https://example.com/photo.png',website:'https://example.com',email:'test@example.com',categories:['Shop'],social_urls:[],notes:'PRIVATE',contact_name:'PRIVATE',internal_notes:'PRIVATE',monthly_fee:100}
const b=publicBusiness(raw)
test('public listing snapshot excludes confidential fields and escapes HTML and image URLs',()=>{
 assert.ok(!Object.hasOwn(b,'notes'));assert.ok(!Object.hasOwn(b,'contact_name'));assert.ok(!Object.hasOwn(b,'monthly_fee'))
 const html=cardHtml(b,'Loving Longmont');assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('https://example.com/photo.png'))
 assert.throws(()=>publicBusiness({...raw,image_url:'javascript:alert(1)'}));assert.throws(()=>publicBusiness({...raw,image_url:'http://example.com/img.png'}))
})
test('publication rejects third-party URLs and traversal paths',()=>{
 assert.equal(pageTarget('MKT Colorado','https://mktcolorado.com/longmont.html#shops').path,'longmont.html')
 for(const url of ['https://evil.test/longmont.html','https://mktcolorado.com/a/b.html','https://mktcolorado.com/%2e%2e%2fsecrets.html','javascript:alert(1)','https://user:pass@mktcolorado.com/a.html'])assert.throws(()=>pageTarget('MKT Colorado',url))
})
test('updates and removal affect only exact matching cards and preserve neighboring content',()=>{
 const old='<header>Keep</header><article class="business-card" id="shop"><h3>Test &amp; Shop</h3><p>Old</p></article><article class="business-card"><h3>Another Shop</h3><p>Keep</p></article><footer>Keep</footer>'
 const p=updatePage(old,b,'Loving Longmont',{path:'businesses.html'},'publish');assert.equal(p.count,1);assert.ok(p.html.includes('id="shop"'));assert.ok(p.html.includes('Another Shop'));assert.ok(!p.html.includes('<p>Old</p>'))
 const gone=updatePage(p.html,b,'Loving Longmont',{path:'businesses.html'},'remove');assert.equal(gone.count,1);assert.ok(!gone.html.includes('data-cc-business'));assert.ok(gone.html.includes('Another Shop'))
 const renamed={...b,name:'New Name'};assert.equal(updatePage(old,renamed,'Loving Longmont',{path:'businesses.html'},'publish',['Test & Shop']).count,1)
})
test('new cards require an explicit existing category grid and remain within it',()=>{
 const html='<section id="shops"><div class="grid"><article class="card"><div><h3>Other</h3></div></article></div></section><footer>Keep</footer>'
 const p=updatePage(html,b,'MKT Colorado',{path:'longmont.html',section:'shops'},'publish');assert.equal(p.count,1);assert.ok(p.html.endsWith('</div></section><footer>Keep</footer>'))
 assert.throws(()=>updatePage(html,b,'MKT Colorado',{path:'longmont.html'},'publish'))
 assert.throws(()=>updatePage(html,b,'MKT Colorado',{path:'longmont.html',section:'missing'},'publish'))
 assert.throws(()=>updatePage(html,b,'MKT Colorado',{path:'longmont.html'},'remove'))
})
test('preview signatures detect changed content and operation',async()=>{
 assert.notEqual(await fingerprint({b,operation:'publish'}),await fingerprint({b,operation:'remove'}))
 assert.notEqual(await fingerprint({b}),await fingerprint({b:{...b,image_url:'https://example.com/new.png'}}))
})
