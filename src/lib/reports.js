// Report engine: field metadata, templates, row builder, CSV/PDF export.
// Extracted verbatim from App.jsx (Phase 3 split) — no behavior changes.
import { isOpenStage, isWonStage, isOverdueDate, fmtInvNum, parseLocalDate } from "./domain.js";
import { calcLeadScore } from "./scoring.jsx";

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS — helpers, field metadata, templates, exports
// ═══════════════════════════════════════════════════════════════════════════════

// Date-range buckets used by Pipeline tab + Custom builder
const REPORT_DATE_RANGES = [
  ["all","All Time"],
  ["week","This Week"],
  ["month","This Month"],
  ["quarter","This Quarter"],
  ["year","This Year"],
  ["custom","Custom"],
];
const dateRangeBounds = (range, customFrom, customTo) => {
  const now = new Date();
  if (range === "all") return { from: null, to: null };
  if (range === "custom") return { from: customFrom ? new Date(customFrom) : null, to: customTo ? new Date(customTo) : null };
  const from = new Date(now);
  if (range === "week") { from.setDate(now.getDate() - 7); }
  else if (range === "month") { from.setMonth(now.getMonth() - 1); }
  else if (range === "quarter") { from.setMonth(now.getMonth() - 3); }
  else if (range === "year") { from.setMonth(now.getMonth() - 12); }
  return { from, to: now };
};
const inDateRange = (dateStr, from, to) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

