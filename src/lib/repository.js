import { hydrateTask, prepareTask } from './task-evidence.js'
import { TABLES, WORKSPACE_ID, cleanPayload, emptyData } from './domain.js'

async function readAll(client, table) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from(table).select('*').eq('workspace_id', WORKSPACE_ID).order('created_at', { ascending: false }).order('id').range(offset, offset + 499)
    if (error) throw error
    rows.push(...data)
    if (data.length < 500) return rows
  }
}
export function liveRepository(client) {
  return {
    async membership() {
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Please sign in again.')
      const { data, error } = await client.from('cc_members').select('role,display_name').eq('workspace_id', WORKSPACE_ID).eq('user_id', auth.user.id).eq('enabled', true).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('This account has not been approved for the MKT workspace. Ask the workspace owner to add your user ID.')
      return { ...data, user_id: auth.user.id }
    },
    async loadDraftPublication(businessId) {
      const {data,error}=await client.from('cc_ll_draft_publications').select('*').eq('business_id',businessId).maybeSingle()
      if(error)throw error
      return data
    },
    async publishDraftBusiness(businessId,settings) {
      const {data,error}=await client.rpc('cc_publish_ll_draft',{p_business_id:businessId,p_pages:settings.pages,p_directory:settings.directory,p_spotlight_pages:settings.spotlight_pages,p_order:settings.spotlight_order,p_active:settings.active})
      if(error)throw error
      return data
    },
    async loadPartnerMessages() {
      const [messages,reactions] = await Promise.all([readAll(client,'cc_partner_messages'),readAll(client,'cc_partner_reactions')])
      return {messages,reactions}
    },
    async postPartnerMessage(body,parent_id=null) {
      const {data,error}=await client.from('cc_partner_messages').insert({workspace_id:WORKSPACE_ID,body,parent_id}).select().single()
      if(error)throw error
      return data
    },
    async reactPartnerMessage(message_id,value) {
      const member=await this.membership()
      const {data,error}=await client.from('cc_partner_reactions').upsert({workspace_id:WORKSPACE_ID,message_id,user_id:member.user_id,value},{onConflict:'message_id,user_id'}).select().single()
      if(error)throw error
      return data
    },
    async uploadListingImage(businessId,file) {
      const member=await this.membership()
      if(member.role==='viewer') throw new Error('Your account is read-only.')
      const extensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}
      if(!extensions[file.type]||file.size>5*1024*1024||file.size===0)throw new Error('Choose a JPEG, PNG or WebP image no larger than 5 MB.')
      const path=`${member.user_id}/${businessId}/${crypto.randomUUID()}.${extensions[file.type]}`
      const {error}=await client.storage.from('cc-listing-images').upload(path,file,{contentType:file.type,upsert:false})
      if(error)throw error
      return client.storage.from('cc-listing-images').getPublicUrl(path).data.publicUrl
    },
    async publishBusiness(input) {
      const member=await this.membership()
      if(member.role==='viewer')throw new Error('Your account is read-only.')
      const {data,error}=await client.functions.invoke('publish-listing',{body:input})
      if(error){let message=error.message;try{message=(await error.context.json()).error||message}catch{ /* Network errors have no response body. */ }throw new Error(message)}
      if(data.error)throw new Error(data.error)
      return data
    },
    async load() {
      const entries = await Promise.all(Object.entries(TABLES).map(async ([key, table]) => [key, key === 'tasks' ? (await readAll(client, table)).map(hydrateTask) : await readAll(client, table)]))
      return Object.fromEntries(entries)
    },
    async save(kind, draft) {
      const payload = { ...cleanPayload(kind, kind === 'tasks' ? prepareTask(draft) : draft), workspace_id: WORKSPACE_ID }
      const table = client.from(kind === 'business_notes' ? 'cc_businesses' : TABLES[kind])
      const query = draft.id ? table.update(payload).eq('id', draft.id).eq('workspace_id', WORKSPACE_ID) : table.insert(payload)
      if (kind === 'notes' && draft.id) query.eq('updated_at', draft.previous_updated_at)
      if (kind === 'business_notes') {
        if (!draft.id) throw new Error('Choose a business before saving notes.')
        query.eq('internal_notes', draft.previous_notes || '')
      }
      const { data, error } = await query.select().single()
      if (kind === 'notes' && error?.code === 'PGRST116') throw new Error('This note changed or permission was lost. Copy your draft and reload before trying again.')
      if (kind === 'business_notes' && error?.code === 'PGRST116') throw new Error('These notes changed or access was lost. Copy your draft, reload the profile and try again.')
      if (kind === 'statistics' && error?.code === '23505') throw new Error('This metric and reporting period already exist. Edit the existing record instead.')
      if (error) throw error
      return kind === 'tasks' ? hydrateTask(data) : data
    },
  }
}

