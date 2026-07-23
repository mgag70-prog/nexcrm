// Shared marketing design system — tokens, the entity load-bar motif, nav,
// footer, and the injected stylesheet. Visual language matches the app and the
// approved calendar mockup: navy #0F2044 / green #059669, Sora display over a
// system body face, hairline-bordered white cards, tabular figures.
import { useState } from 'react'

// The five-business entity palette. The load bar built from these is the site's
// signature — several businesses living inside one system, made literal.
export const ENTITY_COLORS = ['#0F2044', '#059669', '#D97706', '#7C3AED', '#0891B2']
export const ENTITY_NAMES = ['Fairway Circuit', 'Crestfolio', 'HQ Sports', 'GrayHQ', 'Add another']

export function Wordmark({ size = 20 }) {
  return (
    <span className="mkt-wordmark" style={{ fontSize: size }}>
      HQ<span>Ops</span>
    </span>
  )
}

// Signature motif. `segments`: array of {color, value, label}. Used labeled in
// the hero, thin+unlabeled as a section divider, and functionally as cost bars.
export function LoadBar({ segments, height = 8, radius = 4, className = '' }) {
  const total = segments.reduce((s, x) => s + (x.value ?? 1), 0)
  return (
    <div className={`mkt-loadbar ${className}`} style={{ height, borderRadius: radius }}>
      {segments.map((s, i) => (
        <span key={i} style={{ width: `${((s.value ?? 1) / total) * 100}%`, background: s.color }} title={s.label || undefined} />
      ))}
    </div>
  )
}

// Thin unlabeled divider between sections — the connective tissue of the page.
export function LoadBarDivider() {
  const segs = ENTITY_COLORS.map((c) => ({ color: c }))
  return <div className="mkt-divider" aria-hidden="true"><LoadBar segments={segs} height={4} radius={0} /></div>
}

export function Nav({ current }) {
  const [open, setOpen] = useState(false)
  const links = [
    { href: '/pricing', label: 'Pricing' },
    { href: '/demo', label: 'Live demo' },
    { href: '/login', label: 'Log in' },
  ]
  return (
    <header className="mkt-nav">
      <div className="mkt-nav-in">
        <a href="/" className="mkt-nav-brand" aria-label="HQOps home"><Wordmark /></a>
        <button className="mkt-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span /><span /><span />
        </button>
        <nav className={`mkt-nav-links ${open ? 'open' : ''}`} aria-label="Main">
          {links.map((l) => (
            <a key={l.href} href={l.href} className={`mkt-nav-link ${current === l.href ? 'on' : ''}`}>{l.label}</a>
          ))}
          <a href="/portal/login" className="mkt-nav-portal">Client portal</a>
          <a href="/login?mode=signup" className="mkt-btn mkt-btn-primary mkt-nav-cta">Start free trial</a>
        </nav>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mkt-footer">
      <div className="mkt-footer-in">
        <div className="mkt-footer-brand">
          <Wordmark size={22} />
          <p>One system for every business you run.</p>
          <LoadBar segments={ENTITY_COLORS.map((c) => ({ color: c }))} height={5} />
        </div>
        <div className="mkt-footer-cols">
          <div>
            <h4>Product</h4>
            <a href="/pricing">Pricing</a>
            <a href="/demo">Live demo</a>
            <a href="/login?mode=signup">Start free trial</a>
          </div>
          <div>
            <h4>Access</h4>
            <a href="/login">CRM log in</a>
            <a href="/portal/login">Client portal</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="mailto:hello@hqops.app?subject=HQOps%20enquiry">Managed services</a>
            <a href="mailto:hello@hqops.app?subject=HQOps%20enquiry">Contact</a>
          </div>
        </div>
      </div>
      <div className="mkt-footer-base">
        <span>© {'2026'} HQOps</span>
        <span>Built for people running more than one business.</span>
      </div>
    </footer>
  )
}

