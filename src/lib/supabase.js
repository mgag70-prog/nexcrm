import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Required so emailed password-recovery links (#access_token=…&type=recovery)
    // establish a session when the user lands back on the app.
    detectSessionInUrl: true,
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
      if (error) {
        console.error('[storage.get]', key, error)
        return null
      }
      if (!data) return null
      return { key: data.key, value: data.value }
    } catch (e) {
      console.error('[storage.get] threw for', key, e)
      return null
    }
  },
  async set(key, value) {
    try {
      const userId = await requireUserId()
      const { error } = await supabase
        .from('crm_store')
        .upsert(
          { key, value: String(value), user_id: userId },
          { onConflict: 'user_id,key' },
        )
      if (error) {
        console.error('[storage.set]', key, error)
        throw error
      }
    } catch (e) {
      console.error('[storage.set] threw for', key, e)
      throw e
    }
  },
  async delete(key) {
    try {
      const userId = await requireUserId()
      const { error } = await supabase
        .from('crm_store')
        .delete()
        .eq('user_id', userId)
        .eq('key', key)
      if (error) console.error('[storage.delete]', key, error)
    } catch (e) {
      console.error('[storage.delete] threw for', key, e)
    }
  },
  async list(prefix) {
    try {
      const userId = await requireUserId()
      const { data, error } = await supabase
        .from('crm_store')
        .select('key')
        .eq('user_id', userId)
        .like('key', `${prefix}%`)
      if (error) {
        console.error('[storage.list]', prefix, error)
        return { keys: [] }
      }
      return { keys: (data || []).map((r) => r.key) }
    } catch (e) {
      console.error('[storage.list] threw for', prefix, e)
      return { keys: [] }
    }
  },
}

if (typeof window !== 'undefined') {
  window.storage = storage
}

// ─── PORTAL (public, no-auth) ───────────────────────────────────────────────
// Reads/writes the public `portal_snapshots` table so that anonymous visitors
// at /portal/:token can see what the workspace owner exposed for that contact.
// SQL required (one-time, run by user):
//   create table if not exists public.portal_snapshots (
//     token text primary key,
//     payload jsonb not null,
//     created_at timestamptz not null default now()
//   );
//   alter table public.portal_snapshots enable row level security;
//   create policy "portal public read" on public.portal_snapshots for select to anon, authenticated using (true);
//   create policy "portal owner write" on public.portal_snapshots for insert to authenticated with check (true);
//   create policy "portal owner update" on public.portal_snapshots for update to authenticated using (true) with check (true);
//   create policy "portal owner delete" on public.portal_snapshots for delete to authenticated using (true);
export async function fetchPortalSnapshot(token) {
  try {
    const { data, error } = await supabase
      .from('portal_snapshots')
      .select('payload, created_at')
      .eq('token', token)
      .maybeSingle()
    if (error) {
      console.error('[fetchPortalSnapshot]', error)
      return null
    }
    return data
  } catch (e) {
    console.error('[fetchPortalSnapshot] threw', e)
    return null
  }
}

export async function writePortalSnapshot(token, payload) {
  try {
    const { error } = await supabase
      .from('portal_snapshots')
      .upsert({ token, payload, created_at: new Date().toISOString() })
    if (error) console.error('[writePortalSnapshot]', error)
  } catch (e) {
    console.error('[writePortalSnapshot] threw', e)
  }
}

export async function deletePortalSnapshot(token) {
  try {
    await supabase.from('portal_snapshots').delete().eq('token', token)
  } catch (e) {
    console.error('[deletePortalSnapshot] threw', e)
  }
}

// ─── PORTAL ADMIN (calls Netlify Functions, auth header from current owner) ─
async function bearerHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function postFn(name, body) {
  const headers = await bearerHeader()
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body || {}),
  })
  const text = await res.text()
  let data
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
  if (!res.ok) {
    const msg = data?.error || `${name} failed (${res.status})`
    throw new Error(msg)
  }
  return data
}

export async function adminCreatePortal({ email, scope, scopeId, entityId, payload, settings }) {
  return postFn('portal-create', { email, scope, scopeId, entityId, payload, settings })
}

export async function adminRegeneratePortalPassword({ userId, token }) {
  return postFn('portal-regenerate', { userId, token })
}

