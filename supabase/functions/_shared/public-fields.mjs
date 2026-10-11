export const PUBLIC_FIELDS = [
 ['name','Business name',false],['description','Description',false],['image_url','Main photo',false],['address','Address',false],['phone','Phone',false],['website','Website',false],
 ['email','Public email',true],['social_urls','Social media links',true],['categories','Category labels',true],['gallery_images','Additional photos',true]
]
export function sanitizePublicationOptions(value={}) {
 const tier=value?.tier==='Paid'?'Paid':'Free';const fields={}
 for(const [key,,paid] of PUBLIC_FIELDS)fields[key]=key==='name'?true:paid?(tier==='Paid'&&value?.fields?.[key]===true):(typeof value?.fields?.[key]==='boolean'?value.fields[key]:true)
 return {version:1,tier,fields}
}
export function publicSettings(business) {
 let m={};try{const parsed=JSON.parse(business.notes||'{}');if(parsed?.format==='mkt-portfolio-v1')m=parsed}catch{/* Legacy notes are internal text. */}
 return {options:sanitizePublicationOptions(m.publicationOptions),gallery:Array.isArray(m.listingGalleryUrls)?[...new Set(m.listingGalleryUrls.filter(v=>typeof v==='string'))].slice(0,4):[]}
}
