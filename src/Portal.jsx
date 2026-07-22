import React, { useEffect, useRef, useState } from 'react'
import {
  supabase,
  fetchPortalSnapshot,
  portalSignIn,
  portalSignOut,
  portalUpdatePassword,
  portalSendPasswordReset,
  portalGetClientRow,
  portalMarkSignedIn,
  portalListMessages,
  portalSendMessage,
  portalMarkMessagesRead,
  writePortalSnapshot,
  subscribePortalSnapshot,
  subscribePortalMessages,
} from './lib/supabase.js'

// Structured marker the CRM side parses to act on portal events (sign, approve,
// request changes). Surfaces to the owner as a normal message too, with the
// marker stripped.
const PORTAL_ACTION_PREFIX = '[[PORTAL_ACTION:'
function makeActionMessage(type, refId, friendlyText, extra) {
  const tag = `${PORTAL_ACTION_PREFIX}${type}:${refId || ''}${extra ? ':' + encodeURIComponent(JSON.stringify(extra)) : ''}]] `
  return tag + (friendlyText || '')
}
function fmtRelativeTime(d) {
  if (!d) return '—'
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 60_000) return 'just now'
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(d).toLocaleDateString()
}

const NAVY = '#0B1E3F'
const fmt$ = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v || 0)
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtTime = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
const STATUS_COLORS = { Draft: '#64748B', Sent: '#3B82F6', Viewed: '#8B5CF6', Paid: '#10B981', Overdue: '#EF4444', Cancelled: '#94A3B8', Signed: '#10B981' }

