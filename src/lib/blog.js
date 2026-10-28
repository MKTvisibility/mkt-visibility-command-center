export const BLOG_FIELDS = ['slug','title','excerpt','body','author','image_path','image_alt','image_caption']
export const BLOG_BUCKET = 'mkt-blog-images'
export const BLOG_URL = 'https://mktvisibility.github.io/website/blog.html'
export function blogSlug(value) { return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120).replace(/-$/,'') }
export function blogPayload(post) { return Object.fromEntries(BLOG_FIELDS.map(key=>[key,key==='image_path'?(post[key]||null):String(post[key]||'')])) }
export function mountainInput(date) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(date)).map(p=>[p.type,p.value]))
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}
export function mountainISO(value) {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Choose a date and time in Mountain Time.')
 // Validate both DST offsets. During the repeated fall hour choose the first occurrence.
 const candidates=['-06:00','-07:00'].map(offset=>new Date(`${value}:00${offset}`)).filter(date=>Number.isFinite(+date)&&mountainInput(date)===value).sort((a,b)=>a-b)
 if(!candidates.length)throw new Error('That Mountain Time does not exist because of daylight saving time. Choose another time.')
 return candidates[0].toISOString()
}
export function mountainLabel(value) {return new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',dateStyle:'medium',timeStyle:'short'}).format(new Date(value))+' Mountain Time'}
export function blogState(releases,postId,now=Date.now()) {
 const rows=releases.filter(r=>r.post_id===postId)
 return {live:rows.filter(r=>Date.parse(r.published_at)<=now).sort((a,b)=>Date.parse(b.published_at)-Date.parse(a.published_at))[0],scheduled:rows.filter(r=>Date.parse(r.published_at)>now).sort((a,b)=>Date.parse(a.published_at)-Date.parse(b.published_at))[0]}
}

export function blogImageAlt(post){return post.image_path?(post.image_alt?.trim()||`Cover image for: ${post.title||'MKT Visibility blog post'}`).slice(0,300):''}
