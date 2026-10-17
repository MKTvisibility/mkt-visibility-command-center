import {STORY_PAGES,storyPages} from './story-pages.mjs';
// This renderer receives public snapshots only. Record text is never treated as HTML.
const imageKeys=['logo','left','photo3'];
const imageURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
export function storyImages(content){
 const selected=new Set(content.home_story?.images||[]),gallery=(content.gallery||[]).filter(p=>p.enabled!==false);
 const options={logo:{url:content.image_url,alt:content.name+' logo'},left:gallery[0],photo3:gallery[1]};
 return imageKeys.filter(key=>selected.has(key)&&imageURL(options[key]?.url)).map(key=>({...options[key],url:imageURL(options[key].url),key}));
}
export function storyExcerpt(story,limit=420){const paragraph=String(story||'').trim().split(/\n\s*\n/).filter(Boolean)[0]||'';const text=paragraph.replace(/\s+/g,' ').trim();return text.length>limit?text.slice(0,limit-1).replace(/\s+\S*$/,'')+'…':text}
export function storyEligible(row,site='Loving Longmont',page='index.html'){
 return site==='Loving Longmont'&&row.active!==false&&(row.sites||['Loving Longmont']).includes(site)&&row.public_content?.home_story?.enabled===true&&Boolean(row.public_content.story?.trim())&&storyPages(row.public_content.home_story).includes(page);
}
export function renderHomeStory(doc,row){
 const b=row.public_content,article=doc.createElement('article');article.className='ll-home-story';article.dataset.storyBusiness=row.business_id||'';
 const add=(tag,text,cls)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
 const title=add('h3',b.name);article.append(title);
 const images=storyImages(b);
 if(images.length){const media=add('div',null,'ll-home-story-images');media.dataset.count=String(images.length);for(const p of images){const figure=add('figure',null,'ll-home-story-image ll-home-story-'+p.key),img=doc.createElement('img');img.src=p.url;img.alt=p.alt||b.name;img.loading='lazy';img.addEventListener('error',()=>figure.remove(),{once:true});figure.append(img);if(p.caption)figure.append(add('figcaption',p.caption));media.append(figure)}article.append(media)}
 const text=add('div',null,'ll-home-story-text');text.append(add('p',storyExcerpt(b.story)));article.append(text);
 // Stable ID links also work before a newly named profile finishes deploying.
 const route=/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(row.pageRoute||row.route||'')&&!(row.pageRoute||row.route).startsWith('business-')?(row.pageRoute||row.route):'business.html?id='+encodeURIComponent(row.business_id||'');
 const link=add('a','Read more →','ll-home-story-profile');link.href=route;article.append(link);return article;
}
export function renderHomeStories(doc,rows,page,site='Loving Longmont'){
 const ids=new Set();if(!STORY_PAGES.some(([route])=>route===page)||site!=='Loving Longmont')return ids;
 let root=doc.getElementById('home-business-stories');
 const selected=rows.filter(r=>storyEligible(r,site,page)).sort((a,b)=>(a.spotlight_order||0)-(b.spotlight_order||0)||String(b.published_at||'').localeCompare(String(a.published_at||''))||a.public_content.name.localeCompare(b.public_content.name));
 if(!root&&!selected.length)return ids;
 if(!root){root=doc.createElement('section');root.id='home-business-stories';root.className='ll-home-stories';root.setAttribute('aria-label','Local business and professional stories');const intro=doc.querySelector('main .intro,main .page-intro,main .media-hero,main .pricing-intro,.page-intro,.intro');if(intro&&!intro.closest('header'))intro.after(root);else if(doc.querySelector('main'))doc.querySelector('main').prepend(root);else doc.querySelector('footer')?.before(root);}
 if(!doc.querySelector('[data-story-preview-css]')){const css=doc.createElement('link');css.rel='stylesheet';css.href=new URL('./home-stories.css?v=20261017-previews',import.meta.url).href;css.dataset.storyPreviewCss='';doc.head.append(css);}
 root.replaceChildren();root.hidden=!selected.length;if(!selected.length)return ids;
 const heading=doc.createElement('h2');heading.textContent='Stories from Our Community';root.append(heading);const grid=doc.createElement('div');grid.className='ll-story-preview-grid';root.append(grid);
 for(const row of selected){grid.append(renderHomeStory(doc,row));ids.add(row.business_id)}return ids;
}
