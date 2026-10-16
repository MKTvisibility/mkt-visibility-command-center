import {renderBusinessCard} from './profile-view.mjs?v=20261016-compact-cards';
export const alphabetical=(a,b)=>String(a.public_content?.name||a.name||'').localeCompare(String(b.public_content?.name||b.name||''),'en',{sensitivity:'base',numeric:true})||String(a.business_id||'').localeCompare(String(b.business_id||''));
const normalize=s=>s.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
export async function loadCategoryDirectory(doc=document,fetcher=fetch){
 const page=doc.defaultView.location.pathname.split('/').pop()||'index.html';
 const root=doc.querySelector('[data-category-directory]');if(!root)return;
 const base='https://gvmwkltwrlqwbqegieum.supabase.co';
 const results=await Promise.allSettled([
  fetcher(new URL('./category-listings.json',import.meta.url),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Category directory unavailable');return r.json()}),
  fetcher(base+'/rest/v1/cc_ll_live_publications?select=business_id,route,public_content,directory,spotlight_pages,active,sites,site_placements',{headers:{apikey:'sb_publishable_SFIrQ_kqkLQJdBNMnaRr3g_w6XWKaBJ'},cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Live updates unavailable');return r.json()})
 ]);
 if(results.every(r=>r.status==='rejected')){root.textContent='Listings could not load. Please refresh.';return;}
 const catalog=results[0].status==='fulfilled'?results[0].value:[];
 const publications=results[1].status==='fulfilled'?results[1].value:[];
 const published=new Map(publications.map(r=>[r.business_id,r]));
 const entries=new Map();
 for(const item of catalog){if(published.has(item.business_id)||!item.pages.includes(page))continue;entries.set(item.business_id,{...item,public_content:{name:item.name,description:item.description,gallery:item.gallery||[]},pageRoute:item.route||item.source});}
 for(const row of publications){
  const pages=row.site_placements?.['Loving Longmont']||row.spotlight_pages||[];
  if(row.active&&(row.sites||['Loving Longmont']).includes('Loving Longmont')&&pages.includes(page))entries.set(row.business_id,row);
 }
 // Bring older guide cards into the same compact presentation without changing their surrounding guide text.
 const lookup=new Map(catalog.map(item=>[normalize(item.name),item]));
 const routeLookup=new Map(catalog.filter(item=>item.route).map(item=>[item.route,item]));
 for(const row of publications)if(row.active&&(row.sites||['Loving Longmont']).includes('Loving Longmont'))lookup.set(normalize(row.public_content.name),row);
 const converted=new Set(),seenListings=new Set();
 for(const title of [...doc.querySelectorAll('.grid h3,.resource-grid h3,.business-grid h3,.ll-connected-grid h3,.history-grid h3,.places-grid h3')]){
  if(root.contains(title))continue;
  const named=routeLookup.get((title.querySelector('a')?.getAttribute('href')||'').split(/[?#]/)[0]);
  const item=lookup.get(normalize(title.textContent.trim()))||(named&&lookup.get(normalize(named.name)));if(!item)continue;
  const card=title.closest('article')||title.closest('.resource-card,.business-card,.history-card,.ll-connected-card');
  if(!card||converted.has(card))continue;converted.add(card);
  const publication=published.get(item.business_id);
  if(publication&&(!publication.active||!(publication.sites||['Loving Longmont']).includes('Loving Longmont'))){card.remove();continue;}
  if(seenListings.has(item.business_id)){card.remove();continue;}seenListings.add(item.business_id);
  const row=item.public_content?item:{...item,pageRoute:item.route||item.source,public_content:{name:item.name,description:item.description,gallery:item.gallery||[]}};
  const replacement=renderBusinessCard(doc,row,'spotlight');if(card.id)replacement.id=card.id;card.replaceWith(replacement);
 }
 const existing=new Set([...doc.querySelectorAll('main h2,main h3,main h4,section h2,section h3,section h4')].filter(h=>!root.contains(h)).map(h=>normalize(h.textContent.trim())));
 root.replaceChildren();
 const rows=[...entries.values()].filter(r=>!seenListings.has(r.business_id)&&!existing.has(normalize(r.public_content.name))).sort(alphabetical);
 if(rows.length){const grid=doc.createElement('div');grid.className='ll-connected-grid ll-compact-grid';grid.dataset.llPreserveLayout='';for(const row of rows){
  const card=renderBusinessCard(doc,row,'spotlight');
  // Static listings without a profile link back to their existing guide.
  if(row.source&&!row.route)for(const a of card.querySelectorAll('a'))if(a.getAttribute('href')===row.source)a.textContent=a.closest('h3')?row.name:'Read more →';
  grid.append(card);
 }root.append(grid);}
 // Sort within existing sections, preserving headings and other guide content.
 for(const grid of doc.querySelectorAll('.grid,.resource-grid,.activity-grid,.business-grid,.ll-connected-grid,.history-grid,.places-grid')){
  const cards=[...grid.children].filter(n=>n.querySelector('h3,h4')&&!/^H[1-6]$/.test(n.tagName));
  if(cards.length>1){const slots=cards.map(c=>{const slot=doc.createComment('listing');c.before(slot);return slot});cards.sort((a,b)=>alphabetical({name:a.querySelector('h3,h4').textContent},{name:b.querySelector('h3,h4').textContent}));slots.forEach((slot,i)=>slot.replaceWith(cards[i]));}
 }
}
if(typeof document!=='undefined'){
 const run=()=>loadCategoryDirectory().catch(()=>{const root=document.querySelector('[data-category-directory]');if(root)root.textContent='Listings could not load. Please refresh.'});
 // The existing renderer publishes this event after updating legacy cards.
 if(document.querySelector('script[src*="live-page.mjs"]'))document.addEventListener('ll-businesses-updated',run,{once:true});else run();
}
