// POST /.netlify/functions/portal-create
// Body: { email, scope: "contact"|"company", scopeId, entityId, payload, settings }
// Auth: Bearer <owner JWT> in Authorization header
// Action: creates Supabase auth user with auto-generated password,
//         inserts portal_clients row + portal_snapshots row,
//         returns { token, password, portalUrl }

import { randomBytes } from 'node:crypto'
import { adminClient, requireOwner, requireAccountRole, ok, bad, preflight, genTempPassword } from './_shared.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  const owner = await requireOwner(event.headers.authorization || event.headers.Authorization)
  if (!owner) return bad(401, 'Not authenticated')

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return bad(400, 'Invalid JSON') }
  const { email, scope, scopeId, entityId, payload, settings, accountId } = body
  if (!email || !scope || !scopeId || !entityId) return bad(400, 'Missing required fields')
  if (!accountId) return bad(400, 'Missing accountId')
  if (scope !== 'contact' && scope !== 'company') return bad(400, 'Invalid scope')

  const admin = adminClient()

  // The caller must be an owner/admin of the account this portal will belong
  // to — being any authenticated CRM user is not enough.
  const role = await requireAccountRole(admin, owner.id, accountId)
  if (!role) return bad(403, 'You must be an owner or admin of this account to create portals')

  const password = genTempPassword()

  // Create auth user
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'portal_client', scope, scopeId, entityId, ownerId: owner.id },
  })
  if (createErr) {
    // If the user already exists, return a clear error so the CRM can prompt the owner to regenerate instead.
    return bad(409, createErr.message || 'Could not create portal user')
  }
  const userId = created?.user?.id
  if (!userId) return bad(500, 'User created but no id returned')

  // Portal token: with snapshot reads gated only by token knowledge, this is
  // the sole barrier — 192 bits from a CSPRNG, never Math.random().
  const token = randomBytes(24).toString('hex')

  // Insert portal_clients row
  const { error: clientErr } = await admin.from('portal_clients').insert({
    user_id: userId,
    token,
    entity_id: entityId,
    scope,
    scope_id: scopeId,
    first_login: true,
    account_id: accountId,
  })
  if (clientErr) {
    // Roll back the auth user to avoid orphan
    try { await admin.auth.admin.deleteUser(userId) } catch (e) { console.error('[portal-create] rollback deleteUser failed:', e?.message || e) }
    return bad(500, `portal_clients insert failed: ${clientErr.message}`)
  }

  // Write the initial snapshot
  const { error: snapErr } = await admin.from('portal_snapshots').upsert({
    token,
    payload: payload || {},
    scope,
    scope_id: scopeId,
    entity_id: entityId,
    settings: settings || {},
    created_at: new Date().toISOString(),
    account_id: accountId,
  })
  if (snapErr) {
    try { await admin.from('portal_clients').delete().eq('user_id', userId) } catch (e) { console.error('[portal-create] rollback portal_clients failed:', e?.message || e) }
    try { await admin.auth.admin.deleteUser(userId) } catch (e) { console.error('[portal-create] rollback deleteUser failed:', e?.message || e) }
    return bad(500, `portal_snapshots insert failed: ${snapErr.message}`)
  }

  return ok({
    userId,
    token,
    password,
    email,
    portalUrl: `${(event.headers['x-forwarded-proto'] || 'https')}://${event.headers.host}/portal/login?token=${token}`,
  })
}
