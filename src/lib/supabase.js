import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

let userIdPromise = null

function resolveUserId() {
  if (!userIdPromise) {
    userIdPromise = (async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData?.session?.user?.id) return sessionData.session.user.id
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      return data.user.id
    })().catch((err) => {
      userIdPromise = null
      throw err
    })
  }
  return userIdPromise
}

export const storage = {
  async get(key) {
    try {
      const userId = await resolveUserId()
      const { data, error } = await supabase
        .from('crm_store')
        .select('key, value')
        .eq('user_id', userId)
        .eq('key', key)
        .maybeSingle()
      if (error || !data) return null
      return { key: data.key, value: data.value }
    } catch {
      return null
    }
  },
  async set(key, value) {
    const userId = await resolveUserId()
    const { error } = await supabase
      .from('crm_store')
      .upsert(
        { key, value: String(value), user_id: userId },
        { onConflict: 'user_id,key' },
      )
    if (error) throw error
  },
  async delete(key) {
    const userId = await resolveUserId()
    await supabase
      .from('crm_store')
      .delete()
      .eq('user_id', userId)
      .eq('key', key)
  },
  async list(prefix) {
    const userId = await resolveUserId()
    const { data, error } = await supabase
      .from('crm_store')
      .select('key')
      .eq('user_id', userId)
      .like('key', `${prefix}%`)
    if (error) return { keys: [] }
    return { keys: (data || []).map((r) => r.key) }
  },
}

if (typeof window !== 'undefined') {
  window.storage = storage
}
