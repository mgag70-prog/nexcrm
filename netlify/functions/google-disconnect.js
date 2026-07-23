// POST /.netlify/functions/google-disconnect
// Body: { connectionId }
// Auth: Bearer <owner/admin of the account that owns the connection>
// Revokes with Google, deletes the token row, marks the connection revoked.
// Synced email/calendar history is intentionally left in place.

import { adminClient, requireOwner, requireAccountRole, ok, bad, preflight } from './_shared.js'
import { revokeToken } from './lib/google.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  const caller = await requireOwner(event.headers.authorization || event.headers.Authorization)
  if (!caller) return bad(401, 'Not authenticated')

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return bad(400, 'Invalid JSON') }
  const { connectionId } = body
  if (!connectionId) return bad(400, 'Missing connectionId')

  const admin = adminClient()
  const { data: conn } = await admin.from('google_connections')
    .select('id, account_id').eq('id', connectionId).maybeSingle()
  if (!conn) return bad(404, 'Connection not found')

  const role = await requireAccountRole(admin, caller.id, conn.account_id)
  if (!role) return bad(403, 'You must be an owner or admin of this account to disconnect')

  const { data: tok } = await admin.from('google_tokens')
    .select('refresh_token').eq('connection_id', connectionId).maybeSingle()
  if (tok?.refresh_token) await revokeToken(tok.refresh_token)

  await admin.from('google_tokens').delete().eq('connection_id', connectionId)
  const { error } = await admin.from('google_connections').update({
    status: 'revoked', last_error: null, gmail_history_id: null, calendar_sync_token: null,
  }).eq('id', connectionId)
  if (error) return bad(500, `disconnect failed: ${error.message}`)

  return ok({ revoked: true })
}
