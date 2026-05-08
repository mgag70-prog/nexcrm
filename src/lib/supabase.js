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

async function requireUserId() {
  const { data } = await supabase.auth.getSession()
  const id = data?.session?.user?.id
  if (!id) throw new Error('Not authenticated')
  return id
}

export const storage = {
  async get(key) {
    try {
      const userId = await requireUserId()
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
    const userId = await requireUserId()
    const { error } = await supabase
      .from('crm_store')
      .upsert(
        { key, value: String(value), user_id: userId },
        { onConflict: 'user_id,key' },
      )
    if (error) throw error
  },
  async delete(key) {
    const userId = await requireUserId()
    await supabase
      .from('crm_store')
      .delete()
      .eq('user_id', userId)
      .eq('key', key)
  },
  async list(prefix) {
    try {
      const userId = await requireUserId()
      const { data, error } = await supabase
        .from('crm_store')
        .select('key')
        .eq('user_id', userId)
        .like('key', `${prefix}%`)
      if (error) return { keys: [] }
      return { keys: (data || []).map((r) => r.key) }
    } catch {
      return { keys: [] }
    }
  },
}

if (typeof window !== 'undefined') {
  window.storage = storage
}

export async function signUp(email, password) {
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data?.session ?? null
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return () => data.subscription.unsubscribe()
}
