import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { getSession, onAuthChange, signOut, resolveAccounts, setActiveAccount } from './lib/supabase.js'
import Marketing from './marketing/Marketing.jsx'
import Auth, { ResetPassword } from './Auth.jsx'

// The CRM (~1.2MB) and other heavy routes load ONLY when their route is hit, so
// the marketing pages ship without the app. Marketing + Auth stay eager — they
// are the public entry and must render immediately.
const App = lazy(() => import('./App.jsx'))
const Portal = lazy(() => import('./Portal.jsx'))
const InvitePage = lazy(() => import('./Invite.jsx'))
const Pricing = lazy(() => import('./marketing/Pricing.jsx'))

const path = typeof window !== 'undefined' ? window.location.pathname : '/'
const search = typeof window !== 'undefined' ? window.location.search : ''
const hash = typeof window !== 'undefined' ? window.location.hash : ''

const isPortalRoute = path === '/portal' || path === '/portal/' || path.startsWith('/portal/')
const isInviteRoute = path.startsWith('/invite/')
const inviteToken = isInviteRoute ? path.slice('/invite/'.length).replace(/\/+$/, '') : null
const isDemoRoute = path === '/demo' || path.startsWith('/demo')
const isAppRoute = path === '/app' || path.startsWith('/app/')
const isLoginRoute = path === '/login'
const isPricingRoute = path === '/pricing'
const loginMode = new URLSearchParams(search).get('mode') === 'signup' ? 'signup' : 'login'
// Password-recovery links carry #type=recovery and can land on any route.
const isRecovery = hash.includes('type=recovery')

const isPortalClient = (s) => s?.user?.user_metadata?.role === 'portal_client'

// Minimal white splash for the brief public-route session check (resolves from
// localStorage, ~1 frame) and lazy-chunk loads on public routes.
function Splash() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#fff', fontFamily: '"Sora",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#0F2044',
    }}>HQ<span style={{ color: '#059669' }}>Ops</span></div>
  )
}

// Navy loading screen for the authed app side (matches the CRM chrome).
function CenteredScreen({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 14, background: '#0B1E3F', color: '#FFFFFF',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
      fontSize: 13, letterSpacing: 1, padding: 20, textAlign: 'center',
    }}>{children}</div>
  )
}

// Public routes (/ and /login): a logged-in CRM user is bounced to /app so
// typing hqops.app still lands the owner in their CRM. Recovery links win.
function PublicGate({ children }) {
  const [state, setState] = useState('checking') // checking | show

  useEffect(() => {
    let cancelled = false
    getSession().then((s) => {
      if (cancelled) return
      if (s && !isPortalClient(s)) window.location.replace('/app')
      else setState('show')
    })
    const unsub = onAuthChange((s, event) => {
      if (event === 'SIGNED_IN' && s && !isPortalClient(s)) window.location.replace('/app')
    })
    return () => { cancelled = true; unsub() }
  }, [])

  if (state === 'checking') return <Splash />
  return children
}

// /app: logged-out users go to /login; after login they land back on /app.
// Everything below the auth check is the original account-resolution flow.
function AppGate() {
  const [status, setStatus] = useState('loading')
  const [session, setSession] = useState(null)
  const [acct, setAcct] = useState(null)

  useEffect(() => {
    getSession().then((s) => { setSession(s); setStatus('ready') })
    const unsubscribe = onAuthChange((s) => { setSession(s); setStatus('ready') })
    return unsubscribe
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) { setAcct(null); return }
    let cancelled = false
    setAcct(null)
    resolveAccounts()
      .then((r) => { if (!cancelled) setAcct(r) })
      .catch((e) => { console.error('[accounts] resolve failed', e); if (!cancelled) setAcct({ error: e?.message || String(e) }) })
    return () => { cancelled = true }
  }, [userId])

  const switchAccount = async (id) => {
    try {
      await setActiveAccount(id)
      setAcct((prev) => (prev?.accounts ? { ...prev, active: prev.accounts.find((a) => a.id === id) || prev.active } : prev))
    } catch (e) { console.error('[accounts] switch failed', e); alert(e?.message || 'Could not switch accounts') }
  }

  if (status === 'loading') return <CenteredScreen>Loading…</CenteredScreen>

  if (!session) { window.location.replace('/login'); return <Splash /> }

  // Portal clients share this auth project; keep them out of the CRM.
  if (isPortalClient(session)) { window.location.replace('/portal/dashboard'); return <CenteredScreen>Redirecting to your portal…</CenteredScreen> }

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
    <Suspense fallback={<CenteredScreen>Loading…</CenteredScreen>}>
      <App
        key={`${session.user.id}:${acct.active.id}`}
        session={session}
        account={acct.active}
        accounts={acct.accounts}
        onSwitchAccount={switchAccount}
        onLogout={() => signOut()}
      />
    </Suspense>
  )
}

const withSuspense = (node, fallback) => <Suspense fallback={fallback}>{node}</Suspense>

function Root() {
  // A recovery link (any route) goes straight to the password reset screen.
  if (isRecovery) return <ResetPassword onDone={() => window.location.replace('/app')} />

  if (isPortalRoute) return withSuspense(<Portal />, <Splash />)
  if (isInviteRoute) return withSuspense(<InvitePage token={inviteToken} />, <Splash />)
  if (isDemoRoute) return withSuspense(<App demoMode={true} />, <CenteredScreen>Loading demo…</CenteredScreen>)
  if (isAppRoute) return <AppGate />
  if (isLoginRoute) return <PublicGate><Auth initialMode={loginMode} /></PublicGate>
  if (isPricingRoute) return withSuspense(<Pricing />, <Splash />)
  return <PublicGate><Marketing /></PublicGate>
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
