// Shared by the public website and the Command Center preview.
export const RICH_PREFIX='<!--mkt-rich-text-v1-->'
export function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function safeBlogLink(value){try{const u=new URL(value);return ['https:','http:','mailto:'].includes(u.protocol)?u.href:null}catch{return null}}
export function sanitizeBlogHtml(html,doc){
 const source=doc.createElement('template');source.innerHTML=String(html)
 const out=doc.createElement('div'),allowed=new Set(['P','DIV','BR','STRONG','B','EM','I','U','S','H2','H3','UL','OL','LI','BLOCKQUOTE','A','SPAN','FONT'])
 function copy(node,parent){
  if(node.nodeType===3){parent.append(doc.createTextNode(node.textContent));return}
  if(node.nodeType!==1)return
  if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','TEMPLATE'].includes(node.tagName))return
  let target=parent
  if(allowed.has(node.tagName)){
   target=doc.createElement(node.tagName==='FONT'?'span':node.tagName.toLowerCase())
   if(node.tagName==='A'){const href=safeBlogLink(node.getAttribute('href'));if(href){target.setAttribute('href',href);target.setAttribute('rel','noopener noreferrer');target.setAttribute('target','_blank')}}
   if(['P','DIV','H2','H3','LI','BLOCKQUOTE'].includes(node.tagName)&&['left','center','right'].includes(node.style.textAlign))target.style.textAlign=node.style.textAlign
   const size=node.style.fontSize||(node.tagName==='FONT'?({'1':'12px','2':'14px','3':'16px','4':'18px','5':'24px','6':'32px','7':'48px'}[node.getAttribute('size')]):'')
   if(/^(?:1[0-9]|[2-6][0-9]|7[0-2])px$/.test(size))target.style.fontSize=size
   const color=node.style.color||(node.tagName==='FONT'?node.getAttribute('color'):'')
   if(color&&/^(?:#[a-f0-9]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i.test(color))target.style.color=color
   const family=(node.style.fontFamily||(node.tagName==='FONT'?node.getAttribute('face'):'')||'').replace(/["']/g,'').trim()
   if(['Arial','Georgia','Verdana','Times New Roman','Courier New'].includes(family))target.style.fontFamily=family
   if(['bold','700','800','900'].includes(node.style.fontWeight))target.style.fontWeight='bold'
   if(node.style.fontStyle==='italic')target.style.fontStyle='italic'
   if(['underline','line-through'].includes(node.style.textDecorationLine))target.style.textDecorationLine=node.style.textDecorationLine
   parent.append(target)
  }
  for(const child of node.childNodes)copy(child,target)
 }
 for(const child of source.content.childNodes)copy(child,out)
 return out.innerHTML
}
export function blogContentHtml(body,doc){
 if(String(body||'').startsWith(RICH_PREFIX))return sanitizeBlogHtml(body.slice(RICH_PREFIX.length),doc)
 return String(body||'').split(/\n\s*\n/).map(p=>`<p>${escapeHtml(p).replaceAll('\n','<br>')}</p>`).join('')
}
export function richBlogBody(html,doc){return RICH_PREFIX+sanitizeBlogHtml(html,doc)}
export function blogPlainText(body,doc){const el=doc.createElement('div');el.innerHTML=blogContentHtml(body,doc);return el.textContent.trim()}
export const BLOG_ARTICLE_CSS=`.mkt-blog-article{font:18px/1.9 Arial,sans-serif;color:#18303f;max-width:820px;margin:45px auto 75px;padding:0;overflow-wrap:anywhere}.mkt-blog-article h1{font-size:clamp(34px,5vw,54px);line-height:1.12;color:#06243b;margin:24px 0}.mkt-blog-article .byline{color:#637580;font-size:16px}.mkt-blog-article figure{margin:35px 0}.mkt-blog-article img{max-width:100%;height:auto;border-radius:12px}.mkt-blog-article figcaption{font-size:13px;color:#637580;margin-top:7px}.mkt-blog-article .blog-intro{font-size:22px;line-height:1.65;color:#637580}.mkt-blog-article .blog-body{white-space:normal;font:18px/1.9 Arial,sans-serif;color:#18303f}.mkt-blog-article .blog-body p,.mkt-blog-article .blog-body div{margin:0 0 1em}.mkt-blog-article .blog-body h2{font-size:30px;line-height:1.25;color:#06243b;margin:1.4em 0 .6em}.mkt-blog-article .blog-body h3{font-size:24px;line-height:1.3;color:#06243b;margin:1.3em 0 .6em}.mkt-blog-article .blog-body ul,.mkt-blog-article .blog-body ol{padding-left:1.6em;margin:1em 0}.mkt-blog-article .blog-body li{margin:.4em 0}.mkt-blog-article .blog-body blockquote{border-left:4px solid #2b850f;background:#edf5e9;padding:14px 22px;margin:1.5em 0}.mkt-blog-article a{color:#246d13;text-decoration:underline}.mkt-blog-article strong,.mkt-blog-article b{font-weight:700}@media(max-width:560px){.mkt-blog-article{margin-top:28px}.mkt-blog-article .blog-body{font-size:17px}}`
export function blogArticleHtml(post,doc,{imageUrl='',preview=false}={}){
 const date=post.published_at?new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'long',day:'numeric'}).format(new Date(post.published_at)):preview?'Publication date will appear here':''
 const image=imageUrl&&/^https:\/\//.test(imageUrl)?`<figure><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(post.image_alt)}">${post.image_caption?`<figcaption>${escapeHtml(post.image_caption)}</figcaption>`:''}</figure>`:''
 return `<a href="https://mktvisibility.github.io/website/blog.html">← All blog posts</a><h1>${escapeHtml(post.title||'Untitled post')}</h1><p class="byline">${escapeHtml(post.author||'MKT Visibility')}${date?' · '+escapeHtml(date):''}</p>${image}<div class="blog-body">${blogContentHtml(post.body,doc)}</div>`
}
export function blogPreviewDocument(post,doc,options={}){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:white;font-family:Arial,sans-serif}*{box-sizing:border-box}header{border-bottom:1px solid #dfe8e1;padding:23px 24px}.nav{max-width:1132px;margin:auto;display:flex;justify-content:space-between;align-items:center;gap:20px;color:#06243b}.brand{font-size:24px;font-weight:900}.brand span{color:#2b850f}.nav small{font-size:14px}main{padding:0 24px}footer{padding:40px 24px;background:#031827;color:#b8c8cf;font-size:15px}footer div{max-width:1132px;margin:auto}${BLOG_ARTICLE_CSS}</style></head><body><header><div class="nav"><div class="brand">MKT <span>VISIBILITY</span></div><small>Blog</small></div></header><main><article class="mkt-blog-article">${blogArticleHtml(post,doc,{...options,preview:true})}</article></main><footer><div>MKT Visibility · We Keep Your Business Visible.</div></footer></body></html>`
}
