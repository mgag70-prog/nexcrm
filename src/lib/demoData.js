// Demo-mode seed data. Session-only — never written to Supabase.
// Extracted verbatim from App.jsx (Phase 3 split) — no behavior changes.

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
// All demo dates are computed relative to now at load time so /demo (public,
// permanent) always looks freshly populated — nothing decays into the past.
// relISO → full ISO timestamp (optional hour); relDate → yyyy-mm-dd.
const relISO = (days, hour) => { const d = new Date(); d.setDate(d.getDate() + days); if (hour != null) d.setHours(hour, Math.round((hour % 1) * 60), 0, 0); return d.toISOString(); };
const relDate = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
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
  employees:[],
  timeClockEntries:[],
  fsSettings:{},
  expenses:[],
};

const DEMO_FULL = {
  // Four fictional entities mirroring the industries the marketing site sells
  // (Landscaping · Advisory · Property Management · Retail). Distinct palette
  // colours so the cross-entity calendar load bars read clearly.
  entities:[
    {id:"e1",name:"Calder Advisory",type:"LLC",color:"#3B82F6",industry:"Professional Services",website:"calderadvisory.com"},
    {id:"e2",name:"Ridgeline Property Co",type:"LLC",color:"#D97706",industry:"Property Management",website:"ridgelineproperty.com"},
    {id:"e5",name:"Marchfield Landscaping",type:"Field Service Business",color:"#059669",industry:"Landscaping",website:"marchfieldlandscaping.com"},
    {id:"e6",name:"Two Rivers Studio",type:"LLC",color:"#7C3AED",industry:"Retail",website:"tworiversstudio.com"},
  ],
  contacts:[
    // e1 — Calder Advisory (professional services). Active/inactive mix, varied ICP + status, some custom-field values.
    {id:"c1",entityId:"e1",name:"Diane Whitfield",email:"diane@halloranfine.com",phone:"+1 555-0101",companyName:"Halloran & Fine LLP",companyId:"co1",source:"Referral",title:"Managing Partner",icp:"Ideal",status:"Customer",active:true,"LinkedIn URL":"https://linkedin.com/in/dianewhitfield",createdAt:relISO(-40)},
    {id:"c2",entityId:"e1",name:"Andre Sokoloff",email:"andre@bluecrestcap.com",phone:"+1 555-0102",companyName:"Bluecrest Capital",companyId:"co2",source:"Conference",title:"Chief Financial Officer",icp:"Strong",status:"At Risk",active:true,createdAt:relISO(-70)},
    {id:"c3",entityId:"e1",name:"Priya Raman",email:"priya@meridianhealth.org",phone:"+1 555-0103",companyName:"Meridian Health Group",companyId:"co3",source:"Website",title:"Chief Operating Officer",icp:"Ideal",status:"Opportunity",active:true,"LinkedIn URL":"https://linkedin.com/in/priyaraman",createdAt:relISO(-18)},
    {id:"c4",entityId:"e1",name:"Grant Mercer",email:"gmercer@torrington-mfg.com",phone:"+1 555-0104",companyName:"Torrington Manufacturing",companyId:"co4",source:"Cold Outreach",title:"VP Operations",icp:"Developing",status:"Prospect",active:true,createdAt:relISO(-30)},
    {id:"c5",entityId:"e1",name:"Helen Vasquez",email:"helen@vasquezpartners.com",phone:"+1 555-0105",companyName:"Vasquez Partners",source:"Referral",title:"Founder",icp:"Weak",status:"Lead",active:false,createdAt:relISO(-120)},
  ],
  companies:[
    {id:"co1",entityId:"e1",name:"Halloran & Fine LLP",industry:"Legal",website:"halloranfine.com",phone:"+1 555-1001",email:"info@halloranfine.com",employees:80,lifecycleStage:"Customer",leadStatus:"Won",createdAt:relISO(-40)},
    {id:"co2",entityId:"e1",name:"Bluecrest Capital",industry:"Finance",website:"bluecrestcap.com",phone:"+1 555-1002",email:"contact@bluecrestcap.com",employees:35,lifecycleStage:"Customer",leadStatus:"In Progress",createdAt:relISO(-70)},
    {id:"co3",entityId:"e1",name:"Meridian Health Group",industry:"Healthcare",website:"meridianhealth.org",phone:"+1 555-1003",email:"info@meridianhealth.org",employees:420,lifecycleStage:"Opportunity",leadStatus:"Open Deal",createdAt:relISO(-18)},
    {id:"co4",entityId:"e1",name:"Torrington Manufacturing",industry:"Manufacturing",website:"torrington-mfg.com",phone:"+1 555-1004",email:"ops@torrington-mfg.com",employees:210,lifecycleStage:"Prospect",leadStatus:"Attempted to Contact",createdAt:relISO(-30)},
  ],
  // Engineered so deal-health spans all four colour bands (deep-green d1/d2,
  // green d3/d4, amber d5, red d6). d1/d2 carry deep stageHistory for ↑ trend
  // arrows; d4 is a cooling deal (↓). Freshness couples by contact, so the
  // gone-quiet contact (c2) owns only the stale deals.
  deals:[
    {id:"d1",entityId:"e1",contactId:"c1",companyId:"co1",title:"Halloran org redesign engagement",value:45000,stage:"Won",closeDate:relDate(-2),probability:100,dealType:"One-time","Contract Type":"One-time",owner:"You",createdAt:relISO(-40),stageNote:"",stageHistory:[
      {from:"New Lead",to:"Contacted",note:"Intro through a mutual client. Booked scoping call.",at:relISO(-34)},
      {from:"Contacted",to:"Proposal Sent",note:"Sent org-design SOW — $45k fixed fee.",at:relISO(-16)},
      {from:"Proposal Sent",to:"Won",note:"Signed. Engagement letter countersigned, kickoff next week.",at:relISO(-2)},
    ]},
    {id:"d2",entityId:"e1",contactId:"c3",companyId:"co3",title:"Meridian financial modeling sprint",value:15000,stage:"Proposal Sent",closeDate:relDate(14),probability:75,dealType:"One-time","Contract Type":"One-time",owner:"You",createdAt:relISO(-22),stageNote:"Waiting on signed SOW — Priya said the board reviews Thursday.",stageHistory:[
      {from:"New Lead",to:"Contacted",note:"Inbound from the website. Needs a 6-week modeling sprint.",at:relISO(-20)},
      {from:"Contacted",to:"Proposal Sent",note:"Sent the modeling-sprint SOW after discovery.",at:relISO(-3)},
    ]},
    {id:"d3",entityId:"e1",contactId:"c1",companyId:"co1",title:"Halloran advisory board seat",value:12000,stage:"Demo Scheduled",closeDate:relDate(45),probability:45,dealType:"Annual","Contract Type":"Annual",owner:"You",createdAt:relISO(-30),stageNote:"Walkthrough of the advisory cadence booked for next Tuesday.",stageHistory:[{from:"New Lead",to:"Contacted",note:"Diane asked about ongoing advisory after the redesign.",at:relISO(-12)}]},
    {id:"d4",entityId:"e1",contactId:"c4",companyId:"co4",title:"Torrington ops assessment",value:28000,stage:"Follow-up / Discovery",closeDate:relDate(40),probability:50,dealType:"One-time","Contract Type":"One-time",owner:"You",createdAt:relISO(-20),stageNote:"Sent recap + proposed scope. Grant went quiet after the plant tour.",stageHistory:[{from:"New Lead",to:"Contacted",note:"Cold outreach landed a plant tour.",at:relISO(-15)}]},
    {id:"d5",entityId:"e1",contactId:"c2",companyId:"co2",title:"Bluecrest strategy retainer",value:8500,stage:"Responded / Interested",closeDate:relDate(55),probability:30,dealType:"Monthly","Contract Type":"Monthly",owner:"You",createdAt:relISO(-60),stageNote:"Andre wants to revisit after their fund close. Following up in Q3.",stageHistory:[{from:"New Lead",to:"Contacted",note:"Met at the CFO roundtable.",at:relISO(-50)}]},
    {id:"d6",entityId:"e1",contactId:"c2",companyId:"co2",title:"Bluecrest board-deck retainer",value:6000,stage:"New Lead",closeDate:relDate(100),probability:15,dealType:"Monthly",owner:"You",createdAt:relISO(-9)},
  ],
  // Overdue / due-today / upcoming / completed, across all priorities.
  tasks:[
    {id:"t1",entityId:"e1",contactId:"c2",title:"Chase Bluecrest — retainer went quiet",dueDate:relDate(-3),completed:false,priority:"high",reminder:true,createdAt:relISO(-6)},
    {id:"t2",entityId:"e1",contactId:"c3",title:"Send Meridian the signed SOW link",dueDate:relDate(0),completed:false,priority:"high",reminder:true,createdAt:relISO(-1)},
    {id:"t3",entityId:"e1",contactId:"c4",title:"Follow up on Torrington plant-tour recap",dueDate:relDate(2),completed:false,priority:"medium",reminder:false,createdAt:relISO(-2)},
    {id:"t4",entityId:"e1",contactId:"c1",title:"Prep Halloran kickoff deck",dueDate:relDate(4),completed:false,priority:"low",reminder:false,createdAt:relISO(-1)},
    {id:"t5",entityId:"e1",contactId:"c1",title:"Send engagement letter to Halloran",dueDate:relDate(-5),completed:true,priority:"medium",reminder:false,createdAt:relISO(-7)},
  ],
  // Type spread (note / email / system), deal-linked and contact-only, recent
  // enough that "Notes This Week" returns rows. c2 (Andre) is the gone-quiet
  // contact — his newest note is 30 days old, past CAL_STALE_DAYS.
  notes:[
    {id:"n1",entityId:"e1",contactId:"c1",dealId:"d1",content:"Kickoff call booked. Engagement letter countersigned — org-design work starts Monday.",createdAt:relISO(0,10),type:"note"},
    {id:"n2",entityId:"e1",contactId:"c1",dealId:"d1",content:"✅ Deal moved to Won — Halloran org redesign ($45,000).",createdAt:relISO(-2,15),type:"system"},
    {id:"n3",entityId:"e1",contactId:"c3",dealId:"d2",content:"Re: Modeling sprint SOW — assumptions confirmed, sending for signature.",createdAt:relISO(-1,9),type:"email"},
    {id:"n4",entityId:"e1",contactId:"c4",dealId:"d4",content:"Left a follow-up voicemail after the plant tour. No reply yet.",createdAt:relISO(-9,14),type:"note"},
    {id:"n5",entityId:"e1",contactId:"c2",dealId:"d5",content:"Renewal discussion — Andre wants to revisit after their fund close. Circle back in Q3.",createdAt:relISO(-30,11),type:"note"},
  ],
  emailIntegrations:[],
  products:[
    {id:"p1",entityId:"e1",name:"Strategy Retainer",price:8500,category:"Services",description:"Monthly advisory retainer — standing strategic counsel"},
    {id:"p2",entityId:"e1",name:"Org Design Engagement",price:45000,category:"Services",description:"Fixed-fee organizational redesign engagement"},
    {id:"p3",entityId:"e1",name:"Financial Modeling Sprint",price:15000,category:"Services",description:"Six-week financial modeling engagement"},
    {id:"p4",entityId:"e1",name:"Advisory Board Seat",price:12000,category:"Services",description:"Annual advisory board membership"},
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
    {id:"f1",entityId:"e1",name:"Work With Calder Advisory",fields:[{name:"name",label:"Full Name",type:"text",required:true},{name:"email",label:"Email Address",type:"email",required:true},{name:"phone",label:"Phone Number",type:"text",required:false},{name:"company",label:"Company",type:"text",required:false},{name:"message",label:"What are you looking for help with?",type:"textarea",required:false}],submissions:[],active:true,createdAt:relISO(-40)},
    {id:"f2",entityId:"e6",name:"Two Rivers — Wholesale Enquiry",fields:[{name:"name",label:"Name",type:"text",required:true},{name:"email",label:"Email",type:"email",required:true},{name:"company",label:"Store / Company",type:"text",required:false},{name:"message",label:"Which lines are you interested in?",type:"textarea",required:false}],submissions:[],active:true,createdAt:relISO(-25)},
  ],
  automations:[
    {id:"a1",entityId:"e1",name:"Welcome new leads",trigger:"new_contact",condition:"",action:"create_task",actionData:{title:"Send welcome email",priority:"high",daysOut:1},active:true},
    {id:"a2",entityId:"e1",name:"Follow up won deals",trigger:"deal_won",condition:"",action:"create_task",actionData:{title:"Send thank you & onboarding info",priority:"high",daysOut:0},active:true},
  ],
  docs:[],
  quotes:[],
  signatures:[],
  customReports:[],
  customFields:[
    {id:"cf1",entityId:"e1",entity:"contact",name:"LinkedIn URL",type:"text",placeholder:"https://linkedin.com/in/..."},
    {id:"cf2",entityId:"e1",entity:"deal",name:"Contract Type",type:"select",options:["Monthly","Annual","Multi-Year","One-time"]},
  ],
  // Sequence enrollments in progress (+ one completed).
  enrollments:[
    {id:"enr1",contactId:"c4",sequenceId:"sq1",currentStep:1,status:"active",enrolledAt:relISO(-4)},
    {id:"enr2",contactId:"c3",sequenceId:"sq2",currentStep:0,status:"active",enrolledAt:relISO(-1)},
    {id:"enr3",contactId:"c1",sequenceId:"sq1",currentStep:1,status:"completed",enrolledAt:relISO(-20)},
  ],
  timeEntries:[
    {id:"te1",entityId:"e1",contactId:"c1",dealId:"d1",description:"Discovery & org diagnostic",hours:2,rate:300,date:relDate(-6),createdAt:relISO(-6)},
    {id:"te2",entityId:"e1",contactId:"c1",dealId:"d1",description:"Stakeholder interviews — leadership team",hours:3,rate:300,date:relDate(-4),createdAt:relISO(-4)},
    {id:"te3",entityId:"e1",contactId:"c3",dealId:"d2",description:"Modeling sprint — assumptions workshop",hours:2,rate:275,date:relDate(-3),createdAt:relISO(-3)},
    {id:"te4",entityId:"e1",contactId:"c1",dealId:"d3",description:"Advisory cadence design",hours:2.5,rate:300,date:relDate(-2),createdAt:relISO(-2)},
    {id:"te5",entityId:"e1",contactId:null,dealId:null,description:"Internal — weekly pipeline review",hours:0.5,rate:0,date:relDate(-1),createdAt:relISO(-1)},
  ],
  // One invoice in each status: Paid · Sent · Viewed · Overdue · Draft.
  invoices:[
    {id:"inv1",entityId:"e1",number:1,contactId:"c1",dueDate:relDate(-15),status:"Paid",notes:"Org redesign — 50% deposit. Paid in full.",items:[{description:"Org redesign engagement — deposit",quantity:1,unitPrice:22500}],createdAt:relISO(-30)},
    {id:"inv2",entityId:"e1",number:2,contactId:"c3",dueDate:relDate(10),status:"Sent",notes:"Net-30 terms.",items:[{description:"Financial modeling sprint",quantity:1,unitPrice:15000}],createdAt:relISO(-5)},
    {id:"inv5",entityId:"e1",number:5,contactId:"c1",dueDate:relDate(14),status:"Viewed",notes:"Opened by client — awaiting payment.",items:[{description:"Advisory board seat — annual",quantity:1,unitPrice:12000}],createdAt:relISO(-3)},
    {id:"inv3",entityId:"e1",number:3,contactId:"c2",dueDate:relDate(-8),status:"Overdue",notes:"Reminder sent 2 days ago.",items:[{description:"Strategy retainer — monthly",quantity:1,unitPrice:8500}],createdAt:relISO(-38)},
    {id:"inv4",entityId:"e1",number:4,contactId:"c4",dueDate:null,status:"Draft",notes:"",items:[{description:"Ops assessment — fixed fee",quantity:1,unitPrice:28000}],createdAt:relISO(-1)},
  ],
  meetings:[],
  webhooks:[],
  portalTokens:[
    {id:"pt1",entityId:"e1",scope:"contact",scopeId:"c1",scopeName:"Diane Whitfield",email:"diane@halloranfine.com",token:"a1b2c3d4e5f6g7h8",settings:{welcome:"Welcome to your Calder Advisory portal.",color:"#3B82F6",enabledTabs:{overview:true,invoices:true,documents:true,proposals:true,projects:true,messages:true,tasks:false,expenses:false},showDealValues:true,showExpenses:false,notifyEmail:""},demo:true,createdAt:relISO(-10)},
    {id:"pt2",entityId:"e1",scope:"contact",scopeId:"c3",scopeName:"Priya Raman",email:"priya@meridianhealth.org",token:"x9y8z7w6v5u4t3s2",settings:{welcome:"Welcome to your Calder Advisory portal.",color:"#3B82F6",enabledTabs:{overview:true,invoices:true,documents:true,proposals:true,projects:true,messages:true,tasks:false,expenses:false},showDealValues:true,showExpenses:false,notifyEmail:""},demo:true,createdAt:relISO(-2)},
  ],
  emailThreads:[
    {id:"et1",entityId:"e1",contactId:"c1",subject:"Re: Org redesign — engagement letter",lastActivity:relISO(-2),messages:[
      {id:"em1",from:"diane@halloranfine.com",to:"you@calderadvisory.com",subject:"Org redesign — engagement letter",body:"This looks good on our end. Sending the countersigned letter today — excited to get started.",date:relISO(-3),direction:"in"},
      {id:"em2",from:"you@calderadvisory.com",to:"diane@halloranfine.com",subject:"Re: Org redesign — engagement letter",body:"Wonderful — received and countersigned. I'll send a kickoff agenda for Monday.",date:relISO(-2),direction:"out"},
    ]},
    {id:"et2",entityId:"e1",contactId:"c3",subject:"Modeling sprint — SOW",lastActivity:relISO(-1),messages:[
      {id:"em3",from:"priya@meridianhealth.org",to:"you@calderadvisory.com",subject:"Modeling sprint — SOW",body:"Assumptions look right. Board reviews Thursday — should have signature by Friday.",date:relISO(-1),direction:"in"},
    ]},
    {id:"et3",entityId:"e1",contactId:"c4",subject:"Torrington — ops assessment scope",lastActivity:relISO(-9),messages:[
      {id:"em4",from:"you@calderadvisory.com",to:"gmercer@torrington-mfg.com",subject:"Torrington — ops assessment scope",body:"Great to tour the plant. Attaching a recap and a proposed scope — happy to adjust.",date:relISO(-9),direction:"out"},
    ]},
  ],
  availability:{},
  invoiceCounter:6,
  employees:[
    {id:"emp1",entityId:"e5",name:"Mike Castillo",role:"Foreman",phone:"+1 555-2001",hourlyRate:32,pin:"1234",active:true,startDate:"2024-03-15"},
    {id:"emp2",entityId:"e5",name:"Carlos Reyes",role:"Crew Lead",phone:"+1 555-2002",hourlyRate:26,pin:"2345",active:true,startDate:"2024-06-01"},
    {id:"emp3",entityId:"e5",name:"Tyler Brooks",role:"Crew Member",phone:"+1 555-2003",hourlyRate:20,pin:"3456",active:true,startDate:"2025-04-10"},
    {id:"emp4",entityId:"e5",name:"Jenna Marks",role:"Admin",phone:"+1 555-2004",hourlyRate:24,pin:"4567",active:true,startDate:"2024-01-20"},
  ],
  timeClockEntries:(()=>{
    const out=[];
    const day=(daysAgo,h,m=0)=>{const d=new Date();d.setDate(d.getDate()-daysAgo);d.setHours(h,m,0,0);return d.toISOString();};
    // Past week of work — d 3-5 approved (settled), d 1-2 pending (needs supervisor review)
    [1,2,3,4,5].forEach(d=>{
      const status=d<=2?"pending":"approved";
      // Make Mike have a 9.5-hour day to demo daily OT badge
      const mikeHrs=d===2?9.5:8;
      const mikeOut=d===2?day(d,17,0):day(d,15,30);
      out.push({id:`tc_${d}_1`,entityId:"e5",employeeId:"emp1",jobId:d%2?"jb1":"jb5",clockIn:day(d,7,30),clockOut:mikeOut,hours:mikeHrs,gpsNote:"Location recorded",date:new Date(Date.now()-d*864e5).toISOString().slice(0,10),status});
      out.push({id:`tc_${d}_2`,entityId:"e5",employeeId:"emp2",jobId:d%2?"jb1":"jb5",clockIn:day(d,7,45),clockOut:day(d,15,30),hours:7.75,gpsNote:"Location recorded",date:new Date(Date.now()-d*864e5).toISOString().slice(0,10),status});
      out.push({id:`tc_${d}_3`,entityId:"e5",employeeId:"emp3",jobId:d%2?"jb1":"jb12",clockIn:day(d,8,0),clockOut:day(d,15,0),hours:7,gpsNote:"Location recorded",date:new Date(Date.now()-d*864e5).toISOString().slice(0,10),status});
    });
    // Tyler flagged Day-1 entry for correction — supervisor needs to review
    const tyler1=out.find(e=>e.id==="tc_1_3");
    if(tyler1){tyler1.correctionRequested=true;tyler1.correctionNote="I worked until 4pm not 3pm — finishing the Maple Ridge backyard took longer than expected.";tyler1.correctionRequestedAt=new Date().toISOString();}
    // Today: Mike + Carlos clocked in, not out yet
    out.push({id:"tc_today_1",entityId:"e5",employeeId:"emp1",jobId:"jb3",clockIn:day(0,7,30),clockOut:null,hours:null,gpsNote:"Location recorded",date:new Date().toISOString().slice(0,10),status:"open"});
    out.push({id:"tc_today_2",entityId:"e5",employeeId:"emp2",jobId:"jb3",clockIn:day(0,7,45),clockOut:null,hours:null,gpsNote:"Location recorded",date:new Date().toISOString().slice(0,10),status:"open"});
    return out;
  })(),
  fsSettings:{e5:{defaultDepositPct:30,defaultLaborRate:65,serviceArea:"Greater Boston · 25-mile radius",businessHours:"Mon-Sat 7am-5pm",logo:""}},
  expenses:[],
};
// Marchfield Landscaping demo data (Field Service entity e5) — merged into DEMO_FULL after declaration to keep shape sane.
(function seedGreenscape(){
  const FS = "e5";
  const today = new Date();
  const dayOffset = (n)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
  DEMO_FULL.companies.push(
    {id:"gco1",entityId:FS,name:"Maple Ridge HOA",industry:"Other",website:"mapleridgehoa.org",phone:"+1 555-3101",email:"board@mapleridgehoa.org",employees:0,city:"Newton",state:"MA",createdAt:new Date().toISOString()},
    {id:"gco2",entityId:FS,name:"Riverside Property Management",industry:"Real Estate",website:"riverside-pm.com",phone:"+1 555-3102",email:"info@riverside-pm.com",employees:45,city:"Cambridge",state:"MA",createdAt:new Date().toISOString()},
    {id:"gco3",entityId:FS,name:"Oak Hills Estates HOA",industry:"Other",website:"oakhillsestates.com",phone:"+1 555-3103",email:"hoa@oakhillsestates.com",employees:0,city:"Brookline",state:"MA",createdAt:new Date().toISOString()},
    {id:"gco4",entityId:FS,name:"Sunset Plaza Properties",industry:"Real Estate",website:"sunsetplaza.com",phone:"+1 555-3104",email:"facilities@sunsetplaza.com",employees:22,city:"Watertown",state:"MA",createdAt:new Date().toISOString()},
    {id:"gco5",entityId:FS,name:"Greenfield Corporate Park",industry:"Real Estate",website:"greenfieldpark.com",phone:"+1 555-3105",email:"ops@greenfieldpark.com",employees:120,city:"Waltham",state:"MA",createdAt:new Date().toISOString()},
  );
  DEMO_FULL.contacts.push(
    {id:"gc1",entityId:FS,name:"Jennifer Walsh",email:"jen.walsh@gmail.com",phone:"+1 555-4101",title:"Homeowner",companyName:"",source:"Referral",createdAt:new Date(Date.now()-8*864e5).toISOString()},
    {id:"gc2",entityId:FS,name:"Tom Brennan",email:"tbrennan@gmail.com",phone:"+1 555-4102",title:"Homeowner",companyName:"",source:"Website",createdAt:new Date(Date.now()-20*864e5).toISOString()},
    {id:"gc3",entityId:FS,name:"Patricia Liu",email:"pliu@mapleridgehoa.org",phone:"+1 555-4103",title:"HOA Board President",companyName:"Maple Ridge HOA",companyId:"gco1",source:"Referral",createdAt:new Date(Date.now()-120*864e5).toISOString()},
    {id:"gc4",entityId:FS,name:"Mark Henderson",email:"mhenderson@yahoo.com",phone:"+1 555-4104",title:"Homeowner",companyName:"",source:"LinkedIn",createdAt:new Date(Date.now()-15*864e5).toISOString()},
    {id:"gc5",entityId:FS,name:"Carlos Mendoza",email:"cmendoza@riverside-pm.com",phone:"+1 555-4105",title:"Property Manager",companyName:"Riverside Property Management",companyId:"gco2",source:"Cold Outreach",createdAt:new Date(Date.now()-60*864e5).toISOString()},
    {id:"gc6",entityId:FS,name:"Susan Park",email:"spark@oakhillsestates.com",phone:"+1 555-4106",title:"HOA Coordinator",companyName:"Oak Hills Estates HOA",companyId:"gco3",source:"Referral",createdAt:new Date(Date.now()-90*864e5).toISOString()},
    {id:"gc7",entityId:FS,name:"Robert Chen",email:"rchen@sunsetplaza.com",phone:"+1 555-4107",title:"Facilities Director",companyName:"Sunset Plaza Properties",companyId:"gco4",source:"Partner",createdAt:new Date(Date.now()-180*864e5).toISOString()},
    {id:"gc8",entityId:FS,name:"Diana Foster",email:"dfoster@gmail.com",phone:"+1 555-4108",title:"Homeowner",companyName:"",source:"Website",createdAt:new Date(Date.now()-30*864e5).toISOString()},
  );
  DEMO_FULL.deals.push(
    {id:"jb1",entityId:FS,contactId:"gc3",companyId:"gco1",title:"Maple Ridge weekly grounds maintenance",value:1850,stage:"In Progress",closeDate:dayOffset(-1),probability:100,jobSiteAddress:"45 Maple Ridge Dr, Newton MA 02458",serviceType:"Lawn Maintenance",crewAssigned:["emp1","emp2","emp3"],materialsCost:120,recurring:true,frequency:"Weekly",nextOccurrence:dayOffset(6),depositRequired:false,createdAt:new Date(Date.now()-90*864e5).toISOString()},
    {id:"jb2",entityId:FS,contactId:"gc2",title:"Brennan residence spring cleanup",value:680,stage:"Completed",closeDate:dayOffset(-7),probability:100,jobSiteAddress:"47 Oak Ridge Dr, Newton MA 02458",serviceType:"Spring Cleanup",crewAssigned:["emp2","emp3"],materialsCost:45,recurring:false,depositRequired:true,depositAmount:200,depositPaid:true,depositPaidDate:dayOffset(-14),completionNotes:"Hauled away 14 bags of leaves and debris. Edged all beds and applied pre-emergent.",createdAt:new Date(Date.now()-21*864e5).toISOString()},
    {id:"jb3",entityId:FS,contactId:"gc5",companyId:"gco2",title:"Riverside Apts patio hardscape — building 4",value:18400,stage:"Won / Scheduled",closeDate:dayOffset(0),probability:100,jobSiteAddress:"122 Riverside Ave, Cambridge MA 02141",serviceType:"Hardscaping",crewAssigned:["emp1","emp2"],materialsCost:6200,recurring:false,depositRequired:true,depositAmount:5520,depositPaid:true,depositPaidDate:dayOffset(-7),createdAt:new Date(Date.now()-30*864e5).toISOString()},
    {id:"jb4",entityId:FS,contactId:"gc6",companyId:"gco3",title:"Oak Hills aeration & overseed (fall)",value:4200,stage:"Estimate Sent",closeDate:dayOffset(60),probability:60,jobSiteAddress:"Oak Hills Estates common areas, Brookline MA",serviceType:"Aeration",crewAssigned:[],materialsCost:0,recurring:false,depositRequired:true,depositAmount:1260,depositPaid:false,createdAt:new Date(Date.now()-3*864e5).toISOString()},
    {id:"jb5",entityId:FS,contactId:"gc7",companyId:"gco4",title:"Sunset Plaza bi-weekly grounds",value:2400,stage:"In Progress",closeDate:dayOffset(-2),probability:100,jobSiteAddress:"500 Sunset Plaza, Watertown MA 02472",serviceType:"Lawn Maintenance",crewAssigned:["emp1","emp2"],materialsCost:0,recurring:true,frequency:"Bi-Weekly",nextOccurrence:dayOffset(12),depositRequired:false,createdAt:new Date(Date.now()-180*864e5).toISOString()},
    {id:"jb6",entityId:FS,contactId:"gc1",title:"Walsh residence mulch refresh",value:520,stage:"New Lead",closeDate:dayOffset(10),probability:30,jobSiteAddress:"234 Pine St, Newton MA 02458",serviceType:"Mulching",crewAssigned:[],materialsCost:0,recurring:false,depositRequired:false,createdAt:new Date(Date.now()-2*864e5).toISOString()},
    {id:"jb7",entityId:FS,contactId:"gc4",title:"Henderson tree pruning — front oaks",value:850,stage:"Contacted",closeDate:dayOffset(7),probability:50,jobSiteAddress:"88 Willow Way, Brookline MA 02446",serviceType:"Tree/Shrub Care",crewAssigned:[],materialsCost:0,recurring:false,depositRequired:false,createdAt:new Date(Date.now()-5*864e5).toISOString()},
    {id:"jb8",entityId:FS,contactId:null,companyId:"gco5",title:"Greenfield Park snow removal contract (winter 26-27)",value:22000,stage:"Won / Scheduled",closeDate:dayOffset(150),probability:100,jobSiteAddress:"1 Greenfield Way, Waltham MA 02451",serviceType:"Snow Removal",crewAssigned:["emp1","emp2","emp3"],materialsCost:0,recurring:false,depositRequired:true,depositAmount:5500,depositPaid:true,depositPaidDate:dayOffset(-15),createdAt:new Date(Date.now()-45*864e5).toISOString()},
    {id:"jb9",entityId:FS,contactId:"gc3",companyId:"gco1",title:"Maple Ridge entrance landscape redesign",value:9500,stage:"Estimate Sent",closeDate:dayOffset(14),probability:65,jobSiteAddress:"45 Maple Ridge Dr (entry monument), Newton MA",serviceType:"Landscape Design",crewAssigned:[],materialsCost:0,recurring:false,depositRequired:true,depositAmount:2850,depositPaid:false,createdAt:new Date(Date.now()-10*864e5).toISOString()},
    {id:"jb10",entityId:FS,contactId:"gc5",companyId:"gco2",title:"Riverside drip irrigation install — courtyard",value:6800,stage:"Contacted",closeDate:dayOffset(25),probability:45,jobSiteAddress:"122 Riverside Ave, Cambridge MA 02141",serviceType:"Irrigation",crewAssigned:[],materialsCost:0,recurring:false,depositRequired:true,depositAmount:2040,depositPaid:false,createdAt:new Date(Date.now()-12*864e5).toISOString()},
    {id:"jb11",entityId:FS,contactId:"gc8",title:"Foster residence fall cleanup",value:540,stage:"Completed",closeDate:dayOffset(-3),probability:100,jobSiteAddress:"12 Birch Lane, Newton MA 02465",serviceType:"Fall Cleanup",crewAssigned:["emp3"],materialsCost:0,recurring:false,depositRequired:false,completionNotes:"Single-crew job. Hauled 9 bags off-site. Customer paid by check on completion.",createdAt:new Date(Date.now()-30*864e5).toISOString()},
    {id:"jb12",entityId:FS,contactId:"gc7",companyId:"gco4",title:"Robert Chen residence weekly lawn (executive perk)",value:240,stage:"In Progress",closeDate:dayOffset(-3),probability:100,jobSiteAddress:"77 Sunset Dr, Watertown MA 02472",serviceType:"Lawn Maintenance",crewAssigned:["emp3"],materialsCost:0,recurring:true,frequency:"Weekly",nextOccurrence:dayOffset(4),depositRequired:false,createdAt:new Date(Date.now()-60*864e5).toISOString()},
  );
  DEMO_FULL.expenses.push(
    {id:"exp_g1",entityId:FS,dealId:"jb3",contactId:"gc5",companyId:"gco2",date:dayOffset(-10),category:"Materials & Supplies",description:"Belgian block edging — 240 linear ft",vendor:"New England Stone Supply",amount:1840,currency:"USD",billable:true,invoiced:true,createdAt:new Date(Date.now()-10*864e5).toISOString()},
    {id:"exp_g2",entityId:FS,dealId:"jb3",contactId:"gc5",companyId:"gco2",date:dayOffset(-9),category:"Materials & Supplies",description:"Pavers and polymeric sand",vendor:"Stone & Co",amount:3120,currency:"USD",billable:true,invoiced:false,createdAt:new Date(Date.now()-9*864e5).toISOString()},
    {id:"exp_g3",entityId:FS,dealId:"jb3",contactId:"gc5",companyId:"gco2",date:dayOffset(-6),category:"Labor (subcontracted)",description:"Specialty mason — 1 day patio install",vendor:"Patio Pros LLC",amount:600,currency:"USD",billable:true,invoiced:false,createdAt:new Date(Date.now()-6*864e5).toISOString()},
    {id:"exp_g4",entityId:FS,dealId:"jb3",contactId:"gc5",companyId:"gco2",date:dayOffset(-2),category:"Equipment & Tools",description:"Plate compactor rental — 2 days",vendor:"United Rentals",amount:200,currency:"USD",billable:true,invoiced:false,createdAt:new Date(Date.now()-2*864e5).toISOString()},
    {id:"exp_g5",entityId:FS,dealId:"jb1",contactId:"gc3",companyId:"gco1",date:dayOffset(-3),category:"Materials & Supplies",description:"Hardwood mulch — 6 yards",vendor:"Greenfield Garden Center",amount:340,currency:"USD",billable:true,invoiced:false,createdAt:new Date(Date.now()-3*864e5).toISOString()},
    {id:"exp_g6",entityId:FS,dealId:"jb2",contactId:"gc2",date:dayOffset(-8),category:"Permits & Fees",description:"Dump fees for spring debris",vendor:"Newton DPW",amount:75,currency:"USD",billable:false,invoiced:false,createdAt:new Date(Date.now()-8*864e5).toISOString()},
    {id:"exp_g7",entityId:FS,dealId:"jb1",contactId:"gc3",companyId:"gco1",date:dayOffset(-1),category:"Fuel & Transportation",description:"Truck fuel — weekly route",vendor:"Shell",amount:85,currency:"USD",billable:false,invoiced:false,createdAt:new Date(Date.now()-1*864e5).toISOString()},
    {id:"exp_g8",entityId:FS,dealId:"jb8",contactId:null,companyId:"gco5",date:dayOffset(-5),category:"Equipment & Tools",description:"Snow plow blade replacement",vendor:"Tractor Supply",amount:420,currency:"USD",billable:false,invoiced:false,createdAt:new Date(Date.now()-5*864e5).toISOString()},
    {id:"exp_g9",entityId:FS,dealId:"jb5",contactId:"gc7",companyId:"gco4",date:dayOffset(-4),category:"Materials & Supplies",description:"Fertilizer & herbicide for bi-weekly route",vendor:"SiteOne Landscape",amount:215,currency:"USD",billable:true,invoiced:true,createdAt:new Date(Date.now()-4*864e5).toISOString()},
    {id:"exp_g10",entityId:FS,dealId:"jb11",contactId:"gc8",date:dayOffset(-3),category:"Labor (subcontracted)",description:"Day labor — Foster cleanup",vendor:"OnCall Crew",amount:240,currency:"USD",billable:true,invoiced:false,createdAt:new Date(Date.now()-3*864e5).toISOString()},
  );
  // A couple of timeline notes + stage history for the landscaping entity.
  DEMO_FULL.notes.push(
    {id:"gn1",entityId:FS,contactId:"gc3",dealId:"jb1",content:"Crew completed the weekly route — clippings bagged, beds edged.",createdAt:relISO(-1,16),type:"note"},
    {id:"gn2",entityId:FS,contactId:"gc5",dealId:"jb3",content:"Patio hardscape (building 4) signed off by the property manager.",createdAt:relISO(-2,15),type:"note"},
  );
  const jb1=DEMO_FULL.deals.find(d=>d.id==="jb1");
  if(jb1){jb1.stageNote=`Recurring weekly route — next visit ${dayOffset(6)}.`;jb1.stageHistory=[
    {from:"Estimate Sent",to:"Won / Scheduled",note:"HOA board approved the annual maintenance contract.",at:relISO(-88)},
    {from:"Won / Scheduled",to:"In Progress",note:"First service completed; now a recurring weekly route.",at:relISO(-84)},
  ];}
})();

