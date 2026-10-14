import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {transformWithOxc} from 'vite'
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import React from 'react'
import {renderProfile,renderBusinessCard} from '../src/lib/live-profile-view.mjs'
test('logo sits above the name and first visible photo sits at left without replacement art',()=>{
 const dom=new JSDOM('<div id="profile"></div>'),root=dom.window.document.getElementById('profile');
 renderProfile(root,{name:'Animal Hospital',image_url:'https://example.com/logo.png',gallery:[{url:'https://example.com/hidden.jpg',enabled:false},{url:'https://example.com/vet.jpg'}]});
 assert.equal(root.querySelector('.bp-primary-image img').src,'https://example.com/vet.jpg');
 assert.equal(root.querySelector('.bp-heading .bp-logo img').src,'https://example.com/logo.png');
 renderProfile(root,{name:'Animal Hospital',image_url:'https://example.com/logo.png'});
 assert.equal(root.querySelector('.bp-primary-image'),null);
 assert.ok(root.querySelector('.bp-identity.bp-no-feature'));
 dom.window.close();
});
test('live editor saves before preview/publish, orders and hides photos, uploads images and protects read-only partners',async()=>{
 const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://localhost/'});
 for(const k of ['window','document','HTMLElement','Node','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true,writable:true});Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const {render,screen,fireEvent,cleanup}=await import('@testing-library/react');const dir=mkdtempSync(join(process.cwd(),'.ui-test-'));
 const raw=readFileSync(new URL('../src/LiveBusinessPage.jsx',import.meta.url),'utf8').replace("import './live-profile.css'",'').replaceAll("from './","from '"+pathToFileURL(join(process.cwd(),'src')).href+'/');const code=await transformWithOxc(raw,'LiveBusinessPage.jsx',{jsx:{runtime:'automatic'}});const file=join(dir,'LiveBusinessPage.mjs');writeFileSync(file,code.code);
 try{const {default:Editor}=await import(pathToFileURL(file).href);const business={id:'77777777-7777-4777-8777-777777777777',name:'Test Photo',address:'PRIVATE',categories:['Photography'],social_urls:[],updated_at:'v1'};let profile={route:'test-photo.html',updated_at:'p1',settings:{fields:{address:false,gallery:true,description:true},services:['Portraits'],gallery:[{url:'https://example.com/one.webp',enabled:true},{url:'https://example.com/two.webp',enabled:true}],spotlight_pages:['businesses.html'],spotlight_order:0,directory:true,active:true}};let saved,previewed=0,published=0,uploaded=0;
 const repository={loadLivePage:async()=>({profile,publication:null}),saveLivePage:async(id,b,s)=>{saved={b,s};profile={...profile,settings:s,updated_at:'p2'};return {business:{...business,...b,updated_at:'v2'},profile}},previewLivePage:async()=>{previewed++;return {signature:'preview1',active:true,public_content:{name:'Test Photo',description:saved.b.description,gallery:saved.s.gallery.filter(p=>p.enabled)}}},publishLivePage:async(id,sig)=>{assert.equal(sig,'preview1');published++;return {active:true,revision:1,published_at:new Date().toISOString()}},uploadListingImage:async()=>{uploaded++;return 'https://example.com/upload.webp'}};
 render(React.createElement(Editor,{business,repository,writable:true}));await screen.findByRole('button',{name:'Preview live business page'});
 fireEvent.change(screen.getByLabelText('Short description'),{target:{value:'A new story'}});assert.equal(screen.getByRole('button',{name:'Preview live business page'}).disabled,true);fireEvent.change(screen.getByLabelText(/^Services/),{target:{value:'Portraits\n'}});assert.equal(screen.getByLabelText(/^Services/).value,'Portraits\n');fireEvent.change(screen.getByLabelText(/^Services/),{target:{value:'Portraits\nFamilies'}});
 fireEvent.click(screen.getByRole('button',{name:'Move photo 2 up'}));fireEvent.click(screen.getByLabelText(/^Show photo 2/));fireEvent.change(screen.getByLabelText('Upload main / additional photos'),{target:{files:[new dom.window.File(['image'],'new.webp',{type:'image/webp'})]}});await screen.findByText('Image uploaded and saved to this client’s private draft. Preview and publish to update the live page.');assert.equal(uploaded,1);assert.equal(saved.s.gallery[2].url,'https://example.com/upload.webp');assert.equal(published,0);fireEvent.change(screen.getByLabelText('Short description'),{target:{value:'A new story after upload'}});
 fireEvent.click(screen.getByRole('button',{name:'Save live-page draft'}));await screen.findByText('Draft saved privately. Preview it before publishing.');assert.equal(published,0);assert.equal(saved.s.fields.address,false);assert.equal(saved.s.gallery[0].url,'https://example.com/two.webp');assert.equal(saved.s.gallery[1].enabled,false);assert.deepEqual(saved.s.services,['Portraits','Families']);
 fireEvent.click(screen.getByRole('button',{name:'Preview live business page'}));await screen.findByRole('button',{name:'Publish live business page'});assert.equal(previewed,1);assert.ok(!screen.getByRole('region',{name:'Live publication preview'}).textContent.includes('PRIVATE'));fireEvent.click(screen.getByRole('button',{name:'Publish live business page'}));await screen.findByText(/Published to the live business page/);assert.equal(published,1);fireEvent.change(screen.getByLabelText('Upload logo'),{target:{files:[new dom.window.File(['image'],'main.jpg',{type:'image/jpeg'})]}});await screen.findByText('Image uploaded and saved to this client’s private draft. Preview and publish to update the live page.');assert.equal(saved.b.image_url,'https://example.com/upload.webp');assert.equal(published,1);cleanup();
 render(React.createElement(Editor,{business,repository,writable:false}));await screen.findByText('Only approved editors can save or publish changes.');assert.equal(screen.getByRole('button',{name:'Preview live business page'}).closest('fieldset').disabled,true);cleanup();
 const root=dom.window.document.createElement('div');renderProfile(root,{name:'<script>Test</script>',story:'<img src=x onerror=alert(1)>',website:'javascript:alert(1)',gallery:[{url:'https://example.com/a.webp'}]});assert.equal(root.querySelector('script'),null);assert.equal(root.querySelector('a.bp-button'),null);assert.ok(root.textContent.includes('<img src=x'));assert.equal(root.querySelector('img').getAttribute('src'),'https://example.com/a.webp');const card=renderBusinessCard(dom.window.document,{business_id:business.id,route:'test-photo.html',public_content:{name:'Test Photo',description:'Published only'}});assert.equal(card.querySelector('h3 a').getAttribute('href'),'test-photo.html');
 }finally{cleanup();rmSync(dir,{recursive:true,force:true});dom.window.close()}
});
