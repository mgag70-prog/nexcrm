// Shared UI layer: icon set, style tokens, and presentational primitives.
// Extracted verbatim from App.jsx (Phase 3 split) — no behavior changes.
import { useState } from "react";
import { avColor, initials, fmtTime, scoreColor } from "../lib/domain.js";

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
  camera:["M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z","M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  repeat:["M17 1l4 4-4 4","M3 11V9a4 4 0 0 1 4-4h14","M7 23l-4-4 4-4","M21 13v2a4 4 0 0 1-4 4H3"],
  truck:["M1 3h15v13H1z","M16 8h4l3 3v5h-7V8z","M5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z","M18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"],
  mapPin:["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z","M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"],
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
  <div className="nx-modal-overlay" style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="nx-modal" style={{...S.modal,maxWidth:wide?720:520}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{fontFamily:"'Sora',sans-serif",fontSize:18,fontWeight:700,color:"#0F172A",margin:0}}>{title}</h2>
        <button style={S.btnGhost} onClick={onClose}><Ic d={I.x} size={18}/></button>
      </div>
      {children}
    </div>
  </div>
);
const PageHeader = ({title,sub,children})=>(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:24,gap:12,flexWrap:"wrap"}}>
    <div>
      <h1 style={{fontFamily:"'Sora',sans-serif",fontSize:22,fontWeight:800,color:"#0F172A",margin:0}}>{title}</h1>
      {sub&&<p style={{color:"#64748B",marginTop:3,fontSize:13,margin:"4px 0 0"}}>{sub}</p>}
    </div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>{children}</div>
  </div>
);
const StatCard = ({label,value,sub,color,icon,onClick})=>(
  <div
    onClick={onClick}
    onMouseEnter={onClick?(e)=>{e.currentTarget.style.boxShadow="0 6px 18px rgba(15,30,60,.10)";e.currentTarget.style.transform="translateY(-1px)";}:undefined}
    onMouseLeave={onClick?(e)=>{e.currentTarget.style.boxShadow="";e.currentTarget.style.transform="";}:undefined}
    style={{...S.card({padding:20}),cursor:onClick?"pointer":"default",transition:onClick?"box-shadow .15s, transform .15s":undefined}}
  >
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



export { Avatar,F,Field,I,Ic,Modal,NoteRow,PageHeader,S,ScoreBadge,StatCard };