// ═══════════════════════════════════════════════════════════════════════════════
// ENTRY: pick subview from the path
// ═══════════════════════════════════════════════════════════════════════════════
export default function Portal() {
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  const [route, setRoute] = useState(() => {
    if (path.startsWith('/portal/login')) return 'login'
    if (path.startsWith('/portal/dashboard')) return 'dashboard'
    if (path.match(/^\/portal\/[^/]+$/)) return 'public-snapshot'
    return 'login'
  })
  const navigate = (target) => {
    if (typeof window !== 'undefined') {
      const url = target === 'dashboard' ? '/portal/dashboard' : '/portal/login'
      window.history.replaceState({}, '', url)
    }
    setRoute(target)
  }
  if (route === 'public-snapshot') return <PublicSnapshotView />
  if (route === 'dashboard') return <ClientPortal navigate={navigate} />
  return <PortalLogin navigate={navigate} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL LOGIN
// ═══════════════════════════════════════════════════════════════════════════════
function PortalLogin({ navigate }) {
  const [mode, setMode] = useState('login') // login | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    return params.get('token') || ''
  })
  const [brand, setBrand] = useState(null)

  // If a token is in the URL, fetch its snapshot to brand the login page
  useEffect(() => {
    if (!token) return
    fetchPortalSnapshot(token).then(res => {
      if (res?.payload) setBrand(res.payload)
    })
  }, [token])

  // If already signed in, jump straight to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data?.session) {
        const client = await portalGetClientRow()
        if (client) navigate('dashboard')
      }
    })
  }, [navigate])

  const accent = brand?.workspace?.color || '#1D4ED8'
  const workspaceName = brand?.workspace?.name || 'HQOps'

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setInfo(null)
    if (mode === 'reset') {
      if (!email) { setError('Enter your email to reset.'); return }
      setBusy(true)
      try {
        const { error } = await portalSendPasswordReset(email)
        if (error) throw error
        setInfo('If that email is registered, a reset link is on its way.')
      } catch (err) { setError(err.message || 'Reset failed.') }
      setBusy(false)
      return
    }
    if (!email || !password) { setError('Email and password are required.'); return }
    setBusy(true)
    try {
      const { error } = await portalSignIn(email, password)
      if (error) throw error
      const client = await portalGetClientRow()
      if (!client) {
        setError('You signed in but this account isn\'t linked to a portal yet. Contact your account manager.')
        await portalSignOut()
        setBusy(false)
        return
      }
      navigate('dashboard')
    } catch (err) {
      setError(err.message || 'Sign in failed.')
      setBusy(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${NAVY} 0%, #162B55 100%)`, padding: 20, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#FFFFFF', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
        <div style={{ background: NAVY, padding: '24px 32px', textAlign: 'center', borderBottom: '1px solid #1E3A6B' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', letterSpacing: 0.5 }}>{workspaceName}</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, letterSpacing: 1.5, textTransform: 'uppercase' }}>Client Portal</div>
          {brand && <div style={{ height: 3, background: accent, borderRadius: 2, marginTop: 14 }}/>}
        </div>
        <form onSubmit={submit} style={{ padding: '24px 32px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{mode === 'login' ? 'Sign in' : 'Reset password'}</div>
          <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>
            {mode === 'login' ? 'This is a secure client portal. Contact your account manager if you need access.' : 'We\'ll email you a password reset link.'}
          </div>
          <label style={lbl}>Email</label>
          <input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="you@company.com" disabled={busy}/>
          {mode === 'login' && <>
            <label style={{ ...lbl, marginTop: 14 }}>Password</label>
            <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="••••••••" disabled={busy}/>
          </>}
          {error && <div style={errBox}>{error}</div>}
          {info && <div style={infoBox}>{info}</div>}
          <button type="submit" disabled={busy} style={{ ...btn(accent), marginTop: 18, opacity: busy ? .6 : 1 }}>
            {busy ? 'Please wait…' : (mode === 'login' ? 'Sign in' : 'Send reset link')}
          </button>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#64748B' }}>
            {mode === 'login' ? (
              <button type="button" onClick={() => { setError(null); setInfo(null); setMode('reset') }} style={linkBtn(accent)}>Forgot password?</button>
            ) : (
              <button type="button" onClick={() => { setError(null); setInfo(null); setMode('login') }} style={linkBtn(accent)}>← Back to sign in</button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT PORTAL DASHBOARD (post-login)
// ═══════════════════════════════════════════════════════════════════════════════
function ClientPortal({ navigate }) {
  const [status, setStatus] = useState('loading')
  const [client, setClient] = useState(null)
  const [snapshot, setSnapshot] = useState(null)
  const [tab, setTab] = useState('overview')
  const [forceChange, setForceChange] = useState(false)
  const [unread, setUnread] = useState(0)
  const tabRef = useRef('overview')
  useEffect(() => { tabRef.current = tab }, [tab])

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession()
      if (!sess?.session) { navigate('login'); return }
      const cl = await portalGetClientRow()
      if (!cl) { setStatus('orphan'); return }
      setClient(cl)
      if (cl.first_login) setForceChange(true)
      const snap = await fetchPortalSnapshot(cl.token)
      setSnapshot(snap)
      // Count unread owner messages (messages from owner that client hasn't seen)
      const msgs = await portalListMessages(cl.token)
      setUnread(msgs.filter(m => m.sender_type === 'owner' && !m.read).length)
      // mark sign-in
      await portalMarkSignedIn(sess.session.user.id)
      setStatus('ready')
    })()
  }, [navigate])

  // Realtime: when the CRM owner edits something, their auto-rebuild useEffect
  // writes a fresh snapshot to portal_snapshots — this subscription picks that
  // up so the client portal updates without a manual refresh.
  useEffect(() => {
    if (!client?.token) return
    const unsub = subscribePortalSnapshot(client.token, async () => {
      const fresh = await fetchPortalSnapshot(client.token)
      if (fresh) setSnapshot(fresh)
    })
    return unsub
  }, [client?.token])

  // Realtime: new owner messages bump the unread badge (unless we're already on
  // the Messages tab, in which case mark them read immediately).
  useEffect(() => {
    if (!client?.token) return
    const unsub = subscribePortalMessages(client.token, async (payload) => {
      const m = payload?.new
      if (!m || m.sender_type !== 'owner') return
      if (tabRef.current === 'messages') {
        await portalMarkMessagesRead(client.token, 'owner')
      } else {
        setUnread(u => u + 1)
      }
    })
    return unsub
  }, [client?.token])

  if (status === 'loading') return <CenteredMessage>Loading your portal…</CenteredMessage>
  if (status === 'orphan') return (
    <CenteredMessage>
      <div>You're signed in, but this account isn't linked to an active portal yet.</div>
      <button onClick={async () => { await portalSignOut(); navigate('login') }} style={{ ...btn('#1D4ED8'), marginTop: 16 }}>Sign out</button>
    </CenteredMessage>
  )

  const settings = snapshot?.payload?.settings || snapshot?.settings || {}
  const enabledTabs = settings.enabledTabs || { overview: true, invoices: true, documents: true, proposals: true, projects: true, messages: true, tasks: true, expenses: false }
  const accent = snapshot?.payload?.workspace?.color || '#1D4ED8'
  const workspaceName = snapshot?.payload?.workspace?.name || 'HQOps'
  const welcome = settings.welcome || `Welcome to your portal.`
  const contact = snapshot?.payload?.contact

  if (forceChange) {
    return <ForcePasswordChange clientUserId={client.user_id} onDone={async () => { setForceChange(false) }} accent={accent} workspaceName={workspaceName}/>
  }

  const TABS = [
    ['overview', 'Overview', null],
    ['invoices', 'Invoices & Payments', enabledTabs.invoices],
    ['documents', 'Documents', enabledTabs.documents],
    ['proposals', 'Proposals', enabledTabs.proposals],
    ['projects', 'Projects', enabledTabs.projects],
    ['expenses', 'Costs & Expenses', enabledTabs.expenses],
    ['messages', 'Messages', enabledTabs.messages],
    ['tasks', 'Tasks', enabledTabs.tasks],
  ].filter(([id, label, enabled]) => id === 'overview' || enabled !== false)

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif' }}>
      <div style={{ background: NAVY, color: '#FFFFFF', padding: '20px 0', borderBottom: `4px solid ${accent}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>{workspaceName}</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{contact ? `Welcome, ${contact.name}` : 'Client Portal'}</div>
            <div style={{ fontSize: 12, color: '#CBD5E1', marginTop: 4 }}>{welcome}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {(snapshot?.payload?.lastUpdated || snapshot?.created_at) && (
              <div style={{ fontSize: 11, color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 0 3px rgba(16,185,129,0.18)' }}/>
                Live · last updated {fmtRelativeTime(snapshot?.payload?.lastUpdated || snapshot?.created_at)}
              </div>
            )}
            <div><button onClick={async () => { await portalSignOut(); navigate('login') }} style={{ ...btn('rgba(255,255,255,0.12)'), marginTop: 8, color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }}>Sign out</button></div>
          </div>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 4, overflowX: 'auto' }}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '14px 18px', borderBottom: `3px solid ${tab === id ? accent : 'transparent'}`,
              color: tab === id ? '#0F172A' : '#64748B', fontWeight: 600, fontSize: 13,
              position: 'relative', whiteSpace: 'nowrap',
            }}>{label}{id === 'messages' && unread > 0 && <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginLeft: 6, fontWeight: 700 }}>{unread}</span>}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
        {tab === 'overview' && <OverviewTab snapshot={snapshot} accent={accent} setTab={setTab} enabledTabs={enabledTabs}/>}
        {tab === 'invoices' && <InvoicesTab snapshot={snapshot} accent={accent} contact={contact} workspaceName={workspaceName}/>}
        {tab === 'documents' && <DocumentsTab snapshot={snapshot} client={client} contact={contact} accent={accent} onSnapshotUpdate={setSnapshot}/>}
        {tab === 'proposals' && <ProposalsTab snapshot={snapshot} client={client} contact={contact} accent={accent}/>}
        {tab === 'projects' && <ProjectsTab snapshot={snapshot} accent={accent}/>}
        {tab === 'expenses' && <ExpensesTab snapshot={snapshot} accent={accent}/>}
        {tab === 'messages' && <MessagesTab token={client.token} contact={contact} accent={accent} onMarkRead={() => setUnread(0)}/>}
        {tab === 'tasks' && <TasksTab snapshot={snapshot} accent={accent}/>}
      </div>
    </div>
  )
}

// ─── First-login forced password change ─────────────────────────────────────
function ForcePasswordChange({ clientUserId, onDone, accent, workspaceName }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    setErr(null)
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return }
    if (pw !== pw2) { setErr('Passwords do not match.'); return }
    setBusy(true)
    try {
      const { error } = await portalUpdatePassword(pw)
      if (error) throw error
      await supabase.from('portal_clients').update({ first_login: false }).eq('user_id', clientUserId)
      onDone()
    } catch (e) { setErr(e.message || 'Could not update password.') }
    setBusy(false)
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', padding: 20 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', padding: 32, maxWidth: 420, width: '100%' }}>
        <div style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, marginBottom: 4 }}>{workspaceName}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Set your password</div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 18 }}>You signed in with a temporary password. Pick a new one to continue.</div>
        <form onSubmit={submit}>
          <label style={lbl}>New password</label>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} style={inp} disabled={busy} autoFocus/>
          <label style={{ ...lbl, marginTop: 14 }}>Confirm password</label>
          <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} style={inp} disabled={busy}/>
          {err && <div style={errBox}>{err}</div>}
          <button type="submit" disabled={busy} style={{ ...btn(accent), marginTop: 16 }}>
            {busy ? 'Saving…' : 'Set password & continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Tabs ───────────────────────────────────────────────────────────────────
function OverviewTab({ snapshot, accent, setTab, enabledTabs }) {
  const inv = snapshot?.payload?.invoices || []
  const docs = snapshot?.payload?.docs || []
  const quotes = snapshot?.payload?.quotes || []
  const deals = snapshot?.payload?.deals || []
  const expenses = snapshot?.payload?.expenses || []
  const totalInvoiced = inv.reduce((s, i) => s + (i.total || 0), 0)
  const paid = inv.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0)
  const outstanding = inv.filter(i => !['Paid','Cancelled'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0)

  // Cross-section activity feed — last 5 items across invoices / docs / quotes / deals
  const events = []
  inv.forEach(i => events.push({ at: i.createdAt, label: `Invoice INV-${String(i.number).padStart(4, '0')} (${fmt$(i.total)})`, badge: i.status, color: STATUS_COLORS[i.status] || '#64748B', goto: 'invoices' }))
  docs.forEach(d => events.push({ at: d.createdAt, label: `Document: ${d.name}`, badge: d.status, color: STATUS_COLORS[d.status] || '#64748B', goto: 'documents' }))
  quotes.forEach(q => events.push({ at: q.createdAt, label: `Proposal: ${q.title || q.number}`, badge: q.status, color: STATUS_COLORS[q.status] || '#64748B', goto: 'proposals' }))
  deals.forEach(d => events.push({ at: d.closeDate || snapshot?.payload?.lastUpdated, label: `Project: ${d.title}`, badge: d.stage, color: '#64748B', goto: 'projects' }))
  events.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <Stat label="Total Invoiced" value={fmt$(totalInvoiced)} color="#1D4ED8"/>
        <Stat label="Amount Paid" value={fmt$(paid)} color="#10B981"/>
        <Stat label="Outstanding Balance" value={fmt$(outstanding)} color="#EF4444"/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionTitle>Recent activity</SectionTitle>
          {events.length === 0 ? <Empty>No activity yet.</Empty> : events.slice(0, 5).map((e, i) => (
            <Row key={i} style={{ cursor: 'pointer' }} onClick={() => setTab(e.goto)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...fontBold, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.label}</div>
                <div style={fontSubtle}>{fmtRelativeTime(e.at)}</div>
              </div>
              {e.badge && <Badge color={e.color}>{e.badge}</Badge>}
            </Row>
          ))}
        </Card>
        <Card>
          <SectionTitle>Quick actions</SectionTitle>
          {inv.length > 0 && <button onClick={() => setTab('invoices')} style={{ ...quickBtn, borderColor: accent }}>💳 View invoices ({inv.length})</button>}
          {quotes.length > 0 && enabledTabs?.proposals !== false && <button onClick={() => setTab('proposals')} style={quickBtn}>📋 View proposals ({quotes.length})</button>}
          {docs.length > 0 && enabledTabs?.documents !== false && <button onClick={() => setTab('documents')} style={quickBtn}>📄 View documents ({docs.length})</button>}
          {deals.length > 0 && enabledTabs?.projects !== false && <button onClick={() => setTab('projects')} style={quickBtn}>🔧 View projects ({deals.length})</button>}
          {expenses.length > 0 && enabledTabs?.expenses && <button onClick={() => setTab('expenses')} style={quickBtn}>💵 View costs & expenses ({expenses.length})</button>}
          {enabledTabs?.messages !== false && <button onClick={() => setTab('messages')} style={quickBtn}>💬 Send a message</button>}
        </Card>
      </div>
    </div>
  )
}

function InvoicesTab({ snapshot, accent, contact, workspaceName }) {
  const inv = snapshot?.payload?.invoices || []
  const [expanded, setExpanded] = useState(null) // invoice id
  if (inv.length === 0) return <Empty>No invoices yet.</Empty>

  const payNow = (i) => {
    if (i.stripeLink) { window.open(i.stripeLink, '_blank', 'noopener'); return }
    alert('Online payment is not set up for this invoice yet. Please contact your account manager to settle it.')
  }
  const download = (i) => {
    const num = `INV-${String(i.number).padStart(4, '0')}`
    const w = window.open('', '_blank')
    if (!w) return
    const lineItems = (i.items || []).map(it => `<tr><td>${escapeHtml(it.description || '')}</td><td style="text-align:right">${(+it.quantity||0)}</td><td style="text-align:right">${fmt$(+it.unitPrice||0)}</td><td style="text-align:right">${fmt$((+it.quantity||0)*(+it.unitPrice||0))}</td></tr>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${num}</title><style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #0F172A; padding: 32px; max-width: 760px; margin: 0 auto; }
      h1 { font-size: 26px; margin: 0 0 4px; }
      .meta { color: #64748B; font-size: 12px; margin-bottom: 24px; }
      .top { display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 2px solid #0F172A; }
      .billto { background:#F8FAFC; padding: 14px 18px; border-radius: 8px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
      th { text-align: left; background: #F8FAFC; padding: 10px; font-size: 11px; text-transform: uppercase; color: #64748B; }
      td { padding: 10px; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
      .total { text-align: right; font-size: 20px; font-weight: 800; padding: 14px 10px; }
      .notes { background: #FEFCE8; border: 1px solid #FDE68A; padding: 12px 14px; border-radius: 6px; margin-top: 18px; font-size: 12px; color: #713F12; }
      .status { display: inline-block; background: #EFF6FF; color: #1D4ED8; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; margin-left: 8px; }
      @media print { body { padding: 16px; } button { display: none; } }
    </style></head><body>
      <div class="top">
        <div><h1>${escapeHtml(workspaceName || 'Invoice')}</h1><div class="meta">Invoice ${num}<span class="status">${escapeHtml(i.status || '')}</span></div></div>
        <div style="text-align:right;font-size:12px;color:#64748B">
          <div>Issued: ${fmtDate(i.createdAt)}</div>
          <div>Due: ${fmtDate(i.dueDate)}</div>
        </div>
      </div>
      ${contact ? `<div class="billto"><div style="font-size:10px;text-transform:uppercase;color:#64748B;font-weight:700">Bill To</div><div style="font-weight:700;margin-top:4px">${escapeHtml(contact.name || '')}</div><div style="font-size:12px;color:#64748B">${escapeHtml(contact.email || '')}</div>${contact.companyName ? `<div style="font-size:12px;color:#64748B">${escapeHtml(contact.companyName)}</div>` : ''}</div>` : ''}
      <table>
        <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit price</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${lineItems || '<tr><td colspan="4" style="text-align:center;color:#94A3B8">No line items</td></tr>'}</tbody>
        <tfoot><tr><td colspan="3" style="text-align:right;font-weight:700">Total</td><td class="total">${fmt$(i.total)}</td></tr></tfoot>
      </table>
      ${i.notes ? `<div class="notes"><strong>Notes</strong><div style="margin-top:4px;white-space:pre-wrap">${escapeHtml(i.notes)}</div></div>` : ''}
      <div style="margin-top:30px;text-align:center"><button onclick="window.print()" style="background:#1D4ED8;color:#fff;padding:10px 18px;border:none;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600">Print / Save as PDF</button></div>
    </body></html>`)
    w.document.close()
  }

  return (
    <Card style={{ overflow: 'hidden' }}>
      <table style={tbl}>
        <thead><tr>{['', 'Number', 'Issued', 'Due', 'Total', 'Status', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{inv.map(i => (
          <React.Fragment key={i.id || i.number}>
            <tr>
              <td style={{ ...td, width: 28, paddingRight: 0 }}>
                <button onClick={() => setExpanded(expanded === (i.id || i.number) ? null : (i.id || i.number))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 12 }}>{expanded === (i.id || i.number) ? '▾' : '▸'}</button>
              </td>
              <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>INV-{String(i.number).padStart(4, '0')}</td>
              <td style={td}>{fmtDate(i.createdAt)}</td>
              <td style={td}>{fmtDate(i.dueDate)}</td>
              <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>{fmt$(i.total)}</td>
              <td style={td}><Badge color={STATUS_COLORS[i.status] || '#64748B'}>{i.status}</Badge></td>
              <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button onClick={() => download(i)} style={{ ...ghostBtn, marginRight: 6 }}>Download</button>
                {!['Paid','Cancelled'].includes(i.status) && <button onClick={() => payNow(i)} style={payBtn(accent)}>{i.stripeLink ? 'Pay Now' : 'Pay Now'}</button>}
              </td>
            </tr>
            {expanded === (i.id || i.number) && (
              <tr>
                <td colSpan={7} style={{ background: '#F8FAFC', padding: '14px 22px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>Line items</div>
                  {(i.items || []).length === 0 ? <div style={fontSubtle}>No itemization.</div> : (
                    <table style={{ ...tbl, fontSize: 12 }}>
                      <thead><tr><th style={{ ...th, background: 'transparent' }}>Description</th><th style={{ ...th, background: 'transparent', textAlign: 'right' }}>Qty</th><th style={{ ...th, background: 'transparent', textAlign: 'right' }}>Unit price</th><th style={{ ...th, background: 'transparent', textAlign: 'right' }}>Amount</th></tr></thead>
                      <tbody>{(i.items || []).map((it, k) => (
                        <tr key={k}>
                          <td style={{ ...td, color: '#0F172A' }}>{it.description || '—'}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{+it.quantity || 0}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{fmt$(+it.unitPrice || 0)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>{fmt$((+it.quantity || 0) * (+it.unitPrice || 0))}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  )}
                  {i.notes && <div style={{ marginTop: 10, fontSize: 12, color: '#475569', background: '#FFFFFF', padding: 10, borderRadius: 6, border: '1px solid #E2E8F0' }}><strong style={{ color: '#0F172A' }}>Notes: </strong>{i.notes}</div>}
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}</tbody>
      </table>
    </Card>
  )
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function DocumentsTab({ snapshot, client, contact, accent, onSnapshotUpdate }) {
  const docs = snapshot?.payload?.docs || []
  const [signing, setSigning] = useState(null) // doc currently being signed
  if (docs.length === 0) return <Empty>No documents shared with you.</Empty>
  const onSigned = async (sigPayload, doc) => {
    // Optimistic local update so the badge flips immediately
    const next = JSON.parse(JSON.stringify(snapshot.payload))
    next.docs = (next.docs || []).map(d => d.id === doc.id ? { ...d, status: 'Signed', signature: sigPayload } : d)
    await writePortalSnapshot(client.token, next)
    onSnapshotUpdate({ ...snapshot, payload: next })
    // Notify CRM with a structured action message — the App.jsx listener parses
    // this and updates crm:docs status + adds a note to the contact timeline.
    await portalSendMessage(
      client.token, 'client', contact?.name || 'Client',
      makeActionMessage('sign_doc', doc.id, `📝 Signed: ${doc.name}`, { name: doc.name, signedAt: sigPayload.signedAt, type: sigPayload.type }),
    )
    setSigning(null)
  }
  const downloadDoc = (d) => {
    if (!d.data) { alert('This document is no longer available for download.'); return }
    const a = document.createElement('a')
    a.href = d.data; a.download = d.name || 'document'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }
  return (
    <Card>
      {docs.map((d, i) => (
        <Row key={d.id || i} style={{ borderTop: i ? '1px solid #E9EEF6' : 'none', padding: '14px 0' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D4ED8', fontWeight: 700 }}>📄</div>
          <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
            <div style={fontBold}>{d.name}</div>
            <div style={fontSubtle}>{fmtDate(d.createdAt)}</div>
          </div>
          {d.status && <Badge color={STATUS_COLORS[d.status] || '#F59E0B'}>{d.status}</Badge>}
          {d.data && <button onClick={() => downloadDoc(d)} style={{ ...ghostBtn, marginLeft: 8 }}>Download</button>}
          {d.status === 'Sent' && <button onClick={() => setSigning(d)} style={{ ...payBtn(accent), marginLeft: 8 }}>Sign</button>}
        </Row>
      ))}
      {signing && <InlineSignatureModal doc={signing} contact={contact} onClose={() => setSigning(null)} onSign={(payload) => onSigned(payload, signing)}/>}
    </Card>
  )
}

function ProposalsTab({ snapshot, client, contact, accent }) {
  const quotes = snapshot?.payload?.quotes || []
  const [expanded, setExpanded] = useState(null)
  if (quotes.length === 0) return <Empty>No proposals shared with you.</Empty>
  const requestChanges = async (q) => {
    const text = prompt(`Request changes to "${q.title || q.number}":\n\nWhat would you like changed?`)
    if (!text || !text.trim()) return
    await portalSendMessage(
      client.token, 'client', contact?.name || 'Client',
      makeActionMessage('request_changes_quote', q.id || q.number, `📋 Change requested for ${q.title || q.number}: ${text.trim()}`, { request: text.trim() }),
    )
    alert('Your change request was sent to your account manager.')
  }
  const approve = async (q) => {
    if (!confirm(`Approve "${q.title || q.number}" for ${fmt$(q.total)}? This signals to your account manager that you're ready to proceed.`)) return
    await portalSendMessage(
      client.token, 'client', contact?.name || 'Client',
      makeActionMessage('approve_quote', q.id || q.number, `✅ Proposal approved: ${q.title || q.number} (${fmt$(q.total)})`, { dealId: q.dealId || null, total: q.total }),
    )
    alert('Approval recorded — your account manager will follow up.')
  }
  return (
    <Card>
      {quotes.map((q, i) => {
        const key = q.id || q.number || i
        return (
          <div key={key} style={{ padding: '14px 0', borderTop: i ? '1px solid #E9EEF6' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setExpanded(expanded === key ? null : key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 12 }}>{expanded === key ? '▾' : '▸'}</button>
              <div style={{ flex: 1 }}>
                <div style={fontBold}>{q.title || q.number}</div>
                <div style={fontSubtle}>{fmtDate(q.createdAt)}{q.status ? ` · ${q.status}` : ''}</div>
              </div>
              <div style={{ ...fontBold, fontSize: 16, color: '#0F172A' }}>{fmt$(q.total)}</div>
            </div>
            {expanded === key && (q.items || []).length > 0 && (
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 14px', marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>Line items</div>
                <table style={{ ...tbl, fontSize: 12 }}>
                  <tbody>{(q.items || []).map((it, k) => (
                    <tr key={k}>
                      <td style={{ ...td, color: '#0F172A' }}>{it.description || it.name || '—'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{+it.quantity || 1}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt$((+it.quantity || 1) * (+it.unitPrice || +it.price || 0))}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
            {q.status !== 'Approved' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => approve(q)} style={{ ...payBtn(accent) }}>Approve</button>
                <button onClick={() => requestChanges(q)} style={ghostBtn}>Request changes</button>
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}

function ProjectsTab({ snapshot, accent }) {
  const deals = snapshot?.payload?.deals || []
  if (deals.length === 0) return <Empty>No projects yet.</Empty>
  return (
    <Card>
      {deals.map((d, i) => {
        const stages = d.stages || []
        const idx = Math.max(0, stages.indexOf(d.stage))
        const total = stages.length
        return (
          <div key={d.id || i} style={{ padding: '18px 0', borderTop: i ? '1px solid #E9EEF6' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ ...fontBold, fontSize: 14 }}>{d.title}</div>
                <div style={fontSubtle}>{d.stage || 'No stage'}{d.closeDate ? ` · ${fmtDate(d.closeDate)}` : ''}</div>
              </div>
              {d.value != null && <div style={{ ...fontBold, fontSize: 18, color: '#0F172A' }}>{fmt$(d.value)}</div>}
            </div>
            {total > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {stages.map((s, k) => (
                    <div key={s} title={s} style={{
                      flex: 1, height: 8, borderRadius: 3,
                      background: k <= idx ? accent : '#E2E8F0',
                      opacity: k === idx ? 1 : (k < idx ? 0.85 : 1),
                      boxShadow: k === idx ? `0 0 0 2px ${accent}30` : 'none',
                    }}/>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                  <span>{stages[0] || ''}</span>
                  <span style={{ fontWeight: 700, color: accent }}>{d.stage}</span>
                  <span>{stages[total - 1] || ''}</span>
                </div>
              </div>
            )}
            {d.stageNote && (
              <div style={{ background: '#F8FAFC', borderLeft: `3px solid ${accent}`, padding: '8px 10px', marginTop: 10, fontSize: 12, color: '#475569' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: 3 }}>Stage update</div>
                {d.stageNote}
              </div>
            )}
            {d.nextStep && (
              <div style={{ background: '#FEFCE8', borderLeft: '3px solid #F59E0B', padding: '8px 10px', marginTop: 6, fontSize: 12, color: '#713F12' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#A16207', textTransform: 'uppercase', marginBottom: 3 }}>Next step</div>
                {d.nextStep}
              </div>
            )}
          </div>
        )
      })}
    </Card>
  )
}

// Strips the [[PORTAL_ACTION:...]] marker from a message so the client sees
// only the friendly text. The marker is internal plumbing between portal and CRM.
function stripActionMarker(content) {
  if (!content) return ''
  if (!content.startsWith(PORTAL_ACTION_PREFIX)) return content
  const end = content.indexOf(']] ')
  if (end < 0) return content
  return content.slice(end + 3)
}

function MessagesTab({ token, contact, accent, onMarkRead }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  // Stable ref for onMarkRead so the subscribe effect doesn't churn every render.
  const onMarkReadRef = useRef(onMarkRead)
  useEffect(() => { onMarkReadRef.current = onMarkRead }, [onMarkRead])

  const scrollToBottom = () => setTimeout(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, 60)

  // Single effect: initial fetch + realtime subscribe + 15s polling fallback.
  // Deps are only [token] so the channel survives parent re-renders.
  useEffect(() => {
    if (!token) { setLoading(false); return }
    let cancelled = false
    let unsub = () => {}
    setLoading(true)
    setError(null)
    const fetchAndApply = async (markRead) => {
      try {
        const list = await portalListMessages(token)
        if (cancelled) return
        setMessages(prev => {
          const fresh = Array.isArray(list) ? list : []
          // Cheap dedup: keep prev order if nothing changed (preserves scroll).
          if (prev.length === fresh.length && prev.every((p, i) => p.id === fresh[i].id)) return prev
          return fresh
        })
        scrollToBottom()
        if (markRead) {
          try { await portalMarkMessagesRead(token, 'owner'); onMarkReadRef.current?.() } catch {}
        }
      } catch (e) {
        console.error('[MessagesTab load]', e)
        if (!cancelled) setError('Could not load messages. You can still send a new one.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAndApply(true)
    try {
      unsub = subscribePortalMessages(token, async (payload) => {
        const m = payload?.new
        if (!m) return
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
        scrollToBottom()
        if (m.sender_type === 'owner') {
          try { await portalMarkMessagesRead(token, 'owner'); onMarkReadRef.current?.() } catch {}
        }
      })
    } catch (e) {
      // Realtime not enabled? Subscription fails silently — the polling below
      // and on-send refetch keep things usable.
      console.warn('[MessagesTab subscribe]', e)
    }
    // 15s polling fallback so owner replies show up even when the realtime
    // publication isn't enabled on portal_messages.
    const pollId = setInterval(() => fetchAndApply(false), 15000)
    return () => { cancelled = true; clearInterval(pollId); try { unsub() } catch {} }
  }, [token])

  const send = async () => {
    const v = draft.trim()
    if (!v || sending || !token) return
    setSending(true)
    setError(null)
    try {
      const res = await portalSendMessage(token, 'client', contact?.name || 'Client', v)
      if (res?.error) throw res.error
      setDraft('')
      // Refetch immediately so the new message is visible even if the realtime
      // publication isn't enabled on portal_messages yet.
      const fresh = await portalListMessages(token)
      setMessages(Array.isArray(fresh) ? fresh : [])
      scrollToBottom()
    } catch (e) {
      console.error('[MessagesTab send]', e)
      setError(e?.message || 'Could not send your message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Card>
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', marginBottom: 12, color: '#B91C1C', fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', padding: 0, fontSize: 14 }}>×</button>
        </div>
      )}
      <div ref={scrollRef} style={{ maxHeight: 480, minHeight: 140, overflowY: 'auto', padding: '6px 0' }}>
        {loading ? (
          <Empty>Loading conversation…</Empty>
        ) : messages.length === 0 ? (
          <Empty>No messages yet. Send your account manager a note below.</Empty>
        ) : (
          messages.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_type === 'client' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
              <div style={{
                maxWidth: '70%',
                background: m.sender_type === 'client' ? accent : '#F1F5F9',
                color: m.sender_type === 'client' ? '#FFFFFF' : '#0F172A',
                padding: '10px 14px', borderRadius: 12, fontSize: 13,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, opacity: .8, marginBottom: 4 }}>{m.sender_name || (m.sender_type === 'client' ? 'You' : 'Account manager')} · {fmtTime(m.created_at)}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{stripActionMarker(m.content)}</div>
              </div>
            </div>
          ))
        )}
      </div>
      {/* Input row uses CSS grid (not flex+width:100%) so the textarea and
          Send button always lay out predictably regardless of parent width. */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #E9EEF6', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          rows={2}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send() }}
          placeholder="Type a message…"
          disabled={sending}
          style={{ ...inp, width: '100%', fontFamily: 'inherit', resize: 'vertical', minHeight: 60 }}
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          style={{ background: accent, color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '0 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', height: 60, opacity: (sending || !draft.trim()) ? .6 : 1, whiteSpace: 'nowrap' }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </Card>
  )
}

function ExpensesTab({ snapshot, accent }) {
  const expenses = snapshot?.payload?.expenses || []
  if (expenses.length === 0) return <Empty>No expenses shared with you yet.</Empty>
  const total = expenses.reduce((s, e) => s + (+e.amount || 0), 0)
  const invoiced = expenses.filter(e => e.invoiced).reduce((s, e) => s + (+e.amount || 0), 0)
  const pending = total - invoiced
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <Stat label="Total Billable Costs" value={fmt$(total)} color="#1D4ED8"/>
        <Stat label="Already Invoiced" value={fmt$(invoiced)} color="#10B981"/>
        <Stat label="Pending Invoice" value={fmt$(pending)} color="#F59E0B"/>
      </div>
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E9EEF6', fontSize: 13, color: '#475569' }}>
          Pass-through costs that may appear on your invoices. Vendor and internal details are not shown.
        </div>
        <table style={tbl}>
          <thead><tr>{['Date', 'Category', 'Description', 'Amount', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{[...expenses].sort((a,b) => new Date(b.date) - new Date(a.date)).map(e => (
            <tr key={e.id}>
              <td style={td}>{fmtDate(e.date)}</td>
              <td style={td}>{e.category || '—'}</td>
              <td style={{ ...td, color: '#0F172A' }}>{e.description || '—'}</td>
              <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>{fmt$(e.amount)}</td>
              <td style={td}><Badge color={e.invoiced ? '#10B981' : '#F59E0B'}>{e.invoiced ? 'Invoiced' : 'Pending'}</Badge></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  )
}

function TasksTab({ snapshot, accent }) {
  const tasks = snapshot?.payload?.tasks || []
  if (tasks.length === 0) return <Empty>No tasks shared with you.</Empty>
  return (
    <Card style={{ overflow: 'hidden' }}>
      {tasks.map((t, i) => (
        <Row key={t.id || i} style={{ borderTop: i ? '1px solid #E9EEF6' : 'none', padding: '12px 0' }}>
          <input type="checkbox" checked={!!t.completed} readOnly style={{ accentColor: accent, marginLeft: 4 }}/>
          <div style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
            <div style={{ ...fontBold, textDecoration: t.completed ? 'line-through' : 'none' }}>{t.title}</div>
            <div style={fontSubtle}>Due {fmtDate(t.dueDate)}</div>
          </div>
          <Badge color={t.completed ? '#10B981' : '#F59E0B'}>{t.completed ? 'Done' : 'Pending'}</Badge>
        </Row>
      ))}
    </Card>
  )
}

// ─── Inline Signature Modal (canvas + type) ─────────────────────────────────
function InlineSignatureModal({ doc, contact, onClose, onSign }) {
  const [mode, setMode] = useState('draw')
  const [typed, setTyped] = useState(contact?.name || '')
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const drewRef = useRef(false)
  useEffect(() => {
    if (mode !== 'draw') return
    const c = canvasRef.current; if (!c) return
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 2; ctx.lineCap = 'round'
  }, [mode])
  const pos = (e) => {
    const c = canvasRef.current
    const r = c.getBoundingClientRect()
    const t = e.touches?.[0]
    return { x: ((t?.clientX ?? e.clientX) - r.left) * (c.width / r.width), y: ((t?.clientY ?? e.clientY) - r.top) * (c.height / r.height) }
  }
  const start = (e) => { e.preventDefault(); drawingRef.current = true; const ctx = canvasRef.current.getContext('2d'); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
  const move = (e) => { if (!drawingRef.current) return; e.preventDefault(); const ctx = canvasRef.current.getContext('2d'); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); drewRef.current = true }
  const end = () => { drawingRef.current = false }
  const clear = () => { const c = canvasRef.current; const ctx = c.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height); drewRef.current = false }
  const submit = () => {
    if (mode === 'draw') {
      if (!drewRef.current) return alert('Please draw your signature.')
      const dataUrl = canvasRef.current.toDataURL('image/png')
      onSign({ type: 'draw', dataUrl, signedAt: new Date().toISOString(), name: contact?.name || null })
    } else {
      if (!typed.trim()) return alert('Type your full name.')
      onSign({ type: 'type', text: typed.trim(), signedAt: new Date().toISOString(), name: contact?.name || null })
    }
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,60,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 24, maxWidth: 640, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Sign document</div>
          <button onClick={onClose} style={ghostBtn}>×</button>
        </div>
        <div style={{ fontSize: 13, color: '#64748B', marginBottom: 14 }}>Sign <strong>{doc.name}</strong>{contact ? ` as ${contact.name}` : ''}.</div>
        <div style={{ display: 'flex', gap: 0, background: '#E2E8F0', padding: 3, borderRadius: 8, marginBottom: 14, width: 'fit-content' }}>
          {[['draw', 'Draw signature'], ['type', 'Type signature']].map(([v, l]) => (
            <button key={v} onClick={() => setMode(v)} style={{ background: mode === v ? '#1D4ED8' : 'transparent', color: mode === v ? '#FFFFFF' : '#64748B', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        {mode === 'draw' ? (
          <div>
            <div style={{ border: '2px dashed #CBD5E1', borderRadius: 10, padding: 6 }}>
              <canvas ref={canvasRef} width={580} height={170} style={{ display: 'block', width: '100%', height: 170, touchAction: 'none', cursor: 'crosshair' }}
                onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
                onTouchStart={start} onTouchMove={move} onTouchEnd={end}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              <button onClick={clear} style={ghostBtn}>Clear</button>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>Sign with your mouse, trackpad, or finger</span>
            </div>
          </div>
        ) : (
          <div>
            <input value={typed} onChange={e => setTyped(e.target.value)} placeholder="Type your full name" style={{ ...inp, fontSize: 22, fontFamily: '"Caveat","Brush Script MT",cursive', height: 76 }}/>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>Your typed name will serve as your electronic signature.</div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={submit} style={btn('#1D4ED8')}>Sign</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public snapshot view (legacy /portal/:token without login) — read-only fallback
// ═══════════════════════════════════════════════════════════════════════════════
function PublicSnapshotView() {
  const token = (typeof window !== 'undefined' ? window.location.pathname.replace(/^\/portal\/?/, '').split('/')[0] : '') || ''
  const [status, setStatus] = useState('loading')
  const [payload, setPayload] = useState(null)
  useEffect(() => {
    fetchPortalSnapshot(token).then(res => {
      if (!res?.payload) { setStatus('notfound'); return }
      setPayload(res.payload)
      setStatus('ready')
    })
  }, [token])
  if (status === 'loading') return <CenteredMessage>Loading…</CenteredMessage>
  if (status === 'notfound') return (
    <CenteredMessage>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Portal not found</div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>If you have an account, sign in below.</div>
      <a href="/portal/login" style={{ ...btn('#1D4ED8'), textDecoration: 'none', display: 'inline-block' }}>Go to portal sign-in</a>
    </CenteredMessage>
  )
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', padding: 32 }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ background: NAVY, color: '#FFFFFF', padding: 20, borderRadius: 12, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: '#94A3B8', textTransform: 'uppercase' }}>{payload.workspace?.name || 'Portal'}</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{payload.contact ? `Welcome, ${payload.contact.name}` : 'Client portal'}</div>
          <div style={{ fontSize: 13, color: '#CBD5E1', marginTop: 6 }}>This is a read-only snapshot. <a href="/portal/login" style={{ color: '#FFFFFF', textDecoration: 'underline' }}>Sign in</a> for the full portal.</div>
        </div>
        <Card><SectionTitle>Invoices</SectionTitle>{(payload.invoices || []).length === 0 ? <Empty>No invoices</Empty> : (payload.invoices || []).map(i => (
          <Row key={i.number}><div style={{ flex: 1 }}><div style={fontBold}>INV-{String(i.number).padStart(4, '0')}</div><div style={fontSubtle}>{fmtDate(i.createdAt)}</div></div><Badge color={STATUS_COLORS[i.status] || '#64748B'}>{i.status}</Badge><div style={{ marginLeft: 8, fontWeight: 700 }}>{fmt$(i.total)}</div></Row>
        ))}</Card>
      </div>
    </div>
  )
}

// ─── Reusable bits ──────────────────────────────────────────────────────────
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 13, color: '#0F172A', outline: 'none', boxSizing: 'border-box' }
const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }
const errBox = { marginTop: 14, padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#B91C1C', fontSize: 12 }
const infoBox = { marginTop: 14, padding: '10px 12px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, color: '#1D4ED8', fontSize: 12 }
const btn = (color) => ({ width: '100%', padding: '11px 16px', borderRadius: 8, border: 'none', background: color, color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background .15s' })
const linkBtn = (color) => ({ background: 'none', border: 'none', color, fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 12 })
const ghostBtn = { background: 'transparent', border: '1px solid #E2E8F0', color: '#475569', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }
const payBtn = (color) => ({ background: color, color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 })
const quickBtn = { width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#0F172A', fontWeight: 500 }
const tbl = { width: '100%', borderCollapse: 'collapse' }
const th = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: .5, background: '#F8FAFC' }
const td = { padding: '12px 16px', fontSize: 13, color: '#475569', borderTop: '1px solid #F1F5F9' }
const fontBold = { fontSize: 13, fontWeight: 700, color: '#0F172A' }
const fontSubtle = { fontSize: 11, color: '#94A3B8' }
const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 18 }

function Card({ children, style }) { return <div style={{ ...card, ...style }}>{children}</div> }
function SectionTitle({ children }) { return <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>{children}</div> }
function Row({ children, style }) { return <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', ...style }}>{children}</div> }
function Empty({ children }) { return <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>{children}</div> }
function Badge({ color, children }) { return <span style={{ background: color + '20', color, border: `1px solid ${color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>{children}</span> }
function Stat({ label, value, color }) { return <div style={card}><div style={fontSubtle}>{label}</div><div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{value}</div></div> }
function CenteredMessage({ children }) { return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', padding: 20, textAlign: 'center' }}><div style={{ background: '#FFFFFF', padding: 28, borderRadius: 12, maxWidth: 420 }}>{children}</div></div> }
