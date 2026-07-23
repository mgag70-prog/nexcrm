// Scheduled sync — every 15 minutes via the in-code `config.schedule` below
// (the netlify.toml-only form did not register on deploy, which also left the
// endpoint publicly invokable). Manual runs go through google-sync-now.

import { adminClient } from './_shared.js'
import { syncConnection } from './lib/google.js'

export default async (req) => {
  // Netlify's scheduler invokes with a JSON body containing next_run. This
  // check is spoofable (any caller can send the field) — the real controls
  // are (1) platform-level blocking of HTTP calls to registered scheduled
  // functions, and (2) the throttle below, which makes a spoofed trigger do
  // no repeated Google API work. Do NOT treat this field as authentication.
  let nextRun = null
  try { nextRun = (await req.json())?.next_run } catch { /* no body */ }
  if (!nextRun) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })

  const admin = adminClient()
  // Throttle: skip connections synced in the last 5 minutes. Caps the damage
  // of any spoofed/repeated trigger at one sync per connection per window;
  // the authed google-sync-now path bypasses this deliberately.
  const cutoff = new Date(Date.now() - 5 * 60000).toISOString()
  const { data: conns, error } = await admin.from('google_connections')
    .select('*').eq('status', 'active')
    .or(`last_sync_at.is.null,last_sync_at.lt.${cutoff}`)
  if (error) {
    console.error('[google-sync] list failed:', error.message)
    return new Response(JSON.stringify({ error: 'list failed' }), { status: 500 })
  }
  const results = []
  for (const conn of conns || []) {
    results.push(await syncConnection(admin, conn))
  }
  console.log('[google-sync]', JSON.stringify(results.map((r) => ({
    connection: r.connection, error: r.error || null,
    mail: r.gmail?.stored ?? null, events: r.calendar?.stored ?? null,
  }))))
  return new Response(JSON.stringify({ synced: results.length }), { status: 200 })
}

export const config = {
  schedule: '*/15 * * * *',
}
