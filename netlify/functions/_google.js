// Shared Google integration helpers: OAuth URLs, signed state, token refresh,
// and the Gmail/Calendar sync core. Service-role only — never imported by
// browser code. Tokens must never be logged; log counts and error messages.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
// HMAC key for the OAuth state parameter. The service role key is server-only
// and long — fine as an HMAC secret; no extra env var to manage.
const STATE_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

const STATE_TTL_MS = 10 * 60 * 1000
const b64url = (buf) => Buffer.from(buf).toString('base64url')

export function redirectUriFor(host) {
  return `https://${host}/.netlify/functions/google-oauth-callback`
}

// ── Signed, short-lived state (CSRF protection) ─────────────────────────────
export function signState({ accountId, entityId }) {
  const payload = JSON.stringify({
    a: accountId,
    e: entityId,
    n: randomBytes(8).toString('hex'),
    x: Date.now() + STATE_TTL_MS,
  })
  const mac = createHmac('sha256', STATE_SECRET).update(payload).digest()
  return `${b64url(payload)}.${b64url(mac)}`
}

export function verifyState(state) {
  try {
    const [p, m] = String(state || '').split('.')
    if (!p || !m) return null
    const payload = Buffer.from(p, 'base64url').toString('utf8')
    const given = Buffer.from(m, 'base64url')
    const expected = createHmac('sha256', STATE_SECRET).update(payload).digest()
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
    const data = JSON.parse(payload)
    if (!data.a || !data.e || !data.x || Date.now() > data.x) return null
    return { accountId: data.a, entityId: data.e }
  } catch {
    return null
  }
}

export function buildConsentUrl(host, state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUriFor(host),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

// ── Token endpoints ─────────────────────────────────────────────────────────
export async function exchangeCode(code, host) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUriFor(host),
      grant_type: 'authorization_code',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'token exchange failed')
  return data // { access_token, refresh_token, expires_in, scope, ... }
}

export async function fetchUserinfo(accessToken) {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json()
  if (!res.ok) throw new Error('userinfo failed')
  return data // { email, ... }
}

export async function revokeToken(token) {
  // Best effort — Google returns 200 even for already-revoked in most cases.
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' })
    return true
  } catch (e) {
    console.error('[google revoke] failed:', e?.message)
    return false
  }
}

// Marker error so the sync loop can distinguish "reconnect required".
export class GoogleAuthError extends Error {}

async function ensureAccessToken(admin, connectionId, tok) {
  const expiresAt = tok.token_expires_at ? new Date(tok.token_expires_at).getTime() : 0
  if (tok.access_token && expiresAt > Date.now() + 120000) return tok.access_token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: tok.refresh_token,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    if (data.error === 'invalid_grant') throw new GoogleAuthError('invalid_grant')
    throw new Error(data.error_description || data.error || 'token refresh failed')
  }
  await admin.from('google_tokens').update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('connection_id', connectionId)
  return data.access_token
}

async function gapi(accessToken, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (res.status === 401) throw new GoogleAuthError('unauthorized')
  if (res.status === 404 || res.status === 410) return { __gone: res.status }
  const data = await res.json()
  if (!res.ok) throw new Error(`google api ${res.status}: ${data?.error?.message || url.split('?')[0]}`)
  return data
}

// Small concurrency pool for per-message fetches.
async function pool(items, limit, fn) {
  const out = []
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      try { out[idx] = await fn(items[idx]) } catch (e) {
        if (e instanceof GoogleAuthError) throw e
        console.error('[google sync] item failed:', e?.message)
        out[idx] = null
      }
    }
  })
  await Promise.all(workers)
  return out
}

// ── Parsing helpers ─────────────────────────────────────────────────────────
const header = (msg, name) =>
  msg.payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || ''

