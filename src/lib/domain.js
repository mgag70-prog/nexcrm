// Pure domain constants, entity/stage helpers, and formatters.
// Extracted verbatim from App.jsx (Phase 3 split) — no behavior changes.

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STAGES = ["New Lead","Contacted","Responded / Interested","Follow-up / Discovery","Demo Scheduled","Proposal Sent","Won","Lost"];
const SC = {
  "New Lead":"#8B5CF6",
  "Contacted":"#F59E0B",
  "Responded / Interested":"#06B6D4",
  "Follow-up / Discovery":"#8B5CF6",
  "Demo Scheduled":"#F97316",
  "Proposal Sent":"#3B82F6",
  "Won":"#10B981",
  "Lost":"#EF4444",
};

// ─── FIELD SERVICE ────────────────────────────────────────────────────────────
const FS_STAGES = ["New Lead","Contacted","Estimate Sent","Won / Scheduled","In Progress","Completed","Lost"];
const FS_SC = {
  "New Lead":"#94A3B8",
  "Contacted":"#3B82F6",
  "Estimate Sent":"#F59E0B",
  "Won / Scheduled":"#10B981",
  "In Progress":"#F97316",
  "Completed":"#14B8A6",
  "Lost":"#EF4444",
};
const SERVICE_TYPES = ["Lawn Maintenance","Mulching","Aeration","Spring Cleanup","Fall Cleanup","Hardscaping","Tree/Shrub Care","Snow Removal","Irrigation","Landscape Design","Other"];
const EMPLOYEE_ROLES = ["Crew Lead","Crew Member","Foreman","Supervisor","Admin"];
const RECURRING_FREQUENCIES = ["Weekly","Bi-Weekly","Monthly","Seasonal"];
const EXPENSE_CATEGORIES = [
  "Labor (subcontracted)",
  "Materials & Supplies",
  "Equipment & Tools",
  "Fuel & Transportation",
  "Permits & Fees",
  "Software & Subscriptions",
  "Marketing & Advertising",
  "Meals & Entertainment",
  "Travel & Lodging",
  "Professional Services",
  "Office & Admin",
  "Other",
];
const EXPENSE_CATEGORY_COLORS = {
  "Labor (subcontracted)":"#8B5CF6",
  "Materials & Supplies":"#059669",
  "Equipment & Tools":"#F59E0B",
  "Fuel & Transportation":"#EF4444",
  "Permits & Fees":"#3B82F6",
  "Software & Subscriptions":"#06B6D4",
  "Marketing & Advertising":"#EC4899",
  "Meals & Entertainment":"#F97316",
  "Travel & Lodging":"#14B8A6",
  "Professional Services":"#6366F1",
  "Office & Admin":"#64748B",
  "Other":"#94A3B8",
};
const isFieldService = e => e?.type === "Field Service Business";
// Terminology overrides for Field Service entities. Keys are stable; UI calls t(entity, key).
const FS_TERMS = {
  deal:"Job", deals:"Jobs",
  Deal:"Job", Deals:"Jobs",
  pipeline:"Job Board",
  addDeal:"Add Job", editDeal:"Edit Job",
  dealName:"Job Name", dealTitle:"Job Title",
  closeDate:"Scheduled Date",
  value:"Job Value",
  contactsLabel:"Customers",
  proposalSent:"Estimate Sent",
};
const DEFAULT_TERMS = {
  deal:"deal", deals:"deals",
  Deal:"Deal", Deals:"Deals",
  pipeline:"Pipeline",
  addDeal:"Add Deal", editDeal:"Edit Deal",
  dealName:"Deal Title", dealTitle:"Deal Title",
  closeDate:"Close Date",
  value:"Value",
  contactsLabel:"Contacts",
  proposalSent:"Proposal Sent",
};
const t = (entity, key) => (isFieldService(entity) ? FS_TERMS[key] : null) || DEFAULT_TERMS[key] || key;
// Date-frequency math for recurring jobs
const advanceDate = (iso, freq) => {
  const base = iso ? new Date(iso) : new Date();
  if(isNaN(base.getTime())) return null;
  const d = new Date(base);
  if(freq==="Weekly") d.setDate(d.getDate()+7);
  else if(freq==="Bi-Weekly") d.setDate(d.getDate()+14);
  else if(freq==="Monthly") d.setMonth(d.getMonth()+1);
  else if(freq==="Seasonal") d.setMonth(d.getMonth()+3);
  else return null;
  return d.toISOString().slice(0,10);
};

