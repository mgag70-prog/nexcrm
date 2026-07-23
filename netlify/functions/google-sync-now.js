// POST /.netlify/functions/google-sync-now
// Body: { connectionId }
// Auth: Bearer <owner/admin of the connection's account>
// Manual "Sync now" — same core as the scheduled run, one connection.

import { adminClient, requireOwner, requireAccountRole, ok, bad, preflight } from './_shared.js'
import { syncConnection } from './_google.js'

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
    .select('*').eq('id', connectionId).maybeSingle()
  if (!conn) return bad(404, 'Connection not found')

  const role = await requireAccountRole(admin, caller.id, conn.account_id)
  if (!role) return bad(403, 'You must be an owner or admin of this account to sync')
  if (conn.status === 'revoked') return bad(409, 'Connection is revoked — reconnect first')

  const result = await syncConnection(admin, conn)
  return ok(result)
}
