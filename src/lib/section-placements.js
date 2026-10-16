import {PAGE_SECTIONS as sections} from './page-sections.mjs'
export const pageOf=placement=>String(placement||'').split('#')[0]
export const sectionsFor=(site,page)=>sections[site]?.[page]||[]
export const onPage=(placements,page)=>(placements||[]).some(p=>pageOf(p)===page)
export function setPageSection(placements,page,section=''){
 const next=(placements||[]).filter(p=>pageOf(p)!==page)
 if(section!==null)next.push(page+(section?'#'+section:''))
 return [...new Set(next)]
}
export function validPlacement(site,route,pages){
 const [page,anchor,...extra]=String(route).split('#')
 return pages.includes(page)&&extra.length===0&&(!anchor||sectionsFor(site,page).some(s=>s.id===anchor))
}
