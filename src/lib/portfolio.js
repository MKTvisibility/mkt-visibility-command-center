import { BRANDS } from './domain.js'
export const CHECKLIST = ['Create town page', 'Research and publish town history', 'Research and add business listings', 'Create postcard and header images', 'Create mug wrap artwork', 'Publish mug in pop-up shop', 'Publish mug in Etsy store', 'Add mug links to town page', 'Add pop-up mug link to town page', 'Add Etsy mug link to town page', 'Add Google Map', 'Review SEO, sources and mobile layout']
const metadataCache = new WeakMap()
export function metadata(record) {
  const cached = metadataCache.get(record)
  if (cached && cached.notes === record.notes) return cached.value
  try { const m = JSON.parse(record.notes || ''); if (m.format === 'mkt-portfolio-v1') { metadataCache.set(record,{notes:record.notes,value:m}); return m } } catch { /* legacy notes */ }
  return { text: record.notes || '' }
}
export const isTown = record => metadata(record).recordType === 'town'
export const isTownWork = record => isTown(record) || Boolean(normalizeTown(metadata(record).townKey))
export function encodeMetadata(record, changes = {}) {
  const m = {...metadata(record), ...changes, format:'mkt-portfolio-v1'}
  if (m.brand && !BRANDS.includes(m.brand)) throw new Error('Choose a valid business dashboard.')
  const notes = JSON.stringify(m)
  if (notes.length > 4000) throw new Error('Shorten the notes or town history to fit this record.')
  return notes
}
export function brandOf(record, data) {
  const explicit = metadata(record).brand
  if (explicit) return explicit
  if (record.site) return record.site
  if (record.brand) return record.brand
  const business = data.businesses.find(b => b.id === (record.business_id || record.id))
  const businessBrand = business && metadata(business).brand
  if (businessBrand) return businessBrand
  if (business && BRANDS.includes(business.name)) return business.name
  if (record.business_id) {
    const sites = [...new Set(data.listings.filter(l => l.business_id === record.business_id).map(l => l.site))]
    if (sites.length === 1) return sites[0]
  }
  // Existing client sales belong to the service business unless explicitly assigned.
  if (record.product || (record.name && record.kind)) return 'MKT Visibility'
  const text = `${record.title || ''} ${metadata(record).text || ''}`.toLowerCase()
  return BRANDS.find(b => text.includes(b.toLowerCase())) || ''
}
export function scopedData(data, brand) {
  const listings = data.listings.filter(r => r.site === brand)
  const ids = new Set(listings.map(l => l.business_id))
  const businesses = data.businesses.filter(b => brandOf(b,data) === brand || ids.has(b.id))
  return {...data, businesses, listings, tasks:data.tasks.filter(t => brandOf(t,data) === brand && !isTownWork(t)), purchases:data.purchases.filter(p => brandOf(p,data) === brand), statistics:data.statistics.filter(s => s.brand === brand), tracking:data.tracking.filter(t => t.brand === brand)}
}
export const normalizeTown = name => String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()
export function townProfiles(data) {
  const saved = data.tasks.filter(isTown)
  const names = new Map(saved.map(t => [normalizeTown(metadata(t).townName), t]))
  for (const l of data.listings.filter(l => l.site === 'MKT Colorado' && l.city?.trim())) {
    const name = l.city.trim(); const key = normalizeTown(name)
    if (!names.has(key)) names.set(key, {title:name, type:'Project',status:'Open',priority:'Normal',assignee:'Unassigned',notes:encodeMetadata({}, {recordType:'town', brand:'MKT Colorado',townName:name,pageUrl:l.url || '',text:''})})
  }
  return [...names.values()].sort((a,b) => metadata(a).townName.localeCompare(metadata(b).townName))
}
export const townKey = town => normalizeTown(metadata(town).townName)
export function townTasks(data,town) { return data.tasks.filter(t => !isTown(t) && normalizeTown(metadata(t).townKey) === townKey(town)) }
