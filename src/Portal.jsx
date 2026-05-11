import { useEffect, useRef, useState } from 'react'
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
} from './lib/supabase.js'

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
  const workspaceName = brand?.workspace?.name || 'NexCRM'

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

  if (status === 'loading') return <CenteredMessage>Loading your portal…</CenteredMessage>
  if (status === 'orphan') return (
    <CenteredMessage>
      <div>You're signed in, but this account isn't linked to an active portal yet.</div>
      <button onClick={async () => { await portalSignOut(); navigate('login') }} style={{ ...btn('#1D4ED8'), marginTop: 16 }}>Sign out</button>
    </CenteredMessage>
  )

  const settings = snapshot?.payload?.settings || snapshot?.settings || {}
  const enabledTabs = settings.enabledTabs || { overview: true, invoices: true, documents: true, proposals: true, projects: true, messages: true, tasks: true }
  const accent = snapshot?.payload?.workspace?.color || '#1D4ED8'
  const workspaceName = snapshot?.payload?.workspace?.name || 'NexCRM'
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
            {snapshot?.created_at && <div style={{ fontSize: 11, color: '#94A3B8' }}>Last updated {fmtTime(snapshot.created_at)}</div>}
            <button onClick={async () => { await portalSignOut(); navigate('login') }} style={{ ...btn('rgba(255,255,255,0.12)'), marginTop: 8, color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }}>Sign out</button>
          </div>
        </div>
      </div>

      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 4, overflowX: 'auto' }}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => { setTab(id); if (id === 'messages') { portalMarkMessagesRead(client.token, 'owner').then(() => setUnread(0)) } }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '14px 18px', borderBottom: `3px solid ${tab === id ? accent : 'transparent'}`,
              color: tab === id ? '#0F172A' : '#64748B', fontWeight: 600, fontSize: 13,
              position: 'relative', whiteSpace: 'nowrap',
            }}>{label}{id === 'messages' && unread > 0 && <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, marginLeft: 6, fontWeight: 700 }}>{unread}</span>}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px' }}>
        {tab === 'overview' && <OverviewTab snapshot={snapshot} accent={accent} setTab={setTab}/>}
        {tab === 'invoices' && <InvoicesTab snapshot={snapshot} accent={accent}/>}
        {tab === 'documents' && <DocumentsTab snapshot={snapshot} client={client} contact={contact} accent={accent} onSnapshotUpdate={setSnapshot}/>}
        {tab === 'proposals' && <ProposalsTab snapshot={snapshot} client={client} contact={contact} accent={accent}/>}
        {tab === 'projects' && <ProjectsTab snapshot={snapshot} accent={accent}/>}
        {tab === 'messages' && <MessagesTab token={client.token} contact={contact} accent={accent}/>}
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
function OverviewTab({ snapshot, accent, setTab }) {
  const inv = snapshot?.payload?.invoices || []
  const docs = snapshot?.payload?.docs || []
  const quotes = snapshot?.payload?.quotes || []
  const totalInvoiced = inv.reduce((s, i) => s + (i.total || 0), 0)
  const paid = inv.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0)
  const outstanding = inv.filter(i => !['Paid','Cancelled'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <Stat label="Total Invoiced" value={fmt$(totalInvoiced)} color="#1D4ED8"/>
        <Stat label="Paid" value={fmt$(paid)} color="#10B981"/>
        <Stat label="Outstanding" value={fmt$(outstanding)} color="#EF4444"/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionTitle>Recent activity</SectionTitle>
          {inv.slice(0, 5).map(i => (
            <Row key={i.number}>
              <div style={{ flex: 1 }}>
                <div style={fontBold}>Invoice #{String(i.number).padStart(4, '0')}</div>
                <div style={fontSubtle}>{fmtDate(i.createdAt)}</div>
              </div>
              <Badge color={STATUS_COLORS[i.status] || '#64748B'}>{i.status}</Badge>
            </Row>
          ))}
          {inv.length === 0 && <Empty>No recent activity.</Empty>}
        </Card>
        <Card>
          <SectionTitle>Quick actions</SectionTitle>
          <button onClick={() => setTab('invoices')} style={{ ...quickBtn, borderColor: accent }}>💳 View invoices</button>
          <button onClick={() => setTab('proposals')} style={quickBtn}>📋 View proposals ({quotes.length})</button>
          <button onClick={() => setTab('documents')} style={quickBtn}>📄 View documents ({docs.length})</button>
          <button onClick={() => setTab('messages')} style={quickBtn}>💬 Send a message</button>
        </Card>
      </div>
    </div>
  )
}

