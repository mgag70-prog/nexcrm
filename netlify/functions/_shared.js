// Shared helpers for portal admin Netlify Functions.
// These run server-side so the SUPABASE_SERVICE_ROLE_KEY never reaches the client.

import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

export function adminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.')
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Authenticate the calling CRM owner from their bearer token.
// Returns the user object on success, or null on failure.
export async function requireOwner(authHeader) {
  const token = (authHeader || '').replace(/^Bearer /, '').trim()
  if (!token) return null
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  // Portal clients are auth users of this same project — a portal client's JWT
  // must not pass owner validation for admin operations.
  if (data.user.user_metadata?.role === 'portal_client') return null
  return data.user
}

// Verify the calling user is an owner or admin of the given account.
// Returns their role string, or null if they aren't (or accountId is missing).
// Uses the service-role client — account_members RLS doesn't apply here, so
// the check itself is authoritative.
export async function requireAccountRole(admin, userId, accountId, roles = ['owner', 'admin']) {
  if (!userId || !accountId) return null
  const { data, error } = await admin
    .from('account_members')
    .select('role')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return roles.includes(data.role) ? data.role : null
}

export function ok(body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  }
}

export function bad(status, message) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ error: message }),
  }
}

export function preflight() {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
    body: '',
  }
}

// Random temp password — 12 chars, mixed alphabet. CSPRNG, not Math.random():
// whoever logs in first with this password owns the portal account, so a
// predictable value is a takeover path.
export function genTempPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) out += alphabet[randomInt(alphabet.length)]
  return out
}
