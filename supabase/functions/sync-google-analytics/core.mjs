export const WORKSPACE = 'c8748032-cdd3-443b-8c56-2e846cc9bf31'
export const PROPERTIES = Object.freeze({
  'Loving Longmont': '558375784', 'MKT Colorado': '558329947',
  'MKT Visibility': '558367806', 'Open Theory Cove': '558417742',
  'Boulder County Photography': '558429449',
})
const GA_METRICS = ['activeUsers', 'screenPageViews', 'sessions']
const LABELS = ['Visitors', 'Page views', 'Sessions']
export function dateRange(now = new Date(), timezone = 'America/Denver') {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now)
  const part = kind => parts.find(p => p.type === kind).value
  const day = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  const end = day.toISOString().slice(0,10)
  day.setUTCDate(day.getUTCDate() - 6)
  return {start:day.toISOString().slice(0,10),end,timezone}
}
export function values(report) {
  if (!report || !Array.isArray(report.metricHeaders) || GA_METRICS.some((m,i) => report.metricHeaders[i]?.name !== m)) throw Error('Invalid Analytics metric response.')
  if (!report.rows?.length) {
    if (report.rowCount && report.rowCount !== 0) throw Error('Incomplete Analytics report.')
    return [0,0,0]
  }
  if (report.rows.length !== 1) throw Error('Expected a single Analytics total.')
  if (report.rows[0].metricValues?.length !== 3) throw Error('Invalid Analytics metric response.')
  return report.rows[0].metricValues.map(v => {
    if (!/^\d+$/.test(v.value)) throw Error('Invalid Analytics value.')
    const value = Number(v.value)
    if (!Number.isSafeInteger(value) || value > 100000000) throw Error('Analytics value exceeds supported range.')
    return value
  })
}
export function googleError(status) {
  if (status === 403) return 'Google denied reporting access. Enable the Analytics Data API and grant the service account Viewer access to this property.'
  if (status === 401) return 'Google reporting credentials were rejected. Check or replace the service account key.'
  if (status === 429) return 'Google reporting quota reached. The next scheduled import will retry.'
  return 'Google Analytics could not return this report. The previous saved statistics are unchanged.'
}
const encode = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')
export async function accessToken(credentials, fetcher = fetch, now = Date.now()) {
  if (credentials.type !== 'service_account' || !/^[^\s@]+@[^\s@]+\.gserviceaccount\.com$/.test(credentials.client_email || '') || !credentials.private_key?.includes('BEGIN PRIVATE KEY')) throw Error('Invalid Google service account configuration.')
  const seconds = Math.floor(now / 1000)
  const json = value => encode(new TextEncoder().encode(JSON.stringify(value)))
  const unsigned = `${json({alg:'RS256',typ:'JWT'})}.${json({iss:credentials.client_email,scope:'https://www.googleapis.com/auth/analytics.readonly',aud:'https://oauth2.googleapis.com/token',iat:seconds,exp:seconds+3600})}`
  const pem = credentials.private_key.replace(/-----[A-Z ]+-----|\s/g,'')
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c=>c.charCodeAt(0)), {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['sign'])
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const response = await fetcher('https://oauth2.googleapis.com/token', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${encode(new Uint8Array(signature))}`}),signal:AbortSignal.timeout(20000)})
  if (!response.ok) throw Error('Google reporting credentials were rejected. Check the service account key.')
  const result = await response.json()
  if (!result.access_token) throw Error('Google did not return a reporting token.')
  return result.access_token
}
export async function collect(brand, token, fetcher = fetch, now = new Date()) {
  const property = PROPERTIES[brand]
  if (!property) throw Error('Unknown Analytics brand.')
  const query = async body => {
    const r = await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, {method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)})
    if (!r.ok) throw Error(googleError(r.status))
    return r.json()
  }
  const metrics = GA_METRICS.map(name=>({name}))
  const rolling = await query({dateRanges:[{startDate:'7daysAgo',endDate:'yesterday'}],metrics})
  const totals = values(rolling)
  const range = dateRange(now, rolling.metadata?.timeZone || 'America/Denver')
  const dates = [{startDate:range.start,endDate:range.end}]
  const daily = await query({dateRanges:dates,dimensions:[{name:'date'}],metrics,keepEmptyRows:true,limit:100})
  if (GA_METRICS.some((m,i)=>daily.metricHeaders?.[i]?.name!==m) || !Array.isArray(daily.dimensionHeaders) || daily.dimensionHeaders[0]?.name!=='date') throw Error('Invalid daily Analytics response.')
  const byDay = new Map()
  if ((daily.rowCount || 0) > (daily.rows?.length || 0)) throw Error('Incomplete Analytics report.')
  for (const row of daily.rows || []) {
    const raw = row.dimensionValues?.[0]?.value || ''
    if (!/^\d{8}$/.test(raw)) throw Error('Invalid Analytics date.')
    const date = `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6)}`
    if (date < range.start || date > range.end || byDay.has(date)) throw Error('Unexpected Analytics date.')
    byDay.set(date, values({metricHeaders:daily.metricHeaders,rows:[row]}))
  }
  const source = await query({dateRanges:dates,dimensions:[{name:'firstUserSource'},{name:'firstUserMedium'}],metrics:[{name:'activeUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:20})
  const geography = await query({dateRanges:dates,dimensions:[{name:'country'},{name:'city'}],metrics:[{name:'activeUsers'}],orderBys:[{metric:{metricName:'activeUsers'},desc:true}],limit:20})
  const breakdown = (report, dimensions) => {
    if (report.metricHeaders?.[0]?.name !== 'activeUsers') throw Error('Invalid Analytics source response.')
    return (report.rows || []).map(row=>{
      const activeUsers=Number(row.metricValues?.[0]?.value)
      if (!Number.isSafeInteger(activeUsers) || activeUsers<0 || row.dimensionValues?.length!==dimensions) throw Error('Invalid Analytics source response.')
      return {labels:row.dimensionValues.map(d=>d.value),activeUsers}
    })
  }
  const sourceUrl = `https://analytics.google.com/analytics/web/#/p${property}/reports/intelligenthome`
  const notes = `Automatic Google Analytics import. Property ${property}, timezone ${range.timezone}. Visitors means GA4 Active users, not total users. Owner/test visits may be included; no hostname/internal-traffic filter applied. Recent data can revise. Active users must not be summed across days. Sources/locations are estimates; top 20 rows and privacy thresholds can limit detail.`
  const records = LABELS.map((metric,i)=>({brand,channel:'Website',metric,period_start:range.start,period_end:range.end,value:totals[i],source:'Google Analytics',source_url:sourceUrl,notes,automated:true}))
  for (let date=range.start;date<=range.end;) {
    const result = byDay.get(date) || [0,0,0]
    records.push(...LABELS.map((metric,i)=>({brand,channel:'Website',metric,period_start:date,period_end:date,value:result[i],source:'Google Analytics',source_url:sourceUrl,notes,automated:true})))
    date=new Date(new Date(`${date}T12:00:00Z`).getTime()+86400000).toISOString().slice(0,10)
  }
  return {brand,property,range,records,sources:breakdown(source,2),locations:breakdown(geography,2),metadata:rolling.metadata || {}}
}