// Field metadata for the Custom Report Builder. Each field knows how to render itself
// from a record + context (the full app data).
const REPORT_FIELDS = {
  contact: [
    { key:"name",        label:"Name",            get: c => c.name },
    { key:"email",       label:"Email",           get: c => c.email },
    { key:"phone",       label:"Phone",           get: c => c.phone },
    { key:"companyName", label:"Company",         get: c => c.companyName },
    { key:"source",      label:"Source / Platform", get: c => c.source },
    { key:"icp",         label:"ICP",             get: c => c.icp },
    { key:"status",      label:"Status",          get: c => c.status },
    { key:"active",      label:"Active",          get: c => (c.active!==false ? "Active" : "Inactive") },
    { key:"createdAt",   label:"Created Date",    type:"date", get: c => c.createdAt },
    { key:"leadScore",   label:"Lead Score",      numeric:true, get: (c,ctx) => calcLeadScore(c, ctx.deals||[], ctx.notes||[], ctx.tasks||[]) },
    { key:"lastNoteAt",  label:"Last Note Date",  type:"date", get: (c,ctx) => { const ns=(ctx.notes||[]).filter(n=>n.contactId===c.id); return ns.length?ns.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))[0].createdAt:null; } },
    { key:"dealCount",   label:"Deal Count",      numeric:true, get: (c,ctx) => (ctx.deals||[]).filter(d=>d.contactId===c.id).length },
    { key:"dealValue",   label:"Total Deal Value", numeric:true, money:true, get: (c,ctx) => (ctx.deals||[]).filter(d=>d.contactId===c.id).reduce((s,d)=>s+(+d.value||0),0) },
    { key:"followUp",    label:"Follow-up / Next Steps", get: c => c.followUp },
  ],
  company: [
    { key:"name",            label:"Name",            get: c => c.name },
    { key:"industry",        label:"Industry",        get: c => c.industry },
    { key:"city",            label:"City",            get: c => c.city },
    { key:"state",           label:"State",           get: c => c.state },
    { key:"website",         label:"Website",         get: c => c.website },
    { key:"employees",       label:"Employees",       numeric:true, get: c => c.employees },
    { key:"lifecycleStage",  label:"Lifecycle Stage", get: c => c.lifecycleStage },
    { key:"leadStatus",      label:"Lead Status",     get: c => c.leadStatus },
    { key:"contactCount",    label:"Contact Count",   numeric:true, get: (c,ctx) => (ctx.contacts||[]).filter(x=>x.companyId===c.id||x.companyName===c.name).length },
    { key:"dealCount",       label:"Deal Count",      numeric:true, get: (c,ctx) => (ctx.deals||[]).filter(d=>d.companyId===c.id).length },
    { key:"pipelineValue",   label:"Total Pipeline Value", numeric:true, money:true, get: (c,ctx) => (ctx.deals||[]).filter(d=>d.companyId===c.id&&isOpenStage(d,ctx.entity)).reduce((s,d)=>s+(+d.value||0),0) },
    { key:"wonRevenue",      label:"Won Revenue",     numeric:true, money:true, get: (c,ctx) => (ctx.deals||[]).filter(d=>d.companyId===c.id&&isWonStage(d,ctx.entity)).reduce((s,d)=>s+(+d.value||0),0) },
    { key:"lastContacted",   label:"Last Contacted",  type:"date", get: c => c.lastContacted },
  ],
  deal: [
    { key:"title",        label:"Title",       get: d => d.title },
    { key:"value",        label:"Value",       numeric:true, money:true, get: d => d.value },
    { key:"stage",        label:"Stage",       get: d => d.stage },
    { key:"companyName",  label:"Company",     get: (d,ctx) => { const c=(ctx.companies||[]).find(x=>x.id===d.companyId); return c?.name||d.companyName; } },
    { key:"contactName",  label:"Contact",     get: (d,ctx) => { const c=(ctx.contacts||[]).find(x=>x.id===d.contactId); return c?.name; } },
    { key:"closeDate",    label:"Close Date",  type:"date", get: d => d.closeDate },
    { key:"probability",  label:"Probability", numeric:true, get: d => d.probability },
    { key:"weighted",     label:"Weighted Value", numeric:true, money:true, get: d => (+d.value||0) * ((d.probability||50)/100) },
    { key:"dealType",     label:"Deal Type",   get: d => d.dealType },
    { key:"priority",     label:"Priority",    get: d => d.priority },
    { key:"owner",        label:"Owner",       get: d => d.owner },
    { key:"pipeline",     label:"Pipeline",    get: d => d.pipeline },
    { key:"daysInStage",  label:"Days in Stage", numeric:true, get: d => { const last=(d.stageHistory||[]).slice(-1)[0]; const since=last?new Date(last.at):new Date(d.createdAt); return Math.max(0, Math.round((Date.now()-since.getTime())/86400000)); } },
    { key:"createdAt",    label:"Created Date", type:"date", get: d => d.createdAt },
    { key:"stageNote",    label:"Stage Note",  get: d => d.stageNote },
    { key:"nextStep",     label:"Next Step",   get: d => d.nextStep },
  ],
  time: [
    { key:"contact",     label:"Contact",       get: (t,ctx) => (ctx.contacts||[]).find(c=>c.id===t.contactId)?.name },
    { key:"description", label:"Description",   get: t => t.description },
    { key:"hours",       label:"Hours",         numeric:true, get: t => t.hours },
    { key:"rate",        label:"Rate",          numeric:true, money:true, get: t => t.rate },
    { key:"billable",    label:"Billable Value", numeric:true, money:true, get: t => (+t.hours||0)*(+t.rate||0) },
    { key:"date",        label:"Date",          type:"date", get: t => t.date },
    { key:"invoiced",    label:"Invoiced",      get: (t,ctx) => (ctx.invoices||[]).some(i=>(i.items||[]).some(it=>it.timeEntryId===t.id))?"Yes":"No" },
  ],
  invoice: [
    { key:"number",      label:"Invoice Number", get: i => fmtInvNum(i.number) },
    { key:"contact",     label:"Contact",        get: (i,ctx) => (ctx.contacts||[]).find(c=>c.id===i.contactId)?.name },
    { key:"company",     label:"Company",        get: (i,ctx) => { const c=(ctx.contacts||[]).find(x=>x.id===i.contactId); const co=(ctx.companies||[]).find(x=>x.id===c?.companyId); return co?.name; } },
    { key:"total",       label:"Total",          numeric:true, money:true, get: i => (i.items||[]).reduce((s,it)=>s+(+it.quantity||0)*(+it.unitPrice||0),0) },
    { key:"status",      label:"Status",         get: i => i.status },
    { key:"dueDate",     label:"Due Date",       type:"date", get: i => i.dueDate },
    { key:"paidAt",      label:"Paid Date",      type:"date", get: i => i.status==="Paid" ? i.updatedAt||i.createdAt : null },
    { key:"itemsCount",  label:"Line Items",     numeric:true, get: i => (i.items||[]).length },
  ],
  expense: [
    { key:"date",         label:"Date",         type:"date", get: e => e.date },
    { key:"jobTitle",     label:"Job / Deal",   get: (e,ctx) => (ctx.deals||[]).find(d=>d.id===e.dealId)?.title },
    { key:"contactName",  label:"Client",       get: (e,ctx) => (ctx.contacts||[]).find(c=>c.id===e.contactId)?.name },
    { key:"companyName",  label:"Company",      get: (e,ctx) => { const co=(ctx.companies||[]).find(c=>c.id===e.companyId); if(co)return co.name; const ct=(ctx.contacts||[]).find(c=>c.id===e.contactId); const co2=(ctx.companies||[]).find(c=>c.id===ct?.companyId); return co2?.name||ct?.companyName; } },
    { key:"category",     label:"Category",     get: e => e.category },
    { key:"description",  label:"Description",  get: e => e.description },
    { key:"vendor",       label:"Vendor",       get: e => e.vendor },
    { key:"amount",       label:"Amount",       numeric:true, money:true, get: e => +e.amount||0 },
    { key:"billable",     label:"Billable",     get: e => e.billable ? "Yes" : "No" },
    { key:"invoiced",     label:"Invoiced",     get: e => e.invoiced ? "Yes" : "No" },
  ],
  activity: [
    { key:"createdAt",    label:"Date",         type:"date", get: n => n.createdAt },
    { key:"contactName",  label:"Contact",      get: (n,ctx) => (ctx.contacts||[]).find(c=>c.id===n.contactId)?.name },
    { key:"companyName",  label:"Company",      get: (n,ctx) => {
        const c=(ctx.contacts||[]).find(x=>x.id===n.contactId);
        if(c){ const co=(ctx.companies||[]).find(x=>x.id===c.companyId); if(co) return co.name; if(c.companyName) return c.companyName; }
        const d=(ctx.deals||[]).find(x=>x.id===n.dealId);
        return (ctx.companies||[]).find(x=>x.id===d?.companyId)?.name;
      } },
    { key:"dealTitle",    label:"Linked Deal",  get: (n,ctx) => (ctx.deals||[]).find(d=>d.id===n.dealId)?.title },
    { key:"noteType",     label:"Type",         get: n => n.noteKind || "Note" },
    { key:"body",         label:"Note",         get: n => n.content },
  ],
};
const REPORT_TYPE_LABELS = { contact:"Contact List", company:"Company List", deal:"Deal Pipeline", revenue:"Revenue Summary", activity:"Activity Log", time:"Time & Billing", invoice:"Invoice Report", expense:"Expense Report", custom:"Custom" };

