// Shared by the public website and the Command Center preview.
export const RICH_PREFIX='<!--mkt-rich-text-v1-->'
export function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function safeBlogLink(value){try{const u=new URL(value);return ['https:','http:','mailto:'].includes(u.protocol)?u.href:null}catch{return null}}
const BLOG_FONT_PIXELS={'1':'12px','2':'14px','3':'16px','4':'18px','5':'24px','6':'32px','7':'48px'}
export function normalizeBlogParagraphSizes(root){
 for(const block of root.querySelectorAll('p,div,li,blockquote')){
  if(block.querySelector('p,div,li,blockquote'))continue
  const sizes=[],walker=root.ownerDocument.createTreeWalker(block,4)
  for(let text=walker.nextNode();text;text=walker.nextNode()){
   if(!text.textContent.trim())continue
   let el=text.parentElement,size='18px'
   while(el&&root.contains(el)){const found=el.style?.fontSize||(el.tagName==='FONT'?BLOG_FONT_PIXELS[el.getAttribute('size')]:null);if(found){size=found;break}if(el===block)break;el=el.parentElement}
   sizes.push(size)
  }
  if(sizes.length&&sizes.every(size=>size===sizes[0])&&(block.style.fontSize||block.querySelector('font[size],[style*="font-size"]'))){
   block.style.fontSize=sizes[0];block.style.lineHeight='1.5'
   for(const el of block.querySelectorAll('font[size],[style*="font-size"]')){el.style.removeProperty('font-size');el.removeAttribute('size')}
  }
 }
}
export function indentBlogParagraphs(root,range){
 const selector='p,div,li,blockquote,h2,h3'
 let blocks=[...root.querySelectorAll(selector)].filter(el=>!el.querySelector(selector)&&range.intersectsNode(el))
 if(range.collapsed){const start=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;const block=start.closest(selector);blocks=block&&root.contains(block)&&block!==root?[block]:[]}
 const remove=blocks.length>0&&blocks.every(el=>el.style.textIndent==='2em')
 for(const block of blocks)block.style.textIndent=remove?'0px':'2em'
 return blocks.length
}
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
   if(['P','DIV','LI','BLOCKQUOTE'].includes(node.tagName)&&['2em','0px'].includes(node.style.textIndent))target.style.textIndent=node.style.textIndent
   if(['1.5','1.6'].includes(node.style.lineHeight))target.style.lineHeight=node.style.lineHeight
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
 normalizeBlogParagraphSizes(out)
 function trimStart(parent){
  while(parent.firstChild&&((parent.firstChild.nodeType===3&&!parent.firstChild.textContent.trim())||(parent.firstChild.nodeType===1&&['P','DIV','BR'].includes(parent.firstChild.tagName)&&!parent.firstChild.textContent.trim())))parent.firstChild.remove()
  if(parent.firstElementChild?.tagName==='DIV')trimStart(parent.firstElementChild)
 }
 trimStart(out)
 return out.innerHTML
}
export function blogContentHtml(body,doc){
 if(String(body||'').startsWith(RICH_PREFIX))return sanitizeBlogHtml(body.slice(RICH_PREFIX.length),doc)
 return String(body||'').trim().split(/\n\s*\n/).map(p=>`<p>${escapeHtml(p).replaceAll('\n','<br>')}</p>`).join('')
}
export function richBlogBody(html,doc){return RICH_PREFIX+sanitizeBlogHtml(html,doc)}
export function blogPlainText(body,doc){const el=doc.createElement('div');el.innerHTML=blogContentHtml(body,doc);return el.textContent.trim()}
export const BLOG_ARTICLE_CSS=`.mkt-blog-article{font:18px/1.6 Arial,sans-serif;color:#18303f;max-width:820px;margin:24px auto 60px;padding:0;overflow-wrap:anywhere}.mkt-blog-article h1{font-size:clamp(34px,5vw,54px);line-height:1.12;color:#06243b;margin:16px 0 10px}.mkt-blog-article .byline{color:#637580;font-size:16px;line-height:1.4;margin:0 0 18px}.mkt-blog-article figure{margin:16px 0 22px}.mkt-blog-article img{display:block;width:100%;height:auto;border-radius:12px}.mkt-blog-article figcaption{font-size:13px;color:#637580;margin-top:7px}.mkt-blog-article .blog-body{white-space:normal;font:18px/1.6 Arial,sans-serif;color:#18303f;margin-top:0}.mkt-blog-article .blog-body p,.mkt-blog-article .blog-body div{margin:0 0 .85em}.mkt-blog-article .blog-body>:first-child{margin-top:0}.mkt-blog-article .blog-body h2{font-size:30px;line-height:1.25;color:#06243b;margin:1.2em 0 .5em}.mkt-blog-article .blog-body h3{font-size:24px;line-height:1.3;color:#06243b;margin:1.1em 0 .5em}.mkt-blog-article .blog-body ul,.mkt-blog-article .blog-body ol{padding-left:1.6em;margin:.85em 0}.mkt-blog-article .blog-body li{margin:.3em 0}.mkt-blog-article .blog-body blockquote{border-left:4px solid #2b850f;background:#edf5e9;padding:14px 22px;margin:1.2em 0}.mkt-blog-article a{color:#246d13;text-decoration:underline}.mkt-blog-article strong,.mkt-blog-article b{font-weight:700}@media(max-width:560px){.mkt-blog-article{margin-top:20px}.mkt-blog-article .blog-body{font-size:17px}}`
export const BLOG_HEADER_CSS=`header{position:sticky;top:0;z-index:10;background:#ffffffed;border-bottom:1px solid #dfe8e1;backdrop-filter:blur(10px)}header .wrap{max-width:1180px;margin:auto;padding:0 24px}header nav{height:78px;display:flex;align-items:center;justify-content:space-between;gap:20px}header .logo img{width:170px;display:block}header .links{display:flex;align-items:center;gap:23px}header .links a{color:#18303f;text-decoration:none;font-weight:700;font-size:14px}header .links .btn{display:inline-block;background:#2b850f;color:#fff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:7px}@media(max-width:850px){header .links a:not(.btn){display:none}}`
export const BLOG_HEADER_HTML=`<header><div class="wrap"><nav aria-label="Main navigation"><a class="logo" href="https://mktvisibility.github.io/website/index.html" aria-label="MKT Visibility home"><img src="https://mktvisibility.github.io/website/MKT%20Visibility%20Logo.png" alt="MKT Visibility"></a><div class="links"><a href="https://mktvisibility.github.io/website/index.html#services">Services</a><a href="https://mktvisibility.github.io/website/index.html#pricing">Pricing</a><a href="https://mktvisibility.github.io/website/index.html#why">Why MKT</a><a href="https://mktvisibility.github.io/website/ai-and-automation.html">AI &amp; Automation</a><a href="https://mktvisibility.github.io/website/blog.html" aria-current="page">Blog</a><a href="https://mktvisibility.github.io/website/index.html#faq">FAQ</a><a class="btn" href="https://mktvisibility.github.io/website/free-visibility-check.html">Free Visibility Check</a></div></nav></div></header>`
export function blogArticleHtml(post,doc,{imageUrl='',preview=false}={}){
 const date=post.published_at?new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'long',day:'numeric'}).format(new Date(post.published_at)):preview?'Publication date will appear here':''
 const image=imageUrl&&/^https:\/\//.test(imageUrl)?`<figure><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(post.image_alt)}">${post.image_caption?`<figcaption>${escapeHtml(post.image_caption)}</figcaption>`:''}</figure>`:''
 return `<a href="https://mktvisibility.github.io/website/blog.html">← All blog posts</a>${image}<h1>${escapeHtml(post.title||'Untitled post')}</h1><p class="byline">${escapeHtml(post.author||'MKT Visibility')}${date?' · '+escapeHtml(date):''}</p><div class="blog-body">${blogContentHtml(post.body,doc)}</div>`
}
export function blogPreviewDocument(post,doc,options={}){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:white;font-family:Arial,sans-serif}*{box-sizing:border-box}main{padding:0 24px}footer{padding:40px 24px;background:#031827;color:#b8c8cf;font-size:15px}footer div{max-width:1132px;margin:auto}${BLOG_HEADER_CSS}${BLOG_ARTICLE_CSS}</style></head><body>${BLOG_HEADER_HTML}<main><article class="mkt-blog-article">${blogArticleHtml(post,doc,{...options,preview:true})}</article></main><footer><div>MKT Visibility · We Keep Your Business Visible.</div></footer></body></html>`
}

export function prettyBlogHtml(body,doc){
 const root=doc.createElement('template');root.innerHTML=blogContentHtml(body,doc)
 const blocks=new Set(['P','DIV','H2','H3','UL','OL','LI','BLOCKQUOTE'])
 function format(node,depth){
  const pad='  '.repeat(depth)
  if(node.nodeType===3)return node.textContent.trim()?pad+escapeHtml(node.textContent.trim()):''
  if(node.nodeType!==1)return ''
  if(!blocks.has(node.tagName))return pad+node.outerHTML
  const shell=node.cloneNode(false).outerHTML,index=shell.lastIndexOf('</'),open=shell.slice(0,index),close=shell.slice(index)
  if([...node.children].some(child=>blocks.has(child.tagName)))return pad+open+'\n'+[...node.childNodes].map(child=>format(child,depth+1)).filter(Boolean).join('\n')+'\n'+pad+close
  return pad+open+'\n'+pad+'  '+node.innerHTML.trim()+'\n'+pad+close
 }
 return [...root.content.childNodes].map(node=>format(node,0)).filter(Boolean).join('\n\n')
}
