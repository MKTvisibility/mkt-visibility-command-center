import {publicSettings} from '../_shared/public-fields.mjs'
export const SITES = {
 'Loving Longmont':{repo:'MKTvisibility/LovingLongmont',host:'mktvisibility.github.io',basePath:'/LovingLongmont/',url:'https://mktvisibility.github.io/LovingLongmont/',secret:'CO_GITHUB_TOKEN'},
 'MKT Colorado':{repo:'MKTvisibility/Colorado',host:'mktcolorado.com',secret:'CO_GITHUB_TOKEN'}
}
export const escapeHtml=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#(?:39|x27);/gi,"'").replace(/&(?:rsquo|lsquo);/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
const normalize=s=>decode(s.replace(/<[^>]+>/g,'')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase()
export function validUrl(value){if(!value)return '';const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Use an http or https URL.');return u.href}
export function pageTarget(site,value){
 const config=SITES[site];if(!config)throw Error('Choose a supported website.')
 const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.port)throw Error('Page URL must belong to the selected website.')
 let pathname=decodeURIComponent(u.pathname);
 if(site==='Loving Longmont'){
  if(u.hostname==='mktvisibility.github.io'){
   if(!pathname.startsWith('/LovingLongmont/'))throw Error('Choose a page in the new Loving Longmont website.');pathname=pathname.slice('/LovingLongmont/'.length)
  }else if(['lovinglongmont.com','www.lovinglongmont.com'].includes(u.hostname))pathname=pathname.replace(/^\//,'');
  else if(u.hostname==='lovinglongmont.github.io'&&pathname.startsWith('/loving-longmont-website/'))pathname=pathname.slice('/loving-longmont-website/'.length);
  else throw Error('Page URL must belong to the selected website.')
 }else{
  if(!['www.'+config.host,config.host].includes(u.hostname))throw Error('Page URL must belong to the selected website.');pathname=pathname.replace(/^\//,'')
 }
 if(!/^[a-zA-Z0-9_-]+\.html$/.test(pathname))throw Error('Choose a top-level HTML listing page.')
 const section=decodeURIComponent(u.hash.slice(1));if(section&&!/^[a-zA-Z0-9_-]+$/.test(section))throw Error('Invalid page section.')
 const url=site==='Loving Longmont'?config.url+pathname+(section?'#'+section:''):u.href;
 return {path:pathname,section,url}
}
export function publicBusiness(b){
 if(!b.id||!b.name?.trim())throw Error('Save a business name before publishing.')
 const {options,gallery}=publicSettings(b);const fields=options.fields
 const imageUrl=value=>{const url=validUrl(value);if(url&&!url.startsWith('https:'))throw Error('Use an HTTPS image URL.');return url}
 return {id:b.id,name:b.name.trim(),description:fields.description?(b.description||''):'',address:fields.address?(b.address||b.city||''):'',phone:fields.phone?(b.phone||''):'',email:fields.email?(b.email||''):'',website:fields.website?validUrl(b.website):'',image_url:fields.image_url?imageUrl(b.image_url):'',categories:fields.categories?(b.categories||[]):[],social_urls:fields.social_urls?(b.social_urls||[]).map(validUrl).filter(Boolean):[],gallery_images:fields.gallery_images?gallery.map(imageUrl).filter(Boolean):[],listingTier:options.tier}
}
export function cardHtml(b,site,id,variant){
 if(site==='Loving Longmont'){
  const route='business.html?id='+encodeURIComponent(b.id);
  return `<article class="business-card" id="${escapeHtml(id||'cc-'+b.id)}" data-cc-business="${escapeHtml(b.id)}" data-ll-live-business="${escapeHtml(b.id)}" data-ll-placement="directory" data-business-category="${escapeHtml(b.categories.join(' · '))}">${b.image_url?`<div class="business-image"><a href="${route}" aria-label="${escapeHtml(b.name)}"><img src="${escapeHtml(b.image_url)}" alt="${escapeHtml(b.name)}" loading="lazy" /></a></div>`:''}<div class="business-body"><h3><a href="${route}">${escapeHtml(b.name)}</a></h3>${b.description?`<p class="business-description">${escapeHtml(b.description)}</p>`:''}<div class="business-links"><a class="business-button" href="${route}">View Business Page →</a></div></div></article>`
 }

 const ll=site==='Loving Longmont';const legacy=!ll&&variant==='business-card';const imageClass=ll?'business-image':legacy?'business-photo':'card-photo';const bodyClass=ll||legacy?'business-body':'card-body'
 const gallery=(b.gallery_images||[]).map((url,index)=>`<img src="${escapeHtml(url)}" alt="${escapeHtml(b.name)} — photo ${index+2}" loading="lazy" style="width:100%;height:180px;object-fit:contain" />`).join('')
 const links=[b.website&&[b.website,'Visit Website →'],...b.social_urls.map(u=>[u,new URL(u).hostname.replace(/^www\./,'')])].filter(Boolean).map(([u,label])=>`<a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" class="${ll?'business-button':''}">${escapeHtml(label)}</a>`).join(' ')
 return `<article class="${ll||legacy?'business-card':'card'}" id="${escapeHtml(id||'cc-'+b.id)}" data-cc-business="${escapeHtml(b.id)}">${b.image_url?`<div class="${imageClass}"><img src="${escapeHtml(b.image_url)}" alt="${escapeHtml(b.name)}" loading="lazy" style="width:100%;height:100%;object-fit:contain;object-position:center" /></div>`:ll?'':`<div class="name-panel"><span>${escapeHtml(b.name)}</span></div>`}<div class="${bodyClass}"><div class="${ll?'business-category':legacy?'business-type':'tag'}">${escapeHtml(b.categories.join(' • '))}</div><h3>${escapeHtml(b.name)}</h3><p class="${ll?'business-description':''}">${escapeHtml(b.description)}</p>${gallery?`<div class="listing-gallery">${gallery}</div>`:''}<div class="${ll?'business-details':legacy?'business-meta':'details'}">${b.address?`<div>📍 ${escapeHtml(b.address)}</div>`:''}${b.phone?`<div>☎ <a href="tel:${escapeHtml(b.phone.replace(/[^+\d]/g,''))}">${escapeHtml(b.phone)}</a></div>`:''}${b.email?`<div>✉ <a href="mailto:${escapeHtml(b.email)}">${escapeHtml(b.email)}</a></div>`:''}</div><div class="${ll||legacy?'business-links':'details'}">${links}</div></div></article>`
}
export function updatePage(html,b,site,target,action,aliases=[]){
 let count=0;const names=new Set([b.name,...aliases].map(normalize));const id=escapeHtml(b.id)
 const edits=[];const openings=/<(article|div)\b[^>]*>/gi;let opening
 while((opening=openings.exec(html))){
  if(edits.some(e=>opening.index<e.end&&opening.index>=e.start))continue
  const classes=opening[0].match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1].split(/\s+/)||[]
  if(!classes.includes('card')&&!classes.includes('business-card'))continue
  const tag=opening[1].toLowerCase();const tags=new RegExp(`<\\/?${tag}\\b[^>]*>`,'gi');tags.lastIndex=openings.lastIndex
  let depth=1,token,end=-1
  while((token=tags.exec(html))){depth+=token[0].startsWith('</')?-1:1;if(depth===0){end=tags.lastIndex;break}}
  if(end<0)continue
  const card=html.slice(opening.index,end);const heading=card.match(/<h[234]\b[^>]*>([\s\S]*?)<\/h[234]>/i)
  if(!card.includes(`data-cc-business="${id}"`)&&(!heading||!names.has(normalize(heading[1]))))continue
  count++;edits.push({start:opening.index,end,replacement:action==='remove'?'':cardHtml(b,site,opening[0].match(/\bid=["']([^"']+)["']/i)?.[1],classes.includes('business-card')?'business-card':'card')})
 }
 let next=html;for(const e of edits.reverse())next=next.slice(0,e.start)+e.replacement+next.slice(e.end)
 if(count)return {html:next,count}
 if(action==='remove')throw Error('No matching listing found on '+target.path+'. Review the saved page link and listing name.')
 if(!target.section)throw Error('For a new listing, enter its page URL with the category section, such as businesses.html#shops.')
 const section=new RegExp(`<section\\b[^>]*\\bid=["']${target.section}["'][^>]*>`,'i').exec(html)
 if(!section)throw Error('The selected category section was not found.')
 const sectionEnd=html.indexOf('</section>',section.index);const fragment=html.slice(section.index,sectionEnd)
 const grid=/<div\b[^>]*class=["'][^"']*\b(?:business-grid|grid)\b[^"']*["'][^>]*>/i.exec(fragment)
 if(!grid)throw Error('No supported listing grid found in that section.')
 const start=section.index+grid.index+grid[0].length;let depth=1;const tags=/<\/?div\b[^>]*>/gi;tags.lastIndex=start;let match
 while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0){if(match.index>sectionEnd)break;return {html:html.slice(0,match.index)+cardHtml(b,site,undefined,fragment.includes('business-card')?'business-card':'card')+'\n'+html.slice(match.index),count:1}}}
 throw Error('Listing grid could not be updated safely.')
}
export async function fingerprint(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('')}
