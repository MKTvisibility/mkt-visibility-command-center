import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderHomeStories,renderHomeStory,storyImages} from '../src/lib/home-stories.mjs';
const content={name:'Local Professional',story:'First paragraph.\n\nSecond paragraph.',description:'SHOULD NOT DISPLAY',phone:'PRIVATE PHONE',services:['DO NOT DISPLAY'],image_url:'https://example.com/logo.png',gallery:[{url:'https://example.com/left.jpg'},{url:'https://example.com/third.jpg'}],home_story:{enabled:true,images:[]}};
test('all eight image combinations show only the chosen assets and full story',()=>{
 const dom=new JSDOM('<main></main>'),doc=dom.window.document;
 for(let mask=0;mask<8;mask++){
  const keys=['logo','left','photo3'].filter((key,i)=>mask&(1<<i)),b={...content,home_story:{enabled:true,images:keys}};
  const article=renderHomeStory(doc,{business_id:'id',route:'professional.html',public_content:b});
  assert.deepEqual(storyImages(b).map(x=>x.key),keys);assert.equal(article.querySelectorAll('img').length,keys.length);assert.equal(article.querySelectorAll('.ll-home-story-text p').length,2);
  assert.match(article.textContent,/First paragraph/);assert.doesNotMatch(article.textContent,/SHOULD NOT|PRIVATE|DO NOT/);assert.equal(article.querySelector('a').getAttribute('href'),'professional.html');
 }
 const unsafe=renderHomeStory(doc,{business_id:'id',route:'javascript:bad',public_content:{...content,story:'<img onerror=alert(1)>',image_url:'javascript:bad',home_story:{enabled:true,images:['logo']}}});assert.equal(unsafe.querySelector('img'),null);assert.equal(unsafe.querySelector('script'),null);assert.match(unsafe.textContent,/<img onerror/);assert.equal(unsafe.querySelector('a').getAttribute('href'),'business.html?id=id');dom.window.close();
});
test('home feed requires an explicitly enabled published story, preserves other content and removes unpublished highlights',()=>{
 const dom=new JSDOM('<header>Keep</header><section id="home-business-stories" hidden></section><footer>Keep</footer>'),doc=dom.window.document;
 const row={business_id:'a',active:true,sites:['Loving Longmont'],public_content:content};
 const excluded=[{...row,business_id:'hidden',active:false},{...row,business_id:'other-site',sites:['MKT Colorado']},{...row,business_id:'off',public_content:{...content,home_story:{enabled:false}}},{...row,business_id:'blank',public_content:{...content,story:' '}}];
 assert.equal(renderHomeStories(doc,[row,...excluded],'events.html').size,0);assert.equal(renderHomeStories(doc,[row,...excluded],'index.html','MKT Colorado').size,0);
 assert.deepEqual([...renderHomeStories(doc,[row,...excluded],'index.html')],['a']);assert.equal(doc.querySelectorAll('.ll-home-story').length,1);assert.equal(doc.querySelector('footer').textContent,'Keep');
 renderHomeStories(doc,[],'index.html');assert.equal(doc.querySelector('#home-business-stories').hidden,true);assert.equal(doc.querySelectorAll('.ll-home-story').length,0);dom.window.close();
});