// Practice records exist only in memory and are never sent to Supabase.
export function demoRepository(initial = sampleData()) {
  let data = structuredClone(initial)
  return {
    async loadPartnerMessages() { return structuredClone(this.partnerData || {messages:[],reactions:[]}) },
    async postPartnerMessage(body,parent_id=null) {
      this.partnerData ||= {messages:[],reactions:[]}
      const message={id:crypto.randomUUID(),body,parent_id,author_name:'Practice workspace',created_at:new Date().toISOString()}
      this.partnerData.messages.unshift(message);return message
    },
    async reactPartnerMessage(message_id,value) {
      this.partnerData ||= {messages:[],reactions:[]}
      const reaction={id:message_id,user_id:'practice-user',message_id,value}
      this.partnerData.reactions=this.partnerData.reactions.filter(r=>r.id!==reaction.id).concat(reaction);return reaction
    },
    async membership() { return { role: 'owner', display_name: 'Practice workspace', user_id: 'practice-user' } },
    async load() { return {...structuredClone(data),tasks:structuredClone(data.tasks).map(hydrateTask)} },
    async save(kind, draft) {
      const payload = cleanPayload(kind, kind === 'tasks' ? prepareTask(draft) : draft)
      if (kind === 'business_notes') {
        const business = data.businesses.find(b => b.id === draft.id)
        if (!business) throw new Error('Business not found.')
        if ((business.internal_notes || '') !== (draft.previous_notes || '')) throw new Error('These notes changed. Reload the profile and try again.')
        business.internal_notes = payload.internal_notes; business.updated_at = new Date().toISOString()
        return structuredClone(business)
      }
      if (kind === 'notes' && draft.id) {
        const original = data.notes.find(n => n.id === draft.id)
        if (!original || original.deleted_at || original.updated_at !== draft.previous_updated_at) throw new Error('This note changed. Reload before trying again.')
      }
      const record = { ...payload, id: draft.id || crypto.randomUUID(), workspace_id: WORKSPACE_ID, created_at: draft.created_at || new Date().toISOString(), updated_at: new Date().toISOString() }
      if (kind === 'notes') {
        const original = data.notes.find(n => n.id === draft.id)
        Object.assign(record, {created_by:original?.created_by || 'practice-user',author_name:original?.author_name || 'Practice workspace',created_at:original?.created_at || record.created_at,edited_by_name:original ? 'Practice workspace' : ''})
      }
      if (kind === 'tasks') {
        const original = data.tasks.find(t => t.id === draft.id)
        Object.assign(record, payload.status === 'Done' && original?.status !== 'Done' ? {completed_at:new Date().toISOString(),completed_by:'practice-user',completed_by_name:'Practice workspace'} : {completed_at:original?.completed_at || null,completed_by:original?.completed_by || null,completed_by_name:original?.completed_by_name || null})
      }
      const index = data[kind].findIndex(r => r.id === record.id)
      if (index < 0) data[kind].unshift(record)
      else data[kind][index] = { ...data[kind][index], ...record }
      const saved=structuredClone(data[kind].find(r => r.id === record.id));return kind === 'tasks' ? hydrateTask(saved) : saved
    },
  }
}

export function sampleData() {
  const data = emptyData()
  const business = (id, name, kind, stage, fee, value, city) => ({ id, name, kind, stage, monthly_fee: fee, deal_value: value, city, status: 'Active', contact_name: 'Sample contact', email: 'sample@example.com', phone: '', address: '', website: 'https://example.com', notes: 'Fictional practice record. Replace only in your live workspace.', created_at: new Date().toISOString() })
  data.businesses = [business('demo-1', 'Example Mountain Studio', 'Client', 'Won', 550, 0, 'Longmont'), business('demo-2', 'Example Main Street Shop', 'Prospect', 'Proposal', 0, 900, 'Boulder'), business('demo-3', 'Example Trail Guides', 'Prospect', 'Contacted', 0, 350, 'Estes Park')]
  data.listings = [{ id: 'demo-listing-1', business_id: 'demo-1', site: 'Loving Longmont', title: 'Example Mountain Studio', pages: ['Local Businesses', 'Arts'], city: 'Longmont', status: 'Published', url: 'https://example.com', description: 'Fictional listing for trying the directory workflow.' }, { id: 'demo-listing-2', business_id: 'demo-3', site: 'MKT Colorado', title: 'Example Trail Guides', pages: ['Estes Park'], city: 'Estes Park', status: 'Needs update', url: '', description: 'Fictional Colorado listing.' }]
  const today = new Date(); const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  data.tasks = [{ id: 'demo-task-1', title: 'Follow up on the sample proposal', business_id: 'demo-2', type: 'Follow-up', status: 'Open', priority: 'High', due_date: date, assignee: 'Michelle', notes: 'Practice reminder only.' }, { id: 'demo-task-2', title: 'Review sample directory listing', business_id: 'demo-3', type: 'Task', status: 'In progress', priority: 'Normal', due_date: date, assignee: 'Tim', notes: '' }]
  data.emails = [{ id: 'demo-email-1', business_id: 'demo-2', recipient: 'sample@example.com', subject: 'Example visibility proposal', status: 'Sent', direction: 'Outbound', occurred_on: date, campaign: 'Sample outreach', notes: 'Fictional tracking record. No email was sent.' }]
  return data
}
