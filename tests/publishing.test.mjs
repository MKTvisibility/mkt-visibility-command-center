import test from 'node:test'
import assert from 'node:assert/strict'
import {publicBusiness,pageTarget,cardHtml,updatePage,fingerprint} from '../supabase/functions/publish-listing/core.mjs'
const raw={id:'123',name:'Test & Shop',description:'<script>alert(1)</script>',image_url:'https://example.com/photo.png',website:'https://example.com',email:'test@example.com',categories:['Shop'],social_urls:[],notes:'PRIVATE',contact_name:'PRIVATE',internal_notes:'PRIVATE',monthly_fee:100}
const b=publicBusiness(raw)
test('public listing snapshot excludes confidential fields and escapes HTML and image URLs',()=>{
 assert.ok(!Object.hasOwn(b,'notes'));assert.ok(!Object.hasOwn(b,'contact_name'));assert.ok(!Object.hasOwn(b,'monthly_fee'))
 const html=cardHtml(b,'Loving Longmont');assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('Visit Website'));assert.ok(html.includes('View Business Page'));assert.ok(html.includes('https://example.com/photo.png'))
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
test('free listings never disclose paid fields, extra images or private references even when checkbox flags are tampered with',()=>{
 const enhanced={...raw,social_urls:['https://facebook.com/shop'],notes:JSON.stringify({format:'mkt-portfolio-v1',text:'Private note',listingGalleryUrls:['https://example.com/extra.png'],publicationOptions:{tier:'Free',fields:{phone:false,email:true,social_urls:true,gallery_images:true,categories:true}}})}
 const basic=publicBusiness(enhanced)
 assert.equal(basic.phone,'');assert.equal(basic.email,'');assert.deepEqual(basic.social_urls,[]);assert.deepEqual(basic.gallery_images,[]);assert.deepEqual(basic.categories,[])
 assert.equal(basic.name,raw.name);assert.equal(basic.image_url,raw.image_url);assert.equal(basic.listingTier,'Free')
 const html=cardHtml(basic,'Loving Longmont');assert.ok(!html.includes(raw.email));assert.ok(!html.includes('facebook.com'));assert.ok(!html.includes('extra.png'));assert.ok(!html.includes('Private note'))
})
test('paid listings disclose only explicitly checked fields and cap the gallery at four additional photos',()=>{
 const value={...raw,social_urls:['https://facebook.com/shop'],notes:JSON.stringify({format:'mkt-portfolio-v1',listingGalleryUrls:Array.from({length:7},(_,i)=>`https://example.com/extra${i}.png`),publicationOptions:{tier:'Paid',fields:{image_url:false,description:false,email:true,social_urls:true,gallery_images:true,categories:false}}})}
 const paid=publicBusiness(value);assert.equal(paid.email,raw.email);assert.equal(paid.image_url,'');assert.equal(paid.description,'');assert.deepEqual(paid.social_urls,['https://facebook.com/shop']);assert.equal(paid.gallery_images.length,4)
 const html=cardHtml(paid,'MKT Colorado');assert.ok(html.includes('extra3.png'));assert.ok(!html.includes('extra4.png'));assert.ok(!html.includes(raw.image_url));assert.ok(!html.includes('alert(1)'))
 value.notes=JSON.stringify({format:'mkt-portfolio-v1',publicationOptions:{tier:'Paid',fields:{}}})
 assert.equal(publicBusiness(value).email,'');assert.deepEqual(publicBusiness(value).social_urls,[])
})
test('legacy Colorado div cards such as Akron update and remove without changing neighboring cards',()=>{
 const old='<section><div class="business-grid"><div class="business-card"><div class="business-photo">🌱</div><div class="business-body"><div class="business-type">Farm</div><h3>Test &amp; Shop</h3><p>Old</p><div class="business-meta">Old phone</div><div class="business-links"><a href="https://example.com">Visit</a></div></div></div><div class="business-card"><div class="business-body"><h3>Keep Neighbor</h3></div></div></div></section>'
 const update=updatePage(old,b,'MKT Colorado',{path:'akron.html'},'publish');assert.equal(update.count,1);assert.ok(update.html.includes('class="business-photo"'));assert.ok(update.html.includes('class="business-card"'));assert.ok(update.html.includes('Keep Neighbor'));assert.ok(!update.html.includes('Old phone'))
 const removal=updatePage(old,b,'MKT Colorado',{path:'akron.html'},'remove');assert.equal(removal.count,1);assert.ok(!removal.html.includes('Test &amp; Shop'));assert.ok(removal.html.includes('<h3>Keep Neighbor</h3>'));assert.ok(removal.html.endsWith('</div></section>'))
})

test('Loving Longmont publishing targets only the migrated repository and normalizes saved old links',()=>{
 for(const url of ['https://lovinglongmont.com/businesses.html#shops','https://lovinglongmont.github.io/loving-longmont-website/businesses.html#shops','https://mktvisibility.github.io/LovingLongmont/businesses.html#shops']){
  assert.deepEqual(pageTarget('Loving Longmont',url),{path:'businesses.html',section:'shops',url:'https://mktvisibility.github.io/LovingLongmont/businesses.html#shops'})
 }
 for(const url of ['https://mktvisibility.github.io/Colorado/businesses.html','https://mktvisibility.github.io/businesses.html','https://evil.test/LovingLongmont/businesses.html'])assert.throws(()=>pageTarget('Loving Longmont',url))
})
