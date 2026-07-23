// Public landing page (/). Ships without the CRM bundle — see main.jsx.
import { useEffect } from 'react'
import { Nav, Footer, LoadBar, LoadBarDivider, MarketingStyles, ENTITY_COLORS, ENTITY_NAMES } from './ui.jsx'
import { hqopsCost } from './pricing.js'
import { COMPETITOR_PRICING, competitorCost } from './competitorPricing.js'

const usePageMeta = (title, description) => {
  useEffect(() => {
    document.title = title
    const m = document.querySelector('meta[name="description"]')
    if (m) m.setAttribute('content', description)
  }, [title, description])
}

// The problem section: 4 businesses × 10 users, three per-seat competitors vs HQOps.
const COST_BUSINESSES = 4
const COST_USERS = 10
const byKey = Object.fromEntries(COMPETITOR_PRICING.competitors.map((c) => [c.key, c]))
const problemRows = [
  { name: 'HubSpot', sub: 'Sales Hub Pro', cost: competitorCost(byKey.hubspot, COST_BUSINESSES, COST_USERS) },
  { name: 'Pipedrive', sub: 'Professional', cost: competitorCost(byKey.pipedrive, COST_BUSINESSES, COST_USERS) },
  { name: 'Jobber', sub: 'Grow', cost: competitorCost(byKey.jobber, COST_BUSINESSES, COST_USERS) },
  { name: 'HQOps', sub: 'Portfolio', cost: hqopsCost(COST_BUSINESSES), win: true },
]
const costMax = Math.max(...problemRows.map((r) => r.cost))

const GROUPS = [
  { color: ENTITY_COLORS[0], title: 'Sales', items: ['Contacts & companies', 'Pipeline with custom stages', 'Deal health scoring', 'Forecasting'] },
  { color: ENTITY_COLORS[1], title: 'Client-facing', items: ['Quotes & proposals', 'E-signature', 'Invoicing', 'Branded client portal with its own login'] },
  { color: ENTITY_COLORS[2], title: 'Operations', items: ['Time tracking', 'Expense logging by job', 'Scheduling', 'Workflow automation', 'Web forms'] },
  { color: ENTITY_COLORS[3], title: 'Field service', items: ['GPS time clock', 'Crew management', 'Dispatch', 'Job costing'] },
  { color: ENTITY_COLORS[4], title: 'Multi-entity', items: ['Isolated data per business', 'Per-entity pipelines & fields', 'Cross-entity reporting'] },
]

// Simplified, static echo of the calendar view — the differentiator made visible.
const CAL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
// Fictional companies spanning four industries (colors: navy=Marchfield
// Landscaping, green=Calder Advisory, amber=Ridgeline Property,
// violet=Two Rivers Studio). No real contacts or deal values.
const CAL_EVENTS = [
  [{ c: ENTITY_COLORS[1], t: '9:00', n: 'Calder — quarterly review' }],
  [{ c: ENTITY_COLORS[3], t: '10:30', n: 'Juniper — launch prep' }, { c: ENTITY_COLORS[1], t: '1:00', n: 'Advisory discovery' }],
  [{ c: ENTITY_COLORS[0], t: '8:00', n: 'Fielder Grounds — pilot review' }, { c: ENTITY_COLORS[2], t: '3:00', n: 'Oakline walkthrough' }],
  [{ c: ENTITY_COLORS[3], t: '9:00', n: 'Juniper kickoff' }],
  [{ c: ENTITY_COLORS[0], t: '10:00', n: 'Cedar Ridge — spring crew' }],
]
const CAL_LOADS = [
  [{ c: ENTITY_COLORS[1], w: 100 }],
  [{ c: ENTITY_COLORS[3], w: 45 }, { c: ENTITY_COLORS[1], w: 55 }],
  [{ c: ENTITY_COLORS[0], w: 40 }, { c: ENTITY_COLORS[2], w: 60 }],
  [{ c: ENTITY_COLORS[3], w: 100 }],
  [{ c: ENTITY_COLORS[0], w: 100 }],
]

