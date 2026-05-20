// ─────────────────────────────────────────────────────────────────────────────
// WellFed — food-journal.jsx
// Replace the two CONFIG values before deploying.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ── ⚙️ CONFIG ─────────────────────────────────────────────────────────────────
// API is same-origin (Railway serves both frontend and API), so no base URL needed.
// Just replace GOOGLE_CLIENT_ID with yours from Google Cloud Console.
const API              = "";
const GOOGLE_CLIENT_ID = "168274465421-7rj5j39seagomfan2jh3lq655ft52cib.apps.googleusercontent.com"; // ← replace this

// ── API helpers ───────────────────────────────────────────────────────────────
let _token = null;
const setToken = t => { _token = t; };

async function apiFetch(path, options = {}) {
  if (!_token) throw new Error("Not authenticated");
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${_token}` },
    ...options,
  });
  if (res.status === 401) { setToken(null); window.dispatchEvent(new Event("fj:reauth")); throw new Error("Session expired"); }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
const apiGet   = path         => apiFetch(path);
const apiPost  = (path, body) => apiFetch(path, { method:"POST",  body:JSON.stringify(body) });
const apiPatch = (path, body) => apiFetch(path, { method:"PATCH", body:JSON.stringify(body) });

// ── Settings ──────────────────────────────────────────────────────────────────
const getSettings  = () => { try { return JSON.parse(localStorage.getItem("wf:settings")||"{}"); } catch { return {}; } };
const saveSettings = v => localStorage.setItem("wf:settings", JSON.stringify(v));

// ── Normalisation ─────────────────────────────────────────────────────────────
const normalize = s => s.trim().toLowerCase().replace(/\s+/g," ");
const titleCase = s => s.charAt(0).toUpperCase()+s.slice(1).toLowerCase();
function similarity(a,b){
  a=normalize(a);b=normalize(b);if(a===b)return 1;
  let m=0;const sh=a.length<b.length?a:b,lo=a.length<b.length?b:a;
  for(let i=0;i<sh.length;i++)if(lo.includes(sh[i]))m++;
  return m/lo.length;
}

// ── Fonts ─────────────────────────────────────────────────────────────────────
// Lora (serif) — headings, big numbers, logo wordmark
// Nunito (sans) — all UI text, labels, buttons, body
// Loaded via index.html <link> tag

const FONT_DISPLAY = "'Lora', Georgia, serif";
const FONT_UI      = "'Nunito', 'Helvetica Neue', Arial, sans-serif";

// ── 4C Sage & Stone palette ───────────────────────────────────────────────────
//
// Light: cool blue-teal sage, warm slate stone, terracotta accent
// Dark:  deep slate-teal bg, desaturated mid tones, same terracotta pop

const LIGHT = {
  // Backgrounds — cool sage tints
  bg:           "#F1F4F4",   // very light blue-teal tint
  surface:      "#FFFFFF",
  surface2:     "#EBF0EF",   // slightly deeper sage tint for alt rows
  // Borders
  border:       "#C2D4D0",   // sage-teal border
  // Text
  text:         "#0F2422",   // near-black with teal undertone
  textSub:      "#2E6058",   // deep teal
  textMuted:    "#5A8078",   // muted teal
  // Accent — terracotta (brand orange, unchanged)
  accent:       "#D85A30",
  accentSoft:   "#FEF0E6",
  accentBorder: "#F0B090",
  // Food tags — sage teal
  tagBg:        "#D8E6E2",
  tagBorder:    "#8ABCB4",
  tagText:      "#162624",
  // Symptom pills — terracotta-tinted
  symBg:        "#FEE8D6",
  symBorder:    "#E8956A",
  symText:      "#5C1A0A",
  symSelBg:     "#D85A30",
  symSelText:   "#FFFFFF",
  symSelBorder: "#B84820",
  // Semantic
  green:        "#2E7D5A",
  greenSoft:    "#E2F2EA",
  greenBorder:  "#7EC4A0",
  greenText:    "#1A4D36",
  amber:        "#B87820",
  amberSoft:    "#FEF3DC",
  red:          "#B83830",
  redSoft:      "#FDEDED",
  redBorder:    "#E88080",
  redText:      "#6A1810",
  // Inputs
  inputBg:      "#FFFFFF",
  overlay:      "rgba(15,36,34,0.45)",
  // Shadows — teal-tinted
  shadow:       "0 2px 12px rgba(46,96,88,0.10)",
  shadowHdr:    "0 2px 16px rgba(46,96,88,0.12)",
  shadowModal:  "0 24px 60px rgba(15,36,34,0.22)",
};

const DARK = {
  // Backgrounds — deep slate-teal, noticeably darker than before
  bg:           "#0A1614",   // near-black with deep teal cast
  surface:      "#112220",   // dark teal-slate card
  surface2:     "#162E2A",   // slightly lighter for alt rows
  // Borders
  border:       "#244440",   // muted teal border
  // Text
  text:         "#D8EEEA",   // cool near-white with teal tint
  textSub:      "#7ABCB0",   // muted teal
  textMuted:    "#3A6860",   // dim teal
  // Accent — terracotta still pops on dark teal
  accent:       "#F0856A",   // slightly lighter terracotta for dark bg
  accentSoft:   "#1E1210",
  accentBorder: "#8C3820",
  // Food tags
  tagBg:        "#162E2A",
  tagBorder:    "#2E5C56",
  tagText:      "#7ABCB0",
  // Symptom pills
  symBg:        "#1E1210",
  symBorder:    "#6A3020",
  symText:      "#F0856A",
  symSelBg:     "#D85A30",
  symSelText:   "#FFFFFF",
  symSelBorder: "#F0856A",
  // Semantic
  green:        "#40C88A",
  greenSoft:    "#081C14",
  greenBorder:  "#1A5C3A",
  greenText:    "#7ECAA0",
  amber:        "#D8A040",
  amberSoft:    "#180E04",
  red:          "#E06858",
  redSoft:      "#180808",
  redBorder:    "#6A2018",
  redText:      "#F0856A",
  // Inputs
  inputBg:      "#162E2A",
  overlay:      "rgba(0,0,0,0.70)",
  // Shadows
  shadow:       "0 2px 16px rgba(0,0,0,0.55)",
  shadowHdr:    "0 2px 24px rgba(0,0,0,0.65)",
  shadowModal:  "0 24px 60px rgba(0,0,0,0.80)",
};

// ── Inline SVG logo (switches per theme) ────────────────────────────────────
function WellFedLogo({ darkMode, height = 48 }) {
  // Scale the 400×80 viewBox to desired height
  const width = height * (400 / 80);
  if (darkMode) {
    return (
      <svg width={width} height={height} viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="8" width="64" height="64" rx="14" fill="#D85A30"/>
        <circle cx="40" cy="40" r="26" fill="#993C1D" opacity="0.2"/>
        <path d="M20,36 Q19,54 40,57 Q61,54 60,36 Z" fill="#712B13"/>
        <path d="M22,36 Q21,51 40,54 Q59,51 58,36 Z" fill="#993C1D" opacity="0.55"/>
        <path d="M27,36 Q26,47 40,49 Q49,48 53,44 Q46,46 40,46 Q28,46 27,36 Z" fill="#F0997B" opacity="0.25"/>
        <ellipse cx="40" cy="36" rx="20" ry="4.5" fill="#D85A30"/>
        <ellipse cx="40" cy="36" rx="15" ry="3" fill="#F0997B" opacity="0.6"/>
        <path d="M31,28 Q29,22 31,16" fill="none" stroke="#F0997B" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M40,27 Q38,21 40,15" fill="none" stroke="#F0997B" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M49,28 Q47,22 49,16" fill="none" stroke="#F0997B" strokeWidth="2.2" strokeLinecap="round"/>
        <circle cx="58" cy="53" r="10" fill="#4A1B0C" stroke="#F0997B" strokeWidth="1.5"/>
        <line x1="58" y1="53" x2="58" y2="46" stroke="#F0997B" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="58" y1="53" x2="63" y2="56" stroke="#F0997B" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="58" cy="53" r="1.5" fill="#F0997B"/>
        <text x="90" y="44" fontFamily="'Lora', Georgia, serif" fontSize="32" fontWeight="700" fill="#D8EEEA" letterSpacing="-0.5">WellFed</text>
        <text x="91" y="62" fontFamily="'Nunito', Arial, sans-serif" fontSize="13" fill="#7ABCB0" letterSpacing="1.5">FEED WELL. FEEL WELL.</text>
      </svg>
    );
  }
  return (
    <svg width={width} height={height} viewBox="0 0 400 80" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="64" height="64" rx="14" fill="#D85A30"/>
      <circle cx="40" cy="40" r="26" fill="#993C1D" opacity="0.2"/>
      <path d="M20,36 Q19,54 40,57 Q61,54 60,36 Z" fill="#712B13"/>
      <path d="M22,36 Q21,51 40,54 Q59,51 58,36 Z" fill="#993C1D" opacity="0.55"/>
      <path d="M27,36 Q26,47 40,49 Q49,48 53,44 Q46,46 40,46 Q28,46 27,36 Z" fill="#F0997B" opacity="0.25"/>
      <ellipse cx="40" cy="36" rx="20" ry="4.5" fill="#D85A30"/>
      <ellipse cx="40" cy="36" rx="15" ry="3" fill="#F0997B" opacity="0.6"/>
      <path d="M31,28 Q29,22 31,16" fill="none" stroke="#F0997B" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M40,27 Q38,21 40,15" fill="none" stroke="#F0997B" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M49,28 Q47,22 49,16" fill="none" stroke="#F0997B" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="58" cy="53" r="10" fill="#FDF3EF" stroke="#F0997B" strokeWidth="1.5"/>
      <line x1="58" y1="53" x2="58" y2="46" stroke="#712B13" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="58" y1="53" x2="63" y2="56" stroke="#712B13" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="58" cy="53" r="1.5" fill="#712B13"/>
      <text x="90" y="44" fontFamily="'Lora', Georgia, serif" fontSize="32" fontWeight="700" fill="#162624" letterSpacing="-0.5">WellFed</text>
      <text x="91" y="62" fontFamily="'Nunito', Arial, sans-serif" fontSize="13" fill="#2E6058" letterSpacing="1.5">FEED WELL. FEEL WELL.</text>
    </svg>
  );
}

// ── Small icon for header (just the bowl icon portion) ───────────────────────
function WellFedIcon({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
      <rect width="80" height="80" rx="16" fill="#D85A30"/>
      <circle cx="40" cy="40" r="26" fill="#993C1D" opacity="0.2"/>
      <path d="M20,36 Q19,54 40,57 Q61,54 60,36 Z" fill="#712B13"/>
      <path d="M22,36 Q21,51 40,54 Q59,51 58,36 Z" fill="#993C1D" opacity="0.55"/>
      <path d="M27,36 Q26,47 40,49 Q49,48 53,44 Q46,46 40,46 Q28,46 27,36 Z" fill="#F0997B" opacity="0.25"/>
      <ellipse cx="40" cy="36" rx="20" ry="4.5" fill="#D85A30"/>
      <ellipse cx="40" cy="36" rx="15" ry="3" fill="#F0997B" opacity="0.6"/>
      <path d="M31,28 Q29,22 31,16" fill="none" stroke="#F0997B" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M40,27 Q38,21 40,15" fill="none" stroke="#F0997B" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M49,28 Q47,22 49,16" fill="none" stroke="#F0997B" strokeWidth="2.2" strokeLinecap="round"/>
      <circle cx="58" cy="53" r="10" fill="#FDF3EF" stroke="#F0997B" strokeWidth="1.5"/>
      <line x1="58" y1="53" x2="58" y2="46" stroke="#712B13" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="58" y1="53" x2="63" y2="56" stroke="#712B13" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="58" cy="53" r="1.5" fill="#712B13"/>
    </svg>
  );
}

const fmtTime    = ts => new Date(ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const fmtDate    = ts => new Date(ts).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const isToday    = ts => new Date(ts).toDateString()===new Date().toDateString();
const ratingColor= (r,t)=>r>=4?t.green:r>=3?"#B8860B":r>=2?t.amber:t.red;
const ratingLabel= r=>["","😣 Terrible","😕 Not great","😐 Okay","🙂 Pretty good","😄 Great"][r]||"";

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({value,onChange,size=26,readonly=false,t}){
  const [hov,setHov]=useState(0);
  const d=readonly?value:(hov||value);
  return(
    <div style={{display:"flex",gap:2,cursor:readonly?"default":"pointer"}}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} style={{fontSize:size,lineHeight:1,display:"inline-block",
          color:n<=d?"#D85A30":t.border,
          transition:"color .12s,transform .1s",
          transform:!readonly&&hov===n?"scale(1.3)":"scale(1)"}}
          onMouseEnter={()=>!readonly&&setHov(n)} onMouseLeave={()=>!readonly&&setHov(0)}
          onClick={()=>!readonly&&onChange?.(n)}>★</span>
      ))}
    </div>
  );
}

// ── Food tag chip ──────────────────────────────────────────────────────────────
function FoodTag({name,onRemove,t}){
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:3,background:t.tagBg,
      border:`1px solid ${t.tagBorder}`,borderRadius:20,padding:"3px 10px",
      fontSize:12,fontWeight:600,color:t.tagText,fontFamily:"'Inter','Helvetica Neue',Arial,sans-serif"}}>
      {name}
      {onRemove&&<button onClick={onRemove} style={{background:"none",border:"none",cursor:"pointer",
        color:t.tagText,fontSize:15,lineHeight:1,padding:"0 0 0 2px",opacity:.5}}>×</button>}
    </span>
  );
}

// ── Symptom pill ───────────────────────────────────────────────────────────────
function SymPill({name,selected,onToggle,t}){
  return(
    <button onClick={()=>onToggle(name)} style={{
      background:selected?t.symSelBg:t.symBg,
      border:`1.5px solid ${selected?t.symSelBorder:t.symBorder}`,
      borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:700,
      color:selected?t.symSelText:t.symText,cursor:"pointer",fontFamily:"inherit",
      transition:"all .15s"}}>
      {name}
    </button>
  );
}

// ── Symptom selector ───────────────────────────────────────────────────────────
function SymptomSelector({selected,onChange,allSymptoms,onAddSymptom,t}){
  const [newSym,setNewSym]=useState("");
  const [warn,setWarn]=useState("");

  const toggle=name=>onChange(selected.includes(name)?selected.filter(s=>s!==name):[...selected,name]);

  const commitNew=async()=>{
    const tc=titleCase(newSym.trim());if(!tc)return;
    const norm=normalize(tc);
    if(allSymptoms.map(s=>normalize(s)).includes(norm)){
      const canonical=allSymptoms.find(s=>normalize(s)===norm);
      if(!selected.includes(canonical))onChange([...selected,canonical]);
      setNewSym("");setWarn("");return;
    }
    const close=allSymptoms.find(s=>similarity(s,tc)>0.75);
    if(close){setWarn(`Did you mean "${close}"?`);return;}
    await onAddSymptom(tc);
    onChange([...selected,tc]);
    setNewSym("");setWarn("");
  };

  return(
    <div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
        {allSymptoms.map(s=>(<SymPill key={s} name={s} selected={selected.includes(s)} onToggle={toggle} t={t}/>))}
      </div>
      <div style={{display:"flex",gap:6,marginTop:4}}>
        <input value={newSym} onChange={e=>{setNewSym(e.target.value);setWarn("");}}
          onKeyDown={e=>e.key==="Enter"&&commitNew()} placeholder="Add custom symptom…"
          style={{flex:1,border:`1.5px solid ${t.border}`,borderRadius:8,padding:"6px 10px",
            fontSize:12,outline:"none",fontFamily:"inherit",color:t.text,background:t.inputBg}}
          onFocus={e=>e.target.style.borderColor=t.accent}
          onBlur={e=>e.target.style.borderColor=t.border}/>
        <button onClick={commitNew} style={{background:t.accent,color:"#fff",border:"none",
          borderRadius:8,padding:"6px 12px",fontWeight:700,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
          + Add
        </button>
      </div>
      {warn&&<div style={{fontSize:11,color:t.amber,background:t.amberSoft,borderRadius:6,padding:"3px 9px",marginTop:4}}>{warn}</div>}
    </div>
  );
}

// ── Rate & Symptoms modal ──────────────────────────────────────────────────────
function RateModal({session,onSave,onClose,allSymptoms,onAddSymptom,t}){
  const [rating,setRating]=useState(session.rating||0);
  const [symptoms,setSymptoms]=useState(session.symptoms||[]);
  const [saving,setSaving]=useState(false);

  const handleSave=async()=>{
    setSaving(true);
    await onSave({...session,rating,symptoms});
    onClose();
  };

  // Lock body scroll while modal is open
  useEffect(()=>{
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=prev;};
  },[]);

  return(
    <div style={{position:"fixed",inset:0,background:t.overlay,zIndex:1000,
      overflowY:"auto",WebkitOverflowScrolling:"touch"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      {/* Spacer so tapping the dark area above closes the modal */}
      <div style={{minHeight:"20vh"}} onClick={onClose}/>
      <div style={{background:t.surface,borderRadius:"20px 20px 0 0",
        padding:"20px 16px 40px",width:"100%",maxWidth:600,
        margin:"0 auto",boxShadow:t.shadowModal,position:"relative"}}>
        <div style={{width:40,height:4,background:t.border,borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontSize:13,fontWeight:700,color:t.textSub,textTransform:"uppercase",
          letterSpacing:"0.06em",marginBottom:4}}>How did you feel?</div>
        <div style={{fontSize:12,color:t.textMuted,marginBottom:14}}>
          Eaten at {fmtTime(session.ts)} · {session.foods.join(", ")}
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textSub,marginBottom:6}}>Overall feeling</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Stars value={rating} onChange={setRating} size={32} t={t}/>
            {rating>0&&<span style={{fontSize:13,color:t.textSub}}>{ratingLabel(rating)}</span>}
          </div>
        </div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textSub,marginBottom:8}}>
            Symptoms <span style={{fontWeight:400,color:t.textMuted}}>(none = feeling fine)</span>
          </div>
          <SymptomSelector selected={symptoms} onChange={setSymptoms}
            allSymptoms={allSymptoms} onAddSymptom={onAddSymptom} t={t}/>
        </div>
        {/* Buttons always visible — not clipped */}
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,background:t.surface2,border:`1px solid ${t.border}`,
            borderRadius:10,padding:"13px",fontWeight:700,cursor:"pointer",fontSize:13,
            color:t.textSub,fontFamily:"inherit"}}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{flex:2,
            background:rating>0?`linear-gradient(135deg,#D85A30,#993C1D)`:t.surface2,
            border:`1px solid ${rating>0?"#D85A30":t.border}`,borderRadius:10,padding:"13px",
            fontWeight:700,cursor:"pointer",fontSize:13,
            color:rating>0?"#fff":t.textMuted,fontFamily:"inherit",opacity:saving?.6:1}}>
            {saving?"Saving…":rating>0?"Save rating & symptoms":"Save (no rating)"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Food autocomplete ──────────────────────────────────────────────────────────
function FoodInput({knownFoods,onAdd,sessionFoods,t}){
  const [text,setText]=useState("");
  const [sugg,setSugg]=useState([]);
  const [warn,setWarn]=useState("");
  const ref=useRef();

  const update=val=>{
    const norm=normalize(val);
    if(!norm){setSugg([]);setWarn("");return;}
    const exact=knownFoods.find(f=>normalize(f)===norm);
    setSugg(knownFoods.filter(f=>normalize(f).includes(norm)||norm.includes(normalize(f))).slice(0,8));
    if(!exact){
      const close=knownFoods.find(f=>similarity(f,val)>0.75&&normalize(f)!==norm);
      setWarn(close?`Did you mean "${close}"?`:"");
    }else setWarn("");
  };

  const commit=name=>{
    const tr=name.trim();if(!tr)return;
    if(sessionFoods.map(f=>normalize(f)).includes(normalize(tr))){setWarn("Already in this meal.");return;}
    onAdd(tr);setText("");setSugg([]);setWarn("");ref.current?.focus();
  };

  return(
    <div style={{position:"relative",flex:1}}>
      <div style={{display:"flex",gap:6}}>
        <input ref={ref} value={text}
          onChange={e=>{setText(e.target.value);update(e.target.value);}}
          onKeyDown={e=>e.key==="Enter"&&commit(text)}
          placeholder="Type a food item…" autoComplete="off" spellCheck={false}
          style={{flex:1,border:`1.5px solid ${t.border}`,borderRadius:10,padding:"9px 12px",
            fontSize:14,outline:"none",fontFamily:"inherit",color:t.text,background:t.inputBg,transition:"border-color .15s"}}
          onFocus={e=>e.target.style.borderColor="#D85A30"}
          onBlur={e=>e.target.style.borderColor=t.border}/>
        <button onClick={()=>commit(text)} style={{
          background:`linear-gradient(135deg,#D85A30,#993C1D)`,
          color:"#fff",border:"none",borderRadius:10,padding:"9px 16px",fontWeight:700,
          cursor:"pointer",fontSize:13,whiteSpace:"nowrap",fontFamily:"inherit"}}>
          + Add
        </button>
      </div>
      {warn&&<div style={{fontSize:11,color:t.amber,background:t.amberSoft,borderRadius:6,padding:"3px 9px",marginTop:5}}>{warn}</div>}
      {sugg.length>0&&text&&(
        <ul style={{position:"absolute",top:"calc(100% + 4px)",left:0,background:t.surface,
          border:`1px solid ${t.border}`,borderRadius:10,boxShadow:t.shadow,
          zIndex:200,listStyle:"none",margin:0,padding:"4px 0",width:"100%",maxHeight:200,overflowY:"auto"}}>
          {sugg.map(s=>(
            <li key={s} onMouseDown={()=>commit(s)} style={{padding:"8px 14px",cursor:"pointer",
              fontSize:13,color:t.text,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {s}
              {sessionFoods.map(f=>normalize(f)).includes(normalize(s))&&
                <span style={{fontSize:10,color:t.green}}>✓</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Meal card ─────────────────────────────────────────────────────────────────
function MealCard({session,onEdit,onDelete,t}){
  const pending=!session.rating&&!session.symptoms?.length;
  const leftColor = pending ? "#C67D20" : session.rating ? ratingColor(session.rating,t) : t.border;
  const [confirming,setConfirming]=useState(false);

  const handleDelete=async()=>{
    if(!confirming){setConfirming(true);setTimeout(()=>setConfirming(false),3000);return;}
    await onDelete(session.id);
  };

  return(
    <div style={{background:t.surface,borderRadius:14,padding:"12px 14px",
      boxShadow:t.shadow,border:`1px solid ${pending?t.amberSoft:t.border}`,marginBottom:10,
      borderLeft:`4px solid ${leftColor}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"baseline",gap:6}}>
          <span style={{fontSize:22,fontWeight:700,color:t.text,letterSpacing:"-0.02em",
            fontFamily:"'Lora','Georgia',serif"}}>{fmtTime(session.ts)}</span>
          {!isToday(session.ts)&&<span style={{fontSize:11,color:t.textMuted}}>{fmtDate(session.ts)}</span>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {/* Trash — tap once to arm, tap again to confirm */}
          <button onClick={handleDelete} title={confirming?"Tap again to delete":"Delete meal"}
            style={{background:confirming?t.redSoft:"none",
              border:`1px solid ${confirming?t.redBorder:"transparent"}`,
              borderRadius:8,padding:"4px 8px",cursor:"pointer",
              color:confirming?t.red:t.textMuted,fontSize:15,lineHeight:1,
              transition:"all .2s",display:"flex",alignItems:"center",gap:4}}>
            🗑
            {confirming&&<span style={{fontSize:11,fontWeight:700,fontFamily:"inherit"}}>Delete?</span>}
          </button>
          <button onClick={()=>onEdit(session)} style={{
            background:t.accentSoft,border:`1px solid ${t.accentBorder}`,
            borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,color:t.accent,
            cursor:"pointer",fontFamily:"inherit"}}>
            {pending?"Rate now ✦":"Edit"}
          </button>
        </div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:6}}>
        {session.foods.map(f=><FoodTag key={f} name={f} t={t}/>)}
      </div>
      {session.rating>0&&(
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:4}}>
          <Stars value={session.rating} readonly size={14} t={t}/>
          <span style={{fontSize:12,color:ratingColor(session.rating,t),fontWeight:600}}>{ratingLabel(session.rating)}</span>
        </div>
      )}
      {session.symptoms?.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
          {session.symptoms.map(s=>(
            <span key={s} style={{background:t.symBg,border:`1px solid ${t.symBorder}`,
              borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600,color:t.symText}}>{s}</span>
          ))}
        </div>
      )}
      {pending&&<div style={{fontSize:11,color:"#C67D20",fontWeight:600,marginTop:6}}>
        ⏳ Come back in 30–60 min to rate how you feel
      </div>}
    </div>
  );
}

// ── Suggestion modal ──────────────────────────────────────────────────────────
function SuggestionModal({onSubmit,onClose,t}){
  const [text,setText]=useState("");
  const [saving,setSaving]=useState(false);
  const [done,setDone]=useState(false);

  useEffect(()=>{
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=prev;};
  },[]);

  const handleSubmit=async()=>{
    if(!text.trim()||saving)return;
    setSaving(true);
    await onSubmit(text.trim());
    setDone(true);
    setTimeout(onClose,1500);
  };

  return(
    <div style={{position:"fixed",inset:0,background:t.overlay,zIndex:1000,overflowY:"auto",WebkitOverflowScrolling:"touch"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{minHeight:"25vh"}} onClick={onClose}/>
      <div style={{background:t.surface,borderRadius:"20px 20px 0 0",padding:"20px 16px 40px",
        width:"100%",maxWidth:600,margin:"0 auto",boxShadow:t.shadowModal}}>
        <div style={{width:40,height:4,background:t.border,borderRadius:2,margin:"0 auto 16px"}}/>
        {done?(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:32,marginBottom:8}}>🙏</div>
            <div style={{fontWeight:700,color:t.green,fontSize:15}}>Thanks for your suggestion!</div>
          </div>
        ):(
          <>
            <div style={{fontSize:13,fontWeight:700,color:t.textSub,textTransform:"uppercase",
              letterSpacing:"0.06em",marginBottom:4}}>Suggest an improvement</div>
            <div style={{fontSize:12,color:t.textMuted,marginBottom:14}}>
              Got an idea to make WellFed better? We'd love to hear it.
            </div>
            <textarea value={text} onChange={e=>setText(e.target.value)}
              placeholder="Type your suggestion here…" rows={4}
              style={{width:"100%",border:`1.5px solid ${t.border}`,borderRadius:10,
                padding:"10px 12px",fontSize:14,outline:"none",fontFamily:"inherit",
                color:t.text,background:t.inputBg,resize:"vertical",marginBottom:12,
                boxSizing:"border-box"}}
              onFocus={e=>e.target.style.borderColor="#D85A30"}
              onBlur={e=>e.target.style.borderColor=t.border}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={onClose} style={{flex:1,background:t.surface2,border:`1px solid ${t.border}`,
                borderRadius:10,padding:"12px",fontWeight:700,cursor:"pointer",fontSize:13,
                color:t.textSub,fontFamily:"inherit"}}>Cancel</button>
              <button onClick={handleSubmit} disabled={!text.trim()||saving} style={{flex:2,
                background:text.trim()?`linear-gradient(135deg,#D85A30,#993C1D)`:t.surface2,
                border:`1px solid ${text.trim()?"#D85A30":t.border}`,borderRadius:10,padding:"12px",
                fontWeight:700,cursor:text.trim()?"pointer":"default",fontSize:13,
                color:text.trim()?"#fff":t.textMuted,fontFamily:"inherit",
                opacity:saving?.6:1}}>
                {saving?"Sending…":"Send suggestion"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Log Page ──────────────────────────────────────────────────────────────────
function LogPage({sessions,knownFoods,allSymptoms,onSaveMeal,onUpdateMeal,onDeleteMeal,onAddFood,onAddSymptom,onSuggest,t}){
  const [mealFoods,setMealFoods]=useState([]);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  const [editSession,setEditSession]=useState(null);
  const [showPrevious,setShowPrevious]=useState(false);
  const [showSuggest,setShowSuggest]=useState(false);

  const today=new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const todaySessions=[...sessions.filter(s=>isToday(s.ts))].sort((a,b)=>b.ts.localeCompare(a.ts));

  // Group previous sessions by date
  const previousSessions=sessions.filter(s=>!isToday(s.ts));
  const byDate={};
  previousSessions.forEach(s=>{
    const d=new Date(s.ts).toDateString();
    if(!byDate[d])byDate[d]=[];
    byDate[d].push(s);
  });
  const prevDates=Object.keys(byDate).sort((a,b)=>new Date(b)-new Date(a));

  const handleAddFood=name=>{
    const existing=knownFoods.find(f=>normalize(f)===normalize(name));
    const canonical=existing||name;
    if(!existing)onAddFood(canonical);
    setMealFoods(prev=>[...prev,canonical]);
  };

  const handleSave=async()=>{
    if(!mealFoods.length||saving)return;
    setSaving(true);
    await onSaveMeal(mealFoods);
    setMealFoods([]);setSaving(false);
    setSaved(true);setTimeout(()=>setSaved(false),2200);
  };

  return(
    <div style={{padding:"0 0 80px 0"}}>
      {/* Date header */}
      <div style={{fontSize:11,fontWeight:700,color:t.accent,letterSpacing:"0.08em",
        textTransform:"uppercase",marginBottom:10,paddingTop:2}}>
        {today}
      </div>

      {/* Compact log form */}
      <div style={{background:t.surface,borderRadius:14,padding:"12px 14px",
        boxShadow:t.shadow,border:`1px solid ${t.border}`,marginBottom:12}}>
        <FoodInput knownFoods={knownFoods} onAdd={handleAddFood} sessionFoods={mealFoods} t={t}/>
        {mealFoods.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:8}}>
            {mealFoods.map((f,i)=>(
              <FoodTag key={i} name={f} onRemove={()=>setMealFoods(p=>p.filter((_,j)=>j!==i))} t={t}/>
            ))}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,gap:8}}>
          <span style={{fontSize:11,color:t.textMuted}}>
            {mealFoods.length>0
              ?`${mealFoods.length} item${mealFoods.length>1?"s":""} · rate how you feel in 30–60 min`
              :"Add foods eaten, then rate how you feel later"}
          </span>
          <button onClick={handleSave} disabled={!mealFoods.length||saving} style={{
            background:saved
              ?`linear-gradient(135deg,${t.green},#1A5C3A)`
              :`linear-gradient(135deg,#D85A30,#993C1D)`,
            color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontWeight:700,
            cursor:mealFoods.length&&!saving?"pointer":"not-allowed",fontSize:13,fontFamily:"inherit",
            opacity:mealFoods.length&&!saving?1:0.35,transition:"background .3s,opacity .2s",whiteSpace:"nowrap"}}>
            {saving?"Saving…":saved?"✓ Logged!":"Log meal"}
          </button>
        </div>
      </div>

      {/* Today's meals */}
      {todaySessions.length>0&&(
        <>
          <div style={{fontSize:11,fontWeight:700,color:t.textSub,textTransform:"uppercase",
            letterSpacing:"0.06em",marginBottom:8}}>Today's meals</div>
          {todaySessions.map(s=>(
            <MealCard key={s.id} session={s} onEdit={setEditSession} onDelete={onDeleteMeal} t={t}/>
          ))}
        </>
      )}

      {/* Previous entries */}
      {previousSessions.length>0&&(
        <div style={{marginTop:8}}>
          <button onClick={()=>setShowPrevious(p=>!p)} style={{
            width:"100%",background:t.surface,border:`1px solid ${t.border}`,
            borderRadius:12,padding:"11px",fontWeight:700,cursor:"pointer",fontSize:13,
            color:t.textSub,fontFamily:"inherit",boxShadow:t.shadow,
            display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
            <span style={{fontSize:15}}>{showPrevious?"▲":"▼"}</span>
            {showPrevious?"Hide previous entries":`Show previous entries (${previousSessions.length})`}
          </button>
          {showPrevious&&(
            <div style={{marginTop:12}}>
              {prevDates.map(dateStr=>(
                <div key={dateStr}>
                  <div style={{fontSize:11,fontWeight:700,color:t.textSub,textTransform:"uppercase",
                    letterSpacing:"0.06em",marginBottom:8,marginTop:4}}>
                    {new Date(dateStr).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
                  </div>
                  {byDate[dateStr].sort((a,b)=>b.ts.localeCompare(a.ts)).map(s=>(
                    <MealCard key={s.id} session={s} onEdit={setEditSession} onDelete={onDeleteMeal} t={t}/>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Suggest improvement button */}
      <div style={{marginTop:16,textAlign:"center"}}>
        <button onClick={()=>setShowSuggest(true)} style={{
          background:"none",border:"none",cursor:"pointer",
          fontSize:12,color:t.textMuted,fontFamily:"inherit",
          textDecoration:"underline",textUnderlineOffset:3}}>
          💡 Suggest an improvement
        </button>
      </div>

      {/* Modals */}
      {editSession&&(
        <RateModal session={editSession}
          onSave={async updated=>{await onUpdateMeal(updated);setEditSession(null);}}
          onClose={()=>setEditSession(null)}
          allSymptoms={allSymptoms} onAddSymptom={onAddSymptom} t={t}/>
      )}
      {showSuggest&&(
        <SuggestionModal onSubmit={onSuggest} onClose={()=>setShowSuggest(false)} t={t}/>
      )}
    </div>
  );
}

// ── Analysis Page ─────────────────────────────────────────────────────────────
function AnalysisPage({sessions,t}){
  const [view,setView]=useState("foods");
  const [sortKey,setSortKey]=useState("avg");
  const [sortAsc,setSortAsc]=useState(true);
  const [minMeals,setMinMeals]=useState(1);
  const [period,setPeriod]=useState("all");

  const now=new Date();
  const thisMonthStart=new Date(now.getFullYear(),now.getMonth(),1);
  const lastMonthStart=new Date(now.getFullYear(),now.getMonth()-1,1);
  const lastMonthEnd=new Date(now.getFullYear(),now.getMonth(),0,23,59,59,999);
  const periodLabel={all:"All time",
    this_month:now.toLocaleDateString("en-US",{month:"long",year:"numeric"}),
    last_month:new Date(lastMonthStart).toLocaleDateString("en-US",{month:"long",year:"numeric"})}[period];

  const filtered=sessions.filter(s=>{
    if(period==="all")return true;
    const d=new Date(s.ts);
    if(period==="this_month")return d>=thisMonthStart;
    if(period==="last_month")return d>=lastMonthStart&&d<=lastMonthEnd;
    return true;
  });
  const rated=filtered.filter(s=>s.rating>0);

  const foodMap={};
  rated.forEach(s=>s.foods.forEach(f=>{
    if(!foodMap[f])foodMap[f]={ratings:[],symptoms:[]};
    foodMap[f].ratings.push(s.rating);
    (s.symptoms||[]).forEach(sym=>foodMap[f].symptoms.push(sym));
  }));
  const foodStats=Object.entries(foodMap).map(([name,d])=>({
    name,count:d.ratings.length,
    avg:+(d.ratings.reduce((a,b)=>a+b,0)/d.ratings.length).toFixed(2),
    min:Math.min(...d.ratings),max:Math.max(...d.ratings),
  })).filter(f=>f.count>=minMeals);

  const symMap={};
  filtered.forEach(s=>(s.symptoms||[]).forEach(sym=>{
    if(!symMap[sym])symMap[sym]={count:0,foods:[],avgRating:[]};
    symMap[sym].count++;s.foods.forEach(f=>symMap[sym].foods.push(f));
    if(s.rating)symMap[sym].avgRating.push(s.rating);
  }));
  const symStats=Object.entries(symMap).map(([name,d])=>({
    name,count:d.count,topFoods:topN(d.foods,3),
    avgRating:d.avgRating.length?+(d.avgRating.reduce((a,b)=>a+b,0)/d.avgRating.length).toFixed(1):null,
  })).sort((a,b)=>b.count-a.count);

  const sorted=[...foodStats].sort((a,b)=>{const d=a[sortKey]<b[sortKey]?-1:a[sortKey]>b[sortKey]?1:0;return sortAsc?d:-d;});
  const handleSort=k=>{if(sortKey===k)setSortAsc(a=>!a);else{setSortKey(k);setSortAsc(true);}};
  const chartData=[...foodStats].sort((a,b)=>b.count-a.count).slice(0,15).sort((a,b)=>a.avg-b.avg);
  const symChart=[...symStats].slice(0,12);

  const card={background:t.surface,borderRadius:14,padding:"14px",boxShadow:t.shadow,border:`1px solid ${t.border}`,marginBottom:12};
  const sec={margin:"0 0 10px 0",fontSize:12,fontWeight:700,color:t.textSub,textTransform:"uppercase",letterSpacing:"0.06em"};

  // Segmented control style
  const seg=(active)=>({
    flex:1,background:active?t.surface:"none",border:"none",borderRadius:8,
    padding:"7px 4px",fontSize:11,fontWeight:700,color:active?t.accent:t.textMuted,
    cursor:"pointer",fontFamily:"inherit",boxShadow:active?t.shadow:"none",
    transition:"all .15s",whiteSpace:"nowrap",
  });

  if(!sessions.length) return(
    <div style={{...card,textAlign:"center",padding:"48px 20px"}}>
      <div style={{fontSize:48}}>📊</div>
      <div style={{marginTop:12,fontSize:15,fontWeight:700,color:t.text,fontFamily:"'Lora','Georgia',serif"}}>No data yet</div>
      <div style={{fontSize:13,color:t.textMuted,marginTop:4}}>Log meals and rate how you feel to see analysis.</div>
    </div>
  );

  return(
    <div style={{padding:"0 0 80px 0"}}>
      {/* Period picker */}
      <div style={{display:"flex",background:t.surface2,borderRadius:10,padding:3,marginBottom:12,border:`1px solid ${t.border}`}}>
        {[{id:"all",label:"All time"},{id:"this_month",label:"This month"},{id:"last_month",label:"Last month"}].map(({id,label})=>(
          <button key={id} onClick={()=>setPeriod(id)} style={seg(period===id)}>{label}</button>
        ))}
      </div>
      {period!=="all"&&(
        <div style={{fontSize:11,fontWeight:700,color:t.accent,letterSpacing:"0.07em",textTransform:"uppercase",marginBottom:10}}>
          Showing: {periodLabel}
          {filtered.length===0&&<span style={{color:t.textMuted,fontWeight:400,marginLeft:8,textTransform:"none",letterSpacing:0}}>— no data for this period</span>}
        </div>
      )}

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
        {[
          {label:"Meals",    val:filtered.length,             color:"#D85A30"},
          {label:"Rated",    val:rated.length,                color:"#993C1D"},
          {label:"Foods",    val:Object.keys(foodMap).length, color:t.green},
          {label:"Symptoms", val:Object.keys(symMap).length,  color:t.red},
        ].map(c=>(
          <div key={c.label} style={{background:t.surface,borderRadius:12,padding:"10px 6px",
            textAlign:"center",boxShadow:t.shadow,border:`1px solid ${t.border}`}}>
            <div style={{fontSize:22,fontWeight:700,color:c.color,fontFamily:"'Lora','Georgia',serif"}}>{c.val}</div>
            <div style={{fontSize:10,color:t.textMuted,marginTop:1,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Foods / Symptoms sub-tabs */}
      <div style={{display:"flex",background:t.surface2,borderRadius:10,padding:3,marginBottom:12,border:`1px solid ${t.border}`}}>
        {[{id:"foods",label:"🥗 Foods"},{id:"symptoms",label:"🩺 Symptoms"}].map(({id,label})=>(
          <button key={id} onClick={()=>setView(id)} style={{...seg(view===id),fontSize:12,padding:"7px"}}>{label}</button>
        ))}
      </div>

      {view==="foods"&&(<>
        {chartData.length>0&&(
          <div style={card}>
            <div style={sec}>Avg feeling by food</div>
            <div style={{fontSize:11,color:t.textMuted,marginBottom:10}}>Top 15 most eaten · green = good, red = bad</div>
            <ResponsiveContainer width="100%" height={Math.max(180,chartData.length*30)}>
              <BarChart data={chartData} layout="vertical" margin={{left:0,right:28,top:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={t.border}/>
                <XAxis type="number" domain={[0,5]} tickCount={6} tick={{fontSize:10,fill:t.textMuted}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" width={110} tick={{fontSize:11,fill:t.text}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,color:t.text}}
                  formatter={(v,n,p)=>[`${v}★ (${p.payload.count} meal${p.payload.count>1?"s":""})`, "Rating"]}/>
                <Bar dataKey="avg" radius={[0,6,6,0]}>{chartData.map((f,i)=><Cell key={i} fill={ratingColor(f.avg,t)}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={sec}>Food breakdown</div>
            <label style={{fontSize:11,color:t.textMuted,display:"flex",alignItems:"center",gap:5}}>
              Min meals:
              <select value={minMeals} onChange={e=>setMinMeals(+e.target.value)} style={{
                border:`1px solid ${t.border}`,borderRadius:6,padding:"2px 6px",fontSize:11,
                background:t.inputBg,color:t.text,fontFamily:"inherit"}}>
                {[1,2,3,5].map(n=><option key={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${t.border}`}}>
                  {[{k:"name",l:"Food"},{k:"avg",l:"Avg ★"},{k:"count",l:"Meals"},{k:"min",l:"Worst"},{k:"max",l:"Best"}].map(col=>(
                    <th key={col.k} onClick={()=>handleSort(col.k)} style={{textAlign:"left",padding:"6px 8px",
                      cursor:"pointer",userSelect:"none",fontSize:11,fontWeight:700,whiteSpace:"nowrap",
                      color:sortKey===col.k?"#D85A30":t.textSub}}>
                      {col.l}{sortKey===col.k?(sortAsc?" ↑":" ↓"):""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((f,i)=>(
                  <tr key={f.name} style={{background:i%2===0?t.surface2:t.surface}}>
                    <td style={{padding:"7px 8px",fontWeight:600,color:t.text}}>{f.name}</td>
                    <td style={{padding:"7px 8px",fontWeight:700,color:ratingColor(f.avg,t)}}>{f.avg}★</td>
                    <td style={{padding:"7px 8px",color:t.textSub}}>{f.count}</td>
                    <td style={{padding:"7px 8px",color:ratingColor(f.min,t)}}>{f.min}★</td>
                    <td style={{padding:"7px 8px",color:ratingColor(f.max,t)}}>{f.max}★</td>
                  </tr>
                ))}
                {!sorted.length&&<tr><td colSpan={5} style={{textAlign:"center",color:t.textMuted,padding:16,fontSize:12}}>No foods with ≥{minMeals} rated meals.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {foodStats.filter(f=>f.avg>=4&&f.count>=2).length>0&&(
          <div style={{...card,borderLeft:`3px solid ${t.green}`}}>
            <div style={{...sec,color:t.green}}>✅ Foods you tolerate well</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {foodStats.filter(f=>f.avg>=4&&f.count>=2).sort((a,b)=>b.avg-a.avg).map(f=>(
                <div key={f.name} style={{background:t.greenSoft,border:`1px solid ${t.greenBorder}`,borderRadius:20,
                  padding:"4px 12px",fontSize:12,color:t.greenText,display:"flex",alignItems:"center",gap:5,fontWeight:600}}>
                  {f.name} <span>{f.avg}★</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {foodStats.filter(f=>f.avg<3&&f.count>=2).length>0&&(
          <div style={{...card,borderLeft:`3px solid ${t.red}`}}>
            <div style={{...sec,color:t.red}}>❌ Foods you do not tolerate well</div>
            <p style={{fontSize:12,color:t.textMuted,marginBottom:10}}>
              You've felt bad after eating these multiple times.
            </p>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {foodStats.filter(f=>f.avg<3&&f.count>=2).sort((a,b)=>a.avg-b.avg).map(f=>(
                <div key={f.name} style={{background:t.redSoft,border:`1px solid ${t.redBorder}`,borderRadius:20,
                  padding:"4px 12px",fontSize:12,color:t.redText,display:"flex",alignItems:"center",gap:5,fontWeight:600}}>
                  {f.name} <span>{f.avg}★</span>
                  <span style={{fontSize:10,fontWeight:400,color:t.textMuted}}>{f.count} meals</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>)}

      {view==="symptoms"&&(<>
        {symChart.length>0&&(
          <div style={card}>
            <div style={sec}>Symptom frequency</div>
            <ResponsiveContainer width="100%" height={Math.max(160,symChart.length*30)}>
              <BarChart data={symChart} layout="vertical" margin={{left:0,right:28,top:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={t.border}/>
                <XAxis type="number" tickCount={5} tick={{fontSize:10,fill:t.textMuted}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" width={110} tick={{fontSize:11,fill:t.text}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:8,fontSize:12,color:t.text}}
                  formatter={v=>[`${v} occurrence${v!==1?"s":""}`, "Frequency"]}/>
                <Bar dataKey="count" radius={[0,6,6,0]} fill="#D85A30"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {symStats.length>0?symStats.map(sym=>(
          <div key={sym.name} style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,color:t.text,fontSize:14}}>{sym.name}</div>
                <div style={{fontSize:11,color:t.textMuted,marginTop:1}}>
                  {sym.count} occurrence{sym.count!==1?"s":""}
                  {sym.avgRating&&` · avg feeling after: ${sym.avgRating}★`}
                </div>
              </div>
              <span style={{background:t.symBg,border:`1px solid ${t.symBorder}`,borderRadius:20,
                padding:"3px 10px",fontSize:12,fontWeight:700,color:t.symText}}>{sym.count}×</span>
            </div>
            {sym.topFoods.length>0&&(
              <div>
                <div style={{fontSize:11,color:t.textSub,marginBottom:5,fontWeight:600}}>Most commonly eaten before this symptom:</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {sym.topFoods.map(([food,cnt])=>(
                    <div key={food} style={{background:t.surface2,border:`1px solid ${t.border}`,borderRadius:20,
                      padding:"3px 10px",fontSize:12,color:t.textSub,display:"flex",alignItems:"center",gap:4,fontWeight:600}}>
                      {food} <span style={{color:t.textMuted,fontWeight:400}}>×{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )):(
          <div style={{...card,textAlign:"center",padding:"32px 20px"}}>
            <div style={{fontSize:36}}>🩺</div>
            <div style={{marginTop:10,fontSize:14,fontWeight:700,color:t.text}}>No symptoms logged yet</div>
          </div>
        )}
      </>)}
    </div>
  );
}

// ── Login Screen ──────────────────────────────────────────────────────────────
function LoginScreen({onSignIn,darkMode,t}){
  const btnRef=useRef();

  useEffect(()=>{
    const script=document.createElement("script");
    script.src="https://accounts.google.com/gsi/client";
    script.async=true;script.defer=true;
    script.onload=()=>{
      window.google.accounts.id.initialize({
        client_id:   GOOGLE_CLIENT_ID,
        callback:    onSignIn,
        auto_select: true,
      });
      window.google.accounts.id.renderButton(btnRef.current,{
        theme: darkMode?"filled_black":"outline",
        size:  "large",shape:"pill",text:"signin_with",width:280,
      });
      window.google.accounts.id.prompt();
    };
    document.head.appendChild(script);
    return ()=>{ try{document.head.removeChild(script);}catch{} };
  },[]);

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      minHeight:"100vh",background:t.bg,padding:32,
      fontFamily:"'Nunito','Helvetica Neue',Arial,sans-serif"}}>
      <div style={{
        background:t.surface,borderRadius:24,padding:"44px 32px 36px",
        boxShadow:t.shadowModal,border:`1px solid ${t.border}`,
        textAlign:"center",maxWidth:380,width:"100%",
      }}>
        {/* Full logo */}
        <div style={{marginBottom:28,display:"flex",justifyContent:"center"}}>
          <WellFedLogo darkMode={darkMode} height={56}/>
        </div>

        <p style={{margin:"0 0 32px",fontSize:14,color:t.textMuted,lineHeight:1.7,maxWidth:280,marginLeft:"auto",marginRight:"auto"}}>
          Track what you eat, rate how you feel, and discover which foods affect your wellbeing.
        </p>

        <div ref={btnRef} style={{display:"flex",justifyContent:"center"}}/>

        <p style={{margin:"20px 0 0",fontSize:11,color:t.textMuted}}>
          Your data is private and only visible to you.
        </p>
      </div>
    </div>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────
function SettingsPage({darkMode,onToggle,user,onSignOut,suggestions,t}){
  return(
    <div style={{padding:"0 0 80px 0"}}>
      {/* Account */}
      <div style={{background:t.surface,borderRadius:14,padding:"16px",boxShadow:t.shadow,border:`1px solid ${t.border}`,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:t.textSub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14}}>Account</div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
          {user.avatar_url
            ?<img src={user.avatar_url} alt="" style={{width:48,height:48,borderRadius:"50%",border:`2px solid ${t.accentBorder}`}}/>
            :<div style={{width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,#D85A30,#993C1D)`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:"#fff",fontWeight:700}}>
              {user.name?.[0]||"?"}
            </div>
          }
          <div>
            <div style={{fontWeight:700,color:t.text,fontSize:15}}>{user.name||"—"}</div>
            <div style={{fontSize:12,color:t.textMuted,marginTop:1}}>{user.email}</div>
          </div>
        </div>
        <button onClick={onSignOut} style={{width:"100%",background:t.surface2,border:`1px solid ${t.border}`,
          borderRadius:10,padding:"10px",fontWeight:700,cursor:"pointer",fontSize:13,
          color:t.textSub,fontFamily:"inherit"}}>Sign out</button>
      </div>

      {/* Appearance */}
      <div style={{background:t.surface,borderRadius:14,padding:"16px",boxShadow:t.shadow,border:`1px solid ${t.border}`,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:t.textSub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:14}}>Appearance</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontWeight:700,color:t.text,fontSize:14}}>{darkMode?"🌙 Dark":"☀️ Light"}</div>
            <div style={{fontSize:12,color:t.textMuted,marginTop:2}}>
              {darkMode?"Deep teal-slate palette":"Cool sage palette"}
            </div>
          </div>
          <div onClick={onToggle} style={{width:50,height:28,borderRadius:14,cursor:"pointer",
            background:darkMode?"#D85A30":t.border,position:"relative",transition:"background .25s",flexShrink:0}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:darkMode?"#D8EEEA":"#fff",position:"absolute",
              top:3,left:darkMode?25:3,transition:"left .25s",boxShadow:"0 1px 4px rgba(0,0,0,.3)"}}/>
          </div>
        </div>
      </div>

      {/* About */}
      <div style={{background:t.surface,borderRadius:14,padding:"16px",boxShadow:t.shadow,border:`1px solid ${t.border}`,marginBottom:12}}>
        <div style={{marginBottom:16,display:"flex",justifyContent:"center"}}>
          <WellFedLogo darkMode={darkMode} height={44}/>
        </div>
        <div style={{fontSize:13,color:t.textMuted,lineHeight:1.7,textAlign:"center"}}>
          Log what you eat, then come back 30–60 minutes later to rate how you feel and note any symptoms. Over time, patterns reveal which foods affect your wellbeing.
        </div>
      </div>

      {/* Suggestions — admin only */}
      {user.admin_yn&&(
        <div style={{background:t.surface,borderRadius:14,padding:"16px",boxShadow:t.shadow,border:`1px solid ${t.border}`}}>
          <div style={{fontSize:12,fontWeight:700,color:t.textSub,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>
            💡 Suggestions ({suggestions.length})
          </div>
          {suggestions.length===0?(
            <div style={{fontSize:13,color:t.textMuted,textAlign:"center",padding:"12px 0"}}>
              No suggestions yet. Use the link on the Log page to submit one.
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {suggestions.map((s,i)=>(
                <div key={i} style={{background:t.surface2,borderRadius:10,padding:"10px 12px",
                  border:`1px solid ${t.border}`}}>
                  <div style={{fontSize:13,color:t.text,lineHeight:1.6,marginBottom:4}}>{s.text}</div>
                  <div style={{fontSize:10,color:t.textMuted,fontWeight:600}}>
                    {s.name&&<span>{s.name} · </span>}
                    {new Date(s.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function topN(arr,n){
  const freq={};arr.forEach(x=>{freq[x]=(freq[x]||0)+1;});
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,n);
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("log");
  const [user,setUser]=useState(null);
  const [sessions,setSessions]=useState([]);
  const [knownFoods,setKnownFoods]=useState([]);
  const [allSymptoms,setAllSymptoms]=useState([]);
  const [suggestions,setSuggestions]=useState([]);
  const [darkMode,setDarkMode]=useState(()=>getSettings().darkMode||false);
  const [loading,setLoading]=useState(false);
  const t=darkMode?DARK:LIGHT;

  const handleCredential=useCallback(async response=>{
    setToken(response.credential);
    setLoading(true);
    try{
      const [me,meals,foods,symptoms,suggs]=await Promise.all([
        apiGet("/me"),apiGet("/meals"),apiGet("/foods"),apiGet("/symptoms"),apiGet("/suggestions"),
      ]);
      setUser(me);setSessions(meals);
      setKnownFoods(foods.map(f=>f.name));
      setAllSymptoms(symptoms.map(s=>s.name));
      setSuggestions(suggs);
    }catch(e){console.error("Login failed:",e);setToken(null);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{
    const h=()=>setUser(null);
    window.addEventListener("fj:reauth",h);
    return ()=>window.removeEventListener("fj:reauth",h);
  },[]);

  const handleSignOut=()=>{
    setToken(null);setUser(null);setSessions([]);setKnownFoods([]);setAllSymptoms([]);
    if(window.google?.accounts?.id)window.google.accounts.id.disableAutoSelect();
  };

  const toggleDark=()=>setDarkMode(d=>{saveSettings({...getSettings(),darkMode:!d});return !d;});

  const addFood=useCallback(async name=>{
    if(knownFoods.map(normalize).includes(normalize(name)))return;
    await apiPost("/foods",{name});
    setKnownFoods(prev=>[...prev,name].sort((a,b)=>a.localeCompare(b)));
  },[knownFoods]);

  const addSymptom=useCallback(async name=>{
    if(allSymptoms.map(normalize).includes(normalize(name)))return;
    await apiPost("/symptoms",{name});
    setAllSymptoms(prev=>[...prev,name].sort((a,b)=>a.localeCompare(b)));
  },[allSymptoms]);

  const saveMeal=useCallback(async foods=>{
    const meal=await apiPost("/meals",{foods});
    setSessions(prev=>[meal,...prev]);
  },[]);

  const deleteMeal=useCallback(async id=>{
    await apiFetch(`/meals/${id}`,{method:"DELETE"});
    setSessions(prev=>prev.filter(s=>s.id!==id));
  },[]);

  const updateMeal=useCallback(async updated=>{
    const meal=await apiPatch(`/meals/${updated.id}`,{rating:updated.rating,symptoms:updated.symptoms});
    setSessions(prev=>prev.map(s=>s.id===meal.id?meal:s));
  },[]);

  const submitSuggestion=useCallback(async text=>{
    const s=await apiPost("/suggestions",{text});
    setSuggestions(prev=>[s,...prev]);
  },[]);

  // Loading
  if(loading) return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      height:"100vh",background:t.bg,fontFamily:"'Nunito',sans-serif",gap:16}}>
      <WellFedIcon size={52}/>
      <div style={{fontSize:13,color:t.textMuted}}>Loading…</div>
    </div>
  );

  // Not signed in
  if(!user) return <LoginScreen onSignIn={handleCredential} darkMode={darkMode} t={t}/>;

  const TABS=[{id:"log",label:"Log",icon:"📝"},{id:"analysis",label:"Analysis",icon:"📊"},{id:"settings",label:"Settings",icon:"⚙️"}];

  return(
    <div style={{fontFamily:"'Nunito','Helvetica Neue',Arial,sans-serif",background:t.bg,minHeight:"100vh",maxWidth:600,margin:"0 auto"}}>
      {/* Header */}
      <div style={{background:t.surface,borderBottom:`1px solid ${t.border}`,
        padding:"12px 16px 0",position:"sticky",top:0,zIndex:50,boxShadow:t.shadowHdr}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          {/* Logo */}
          <WellFedLogo darkMode={darkMode} height={40}/>
          {/* Avatar */}
          <div onClick={()=>setTab("settings")} style={{cursor:"pointer",flexShrink:0}}>
            {user.avatar_url
              ?<img src={user.avatar_url} alt="" style={{width:32,height:32,borderRadius:"50%",border:`2px solid ${t.accentBorder}`,display:"block"}}/>
              :<div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,#D85A30,#993C1D)`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#FAECE7",fontWeight:700}}>
                {user.name?.[0]||"?"}
              </div>
            }
          </div>
        </div>
        {/* Tab bar */}
        <div style={{display:"flex"}}>
          {TABS.map(({id,label,icon})=>(
            <button key={id} onClick={()=>setTab(id)} style={{
              flex:1,background:"none",border:"none",cursor:"pointer",
              padding:"8px 4px",fontSize:12,fontWeight:700,fontFamily:"inherit",
              color:tab===id?"#D85A30":t.textMuted,
              borderBottom:tab===id?"3px solid #D85A30":"3px solid transparent",
              transition:"color .15s",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div style={{padding:"12px 12px 0"}}>
        {tab==="log"&&<LogPage sessions={sessions} knownFoods={knownFoods} allSymptoms={allSymptoms}
          onSaveMeal={saveMeal} onUpdateMeal={updateMeal} onDeleteMeal={deleteMeal} onAddFood={addFood} onAddSymptom={addSymptom} onSuggest={submitSuggestion} t={t}/>}
        {tab==="analysis"&&<AnalysisPage sessions={sessions} t={t}/>}
        {tab==="settings"&&<SettingsPage darkMode={darkMode} onToggle={toggleDark} user={user} onSignOut={handleSignOut} suggestions={suggestions} t={t}/>}
      </div>
    </div>
  );
}
