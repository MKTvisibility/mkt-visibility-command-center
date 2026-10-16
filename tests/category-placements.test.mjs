import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {loadCategoryDirectory} from '../public/live/category-directory.mjs';
const fallback=(id,name,pages=['arts-crafts-makers.html'])=>({business_id:id,name,description:'Already public',route:'existing.html',source:'businesses.html',pages});
const live=(id,name,pages,extra={})=>({business_id:id,route:'named-page.html',active:true,sites:['Loving Longmont'],public_content:{name,description:'Published'},site_placements:{'Loving Longmont':pages},...extra});
test('category directory sorts names, deduplicates old cards and honors per-site removals and unpublishing',async()=>{
 const dom=new JSDOM('<header>Header</header><main><div class="resource-grid"><article><h3>Zulu Studio</h3></article><article><h3>Beta Studio</h3></article></div><section data-category-directory></section></main><footer>Footer</footer>',{url:'https://lovinglongmont.com/arts-crafts-makers.html'});
 const catalog=[fallback('old','Zulu Studio'),fallback('one','Alpha Studio'),fallback('hidden','Hidden Studio'),fallback('other-site','Wrong Website'),fallback('moved','Moved Studio')];
 const rows=[live('one','Alpha Studio',['arts-crafts-makers.html']),live('hidden','Hidden Studio',[],{active:false}),live('other-site','Wrong Website',['arts-crafts-makers.html'],{sites:['MKT Colorado']}),live('moved','Moved Studio',[])];
 const fetcher=async url=>({ok:true,json:async()=>String(url).includes('category-listings.json')?catalog:rows});
 await loadCategoryDirectory(dom.window.document,fetcher);
 assert.deepEqual([...dom.window.document.querySelectorAll('[data-category-directory] h3')].map(h=>h.textContent),['Alpha Studio']);
 assert.deepEqual([...dom.window.document.querySelectorAll('.resource-grid h3')].map(h=>h.textContent),['Beta Studio','Zulu Studio']);
 assert.equal(dom.window.document.querySelector('header').textContent,'Header');assert.equal(dom.window.document.querySelector('footer').textContent,'Footer');
 await loadCategoryDirectory(dom.window.document,fetcher);assert.equal(dom.window.document.querySelectorAll('[data-category-directory] h3').length,1);
 dom.window.close();
});
test('existing listings without profiles remain reachable through their guide, and names sort case-insensitively',async()=>{
 const dom=new JSDOM('<section data-category-directory></section>',{url:'https://lovinglongmont.com/arts-crafts-makers.html'});
 const rows=[{...fallback('z','Zulu'),route:''},fallback('a','alpha')];
 await loadCategoryDirectory(dom.window.document,async url=>({ok:true,json:async()=>String(url).includes('category-listings.json')?rows:[]}));
 assert.deepEqual([...dom.window.document.querySelectorAll('h3')].map(h=>h.textContent),['alpha','Zulu']);
 assert.equal(dom.window.document.querySelectorAll('h3 a')[1].getAttribute('href'),'businesses.html');
 dom.window.close();
});
test('new category validator accepts every Loving Longmont category and rejects unavailable MKT Colorado pages',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const {readFileSync}=await import('node:fs');
 const categories=JSON.parse(readFileSync(new URL('../scripts/ll-categories.json',import.meta.url)));
 const db=new PGlite();
 try{await db.exec(readFileSync(new URL('../supabase/migrations/20261016032716_loving_longmont_category_placements.sql',import.meta.url),'utf8'));
 const settings={sites:['Loving Longmont'],spotlight_pages:categories.map(([,p])=>p),site_placements:{'Loving Longmont':categories.map(([,p])=>p)}};
 const result=await db.query('select public.cc_ll_validate_settings($1::jsonb) as valid',[JSON.stringify(settings)]);assert.equal(result.rows[0].valid,true);
 await assert.rejects(db.query('select public.cc_ll_validate_settings($1::jsonb)',[JSON.stringify({...settings,site_placements:{'MKT Colorado':['arts-crafts-makers.html']}})]),/Page unavailable/);
 await assert.rejects(db.query('select public.cc_ll_validate_settings($1::jsonb)',[JSON.stringify({...settings,spotlight_pages:['unknown-page.html']})]),/eligible spotlight/);
 }finally{await db.close()}
});
