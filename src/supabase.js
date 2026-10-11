import { createClient } from '@supabase/supabase-js'
import { validateConfig } from './lib/domain.js'

export function makeSupabase(config) {
  if (!config?.url || !config?.key) return null
  validateConfig(config)
  return createClient(config.url, config.key, {
    auth: { persistSession: true, storage: window.sessionStorage, autoRefreshToken: true, detectSessionInUrl: false },
  })
}

export function readConfig() {
  const url = import.meta.env?.VITE_SUPABASE_URL || ''
  const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || ''
  if (url && key) {
    try { validateConfig({ url, key }); return { url, key } } catch { return null }
  }
  try {
    const config = JSON.parse(window.sessionStorage.getItem('mkt-public-config') || 'null')
    if (config) validateConfig(config)
    return config
  } catch { return null }
}