// ── e2: Ridgeline Property Co (Property Management, standard pipeline) ───────────
(function seedRidgeline(){
  const E="e2";
  DEMO_FULL.companies.push(
    {id:"rco1",entityId:E,name:"Oakmont Residences",industry:"Real Estate",website:"oakmontliving.com",phone:"+1 555-5101",email:"owner@oakmontliving.com",employees:6,city:"Denver",state:"CO",lifecycleStage:"Customer",leadStatus:"Won",createdAt:relISO(-200)},
    {id:"rco2",entityId:E,name:"Beacon Hill Lofts HOA",industry:"Real Estate",website:"beaconhilllofts.org",phone:"+1 555-5102",email:"board@beaconhilllofts.org",employees:0,city:"Denver",state:"CO",lifecycleStage:"Opportunity",leadStatus:"Open Deal",createdAt:relISO(-24)},
    {id:"rco3",entityId:E,name:"Cedar Park Townhomes",industry:"Real Estate",website:"cedarparktownhomes.com",phone:"+1 555-5103",email:"info@cedarparktownhomes.com",employees:3,city:"Boulder",state:"CO",lifecycleStage:"Prospect",leadStatus:"In Progress",createdAt:relISO(-40)},
  );
  DEMO_FULL.contacts.push(
    {id:"rc1",entityId:E,name:"Nathan Boyd",email:"nathan@oakmontliving.com",phone:"+1 555-6101",title:"Owner Representative",companyName:"Oakmont Residences",companyId:"rco1",source:"Referral",icp:"Ideal",status:"Customer",active:true,createdAt:relISO(-200)},
    {id:"rc2",entityId:E,name:"Sofia Marchetti",email:"sofia@beaconhilllofts.org",phone:"+1 555-6102",title:"HOA Board Chair",companyName:"Beacon Hill Lofts HOA",companyId:"rco2",source:"Website",icp:"Strong",status:"Opportunity",active:true,createdAt:relISO(-24)},
    {id:"rc3",entityId:E,name:"Derek Sanders",email:"derek@cedarparktownhomes.com",phone:"+1 555-6103",title:"Property Owner",companyName:"Cedar Park Townhomes",companyId:"rco3",source:"Cold Outreach",icp:"Developing",status:"Prospect",active:true,createdAt:relISO(-40)},
    {id:"rc4",entityId:E,name:"Wendy Alvarez",email:"wendy.alvarez@gmail.com",phone:"+1 555-6104",title:"Tenant Liaison",companyName:"Oakmont Residences",companyId:"rco1",source:"Referral",icp:"Weak",status:"Customer",active:false,createdAt:relISO(-150)},
  );
  DEMO_FULL.deals.push(
    {id:"rd1",entityId:E,contactId:"rc1",companyId:"rco1",title:"Oakmont — full-service management",value:36000,stage:"Won",closeDate:relDate(-5),probability:100,dealType:"Annual",owner:"You",createdAt:relISO(-60),stageNote:"",stageHistory:[
      {from:"Proposal Sent",to:"Won",note:"Signed 12-month management agreement, 8% of collected rents.",at:relISO(-5)},
    ]},
    {id:"rd2",entityId:E,contactId:"rc2",companyId:"rco2",title:"Beacon Hill — management takeover",value:21000,stage:"Proposal Sent",closeDate:relDate(12),probability:70,dealType:"Annual",owner:"You",createdAt:relISO(-24),stageNote:"Board votes on the switch at the next meeting.",stageHistory:[{from:"Contacted",to:"Proposal Sent",note:"Sent the takeover proposal + fee schedule.",at:relISO(-4)}]},
    {id:"rd3",entityId:E,contactId:"rc3",companyId:"rco3",title:"Cedar Park — lease-up services",value:9000,stage:"Demo Scheduled",closeDate:relDate(20),probability:50,dealType:"One-time",owner:"You",createdAt:relISO(-14),stageNote:"Walkthrough of the lease-up plan scheduled."},
    {id:"rd4",entityId:E,contactId:"rc2",companyId:"rco2",title:"Downtown mixed-use RFP",value:52000,stage:"New Lead",closeDate:relDate(80),probability:20,dealType:"Annual",owner:"You",createdAt:relISO(-3)},
  );
  DEMO_FULL.tasks.push(
    {id:"rt1",entityId:E,contactId:"rc2",title:"Prep Beacon Hill board presentation",dueDate:relDate(1),completed:false,priority:"high",reminder:true,createdAt:relISO(-2)},
    {id:"rt2",entityId:E,contactId:"rc1",title:"Send Oakmont monthly owner statement",dueDate:relDate(-1),completed:false,priority:"medium",reminder:false,createdAt:relISO(-3)},
  );
  DEMO_FULL.notes.push(
    {id:"rn1",entityId:E,contactId:"rc1",dealId:"rd1",content:"Management agreement signed. Onboarding the Oakmont portfolio this week.",createdAt:relISO(-1,11),type:"note"},
    {id:"rn2",entityId:E,contactId:"rc2",dealId:"rd2",content:"Re: Takeover proposal — board is leaning yes, wants a maintenance SLA line.",createdAt:relISO(0,9),type:"email"},
  );
  DEMO_FULL.products.push(
    {id:"rp1",entityId:E,name:"Full-Service Management",price:3000,category:"Services",description:"Monthly full-service property management"},
    {id:"rp2",entityId:E,name:"Lease-Up Package",price:9000,category:"Services",description:"End-to-end lease-up for a new community"},
    {id:"rp3",entityId:E,name:"Maintenance Coordination",price:750,category:"Services",description:"Monthly vendor & maintenance coordination"},
  );
  DEMO_FULL.invoices.push(
    {id:"rinv1",entityId:E,number:1,contactId:"rc1",dueDate:relDate(-12),status:"Paid",notes:"Oakmont — management fee, prior month.",items:[{description:"Full-service management fee",quantity:1,unitPrice:3000}],createdAt:relISO(-25)},
    {id:"rinv2",entityId:E,number:2,contactId:"rc1",dueDate:relDate(8),status:"Sent",notes:"Oakmont — current month.",items:[{description:"Full-service management fee",quantity:1,unitPrice:3000},{description:"Maintenance coordination",quantity:1,unitPrice:750}],createdAt:relISO(-4)},
  );
  DEMO_FULL.meetings.push(
    {id:"rmt1",entityId:E,title:"Beacon Hill — management proposal walkthrough",contactId:"rc2",date:relDate(2),time:"11:00",duration:45,location:"Beacon Hill clubhouse",notes:"",createdAt:relISO(-2)},
    {id:"rmt2",entityId:E,title:"Oakmont — monthly owner report",contactId:"rc1",date:relDate(0),time:"15:30",duration:45,location:"Zoom",notes:"",createdAt:relISO(-3)},
  );
})();

