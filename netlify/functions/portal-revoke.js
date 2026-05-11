// POST /.netlify/functions/portal-revoke
// Body: { userId, token }  (token used as fallback)
// Auth: Bearer <owner JWT>
// Action: deletes Supabase auth user, deletes portal_clients + portal_snapshots rows

import { adminClient, requireOwner, ok, bad, preflight } from './_shared.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  const owner = await requireOwner(event.headers.authorization || event.headers.Authorization)
  if (!owner) return bad(401, 'Not authenticated')

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return bad(400, 'Invalid JSON') }
  let { userId, token } = body
  if (!userId && !token) return bad(400, 'Missing userId or token')

  const admin = adminClient()
  if (!userId && token) {
    const { data } = await admin.from('portal_clients').select('user_id').eq('token', token).maybeSingle()
    userId = data?.user_id
  }

  // Each call is wrapped in try/catch — Supabase query builders aren't vanilla Promises
  // and don't have .catch(); they reject the awaited promise normally.
  const safe = async (label, fn) => {
    try { await fn() } catch (e) { console.error('[portal-revoke]', label, e?.message || e) }
  }
  if (token) {
    await safe('delete portal_messages', () => admin.from('portal_messages').delete().eq('token', token))
    await safe('delete portal_snapshots', () => admin.from('portal_snapshots').delete().eq('token', token))
  }
  if (userId) {
    await safe('delete portal_clients', () => admin.from('portal_clients').delete().eq('user_id', userId))
    await safe('delete auth user', () => admin.auth.admin.deleteUser(userId))
  }
  return ok({ revoked: true })
}