export function parseAddressList(raw) {
  if (!raw) return []
  return raw.split(',').map((part) => {
    const angled = part.match(/<([^>]+)>/)
    const email = (angled ? angled[1] : part).trim().toLowerCase()
    const name = angled ? part.replace(/<[^>]+>/, '').replace(/["']/g, '').trim() : ''
    return email.includes('@') ? { email, name } : null
  }).filter(Boolean)
}

function decodeBody(data) {
  try { return Buffer.from(data, 'base64url').toString('utf8') } catch { return '' }
}

function extractBody(payload) {
  if (!payload) return { text: '', hasAttachments: false }
  let text = ''
  let html = ''
  let hasAttachments = false
  const walk = (part) => {
    if (!part) return
    if (part.filename) hasAttachments = true
    if (part.mimeType === 'text/plain' && part.body?.data && !text) text = decodeBody(part.body.data)
    else if (part.mimeType === 'text/html' && part.body?.data && !html) html = decodeBody(part.body.data)
    ;(part.parts || []).forEach(walk)
  }
  walk(payload)
  if (!text && html) text = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return { text: text.slice(0, 20000), hasAttachments }
}

// Per-run work caps: the scheduled function must finish inside Netlify's
// synchronous timeout. Baseline restarts are cheap and idempotent (upsert +
// already-stored id skip), so large backfills complete across several runs.
const BASELINE_LIST_CAP = 500
const META_FETCH_CAP = 60

async function loadEntityContacts(admin, conn) {
  const { data } = await admin.from('crm_store').select('value')
    .eq('account_id', conn.account_id).eq('key', 'crm:contacts').maybeSingle()
  const map = new Map()
  try {
    for (const c of JSON.parse(data?.value || '[]')) {
      if (c.entityId === conn.entity_id && c.email) {
        map.set(String(c.email).toLowerCase(), { id: c.id, companyId: c.companyId || null })
      }
    }
  } catch (e) { console.error('[google sync] contacts parse failed:', e?.message) }
  return map
}

// ── Gmail sync ──────────────────────────────────────────────────────────────
async function syncGmail(admin, conn, accessToken, contacts) {
  const ownEmail = conn.email_address.toLowerCase()
  let ids = []
  let newHistoryId = null
  let baselineMode = !conn.gmail_history_id

  if (!baselineMode) {
    // Incremental via history. 404 means the history id expired — fall back
    // to a fresh baseline next run.
    let pageToken = ''
    for (let page = 0; page < 10; page++) {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${conn.gmail_history_id}&historyTypes=messageAdded&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`
      const data = await gapi(accessToken, url)
      if (data.__gone) {
        await admin.from('google_connections').update({ gmail_history_id: null }).eq('id', conn.id)
        return { stored: 0, note: 'history expired — baseline next run' }
      }
      newHistoryId = data.historyId || newHistoryId
      for (const h of data.history || []) {
        for (const m of h.messagesAdded || []) if (m.message?.id) ids.push(m.message.id)
      }
      pageToken = data.nextPageToken
      if (!pageToken) break
    }
    ids = [...new Set(ids)]
  } else {
    // Baseline: newest-first list of the last 90 days, hard cap 500.
    let pageToken = ''
    while (ids.length < BASELINE_LIST_CAP) {
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=newer_than:90d&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`
      const data = await gapi(accessToken, url)
      ids.push(...(data.messages || []).map((m) => m.id))
      pageToken = data.nextPageToken
      if (!pageToken) break
    }
    ids = ids.slice(0, BASELINE_LIST_CAP)
  }

  // Skip messages we already stored (makes baseline restartable).
  const { data: existing } = await admin.from('email_messages')
    .select('gmail_message_id').eq('connection_id', conn.id).limit(1000)
  const seen = new Set((existing || []).map((r) => r.gmail_message_id))
  const todo = ids.filter((id) => !seen.has(id))
  const batch = todo.slice(0, META_FETCH_CAP)
  const baselineComplete = todo.length <= batch.length

  // Metadata first: match against entity contacts BEFORE fetching bodies, so
  // unmatched inbox noise costs one cheap call and is never stored.
  const metas = await pool(batch, 8, (id) =>
    gapi(accessToken, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`))

  const matched = []
  for (const meta of metas) {
    if (!meta || meta.__gone) continue
    const from = parseAddressList(header(meta, 'From'))[0] || null
    const to = parseAddressList(header(meta, 'To'))
    const cc = parseAddressList(header(meta, 'Cc'))
    const direction = from && from.email === ownEmail ? 'out' : 'in'
    const ordered = direction === 'in' ? [from, ...to, ...cc] : [...to, ...cc, from]
    const hit = ordered.find((p) => p && contacts.has(p.email))
    if (!hit) continue // not a CRM contact — never stored
    matched.push({ meta, from, to, cc, direction, contact: contacts.get(hit.email) })
  }

  const rows = await pool(matched, 8, async (m) => {
    const full = await gapi(accessToken, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.meta.id}?format=full`)
    if (!full || full.__gone) return null
    const { text, hasAttachments } = extractBody(full.payload)
    const sentMs = Number(full.internalDate) || Date.parse(header(full, 'Date')) || Date.now()
    return {
      account_id: conn.account_id,
      entity_id: conn.entity_id,
      connection_id: conn.id,
      gmail_message_id: full.id,
      gmail_thread_id: full.threadId || null,
      direction: m.direction,
      from_email: m.from?.email || null,
      from_name: m.from?.name || null,
      to_emails: m.to.map((p) => p.email),
      cc_emails: m.cc.map((p) => p.email),
      subject: header(full, 'Subject') || null,
      snippet: full.snippet || null,
      body_text: text || null,
      sent_at: new Date(sentMs).toISOString(),
      contact_id: m.contact.id,
      company_id: m.contact.companyId,
      has_attachments: hasAttachments,
    }
  })
  const clean = rows.filter(Boolean)
  if (clean.length) {
    const { error } = await admin.from('email_messages')
      .upsert(clean, { onConflict: 'connection_id,gmail_message_id' })
    if (error) throw new Error(`email upsert failed: ${error.message}`)
  }

  // Advance the cursor only when this run finished its window: incremental
  // always does; baseline only once every listed message has been processed.
  if (!baselineMode && newHistoryId) {
    await admin.from('google_connections').update({ gmail_history_id: newHistoryId }).eq('id', conn.id)
  } else if (baselineMode && baselineComplete) {
    const profile = await gapi(accessToken, 'https://gmail.googleapis.com/gmail/v1/users/me/profile')
    if (profile?.historyId) {
      await admin.from('google_connections').update({ gmail_history_id: String(profile.historyId) }).eq('id', conn.id)
    }
  }
  return { stored: clean.length, scanned: batch.length, baseline: baselineMode, baselineComplete }
}

// ── Calendar sync ───────────────────────────────────────────────────────────
async function syncCalendar(admin, conn, accessToken, contacts) {
  const base = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  let items = []
  let nextSyncToken = null
  let pageToken = ''
  let useSyncToken = !!conn.calendar_sync_token

  for (let page = 0; page < 8; page++) {
    let url
    if (useSyncToken) {
      url = `${base}?syncToken=${encodeURIComponent(conn.calendar_sync_token)}&maxResults=250${pageToken ? `&pageToken=${pageToken}` : ''}`
    } else {
      const timeMin = new Date(Date.now() - 14 * 864e5).toISOString()
      const timeMax = new Date(Date.now() + 60 * 864e5).toISOString()
      url = `${base}?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&maxResults=250${pageToken ? `&pageToken=${pageToken}` : ''}`
    }
    const data = await gapi(accessToken, url)
    if (data.__gone) {
      // 410: sync token expired — restart with a full window fetch.
      await admin.from('google_connections').update({ calendar_sync_token: null }).eq('id', conn.id)
      useSyncToken = false
      pageToken = ''
      items = []
      continue
    }
    items.push(...(data.items || []))
    pageToken = data.nextPageToken
    nextSyncToken = data.nextSyncToken || nextSyncToken
    if (!pageToken) break
  }

  const rows = items.filter((ev) => ev.id).map((ev) => {
    const allDay = !!ev.start?.date
    const startRaw = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null)
    const endRaw = ev.end?.dateTime || (ev.end?.date ? `${ev.end.date}T00:00:00Z` : null)
    const attendees = (ev.attendees || []).map((a) => ({
      email: (a.email || '').toLowerCase(), name: a.displayName || '', response: a.responseStatus || '',
    }))
    const hit = attendees.find((a) => contacts.has(a.email))
    return {
      account_id: conn.account_id,
      entity_id: conn.entity_id,
      connection_id: conn.id,
      google_event_id: ev.id,
      calendar_id: 'primary',
      title: ev.summary || null,
      description: (ev.description || '').slice(0, 5000) || null,
      location: ev.location || null,
      start_at: startRaw ? new Date(startRaw).toISOString() : null,
      end_at: endRaw ? new Date(endRaw).toISOString() : null,
      all_day: allDay,
      attendees,
      organizer_email: (ev.organizer?.email || '').toLowerCase() || null,
      // Cancelled events arrive via incremental sync as status:'cancelled'
      // with minimal fields — the upsert updates status rather than deleting.
      status: ['confirmed', 'tentative', 'cancelled'].includes(ev.status) ? ev.status : 'confirmed',
      contact_id: hit ? contacts.get(hit.email).id : null,
      recurring_event_id: ev.recurringEventId || null,
      updated_at: ev.updated ? new Date(ev.updated).toISOString() : new Date().toISOString(),
    }
  })
  if (rows.length) {
    const { error } = await admin.from('calendar_events')
      .upsert(rows, { onConflict: 'connection_id,google_event_id' })
    if (error) throw new Error(`calendar upsert failed: ${error.message}`)
  }
  if (nextSyncToken) {
    await admin.from('google_connections').update({ calendar_sync_token: nextSyncToken }).eq('id', conn.id)
  }
  return { stored: rows.length }
}

