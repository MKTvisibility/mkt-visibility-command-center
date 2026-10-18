import {useEffect,useRef,useState} from 'react'
import {renderHomeStory} from './lib/home-stories.mjs'
import {STORY_PAGES,storyPages} from './lib/story-pages.mjs'
import './home-stories.css'
import {renderEventCalendar} from './lib/business-events.mjs'
import {renderProfile,renderBusinessCard,safeWebUrl} from './lib/live-profile-view.mjs'
import {metadata} from './lib/portfolio.js'
import './live-profile.css'
import {pageOf,sectionsFor,onPage,setPageSection,validPlacement} from './lib/section-placements.js'
import {suggestPageFilename,validPageFilename} from './lib/page-filename.js'
export const CONNECTED_BUSINESS_ID='fd5a893d-2fbf-4f5d-a82c-06d73752f5a1'
const FIELDS=[['description','Description'],['image_url','Logo above business name (right)'],['tagline','Tagline'],['photographer','Public contact name'],['service_area','Service area'],['address','Street address'],['phone','Phone'],['email','Email'],['website','Website'],['categories','Category labels'],['social_urls','Social links'],['story','Business story'],['services','Services'],['gallery','Main photo on the left and additional photos']]

const SITES=['Loving Longmont','MKT Colorado']
const DIRECTORY_BASES={'Loving Longmont':'https://mktvisibility.github.io/LovingLongmont/','MKT Colorado':'https://mktcolorado.com/'}
const ROWS=[
 ["Volunteer Opportunities","find-a-local-volunteer-opportunity.html",null],
 ["Museums & Historic Sites", "museums-historic-sites.html", null],
 ["Kids, Family Activities & Camps", "kids-family-activities.html", null],
 ["Event Venues & Group Experiences", "event-venues-group-experiences.html", null],
 ["Farm Visits & Seasonal Fun", "farm-visits-seasonal-fun.html", null],
 ["Recovery & Peer Support", "recovery-peer-support.html", null],
 ["Senior Services", "senior-services.html", null],
 ["Bakeries & Cottage Food", "bakeries-cottage-food.html", null],
 ["Vintage, Secondhand & Creative Reuse", "vintage-secondhand-creative-reuse.html", null],
 [
  "Animals & Pets",
  "animals.html",
  null
 ],
 [
  "Arts, Crafts & Makers",
  "arts-crafts-makers.html",
  "makers.html"
 ],
 [
  "Books, Comics & Games",
  "books-comics-games.html",
  null
 ],
 [
  "Business directory",
  "businesses.html",
  "businesses.html"
 ],
 [
  "Classes & Learning",
  "classes-learning.html",
  null
 ],
 [
  "Community & Volunteering",
  "community.html",
  null
 ],
 [
  "Events",
  "events.html",
  "events.html"
 ],
 [
  "Faith & Spirituality",
  "faith-spirituality.html",
  null
 ],
 [
  "Farms & Local Essentials",
  "farms-local-essentials.html",
  null
 ],
 [
  "Food & Drink",
  "food-drink.html",
  "food-drink.html"
 ],
 [
  "Food Assistance & Basic Needs",
  "food-assistance-basic-needs.html",
  null
 ],
 [
  "Health & Wellness",
  "health-wellness.html",
  null
 ],
 [
  "History & Historic Places",
  "history.html",
  null
 ],
 [
  "Home, Garden & Gifts",
  "home-garden-gifts.html",
  null
 ],
 [
  "Homepage",
  "index.html",
  "index.html"
 ],
 [
  "In the Spotlight",
  "spotlight.html",
  "spotlight.html"
 ],
 [
  "Jobs, Careers & Training",
  "jobs.html",
  null
 ],
 [
  "Music & Entertainment",
  "music-entertainment.html",
  null
 ],
 [
  "Outdoor Recreation & Adventure",
  "outdoor-recreation-adventure.html",
  null
 ],
 [
  "Professional & Business Services",
  "professional-business-services.html",
  null
 ],
 [
  "Shopping & Specialty Stores",
  "shopping-specialty-stores.html",
  null
 ],
 [
  "Sports, Fitness & Recreation",
  "sports-fitness-equipment.html",
  null
 ],
 [
  "Things to Do & Family Fun",
  "things-to-do.html",
  "things-to-do.html"
 ]
]
const isLongmont=city=>/^longmont(,? (co|colorado))?$/i.test(String(city||'').trim())
function normalizePlacements(settings,city){
 const sites=(settings.sites||['Loving Longmont']).filter(site=>site!=='Loving Longmont'||isLongmont(city))
 const site_placements=Object.fromEntries(SITES.map((site,i)=>[site,((settings.site_placements||{})[site]||[...(settings.directory?['businesses.html']:[]),...(settings.spotlight_pages||[])]).filter(route=>validPlacement(site,route,ROWS.map(row=>row[i+1]).filter(Boolean)))]))
 return {...settings,sites:sites.length?sites:['MKT Colorado'],site_placements}
}
const B_FIELDS=['name','description','phone','email','address','city','website','image_url','categories','social_urls']
const businessFields=b=>Object.fromEntries(B_FIELDS.map(k=>[k,b[k]??(['categories','social_urls'].includes(k)?[]:'')]))
const lines=s=>s.split(/\n/)
function StoryPreview({content}){const ref=useRef(null);useEffect(()=>{ref.current.replaceChildren();if(content?.home_story?.enabled&&content.story)ref.current.append(renderHomeStory(ref.current.ownerDocument,{business_id:content.id||'preview',public_content:content}))},[content]);return <div className="lp-home-story-preview" ref={ref}/> }
function PagePreview({content}){const ref=useRef(null),cardRef=useRef(null);useEffect(()=>{renderProfile(ref.current,content);if(cardRef.current){cardRef.current.replaceChildren();if(content)cardRef.current.append(renderBusinessCard(cardRef.current.ownerDocument,{business_id:'preview',route:'business.html',public_content:content},'spotlight'))}},[content]);return <div className="lp-preview"><h4>Directory card preview</h4><div className="lp-directory-preview" ref={cardRef}/><h4>Individual business page</h4><div className="bp-main" ref={ref}/></div>}