// Pre-built templates (loaded as starting state for a new report)
const REPORT_TEMPLATES = [
  { name:"Monthly Pipeline Review", type:"deal", fields:["title","companyName","stage","value","weighted","closeDate"], filters:{ dateRange:"month", dateField:"createdAt" }, sort:{field:"value",dir:"desc"}, groupBy:"stage" },
  { name:"Contact Source Performance", type:"contact", fields:["name","companyName","source","dealCount","dealValue"], filters:{}, sort:{field:"dealValue",dir:"desc"}, groupBy:"source" },
  { name:"Overdue Deals", type:"deal", fields:["title","companyName","stage","value","closeDate","daysInStage"], filters:{ overdue:true }, sort:{field:"closeDate",dir:"asc"}, groupBy:null },
  { name:"Top Accounts", type:"company", fields:["name","industry","contactCount","dealCount","pipelineValue","wonRevenue"], filters:{}, sort:{field:"pipelineValue",dir:"desc"}, groupBy:null },
  { name:"Billable Hours This Month", type:"time", fields:["date","contact","description","hours","rate","billable"], filters:{ dateRange:"month", dateField:"date" }, sort:{field:"date",dir:"desc"}, groupBy:null },
  { name:"Outstanding Invoices", type:"invoice", fields:["number","contact","total","status","dueDate"], filters:{ statuses:["Sent","Viewed","Overdue"] }, sort:{field:"dueDate",dir:"asc"}, groupBy:"status" },
  { name:"Won Deals This Quarter", type:"deal", fields:["title","companyName","contactName","value","closeDate"], filters:{ dateRange:"quarter", dateField:"closeDate", stages:["Won"] }, sort:{field:"value",dir:"desc"}, groupBy:null },
  { name:"Expenses by Job", type:"expense", fields:["date","jobTitle","category","description","vendor","amount","billable"], filters:{}, sort:{field:"date",dir:"desc"}, groupBy:"jobTitle" },
  { name:"Expenses by Category", type:"expense", fields:["category","date","jobTitle","description","amount"], filters:{ dateRange:"month", dateField:"date" }, sort:{field:"amount",dir:"desc"}, groupBy:"category" },
  { name:"Unbilled Expenses", type:"expense", fields:["date","companyName","contactName","jobTitle","description","amount"], filters:{ billableOnly:true, uninvoicedOnly:true }, sort:{field:"date",dir:"desc"}, groupBy:"companyName" },
  { name:"Notes This Week", type:"activity", fields:["createdAt","contactName","companyName","dealTitle","noteType","body"], filters:{ dateRange:"week", dateField:"createdAt" }, sort:{field:"createdAt",dir:"desc"}, groupBy:"contactName" },
];