function InvoicesTab({ snapshot, accent }) {
  const inv = snapshot?.payload?.invoices || []
  if (inv.length === 0) return <Empty>No invoices yet.</Empty>
  return (
    <Card style={{ overflow: 'hidden' }}>
      <table style={tbl}>
        <thead><tr>{['Number', 'Issued', 'Due', 'Total', 'Status', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>{inv.map(i => (
          <tr key={i.number}>
            <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>INV-{String(i.number).padStart(4, '0')}</td>
            <td style={td}>{fmtDate(i.createdAt)}</td>
            <td style={td}>{fmtDate(i.dueDate)}</td>
            <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>{fmt$(i.total)}</td>
            <td style={td}><Badge color={STATUS_COLORS[i.status] || '#64748B'}>{i.status}</Badge></td>
            <td style={{ ...td, textAlign: 'right' }}>
              {!['Paid','Cancelled'].includes(i.status) && <button onClick={() => alert('Online payments are coming soon — please contact your account manager to settle this invoice.')} style={{ ...payBtn(accent) }}>Pay Now</button>}
            </td>
          </tr>
        ))}</tbody>
      </table>
    </Card>
  )
}

function DocumentsTab({ snapshot, client, contact, accent, onSnapshotUpdate }) {
  const docs = snapshot?.payload?.docs || []
  const [signing, setSigning] = useState(null) // doc currently being signed
  if (docs.length === 0) return <Empty>No documents shared with you.</Empty>
  const onSigned = async (sigPayload, doc) => {
    // Persist signature into the snapshot payload (so the CRM owner sees Signed status next refresh)
    const next = JSON.parse(JSON.stringify(snapshot.payload))
    next.docs = (next.docs || []).map(d => d.id === doc.id ? { ...d, status: 'Signed', signature: sigPayload } : d)
    await writePortalSnapshot(client.token, next)
    onSnapshotUpdate({ ...snapshot, payload: next })
    setSigning(null)
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
          {d.status === 'Sent' && <button onClick={() => setSigning(d)} style={{ ...payBtn(accent), marginLeft: 8 }}>Sign</button>}
        </Row>
      ))}
      {signing && <InlineSignatureModal doc={signing} contact={contact} onClose={() => setSigning(null)} onSign={(payload) => onSigned(payload, signing)}/>}
    </Card>
  )
}

function ProposalsTab({ snapshot, client, contact, accent }) {
  const quotes = snapshot?.payload?.quotes || []
  if (quotes.length === 0) return <Empty>No proposals shared with you.</Empty>
  const requestChanges = async (q) => {
    const text = prompt(`Request changes to "${q.title || q.number}":\n\nWhat would you like changed?`)
    if (!text || !text.trim()) return
    await portalSendMessage(client.token, 'client', contact?.name || 'Client', `📋 Change requested for ${q.title || q.number}: ${text.trim()}`)
    alert('Your change request was sent to your account manager.')
  }
  const approve = async (q) => {
    if (!confirm(`Approve "${q.title || q.number}" for ${fmt$(q.total)}? This signals to your account manager that you're ready to proceed.`)) return
    await portalSendMessage(client.token, 'client', contact?.name || 'Client', `✅ Proposal approved: ${q.title || q.number} (${fmt$(q.total)})`)
    alert('Approval recorded — your account manager will follow up.')
  }
  return (
    <Card>
      {quotes.map((q, i) => (
        <div key={q.number || q.id || i} style={{ padding: '14px 0', borderTop: i ? '1px solid #E9EEF6' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={fontBold}>{q.title || q.number}</div>
              <div style={fontSubtle}>{fmtDate(q.createdAt)}{q.status ? ` · ${q.status}` : ''}</div>
            </div>
            <div style={{ ...fontBold, fontSize: 16, color: '#0F172A' }}>{fmt$(q.total)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={() => approve(q)} style={{ ...payBtn(accent) }}>Approve</button>
            <button onClick={() => requestChanges(q)} style={ghostBtn}>Request changes</button>
          </div>
        </div>
      ))}
    </Card>
  )
}

function ProjectsTab({ snapshot, accent }) {
  const deals = snapshot?.payload?.deals || []
  if (deals.length === 0) return <Empty>No projects yet.</Empty>
  return (
    <Card>
      {deals.map((d, i) => (
        <div key={d.id || i} style={{ padding: '16px 0', borderTop: i ? '1px solid #E9EEF6' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...fontBold, fontSize: 14 }}>{d.title}</div>
              <div style={fontSubtle}>{d.stage}{d.closeDate ? ` · close ${fmtDate(d.closeDate)}` : ''}</div>
              {d.stageNote && <div style={{ background: '#F8FAFC', borderLeft: `3px solid ${accent}`, padding: '8px 10px', marginTop: 6, fontSize: 12, color: '#475569' }}>{d.stageNote}</div>}
            </div>
            <div style={{ ...fontBold, fontSize: 18, color: '#0F172A' }}>{fmt$(d.value)}</div>
          </div>
          {typeof d.probability === 'number' && (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${d.probability}%`, height: '100%', background: accent }}/>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{d.probability}% probability</div>
            </div>
          )}
        </div>
      ))}
    </Card>
  )
}

function MessagesTab({ token, contact, accent }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)
  const refresh = async () => {
    const m = await portalListMessages(token)
    setMessages(m)
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, 50)
  }
  useEffect(() => { refresh() }, [token])
  const send = async () => {
    const v = draft.trim()
    if (!v) return
    setSending(true)
    await portalSendMessage(token, 'client', contact?.name || 'Client', v)
    setDraft('')
    await refresh()
    setSending(false)
  }
  return (
    <Card>
      <div ref={scrollRef} style={{ maxHeight: 480, overflowY: 'auto', padding: '6px 0' }}>
        {messages.length === 0 && <Empty>No messages yet. Send your account manager a note below.</Empty>}
        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_type === 'client' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{
              maxWidth: '70%',
              background: m.sender_type === 'client' ? accent : '#F1F5F9',
              color: m.sender_type === 'client' ? '#FFFFFF' : '#0F172A',
              padding: '10px 14px', borderRadius: 12, fontSize: 13,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, opacity: .8, marginBottom: 4 }}>{m.sender_name || (m.sender_type === 'client' ? 'You' : 'Account manager')} · {fmtTime(m.created_at)}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid #E9EEF6' }}>
        <textarea rows={2} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a message…" style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }}/>
        <button onClick={send} disabled={sending || !draft.trim()} style={{ ...btn(accent), opacity: (sending || !draft.trim()) ? .6 : 1 }}>Send</button>
      </div>
    </Card>
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