// ── e6: Two Rivers Studio (Retail, standard pipeline) ───────────────────────────
(function seedTwoRivers(){
  const E="e6";
  DEMO_FULL.companies.push(
    {id:"tco1",entityId:E,name:"Harbor General Store",industry:"Retail",website:"harborgeneral.com",phone:"+1 555-7101",email:"buying@harborgeneral.com",employees:14,city:"Portland",state:"ME",lifecycleStage:"Customer",leadStatus:"Won",createdAt:relISO(-120)},
    {id:"tco2",entityId:E,name:"The Nook Boutique",industry:"Retail",website:"thenookboutique.com",phone:"+1 555-7102",email:"hello@thenookboutique.com",employees:4,city:"Camden",state:"ME",lifecycleStage:"Opportunity",leadStatus:"Open Deal",createdAt:relISO(-20)},
  );
  DEMO_FULL.contacts.push(
    {id:"tc1",entityId:E,name:"Ella Nakamura",email:"ella@harborgeneral.com",phone:"+1 555-8101",title:"Head Buyer",companyName:"Harbor General Store",companyId:"tco1",source:"Trade Show",icp:"Ideal",status:"Customer",active:true,createdAt:relISO(-120)},
    {id:"tc2",entityId:E,name:"Marcus Webb",email:"marcus@thenookboutique.com",phone:"+1 555-8102",title:"Owner",companyName:"The Nook Boutique",companyId:"tco2",source:"Instagram",icp:"Strong",status:"Opportunity",active:true,createdAt:relISO(-20)},
    {id:"tc3",entityId:E,name:"Rosa Lindqvist",email:"rosa.lindqvist@gmail.com",phone:"+1 555-8103",title:"Retail Customer",companyName:"",source:"Website",icp:"Developing",status:"Customer",active:true,createdAt:relISO(-8)},
  );
  DEMO_FULL.deals.push(
    {id:"td1",entityId:E,contactId:"tc1",companyId:"tco1",title:"Harbor General — spring wholesale line",value:8600,stage:"Won",closeDate:relDate(-3),probability:100,dealType:"One-time",owner:"You",createdAt:relISO(-45),stageNote:"",stageHistory:[{from:"Proposal Sent",to:"Won",note:"PO received for the full spring assortment.",at:relISO(-3)}]},
    {id:"td2",entityId:E,contactId:"tc2",companyId:"tco2",title:"The Nook — opening wholesale order",value:3200,stage:"Proposal Sent",closeDate:relDate(8),probability:65,dealType:"One-time",owner:"You",createdAt:relISO(-12),stageNote:"Sent the linesheet + opening-order terms.",stageHistory:[{from:"Contacted",to:"Proposal Sent",note:"Sent linesheet after the Instagram enquiry.",at:relISO(-2)}]},
    {id:"td3",entityId:E,contactId:"tc3",title:"Custom ceramics — private commission",value:900,stage:"Contacted",closeDate:relDate(15),probability:40,dealType:"One-time",owner:"You",createdAt:relISO(-6)},
  );
  DEMO_FULL.tasks.push(
    {id:"tt1",entityId:E,contactId:"tc2",title:"Confirm The Nook opening-order ship date",dueDate:relDate(3),completed:false,priority:"medium",reminder:true,createdAt:relISO(-1)},
  );
  DEMO_FULL.notes.push(
    {id:"tn1",entityId:E,contactId:"tc1",dealId:"td1",content:"PO received for the spring line — pulling and packing this week.",createdAt:relISO(-1,13),type:"note"},
    {id:"tn2",entityId:E,contactId:"tc2",dealId:"td2",content:"Re: Linesheet — Marcus wants the stoneware mugs and the wool throws.",createdAt:relISO(0,10),type:"email"},
  );
  DEMO_FULL.products.push(
    {id:"tp1",entityId:E,name:"Stoneware mug set (4)",price:68,category:"Homeware",description:"Hand-thrown stoneware, set of four"},
    {id:"tp2",entityId:E,name:"Wool throw blanket",price:120,category:"Textiles",description:"Undyed wool, woven in-studio"},
    {id:"tp3",entityId:E,name:"Stoneware vase",price:54,category:"Homeware",description:"Small-batch ceramic vase"},
  );
  DEMO_FULL.invoices.push(
    {id:"tinv1",entityId:E,number:1,contactId:"tc1",dueDate:relDate(-6),status:"Paid",notes:"Harbor General — spring line, paid on receipt.",items:[{description:"Spring wholesale assortment",quantity:1,unitPrice:8600}],createdAt:relISO(-8)},
    {id:"tinv2",entityId:E,number:2,contactId:"tc2",dueDate:relDate(14),status:"Sent",notes:"The Nook — opening order, Net-14.",items:[{description:"Stoneware mug set (4)",quantity:20,unitPrice:68},{description:"Wool throw blanket",quantity:15,unitPrice:120}],createdAt:relISO(-2)},
  );
})();

