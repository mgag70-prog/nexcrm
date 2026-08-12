// Deal-health and lead-scoring math, plus the DealHealthChip badge.
// Extracted verbatim from App.jsx (Phase 3 split) — no behavior changes.
import { isFieldService, SOURCE_SCORE } from "./domain.js";

// ─── LEAD SCORING ─────────────────────────────────────────────────────────────
// ─── DEAL HEALTH (0-100) ─────────────────────────────────────────────────────
// Freshness 30 + Confidence 25 + Urgency 20 + Momentum 25. Shared by the
// calendar context panel, Kanban cards, and DealDetail.
const DEAL_MOMENTUM_STANDARD={"Won":25,"Proposal Sent":20,"Demo Scheduled":17,"Follow-up / Discovery":13,"Responded / Interested":10,"Contacted":7,"New Lead":3,"Lost":0};
const DEAL_MOMENTUM_FS={"Completed":25,"Won":24,"Scheduled":24,"In Progress":22,"Estimate Sent":20,"Contacted":7,"New Lead":3,"Lost":0};

function dealMomentumPts(stage,entity){
  if(!stage)return 3;
  const table=isFieldService(entity)?DEAL_MOMENTUM_FS:DEAL_MOMENTUM_STANDARD;
  if(table[stage]!=null)return table[stage];
  if(/lost|inactive/i.test(stage))return 0;
  // Custom entity stages: scale by position among non-terminal stages.
  const live=(entity?.stages||[]).filter(s=>!/lost|inactive/i.test(s));
  const idx=live.indexOf(stage);
  if(idx===-1)return 12; // unknown stage — midpoint
  return live.length<2?25:Math.round(3+22*(idx/(live.length-1)));
}
function dealFreshnessPts(days){
  if(days==null)return 0; // no note ever logged
  if(days<=0)return 30;
  if(days<=7)return 30-(10*days)/7;
  if(days<=14)return 20-(10*(days-7))/7;
  if(days<=21)return 10-(10*(days-14))/7;
  return 0;
}
function dealUrgencyPts(days){
  if(days==null)return 5; // no close date — treat as far out
  if(days<=7)return 20;   // includes overdue
  if(days<=30)return 20-(5*(days-7))/23;
  if(days<=60)return 15-(5*(days-30))/30;
  if(days<=90)return 10-(5*(days-60))/30;
  return 5;
}
// asOf (ms) reconstructs the score at a past moment — stage via stageHistory
// (each entry records the stage a transition LEFT and when), notes by
// timestamp. null = now.
function calcDealHealthAt(deal,notes,entity,asOf){
  const t=asOf??Date.now();
  let stage=deal.stage;
  if(asOf!=null){
    const hist=(deal.stageHistory||[]).map(h=>({from:h.from,at:new Date(h.at).getTime()})).sort((a,b)=>a.at-b.at);
    const later=hist.find(h=>h.at>t);
    if(later)stage=later.from;
    // else: no transition after t — current stage already held at t
  }
  const rel=(notes||[]).filter(n=>(n.dealId===deal.id||(deal.contactId&&n.contactId===deal.contactId))&&new Date(n.createdAt).getTime()<=t);
  const lastNote=rel.reduce((m,n)=>Math.max(m,new Date(n.createdAt).getTime()),0);
  const f=dealFreshnessPts(lastNote?(t-lastNote)/864e5:null);
  const c=Math.max(0,Math.min(25,(+deal.probability||0)/4));
  const u=dealUrgencyPts(deal.closeDate?(new Date(deal.closeDate).getTime()-t)/864e5:null);
  const m=dealMomentumPts(stage,entity);
  return Math.round(Math.max(0,Math.min(100,f+c+u+m)));
}
function calcDealHealth(deal,notes,entity){return calcDealHealthAt(deal,notes,entity,null);}
// Trend vs 7 days ago. Omitted (null) when the deal is younger than 7 days —
// stageHistory records every transition, so an existing deal's past stage is
// always derivable, but a younger deal has nothing to compare against.
function dealHealthTrend(deal,notes,entity){
  const t7=Date.now()-7*864e5;
  if(!deal.createdAt||new Date(deal.createdAt).getTime()>t7)return null;
  const diff=calcDealHealthAt(deal,notes,entity,null)-calcDealHealthAt(deal,notes,entity,t7);
  return diff>=3?"up":diff<=-3?"down":"flat";
}
// Colour bands per spec: <25 bad, <50 warn, <75 ok, 75+ good.
const dealHealthBand=(s)=>s<25?{bg:"#FEF2F2",fg:"#B91C1C"}:s<50?{bg:"#FFFBEB",fg:"#B45309"}:s<75?{bg:"#F0FDF4",fg:"#15803D"}:{bg:"#D1FAE5",fg:"#065F46"};

function DealHealthChip({deal,notes,entity,label="",size=10}){
  const s=calcDealHealth(deal,notes,entity);
  const b=dealHealthBand(s);
  const tr=dealHealthTrend(deal,notes,entity);
  const trChar=tr==="up"?"↑":tr==="down"?"↓":tr==="flat"?"→":null;
  return(
    <span title={`Deal health ${s}/100 — freshness + confidence + urgency + momentum${tr?` · ${tr==="up"?"improving":tr==="down"?"declining":"steady"} vs 7 days ago`:""}`}
      style={{fontSize:size,fontWeight:700,padding:"2px 7px",borderRadius:4,background:b.bg,color:b.fg,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:3}}>
      {label?`${label} ${s}`:s}{trChar&&<span>{trChar}</span>}
    </span>
  );
}

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

export { calcDealHealth,calcDealHealthAt,calcLeadScore,DEAL_MOMENTUM_FS,DEAL_MOMENTUM_STANDARD,dealFreshnessPts,dealHealthBand,DealHealthChip,dealHealthTrend,dealMomentumPts,dealUrgencyPts };
