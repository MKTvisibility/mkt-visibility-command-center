// Business reporting uses public business identifiers only, never contact details.
const TAG='G-85GTDQHKLW';
export function safeDomain(value,base){try{const u=new URL(value,base);return /^https?:$/.test(u.protocol)?u.hostname:'';}catch{return '';}}
export function actionType(value,base){try{const u=new URL(value,base);if(u.protocol==='tel:')return 'phone';if(u.protocol==='mailto:')return 'email';if(!/^https?:$/.test(u.protocol))return '';if(u.hostname===new URL(base).hostname)return 'internal';return /(^|\.)(facebook|instagram|linkedin|tiktok|youtube|pinterest)\.com$/.test(u.hostname)?'social':'website';}catch{return '';}}
export function initBusinessAnalytics(win=window){
 if(win.__llBusinessAnalytics)return;win.__llBusinessAnalytics=true;
 const doc=win.document;if(win.navigator.doNotTrack==='1'||win.location.protocol==='file:')return;
 if(typeof win.gtag!=='function'){
  win.dataLayer=win.dataLayer||[];win.gtag=function(){win.dataLayer.push(arguments);};
  win.gtag('js',new Date());win.gtag('config',TAG);
  if(!doc.querySelector('script[src*="googletagmanager.com/gtag/js"]')){const script=doc.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+TAG;doc.head.append(script);}
 }
 const emit=(event,params)=>{if(doc.visibilityState==='hidden')return;win.gtag('event',event,{send_to:TAG,page_path:win.location.pathname,...params});};
 let catalog=[],routes={},catalogReady=false;const viewed=new Set(),seen=new Set(),observed=new WeakSet(),timers=new WeakMap();
 const idOf=node=>node?.dataset.llProfile||node?.dataset.llLiveBusiness||node?.dataset.ccBusiness||'';
 const page=win.location.pathname.split('/').pop()||'index.html';
 function identity(node){const id=idOf(node),entry=catalog.find(e=>e.business_id===id||(!id&&e.route===page));const linked=node?.querySelector('.business-links a')?.getAttribute('href');return {business_id:id||entry?.business_id||page.replace(/\.html$/,''),business_name:(node?.querySelector('h1,h2,h3')?.textContent||entry?.name||'').trim().slice(0,100),business_route:entry?.route||linked?.split(/[?#]/)[0]||page};}
 function profile(){const root=doc.querySelector('#business-profile,main.bp-main');if(root&&!idOf(root)&&!catalogReady)return;if(!root||!root.querySelector('.bp-profile,article,h1'))return;const text=root.textContent||'';if(/Loading current business information|Business information could not load|Business updates are temporarily unavailable/.test(text))return;const data=identity(root);if(!data.business_name||viewed.has(data.business_id))return;viewed.add(data.business_id);emit('ll_profile_view',data);}
 function placement(card){const section=card.closest('section[id]');return (section?.id||card.dataset.llPlacement||'directory').slice(0,80);}
 const observer=win.IntersectionObserver?new win.IntersectionObserver(entries=>{for(const e of entries){const card=e.target,id=idOf(card);if(!e.isIntersecting||e.intersectionRatio<0.5){win.clearTimeout(timers.get(card));timers.delete(card);continue;}if(seen.has(id))continue;timers.set(card,win.setTimeout(()=>{timers.delete(card);if(!card.isConnected||seen.has(id)||doc.visibilityState==='hidden')return;seen.add(id);emit('ll_listing_impression',{...identity(card),placement:placement(card)});},1000));}},{threshold:[0,0.5]}):null;
 function scan(){profile();if(observer)for(const card of doc.querySelectorAll('[data-ll-live-business],.ll-compact-card')){if(!idOf(card)||observed.has(card))continue;observed.add(card);observer.observe(card);}}
 doc.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(!link)return;const href=link.getAttribute('href'),type=actionType(href,win.location.href);if(!type)return;const card=link.closest('[data-ll-live-business],.ll-compact-card'),root=link.closest('#business-profile,main.bp-main');if(card){emit('ll_profile_open',{...identity(card),placement:placement(card)});}else if(root&&type!=='internal'){emit('ll_business_click',{...identity(root),action_type:type,link_domain:safeDomain(href,win.location.href)});}else if(/pricing\.html#contribute|become.*sponsor/i.test(href+' '+link.textContent)){emit('ll_sponsor_interest',{placement:link.closest('footer')?'footer':'page',link_domain:safeDomain(href,win.location.href)});}});
 doc.addEventListener('ll-businesses-updated',scan);doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='hidden'){doc.querySelectorAll('[data-ll-live-business],.ll-compact-card').forEach(c=>{win.clearTimeout(timers.get(c));timers.delete(c);});}else scan();});
 // Only observe profile/listing changes. Repeated render notifications are deduplicated.
 let queued=false;const mutation=new win.MutationObserver(()=>{if(!queued){queued=true;win.queueMicrotask(()=>{queued=false;scan();});}});mutation.observe(doc.body,{childList:true,subtree:true});
 const read=async path=>{const r=await win.fetch(new URL(path,import.meta.url));if(!r.ok)throw Error('Catalog unavailable');return r.json();};
 Promise.allSettled([read('./category-listings.json'),read('./live/business-routes.json')]).then(values=>{catalogReady=true;catalog=values[0].value||[];routes=values[1].value||{};catalog=catalog.map(e=>({...e,route:routes[e.business_id]||e.route}));scan();});
 scan();
}
if(typeof window!=='undefined')initBusinessAnalytics();
