// Invite accept page — /invite/:token
// If not logged in: shows the standard login/signup screen, then the accept
// card once a session exists. Expired / already-accepted / invalid tokens get
// clear messages instead of a crash.
import { useEffect, useState } from 'react'
import { getSession, onAuthChange, getInvite, acceptInvite, setActiveAccount } from './lib/supabase.js'
import Auth from './Auth.jsx'

const NAVY = '#0B1E3F'
const NAVY_LIGHT = '#162B55'
const NAVY_BORDER = '#1E3A6B'
const ACCENT = '#3B82F6'

const page = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: NAVY,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
  padding: 20,
}
const card = {
  width: '100%',
  maxWidth: 420,
  background: NAVY_LIGHT,
  border: `1px solid ${NAVY_BORDER}`,
  borderRadius: 16,
  padding: '32px 28px',
  color: '#FFFFFF',
}
const btnPrimary = {
  flex: 1,
  background: ACCENT,
  color: '#FFFFFF',
  border: 'none',
  borderRadius: 8,
  padding: '11px 16px',
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
}
const btnGhost = {
  flex: 1,
  background: 'rgba(255,255,255,0.06)',
  color: '#CBD5E1',
  border: `1px solid ${NAVY_BORDER}`,
  borderRadius: 8,
  padding: '11px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

function Shell({ children }) {
  return (
    <div style={page}>
      <div style={card}>
        <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 18 }}>
          HQ<span style={{ color: ACCENT }}>Ops</span>
        </div>
        {children}
      </div>
    </div>
  )
}

function StatusCard({ title, message }) {
  return (
    <Shell>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6, marginBottom: 20 }}>{message}</div>
      <a href="/" style={{ ...btnPrimary, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Go to HQOps</a>
    </Shell>
  )
}

export default function InvitePage({ token }) {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [invite, setInvite] = useState(undefined)   // undefined = loading, null = invalid
  const [inviteError, setInviteError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [acceptError, setAcceptError] = useState(null)

  useEffect(() => {
    getSession().then(setSession)
    return onAuthChange((s) => setSession(s))
  }, [])

  useEffect(() => {
    let cancelled = false
    getInvite(token)
      .then((row) => { if (!cancelled) setInvite(row) })
      .catch((e) => { if (!cancelled) setInviteError(e?.message || 'Could not load invite') })
    return () => { cancelled = true }
  }, [token])

  const accept = async () => {
    setBusy(true)
    setAcceptError(null)
    try {
      const accountId = await acceptInvite(token)
      await setActiveAccount(accountId)
      window.location.href = '/'
    } catch (e) {
      const msg = String(e?.message || e)
      if (msg.includes('invite_expired')) setAcceptError('This invite has expired. Ask for a new one.')
      else if (msg.includes('already_accepted')) setAcceptError('This invite has already been used.')
      else if (msg.includes('invalid_invite')) setAcceptError('This invite link is not valid.')
      else setAcceptError(msg || 'Could not accept the invite.')
      setBusy(false)
    }
  }

  if (!token) return <StatusCard title="Invalid invite link" message="This link is missing its invite code. Check that you copied the full URL." />
  if (inviteError) return <StatusCard title="Something went wrong" message={`Could not load this invite: ${inviteError}. Refresh to try again.`} />
  if (invite === undefined || session === undefined) {
    return (
      <div style={{ ...page, color: '#FFFFFF', fontSize: 13, letterSpacing: 1 }}>Loading…</div>
    )
  }
  if (invite === null) return <StatusCard title="Invite not found" message="This invite link is not valid. It may have been revoked, or the URL was copied incompletely." />
  if (invite.status === 'expired') return <StatusCard title="Invite expired" message={`This invite to ${invite.account_name} has expired. Ask the person who invited you to send a fresh link.`} />
  if (invite.status === 'accepted') return <StatusCard title="Invite already used" message={`This invite to ${invite.account_name} has already been accepted. If that was you, just sign in.`} />

  // Pending invite, not signed in → login/signup first, then accept.
  if (!session) {
    return (
      <div>
        <div style={{ background: NAVY, padding: '18px 20px 0', textAlign: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif' }}>
          <div style={{ display: 'inline-block', background: NAVY_LIGHT, border: `1px solid ${NAVY_BORDER}`, borderRadius: 10, padding: '10px 18px', color: '#CBD5E1', fontSize: 13 }}>
            You've been invited to join <strong style={{ color: '#FFFFFF' }}>{invite.account_name}</strong> as <strong style={{ color: '#FFFFFF' }}>{invite.role}</strong> — sign in or create an account to accept.
          </div>
        </div>
        <Auth />
      </div>
    )
  }

  return (
    <Shell>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Join {invite.account_name}</div>
      <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.6, marginBottom: 6 }}>
        You've been invited to join <strong style={{ color: '#E2E8F0' }}>{invite.account_name}</strong> as{' '}
        <strong style={{ color: '#E2E8F0' }}>{invite.role}</strong>.
      </div>
      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 20 }}>Signed in as {session.user?.email}</div>
      {acceptError && (
        <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #7F1D1D', color: '#FCA5A5', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, marginBottom: 14 }}>
          {acceptError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => { window.location.href = '/' }}>Decline</button>
        <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={accept}>{busy ? 'Joining…' : 'Accept invite'}</button>
      </div>
    </Shell>
  )
}