function BusinessTrafficReport({business,repository}){
 const [start,setStart]=useState(''),[end,setEnd]=useState(()=>{const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());return new Date(new Date(today+'T12:00:00Z').getTime()-86400000).toISOString().slice(0,10)}),[baseline,setBaseline]=useState(null),[report,setReport]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{let active=true;if(repository?.businessListingDate)repository.businessListingDate(business.id).then(value=>{if(active){setBaseline(value);if(value)setStart(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value.first_listed_at)))}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[business.id,repository])
 if(!repository?.businessTrafficReport)return null
 const run=async()=>{setBusy(true);setError('');setReport(null);try{setReport(await repository.businessTrafficReport(business.id,start,end))}catch(e){setError(e.message)}finally{setBusy(false)}}
 const number=value=>value===null||value===undefined?'Not available':Number(value).toLocaleString()
 const downloadPdf=()=>{
  if(!report)return
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))
  const n=value=>value==null?'Not available':Number(value).toLocaleString('en-US')
  const date=value=>{if(!value)return 'Not available';const d=new Date(value+'T12:00:00');return Number.isNaN(d.getTime())?String(value):d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
  const profileVisitors=report.profile?.[0],profileViews=report.profile?.[1],siteVisitors=report.site?.[0],siteViews=report.site?.[1]
  const measured=profileVisitors!=null&&profileViews!=null
  const rows=[['Clicks to your website',report.actions?.website],['Phone-link clicks',report.actions?.phone],['Email-link clicks',report.actions?.email],['Social-link clicks',report.actions?.social],['Visible listing impressions',report.exposure?.ll_listing_impression],['Profile opens from listing cards',report.exposure?.ll_profile_open]]
  const popup=window.open('','_blank')
  if(!popup){setError('Please allow pop-ups for Command Center to open the PDF-ready report.');return}
  popup.opener=null
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(report.business.name)} | Loving Longmont Visibility Report</title><style>
  @page{size:letter;margin:0.52in}*{box-sizing:border-box}body{margin:0;background:#fff;color:#233136;font:13px/1.4 Arial,Helvetica,sans-serif}.sheet{max-width:860px;margin:auto}.mast{background:#202e32;color:#fff;border-radius:5px;padding:11px 15px;display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:800;letter-spacing:1.6px}.mast strong{color:#d6a62e}.mast small{font-size:10px;letter-spacing:.3px}.heading{display:flex;justify-content:space-between;gap:24px;margin:15px 0}.heading h1{font-size:32px;line-height:1.1;margin:0 0 5px}.heading p{color:#75868d;margin:4px 0}.date{text-align:right;white-space:nowrap}.date strong{display:block}.early{border:1px solid #e5d3a0;border-left:4px solid #dca31b;background:#fbf6e8;border-radius:5px;padding:12px 14px;display:flex;gap:18px;margin:16px 0}.early strong{color:#987016;font-size:10px;letter-spacing:1.5px;white-space:nowrap}.section{color:#087f74;text-transform:uppercase;letter-spacing:1.7px;font-weight:800;font-size:11px;margin:17px 0 8px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.stat{border:1px solid #d5e1e1;border-radius:6px;padding:13px;background:#f0f7f6}.stat:nth-child(n+3){background:#fff}.stat label{display:block;font-size:10px;letter-spacing:1.4px;color:#6a8089;font-weight:800;text-transform:uppercase}.stat b{font-size:35px;display:block;color:#087f74;margin:6px 0}.stat:nth-child(n+3) b{color:#233136}.stat span{font-size:11px;color:#72838b}.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.box{border:1px solid #d3e0df;border-radius:6px;padding:13px;background:#f0f7f6}.box:nth-child(2){background:#fff}.box h3{font-size:14px;margin:0 0 8px}.box p{margin:0;color:#475b61}.metrics{width:100%;border-collapse:collapse}.metrics th{background:#202e32;color:white;text-align:left;padding:9px 12px;font-size:10px;letter-spacing:1px;text-transform:uppercase}.metrics th:last-child,.metrics td:last-child{text-align:right}.metrics td{padding:8px 12px;border-bottom:1px solid #e5eceb}.foot{font-size:10px;color:#667a80;margin-top:16px}.print{margin:20px auto;text-align:center}.print button{background:#087f74;color:white;border:0;border-radius:5px;padding:11px 20px;cursor:pointer}@media print{.print{display:none}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{max-width:none}.box,.stat,.early{break-inside:avoid}}
  </style></head><body><div class="sheet"><div class="mast"><span>MKT <strong>VISIBILITY</strong></span><small>LOVING LONGMONT&nbsp; | &nbsp;CLIENT VISIBILITY REPORT</small></div><div class="heading"><div><h1>${escapeHtml(report.business.name)}</h1><p>Your business presence on Loving Longmont</p><p>Reporting period based on available listing and analytics data.</p></div><div class="date"><strong>${escapeHtml(date(report.range.start))} – ${escapeHtml(date(report.range.end))}</strong><p>Prepared ${escapeHtml(new Date(report.generatedAt||Date.now()).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}))}</p></div></div>
  <div class="early"><strong>EARLY RESULTS</strong><span>${measured?`Your profile recorded <b>${n(profileVisitors)} active users</b> and <b>${n(profileViews)} page views</b> during this reporting window.`:'Profile traffic data is not yet available for this period.'} These visibility figures do not establish inquiries, customers, or sales.</span></div>
  <div class="section">Your business profile &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Loving Longmont audience</div><div class="stats"><div class="stat"><label>Profile visitors</label><b>${n(profileVisitors)}</b><span>GA4 active users</span></div><div class="stat"><label>Profile views</label><b>${n(profileViews)}</b><span>Includes repeat views</span></div><div class="stat"><label>Website visitors</label><b>${n(siteVisitors)}</b><span>Whole-site active users</span></div><div class="stat"><label>Website views</label><b>${n(siteViews)}</b><span>Whole-site page views</span></div></div><p style="color:#73858a;font-size:11px;margin:9px 0">Audience context only: whole-site visitors did not necessarily view your business profile.</p>
  <div class="section">What this report tells you</div><div class="cols"><div class="box"><h3>Your profile is receiving attention</h3><p>${measured?`${n(profileVisitors)} active users and ${n(profileViews)} views provide a starting point for measuring your listing over time.`:'Profile activity will be measurable when analytics data is available.'} This is a baseline, not a growth comparison.</p></div><div class="box"><h3>More insight in the next report</h3><p>Future reports can combine profile traffic with recorded listing exposure and contact-link activity as the tracking collects data.</p></div></div>
  <div class="section">Contact actions &amp; listing exposure</div><table class="metrics"><thead><tr><th>Measurement</th><th>Recorded count</th></tr></thead><tbody>${rows.map(([label,value])=>`<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(n(value))}</td></tr>`).join('')}</tbody></table>
  <div class="foot"><strong>Sources and limitations:</strong> Google Analytics 4 and available Loving Longmont tracking. Values may be unavailable where measurement has not started. ${(report.notes||[]).map(escapeHtml).join(' ')}</div></div><div class="print"><button onclick="window.print()">Save as PDF / Print report</button><p>In the print dialog, choose <b>Save as PDF</b> as the destination.</p></div></body></html>`
  popup.document.open();popup.document.write(html);popup.document.close();popup.focus()
 }

 return <details className="lp-edit-group"><summary>Business traffic &amp; sponsorship report</summary><p>Run a Google Analytics report from this business’s first known listing date, or choose a shorter period. Whole-site visitors and this business’s profile visitors are shown separately.</p>{baseline&&<p className="fine">First known listing: {new Date(baseline.first_listed_at).toLocaleDateString('en-US',{timeZone:'America/Denver'})}. {baseline.source==='repository_first_mention'?'Based on earliest available website revision evidence; an earlier listing may be unknown.':'Based on the earliest available recorded publication.'}</p>}<div className="form-grid"><label>Report start<input type="date" value={start} max={end} onChange={e=>{setStart(e.target.value);setReport(null)}}/></label><label>Report end (through yesterday)<input type="date" value={end} onChange={e=>{setEnd(e.target.value);setReport(null)}}/></label></div><button type="button" className="secondary" disabled={busy||!start||!end} onClick={run}>{busy?'Loading business report…':'Run business report'}</button>{error&&<p role="alert" className="error">{error}</p>}{report&&<section aria-label="Business traffic report"><h4>{report.business.name} · {report.range.start} – {report.range.end}</h4><div className="table-wrap"><table><thead><tr><th>Measurement</th><th>Result</th></tr></thead><tbody>{[['Whole website visitors — audience context',report.site[0]],['Visitors to this business’s profile',report.profile[0]],['Views of this business’s profile',report.profile[1]],['Visible listing impressions',report.exposure?.ll_listing_impression],['Profile opens from listing cards',report.exposure?.ll_profile_open],['Clicks to their website',report.actions?.website],['Phone-link clicks',report.actions?.phone],['Email-link clicks',report.actions?.email],['Social-link clicks',report.actions?.social]].map(([label,value])=><tr key={label}><td>{label}</td><td>{number(value)}</td></tr>)}</tbody></table></div><button type="button" className="secondary" onClick={downloadPdf}>Download business report PDF</button><details><summary>Report sources and limitations</summary><p>Source: Google Analytics · Generated {new Date(report.generatedAt).toLocaleString()}</p>{report.notes.map(note=><p className="fine" key={note}>{note}</p>)}</details></section>}</details>
}

function EventsPreview({events,name}){const ref=useRef(null);useEffect(()=>{renderEventCalendar(ref.current,events,{name})},[events,name]);return <div ref={ref}/>}
function BusinessEventsEditor({business,repository,writable}){
 const [draft,setDraft]=useState(null),[saved,setSaved]=useState(null),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[selected,setSelected]=useState('')
 useEffect(()=>{let active=true;if(repository?.loadBusinessEvents)repository.loadBusinessEvents(business.id).then(d=>{if(active){setDraft(d);setSaved(d)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[business.id,repository])
 if(!repository?.loadBusinessEvents)return null
 const act=async fn=>{setBusy(true);setError('');setNotice('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}}
 const dirty=JSON.stringify(draft)!==JSON.stringify(saved)
 const change=(id,key,value)=>{setDraft(d=>({...d,events:d.events.map(e=>e.id===id?{...e,[key]:value}:e)}));setPreview(null);setNotice('')}
 const save=async()=>{const d=await repository.saveBusinessEvents(business.id,draft.events,draft.version);setDraft(d);setSaved(d);setPreview(null);setNotice('Event draft saved privately. Preview and publish to update the website.');return d}
 const e=draft?.events.find(e=>e.id===selected)
 return <details className="lp-edit-group"><summary>Events &amp; calendar</summary><p>Add public events to this business’s own calendar. Select Spotlight to also include an event on Loving Longmont’s Events page. Past events hide automatically. Events publish separately from story edits.</p>{!draft&&!error&&<p>Loading events…</p>}{draft&&<fieldset disabled={!writable||busy}><label>Saved events<select aria-label="Saved events" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose an event ({draft.events.length})</option>{[...draft.events].sort((a,b)=>a.start_date.localeCompare(b.start_date)).map(e=><option key={e.id} value={e.id}>{e.start_date} · {e.title||'Untitled event'}{e.enabled?'':' (hidden)'}</option>)}</select></label><button type="button" className="secondary" disabled={draft.events.length>=300} onClick={()=>{const id=crypto.randomUUID();setDraft(d=>({...d,events:[...d.events,{id,title:'',description:'',start_date:'',end_date:'',start_time:'',end_time:'',time_note:'',location:'',cost:'',url:'',image_url:'',image_alt:'',enabled:true,spotlight:false}]}));setSelected(id);setPreview(null)}}>Add event</button>{e&&<div className="form-grid">{[['title','Event title','text'],['start_date','Start date','date'],['end_date','End date','date'],['start_time','Start time (Mountain)','time'],['end_time','End time (Mountain)','time'],['time_note','Time details (optional override)','text'],['location','Location','text'],['cost','Cost / admission','text'],['url','Event details / ticket link','url'],['image_url','Event image URL','url'],['image_alt','Image description','text']].map(([key,label,type])=><label key={key}>{label}<input type={type} value={e[key]||''} maxLength={key.endsWith('url')?5000:key==='location'?500:300} onChange={x=>{change(e.id,key,x.target.value);if(key==='start_date'&&!e.end_date)change(e.id,'end_date',x.target.value)}}/></label>)}<label className="span-two">Event description<textarea value={e.description||''} maxLength={2000} rows={4} onChange={x=>change(e.id,'description',x.target.value)}/></label>{safeWebUrl(e.image_url)&&<img className="lp-image" src={e.image_url} alt={e.image_alt||'Event preview'}/>}<label>Upload event image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={x=>{const file=x.target.files?.[0];if(file)act(async()=>{const url=await repository.uploadListingImage(business.id,file);change(e.id,'image_url',url);setNotice('Image added to event. Save and preview before publishing.')});x.target.value=''}}/></label><label className="check"><input type="checkbox" checked={e.enabled} onChange={x=>change(e.id,'enabled',x.target.checked)}/>Show on business calendar</label><label className="check"><input type="checkbox" checked={e.spotlight} onChange={x=>change(e.id,'spotlight',x.target.checked)}/>Spotlight on Events Page</label><button type="button" className="text-button" onClick={()=>{setDraft(d=>({...d,events:d.events.filter(x=>x.id!==e.id)}));setSelected('');setPreview(null)}}>Remove event</button></div>}<div className="actions"><button type="button" className="secondary" disabled={!dirty} onClick={()=>act(save)}>Save event draft</button><button type="button" className="primary" onClick={()=>act(async()=>{if(dirty||!draft.version)await save();setPreview(await repository.previewBusinessEvents(business.id))})}>Preview events</button></div></fieldset>}{preview&&<section aria-label="Events publication preview"><EventsPreview events={preview.events} name={preview.name}/><p>{preview.events.filter(e=>e.spotlight).length} events selected for the Events page. Hidden events are excluded.</p><button type="button" className="primary" disabled={!writable||busy||dirty} onClick={()=>act(async()=>{await repository.publishBusinessEvents(business.id,preview.signature);setPreview(null);setNotice('Events published to the business calendar and selected Events page spotlights.')})}>Publish events</button></section>}{busy&&<p role="status">Working on events…</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}</details>
}

export default function LiveBusinessPage({business,repository,writable,onBusinessSaved}){
 const [loaded,setLoaded]=useState(false),[profile,setProfile]=useState(null),[publication,setPublication]=useState(null),[draft,setDraft]=useState(null),[saved,setSaved]=useState(null),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 useEffect(()=>{let mounted=true;if(!repository?.loadLivePage){return}repository.loadLivePage(business.id).then(result=>{if(!mounted)return;if(result){const value={business:businessFields(business),settings:result.profile.settings,businessVersion:business.updated_at};setProfile(result.profile);setPublication(result.publication);const filename=metadata(business).pageFilename||result.profile.route;const savedValue={...value,settings:{...normalizePlacements(value.settings,business.city),page_filename:filename}};setSaved(savedValue);setDraft({...savedValue,settings:{...normalizePlacements(savedValue.settings,business.city),page_filename:result.profile.route.startsWith('business-')&&!metadata(business).pageFilename?suggestPageFilename(business.name):filename}})}setLoaded(true)}).catch(e=>{if(mounted){setError(e.message);setLoaded(true)}});return()=>{mounted=false}},[business,repository])
 if(!repository?.loadLivePage)return <section className="info"><p>Live-page editing is available in your signed-in workspace.</p></section>
 if(!loaded)return <section className="info"><p>Loading live business-page editor…</p></section>
 if(!profile)return <section className="info"><h3>Live business page</h3><p role={error?'alert':undefined}>{error||'The live page editor is not configured yet.'}</p></section>
 const dirty=JSON.stringify(draft)!==JSON.stringify(saved),settings=draft.settings,record=draft.business
 const change=(group,key,value)=>{setDraft(d=>{const next={...d,[group]:{...d[group],[key]:value}};if(group==='business'&&key==='city')next.settings=normalizePlacements(next.settings,value);return next});setPreview(null);setNotice('')}
 const setPhoto=(index,key,value)=>change('settings','gallery',settings.gallery.map((p,i)=>i===index?{...p,[key]:value}:p))
 const movePhoto=(index,step)=>{const gallery=[...settings.gallery];[gallery[index],gallery[index+step]]=[gallery[index+step],gallery[index]];change('settings','gallery',gallery)}
 async function act(fn){setBusy(true);setError('');setNotice('');try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function save(value=draft){value={...value,settings:normalizePlacements(value.settings,value.business.city)};if(!validPageFilename(value.settings.page_filename))throw Error('Use a page filename such as recovery-cafe-longmont.html.');if(!value.business.name.trim())throw Error('Enter the business name.');for(const url of [value.business.image_url,...value.settings.gallery.map(p=>p.url)].filter(Boolean))if(!safeWebUrl(url)||!url.startsWith('https://'))throw Error('Use HTTPS image URLs.');const result=await repository.saveLivePage(business.id,{...value.business,categories:value.business.categories.map(s=>s.trim()).filter(Boolean),social_urls:value.business.social_urls.map(s=>s.trim()).filter(Boolean)},{...value.settings,services:value.settings.services.map(s=>s.trim()).filter(Boolean)},value.businessVersion,profile.updated_at);const next={business:businessFields(result.business),settings:{...normalizePlacements(result.profile.settings,result.business.city),page_filename:result.pageFilename||metadata(result.business).pageFilename||result.profile.route},businessVersion:result.business.updated_at};setProfile(result.profile);setDraft(next);setSaved(next);setPreview(null);onBusinessSaved?.(result.business);setNotice('Draft saved privately. Preview it before publishing.')}
 async function showPreview(){if(dirty)await save();setPreview(await repository.previewLivePage(business.id))}
 async function retryNamedPage(){const result=await repository.ensureBusinessPage(business.id);setNotice((result.results||[]).map(r=>r.success?`${r.site}: named page created. Wait for hosting to finish; email preparation will verify the link.`:`${r.site}: named page creation failed: ${r.error}`).join('\n'))}
 async function publish(){if(!preview||dirty)throw Error('Save and preview before publishing.');const result=await repository.publishLivePage(business.id,preview.signature);setPublication(result);setPreview(null);setNotice(!result.active?'Unpublished. Saved business details and images are retained.':result.pageCreation?.results?.length?result.pageCreation.results.map(r=>r.success?`${r.site}: business information published; named page created and hosting deployment is pending.`:`${r.site}: business information published, but named page creation failed: ${r.error} Use Open published profile below.`).join('\n'):'Published to the live business page. Named page creation could not be confirmed. Use Open published profile below.')}
 async function upload(files,main=false){if(!main&&settings.gallery.length+files.length>4)throw Error('Use up to four photos.');const photos=[];for(const file of files){const url=await repository.uploadListingImage(business.id,file);photos.push({url,alt:'',caption:'',enabled:true})}const value=main?{...draft,business:{...draft.business,image_url:photos[0].url}}:{...draft,settings:{...draft.settings,gallery:[...draft.settings.gallery,...photos]}};setDraft(value);setPreview(null);try{await save(value);setNotice('Image uploaded and saved to this client’s private draft. Preview and publish to update the live page.')}catch(e){throw Error('Image uploaded, but the draft could not be saved: '+e.message+' Your image URL is retained in this editor. Save the draft before leaving.',{cause:e})}}

 const namedRoute=metadata(business).pageFilename||publication?.route||profile.route
 const liveLinks=(settings.sites||['Loving Longmont']).map(site=>{const base=site==='MKT Colorado'?'https://mktvisibility.github.io/Colorado/':'https://mktvisibility.github.io/LovingLongmont/';const generic=namedRoute.startsWith('business-');return {site,url:base+(generic?'business.html?id='+business.id:namedRoute)}})

 return <section className="card lp-editor" aria-label="Live business page editor"><div className="section-head"><div><h3>Edit & publish the live business page</h3><p>Save a private draft, preview the public page, then publish.</p><a href={liveLinks.find(l=>l.site===(isLongmont(record.city)?'Loving Longmont':'MKT Colorado'))?.url||liveLinks[0]?.url} target="_blank" rel="noreferrer">Open published profile ↗</a></div><div>{liveLinks.map(({site,url})=><p key={site}><a href={url} target="_blank" rel="noreferrer">Open {site} page ↗</a></p>)}</div></div>{publication?.active&&repository.ensureBusinessPage&&<button type="button" className="secondary" disabled={busy||dirty||!writable} onClick={()=>act(retryNamedPage)}>Retry named page creation</button>}{publication&&<p className="fine">Last published: {new Date(publication.published_at).toLocaleString()} · Version {publication.revision}</p>}<BusinessTrafficReport key={business.id} business={business} repository={repository}/>{!writable&&<p>Only approved editors can save or publish changes.</p>}<fieldset disabled={!writable||busy} className="lp-fields"><details className="lp-edit-group"><summary>Page content & business story</summary><div className="form-grid"><label className="span-two">Business page filename<input value={settings.page_filename||''} maxLength={100} onChange={e=>change('settings','page_filename',e.target.value.toLowerCase())} placeholder="recovery-cafe-longmont.html"/><small>Choose once before your first publication. Use lowercase letters, numbers and hyphens, ending in .html. Existing page names cannot be reused. Older published page links continue to identify this business.</small></label><label>Business name<input value={record.name} maxLength={200} onChange={e=>change('business','name',e.target.value)}/></label><label>Tagline<input value={settings.tagline||''} maxLength={300} onChange={e=>change('settings','tagline',e.target.value)}/></label><label className="span-two">Short description<textarea value={record.description} maxLength={2000} rows={3} onChange={e=>change('business','description',e.target.value)}/></label><label>Public contact name<input value={settings.photographer||''} maxLength={300} onChange={e=>change('settings','photographer',e.target.value)}/></label><label>Service area<input value={settings.service_area||''} maxLength={300} onChange={e=>change('settings','service_area',e.target.value)}/></label><label>Phone<input value={record.phone} onChange={e=>change('business','phone',e.target.value)}/></label><label>Email<input type="email" value={record.email} onChange={e=>change('business','email',e.target.value)}/></label><label>Website<input type="url" value={record.website} onChange={e=>change('business','website',e.target.value)}/></label><label>Town / city<input value={record.city||''} onChange={e=>change('business','city',e.target.value)}/></label><label>Saved street address<input value={record.address} onChange={e=>change('business','address',e.target.value)}/><small>Displayed only when Street address is checked below.</small></label><label>Categories<textarea rows={2} value={record.categories.join('\n')} onChange={e=>change('business','categories',lines(e.target.value))}/><small>One category per line.</small></label><label>Social links<textarea rows={2} value={record.social_urls.join('\n')} onChange={e=>change('business','social_urls',lines(e.target.value))}/><small>One account URL per line.</small></label><label className="span-two">Business story<textarea value={settings.story||''} maxLength={5000} rows={6} onChange={e=>change('settings','story',e.target.value)}/></label><label className="span-two">Services<textarea rows={4} value={(settings.services||[]).join('\n')} onChange={e=>change('settings','services',lines(e.target.value))}/><small>One service per line.</small></label><label className="span-two">Logo URL — above business name (right)<input type="url" value={record.image_url} onChange={e=>change('business','image_url',e.target.value)}/></label><p className="fine span-two">Logo placement: above the business name on the right. This is separate from the main photo on the left.</p></div></details><BusinessEventsEditor key={business.id} business={business} repository={repository} writable={writable}/><details className="lp-edit-group"><summary>Images & logo</summary>{safeWebUrl(record.image_url)&&<img className="lp-image" src={record.image_url} alt="Logo preview — above business name"/>}<label className="secondary upload-image">Upload logo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const files=[...(e.target.files||[])];if(files.length)act(()=>upload(files,true));e.target.value=''}}/></label><h4>Main photo on the left &amp; additional photos</h4><p className="fine">Placement 1: the first checked photo appears on the left of the business name and fills the directory thumbnail. If no main photo is visible, the directory shows a decorative business-name placeholder. Placement 2: the logo above appears above the name on the right. Other checked photos appear below the story. Uncheck the visibility controls to hide either area.</p>{settings.gallery.map((p,i)=><div className="lp-photo" key={i}><div>{safeWebUrl(p.url)&&<img className="lp-image" src={p.url} alt={p.alt||'Gallery preview'}/>}</div><div><label>{i===0?'Main photo URL — left side':`Additional photo ${i+1} URL`}<input type="url" value={p.url} onChange={e=>setPhoto(i,'url',e.target.value)}/></label><label>Photo {i+1} description<input value={p.alt||''} maxLength={300} onChange={e=>setPhoto(i,'alt',e.target.value)}/></label><label>Photo {i+1} caption<input value={p.caption||''} maxLength={500} onChange={e=>setPhoto(i,'caption',e.target.value)}/></label><label className="check"><input type="checkbox" checked={p.enabled!==false} onChange={e=>setPhoto(i,'enabled',e.target.checked)}/>Show photo {i+1}{i===0?' — main photo on the left':' — next visible photo or gallery'}</label><div className="actions"><button type="button" className="secondary" disabled={i===0} onClick={()=>movePhoto(i,-1)}>Move photo {i+1} up</button><button type="button" className="secondary" disabled={i===settings.gallery.length-1} onClick={()=>movePhoto(i,1)}>Move photo {i+1} down</button><button type="button" className="text-button" onClick={()=>change('settings','gallery',settings.gallery.filter((_,n)=>n!==i))}>Remove photo {i+1}</button></div></div></div>)}<div className="actions"><button type="button" className="secondary" disabled={settings.gallery.length>=4} onClick={()=>change('settings','gallery',[...settings.gallery,{url:'',alt:'',caption:'',enabled:true}])}>Add photo URL</button><label className="secondary upload-image">Upload main / additional photos<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={settings.gallery.length>=4} onChange={e=>{const files=[...(e.target.files||[])];if(files.length)act(()=>upload(files));e.target.value=''}}/></label></div></details><details className="lp-edit-group"><summary>What visitors can see</summary><div className="public-field-grid">{FIELDS.map(([key,label])=><label className="check" key={key}><input type="checkbox" checked={settings.fields[key]===true} onChange={e=>change('settings','fields',{...settings.fields,[key]:e.target.checked})}/>Show {label}</label>)}</div>{record.social_urls.filter(safeWebUrl).map(url=><label className="check" key={url}><input type="checkbox" checked={settings.social_visibility?.[url]!==false} onChange={e=>change('settings','social_visibility',{...settings.social_visibility,[url]:e.target.checked})}/>Show {url}</label>)}</details><details className="lp-edit-group" open><summary>Business or professional story highlights</summary><p>Feature a one-paragraph preview of this profile’s Business story on the pages you select. Cards appear three across, with a Read more button linking to the full individual profile.</p><label className="check"><input type="checkbox" aria-label="Enable story highlights" disabled={!isLongmont(record.city)} checked={settings.home_story?.enabled===true} onChange={e=>{const enabled=e.target.checked;setDraft(d=>({...d,settings:{...d.settings,home_story:{images:[],pages:['index.html'],...d.settings.home_story,enabled},fields:{...d.settings.fields,...enabled?{story:true}:{}},sites:enabled?[...new Set([...(d.settings.sites||[]),'Loving Longmont'])]:d.settings.sites,active:enabled?true:d.settings.active}}));setPreview(null);setNotice('')}}/>Enable story highlights</label>{!isLongmont(record.city)&&<p className="fine">A verified Longmont city is required for Loving Longmont placement.</p>}<p className="fine">Choose any combination, all three, or no images for a text-only story. Photo choices follow the first and second visible photos in Images &amp; logo. Only the first paragraph is previewed (up to 420 characters); the full story stays on the individual profile.</p><fieldset className="lp-story-page-choices" disabled={!settings.home_story?.enabled||!isLongmont(record.city)}><legend>Pages for this story highlight</legend><div className="public-field-grid">{STORY_PAGES.map(([page,label])=><label className="check" key={page}><input type="checkbox" aria-label={'Highlight story on '+label} checked={storyPages(settings.home_story).includes(page)} onChange={e=>{const pages=storyPages(settings.home_story).filter(p=>p!==page);if(e.target.checked)pages.push(page);change('settings','home_story',{enabled:false,images:[],...settings.home_story,pages})}}/>{label}</label>)}</div></fieldset><div className="lp-story-image-choices">{[['logo','Logo',settings.fields.image_url===true?record.image_url:''],['left','Left image',settings.fields.gallery===true?settings.gallery.filter(p=>p.enabled!==false)[0]?.url:''],['photo3','Third image (additional photo)',settings.fields.gallery===true?settings.gallery.filter(p=>p.enabled!==false)[1]?.url:'']].map(([key,label,url])=><label key={key}>{safeWebUrl(url)&&<img src={url} alt={label+' selection preview'}/>}<span><input type="checkbox" aria-label={'Use '+label+' in story highlight'} disabled={!safeWebUrl(url)&&!(settings.home_story?.images||[]).includes(key)} checked={(settings.home_story?.images||[]).includes(key)} onChange={e=>{const images=(settings.home_story?.images||[]).filter(k=>k!==key);if(e.target.checked)images.push(key);change('settings','home_story',{enabled:false,...settings.home_story,images})}}/> {label}</span>{!safeWebUrl(url)&&<small>Add and show this image in Images &amp; logo / What visitors can see to select it.</small>}</label>)}</div></details><details className="lp-edit-group" open><summary>Websites, directory pages & spotlights</summary><h4>Where it appears</h4><p className="fine">For a story preview card, use the Business or professional story highlights section above. The Homepage row below controls a regular business listing.</p><p className="fine">On Loving Longmont’s Events page, choose “Event Venues &amp; Party Planning” to feature this business as a venue or party service. Month sections place a business card in that month; dated events use the Events &amp; calendar box above.</p><p className="fine">Select a page, then choose its section when available. Page links stay available when unchecked. Grey boxes indicate an unavailable page or a business outside Longmont.</p>{!isLongmont(record.city)&&<p className="info">{record.city?'This business is outside Longmont and can only appear on MKT Colorado.':'Enter a verified Longmont city to enable Loving Longmont.'}</p>}<div className="table-wrap"><table><thead><tr><th scope="col">Page / directory / category</th><th scope="col">Loving Longmont</th><th scope="col">MKT Colorado</th></tr></thead><tbody><tr><th scope="row">Individual business page</th>{SITES.map(site=><td key={site}><label className="check" style={{opacity:site==='Loving Longmont'&&!isLongmont(record.city)?0.45:1}}><input type="checkbox" aria-label={`Publish individual page on ${site}`} disabled={site==='Loving Longmont'&&!isLongmont(record.city)} checked={settings.active&&(settings.sites||[]).includes(site)} onChange={e=>{const sites=e.target.checked?[...new Set([...(settings.sites||[]),site])]:(settings.sites||[]).filter(s=>s!==site);setDraft(d=>({...d,settings:{...d.settings,sites,active:sites.length>0}}));setPreview(null)}}/>Publish</label><a href={DIRECTORY_BASES[site]+(namedRoute.startsWith('business-')?'business.html?id='+business.id:namedRoute)} target="_blank" rel="noopener noreferrer">View page ↗</a></td>)}</tr>{ROWS.map(([label,...routes])=><tr key={label}><th scope="row">{label}</th>{SITES.map((site,i)=>{const route=routes[i],eligible=site!=='Loving Longmont'||isLongmont(record.city),available=Boolean(route)&&eligible;return <td key={site}><label className="check" style={{opacity:available?1:0.45}}><input type="checkbox" aria-label={`Include ${label} on ${site}`} disabled={!available} checked={available&&(settings.sites||[]).includes(site)&&onPage(settings.site_placements?.[site],route)} onChange={e=>{const placements=settings.site_placements||{},selected=placements[site]||[];const site_placements={...placements,[site]:e.target.checked?(onPage(selected,route)?selected:setPageSection(selected,route)):setPageSection(selected,route,null)};setDraft(d=>({...d,settings:{...d.settings,site_placements,sites:e.target.checked?[...new Set([...(d.settings.sites||[]),site])]:d.settings.sites,directory:Object.values(site_placements).some(p=>p.includes('businesses.html')),spotlight_pages:[...new Set(Object.values(site_placements).flat().map(pageOf))],active:e.target.checked?true:d.settings.active}}));setPreview(null);setNotice('')}}/>{available?'Include':route?'Outside Longmont':'Page unavailable'}</label>{available&&onPage(settings.site_placements?.[site],route)&&sectionsFor(site,route).length>0&&<label className="lp-section-choice">Where on this page<select aria-label={`Section for ${label} on ${site}`} value={(settings.site_placements?.[site]||[]).find(p=>pageOf(p)===route)?.split('#')[1]||''} onChange={e=>{const site_placements={...settings.site_placements,[site]:setPageSection(settings.site_placements?.[site],route,e.target.value)};change('settings','site_placements',site_placements)}}><option value="">{site==='Loving Longmont'&&route==='events.html'?'Event Venues & Party Planning':'General business spotlights'}</option>{sectionsFor(site,route).map(section=><option key={section.id} value={section.id}>{section.label}</option>)}</select><small>The card links to this business’s individual page.</small></label>}{route&&<a href={DIRECTORY_BASES[site]+route} target="_blank" rel="noopener noreferrer">View page ↗</a>}</td>})}</tr>)}</tbody></table></div><p className="fine">Loving Longmont category listings display alphabetically by business name.</p></details><div className="actions"><button type="button" className="secondary" disabled={!dirty} onClick={()=>act(save)}>Save live-page draft</button><button type="button" className="primary" onClick={()=>act(showPreview)}>Preview live business page</button></div></fieldset>{dirty&&<p className="fine">Changes are not live. Preview saves your draft automatically; publish after reviewing it.</p>}{preview&&<section aria-label="Live publication preview"><h4>Public page preview</h4>{!preview.active&&<p>This will unpublish the page and its placements. Saved information is retained.</p>}<PagePreview content={preview.active?preview.public_content:null}/>{preview.active&&preview.public_content?.home_story?.enabled&&<section aria-label="Story card preview"><h4>Story card preview</h4><StoryPreview content={preview.public_content}/></section>}<div className="actions"><button className="primary" disabled={!writable||busy||dirty} onClick={()=>act(publish)}>{preview.active?'Publish live business page':'Confirm unpublish'}</button><button className="secondary" disabled={busy} onClick={()=>setPreview(null)}>Close preview</button></div></section>}{busy&&<p role="status">Working…</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}</section>
}

