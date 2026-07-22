import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { getSession, onAuthChange, signOut, resolveAccounts, setActiveAccount } from './lib/supabase.js'
import App from './App.jsx'
import Auth, { ResetPassword } from './Auth.jsx'
import Portal from './Portal.jsx'
import InvitePage from './Invite.jsx'

const path = typeof window !== 'undefined' ? window.location.pathname : ''
const isDemoRoute = path.startsWith('/demo')
// Portal routes: /portal, /portal/login, /portal/dashboard, /portal/:token
const isPortalRoute = path === '/portal' || path === '/portal/' || path.startsWith('/portal/')
// Team invite accept route: /invite/:token
const isInviteRoute = path.startsWith('/invite/')
const inviteToken = isInviteRoute ? path.slice('/invite/'.length).replace(/\/+$/, '') : null

function CenteredScreen({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      background: '#0B1E3F',
      color: '#FFFFFF',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
      fontSize: 13,
      letterSpacing: 1,
      padding: 20,
      textAlign: 'center',
    }}>{children}</div>
  )
}

function AuthGate() {
  const [status, setStatus] = useState('loading')
  const [session, setSession] = useState(null)
  const [recovery, setRecovery] = useState(false)
  // Account resolution: which accounts this user belongs to + the active one.
  // App must not render (and therefore must not load or save any data) until
  // this completes — the storage adapter is account-scoped.
  const [acct, setAcct] = useState(null) // { accounts, active } | { error }

  useEffect(() => {
    getSession().then((s) => {
      setSession(s)
      setStatus('ready')
    })
    const unsubscribe = onAuthChange((s, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(s)
      setStatus('ready')
    })
    return unsubscribe
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) { setAcct(null); return }
    let cancelled = false
    setAcct(null)
    resolveAccounts()
      .then((r) => { if (!cancelled) setAcct(r) })
      .catch((e) => {
        console.error('[accounts] resolve failed', e)
        if (!cancelled) setAcct({ error: e?.message || String(e) })
      })
    return () => { cancelled = true }
  }, [userId])

  const switchAccount = async (id) => {
    try {
      await setActiveAccount(id)
      // Remount App via its key: the fresh mount re-runs the initial load
      // against the new account, with the loadedRef gate starting closed.
      setAcct((prev) => (prev?.accounts ? { ...prev, active: prev.accounts.find((a) => a.id === id) || prev.active } : prev))
    } catch (e) {
      console.error('[accounts] switch failed', e)
      alert(e?.message || 'Could not switch accounts')
    }
  }

  if (status === 'loading') return <CenteredScreen>Loading…</CenteredScreen>

  if (!session) return <Auth />

  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />

  if (!acct) return <CenteredScreen>Loading your workspace…</CenteredScreen>

  if (acct.error) {
    return (
      <CenteredScreen>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0 }}>Could not load your workspace</div>
        <div style={{ fontSize: 12.5, color: '#94A3B8', letterSpacing: 0, maxWidth: 380, lineHeight: 1.6 }}>{acct.error}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => window.location.reload()} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          <button onClick={() => signOut()} style={{ background: 'rgba(255,255,255,0.08)', color: '#CBD5E1', border: '1px solid #1E3A6B', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sign out</button>
        </div>
      </CenteredScreen>
    )
  }

  return (
    <App
      key={`${session.user.id}:${acct.active.id}`}
      session={session}
      account={acct.active}
      accounts={acct.accounts}
      onSwitchAccount={switchAccount}
      onLogout={() => signOut()}
    />
  )
}

function Root() {
  if (isPortalRoute) return <Portal />
  if (isInviteRoute) return <InvitePage token={inviteToken} />
  if (isDemoRoute) return <App demoMode={true} />
  return <AuthGate />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
