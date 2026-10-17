import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
const workspace='c8748032-cdd3-443b-8c56-2e846cc9bf31',editor='22222222-2222-4222-8222-222222222222',viewer='33333333-3333-4333-8333-333333333333',business='55555555-5555-4555-8555-555555555555';
test('story selection is private until signed publication, rejects hidden images and respects member roles',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 for(const file of ['202610110001_command_center.sql','202610110002_business_profiles.sql','20261012075549_connected_live_business_pages.sql','20261012172712_universal_client_page_editor.sql','20261016234428_page_section_placements.sql','20261017073123_home_page_story_highlights.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users values('${editor}'),('${viewer}');insert into cc_members(workspace_id,user_id,display_name,role) values('${workspace}','${editor}','Editor','editor'),('${workspace}','${viewer}','Viewer','viewer');insert into cc_businesses(id,name,city,image_url,notes) values('${business}','Professional','Longmont','https://example.com/logo.png','PRIVATE NOTES');`);
 const settings={sites:['Loving Longmont'],active:true,fields:{story:true,gallery:true,image_url:true},story:'A published story',gallery:[{url:'https://example.com/left.jpg',enabled:true},{url:'https://example.com/third.jpg',enabled:true}],home_story:{enabled:true,images:['photo3']}};
 await db.query('insert into cc_ll_live_profiles(business_id,workspace_id,route,settings) values($1,$2,$3,$4)',[business,workspace,'professional.html',settings]);
 const as=async(user,role='authenticated')=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${user}',false);set role ${role}`);
 const preview=async()=> (await db.query('select cc_preview_ll_live_profile($1) value',[business])).rows[0].value;
 await as(editor);let p=await preview();assert.deepEqual(p.public_content.home_story,{enabled:true,images:['photo3']});assert.equal(p.public_content.story,'A published story');assert.ok(!JSON.stringify(p).includes('PRIVATE'));assert.equal((await db.query('select count(*) from cc_ll_live_publications')).rows[0].count,0);
 await db.query('select cc_publish_ll_live_profile($1,$2)',[business,p.signature]);
 await db.query("update cc_ll_live_profiles set settings=jsonb_set(settings,'{home_story,images}','[\"logo\",\"left\",\"photo3\"]'),updated_at=clock_timestamp() where business_id=$1",[business]);
 await assert.rejects(db.query('select cc_publish_ll_live_profile($1,$2)',[business,p.signature]),/preview changed/);
 assert.deepEqual((await db.query('select public_content from cc_ll_live_publications')).rows[0].public_content.home_story.images,['photo3']);
 await db.query("update cc_ll_live_profiles set settings=jsonb_set(settings,'{fields,gallery}','false') where business_id=$1",[business]);await assert.rejects(preview,/missing or hidden/);
 await db.query("update cc_ll_live_profiles set settings=jsonb_set(settings,'{fields,gallery}','true') where business_id=$1",[business]);p=await preview();assert.equal(p.public_content.home_story.images.length,3);
 await db.query("update cc_ll_live_profiles set settings=jsonb_set(settings,'{home_story,images}','[]') where business_id=$1",[business]);p=await preview();assert.deepEqual(p.public_content.home_story.images,[]);
 await db.query("update cc_ll_live_profiles set settings=jsonb_set(settings,'{fields,story}','false') where business_id=$1",[business]);await assert.rejects(preview,/Business story/);
 for(const value of [{enabled:true,images:['private']},{enabled:true,images:['logo','logo']},{enabled:true,images:[],notes:'private'},{enabled:'true',images:[]}])await assert.rejects(db.query('select cc_ll_validate_settings($1)',[{home_story:value}]));
 await as(viewer);await assert.rejects(preview,/Approved editor/);await as('','anon');assert.equal((await db.query('select public_content from cc_ll_live_publications')).rows.length,1);await assert.rejects(preview,/permission denied/);
 }finally{await db.close()}
});
