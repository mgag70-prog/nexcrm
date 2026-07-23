// Scheduled function (see netlify.toml: every 15 minutes).
// Netlify's scheduler is the only caller — scheduled functions are not
// reachable over HTTP. Manual runs go through google-sync-now instead.

import { adminClient } from './_shared.js'
import { syncConnection } from './_google.js'

export async function handler() {
  const admin = adminClient()
  const { data: conns, error } = await admin.from('google_connections')
    .select('*').eq('status', 'active')
  if (error) {
    console.error('[google-sync] list failed:', error.message)
    return { statusCode: 500, body: 'list failed' }
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
