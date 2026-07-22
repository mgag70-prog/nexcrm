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

// ─── ACCOUNTS (multi-user team access) ──────────────────────────────────────
// Data belongs to an ACCOUNT; users are members of one or more accounts with a
// role in each. The storage adapter below is account-scoped: nothing reads or
// writes crm_store until resolveAccounts() has picked an active account.

let activeAccountId = null
let myAccounts = [] // [{ id, name, plan, role, createdAt }]

const activeAccountStorageKey = (userId) => `hqops:activeAccount:${userId}`

// Resolve the accounts this user belongs to and pick the active one
// (last used from localStorage if still a member, else the first).
// A brand-new signup has no account yet — bootstrap one via create_account().
export async function resolveAccounts() {
  const userId = await requireUserId()
  // RLS lets members see ALL membership rows of their accounts (the Team tab
  // needs that) — filter to OUR rows or a teammate's role would leak in here.
  const { data, error } = await supabase
    .from('account_members')
    .select('role, account:accounts(id, name, plan, created_at)')
    .eq('user_id', userId)
  if (error) throw error
  let accounts = (data || [])
    .filter((r) => r.account)
    .map((r) => ({
      id: r.account.id,
      name: r.account.name,
      plan: r.account.plan,
      role: r.role,
      createdAt: r.account.created_at,
    }))
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  if (!accounts.length) {
    const { data: sess } = await supabase.auth.getSession()
    const user = sess?.session?.user
    // Never bootstrap a CRM account for a portal client that strays here.
    if (user?.user_metadata?.role === 'portal_client') {
      throw new Error('Portal client accounts cannot use the CRM — visit /portal/login instead')
    }
    const email = user?.email || ''
    const name = email ? email.split('@')[0] : 'My Workspace'
    const { data: newId, error: cErr } = await supabase.rpc('create_account', { p_name: name })
    if (cErr) throw cErr
    accounts = [{ id: newId, name, plan: 'free', role: 'owner', createdAt: new Date().toISOString() }]
  }
  myAccounts = accounts
  let saved = null
  try { saved = localStorage.getItem(activeAccountStorageKey(userId)) } catch { /* private mode */ }
  const active = accounts.find((a) => a.id === saved) || accounts[0]
  activeAccountId = active.id
  try { localStorage.setItem(activeAccountStorageKey(userId), active.id) } catch { /* private mode */ }
  return { accounts, active }
}

export function listMyAccounts() {
  return myAccounts
}

export function getActiveAccount() {
  return myAccounts.find((a) => a.id === activeAccountId) || null
}

export function getMyRole(accountId) {
  const acc = myAccounts.find((a) => a.id === (accountId || activeAccountId))
  return acc?.role || null
}

// Persist + activate an account choice. When called before resolveAccounts()
// (e.g. from the invite-accept page) membership can't be validated locally,
// so we just persist the choice for the next load.
export async function setActiveAccount(id) {
  if (!id) throw new Error('Missing account id')
  if (myAccounts.length && !myAccounts.some((a) => a.id === id)) {
    throw new Error('Not a member of that account')
  }
  const userId = await requireUserId()
  try { localStorage.setItem(activeAccountStorageKey(userId), id) } catch { /* private mode */ }
  activeAccountId = id
}

function requireAccountId() {
  if (!activeAccountId) throw new Error('No active account — resolveAccounts() has not completed')
  return activeAccountId
}

export const storage = {
  async get(key) {
    try {
      await requireUserId()
      const accountId = requireAccountId()
      const { data, error } = await supabase
        .from('crm_store')
        .select('key, value')
        .eq('account_id', accountId)
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
      const accountId = requireAccountId()
      const { error } = await supabase
        .from('crm_store')
        .upsert(
          // user_id records the last writer; it is no longer part of the PK.
          { key, value: String(value), account_id: accountId, user_id: userId },
          { onConflict: 'account_id,key' },
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
      await requireUserId()
      const accountId = requireAccountId()
      const { error } = await supabase
        .from('crm_store')
        .delete()
        .eq('account_id', accountId)
        .eq('key', key)
      if (error) console.error('[storage.delete]', key, error)
    } catch (e) {
      console.error('[storage.delete] threw for', key, e)
    }
  },
  async list(prefix) {
    try {
      await requireUserId()
      const accountId = requireAccountId()
      const { data, error } = await supabase
        .from('crm_store')
        .select('key')
        .eq('account_id', accountId)
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
    const row = { token, payload, created_at: new Date().toISOString() }
    // Stamp the owning account so the portal admin functions can verify who
    // may manage this portal. Only the CRM side calls this, so the active
    // account is the owner; portal pages never write snapshots.
    if (activeAccountId) row.account_id = activeAccountId
    const { error } = await supabase.from('portal_snapshots').upsert(row)
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
  const accountId = requireAccountId()
  return postFn('portal-create', { email, scope, scopeId, entityId, payload, settings, accountId })
}

export async function adminRegeneratePortalPassword({ userId, token }) {
  return postFn('portal-regenerate', { userId, token })
}

export async function adminRevokePortal({ userId, token }) {
  return postFn('portal-revoke', { userId, token })
}

// ─── TEAM MANAGEMENT ────────────────────────────────────────────────────────
// Member mutations go through SECURITY DEFINER functions in Postgres so the
// role rules (exactly one owner, owner untouchable) hold even if the UI is
// bypassed. Reads use RLS-gated tables/RPCs.

export async function listAccountMembers(accountId) {
  const { data, error } = await supabase.rpc('list_account_members', { p_account_id: accountId })
  if (error) throw error
  return data || []
}

export async function listAccountInvites(accountId) {
  const { data, error } = await supabase
    .from('account_invites')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createAccountInvite({ accountId, email, role }) {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('account_invites')
    .insert({ account_id: accountId, email, role, invited_by: userId })
    .select()
    .single()
  if (error) throw error
  return data // includes the generated token
}

export async function revokeAccountInvite(inviteId) {
  const { error } = await supabase.from('account_invites').delete().eq('id', inviteId)
  if (error) throw error
}

export async function setMemberRole(accountId, userId, role) {
  const { error } = await supabase.rpc('set_member_role', {
    p_account_id: accountId, p_user_id: userId, p_role: role,
  })
  if (error) throw error
}

export async function removeMember(accountId, userId) {
  const { error } = await supabase.rpc('remove_member', {
    p_account_id: accountId, p_user_id: userId,
  })
  if (error) throw error
}

export async function transferOwnership(accountId, newOwnerUserId) {
  const { error } = await supabase.rpc('transfer_ownership', {
    p_account_id: accountId, p_new_owner: newOwnerUserId,
  })
  if (error) throw error
}

// ─── INVITE ACCEPT FLOW (/invite/:token) ────────────────────────────────────

export async function getInvite(token) {
  const { data, error } = await supabase.rpc('get_invite', { p_token: token })
  if (error) throw error
  return data?.[0] || null // null → invalid token
}

export async function acceptInvite(token) {
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token })
  if (error) throw error
  return data // the joined account's id
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
