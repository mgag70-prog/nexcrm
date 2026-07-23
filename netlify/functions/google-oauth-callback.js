// GET /.netlify/functions/google-oauth-callback?code=…&state=…
// Hit by Google's redirect — no bearer token. Authorization comes from the
// HMAC-signed, short-lived state that google-oauth-start issued to an
// owner/admin. Exchanges the code, records the connection, stores tokens
// (service-role only table), then bounces back into the app.

import { adminClient, bad } from './_shared.js'
import { verifyState, exchangeCode, fetchUserinfo, GOOGLE_SCOPES } from './lib/google.js'

const back = (host, params) => ({
  statusCode: 302,
  headers: { Location: `https://${host}/?${new URLSearchParams(params)}` },
  body: '',
})

export async function handler(event) {
  if (event.httpMethod !== 'GET') return bad(405, 'Method not allowed')
  const host = event.headers.host
  const { code, state, error } = event.queryStringParameters || {}

  if (error) return back(host, { google: 'error', reason: error })

  // Validate state BEFORE touching the code.
  const parsed = verifyState(state)
  if (!parsed) return back(host, { google: 'error', reason: 'invalid_state' })
  if (!code) return back(host, { google: 'error', reason: 'missing_code' })

  try {
    const tokens = await exchangeCode(code, host)
    if (!tokens.refresh_token) {
      // prompt=consent should always yield one; if not, bail loudly rather
      // than record a connection that can never sync.
      return back(host, { google: 'error', reason: 'no_refresh_token' })
    }
    const userinfo = await fetchUserinfo(tokens.access_token)
    const email = (userinfo.email || '').toLowerCase()
    if (!email) return back(host, { google: 'error', reason: 'no_email' })

    const admin = adminClient()
    const grantedScopes = (tokens.scope || GOOGLE_SCOPES.join(' ')).split(' ')

    // Reconnect for the same entity+email updates in place; cursors reset so
    // the next sync takes a fresh baseline.
    const { data: existing } = await admin.from('google_connections').select('id')
      .eq('account_id', parsed.accountId).eq('entity_id', parsed.entityId)
      .eq('email_address', email).maybeSingle()

    let connectionId
    if (existing) {
      connectionId = existing.id
      const { error: upErr } = await admin.from('google_connections').update({
        status: 'active', scopes: grantedScopes, connected_at: new Date().toISOString(),
        last_error: null, gmail_history_id: null, calendar_sync_token: null,
      }).eq('id', connectionId)
      if (upErr) throw new Error(`connection update failed: ${upErr.message}`)
    } else {
      const { data: created, error: insErr } = await admin.from('google_connections').insert({
        account_id: parsed.accountId, entity_id: parsed.entityId,
        provider: 'google', email_address: email, scopes: grantedScopes, status: 'active',
      }).select('id').single()
      if (insErr) throw new Error(`connection insert failed: ${insErr.message}`)
      connectionId = created.id
    }

    const { error: tokErr } = await admin.from('google_tokens').upsert({
      connection_id: connectionId,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (tokErr) throw new Error(`token store failed: ${tokErr.message}`)

    return back(host, { google: 'connected', email, entity: parsed.entityId })
  } catch (e) {
    console.error('[google-oauth-callback]', e?.message)
    return back(host, { google: 'error', reason: 'exchange_failed' })
  }
}
