import {useState,useMemo,useEffect} from 'react'
export default function BusinessPicker({businesses=[],value='',onChange,required=false,placeholder='Search businesses...'}) {
 const [query,setQuery]=useState('')
 const [open,setOpen]=useState(false)
 const selected=businesses.find(b=>String(b.id)===String(value))
 useEffect(()=>{if(!open)setQuery(selected?.name||'')},[value,selected?.name,open])
 const results=useMemo(()=>[...businesses].filter(b=>b.name?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true})).slice(0,30),[businesses,query])
 return <div className="business-picker" style={{position:'relative',width:'100%'}}>
 <input role="combobox" aria-label="Search businesses" aria-autocomplete="list" aria-expanded={open} autoComplete="off" placeholder={placeholder} value={query} onFocus={()=>{setOpen(true);setQuery('')}} onChange={e=>{setQuery(e.target.value);setOpen(true);if(value)onChange('')}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='Enter'&&open&&results.length){e.preventDefault();onChange(String(results[0].id));setQuery(results[0].name);setOpen(false)}}} onBlur={()=>setTimeout(()=>{setOpen(false);setQuery(current=>{const item=businesses.find(b=>String(b.id)===String(value));return item?.name||current})},150)} />
 {value&&<button type="button" aria-label="Clear business" onClick={()=>{onChange('');setQuery('');setOpen(true)}} style={{marginLeft:4}}>×</button>}
 {required&&<input type="text" tabIndex={-1} required value={value?'selected':''} onChange={()=>{}} style={{position:'absolute',width:1,height:1,opacity:0,pointerEvents:'none'}} />}
 {open&&<div role="listbox" style={{position:'absolute',zIndex:1000,top:'100%',left:0,right:0,maxHeight:240,overflowY:'auto',background:'var(--card,#fff)',color:'var(--text,#222)',border:'1px solid #aaa',borderRadius:6,boxShadow:'0 6px 20px #0002'}}>
 {!required&&<button type="button" style={{display:'block',width:'100%',textAlign:'left'}} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange('');setQuery('');setOpen(false)}}>No linked business</button>}
 {results.map(b=><button type="button" role="option" aria-selected={String(b.id)===String(value)} key={b.id} style={{display:'block',width:'100%',textAlign:'left',padding:'8px 10px'}} onMouseDown={e=>e.preventDefault()} onClick={()=>{onChange(String(b.id));setQuery(b.name);setOpen(false)}}>{b.name}</button>)}
 {!results.length&&<div style={{padding:10}}>No matching businesses</div>}
 </div>}
 </div>
}
