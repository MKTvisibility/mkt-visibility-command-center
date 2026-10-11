export const WORKSPACE_ID = 'c8748032-cdd3-443b-8c56-2e846cc9bf31'
export const TABLES = { businesses: 'cc_businesses', listings: 'cc_listings', emails: 'cc_emails', tasks: 'cc_tasks' }
export const STAGES = ['New', 'Contacted', 'Discovery', 'Proposal', 'Won', 'Lost']
export const emptyData = () => ({ businesses: [], listings: [], emails: [], tasks: [] })
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
    pipeline: data.businesses.filter(b => b.status !== 'Archived' && !['Won', 'Lost'].includes(b.stage)).reduce((sum, b) => sum + Number(b.deal_value || 0), 0),
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
export function cleanPayload(kind, draft) {
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
  let payload
  if (kind === 'businesses') payload = {
    name: text(draft.name, 200), contact_name: text(draft.contact_name, 200), email: email(draft.email), phone: text(draft.phone, 80),
    address: text(draft.address, 500), city: text(draft.city, 100), website: url(draft.website), kind: draft.kind,
    status: draft.status, stage: draft.stage, monthly_fee: number(draft.monthly_fee), deal_value: number(draft.deal_value), notes: text(draft.notes),
  }
  if (kind === 'listings') payload = {
    business_id: draft.business_id || null, site: draft.site, title: text(draft.title, 200), city: text(draft.city, 100),
    pages: Array.isArray(draft.pages) ? draft.pages : text(draft.pages, 2000).split(',').map(p => p.trim()).filter(Boolean),
    url: url(draft.url), status: draft.status, description: text(draft.description),
  }
  if (kind === 'emails') payload = {
    business_id: draft.business_id || null, recipient: email(draft.recipient), subject: text(draft.subject, 300),
    direction: draft.direction, status: draft.status, occurred_on: draft.occurred_on || null, campaign: text(draft.campaign, 200), notes: text(draft.notes),
  }
  if (kind === 'tasks') payload = {
    business_id: draft.business_id || null, title: text(draft.title, 200), type: draft.type, status: draft.status,
    due_date: draft.due_date || null, assignee: text(draft.assignee, 100), priority: draft.priority, notes: text(draft.notes),
  }
  if (!payload) throw new Error('Unknown record type.')
  if (!(payload.name || payload.title || payload.subject)) throw new Error('A name, title, or subject is required.')
  if (kind === 'listings' && !payload.business_id) throw new Error('Choose the business this listing belongs to.')
  if (kind === 'emails' && !payload.recipient) throw new Error('An email address is required.')
  if (kind === 'emails' && ['Sent', 'Replied'].includes(payload.status) && !payload.occurred_on) throw new Error('Record the date for a sent message or reply.')
  if (kind === 'emails' && payload.direction === 'Inbound' && payload.status === 'Draft') throw new Error('An inbound message cannot be a draft.')
  if (kind === 'tasks' && payload.type === 'Follow-up' && !payload.due_date) throw new Error('Choose a follow-up date.')
  for (const field of ['due_date', 'occurred_on']) {
    if (payload[field] && (!/^\d{4}-\d{2}-\d{2}$/.test(payload[field]) || Number.isNaN(Date.parse(payload[field])) || new Date(payload[field]).toISOString().slice(0, 10) !== payload[field])) throw new Error('Choose a valid date.')
  }
  return payload
}
export function toCsv(rows) {
  if (!rows.length) return ''
  const fields = Object.keys(rows[0]).filter(k => !['workspace_id', 'created_by'].includes(k))
  const cell = value => {
    let s = Array.isArray(value) ? value.join('; ') : String(value ?? '')
    if (/^[\s]*[=+\-@]/.test(s)) s = `'${s}`
    return `"${s.replaceAll('"', '""')}"`
  }
  return [fields.map(cell).join(','), ...rows.map(row => fields.map(k => cell(row[k])).join(','))].join('\r\n')
}