// ── Per-connection driver ───────────────────────────────────────────────────
export async function syncConnection(admin, conn) {
  const { data: tok } = await admin.from('google_tokens')
    .select('refresh_token, access_token, token_expires_at')
    .eq('connection_id', conn.id).maybeSingle()
  if (!tok?.refresh_token) {
    await admin.from('google_connections')
      .update({ status: 'error', last_error: 'token row missing — reconnect required' }).eq('id', conn.id)
    return { connection: conn.id, error: 'no token' }
  }
  try {
    const accessToken = await ensureAccessToken(admin, conn.id, tok)
    const contacts = await loadEntityContacts(admin, conn)
    const gmail = await syncGmail(admin, conn, accessToken, contacts)
    const calendar = await syncCalendar(admin, conn, accessToken, contacts)
    await admin.from('google_connections')
      .update({ last_sync_at: new Date().toISOString(), last_error: null, status: 'active' })
      .eq('id', conn.id)
    return { connection: conn.id, email: conn.email_address, gmail, calendar }
  } catch (e) {
    if (e instanceof GoogleAuthError) {
      // Do NOT retry in a loop — surface for reconnect.
      await admin.from('google_connections')
        .update({ status: 'error', last_error: `${e.message} — reconnect required` }).eq('id', conn.id)
      return { connection: conn.id, error: e.message }
    }
    await admin.from('google_connections')
      .update({ last_error: String(e?.message || e).slice(0, 500) }).eq('id', conn.id)
    return { connection: conn.id, error: String(e?.message || e) }
  }
}
