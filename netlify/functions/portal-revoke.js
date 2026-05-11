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

  if (token) {
    await admin.from('portal_messages').delete().eq('token', token).catch(() => {})
    await admin.from('portal_snapshots').delete().eq('token', token).catch(() => {})
  }
  if (userId) {
    await admin.from('portal_clients').delete().eq('user_id', userId).catch(() => {})
    await admin.auth.admin.deleteUser(userId).catch(() => {})
  }
  return ok({ revoked: true })
}
