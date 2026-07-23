// Public pricing page (/pricing). Ships without the CRM bundle.
import { useEffect, useState } from 'react'
import { Nav, Footer, LoadBarDivider, MarketingStyles } from './ui.jsx'
import { PLANS, FIELD_SERVICE, TRIAL_DAYS, FAIR_USE_USERS, hqopsCost, hqopsPlanName } from './pricing.js'
import { COMPETITOR_PRICING, competitorCost } from './competitorPricing.js'

const usePageMeta = (title, description) => {
  useEffect(() => {
    document.title = title
    const m = document.querySelector('meta[name="description"]')
    if (m) m.setAttribute('content', description)
  }, [title, description])
}

const FAQ = [
  { q: 'What counts as a workspace?', a: 'One business, entity, or brand. Three LLCs is three workspaces. Data is fully isolated between them, but you switch with one click from a single login.' },
  { q: 'Do you really not charge per user?', a: `Correct. Add your whole team, your crew, your bookkeeper. Fair use applies at ${FAIR_USE_USERS} users per workspace.` },
  { q: 'What happens after the trial?', a: `${TRIAL_DAYS} days, full features, no card. If you don't pick a plan your account goes read-only. Nothing is deleted.` },
  { q: 'Can I switch plans?', a: 'Any time. Upgrades prorate immediately, downgrades apply at period end.' },
  { q: 'Do I own my data?', a: 'Yes. Full export any time, in standard formats.' },
]

// Feature comparison. `sync` rows are managed-only per the honesty constraint —
// never shown as a self-serve checkmark.
const FTABLE = [
  { grp: 'Core' },
  { label: 'Workspaces', solo: '1', studio: '3', portfolio: 'Unlimited' },
  { label: 'Users', solo: 'Unlimited', studio: 'Unlimited', portfolio: 'Unlimited' },
  { label: 'Contacts, companies, pipeline', solo: true, studio: true, portfolio: true },
  { label: 'Custom pipeline stages & fields', solo: true, studio: true, portfolio: true },
  { label: 'Deal health & forecasting', solo: true, studio: true, portfolio: true },
  { grp: 'Client-facing' },
  { label: 'Quotes, proposals & e-signature', solo: true, studio: true, portfolio: true },
  { label: 'Invoicing', solo: true, studio: true, portfolio: true },
  { label: 'Branded client portal', solo: true, studio: true, portfolio: true },
  { grp: 'Operations' },
  { label: 'Time tracking & scheduling', solo: true, studio: true, portfolio: true },
  { label: 'Workflow automation', solo: false, studio: true, portfolio: true },
  { label: 'Cross-workspace reporting', solo: false, studio: true, portfolio: true },
  { label: 'Email & calendar sync', solo: 'managed', studio: 'managed', portfolio: 'managed' },
  { grp: 'Support' },
  { label: 'Priority support', solo: false, studio: false, portfolio: true },
  { label: 'Full data export', solo: true, studio: true, portfolio: true },
]

