import {useState} from 'react'
import {discoveredBusinesses,discoveryOf,awaitingDiscoveryReview,discoveryReview} from './lib/discovery.js'
import {metadata} from './lib/portfolio.js'
export function DiscoverySummary({data,onOpen}) {
 const rows=discoveredBusinesses(data),pending=rows.filter(awaitingDiscoveryReview)
 return <section className="card"><button className="directory-link" onClick={onOpen}><div><strong>New businesses to review</strong><p>{pending.length} awaiting Michelle or Tim’s review · {rows.length} researched profiles created</p><small>Open the list, then select a business name to process its profile.</small></div><span aria-hidden="true">→</span></button></section>
}
export function DiscoveryList({data,onView,onClose}) {
 const [filter,setFilter]=useState('Pending review'),[search,setSearch]=useState('')
 const rows=discoveredBusinesses(data).filter(b=>(filter==='All'||discoveryOf(b).status===filter)&&`${b.name} ${b.city}`.toLowerCase().includes(search.toLowerCase()))
 return <section className="card"><div className="section-head"><h2>New businesses to review</h2><button className="secondary" onClick={onClose}>Back to dashboard</button></div><p>Researched by Nova or Hunter using public sources. AI-extracted details require human verification; missing information stays unknown. Michelle or Tim reviews each profile before publishing or outreach.</p><div className="actions"><label>Review status <select value={filter} onChange={e=>setFilter(e.target.value)}>{['Pending review','Reviewed','Not a match','All'].map(s=><option key={s}>{s}</option>)}</select></label><label>Find a business <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type a name or town"/></label></div>{rows.length?rows.map(b=><div className="report-line" key={b.id}><button className="text-button" onClick={()=>onView(b.id)}>{b.name}</button><span>{b.city} · {metadata(b).brand} · {discoveryOf(b).status}</span></div>):<p>No businesses in this view.</p>}</section>
}
export function DiscoveryReview({business,member,writable,onSave}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const d=discoveryOf(business)
 if(!d)return null
 async function change(status){setBusy(true);setError('');try{await onSave('businesses',discoveryReview(business,status,member.display_name))}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <section className="card"><h2>Discovery review: {d.status}</h2><p>Researched by {d.researcher||'Nova'} on {d.researchedOn}. Review by Michelle or Tim.</p>{awaitingDiscoveryReview(business)&&<p>Awaiting review before publishing a listing or preparing outreach.</p>}{d.verification&&<p>{d.verification}</p>}{d.uncertainties?.length>0&&<ul>{d.uncertainties.map((item,i)=><li key={i}>{item}</li>)}</ul>}{d.reviewedBy&&<p>Last review: {d.reviewedBy}</p>}<p>{d.reason}</p>{d.sources?.map(url=><p key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></p>)}{writable&&<div className="actions">{['Reviewed','Not a match','Pending review'].filter(s=>s!==d.status).map(s=><button className="secondary" disabled={busy} key={s} onClick={()=>change(s)}>{s==='Pending review'?'Return to review queue':s==='Reviewed'?'Mark reviewed':'Not a match'}</button>)}</div>}{error&&<p role="alert">{error}</p>}</section>
}
