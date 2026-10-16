import test from 'node:test';import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';import {readFileSync} from 'node:fs';
import {setPageSection,validPlacement,onPage} from '../src/lib/section-placements.js';
import {renderSectionPlacements} from '../public/live/section-placements.mjs';
import {renderBusinessCard} from '../src/lib/live-profile-view.mjs';
test('page section choices preserve unrelated website placements and reject unknown anchors',()=>{
 const selected=setPageSection(['animals.html','jobs.html'],'jobs.html','side-gigs');assert.deepEqual(selected,['animals.html','jobs.html#side-gigs']);assert.equal(onPage(selected,'jobs.html'),true);
 assert.deepEqual(setPageSection(selected,'jobs.html',null),['animals.html']);assert.equal(validPlacement('Loving Longmont','jobs.html#side-gigs',['jobs.html']),true);assert.equal(validPlacement('Loving Longmont','jobs.html#wrong',['jobs.html']),false);assert.equal(validPlacement('MKT Colorado','jobs.html#side-gigs',['jobs.html']),false);
});
test('section placement replaces only matching legacy card, links to profile and is repeatable',()=>{
 const dom=new JSDOM('<section id="side-gigs"><div class="gig-grid"><div class="gig-card"><h3>Taskrabbit</h3></div><div class="gig-card"><h3>Rover</h3></div></div></section><div class="ll-connected-card"><h3>Taskrabbit</h3></div><footer>Keep</footer>',{url:'https://lovinglongmont.com/jobs.html'});
 const row={business_id:'task',route:'taskrabbit.html',active:true,sites:['Loving Longmont'],public_content:{name:'Taskrabbit',description:'Help at home'},site_placements:{'Loving Longmont':['jobs.html#side-gigs']}};
 for(let i=0;i<2;i++){assert.ok(renderSectionPlacements(dom.window.document,[row],'jobs.html','Loving Longmont',renderBusinessCard).has('task'));assert.equal(dom.window.document.querySelectorAll('[data-ll-live-business="task"]').length,1);assert.equal(dom.window.document.querySelector('#side-gigs h3 a').getAttribute('href'),'taskrabbit.html');assert.equal(dom.window.document.querySelectorAll('.gig-card').length,1)}
 assert.equal(dom.window.document.querySelector('footer').textContent,'Keep');dom.window.close();
});
test('unsupported, inactive and other-site placements cannot change page sections',()=>{
 const dom=new JSDOM('<section id="side-gigs"><div class="gig-grid"></div></section>');const row={business_id:'task',active:true,sites:['MKT Colorado'],public_content:{name:'Taskrabbit'},site_placements:{'Loving Longmont':['jobs.html#side-gigs']}};assert.equal(renderSectionPlacements(dom.window.document,[row],'jobs.html','Loving Longmont',renderBusinessCard).size,0);dom.window.close();
});
test('database allows known anchors and blocks invalid anchors and invalid websites',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();try{await db.exec(readFileSync(new URL('../supabase/migrations/20261016234428_page_section_placements.sql',import.meta.url),'utf8'));const query=s=>db.query('select public.cc_ll_validate_settings($1::jsonb) as valid',[JSON.stringify(s)]);assert.equal((await query({site_placements:{'Loving Longmont':['jobs.html#side-gigs']}})).rows[0].valid,true);await assert.rejects(query({site_placements:{'Loving Longmont':['jobs.html#bad']}}),/Section unavailable/);await assert.rejects(query({site_placements:{'MKT Colorado':['jobs.html']}}),/Page unavailable/)}finally{await db.close()}
});