export default function Pricing() {
  usePageMeta(
    'Pricing — HQOps',
    'Flat pricing by the business, not the seat. Unlimited users on every plan. From $49/mo. Compare against Jobber, Pipedrive, Bonsai, and HubSpot.',
  )
  const [billing, setBilling] = useState('annual')
  const [tableOpen, setTableOpen] = useState(false)

  return (
    <div className="mkt">
      <MarketingStyles />
      <Nav current="/pricing" />

      <section className="mkt-section-tight" style={{ paddingTop: 56, textAlign: 'center' }}>
        <div className="mkt-wrap">
          <h1 className="mkt-h2" style={{ fontSize: 'clamp(32px,4.4vw,52px)' }}>Priced by the business, not the seat.</h1>
          <p className="mkt-lead" style={{ margin: '16px auto 26px' }}>
            Unlimited users on every plan. Add another business without adding another subscription.
          </p>
          <BillingToggle billing={billing} setBilling={setBilling} />
        </div>
      </section>

      <section style={{ paddingBottom: 20 }}>
        <div className="mkt-wrap">
          <div className="mkt-plans">
            {PLANS.map((p) => (
              <div key={p.key} className={`mkt-plan ${p.popular ? 'pop' : ''}`}>
                {p.popular && <div className="mkt-ribbon">Most popular</div>}
                <div className="mkt-plan-name">{p.name}</div>
                <div className="mkt-plan-tag">{p.tagline}</div>
                <div className="mkt-plan-price">
                  <b className="num">${billing === 'annual' ? p.annual : p.monthly}</b><span>/mo</span>
                </div>
                <div className="mkt-plan-bill">{billing === 'annual' ? 'per month, billed annually' : 'billed monthly'}</div>
                <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <a href="/login?mode=signup" className={`mkt-btn ${p.popular ? 'mkt-btn-primary' : 'mkt-btn-secondary'}`}>Start free trial</a>
              </div>
            ))}
          </div>

          {/* Field Service — capability shown, sold Contact-us only */}
          <div className="mkt-fs">
            <div className="mkt-fs-badge">◈</div>
            <div>
              <h3>{FIELD_SERVICE.name} <span className="mkt-fs-price">{FIELD_SERVICE.priceNote}</span></h3>
              <p>{FIELD_SERVICE.tagline} — {FIELD_SERVICE.features.join(', ')}. Set up with us so crew access is scoped correctly.</p>
            </div>
            <a href="mailto:hello@hqops.app?subject=HQOps%20Field%20Service%20enquiry" className="mkt-btn mkt-btn-ghost">Contact us</a>
          </div>
        </div>
      </section>

      <LoadBarDivider />

      {/* Interactive comparison — highest-converting section */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-eyebrow">The math, live</div>
          <h2 className="mkt-h2">Set your real numbers. Watch the gap.</h2>
          <ComparisonBand billing={billing} />
        </div>
      </section>

      {/* Full feature table */}
      <section className="mkt-section-tight" style={{ background: '#FAFBFD', borderTop: '1px solid #EDF1F6' }}>
        <div className="mkt-wrap">
          <h2 className="mkt-h2" style={{ fontSize: 'clamp(24px,3vw,34px)' }}>Compare every plan</h2>
          <button className="mkt-btn mkt-btn-secondary mkt-ftable-toggle" style={{ marginTop: 16 }} onClick={() => setTableOpen((o) => !o)}>
            {tableOpen ? 'Hide comparison' : 'Show full comparison'}
          </button>
          <div className={`mkt-ftable-wrap ${tableOpen ? '' : 'collapsed'}`}>
            <table className="mkt-ftable">
              <thead>
                <tr><th>Feature</th><th className="c">Solo</th><th className="c">Studio</th><th className="c">Portfolio</th></tr>
              </thead>
              <tbody>
                {FTABLE.map((row, i) =>
                  row.grp ? (
                    <tr key={i}><td className="grp" colSpan={4}>{row.grp}</td></tr>
                  ) : (
                    <tr key={i}>
                      <td>{row.label}</td>
                      {['solo', 'studio', 'portfolio'].map((k) => <td key={k} className="c">{renderCell(row[k])}</td>)}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <p className="mkt-compare-foot" style={{ maxWidth: 620 }}>
            Email & calendar sync is available on managed plans only. It runs against a Google integration that's
            published but not yet through Google's verification review, so we operate it for you rather than
            offering it self-serve.
          </p>
        </div>
      </section>

      {/* Managed services */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-managed">
            <div>
              <div className="mkt-eyebrow" style={{ color: '#6EE7B7' }}>Managed services</div>
              <h2 className="mkt-h2">Or hand the whole thing to us.</h2>
              <p>We configure and operate HQOps for you — quoting, invoicing, chasing unpaid balances, payroll prep, and client communication.</p>
            </div>
            <div className="mkt-managed-cta">
              <a href="mailto:hello@hqops.app?subject=Managed%20services%20enquiry" className="mkt-btn mkt-btn-primary mkt-btn-lg">Talk to us</a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mkt-section-tight">
        <div className="mkt-wrap">
          <h2 className="mkt-h2" style={{ textAlign: 'center' }}>Questions</h2>
          <FaqAccordion />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mkt-final" style={{ paddingTop: 40 }}>
        <div className="mkt-wrap">
          <h2 className="mkt-h2">Start free. Add businesses, not bills.</h2>
          <p className="mkt-lead">{TRIAL_DAYS} days, full features, no card.</p>
          <div className="mkt-final-ctas">
            <a href="/login?mode=signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">Start free trial</a>
            <a href="/demo" className="mkt-btn mkt-btn-secondary mkt-btn-lg">See the live demo</a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}

function BillingToggle({ billing, setBilling }) {
  return (
    <div className="mkt-toggle" role="group" aria-label="Billing period">
      <button className={billing === 'monthly' ? 'on' : ''} onClick={() => setBilling('monthly')}>Monthly</button>
      <button className={billing === 'annual' ? 'on' : ''} onClick={() => setBilling('annual')}>Annual</button>
      <span className="save">Save 20%</span>
    </div>
  )
}

function renderCell(v) {
  if (v === true) return <span className="yes">✓</span>
  if (v === false) return <span className="no">—</span>
  if (v === 'managed') return <span style={{ fontSize: 11.5, fontWeight: 700, color: '#7C3AED' }}>Managed</span>
  return <span className="num" style={{ fontWeight: 600 }}>{v}</span>
}

function ComparisonBand({ billing }) {
  const [businesses, setBusinesses] = useState(4)
  const [users, setUsers] = useState(10)
  const rows = [
    { name: 'HQOps', sub: hqopsPlanName(businesses), cost: hqopsCost(businesses, billing), win: true },
    ...COMPETITOR_PRICING.competitors.map((c) => ({ name: c.name, sub: c.note, cost: competitorCost(c, businesses, users) })),
  ].sort((a, b) => a.cost - b.cost)
  const max = Math.max(...rows.map((r) => r.cost))

  return (
    <div className="mkt-compare" style={{ marginTop: 24 }}>
      <div className="mkt-steppers">
        <Stepper label="Businesses" value={businesses} set={setBusinesses} min={1} max={6} />
        <Stepper label="Users" value={users} set={setUsers} min={1} max={25} />
      </div>
      <div className="mkt-compare-rows">
        {rows.map((r) => (
          <div key={r.name} className={`mkt-compare-row ${r.win ? 'win' : ''}`}>
            <div className="mkt-compare-name">{r.name}{r.win && <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', display: 'block' }}>{r.sub} plan</span>}</div>
            <div className="mkt-compare-track"><div className="mkt-compare-fill" style={{ width: `${Math.max(4, (r.cost / max) * 100)}%` }} /></div>
            <div className="mkt-compare-val num">${r.cost.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <p className="mkt-compare-foot">
        {COMPETITOR_PRICING.footnote} HQOps figure uses {billing} pricing; users never change it.
      </p>
    </div>
  )
}

function Stepper({ label, value, set, min, max }) {
  return (
    <div className="mkt-stepper">
      <label>{label}</label>
      <div className="mkt-stepper-ctl">
        <button aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => set((v) => Math.max(min, v - 1))}>−</button>
        <div className="mkt-stepper-val num">{value}</div>
        <button aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => set((v) => Math.min(max, v + 1))}>+</button>
      </div>
    </div>
  )
}

function FaqAccordion() {
  const [open, setOpen] = useState(0)
  return (
    <div className="mkt-faq">
      {FAQ.map((f, i) => (
        <div key={i} className="mkt-faq-item">
          <button className="mkt-faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
            {f.q}<span aria-hidden="true">+</span>
          </button>
          {open === i && <div className="mkt-faq-a">{f.a}</div>}
        </div>
      ))}
    </div>
  )
}
