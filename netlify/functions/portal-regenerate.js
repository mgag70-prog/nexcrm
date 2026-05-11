// POST /.netlify/functions/portal-regenerate
// Body: { userId, token }  (token used as fallback if userId missing)
// Auth: Bearer <owner JWT>
// Action: generates new temp password, updates auth user, sets first_login=true

import { adminClient, requireOwner, ok, bad, preflight, genTempPassword } from './_shared.js'

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
    const { data, error } = await admin.from('portal_clients').select('user_id').eq('token', token).maybeSingle()
    if (error || !data?.user_id) return bad(404, 'Portal client not found for token')
    userId = data.user_id
  }

  const password = genTempPassword()
  const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password })
  if (updErr) return bad(500, `updateUser failed: ${updErr.message}`)

  // Force first-login flow next time
  await admin.from('portal_clients').update({ first_login: true }).eq('user_id', userId)

  return ok({ userId, password })
}
