// Scheduled sync — every 15 minutes via the @netlify/functions schedule()
// wrapper (both the netlify.toml-only form and the v2 config.schedule export
// failed to register on this site). Manual runs go through google-sync-now.

import { schedule } from '@netlify/functions'
import { adminClient } from './_shared.js'
import { syncConnection } from './lib/google.js'

async function run(event) {
  // Netlify's scheduler sends a JSON body containing next_run. This check is
  // spoofable (any caller can send the field) — it is NOT authentication.
  // The real abuse cap is the throttle below: a spoofed or repeated trigger
  // performs no repeated Google API work.
  let nextRun = null
  try { nextRun = JSON.parse(event.body || '{}')?.next_run } catch { /* no body */ }
  if (!nextRun) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) }

  const admin = adminClient()
  // Skip connections synced in the last 14 minutes — just under the 15-minute
  // schedule interval, so an external trigger can never cause work the
  // scheduler wasn't already about to do. The authed google-sync-now path
  // bypasses this deliberately.
  const cutoff = new Date(Date.now() - 14 * 60000).toISOString()
  const { data: conns, error } = await admin.from('google_connections')
    .select('*').eq('status', 'active')
    .or(`last_sync_at.is.null,last_sync_at.lt.${cutoff}`)
  if (error) {
    console.error('[google-sync] list failed:', error.message)
    return { statusCode: 500, body: '' }
  }
  const results = []
  for (const conn of conns || []) {
    results.push(await syncConnection(admin, conn))
  }
  console.log('[google-sync]', JSON.stringify(results.map((r) => ({
    connection: r.connection, error: r.error || null,
    mail: r.gmail?.stored ?? null, events: r.calendar?.stored ?? null,
  }))))
  // 204, no body: sync detail goes to logs only — a count would leak
  // platform-wide connection numbers to unauthenticated callers.
  return { statusCode: 204, body: '' }
}

export const handler = schedule('*/15 * * * *', run)
