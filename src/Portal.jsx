import { useEffect, useState } from 'react'
import { fetchPortalSnapshot } from './lib/supabase.js'

const NAVY = '#0B1E3F'
const fmt$ = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v || 0)
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const STATUS_COLORS = { Draft: '#64748B', Sent: '#3B82F6', Viewed: '#8B5CF6', Paid: '#10B981', Overdue: '#EF4444', Cancelled: '#94A3B8' }

export default function Portal() {
  const token = (typeof window !== 'undefined' ? window.location.pathname.replace(/^\/portal\/?/, '').split('/')[0] : '') || ''
  const [status, setStatus] = useState('loading')
  const [payload, setPayload] = useState(null)
  const [createdAt, setCreatedAt] = useState(null)
  const [tab, setTab] = useState('invoices')

  useEffect(() => {
    if (!token) { setStatus('notfound'); return }
    fetchPortalSnapshot(token).then(res => {
      if (!res || !res.payload) { setStatus('notfound'); return }
      setPayload(res.payload)
      setCreatedAt(res.created_at)
      setStatus('ready')
    })
  }, [token])

  if (status === 'loading') {
    return (
      <Wrapper>
        <div style={{ padding: 60, textAlign: 'center', color: '#64748B' }}>Loading your portal…</div>
      </Wrapper>
    )
  }

  if (status === 'notfound') {
    return (
      <Wrapper>
        <Header workspace="Portal" contact="" />
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>This portal link isn't active</div>
          <div style={{ fontSize: 14, color: '#64748B', marginBottom: 16 }}>
            The link may have been revoked, or your account manager hasn't published any documents yet.
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8' }}>
            If you believe this is an error, contact the person who shared this link with you.
          </div>
        </div>
      </Wrapper>
    )
  }

  const { workspace, contact, invoices = [], docs = [], quotes = [] } = payload
  const totalDue = invoices.filter(i => !['Paid', 'Cancelled'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0)
  const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((s, i) => s + (i.total || 0), 0)

  return (
    <Wrapper>
      <Header workspace={workspace?.name || 'Workspace'} workspaceColor={workspace?.color} contact={contact?.name || ''} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <Stat label="Outstanding" value={fmt$(totalDue)} color="#EF4444" />
        <Stat label="Paid" value={fmt$(totalPaid)} color="#10B981" />
        <Stat label="Documents" value={`${docs.length + quotes.length}`} color="#1D4ED8" />
      </div>
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E2E8F0', marginBottom: 16 }}>
        {[
          ['invoices', `Invoices (${invoices.length})`],
          ['quotes', `Quotes (${quotes.length})`],
          ['docs', `Documents (${docs.length})`],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '10px 18px', borderBottom: `2px solid ${tab === id ? '#1D4ED8' : 'transparent'}`,
            color: tab === id ? '#1D4ED8' : '#64748B', fontWeight: 600, fontSize: 13,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'invoices' && (
        invoices.length === 0
          ? <Empty msg="No invoices yet. Anything billed to you will appear here." />
          : (
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Number', 'Issued', 'Due', 'Total', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{invoices.map(inv => (
                  <tr key={inv.number}>
                    <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>INV-{String(inv.number).padStart(4, '0')}</td>
                    <td style={td}>{fmtDate(inv.createdAt)}</td>
                    <td style={td}>{fmtDate(inv.dueDate)}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>{fmt$(inv.total)}</td>
                    <td style={td}><Badge color={STATUS_COLORS[inv.status] || '#64748B'}>{inv.status}</Badge></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
      )}

      {tab === 'quotes' && (
        quotes.length === 0
          ? <Empty msg="No quotes shared with you yet." />
          : (
            <div style={card}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Quote', 'Created', 'Total', 'Status'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{quotes.map(q => (
                  <tr key={q.number || q.id}>
                    <td style={{ ...td, color: '#0F172A', fontWeight: 600 }}>{q.title || q.number}</td>
                    <td style={td}>{fmtDate(q.createdAt)}</td>
                    <td style={{ ...td, fontWeight: 700, color: '#0F172A' }}>{fmt$(q.total)}</td>
                    <td style={td}><Badge color="#7C3AED">{q.status || 'Sent'}</Badge></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )
      )}

      {tab === 'docs' && (
        docs.length === 0
          ? <Empty msg="No documents have been shared with you." />
          : (
            <div style={card}>
              {docs.map((d, i) => (
                <div key={d.id || i} style={{ padding: '14px 18px', borderTop: i ? '1px solid #E9EEF6' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1D4ED8', fontWeight: 700 }}>📄</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{fmtDate(d.createdAt)}</div>
                  </div>
                  {d.status && <Badge color={d.status === 'Signed' ? '#10B981' : '#F59E0B'}>{d.status}</Badge>}
                </div>
              ))}
            </div>
          )
      )}

      {createdAt && (
        <div style={{ marginTop: 24, fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
          Data as of {fmtDate(createdAt)}. If something looks out of date, ask {workspace?.name || 'your account manager'} to refresh this portal.
        </div>
      )}
    </Wrapper>
  )
}

function Wrapper({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </div>
    </div>
  )
}

function Header({ workspace, workspaceColor, contact }) {
  return (
    <div style={{ background: NAVY, borderRadius: 14, padding: '26px 28px', color: '#FFFFFF', marginBottom: 24, boxShadow: '0 2px 14px rgba(15,30,60,.08)' }}>
      <div style={{ fontSize: 12, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>{workspace}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', marginTop: 4 }}>
        {contact ? `Welcome, ${contact}` : 'Client portal'}
      </div>
      <div style={{ fontSize: 13, color: '#CBD5E1', marginTop: 6 }}>
        Your invoices, quotes, and documents in one place. No login required.
      </div>
      {workspaceColor && <div style={{ height: 3, background: workspaceColor, borderRadius: 2, marginTop: 16 }}/>}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: .5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 6 }}>{value}</div>
    </div>
  )
}

function Empty({ msg }) {
  return <div style={{ ...card, padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>{msg}</div>
}

function Badge({ color, children }) {
  return (
    <span style={{ background: color + '20', color, border: `1px solid ${color}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>{children}</span>
  )
}

const card = { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }
const th = { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: .5, background: '#F8FAFC' }
const td = { padding: '12px 16px', fontSize: 13, color: '#475569', borderTop: '1px solid #F1F5F9' }
