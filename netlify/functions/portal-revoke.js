// POST /.netlify/functions/portal-revoke
// Body: { userId, token }  (token used as fallback)
// Auth: Bearer <owner JWT>
// Action: deletes Supabase auth user, deletes portal_clients + portal_snapshots rows

import { adminClient, requireOwner, requireAccountRole, ok, bad, preflight } from './_shared.js'

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
  // Resolve the portal row for its owning account; the caller must be
  // owner/admin of that account before anything is deleted.
  const query = admin.from('portal_clients').select('user_id, token, account_id')
  const { data: portalRow, error: rowErr } = await (userId
    ? query.eq('user_id', userId).maybeSingle()
    : query.eq('token', token).maybeSingle())
  if (rowErr || !portalRow) return bad(404, 'Portal client not found')
  userId = portalRow.user_id
  token = token || portalRow.token

  const role = await requireAccountRole(admin, owner.id, portalRow.account_id)
  if (!role) return bad(403, 'You must be an owner or admin of the account that owns this portal')

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
