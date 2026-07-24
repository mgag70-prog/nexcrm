// POST /.netlify/functions/ai-claude
// Body: { messages: [...], max_tokens?, model?, system? }
// Auth: Bearer <owner JWT> in Authorization header
// Action: proxies a Messages request to the Anthropic API using the server-side
//         ANTHROPIC_API_KEY so the key never reaches the browser. Used by both
//         the AI import and the "Prep me" contact briefing (one integration).

import { requireOwner, ok, bad, preflight } from './_shared.js'

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const DEFAULT_MODEL = 'claude-sonnet-4-20250514'
const MAX_TOKENS_CAP = 2000

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight()
  if (event.httpMethod !== 'POST') return bad(405, 'Method not allowed')

  // Gate behind an authenticated CRM owner so the API key can't be burned by anon callers.
  const owner = await requireOwner(event.headers.authorization || event.headers.Authorization)
  if (!owner) return bad(401, 'Not authenticated')

  if (!ANTHROPIC_API_KEY) return bad(503, 'AI is not configured on the server (ANTHROPIC_API_KEY missing).')

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return bad(400, 'Invalid JSON') }
  const { messages, max_tokens, model, system } = body
  if (!Array.isArray(messages) || messages.length === 0) return bad(400, 'messages required')

  const payload = {
    model: model || DEFAULT_MODEL,
    max_tokens: Math.min(Math.max(+max_tokens || 1024, 1), MAX_TOKENS_CAP),
    messages,
  }
  if (system) payload.system = system

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    })
    const data = await resp.json().catch(() => null)
    if (!resp.ok) {
      const msg = data?.error?.message || `Anthropic request failed (${resp.status})`
      // Collapse upstream auth failures to 502 so the client never mistakes them for its own 401.
      return bad(resp.status === 401 || resp.status === 403 ? 502 : resp.status, msg)
    }
    return ok(data)
  } catch (e) {
    return bad(502, 'Could not reach the AI service')
  }
}