const stagesFor = e => {
  if(Array.isArray(e?.stages) && e.stages.length) return e.stages;
  if(isFieldService(e)) return FS_STAGES;
  return STAGES;
};
const stageColor = (e, s) => e?.stageColors?.[s] || (isFieldService(e) ? FS_SC[s] : null) || SC[s] || "#64748B";
// Returns the entity's pipeline + any orphan stages found in the deals (so legacy/imported stages still render).
const stagesForWithOrphans = (entity, deals) => {
  const base = stagesFor(entity);
  const used = [...new Set((deals || []).map(d => d.stage).filter(Boolean))];
  const orphans = used.filter(s => !base.includes(s));
  return [...base, ...orphans];
};

// ─── WON / OPEN / LOST classification ──────────────────────────────────────────
// Resolves a deal's stage to won / lost / open for ANY pipeline flavor:
//   • Standard  → "Won" wins, "Lost" is dead.
//   • Field service → "Won / Scheduled", "In Progress", "Completed" all win; "Lost" dead.
//   • Custom (e.g. Crestfolio: …, "Active Client", "Inactive") → last non-dead
//     stage wins, "Inactive"/"Lost" is dead — matching the existing /lost|inactive/
//     "live stages" convention used by the momentum engine.
// Use these instead of hardcoded ["Won","Lost"] literals so KPIs, pipeline totals,
// close rate and forecast reconcile across every entity's pipeline.
const isLostStageName = s => /lost|inactive/i.test(s || "");
const FS_WON_STAGES = ["Won / Scheduled", "In Progress", "Completed"];
const wonStagesFor = (entity) => {
  if (isFieldService(entity)) return FS_WON_STAGES;
  const stages = stagesFor(entity);
  if (stages.includes("Won")) return ["Won"];
  // Custom pipeline with no literal "Won": the last live (non-dead) stage is the win state.
  const live = stages.filter(s => !isLostStageName(s));
  return live.length ? [live[live.length - 1]] : [];
};
const dealStageClass = (stage, entity) => {
  if (!stage) return "open";
  if (isLostStageName(stage)) return "lost";
  return wonStagesFor(entity).includes(stage) ? "won" : "open";
};
const isWonStage  = (deal, entity) => dealStageClass(deal?.stage, entity) === "won";
const isLostStage = (deal, entity) => dealStageClass(deal?.stage, entity) === "lost";
const isOpenStage = (deal, entity) => dealStageClass(deal?.stage, entity) === "open";

// One-time stage migration map for legacy/imported pipeline names.
const STAGE_MIGRATION_MAP = {
  "Outreach Sent": "Contacted",
  "Responded/Interested": "Responded / Interested",
  "Follow-up": "Follow-up / Discovery",
  "Paying Subscriber": "Won",
  "Appointment Scheduled": "New Lead",
  "Qualified To Buy": "Contacted",
  "Presentation Scheduled": "Proposal Sent",
  "Decision Maker Bought-In": "Proposal Sent",
  "Decision Maker Bought In": "Proposal Sent",
  "Contract Sent": "Proposal Sent",
  "Closed Won": "Won",
  "Closed Lost": "Lost",
  // Field Service: "Proposal Sent" → "Estimate Sent". Sales-only stages collapse to "Contacted" / "Estimate Sent" for FS.
  "Proposal Sent": "Estimate Sent",
  "Demo Scheduled": "Estimate Sent",
  "Responded / Interested": "Contacted",
  "Follow-up / Discovery": "Contacted",
  "Won": "Won / Scheduled",
};
const SOURCES = ["Website","Referral","LinkedIn","Cold Outreach","Event","Partner","BiggerPockets","HubSpot Import","Zoho Import","Other"];
const PLATFORMS = SOURCES; // alias — "Source" is now also surfaced as "Platform"
const ICP_LEVELS = ["Small","Medium","High","Very High"];
const LIFECYCLE_STAGES = ["Lead","Prospect","Opportunity","Customer","Churned"];
const LEAD_STATUSES = ["New","Open","In Progress","Qualified","Unqualified"];
const DEAL_TYPES = ["New Business","Existing Business","Renewal","Upsell"];
const DEAL_PRIORITIES = ["Low","Medium","High"];
const ETYPES = ["LLC","Corporation","Non-Profit","Partnership","Sole Proprietor","S-Corp","Trust","Field Service Business"];
const PRIORITIES = ["low","medium","high"];
const INDUSTRIES = [
  // Generic
  "Technology","SaaS","Finance","Healthcare","Retail","Manufacturing","Real Estate","Legal","Education",
  // Field Service
  "Construction","Landscaping","Electrical","HVAC","Plumbing","Roofing","Painting","Pest Control","Cleaning Services","Property Management",
  // Fairway Circuit
  "Indoor Golf Facility","Outdoor League","Tech Vendor","Golf Vendor","Golf Trip Organizer",
  // Crestfolio
  "Personal","Family Investment Account","Real Estate Investor","Small Business",
  "Other"
];
const EMAIL_PROVIDERS = [{id:"gmail",label:"Gmail",color:"#EA4335",logo:"G"},{id:"outlook",label:"Outlook",color:"#0078D4",logo:"O"},{id:"smtp",label:"SMTP/Other",color:"#64748B",logo:"@"}];
const SOURCE_SCORE = {"LinkedIn":20,"Referral":20,"Website":15,"Event":12,"Partner":18,"Cold Outreach":8,"Other":5,"HubSpot Import":10,"Zoho Import":10};
const TRIGGER_LABELS = {"new_contact":"New Contact Created","stage_change":"Deal Stage Changes","task_overdue":"Task Becomes Overdue","deal_created":"New Deal Created","deal_won":"Deal Marked Won"};
const ACTION_LABELS = {"create_task":"Create a Task","add_note":"Log a Note","enroll_sequence":"Enroll in Sequence","update_score":"Update Lead Score"};


