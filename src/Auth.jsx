import { useState } from 'react'
import { signIn, signUp, sendPasswordReset, updateOwnPassword } from './lib/supabase.js'

const NAVY = '#0B1E3F'
const NAVY_LIGHT = '#162B55'
const NAVY_BORDER = '#1E3A6B'
const ACCENT = '#3B82F6'

export default function Auth({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (mode === 'reset') {
      if (!email) {
        setError('Enter your email to reset your password.')
        return
      }
      setBusy(true)
      try {
        const { error } = await sendPasswordReset(email)
        if (error) throw error
        setInfo('If that email is registered, a password reset link is on its way.')
      } catch (err) {
        setError(err?.message || 'Could not send reset email.')
      } finally {
        setBusy(false)
      }
      return
    }
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        const { data, error } = await signUp(email, password)
        if (error) throw error
        if (!data?.session) {
          setInfo('Account created. Check your inbox to confirm your email, then log in.')
          setMode('login')
        }
      }
    } catch (err) {
      setError(err?.message || 'Authentication failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
      padding: 20,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#FFFFFF',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        <div style={{
          background: NAVY,
          padding: '28px 32px',
          textAlign: 'center',
          borderBottom: `1px solid ${NAVY_BORDER}`,
        }}>
          <div style={{
            fontSize: 24,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: 0.5,
          }}>HQOps</div>
          <div style={{
            fontSize: 11,
            color: '#94A3B8',
            marginTop: 4,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}>Multi-entity platform</div>
        </div>

        <form onSubmit={submit} style={{ padding: '28px 32px' }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#0F172A',
            marginBottom: 6,
          }}>{mode === 'login' ? 'Sign in' : mode === 'reset' ? 'Reset password' : 'Create your account'}</div>
          <div style={{
            fontSize: 13,
            color: '#64748B',
            marginBottom: 22,
          }}>
            {mode === 'login'
              ? 'Welcome back. Enter your details to continue.'
              : mode === 'reset'
                ? "We'll email you a password reset link."
                : 'Get started with HQOps in seconds.'}
          </div>

          <label style={labelStyle}>Email</label>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            placeholder="you@example.com"
            disabled={busy}
          />

          {mode !== 'reset' && (
            <>
              <label style={{ ...labelStyle, marginTop: 14 }}>Password</label>
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                placeholder="••••••••"
                disabled={busy}
              />
            </>
          )}
          {mode === 'login' && (
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => { setError(null); setInfo(null); setMode('reset') }}
                style={{ background: 'none', border: 'none', color: ACCENT, fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 12 }}
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 14,
              padding: '10px 12px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              color: '#B91C1C',
              fontSize: 12,
            }}>{error}</div>
          )}
          {info && (
            <div style={{
              marginTop: 14,
              padding: '10px 12px',
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 8,
              color: '#1D4ED8',
              fontSize: 12,
            }}>{info}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 20,
              width: '100%',
              padding: '11px 16px',
              borderRadius: 8,
              border: 'none',
              background: busy ? '#94A3B8' : NAVY,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : 'Sign up'}
          </button>

          <div style={{
            marginTop: 18,
            textAlign: 'center',
            fontSize: 12,
            color: '#64748B',
          }}>
            {mode === 'reset' ? (
              <button
                type="button"
                onClick={() => { setError(null); setInfo(null); setMode('login') }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: ACCENT,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 12,
                }}
              >
                ← Back to sign in
              </button>
            ) : (
              <>
                {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => { setError(null); setInfo(null); setMode(mode === 'login' ? 'signup' : 'login') }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: ACCENT,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 12,
                  }}
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// Shown when the user arrives via an emailed password-recovery link
// (Supabase PASSWORD_RECOVERY event). Lets them set a new password before
// continuing into the app.
export function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { error } = await updateOwnPassword(password)
      if (error) throw error
      onDone?.()
    } catch (err) {
      setError(err?.message || 'Could not update password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`,
      padding: 20,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#FFFFFF',
        borderRadius: 14,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        <div style={{
          background: NAVY,
          padding: '28px 32px',
          textAlign: 'center',
          borderBottom: `1px solid ${NAVY_BORDER}`,
        }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', letterSpacing: 0.5 }}>HQOps</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, letterSpacing: 1.5, textTransform: 'uppercase' }}>Multi-entity platform</div>
        </div>
        <form onSubmit={submit} style={{ padding: '28px 32px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>Set a new password</div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 22 }}>Choose a new password for your account.</div>

          <label style={labelStyle}>New password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            placeholder="••••••••"
            disabled={busy}
          />

          <label style={{ ...labelStyle, marginTop: 14 }}>Confirm new password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={inputStyle}
            placeholder="••••••••"
            disabled={busy}
          />

          {error && (
            <div style={{
              marginTop: 14,
              padding: '10px 12px',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              color: '#B91C1C',
              fontSize: 12,
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 20,
              width: '100%',
              padding: '11px 16px',
              borderRadius: 8,
              border: 'none',
              background: busy ? '#94A3B8' : NAVY,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              transition: 'background .15s',
            }}
          >
            {busy ? 'Please wait…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#334155',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid #E2E8F0',
  background: '#F8FAFC',
  fontSize: 13,
  color: '#0F172A',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}
