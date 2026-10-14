import {safeUrl} from './domain.js'
import {metadata} from './portfolio.js'
export function reviewLinks(business,data,key,task,profile){
 const links=[],add=(label,url)=>{const safe=safeUrl(url);if(safe&&!links.some(l=>l.url===safe))links.push({label,url:safe})}
 const page=()=>{
  const sites=[...new Set(data.listings.filter(l=>l.business_id===business.id&&['Loving Longmont','MKT Colorado'].includes(l.site)).map(l=>l.site))]
  for(const site of sites){const base=site==='MKT Colorado'?'https://mktvisibility.github.io/Colorado/':'https://mktvisibility.github.io/LovingLongmont/';add(`Open ${site} page`,base+'business.html?id='+encodeURIComponent(business.id))}
 }
 if(['qa','description','image'].includes(key)){
  if(key==='image')add('Open image / logo',business.image_url)
  page()
 }else if(key?.startsWith('rating:')){
  const platform=key.slice(7);add('Open',profile?.approved?.platforms?.[platform]?.url||(platform==='Website'?business.website:''))
 }
 const saved=metadata(task||{}).pageUrl
 if(saved)add('Open task link',saved.replace('https://lovinglongmont.github.io/loving-longmont-website/','https://mktvisibility.github.io/LovingLongmont/'))
 return links
}
