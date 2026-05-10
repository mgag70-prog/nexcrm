import { useState, useEffect, useRef, useCallback } from "react";
import { writePortalSnapshot, deletePortalSnapshot } from "./lib/supabase.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend, LineChart, Line, AreaChart, Area } from "recharts";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STAGES = ["New Lead","Contacted","Proposal Sent","Won","Lost"];
const SC = {"New Lead":"#8B5CF6","Contacted":"#F59E0B","Proposal Sent":"#3B82F6","Won":"#10B981","Lost":"#EF4444"};
const stagesFor = e => Array.isArray(e?.stages) && e.stages.length ? e.stages : STAGES;
const stageColor = (e, s) => e?.stageColors?.[s] || SC[s] || "#64748B";
const SOURCES = ["Website","Referral","LinkedIn","Cold Outreach","Event","Partner","BiggerPockets","HubSpot Import","Zoho Import","Other"];
const PLATFORMS = SOURCES; // alias — "Source" is now also surfaced as "Platform"
const ICP_LEVELS = ["Small","Medium","High","Very High"];
const LIFECYCLE_STAGES = ["Lead","Prospect","Opportunity","Customer","Churned"];
const LEAD_STATUSES = ["New","Open","In Progress","Qualified","Unqualified"];
const DEAL_TYPES = ["New Business","Existing Business","Renewal","Upsell"];
const DEAL_PRIORITIES = ["Low","Medium","High"];
const ETYPES = ["LLC","Corporation","Non-Profit","Partnership","Sole Proprietor","S-Corp","Trust"];
const PRIORITIES = ["low","medium","high"];
const INDUSTRIES = [
  // Generic
  "Technology","SaaS","Finance","Healthcare","Retail","Manufacturing","Real Estate","Legal","Education",
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
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "—";
const fmtTime = d => d ? new Date(d).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}) : "—";
const uid = () => `id_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const initials = n => n?.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()||"?";
const ACOLORS = ["#3B82F6","#8B5CF6","#EC4899","#10B981","#F59E0B","#EF4444","#06B6D4","#F97316"];
const avColor = n => ACOLORS[((n?.charCodeAt(0)||0)+(n?.charCodeAt(1)||0))%ACOLORS.length];
const scoreColor = s => s>=75?"#10B981":s>=50?"#F59E0B":s>=25?"#F97316":"#EF4444";


const INVOICE_STATUSES = ["Draft","Sent","Viewed","Paid","Overdue","Cancelled"];
const INV_COLORS = {"Draft":"#64748B","Sent":"#3B82F6","Viewed":"#8B5CF6","Paid":"#10B981","Overdue":"#EF4444","Cancelled":"#94A3B8"};
const WEBHOOK_EVENTS = ["contact.created","contact.updated","deal.created","deal.won","deal.lost","invoice.sent","invoice.paid","meeting.booked","form.submitted","time.logged"];
const DURATIONS = [15,30,45,60,90,120];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const fmtHours = h => h===1?"1 hr":`${h} hrs`;
const fmtInvNum = n => `INV-${String(n).padStart(4,"0")}`;
const genToken = () => Math.random().toString(36).slice(2,10)+Math.random().toString(36).slice(2,10);

// ─── LEAD SCORING ─────────────────────────────────────────────────────────────
function calcLeadScore(contact, deals, notes, tasks) {
  let score = 0;
  const cDeals = deals.filter(d=>d.contactId===contact.id);
  const cNotes = notes.filter(n=>n.contactId===contact.id);
  const cTasks = tasks.filter(t=>t.contactId===contact.id);
  // Deal presence & value
  if(cDeals.length>0) score+=15;
  if(cDeals.some(d=>d.stage==="Proposal Sent"||d.stage==="Contacted")) score+=15;
  if(cDeals.some(d=>d.stage==="Won")) score+=25;
  const maxVal = Math.max(...cDeals.map(d=>d.value||0),0);
  if(maxVal>50000) score+=15; else if(maxVal>10000) score+=10; else if(maxVal>1000) score+=5;
  // Activity
  if(cNotes.length>=3) score+=10; else if(cNotes.length>=1) score+=5;
  if(cTasks.filter(t=>t.completed).length>0) score+=5;
  // Source quality
  score += Math.min(SOURCE_SCORE[contact.source]||5, 15);
  return Math.min(score, 100);
}

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
const DEMO = {
  entities:[
    {id:"e3",name:"Fairway Circuit LLC",type:"LLC",color:"#F59E0B",industry:"Sports & Recreation",website:"fairwaycircuit.com"},
    {id:"e4",name:"Crestfolio LLC",type:"LLC",color:"#8B5CF6",industry:"Financial Services",website:"crestfolio.io",
      stages:["Initial Contact","Discovery Meeting","Proposal Sent","Under Agreement","Active Client","Inactive"],
      stageColors:{"Initial Contact":"#8B5CF6","Discovery Meeting":"#F59E0B","Proposal Sent":"#3B82F6","Under Agreement":"#06B6D4","Active Client":"#10B981","Inactive":"#94A3B8"}},
  ],
  contacts:[],
  companies:[],
  deals:[],
  tasks:[],
  notes:[],
  emailIntegrations:[],
  products:[],
  sequences:[],
  templates:[],
  forms:[],
  automations:[],
  docs:[],
  quotes:[],
  customFields:[
    {id:"cf_e4_1",entityId:"e4",entity:"contact",name:"Contact Type",type:"select",options:["Individual","Family","Small Business","Family Office","RIA"]},
    {id:"cf_e4_2",entityId:"e4",entity:"contact",name:"AUM Range",type:"select",options:["Under $1M","$1M-$5M","$5M-$25M","$25M-$100M","$100M+"]},
    {id:"cf_e4_3",entityId:"e4",entity:"contact",name:"Relationship Manager",type:"text"},
    {id:"cf_e4_4",entityId:"e4",entity:"contact",name:"Referral Source",type:"text"},
  ],
  enrollments:[],
  timeEntries:[],
  invoices:[],
  meetings:[],
  webhooks:[],
  portalTokens:[],
  emailThreads:[],
  availability:{},
  invoiceCounter:1,
};

const DEMO_FULL = {
  entities:[
    {id:"e1",name:"Apex Ventures LLC",type:"LLC",color:"#3B82F6",industry:"Technology"},
    {id:"e2",name:"GreenPath Foundation",type:"Non-Profit",color:"#10B981",industry:"Education"},
  ],
  contacts:[
    {id:"c1",entityId:"e1",name:"Sarah Johnson",email:"sarah@techcorp.com",phone:"+1 555-0101",companyName:"TechCorp",source:"LinkedIn",title:"VP of Engineering",createdAt:new Date(Date.now()-5*864e5).toISOString()},
    {id:"c2",entityId:"e1",name:"Marcus Rivera",email:"marcus@startup.io",phone:"+1 555-0102",companyName:"Startup.io",source:"Referral",title:"CEO",createdAt:new Date(Date.now()-3*864e5).toISOString()},
    {id:"c3",entityId:"e1",name:"Lisa Chen",email:"lisa@enterprise.co",phone:"+1 555-0103",companyName:"Enterprise Co",source:"Website",title:"CTO",createdAt:new Date(Date.now()-864e5).toISOString()},
    {id:"c4",entityId:"e2",name:"David Park",email:"david@greenfund.org",phone:"+1 555-0104",companyName:"Green Fund",source:"Event",title:"Director",createdAt:new Date().toISOString()},
  ],
  companies:[
    {id:"co1",entityId:"e1",name:"TechCorp",industry:"Technology",website:"techcorp.com",phone:"+1 555-1001",email:"info@techcorp.com",employees:200,createdAt:new Date().toISOString()},
    {id:"co2",entityId:"e1",name:"Startup.io",industry:"SaaS",website:"startup.io",phone:"+1 555-1002",email:"hello@startup.io",employees:25,createdAt:new Date().toISOString()},
    {id:"co3",entityId:"e1",name:"Enterprise Co",industry:"Finance",website:"enterprise.co",phone:"+1 555-1003",email:"info@enterprise.co",employees:1500,createdAt:new Date().toISOString()},
  ],
  deals:[
    {id:"d1",entityId:"e1",contactId:"c1",companyId:"co1",title:"TechCorp Enterprise License",value:45000,stage:"Proposal Sent",closeDate:"2026-06-15",probability:70,createdAt:new Date(Date.now()-4*864e5).toISOString()},
    {id:"d2",entityId:"e1",contactId:"c2",companyId:"co2",title:"Startup.io Starter Package",value:8500,stage:"Contacted",closeDate:"2026-05-30",probability:40,createdAt:new Date(Date.now()-2*864e5).toISOString()},
    {id:"d3",entityId:"e1",contactId:"c3",companyId:"co3",title:"Enterprise Annual Contract",value:120000,stage:"New Lead",closeDate:"2026-07-01",probability:20,createdAt:new Date(Date.now()-864e5).toISOString()},
    {id:"d4",entityId:"e1",contactId:"c1",companyId:"co1",title:"Professional Services Q2",value:15000,stage:"Won",closeDate:"2026-04-15",probability:100,createdAt:new Date(Date.now()-7*864e5).toISOString()},
    {id:"d5",entityId:"e1",contactId:"c2",companyId:"co2",title:"Add-on Module",value:3000,stage:"Lost",closeDate:"2026-04-01",probability:0,createdAt:new Date(Date.now()-10*864e5).toISOString()},
    {id:"d6",entityId:"e1",contactId:"c3",companyId:"co3",title:"Implementation Support",value:22000,stage:"Contacted",closeDate:"2026-06-30",probability:50,createdAt:new Date(Date.now()-3*864e5).toISOString()},
  ],
  tasks:[
    {id:"t1",entityId:"e1",contactId:"c1",title:"Follow up on proposal",dueDate:"2026-05-10",completed:false,priority:"high",reminder:true,createdAt:new Date().toISOString()},
    {id:"t2",entityId:"e1",contactId:"c2",title:"Schedule demo call",dueDate:"2026-05-08",completed:false,priority:"medium",reminder:false,createdAt:new Date().toISOString()},
    {id:"t3",entityId:"e1",contactId:"c3",title:"Send intro email",dueDate:"2026-05-09",completed:true,priority:"low",reminder:false,createdAt:new Date().toISOString()},
    {id:"t4",entityId:"e1",contactId:"c1",title:"Review contract terms",dueDate:"2026-05-12",completed:false,priority:"high",reminder:true,createdAt:new Date().toISOString()},
    {id:"t5",entityId:"e2",contactId:"c4",title:"Review grant application",dueDate:"2026-05-15",completed:false,priority:"medium",reminder:true,createdAt:new Date().toISOString()},
  ],
  notes:[
    {id:"n1",entityId:"e1",contactId:"c1",content:"Great intro call. Very interested in enterprise tier. Budget confirmed ~$50k.",createdAt:new Date(Date.now()-2*864e5).toISOString(),type:"note"},
    {id:"n2",entityId:"e1",contactId:"c1",content:"Proposal sent via email. Following up next Tuesday. Legal review required.",createdAt:new Date(Date.now()-864e5).toISOString(),type:"note"},
    {id:"n3",entityId:"e1",contactId:"c2",content:"Referral from John at HQ. Needs starter package within 30 days. Budget ~$10k.",createdAt:new Date(Date.now()-3*864e5).toISOString(),type:"note"},
    {id:"n4",entityId:"e1",contactId:"c3",content:"Initial contact via website form. Large enterprise, 1500 employees. High potential.",createdAt:new Date(Date.now()-864e5).toISOString(),type:"note"},
    {id:"n5",entityId:"e2",contactId:"c4",content:"Interested in our Q3 grant program. Mission-aligned, strong leadership.",createdAt:new Date(Date.now()-864e5).toISOString(),type:"note"},
  ],
  emailIntegrations:[],
  products:[
    {id:"p1",entityId:"e1",name:"Starter Package",price:8500,category:"Software",description:"Entry-level SaaS subscription, up to 5 users"},
    {id:"p2",entityId:"e1",name:"Enterprise License",price:45000,category:"Software",description:"Full enterprise tier, unlimited users, SSO"},
    {id:"p3",entityId:"e1",name:"Professional Services",price:15000,category:"Services",description:"Implementation and onboarding support"},
    {id:"p4",entityId:"e1",name:"Annual Support",price:12000,category:"Support",description:"Priority support, 4hr SLA, dedicated CSM"},
  ],
  sequences:[
    {id:"sq1",entityId:"e1",name:"New Lead Nurture",steps:[{id:"s1",delay:0,subject:"Thanks for your interest",body:"Hi {{name}},\n\nThanks for reaching out!\n\nBest,\n{{sender}}"},{id:"s2",delay:3,subject:"Quick follow-up",body:"Hi {{name}},\n\nJust checking in.\n\nBest,\n{{sender}}"}],active:true,enrolledCount:0},
    {id:"sq2",entityId:"e1",name:"Post-Proposal Follow-up",steps:[{id:"s4",delay:0,subject:"Proposal — any questions?",body:"Hi {{name}},\n\nFollowing up on the proposal.\n\nBest,\n{{sender}}"}],active:true,enrolledCount:0},
  ],
  templates:[
    {id:"tm1",entityId:"e1",name:"Introduction Email",subject:"Quick introduction",body:"Hi {{name}},\n\nMy name is {{sender}} and I wanted to reach out...",tags:["outreach","intro"]},
    {id:"tm2",entityId:"e1",name:"Proposal Follow-up",subject:"Following up on our proposal",body:"Hi {{name}},\n\nFollowing up on our proposal.",tags:["follow-up","proposal"]},
  ],
  forms:[
    {id:"f1",entityId:"e1",name:"Contact Us Form",fields:[{name:"name",label:"Full Name",type:"text",required:true},{name:"email",label:"Email Address",type:"email",required:true},{name:"phone",label:"Phone Number",type:"text",required:false},{name:"company",label:"Company",type:"text",required:false},{name:"message",label:"Message",type:"textarea",required:false}],submissions:[],active:true,createdAt:new Date().toISOString()},
  ],
  automations:[
    {id:"a1",entityId:"e1",name:"Welcome new leads",trigger:"new_contact",condition:"",action:"create_task",actionData:{title:"Send welcome email",priority:"high",daysOut:1},active:true},
    {id:"a2",entityId:"e1",name:"Follow up won deals",trigger:"deal_won",condition:"",action:"create_task",actionData:{title:"Send thank you & onboarding info",priority:"high",daysOut:0},active:true},
  ],
  docs:[],
  quotes:[],
  customFields:[
    {id:"cf1",entityId:"e1",entity:"contact",name:"LinkedIn URL",type:"text",placeholder:"https://linkedin.com/in/..."},
    {id:"cf2",entityId:"e1",entity:"deal",name:"Contract Type",type:"select",options:["Monthly","Annual","Multi-Year","One-time"]},
  ],
  enrollments:[],
  timeEntries:[
    {id:"te1",entityId:"e1",contactId:"c1",dealId:"d1",description:"Discovery call & needs assessment",hours:1.5,rate:200,date:new Date(Date.now()-6*864e5).toISOString().slice(0,10),createdAt:new Date(Date.now()-6*864e5).toISOString()},
    {id:"te2",entityId:"e1",contactId:"c1",dealId:"d1",description:"Proposal drafting and pricing review",hours:3,rate:200,date:new Date(Date.now()-4*864e5).toISOString().slice(0,10),createdAt:new Date(Date.now()-4*864e5).toISOString()},
    {id:"te3",entityId:"e1",contactId:"c2",dealId:"d2",description:"Strategy session — starter package fit",hours:2,rate:175,date:new Date(Date.now()-3*864e5).toISOString().slice(0,10),createdAt:new Date(Date.now()-3*864e5).toISOString()},
    {id:"te4",entityId:"e1",contactId:"c3",dealId:"d3",description:"Solution architecture review",hours:2.5,rate:225,date:new Date(Date.now()-2*864e5).toISOString().slice(0,10),createdAt:new Date(Date.now()-2*864e5).toISOString()},
    {id:"te5",entityId:"e1",contactId:null,dealId:null,description:"Internal sales pipeline review",hours:0.5,rate:0,date:new Date(Date.now()-864e5).toISOString().slice(0,10),createdAt:new Date(Date.now()-864e5).toISOString()},
  ],
  invoices:[
    {id:"inv1",entityId:"e1",number:1,contactId:"c1",dueDate:new Date(Date.now()-30*864e5).toISOString().slice(0,10),status:"Paid",notes:"Q1 services — paid in full.",items:[{description:"Professional Services Q1",quantity:1,unitPrice:15000}],createdAt:new Date(Date.now()-45*864e5).toISOString()},
    {id:"inv2",entityId:"e1",number:2,contactId:"c1",dueDate:new Date(Date.now()+10*864e5).toISOString().slice(0,10),status:"Sent",notes:"Net-30 terms.",items:[{description:"Enterprise License — annual",quantity:1,unitPrice:45000},{description:"Implementation services",quantity:20,unitPrice:200}],createdAt:new Date(Date.now()-7*864e5).toISOString()},
    {id:"inv3",entityId:"e1",number:3,contactId:"c2",dueDate:new Date(Date.now()-5*864e5).toISOString().slice(0,10),status:"Overdue",notes:"Reminder sent 2 days ago.",items:[{description:"Starter Package — monthly",quantity:1,unitPrice:8500}],createdAt:new Date(Date.now()-35*864e5).toISOString()},
    {id:"inv4",entityId:"e1",number:4,contactId:"c3",dueDate:null,status:"Draft",notes:"",items:[{description:"Annual Contract — Year 1",quantity:1,unitPrice:120000}],createdAt:new Date(Date.now()-864e5).toISOString()},
  ],
  meetings:[],
  webhooks:[],
  portalTokens:[
    {id:"pt1",entityId:"e1",contactId:"c1",token:"a1b2c3d4e5f6g7h8",createdAt:new Date(Date.now()-10*864e5).toISOString()},
    {id:"pt2",entityId:"e1",contactId:"c3",token:"x9y8z7w6v5u4t3s2",createdAt:new Date(Date.now()-2*864e5).toISOString()},
  ],
  emailThreads:[
    {id:"et1",entityId:"e1",contactId:"c1",subject:"Re: Enterprise tier pricing",lastActivity:new Date(Date.now()-2*864e5).toISOString(),messages:[
      {id:"em1",from:"sarah@techcorp.com",to:"you@apex.com",subject:"Enterprise tier pricing",body:"Hi — could you share the breakdown for the enterprise tier? Specifically interested in SSO and the SLA terms.",date:new Date(Date.now()-3*864e5).toISOString(),direction:"in"},
      {id:"em2",from:"you@apex.com",to:"sarah@techcorp.com",subject:"Re: Enterprise tier pricing",body:"Absolutely — attaching the proposal. Happy to walk through it on a call this week.",date:new Date(Date.now()-2*864e5).toISOString(),direction:"out"},
    ]},
    {id:"et2",entityId:"e1",contactId:"c2",subject:"Re: Starter package — quick question",lastActivity:new Date(Date.now()-864e5).toISOString(),messages:[
      {id:"em3",from:"marcus@startup.io",to:"you@apex.com",subject:"Starter package — quick question",body:"Does the starter tier include the API integrations?",date:new Date(Date.now()-864e5).toISOString(),direction:"in"},
    ]},
    {id:"et3",entityId:"e1",contactId:"c3",subject:"Implementation timeline",lastActivity:new Date(Date.now()-12*3600e3).toISOString(),messages:[
      {id:"em4",from:"lisa@enterprise.co",to:"you@apex.com",subject:"Implementation timeline",body:"What's the realistic ramp time for a 1500-employee rollout?",date:new Date(Date.now()-12*3600e3).toISOString(),direction:"in"},
    ]},
  ],
  availability:{},
  invoiceCounter:5,
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Ic = ({d,size=16,c=""}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,color:c||"currentColor"}}>
    {Array.isArray(d)?d.map((p,i)=><path key={i} d={p}/>):<path d={d}/>}
  </svg>
);
const I = {
  home:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  users:["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2","M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8","M23 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"],
  building:"M3 21h18 M9 21V7l6-4v18 M9 12h6",
  layers:["M12 2L2 7l10 5 10-5-10-5","M2 17l10 5 10-5","M2 12l10 5 10-5"],
  check:"M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  bar:"M18 20V10 M12 20V4 M6 20v-6",
  gear:"M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  plus:"M12 5v14 M5 12h14",
  search:"M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  mail:"M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  phone:"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z",
  x:"M18 6 6 18 M6 6l12 12",
  edit:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:"M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  down:"M6 9l6 6 6-6",
  link:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  cal:"M8 2v4 M16 2v4 M3 10h18 M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z",
  note:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
  send:"M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z",
  share:"M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8 M16 6l-4-4-4 4 M12 2v13",
  dl:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  bell:"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  ok:"M20 6L9 17l-5-5",
  dollar:"M12 1v22 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  arrow:"M5 12h14 M12 5l7 7-7 7",
  plug:"M7 12h10 M9 16l-2-4 2-4 M15 8l2 4-2 4",
  eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  copy:"M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  upload:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12",
  brain:"M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-1.98-3 2.5 2.5 0 0 1-1.32-4.24 3 3 0 0 1 .34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2",
  zap:"M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  list:"M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
  form:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8",
  seq:"M17 1l4 4-4 4 M3 11V9a4 4 0 0 1 4-4h14 M7 23l-4-4 4-4 M21 13v2a4 4 0 0 1-4 4H3",
  box:"M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  file:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6",
  pdf:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M10 13h4 M10 17h4 M10 9h1",
  import:"M8 17l4 4 4-4 M12 12v9 M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29",
  trending:"M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
  target:"M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  quote:"M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
  merge:"M8 8H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h3 M16 8h3a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3 M12 2v4 M12 18v4 M8 12h8",
  robot:"M12 8V4H8 M16 8V4h-4 M8 8h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z M2 14h2 M20 14h2 M10 13v2 M14 13v2",
  clock:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  invoice:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M12 18v-4 M9 15h6",
  portal:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  sign:"M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
  hook:"M20 20V10 M12 20V4 M6 20v-6 M22 6l-4-4-4 4",
  inbox:"M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  meet:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  pen:"M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
  globe:"M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z M2 12h20 M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  refresh:"M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  play:"M5 3l14 9-14 9V3z",
  stop:"M21 4H3v16h18V4z",
  dollar2:"M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  card:(extra={})=>({background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:12,...extra}),
  input:{width:"100%",background:"#FFFFFF",border:"1px solid #CBD5E1",borderRadius:8,padding:"8px 12px",color:"#0F172A",fontSize:13,outline:"none",boxSizing:"border-box"},
  label:{fontSize:11,color:"#64748B",fontWeight:600,marginBottom:4,display:"block",textTransform:"uppercase",letterSpacing:.5},
  badge:(c)=>({background:c+"20",color:c,border:`1px solid ${c}40`,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3,whiteSpace:"nowrap"}),
  btnPrimary:{background:"#1D4ED8",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:600,fontSize:13,display:"inline-flex",alignItems:"center",gap:6},
  btnSecondary:{background:"#F1F5F9",color:"#334155",border:"1px solid #CBD5E1",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:500,fontSize:13,display:"inline-flex",alignItems:"center",gap:6},
  btnGhost:{background:"transparent",color:"#475569",border:"none",borderRadius:6,padding:"4px 6px",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4,fontSize:13},
  btnDanger:{background:"#EF4444",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontWeight:600,fontSize:13},
  row:(i)=>({display:"flex",alignItems:"center",gap:8,padding:"11px 16px",borderTop:i?"1px solid #E9EEF6":"none",cursor:"pointer"}),
  th:{padding:"10px 16px",textAlign:"left",fontSize:11,fontWeight:600,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,background:"#F8FAFC",whiteSpace:"nowrap"},
  td:{padding:"12px 16px",fontSize:13,color:"#475569",borderTop:"1px solid #F1F5F9"},
  overlay:{position:"fixed",inset:0,background:"rgba(15,30,60,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16},
  modal:{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:16,padding:24,width:"100%",maxWidth:520,maxHeight:"88vh",overflowY:"auto"},
  grid2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},
  formGroup:{marginBottom:14},
  select:{width:"100%",background:"#FFFFFF",border:"1px solid #CBD5E1",borderRadius:8,padding:"8px 12px",color:"#0F172A",fontSize:13,outline:"none"},
  textarea:{width:"100%",background:"#FFFFFF",border:"1px solid #CBD5E1",borderRadius:8,padding:"8px 12px",color:"#0F172A",fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"},
};

// ─── UTILITY COMPONENTS ───────────────────────────────────────────────────────
const Avatar = ({name,size=32}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:avColor(name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.35,fontWeight:700,color:"#fff",flexShrink:0}}>{initials(name)}</div>
);
const Field = ({label,children})=>(
  <div style={S.formGroup}><label style={S.label}>{label}</label>{children}</div>
);
// Module-level form-field helper. CRITICAL: must NOT be redeclared inside any
// component's render — that would create a new component identity per keystroke
// and React would unmount/remount the input, killing focus.
const F = ({label, name, placeholder, type: ftype = "text", options, required, form, set}) => (
  <Field label={label}>
    {options
      ? (
        <select style={S.select} value={form?.[name] || ""} onChange={e => set(name, e.target.value)}>
          <option value="">Select…</option>
          {options.map(o => <option key={o}>{o}</option>)}
        </select>
      )
      : (
        <input type={ftype} style={{...S.input, borderColor: required && !form?.[name] ? "#FCA5A5" : undefined}} placeholder={placeholder} value={form?.[name] || ""} onChange={e => set(name, e.target.value)}/>
      )
    }
  </Field>
);

// Inline-editable note row (H5)
function NoteRow({note,updateNote,deleteNote}){
  const [editing,setEditing]=useState(false);
  const [text,setText]=useState(note.content);
  const save=()=>{if(text.trim()&&text.trim()!==note.content)updateNote?.(note.id,{content:text.trim()});setEditing(false);};
  return(
    <div style={{background:"#F8FAFC",borderRadius:10,padding:16,marginBottom:10,borderLeft:`3px solid ${note.type==="email"?"#1D4ED8":note.type==="sequence"?"#10B981":"#CBD5E1"}`}}>
      {note.type==="email"&&<div style={{fontSize:11,color:"#1D4ED8",fontWeight:600,marginBottom:4}}>📧 EMAIL SENT</div>}
      {note.type==="sequence"&&<div style={{fontSize:11,color:"#10B981",fontWeight:600,marginBottom:4}}>⚡ SEQUENCE STEP</div>}
      {editing?(
        <div>
          <textarea autoFocus style={{...S.textarea,minHeight:60}} value={text} onChange={e=>setText(e.target.value)}/>
          <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginTop:6}}>
            <button style={S.btnGhost} onClick={()=>{setText(note.content);setEditing(false);}}>Cancel</button>
            <button style={S.btnPrimary} onClick={save}>Save</button>
          </div>
        </div>
      ):(
        <div style={{fontSize:13,color:"#334155",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{note.content}</div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
        <div style={{fontSize:11,color:"#475569"}}>{fmtTime(note.createdAt)}</div>
        {!editing&&(
          <div style={{display:"flex",gap:4}}>
            {updateNote&&<button style={S.btnGhost} title="Edit note" onClick={()=>setEditing(true)}><Ic d={I.edit} size={11}/></button>}
            {deleteNote&&<button style={{...S.btnGhost,color:"#EF4444"}} title="Delete note" onClick={()=>{if(confirm("Delete this note?"))deleteNote(note.id);}}><Ic d={I.trash} size={11}/></button>}
          </div>
        )}
      </div>
    </div>
  );
}

const Modal = ({title,onClose,children,wide})=>(
  <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{...S.modal,maxWidth:wide?720:520}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:700,color:"#0F172A",margin:0}}>{title}</h2>
        <button style={S.btnGhost} onClick={onClose}><Ic d={I.x} size={18}/></button>
      </div>
      {children}
    </div>
  </div>
);
const PageHeader = ({title,sub,children})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24}}>
    <div>
      <h1 style={{fontFamily:"'Sora',sans-serif",fontSize:22,fontWeight:800,color:"#0F172A",margin:0}}>{title}</h1>
      {sub&&<p style={{color:"#64748B",marginTop:3,fontSize:13,margin:"4px 0 0"}}>{sub}</p>}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>{children}</div>
  </div>
);
const StatCard = ({label,value,sub,color,icon})=>(
  <div style={S.card({padding:20})}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div style={{flex:1}}>
        <div style={{fontSize:11,color:"#64748B",fontWeight:700,marginBottom:8,textTransform:"uppercase",letterSpacing:.5}}>{label}</div>
        <div style={{fontFamily:"'Sora',sans-serif",fontSize:26,fontWeight:800,color}}>{value}</div>
        {sub&&<div style={{fontSize:12,color:"#64748B",marginTop:3}}>{sub}</div>}
      </div>
      <div style={{width:38,height:38,background:color+"20",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color,flexShrink:0}}>
        <Ic d={icon} size={17}/>
      </div>
    </div>
  </div>
);
const ScoreBadge = ({score})=>(
  <div style={{display:"inline-flex",alignItems:"center",gap:5,background:scoreColor(score)+"18",border:`1px solid ${scoreColor(score)}40`,borderRadius:20,padding:"3px 10px"}}>
    <div style={{width:7,height:7,borderRadius:"50%",background:scoreColor(score)}}/>
    <span style={{fontSize:12,fontWeight:700,color:scoreColor(score)}}>{score}</span>
  </div>
);


// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function Dashboard({ed,ec,et,notes,contacts,entity,setView,setSelContact,openModal}){
  const pipeVal=ed.filter(d=>!["Won","Lost"].includes(d.stage)).reduce((s,d)=>s+(d.value||0),0);
  const wonVal=ed.filter(d=>d.stage==="Won").reduce((s,d)=>s+(d.value||0),0);
  const closed=ed.filter(d=>["Won","Lost"].includes(d.stage));
  const closeRate=closed.length?Math.round((ed.filter(d=>d.stage==="Won").length/closed.length)*100):0;
  const weightedPipe=ed.filter(d=>!["Won","Lost"].includes(d.stage)).reduce((s,d)=>s+((d.value||0)*((d.probability||50)/100)),0);
  const stageChart=stagesFor(entity).map(st=>({name:st.split(" ")[0],deals:ed.filter(d=>d.stage===st).length,value:ed.filter(d=>d.stage===st).reduce((s,d)=>s+(d.value||0),0)/1000}));
  const recentNotes=[...notes].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,4);
  const pendingTasks=et.filter(t=>!t.completed).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).slice(0,5);
  const recentDeals=[...ed].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,4);
  // Forecast: next 3 months
  const now=new Date(); const months=[];
  for(let i=0;i<3;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);months.push({month:d.toLocaleString("default",{month:"short"}),won:0,weighted:0});}
  ed.forEach(d=>{
    if(!d.closeDate)return; const cd=new Date(d.closeDate); const mi=months.findIndex((m,i)=>{const md=new Date(now.getFullYear(),now.getMonth()+i,1);return cd.getMonth()===md.getMonth()&&cd.getFullYear()===md.getFullYear();});
    if(mi>=0){if(d.stage==="Won")months[mi].won+=(d.value||0)/1000;else if(!["Lost"].includes(d.stage))months[mi].weighted+=((d.value||0)*(d.probability||50)/100)/1000;}
  });

  return(
    <div>
      <PageHeader title="Dashboard" sub={`${entity?.name} · ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}`}>
        <button style={S.btnPrimary} onClick={()=>openModal("addDeal")}><Ic d={I.plus} size={14}/>New Deal</button>
      </PageHeader>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:20}}>
        <StatCard label="Active Pipeline" value={fmt$(pipeVal)} sub={`${ed.filter(d=>!["Won","Lost"].includes(d.stage)).length} open deals`} color="#1D4ED8" icon={I.dollar}/>
        <StatCard label="Weighted Pipeline" value={fmt$(weightedPipe)} sub="By probability" color="#8B5CF6" icon={I.layers}/>
        <StatCard label="Won Revenue" value={fmt$(wonVal)} sub={`${ed.filter(d=>d.stage==="Won").length} deals closed`} color="#10B981" icon={I.ok}/>
        <StatCard label="Close Rate" value={`${closeRate}%`} sub={`${closed.length} deals evaluated`} color="#F59E0B" icon={I.bar}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:20}}>
        <StatCard label="Total Contacts" value={ec.length} sub="In this entity" color="#1D4ED8" icon={I.users}/>
        <StatCard label="Tasks Pending" value={et.filter(t=>!t.completed).length} sub={`${et.filter(t=>!t.completed&&new Date(t.dueDate)<new Date()).length} overdue`} color="#EF4444" icon={I.check}/>
        <StatCard label="Avg Deal Size" value={fmt$(ed.length?ed.reduce((s,d)=>s+(d.value||0),0)/ed.length:0)} sub="All deals" color="#F97316" icon={I.dollar}/>
        <StatCard label="Activity Notes" value={notes.length} sub="Total logged" color="#EC4899" icon={I.note}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr",gap:16,marginBottom:20}}>
        <div style={S.card({padding:20})}>
          <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>Pipeline by Stage</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stageChart} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF6" vertical={false}/>
              <XAxis dataKey="name" tick={{fill:"#64748B",fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:"#64748B",fontSize:10}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:8,color:"#0F172A",fontSize:12}} formatter={(v,n)=>[n==="value"?`$${v}k`:v,n==="value"?"Value ($k)":"Deals"]}/>
              <Legend wrapperStyle={{fontSize:11,color:"#64748B"}}/>
              <Bar dataKey="deals" fill="#1D4ED8" radius={[4,4,0,0]} name="Deals"/>
              <Bar dataKey="value" fill="#8B5CF620" radius={[4,4,0,0]} name="value" stroke="#8B5CF6" strokeWidth={1.5}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={S.card({padding:20})}>
          <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Stage Breakdown</div>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart><Pie data={stagesFor(entity).map(st=>({name:st,value:ed.filter(d=>d.stage===st).length}))} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" stroke="none">
              {stagesFor(entity).map((st,i)=><Cell key={i} fill={stageColor(entity,st)}/>)}
            </Pie><Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:8,fontSize:12}} formatter={(v,n)=>[v+" deals",n]}/></PieChart>
          </ResponsiveContainer>
          {stagesFor(entity).map(st=>(
            <div key={st} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"2px 0"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:stageColor(entity,st)}}/><span style={{fontSize:11,color:"#475569"}}>{st}</span></div>
              <span style={{fontSize:12,fontWeight:700,color:"#0F172A"}}>{ed.filter(d=>d.stage===st).length}</span>
            </div>
          ))}
        </div>
        <div style={S.card({padding:20})}>
          <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>3-Month Forecast</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={months} barSize={20}>
              <XAxis dataKey="month" tick={{fill:"#64748B",fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:8,fontSize:12}} formatter={v=>`$${v}k`}/>
              <Bar dataKey="won" fill="#10B981" radius={[3,3,0,0]} name="Won" stackId="a"/>
              <Bar dataKey="weighted" fill="#1D4ED820" radius={[3,3,0,0]} name="Weighted" stackId="a" stroke="#1D4ED8" strokeWidth={1}/>
            </BarChart>
          </ResponsiveContainer>
          <div style={{display:"flex",gap:12,marginTop:8}}>
            <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#475569"}}><div style={{width:8,height:8,borderRadius:2,background:"#10B981"}}/>Won</div>
            <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#475569"}}><div style={{width:8,height:8,borderRadius:2,background:"#1D4ED840",border:"1px solid #1D4ED8"}}/>Weighted</div>
          </div>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={S.card({padding:20})}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Recent Deals</div>
            <button style={{...S.btnGhost,fontSize:11}} onClick={()=>setView("deals")}>View All <Ic d={I.arrow} size={11}/></button>
          </div>
          {recentDeals.map(deal=>{
            const contact=contacts.find(c=>c.id===deal.contactId);
            return(<div key={deal.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #E9EEF6"}}>
              <Avatar name={contact?.name||"?"} size={28}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{deal.title}</div>
                <div style={{fontSize:11,color:"#64748B"}}>{contact?.name} · {fmtDate(deal.createdAt)}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:700,color:stageColor(entity,deal.stage)}}>{fmt$(deal.value)}</div>
                <span style={S.badge(stageColor(entity,deal.stage))}>{deal.stage}</span>
              </div>
            </div>);
          })}
        </div>
        <div style={S.card({padding:20})}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Upcoming Tasks</div>
            <button style={{...S.btnGhost,fontSize:11}} onClick={()=>setView("tasks")}>View All <Ic d={I.arrow} size={11}/></button>
          </div>
          {pendingTasks.length===0?<p style={{color:"#475569",fontSize:13}}>All tasks complete! 🎉</p>:pendingTasks.map(t=>{
            const contact=contacts.find(c=>c.id===t.contactId);
            const overdue=new Date(t.dueDate)<new Date();
            return(<div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid #E9EEF6"}}>
              <div style={{color:{high:"#EF4444",medium:"#F59E0B",low:"#64748B"}[t.priority]}}><Ic d={I.bell} size={14}/></div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:"#0F172A"}}>{t.title}</div>
                <div style={{fontSize:11,color:overdue?"#EF4444":"#64748B"}}>{overdue?"⚠ Overdue · ":""}{fmtDate(t.dueDate)} · {contact?.name}</div>
              </div>
              <span style={S.badge({high:"#EF4444",medium:"#F59E0B",low:"#64748B"}[t.priority])}>{t.priority}</span>
            </div>);
          })}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// CONTACTS LIST (with duplicate detection indicator)
// ═══════════════════════════════════════════════════════════════════════════════
function ContactsList({ec,search,openModal,setSelContact,deleteContact,deals,notes,tasks}){
  const [sort,setSort]=useState("name");
  const filtered=ec.filter(c=>!search||[c.name,c.email,c.companyName,c.phone].some(v=>v?.toLowerCase().includes(search.toLowerCase())));
  const sorted=[...filtered].sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="score"?(calcLeadScore(b,deals,notes,tasks)-calcLeadScore(a,deals,notes,tasks)):new Date(b.createdAt)-new Date(a.createdAt));
  // Find duplicates: same email or very similar name
  const dupMap={};
  ec.forEach(c=>{if(c.email)dupMap[c.email.toLowerCase()]=(dupMap[c.email.toLowerCase()]||0)+1;});

  return(
    <div>
      <PageHeader title="Contacts" sub={`${ec.length} total contacts`}>
        <select style={{...S.select,width:"auto"}} value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="name">Sort: Name</option>
          <option value="date">Sort: Newest</option>
          <option value="score">Sort: Lead Score</option>
        </select>
        <button style={S.btnPrimary} onClick={()=>openModal("addContact")}><Ic d={I.plus} size={14}/>Add Contact</button>
      </PageHeader>
      <div style={S.card({overflow:"hidden"})}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Contact","Score","Company","Email","Phone","Source","Added",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {sorted.length===0?<tr><td colSpan={8} style={{padding:48,textAlign:"center",color:"#475569"}}>No contacts found. Add your first contact!</td></tr>
            :sorted.map(c=>{
              const score=calcLeadScore(c,deals,notes,tasks);
              const isDup=dupMap[c.email?.toLowerCase()]>1;
              return(
                <tr key={c.id} style={{cursor:"pointer"}} onClick={()=>setSelContact(c.id)}
                  onMouseEnter={e=>e.currentTarget.style.background="#F1F5F9"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <td style={S.td}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{position:"relative"}}>
                        <Avatar name={c.name} size={32}/>
                        {isDup&&<div title="Possible duplicate" style={{position:"absolute",top:-2,right:-2,width:10,height:10,background:"#F59E0B",borderRadius:"50%",border:"2px solid #fff"}}/>}
                      </div>
                      <div>
                        <div style={{fontWeight:600,color:"#0F172A"}}>{c.name}</div>
                        {c.title&&<div style={{fontSize:11,color:"#475569"}}>{c.title}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={S.td}><ScoreBadge score={score}/></td>
                  <td style={S.td}>{c.companyName||"—"}</td>
                  <td style={S.td}><a href={`mailto:${c.email}`} style={{color:"#1D4ED8",textDecoration:"none"}} onClick={e=>e.stopPropagation()}>{c.email||"—"}</a></td>
                  <td style={S.td}>{c.phone||"—"}</td>
                  <td style={S.td}><span style={S.badge("#8B5CF6")}>{c.source}</span></td>
                  <td style={S.td}>{fmtDate(c.createdAt)}</td>
                  <td style={S.td}>
                    <div style={{display:"flex",gap:2}} onClick={e=>e.stopPropagation()}>
                      <button style={S.btnGhost} title="Edit" onClick={()=>openModal("editContact",c)}><Ic d={I.edit} size={14}/></button>
                      <button style={{...S.btnGhost,color:"#EF4444"}} title="Delete" onClick={()=>{if(confirm(`Delete ${c.name}?`))deleteContact(c.id);}}><Ic d={I.trash} size={14}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT DETAIL (Notes, Tasks, Docs, Sequences tabs + Lead Score)
// ═══════════════════════════════════════════════════════════════════════════════
function ContactDetail({contact,allDeals,allNotes,allTasks,allDocs,contacts,companies=[],sequences,enrollments,openModal,onBack,addNote,updateNote,deleteNote,updateTask,deleteTask,activeEntityId,emailIntegrations,updateContact,addDoc,deleteDoc,addEnrollment,updateEnrollment,deleteEnrollment,customFields,entity,setSelCompany,setSelDeal,setView}){
  const [noteText,setNoteText]=useState("");
  const [tab,setTab]=useState("notes");
  const fileRef=useRef();
  if(!contact)return null;

  const cDeals=allDeals.filter(d=>d.contactId===contact.id);
  const cNotes=allNotes.filter(n=>n.contactId===contact.id);
  const cTasks=allTasks.filter(t=>t.contactId===contact.id);
  const cDocs=allDocs.filter(d=>d.contactId===contact.id);
  const cEnrollments=enrollments.filter(e=>e.contactId===contact.id);
  const hasEmail=emailIntegrations.some(e=>e.entityId===activeEntityId);
  const score=calcLeadScore(contact,allDeals,allNotes,allTasks);
  const contactCustomFields=customFields.filter(f=>f.entity==="contact");

  const submitNote=()=>{if(!noteText.trim())return;addNote({contactId:contact.id,content:noteText,type:"note"});setNoteText("");};

  const handleFileUpload=(e)=>{
    const file=e.target.files[0]; if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      addDoc({contactId:contact.id,name:file.name,type:file.type,size:file.size,data:ev.target.result,status:"Draft",uploadedAt:new Date().toISOString()});
    };
    reader.readAsDataURL(file);
  };

  const docStatusColors={"Draft":"#64748B","Sent":"#F59E0B","Under Review":"#3B82F6","Signed":"#10B981","Rejected":"#EF4444"};
  const DOCSTATUSES=["Draft","Sent","Under Review","Signed","Rejected"];

  return(
    <div>
      <button style={{...S.btnGhost,marginBottom:16,color:"#475569",fontSize:13}} onClick={onBack}>
        <Ic d="M15 18l-6-6 6-6" size={14}/> Back to Contacts
      </button>
      <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20,alignItems:"start"}}>
        {/* Left Panel */}
        <div>
          <div style={S.card({padding:24,marginBottom:12})}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:12}}><Avatar name={contact.name} size={72}/></div>
              <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:800,color:"#0F172A",margin:"0 0 4px"}}>{contact.name}</h2>
              {contact.title&&<div style={{color:"#64748B",fontSize:13,marginBottom:4}}>{contact.title}</div>}
              {(()=>{
                const linkedCo=companies.find(c=>c.id===contact.companyId)||companies.find(c=>c.name?.toLowerCase()===(contact.companyName||"").toLowerCase());
                if(linkedCo&&setSelCompany&&setView){
                  return <button style={{background:"none",border:"none",color:"#1D4ED8",cursor:"pointer",fontSize:13,marginBottom:8,padding:0,textDecoration:"underline"}} onClick={()=>{setSelCompany(linkedCo.id);setView("companies");}}>{linkedCo.name}</button>;
                }
                return <div style={{color:"#475569",fontSize:13,marginBottom:8}}>{contact.companyName||"—"}</div>;
              })()}
              <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
                {contact.source&&<span style={S.badge("#8B5CF6")}>{contact.source}</span>}
                {contact.icp&&<span style={S.badge("#06B6D4")}>ICP: {contact.icp}</span>}
                {contact.status&&<span style={S.badge("#F59E0B")}>{contact.status}</span>}
                <div style={{display:"inline-flex",alignItems:"center",gap:4,background:scoreColor(score)+"18",border:`1px solid ${scoreColor(score)}40`,borderRadius:20,padding:"3px 10px"}}>
                  <Ic d={I.target} size={11} c={scoreColor(score)}/><span style={{fontSize:12,fontWeight:700,color:scoreColor(score)}}>Score: {score}</span>
                </div>
              </div>
              {(contact.followUp||contact.notes)&&(
                <div style={{textAlign:"left",marginTop:14,paddingTop:14,borderTop:"1px solid #F1F5F9"}}>
                  {contact.followUp&&<div style={{marginBottom:contact.notes?10:0}}><div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Follow-up / Next Steps</div><div style={{fontSize:12,color:"#0F172A",whiteSpace:"pre-wrap"}}>{contact.followUp}</div></div>}
                  {contact.notes&&<div><div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>Notes</div><div style={{fontSize:12,color:"#0F172A",whiteSpace:"pre-wrap"}}>{contact.notes}</div></div>}
                </div>
              )}
            </div>
            <div style={{borderTop:"1px solid #E9EEF6",paddingTop:16,display:"flex",flexDirection:"column",gap:10}}>
              {contact.email&&<a href={`mailto:${contact.email}`} style={{display:"flex",gap:8,alignItems:"center",fontSize:13,color:"#1D4ED8",textDecoration:"none"}}><Ic d={I.mail} size={14} c="#475569"/>{contact.email}</a>}
              {contact.phone&&<div style={{display:"flex",gap:8,alignItems:"center",fontSize:13,color:"#334155"}}><Ic d={I.phone} size={14} c="#475569"/>{contact.phone}</div>}
              {contact.companyName&&<div style={{display:"flex",gap:8,alignItems:"center",fontSize:13,color:"#334155"}}><Ic d={I.building} size={14} c="#475569"/>{contact.companyName}</div>}
              <div style={{display:"flex",gap:8,alignItems:"center",fontSize:12,color:"#475569"}}><Ic d={I.cal} size={13} c="#475569"/>Added {fmtDate(contact.createdAt)}</div>
              {contactCustomFields.map(cf=>(
                contact[cf.name]&&<div key={cf.id} style={{display:"flex",gap:8,alignItems:"center",fontSize:12,color:"#475569"}}><Ic d={I.list} size={13} c="#475569"/><span style={{color:"#64748B"}}>{cf.name}:</span> {contact[cf.name]}</div>
              ))}
            </div>
            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button style={{...S.btnPrimary,flex:1,justifyContent:"center",padding:"7px"}} onClick={()=>openModal("editContact",contact)}><Ic d={I.edit} size={13}/>Edit</button>
              {hasEmail
                ?<button style={{...S.btnSecondary,flex:1,justifyContent:"center",padding:"7px"}} onClick={()=>openModal("composeEmail",{to:contact.email,contactId:contact.id})}><Ic d={I.mail} size={13}/>Email</button>
                :<button style={{...S.btnSecondary,flex:1,justifyContent:"center",padding:"7px",fontSize:11}} onClick={()=>openModal("connectEmail")}><Ic d={I.plug} size={13}/>Connect Mail</button>
              }
            </div>
          </div>
          {/* Deals Card */}
          <div style={S.card({padding:16,marginBottom:12})}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Deals ({cDeals.length})</div>
              <button style={S.btnGhost} onClick={()=>openModal("addDeal",{contactId:contact.id})}><Ic d={I.plus} size={14}/></button>
            </div>
            {cDeals.length===0?<p style={{fontSize:12,color:"#475569",padding:"4px 0"}}>No deals yet.</p>
            :cDeals.map(d=>(
              <div key={d.id} onClick={()=>{if(setSelDeal&&setView){setSelDeal(d.id);setView("deals");}}} style={{background:"#F1F5F9",borderRadius:8,padding:"10px 12px",marginBottom:8,cursor:setSelDeal?"pointer":"default"}}>
                <div style={{fontSize:13,fontWeight:600,color:"#0F172A",marginBottom:4}}>{d.title}</div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={S.badge(stageColor(entity,d.stage))}>{d.stage}</span>
                  <span style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>{fmt$(d.value)}</span>
                </div>
                <div style={{fontSize:11,color:"#475569",marginTop:4}}>Close: {fmtDate(d.closeDate)}</div>
              </div>
            ))}
          </div>
          {/* Quick Quote Button */}
          <button style={{...S.btnSecondary,width:"100%",justifyContent:"center"}} onClick={()=>openModal("buildQuote",{contactId:contact.id})}><Ic d={I.quote} size={13}/>Build Quote / Proposal</button>
        </div>

        {/* Right: Tabs */}
        <div style={S.card({overflow:"hidden"})}>
          <div style={{display:"flex",borderBottom:"1px solid #E9EEF6",padding:"0 16px",gap:2}}>
            {[["notes",`Notes (${cNotes.length})`],["tasks",`Tasks (${cTasks.length})`],["docs",`Docs (${cDocs.length})`],["sequences",`Sequences (${cEnrollments.length})`]].map(([id,lbl])=>(
              <button key={id} style={{padding:"13px 12px",background:"transparent",border:"none",borderBottom:tab===id?"2px solid #1D4ED8":"2px solid transparent",color:tab===id?"#1D4ED8":"#64748B",cursor:"pointer",fontWeight:600,fontSize:12,transition:"color .15s",whiteSpace:"nowrap"}} onClick={()=>setTab(id)}>{lbl}</button>
            ))}
          </div>
          <div style={{padding:20}}>
            {/* NOTES TAB */}
            {tab==="notes"&&(
              <div>
                <div style={{marginBottom:20}}>
                  <textarea style={{...S.textarea,minHeight:80}} placeholder="Write a note..." value={noteText} onChange={e=>setNoteText(e.target.value)} onKeyDown={e=>{if(e.metaKey&&e.key==="Enter")submitNote();}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
                    <span style={{fontSize:11,color:"#475569"}}>⌘+Enter to save</span>
                    <button style={S.btnPrimary} onClick={submitNote}><Ic d={I.note} size={13}/>Add Note</button>
                  </div>
                </div>
                {[...cNotes].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(n=>(
                  <NoteRow key={n.id} note={n} updateNote={updateNote} deleteNote={deleteNote}/>
                ))}
                {cNotes.length===0&&<p style={{color:"#475569",fontSize:13}}>No notes yet.</p>}
              </div>
            )}
            {/* TASKS TAB */}
            {tab==="tasks"&&(
              <div>
                <button style={{...S.btnPrimary,marginBottom:16}} onClick={()=>openModal("addTask",{contactId:contact.id})}><Ic d={I.plus} size={14}/>Add Task</button>
                {cTasks.length===0?<p style={{color:"#475569",fontSize:13}}>No tasks. Add a follow-up!</p>
                :cTasks.map(t=>{
                  const overdue=!t.completed&&new Date(t.dueDate)<new Date();
                  return(<div key={t.id} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 12px",background:"#FFFFFF",border:"1px solid #E9EEF6",borderRadius:8,marginBottom:8,opacity:t.completed?.65:1,borderLeft:`3px solid ${{high:"#EF4444",medium:"#F59E0B",low:"#64748B"}[t.priority]}`}}>
                    <input type="checkbox" checked={t.completed} onChange={e=>updateTask(t.id,{completed:e.target.checked})} style={{marginTop:2,cursor:"pointer",accentColor:"#1D4ED8",width:14,height:14}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:"#0F172A",textDecoration:t.completed?"line-through":"none"}}>{t.title}</div>
                      <div style={{display:"flex",gap:8,alignItems:"center",marginTop:3}}>
                        <span style={{fontSize:11,color:overdue?"#EF4444":"#64748B"}}>{overdue?"⚠ Overdue · ":""}{fmtDate(t.dueDate)}</span>
                        <span style={S.badge({high:"#EF4444",medium:"#F59E0B",low:"#64748B"}[t.priority])}>{t.priority}</span>
                      </div>
                    </div>
                    <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>deleteTask(t.id)}><Ic d={I.trash} size={12}/></button>
                  </div>);
                })}
              </div>
            )}
            {/* DOCS TAB */}
            {tab==="docs"&&(
              <div>
                <div style={{display:"flex",gap:8,marginBottom:20}}>
                  <button style={S.btnPrimary} onClick={()=>fileRef.current?.click()}><Ic d={I.upload} size={13}/>Upload Document</button>
                  <input ref={fileRef} type="file" style={{display:"none"}} onChange={handleFileUpload} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg"/>
                  <button style={S.btnSecondary} onClick={()=>openModal("buildQuote",{contactId:contact.id})}><Ic d={I.quote} size={13}/>New Quote</button>
                </div>
                {cDocs.length===0&&<div style={{border:"2px dashed #CBD5E1",borderRadius:10,padding:32,textAlign:"center",color:"#94A3B8"}}>
                  <Ic d={I.file} size={28} c="#CBD5E1"/><div style={{marginTop:8,fontSize:13}}>No documents yet. Upload proposals, contracts, or any file.</div>
                </div>}
                {cDocs.map(doc=>(
                  <div key={doc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#F8FAFC",borderRadius:8,marginBottom:8,border:"1px solid #E9EEF6"}}>
                    <div style={{width:36,height:36,background:"#EEF2FF",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      <Ic d={doc.type==="application/pdf"?I.pdf:I.file} size={16} c="#1D4ED8"/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</div>
                      <div style={{fontSize:11,color:"#64748B"}}>{fmtDate(doc.uploadedAt)} · {doc.size?(doc.size/1024).toFixed(1)+"KB":""}</div>
                    </div>
                    <select value={doc.status||"Draft"} onChange={e=>{const updated={...doc,status:e.target.value};addDoc(updated,true);}} style={{...S.select,width:"auto",fontSize:11,padding:"4px 8px",color:docStatusColors[doc.status||"Draft"],fontWeight:600}}>
                      {DOCSTATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                    <button style={{...S.btnGhost,color:"#8B5CF6"}} title="Request Signature" onClick={()=>onRequestSign&&onRequestSign(doc,contact)}><Ic d={I.sign} size={14}/></button>
                    <a href={doc.data} download={doc.name} style={{...S.btnGhost,color:"#1D4ED8"}} title="Download"><Ic d={I.dl} size={14}/></a>
                    <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>deleteDoc(doc.id)}><Ic d={I.trash} size={14}/></button>
                  </div>
                ))}
              </div>
            )}
            {/* SEQUENCES TAB */}
            {tab==="sequences"&&(
              <div>
                <div style={{display:"flex",gap:8,marginBottom:20}}>
                  <button style={S.btnPrimary} onClick={()=>openModal("enrollSequence",{contactId:contact.id})}><Ic d={I.seq} size={13}/>Enroll in Sequence</button>
                </div>
                {cEnrollments.length===0&&<p style={{color:"#475569",fontSize:13}}>Not enrolled in any sequences.</p>}
                {cEnrollments.map(enr=>{
                  const seq=sequences.find(s=>s.id===enr.sequenceId);
                  return seq?(
                    <div key={enr.id} style={{background:"#F8FAFC",borderRadius:8,padding:"12px 14px",marginBottom:8,border:"1px solid #E9EEF6"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{seq.name}</div>
                        <span style={S.badge(enr.status==="active"?"#10B981":enr.status==="completed"?"#1D4ED8":"#64748B")}>{enr.status}</span>
                      </div>
                      <div style={{fontSize:12,color:"#64748B"}}>Step {enr.currentStep+1} of {seq.steps.length} · Enrolled {fmtDate(enr.enrolledAt)}</div>
                      <div style={{display:"flex",gap:4,marginTop:8}}>
                        {seq.steps.map((_,i)=>(
                          <div key={i} style={{height:4,flex:1,borderRadius:2,background:i<=enr.currentStep?"#10B981":"#E2E8F0"}}/>
                        ))}
                      </div>
                    </div>
                  ):null;
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// COMPANIES
// ═══════════════════════════════════════════════════════════════════════════════
function CompaniesList({eco,search,openModal,deleteCompany,contacts,deals=[],setSelCompany}){
  const filtered=eco.filter(c=>!search||[c.name,c.industry,c.email].some(v=>v?.toLowerCase().includes(search.toLowerCase())));
  return(
    <div>
      <PageHeader title="Companies" sub={`${eco.length} companies`}>
        <button style={S.btnPrimary} onClick={()=>openModal("addCompany")}><Ic d={I.plus} size={14}/>Add Company</button>
      </PageHeader>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
        {filtered.length===0?<div style={{...S.card({padding:48}),gridColumn:"1/-1",textAlign:"center",color:"#475569"}}>No companies yet.</div>
        :filtered.map(c=>{
          const cContacts=contacts.filter(ct=>ct.companyName===c.name);
          const cDeals=deals.filter(d=>d.companyId===c.id||(d.companyName&&d.companyName.toLowerCase()===(c.name||"").toLowerCase()));
          return(
            <div key={c.id} style={{...S.card({padding:20,position:"relative"}),cursor:"pointer",transition:"box-shadow .15s, transform .15s"}}
              onClick={()=>setSelCompany?.(c.id)}
              onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 8px 20px rgba(15,30,60,.08)";e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.boxShadow="";e.currentTarget.style.transform="";}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:14}}>
                <div style={{width:44,height:44,background:"#EEF2FF",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:avColor(c.name),border:"1px solid #E2E8F0",flexShrink:0}}>{c.name[0]}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:15,color:"#0F172A",marginBottom:2}}>{c.name}</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <span style={S.badge("#06B6D4")}>{c.industry||"Other"}</span>
                    {c.lifecycleStage&&<span style={S.badge("#8B5CF6")}>{c.lifecycleStage}</span>}
                    {c.leadStatus&&<span style={S.badge("#F59E0B")}>{c.leadStatus}</span>}
                  </div>
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
                {c.email&&<div style={{display:"flex",gap:6,alignItems:"center",fontSize:12,color:"#64748B"}}><Ic d={I.mail} size={12}/><a href={`mailto:${c.email}`} onClick={e=>e.stopPropagation()} style={{color:"#1D4ED8",textDecoration:"none"}}>{c.email}</a></div>}
                {c.phone&&<div style={{display:"flex",gap:6,alignItems:"center",fontSize:12,color:"#64748B"}}><Ic d={I.phone} size={12}/>{c.phone}</div>}
                {c.website&&<div style={{display:"flex",gap:6,alignItems:"center",fontSize:12,color:"#64748B"}}><Ic d={I.link} size={12}/><a href={`https://${c.website}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:"#1D4ED8",textDecoration:"none"}}>{c.website}</a></div>}
                {(c.city||c.state)&&<div style={{display:"flex",gap:6,alignItems:"center",fontSize:12,color:"#64748B"}}><Ic d={I.building} size={12}/>{[c.city,c.state].filter(Boolean).join(", ")}</div>}
                {c.owner&&<div style={{display:"flex",gap:6,alignItems:"center",fontSize:12,color:"#64748B"}}><Ic d={I.users} size={12}/>Owner: {c.owner}</div>}
                {c.employees&&<div style={{display:"flex",gap:6,alignItems:"center",fontSize:12,color:"#64748B"}}><Ic d={I.users} size={12}/>{c.employees.toLocaleString()} employees</div>}
                {c.lastContacted&&<div style={{display:"flex",gap:6,alignItems:"center",fontSize:12,color:"#64748B"}}><Ic d={I.clock} size={12}/>Last contact: {fmtDate(c.lastContacted)}</div>}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid #E9EEF6",paddingTop:12}}>
                <span style={{fontSize:12,color:"#475569"}}>{cContacts.length} contact{cContacts.length!==1?"s":""} · {cDeals.length} deal{cDeals.length!==1?"s":""}</span>
                <div style={{display:"flex",gap:4}}>
                  <button style={S.btnGhost} onClick={e=>{e.stopPropagation();openModal("editCompany",c);}}><Ic d={I.edit} size={13}/></button>
                  <button style={{...S.btnGhost,color:"#EF4444"}} onClick={e=>{e.stopPropagation();if(confirm(`Delete ${c.name}?`))deleteCompany(c.id);}}><Ic d={I.trash} size={13}/></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY DETAIL