// ── e1: Calder Advisory cross-cutting stores (quotes, docs, signature, meetings,
//        availability, saved reports) ───────────────────────────────────────────
(function seedCalderExtras(){
  const E="e1";
  DEMO_FULL.quotes.push(
    {id:"q1",entityId:E,number:"Q-0001",createdAt:relISO(-6),status:"Sent",contactId:"c3",dealId:"d2",title:"Financial modeling sprint",items:[{productId:"p3",qty:1,price:15000,name:"Financial Modeling Sprint",description:"Six-week engagement"}],notes:"Valid 30 days.",total:15000},
    {id:"q2",entityId:E,number:"Q-0002",createdAt:relISO(-1),status:"Draft",contactId:"c4",dealId:"d4",title:"Operations assessment",items:[{productId:"p2",qty:1,price:28000,name:"Org Design Engagement",description:"Ops assessment scope"}],notes:"",total:28000},
  );
  DEMO_FULL.docs.push(
    {id:"doc1",entityId:E,contactId:"c1",name:"Halloran — Engagement Letter.pdf",type:"application/pdf",size:184320,data:"data:application/pdf;base64,JVBERi0xLjQK",status:"Signed",uploadedAt:relISO(-4)},
    {id:"doc2",entityId:E,contactId:"c3",name:"Meridian — Modeling SOW.pdf",type:"application/pdf",size:151552,data:"data:application/pdf;base64,JVBERi0xLjQK",status:"Sent",uploadedAt:relISO(-3)},
    {id:"doc3",entityId:E,contactId:"c4",name:"Torrington — Ops Assessment Proposal.pdf",type:"application/pdf",size:203776,data:"data:application/pdf;base64,JVBERi0xLjQK",status:"Draft",uploadedAt:relISO(-9)},
  );
  const doc1=DEMO_FULL.docs.find(d=>d.id==="doc1");
  DEMO_FULL.signatures.push(
    {id:"sig1",type:"type",text:"Diane Whitfield",signedAt:relISO(-4),doc:doc1,contactId:"c1",entityId:E},
  );
  DEMO_FULL.meetings.push(
    {id:"mt1",entityId:E,title:"Meridian — modeling sprint review",contactId:"c3",date:relDate(0),time:"10:00",duration:60,location:"Zoom",notes:"Walk through the assumptions.",createdAt:relISO(-2)},
    {id:"mt2",entityId:E,title:"Halloran org redesign kickoff",contactId:"c1",date:relDate(1),time:"09:00",duration:90,location:"Halloran & Fine, 12th fl",notes:"",createdAt:relISO(-1)},
    {id:"mt3",entityId:E,title:"Torrington — follow-up call",contactId:"c4",date:relDate(3),time:"14:00",duration:30,location:"Phone",notes:"Chase the ops assessment.",createdAt:relISO(-1)},
  );
  DEMO_FULL.availability.e1={
    Monday:{enabled:true,start:"09:00",end:"17:00"},
    Tuesday:{enabled:true,start:"09:00",end:"17:00"},
    Wednesday:{enabled:true,start:"09:00",end:"17:00"},
    Thursday:{enabled:true,start:"09:00",end:"17:00"},
    Friday:{enabled:true,start:"09:00",end:"15:00"},
    Saturday:{enabled:false,start:"09:00",end:"17:00"},
    Sunday:{enabled:false,start:"09:00",end:"17:00"},
  };
  DEMO_FULL.customReports.push(
    {id:"rep1",entityId:E,name:"Notes This Week",type:"activity",fields:["createdAt","contactName","companyName","dealTitle","noteType","body"],filters:{dateRange:"week",dateField:"createdAt"},sort:{field:"createdAt",dir:"desc"},groupBy:"contactName",createdAt:relISO(-7),lastRunAt:relISO(-1)},
    {id:"rep2",entityId:E,name:"Open Pipeline by Stage",type:"deal",fields:["title","companyName","stage","value","probability","closeDate"],filters:{},sort:{field:"value",dir:"desc"},groupBy:"stage",createdAt:relISO(-14),lastRunAt:relISO(-2)},
  );
})();

