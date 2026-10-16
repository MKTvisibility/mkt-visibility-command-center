import {PAGE_SECTIONS} from './page-sections.mjs';
export const placementPage=value=>String(value||'').split('#')[0];
export function renderSectionPlacements(doc,rows,page,site,renderCard){
 const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const supported=PAGE_SECTIONS[site]?.[page]||[];const placed=new Set();
 for(const row of rows){
  if(!row.active||!(row.sites||['Loving Longmont']).includes(site))continue;
  const targets=(row.site_placements?.[site]||[]).filter(p=>placementPage(p)===page&&p.includes('#'));
  const sections=[...new Set(targets.map(p=>p.split('#')[1]))].filter(id=>supported.some(s=>s.id===id)).map(id=>doc.getElementById(id)).filter(Boolean);
  if(!sections.length)continue;
  // A section placement replaces the former static card and any old general spotlight.
  for(const card of doc.querySelectorAll('.gig-card,.site-card,.resource-card,.business-card,.ll-connected-card,.ll-staffing-card,.ll-compact-card')){
   if(card.dataset.llLiveBusiness===row.business_id||normalize(card.querySelector('h3,h4')?.textContent)===normalize(row.public_content?.name))card.remove();
  }
  for(const section of sections){
   let grid=section.querySelector('.gig-grid,.site-grid,.resource-grid,.business-grid,.ll-connected-grid,.grid,.activity-grid,.history-grid,.places-grid,.community-grid,.support-grid,.event-grid,.project-grid,.photo-grid,.option-grid,.help-grid');
   if(!grid){grid=doc.createElement('div');grid.className='ll-connected-grid';section.append(grid)}
   grid.append(renderCard(doc,row,'spotlight'));
  }
  placed.add(row.business_id);
 }
 return placed;
}
