import BlogTextEditor from './BlogTextEditor.jsx'
import {blogPreviewDocument,blogPlainText} from './lib/blog-content.mjs'
import {useEffect,useRef,useState} from 'react'
import {WORKSPACE_ID} from './lib/domain.js'
import {BLOG_BUCKET,BLOG_URL,blogPayload,blogSlug,blogState,mountainISO,mountainLabel,blogImageAlt} from './lib/blog.js'
import './blog.css'

export default function BlogManager({client,member,writable}) {
 const [posts,setPosts]=useState([]),[releases,setReleases]=useState([]),[post,setPost]=useState(null),[dirty,setDirty]=useState(false)
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(Boolean(client)),[filter,setFilter]=useState('All')
 const [scheduledTime,setScheduledTime]=useState(''),[image,setImage]=useState(null),[preview,setPreview]=useState(false),[approval,setApproval]=useState(null),[previewWidth,setPreviewWidth]=useState('desktop')
 const feedback=useRef(null)
 useEffect(()=>{if(error||notice)feedback.current?.focus()},[error,notice])
 const canEdit=writable&&member?.role!=='viewer'&&Boolean(client)
 async function load() {
  if(!client)return
  const [a,b]=await Promise.all([client.from('cc_blog_posts').select('*').eq('workspace_id',WORKSPACE_ID).order('updated_at',{ascending:false}),client.from('cc_blog_releases').select('id,post_id,published_at,source_revision').eq('workspace_id',WORKSPACE_ID).order('published_at',{ascending:false})])
  if(a.error||b.error)throw a.error||b.error
  setPosts(a.data);setReleases(b.data)
 }
 useEffect(()=>{let active=true;Promise.resolve().then(load).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false} /* client changes only on connection changes */
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[client])
 useEffect(()=>{let active=true;if(post?.image_path&&client)client.storage.from(BLOG_BUCKET).createSignedUrl(post.image_path,300).then(({data,error})=>{if(active){if(error)setError(error.message);else setImage({path:post.image_path,url:data.signedUrl})}});return()=>{active=false}},[client,post?.image_path])
 useEffect(()=>{if(!dirty)return;const warn=e=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty])
 function choose(next) {if(dirty&&!window.confirm('Discard unsaved changes to this post?'))return;setPost(next);setDirty(false);setScheduledTime('');setError('');setNotice('');setApproval(null);setPreview(false)}
 function change(key,value){setPost(p=>({...p,[key]:value}));setDirty(true);setApproval(null)}
 async function run(fn){setBusy(true);setError('');setNotice('');try{await fn()}catch(e){setError(e.message||'The action could not be completed.')}finally{setBusy(false)}}
 async function save() {
  const payload=blogPayload(post)
  if(payload.image_path)payload.image_alt=blogImageAlt(post)
  if(payload.body.length>100000)throw new Error('This post is too long. Shorten the text before saving.');
  if(!payload.slug||!/^([a-z0-9]+-)*[a-z0-9]+$/.test(payload.slug))throw new Error('Add a URL slug using lowercase letters, numbers, and hyphens.')
  let query=post.revision?client.from('cc_blog_posts').update(payload).eq('id',post.id).eq('revision',post.revision):client.from('cc_blog_posts').insert({...payload,id:post.id,workspace_id:WORKSPACE_ID})
  const {data,error}=await query.select().maybeSingle();if(error)throw error;if(!data)throw new Error('Another editor changed this post. Reload the saved draft before saving again.')
  setPost(data);setDirty(false);await load();setNotice('Draft saved. The public version has not changed.');return data
 }
 async function upload(file){
  if(!file)return
  await run(async()=>{if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8388608)throw new Error('Choose a JPG, PNG, or WebP image up to 8 MB.')
   const saved=dirty||!post.revision?await save():post
   const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=`${WORKSPACE_ID}/${saved.id}/${crypto.randomUUID()}.${ext}`
   const {error}=await client.storage.from(BLOG_BUCKET).upload(path,file,{contentType:file.type,upsert:false});if(error)throw error
   const {data,error:saveError}=await client.from('cc_blog_posts').update({image_path:path,image_alt:blogImageAlt({...saved,image_path:path})}).eq('id',saved.id).eq('revision',saved.revision).select().maybeSingle();if(saveError)throw saveError;if(!data)throw new Error('Image uploaded, but another editor changed the draft. Reload before attaching an image.')
   setPost(data);setDirty(false);await load();setNotice('Image uploaded and attached to this draft.')
  })
 }
 function prepare(action){setError('');try{if((dirty&&!['unpublish','cancel'].includes(action))||!post.revision)throw new Error('Save your draft before continuing.');let at=null;if(action==='schedule'){at=mountainISO(scheduledTime);if(Date.parse(at)<=Date.now())throw new Error('Choose a future publication time.')}if(['publish','schedule'].includes(action)&&(!post.title.trim()||!blogPlainText(post.body,document)))throw new Error('Add a title and post text before publishing.');setApproval({action,at})}catch(e){setError(e.message)}}
 async function publish(request=approval){await run(async()=>{
  if(!request)return
  if(['publish','schedule'].includes(request.action)&&(!post.title.trim()||!blogPlainText(post.body,document)))throw new Error('Add a title and post text before publishing.')
  const needsSave=['publish','schedule'].includes(request.action)&&(dirty||!post.revision||post.image_path&&!post.image_alt.trim())
  const saved=needsSave?await save():post
  setNotice('')
  const {error}=await client.rpc('cc_blog_publish',{p_post_id:saved.id,p_revision:saved.revision,p_action:request.action,p_publish_at:request.at});if(error)throw error
  await load();setApproval(null)
  setNotice(({publish:'Post published. It is now available on the public blog.',schedule:`Post scheduled for ${request.at?mountainLabel(request.at):''}. It will appear automatically.`,cancel:'Scheduled publication cancelled. Any current public version remains available.',unpublish:'Hidden from the website. Your post and image remain saved in Command Center; you can publish them again anytime.'})[request.action])
 })}
 const imageUrl=image?.path===post?.image_path?image?.url:''
 const state=post?blogState(releases,post.id):{}
 const displayed=posts.filter(p=>{const s=blogState(releases,p.id);return filter==='All'||filter==='Scheduled'&&s.scheduled||filter==='Published'&&s.live||filter==='Drafts'&&!s.live&&!s.scheduled})
 return <div className="blog-manager">
  <section className="card"><div className="section-head"><div><h2>MKT Visibility Blog</h2><p>Your free public blog on the MKT Visibility website. Write, preview, publish, or schedule posts in Mountain Time.</p></div><div className="actions"><a className="secondary" href={BLOG_URL} target="_blank" rel="noreferrer">View public blog ↗</a><button className="primary" disabled={!canEdit||busy} onClick={()=>choose({id:crypto.randomUUID(),slug:'',title:'',excerpt:'',body:'',author:member?.display_name||'MKT Visibility',image_path:null,image_alt:'',image_caption:''})}>＋ New post</button></div></div>{!client&&<p className="info">Sign in to your live workspace to manage blog posts. Publishing is unavailable in practice mode.</p>}</section>
  {!post&&error&&<div className="error" role="alert">{error}</div>}
  <div className={`blog-layout ${preview?'is-preview':''}`}><section className="card blog-list"><label>Show posts<select value={filter} onChange={e=>setFilter(e.target.value)}>{['All','Drafts','Scheduled','Published'].map(s=><option key={s}>{s}</option>)}</select></label><button className="text-button" disabled={busy||!client} onClick={()=>run(load)}>Refresh posts</button>{loading?<p>Loading posts…</p>:displayed.length?displayed.map(p=>{const s=blogState(releases,p.id);return <button key={p.id} className={`blog-post-choice ${post?.id===p.id?'selected':''}`} disabled={busy} onClick={()=>choose(p)}><strong>{p.title||'Untitled post'}</strong><span>{s.scheduled?'Scheduled':s.live?'Visible on website':'Hidden from website'}{s.live&&s.live.source_revision!==p.revision?' · Draft changes':''}</span><small>{s.scheduled?mountainLabel(s.scheduled.published_at):`Updated ${mountainLabel(p.updated_at)}`}</small></button>}):<p>No {filter==='All'?'blog':filter.toLowerCase()} posts yet. Create a post to get started.</p>}</section>
  {post?<section className="card blog-editor"><div className="section-head"><h2>{post.revision?'Edit post':'New post'}</h2><button className="secondary" disabled={busy} onClick={()=>setPreview(!preview)}>{preview?'Back to editor':'Preview on website'}</button></div>
  {state.live&&<p className="info">Published {mountainLabel(state.live.published_at)}. Draft edits remain private until you publish them.</p>}{state.scheduled&&<p className="info">A saved version is scheduled for {mountainLabel(state.scheduled.published_at)}. Further draft edits do not change that scheduled version. Schedule again to replace it.</p>}
  {preview?<div className="blog-website-preview"><div className="blog-preview-controls"><strong>Private website preview</strong><p>Shows your current edits, including unsaved changes. Only publishing or scheduling makes them public.</p><div className="actions"><button className="secondary" aria-pressed={previewWidth==='desktop'} onClick={()=>setPreviewWidth('desktop')}>Desktop</button><button className="secondary" aria-pressed={previewWidth==='mobile'} onClick={()=>setPreviewWidth('mobile')}>Mobile</button></div></div><iframe title="Website preview of blog post" sandbox="" className={`blog-preview-frame ${previewWidth}`} srcDoc={blogPreviewDocument({...post,published_at:state.scheduled?.published_at||state.live?.published_at,image_alt:blogImageAlt(post)},document,{imageUrl})}/></div>:<fieldset disabled={!canEdit||busy} className="blog-fields"><label>Title<input maxLength={200} value={post.title} onChange={e=>{const title=e.target.value;setPost(p=>({...p,title,slug:!p.revision&&(!p.slug||p.slug===blogSlug(p.title))?blogSlug(title):p.slug}));setDirty(true);setApproval(null)}}/></label><label>Post URL slug<input maxLength={120} disabled={Boolean(state.live||state.scheduled)} value={post.slug} onChange={e=>change('slug',e.target.value)}/><small>{BLOG_URL}?post={post.slug||'your-post-title'}</small></label><label>Author<input maxLength={120} value={post.author} onChange={e=>change('author',e.target.value)}/></label><BlogTextEditor key={post.id} value={post.body} onChange={body=>change('body',body)} disabled={!canEdit||busy}/><label>Featured image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const file=e.target.files[0];e.target.value='';upload(file)}}/><small>JPG, PNG, or WebP · up to 8 MB. Uploading saves the draft first.</small></label>{imageUrl&&<img className="blog-editor-image" src={imageUrl} alt={blogImageAlt(post)}/>}{post.image_path&&<><button className="text-button" onClick={()=>change('image_path',null)}>Remove image from draft</button><label>Image description (alt text)<input placeholder={blogImageAlt({...post,image_alt:''})} maxLength={300} value={post.image_alt} onChange={e=>change('image_alt',e.target.value)}/><small>Optional. If blank, the cover uses a description based on your post title.</small></label><label>Image caption / credit<input maxLength={500} value={post.image_caption} onChange={e=>change('image_caption',e.target.value)}/></label></>}</fieldset>}
  <div ref={feedback} tabIndex={-1} className="blog-action-feedback">{error&&<div className="error" role="alert">{error}</div>}{notice&&<div className="success" role="status">{notice}</div>}</div><div className="blog-visibility"><strong>{state.live?'Visible on website':state.scheduled?'Scheduled — not yet visible':'Hidden from website'}</strong><p>Unpublishing hides the post and cancels its schedule. Your saved post and image stay in Command Center, ready to publish again.</p>{state.live&&<a href={`${BLOG_URL}?post=${encodeURIComponent(post.slug)}`} target="_blank" rel="noreferrer">View published post ↗</a>}</div><div className="actions"><button className="primary" disabled={!canEdit||busy||!dirty&&Boolean(post.revision)} onClick={()=>run(save)}>{busy?'Working…':'Save draft'}</button>{dirty&&<span className="fine">Unsaved changes</span>}<button className="secondary" disabled={!canEdit||busy} onClick={()=>publish({action:'publish',at:null})}>{busy?'Working…':'Publish now'}</button>{post.revision&&<button className="secondary" disabled={!canEdit||busy||!state.live&&!state.scheduled} onClick={()=>prepare('unpublish')}>Unpublish — hide from website</button>}</div>
  <div className="blog-schedule"><label>Schedule publication — Mountain Time<input type="datetime-local" value={scheduledTime} disabled={!canEdit||busy} onChange={e=>{setScheduledTime(e.target.value);setApproval(null)}}/></label><small>Uses Denver daylight saving time. During the repeated fall hour, the first occurrence is used.</small><div className="actions"><button className="secondary" disabled={!canEdit||busy||dirty||!post.revision} onClick={()=>prepare('schedule')}>{state.scheduled?'Replace schedule':'Schedule post'}</button>{state.scheduled&&<button className="text-button" disabled={!canEdit||busy||dirty} onClick={()=>prepare('cancel')}>Cancel schedule</button>}</div></div>
  {approval&&<div className="blog-approval" role="region" aria-label="Confirm publication"><strong>{approval.action==='schedule'?`Publish this saved version automatically on ${mountainLabel(approval.at)}?`:approval.action==='publish'?'Publish this saved version to the public blog now?':approval.action==='unpublish'?'Hide this post from the website and cancel any schedule? Your saved post and image will remain in Command Center.':'Cancel the scheduled version of this post?'}</strong><p>{post.title}</p><div className="actions"><button className="primary" disabled={busy} onClick={()=>publish()}>Confirm {approval.action==='cancel'?'cancellation':approval.action==='unpublish'?'unpublish':approval.action==='schedule'?'schedule':'publication'}</button><button className="secondary" disabled={busy} onClick={()=>setApproval(null)}>Go back</button></div></div>}
  </section>:<section className="card"><h2>Your next story starts here.</h2><p>Select a post to edit, or create a new one. Drafts and future scheduled versions are visible only to your approved partners.</p></section>}</div>
 </div>
}