// ── Demo calendar + email datasets (read in-memory when demoMode; zero Supabase) ─
// Calendar events are shaped as calendar_events DB rows (snake_case) because
// GoogleCalendarView reads those columns directly. Spread across four entities in
// the current week, a genuine cross-entity double-booking (ce1/ce2), all three
// size tiers, and several today-events (incl. the gone-quiet contact c2).
const DEMO_CALENDAR_EVENTS = (()=>{
  const mk=(id,entity_id,contact_id,title,dayOff,startH,durMin,opt={})=>{
    const start=relISO(dayOff,startH);
    const end=new Date(new Date(start).getTime()+durMin*60000).toISOString();
    return {id,entity_id,google_event_id:"g_"+id,title,location:opt.location||"",start_at:start,end_at:end,all_day:!!opt.all_day,attendees:opt.attendees||[],organizer_email:"you@calderadvisory.com",status:opt.status||"confirmed",contact_id:contact_id||null};
  };
  return [
    // TODAY — populates the brief strip
    mk("ce1","e1","c3","Meridian — modeling sprint review",0,10,60,{location:"Zoom"}),
    mk("ce2","e5","gc3","Maple Ridge — site walk",0,10.5,45,{location:"45 Maple Ridge Dr"}), // overlaps ce1 across entities
    mk("ce3","e1","c2","Bluecrest — retainer check-in",0,14,30), // c2 gone quiet → brief callout
    mk("ce4","e2","rc1","Oakmont — monthly owner report",0,15.5,45,{location:"Oakmont clubhouse"}),
    mk("ce5","e6","tc1","Harbor General — spring line buy",0,8.5,90,{location:"Two Rivers showroom"}), // large tier
    mk("ce6","e5","gc6","Oak Hills — aeration estimate",0,13,45,{location:"Oak Hills common areas"}),
    // Rest of the week
    mk("ce7","e1","c1","Halloran org redesign kickoff",1,9,90,{location:"Halloran & Fine, 12th fl"}),
    mk("ce8","e5","gc5","Riverside patio — final punch list",1,13,60),
    mk("ce9","e2","rc3","Cedar Park — lease-up strategy",1,16,30),
    mk("ce10","e2","rc2","Beacon Hill — proposal walkthrough",2,11,45),
    mk("ce11","e6","tc2","The Nook — opening order review",2,15,30),
    mk("ce12","e6","tc1","Harbor General — reorder logistics",2,10,45),
    mk("ce13","e1","c4","Torrington — follow-up call",-1,14,15), // small tier
    mk("ce14","e5","gc7","Sunset Plaza — bi-weekly service",-1,8,30),
    mk("ce15","e1","c3","Meridian — internal prep",-2,12,15,{status:"cancelled"}), // cancelled → excluded from load/brief
  ];
})();

