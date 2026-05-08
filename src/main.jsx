import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { getSession, onAuthChange, signOut } from './lib/supabase.js'
import App from './App.jsx'
import Auth from './Auth.jsx'

const isDemoRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')

function AuthGate() {
  const [status, setStatus] = useState('loading')
  const [session, setSession] = useState(null)

  useEffect(() => {
    getSession().then((s) => {
      setSession(s)
      setStatus('ready')
    })
    const unsubscribe = onAuthChange((s) => {
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

  return <App key={session.user.id} session={session} onLogout={() => signOut()} />
}

function Root() {
  if (isDemoRoute) return <App demoMode={true} />
  return <AuthGate />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
