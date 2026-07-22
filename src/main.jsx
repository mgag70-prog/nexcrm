import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { getSession, onAuthChange, signOut } from './lib/supabase.js'
import App from './App.jsx'
import Auth, { ResetPassword } from './Auth.jsx'
import Portal from './Portal.jsx'

const path = typeof window !== 'undefined' ? window.location.pathname : ''
const isDemoRoute = path.startsWith('/demo')
// Portal routes: /portal, /portal/login, /portal/dashboard, /portal/:token
const isPortalRoute = path === '/portal' || path === '/portal/' || path.startsWith('/portal/')

function AuthGate() {
  const [status, setStatus] = useState('loading')
  const [session, setSession] = useState(null)
  const [recovery, setRecovery] = useState(false)

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

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B1E3F',
        color: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
        fontSize: 13,
        letterSpacing: 1,
      }}>Loading…</div>
    )
  }

  if (!session) return <Auth />

  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />

  return <App key={session.user.id} session={session} onLogout={() => signOut()} />
}

function Root() {
  if (isPortalRoute) return <Portal />
  if (isDemoRoute) return <App demoMode={true} />
  return <AuthGate />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