// Synced-email fixtures shaped as email_messages rows; keyed to e1 contacts.
const DEMO_EMAIL_MESSAGES = [
  {id:"gm1",contact_id:"c1",gmail_thread_id:"t_c1",direction:"in",from_email:"diane@halloranfine.com",from_name:"Diane Whitfield",to_emails:["you@calderadvisory.com"],subject:"Countersigned engagement letter",snippet:"Attaching the signed letter — thrilled to start.",body_text:"Attaching the signed letter — thrilled to start. Let's lock the kickoff for Monday morning.",sent_at:relISO(-2,9),has_attachments:true},
  {id:"gm2",contact_id:"c1",gmail_thread_id:"t_c1",direction:"out",from_email:"you@calderadvisory.com",from_name:"You",to_emails:["diane@halloranfine.com"],subject:"Re: Countersigned engagement letter",snippet:"Received — kickoff agenda attached.",body_text:"Received, thank you. Kickoff agenda attached for Monday 9am.",sent_at:relISO(-2,11),has_attachments:true},
  {id:"gm3",contact_id:"c3",gmail_thread_id:"t_c3",direction:"in",from_email:"priya@meridianhealth.org",from_name:"Priya Raman",to_emails:["you@calderadvisory.com"],subject:"Modeling sprint SOW",snippet:"Assumptions look right — board reviews Thursday.",body_text:"Assumptions look right. The board reviews Thursday; I expect signature by Friday.",sent_at:relISO(-1,9),has_attachments:false},
  {id:"gm4",contact_id:"c2",gmail_thread_id:"t_c2",direction:"out",from_email:"you@calderadvisory.com",from_name:"You",to_emails:["andre@bluecrestcap.com"],subject:"Retainer — revisiting in Q3",snippet:"No problem — I'll check back after your fund close.",body_text:"Completely understand. I'll circle back after your fund close in Q3. The door's open whenever you're ready.",sent_at:relISO(-30,10),has_attachments:false},
  {id:"gm5",contact_id:"c4",gmail_thread_id:"t_c4",direction:"out",from_email:"you@calderadvisory.com",from_name:"You",to_emails:["gmercer@torrington-mfg.com"],subject:"Plant tour recap + proposed scope",snippet:"Recap and proposed scope attached.",body_text:"Great to tour the plant. Recap and a proposed scope attached — happy to adjust to your priorities.",sent_at:relISO(-9,14),has_attachments:true},
];


export { DEMO,DEMO_CALENDAR_EVENTS,DEMO_EMAIL_MESSAGES,DEMO_FULL,relDate,relISO };