// Combine timeline notes (crm:notes) with per-stage deal notes into one
// reportable activity dataset. Timeline notes carry the body in `content` and a
// `type` of note/email/system; deal stage notes live on the deal object as the
// current `stageNote` plus archived `stageHistory[].note` entries. Each output
// record is normalized to { id, entityId, contactId, dealId, createdAt, content,
// noteKind } so the `activity` fieldset getters and the entity/date filters work
// uniformly across both kinds.
const NOTE_KIND_LABELS = { note: "Note", email: "Email", system: "System" };
const buildActivityRecords = (ctx) => {
  const out = [];
  (ctx.notes || []).forEach(n => {
    if (n.content == null || n.content === "") return;
    out.push({
      id: n.id, entityId: n.entityId, contactId: n.contactId ?? null,
      dealId: n.dealId ?? null, createdAt: n.createdAt,
      content: n.content, noteKind: NOTE_KIND_LABELS[n.type] || "Note",
    });
  });
  (ctx.deals || []).forEach(d => {
    if (d.stageNote) out.push({
      id: `${d.id}:stage-current`, entityId: d.entityId, contactId: d.contactId ?? null,
      dealId: d.id, createdAt: d.lastContacted || d.createdAt,
      content: d.stageNote, noteKind: "Stage note",
    });
    (d.stageHistory || []).forEach((h, i) => {
      if (!h.note) return;
      out.push({
        id: `${d.id}:stage-${i}`, entityId: d.entityId, contactId: d.contactId ?? null,
        dealId: d.id, createdAt: h.at || d.createdAt,
        content: h.note, noteKind: "Stage note",
      });
    });
  });
  return out;
};

// Build the rendered rows for a report given its definition + the app context
const runReportRows = (report, ctx) => {
  const fieldset = REPORT_FIELDS[report.type] || REPORT_FIELDS.deal;
  let base = [];
  if (report.type === "contact") base = ctx.contacts || [];
  else if (report.type === "company") base = ctx.companies || [];
  else if (report.type === "deal") base = ctx.deals || [];
  else if (report.type === "time") base = ctx.timeEntries || [];
  else if (report.type === "invoice") base = ctx.invoices || [];
  else if (report.type === "expense") base = ctx.expenses || [];
  else if (report.type === "revenue") base = ctx.deals || [];
  else if (report.type === "activity") base = buildActivityRecords(ctx);
  // Filter by entity (default = active entity, or all if filters.entityIds unset)
  if (report.filters?.entityIds?.length) {
    base = base.filter(r => report.filters.entityIds.includes(r.entityId));
  } else if (ctx.activeEntityId) {
    base = base.filter(r => !r.entityId || r.entityId === ctx.activeEntityId);
  }
  const f = report.filters || {};
  // Date filter
  if (f.dateRange && f.dateRange !== "all") {
    const { from, to } = dateRangeBounds(f.dateRange, f.dateFrom, f.dateTo);
    const dateField = f.dateField || "createdAt";
    base = base.filter(r => inDateRange(r[dateField], from, to));
  }
  // Stage filter (deals)
  if (f.stages?.length) base = base.filter(r => f.stages.includes(r.stage));
  // Status filter (invoices)
  if (f.statuses?.length) base = base.filter(r => f.statuses.includes(r.status));
  // Source/Platform (contacts)
  if (f.sources?.length) base = base.filter(r => f.sources.includes(r.source));
  // ICP (contacts)
  if (f.icps?.length) base = base.filter(r => f.icps.includes(r.icp));
  // Active toggle (contacts)
  if (f.activeOnly === true) base = base.filter(r => r.active !== false);
  if (f.activeOnly === false) base = base.filter(r => r.active === false);
  // Min/max value (deals)
  if (f.valueMin != null && f.valueMin !== "") base = base.filter(r => (+r.value || 0) >= +f.valueMin);
  if (f.valueMax != null && f.valueMax !== "") base = base.filter(r => (+r.value || 0) <= +f.valueMax);
  // Overdue (deals)
  if (f.overdue) base = base.filter(r => isOverdueDate(r.closeDate) && isOpenStage(r, ctx.entity));
  // Expense-specific filters
  if (f.billableOnly) base = base.filter(r => r.billable);
  if (f.uninvoicedOnly) base = base.filter(r => !r.invoiced);
  if (f.categories?.length) base = base.filter(r => f.categories.includes(r.category));
  // Project + sort + group
  const fields = (report.fields?.length ? report.fields : fieldset.map(f => f.key)).map(k => fieldset.find(f => f.key === k)).filter(Boolean);
  let rows = base.map(r => {
    const out = { __id: r.id, __raw: r };
    fields.forEach(f => { out[f.key] = f.get(r, ctx); });
    return out;
  });
  if (report.sort?.field) {
    const sf = report.sort.field;
    const dir = report.sort.dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av = a[sf], bv = b[sf];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }
  return { rows, fields };
};