// ═══════════════════════════════════════════════════════════════════════════════
function CompanyDetail({company,allContacts,allDeals,allNotes,allTasks,onBack,openModal,setSelContact,setSelDeal,setView,deleteCompany,deleteNote,entity}){
  const [tab,setTab]=useState("overview");
  if(!company){
    return(
      <div>
        <button style={{...S.btnGhost,fontSize:12,marginBottom:14}} onClick={onBack}><Ic d={I.arrow} size={12}/>Back to Companies</button>
        <div style={{...S.card({padding:48}),textAlign:"center",color:"#475569"}}>This company no longer exists.</div>
      </div>
    );
  }
  const cContacts=allContacts.filter(ct=>ct.companyName===company.name||ct.companyId===company.id);
  const contactIds=new Set(cContacts.map(c=>c.id));
  const cDeals=allDeals.filter(d=>d.companyId===company.id||(d.companyName&&d.companyName.toLowerCase()===(company.name||"").toLowerCase())||contactIds.has(d.contactId));
  const cNotes=allNotes.filter(n=>contactIds.has(n.contactId));
  const cTasks=allTasks.filter(t=>contactIds.has(t.contactId));
  const dealValue=cDeals.reduce((s,d)=>s+(+d.value||0),0);
  const wonValue=cDeals.filter(d=>d.stage==="Won").reduce((s,d)=>s+(+d.value||0),0);
  const openDeals=cDeals.filter(d=>!["Won","Lost"].includes(d.stage));

  const TAB=({id,label,count})=>(
    <button onClick={()=>setTab(id)} style={{...S.btnGhost,padding:"6px 14px",borderBottom:`2px solid ${tab===id?"#1D4ED8":"transparent"}`,color:tab===id?"#1D4ED8":"#64748B",borderRadius:0,fontSize:13,fontWeight:600}}>
      {label}{count!=null&&<span style={{marginLeft:6,background:tab===id?"#DBEAFE":"#F1F5F9",color:tab===id?"#1D4ED8":"#64748B",borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700}}>{count}</span>}
    </button>
  );
  return(
    <div>
      <button style={{...S.btnGhost,fontSize:12,marginBottom:14}} onClick={onBack}><Ic d={I.arrow} size={12}/>Back to Companies</button>
      <div style={S.card({padding:24,marginBottom:20})}>
        <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
          <div style={{width:64,height:64,background:"#EEF2FF",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:800,color:avColor(company.name),border:"1px solid #E2E8F0",flexShrink:0}}>{company.name?.[0]||"?"}</div>
          <div style={{flex:1,minWidth:0}}>
            <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:22,fontWeight:800,color:"#0F172A",margin:"0 0 6px"}}>{company.name}</h2>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
              <span style={S.badge("#06B6D4")}>{company.industry||"Other"}</span>
              {company.lifecycleStage&&<span style={S.badge("#8B5CF6")}>{company.lifecycleStage}</span>}
              {company.leadStatus&&<span style={S.badge("#F59E0B")}>{company.leadStatus}</span>}
              {company.employees&&<span style={S.badge("#7C3AED")}>{company.employees.toLocaleString()} employees</span>}
              {entity&&<span style={S.badge("#64748B")}>{entity.name}</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6,fontSize:12,color:"#475569"}}>
              {company.website&&<div style={{display:"flex",gap:6,alignItems:"center"}}><Ic d={I.link} size={12}/><a href={`https://${company.website}`} target="_blank" rel="noreferrer" style={{color:"#1D4ED8",textDecoration:"none"}}>{company.website}</a></div>}
              {company.email&&<div style={{display:"flex",gap:6,alignItems:"center"}}><Ic d={I.mail} size={12}/><a href={`mailto:${company.email}`} style={{color:"#1D4ED8",textDecoration:"none"}}>{company.email}</a></div>}
              {company.phone&&<div style={{display:"flex",gap:6,alignItems:"center"}}><Ic d={I.phone} size={12}/>{company.phone}</div>}
              {(company.city||company.state)&&<div style={{display:"flex",gap:6,alignItems:"center"}}><Ic d={I.building} size={12}/>{[company.city,company.state].filter(Boolean).join(", ")}</div>}
              {company.owner&&<div style={{display:"flex",gap:6,alignItems:"center"}}><Ic d={I.users} size={12}/>Owner: {company.owner}</div>}
              {(()=>{const pc=allContacts.find(c=>c.id===company.primaryContactId);return pc?<div style={{display:"flex",gap:6,alignItems:"center"}}><Ic d={I.users} size={12}/>Primary: <button style={{background:"none",border:"none",color:"#1D4ED8",cursor:"pointer",padding:0,fontSize:12,textDecoration:"underline"}} onClick={()=>{setSelContact?.(pc.id);setView?.("contacts");}}>{pc.name}</button></div>:null;})()}
              {company.lastContacted&&<div style={{display:"flex",gap:6,alignItems:"center"}}><Ic d={I.clock} size={12}/>Last contact: {fmtDate(company.lastContacted)}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            <button style={S.btnSecondary} onClick={()=>openModal("editCompany",company)}><Ic d={I.edit} size={13}/>Edit</button>
            <button style={{...S.btnSecondary,color:"#EF4444",borderColor:"#FECACA"}} onClick={()=>{if(confirm(`Delete ${company.name}? This won't remove its contacts or deals.`)){deleteCompany(company.id);onBack();}}}><Ic d={I.trash} size={13}/></button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginTop:18,paddingTop:16,borderTop:"1px solid #E9EEF6"}}>
          <div><div style={{fontSize:11,color:"#64748B",textTransform:"uppercase",fontWeight:700,letterSpacing:.5,marginBottom:4}}>Open pipeline</div><div style={{fontSize:18,fontWeight:800,color:"#1D4ED8"}}>{fmt$(openDeals.reduce((s,d)=>s+(+d.value||0),0))}</div><div style={{fontSize:11,color:"#94A3B8"}}>{openDeals.length} open deal{openDeals.length===1?"":"s"}</div></div>
          <div><div style={{fontSize:11,color:"#64748B",textTransform:"uppercase",fontWeight:700,letterSpacing:.5,marginBottom:4}}>Won revenue</div><div style={{fontSize:18,fontWeight:800,color:"#10B981"}}>{fmt$(wonValue)}</div><div style={{fontSize:11,color:"#94A3B8"}}>across all time</div></div>
          <div><div style={{fontSize:11,color:"#64748B",textTransform:"uppercase",fontWeight:700,letterSpacing:.5,marginBottom:4}}>Total deal value</div><div style={{fontSize:18,fontWeight:800,color:"#0F172A"}}>{fmt$(dealValue)}</div><div style={{fontSize:11,color:"#94A3B8"}}>{cDeals.length} deal{cDeals.length===1?"":"s"}</div></div>
        </div>
      </div>

      <div style={{display:"flex",gap:0,borderBottom:"1px solid #E2E8F0",marginBottom:16}}>
        <TAB id="overview" label="Overview"/>
        <TAB id="contacts" label="Contacts" count={cContacts.length}/>
        <TAB id="deals" label="Deals" count={cDeals.length}/>
        <TAB id="notes" label="Notes" count={cNotes.length}/>
        <TAB id="tasks" label="Tasks" count={cTasks.length}/>
      </div>

      {tab==="overview"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={S.card({padding:18})}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Recent contacts</div>
            {cContacts.length===0?<div style={{fontSize:13,color:"#94A3B8"}}>No contacts linked to this company yet.</div>
            :cContacts.slice(0,6).map(ct=>(
              <div key={ct.id} onClick={()=>{setSelContact(ct.id);setView("contacts");}} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #F1F5F9",cursor:"pointer"}}>
                <Avatar name={ct.name} size={28}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{ct.name}</div>
                  <div style={{fontSize:11,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ct.title||ct.email||"—"}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={S.card({padding:18})}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Recent deals</div>
            {cDeals.length===0?<div style={{fontSize:13,color:"#94A3B8"}}>No deals associated yet.</div>
            :cDeals.slice(0,6).map(d=>(
              <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #F1F5F9"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.title}</div>
                  <span style={S.badge(stageColor(entity,d.stage))}>{d.stage}</span>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>{fmt$(d.value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="contacts"&&(
        <div style={S.card({overflow:"hidden"})}>
          {cContacts.length===0?<div style={{padding:32,textAlign:"center",color:"#94A3B8",fontSize:13}}>No contacts at this company yet.</div>
          :cContacts.map((ct,i)=>(
            <div key={ct.id} onClick={()=>{setSelContact(ct.id);setView("contacts");}} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderTop:i?"1px solid #E9EEF6":"none",cursor:"pointer"}}>
              <Avatar name={ct.name} size={32}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{ct.name}</div>
                <div style={{fontSize:12,color:"#64748B"}}>{[ct.title,ct.email,ct.phone].filter(Boolean).join(" · ")||"—"}</div>
              </div>
              <Ic d={I.arrow} size={14} c="#CBD5E1"/>
            </div>
          ))}
        </div>
      )}

      {tab==="deals"&&(
        <div style={S.card({overflow:"hidden"})}>
          {cDeals.length===0?<div style={{padding:32,textAlign:"center",color:"#94A3B8",fontSize:13}}>No deals associated.</div>
          :(
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Deal","Stage","Value","Close","Probability"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{cDeals.map(d=>(
                <tr key={d.id} onClick={()=>{if(setSelDeal&&setView){setSelDeal(d.id);setView("deals");}}} style={{cursor:setSelDeal?"pointer":"default"}}>
                  <td style={{...S.td,color:"#0F172A",fontWeight:600}}>{d.title}</td>
                  <td style={S.td}><span style={S.badge(stageColor(entity,d.stage))}>{d.stage}</span></td>
                  <td style={{...S.td,fontWeight:700,color:"#0F172A"}}>{fmt$(d.value)}</td>
                  <td style={S.td}>{fmtDate(d.closeDate)}</td>
                  <td style={S.td}>{d.probability!=null?`${d.probability}%`:"—"}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {tab==="notes"&&(
        <div style={S.card({padding:18})}>
          {cNotes.length===0?<div style={{fontSize:13,color:"#94A3B8"}}>No notes yet. Notes are linked through this company's contacts.</div>
          :cNotes.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(n=>{
            const ct=allContacts.find(c=>c.id===n.contactId);
            return(
              <div key={n.id} style={{padding:"10px 0",borderBottom:"1px solid #F1F5F9"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{fontSize:11,color:"#64748B"}}>{ct?.name||"—"} · {fmtTime(n.createdAt)}</div>
                  {deleteNote&&<button style={{...S.btnGhost,color:"#EF4444"}} title="Delete note" onClick={()=>{if(confirm("Delete this note?"))deleteNote(n.id);}}><Ic d={I.trash} size={11}/></button>}
                </div>
                <div style={{fontSize:13,color:"#0F172A",whiteSpace:"pre-wrap"}}>{n.content}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="tasks"&&(
        <div style={S.card({overflow:"hidden"})}>
          {cTasks.length===0?<div style={{padding:32,textAlign:"center",color:"#94A3B8",fontSize:13}}>No tasks yet.</div>
          :cTasks.sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate)).map((t,i)=>{
            const ct=allContacts.find(c=>c.id===t.contactId);
            const overdue=!t.completed&&new Date(t.dueDate)<new Date();
            return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderTop:i?"1px solid #E9EEF6":"none"}}>
                <input type="checkbox" checked={!!t.completed} readOnly style={{accentColor:"#1D4ED8"}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,color:"#0F172A",textDecoration:t.completed?"line-through":"none"}}>{t.title}</div>
                  <div style={{fontSize:11,color:overdue?"#EF4444":"#64748B"}}>{overdue?"⚠ Overdue · ":""}{fmtDate(t.dueDate)}{ct?` · ${ct.name}`:""}</div>
                </div>
                <span style={S.badge({high:"#EF4444",medium:"#F59E0B",low:"#64748B"}[t.priority]||"#64748B")}>{t.priority||"medium"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KANBAN PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════
function KanbanBoard({ed,contacts,companies=[],updateDeal,deleteDeal,openModal,setSelContact,setSelDeal,setView,products,entity}){
  const [dragging,setDragging]=useState(null);
  const [dragOver,setDragOver]=useState(null);
  const totalPipe=ed.filter(d=>!["Won","Lost"].includes(d.stage)).reduce((s,d)=>s+(d.value||0),0);
  return(
    <div>
      <PageHeader title="Deal Pipeline" sub={`${ed.length} deals · ${fmt$(totalPipe)} active pipeline`}>
        <button style={S.btnPrimary} onClick={()=>openModal("addDeal")}><Ic d={I.plus} size={14}/>Add Deal</button>
      </PageHeader>
      <div style={{display:"flex",gap:14,overflowX:"auto",paddingBottom:16,alignItems:"flex-start"}}>
        {stagesFor(entity).map(stage=>{
          const sDeals=ed.filter(d=>d.stage===stage);
          const sVal=sDeals.reduce((s,d)=>s+(d.value||0),0);
          const isOver=dragOver===stage;
          const sCol=stageColor(entity,stage);
          return(
            <div key={stage} style={{minWidth:240,flex:"1 0 240px",background:isOver?"#E9EEF6":"#F1F5F9",border:`1px solid ${isOver?sCol+"60":"#E2E8F0"}`,borderRadius:12,padding:14,transition:"all .15s",maxWidth:300}}
              onDragOver={e=>{e.preventDefault();setDragOver(stage);}} onDragLeave={()=>setDragOver(null)}
              onDrop={e=>{e.preventDefault();if(dragging)updateDeal(dragging,{stage});setDragging(null);setDragOver(null);}}>
              <div style={{marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:sCol}}/>
                    <span style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>{stage}</span>
                    <span style={{background:"#E2E8F0",color:"#64748B",borderRadius:10,padding:"1px 6px",fontSize:11,fontWeight:700}}>{sDeals.length}</span>
                  </div>
                  <button style={{...S.btnGhost,padding:2}} onClick={()=>openModal("addDeal",{stage})}><Ic d={I.plus} size={14}/></button>
                </div>
                <div style={{fontSize:12,color:sCol,fontWeight:600}}>{fmt$(sVal)}</div>
              </div>
              <div style={{minHeight:80}}>
                {sDeals.map(deal=>{
                  const contact=contacts.find(c=>c.id===deal.contactId);
                  const company=companies.find(c=>c.id===deal.companyId)||(deal.companyName?companies.find(c=>c.name?.toLowerCase()===deal.companyName.toLowerCase()):null);
                  const companyLabel=company?.name||deal.companyName;
                  return(
                    <div key={deal.id} draggable onDragStart={()=>setDragging(deal.id)} onDragEnd={()=>{setDragging(null);setDragOver(null);}}
                      onClick={(e)=>{
                        if(e.target.closest('button'))return;
                        if(setSelDeal)setSelDeal(deal.id);
                      }}
                      style={{background:"#FFFFFF",border:`1px solid ${dragging===deal.id?"#1D4ED8":"#E2E8F0"}`,borderRadius:10,padding:14,marginBottom:10,cursor:"grab",opacity:dragging===deal.id?.5:1}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:6,lineHeight:1.4}}>{deal.title}</div>
                      <div style={{fontSize:20,fontWeight:800,color:sCol,marginBottom:8}}>{fmt$(deal.value)}</div>
                      {deal.probability!=null&&<div style={{marginBottom:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#475569",marginBottom:3}}><span>Probability</span><span style={{color:sCol}}>{deal.probability}%</span></div>
                        <div style={{height:4,background:"#E9EEF6",borderRadius:2}}><div style={{height:"100%",background:sCol,borderRadius:2,width:`${deal.probability}%`,transition:"width .3s"}}/></div>
                      </div>}
                      {companyLabel&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,fontSize:12,color:"#475569"}}><Ic d={I.building} size={12} c="#94A3B8"/><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:company?500:400,fontStyle:company?"normal":"italic"}}>{companyLabel}{!company&&deal.companyName?" (unlinked)":""}</span></div>}
                      {contact&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><Avatar name={contact.name} size={20}/><span style={{fontSize:12,color:"#64748B"}}>{contact.name}</span></div>}
                      <div style={{fontSize:11,color:"#475569",marginBottom:8}}><Ic d={I.cal} size={11} c="#475569"/> {fmtDate(deal.closeDate)}</div>
                      {deal.contractType&&<span style={{...S.badge("#06B6D4"),fontSize:10,marginBottom:6}}>{deal.contractType}</span>}
                      <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                        <button style={S.btnGhost} title="View Contact" onClick={()=>{setSelContact(deal.contactId);setView("contacts");}}><Ic d={I.link} size={12}/></button>
                        <button style={S.btnGhost} title="Quote" onClick={()=>openModal("buildQuote",{contactId:deal.contactId,dealId:deal.id})}><Ic d={I.quote} size={12}/></button>
                        <button style={S.btnGhost} title="Edit" onClick={()=>openModal("editDeal",deal)}><Ic d={I.edit} size={12}/></button>
                        <button style={{...S.btnGhost,color:"#EF4444"}} title="Delete" onClick={()=>{if(confirm("Delete deal?"))deleteDeal(deal.id);}}><Ic d={I.trash} size={12}/></button>
                      </div>
                    </div>
                  );
                })}
                {sDeals.length===0&&<div style={{border:"2px dashed #CBD5E1",borderRadius:10,padding:"20px",textAlign:"center",color:"#94A3B8",fontSize:12}}>Drop deals here</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════════
function TasksView({et,contacts,updateTask,deleteTask,openModal}){
  const [filter,setFilter]=useState("all");
  const [editingId,setEditingId]=useState(null);
  const [edit,setEdit]=useState({title:"",dueDate:"",priority:"medium",contactId:""});
  const filtered=et.filter(t=>filter==="all"?true:filter==="pending"?!t.completed:t.completed);
  const sorted=[...filtered].sort((a,b)=>a.completed===b.completed?(new Date(a.dueDate)-new Date(b.dueDate)):a.completed?1:-1);
  const overdue=et.filter(t=>!t.completed&&new Date(t.dueDate)<new Date()).length;
  const startEdit=(t)=>{setEditingId(t.id);setEdit({title:t.title||"",dueDate:t.dueDate||"",priority:t.priority||"medium",contactId:t.contactId||""});};
  const saveEdit=()=>{
    if(!edit.title.trim())return;
    updateTask(editingId,{title:edit.title.trim(),dueDate:edit.dueDate||null,priority:edit.priority,contactId:edit.contactId||null});
    setEditingId(null);
  };
  return(
    <div>
      <PageHeader title="Tasks" sub={`${et.filter(t=>!t.completed).length} pending · ${overdue} overdue`}>
        <div style={{display:"flex",gap:4,background:"#E2E8F0",padding:3,borderRadius:8}}>
          {[["all","All"],["pending","Pending"],["done","Done"]].map(([v,l])=>(
            <button key={v} style={{...S.btnGhost,padding:"5px 12px",background:filter===v?"#1D4ED8":"transparent",color:filter===v?"#FFFFFF":"#64748B",borderRadius:6,fontSize:12}} onClick={()=>setFilter(v)}>{l}</button>
          ))}
        </div>
        <button style={S.btnPrimary} onClick={()=>openModal("addTask")}><Ic d={I.plus} size={14}/>Add Task</button>
      </PageHeader>
      <div style={S.card({overflow:"hidden"})}>
        {sorted.length===0?<div style={{padding:48,textAlign:"center",color:"#475569"}}>No tasks found!</div>
        :sorted.map((t,i)=>{
          const contact=contacts.find(c=>c.id===t.contactId);
          const ov=!t.completed&&new Date(t.dueDate)<new Date();
          if(editingId===t.id){
            return(
              <div key={t.id} style={{display:"grid",gridTemplateColumns:"1fr 140px 110px 80px",gap:8,padding:"10px 16px",borderTop:i?"1px solid #E9EEF6":"none",alignItems:"center",background:"#F8FAFC"}}>
                <input style={S.input} placeholder="Title" value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")saveEdit();if(e.key==="Escape")setEditingId(null);}}/>
                <input type="date" style={S.input} value={edit.dueDate} onChange={e=>setEdit({...edit,dueDate:e.target.value})}/>
                <select style={S.select} value={edit.priority} onChange={e=>setEdit({...edit,priority:e.target.value})}>{PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}</select>
                <div style={{display:"flex",gap:4,justifyContent:"flex-end"}}>
                  <button style={S.btnGhost} title="Cancel" onClick={()=>setEditingId(null)}><Ic d={I.x} size={13}/></button>
                  <button style={{...S.btnGhost,color:"#10B981"}} title="Save" onClick={saveEdit}><Ic d={I.ok} size={13}/></button>
                </div>
              </div>
            );
          }
          return(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderTop:i?"1px solid #E9EEF6":"none",opacity:t.completed?.6:1,cursor:"pointer"}} onClick={(e)=>{if(e.target.closest('button')||e.target.closest('input'))return;startEdit(t);}}>
              <input type="checkbox" checked={t.completed} onChange={e=>updateTask(t.id,{completed:e.target.checked})} style={{cursor:"pointer",accentColor:"#1D4ED8",width:16,height:16,flexShrink:0}} onClick={e=>e.stopPropagation()}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,color:t.completed?"#475569":"#0F172A",textDecoration:t.completed?"line-through":"none",fontWeight:500}}>{t.title}</div>
                <div style={{display:"flex",gap:10,alignItems:"center",marginTop:3,flexWrap:"wrap"}}>
                  {contact&&<span style={{fontSize:12,color:"#64748B",display:"flex",alignItems:"center",gap:4}}><Avatar name={contact.name} size={16}/>{contact.name}</span>}
                  <span style={{fontSize:12,color:ov?"#EF4444":"#64748B",display:"flex",alignItems:"center",gap:3}}><Ic d={I.cal} size={12}/>{fmtDate(t.dueDate)}{ov&&" ⚠"}</span>
                  {t.reminder&&<span style={S.badge("#8B5CF6")}><Ic d={I.bell} size={10}/>Reminder On</span>}
                </div>
              </div>
              <span style={S.badge({high:"#EF4444",medium:"#F59E0B",low:"#64748B"}[t.priority])}>{t.priority}</span>
              <button style={S.btnGhost} title="Edit" onClick={e=>{e.stopPropagation();startEdit(t);}}><Ic d={I.edit} size={13}/></button>
              <button style={{...S.btnGhost,color:"#EF4444"}} onClick={e=>{e.stopPropagation();deleteTask(t.id);}}><Ic d={I.trash} size={14}/></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS (Pipeline, Activity, Forecasting tabs)
// ═══════════════════════════════════════════════════════════════════════════════
function ReportsView({ed,ec,et,notes,entity,showToast}){
  const [reportType,setReportType]=useState("pipeline");
  const [shared,setShared]=useState(false);
  const pipeTotal=ed.filter(d=>!["Won","Lost"].includes(d.stage)).reduce((s,d)=>s+(d.value||0),0);
  const wonTotal=ed.filter(d=>d.stage==="Won").reduce((s,d)=>s+(d.value||0),0);
  const lostTotal=ed.filter(d=>d.stage==="Lost").reduce((s,d)=>s+(d.value||0),0);
  const closed=ed.filter(d=>["Won","Lost"].includes(d.stage));
  const closeRate=closed.length?Math.round((ed.filter(d=>d.stage==="Won").length/closed.length)*100):0;
  const avgDeal=ed.length?Math.round(ed.reduce((s,d)=>s+(d.value||0),0)/ed.length):0;
  const weighted=ed.filter(d=>!["Won","Lost"].includes(d.stage)).reduce((s,d)=>s+((d.value||0)*((d.probability||50)/100)),0);
  const stageData=stagesFor(entity).map(st=>({stage:st,count:ed.filter(d=>d.stage===st).length,value:ed.filter(d=>d.stage===st).reduce((s,d)=>s+(d.value||0),0)}));
  const sourceData=SOURCES.map(src=>({source:src,count:ec.filter(c=>c.source===src).length})).filter(d=>d.count>0);
  // Forecast: 6 months
  const now=new Date();
  const forecastMonths=Array.from({length:6},(_,i)=>{
    const monthDate=new Date(now.getFullYear(),now.getMonth()+i,1);
    const label=monthDate.toLocaleString("default",{month:"short",year:"2-digit"});
    const inMonth=(deal)=>{
      if(!deal.closeDate)return false;
      const cd=new Date(deal.closeDate);
      return cd.getMonth()===monthDate.getMonth()&&cd.getFullYear()===monthDate.getFullYear();
    };
    const won=ed.filter(deal=>deal.stage==="Won"&&inMonth(deal)).reduce((s,deal)=>s+(deal.value||0),0);
    const pipe=ed.filter(deal=>!["Won","Lost"].includes(deal.stage)&&inMonth(deal)).reduce((s,deal)=>s+((deal.value||0)*(deal.probability||50)/100),0);
    return {month:label,won,weighted:pipe,total:won+pipe};
  });
  const handleShare=()=>{const r={entity:entity?.name,type:reportType,data:{pipeTotal,wonTotal,closeRate,avgDeal,deals:ed.length,contacts:ec.length}};navigator.clipboard?.writeText(`${window.location.href}?report=${btoa(JSON.stringify(r))}`).catch(()=>{});showToast("Share link copied!");setShared(true);setTimeout(()=>setShared(false),3000);};
  const handleExport=()=>{const data=reportType==="pipeline"?{summary:{pipeTotal,wonTotal,lostTotal,closeRate,avgDeal,weighted},byStage:stageData,deals:ed}:reportType==="forecast"?{forecast:forecastMonths,deals:ed}:{contacts:ec,sources:sourceData,tasks:et,notes};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${entity?.name}_${reportType}_report.json`;a.click();showToast("Report exported!");};
  return(
    <div>
      <PageHeader title="Reports" sub={`${entity?.name} · Generated ${fmtDate(new Date())}`}>
        <div style={{display:"flex",gap:4,background:"#E2E8F0",padding:3,borderRadius:8}}>
          {[["pipeline","Pipeline"],["activity","Activity"],["forecast","Forecast"]].map(([v,l])=>(
            <button key={v} style={{...S.btnGhost,padding:"5px 14px",background:reportType===v?"#1D4ED8":"transparent",color:reportType===v?"#FFFFFF":"#64748B",borderRadius:6,fontSize:12}} onClick={()=>setReportType(v)}>{l}</button>
          ))}
        </div>
        <button style={S.btnSecondary} onClick={handleExport}><Ic d={I.dl} size={14}/>Export</button>
        <button style={{...S.btnPrimary,background:shared?"#10B981":"#1D4ED8"}} onClick={handleShare}><Ic d={shared?I.ok:I.share} size={14}/>{shared?"Copied!":"Share"}</button>
      </PageHeader>
      {reportType==="pipeline"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:20}}>
            <StatCard label="Active Pipeline" value={fmt$(pipeTotal)} color="#1D4ED8" icon={I.dollar}/>
            <StatCard label="Won Revenue" value={fmt$(wonTotal)} color="#10B981" icon={I.ok}/>
            <StatCard label="Close Rate" value={`${closeRate}%`} color="#F59E0B" icon={I.bar}/>
            <StatCard label="Avg Deal Size" value={fmt$(avgDeal)} color="#8B5CF6" icon={I.dollar}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}}>
            <StatCard label="Total Deals" value={ed.length} sub="All time" color="#06B6D4" icon={I.layers}/>
            <StatCard label="Weighted Pipeline" value={fmt$(weighted)} sub="By probability" color="#EC4899" icon={I.bar}/>
            <StatCard label="Lost Revenue" value={fmt$(lostTotal)} sub="Lost deals" color="#EF4444" icon={I.x}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            <div style={S.card({padding:20})}>
              <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>Deal Count by Stage</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stageData} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF6" vertical={false}/>
                  <XAxis dataKey="stage" tick={{fill:"#64748B",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>v.split(" ")[0]}/>
                  <YAxis tick={{fill:"#64748B",fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:8,fontSize:12}}/>
                  <Bar dataKey="count" radius={[4,4,0,0]}>{stageData.map((d,i)=><Cell key={i} fill={stageColor(entity,d.stage)}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={S.card({padding:20})}>
              <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>Value by Stage ($)</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stageData} barSize={30}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF6" vertical={false}/>
                  <XAxis dataKey="stage" tick={{fill:"#64748B",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>v.split(" ")[0]}/>
                  <YAxis tick={{fill:"#64748B",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                  <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:8,fontSize:12}} formatter={v=>fmt$(v)}/>
                  <Bar dataKey="value" radius={[4,4,0,0]}>{stageData.map((d,i)=><Cell key={i} fill={stageColor(entity,d.stage)+"80"}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={S.card({overflow:"hidden"})}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #E9EEF6",fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>All Deals</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Deal","Value","Stage","Probability","Close Date"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{ed.map(d=>(
                <tr key={d.id}>
                  <td style={S.td}><div style={{fontWeight:600,color:"#0F172A"}}>{d.title}</div></td>
                  <td style={{...S.td,fontWeight:700,color:stageColor(entity,d.stage)}}>{fmt$(d.value)}</td>
                  <td style={S.td}><span style={S.badge(stageColor(entity,d.stage))}>{d.stage}</span></td>
                  <td style={S.td}>{d.probability||"—"}%</td>
                  <td style={S.td}>{fmtDate(d.closeDate)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {reportType==="activity"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:20}}>
            <StatCard label="Total Contacts" value={ec.length} color="#1D4ED8" icon={I.users}/>
            <StatCard label="Notes Logged" value={notes.length} color="#8B5CF6" icon={I.note}/>
            <StatCard label="Tasks Created" value={et.length} color="#F59E0B" icon={I.check}/>
            <StatCard label="Tasks Done" value={et.filter(t=>t.completed).length} sub={`${et.length?Math.round(et.filter(t=>t.completed).length/et.length*100):0}% completion`} color="#10B981" icon={I.ok}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            <div style={S.card({padding:20})}>
              <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>Contacts by Source</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sourceData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF6" vertical={false}/>
                  <XAxis dataKey="source" tick={{fill:"#64748B",fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#64748B",fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:8,fontSize:12}}/>
                  <Bar dataKey="count" fill="#1D4ED8" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={S.card({padding:20})}>
              <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Task Status</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={[{name:"Done",value:et.filter(t=>t.completed).length},{name:"Pending",value:et.filter(t=>!t.completed).length}]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" stroke="none">
                    <Cell fill="#10B981"/><Cell fill="#EF4444"/>
                  </Pie>
                  <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:8,fontSize:12}}/>
                  <Legend wrapperStyle={{fontSize:12,color:"#64748B"}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={S.card({padding:20})}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>Recent Activity Log</div>
            {[...notes].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,20).map(n=>{
              const contact=ec.find(c=>c.id===n.contactId);
              return(<div key={n.id} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid #E9EEF6",alignItems:"flex-start"}}>
                <Avatar name={contact?.name||"?"} size={28}/>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{contact?.name||"Unknown"}</div><div style={{fontSize:13,color:"#64748B",marginTop:2}}>{n.content}</div></div>
                <div style={{fontSize:11,color:"#475569",flexShrink:0}}>{fmtTime(n.createdAt)}</div>
              </div>);
            })}
          </div>
        </div>
      )}
      {reportType==="forecast"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:20}}>
            <StatCard label="6-Month Won" value={fmt$(forecastMonths.reduce((s,m)=>s+m.won,0))} color="#10B981" icon={I.ok}/>
            <StatCard label="6-Month Weighted" value={fmt$(forecastMonths.reduce((s,m)=>s+m.weighted,0))} color="#1D4ED8" icon={I.trending}/>
            <StatCard label="Total Forecast" value={fmt$(forecastMonths.reduce((s,m)=>s+m.total,0))} color="#8B5CF6" icon={I.dollar}/>
          </div>
          <div style={S.card({padding:20,marginBottom:20})}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:16}}>6-Month Revenue Forecast</div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={forecastMonths}>
                <defs>
                  <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="pipeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.2}/><stop offset="95%" stopColor="#1D4ED8" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9EEF6" vertical={false}/>
                <XAxis dataKey="month" tick={{fill:"#64748B",fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#64748B",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                <Tooltip contentStyle={{background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:8,fontSize:12}} formatter={v=>fmt$(v)}/>
                <Legend wrapperStyle={{fontSize:11,color:"#64748B"}}/>
                <Area type="monotone" dataKey="won" stroke="#10B981" fill="url(#wonGrad)" strokeWidth={2} name="Won"/>
                <Area type="monotone" dataKey="weighted" stroke="#1D4ED8" fill="url(#pipeGrad)" strokeWidth={2} name="Weighted Pipeline"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={S.card({overflow:"hidden"})}>
            <div style={{padding:"14px 16px",borderBottom:"1px solid #E9EEF6",fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Monthly Breakdown</div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Month","Won Revenue","Weighted Pipeline","Total Forecast"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{forecastMonths.map(m=>(
                <tr key={m.month}>
                  <td style={{...S.td,fontWeight:600,color:"#0F172A"}}>{m.month}</td>
                  <td style={{...S.td,color:"#10B981",fontWeight:600}}>{fmt$(m.won)}</td>
                  <td style={{...S.td,color:"#1D4ED8",fontWeight:600}}>{fmt$(m.weighted)}</td>
                  <td style={{...S.td,fontWeight:700,color:"#8B5CF6"}}>{fmt$(m.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// AI IMPORT VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function ImportView({activeEntityId,entity,contacts,companies,addContact,addCompany,addDeal,showToast}){
  const [tab,setTab]=useState("ai");
  const [file,setFile]=useState(null);
  const [fileContent,setFileContent]=useState("");
  const [loading,setLoading]=useState(false);
  const [extracted,setExtracted]=useState(null);
  const [selected,setSelected]=useState({});
  const [csvRows,setCsvRows]=useState([]);
  const [csvHeaders,setCsvHeaders]=useState([]);
  const [csvMapping,setCsvMapping]=useState({});
  const [csvType,setCsvType]=useState("contact"); // "contact" | "company"
  const [importSource,setImportSource]=useState("HubSpot Import");
  const fileRef=useRef();
  const csvRef=useRef();

  // ─── CONTACT IMPORT ───────────────────────────────────────────────────────
  const CONTACT_FIELDS=["name","firstName","lastName","email","phone","title","companyName","source","notes"];
  const CONTACT_FIELD_LABELS={name:"name",firstName:"name (first part)",lastName:"name (last part)",email:"email",phone:"phone",title:"title",companyName:"companyName",source:"source",notes:"notes"};
  const HUBSPOT_CONTACT_DEFAULTS={
    firstname:"firstName",lastname:"lastName",email:"email",phone:"phone",jobtitle:"title",company:"companyName","hs_analytics_source":"source",
    "First Name":"firstName","Last Name":"lastName","Email":"email","Phone Number":"phone","Job Title":"title","Company Name":"companyName","Lead Status":"source",
  };
  const ZOHO_CONTACT_DEFAULTS={"First Name":"firstName","Last Name":"lastName",Email:"email",Phone:"phone",Title:"title",Account:"companyName","Lead Source":"source"};
  const HUBSPOT_CONTACT_SKIP=new Set(["city","record id","contact owner","create date","last activity date"]);

  // ─── COMPANY IMPORT ───────────────────────────────────────────────────────
  const COMPANY_FIELDS=["name","website","industry","phone","email","employees","notes"];
  const COMPANY_FIELD_LABELS={name:"name",website:"website",industry:"industry",phone:"phone",email:"email",employees:"employees",notes:"notes"};
  const HUBSPOT_COMPANY_DEFAULTS={
    // Display names (modern HubSpot UI export)
    "Company name":"name","Company Name":"name","Company Domain Name":"website","Domain":"website",
    "Industry":"industry","Phone Number":"phone","Number of Employees":"employees","Email":"email",
    // API names (legacy)
    name:"name",domain:"website",industry:"industry",phone:"phone",numberofemployees:"employees",email:"email",
  };
  const HUBSPOT_COMPANY_SKIP=new Set(["city","annual revenue","record id","company owner","create date","country","state","postal code","time zone"]);

  // ─── DEAL IMPORT ──────────────────────────────────────────────────────────
  const DEAL_FIELDS=["title","value","closeDate","stage","companyName","contactName","probability","notes"];
  const DEAL_FIELD_LABELS={title:"title",value:"value",closeDate:"closeDate",stage:"stage",companyName:"company (link by name)",contactName:"contact (link by name)",probability:"probability",notes:"notes"};
  const HUBSPOT_DEAL_DEFAULTS={
    "Deal Name":"title","Amount":"value","Close Date":"closeDate","Deal Stage":"stage","Pipeline":"",
    "Associated Company":"companyName","Associated Companies":"companyName","Associated Contact":"contactName","Associated Contacts":"contactName",
    "Deal Probability":"probability","Forecast Probability":"probability",
    // legacy API names
    dealname:"title",amount:"value",closedate:"closeDate",dealstage:"stage",pipeline:"",
  };
  const HUBSPOT_DEAL_SKIP=new Set(["deal description","record id","deal owner","create date","last modified date","deal type","forecast amount","weighted amount","days to close"]);
  // HubSpot's default sales pipeline → NexCRM's default stages
  const HUBSPOT_STAGE_MAP={
    "appointment scheduled":"New Lead",
    "qualified to buy":"Contacted",
    "presentation scheduled":"Proposal Sent",
    "decision maker bought-in":"Proposal Sent",
    "decision maker bought in":"Proposal Sent",
    "contract sent":"Proposal Sent",
    "closed won":"Won",
    "closed lost":"Lost",
  };

  const fieldsForType=(t)=>t==="deal"?DEAL_FIELDS:t==="company"?COMPANY_FIELDS:CONTACT_FIELDS;
  const labelsForType=(t)=>t==="deal"?DEAL_FIELD_LABELS:t==="company"?COMPANY_FIELD_LABELS:CONTACT_FIELD_LABELS;

  // Full-text CSV parser: handles quoted fields with embedded commas AND newlines, BOM, CRLF/LF.
  const parseCsv=(text)=>{
    if(!text)return[];
    if(text.charCodeAt(0)===0xFEFF)text=text.slice(1); // strip BOM
    const rows=[];let row=[];let cur="";let inQ=false;
    const pushCell=()=>{row.push(cur);cur="";};
    const pushRow=()=>{if(row.length>1||row[0]!=="")rows.push(row.map(v=>v.trim()));row=[];};
    for(let i=0;i<text.length;i++){
      const ch=text[i];
      if(inQ){
        if(ch==='"'&&text[i+1]==='"'){cur+='"';i++;}
        else if(ch==='"')inQ=false;
        else cur+=ch;
      }else{
        if(ch==='"')inQ=true;
        else if(ch===","){pushCell();}
        else if(ch==='\r'){pushCell();pushRow();if(text[i+1]==='\n')i++;}
        else if(ch==='\n'){pushCell();pushRow();}
        else cur+=ch;
      }
    }
    if(cur!==""||row.length>0){pushCell();pushRow();}
    return rows;
  };

  const readFile=(f,isCSV)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      const text=e.target.result;
      if(isCSV){
        const allRows=parseCsv(text);
        const headers=allRows[0]||[];
        const rows=allRows.slice(1).map(vals=>{
          const obj={};headers.forEach((h,i)=>obj[h]=vals[i]||"");return obj;
        }).filter(r=>Object.values(r).some(v=>v));
        console.log("[CSV Parse] file:",f?.name,"headers:",headers.length,"data rows:",rows.length);
        if(rows[0])console.log("[CSV Parse] first row sample:",rows[0]);
        setCsvHeaders(headers);setCsvRows(rows);
        const lowered=headers.map(h=>h.toLowerCase().trim());
        // Auto-detect HubSpot vs Zoho — check both legacy API headers and modern display headers
        const isHubspot=lowered.some(l=>["firstname","lastname","hs_analytics_source","hubspot_owner_id","record id","lead status","company domain name","number of employees","deal name","deal stage","close date","amount","pipeline"].includes(l))
          ||(lowered.includes("first name")&&lowered.some(l=>["phone number","job title","company name","record id","lead status"].includes(l)))
          ||(lowered.includes("company name")&&lowered.some(l=>["company domain name","number of employees","industry","record id"].includes(l)))
          ||(lowered.includes("deal name")||lowered.includes("deal stage"));
        const isZoho=lowered.some(l=>["lead source","account","salutation"].includes(l));
        // Detect type — order matters: Deals first (because Deals export contains "Associated Company" which would otherwise trip Companies detection)
        const looksLikeDeal=
          lowered.includes("deal name")||lowered.includes("deal stage")||lowered.includes("dealname")||lowered.includes("dealstage")
          ||(lowered.includes("amount")&&lowered.includes("close date"))
          ||(lowered.includes("amount")&&lowered.includes("pipeline"));
        const looksLikeCompany=!looksLikeDeal&&
          (lowered.includes("company name")||lowered.includes("company domain name")||lowered.includes("number of employees")||lowered.includes("annual revenue"))
          && !lowered.includes("first name")
          && !lowered.includes("last name")
          && !lowered.includes("job title")
          && !lowered.includes("lead status");
        const detectedType=looksLikeDeal?"deal":looksLikeCompany?"company":"contact";
        setCsvType(detectedType);
        const defaults=detectedType==="deal"
          ?(isHubspot?HUBSPOT_DEAL_DEFAULTS:{})
          :detectedType==="company"
          ?(isHubspot?HUBSPOT_COMPANY_DEFAULTS:{})
          :(isHubspot?HUBSPOT_CONTACT_DEFAULTS:isZoho?ZOHO_CONTACT_DEFAULTS:{});
        const skipSet=detectedType==="deal"?HUBSPOT_DEAL_SKIP:detectedType==="company"?HUBSPOT_COMPANY_SKIP:HUBSPOT_CONTACT_SKIP;
        const mapping={};
        headers.forEach(h=>{
          const lower=h.toLowerCase().trim();
          if(isHubspot&&skipSet.has(lower))return;
          const match=Object.keys(defaults).find(k=>k.toLowerCase()===lower);
          if(match)mapping[h]=defaults[match];
        });
        setCsvMapping(mapping);
        setImportSource(isHubspot?"HubSpot Import":isZoho?"Zoho Import":"Other");
      } else {
        setFileContent(text);
      }
    };
    if(isCSV)reader.readAsText(f);else reader.readAsDataURL(f);
  };

  const handleAIFile=(e)=>{const f=e.target.files[0];if(!f)return;setFile(f);setExtracted(null);readFile(f,false);};
  const handleCSVFile=(e)=>{const f=e.target.files[0];if(!f)return;setFile(f);setExtracted(null);readFile(f,true);};

  const runAIExtract=async()=>{
    if(!file&&!fileContent){showToast("Please upload a file first","error");return;}
    setLoading(true);setExtracted(null);
    try{
      const isImage=file?.type?.startsWith("image/")||file?.type==="application/pdf";
      const messages=isImage?[{role:"user",content:[{type:"image",source:{type:"base64",media_type:file.type,data:fileContent.split(",")[1]}},{type:"text",text:`Extract all contact and company information from this document. Return ONLY valid JSON with this structure: {"contacts":[{"name":"","email":"","phone":"","title":"","companyName":"","notes":""}],"companies":[{"name":"","industry":"","website":"","phone":"","email":""}]}. Extract every person and company you can find.`}]}]:[{role:"user",content:`Extract all contact and company information from this text/data. Return ONLY valid JSON with this structure: {"contacts":[{"name":"","email":"","phone":"","title":"","companyName":"","notes":""}],"companies":[{"name":"","industry":"","website":"","phone":"","email":""}]}. Text to analyze:\n\n${fileContent.slice(0,8000)}`}];
      const resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages})});
      const data=await resp.json();
      const text=data.content?.find(c=>c.type==="text")?.text||"";
      const jsonMatch=text.match(/\{[\s\S]*\}/);
      if(jsonMatch){
        const parsed=JSON.parse(jsonMatch[0]);
        setExtracted(parsed);
        const sel={};
        (parsed.contacts||[]).forEach((_,i)=>sel[`c_${i}`]=true);
        (parsed.companies||[]).forEach((_,i)=>sel[`co_${i}`]=true);
        setSelected(sel);
      }else{showToast("Could not extract structured data. Try a clearer document.","error");}
    }catch(e){showToast("AI extraction failed. Check your file and try again.","error");}
    setLoading(false);
  };

  const importAIData=()=>{
    let cc=0;let cco=0;
    if(extracted?.contacts){
      extracted.contacts.forEach((c,i)=>{
        if(!selected[`c_${i}`])return;
        const dupEmail=c.email&&contacts.some(ex=>ex.email?.toLowerCase()===c.email?.toLowerCase()&&ex.entityId===activeEntityId);
        if(!dupEmail&&c.name){addContact({...c,source:importSource||"Other"});cc++;}
      });
    }
    if(extracted?.companies){
      extracted.companies.forEach((co,i)=>{
        if(!selected[`co_${i}`])return;
        const dup=co.name&&companies.some(ex=>ex.name?.toLowerCase()===co.name?.toLowerCase()&&ex.entityId===activeEntityId);
        if(!dup&&co.name){addCompany(co);cco++;}
      });
    }
    showToast(`Imported ${cc} contacts, ${cco} companies`);
    setExtracted(null);setFile(null);setFileContent("");
  };

  const buildContactFromRow=(row)=>{
    const contact={source:importSource||"Other"};
    let firstName="";let lastName="";
    Object.keys(csvMapping).forEach(h=>{
      const target=csvMapping[h];const val=row[h];
      if(!target||!val)return;
      if(target==="firstName")firstName=val;
      else if(target==="lastName")lastName=val;
      else contact[target]=val;
    });
    if(firstName||lastName){
      contact.name=[firstName,lastName].filter(Boolean).join(" ");
    }
    // M10 — auto-link to existing company by case-insensitive name match
    if(contact.companyName){
      const co=eCompaniesForEntity.find(c=>c.name&&c.name.toLowerCase()===contact.companyName.toLowerCase());
      if(co)contact.companyId=co.id;
    }
    return contact;
  };

  const buildCompanyFromRow=(row)=>{
    const company={};
    Object.keys(csvMapping).forEach(h=>{
      const target=csvMapping[h];const val=row[h];
      if(!target||!val)return;
      if(target==="employees"){
        const n=parseInt(String(val).replace(/[^0-9]/g,""),10);
        if(!Number.isNaN(n))company.employees=n;
      } else {
        company[target]=val;
      }
    });
    return company;
  };

  const parseAmount=(s)=>{
    if(s==null||s==="")return undefined;
    const cleaned=String(s).replace(/[^0-9.\-]/g,"");
    const n=parseFloat(cleaned);
    return Number.isNaN(n)?undefined:n;
  };
  const parseDate=(s)=>{
    if(!s)return undefined;
    const t=Date.parse(s);
    if(Number.isNaN(t))return undefined;
    return new Date(t).toISOString().slice(0,10);
  };
  const eContactsForEntity=contacts.filter(c=>c.entityId===activeEntityId);
  const eCompaniesForEntity=companies.filter(c=>c.entityId===activeEntityId);
  const buildDealFromRow=(row,entityStages)=>{
    const deal={};
    let companyName="";let contactName="";
    Object.keys(csvMapping).forEach(h=>{
      const target=csvMapping[h];const val=row[h];
      if(!target||!val)return;
      if(target==="value"){const n=parseAmount(val);if(n!=null)deal.value=n;}
      else if(target==="closeDate"){const d=parseDate(val);if(d)deal.closeDate=d;}
      else if(target==="probability"){const n=parseAmount(val);if(n!=null)deal.probability=Math.max(0,Math.min(100,Math.round(n)));}
      else if(target==="stage"){
        const mapped=HUBSPOT_STAGE_MAP[String(val).toLowerCase().trim()];
        const final=mapped||val;
        // Always coerce to a stage that exists in the active pipeline so the deal is visible in the kanban.
        const pipeline=(entityStages&&entityStages.length)?entityStages:STAGES;
        deal.stage=pipeline.includes(final)?final:pipeline[0];
      }
      else if(target==="companyName")companyName=String(val).trim();
      else if(target==="contactName")contactName=String(val).trim();
      else deal[target]=val;
    });
    // Resolve linked records by case-insensitive name match within active entity
    if(companyName){
      const co=eCompaniesForEntity.find(c=>c.name&&c.name.toLowerCase()===companyName.toLowerCase());
      if(co)deal.companyId=co.id;
      deal.companyName=companyName; // keep original string for reference
    }
    if(contactName){
      const ct=eContactsForEntity.find(c=>c.name&&c.name.toLowerCase()===contactName.toLowerCase());
      if(ct)deal.contactId=ct.id;
      deal.contactName=contactName;
    }
    return deal;
  };

  const importCSVData=()=>{
    const activeEntity=activeEntityId; // captured for logs
    const entityStages=entity?.stages;
    console.log("[CSV Import] type:",csvType,"rows:",csvRows.length,"activeEntityId:",activeEntity);
    console.log("[CSV Import] mapping:",csvMapping);
    if(csvRows[0]){
      console.log("[CSV Import] first raw row:",csvRows[0]);
      const built=csvType==="deal"?buildDealFromRow(csvRows[0],entityStages):csvType==="company"?buildCompanyFromRow(csvRows[0]):buildContactFromRow(csvRows[0]);
      console.log("[CSV Import] first built object:",built);
    }
    let count=0;let skipped=0;const skipReasons=[];let linkedContacts=0;let linkedCompanies=0;
    const log=(reason)=>{skipped++;if(skipReasons.length<10)skipReasons.push(reason);};
    if(csvType==="deal"){
      csvRows.forEach((row,idx)=>{
        const deal=buildDealFromRow(row,entityStages);
        if(!deal.title){log(`row ${idx+1}: missing title (raw=${JSON.stringify(row).slice(0,120)})`);return;}
        if(deal.contactId)linkedContacts++;
        if(deal.companyId)linkedCompanies++;
        addDeal(deal);count++;
      });
      console.log("[CSV Import] created:",count,"skipped:",skipped,"linked to existing contact:",linkedContacts,"linked to existing company:",linkedCompanies);
      if(skipReasons.length)console.log("[CSV Import] skip reasons (first 10):",skipReasons);
      showToast(`Imported ${count} deal${count===1?"":"s"} · linked ${linkedContacts} contact${linkedContacts===1?"":"s"}, ${linkedCompanies} compan${linkedCompanies===1?"y":"ies"}${skipped?` (${skipped} skipped)`:""}`);
    } else if(csvType==="company"){
      csvRows.forEach((row,idx)=>{
        const co=buildCompanyFromRow(row);
        if(!co.name){log(`row ${idx+1}: missing name (raw=${JSON.stringify(row).slice(0,120)})`);return;}
        const dup=companies.some(x=>x.name&&x.name.toLowerCase()===co.name.toLowerCase()&&x.entityId===activeEntityId);
        if(dup){log(`row ${idx+1}: duplicate of "${co.name}"`);return;}
        addCompany(co);count++;
      });
      console.log("[CSV Import] created:",count,"skipped:",skipped);
      if(skipReasons.length)console.log("[CSV Import] skip reasons (first 10):",skipReasons);
      showToast(`Imported ${count} compan${count===1?"y":"ies"}${skipped?` (${skipped} skipped — open the browser console for details)`:""}`);
    } else {
      csvRows.forEach((row,idx)=>{
        const contact=buildContactFromRow(row);
        if(!contact.name){log(`row ${idx+1}: missing name (raw=${JSON.stringify(row).slice(0,120)})`);return;}
        const dup=contact.email&&contacts.some(c=>c.email&&c.email.toLowerCase()===contact.email.toLowerCase()&&c.entityId===activeEntityId);
        if(dup){log(`row ${idx+1}: duplicate email ${contact.email}`);return;}
        addContact(contact);count++;
      });
      console.log("[CSV Import] created:",count,"skipped:",skipped);
      if(skipReasons.length)console.log("[CSV Import] skip reasons (first 10):",skipReasons);
      showToast(`Imported ${count} contact${count===1?"":"s"}${skipped?` (${skipped} skipped — open the browser console for details)`:""}`);
    }
    setCsvRows([]);setCsvHeaders([]);setCsvMapping({});setFile(null);
  };

  return(
    <div>
      <PageHeader title="Import Data" sub="Bring in contacts from any CRM, file, or document">
        <div style={{display:"flex",gap:4,background:"#E2E8F0",padding:3,borderRadius:8}}>
          {[["ai","AI Extract"],["csv","CSV / HubSpot / Zoho"]].map(([v,l])=>(
            <button key={v} style={{...S.btnGhost,padding:"5px 14px",background:tab===v?"#1D4ED8":"transparent",color:tab===v?"#FFFFFF":"#64748B",borderRadius:6,fontSize:12}} onClick={()=>setTab(v)}>{l}</button>
          ))}
        </div>
      </PageHeader>

      {/* AI EXTRACT TAB */}
      {tab==="ai"&&(
        <div>
          <div style={S.card({padding:28,marginBottom:20})}>
            <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
              <div style={{width:48,height:48,background:"#EEF2FF",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic d={I.robot} size={24} c="#1D4ED8"/></div>
              <div style={{flex:1}}>
                <h3 style={{fontFamily:"'Sora',sans-serif",fontSize:16,fontWeight:700,color:"#0F172A",margin:"0 0 6px"}}>AI-Powered Data Extraction</h3>
                <p style={{fontSize:13,color:"#64748B",margin:"0 0 16px",lineHeight:1.6}}>Drop in a PDF, image, business card scan, email chain, or any document. Claude reads it and extracts contacts and companies automatically — then you review before importing.</p>
                <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                  <button style={S.btnPrimary} onClick={()=>fileRef.current?.click()}><Ic d={I.upload} size={14}/>
                    {file?file.name:"Upload File (PDF, Image, Text)"}
                  </button>
                  <input ref={fileRef} type="file" style={{display:"none"}} onChange={handleAIFile} accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.json,.eml"/>
                  <div>
                    <label style={{...S.label,display:"inline"}}>Source: </label>
                    <select value={importSource} onChange={e=>setImportSource(e.target.value)} style={{...S.select,width:"auto",display:"inline-block",marginLeft:6}}>
                      {SOURCES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  {file&&<button style={{...S.btnPrimary,background:loading?"#94A3B8":"#7C3AED"}} onClick={runAIExtract} disabled={loading}>
                    <Ic d={I.brain} size={14}/>{loading?"Analyzing...":"Extract with AI"}
                  </button>}
                </div>
              </div>
            </div>
          </div>
          {loading&&<div style={{...S.card({padding:40}),textAlign:"center"}}><div style={{fontSize:14,color:"#64748B"}}>🤖 Claude is reading your document...</div></div>}
          {extracted&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div style={{fontSize:15,fontWeight:700,color:"#0F172A"}}>Extracted {(extracted.contacts||[]).length} contacts, {(extracted.companies||[]).length} companies</div>
                <div style={{display:"flex",gap:8}}>
                  <button style={S.btnSecondary} onClick={()=>{const s={};(extracted.contacts||[]).forEach((_,i)=>s[`c_${i}`]=false);(extracted.companies||[]).forEach((_,i)=>s[`co_${i}`]=false);setSelected(s);}}>Deselect All</button>
                  <button style={S.btnPrimary} onClick={importAIData}><Ic d={I.import} size={14}/>Import Selected</button>
                </div>
              </div>
              {(extracted.contacts||[]).length>0&&(
                <div style={S.card({padding:20,marginBottom:16})}>
                  <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>Contacts</div>
                  {extracted.contacts.map((c,i)=>{
                    const isDup=c.email&&contacts.some(ex=>ex.email?.toLowerCase()===c.email?.toLowerCase()&&ex.entityId===activeEntityId);
                    return(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:isDup?"#FFF7ED":selected[`c_${i}`]?"#EFF6FF":"#F8FAFC",borderRadius:8,marginBottom:8,border:`1px solid ${isDup?"#FED7AA":selected[`c_${i}`]?"#BFDBFE":"#E9EEF6"}`}}>
                        <input type="checkbox" checked={!isDup&&!!selected[`c_${i}`]} disabled={isDup} onChange={e=>setSelected(p=>({...p,[`c_${i}`]:e.target.checked}))} style={{cursor:isDup?"not-allowed":"pointer",accentColor:"#1D4ED8",width:16,height:16}}/>
                        <Avatar name={c.name||"?"} size={32}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{c.name||"—"}</div>
                          <div style={{fontSize:11,color:"#64748B"}}>{c.email} {c.phone&&`· ${c.phone}`} {c.title&&`· ${c.title}`}</div>
                          {c.companyName&&<div style={{fontSize:11,color:"#64748B"}}>{c.companyName}</div>}
                        </div>
                        {isDup&&<span style={S.badge("#F59E0B")}>Duplicate</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {(extracted.companies||[]).length>0&&(
                <div style={S.card({padding:20})}>
                  <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>Companies</div>
                  {extracted.companies.map((co,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:selected[`co_${i}`]?"#EFF6FF":"#F8FAFC",borderRadius:8,marginBottom:8,border:`1px solid ${selected[`co_${i}`]?"#BFDBFE":"#E9EEF6"}`}}>
                      <input type="checkbox" checked={!!selected[`co_${i}`]} onChange={e=>setSelected(p=>({...p,[`co_${i}`]:e.target.checked}))} style={{cursor:"pointer",accentColor:"#1D4ED8",width:16,height:16}}/>
                      <div style={{width:36,height:36,background:"#EEF2FF",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#1D4ED8"}}>{(co.name||"?")[0]}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{co.name||"—"}</div>
                        <div style={{fontSize:11,color:"#64748B"}}>{co.industry} {co.website&&`· ${co.website}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CSV TAB */}
      {tab==="csv"&&(
        <div>
          <div style={S.card({padding:28,marginBottom:20})}>
            <h3 style={{fontFamily:"'Sora',sans-serif",fontSize:16,fontWeight:700,color:"#0F172A",margin:"0 0 6px"}}>CSV Import — HubSpot, Zoho & Generic</h3>
            <p style={{fontSize:13,color:"#64748B",margin:"0 0 16px",lineHeight:1.6}}>Export contacts from HubSpot or Zoho as CSV. Column headers are auto-detected — review the mapping below before importing.</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button style={S.btnPrimary} onClick={()=>csvRef.current?.click()}><Ic d={I.upload} size={14}/>{file?file.name:"Upload CSV File"}</button>
              <input ref={csvRef} type="file" style={{display:"none"}} onChange={handleCSVFile} accept=".csv"/>
              <div>
                <label style={{...S.label,display:"inline"}}>Import as source: </label>
                <select value={importSource} onChange={e=>setImportSource(e.target.value)} style={{...S.select,width:"auto",display:"inline-block",marginLeft:6}}>
                  {SOURCES.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>
          {csvHeaders.length>0&&(
            <div>
              <div style={S.card({padding:20,marginBottom:20})}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>Column Mapping ({csvRows.length} rows detected)</div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={S.badge(csvType==="deal"?"#10B981":csvType==="company"?"#7C3AED":"#1D4ED8")}>
                      Detected: {csvType==="deal"?"Deals":csvType==="company"?"Companies":"Contacts"}
                    </span>
                    <div style={{display:"flex",gap:0,background:"#E2E8F0",padding:3,borderRadius:8}}>
                      {[["contact","Contacts"],["company","Companies"],["deal","Deals"]].map(([v,l])=>(
                        <button key={v} onClick={()=>{setCsvType(v);setCsvMapping({});}} style={{...S.btnGhost,padding:"4px 10px",background:csvType===v?"#1D4ED8":"transparent",color:csvType===v?"#FFFFFF":"#64748B",borderRadius:6,fontSize:11,fontWeight:600}}>{l}</button>
                      ))}
                    </div>
                  </div>
                </div>
                {csvType==="contact"&&(()=>{
                  const firstHdr=Object.entries(csvMapping).find(([,v])=>v==="firstName")?.[0];
                  const lastHdr=Object.entries(csvMapping).find(([,v])=>v==="lastName")?.[0];
                  if(!firstHdr&&!lastHdr)return null;
                  const sample=csvRows[0]||{};
                  const fv=firstHdr?sample[firstHdr]:"";const lv=lastHdr?sample[lastHdr]:"";
                  const combined=[fv,lv].filter(Boolean).join(" ")||"John Smith";
                  return(
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,marginBottom:14,fontSize:12,color:"#1E3A8A"}}>
                      <Ic d={I.users} size={14} c="#1D4ED8"/>
                      <span><strong>{firstHdr||"First Name"}</strong>{firstHdr&&lastHdr?" + ":""}{lastHdr?<strong>{lastHdr}</strong>:null} will be combined into the <code style={{background:"#DBEAFE",padding:"1px 5px",borderRadius:3,fontFamily:"monospace"}}>name</code> field {csvRows[0]&&<>· e.g. <strong>"{combined}"</strong></>}</span>
                    </div>
                  );
                })()}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {csvHeaders.slice(0,16).map(h=>{
                    const target=csvMapping[h];
                    const isCombined=target==="firstName"||target==="lastName";
                    return(
                      <div key={h} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{fontSize:12,color:"#64748B",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={h}>{h}</div>
                        <Ic d={I.arrow} size={14} c={isCombined?"#1D4ED8":"#CBD5E1"}/>
                        <select value={target||""} onChange={e=>setCsvMapping(p=>({...p,[h]:e.target.value}))} style={{...S.select,width:160,fontSize:12,...(isCombined?{borderColor:"#1D4ED8",color:"#1E3A8A",fontWeight:600}:{})}}>
                          <option value="">Skip</option>
                          {fieldsForType(csvType).map(f=><option key={f} value={f}>{labelsForType(csvType)[f]||f}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={S.card({overflow:"hidden",marginBottom:16})}>
                <div style={{padding:"12px 16px",borderBottom:"1px solid #E9EEF6",fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",display:"flex",justifyContent:"space-between"}}>
                  <span>Preview (first 5 rows)</span>
                  <span>{csvRows.length} total rows</span>
                </div>
                <div style={{overflowX:"auto"}}>
                  {(()=>{
                    const firstHdr=csvType==="contact"?Object.entries(csvMapping).find(([,v])=>v==="firstName")?.[0]:null;
                    const lastHdr=csvType==="contact"?Object.entries(csvMapping).find(([,v])=>v==="lastName")?.[0]:null;
                    const showCombined=!!(firstHdr||lastHdr);
                    return(
                      <table style={{width:"100%",borderCollapse:"collapse"}}>
                        <thead><tr>
                          {showCombined&&<th style={{...S.th,background:"#EFF6FF",color:"#1E3A8A"}}>combined name<span style={{color:"#1D4ED8",marginLeft:4}}>→ name</span></th>}
                          {csvHeaders.slice(0,6).map(h=><th key={h} style={S.th}>{h}{csvMapping[h]&&<span style={{color:"#10B981",marginLeft:4}}>→{labelsForType(csvType)[csvMapping[h]]||csvMapping[h]}</span>}</th>)}
                        </tr></thead>
                        <tbody>{csvRows.slice(0,5).map((row,i)=>{
                          const combined=[firstHdr?row[firstHdr]:"",lastHdr?row[lastHdr]:""].filter(Boolean).join(" ");
                          return(
                            <tr key={i}>
                              {showCombined&&<td style={{...S.td,background:"#F8FAFC",color:"#0F172A",fontWeight:600}}>{combined||"—"}</td>}
                              {csvHeaders.slice(0,6).map(h=><td key={h} style={S.td}>{row[h]||"—"}</td>)}
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                <button style={S.btnSecondary} onClick={()=>{setCsvRows([]);setCsvHeaders([]);setFile(null);}}>Cancel</button>
                <button style={S.btnPrimary} onClick={importCSVData}><Ic d={I.import} size={14}/>Import {csvRows.length} {csvType==="deal"?(csvRows.length===1?"Deal":"Deals"):csvType==="company"?(csvRows.length===1?"Company":"Companies"):(csvRows.length===1?"Contact":"Contacts")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// SEQUENCES VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function SequencesView({sequences,templates,enrollments,contacts,activeEntityId,addSequence,updateSequence,deleteSequence,addTemplate,updateTemplate,deleteTemplate,showToast}){
  const [editingTmpl,setEditingTmpl]=useState(null);
  const [tmplForm,setTmplForm]=useState({name:"",subject:"",body:"",tags:""});
  const startEdit=(t)=>{setEditingTmpl(t.id);setTmplForm({name:t.name,subject:t.subject,body:t.body,tags:(t.tags||[]).join(", ")});};
  const saveEdit=()=>{
    if(!tmplForm.name){showToast?.("Template name required","error");return;}
    updateTemplate?.(editingTmpl,{...tmplForm,tags:tmplForm.tags.split(",").map(t=>t.trim()).filter(Boolean)});
    setEditingTmpl(null);
    showToast?.("Template updated");
  };
  const [tab,setTab]=useState("sequences");
  const [editSeq,setEditSeq]=useState(null);
  const [newSeq,setNewSeq]=useState({name:"",steps:[]});
  const [newTmpl,setNewTmpl]=useState({name:"",subject:"",body:"",tags:""});
  const [showNewSeq,setShowNewSeq]=useState(false);
  const [showNewTmpl,setShowNewTmpl]=useState(false);

  const eSeq=sequences.filter(s=>s.entityId===activeEntityId);
  const eTmpl=templates.filter(t=>t.entityId===activeEntityId);

  const addStep=()=>setNewSeq(s=>({...s,steps:[...s.steps,{id:uid(),delay:s.steps.length===0?0:3,subject:"",body:""}]}));
  const updateStep=(idx,field,val)=>setNewSeq(s=>({...s,steps:s.steps.map((st,i)=>i===idx?{...st,[field]:val}:st)}));
  const removeStep=(idx)=>setNewSeq(s=>({...s,steps:s.steps.filter((_,i)=>i!==idx)}));

  return(
    <div>
      <PageHeader title="Sequences & Templates" sub="Automate multi-step outreach and reuse email content">
        <div style={{display:"flex",gap:4,background:"#E2E8F0",padding:3,borderRadius:8}}>
          {[["sequences","Sequences"],["templates","Templates"]].map(([v,l])=>(
            <button key={v} style={{...S.btnGhost,padding:"5px 14px",background:tab===v?"#1D4ED8":"transparent",color:tab===v?"#FFFFFF":"#64748B",borderRadius:6,fontSize:12}} onClick={()=>setTab(v)}>{l}</button>
          ))}
        </div>
        {tab==="sequences"&&<button style={S.btnPrimary} onClick={()=>setShowNewSeq(true)}><Ic d={I.plus} size={14}/>New Sequence</button>}
        {tab==="templates"&&<button style={S.btnPrimary} onClick={()=>setShowNewTmpl(true)}><Ic d={I.plus} size={14}/>New Template</button>}
      </PageHeader>

      {/* SEQUENCES */}
      {tab==="sequences"&&(
        <div>
          {showNewSeq&&(
            <div style={S.card({padding:24,marginBottom:20,border:"2px solid #BFDBFE"})}>
              <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700,color:"#0F172A"}}>New Sequence</h3>
              <Field label="Sequence Name"><input style={S.input} value={newSeq.name} onChange={e=>setNewSeq(s=>({...s,name:e.target.value}))} placeholder="e.g. New Lead Nurture"/></Field>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Steps ({newSeq.steps.length})</div>
                {newSeq.steps.map((step,i)=>(
                  <div key={step.id} style={{background:"#F8FAFC",borderRadius:8,padding:14,marginBottom:8,border:"1px solid #E9EEF6"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:24,height:24,background:"#1D4ED8",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"}}>{i+1}</div>
                        <div style={{fontSize:12,color:"#64748B"}}>
                          {i===0?"Immediately":"Day "}
                          {i>0&&<input type="number" value={step.delay} onChange={e=>updateStep(i,"delay",+e.target.value)} style={{...S.input,width:50,display:"inline",padding:"2px 6px",marginLeft:4}} min={1}/>}
                          {i>0&&" after enrollment"}
                        </div>
                      </div>
                      <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>removeStep(i)}><Ic d={I.x} size={13}/></button>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                      <input style={S.input} placeholder="Subject line" value={step.subject} onChange={e=>updateStep(i,"subject",e.target.value)}/>
                      <textarea style={{...S.textarea,minHeight:70}} placeholder="Email body — use {{name}}, {{sender}}, {{date}}" value={step.body} onChange={e=>updateStep(i,"body",e.target.value)}/>
                    </div>
                  </div>
                ))}
                <button style={{...S.btnSecondary,marginTop:4}} onClick={addStep}><Ic d={I.plus} size={13}/>Add Step</button>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                <button style={S.btnSecondary} onClick={()=>{setShowNewSeq(false);setNewSeq({name:"",steps:[]});}}>Cancel</button>
                <button style={S.btnPrimary} onClick={()=>{if(!newSeq.name||newSeq.steps.length===0){showToast("Add a name and at least one step","error");return;}addSequence(newSeq);setShowNewSeq(false);setNewSeq({name:"",steps:[]});showToast("Sequence created!");}}>Save Sequence</button>
              </div>
            </div>
          )}
          {eSeq.length===0&&!showNewSeq&&<div style={{...S.card({padding:48}),textAlign:"center",color:"#475569"}}>No sequences yet. Create your first outreach sequence.</div>}
          {eSeq.map(seq=>{
            const enrCount=enrollments.filter(e=>e.sequenceId===seq.id).length;
            return(
              <div key={seq.id} style={S.card({padding:20,marginBottom:12})}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:"#0F172A",marginBottom:4}}>{seq.name}</div>
                    <div style={{display:"flex",gap:8}}>
                      <span style={S.badge("#1D4ED8")}>{seq.steps.length} steps</span>
                      <span style={S.badge("#10B981")}>{enrCount} enrolled</span>
                      <span style={S.badge(seq.active?"#10B981":"#64748B")}>{seq.active?"Active":"Paused"}</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button style={S.btnSecondary} onClick={()=>updateSequence(seq.id,{active:!seq.active})}>{seq.active?"Pause":"Activate"}</button>
                    <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>{if(confirm("Delete sequence?"))deleteSequence(seq.id);}}><Ic d={I.trash} size={14}/></button>
                  </div>
                </div>
                <div style={{display:"flex",gap:0,position:"relative"}}>
                  {seq.steps.map((step,i)=>(
                    <div key={step.id} style={{flex:1,position:"relative"}}>
                      <div style={{background:"#F1F5F9",borderRadius:8,padding:10,marginRight:i<seq.steps.length-1?8:0,border:"1px solid #E9EEF6"}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#64748B",marginBottom:4}}>Step {i+1} {i>0?`· Day ${step.delay}`:"· Immediately"}</div>
                        <div style={{fontSize:12,fontWeight:600,color:"#0F172A",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{step.subject||"(no subject)"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TEMPLATES */}
      {tab==="templates"&&(
        <div>
          {showNewTmpl&&(
            <div style={S.card({padding:24,marginBottom:20,border:"2px solid #BFDBFE"})}>
              <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700,color:"#0F172A"}}>New Template</h3>
              <Field label="Template Name"><input style={S.input} value={newTmpl.name} onChange={e=>setNewTmpl(t=>({...t,name:e.target.value}))} placeholder="e.g. Introduction Email"/></Field>
              <Field label="Subject Line"><input style={S.input} value={newTmpl.subject} onChange={e=>setNewTmpl(t=>({...t,subject:e.target.value}))} placeholder="Use {{name}}, {{date}} as variables"/></Field>
              <Field label="Body"><textarea style={{...S.textarea,minHeight:140}} value={newTmpl.body} onChange={e=>setNewTmpl(t=>({...t,body:e.target.value}))} placeholder="Use {{name}}, {{sender}}, {{company}} as variables"/></Field>
              <Field label="Tags (comma-separated)"><input style={S.input} value={newTmpl.tags} onChange={e=>setNewTmpl(t=>({...t,tags:e.target.value}))} placeholder="outreach, follow-up, proposal"/></Field>
              <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
                <button style={S.btnSecondary} onClick={()=>{setShowNewTmpl(false);setNewTmpl({name:"",subject:"",body:"",tags:""});}}>Cancel</button>
                <button style={S.btnPrimary} onClick={()=>{if(!newTmpl.name){showToast("Template name required","error");return;}addTemplate({...newTmpl,tags:newTmpl.tags.split(",").map(t=>t.trim()).filter(Boolean)});setShowNewTmpl(false);setNewTmpl({name:"",subject:"",body:"",tags:""});showToast("Template saved!");}}>Save Template</button>
              </div>
            </div>
          )}
          {eTmpl.length===0&&!showNewTmpl&&<div style={{...S.card({padding:48}),textAlign:"center",color:"#475569"}}>No templates yet. Create reusable email templates.</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
            {eTmpl.map(tmpl=>(
              <div key={tmpl.id} style={S.card({padding:20})}>
                {editingTmpl===tmpl.id?(
                  <div>
                    <Field label="Name"><input style={S.input} value={tmplForm.name} onChange={e=>setTmplForm({...tmplForm,name:e.target.value})}/></Field>
                    <Field label="Subject"><input style={S.input} value={tmplForm.subject} onChange={e=>setTmplForm({...tmplForm,subject:e.target.value})}/></Field>
                    <Field label="Body"><textarea style={S.textarea} rows={6} value={tmplForm.body} onChange={e=>setTmplForm({...tmplForm,body:e.target.value})}/></Field>
                    <Field label="Tags (comma-separated)"><input style={S.input} value={tmplForm.tags} onChange={e=>setTmplForm({...tmplForm,tags:e.target.value})}/></Field>
                    <div style={{display:"flex",justifyContent:"flex-end",gap:6}}>
                      <button style={S.btnSecondary} onClick={()=>setEditingTmpl(null)}>Cancel</button>
                      <button style={S.btnPrimary} onClick={saveEdit}>Save changes</button>
                    </div>
                  </div>
                ):(<>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#0F172A"}}>{tmpl.name}</div>
                  <div style={{display:"flex",gap:4}}>
                    <button style={S.btnGhost} title="Edit template" onClick={()=>startEdit(tmpl)}><Ic d={I.edit} size={13}/></button>
                    <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>deleteTemplate(tmpl.id)}><Ic d={I.trash} size={13}/></button>
                  </div>
                </div>
                <div style={{fontSize:12,fontWeight:600,color:"#1D4ED8",marginBottom:6}}>{tmpl.subject}</div>
                <div style={{fontSize:12,color:"#475569",lineHeight:1.5,maxHeight:60,overflow:"hidden",borderBottom:"1px solid #E9EEF6",paddingBottom:10,marginBottom:10}}>{tmpl.body.slice(0,120)}{tmpl.body.length>120&&"..."}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {(tmpl.tags||[]).map(tag=><span key={tag} style={S.badge("#8B5CF6")}>{tag}</span>)}
                </div></>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMS VIEW (Web-to-Lead)
// ═══════════════════════════════════════════════════════════════════════════════
function FormsView({forms,activeEntityId,addForm,updateForm,deleteForm,showToast,addContact,addNote}){
  const [showNew,setShowNew]=useState(false);
  const [selectedForm,setSelectedForm]=useState(null);
  const [newForm,setNewForm]=useState({name:"",fields:[{name:"name",label:"Full Name",type:"text",required:true},{name:"email",label:"Email",type:"email",required:true},{name:"phone",label:"Phone",type:"text",required:false},{name:"company",label:"Company",type:"text",required:false},{name:"message",label:"Message",type:"textarea",required:false}]});
  const eForms=forms.filter(f=>f.entityId===activeEntityId);

  const generateEmbed=(form)=>{
    return `<!-- NexCRM Web-to-Lead Form: ${form.name} -->
<form id="nexcrm-form-${form.id}" style="font-family:sans-serif;max-width:480px">
${form.fields.filter(f=>f.enabled!==false).map(f=>`  <div style="margin-bottom:14px">
    <label style="display:block;font-size:13px;font-weight:600;margin-bottom:4px">${f.label}${f.required?' *':''}</label>
    ${f.type==='textarea'?`<textarea name="${f.name}" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:6px" rows="4"${f.required?' required':''}></textarea>`:`<input type="${f.type}" name="${f.name}" style="width:100%;padding:8px;border:1px solid #CBD5E1;border-radius:6px"${f.required?' required':''}>`}
  </div>`).join('\n')}
  <button type="submit" style="background:#1D4ED8;color:#fff;padding:10px 20px;border:none;border-radius:6px;cursor:pointer">Submit</button>
</form>
<script>
document.getElementById('nexcrm-form-${form.id}').onsubmit=function(e){
  e.preventDefault();
  const data=Object.fromEntries(new FormData(e.target));
  fetch('https://nexcrm.app/api/forms/${form.id}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
};
</script>`;
  };

  const copyEmbed=(form)=>{navigator.clipboard?.writeText(generateEmbed(form)).catch(()=>{});showToast("Embed code copied to clipboard!");};

  const simulateSubmission=(form)=>{
    const testData={name:"Test Lead",email:"test@example.com",phone:"+1 555-0199",company:"Test Corp",message:"Interested in your services"};
    addContact({name:testData.name,email:testData.email,phone:testData.phone,companyName:testData.company,source:"Website",title:""});
    showToast("Test submission processed — check Contacts!");
  };

  return(
    <div>
      <PageHeader title="Web-to-Lead Forms" sub="Embed forms on your website to capture leads directly into NexCRM">
        <button style={S.btnPrimary} onClick={()=>setShowNew(true)}><Ic d={I.plus} size={14}/>New Form</button>
      </PageHeader>
      {showNew&&(
        <div style={S.card({padding:24,marginBottom:20,border:"2px solid #BFDBFE"})}>
          <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700,color:"#0F172A"}}>New Form</h3>
          <Field label="Form Name"><input style={S.input} value={newForm.name} onChange={e=>setNewForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Contact Us, Get a Demo"/></Field>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Fields</div>
            {newForm.fields.map((f,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <input type="checkbox" checked={f.enabled!==false} onChange={e=>setNewForm(frm=>({...frm,fields:frm.fields.map((ff,j)=>j===i?{...ff,enabled:e.target.checked}:ff)}))} style={{cursor:"pointer",accentColor:"#1D4ED8",width:16,height:16}}/>
                <input style={{...S.input,flex:1}} value={f.label} onChange={e=>setNewForm(frm=>({...frm,fields:frm.fields.map((ff,j)=>j===i?{...ff,label:e.target.value}:ff)}))}/>
                <span style={{fontSize:12,color:"#64748B",whiteSpace:"nowrap"}}>{f.type}</span>
                <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"#64748B",cursor:"pointer"}}>
                  <input type="checkbox" checked={f.required} onChange={e=>setNewForm(frm=>({...frm,fields:frm.fields.map((ff,j)=>j===i?{...ff,required:e.target.checked}:ff)}))} style={{cursor:"pointer",accentColor:"#1D4ED8"}}/>Required
                </label>
              </div>
            ))}
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
            <button style={S.btnSecondary} onClick={()=>setShowNew(false)}>Cancel</button>
            <button style={S.btnPrimary} onClick={()=>{if(!newForm.name){showToast("Form name required","error");return;}addForm({...newForm,submissions:[],active:true,createdAt:new Date().toISOString()});setShowNew(false);showToast("Form created!");}}>Create Form</button>
          </div>
        </div>
      )}
      {eForms.length===0&&!showNew&&<div style={{...S.card({padding:48}),textAlign:"center",color:"#475569"}}>No forms yet. Create your first web-to-lead form.</div>}
      {eForms.map(form=>(
        <div key={form.id} style={S.card({padding:20,marginBottom:14})}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#0F172A",marginBottom:4}}>{form.name}</div>
              <div style={{display:"flex",gap:8}}>
                <span style={S.badge("#1D4ED8")}>{(form.fields||[]).filter(f=>f.enabled!==false).length} fields</span>
                <span style={S.badge("#10B981")}>{(form.submissions||[]).length} submissions</span>
                <span style={S.badge(form.active?"#10B981":"#64748B")}>{form.active?"Active":"Inactive"}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button style={S.btnSecondary} onClick={()=>simulateSubmission(form)}><Ic d={I.zap} size={13}/>Test Submit</button>
              <button style={S.btnPrimary} onClick={()=>setSelectedForm(selectedForm===form.id?null:form.id)}><Ic d={I.copy} size={13}/>{selectedForm===form.id?"Hide":"Get Embed"}</button>
              <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>{if(confirm("Delete form?"))deleteForm(form.id);}}><Ic d={I.trash} size={14}/></button>
            </div>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
            {(form.fields||[]).filter(f=>f.enabled!==false).map((f,i)=><span key={i} style={S.badge(f.required?"#1D4ED8":"#64748B")}>{f.label}{f.required?" *":""}</span>)}
          </div>
          {selectedForm===form.id&&(
            <div style={{marginTop:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5}}>Embed Code</div>
                <button style={S.btnSecondary} onClick={()=>copyEmbed(form)}><Ic d={I.copy} size={13}/>Copy Code</button>
              </div>
              <pre style={{background:"#F1F5F9",borderRadius:8,padding:14,fontSize:11,color:"#334155",overflow:"auto",maxHeight:200,border:"1px solid #E9EEF6",lineHeight:1.5}}>{generateEmbed(form)}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// AUTOMATION VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function AutomationView({automations,activeEntityId,addAutomation,updateAutomation,deleteAutomation,showToast}){
  const [showNew,setShowNew]=useState(false);
  const [form,setForm]=useState({name:"",trigger:"new_contact",action:"create_task",actionData:{title:"",priority:"medium",daysOut:1}});
  const eAuto=automations.filter(a=>a.entityId===activeEntityId);

  return(
    <div>
      <PageHeader title="Workflow Automation" sub="Trigger automatic actions when events happen in your CRM">
        <button style={S.btnPrimary} onClick={()=>setShowNew(true)}><Ic d={I.plus} size={14}/>New Automation</button>
      </PageHeader>
      <div style={{...S.card({padding:16}),marginBottom:20,background:"#EFF6FF",border:"1px solid #BFDBFE"}}>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <Ic d={I.zap} size={18} c="#1D4ED8"/>
          <div style={{fontSize:13,color:"#1D4ED8"}}>Automations run automatically when the trigger condition is met. They create tasks, log notes, or enroll contacts in sequences — saving you manual work.</div>
        </div>
      </div>
      {showNew&&(
        <div style={S.card({padding:24,marginBottom:20,border:"2px solid #BFDBFE"})}>
          <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700,color:"#0F172A"}}>New Automation Rule</h3>
          <Field label="Automation Name"><input style={S.input} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Welcome new leads"/></Field>
          <div style={S.grid2}>
            <Field label="When (Trigger)">
              <select style={S.select} value={form.trigger} onChange={e=>setForm(f=>({...f,trigger:e.target.value}))}>
                {Object.entries(TRIGGER_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Then (Action)">
              <select style={S.select} value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}>
                {Object.entries(ACTION_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
          </div>
          {form.action==="create_task"&&(
            <div style={{background:"#F8FAFC",borderRadius:8,padding:14,border:"1px solid #E9EEF6"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#64748B",marginBottom:10}}>Task Details</div>
              <div style={S.grid2}>
                <Field label="Task Title"><input style={S.input} value={form.actionData.title||""} onChange={e=>setForm(f=>({...f,actionData:{...f.actionData,title:e.target.value}}))}/></Field>
                <Field label="Due in (days)"><input type="number" style={S.input} min={0} value={form.actionData.daysOut||1} onChange={e=>setForm(f=>({...f,actionData:{...f.actionData,daysOut:+e.target.value}}))}/></Field>
              </div>
              <Field label="Priority">
                <select style={S.select} value={form.actionData.priority||"medium"} onChange={e=>setForm(f=>({...f,actionData:{...f.actionData,priority:e.target.value}}))}>
                  {PRIORITIES.map(p=><option key={p}>{p}</option>)}
                </select>
              </Field>
            </div>
          )}
          {form.action==="add_note"&&(
            <Field label="Note Content"><textarea style={{...S.textarea,minHeight:80}} value={form.actionData.content||""} onChange={e=>setForm(f=>({...f,actionData:{...f.actionData,content:e.target.value}}))}/></Field>
          )}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button style={S.btnSecondary} onClick={()=>setShowNew(false)}>Cancel</button>
            <button style={S.btnPrimary} onClick={()=>{if(!form.name){showToast("Name required","error");return;}addAutomation({...form,active:true});setShowNew(false);showToast("Automation created!");}}>Create Automation</button>
          </div>
        </div>
      )}
      {eAuto.length===0&&!showNew&&<div style={{...S.card({padding:48}),textAlign:"center",color:"#475569"}}>No automations yet. Automate your workflow!</div>}
      {eAuto.map(auto=>(
        <div key={auto.id} style={S.card({padding:18,marginBottom:10})}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:38,height:38,background:auto.active?"#EFF6FF":"#F1F5F9",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic d={I.zap} size={17} c={auto.active?"#1D4ED8":"#94A3B8"}/></div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:"#0F172A"}}>{auto.name}</div>
                <div style={{fontSize:12,color:"#64748B",marginTop:2}}>
                  <span style={S.badge("#8B5CF6")}>{TRIGGER_LABELS[auto.trigger]}</span>
                  <span style={{margin:"0 6px",color:"#CBD5E1"}}>→</span>
                  <span style={S.badge("#1D4ED8")}>{ACTION_LABELS[auto.action]}</span>
                  {auto.actionData?.title&&<span style={{marginLeft:6,fontSize:12,color:"#475569"}}>"{auto.actionData.title}"</span>}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button style={{...S.btnSecondary,fontSize:12,padding:"5px 12px"}} onClick={()=>updateAutomation(auto.id,{active:!auto.active})}>{auto.active?"Pause":"Activate"}</button>
              <span style={S.badge(auto.active?"#10B981":"#64748B")}>{auto.active?"Active":"Paused"}</span>
              <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>{if(confirm("Delete automation?"))deleteAutomation(auto.id);}}><Ic d={I.trash} size={14}/></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS VIEW (Entities, Products, Custom Fields, Email, Profile)
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsView({entities,entity,emailInts,connectEmail,disconnectEmail,openModal,setEntities,showToast,products,activeEntityId,addProduct,updateProduct,deleteProduct,customFields,addCustomField,deleteCustomField,webhooks,addWebhook,updateWebhook,deleteWebhook}){
  const [tab,setTab]=useState("entities");
  const [connecting,setConnecting]=useState(null);
  const [emailForm,setEmailForm]=useState({email:"",password:"",server:"",port:""});
  const [newProduct,setNewProduct]=useState({name:"",price:"",category:"Software",description:""});
  const [newField,setNewField]=useState({entity:"contact",name:"",type:"text",options:""});
  const [showNewProd,setShowNewProd]=useState(false);
  const [showNewField,setShowNewField]=useState(false);

  const eProducts=products.filter(p=>p.entityId===activeEntityId);
  const eFields=customFields.filter(f=>f.entityId===activeEntityId);

  const simulateOAuth=(provider)=>{connectEmail(provider,"user@"+provider+".com");setConnecting(null);showToast(`${provider} connected! (Demo mode)`);};

  return(
    <div>
      <PageHeader title="Settings" sub="Manage entities, products, fields, integrations & preferences"/>
      <div style={{display:"flex",gap:0,background:"#FFFFFF",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}>
        <div style={{width:210,borderRight:"1px solid #E9EEF6",padding:"12px 0",flexShrink:0}}>
          {[["entities","Entities"],["products","Product Catalog"],["fields","Custom Fields"],["email","Email Integration"],["webhooks","Webhooks"],["profile","Profile"]].map(([id,lbl])=>(
            <button key={id} style={{width:"100%",padding:"10px 16px",background:tab===id?"#EEF2FF":"transparent",border:"none",borderLeft:tab===id?"3px solid #1D4ED8":"3px solid transparent",color:tab===id?"#1D4ED8":"#64748B",cursor:"pointer",textAlign:"left",fontSize:13,fontWeight:tab===id?600:500}} onClick={()=>setTab(id)}>{lbl}</button>
          ))}
        </div>
        <div style={{flex:1,padding:24,overflowY:"auto"}}>

          {/* ENTITIES */}
          {tab==="entities"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div><h3 style={{margin:0,fontFamily:"'Sora',sans-serif",fontSize:16,fontWeight:700,color:"#0F172A"}}>Legal Entities</h3><p style={{margin:"4px 0 0",color:"#475569",fontSize:13}}>Each entity has completely separate contacts, deals, tasks, and notes.</p></div>
                <button style={S.btnPrimary} onClick={()=>openModal("addEntity")}><Ic d={I.plus} size={14}/>Add Entity</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {entities.map(e=>(
                  <div key={e.id} style={{background:"#F8FAFC",borderRadius:10,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,border:`1px solid ${e.id===entity?.id?"#1D4ED8":"#E2E8F0"}`}}>
                    <div style={{width:40,height:40,background:e.color+"20",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${e.color}40`}}><div style={{width:12,height:12,borderRadius:"50%",background:e.color}}/></div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,color:"#0F172A",fontSize:14}}>{e.name}</div>
                      <div style={{fontSize:12,color:"#64748B",marginTop:2}}>{e.type} · {e.industry||"General"}{e.website&&` · ${e.website}`}</div>
                    </div>
                    {e.id===entity?.id&&<span style={S.badge("#10B981")}>Active</span>}
                    <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>{if(entities.length===1)return showToast("Cannot delete last entity","error");if(confirm("Delete entity and all its data?"))setEntities(p=>p.filter(x=>x.id!==e.id));}}><Ic d={I.trash} size={14}/></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PRODUCTS */}
          {tab==="products"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div><h3 style={{margin:0,fontFamily:"'Sora',sans-serif",fontSize:16,fontWeight:700,color:"#0F172A"}}>Product & Service Catalog</h3><p style={{margin:"4px 0 0",color:"#475569",fontSize:13}}>Add your products and services to use when building quotes.</p></div>
                <button style={S.btnPrimary} onClick={()=>setShowNewProd(true)}><Ic d={I.plus} size={14}/>Add Product</button>
              </div>
              {showNewProd&&(
                <div style={{...S.card({padding:16}),marginBottom:16,border:"1px solid #BFDBFE"}}>
                  <div style={S.grid2}>
                    <Field label="Product Name"><input style={S.input} value={newProduct.name} onChange={e=>setNewProduct(p=>({...p,name:e.target.value}))}/></Field>
                    <Field label="Price (USD)"><input type="number" style={S.input} value={newProduct.price} onChange={e=>setNewProduct(p=>({...p,price:e.target.value}))}/></Field>
                    <Field label="Category">
                      <select style={S.select} value={newProduct.category} onChange={e=>setNewProduct(p=>({...p,category:e.target.value}))}>
                        {["Software","Hardware","Services","Support","Consulting","Other"].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </Field>
                    <Field label="Description"><input style={S.input} value={newProduct.description} onChange={e=>setNewProduct(p=>({...p,description:e.target.value}))}/></Field>
                  </div>
                  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
                    <button style={S.btnSecondary} onClick={()=>setShowNewProd(false)}>Cancel</button>
                    <button style={S.btnPrimary} onClick={()=>{if(!newProduct.name)return;addProduct({...newProduct,price:+newProduct.price||0});setShowNewProd(false);setNewProduct({name:"",price:"",category:"Software",description:""});showToast("Product added!");}}>Add Product</button>
                  </div>
                </div>
              )}
              <div style={S.card({overflow:"hidden"})}>
                {eProducts.length===0?<div style={{padding:40,textAlign:"center",color:"#475569"}}>No products yet.</div>:(
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>{["Product","Category","Price","Description",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>{eProducts.map((p,i)=>(
                      <tr key={p.id}>
                        <td style={{...S.td,fontWeight:600,color:"#0F172A"}}>{p.name}</td>
                        <td style={S.td}><span style={S.badge("#06B6D4")}>{p.category}</span></td>
                        <td style={{...S.td,fontWeight:700,color:"#10B981"}}>{fmt$(p.price)}</td>
                        <td style={{...S.td,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.description}</td>
                        <td style={S.td}><button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>deleteProduct(p.id)}><Ic d={I.trash} size={13}/></button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* CUSTOM FIELDS */}
          {tab==="fields"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                <div><h3 style={{margin:0,fontFamily:"'Sora',sans-serif",fontSize:16,fontWeight:700,color:"#0F172A"}}>Custom Fields</h3><p style={{margin:"4px 0 0",color:"#475569",fontSize:13}}>Add extra fields to contacts, companies, or deals.</p></div>
                <button style={S.btnPrimary} onClick={()=>setShowNewField(true)}><Ic d={I.plus} size={14}/>Add Field</button>
              </div>
              {showNewField&&(
                <div style={{...S.card({padding:16}),marginBottom:16,border:"1px solid #BFDBFE"}}>
                  <div style={S.grid2}>
                    <Field label="Applies To">
                      <select style={S.select} value={newField.entity} onChange={e=>setNewField(f=>({...f,entity:e.target.value}))}>
                        <option value="contact">Contact</option><option value="company">Company</option><option value="deal">Deal</option>
                      </select>
                    </Field>
                    <Field label="Field Name"><input style={S.input} value={newField.name} onChange={e=>setNewField(f=>({...f,name:e.target.value}))} placeholder="e.g. LinkedIn URL"/></Field>
                    <Field label="Field Type">
                      <select style={S.select} value={newField.type} onChange={e=>setNewField(f=>({...f,type:e.target.value}))}>
                        <option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Dropdown</option><option value="url">URL</option>
                      </select>
                    </Field>
                    {newField.type==="select"&&<Field label="Options (comma-separated)"><input style={S.input} value={newField.options} onChange={e=>setNewField(f=>({...f,options:e.target.value}))} placeholder="Option 1, Option 2"/></Field>}
                  </div>
                  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
                    <button style={S.btnSecondary} onClick={()=>setShowNewField(false)}>Cancel</button>
                    <button style={S.btnPrimary} onClick={()=>{if(!newField.name)return;addCustomField({...newField,options:newField.options.split(",").map(o=>o.trim()).filter(Boolean)});setShowNewField(false);setNewField({entity:"contact",name:"",type:"text",options:""});showToast("Field added!");}}>Add Field</button>
                  </div>
                </div>
              )}
              {["contact","company","deal"].map(entityType=>{
                const fields=eFields.filter(f=>f.entity===entityType);
                if(fields.length===0)return null;
                return(<div key={entityType} style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>{entityType} Fields</div>
                  {fields.map(f=>(
                    <div key={f.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#F8FAFC",borderRadius:8,marginBottom:6,border:"1px solid #E9EEF6"}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{f.name}</div>
                        <div style={{fontSize:11,color:"#64748B"}}>{f.type}{f.options?.length>0&&` · ${f.options.join(", ")}`}</div>
                      </div>
                      <span style={S.badge("#8B5CF6")}>{f.type}</span>
                      <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>deleteCustomField(f.id)}><Ic d={I.trash} size={13}/></button>
                    </div>
                  ))}
                </div>);
              })}
              {eFields.length===0&&!showNewField&&<div style={{padding:40,textAlign:"center",color:"#475569",border:"2px dashed #CBD5E1",borderRadius:10}}>No custom fields yet.</div>}
            </div>
          )}

          {/* EMAIL */}
          {tab==="email"&&(
            <div>
              <div style={{marginBottom:20}}>
                <h3 style={{margin:"0 0 4px",fontFamily:"'Sora',sans-serif",fontSize:16,fontWeight:700,color:"#0F172A"}}>Email Integration</h3>
                <p style={{margin:0,color:"#475569",fontSize:13}}>Connect Gmail, Outlook, or SMTP to send and log emails from contact profiles.</p>
              </div>
              {emailInts.length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Connected Accounts</div>
                  {emailInts.map(int=>(
                    <div key={int.id} style={{background:"#F8FAFC",borderRadius:10,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,marginBottom:8,border:"1px solid #10B98140"}}>
                      <div style={{width:36,height:36,background:EMAIL_PROVIDERS.find(p=>p.id===int.provider)?.color+"20",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:EMAIL_PROVIDERS.find(p=>p.id===int.provider)?.color,fontSize:16}}>{EMAIL_PROVIDERS.find(p=>p.id===int.provider)?.logo}</div>
                      <div style={{flex:1}}><div style={{fontWeight:600,color:"#0F172A"}}>{EMAIL_PROVIDERS.find(p=>p.id===int.provider)?.label}</div><div style={{fontSize:12,color:"#64748B"}}>{int.email} · Connected {fmtDate(int.connectedAt)}</div></div>
                      <span style={S.badge("#10B981")}><Ic d={I.ok} size={10}/>Connected</span>
                      <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>disconnectEmail(int.id)}><Ic d={I.trash} size={13}/></button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                {EMAIL_PROVIDERS.map(prov=>{
                  const connected=emailInts.some(i=>i.provider===prov.id);
                  return connected?null:(
                    <div key={prov.id} style={{background:"#F8FAFC",borderRadius:12,padding:20,textAlign:"center",border:`1px solid ${connected?"#10B98140":"#E2E8F0"}`,cursor:"pointer",flex:"1 0 150px",minWidth:140}} onClick={()=>prov.id!=="smtp"?simulateOAuth(prov.id):setConnecting("smtp")}>
                      <div style={{width:44,height:44,background:prov.color+"20",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:prov.color,fontSize:20,margin:"0 auto 10px"}}>{prov.logo}</div>
                      <div style={{fontWeight:600,color:"#0F172A",fontSize:13}}>Connect {prov.label}</div>
                    </div>
                  );
                })}
              </div>
              {connecting==="smtp"&&(
                <div style={S.card({padding:20})}>
                  <h4 style={{margin:"0 0 14px",color:"#0F172A"}}>SMTP Configuration</h4>
                  <div style={S.grid2}>
                    <Field label="Email Address"><input style={S.input} value={emailForm.email} onChange={e=>setEmailForm(f=>({...f,email:e.target.value}))}/></Field>
                    <Field label="Password / App Password"><input type="password" style={S.input} value={emailForm.password} onChange={e=>setEmailForm(f=>({...f,password:e.target.value}))}/></Field>
                    <Field label="SMTP Server"><input style={S.input} value={emailForm.server} onChange={e=>setEmailForm(f=>({...f,server:e.target.value}))} placeholder="smtp.gmail.com"/></Field>
                    <Field label="Port"><input style={S.input} value={emailForm.port} onChange={e=>setEmailForm(f=>({...f,port:e.target.value}))} placeholder="587"/></Field>
                  </div>
                  <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:4}}>
                    <button style={S.btnSecondary} onClick={()=>setConnecting(null)}>Cancel</button>
                    <button style={S.btnPrimary} onClick={()=>{if(!emailForm.email)return;connectEmail("smtp",emailForm.email);setConnecting(null);showToast("SMTP connected!");}}>Connect SMTP</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab==="webhooks"&&<WebhooksPanel webhooks={webhooks} activeEntityId={activeEntityId} addWebhook={addWebhook} updateWebhook={updateWebhook} deleteWebhook={deleteWebhook} showToast={showToast}/>}

          {/* PROFILE */}
          {tab==="profile"&&(
            <div>
              <h3 style={{margin:"0 0 16px",fontFamily:"'Sora',sans-serif",fontSize:16,fontWeight:700,color:"#0F172A"}}>Profile & Roadmap</h3>
              <div style={{background:"#F8FAFC",borderRadius:10,padding:16,border:"1px solid #E2E8F0",marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:600,color:"#0F172A",marginBottom:6}}>🚀 Current: Personal Mode</div>
                <div style={{fontSize:13,color:"#64748B",lineHeight:1.6}}>NexCRM is running in personal/demo mode. Deploy to Vercel or Netlify to access it from any device. When ready for multi-user SaaS: add user auth, 2FA, team invites, RBAC, billing, and white-labeling.</div>
              </div>
              <div style={{background:"#F8FAFC",borderRadius:10,padding:16,border:"1px solid #E2E8F0"}}>
                <div style={{fontSize:13,fontWeight:600,color:"#0F172A",marginBottom:10}}>📋 Integration Roadmap</div>
                {[["✅","AI Data Extraction (Claude API)"],["✅","HubSpot & Zoho CSV Import"],["✅","Document Storage per Contact"],["✅","Email Sequences & Templates"],["✅","Web-to-Lead Forms"],["✅","Workflow Automation"],["✅","Quote / Proposal Builder"],["✅","Forecasting"],["✅","Product Catalog"],["✅","Lead Scoring"],["✅","Custom Fields"],["🔜","Zapier / Make Webhooks"],["🔜","Calendly / Cal.com Integration"],["🔜","Slack Notifications"],["🔜","QuickBooks Invoicing"],["🔜","DocuSign eSignature"],["🔜","Twilio SMS Sequences"],["🔜","Two-way Email Sync"],].map(([icon,item])=>(
                  <div key={item} style={{display:"flex",gap:8,padding:"5px 0",fontSize:13,color:icon==="✅"?"#10B981":"#64748B",borderBottom:"1px solid #F1F5F9"}}>
                    <span>{icon}</span><span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── EMPTY STATE ──────────────────────────────────────────────────────────────
const EmptyState = ({icon,title,message,ctaLabel,ctaSecondaryLabel,onCta,onCtaSecondary})=>(
  <div style={{...S.card({padding:"56px 32px"}),textAlign:"center"}}>
    {icon&&<div style={{display:"flex",justifyContent:"center",marginBottom:14,color:"#94A3B8"}}><Ic d={icon} size={36} c="#94A3B8"/></div>}
    <div style={{fontSize:16,fontWeight:700,color:"#0F172A",marginBottom:6}}>{title}</div>
    {message&&<div style={{fontSize:13,color:"#64748B",marginBottom:20,maxWidth:420,marginLeft:"auto",marginRight:"auto",lineHeight:1.5}}>{message}</div>}
    <div style={{display:"flex",gap:8,justifyContent:"center"}}>
      {ctaLabel&&<button style={S.btnPrimary} onClick={onCta}><Ic d={I.plus} size={14}/>{ctaLabel}</button>}
      {ctaSecondaryLabel&&<button style={S.btnSecondary} onClick={onCtaSecondary}>{ctaSecondaryLabel}</button>}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// INBOX
// ═══════════════════════════════════════════════════════════════════════════════
function InboxView({emailThreads,contacts,activeEntityId,emailIntegrations,addEmailThread,addEmailMessage,setSelContact,setView,showToast}){
  const [composing,setComposing]=useState(false);
  const [form,setForm]=useState({contactId:"",subject:"",body:""});
  const eContacts=contacts.filter(c=>c.entityId===activeEntityId);
  const submit=()=>{
    if(!form.contactId||!form.subject){showToast?.("Pick a contact and add a subject","error");return;}
    addEmailThread?.({
      contactId:form.contactId,subject:form.subject,
      lastActivity:new Date().toISOString(),
      messages:[{id:`em_${Date.now()}`,from:"you@workspace.com",to:eContacts.find(c=>c.id===form.contactId)?.email||"",subject:form.subject,body:form.body,date:new Date().toISOString(),direction:"out"}],
    });
    setForm({contactId:"",subject:"",body:""});
    setComposing(false);
    showToast?.("Email logged");
  };
  return _InboxViewBody({emailThreads,contacts,activeEntityId,emailIntegrations,setSelContact,setView,composing,setComposing,form,setForm,submit,eContacts});
}
function _InboxViewBody({emailThreads,contacts,activeEntityId,emailIntegrations,setSelContact,setView,composing,setComposing,form,setForm,submit,eContacts}){
  const eThreads=(emailThreads||[]).filter(t=>t.entityId===activeEntityId);
  const noIntegration=(emailIntegrations||[]).length===0;
  if(eThreads.length===0){
    return(
      <div>
        <PageHeader title="Inbox" sub="Email conversations with your contacts"/>
        {noIntegration?(
          <EmptyState
            icon={I.mail}
            title="Connect your email to get started"
            message="Link Gmail, Outlook, or any SMTP account to send and receive messages directly inside NexCRM. Once connected, conversations with your contacts will appear here."
            ctaLabel="Connect email"
            onCta={()=>setView("settings")}
          />
        ):(
          <EmptyState
            icon={I.inbox}
            title="No conversations yet"
            message="Open a contact's profile to send your first email. Replies and follow-ups will land here."
            ctaLabel="Browse contacts"
            onCta={()=>setView("contacts")}
          />
        )}
      </div>
    );
  }
  return(
    <div>
      <PageHeader title="Inbox" sub={`${eThreads.length} conversation${eThreads.length===1?"":"s"}`}>
        {!composing&&<button style={S.btnPrimary} onClick={()=>setComposing(true)}><Ic d={I.plus} size={14}/>Log email</button>}
      </PageHeader>
      {composing&&(
        <div style={{...S.card({padding:18}),marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:12}}>Log a new email</div>
          <div style={S.grid2}>
            <Field label="Contact"><select style={S.select} value={form.contactId} onChange={e=>setForm({...form,contactId:e.target.value})}><option value="">Select contact…</option>{eContacts.map(c=><option key={c.id} value={c.id}>{c.name}{c.email?` — ${c.email}`:""}</option>)}</select></Field>
            <Field label="Subject"><input style={S.input} placeholder="Re: Discovery call follow-up" value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></Field>
          </div>
          <Field label="Message"><textarea style={S.textarea} rows={4} placeholder="Body of the email you sent…" value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></Field>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:6}}>
            <button style={S.btnSecondary} onClick={()=>setComposing(false)}>Cancel</button>
            <button style={S.btnPrimary} onClick={submit}>Save email</button>
          </div>
        </div>
      )}
      <div style={S.card({overflow:"hidden"})}>
        {eThreads.sort((a,b)=>new Date(b.lastActivity||0)-new Date(a.lastActivity||0)).map(t=>{
          const c=contacts.find(x=>x.id===t.contactId);
          const lastMsg=t.messages?.[t.messages.length-1];
          return(
            <div key={t.id} style={{padding:"14px 18px",borderBottom:"1px solid #E9EEF6",cursor:"pointer",display:"flex",alignItems:"center",gap:12}}
              onClick={()=>{setSelContact(t.contactId);setView("contacts");}}>
              <Avatar name={c?.name||"?"} size={32}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>{c?.name||"Unknown contact"}</div>
                <div style={{fontSize:12,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.subject||lastMsg?.subject||"(no subject)"}</div>
              </div>
              <div style={{fontSize:11,color:"#94A3B8",flexShrink:0}}>{fmtTime(t.lastActivity)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME TRACKING
// ═══════════════════════════════════════════════════════════════════════════════
function TimeView({timeEntries,contacts,deals,activeEntityId,addTimeEntry,updateTimeEntry,deleteTimeEntry,showToast}){
  const [editingId,setEditingId]=useState(null);
  const [editForm,setEditForm]=useState({});
  const startEdit=(e)=>{setEditingId(e.id);setEditForm({description:e.description||"",hours:e.hours||"",rate:e.rate||"",date:e.date||"",contactId:e.contactId||""});};
  const saveEdit=()=>{
    if(!editForm.description||!editForm.hours){showToast?.("Description and hours are required","error");return;}
    updateTimeEntry?.(editingId,{description:editForm.description,hours:+editForm.hours,rate:+editForm.rate||0,date:editForm.date,contactId:editForm.contactId||null});
    setEditingId(null);
    showToast?.("Entry updated");
  };
  const eEntries=(timeEntries||[]).filter(e=>e.entityId===activeEntityId);
  const eContacts=contacts.filter(c=>c.entityId===activeEntityId);
  const eDeals=deals.filter(d=>d.entityId===activeEntityId);
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({description:"",hours:"",date:new Date().toISOString().slice(0,10),contactId:"",dealId:"",rate:""});
  const totalHours=eEntries.reduce((s,e)=>s+(+e.hours||0),0);
  const billableTotal=eEntries.reduce((s,e)=>s+((+e.hours||0)*(+e.rate||0)),0);
  const submit=()=>{
    if(!form.description||!form.hours){showToast?.("Description and hours are required","error");return;}
    addTimeEntry({entityId:activeEntityId,description:form.description,hours:+form.hours,rate:+form.rate||0,date:form.date,contactId:form.contactId||null,dealId:form.dealId||null,createdAt:new Date().toISOString()});
    setForm({description:"",hours:"",date:new Date().toISOString().slice(0,10),contactId:"",dealId:"",rate:""});
    setAdding(false);
    showToast?.("Time entry logged");
  };
  return(
    <div>
      <PageHeader title="Time Tracking" sub={eEntries.length===0?"Log billable hours against contacts and deals":`${eEntries.length} entries · ${fmtHours(totalHours)} · ${fmt$(billableTotal)} billable`}>
        {eEntries.length>0&&!adding&&<button style={S.btnPrimary} onClick={()=>setAdding(true)}><Ic d={I.plus} size={14}/>Log time</button>}
      </PageHeader>
      {adding&&(
        <div style={{...S.card({padding:18}),marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:12}}>Log a time entry</div>
          <Field label="Description"><input style={S.input} placeholder="e.g. Discovery call with client" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field>
          <div style={S.grid2}>
            <Field label="Hours"><input style={S.input} type="number" step="0.25" placeholder="1.5" value={form.hours} onChange={e=>setForm({...form,hours:e.target.value})}/></Field>
            <Field label="Date"><input style={S.input} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
            <Field label="Hourly rate (optional)"><input style={S.input} type="number" placeholder="150" value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})}/></Field>
            <Field label="Contact (optional)"><select style={S.select} value={form.contactId} onChange={e=>setForm({...form,contactId:e.target.value})}><option value="">—</option>{eContacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          </div>
          <Field label="Deal (optional)"><select style={S.select} value={form.dealId} onChange={e=>setForm({...form,dealId:e.target.value})}><option value="">—</option>{eDeals.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnSecondary} onClick={()=>setAdding(false)}>Cancel</button>
            <button style={S.btnPrimary} onClick={submit}>Save entry</button>
          </div>
        </div>
      )}
      {eEntries.length===0&&!adding?(
        <EmptyState
          icon={I.clock}
          title="No time logged yet"
          message="Track billable hours against contacts and deals. Time entries can be rolled into invoices later."
          ctaLabel="Log your first entry"
          onCta={()=>setAdding(true)}
        />
      ):(
        <div style={S.card({overflow:"hidden"})}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Date","Description","Contact","Hours","Amount",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{[...eEntries].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(e=>{
              const c=contacts.find(x=>x.id===e.contactId);
              if(editingId===e.id){
                return(
                  <tr key={e.id} style={{background:"#F8FAFC"}}>
                    <td style={S.td}><input type="date" style={{...S.input,padding:"4px 6px"}} value={editForm.date} onChange={ev=>setEditForm({...editForm,date:ev.target.value})}/></td>
                    <td style={S.td}><input style={{...S.input,padding:"4px 6px"}} value={editForm.description} onChange={ev=>setEditForm({...editForm,description:ev.target.value})}/></td>
                    <td style={S.td}><select style={{...S.select,padding:"4px 6px"}} value={editForm.contactId} onChange={ev=>setEditForm({...editForm,contactId:ev.target.value})}><option value="">—</option>{eContacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                    <td style={S.td}><input type="number" step="0.25" style={{...S.input,padding:"4px 6px",width:80}} value={editForm.hours} onChange={ev=>setEditForm({...editForm,hours:ev.target.value})}/></td>
                    <td style={S.td}><input type="number" step="1" style={{...S.input,padding:"4px 6px",width:80}} placeholder="Rate" value={editForm.rate} onChange={ev=>setEditForm({...editForm,rate:ev.target.value})}/></td>
                    <td style={{...S.td,textAlign:"right",whiteSpace:"nowrap"}}>
                      <button style={S.btnGhost} title="Cancel" onClick={()=>setEditingId(null)}><Ic d={I.x} size={13}/></button>
                      <button style={{...S.btnGhost,color:"#10B981"}} title="Save" onClick={saveEdit}><Ic d={I.ok} size={13}/></button>
                    </td>
                  </tr>
                );
              }
              return(
                <tr key={e.id}>
                  <td style={S.td}>{fmtDate(e.date)}</td>
                  <td style={{...S.td,color:"#0F172A",fontWeight:500}}>{e.description}</td>
                  <td style={S.td}>{c?.name||"—"}</td>
                  <td style={S.td}>{fmtHours(e.hours)}</td>
                  <td style={{...S.td,fontWeight:600,color:"#0F172A"}}>{e.rate?fmt$((+e.hours||0)*(+e.rate||0)):"—"}</td>
                  <td style={{...S.td,textAlign:"right",whiteSpace:"nowrap"}}>
                    <button style={S.btnGhost} title="Edit" onClick={()=>startEdit(e)}><Ic d={I.edit} size={13}/></button>
                    <button style={{...S.btnGhost,color:"#EF4444"}} title="Delete" onClick={()=>{if(confirm("Delete entry?"))deleteTimeEntry(e.id);}}><Ic d={I.trash} size={13}/></button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════════════════════
function InvoicesView({invoices,contacts,products,timeEntries=[],activeEntityId,addInvoice,updateInvoice,deleteInvoice,invoiceCounter,setInvoiceCounter,showToast,setView}){
  const eInvoices=(invoices||[]).filter(i=>i.entityId===activeEntityId);
  const eContacts=contacts.filter(c=>c.entityId===activeEntityId);
  const eProducts=products.filter(p=>p.entityId===activeEntityId);
  const eTime=(timeEntries||[]).filter(t=>t.entityId===activeEntityId);
  const [composing,setComposing]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const blankItem=()=>({description:"",quantity:1,unitPrice:0,timeEntryId:null});
  const [form,setForm]=useState({contactId:"",dueDate:"",notes:"",items:[blankItem()]});
  const totalsFor=inv=>(inv.items||[]).reduce((s,it)=>s+(+it.quantity||0)*(+it.unitPrice||0),0);
  const total=form.items.reduce((s,it)=>s+(+it.quantity||0)*(+it.unitPrice||0),0);
  // Track which time entries have already been billed
  const billedTimeIds=new Set();
  eInvoices.forEach(inv=>(inv.items||[]).forEach(it=>{if(it.timeEntryId)billedTimeIds.add(it.timeEntryId);}));
  const unbilledForContact=form.contactId?eTime.filter(t=>t.contactId===form.contactId&&!billedTimeIds.has(t.id)&&+t.hours>0&&+t.rate>0):[];
  const importUnbilledTime=()=>{
    if(unbilledForContact.length===0)return;
    const newItems=unbilledForContact.map(t=>({description:`${t.description} (${fmtDate(t.date)})`,quantity:+t.hours,unitPrice:+t.rate,timeEntryId:t.id}));
    setForm({...form,items:[...form.items.filter(it=>it.description||it.timeEntryId),...newItems]});
    showToast?.(`Added ${newItems.length} time entr${newItems.length===1?"y":"ies"} as line items`);
  };
  const submit=()=>{
    if(!form.contactId){showToast?.("Pick a contact","error");return;}
    if(!form.items.some(it=>it.description&&+it.quantity>0)){showToast?.("Add at least one line item","error");return;}
    if(editingId){
      updateInvoice(editingId,{contactId:form.contactId,dueDate:form.dueDate||null,notes:form.notes,items:form.items.filter(it=>it.description)});
      setEditingId(null);setComposing(false);
      setForm({contactId:"",dueDate:"",notes:"",items:[blankItem()]});
      showToast?.("Invoice updated");
      return;
    }
    const number=invoiceCounter||1;
    addInvoice({entityId:activeEntityId,number,contactId:form.contactId,dueDate:form.dueDate||null,notes:form.notes,items:form.items.filter(it=>it.description),status:"Draft",createdAt:new Date().toISOString()});
    setInvoiceCounter(number+1);
    setForm({contactId:"",dueDate:"",notes:"",items:[blankItem()]});
    setComposing(false);
    showToast?.(`Invoice ${fmtInvNum(number)} created as Draft`);
  };
  const openCompose=()=>{
    if(eContacts.length===0){showToast?.("Add a contact before creating an invoice","error");return;}
    setEditingId(null);
    setForm({contactId:"",dueDate:"",notes:"",items:[blankItem()]});
    setComposing(true);
  };
  const openEdit=(inv)=>{
    setEditingId(inv.id);
    setForm({contactId:inv.contactId||"",dueDate:inv.dueDate||"",notes:inv.notes||"",items:(inv.items||[]).length?inv.items.map(it=>({...it})):[blankItem()]});
    setComposing(true);
  };
  const totalOutstanding=eInvoices.filter(i=>!["Paid","Cancelled"].includes(i.status)).reduce((s,i)=>s+totalsFor(i),0);
  const totalPaid=eInvoices.filter(i=>i.status==="Paid").reduce((s,i)=>s+totalsFor(i),0);
  return(
    <div>
      <PageHeader title="Invoices" sub={eInvoices.length===0?"Bill clients and track payments":`${eInvoices.length} invoice${eInvoices.length===1?"":"s"} · ${fmt$(totalOutstanding)} outstanding · ${fmt$(totalPaid)} collected`}>
        {eInvoices.length>0&&!composing&&<button style={S.btnPrimary} onClick={openCompose}><Ic d={I.plus} size={14}/>New invoice</button>}
      </PageHeader>
      {composing&&(
        <div style={{...S.card({padding:18}),marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:12}}>{editingId?`Editing ${fmtInvNum(eInvoices.find(i=>i.id===editingId)?.number||1)}`:`New invoice ${fmtInvNum(invoiceCounter||1)}`}</div>
          <div style={S.grid2}>
            <Field label="Contact *"><select style={S.select} value={form.contactId} onChange={e=>setForm({...form,contactId:e.target.value})}><option value="">Select contact…</option>{eContacts.map(c=><option key={c.id} value={c.id}>{c.name}{c.companyName?` — ${c.companyName}`:""}</option>)}</select></Field>
            <Field label="Due date"><input style={S.input} type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field>
          </div>
          {unbilledForContact.length>0&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,marginBottom:12,fontSize:12,color:"#1E3A8A"}}>
              <Ic d={I.clock} size={14} c="#1D4ED8"/>
              <span style={{flex:1}}><strong>{unbilledForContact.length}</strong> unbilled time entr{unbilledForContact.length===1?"y":"ies"} for this contact ({fmtHours(unbilledForContact.reduce((s,t)=>s+(+t.hours||0),0))} · {fmt$(unbilledForContact.reduce((s,t)=>s+(+t.hours||0)*(+t.rate||0),0))})</span>
              <button style={{...S.btnPrimary,padding:"4px 10px",fontSize:11}} onClick={importUnbilledTime}>Add as line items</button>
            </div>
          )}
          <div style={{...S.label,marginTop:6}}>Line items</div>
          {form.items.map((it,idx)=>(
            <div key={idx} style={{display:"grid",gridTemplateColumns:"1fr 90px 120px 32px",gap:8,marginBottom:8,alignItems:"center"}}>
              <input style={S.input} placeholder="Description" value={it.description} onChange={e=>{const items=[...form.items];items[idx]={...it,description:e.target.value};setForm({...form,items});}} list={`prods-${idx}`}/>
              <datalist id={`prods-${idx}`}>{eProducts.map(p=><option key={p.id} value={p.name}/>)}</datalist>
              <input style={S.input} type="number" step="0.01" placeholder="Qty" value={it.quantity} onChange={e=>{const items=[...form.items];items[idx]={...it,quantity:e.target.value};setForm({...form,items});}}/>
              <input style={S.input} type="number" step="0.01" placeholder="Unit price" value={it.unitPrice} onChange={e=>{const items=[...form.items];items[idx]={...it,unitPrice:e.target.value};setForm({...form,items});}}/>
              <button style={S.btnGhost} title="Remove" onClick={()=>setForm({...form,items:form.items.filter((_,i)=>i!==idx).length?form.items.filter((_,i)=>i!==idx):[blankItem()]})}><Ic d={I.x} size={14}/></button>
            </div>
          ))}
          <button style={{...S.btnGhost,fontSize:12,fontWeight:600,marginBottom:10}} onClick={()=>setForm({...form,items:[...form.items,blankItem()]})}><Ic d={I.plus} size={12}/>Add line</button>
          <Field label="Notes (optional)"><textarea style={S.textarea} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
            <div style={{fontSize:14,fontWeight:700,color:"#0F172A"}}>Total: {fmt$(total)}</div>
            <div style={{display:"flex",gap:8}}>
              <button style={S.btnSecondary} onClick={()=>{setComposing(false);setEditingId(null);}}>Cancel</button>
              <button style={S.btnPrimary} onClick={submit}>{editingId?"Save changes":"Create draft"}</button>
            </div>
          </div>
        </div>
      )}
      {eInvoices.length===0&&!composing?(
        eContacts.length===0?(
          <EmptyState
            icon={I.invoice}
            title="No invoices yet"
            message="You'll need at least one contact before you can bill them. Add a contact, then come back to create your first invoice."
            ctaLabel="Add a contact"
            onCta={()=>setView?.("contacts")}
          />
        ):(
          <EmptyState
            icon={I.invoice}
            title="No invoices yet"
            message="Create your first invoice to bill a client. Drafts can be edited and marked sent or paid as you work through the billing cycle."
            ctaLabel="Create your first invoice"
            onCta={openCompose}
          />
        )
      ):(
        <div style={S.card({overflow:"hidden"})}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Number","Contact","Total","Status","Due",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{[...eInvoices].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(inv=>{
              const c=contacts.find(x=>x.id===inv.contactId);
              return(
                <tr key={inv.id}>
                  <td style={{...S.td,fontWeight:600,color:"#0F172A"}}>{fmtInvNum(inv.number)}</td>
                  <td style={S.td}>{c?.name||"—"}</td>
                  <td style={{...S.td,fontWeight:600,color:"#0F172A"}}>{fmt$(totalsFor(inv))}</td>
                  <td style={S.td}>
                    <select style={{...S.select,width:"auto",padding:"3px 6px",fontSize:11,...S.badge(INV_COLORS[inv.status]||"#64748B")}} value={inv.status} onChange={e=>updateInvoice(inv.id,{status:e.target.value})}>
                      {INVOICE_STATUSES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={S.td}>{fmtDate(inv.dueDate)}</td>
                  <td style={{...S.td,textAlign:"right",whiteSpace:"nowrap"}}>
                    <button style={S.btnGhost} title="Edit" onClick={()=>openEdit(inv)}><Ic d={I.edit} size={13}/></button>
                    <button style={{...S.btnGhost,color:"#EF4444"}} title="Delete" onClick={()=>{if(confirm("Delete invoice?"))deleteInvoice(inv.id);}}><Ic d={I.trash} size={13}/></button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT PORTAL
// ═══════════════════════════════════════════════════════════════════════════════
function ClientPortalView({portalTokens,contacts,activeEntityId,addPortalToken,deletePortalToken,refreshPortalSnapshot,showToast,entity,setView}){
  const eTokens=(portalTokens||[]).filter(t=>t.entityId===activeEntityId);
  const eContacts=contacts.filter(c=>c.entityId===activeEntityId);
  const [generating,setGenerating]=useState(false);
  const [contactId,setContactId]=useState("");
  const linkFor=tok=>`${typeof window!=="undefined"?window.location.origin:""}/portal/${tok.token}`;
  const generate=()=>{
    if(!contactId){showToast?.("Pick a contact","error");return;}
    const tok={entityId:activeEntityId,contactId,token:genToken(),createdAt:new Date().toISOString()};
    addPortalToken(tok);
    setContactId("");
    setGenerating(false);
    showToast?.("Portal link created");
  };
  const copy=async(t)=>{try{await navigator.clipboard.writeText(linkFor(t));showToast?.("Link copied");}catch{showToast?.("Could not copy","error");}};
  const startGenerate=()=>{
    if(eContacts.length===0){showToast?.("Add a contact first","error");return;}
    setGenerating(true);
  };
  return(
    <div>
      <PageHeader title="Client Portal" sub={eTokens.length===0?`Give clients of ${entity?.name||"this workspace"} a private link`:`${eTokens.length} active link${eTokens.length===1?"":"s"}`}>
        {eTokens.length>0&&!generating&&<button style={S.btnPrimary} onClick={startGenerate}><Ic d={I.plus} size={14}/>New portal link</button>}
      </PageHeader>
      {generating&&(
        <div style={{...S.card({padding:18}),marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:12}}>Generate a portal link</div>
          <Field label="Contact"><select style={S.select} value={contactId} onChange={e=>setContactId(e.target.value)}><option value="">Select contact…</option>{eContacts.map(c=><option key={c.id} value={c.id}>{c.name}{c.companyName?` — ${c.companyName}`:""}</option>)}</select></Field>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:6}}>
            <button style={S.btnSecondary} onClick={()=>setGenerating(false)}>Cancel</button>
            <button style={S.btnPrimary} onClick={generate}>Generate link</button>
          </div>
        </div>
      )}
      {eTokens.length===0&&!generating?(
        eContacts.length===0?(
          <EmptyState
            icon={I.link}
            title="No client portal links yet"
            message="You'll need at least one contact before you can generate a portal link. Add a contact, then come back here to share a private link they can use to view their invoices, quotes, and documents."
            ctaLabel="Add a contact"
            onCta={()=>setView?.("contacts")}
          />
        ):(
          <EmptyState
            icon={I.link}
            title="No client portal links yet"
            message="Generate a private link for a client so they can view their invoices, quotes, and documents in one place."
            ctaLabel="Generate your first link"
            onCta={startGenerate}
          />
        )
      ):(
        <div style={S.card({overflow:"hidden"})}>
          {eTokens.map((t,i)=>{
            const c=contacts.find(x=>x.id===t.contactId);
            return(
              <div key={t.id} style={{padding:"14px 18px",borderTop:i?"1px solid #E9EEF6":"none",display:"flex",alignItems:"center",gap:12}}>
                <Avatar name={c?.name||"?"} size={32}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>{c?.name||"Unknown contact"}</div>
                  <div style={{fontSize:12,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{linkFor(t)}</div>
                </div>
                <button style={S.btnSecondary} onClick={()=>copy(t)}><Ic d={I.copy} size={12}/>Copy</button>
                {refreshPortalSnapshot&&<button style={S.btnSecondary} title="Refresh portal data" onClick={()=>refreshPortalSnapshot(t.id)}><Ic d={I.bar||I.share} size={12}/>Refresh</button>}
                <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>{if(confirm("Revoke link?"))deletePortalToken(t.id);}}><Ic d={I.trash} size={13}/></button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULER (C1)
// ═══════════════════════════════════════════════════════════════════════════════
function SchedulerView({meetings,contacts,activeEntityId,availability,addMeeting,updateMeeting,deleteMeeting,updateAvailability,showToast}){
  const [tab,setTab]=useState("upcoming");
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({title:"",contactId:"",date:new Date().toISOString().slice(0,10),time:"10:00",duration:30,location:"",notes:""});
  const eMeetings=(meetings||[]).filter(m=>m.entityId===activeEntityId);
  const eContacts=contacts.filter(c=>c.entityId===activeEntityId);
  const now=new Date();
  const upcoming=eMeetings.filter(m=>new Date(`${m.date}T${m.time||"00:00"}`)>=now).sort((a,b)=>new Date(`${a.date}T${a.time||"00:00"}`)-new Date(`${b.date}T${b.time||"00:00"}`));
  const past=eMeetings.filter(m=>new Date(`${m.date}T${m.time||"00:00"}`)<now).sort((a,b)=>new Date(`${b.date}T${b.time||"00:00"}`)-new Date(`${a.date}T${a.time||"00:00"}`));
  const submit=()=>{
    if(!form.title){showToast?.("Meeting title is required","error");return;}
    addMeeting({entityId:activeEntityId,title:form.title,contactId:form.contactId||null,date:form.date,time:form.time,duration:+form.duration||30,location:form.location,notes:form.notes,createdAt:new Date().toISOString()});
    setForm({title:"",contactId:"",date:new Date().toISOString().slice(0,10),time:"10:00",duration:30,location:"",notes:""});
    setAdding(false);
    showToast?.("Meeting scheduled");
  };
  const TAB=({id,label,count})=>(
    <button onClick={()=>setTab(id)} style={{...S.btnGhost,padding:"6px 14px",borderBottom:`2px solid ${tab===id?"#1D4ED8":"transparent"}`,color:tab===id?"#1D4ED8":"#64748B",borderRadius:0,fontSize:13,fontWeight:600}}>
      {label}{count!=null&&<span style={{marginLeft:6,background:tab===id?"#DBEAFE":"#F1F5F9",color:tab===id?"#1D4ED8":"#64748B",borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700}}>{count}</span>}
    </button>
  );
  return(
    <div>
      <PageHeader title="Scheduler" sub={eMeetings.length===0?"Schedule meetings with contacts and manage your availability":`${upcoming.length} upcoming · ${past.length} past`}>
        {!adding&&tab!=="availability"&&<button style={S.btnPrimary} onClick={()=>setAdding(true)}><Ic d={I.plus} size={14}/>Log meeting</button>}
      </PageHeader>
      <div style={{display:"flex",gap:0,borderBottom:"1px solid #E2E8F0",marginBottom:16}}>
        <TAB id="upcoming" label="Upcoming" count={upcoming.length}/>
        <TAB id="past" label="Past" count={past.length}/>
        <TAB id="availability" label="Availability"/>
      </div>
      {adding&&(
        <div style={{...S.card({padding:18}),marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:12}}>Schedule a meeting</div>
          <Field label="Title *"><input style={S.input} placeholder="Discovery call" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></Field>
          <div style={S.grid2}>
            <Field label="Contact"><select style={S.select} value={form.contactId} onChange={e=>setForm({...form,contactId:e.target.value})}><option value="">Select contact…</option>{eContacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <Field label="Duration"><select style={S.select} value={form.duration} onChange={e=>setForm({...form,duration:+e.target.value})}>{DURATIONS.map(d=><option key={d} value={d}>{d} min</option>)}</select></Field>
            <Field label="Date"><input style={S.input} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field>
            <Field label="Time"><input style={S.input} type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})}/></Field>
          </div>
          <Field label="Location / link"><input style={S.input} placeholder="Zoom link, address, or Google Meet" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}/></Field>
          <Field label="Notes"><textarea style={S.textarea} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
            <button style={S.btnSecondary} onClick={()=>setAdding(false)}>Cancel</button>
            <button style={S.btnPrimary} onClick={submit}>Save meeting</button>
          </div>
        </div>
      )}
      {(tab==="upcoming"||tab==="past")&&(()=>{
        const list=tab==="upcoming"?upcoming:past;
        if(list.length===0&&!adding) return(
          <EmptyState
            icon={I.cal||I.clock}
            title={tab==="upcoming"?"No upcoming meetings":"No past meetings"}
            message="Log meetings with your contacts to keep a clean activity record and follow-up reminders."
            ctaLabel="Log a meeting"
            onCta={()=>setAdding(true)}
          />
        );
        return(
          <div style={S.card({overflow:"hidden"})}>
            {list.map((m,i)=>{
              const c=contacts.find(x=>x.id===m.contactId);
              return(
                <div key={m.id} style={{padding:"14px 18px",borderTop:i?"1px solid #E9EEF6":"none",display:"flex",alignItems:"center",gap:14}}>
                  <div style={{width:50,textAlign:"center",flexShrink:0}}>
                    <div style={{fontSize:11,color:"#64748B",fontWeight:600,textTransform:"uppercase"}}>{new Date(m.date).toLocaleString("default",{month:"short"})}</div>
                    <div style={{fontSize:22,fontWeight:800,color:"#0F172A"}}>{new Date(m.date).getDate()}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#0F172A"}}>{m.title}</div>
                    <div style={{fontSize:12,color:"#64748B"}}>{m.time} · {fmtHours((m.duration||30)/60).replace("hr","hr")} · {c?.name||"No contact"}</div>
                    {m.location&&<div style={{fontSize:11,color:"#475569",marginTop:2}}>📍 {m.location}</div>}
                  </div>
                  <button style={{...S.btnGhost,color:"#EF4444"}} onClick={()=>{if(confirm("Delete meeting?"))deleteMeeting(m.id);}}><Ic d={I.trash} size={13}/></button>
                </div>
              );
            })}
          </div>
        );
      })()}
      {tab==="availability"&&(()=>{
        const entityAvail=availability?.[activeEntityId]||{};
        return(
          <div style={S.card({padding:24})}>
            <div style={{fontSize:13,fontWeight:700,color:"#0F172A",marginBottom:6}}>Working hours</div>
            <div style={{fontSize:12,color:"#64748B",marginBottom:16}}>Set when you're available so contacts can request meetings on your calendar.</div>
            {DAYS.map(day=>{
              const a=entityAvail[day]||{enabled:false,start:"09:00",end:"17:00"};
              const update=(patch)=>updateAvailability?.(activeEntityId,{[day]:{...a,...patch}});
              return(
                <div key={day} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #F1F5F9"}}>
                  <label style={{display:"flex",alignItems:"center",gap:6,minWidth:120}}>
                    <input type="checkbox" checked={!!a.enabled} onChange={e=>update({enabled:e.target.checked})} style={{accentColor:"#1D4ED8"}}/>
                    <span style={{fontSize:13,fontWeight:600,color:"#0F172A"}}>{day}</span>
                  </label>
                  <input type="time" disabled={!a.enabled} value={a.start} onChange={e=>update({start:e.target.value})} style={{...S.input,width:120,opacity:a.enabled?1:.4}}/>
                  <span style={{color:"#94A3B8"}}>to</span>
                  <input type="time" disabled={!a.enabled} value={a.end} onChange={e=>update({end:e.target.value})} style={{...S.input,width:120,opacity:a.enabled?1:.4}}/>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOKS PANEL (C3 — lives inside Settings)
// ═══════════════════════════════════════════════════════════════════════════════
function WebhooksPanel({webhooks,activeEntityId,addWebhook,updateWebhook,deleteWebhook,showToast}){
  const eHooks=(webhooks||[]).filter(w=>w.entityId===activeEntityId);
  const [adding,setAdding]=useState(false);
  const [form,setForm]=useState({name:"",url:"",events:["contact.created"],active:true});
  const submit=()=>{
    if(!form.name||!form.url){showToast?.("Name and URL are required","error");return;}
    if(!/^https?:\/\//i.test(form.url)){showToast?.("URL must start with http:// or https://","error");return;}
    if(form.events.length===0){showToast?.("Select at least one event","error");return;}
    addWebhook({entityId:activeEntityId,name:form.name,url:form.url,events:form.events,active:form.active,createdAt:new Date().toISOString(),lastFired:null,lastStatus:null});
    setForm({name:"",url:"",events:["contact.created"],active:true});
    setAdding(false);
    showToast?.("Webhook created");
  };
  const toggleEvent=(ev)=>{
    setForm(f=>({...f,events:f.events.includes(ev)?f.events.filter(e=>e!==ev):[...f.events,ev]}));
  };
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:"#0F172A"}}>Webhooks</div>
          <div style={{fontSize:12,color:"#64748B",marginTop:2}}>Send POST requests to your endpoint when CRM events happen.</div>
        </div>
        {!adding&&<button style={S.btnPrimary} onClick={()=>setAdding(true)}><Ic d={I.plus} size={14}/>New webhook</button>}
      </div>
      {adding&&(
        <div style={{...S.card({padding:18}),marginBottom:16}}>
          <Field label="Name"><input style={S.input} placeholder="Slack notifications" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
          <Field label="Endpoint URL"><input style={S.input} placeholder="https://hooks.example.com/abc" value={form.url} onChange={e=>setForm({...form,url:e.target.value})}/></Field>
          <Field label="Events to send">
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
              {WEBHOOK_EVENTS.map(ev=>(
                <label key={ev} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",fontSize:12,cursor:"pointer"}}>
                  <input type="checkbox" checked={form.events.includes(ev)} onChange={()=>toggleEvent(ev)} style={{accentColor:"#1D4ED8"}}/>
                  <code style={{background:"#F1F5F9",padding:"1px 6px",borderRadius:4,fontFamily:"monospace",fontSize:11}}>{ev}</code>
                </label>
              ))}
            </div>
          </Field>
          <label style={{display:"flex",alignItems:"center",gap:6,marginTop:8,fontSize:12,cursor:"pointer"}}>
            <input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})} style={{accentColor:"#1D4ED8"}}/>
            <span>Active immediately</span>
          </label>
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
            <button style={S.btnSecondary} onClick={()=>setAdding(false)}>Cancel</button>
            <button style={S.btnPrimary} onClick={submit}>Create webhook</button>
          </div>
        </div>
      )}
      {eHooks.length===0&&!adding?(
        <EmptyState icon={I.zap} title="No webhooks configured" message="Push CRM events (contact.created, deal.won, invoice.paid, …) to any HTTPS endpoint." ctaLabel="Create your first webhook" onCta={()=>setAdding(true)}/>
      ):(
        <div style={S.card({overflow:"hidden"})}>
          {eHooks.map((w,i)=>(
            <div key={w.id} style={{padding:"14px 18px",borderTop:i?"1px solid #E9EEF6":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F172A"}}>{w.name}</div>
                  <div style={{fontSize:11,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.url}</div>
                </div>
                <span style={S.badge(w.active?"#10B981":"#94A3B8")}>{w.active?"Active":"Disabled"}</span>
                <button style={S.btnGhost} title={w.active?"Disable":"Enable"} onClick={()=>updateWebhook(w.id,{active:!w.active})}><Ic d={w.active?I.x:I.ok} size={12}/></button>
                <button style={{...S.btnGhost,color:"#EF4444"}} title="Delete" onClick={()=>{if(confirm("Delete webhook?"))deleteWebhook(w.id);}}><Ic d={I.trash} size={12}/></button>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {(w.events||[]).map(ev=><code key={ev} style={{background:"#F1F5F9",padding:"1px 6px",borderRadius:4,fontFamily:"monospace",fontSize:10,color:"#64748B"}}>{ev}</code>)}
              </div>
              {w.lastFired&&<div style={{fontSize:11,color:"#94A3B8",marginTop:6}}>Last fired {fmtTime(w.lastFired)} · {w.lastStatus||"—"}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNATURE MODAL (C4)
// ═══════════════════════════════════════════════════════════════════════════════
function SignatureModal({doc,contact,onClose,onSign,showToast}){
  const [mode,setMode]=useState("draw");
  const [typed,setTyped]=useState(contact?.name||"");
  const canvasRef=useRef(null);
  const drawingRef=useRef(false);
  const drewSomethingRef=useRef(false);

  useEffect(()=>{
    const c=canvasRef.current;
    if(!c)return;
    const ctx=c.getContext("2d");
    ctx.fillStyle="#FFFFFF";
    ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle="#0F172A";
    ctx.lineWidth=2;
    ctx.lineCap="round";
  },[mode]);

  const getPos=(e)=>{
    const c=canvasRef.current;
    const r=c.getBoundingClientRect();
    const t=e.touches?.[0];
    return {x:((t?.clientX??e.clientX)-r.left)*(c.width/r.width),y:((t?.clientY??e.clientY)-r.top)*(c.height/r.height)};
  };
  const start=(e)=>{e.preventDefault();drawingRef.current=true;const c=canvasRef.current;const ctx=c.getContext("2d");const p=getPos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);};
  const move=(e)=>{if(!drawingRef.current)return;e.preventDefault();const ctx=canvasRef.current.getContext("2d");const p=getPos(e);ctx.lineTo(p.x,p.y);ctx.stroke();drewSomethingRef.current=true;};
  const end=()=>{drawingRef.current=false;};
  const clear=()=>{const c=canvasRef.current;if(!c)return;const ctx=c.getContext("2d");ctx.fillStyle="#FFFFFF";ctx.fillRect(0,0,c.width,c.height);drewSomethingRef.current=false;};

  const submit=()=>{
    if(mode==="draw"){
      if(!drewSomethingRef.current){showToast?.("Please draw your signature","error");return;}
      const dataUrl=canvasRef.current.toDataURL("image/png");
      onSign?.({type:"draw",dataUrl,signedAt:new Date().toISOString()});
    } else {
      if(!typed.trim()){showToast?.("Type your full name","error");return;}
      onSign?.({type:"type",text:typed.trim(),signedAt:new Date().toISOString()});
    }
    showToast?.("Signature captured");
    onClose?.();
  };

  return(
    <Modal title="Sign document" onClose={onClose} wide>
      <div style={{fontSize:13,color:"#475569",marginBottom:14}}>
        Sign <strong>{doc?.name||"this document"}</strong>{contact?` as ${contact.name}`:""}.
      </div>
      <div style={{display:"flex",gap:0,background:"#E2E8F0",padding:3,borderRadius:8,marginBottom:14,width:"fit-content"}}>
        {[["draw","Draw signature"],["type","Type signature"]].map(([v,l])=>(
          <button key={v} onClick={()=>setMode(v)} style={{...S.btnGhost,padding:"6px 14px",background:mode===v?"#1D4ED8":"transparent",color:mode===v?"#FFFFFF":"#64748B",borderRadius:6,fontSize:12,fontWeight:600}}>{l}</button>
        ))}
      </div>
      {mode==="draw"?(
        <div>
          <div style={{border:"2px dashed #CBD5E1",borderRadius:10,background:"#FFFFFF",padding:6}}>
            <canvas ref={canvasRef} width={620} height={180} style={{display:"block",width:"100%",height:180,touchAction:"none",cursor:"crosshair"}}
              onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
              onTouchStart={start} onTouchMove={move} onTouchEnd={end}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
            <button style={S.btnGhost} onClick={clear}>Clear</button>
            <span style={{fontSize:11,color:"#94A3B8"}}>Sign with your mouse, trackpad, or finger</span>
          </div>
        </div>
      ):(
        <div>
          <input style={{...S.input,fontSize:24,fontFamily:"'Caveat','Brush Script MT',cursive",padding:"18px 14px",height:80}} placeholder="Type your full name" value={typed} onChange={e=>setTyped(e.target.value)}/>
          <div style={{fontSize:11,color:"#94A3B8",marginTop:6}}>Your typed name will serve as your electronic signature.</div>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}>
        <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
        <button style={S.btnPrimary} onClick={submit}><Ic d={I.ok} size={13}/>Sign</button>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEAL DETAIL (H1)
// ═══════════════════════════════════════════════════════════════════════════════
function DealDetail({deal,allContacts,allCompanies,allNotes,allTasks,onBack,openModal,setSelContact,setSelCompany,setView,deleteDeal,updateDeal,addNote,deleteNote,entity,activeEntityId}){
  const [tab,setTab]=useState("overview");
  const [noteText,setNoteText]=useState("");
  if(!deal){
    return(
      <div>
        <button style={{...S.btnGhost,fontSize:12,marginBottom:14}} onClick={onBack}><Ic d={I.arrow} size={12}/>Back to Pipeline</button>
        <div style={{...S.card({padding:48}),textAlign:"center",color:"#475569"}}>This deal no longer exists.</div>
      </div>
    );
  }
  const contact=allContacts.find(c=>c.id===deal.contactId);
  const company=allCompanies.find(c=>c.id===deal.companyId)||(deal.companyName?allCompanies.find(c=>c.name?.toLowerCase()===deal.companyName.toLowerCase()):null);
  const notes=allNotes.filter(n=>n.dealId===deal.id||(n.contactId&&n.contactId===deal.contactId)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const tasks=allTasks.filter(t=>t.dealId===deal.id||(t.contactId&&t.contactId===deal.contactId));
  const stages=stagesFor(entity);
  const sCol=stageColor(entity,deal.stage);

  const TAB=({id,label,count})=>(
    <button onClick={()=>setTab(id)} style={{...S.btnGhost,padding:"6px 14px",borderBottom:`2px solid ${tab===id?"#1D4ED8":"transparent"}`,color:tab===id?"#1D4ED8":"#64748B",borderRadius:0,fontSize:13,fontWeight:600}}>
      {label}{count!=null&&<span style={{marginLeft:6,background:tab===id?"#DBEAFE":"#F1F5F9",color:tab===id?"#1D4ED8":"#64748B",borderRadius:10,padding:"1px 7px",fontSize:11,fontWeight:700}}>{count}</span>}
    </button>
  );
  const submitNote=()=>{
    if(!noteText.trim())return;
    addNote({entityId:activeEntityId,contactId:deal.contactId||null,dealId:deal.id,content:noteText.trim(),type:"note",createdAt:new Date().toISOString()});
    setNoteText("");
  };
  return(
    <div>
      <button style={{...S.btnGhost,fontSize:12,marginBottom:14}} onClick={onBack}><Ic d={I.arrow} size={12}/>Back to Pipeline</button>
      <div style={S.card({padding:24,marginBottom:20})}>
        <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
          <div style={{width:64,height:64,background:sCol+"20",borderRadius:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${sCol}40`}}><Ic d={I.dollar} size={28} c={sCol}/></div>
          <div style={{flex:1,minWidth:0}}>
            <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:22,fontWeight:800,color:"#0F172A",margin:"0 0 6px"}}>{deal.title}</h2>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
              <select value={deal.stage} onChange={e=>updateDeal(deal.id,{stage:e.target.value})} style={{...S.select,width:"auto",padding:"3px 10px",fontSize:11,...S.badge(sCol)}}>
                {stages.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              {entity&&<span style={S.badge("#64748B")}>{entity.name}</span>}
            </div>
            <div style={{fontSize:13,color:"#475569"}}>
              {contact&&<button style={{background:"none",border:"none",color:"#1D4ED8",cursor:"pointer",padding:0,fontSize:13,marginRight:14}} onClick={()=>{setSelContact(contact.id);setView("contacts");}}>👤 {contact.name}</button>}
              {company&&<button style={{background:"none",border:"none",color:"#1D4ED8",cursor:"pointer",padding:0,fontSize:13}} onClick={()=>{setSelCompany(company.id);setView("companies");}}>🏢 {company.name}</button>}
              {!company&&deal.companyName&&<span style={{color:"#64748B"}}>🏢 {deal.companyName} <em style={{fontSize:11}}>(not linked)</em></span>}
            </div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:28,fontWeight:800,color:sCol}}>{fmt$(deal.value)}</div>
            <div style={{fontSize:12,color:"#64748B",marginTop:2}}>Close: {fmtDate(deal.closeDate)}</div>
            <div style={{fontSize:12,color:"#64748B"}}>Probability: {deal.probability||"—"}%</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginTop:16,paddingTop:16,borderTop:"1px solid #E9EEF6"}}>
          <button style={S.btnSecondary} onClick={()=>openModal("editDeal",deal)}><Ic d={I.edit} size={13}/>Edit deal</button>
          <button style={S.btnSecondary} onClick={()=>openModal("buildQuote",{contactId:deal.contactId,dealId:deal.id})}><Ic d={I.quote} size={13}/>Build quote</button>
          <button style={{...S.btnSecondary,color:"#EF4444",borderColor:"#FECACA",marginLeft:"auto"}} onClick={()=>{if(confirm("Delete deal?")){deleteDeal(deal.id);onBack();}}}><Ic d={I.trash} size={13}/>Delete</button>
        </div>
      </div>

      <div style={{display:"flex",gap:0,borderBottom:"1px solid #E2E8F0",marginBottom:16}}>
        <TAB id="overview" label="Overview"/>
        <TAB id="notes" label="Notes" count={notes.length}/>
        <TAB id="tasks" label="Tasks" count={tasks.length}/>
        <TAB id="activity" label="Activity"/>
      </div>

      {tab==="overview"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <div style={S.card({padding:18})}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Deal facts</div>
            <div style={{display:"grid",gridTemplateColumns:"130px 1fr",rowGap:8,fontSize:13}}>
              <div style={{color:"#94A3B8"}}>Value</div><div style={{fontWeight:600,color:"#0F172A"}}>{fmt$(deal.value)}</div>
              <div style={{color:"#94A3B8"}}>Stage</div><div style={{fontWeight:600,color:"#0F172A"}}>{deal.stage}</div>
              <div style={{color:"#94A3B8"}}>Probability</div><div style={{fontWeight:600,color:"#0F172A"}}>{deal.probability||"—"}%</div>
              <div style={{color:"#94A3B8"}}>Close date</div><div style={{fontWeight:600,color:"#0F172A"}}>{fmtDate(deal.closeDate)}</div>
              <div style={{color:"#94A3B8"}}>Created</div><div style={{fontWeight:600,color:"#0F172A"}}>{fmtDate(deal.createdAt)}</div>
              {deal.lastContacted&&(<><div style={{color:"#94A3B8"}}>Last contact</div><div style={{fontWeight:600,color:"#0F172A"}}>{fmtDate(deal.lastContacted)}</div></>)}
              {deal.owner&&(<><div style={{color:"#94A3B8"}}>Owner</div><div style={{fontWeight:600,color:"#0F172A"}}>{deal.owner}</div></>)}
              {deal.dealType&&(<><div style={{color:"#94A3B8"}}>Type</div><div style={{fontWeight:600,color:"#0F172A"}}>{deal.dealType}</div></>)}
              {deal.priority&&(<><div style={{color:"#94A3B8"}}>Priority</div><div style={{fontWeight:600,color:"#0F172A"}}>{deal.priority}</div></>)}
              {deal.pipeline&&(<><div style={{color:"#94A3B8"}}>Pipeline</div><div style={{fontWeight:600,color:"#0F172A"}}>{deal.pipeline}</div></>)}
              {deal.nextStep&&(<><div style={{color:"#94A3B8"}}>Next step</div><div style={{fontWeight:600,color:"#0F172A"}}>{deal.nextStep}</div></>)}
              {deal.contractType&&(<><div style={{color:"#94A3B8"}}>Contract</div><div style={{fontWeight:600,color:"#0F172A"}}>{deal.contractType}</div></>)}
            </div>
            {deal.description&&(
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #F1F5F9"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Description</div>
                <div style={{fontSize:13,color:"#0F172A",whiteSpace:"pre-wrap"}}>{deal.description}</div>
              </div>
            )}
            {deal.stage==="Lost"&&deal.lostReason&&(
              <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #F1F5F9"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#EF4444",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>Closed Lost reason</div>
                <div style={{fontSize:13,color:"#0F172A",whiteSpace:"pre-wrap"}}>{deal.lostReason}</div>
              </div>
            )}
          </div>
          <div style={S.card({padding:18})}>
            <div style={{fontSize:12,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Recent activity</div>
            {(notes.length===0&&tasks.length===0)?<div style={{fontSize:13,color:"#94A3B8"}}>No notes or tasks yet.</div>
            :[...notes.slice(0,3).map(n=>({type:"note",d:n})),...tasks.slice(0,3).map(t=>({type:"task",d:t}))].sort((a,b)=>new Date(b.d.createdAt)-new Date(a.d.createdAt)).slice(0,6).map((it,i)=>(
              <div key={i} style={{padding:"6px 0",borderBottom:"1px solid #F1F5F9",fontSize:13}}>
                <div style={{fontSize:11,color:"#64748B"}}>{it.type==="note"?"📝 Note":"✅ Task"} · {fmtTime(it.d.createdAt)}</div>
                <div style={{color:"#0F172A"}}>{it.type==="note"?it.d.content.slice(0,90):it.d.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="notes"&&(
        <div>
          <div style={{...S.card({padding:14}),marginBottom:14}}>
            <textarea style={S.textarea} rows={3} placeholder="Add a note about this deal…" value={noteText} onChange={e=>setNoteText(e.target.value)}/>
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}>
              <button style={S.btnPrimary} disabled={!noteText.trim()} onClick={submitNote}><Ic d={I.plus} size={13}/>Add note</button>
            </div>
          </div>
          {notes.length===0?<div style={{...S.card({padding:32}),textAlign:"center",color:"#94A3B8",fontSize:13}}>No notes yet.</div>
          :notes.map(n=>(
            <div key={n.id} style={{...S.card({padding:14}),marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:"#64748B",marginBottom:4}}>{fmtTime(n.createdAt)}</div>
                  <div style={{fontSize:13,color:"#0F172A",whiteSpace:"pre-wrap"}}>{n.content}</div>
                </div>
                {deleteNote&&<button style={{...S.btnGhost,color:"#EF4444",flexShrink:0}} onClick={()=>{if(confirm("Delete note?"))deleteNote(n.id);}}><Ic d={I.trash} size={12}/></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab==="tasks"&&(
        <div style={S.card({overflow:"hidden"})}>
          {tasks.length===0?<div style={{padding:32,textAlign:"center",color:"#94A3B8",fontSize:13}}>No tasks yet.</div>
          :tasks.map((t,i)=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderTop:i?"1px solid #E9EEF6":"none"}}>
              <input type="checkbox" checked={!!t.completed} readOnly style={{accentColor:"#1D4ED8"}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:"#0F172A",textDecoration:t.completed?"line-through":"none"}}>{t.title}</div>
                <div style={{fontSize:11,color:"#64748B"}}>{fmtDate(t.dueDate)}</div>
              </div>
              <span style={S.badge({high:"#EF4444",medium:"#F59E0B",low:"#64748B"}[t.priority]||"#64748B")}>{t.priority||"medium"}</span>
            </div>
          ))}
        </div>
      )}

      {tab==="activity"&&(
        <div style={S.card({padding:18})}>
          <div style={{fontSize:13,color:"#64748B"}}>
            Created {fmtTime(deal.createdAt)}. Stage is currently <strong>{deal.stage}</strong>. Future activity will appear here as you log notes, tasks, and meetings against this deal.
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════════════
function Modals({modal,closeModal,contacts,companies,entities,activeEntityId,addContact,updateContact,addCompany,updateCompany,addDeal,updateDeal,addTask,updateTask,addNote,addEntity,connectEmail,showToast,products,sequences,addEnrollment,customFields,entity,addQuote,updateQuote,addTemplate,updateTemplate,timeEntries,addInvoice,updateInvoice,setInvoiceCounter,invoiceCounter}){
  const {type,data}=modal;
  const [form,setForm]=useState(data||{});
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));

  const contactCustomFields=customFields?.filter(f=>f.entity==="contact"&&f.entityId===activeEntityId)||[];
  const dealCustomFields=customFields?.filter(f=>f.entity==="deal"&&f.entityId===activeEntityId)||[];

  // Duplicate check
  const dupContact=type==="addContact"&&form.email&&contacts.some(c=>c.email?.toLowerCase()===form.email?.toLowerCase());

  if(type==="addContact"||type==="editContact") return(
    <Modal title={type==="addContact"?"Add Contact":"Edit Contact"} onClose={closeModal} wide>
      {dupContact&&<div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,padding:10,marginBottom:14,fontSize:13,color:"#92400E"}}>⚠ A contact with this email already exists.</div>}
      <div style={S.grid2}>
        <F form={form} set={set} label="Full Name *" name="name" placeholder="Sarah Johnson" required/>
        <F form={form} set={set} label="Email" name="email" type="email" placeholder="sarah@company.com"/>
        <F form={form} set={set} label="Phone" name="phone" placeholder="+1 555-0100"/>
        <F form={form} set={set} label="Title" name="title" placeholder="VP of Engineering"/>
        <F form={form} set={set} label="Company" name="companyName" placeholder="TechCorp"/>
        <F form={form} set={set} label="Platform" name="source" options={PLATFORMS}/>
        <F form={form} set={set} label="ICP" name="icp" options={ICP_LEVELS}/>
        <F form={form} set={set} label="Status" name="status" placeholder="e.g. Awaiting reply"/>
      </div>
      <Field label="Follow-up / Next Steps"><textarea rows={2} style={S.textarea} value={form.followUp||""} onChange={e=>set("followUp",e.target.value)}/></Field>
      <Field label="Notes"><textarea rows={3} style={S.textarea} value={form.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Persistent notes about this contact (separate from the activity timeline)…"/></Field>
      {contactCustomFields.map(cf=>(
        <Field key={cf.id} label={cf.name}>
          {cf.type==="select"?<select style={S.select} value={form[cf.name]||""} onChange={e=>set(cf.name,e.target.value)}><option value="">Select...</option>{cf.options?.map(o=><option key={o}>{o}</option>)}</select>
          :<input type={cf.type==="url"?"url":cf.type==="number"?"number":"text"} style={S.input} placeholder={cf.placeholder||""} value={form[cf.name]||""} onChange={e=>set(cf.name,e.target.value)}/>}
        </Field>
      ))}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        <button style={S.btnSecondary} onClick={closeModal}>Cancel</button>
        <button style={S.btnPrimary} onClick={()=>{
          if(!form.name)return;
          // Auto-link to existing company by name (relationship requirement)
          const co=form.companyName?companies.find(c=>c.name?.toLowerCase()===form.companyName.toLowerCase()):null;
          const payload={...form,companyId:co?co.id:form.companyId||null};
          type==="addContact"?addContact(payload):updateContact(data.id,payload);
          closeModal();
        }}>
          {type==="addContact"?"Add Contact":"Save Changes"}
        </button>
      </div>
    </Modal>
  );

  if(type==="addCompany"||type==="editCompany") return(
    <Modal title={type==="addCompany"?"Add Company":"Edit Company"} onClose={closeModal} wide>
      <div style={S.grid2}>
        <F form={form} set={set} label="Company Name *" name="name" required/>
        <F form={form} set={set} label="Industry" name="industry" options={INDUSTRIES}/>
        <F form={form} set={set} label="Website" name="website" placeholder="company.com"/>
        <F form={form} set={set} label="Email" name="email" type="email"/>
        <F form={form} set={set} label="Phone" name="phone"/>
        <F form={form} set={set} label="Employees" name="employees" type="number"/>
        <F form={form} set={set} label="Company Owner" name="owner" placeholder="Account manager"/>
        <F form={form} set={set} label="Lifecycle Stage" name="lifecycleStage" options={LIFECYCLE_STAGES}/>
        <F form={form} set={set} label="Lead Status" name="leadStatus" options={LEAD_STATUSES}/>
        <F form={form} set={set} label="City" name="city"/>
        <F form={form} set={set} label="State" name="state"/>
        <Field label="Primary Contact"><select style={S.select} value={form.primaryContactId||""} onChange={e=>set("primaryContactId",e.target.value)}>
          <option value="">— None —</option>
          {contacts.filter(c=>!form.id||c.companyId===form.id||c.companyName===form.name).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select></Field>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        <button style={S.btnSecondary} onClick={closeModal}>Cancel</button>
        <button style={S.btnPrimary} onClick={()=>{if(!form.name)return;type==="addCompany"?addCompany(form):updateCompany(data.id,form);closeModal();}}>
          {type==="addCompany"?"Add Company":"Save Changes"}
        </button>
      </div>
    </Modal>
  );

  if(type==="addDeal"||type==="editDeal") return(
    <Modal title={type==="addDeal"?"Add Deal":"Edit Deal"} onClose={closeModal} wide>
      <F form={form} set={set} label="Deal Title *" name="title" placeholder="Enterprise License Q3" required/>
      <div style={S.grid2}>
        <F form={form} set={set} label="Value (USD)" name="value" type="number" placeholder="50000"/>
        <F form={form} set={set} label="Stage" name="stage" options={stagesFor(entity)}/>
        <F form={form} set={set} label="Close Date" name="closeDate" type="date"/>
        <Field label="Probability (%)"><input type="range" min={0} max={100} value={form.probability||50} onChange={e=>set("probability",+e.target.value)} style={{width:"100%",accentColor:"#1D4ED8"}}/><div style={{fontSize:12,color:"#64748B",textAlign:"right"}}>{form.probability||50}%</div></Field>
        <Field label="Contact *"><select style={{...S.select,borderColor:!form.contactId?"#FCA5A5":undefined}} value={form.contactId||""} onChange={e=>{
          set("contactId",e.target.value);
          // Auto-fill company from the chosen contact if no company set yet
          const c=contacts.find(x=>x.id===e.target.value);
          if(c&&!form.companyId&&(c.companyId||c.companyName)){
            const co=companies.find(x=>x.id===c.companyId)||companies.find(x=>x.name?.toLowerCase()===c.companyName?.toLowerCase());
            if(co){set("companyId",co.id);set("companyName",co.name);}
          }
        }}><option value="">Select contact...</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}{c.companyName?` — ${c.companyName}`:""}</option>)}</select></Field>
        <Field label="Company *"><select style={{...S.select,borderColor:!form.companyId?"#FCA5A5":undefined}} value={form.companyId||""} onChange={e=>{
          set("companyId",e.target.value);
          const co=companies.find(x=>x.id===e.target.value);
          if(co)set("companyName",co.name);
        }}><option value="">Select company...</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <F form={form} set={set} label="Deal Owner" name="owner" placeholder="Account exec"/>
        <F form={form} set={set} label="Deal Type" name="dealType" options={DEAL_TYPES}/>
        <F form={form} set={set} label="Priority" name="priority" options={DEAL_PRIORITIES}/>
        <F form={form} set={set} label="Pipeline" name="pipeline" placeholder="Default"/>
      </div>
      <Field label="Next Step"><input style={S.input} value={form.nextStep||""} onChange={e=>set("nextStep",e.target.value)} placeholder="e.g. Send pricing proposal"/></Field>
      <Field label="Description"><textarea rows={3} style={S.textarea} value={form.description||""} onChange={e=>set("description",e.target.value)}/></Field>
      {form.stage==="Lost"&&(
        <Field label="Closed Lost Reason"><textarea rows={2} style={S.textarea} value={form.lostReason||""} onChange={e=>set("lostReason",e.target.value)} placeholder="Why was this deal lost?"/></Field>
      )}
      {dealCustomFields.map(cf=>(
        <Field key={cf.id} label={cf.name}>
          {cf.type==="select"?<select style={S.select} value={form[cf.name]||""} onChange={e=>set(cf.name,e.target.value)}><option value="">Select...</option>{cf.options?.map(o=><option key={o}>{o}</option>)}</select>
          :<input type="text" style={S.input} value={form[cf.name]||""} onChange={e=>set(cf.name,e.target.value)}/>}
        </Field>
      ))}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        <button style={S.btnSecondary} onClick={closeModal}>Cancel</button>
        <button style={S.btnPrimary} onClick={()=>{
          if(!form.title){showToast?.("Title required","error");return;}
          if(!form.contactId){showToast?.("Pick a contact — every deal must link to one","error");return;}
          if(!form.companyId){showToast?.("Pick a company — every deal must link to one","error");return;}
          type==="addDeal"?addDeal(form):updateDeal(data.id,form);
          closeModal();
        }}>
          {type==="addDeal"?"Add Deal":"Save Changes"}
        </button>
      </div>
    </Modal>
  );

  if(type==="addTask") return(
    <Modal title="Add Task" onClose={closeModal}>
      <F form={form} set={set} label="Task Title *" name="title" placeholder="Follow up on proposal" required/>
      <div style={S.grid2}>
        <F form={form} set={set} label="Due Date" name="dueDate" type="date"/>
        <F form={form} set={set} label="Priority" name="priority" options={PRIORITIES}/>
        <Field label="Linked Contact"><select style={S.select} value={form.contactId||""} onChange={e=>set("contactId",e.target.value)}><option value="">Select contact...</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <Field label="Reminder">
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input type="checkbox" checked={form.reminder||false} onChange={e=>set("reminder",e.target.checked)} style={{cursor:"pointer",accentColor:"#1D4ED8",width:16,height:16}}/>
          <span style={{fontSize:13,color:"#64748B"}}>Enable reminder notification</span>
        </div>
      </Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        <button style={S.btnSecondary} onClick={closeModal}>Cancel</button>
        <button style={S.btnPrimary} onClick={()=>{if(!form.title)return;addTask({...form,contactId:form.contactId||data?.contactId,completed:false});closeModal();}}>Add Task</button>
      </div>
    </Modal>
  );

  if(type==="addEntity") return(
    <Modal title="Add Legal Entity" onClose={closeModal}>
      <div style={{background:"#F1F5F9",borderRadius:8,padding:12,marginBottom:14,fontSize:13,color:"#475569",lineHeight:1.6}}>Each entity is completely isolated — separate contacts, deals, tasks, notes, and email integrations.</div>
      <F form={form} set={set} label="Entity Name *" name="name" placeholder="e.g. Apex Ventures LLC" required/>
      <div style={S.grid2}>
        <F form={form} set={set} label="Entity Type" name="type" options={ETYPES}/>
        <F form={form} set={set} label="Industry" name="industry" options={INDUSTRIES}/>
        <F form={form} set={set} label="Website" name="website" placeholder="yourcompany.com"/>
      </div>
      <Field label="Brand Color">
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {["#1D4ED8","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#F97316","#06B6D4"].map(c=>(
            <div key={c} style={{width:28,height:28,borderRadius:6,background:c,cursor:"pointer",border:form.color===c?"3px solid #0F172A":"2px solid transparent"}} onClick={()=>set("color",c)}/>
          ))}
        </div>
      </Field>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        <button style={S.btnSecondary} onClick={closeModal}>Cancel</button>
        <button style={S.btnPrimary} onClick={()=>{if(!form.name)return;addEntity({...form,color:form.color||"#1D4ED8"});closeModal();}}>Create Entity</button>
      </div>
    </Modal>
  );

  if(type==="composeEmail") return(
    <Modal title="Compose Email" onClose={closeModal} wide>
      <Field label="To"><input style={S.input} value={form.to||data?.to||""} onChange={e=>set("to",e.target.value)}/></Field>
      <F form={form} set={set} label="Subject" name="subject" placeholder="Enter subject..."/>
      <Field label="Message">
        <textarea style={{...S.textarea,minHeight:180}} placeholder="Write your email..." value={form.body||""} onChange={e=>set("body",e.target.value)}/>
      </Field>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
        <p style={{fontSize:12,color:"#475569",margin:0}}>Email will be logged on the contact timeline.</p>
        <div style={{display:"flex",gap:8}}>
          <button style={S.btnSecondary} onClick={closeModal}>Discard</button>
          <button style={S.btnPrimary} onClick={()=>{if(!form.subject&&!form.body)return;const content=`To: ${form.to||data?.to}\nSubject: ${form.subject||"(no subject)"}\n\n${form.body||""}`;if(data?.contactId)addNote({contactId:data.contactId,content,type:"email"});showToast("Email sent & logged!");closeModal();}}><Ic d={I.send} size={14}/>Send Email</button>
        </div>
      </div>
    </Modal>
  );

  if(type==="connectEmail") return(
    <Modal title="Connect Email" onClose={closeModal}>
      <p style={{fontSize:13,color:"#64748B",marginBottom:16}}>Connect an email account to send emails directly from contact profiles.</p>
      <div style={{display:"flex",gap:10,flexDirection:"column"}}>
        {EMAIL_PROVIDERS.map(prov=>(
          <button key={prov.id} style={{...S.btnSecondary,justifyContent:"flex-start",padding:"12px 16px"}} onClick={closeModal}>
            <div style={{width:28,height:28,background:prov.color+"20",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:prov.color,fontSize:14}}>{prov.logo}</div>
            Connect {prov.label}
          </button>
        ))}
      </div>
      <p style={{fontSize:12,color:"#475569",marginTop:12}}>→ Go to Settings → Email Integration to connect your account.</p>
    </Modal>
  );

  if(type==="enrollSequence") return(
    <Modal title="Enroll in Sequence" onClose={closeModal}>
      <p style={{fontSize:13,color:"#64748B",marginBottom:16}}>Select a sequence to enroll this contact in.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {(sequences||[]).filter(s=>s.entityId===activeEntityId&&s.active).map(seq=>(
          <button key={seq.id} style={{...S.btnSecondary,justifyContent:"flex-start",padding:"12px 16px"}} onClick={()=>{addEnrollment({contactId:data?.contactId,sequenceId:seq.id,currentStep:0,status:"active",enrolledAt:new Date().toISOString()});showToast(`Enrolled in "${seq.name}"`);closeModal();}}>
            <Ic d={I.seq} size={15} c="#1D4ED8"/>
            <div>
              <div style={{fontWeight:600,color:"#0F172A"}}>{seq.name}</div>
              <div style={{fontSize:11,color:"#64748B"}}>{seq.steps.length} steps</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );

  if(type==="buildQuote") return <QuoteBuilder data={data} contacts={contacts} products={products} activeEntityId={activeEntityId} onClose={closeModal} addNote={addNote} addQuote={addQuote} showToast={showToast}/>;

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════
function QuoteBuilder({data,contacts,products,activeEntityId,onClose,addNote,addQuote,showToast}){
  const [items,setItems]=useState([{productId:"",qty:1,price:0,name:"",description:""}]);
  const [notes,setNotes]=useState("");
  const [title,setTitle]=useState("Proposal");
  const eProducts=products.filter(p=>p.entityId===activeEntityId);
  const contact=contacts.find(c=>c.id===data?.contactId);
  const total=items.reduce((s,i)=>s+(i.qty*(i.price||0)),0);
  const addItem=()=>setItems(p=>[...p,{productId:"",qty:1,price:0,name:"",description:""}]);
  const updateItem=(idx,field,val)=>setItems(p=>p.map((it,i)=>{if(i!==idx)return it;const updated={...it,[field]:val};if(field==="productId"){const prod=eProducts.find(p=>p.id===val);if(prod){updated.name=prod.name;updated.price=prod.price;updated.description=prod.description;}}return updated;}));
  const removeItem=(idx)=>setItems(p=>p.filter((_,i)=>i!==idx));

  const generateQuoteText=()=>`PROPOSAL: ${title}
${contact?`To: ${contact.name} — ${contact.companyName||""}`:""} 
Date: ${fmtDate(new Date())}
${"─".repeat(50)}

LINE ITEMS:
${items.map(it=>`  ${it.name||"Item"} (x${it.qty}) ............... ${fmt$(it.qty*it.price)}`).join("\n")}

${"─".repeat(50)}
TOTAL: ${fmt$(total)}

${notes?`\nNotes:\n${notes}`:""}

This proposal is valid for 30 days.`;

  const saveQuote=()=>{
    if(!data?.contactId){showToast("Pick a contact first","error");return;}
    if(addQuote){
      addQuote({contactId:data.contactId,dealId:data.dealId||null,title,items:items.filter(it=>it.name||it.productId),notes,total});
    }
    addNote({contactId:data.contactId,dealId:data.dealId||null,content:generateQuoteText(),type:"note"});
    showToast("Quote saved");
    onClose();
  };

  const copyQuote=()=>{
    navigator.clipboard?.writeText(generateQuoteText()).catch(()=>{});
    showToast("Quote copied to clipboard!");
  };

  return(
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{...S.modal,maxWidth:680}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:700,color:"#0F172A",margin:0}}>Build Quote / Proposal</h2>
          <button style={S.btnGhost} onClick={onClose}><Ic d={I.x} size={18}/></button>
        </div>
        <div style={{display:"flex",gap:12,marginBottom:16,alignItems:"center"}}>
          <div style={{flex:1}}><label style={S.label}>Proposal Title</label><input style={S.input} value={title} onChange={e=>setTitle(e.target.value)}/></div>
          {contact&&<div style={{flexShrink:0,background:"#F1F5F9",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#475569"}}>For: <strong style={{color:"#0F172A"}}>{contact.name}</strong></div>}
        </div>
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <label style={S.label}>Line Items</label>
            <button style={{...S.btnSecondary,fontSize:12,padding:"4px 10px"}} onClick={addItem}><Ic d={I.plus} size={12}/>Add Item</button>
          </div>
          {items.map((item,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr auto",gap:8,marginBottom:8,alignItems:"center"}}>
              <div>
                <select style={{...S.select,marginBottom:4}} value={item.productId||""} onChange={e=>updateItem(i,"productId",e.target.value)}>
                  <option value="">Custom item...</option>
                  {eProducts.map(p=><option key={p.id} value={p.id}>{p.name} — {fmt$(p.price)}</option>)}
                </select>
                <input style={{...S.input,fontSize:12}} placeholder="Item name" value={item.name} onChange={e=>updateItem(i,"name",e.target.value)}/>
              </div>
              <div>
                <label style={{...S.label,marginBottom:3}}>Qty</label>
                <input type="number" style={S.input} min={1} value={item.qty} onChange={e=>updateItem(i,"qty",+e.target.value)}/>
              </div>
              <div>
                <label style={{...S.label,marginBottom:3}}>Unit Price</label>
                <input type="number" style={S.input} min={0} value={item.price} onChange={e=>updateItem(i,"price",+e.target.value)}/>
              </div>
              <div style={{paddingTop:18,display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:12,fontWeight:600,color:"#10B981",whiteSpace:"nowrap"}}>{fmt$(item.qty*item.price)}</span>
                <button style={{...S.btnGhost,color:"#EF4444",padding:3}} onClick={()=>removeItem(i)}><Ic d={I.x} size={13}/></button>
              </div>
            </div>
          ))}
        </div>
        <div style={{background:"#F8FAFC",borderRadius:8,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,border:"1px solid #E9EEF6"}}>
          <span style={{fontSize:14,fontWeight:700,color:"#0F172A"}}>Total</span>
          <span style={{fontSize:22,fontWeight:800,color:"#10B981",fontFamily:"'Sora',sans-serif"}}>{fmt$(total)}</span>
        </div>
        <Field label="Additional Notes (optional)">
          <textarea style={{...S.textarea,minHeight:60}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Payment terms, validity period, special conditions..."/>
        </Field>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:12}}>
          <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
          <button style={S.btnSecondary} onClick={copyQuote}><Ic d={I.copy} size={13}/>Copy as Text</button>
          {data?.contactId&&<button style={S.btnPrimary} onClick={saveQuote}><Ic d={I.note} size={13}/>Save to Contact</button>}
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App({session,onLogout,demoMode=false}={}){
  const D = demoMode ? DEMO_FULL : DEMO;
  const [entities,setEntities]=useState(D.entities);
  const [activeEntityId,setActiveEntityId]=useState(demoMode?"e1":"e3");
  const [contacts,setContacts]=useState(D.contacts);
  const [companies,setCompanies]=useState(D.companies);
  const [deals,setDeals]=useState(D.deals);
  const [tasks,setTasks]=useState(D.tasks);
  const [notes,setNotes]=useState(D.notes);
  const [emailInts,setEmailInts]=useState(D.emailIntegrations);
  const [products,setProducts]=useState(D.products);
  const [sequences,setSequences]=useState(D.sequences);
  const [templates,setTemplates]=useState(D.templates);
  const [forms,setForms]=useState(D.forms);
  const [automations,setAutomations]=useState(D.automations);
  const [docs,setDocs]=useState(D.docs);
  const [quotes,setQuotes]=useState(D.quotes);
  const [customFields,setCustomFields]=useState(D.customFields);
  const [enrollments,setEnrollments]=useState(D.enrollments);
  // New state
  const [timeEntries,setTimeEntries]=useState(D.timeEntries);
  const [invoices,setInvoices]=useState(D.invoices);
  const [meetings,setMeetings]=useState(D.meetings);
  const [webhooks,setWebhooks]=useState(D.webhooks);
  const [portalTokens,setPortalTokens]=useState(D.portalTokens);
  const [emailThreads,setEmailThreads]=useState(D.emailThreads);
  const [availability,setAvailability]=useState(D.availability);
  const [invoiceCounter,setInvoiceCounter]=useState(D.invoiceCounter);
  const [signatures,setSignatures]=useState([]);
  // UI state
  const [view,setView]=useState("dashboard");
  const [selContact,setSelContact]=useState(null);
  const [selCompany,setSelCompany]=useState(null);
  const [selDeal,setSelDeal]=useState(null);
  const [search,setSearch]=useState("");
  const [modal,setModal]=useState(null);
  const [toast,setToast]=useState(null);
  const [entityMenuOpen,setEntityMenuOpen]=useState(false);
  const [sigModal,setSigModal]=useState(null);

  const entity=entities.find(e=>e.id===activeEntityId)||entities[0];
  const ec=contacts.filter(c=>c.entityId===activeEntityId);
  const eco=companies.filter(c=>c.entityId===activeEntityId);
  const ed=deals.filter(d=>d.entityId===activeEntityId);
  const et=tasks.filter(t=>t.entityId===activeEntityId);
  const en=notes.filter(n=>n.entityId===activeEntityId);
  const eei=emailInts.filter(i=>i.entityId===activeEntityId);

  // ─── PERSISTENCE ──────────────────────────────────────────────────────────
  // loadedRef gates writes: until the initial load from Supabase completes,
  // save() must be a no-op. Otherwise the save useEffects below fire on mount
  // with the initial DEMO=[] state and overwrite the user's real data before
  // the async load can read it back.
  const loadedRef=useRef(false);
  useEffect(()=>{
    if(demoMode){loadedRef.current=true;return;}
    loadedRef.current=false;
    let cancelled=false;
    (async()=>{
      const load=async(key,setter)=>{
        try{
          const r=await window.storage?.get(key);
          if(cancelled)return;
          if(r?.value)setter(JSON.parse(r.value));
        }catch(e){console.error("[Persistence] load failed for",key,e);}
      };
      const keys=[["crm:entities",setEntities],["crm:contacts",setContacts],["crm:companies",setCompanies],["crm:deals",setDeals],["crm:tasks",setTasks],["crm:notes",setNotes],["crm:emailInts",setEmailInts],["crm:products",setProducts],["crm:sequences",setSequences],["crm:templates",setTemplates],["crm:forms",setForms],["crm:automations",setAutomations],["crm:docs",setDocs],["crm:quotes",setQuotes],["crm:customFields",setCustomFields],["crm:enrollments",setEnrollments],["crm:timeEntries",setTimeEntries],["crm:invoices",setInvoices],["crm:meetings",setMeetings],["crm:webhooks",setWebhooks],["crm:portalTokens",setPortalTokens],["crm:emailThreads",setEmailThreads],["crm:availability",setAvailability],["crm:invoiceCounter",setInvoiceCounter],["crm:signatures",setSignatures]];
      for(const [k,s] of keys)await load(k,s);
      try{
        const r=await window.storage?.get("crm:activeEntityId");
        if(!cancelled&&r?.value)setActiveEntityId(JSON.parse(r.value));
      }catch(e){console.error("[Persistence] load failed for crm:activeEntityId",e);}
      if(!cancelled){
        loadedRef.current=true;
        console.log("[Persistence] initial load complete — saves enabled");
      }
    })();
    return()=>{cancelled=true;};
  },[demoMode]);

  const [saveStatus,setSaveStatus]=useState({state:"idle",lastSavedAt:null,lastError:null});
  const inFlightRef=useRef(0);
  const save=async(key,val)=>{
    if(demoMode)return;
    if(!loadedRef.current)return; // skip until initial load completes
    inFlightRef.current+=1;
    setSaveStatus(s=>({...s,state:"saving"}));
    try{
      await window.storage?.set(key,JSON.stringify(val));
      inFlightRef.current=Math.max(0,inFlightRef.current-1);
      if(inFlightRef.current===0){
        setSaveStatus({state:"saved",lastSavedAt:new Date().toISOString(),lastError:null});
      }
    }catch(e){
      console.error("[Persistence] save failed for",key,e);
      inFlightRef.current=Math.max(0,inFlightRef.current-1);
      setSaveStatus({state:"error",lastSavedAt:null,lastError:String(e?.message||e)});
    }
  };
  useEffect(()=>{save("crm:entities",entities);},[entities]);
  useEffect(()=>{save("crm:contacts",contacts);},[contacts]);
  useEffect(()=>{save("crm:companies",companies);},[companies]);
  useEffect(()=>{save("crm:deals",deals);},[deals]);
  useEffect(()=>{save("crm:tasks",tasks);},[tasks]);
  useEffect(()=>{save("crm:notes",notes);},[notes]);
  useEffect(()=>{save("crm:emailInts",emailInts);},[emailInts]);
  useEffect(()=>{save("crm:products",products);},[products]);
  useEffect(()=>{save("crm:sequences",sequences);},[sequences]);
  useEffect(()=>{save("crm:templates",templates);},[templates]);
  useEffect(()=>{save("crm:forms",forms);},[forms]);
  useEffect(()=>{save("crm:automations",automations);},[automations]);
  useEffect(()=>{save("crm:docs",docs);},[docs]);
  useEffect(()=>{save("crm:quotes",quotes);},[quotes]);
  useEffect(()=>{save("crm:customFields",customFields);},[customFields]);
  useEffect(()=>{save("crm:enrollments",enrollments);},[enrollments]);
  useEffect(()=>{save("crm:timeEntries",timeEntries);},[timeEntries]);
  useEffect(()=>{save("crm:invoices",invoices);},[invoices]);
  useEffect(()=>{save("crm:meetings",meetings);},[meetings]);
  useEffect(()=>{save("crm:webhooks",webhooks);},[webhooks]);
  useEffect(()=>{save("crm:portalTokens",portalTokens);},[portalTokens]);
  useEffect(()=>{save("crm:emailThreads",emailThreads);},[emailThreads]);
  useEffect(()=>{save("crm:availability",availability);},[availability]);
  useEffect(()=>{save("crm:invoiceCounter",invoiceCounter);},[invoiceCounter]);
  useEffect(()=>{save("crm:signatures",signatures);},[signatures]);
  useEffect(()=>{save("crm:activeEntityId",activeEntityId);},[activeEntityId]);

  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),3500);};

  // ─── WEBHOOK FIRE ─────────────────────────────────────────────────────────
  const fireWebhook=(event,data={})=>{
    webhooks.filter(w=>w.entityId===activeEntityId&&w.active&&w.events.includes(event)).forEach(wh=>{
      updateWebhook(wh.id,{lastFired:new Date().toISOString(),lastStatus:200});
      // In production this would call: fetch(wh.url, {method:'POST', body: JSON.stringify({event, data, timestamp: new Date().toISOString()})})
    });
  };

  // ─── AUTOMATION RUNNER ────────────────────────────────────────────────────
  const runAutomations=(trigger,ctx={})=>{
    automations.filter(a=>a.entityId===activeEntityId&&a.active&&a.trigger===trigger).forEach(auto=>{
      if(auto.action==="create_task"&&auto.actionData?.title){
        const due=new Date();due.setDate(due.getDate()+(auto.actionData.daysOut||0));
        setTasks(p=>[...p,{id:uid(),entityId:activeEntityId,contactId:ctx.contactId,title:auto.actionData.title,dueDate:due.toISOString().split("T")[0],completed:false,priority:auto.actionData.priority||"medium",reminder:false,createdAt:new Date().toISOString()}]);
        showToast(`Auto-task: "${auto.actionData.title}"`);
      }
      if(auto.action==="add_note"&&auto.actionData?.content){
        setNotes(p=>[...p,{id:uid(),entityId:activeEntityId,contactId:ctx.contactId,content:auto.actionData.content,type:"note",createdAt:new Date().toISOString()}]);
      }
    });
  };

  const openModal=(type,data={})=>setModal({type,data});
  const closeModal=()=>setModal(null);

  // ─── CONTACTS ─────────────────────────────────────────────────────────────
  const addContact=(data)=>{const c={id:uid(),entityId:activeEntityId,...data,createdAt:new Date().toISOString()};setContacts(p=>[...p,c]);runAutomations("new_contact",{contactId:c.id});fireWebhook("contact.created",c);return c;};
  const updateContact=(id,data)=>setContacts(p=>p.map(c=>c.id===id?{...c,...data}:c));
  const deleteContact=(id)=>{setContacts(p=>p.filter(c=>c.id!==id));if(selContact===id)setSelContact(null);};

  // ─── COMPANIES ────────────────────────────────────────────────────────────
  const addCompany=(data)=>setCompanies(p=>[...p,{id:uid(),entityId:activeEntityId,...data,createdAt:new Date().toISOString()}]);
  const updateCompany=(id,data)=>setCompanies(p=>p.map(c=>c.id===id?{...c,...data}:c));
  const deleteCompany=(id)=>setCompanies(p=>p.filter(c=>c.id!==id));

  // ─── DEALS ────────────────────────────────────────────────────────────────
  const addDeal=(data)=>{
    const d={id:uid(),entityId:activeEntityId,...data,createdAt:new Date().toISOString(),lastContacted:new Date().toISOString()};
    setDeals(p=>[...p,d]);
    runAutomations("deal_created",{contactId:d.contactId});
    fireWebhook("deal.created",d);
    if(d.stage){
      runAutomations("stage_change",{contactId:d.contactId});
      if(d.stage==="Won"){runAutomations("deal_won",{contactId:d.contactId});fireWebhook("deal.won",d);}
    }
    touchLastContacted(d.contactId);
    return d;
  };
  const updateDeal=(id,data)=>{
    setDeals(p=>p.map(d=>{
      if(d.id!==id)return d;
      const u={...d,...data,lastContacted:new Date().toISOString()};
      if(data.stage==="Won"&&d.stage!=="Won"){runAutomations("deal_won",{contactId:d.contactId});fireWebhook("deal.won",u);}
      if(data.stage&&data.stage!==d.stage)runAutomations("stage_change",{contactId:d.contactId});
      return u;
    }));
    const dl=deals.find(d=>d.id===id);
    touchLastContacted(dl?.contactId);
  };
  const deleteDeal=(id)=>setDeals(p=>p.filter(d=>d.id!==id));

  // ─── TASKS ────────────────────────────────────────────────────────────────
  const addTask=(data)=>setTasks(p=>[...p,{id:uid(),entityId:activeEntityId,...data,createdAt:new Date().toISOString()}]);
  const updateTask=(id,data)=>setTasks(p=>p.map(t=>t.id===id?{...t,...data}:t));
  const deleteTask=(id)=>setTasks(p=>p.filter(t=>t.id!==id));

  // ─── NOTES ────────────────────────────────────────────────────────────────
  const touchLastContacted=(contactId)=>{
    if(!contactId)return;
    const ct=contacts.find(c=>c.id===contactId);
    if(!ct)return;
    const now=new Date().toISOString();
    // Touch the contact's company (by id or by name)
    const co=companies.find(c=>c.id===ct.companyId)||companies.find(c=>c.name?.toLowerCase()===(ct.companyName||"").toLowerCase());
    if(co)setCompanies(p=>p.map(x=>x.id===co.id?{...x,lastContacted:now}:x));
  };
  const addNote=(data)=>{
    setNotes(p=>[...p,{id:uid(),entityId:activeEntityId,...data,createdAt:new Date().toISOString()}]);
    touchLastContacted(data.contactId);
  };
  const updateNote=(id,data)=>setNotes(p=>p.map(n=>n.id===id?{...n,...data}:n));
  const deleteNote=(id)=>setNotes(p=>p.filter(n=>n.id!==id));

  // ─── EMAIL ────────────────────────────────────────────────────────────────
  const connectEmail=(provider,email)=>setEmailInts(p=>[...p,{id:uid(),entityId:activeEntityId,provider,email,connectedAt:new Date().toISOString()}]);
  const disconnectEmail=(id)=>setEmailInts(p=>p.filter(i=>i.id!==id));
  const addEmailThread=(data)=>setEmailThreads(p=>[...p,{id:uid(),entityId:activeEntityId,...data}]);
  const addEmailMessage=(threadId,msg)=>setEmailThreads(p=>p.map(t=>t.id===threadId?{...t,messages:[...t.messages,msg],lastActivity:new Date().toISOString()}:t));

  // ─── PRODUCTS ─────────────────────────────────────────────────────────────
  const addProduct=(data)=>setProducts(p=>[...p,{id:uid(),entityId:activeEntityId,...data}]);
  const updateProduct=(id,data)=>setProducts(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteProduct=(id)=>setProducts(p=>p.filter(x=>x.id!==id));

  // ─── SEQUENCES ────────────────────────────────────────────────────────────
  const addSequence=(data)=>setSequences(p=>[...p,{id:uid(),entityId:activeEntityId,...data,enrolledCount:0}]);
  const updateSequence=(id,data)=>setSequences(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteSequence=(id)=>setSequences(p=>p.filter(x=>x.id!==id));

  // ─── TEMPLATES ────────────────────────────────────────────────────────────
  const addTemplate=(data)=>setTemplates(p=>[...p,{id:uid(),entityId:activeEntityId,...data}]);
  const updateTemplate=(id,data)=>setTemplates(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteTemplate=(id)=>setTemplates(p=>p.filter(x=>x.id!==id));

  // ─── QUOTES ───────────────────────────────────────────────────────────────
  const addQuote=(data)=>{const q={id:uid(),entityId:activeEntityId,number:`Q-${String((quotes||[]).filter(x=>x.entityId===activeEntityId).length+1).padStart(4,"0")}`,createdAt:new Date().toISOString(),status:"Draft",...data};setQuotes(p=>[...p,q]);return q;};
  const updateQuote=(id,data)=>setQuotes(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteQuote=(id)=>setQuotes(p=>p.filter(x=>x.id!==id));

  // ─── FORMS ────────────────────────────────────────────────────────────────
  const addForm=(data)=>setForms(p=>[...p,{id:uid(),entityId:activeEntityId,...data}]);
  const updateForm=(id,data)=>setForms(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteForm=(id)=>setForms(p=>p.filter(x=>x.id!==id));

  // ─── AUTOMATIONS ──────────────────────────────────────────────────────────
  const addAutomation=(data)=>setAutomations(p=>[...p,{id:uid(),entityId:activeEntityId,...data}]);
  const updateAutomation=(id,data)=>setAutomations(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteAutomation=(id)=>setAutomations(p=>p.filter(x=>x.id!==id));

  // ─── DOCS ─────────────────────────────────────────────────────────────────
  const addDoc=(data,isUpdate=false)=>{if(isUpdate){setDocs(p=>p.map(d=>d.id===data.id?data:d));return;}setDocs(p=>[...p,{id:uid(),entityId:activeEntityId,...data}]);};
  const deleteDoc=(id)=>setDocs(p=>p.filter(d=>d.id!==id));

  // ─── CUSTOM FIELDS ────────────────────────────────────────────────────────
  const addCustomField=(data)=>setCustomFields(p=>[...p,{id:uid(),entityId:activeEntityId,...data}]);
  const deleteCustomField=(id)=>setCustomFields(p=>p.filter(x=>x.id!==id));

  // ─── ENROLLMENTS ──────────────────────────────────────────────────────────
  const addEnrollment=(data)=>setEnrollments(p=>[...p,{id:uid(),...data}]);
  const updateEnrollment=(id,data)=>setEnrollments(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteEnrollment=(id)=>setEnrollments(p=>p.filter(x=>x.id!==id));

  // ─── TIME TRACKING ────────────────────────────────────────────────────────
  const addTimeEntry=(data)=>{setTimeEntries(p=>[...p,{id:uid(),...data}]);fireWebhook("time.logged",data);};
  const updateTimeEntry=(id,data)=>setTimeEntries(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteTimeEntry=(id)=>setTimeEntries(p=>p.filter(x=>x.id!==id));

  // ─── INVOICES ─────────────────────────────────────────────────────────────
  const addInvoice=(data)=>{const inv={id:uid(),...data};setInvoices(p=>[...p,inv]);fireWebhook("invoice.sent",inv);return inv;};
  const updateInvoice=(id,data)=>{setInvoices(p=>p.map(x=>{if(x.id!==id)return x;const u={...x,...data};if(data.status==="Paid"&&x.status!=="Paid")fireWebhook("invoice.paid",u);return u;}));};
  const deleteInvoice=(id)=>setInvoices(p=>p.filter(x=>x.id!==id));

  // ─── MEETINGS ─────────────────────────────────────────────────────────────
  const addMeeting=(data)=>{
    const m={id:uid(),...data};
    setMeetings(p=>[...p,m]);
    fireWebhook("meeting.booked",m);
    touchLastContacted(m.contactId);
    return m;
  };
  const updateMeeting=(id,data)=>setMeetings(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteMeeting=(id)=>setMeetings(p=>p.filter(x=>x.id!==id));

  // ─── WEBHOOKS ─────────────────────────────────────────────────────────────
  const addWebhook=(data)=>setWebhooks(p=>[...p,{id:uid(),...data}]);
  const updateWebhook=(id,data)=>setWebhooks(p=>p.map(x=>x.id===id?{...x,...data}:x));
  const deleteWebhook=(id)=>setWebhooks(p=>p.filter(x=>x.id!==id));

  // ─── PORTAL TOKENS ────────────────────────────────────────────────────────
  const buildPortalPayload=(token)=>{
    const ent=entities.find(e=>e.id===token.entityId);
    const ct=contacts.find(c=>c.id===token.contactId);
    const cInvoices=invoices.filter(i=>i.entityId===token.entityId&&i.contactId===token.contactId).map(i=>({
      number:i.number,createdAt:i.createdAt,dueDate:i.dueDate,status:i.status,
      total:(i.items||[]).reduce((s,it)=>s+(+it.quantity||0)*(+it.unitPrice||0),0),
    }));
    const cDocs=docs.filter(d=>d.entityId===token.entityId&&d.contactId===token.contactId).map(d=>({id:d.id,name:d.name,status:d.status,createdAt:d.createdAt}));
    const cQuotes=quotes.filter(q=>q.entityId===token.entityId&&q.contactId===token.contactId).map(q=>({number:q.number,title:q.title,total:q.total,status:q.status,createdAt:q.createdAt}));
    return {
      workspace:ent?{name:ent.name,color:ent.color}:null,
      contact:ct?{name:ct.name,email:ct.email}:null,
      invoices:cInvoices,docs:cDocs,quotes:cQuotes,
    };
  };
  const addPortalToken=(data)=>{
    const tok={id:uid(),...data};
    setPortalTokens(p=>[...p,tok]);
    if(!demoMode)writePortalSnapshot(tok.token,buildPortalPayload(tok));
    return tok;
  };
  const refreshPortalSnapshot=(tokenId)=>{
    const t=portalTokens.find(x=>x.id===tokenId);
    if(!t)return;
    if(!demoMode)writePortalSnapshot(t.token,buildPortalPayload(t));
    showToast("Portal data refreshed");
  };
  const deletePortalToken=(id)=>{
    const t=portalTokens.find(x=>x.id===id);
    setPortalTokens(p=>p.filter(x=>x.id!==id));
    if(t&&!demoMode)deletePortalSnapshot(t.token);
  };

  // ─── AVAILABILITY ─────────────────────────────────────────────────────────
  const updateAvailability=(entityId,data)=>setAvailability(p=>({...p,[entityId]:{...(p[entityId]||{}), ...data}}));

  // ─── SIGNATURES ───────────────────────────────────────────────────────────
  const addSignature=(data)=>{setSignatures(p=>[...p,{id:uid(),...data}]);addDoc({...data.doc,status:"Signed"},true);};
  const deleteSignature=(id)=>setSignatures(p=>p.filter(x=>x.id!==id));

  // ─── ENTITY ───────────────────────────────────────────────────────────────
  const addEntity=(data)=>{const e={id:uid(),...data};setEntities(p=>[...p,e]);setActiveEntityId(e.id);setView("dashboard");showToast(`Switched to ${e.name}`);};

  // ─── NAVIGATION ───────────────────────────────────────────────────────────
  const overdueTasks=et.filter(t=>!t.completed&&new Date(t.dueDate)<new Date()).length;
  const unpaidInvoices=invoices.filter(i=>i.entityId===activeEntityId&&["Sent","Viewed","Overdue"].includes(i.status)).length;
  const unreadEmails=emailThreads.filter(t=>t.entityId===activeEntityId&&t.messages[t.messages.length-1]?.direction==="inbound").length;

  const NAV=[
    {id:"dashboard",label:"Dashboard",icon:I.home},
    {id:"contacts",label:"Contacts",icon:I.users,badge:ec.length,badgeColor:"rgba(255,255,255,0.15)"},
    {id:"companies",label:"Companies",icon:I.building},
    {id:"deals",label:"Pipeline",icon:I.layers},
    {id:"tasks",label:"Tasks",icon:I.check,badge:overdueTasks,badgeColor:"#EF4444"},
    {id:"inbox",label:"Inbox",icon:I.inbox,badge:unreadEmails,badgeColor:"#1D4ED8"},
    {id:"scheduler",label:"Scheduler",icon:I.meet},
    {id:"time",label:"Time Tracking",icon:I.clock},
    {id:"invoices",label:"Invoices",icon:I.invoice,badge:unpaidInvoices,badgeColor:"#F59E0B"},
    {id:"portal",label:"Client Portal",icon:I.portal},
    {id:"import",label:"Import",icon:I.import},
    {id:"sequences",label:"Sequences",icon:I.seq},
    {id:"forms",label:"Web Forms",icon:I.form},
    {id:"automation",label:"Automation",icon:I.zap},
    {id:"reports",label:"Reports",icon:I.bar},
    {id:"settings",label:"Settings",icon:I.gear},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',sans-serif",background:"#F1F5F9",overflow:"hidden"}}>
      {demoMode&&(
        <div style={{flexShrink:0,background:"linear-gradient(90deg,#F59E0B 0%,#F97316 100%)",color:"#FFFFFF",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"center",gap:14,fontSize:13,fontWeight:600,boxShadow:"0 1px 3px rgba(0,0,0,0.1)"}}>
          <span style={{background:"rgba(0,0,0,0.18)",padding:"2px 9px",borderRadius:4,fontSize:11,fontWeight:800,letterSpacing:1}}>DEMO MODE</span>
          <span style={{fontWeight:500}}>Sample data — your changes are session-only and won't be saved.</span>
          <a href="/" style={{marginLeft:8,background:"#FFFFFF",color:"#0B1E3F",padding:"5px 12px",borderRadius:6,textDecoration:"none",fontSize:12,fontWeight:700}}>Sign up to save your work</a>
        </div>
      )}
      <div style={{display:"flex",flex:1,minHeight:0,overflow:"hidden"}}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@700;800&display=swap" rel="stylesheet"/>

      {/* ─── SIDEBAR ─────────────────────────────────── */}
      <div style={{width:222,background:"#0F2044",display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
        <div style={{padding:"16px 16px 10px",borderBottom:"1px solid #162B55"}}>
          <div style={{fontFamily:"'Sora',sans-serif",fontSize:20,fontWeight:800,color:"#FFFFFF",letterSpacing:"-0.5px"}}>Nex<span style={{color:entity?.color||"#3B82F6"}}>CRM</span></div>
          <div style={{fontSize:10,color:"#475569",letterSpacing:".5px",textTransform:"uppercase",marginTop:1}}>Multi-Entity Platform</div>
        </div>
        {/* Entity Switcher */}
        <div style={{padding:"8px 10px 4px",position:"relative"}}>
          <button style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid #1E3A6B",borderRadius:8,padding:"7px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:7,color:"#E2E8F0",fontSize:12}} onClick={()=>setEntityMenuOpen(o=>!o)}>
            <span style={{display:"flex",alignItems:"center",gap:7,flex:1,minWidth:0}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:entity?.color||"#3B82F6",flexShrink:0}}/>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600}}>{entity?.name}</span>
            </span>
            <Ic d={I.down} size={12} c="#475569"/>
          </button>
          {entityMenuOpen&&(
            <div style={{position:"absolute",top:"calc(100% + 2px)",left:10,right:10,background:"#162B55",border:"1px solid #1E3A6B",borderRadius:10,zIndex:50,overflow:"hidden",boxShadow:"0 8px 24px rgba(0,0,0,.4)"}}>
              {entities.map(e=>(
                <div key={e.id} style={{padding:"9px 12px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,background:e.id===activeEntityId?"rgba(255,255,255,0.1)":"transparent",borderBottom:"1px solid #1E3A6B"}}
                  onClick={()=>{setActiveEntityId(e.id);setEntityMenuOpen(false);setSelContact(null);showToast(`Switched to ${e.name}`);}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:e.color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"#E2E8F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div><div style={{fontSize:10,color:"#475569"}}>{e.type}</div></div>
                  {e.id===activeEntityId&&<Ic d={I.ok} size={12} c="#10B981"/>}
                </div>
              ))}
              <div style={{padding:8}}><button style={{...S.btnPrimary,width:"100%",justifyContent:"center",fontSize:11,padding:"6px"}} onClick={()=>{setEntityMenuOpen(false);openModal("addEntity");}}><Ic d={I.plus} size={12}/>New Entity</button></div>
            </div>
          )}
        </div>
        {/* Navigation */}
        <nav style={{flex:1,overflowY:"auto",padding:"4px 0"}}>
          {NAV.map(item=>{
            const active=view===item.id&&(item.id!=="contacts"||!selContact);
            return(
              <button key={item.id} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"7px 14px",cursor:"pointer",fontSize:12,fontWeight:active?600:400,color:active?"#FFFFFF":"#94A3B8",background:active?"rgba(255,255,255,0.10)":"transparent",border:"none",borderLeft:`3px solid ${active?entity?.color||"#3B82F6":"transparent"}`,transition:"all .1s",textAlign:"left"}}
                onClick={()=>{setView(item.id);if(item.id!=="contacts")setSelContact(null);if(item.id!=="companies")setSelCompany(null);if(item.id!=="deals")setSelDeal(null);}}>
                <Ic d={item.icon} size={14}/>
                <span style={{flex:1}}>{item.label}</span>
                {item.badge>0&&<span style={{background:item.badgeColor||"rgba(255,255,255,0.15)",color:item.badgeColor==="rgba(255,255,255,0.15)"?"#94A3B8":"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{item.badge}</span>}
              </button>
            );
          })}
        </nav>
        <div style={{padding:"10px 14px",borderTop:"1px solid #162B55"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:session?8:0}}>
            <div style={{width:26,height:26,borderRadius:"50%",background:entity?.color||"#3B82F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>{(session?.user?.email?.[0]||entity?.name?.[0]||"?").toUpperCase()}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:600,color:"#CBD5E1",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:145}}>{session?.user?.email||entity?.name}</div>
              <div style={{fontSize:9,color:"#475569"}}>{session?"Signed in":entity?.type}</div>
            </div>
          </div>
          {!demoMode&&(
            <div title={saveStatus.lastError||(saveStatus.lastSavedAt?`Last saved ${new Date(saveStatus.lastSavedAt).toLocaleTimeString()}`:"Waiting for first change")} style={{
              display:"flex",alignItems:"center",justifyContent:"center",gap:6,
              padding:"5px 8px",marginBottom:6,borderRadius:6,fontSize:10,fontWeight:600,
              background:saveStatus.state==="error"?"rgba(239,68,68,0.15)":saveStatus.state==="saving"?"rgba(245,158,11,0.15)":saveStatus.state==="saved"?"rgba(16,185,129,0.15)":"rgba(255,255,255,0.04)",
              color:saveStatus.state==="error"?"#FCA5A5":saveStatus.state==="saving"?"#FCD34D":saveStatus.state==="saved"?"#86EFAC":"#94A3B8",
              border:`1px solid ${saveStatus.state==="error"?"#7F1D1D":saveStatus.state==="saving"?"#78350F":saveStatus.state==="saved"?"#064E3B":"#1E3A6B"}`,
            }}>
              <span style={{width:6,height:6,borderRadius:"50%",background:saveStatus.state==="error"?"#EF4444":saveStatus.state==="saving"?"#F59E0B":saveStatus.state==="saved"?"#10B981":"#64748B"}}/>
              {saveStatus.state==="saving"?"Saving…":saveStatus.state==="saved"?"All changes saved":saveStatus.state==="error"?"Save failed — see console":"Idle"}
            </div>
          )}
          {onLogout&&(
            <button onClick={onLogout} style={{width:"100%",background:"rgba(255,255,255,0.06)",border:"1px solid #1E3A6B",borderRadius:6,padding:"6px 10px",cursor:"pointer",color:"#CBD5E1",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* ─── MAIN ─────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <div style={{height:50,background:"#FFFFFF",borderBottom:"1px solid #E2E8F0",display:"flex",alignItems:"center",padding:"0 20px",gap:10,flexShrink:0}}>
          <div style={{position:"relative",flex:1,maxWidth:360}}>
            <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><Ic d={I.search} size={13} c="#94A3B8"/></div>
            <input style={{...S.input,paddingLeft:30,background:"#F8FAFC",border:"1px solid #E2E8F0",color:"#0F172A",fontSize:12}} placeholder="Search contacts, deals, companies..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
            <span style={{fontSize:12,color:"#64748B",display:"flex",alignItems:"center",gap:4}}><div style={{width:6,height:6,borderRadius:"50%",background:"#10B981"}}/>{entity?.name}</span>
            {overdueTasks>0&&<div style={{...S.badge("#EF4444"),cursor:"pointer"}} onClick={()=>setView("tasks")}><Ic d={I.bell} size={10}/>{overdueTasks} overdue</div>}
            {unpaidInvoices>0&&<div style={{...S.badge("#F59E0B"),cursor:"pointer"}} onClick={()=>setView("invoices")}><Ic d={I.invoice} size={10}/>{unpaidInvoices} unpaid</div>}
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:20}}>
          {view==="dashboard"&&<Dashboard ed={ed} ec={ec} et={et} notes={en} contacts={contacts} entity={entity} setView={setView} setSelContact={setSelContact} openModal={openModal}/>}
          {view==="contacts"&&!selContact&&<ContactsList ec={ec} search={search} openModal={openModal} setSelContact={setSelContact} deleteContact={deleteContact} deals={deals} notes={notes} tasks={tasks}/>}
          {view==="contacts"&&selContact&&<ContactDetail contact={contacts.find(c=>c.id===selContact)} allDeals={deals} allNotes={notes} allTasks={tasks} allDocs={docs} contacts={contacts} companies={companies} sequences={sequences} enrollments={enrollments} openModal={openModal} onBack={()=>setSelContact(null)} addNote={addNote} updateNote={updateNote} deleteNote={deleteNote} updateTask={updateTask} deleteTask={deleteTask} activeEntityId={activeEntityId} emailIntegrations={emailInts} updateContact={updateContact} addDoc={addDoc} deleteDoc={deleteDoc} addEnrollment={addEnrollment} updateEnrollment={updateEnrollment} deleteEnrollment={deleteEnrollment} customFields={customFields} entity={entity} setSelCompany={setSelCompany} setSelDeal={setSelDeal} setView={setView} onRequestSign={(doc,contact)=>setSigModal({doc,contact})}/>}
          {view==="companies"&&!selCompany&&<CompaniesList eco={eco} search={search} openModal={openModal} deleteCompany={deleteCompany} contacts={contacts} deals={ed} setSelCompany={setSelCompany}/>}
          {view==="companies"&&selCompany&&<CompanyDetail company={companies.find(c=>c.id===selCompany)} allContacts={contacts} allDeals={deals} allNotes={notes} allTasks={tasks} onBack={()=>setSelCompany(null)} openModal={openModal} setSelContact={setSelContact} setSelDeal={setSelDeal} setView={setView} deleteCompany={deleteCompany} deleteNote={deleteNote} entity={entity}/>}
          {view==="deals"&&!selDeal&&<KanbanBoard ed={ed} contacts={contacts} companies={companies} updateDeal={updateDeal} deleteDeal={deleteDeal} openModal={openModal} setSelContact={setSelContact} setSelDeal={setSelDeal} setView={setView} products={products} entity={entity}/>}
          {view==="deals"&&selDeal&&<DealDetail deal={deals.find(d=>d.id===selDeal)} allContacts={contacts} allCompanies={companies} allNotes={notes} allTasks={tasks} onBack={()=>setSelDeal(null)} openModal={openModal} setSelContact={setSelContact} setSelCompany={setSelCompany} setView={setView} deleteDeal={deleteDeal} updateDeal={updateDeal} addNote={addNote} deleteNote={deleteNote} entity={entity} activeEntityId={activeEntityId}/>}
          {view==="tasks"&&<TasksView et={et} contacts={contacts} updateTask={updateTask} deleteTask={deleteTask} openModal={openModal}/>}
          {view==="inbox"&&<InboxView emailThreads={emailThreads} contacts={ec} activeEntityId={activeEntityId} emailIntegrations={emailInts} addEmailThread={addEmailThread} addEmailMessage={addEmailMessage} setSelContact={setSelContact} setView={setView} showToast={showToast}/>}
          {view==="scheduler"&&<SchedulerView meetings={meetings} contacts={contacts} activeEntityId={activeEntityId} availability={availability} addMeeting={addMeeting} updateMeeting={updateMeeting} deleteMeeting={deleteMeeting} updateAvailability={updateAvailability} showToast={showToast}/>}
          {view==="time"&&<TimeView timeEntries={timeEntries} contacts={contacts} deals={deals} activeEntityId={activeEntityId} addTimeEntry={addTimeEntry} updateTimeEntry={updateTimeEntry} deleteTimeEntry={deleteTimeEntry} openModal={openModal} showToast={showToast}/>}
          {view==="invoices"&&<InvoicesView invoices={invoices} contacts={contacts} products={products} timeEntries={timeEntries} activeEntityId={activeEntityId} addInvoice={addInvoice} updateInvoice={updateInvoice} deleteInvoice={deleteInvoice} invoiceCounter={invoiceCounter} setInvoiceCounter={setInvoiceCounter} showToast={showToast} setView={setView}/>}
          {view==="portal"&&<ClientPortalView portalTokens={portalTokens} contacts={contacts} invoices={invoices} docs={docs} quotes={quotes} deals={deals} activeEntityId={activeEntityId} addPortalToken={addPortalToken} deletePortalToken={deletePortalToken} refreshPortalSnapshot={refreshPortalSnapshot} showToast={showToast} entity={entity} setView={setView}/>}
          {view==="import"&&<ImportView activeEntityId={activeEntityId} entity={entity} contacts={contacts} companies={companies} addContact={addContact} addCompany={addCompany} addDeal={addDeal} showToast={showToast}/>}
          {view==="sequences"&&<SequencesView sequences={sequences} templates={templates} enrollments={enrollments} contacts={contacts} activeEntityId={activeEntityId} addSequence={addSequence} updateSequence={updateSequence} deleteSequence={deleteSequence} addTemplate={addTemplate} updateTemplate={updateTemplate} deleteTemplate={deleteTemplate} showToast={showToast}/>}
          {view==="forms"&&<FormsView forms={forms} activeEntityId={activeEntityId} addForm={addForm} updateForm={updateForm} deleteForm={deleteForm} showToast={showToast} addContact={addContact} addNote={addNote}/>}
          {view==="automation"&&<AutomationView automations={automations} activeEntityId={activeEntityId} addAutomation={addAutomation} updateAutomation={updateAutomation} deleteAutomation={deleteAutomation} showToast={showToast}/>}
          {view==="reports"&&<ReportsView ed={ed} ec={ec} et={et} notes={en} entity={entity} showToast={showToast}/>}
          {view==="settings"&&<SettingsView entities={entities} entity={entity} emailInts={eei} connectEmail={connectEmail} disconnectEmail={disconnectEmail} openModal={openModal} setEntities={setEntities} showToast={showToast} products={products} activeEntityId={activeEntityId} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} customFields={customFields} addCustomField={addCustomField} deleteCustomField={deleteCustomField} webhooks={webhooks} addWebhook={addWebhook} updateWebhook={updateWebhook} deleteWebhook={deleteWebhook}/>}
        </div>
      </div>
      </div>

      {/* ─── MODALS ────────────────────────────────────── */}
      {modal&&<Modals modal={modal} closeModal={closeModal} contacts={ec} companies={eco} entities={entities} activeEntityId={activeEntityId} addContact={addContact} updateContact={updateContact} addCompany={addCompany} updateCompany={updateCompany} addDeal={addDeal} updateDeal={updateDeal} addTask={addTask} updateTask={updateTask} addNote={addNote} addEntity={addEntity} connectEmail={connectEmail} showToast={showToast} products={products} sequences={sequences} addEnrollment={addEnrollment} customFields={customFields} entity={entity} addQuote={addQuote} updateQuote={updateQuote} addTemplate={addTemplate} updateTemplate={updateTemplate} timeEntries={timeEntries} addInvoice={addInvoice} updateInvoice={updateInvoice} setInvoiceCounter={setInvoiceCounter} invoiceCounter={invoiceCounter}/>}

      {/* ─── E-SIGNATURE MODAL ─────────────────────────── */}
      {sigModal&&<SignatureModal doc={sigModal.doc} contact={sigModal.contact} onClose={()=>setSigModal(null)} onSign={(sigData)=>addSignature({...sigData,doc:sigModal.doc,contactId:sigModal.contact?.id,entityId:activeEntityId})} showToast={showToast}/>}

      {/* ─── TOAST ──────────────────────────────────────── */}
      {toast&&(
        <div style={{position:"fixed",bottom:20,right:20,background:toast.type==="error"?"#EF4444":"#10B981",color:"#fff",borderRadius:10,padding:"11px 18px",fontSize:13,fontWeight:600,zIndex:2000,boxShadow:"0 4px 20px rgba(0,0,0,.25)",display:"flex",alignItems:"center",gap:7,animation:"fadeIn .2s"}}>
          <Ic d={toast.type==="error"?I.x:I.ok} size={14}/>{toast.msg}
        </div>
      )}

      <style>{`
        *{box-sizing:border-box;}body{margin:0;}
        ::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:#F1F5F9;}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px;}::-webkit-scrollbar-thumb:hover{background:#94A3B8;}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:none;}input[type="range"]{accent-color:#1D4ED8;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
      `}</style>
    </div>
  );
}
