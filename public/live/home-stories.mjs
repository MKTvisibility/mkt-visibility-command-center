// This renderer receives public snapshots only. Record text is never treated as HTML.
const imageKeys=['logo','left','photo3'];
const imageURL=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
export function storyImages(content){
 const selected=new Set(content.home_story?.images||[]),gallery=(content.gallery||[]).filter(p=>p.enabled!==false);
 const options={logo:{url:content.image_url,alt:content.name+' logo'},left:gallery[0],photo3:gallery[1]};
 return imageKeys.filter(key=>selected.has(key)&&imageURL(options[key]?.url)).map(key=>({...options[key],url:imageURL(options[key].url),key}));
}
export function storyEligible(row,site='Loving Longmont'){
 return site==='Loving Longmont'&&row.active!==false&&(row.sites||['Loving Longmont']).includes(site)&&row.public_content?.home_story?.enabled===true&&Boolean(row.public_content.story?.trim());
}
export function renderHomeStory(doc,row){
 const b=row.public_content,article=doc.createElement('article');article.className='ll-home-story';article.dataset.storyBusiness=row.business_id||'';
 const add=(tag,text,cls)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n};
 const title=add('h3',b.name);article.append(title);
 const images=storyImages(b);
 if(images.length){const media=add('div',null,'ll-home-story-images');media.dataset.count=String(images.length);for(const p of images){const figure=add('figure',null,'ll-home-story-image ll-home-story-'+p.key),img=doc.createElement('img');img.src=p.url;img.alt=p.alt||b.name;img.loading='lazy';img.addEventListener('error',()=>figure.remove(),{once:true});figure.append(img);if(p.caption)figure.append(add('figcaption',p.caption));media.append(figure)}article.append(media)}
 const text=add('div',null,'ll-home-story-text');for(const paragraph of b.story.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean))text.append(add('p',paragraph));article.append(text);
 // Stable ID links also work before a newly named profile finishes deploying.
 const route=/^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(row.pageRoute||row.route||'')&&!(row.pageRoute||row.route).startsWith('business-')?(row.pageRoute||row.route):'business.html?id='+encodeURIComponent(row.business_id||'');
 const link=add('a','View full profile →','ll-home-story-profile');link.href=route;article.append(link);return article;
}
export function renderHomeStories(doc,rows,page,site='Loving Longmont'){
 const ids=new Set();if(page!=='index.html'||site!=='Loving Longmont')return ids;
 const root=doc.getElementById('home-business-stories');if(!root)return ids;
 root.replaceChildren();const selected=rows.filter(r=>storyEligible(r,site)).sort((a,b)=>(a.spotlight_order||0)-(b.spotlight_order||0)||String(b.published_at||'').localeCompare(String(a.published_at||''))||a.public_content.name.localeCompare(b.public_content.name));
 root.hidden=!selected.length;if(!selected.length)return ids;
 const heading=doc.createElement('h2');heading.textContent='Stories from Our Community';root.append(heading);
 for(const row of selected){root.append(renderHomeStory(doc,row));ids.add(row.business_id)}return ids;
}