// CSV escape + download
const exportReportCSV = (report, fields, rows) => {
  const esc = v => { const s = v == null ? "" : String(v); return /["\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const header = fields.map(f => esc(f.label)).join(",");
  const body = rows.map(r => fields.map(f => esc(r[f.key])).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${(report.name||"report").replace(/[^\w-]+/g,"_")}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// PDF export — open print-optimized HTML in a new tab; user uses browser print → save as PDF
const exportReportPDF = (report, fields, rows, summary, entity, filtersText) => {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${report.name||"Report"}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif; color: #0F172A; padding: 32px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #64748B; font-size: 12px; margin-bottom: 18px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 18px; }
  .stat { border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 14px; }
  .stat-label { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: .5px; font-weight: 700; }
  .stat-value { font-size: 18px; font-weight: 800; margin-top: 2px; color: #0F172A; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #F8FAFC; padding: 8px 10px; font-size: 10px; text-transform: uppercase; color: #64748B; font-weight: 700; border-bottom: 1px solid #E2E8F0; }
  td { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; color: #334155; }
  .group-header { background: #EFF6FF; color: #1E3A8A; font-weight: 700; padding: 8px 10px; font-size: 12px; }
  .footer { margin-top: 24px; font-size: 11px; color: #94A3B8; text-align: center; }
  @media print { body { padding: 16px; } button { display: none; } }
</style></head><body>
  <h1>${report.name||"Report"}</h1>
  <div class="meta">${entity?.name||""} · Generated ${new Date().toLocaleString()}${filtersText?` · ${filtersText}`:""}</div>
  <div class="summary">
    ${summary.map(s=>`<div class="stat"><div class="stat-label">${s.label}</div><div class="stat-value">${s.value}</div></div>`).join("")}
  </div>
  <table>
    <thead><tr>${fields.map(f=>`<th>${f.label}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${fields.map(f=>{
      let v = r[f.key]; if (v==null) v="—";
      if (f.money) v = typeof v === "number" ? "$"+v.toLocaleString("en-US",{maximumFractionDigits:0}) : v;
      else if (f.type==="date" && v && v !== "—") v = (parseLocalDate(v)||new Date(v)).toLocaleDateString();
      return `<td>${String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;")}</td>`;
    }).join("")}</tr>`).join("")}</tbody>
  </table>
  <div class="footer">${rows.length} row${rows.length===1?"":"s"} · HQOps</div>
  <script>setTimeout(()=>window.print(),300);</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html); w.document.close();
  return true;
};


export { buildActivityRecords,dateRangeBounds,exportReportCSV,exportReportPDF,inDateRange,NOTE_KIND_LABELS,REPORT_DATE_RANGES,REPORT_FIELDS,REPORT_TEMPLATES,REPORT_TYPE_LABELS,runReportRows };