export async function adminRevokePortal({ userId, token }) {
  return postFn('portal-revoke', { userId, token })
}

// ─── PORTAL CLIENT — runtime helpers used by the portal pages ────────────────
export async function portalSignIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function portalSignOut() {
  return supabase.auth.signOut()
}

export async function portalUpdatePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword })
}

export async function portalSendPasswordReset(email) {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/portal/login` : undefined
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}

export async function portalGetClientRow() {
  const { data: sess } = await supabase.auth.getSession()
  const userId = sess?.session?.user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('portal_clients')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) { console.error('[portalGetClientRow]', error); return null }
  return data
}

export async function portalMarkSignedIn(userId) {
  try {
    await supabase
      .from('portal_clients')
      .update({ first_login: false, last_accessed: new Date().toISOString() })
      .eq('user_id', userId)
  } catch (e) { console.error('[portalMarkSignedIn]', e) }
}

export async function portalListMessages(token, limit = 200) {
  const { data, error } = await supabase
    .from('portal_messages')
    .select('*')
    .eq('token', token)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) { console.error('[portalListMessages]', error); return [] }
  return data || []
}

// Fetch messages for many tokens at once — used by the CRM Inbox to surface
// every active portal thread for the current entity in a single query.
export async function portalListMessagesForTokens(tokens) {
  if (!tokens?.length) return []
  const { data, error } = await supabase
    .from('portal_messages')
    .select('*')
    .in('token', tokens)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) { console.error('[portalListMessagesForTokens]', error); return [] }
  return data || []
}

export async function portalSendMessage(token, sender_type, sender_name, content) {
  return supabase.from('portal_messages').insert({ token, sender_type, sender_name, content })
}

export async function portalMarkMessagesRead(token, sender_type) {
  return supabase
    .from('portal_messages')
    .update({ read: true })
    .eq('token', token)
    .eq('sender_type', sender_type)
    .eq('read', false)
}

// ─── REALTIME ────────────────────────────────────────────────────────────────
// Subscribe to row-level changes on portal_snapshots / portal_messages for a
// single token. Requires that the tables be in the supabase_realtime publication
// (one-time SQL — see CLAUDE.md). Returns an unsubscribe function.
export function subscribePortalSnapshot(token, onChange) {
  if (!token) return () => {}
  const channel = supabase
    .channel(`portal_snapshot:${token}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'portal_snapshots', filter: `token=eq.${token}` },
      payload => { try { onChange?.(payload) } catch (e) { console.error('[subscribePortalSnapshot cb]', e) } },
    )
    .subscribe()
  return () => { try { supabase.removeChannel(channel) } catch (e) { console.error('[unsub snapshot]', e) } }
}

export function subscribePortalMessages(token, onChange) {
  if (!token) return () => {}
  const channel = supabase
    .channel(`portal_messages:${token}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'portal_messages', filter: `token=eq.${token}` },
      payload => { try { onChange?.(payload) } catch (e) { console.error('[subscribePortalMessages cb]', e) } },
    )
    .subscribe()
  return () => { try { supabase.removeChannel(channel) } catch (e) { console.error('[unsub messages]', e) } }
}

// Listen to message inserts across many tokens — used by the CRM Inbox so the
// owner sees new portal messages live.
export function subscribePortalMessagesForTokens(tokens, onInsert) {
  if (!tokens?.length) return () => {}
  const channel = supabase
    .channel(`portal_messages_multi:${tokens.length}_${Date.now()}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'portal_messages' },
      payload => {
        if (tokens.includes(payload?.new?.token)) {
          try { onInsert?.(payload.new) } catch (e) { console.error('[subscribePortalMessagesForTokens cb]', e) }
        }
      },
    )
    .subscribe()
  return () => { try { supabase.removeChannel(channel) } catch (e) { console.error('[unsub messages multi]', e) } }
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
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session, event)
  })
  return () => data.subscription.unsubscribe()
}

// CRM owner password reset — sends the recovery email, link lands on the app root.
export async function sendPasswordReset(email) {
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined
  return supabase.auth.resetPasswordForEmail(email, { redirectTo })
}

export async function updateOwnPassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword })
}
