import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderHomeStories,renderHomeStory,storyImages,storyExcerpt} from '../src/lib/home-stories.mjs';
import {STORY_PAGES} from '../src/lib/story-pages.mjs';
const content={name:'Local Professional',story:'First paragraph.\n\nSecond paragraph.',description:'SHOULD NOT DISPLAY',phone:'PRIVATE PHONE',services:['DO NOT DISPLAY'],image_url:'https://example.com/logo.png',gallery:[{url:'https://example.com/left.jpg'},{url:'https://example.com/third.jpg'}],home_story:{enabled:true,images:[]}};
test('all eight image combinations show only the chosen assets and one-paragraph preview',()=>{
 const dom=new JSDOM('<main></main>'),doc=dom.window.document;
 for(let mask=0;mask<8;mask++){
  const keys=['logo','left','photo3'].filter((key,i)=>mask&(1<<i)),b={...content,home_story:{enabled:true,images:keys}};
  const article=renderHomeStory(doc,{business_id:'id',route:'professional.html',public_content:b});
  assert.deepEqual(storyImages(b).map(x=>x.key),keys);assert.equal(article.querySelectorAll('img').length,keys.length);assert.equal(article.querySelectorAll('.ll-home-story-text p').length,1);
  assert.match(article.textContent,/First paragraph/);assert.doesNotMatch(article.textContent,/Second paragraph/);assert.equal(article.querySelector('a').textContent,'Read more →');assert.doesNotMatch(article.textContent,/SHOULD NOT|PRIVATE|DO NOT/);assert.equal(article.querySelector('a').getAttribute('href'),'professional.html');
 }
 const unsafe=renderHomeStory(doc,{business_id:'id',route:'javascript:bad',public_content:{...content,story:'<img onerror=alert(1)>',image_url:'javascript:bad',home_story:{enabled:true,images:['logo']}}});assert.equal(unsafe.querySelector('img'),null);assert.equal(unsafe.querySelector('script'),null);assert.match(unsafe.textContent,/<img onerror/);assert.equal(unsafe.querySelector('a').getAttribute('href'),'business.html?id=id');dom.window.close();
});
test('page selections insert three-card grid after the introduction and do not leak to other pages or profiles',()=>{
 const dom=new JSDOM('<header>Keep</header><main><section class="intro"><h1>Events</h1></section><div id="existing">Keep</div></main><footer>Keep</footer>'),doc=dom.window.document;
 const row={business_id:'a',active:true,sites:['Loving Longmont'],public_content:{...content,home_story:{enabled:true,images:['photo3'],pages:['events.html','community.html']}}};
 assert.equal(renderHomeStories(doc,[row],'index.html').size,0);assert.equal(doc.querySelector('#home-business-stories'),null);
 renderHomeStories(doc,[row,{...row,business_id:'b'},{...row,business_id:'c'}],'events.html');assert.equal(doc.querySelector('.intro').nextElementSibling.id,'home-business-stories');assert.equal(doc.querySelectorAll('.ll-story-preview-grid>.ll-home-story').length,3);assert.equal(doc.querySelectorAll('.ll-home-story-text p').length,3);assert.equal(doc.querySelector('#existing').textContent,'Keep');
 renderHomeStories(doc,[],'events.html');assert.equal(doc.querySelector('#home-business-stories').hidden,true);assert.equal(renderHomeStories(doc,[row],'business.html').size,0);assert.equal(STORY_PAGES.length,42);dom.window.close();
});
test('navigation selections validate all supported pages and reject individual profiles',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const {readFileSync}=await import('node:fs');const db=new PGlite();try{
 await db.exec(readFileSync(new URL('../supabase/migrations/20261018041435_directory_navigation_categories.sql',import.meta.url),'utf8'));
 const check=pages=>db.query('select cc_ll_validate_settings($1) as valid',[{home_story:{enabled:true,images:['photo3'],pages}}]);
 assert.equal((await check(STORY_PAGES.map(([page])=>page))).rows[0].valid,true);
 for(const pages of [['business.html'],['index.html','index.html'],[],['events.html#october']])await assert.rejects(check(pages));
 }finally{await db.close()}
});
test('home feed requires an explicitly enabled published story, preserves other content and removes unpublished highlights',()=>{
 const dom=new JSDOM('<header>Keep</header><section id="home-business-stories" hidden></section><footer>Keep</footer>'),doc=dom.window.document;
 const row={business_id:'a',active:true,sites:['Loving Longmont'],public_content:content};
 const excluded=[{...row,business_id:'hidden',active:false},{...row,business_id:'other-site',sites:['MKT Colorado']},{...row,business_id:'off',public_content:{...content,home_story:{enabled:false}}},{...row,business_id:'blank',public_content:{...content,story:' '}}];
 assert.equal(renderHomeStories(doc,[row,...excluded],'events.html').size,0);assert.equal(renderHomeStories(doc,[row,...excluded],'index.html','MKT Colorado').size,0);
 assert.deepEqual([...renderHomeStories(doc,[row,...excluded],'index.html')],['a']);assert.equal(doc.querySelectorAll('.ll-home-story').length,1);assert.equal(doc.querySelector('footer').textContent,'Keep');
 renderHomeStories(doc,[],'index.html');assert.equal(doc.querySelector('#home-business-stories').hidden,true);assert.equal(doc.querySelectorAll('.ll-home-story').length,0);dom.window.close();
});

test('preview skips a standalone article title and uses the opening paragraph',()=>{assert.equal(storyExcerpt('Brickscape Café: A Place to Build\n\nBrickscape began as a small pop-up bringing people together through creative play.\n\nLater details.'),'Brickscape began as a small pop-up bringing people together through creative play.');assert.equal(storyExcerpt('First paragraph.\n\nLonger second paragraph.'),'First paragraph.')});
