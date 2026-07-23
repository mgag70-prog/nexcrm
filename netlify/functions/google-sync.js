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
  // Skip connections synced in the last 5 minutes. The authed google-sync-now
  // path bypasses this deliberately.
  const cutoff = new Date(Date.now() - 5 * 60000).toISOString()
  const { data: conns, error } = await admin.from('google_connections')
    .select('*').eq('status', 'active')
    .or(`last_sync_at.is.null,last_sync_at.lt.${cutoff}`)
  if (error) {
    console.error('[google-sync] list failed:', error.message)
    return { statusCode: 500, body: JSON.stringify({ error: 'list failed' }) }
  }
  const results = []
  for (const conn of conns || []) {
    results.push(await syncConnection(admin, conn))
  }
  console.log('[google-sync]', JSON.stringify(results.map((r) => ({
    connection: r.connection, error: r.error || null,
    mail: r.gmail?.stored ?? null, events: r.calendar?.stored ?? null,
  }))))
  return { statusCode: 200, body: JSON.stringify({ synced: results.length }) }
}

export const handler = schedule('*/15 * * * *', run)
