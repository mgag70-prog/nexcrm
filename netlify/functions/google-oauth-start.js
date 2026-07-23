// POST /.netlify/functions/google-oauth-start
// Body: { accountId, entityId }
// Auth: Bearer <CRM owner/admin JWT>
// Returns { url } — the Google consent URL the browser should navigate to.

import { adminClient, requireOwner, requireAccountRole, ok, bad, preflight } from './_shared.js'
import { signState, buildConsentUrl } from './_google.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  const caller = await requireOwner(event.headers.authorization || event.headers.Authorization)
  if (!caller) return bad(401, 'Not authenticated')

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return bad(400, 'Invalid JSON') }
  const { accountId, entityId } = body
  if (!accountId || !entityId) return bad(400, 'Missing accountId or entityId')

  const admin = adminClient()
  const role = await requireAccountRole(admin, caller.id, accountId)
  if (!role) return bad(403, 'You must be an owner or admin of this account to connect Google')

  const state = signState({ accountId, entityId })
  return ok({ url: buildConsentUrl(event.headers.host, state) })
}