export default function Marketing() {
  usePageMeta(
    'HQOps — One system for every business you run',
    'Run multiple businesses from one platform. CRM, quoting, invoicing, scheduling, and client portals with unlimited users on every plan. From $49/mo.',
  )

  return (
    <div className="mkt">
      <MarketingStyles />
      <Nav current="/" />

      {/* HERO — the whole site's thesis */}
      <section className="mkt-hero">
        <div className="mkt-wrap">
          <h1>Four businesses.<br />One system. One bill.</h1>
          <p className="mkt-hero-sub">
            HQOps is the operations platform for people running more than one business. CRM, quoting,
            invoicing, scheduling, time tracking, and client portals — with unlimited users on every plan.
          </p>
          <div className="mkt-hero-ctas">
            <a href="/login?mode=signup" className="mkt-btn mkt-btn-primary mkt-btn-lg">Start free trial</a>
            <a href="/demo" className="mkt-btn mkt-btn-secondary mkt-btn-lg">See the live demo</a>
            <span className="mkt-hero-note">No signup required for the demo.</span>
          </div>

          {/* signature: one strip, five businesses */}
          <div className="mkt-hero-bar">
            <LoadBar segments={ENTITY_COLORS.map((c) => ({ color: c }))} height={12} radius={6} />
            <div className="mkt-hero-bar-labels">
              {ENTITY_NAMES.map((n, i) => (
                <span key={n}><i style={{ background: ENTITY_COLORS[i] }} /><b>{n}</b></span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <LoadBarDivider />

      {/* THE PROBLEM — the strongest argument, given room */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-cost">
            <div className="mkt-eyebrow" style={{ color: '#6EE7B7' }}>The multi-business tax</div>
            <h2 className="mkt-h2">Per-seat pricing punishes you for growing.</h2>
            <p className="mkt-cost-lead mkt-lead">
              Run four businesses on a per-seat CRM and you get four subscriptions, four logins, four bills,
              and no consolidated view. Here's ten users across four businesses, every month:
            </p>
            <div className="mkt-cost-rows">
              {problemRows.map((r) => (
                <div key={r.name} className={`mkt-cost-row ${r.win ? 'win' : ''}`}>
                  <div className="mkt-cost-name">{r.name}<small>{r.sub}</small></div>
                  <div className="mkt-cost-track">
                    <div className="mkt-cost-fill" style={{ width: `${(r.cost / costMax) * 100}%`, background: r.win ? '#10B981' : 'rgba(255,255,255,.28)' }} />
                  </div>
                  <div className="mkt-cost-val num">${r.cost.toLocaleString()}<span style={{ fontSize: 12, opacity: .6, fontWeight: 500 }}>/mo</span></div>
                </div>
              ))}
            </div>
            <p className="mkt-cost-foot">
              Same team, same work. HQOps charges by the business, not the seat — {' '}
              <a href="/pricing" style={{ color: '#6EE7B7', borderBottom: '1px solid rgba(110,231,183,.4)' }}>see the full comparison</a>.
            </p>
          </div>
        </div>
      </section>

      {/* CALENDAR — the strongest differentiator */}
      <section className="mkt-section" style={{ background: '#FAFBFD', borderTop: '1px solid #EDF1F6', borderBottom: '1px solid #EDF1F6' }}>
        <div className="mkt-wrap">
          <div className="mkt-cal">
            <div>
              <div className="mkt-eyebrow">One calendar, every business</div>
              <h2 className="mkt-h2">The meeting view no one else can build.</h2>
              <p className="mkt-lead" style={{ marginTop: 16 }}>
                A merged week across all your businesses, with CRM context on every meeting: who you're seeing,
                their open deals and health score, outstanding invoices, and a flag when someone's gone quiet.
                Competitors can't do this — they don't have both halves of the data.
              </p>
              <a href="/demo" className="mkt-btn mkt-btn-ghost" style={{ marginTop: 22 }}>Open it in the demo →</a>
            </div>
            <CalendarEcho />
          </div>
        </div>
      </section>

      {/* WHAT'S INSIDE — grouped, not a dump */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-eyebrow">What's inside</div>
          <h2 className="mkt-h2">Everything the businesses need, in one place.</h2>
          <div className="mkt-groups">
            {GROUPS.map((g) => (
              <div key={g.title} className="mkt-group" style={{ '--c': g.color }}>
                <div className="mkt-group-top">
                  <span className="mkt-group-dot" style={{ background: g.color }} />
                  <h3>{g.title}</h3>
                </div>
                <ul>{g.items.map((it) => <li key={it}>{it}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LoadBarDivider />

      {/* MANAGED SERVICES */}
      <section className="mkt-section">
        <div className="mkt-wrap">
          <div className="mkt-managed">
            <div>
              <div className="mkt-eyebrow" style={{ color: '#6EE7B7' }}>Managed services</div>
              <h2 className="mkt-h2">Don't want to run it yourself?</h2>
              <p>We configure HQOps and operate it for you — so the system runs whether or not you have time to.</p>
              <ul>
                <li>Quoting & invoicing</li>
                <li>Chasing unpaid balances</li>
                <li>Payroll prep</li>
                <li>Client communication</li>
              </ul>
            </div>
            <div className="mkt-managed-cta">
              <a href="mailto:hello@hqops.app?subject=Managed%20services%20enquiry" className="mkt-btn mkt-btn-primary mkt-btn-lg">Talk to us</a>
              <a href="/pricing" className="mkt-btn mkt-btn-secondary">See plans first</a>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mkt-final">
        <div className="mkt-wrap">
          <h2 className="mkt-h2">Every business you run, one login.</h2>
          <p className="mkt-lead">Start free for 14 days. No card, full features, unlimited users.</p>
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

function CalendarEcho() {
  return (
    <div>
      <div className="mkt-cal-visual" role="img" aria-label="A week calendar merging meetings from five businesses">
        <div className="mkt-cal-head">
          {CAL_DAYS.map((d, i) => (
            <div key={d} className="mkt-cal-day">
              <div className="mkt-cal-dow">{d}</div>
              <div className="mkt-cal-load">
                {CAL_LOADS[i].map((s, j) => <span key={j} style={{ width: `${s.w}%`, background: s.c }} />)}
              </div>
            </div>
          ))}
        </div>
        <div className="mkt-cal-body">
          {CAL_EVENTS.map((col, i) => (
            <div key={i} className="mkt-cal-col">
              {col.map((e, j) => (
                <div key={j} className="mkt-cal-ev" style={{ '--c': e.c }}>
                  <small className="num">{e.t}</small>{e.n}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      {/* context-panel echo */}
      <div className="mkt-cal-panel" style={{ marginTop: 14 }}>
        <div className="who">
          <div className="av" style={{ background: ENTITY_COLORS[0] }}>DP</div>
          <div><b>Dana Poole</b><small>Fielder Grounds · Marchfield Landscaping</small></div>
        </div>
        <div className="mkt-cal-deal">
          <div className="top"><span>Maintenance Pilot</span><span className="num">$2,400</span></div>
          <div className="meta">
            <span className="mkt-cal-chip" style={{ background: '#F1F5F9', color: '#475569' }}>Outreach Sent</span>
            <span className="mkt-cal-chip" style={{ background: '#FEF2F2', color: '#B91C1C' }}>Health 38 ↓</span>
          </div>
        </div>
        <div className="mkt-cal-quiet"><b>Gone quiet.</b> Last note was 34 days ago. Worth opening with that.</div>
      </div>
    </div>
  )
}
