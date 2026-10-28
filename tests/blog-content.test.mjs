import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {RICH_PREFIX,blogContentHtml,richBlogBody,blogPlainText,blogArticleHtml,blogPreviewDocument,safeBlogLink} from '../src/lib/blog-content.mjs'
test('rich formatting is retained while scripts, unsafe links, external embeds and event handlers are removed',()=>{
 const {document}=new JSDOM('').window
 const body=richBlogBody('<h2>Heading</h2><p style="text-align:center;color:red" onclick="alert(1)"><b>Bold</b> <i>Italic</i> <u>Underlined</u></p><ol><li>First</li></ol><blockquote>A quote</blockquote><a href="javascript:alert(1)">Bad</a><a href="https://example.com" onmouseover="alert(1)">Good</a><script>alert(1)</script><img src=x onerror=alert(1)><iframe src="https://evil.test"></iframe>',document)
 const html=blogContentHtml(body,document)
 assert.ok(body.startsWith(RICH_PREFIX));assert.match(html,/<h2>Heading<\/h2>/);assert.match(html,/<b>Bold<\/b>/);assert.match(html,/<ol><li>First<\/li><\/ol>/);assert.match(html,/text-align: center/);assert.match(html,/color: red/);assert.doesNotMatch(html,/javascript:|onclick|onmouseover|onerror|<script|<img|<iframe/)
 assert.match(html,/href="https:\/\/example.com\/"/);assert.equal(safeBlogLink('data:text/html,x'),null)
 assert.match(blogPlainText(body,document),/HeadingBold/)
})
test('existing plain posts remain literal text and preview uses the identical sanitized article markup',()=>{
 const {document}=new JSDOM('').window
 assert.equal(blogContentHtml('First line\nnext line\n\n<script>literal</script>',document),'<p>First line<br>next line</p><p>&lt;script&gt;literal&lt;/script&gt;</p>')
 const post={title:'Preview <title>',author:'MKT',body:richBlogBody('<h2>Section</h2><p><b>Formatted</b> text</p>',document),excerpt:'Intro',published_at:'2026-10-28T12:00:00Z',image_alt:'Image',image_caption:'Photo credit'}
 const options={imageUrl:'https://example.com/image.png'},article=blogArticleHtml(post,document,options),preview=blogPreviewDocument(post,document,options)
 assert.ok(preview.includes(article));assert.match(article,/<b>Formatted<\/b>/);assert.match(article,/&lt;title&gt;/);assert.match(article,/Photo credit/)
 assert.equal(blogPlainText(richBlogBody('<p><br></p>',document),document),'')
})

test('font sizes, colors and families survive HTML and visual editor round trips',()=>{
 const {document}=new JSDOM('').window
 const html=blogContentHtml(richBlogBody('<p><font face="Georgia" size="5" color="#b71936"><b>Styled</b></font><span style="font-size:32px;color:#2458ab;font-family:Verdana;font-style:italic;background-image:url(https://bad.test/x)">More</span></p>',document),document)
 assert.match(html,/font-size: 24px/);assert.match(html,/font-family: Georgia/);assert.match(html,/color: rgb\(183, 25, 54\)/);assert.match(html,/font-size: 32px/);assert.match(html,/font-style: italic/);assert.doesNotMatch(html,/background|<font/)
 assert.equal(blogContentHtml(richBlogBody(html,document),document),html)
 const article=blogArticleHtml({title:'Post',body:richBlogBody(html,document),excerpt:'Do not show a separate introduction'},document)
 assert.doesNotMatch(article,/Do not show a separate introduction/)
})
test('first-line paragraph indentation toggles for selected paragraphs and survives saving',async()=>{
 const {indentBlogParagraphs}=await import('../src/lib/blog-content.mjs'),{document}=new JSDOM('<div id="editor"><p>First paragraph.</p><p>Second paragraph.</p></div>').window
 const root=document.querySelector('#editor'),range=document.createRange();range.selectNodeContents(root)
 assert.equal(indentBlogParagraphs(root,range),2)
 assert.ok([...root.querySelectorAll('p')].every(p=>p.style.textIndent==='2em'))
 assert.match(blogContentHtml(richBlogBody(root.innerHTML,document),document),/text-indent: 2em/)
 indentBlogParagraphs(root,range);assert.ok([...root.querySelectorAll('p')].every(p=>p.style.textIndent==='0px'))
})
test('uniform smaller text resets its paragraph size and line height, removing larger ancestor font struts',()=>{
 const {document}=new JSDOM('').window
 const html=blogContentHtml(richBlogBody('<p style="font-size:48px"><span style="font-size:32px"><font size="1">Small paragraph</font></span></p>',document),document)
 const root=document.createElement('div');root.innerHTML=html
 assert.equal(root.firstChild.style.fontSize,'12px');assert.equal(root.firstChild.style.lineHeight,'1.5')
 assert.equal(root.querySelectorAll('p [style*="font-size"]').length,0)
 assert.equal(blogContentHtml(richBlogBody(html,document),document),html)
})
test('cover image precedes the title, empty opening paragraphs are removed, and the preview has the homepage navigation',()=>{
 const {document}=new JSDOM('').window,post={title:'Cover story',body:richBlogBody('<p><br></p><div><br></div><p>Opening text</p>',document)}
 const article=blogArticleHtml(post,document,{imageUrl:'https://example.com/upload.jpg'})
 assert.ok(article.indexOf('<figure>')<article.indexOf('<h1>'));assert.match(article,/src="https:\/\/example.com\/upload.jpg"/)
 assert.match(article,/<div class="blog-body"><p>Opening text<\/p><\/div>/)
 const preview=blogPreviewDocument(post,document,{imageUrl:'https://example.com/upload.jpg'})
 for(const label of ['Services','Pricing','Why MKT','AI &amp; Automation','Blog','FAQ','Free Visibility Check'])assert.ok(preview.includes('>'+label+'<'))
 assert.match(preview,/MKT%20Visibility%20Logo.png/)
})