const fmt$ = v => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:0}).format(v||0);
// Parse a value as a LOCAL date. Date-only strings ("YYYY-MM-DD") would otherwise
// parse as UTC midnight and render/compare a day early in timezones behind UTC.
const parseLocalDate = (v) => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(v); // full ISO timestamp / other → native parse (already tz-correct)
  return isNaN(d.getTime()) ? null : d;
};
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
// Overdue = strictly before today (date-only compare). "Due today" is its own state.
const isOverdueDate = (v) => { const d = parseLocalDate(v); return !!d && d < startOfToday(); };
const isDueToday = (v) => {
  const d = parseLocalDate(v); if (!d) return false;
  const s = startOfToday(); const e = new Date(s); e.setDate(e.getDate() + 1);
  return d >= s && d < e;
};
const fmtDate = d => { const dt = parseLocalDate(d); return dt ? dt.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—"; };
const fmtTime = d => d ? new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "—";
const uid = () => `id_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const initials = n => n?.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()||"?";
const ACOLORS = ["#3B82F6","#8B5CF6","#EC4899","#10B981","#F59E0B","#EF4444","#06B6D4","#F97316"];
const avColor = n => ACOLORS[((n?.charCodeAt(0)||0)+(n?.charCodeAt(1)||0))%ACOLORS.length];
const scoreColor = s => s>=75?"#10B981":s>=50?"#F59E0B":s>=25?"#F97316":"#EF4444";


const INVOICE_STATUSES = ["Draft","Sent","Viewed","Paid","Overdue","Cancelled"];
const INV_COLORS = {"Draft":"#64748B","Sent":"#3B82F6","Viewed":"#8B5CF6","Paid":"#10B981","Overdue":"#EF4444","Cancelled":"#94A3B8"};
const QUOTE_STATUSES = ["Draft","Sent","Accepted","Declined"];
const QUOTE_COLORS = {"Draft":"#64748B","Sent":"#3B82F6","Accepted":"#10B981","Declined":"#EF4444"};
// Portal approvals historically wrote "Approved" — surface it as "Accepted".
const quoteStatusLabel = s => (s==="Approved" ? "Accepted" : (s||"Draft"));
const quoteStatusColor = s => QUOTE_COLORS[quoteStatusLabel(s)] || "#64748B";
const WEBHOOK_EVENTS = ["contact.created","contact.updated","deal.created","deal.won","deal.lost","invoice.sent","invoice.paid","meeting.booked","form.submitted","time.logged"];
const DURATIONS = [15,30,45,60,90,120];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const fmtHours = h => h===1?"1 hr":`${h} hrs`;
const fmtInvNum = n => `INV-${String(n).padStart(4,"0")}`;
const genToken = () => Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);

export { ACOLORS,ACTION_LABELS,advanceDate,avColor,DAYS,DEAL_PRIORITIES,DEAL_TYPES,dealStageClass,DEFAULT_TERMS,DURATIONS,EMAIL_PROVIDERS,EMPLOYEE_ROLES,ETYPES,EXPENSE_CATEGORIES,EXPENSE_CATEGORY_COLORS,fmt$,fmtDate,fmtHours,fmtInvNum,fmtTime,FS_SC,FS_STAGES,FS_TERMS,FS_WON_STAGES,genToken,ICP_LEVELS,INDUSTRIES,initials,INV_COLORS,INVOICE_STATUSES,isDueToday,isFieldService,isLostStage,isLostStageName,isOpenStage,isOverdueDate,isWonStage,LEAD_STATUSES,LIFECYCLE_STAGES,parseLocalDate,PLATFORMS,PRIORITIES,QUOTE_COLORS,QUOTE_STATUSES,quoteStatusColor,quoteStatusLabel,RECURRING_FREQUENCIES,SC,scoreColor,SERVICE_TYPES,SOURCE_SCORE,SOURCES,STAGE_MIGRATION_MAP,stageColor,STAGES,stagesFor,stagesForWithOrphans,startOfToday,t,TRIGGER_LABELS,uid,WEBHOOK_EVENTS,wonStagesFor };
