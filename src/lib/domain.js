import { metadata } from './portfolio.js'
export const WORKSPACE_ID = 'c8748032-cdd3-443b-8c56-2e846cc9bf31'
export const BRANDS = ['MKT Visibility', 'MKT Colorado', 'Loving Longmont', 'Open Theory Cove', 'Boulder County Photography']
export const CHANNELS = ['Website', 'Google Search', 'Facebook', 'Instagram', 'LinkedIn', 'YouTube', 'TikTok', 'Pinterest', 'Etsy']
export const METRICS = ['Visitors', 'Page views', 'Sessions', 'Search clicks', 'Search impressions', 'Followers', 'Content views', 'Interactions', 'Posts published', 'Link clicks', 'Inquiries', 'Orders', 'Revenue']
export const SOURCES = ['Manual report', 'Google Analytics', 'Google Search Console', 'Metricool', 'Platform report']
export const TABLES = { businesses: 'cc_businesses', listings: 'cc_listings', emails: 'cc_emails', tasks: 'cc_tasks', purchases: 'cc_purchases', statistics: 'cc_statistics', tracking: 'cc_tracking_setup', notes: 'cc_notes' }
export const STAGES = ['New', 'Contacted', 'Discovery', 'Proposal', 'Won', 'Lost']
export const emptyData = () => ({ businesses: [], listings: [], emails: [], tasks: [], purchases: [], statistics: [], tracking: [], notes: [] })
export const currency = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value) || 0)
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function isDue(task, today = localDay()) {
  return task.status !== 'Done' && task.status !== 'Cancelled' && Boolean(task.due_date) && task.due_date <= today
}
export function dashboard(data, today = localDay()) {
  const active = data.businesses.filter(b => b.kind === 'Client' && b.status === 'Active')
  return {
    businesses: data.businesses.filter(b => b.status !== 'Archived').length,
    clients: active.length,
    due: data.tasks.filter(t => t.type === 'Follow-up' && isDue(t, today)).length,
    recurring: active.reduce((sum, b) => sum + Number(b.monthly_fee || 0), 0),
    pipeline: data.businesses.filter(b => b.status !== 'Archived' && b.kind !== 'Partner-owned Business' && !['Won', 'Lost'].includes(b.stage)).reduce((sum, b) => sum + Number(b.deal_value || 0), 0),
  }
}
export function safeUrl(value) {
  if (!value) return null
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null } catch { return null }
}
export function validateConfig({ url, key }) {
  let parsed
  try { parsed = new URL(url) } catch { throw new Error('Enter a valid Supabase project URL.') }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co') || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Use your HTTPS Supabase project URL, ending in .supabase.co.')
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('Use a Supabase publishable key beginning sb_publishable_. Secret and service-role keys are not accepted.')
  return true
}
// Versioned summary metadata uses the existing protected notes column.
// Legacy plain-text notes remain readable; no message bodies or email links are stored.
export function messageSummary(record) {
  try {
    const value = JSON.parse(record.notes || '')
    if (value?.format === 'mkt-message-summary-v1') return {
      sender: typeof value.sender === 'string' ? value.sender : '',
      summary: typeof value.summary === 'string' ? value.summary : '',
      next_action: typeof value.next_action === 'string' ? value.next_action : '',
      follow_up_on: typeof value.follow_up_on === 'string' ? value.follow_up_on : '',
      response_status: typeof value.response_status === 'string' ? value.response_status : 'No action',
      verification: value.verification === 'Reviewed' ? 'Reviewed' : 'Unverified',
      ...(['Loving Longmont','MKT Colorado'].includes(value.directoryBrand)?{directoryBrand:value.directoryBrand}:{}),
    }
  } catch { /* Original notes are plain text. */ }
  return { sender: '', summary: record.notes || '', next_action: '', follow_up_on: '', response_status: 'No action', verification: 'Unverified' }
}
export function businessMessages(data, businessId) {
  return data.emails.filter(e => (e.business_id === businessId || (e.related_business_ids || []).includes(businessId))).sort((a, b) =>
    (b.occurred_on || '').localeCompare(a.occurred_on || '') || (b.created_at || '').localeCompare(a.created_at || '') || String(a.id).localeCompare(String(b.id)))
}
function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function cleanPayload(kind, draft) {
  if (kind === 'notes') {
    if (!draft.business_id) throw new Error('Choose a business for this note.')
    const body = String(draft.body ?? '').trim()
    if (!draft.remove && (!body || Array.from(body).length > 10000)) throw new Error('Enter a note within 10,000 characters.')
    if (draft.remove && !draft.id) throw new Error('Choose a saved note to delete.')
    return draft.remove ? {business_id:draft.business_id, parent_id:draft.parent_id || null, body:'', deleted_at:new Date().toISOString()} : {business_id:draft.business_id, parent_id:draft.parent_id || null, body}
  }
  if (kind === 'statistics') {
    if (!BRANDS.includes(draft.brand) || !CHANNELS.includes(draft.channel) || !METRICS.includes(draft.metric) || !SOURCES.includes(draft.source)) throw new Error('Choose a valid brand, channel, metric and source.')
    if (!validDay(draft.period_start || '') || !validDay(draft.period_end || '') || draft.period_start > draft.period_end || draft.period_end > localDay()) throw new Error('Choose a valid completed reporting period.')
    if (draft.value === '' || draft.value == null || !Number.isFinite(Number(draft.value)) || Number(draft.value) < 0 || Number(draft.value) > 100000000) throw new Error('Enter a reported value between 0 and 100,000,000. Leave unreported metrics out.')
    if (draft.source_url && !safeUrl(draft.source_url)) throw new Error('Source links must begin with https:// or http://.')
    return { brand: draft.brand, channel: draft.channel, metric: draft.metric, period_start: draft.period_start, period_end: draft.period_end, value: Number(draft.value), source: draft.source, source_url: String(draft.source_url || '').slice(0,2000), notes: String(draft.notes || '').slice(0,4000) }
  }
  if (kind === 'business_notes') {
    const notes = String(draft.internal_notes ?? '')
    if (Array.from(notes).length > 10000) throw new Error('Keep internal notes within 10,000 characters.')
    return { internal_notes: notes }
  }
  const number = value => {
    const result = Number(value || 0)
    if (!Number.isFinite(result) || result < 0 || result > 100000000) throw new Error('Amounts must be between 0 and 100,000,000.')
    return result
  }
  const text = (value, limit = 4000) => String(value ?? '').trim().slice(0, limit)
  const email = value => {
    const result = text(value, 320)
    if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new Error('Enter a valid email address.')
    return result
  }
  const url = value => {
    const result = text(value, 2000)
    if (result && !safeUrl(result)) throw new Error('Links must begin with https:// or http://.')
    return result
  }
  const list = value => [...new Set((Array.isArray(value) ? value : String(value || '').split(',' )).map(v => String(v).trim()).filter(Boolean))]
  let payload
  if (kind === 'businesses') payload = {
    description: text(draft.description), categories: list(draft.categories), social_urls: list(draft.social_urls).map(url), image_url: url(draft.image_url),
    name: text(draft.name, 200), contact_name: text(draft.contact_name, 200), email: email(draft.email), phone: text(draft.phone, 80),
    address: text(draft.address, 500), city: text(draft.city, 100), website: url(draft.website), kind: draft.kind,
    status: draft.status, stage: draft.stage, monthly_fee: number(draft.monthly_fee), deal_value: number(draft.deal_value), notes: text(draft.notes),
  }
  if (kind === 'listings') payload = {
    business_id: draft.business_id || null, site: draft.site, title: text(draft.title, 200), city: text(draft.city, 100),
    pages: Array.isArray(draft.pages) ? draft.pages : text(draft.pages, 2000).split(',').map(p => p.trim()).filter(Boolean),
    url: url(draft.url), status: draft.status, description: text(draft.description), added_on: draft.added_on || null,
  }
  if (kind === 'emails') payload = {
    occurred_at: draft.occurred_at || null, message_type: draft.message_type || 'Human', source_message_id: text(draft.source_message_id, 1000), related_business_ids: Array.isArray(draft.related_business_ids) ? draft.related_business_ids : [],
    business_id: draft.business_id || null, recipient: email(draft.recipient), subject: text(draft.subject, 300),
    direction: draft.direction, status: draft.status, occurred_on: draft.occurred_on || null, campaign: text(draft.campaign, 200), notes: text(draft.notes),
  }
  if (kind === 'purchases') payload = { business_id: draft.business_id || null, product: text(draft.product, 200), purchased_on: draft.purchased_on || null, amount: number(draft.amount), status: draft.status, notes: text(draft.notes) }
  if (kind === 'tasks') payload = {
    details: draft.details || {},
    business_id: draft.business_id || null, title: text(draft.title, 200), type: draft.type, status: draft.status,
    due_date: draft.due_date || null, assignee: text(draft.assignee, 100), priority: draft.priority === 'Medium' ? 'Normal' : draft.priority, notes: text(draft.notes),
  }
  if (kind === 'emails' && Object.hasOwn(draft, 'summary')) {
    if (String(draft.summary ?? '').trim().length > 2500) throw new Error('Keep the brief summary within 2,500 characters; existing notes have not been changed.')
    if (String(draft.next_action ?? '').trim().length > 500) throw new Error('Keep the next action within 500 characters.')
    const detail = {
      format: 'mkt-message-summary-v1', sender: email(draft.sender), summary: text(draft.summary, 2500),
      next_action: text(draft.next_action, 500), follow_up_on: draft.follow_up_on || '',
      response_status: draft.response_status || 'No action', verification: draft.verification || 'Unverified',
    }
    if (!['No action', 'Needs our reply', 'Waiting for reply', 'Follow up', 'Closed'].includes(detail.response_status)) throw new Error('Choose a valid response status.')
    if (!['Reviewed', 'Unverified'].includes(detail.verification)) throw new Error('Choose a valid verification status.')
    if (detail.follow_up_on && !validDay(detail.follow_up_on)) throw new Error('Choose a valid follow-up date.')
    const directoryBrand=draft.directoryBrand||messageSummary(draft).directoryBrand
    if(['Loving Longmont','MKT Colorado'].includes(directoryBrand))detail.directoryBrand=directoryBrand
    const encoded = JSON.stringify(detail)
    if (Array.from(encoded).length > 4000) throw new Error('Shorten the summary or next action to fit this record.')
    payload.notes = encoded
  }
  if (['tasks','businesses','purchases'].includes(kind) && metadata(draft).format === 'mkt-portfolio-v1' && Array.from(String(draft.notes)).length > 4000) throw new Error('Shorten the notes to fit this record.')
  if (!payload) throw new Error('Unknown record type.')
  if (!(payload.name || payload.title || payload.subject || payload.product)) throw new Error('A name, title, or subject is required.')
  if (kind === 'listings' && !payload.business_id) throw new Error('Choose the business this listing belongs to.')
  if (kind === 'emails' && !payload.recipient) throw new Error('An email address is required.')
  if (kind === 'emails' && ['Sent', 'Replied'].includes(payload.status) && !payload.occurred_on) throw new Error('Record the date for a sent message or reply.')
  if (kind === 'emails' && payload.direction === 'Inbound' && payload.status === 'Draft') throw new Error('An inbound message cannot be a draft.')
  if (kind === 'tasks' && payload.type === 'Follow-up' && !payload.due_date) throw new Error('Choose a follow-up date.')
  if (kind === 'purchases' && (!payload.business_id || !payload.purchased_on)) throw new Error('Choose a business and the actual purchase date.')
  if (kind === 'businesses' && (payload.categories.length > 40 || payload.categories.join(',').length > 2000 || payload.social_urls.length > 30 || payload.social_urls.join(',').length > 6000)) throw new Error('Shorten the category or social account list.')
  for (const field of ['due_date', 'occurred_on', 'added_on', 'purchased_on']) {
    if (payload[field] && !validDay(payload[field])) throw new Error('Choose a valid date.')
  }
  return payload
}
export function toCsv(rows) {
  rows = rows.map(row => Object.hasOwn(row, 'direction') && Object.hasOwn(row, 'subject') ? { ...row, ...messageSummary(row), notes: undefined } : row)
  if (!rows.length) return ''
  const fields = Object.keys(rows[0]).filter(k => !['workspace_id', 'created_by'].includes(k))
  const cell = value => {
    let s = Array.isArray(value) ? value.join('; ') : String(value ?? '')
    if (/^[\s]*[=+\-@]/.test(s)) s = `'${s}`
    return `"${s.replaceAll('"', '""')}"`
  }
  return [fields.map(cell).join(','), ...rows.map(row => fields.map(k => cell(row[k])).join(','))].join('\r\n')
}

export function trackingDates(installedAt) {
 const timestamp = Date.parse(installedAt)
 if (!Number.isFinite(timestamp)) return null
 const format = value => new Intl.DateTimeFormat('en-US', {timeZone:'America/Denver',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(value)
 return {installed:format(timestamp), check:format(timestamp + 48 * 60 * 60 * 1000)}
}

export function taskOverview(tasks, today = localDay()) {
  const open = tasks.filter(t => !['Done', 'Cancelled'].includes(t.status))
  const urgent = [...open].sort(compareTasks).slice(0, 5)
  return { open: open.length, overdue: open.filter(t => t.due_date && t.due_date < today).length, today: open.filter(t => t.due_date === today).length, urgent }
}

export function priorityLabel(value) { return value === 'High' ? 'High' : value === 'Low' ? 'Low' : 'Normal' }
export function compareTasks(a, b) {
  const ranks = { High: 0, Normal: 1, Low: 2 }
  return ranks[priorityLabel(a.priority)] - ranks[priorityLabel(b.priority)] || (a.due_date || '9999').localeCompare(b.due_date || '9999') || (a.title || '').localeCompare(b.title || '', 'en', {numeric:true})
}