// One injected stylesheet for both marketing pages. Scoped under .mkt so it
// can never leak into the CRM (which lives on /app under its own inline styles).
export function MarketingStyles() {
  return <style>{CSS}</style>
}

const CSS = `
.mkt{--navy:#0F2044;--navy-2:#1E3A6B;--green:#059669;--green-dk:#047857;
  --bg:#F1F5F9;--surface:#fff;--text:#0F172A;--muted:#475569;--faint:#94A3B8;
  --border:#E2E8F0;--hairline:#EDF1F6;
  color:var(--text);background:var(--surface);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased;}
.mkt *{box-sizing:border-box;}
.mkt a{text-decoration:none;}
/* Buttons keep their OWN colors — excluding .mkt-btn here stops a secondary
   (white) button on a dark band from inheriting white text and vanishing. */
.mkt a:not(.mkt-btn){color:inherit;}
.mkt .num{font-variant-numeric:tabular-nums;}
.mkt h1,.mkt h2,.mkt h3,.mkt .mkt-wordmark{font-family:"Sora",-apple-system,sans-serif;letter-spacing:-0.02em;}
.mkt-wordmark{font-weight:800;color:var(--navy);}
.mkt-wordmark span{color:var(--green);}
.mkt-wrap{max-width:1120px;margin:0 auto;padding:0 24px;}

/* motif */
.mkt-loadbar{display:flex;width:100%;overflow:hidden;background:var(--hairline);}
.mkt-loadbar span{display:block;height:100%;}
.mkt-divider{padding:0;}

/* buttons */
.mkt-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  font-weight:650;font-size:15px;border-radius:9px;padding:12px 20px;cursor:pointer;
  border:1px solid transparent;transition:transform .12s ease,box-shadow .12s ease,background .12s ease;white-space:nowrap;}
.mkt-btn-primary{background:var(--green);color:#fff;box-shadow:0 1px 2px rgba(5,150,105,.25);}
.mkt-btn-primary:hover{background:var(--green-dk);transform:translateY(-1px);box-shadow:0 6px 18px rgba(5,150,105,.28);}
.mkt-btn-secondary{background:#fff;color:var(--navy);border-color:var(--border);}
.mkt-btn-secondary:hover{border-color:var(--navy-2);transform:translateY(-1px);}
.mkt-btn-lg{font-size:16px;padding:14px 26px;}
.mkt-btn-ghost{background:transparent;color:var(--navy);border-color:var(--border);}
.mkt-btn-ghost:hover{background:var(--bg);}

/* nav */
.mkt-nav{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.86);
  backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--border);}
.mkt-nav-in{max-width:1120px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:16px;}
.mkt-nav-brand{margin-right:auto;}
.mkt-nav-links{display:flex;align-items:center;gap:22px;}
.mkt-nav-link{font-size:14.5px;font-weight:600;color:var(--muted);}
.mkt-nav-link:hover,.mkt-nav-link.on{color:var(--navy);}
.mkt-nav-portal{font-size:12.5px;font-weight:600;color:var(--faint);
  border:1px solid var(--border);border-radius:20px;padding:4px 12px;}
.mkt-nav-portal:hover{color:var(--muted);border-color:#CBD5E1;}
.mkt-nav-cta{padding:9px 16px;font-size:14px;}
.mkt-burger{display:none;flex-direction:column;gap:4px;background:none;border:0;cursor:pointer;padding:8px;}
.mkt-burger span{width:22px;height:2px;background:var(--navy);border-radius:2px;}

/* generic section rhythm — deliberately varied, not uniform */
.mkt-section{padding:84px 0;}
.mkt-section-tight{padding:56px 0;}
.mkt-eyebrow{font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--green);margin-bottom:14px;}
.mkt-h2{font-size:clamp(28px,3.4vw,42px);font-weight:800;line-height:1.1;color:var(--navy);}
.mkt-lead{font-size:clamp(16px,1.5vw,19px);color:var(--muted);max-width:620px;line-height:1.6;}

/* hero */
.mkt-hero{padding:76px 0 64px;position:relative;overflow:hidden;}
.mkt-hero h1{font-size:clamp(38px,6vw,74px);font-weight:800;line-height:1.02;color:var(--navy);}
.mkt-hero-sub{font-size:clamp(17px,1.7vw,21px);color:var(--muted);max-width:640px;margin:22px 0 0;line-height:1.55;}
.mkt-hero-ctas{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px;align-items:center;}
.mkt-hero-note{font-size:13.5px;color:var(--faint);}
.mkt-hero-bar{margin-top:52px;}
.mkt-hero-bar-labels{display:flex;margin-top:10px;gap:0;}
.mkt-hero-bar-labels span{flex:1;font-size:12.5px;font-weight:600;color:var(--muted);
  display:flex;align-items:center;gap:6px;min-width:0;}
.mkt-hero-bar-labels i{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.mkt-hero-bar-labels span b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;}

/* problem / cost math */
.mkt-cost{background:var(--navy);color:#fff;border-radius:20px;padding:clamp(28px,4vw,48px);}
.mkt-cost h2{color:#fff;}
.mkt-cost-lead{color:#B9C6DC;max-width:600px;margin-top:14px;}
.mkt-cost-rows{margin-top:30px;display:flex;flex-direction:column;gap:14px;}
.mkt-cost-row{display:grid;grid-template-columns:150px 1fr auto;align-items:center;gap:16px;}
.mkt-cost-name{font-size:15px;font-weight:650;color:#E2E8F0;}
.mkt-cost-name small{display:block;font-size:11.5px;color:#8093AE;font-weight:500;margin-top:1px;}
.mkt-cost-track{height:14px;border-radius:7px;background:rgba(255,255,255,.08);overflow:hidden;}
.mkt-cost-fill{height:100%;border-radius:7px;transition:width .6s cubic-bezier(.16,1,.3,1);}
.mkt-cost-val{font-size:19px;font-weight:750;min-width:96px;text-align:right;}
.mkt-cost-row.win .mkt-cost-name,.mkt-cost-row.win .mkt-cost-val{color:#6EE7B7;}
.mkt-cost-foot{margin-top:24px;font-size:12.5px;color:#8093AE;line-height:1.5;}

/* calendar echo */
.mkt-cal{display:grid;grid-template-columns:1fr .9fr;gap:36px;align-items:center;}
.mkt-cal-visual{background:#fff;border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 18px 50px rgba(15,32,68,.10);}
.mkt-cal-head{display:grid;grid-template-columns:repeat(5,1fr);border-bottom:1px solid var(--border);}
.mkt-cal-day{padding:8px 8px 7px;border-right:1px solid var(--hairline);}
.mkt-cal-day:last-child{border-right:0;}
.mkt-cal-dow{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);}
.mkt-cal-load{display:flex;height:4px;border-radius:2px;overflow:hidden;margin-top:6px;background:var(--hairline);}
.mkt-cal-load span{display:block;height:100%;}
.mkt-cal-body{display:grid;grid-template-columns:repeat(5,1fr);min-height:260px;}
.mkt-cal-col{border-right:1px solid var(--hairline);padding:6px;position:relative;}
.mkt-cal-col:last-child{border-right:0;}
.mkt-cal-ev{border-radius:5px;padding:5px 7px;margin-bottom:5px;font-size:10.5px;font-weight:650;line-height:1.25;border-left:3px solid var(--c);background:color-mix(in srgb,var(--c) 9%,#fff);}
.mkt-cal-ev small{display:block;font-weight:600;color:var(--muted);font-size:9.5px;}
.mkt-cal-panel{background:#fff;border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:0 8px 30px rgba(15,32,68,.08);}
.mkt-cal-panel .who{display:flex;align-items:center;gap:11px;margin-bottom:14px;}
.mkt-cal-panel .av{width:38px;height:38px;border-radius:50%;background:var(--violet,#7C3AED);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;}
.mkt-cal-panel .who b{font-size:14px;font-weight:700;display:block;}
.mkt-cal-panel .who small{font-size:12px;color:var(--muted);}
.mkt-cal-deal{border:1px solid var(--border);border-radius:9px;padding:11px 12px;margin-bottom:10px;}
.mkt-cal-deal .top{display:flex;justify-content:space-between;font-size:13px;font-weight:700;}
.mkt-cal-deal .meta{display:flex;gap:6px;margin-top:8px;}
.mkt-cal-chip{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:5px;}
.mkt-cal-quiet{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;border-radius:8px;padding:9px 11px;font-size:12px;line-height:1.5;}

/* what's inside — grouped */
.mkt-groups{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px;}
.mkt-group{background:#fff;border:1px solid var(--border);border-radius:14px;padding:22px;}
.mkt-group-top{display:flex;align-items:center;gap:10px;margin-bottom:14px;}
.mkt-group-dot{width:11px;height:11px;border-radius:3px;flex-shrink:0;}
.mkt-group h3{font-size:16px;font-weight:750;color:var(--navy);}
.mkt-group ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px;}
.mkt-group li{font-size:14px;color:var(--muted);padding-left:20px;position:relative;line-height:1.4;}
.mkt-group li::before{content:"";position:absolute;left:0;top:7px;width:7px;height:7px;border-radius:2px;background:var(--c);}

/* managed services band */
.mkt-managed{background:linear-gradient(135deg,#0F2044,#15294f);color:#fff;border-radius:20px;padding:clamp(28px,4vw,46px);display:grid;grid-template-columns:1.3fr 1fr;gap:32px;align-items:center;}
.mkt-managed h2{color:#fff;}
.mkt-managed p{color:#B9C6DC;margin-top:14px;max-width:520px;}
.mkt-managed ul{list-style:none;padding:0;margin:18px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:8px 18px;}
.mkt-managed li{font-size:14px;color:#DCE5F1;padding-left:20px;position:relative;}
.mkt-managed li::before{content:"→";position:absolute;left:0;color:var(--green);font-weight:700;}
.mkt-managed-cta{display:flex;flex-direction:column;gap:10px;}

/* final cta */
.mkt-final{text-align:center;padding:96px 0;}
.mkt-final h2{font-size:clamp(30px,4vw,50px);}
.mkt-final .mkt-lead{margin:16px auto 30px;}
.mkt-final-ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;}

/* footer */
.mkt-footer{background:var(--navy);color:#B9C6DC;padding:56px 0 0;}
.mkt-footer .mkt-wordmark{color:#fff;} /* HQ must not be navy-on-navy */
.mkt-footer-in{max-width:1120px;margin:0 auto;padding:0 24px 40px;display:grid;grid-template-columns:1.4fr 2fr;gap:40px;}
.mkt-footer-brand p{margin:12px 0 16px;font-size:14px;max-width:260px;}
.mkt-footer-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;}
.mkt-footer-cols h4{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8093AE;margin-bottom:12px;}
.mkt-footer-cols a{display:block;font-size:14px;color:#DCE5F1;padding:4px 0;}
.mkt-footer-cols a:hover{color:#fff;}
.mkt-footer-base{border-top:1px solid rgba(255,255,255,.09);padding:18px 24px;max-width:1120px;margin:0 auto;
  display:flex;justify-content:space-between;font-size:12.5px;color:#8093AE;flex-wrap:wrap;gap:8px;}

/* pricing page */
.mkt-toggle{display:inline-flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--border);border-radius:30px;padding:5px;margin:0 auto;}
.mkt-toggle button{border:0;background:transparent;font-size:14px;font-weight:650;color:var(--muted);padding:8px 18px;border-radius:22px;cursor:pointer;transition:all .15s;}
.mkt-toggle button.on{background:var(--navy);color:#fff;}
.mkt-toggle .save{font-size:11.5px;font-weight:800;color:var(--green);background:#ECFDF5;border:1px solid #A7F3D0;border-radius:20px;padding:3px 9px;}
.mkt-plans{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:40px;align-items:start;}
.mkt-plan{background:#fff;border:1px solid var(--border);border-radius:16px;padding:26px 24px;position:relative;display:flex;flex-direction:column;}
.mkt-plan.pop{border-color:var(--green);box-shadow:0 12px 40px rgba(5,150,105,.14);}
.mkt-ribbon{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--green);color:#fff;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:4px 12px;border-radius:20px;white-space:nowrap;}
.mkt-plan-name{font-size:19px;font-weight:750;color:var(--navy);}
.mkt-plan-tag{font-size:13px;color:var(--muted);margin-top:2px;min-height:34px;}
.mkt-plan-price{display:flex;align-items:baseline;gap:4px;margin:14px 0 2px;}
.mkt-plan-price b{font-size:44px;font-weight:800;color:var(--navy);letter-spacing:-.03em;}
.mkt-plan-price span{font-size:14px;color:var(--faint);font-weight:600;}
.mkt-plan-bill{font-size:12.5px;color:var(--faint);min-height:18px;}
.mkt-plan ul{list-style:none;padding:0;margin:18px 0 22px;display:flex;flex-direction:column;gap:9px;flex:1;}
.mkt-plan li{font-size:14px;color:var(--muted);padding-left:22px;position:relative;line-height:1.4;}
.mkt-plan li::before{content:"✓";position:absolute;left:0;color:var(--green);font-weight:800;}
.mkt-plan .mkt-btn{width:100%;}
.mkt-fs{background:#fff;border:1px dashed #C7B6E8;border-radius:16px;padding:24px;margin-top:18px;
  display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;}
.mkt-fs-badge{width:44px;height:44px;border-radius:11px;background:#F5F0FF;color:var(--violet,#7C3AED);
  display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.mkt-fs h3{font-size:17px;font-weight:750;color:var(--navy);}
.mkt-fs p{font-size:13.5px;color:var(--muted);margin-top:3px;}
.mkt-fs-price{font-size:14px;font-weight:700;color:#7C3AED;}

/* comparison band */
.mkt-compare{background:var(--bg);border-radius:20px;padding:clamp(24px,3.5vw,40px);}
.mkt-steppers{display:flex;gap:28px;flex-wrap:wrap;margin-top:24px;}
.mkt-stepper label{font-size:12.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:8px;}
.mkt-stepper-ctl{display:inline-flex;align-items:center;gap:0;background:#fff;border:1px solid var(--border);border-radius:11px;overflow:hidden;}
.mkt-stepper-ctl button{width:42px;height:42px;border:0;background:#fff;font-size:20px;color:var(--navy);cursor:pointer;}
.mkt-stepper-ctl button:hover{background:var(--bg);}
.mkt-stepper-ctl button:disabled{color:#CBD5E1;cursor:not-allowed;}
.mkt-stepper-val{min-width:54px;text-align:center;font-size:18px;font-weight:750;color:var(--navy);border-left:1px solid var(--border);border-right:1px solid var(--border);height:42px;display:flex;align-items:center;justify-content:center;}
.mkt-compare-rows{margin-top:28px;display:flex;flex-direction:column;gap:12px;}
.mkt-compare-row{display:grid;grid-template-columns:130px 1fr 110px;align-items:center;gap:16px;}
.mkt-compare-name{font-size:14.5px;font-weight:650;color:var(--text);}
.mkt-compare-track{height:26px;background:#E7ECF3;border-radius:8px;overflow:hidden;}
.mkt-compare-fill{height:100%;border-radius:8px;transition:width .5s cubic-bezier(.16,1,.3,1);background:#B4C0D2;}
.mkt-compare-row.win .mkt-compare-fill{background:var(--green);}
.mkt-compare-row.win .mkt-compare-name{color:var(--green-dk);font-weight:750;}
.mkt-compare-val{font-size:18px;font-weight:750;text-align:right;color:var(--text);}
.mkt-compare-row.win .mkt-compare-val{color:var(--green-dk);}
.mkt-compare-foot{margin-top:22px;font-size:12px;color:var(--faint);line-height:1.5;}

/* feature table */
.mkt-ftable-wrap{overflow-x:auto;margin-top:20px;border:1px solid var(--border);border-radius:14px;}
.mkt-ftable{width:100%;border-collapse:collapse;min-width:560px;}
.mkt-ftable th,.mkt-ftable td{text-align:left;padding:12px 16px;font-size:14px;border-bottom:1px solid var(--hairline);}
.mkt-ftable thead th{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);background:#FAFBFD;}
.mkt-ftable td.c{text-align:center;}
.mkt-ftable .yes{color:var(--green);font-weight:800;}
.mkt-ftable .no{color:#CBD5E1;}
.mkt-ftable .grp{font-weight:750;color:var(--navy);background:#FAFBFD;}
.mkt-ftable-toggle{display:none;}

/* faq */
.mkt-faq{max-width:760px;margin:36px auto 0;}
.mkt-faq-item{border-bottom:1px solid var(--border);}
.mkt-faq-q{width:100%;text-align:left;background:none;border:0;padding:20px 0;font-size:16.5px;font-weight:650;color:var(--navy);cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;}
.mkt-faq-q span{color:var(--faint);font-size:22px;font-weight:400;transition:transform .2s;flex-shrink:0;}
.mkt-faq-q[aria-expanded="true"] span{transform:rotate(45deg);}
.mkt-faq-a{font-size:15px;color:var(--muted);line-height:1.65;padding:0 0 20px;max-width:660px;}

/* responsive */
@media (max-width:900px){
  .mkt-burger{display:flex;}
  .mkt-nav-links{position:absolute;top:100%;left:0;right:0;background:#fff;border-bottom:1px solid var(--border);
    flex-direction:column;align-items:stretch;gap:0;padding:8px 0;display:none;box-shadow:0 12px 30px rgba(15,32,68,.10);}
  .mkt-nav-links.open{display:flex;}
  .mkt-nav-link{padding:12px 24px;}
  .mkt-nav-portal{margin:6px 24px;text-align:center;}
  .mkt-nav-cta{margin:6px 24px 10px;}
  .mkt-cal{grid-template-columns:1fr;gap:24px;}
  .mkt-groups{grid-template-columns:1fr;}
  .mkt-managed{grid-template-columns:1fr;gap:24px;}
  .mkt-plans{grid-template-columns:1fr;max-width:420px;margin-left:auto;margin-right:auto;}
  .mkt-footer-in{grid-template-columns:1fr;gap:28px;}
  .mkt-managed ul{grid-template-columns:1fr;}
}
@media (max-width:680px){
  .mkt-section{padding:60px 0;}
  .mkt-hero{padding:48px 0 44px;}
  .mkt-cost-row{grid-template-columns:96px 1fr;grid-template-areas:"name val" "track track";row-gap:6px;}
  .mkt-cost-name{grid-area:name;}
  .mkt-cost-val{grid-area:val;}
  .mkt-cost-track{grid-area:track;}
  .mkt-compare-row{grid-template-columns:88px 1fr 76px;gap:10px;}
  .mkt-compare-val{font-size:15px;}
  .mkt-fs{grid-template-columns:1fr;text-align:center;}
  .mkt-fs-badge{margin:0 auto;}
  .mkt-hero-bar-labels span b{display:none;}
  .mkt-ftable-toggle{display:inline-flex;}
  .mkt-ftable-wrap.collapsed{display:none;}
}
.mkt :focus-visible{outline:2px solid var(--green);outline-offset:2px;border-radius:3px;}
@media (prefers-reduced-motion:reduce){.mkt *{transition:none!important;animation:none!important;}}
`
