import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SHORT   = MONTHS.map(m => m.slice(0,3));
const CATS    = ["Essential","Food","Transport","Health","Entertainment","Education","Other"];
const CAT_CLR = { Essential:"#06b6d4", Food:"#34d399", Transport:"#fbbf24", Health:"#f87171", Entertainment:"#c4b5fd", Education:"#818cf8", Other:"#94a3b8" };

const TH_STYLE = { padding:"8px 10px", textAlign:"left", color:"#3d5166", fontSize:10, fontWeight:700,
  letterSpacing:"0.09em", textTransform:"uppercase", borderBottom:"1px solid rgba(255,255,255,0.05)", whiteSpace:"nowrap" };
const TD_STYLE = { padding:"8px 10px", borderBottom:"1px solid rgba(255,255,255,0.032)", verticalAlign:"middle" };

/* ═══════════════════════════════════════════════
   UTILS
═══════════════════════════════════════════════ */
const fmt   = n  => "৳" + Math.round(n||0).toLocaleString("en-IN");
const pct   = (a,b) => b > 0 ? Math.min(100, Math.round((a/b)*100)) : 0;
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const clamp = (v,lo,hi) => Math.min(hi, Math.max(lo, v));
const mkKey = (y,m) => `${y}-${String(m+1).padStart(2,"0")}`;
const k2ym  = k  => { const [y,m] = k.split("-"); return [+y, +m-1]; };
const nowKey= () => { const d = new Date(); return mkKey(d.getFullYear(), d.getMonth()); };

/* ═══════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════ */
const LS_KEY = "sft_v5";
function loadStore() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const d = JSON.parse(raw); if (d?.months) return d; }
  } catch {}
  // FIX: seed with current month, not hardcoded June 2025
  const ck = nowKey();
  return mkStore({ [ck]: seedCurrentMonth() });
}
function mkStore(months) {
  return { months, templates: defaultTemplates(), lastAutoInit: null };
}
function persist(d) { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} }

/* ═══════════════════════════════════════════════
   SEED / TEMPLATES
═══════════════════════════════════════════════ */
function defaultTemplates() {
  return {
    income: [
      { id: uid(), source: "Main Salary",  budgeted: 60000 },
      { id: uid(), source: "Extra Income", budgeted: 0 },
    ],
    expenses: [
      { id: uid(), name: "House Rent",      budgeted: 10000, category: "Essential" },
      { id: uid(), name: "Internet Bill",   budgeted: 1000,  category: "Essential" },
      { id: uid(), name: "Electricity",     budgeted: 2000,  category: "Essential" },
      { id: uid(), name: "Mobile Recharge", budgeted: 500,   category: "Essential" },
      { id: uid(), name: "Food Budget",     budgeted: 15000, category: "Food" },
      { id: uid(), name: "Transportation",  budgeted: 3000,  category: "Transport" },
    ],
  };
}

// FIX: seed with current month dynamically
function seedCurrentMonth() {
  return {
    income: [
      { id:uid(), source:"Main Salary",  budgeted:60000, actual:0 },
      { id:uid(), source:"Extra Income", budgeted:0,     actual:0 },
    ],
    expenses: [
      { id:uid(), name:"House Rent",      budgeted:10000, actual:0, paid:false, category:"Essential", notes:"" },
      { id:uid(), name:"Internet Bill",   budgeted:1000,  actual:0, paid:false, category:"Essential", notes:"" },
      { id:uid(), name:"Electricity",     budgeted:2000,  actual:0, paid:false, category:"Essential", notes:"" },
      { id:uid(), name:"Food Budget",     budgeted:15000, actual:0, paid:false, category:"Food",      notes:"" },
      { id:uid(), name:"Transportation",  budgeted:3000,  actual:0, paid:false, category:"Transport", notes:"" },
    ],
    debts:   [],
    savings: 0,
  };
}

function createNewMonth(templates, prevData) {
  const tmpl = templates || defaultTemplates();
  const prevDebts = (prevData?.debts || [])
    .filter(d => !d.completed)
    .map(d => {
      const rem = Math.max(0, (d.totalDebt||0) - (d.paid||0));
      return rem > 0
        ? { id:uid(), name:d.name, totalDebt:rem, paid:0, dueDate:d.dueDate, completed:false, carriedOver:true, notes:"" }
        : null;
    })
    .filter(Boolean);

  // FIX: carry previous month's positive savings as carryover income
  const prevSav = prevData ? calcMonth(prevData).sav : 0;
  const carryoverIncome = prevSav > 0
    ? [{ id:uid(), source:"Carryover (prev month)", budgeted:prevSav, actual:prevSav }]
    : [];

  return {
    income:   [...carryoverIncome, ...tmpl.income.map(t => ({ id:uid(), source:t.source, budgeted:t.budgeted, actual:0 }))],
    expenses: tmpl.expenses.map(t => ({ id:uid(), name:t.name, budgeted:t.budgeted, actual:0, paid:false, category:t.category||"Essential", notes:"" })),
    debts:    prevDebts,
    savings:  0,
  };
}

/* ═══════════════════════════════════════════════
   CALCULATIONS
═══════════════════════════════════════════════ */
function calcMonth(md) {
  const inc   = (md.income||[]).reduce((s,i) => s+(i.actual||0), 0);
  const exp   = (md.expenses||[]).reduce((s,e) => s+(e.actual||0), 0);
  const dpaid = (md.debts||[]).reduce((s,d) => s+(d.paid||0), 0);
  const sav   = inc - exp - dpaid;
  return { inc, exp, dpaid, sav };
}
function cumSavings(months) {
  return Object.values(months).reduce((s,m) => s + Math.max(0, calcMonth(m).sav), 0);
}
function buildAlerts(md) {
  const { inc, exp } = calcMonth(md);
  const bgt = (md.expenses||[]).reduce((s,e) => s+(e.budgeted||0), 0);
  const alerts = [];
  if (exp > inc) alerts.push({ type:"danger", icon:"⚠️", msg:`Overspending! Expenses exceed income by ${fmt(exp-inc)}` });
  else if (exp > bgt*1.05) alerts.push({ type:"warn", icon:"📊", msg:`Budget exceeded by ${pct(exp-bgt,bgt)}% (${fmt(exp-bgt)} over)` });
  const now = new Date();
  (md.debts||[]).forEach(d => {
    if (!d.completed && d.dueDate) {
      const days = Math.round((new Date(d.dueDate)-now)/864e5);
      if (days < 0) alerts.push({ type:"danger", icon:"🚨", msg:`"${d.name}" is OVERDUE by ${Math.abs(days)} days` });
      else if (days <= 7) alerts.push({ type:"warn", icon:"🔔", msg:`"${d.name}" due in ${days} day${days!==1?"s":""}` });
    }
  });
  if (inc > 0 && (inc-exp)/inc < 0.1) alerts.push({ type:"info", icon:"💡", msg:`Low savings rate: ${pct(Math.max(0,inc-exp),inc)}% of income saved` });
  return alerts;
}

/* ═══════════════════════════════════════════════
   EXPORT
═══════════════════════════════════════════════ */
function exportCSV(monthKey, md) {
  const [y,m] = k2ym(monthKey);
  let csv = `Sajjad Finance Tracker - ${MONTHS[m]} ${y}\n\n`;
  csv += "INCOME\nSource,Budgeted,Actual,Variance\n";
  (md.income||[]).forEach(r => { csv += `"${r.source}",${r.budgeted||0},${r.actual||0},${(r.actual||0)-(r.budgeted||0)}\n`; });
  csv += `\nEXPENSES\nName,Category,Budgeted,Actual,Paid,Notes\n`;
  (md.expenses||[]).forEach(r => { csv += `"${r.name}","${r.category||""}",${r.budgeted||0},${r.actual||0},${r.paid?"Yes":"No"},"${r.notes||""}"\n`; });
  csv += `\nDEBTS\nName,Total,Paid,Remaining,Due,Status\n`;
  (md.debts||[]).forEach(r => { csv += `"${r.name}",${r.totalDebt||0},${r.paid||0},${Math.max(0,(r.totalDebt||0)-(r.paid||0))},"${r.dueDate||""}","${r.completed?"Done":"Active"}"\n`; });
  const { inc, exp, dpaid, sav } = calcMonth(md);
  csv += `\nSUMMARY\nTotal Income,${inc}\nTotal Expenses,${exp}\nLoan Payments,${dpaid}\nMonthly Savings,${sav}\n`;
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv],{type:"text/csv"})),
    download: `finance-${monthKey}.csv`
  });
  a.click(); URL.revokeObjectURL(a.href);
}
function exportBackup(store) {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([JSON.stringify(store,null,2)],{type:"application/json"})),
    download: `finance-backup-${new Date().toISOString().slice(0,10)}.json`
  });
  a.click(); URL.revokeObjectURL(a.href);
}

/* ═══════════════════════════════════════════════
   BASE UI COMPONENTS (outside App = no remounts)
═══════════════════════════════════════════════ */
function NumInput({ value, onChange, width=108 }) {
  const [f,sf] = useState(false);
  return (
    <input type="number" value={value} onChange={e => onChange(+e.target.value||0)}
      onFocus={()=>sf(true)} onBlur={()=>sf(false)} className="hs"
      style={{ background:"rgba(255,255,255,0.05)",
        border:`1px solid ${f?"#06b6d4":"rgba(255,255,255,0.1)"}`,
        borderRadius:8, padding:"6px 8px", color:"#dde4ee", fontSize:13,
        width, outline:"none", fontFamily:"inherit", boxSizing:"border-box",
        transition:"border-color .15s" }} />
  );
}

function TxtInput({ value, onChange, placeholder="Name..." }) {
  const [f,sf] = useState(false);
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      onFocus={()=>sf(true)} onBlur={()=>sf(false)} placeholder={placeholder}
      style={{ background: f?"rgba(255,255,255,0.05)":"transparent",
        border:`1px solid ${f?"rgba(6,182,212,0.4)":"transparent"}`,
        borderRadius:7, padding:"6px 8px", color:"#c8d3e0", fontSize:13,
        outline:"none", width:"100%", fontFamily:"inherit",
        boxSizing:"border-box", transition:"all .15s" }} />
  );
}

// FIX: NEW — notes textarea input
function NotesInput({ value, onChange }) {
  const [f,sf] = useState(false);
  const [open,so] = useState(false);
  if (!open) return (
    <button onClick={()=>so(true)}
      style={{ background:"none", border:"none", color: value ? "#67e8f9" : "#2a3a4a",
        cursor:"pointer", fontSize:11, padding:"2px 6px", borderRadius:5,
        fontFamily:"inherit", transition:"color .15s" }}
      title={value || "Add note"}>
      {value ? "📝" : "＋note"}
    </button>
  );
  return (
    <textarea value={value||""} onChange={e=>onChange(e.target.value)}
      onFocus={()=>sf(true)} onBlur={()=>sf(false)}
      placeholder="Notes..."
      rows={2}
      style={{ background:"rgba(255,255,255,0.05)",
        border:`1px solid ${f?"rgba(6,182,212,0.4)":"rgba(255,255,255,0.1)"}`,
        borderRadius:7, padding:"5px 8px", color:"#c8d3e0", fontSize:11,
        outline:"none", width:"100%", fontFamily:"inherit", resize:"vertical",
        boxSizing:"border-box", transition:"all .15s" }} />
  );
}

function DateInput({ value, onChange }) {
  return (
    <input type="date" value={value} onChange={e => onChange(e.target.value)}
      style={{ background:"rgba(255,255,255,0.05)",
        border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:8, padding:"6px 8px", color:"#8899aa", fontSize:12,
        width:"100%", outline:"none", colorScheme:"dark",
        fontFamily:"inherit", boxSizing:"border-box" }} />
  );
}

function CatSelect({ value, onChange }) {
  return (
    <select value={value||"Essential"} onChange={e => onChange(e.target.value)}
      style={{ background:"transparent", border:"none",
        color:CAT_CLR[value]||"#94a3b8", fontSize:11, fontWeight:700,
        cursor:"pointer", fontFamily:"inherit", outline:"none" }}>
      {CATS.map(c => <option key={c} value={c} style={{background:"#0d1117",color:"#c8d3e0"}}>{c}</option>)}
    </select>
  );
}

function Btn({ onClick, children, color="#06b6d4", variant="outline", size="md", disabled=false, title }) {
  const [h,sh] = useState(false);
  const pad = size==="sm"?"4px 10px":size==="lg"?"10px 22px":"7px 14px";
  const fs  = size==="sm"?11:size==="lg"?14:12;
  const s = variant==="solid"
    ? { background:h?color+"cc":color, color:"#fff", border:"none" }
    : variant==="danger"
    ? { background:h?"rgba(239,68,68,0.22)":"rgba(239,68,68,0.07)", border:"1px solid rgba(239,68,68,0.4)", color:"#f87171" }
    : { background:h?color+"22":color+"0d", border:`1px solid ${h?color+"77":color+"33"}`, color };
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
      style={{ display:"inline-flex", alignItems:"center", gap:5, padding:pad,
        borderRadius:8, fontSize:fs, fontWeight:700,
        cursor:disabled?"not-allowed":"pointer", fontFamily:"inherit",
        opacity:disabled?.5:1, transition:"all .18s", whiteSpace:"nowrap", ...s }}>
      {children}
    </button>
  );
}

function AddBtn({ onClick, label, color="#06b6d4" }) {
  const [h,sh] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
      style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 13px",
        borderRadius:8, border:`1px solid ${h?color+"88":color+"33"}`,
        background:h?color+"20":color+"0d", color, fontSize:12, fontWeight:700,
        cursor:"pointer", fontFamily:"inherit", transition:"all .18s", whiteSpace:"nowrap" }}>
      <span style={{fontSize:15,lineHeight:1}}>+</span>{label}
    </button>
  );
}

function DelBtn({ onClick }) {
  const [h,sh] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)} title="Delete"
      style={{ width:28, height:28, borderRadius:7, cursor:"pointer", flexShrink:0,
        border:`1px solid ${h?"rgba(239,68,68,0.5)":"rgba(239,68,68,0.18)"}`,
        background:h?"rgba(239,68,68,0.18)":"rgba(239,68,68,0.06)", color:"#f87171",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:13, transition:"all .18s" }}>✕</button>
  );
}

function Badge({ bg, fg, children }) {
  return (
    <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:99,
      fontSize:10, fontWeight:700, background:bg, color:fg, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

function Card({ children, style={}, className="" }) {
  return (
    <div className={className}
      style={{ background:"rgba(255,255,255,0.027)",
        border:"1px solid rgba(255,255,255,0.065)",
        borderRadius:16, padding:"18px 16px", marginBottom:16, ...style }}>
      {children}
    </div>
  );
}

// FIX: rows now start visible=true immediately to prevent flash
function FadeRow({ children, visible }) {
  const [mounted, setMounted] = useState(true);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Small delay so newly added rows animate in
      const t = setTimeout(() => setShow(true), 10);
      return () => clearTimeout(t);
    } else {
      setShow(false);
      const t = setTimeout(() => setMounted(false), 280);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!mounted) return null;
  return (
    <tr style={{ opacity:show?1:0, transform:show?"none":"translateY(-6px)", transition:"opacity .28s,transform .28s" }}>
      {children}
    </tr>
  );
}

function ProgBar({ value, total, color="#818cf8", height=6 }) {
  const p = pct(value, total);
  return (
    <div style={{ height, background:"rgba(255,255,255,0.055)", borderRadius:99, overflow:"hidden" }}>
      <div style={{ height:"100%", borderRadius:99, width:`${p}%`,
        background:`linear-gradient(90deg,${color}88,${color})`,
        transition:"width .6s cubic-bezier(.4,0,.2,1)" }}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   SEARCH / FILTER BAR
   FIX: NEW — search + category filter for expenses
═══════════════════════════════════════════════ */
function SearchBar({ value, onChange, placeholder }) {
  const [f,sf] = useState(false);
  return (
    <div style={{ position:"relative", flex:"1 1 180px", minWidth:0 }}>
      <span style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)",
        color:"#3d5166", fontSize:13, pointerEvents:"none" }}>🔍</span>
      <input type="text" value={value} onChange={e=>onChange(e.target.value)}
        onFocus={()=>sf(true)} onBlur={()=>sf(false)} placeholder={placeholder||"Search..."}
        style={{ width:"100%", background:"rgba(255,255,255,0.04)",
          border:`1px solid ${f?"rgba(6,182,212,0.35)":"rgba(255,255,255,0.07)"}`,
          borderRadius:9, padding:"6px 8px 6px 30px", color:"#c8d3e0", fontSize:12,
          outline:"none", fontFamily:"inherit", boxSizing:"border-box", transition:"border-color .15s" }}/>
      {value && (
        <button onClick={()=>onChange("")}
          style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)",
            background:"none", border:"none", color:"#3d5166", cursor:"pointer", fontSize:14 }}>×</button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CONFIRM DIALOG
═══════════════════════════════════════════════ */
function Confirm({ title, detail, confirmLabel="Delete", onOk, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:2000, background:"rgba(0,0,0,0.85)",
      display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}
      onClick={onCancel}>
      <div style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,0.12)",
        borderRadius:16, padding:"28px 24px", maxWidth:420, width:"100%",
        boxShadow:"0 24px 60px rgba(0,0,0,0.8)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:800, color:"#eef2f8", marginBottom:8 }}>{title}</div>
        {detail && <div style={{ fontSize:13, color:"#3d5166", marginBottom:20, lineHeight:1.6 }}>{detail}</div>}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <Btn onClick={onCancel} color="#67e8f9">Cancel</Btn>
          <Btn onClick={onOk} variant="danger" color="#f87171">{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ALERT BANNER
═══════════════════════════════════════════════ */
function AlertBanner({ alerts }) {
  const [dismissed,sd] = useState(new Set());
  const live = alerts.filter((_,i) => !dismissed.has(i));
  if (!live.length) return null;
  const clr = { danger:"rgba(239,68,68,0.35)", warn:"rgba(251,191,36,0.3)", info:"rgba(6,182,212,0.25)" };
  const bg  = { danger:"rgba(239,68,68,0.08)", warn:"rgba(251,191,36,0.06)", info:"rgba(6,182,212,0.06)" };
  const tc  = { danger:"#fca5a5", warn:"#fde68a", info:"#67e8f9" };
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
      {live.map((a,i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10,
          padding:"9px 14px", borderRadius:10,
          border:`1px solid ${clr[a.type]||clr.info}`,
          background:bg[a.type]||bg.info }}>
          <span style={{ fontSize:12, color:tc[a.type]||tc.info }}>{a.icon} {a.msg}</span>
          <button onClick={()=>sd(p=>new Set([...p,i]))}
            style={{ background:"none", border:"none", color:"#3d5166", cursor:"pointer", fontSize:16, lineHeight:1 }}>×</button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   METRIC CARD
═══════════════════════════════════════════════ */
function MCard({ label, value, sub, color="#94a3b8", isHero, danger }) {
  const [h,sh] = useState(false);
  if (isHero) {
    return (
      <div onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
        style={{ background:"linear-gradient(135deg,rgba(6,182,212,0.14),rgba(59,130,246,0.09))",
          border:"1px solid rgba(6,182,212,0.3)", borderRadius:14, padding:"16px 18px",
          flex:"1 1 150px", minWidth:0, transform:h?"translateY(-3px)":"none",
          transition:"transform .2s", position:"relative", overflow:"hidden" }}>
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.11em", textTransform:"uppercase", color:"#67e8f9", marginBottom:7 }}>{label}</div>
        <div style={{ fontSize:22, fontWeight:800, color:"#e0f7fa", letterSpacing:"-0.02em", wordBreak:"break-all" }}>{value}</div>
        {sub && <div style={{ marginTop:5, fontSize:10, color:"#3d5166" }}>{sub}</div>}
      </div>
    );
  }
  return (
    <div onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
      style={{ background:"rgba(255,255,255,0.027)", border:`1px solid ${color}18`,
        borderRadius:14, padding:"16px 18px", flex:"1 1 150px", minWidth:0,
        transform:h?"translateY(-2px)":"none", transition:"transform .2s" }}>
      <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.11em", textTransform:"uppercase", color:"#7a8fa8", marginBottom:7 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.02em", wordBreak:"break-all",
        color:danger?"#f87171":color }}>{value}</div>
      {sub && <div style={{ marginTop:5, fontSize:10, color:"#3d5166" }}>{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DEBT MINI CARD
═══════════════════════════════════════════════ */
function DebtCard({ row, visible }) {
  const rem  = Math.max(0,(row.totalDebt||0)-(row.paid||0));
  const done = row.completed || rem===0;
  const p    = pct(row.paid||0, row.totalDebt||1);
  const col  = done?"#34d399":p>=75?"#fbbf24":"#818cf8";
  return (
    <div style={{ background:done?"rgba(5,150,105,0.07)":"rgba(255,255,255,0.025)",
      border:`1px solid ${done?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.065)"}`,
      borderRadius:12, padding:"14px 16px",
      opacity:visible?1:0, transform:visible?"none":"translateY(10px)",
      transition:"opacity .3s,transform .3s" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:8 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:done?"#6ee7b7":"#c8d3e0",
            textDecoration:done?"line-through":"none", marginBottom:3, wordBreak:"break-word" }}>{row.name}</div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
            {row.carriedOver && <Badge bg="rgba(251,191,36,0.1)" fg="#fbbf24">↩ Carried</Badge>}
            {row.dueDate && <span style={{ fontSize:10, color:"#3d5166" }}>Due {row.dueDate}</span>}
          </div>
        </div>
        {done
          ? <Badge bg="rgba(5,150,105,0.18)" fg="#34d399">DONE</Badge>
          : <Badge bg="rgba(99,102,241,0.16)" fg="#818cf8">ACTIVE</Badge>}
      </div>
      <div style={{ marginBottom:4 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#3d5166", marginBottom:4 }}>
          <span style={{ color:col, fontWeight:700 }}>{p}%</span>
          <span>{fmt(row.paid||0)} / {fmt(row.totalDebt||0)}</span>
        </div>
        <ProgBar value={row.paid||0} total={row.totalDebt||0} color={col}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11 }}>
        <span style={{ color:"#3d5166" }}>Remaining <span style={{ color:done?"#34d399":"#f87171", fontWeight:700 }}>{fmt(rem)}</span></span>
        <span style={{ color:"#3d5166" }}>Total <span style={{ color:"#c8d3e0", fontWeight:700 }}>{fmt(row.totalDebt||0)}</span></span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MONTH NAVIGATOR
═══════════════════════════════════════════════ */
function MonthNav({ year, month, onChange, allKeys }) {
  const [open,so] = useState(false);
  const key = mkKey(year,month);
  const go  = useCallback(dir => {
    let m=month+dir, y=year;
    if(m<0){m=11;y--;} if(m>11){m=0;y++;}
    onChange(y,m);
  }, [month, year, onChange]);
  const bs = { borderRadius:8, border:"1px solid rgba(6,182,212,0.3)", background:"rgba(6,182,212,0.08)", color:"#67e8f9", cursor:"pointer", fontFamily:"inherit", outline:"none" };
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, position:"relative" }}>
      <button onClick={()=>go(-1)} style={{...bs,width:32,height:32,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
      <button onClick={()=>so(p=>!p)} style={{...bs,padding:"6px 14px",fontWeight:700,fontSize:13,minWidth:152,textAlign:"center"}}>
        {MONTHS[month]} {year} {open?"▲":"▼"}
      </button>
      <button onClick={()=>go(1)} style={{...bs,width:32,height:32,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
      {open && (
        <div onClick={e=>e.stopPropagation()}
          style={{ position:"absolute", top:42, left:38, zIndex:300, background:"#0d1117",
            border:"1px solid rgba(6,182,212,0.25)", borderRadius:12, padding:8,
            minWidth:200, boxShadow:"0 8px 32px rgba(0,0,0,0.7)", maxHeight:280, overflowY:"auto" }}>
          {[...allKeys].sort().map(k => {
            const [ky,km] = k2ym(k); const isA = k===key;
            return (
              <div key={k} onClick={()=>{onChange(ky,km);so(false);}}
                style={{ padding:"7px 12px", borderRadius:8, cursor:"pointer", fontSize:13,
                  fontWeight:isA?700:400, color:isA?"#67e8f9":"#c8d3e0",
                  background:isA?"rgba(6,182,212,0.12)":"transparent", marginBottom:2 }}>
                {MONTHS[km]} {ky}{isA?" ✓":""}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   HISTORY MANAGER
═══════════════════════════════════════════════ */
function HistoryMgr({ store, onUpdate, onClose }) {
  const [cfm,sc] = useState(null);
  const months   = store.months||{};
  const sorted   = Object.keys(months).sort().reverse();

  const del = useCallback(key => {
    const m={...months}; delete m[key]; onUpdate({...store,months:m});
  }, [months, store, onUpdate]);

  const clearAll = useCallback(() => onUpdate({...store,months:{}}), [store, onUpdate]);

  const resetSec = useCallback((key,sec) => {
    const blank = (sec==="income"||sec==="expenses"||sec==="debts") ? [] : 0;
    const patch  = sec==="savings" ? { savings:0 } : { [sec]:blank };
    onUpdate({...store,months:{...months,[key]:{...months[key],...patch}}});
  }, [months, store, onUpdate]);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.85)",
      display:"flex", alignItems:"flex-start", justifyContent:"center",
      padding:"20px 16px", overflowY:"auto" }} onClick={onClose}>
      <div style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:18, padding:"24px 20px", maxWidth:640, width:"100%", marginTop:40 }}
        onClick={e=>e.stopPropagation()}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:"#eef2f8" }}>History Management</div>
            <div style={{ fontSize:11, color:"#3d5166", marginTop:2 }}>Delete, reset, or manage saved months</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={()=>sc({t:"all"})} variant="danger" size="sm">🗑 Clear All</Btn>
            <Btn onClick={onClose} color="#67e8f9" size="sm">Close</Btn>
          </div>
        </div>

        {sorted.length===0 && (
          <div style={{ color:"#3d5166", textAlign:"center", padding:40, fontSize:13 }}>No history saved yet.</div>
        )}

        {sorted.map(key => {
          const [y,m] = k2ym(key);
          const md    = months[key];
          const { inc, exp, sav } = calcMonth(md);
          return (
            <div key={key} style={{ background:"rgba(255,255,255,0.025)",
              border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px", marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#c8d3e0" }}>{MONTHS[m]} {y}</div>
                  <div style={{ fontSize:11, color:"#3d5166", marginTop:2 }}>
                    <span style={{ color:"#4ade80" }}>{fmt(inc)}</span> in ·{" "}
                    <span style={{ color:"#f87171" }}>{fmt(exp)}</span> out ·{" "}
                    <span style={{ color:sav>=0?"#c4b5fd":"#fb923c" }}>{sav>=0?"+":""}{fmt(sav)}</span> net
                  </div>
                </div>
                <Btn onClick={()=>sc({t:"month",key})} variant="danger" size="sm">Delete Month</Btn>
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <Btn onClick={()=>sc({t:"sec",key,sec:"income"})}   size="sm" color="#4ade80">Reset Income</Btn>
                <Btn onClick={()=>sc({t:"sec",key,sec:"expenses"})} size="sm" color="#f87171">Reset Expenses</Btn>
                <Btn onClick={()=>sc({t:"sec",key,sec:"debts"})}    size="sm" color="#818cf8">Reset Debts</Btn>
                <Btn onClick={()=>sc({t:"sec",key,sec:"savings"})}  size="sm" color="#fbbf24">Reset Savings</Btn>
              </div>
            </div>
          );
        })}

        {cfm?.t==="all" && (
          <Confirm title="Clear All History?" detail="Every month will be permanently deleted. This cannot be undone."
            confirmLabel="Clear All" onOk={()=>{clearAll();sc(null);onClose();}} onCancel={()=>sc(null)}/>
        )}
        {cfm?.t==="month" && (()=>{ const [y,m]=k2ym(cfm.key); return (
          <Confirm title={`Delete ${MONTHS[m]} ${y}?`} detail="All data for this month will be permanently deleted."
            confirmLabel="Delete" onOk={()=>{del(cfm.key);sc(null);}} onCancel={()=>sc(null)}/>
        );})()}
        {cfm?.t==="sec" && (
          <Confirm title={`Reset ${cfm.sec} for this month?`} detail="This section will be cleared. Other sections stay intact."
            confirmLabel="Reset" onOk={()=>{resetSec(cfm.key,cfm.sec);sc(null);}} onCancel={()=>sc(null)}/>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TEMPLATE MANAGER
═══════════════════════════════════════════════ */
function TemplateMgr({ templates, onSave, onClose }) {
  const [t,st] = useState(() => JSON.parse(JSON.stringify(templates)));
  const ui     = fn => st(p => ({...p,...fn(p)}));
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.85)",
      display:"flex", alignItems:"flex-start", justifyContent:"center",
      padding:"20px 16px", overflowY:"auto" }} onClick={onClose}>
      <div style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)",
        borderRadius:18, padding:"24px 20px", maxWidth:660, width:"100%", marginTop:40 }}
        onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:"#eef2f8" }}>Recurring Templates</div>
            <div style={{ fontSize:11, color:"#3d5166", marginTop:2 }}>Auto-filled every month</div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={()=>{onSave(t);onClose();}} variant="solid" color="#06b6d4">Save</Btn>
            <Btn onClick={onClose} color="#67e8f9">Cancel</Btn>
          </div>
        </div>

        <div style={{ marginBottom:22 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#4ade80", letterSpacing:"0.1em", textTransform:"uppercase" }}>Income Templates</span>
            <Btn size="sm" color="#4ade80" onClick={()=>ui(p=>({income:[...p.income,{id:uid(),source:"New Source",budgeted:0}]}))}>+ Add</Btn>
          </div>
          {t.income.map(x => (
            <div key={x.id} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" }}>
              <div style={{ flex:"1 1 160px", minWidth:0 }}>
                <TxtInput value={x.source} onChange={v=>ui(p=>({income:p.income.map(r=>r.id===x.id?{...r,source:v}:r)}))} placeholder="Source name..."/>
              </div>
              <NumInput value={x.budgeted} onChange={v=>ui(p=>({income:p.income.map(r=>r.id===x.id?{...r,budgeted:v}:r)}))} width={110}/>
              <DelBtn onClick={()=>ui(p=>({income:p.income.filter(r=>r.id!==x.id)}))}/>
            </div>
          ))}
        </div>

        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#f87171", letterSpacing:"0.1em", textTransform:"uppercase" }}>Expense Templates</span>
            <Btn size="sm" color="#f87171" onClick={()=>ui(p=>({expenses:[...p.expenses,{id:uid(),name:"New Expense",budgeted:0,category:"Essential"}]}))}>+ Add</Btn>
          </div>
          {t.expenses.map(x => (
            <div key={x.id} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8, flexWrap:"wrap" }}>
              <div style={{ flex:"1 1 140px", minWidth:0 }}>
                <TxtInput value={x.name} onChange={v=>ui(p=>({expenses:p.expenses.map(r=>r.id===x.id?{...r,name:v}:r)}))} placeholder="Expense name..."/>
              </div>
              <CatSelect value={x.category||"Essential"} onChange={v=>ui(p=>({expenses:p.expenses.map(r=>r.id===x.id?{...r,category:v}:r)}))}/>
              <NumInput value={x.budgeted} onChange={v=>ui(p=>({expenses:p.expenses.map(r=>r.id===x.id?{...r,budgeted:v}:r)}))} width={100}/>
              <DelBtn onClick={()=>ui(p=>({expenses:p.expenses.filter(r=>r.id!==x.id)}))}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CHARTS
═══════════════════════════════════════════════ */
function TrendChart({ allData }) {
  const keys = Object.keys(allData).sort().slice(-6);
  if (keys.length < 2) return <p style={{ color:"#3d5166", fontSize:12, textAlign:"center", padding:24 }}>Need 2+ months for trend chart</p>;
  const items = keys.map(k => {
    const [y,m] = k2ym(k); const d = allData[k];
    const inc = (d.income||[]).reduce((s,i)=>s+(i.actual||0),0);
    const exp = (d.expenses||[]).reduce((s,e)=>s+(e.actual||0),0);
    return { lbl:`${SHORT[m]}'${String(y).slice(2)}`, inc, exp };
  });
  const mx = Math.max(...items.flatMap(i=>[i.inc,i.exp]), 1);
  const W=560,H=160,PL=48,PB=28,PT=14,CW=W-PL-16,CH=H-PB-PT;
  const bw = Math.min(24,(CW/items.length/2)-4);
  const gap= CW/items.length;
  return (
    <div style={{ overflowX:"auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", minWidth:280, height:"auto", display:"block" }}>
        {[0,25,50,75,100].map(p => {
          const y=PT+CH*(1-p/100);
          return <g key={p}>
            <line x1={PL} y1={y} x2={W-16} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>
            <text x={PL-5} y={y+4} textAnchor="end" fontSize={8} fill="#3d5166">{(mx*p/100/1000).toFixed(0)}k</text>
          </g>;
        })}
        {items.map((item,i) => {
          const cx=PL+i*gap+gap/2;
          const ih=(item.inc/mx)*CH, eh=(item.exp/mx)*CH;
          return <g key={i}>
            <rect x={cx-bw-2} y={PT+CH-ih} width={bw} height={ih} rx={3} fill="rgba(74,222,128,0.75)"/>
            <rect x={cx+2}    y={PT+CH-eh} width={bw} height={eh} rx={3} fill="rgba(248,113,113,0.75)"/>
            <text x={cx} y={H-8} textAnchor="middle" fontSize={8} fill="#4a90d9">{item.lbl}</text>
          </g>;
        })}
        <rect x={PL} y={3} width={8} height={8} fill="rgba(74,222,128,0.75)" rx={2}/>
        <text x={PL+12} y={10} fontSize={8.5} fill="#4ade80">Income</text>
        <rect x={PL+60} y={3} width={8} height={8} fill="rgba(248,113,113,0.75)" rx={2}/>
        <text x={PL+74} y={10} fontSize={8.5} fill="#f87171">Expenses</text>
      </svg>
    </div>
  );
}

function SavingsChart({ allData }) {
  const keys = Object.keys(allData).sort().slice(-8);
  if (keys.length < 2) return null;
  let cum = 0;
  const items = keys.map(k => {
    const [,m] = k2ym(k);
    const s = Math.max(0, calcMonth(allData[k]).sav);
    cum += s;
    return { lbl:SHORT[m], cum };
  });
  const mx = Math.max(...items.map(i=>i.cum), 1);
  const W=560,H=110,PL=48,PB=22,PT=10,CW=W-PL-16,CH=H-PB-PT;
  const step = CW/(items.length-1);
  const pts  = items.map((it,i)=>({ x:PL+i*step, y:PT+CH*(1-(it.cum/mx)) }));
  const path = pts.map((p,i)=>`${i===0?"M":"L"} ${p.x} ${p.y}`).join(" ");
  const area = `${path} L ${pts[pts.length-1].x} ${PT+CH} L ${PL} ${PT+CH} Z`;
  return (
    <div style={{ overflowX:"auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", minWidth:280, height:"auto", display:"block" }}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0,50,100].map(p => <line key={p} x1={PL} y1={PT+CH*(1-p/100)} x2={W-16} y2={PT+CH*(1-p/100)} stroke="rgba(255,255,255,0.04)" strokeWidth={1}/>)}
        <path d={area} fill="url(#sg)"/>
        <path d={path} fill="none" stroke="#c4b5fd" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i) => <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#c4b5fd"/>
          <text x={p.x} y={H-5} textAnchor="middle" fontSize={8} fill="#4a90d9">{items[i].lbl}</text>
        </g>)}
      </svg>
    </div>
  );
}

function DonutChart({ expenses }) {
  const by = {};
  (expenses||[]).forEach(e => { const c=e.category||"Other"; by[c]=(by[c]||0)+(e.actual||0); });
  const entries = Object.entries(by).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const total   = entries.reduce((s,[,v])=>s+v,0);
  if (!total) return <p style={{ color:"#3d5166", fontSize:12, textAlign:"center", padding:20 }}>No expense data yet</p>;
  const R=56,INN=34,CX=75,CY=75;
  let angle = -Math.PI/2;
  const slices = entries.map(([cat,val]) => {
    const a = (val/total)*2*Math.PI;
    const x1=CX+R*Math.cos(angle), y1=CY+R*Math.sin(angle);
    angle += a;
    const x2=CX+R*Math.cos(angle), y2=CY+R*Math.sin(angle);
    return { cat, val, x1, y1, x2, y2, large:a>Math.PI?1:0, color:CAT_CLR[cat]||"#94a3b8" };
  });
  return (
    <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
      <svg viewBox="0 0 150 150" style={{ width:130, height:130, flexShrink:0 }}>
        {slices.map((s,i) => <path key={i} d={`M ${CX} ${CY} L ${s.x1} ${s.y1} A ${R} ${R} 0 ${s.large} 1 ${s.x2} ${s.y2} Z`} fill={s.color} opacity={0.85}/>)}
        <circle cx={CX} cy={CY} r={INN} fill="#0b0f17"/>
        <text x={CX} y={CY-4} textAnchor="middle" fontSize={9} fontWeight="bold" fill="#c8d3e0">Total</text>
        <text x={CX} y={CY+9} textAnchor="middle" fontSize={8.5} fill="#67e8f9">{fmt(total)}</text>
      </svg>
      <div style={{ flex:1, minWidth:110 }}>
        {entries.map(([cat,val]) => (
          <div key={cat} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:5 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:CAT_CLR[cat]||"#94a3b8", flexShrink:0 }}/>
            <span style={{ fontSize:11, color:"#c8d3e0", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{cat}</span>
            <span style={{ fontSize:11, color:"#4a90d9", fontWeight:700 }}>{pct(val,total)}%</span>
            <span style={{ fontSize:10, color:"#3d5166" }}>{fmt(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════ */
export default function App() {
  const now = new Date();
  const [store,SS]       = useState(() => loadStore());
  const [curY,sCY]       = useState(now.getFullYear());
  const [curM,sCM]       = useState(now.getMonth());
  // FIX: vis starts with rows already visible = true to prevent initial flash
  const [vis,sv]         = useState({});
  const [modal,sm]       = useState(null);
  // FIX: separate filter state per section
  const [expSearch,setExpSearch] = useState("");
  const [expCat,setExpCat]       = useState("All");
  const fileRef                  = useRef();

  useEffect(() => { persist(store); }, [store]);

  // FIX: proper deps — month key drives auto-init
  useEffect(() => {
    const ck = nowKey();
    SS(prev => {
      if (prev.months[ck] || prev.lastAutoInit === ck) return prev;
      const sk     = Object.keys(prev.months).sort();
      const prevMd = sk.length ? prev.months[sk[sk.length-1]] : null;
      const nm     = createNewMonth(prev.templates||defaultTemplates(), prevMd);
      return { ...prev, months:{...prev.months,[ck]:nm}, lastAutoInit:ck };
    });
  }, []); // intentionally runs once on mount only

  const monthKey = mkKey(curY, curM);
  const allKeys  = Object.keys(store.months);
  const md       = store.months[monthKey] || createNewMonth(store.templates||defaultTemplates(), null);
  const income   = md.income  || [];
  const expenses = md.expenses|| [];
  const debts    = md.debts   || [];
  const isCur    = nowKey() === monthKey;

  // FIX: initialize vis with true for existing rows so they don't flash
  useEffect(() => {
    const m = {};
    [...income,...expenses,...debts].forEach(r => { m[r.id] = true; });
    sv(m);
  }, [monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Core updaters ── */
  const updI = useCallback(fn => SS(p => {
    const c = p.months[monthKey]||{};
    return { ...p, months:{ ...p.months, [monthKey]:{ ...c, income:fn(c.income||[]) } } };
  }), [monthKey]);

  const updE = useCallback(fn => SS(p => {
    const c = p.months[monthKey]||{};
    return { ...p, months:{ ...p.months, [monthKey]:{ ...c, expenses:fn(c.expenses||[]) } } };
  }), [monthKey]);

  const updD = useCallback(fn => SS(p => {
    const c = p.months[monthKey]||{};
    return { ...p, months:{ ...p.months, [monthKey]:{ ...c, debts:fn(c.debts||[]) } } };
  }), [monthKey]);

  // FIX: new rows start with vis=false then animate in after mount
  const show = useCallback(id => {
    // brief delay so FadeRow mounts first, then triggers animate-in
    setTimeout(() => sv(p => ({...p,[id]:true})), 20);
  }, []);
  const hide = useCallback((id,cb) => { sv(p=>({...p,[id]:false})); setTimeout(cb,285); }, []);

  /* Income handlers */
  const addI = useCallback(() => { const id=uid(); updI(a=>[...a,{id,source:"New Source",budgeted:0,actual:0}]); show(id); }, [updI,show]);
  const delI = useCallback(id => hide(id,()=>updI(a=>a.filter(r=>r.id!==id))), [hide,updI]);
  const setI = useCallback((id,k,v) => updI(a=>a.map(r=>r.id===id?{...r,[k]:v}:r)), [updI]);

  /* Expense handlers */
  const addE = useCallback(() => {
    const id=uid();
    updE(a=>[...a,{id,name:"New Expense",budgeted:0,actual:0,paid:false,category:"Essential",notes:""}]);
    show(id);
  }, [updE,show]);
  const delE = useCallback(id => hide(id,()=>updE(a=>a.filter(r=>r.id!==id))), [hide,updE]);
  const setE = useCallback((id,k,v) => updE(a=>a.map(r=>r.id===id?{...r,[k]:v}:r)), [updE]);

  /* Debt handlers */
  const addD = useCallback(() => {
    const id=uid();
    updD(a=>[...a,{id,name:"New Debt",totalDebt:0,paid:0,dueDate:"",completed:false,notes:""}]);
    show(id);
  }, [updD,show]);
  const delD = useCallback(id => hide(id,()=>updD(a=>a.filter(r=>r.id!==id))), [hide,updD]);
  const setD = useCallback((id,k,v) => updD(a=>a.map(r=>r.id===id?{...r,[k]:v}:r)), [updD]);

  const handleMonthChange = useCallback((y,m) => {
    setExpSearch(""); setExpCat("All");
    sCY(y); sCM(m);
  }, []);

  const handleNextMonth = useCallback(() => {
    const nm=curM===11?0:curM+1, ny=curM===11?curY+1:curY;
    const nk=mkKey(ny,nm);
    SS(prev => {
      if (prev.months[nk]) return prev;
      const created = createNewMonth(prev.templates||defaultTemplates(), prev.months[monthKey]);
      return { ...prev, months:{ ...prev.months, [nk]:created } };
    });
    sCY(ny); sCM(nm);
  }, [curM, curY, monthKey]);

  const handleImport = useCallback(e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => {
      try { const d=JSON.parse(ev.target.result); if(d?.months){SS(d);alert("Restored successfully!");} else alert("Invalid backup file."); }
      catch { alert("Could not parse file."); }
    };
    r.readAsText(f); e.target.value="";
  }, []);

  /* Totals */
  const { inc:totalInc, exp:totalExp, dpaid:loanPaid, sav:mthSav } = calcMonth(md);
  const paidExp   = expenses.filter(e=>e.paid).reduce((s,e)=>s+(e.actual||0),0);
  const liveCash  = totalInc - paidExp;
  const netBal    = totalInc - totalExp;
  const totalDebt = debts.reduce((s,d)=>s+(d.totalDebt||0),0);
  const totalPaid = debts.reduce((s,d)=>s+(d.paid||0),0);
  const remDebt   = totalDebt - totalPaid;
  const debtPct   = pct(totalPaid,totalDebt);
  const bgtInc    = income.reduce((s,i)=>s+(i.budgeted||0),0);
  const bgtExp    = expenses.reduce((s,e)=>s+(e.budgeted||0),0);
  const paidCnt   = expenses.filter(e=>e.paid).length;
  const cumSav    = useMemo(()=>cumSavings(store.months),[store.months]);
  const alerts    = useMemo(()=>buildAlerts(md),[md]);

  // FIX: filtered expenses (search + category)
  const filteredExp = useMemo(() => expenses.filter(e => {
    const matchCat  = expCat==="All" || e.category===expCat;
    const matchText = !expSearch || e.name.toLowerCase().includes(expSearch.toLowerCase()) ||
                      (e.notes||"").toLowerCase().includes(expSearch.toLowerCase());
    return matchCat && matchText;
  }), [expenses, expSearch, expCat]);

  const expCats = useMemo(() => {
    const used = [...new Set(expenses.map(e=>e.category||"Other"))];
    return ["All", ...CATS.filter(c=>used.includes(c))];
  }, [expenses]);

  return (
    <div style={{ minHeight:"100vh",
      background:"linear-gradient(160deg,#07090e 0%,#0b0f17 55%,#070a0f 100%)",
      fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",
      color:"#dde4ee", paddingBottom:60 }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .hs::-webkit-outer-spin-button,.hs::-webkit-inner-spin-button{-webkit-appearance:none}
        .hs{-moz-appearance:textfield}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .su{animation:fadeUp .36s ease both}
        .er{transition:opacity .22s,background .18s}
        .er:hover{background:rgba(255,255,255,0.016)!important}
        .er.paid{opacity:.38}
        .dr.done td{opacity:.52;text-decoration:line-through;text-decoration-color:rgba(52,211,153,0.4)}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.4) sepia(1) saturate(.5)}
        .wrap{max-width:1260px;margin:0 auto;padding:0 18px}
        @media(max-width:720px){
          .hdr{padding:10px 12px!important;flex-wrap:wrap!important;gap:8px!important}
          .wrap{padding:0 10px!important}
          .cr{flex-direction:column!important}
          .cr>div{width:100%!important;flex:none!important}
          .ts{overflow-x:auto;-webkit-overflow-scrolling:touch}
          .hm{display:none!important}
          .ta{flex-wrap:wrap!important}
        }
      `}</style>

      {/* HEADER */}
      <header className="hdr" style={{ borderBottom:"1px solid rgba(99,179,237,0.08)",
        background:"rgba(7,9,14,0.93)", backdropFilter:"blur(20px)",
        position:"sticky", top:0, zIndex:50, padding:"13px 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:9,
            background:"linear-gradient(135deg,#06b6d4,#3b82f6)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontWeight:800, color:"#fff", fontSize:15, flexShrink:0,
            boxShadow:"0 0 14px rgba(6,182,212,0.35)" }}>S</div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:"#eef2f8" }}>Sajjad's Finance Tracker</div>
            <div className="hm" style={{ fontSize:10, color:"#4a90d9", marginTop:1 }}>Personal Finance Dashboard</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <MonthNav year={curY} month={curM} onChange={handleMonthChange} allKeys={allKeys.length?allKeys:[monthKey]}/>
          {isCur ? <Badge bg="rgba(34,197,94,0.15)" fg="#4ade80">● LIVE</Badge>
                 : <Badge bg="rgba(251,191,36,0.12)" fg="#fbbf24">HISTORY</Badge>}
        </div>
      </header>

      <div className="wrap" style={{ marginTop:20 }}>

        {/* ACTION BAR */}
        <div className="ta" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, gap:8, flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <Badge bg="rgba(6,182,212,0.11)"  fg="#67e8f9">{MONTHS[curM]} {curY}</Badge>
            <Badge bg="rgba(34,197,94,0.1)"   fg="#4ade80">{paidCnt}/{expenses.length} Paid</Badge>
            <Badge bg="rgba(99,102,241,0.1)"  fg="#818cf8">{allKeys.length} Month{allKeys.length!==1?"s":""}</Badge>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {isCur && <Btn onClick={handleNextMonth} size="sm" color="#06b6d4">+ Next Month</Btn>}
            <Btn onClick={()=>sm("templates")} size="sm" color="#fbbf24">⚙ Templates</Btn>
            <Btn onClick={()=>sm("history")}   size="sm" color="#818cf8">🗂 History</Btn>
            <Btn onClick={()=>sm("charts")}    size="sm" color="#34d399">📊 Charts</Btn>
            <Btn onClick={()=>exportCSV(monthKey,md)}  size="sm" color="#67e8f9">↓ CSV</Btn>
            <Btn onClick={()=>exportBackup(store)}      size="sm" color="#94a3b8">↓ Backup</Btn>
            <Btn onClick={()=>fileRef.current.click()}  size="sm" color="#94a3b8">↑ Restore</Btn>
            <input ref={fileRef} type="file" accept=".json" onChange={handleImport} style={{display:"none"}}/>
          </div>
        </div>

        {/* ALERTS */}
        <AlertBanner alerts={alerts}/>

        {/* HISTORY STRIP */}
        {allKeys.length > 1 && (
          <div style={{ marginBottom:14, padding:"11px 14px",
            background:"rgba(99,102,241,0.04)", border:"1px solid rgba(99,102,241,0.1)",
            borderRadius:12, overflowX:"auto" }}>
            <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#3d5166", marginBottom:8 }}>
              Monthly History
            </div>
            <div style={{ display:"flex", gap:8, minWidth:"max-content" }}>
              {[...allKeys].sort().map(k => {
                const [ky,km] = k2ym(k);
                const d       = store.months[k];
                const { inc, exp, sav } = calcMonth(d);
                const isA     = k === monthKey;
                return (
                  <div key={k} onClick={()=>{sCY(ky);sCM(km);}}
                    style={{ padding:"9px 12px", borderRadius:10, cursor:"pointer",
                      minWidth:106, flexShrink:0, transition:"all .2s",
                      border:`1px solid ${isA?"rgba(6,182,212,0.4)":"rgba(255,255,255,0.06)"}`,
                      background:isA?"rgba(6,182,212,0.08)":"rgba(255,255,255,0.02)" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:isA?"#67e8f9":"#4a90d9", marginBottom:4 }}>
                      {MONTHS[km].slice(0,3)} {ky}
                    </div>
                    <div style={{ fontSize:11, color:"#4ade80", fontWeight:700 }}>{fmt(inc)}</div>
                    <div style={{ fontSize:10, color:"#f87171" }}>{fmt(exp)}</div>
                    <div style={{ fontSize:10, color:sav>=0?"#c4b5fd":"#fb923c", fontWeight:700, marginTop:2 }}>
                      {sav>=0?"+":""}{fmt(sav)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FINANCIAL OVERVIEW */}
        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.13em", textTransform:"uppercase", color:"#2a3a4a", marginBottom:9 }}>
          Financial Overview
        </div>
        <div className="cr" style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:9 }}>
          <MCard label="Total Income"   value={fmt(totalInc)} color="#4ade80" sub={`${income.length} sources · budget ${fmt(bgtInc)}`}/>
          <MCard label="Total Expenses" value={fmt(totalExp)} color="#f87171" sub={`${expenses.length} items · budget ${fmt(bgtExp)}`}/>
          <MCard label="Cash in Hand"   value={fmt(liveCash)} isHero sub={`After ${fmt(paidExp)} paid`}/>
          <MCard label="Net Balance"    value={fmt(netBal)}   color="#c4b5fd" danger={netBal<0}/>
        </div>
        <div className="cr" style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:9 }}>
          <MCard label="Monthly Savings"   value={fmt(mthSav)}  color={mthSav>=0?"#34d399":"#f87171"} sub="Income − Expenses − Loans" danger={mthSav<0}/>
          <MCard label="Total Accumulated" value={fmt(cumSav)}  color="#a5b4fc" sub={`Across ${allKeys.length} month${allKeys.length!==1?"s":""}`}/>
          <MCard label="Outstanding Loans" value={fmt(remDebt)} color="#fbbf24" danger={remDebt>0} sub={`${debtPct}% cleared`}/>
          <MCard label="Loan Paid (Month)" value={fmt(loanPaid)} color="#818cf8"/>
        </div>

        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.13em", textTransform:"uppercase", color:"#2a3a4a", margin:"10px 0 9px" }}>
          Debt Overview
        </div>
        <div className="cr" style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
          <MCard label="Total Debt"     value={fmt(totalDebt)} color="#f87171"/>
          <MCard label="Total Paid"     value={fmt(totalPaid)} color="#4ade80" sub={`${debtPct}% cleared`}/>
          <MCard label="Remaining"      value={fmt(remDebt)}   color="#fbbf24" danger={remDebt>0}/>
          <MCard label="Debt Clearance" value={`${debtPct}%`}  color="#fb923c"/>
        </div>

        {/* INCOME TABLE */}
        <Card className="su">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#4ade80" }}>▸ Income Tracker</span>
            <AddBtn onClick={addI} label="Add Source" color="#4ade80"/>
          </div>
          <div className="ts">
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr>
                <th style={TH_STYLE}>Source</th>
                <th style={{...TH_STYLE,textAlign:"right",width:110}} className="hm">Budgeted</th>
                <th style={{...TH_STYLE,textAlign:"right",width:110}}>Actual</th>
                <th style={{...TH_STYLE,textAlign:"right",width:90}}>Variance</th>
                <th style={{...TH_STYLE,width:36}}/>
              </tr></thead>
              <tbody>
                {income.map(row => {
                  const v = (row.actual||0)-(row.budgeted||0);
                  return (
                    <FadeRow key={row.id} visible={vis[row.id]??true}>
                      <td style={TD_STYLE}><TxtInput value={row.source} onChange={v=>setI(row.id,"source",v)} placeholder="Income source..."/></td>
                      <td style={{...TD_STYLE,textAlign:"right"}} className="hm"><NumInput value={row.budgeted} onChange={v=>setI(row.id,"budgeted",v)}/></td>
                      <td style={{...TD_STYLE,textAlign:"right"}}><NumInput value={row.actual} onChange={v=>setI(row.id,"actual",v)}/></td>
                      <td style={{...TD_STYLE,textAlign:"right"}}>
                        <span style={{ fontWeight:700, fontSize:12, color:v>=0?"#4ade80":"#f87171" }}>{v>=0?"+":""}{fmt(v)}</span>
                      </td>
                      <td style={TD_STYLE}><DelBtn onClick={()=>delI(row.id)}/></td>
                    </FadeRow>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td style={{...TD_STYLE,fontWeight:800,color:"#4ade80",borderTop:"1px solid rgba(34,197,94,0.14)"}}>Total</td>
                <td style={{...TD_STYLE,textAlign:"right",color:"#3d5166",borderTop:"1px solid rgba(34,197,94,0.14)"}} className="hm">{fmt(bgtInc)}</td>
                <td style={{...TD_STYLE,textAlign:"right",fontWeight:800,color:"#4ade80",fontSize:15,borderTop:"1px solid rgba(34,197,94,0.14)"}}>{fmt(totalInc)}</td>
                <td colSpan={2} style={{borderTop:"1px solid rgba(34,197,94,0.14)"}}/>
              </tr></tfoot>
            </table>
          </div>
        </Card>

        {/* EXPENSE TABLE */}
        <Card className="su">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
            <div>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#f87171" }}>▸ Expense Tracker</span>
              <span style={{ marginLeft:10, fontSize:11, color:"#3d5166" }}>
                Paid <span style={{ color:"#f87171", fontWeight:700 }}>{fmt(paidExp)}</span>
                {" · "}Pending <span style={{ color:"#fbbf24", fontWeight:700 }}>{fmt(totalExp-paidExp)}</span>
              </span>
            </div>
            <AddBtn onClick={addE} label="Add Expense" color="#f87171"/>
          </div>

          {/* FIX: NEW — search + category filter bar */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
            <SearchBar value={expSearch} onChange={setExpSearch} placeholder="Search expenses or notes..."/>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {expCats.map(cat => (
                <button key={cat} onClick={()=>setExpCat(cat)}
                  style={{ padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                    cursor:"pointer", fontFamily:"inherit", border:"none", transition:"all .15s",
                    background:expCat===cat
                      ? (cat==="All"?"rgba(6,182,212,0.25)":CAT_CLR[cat]+"30")
                      : "rgba(255,255,255,0.04)",
                    color:expCat===cat
                      ? (cat==="All"?"#67e8f9":CAT_CLR[cat]||"#94a3b8")
                      : "#3d5166" }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {(expSearch || expCat!=="All") && (
            <div style={{ fontSize:11, color:"#3d5166", marginBottom:8 }}>
              Showing {filteredExp.length} of {expenses.length} items
              {expSearch && <> · <span style={{ color:"#67e8f9" }}>"{expSearch}"</span></>}
              {expCat!=="All" && <> · <span style={{ color:CAT_CLR[expCat] }}>{expCat}</span></>}
            </div>
          )}

          <div className="ts">
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr>
                <th style={{...TH_STYLE,width:32,textAlign:"center"}}>✓</th>
                <th style={TH_STYLE}>Expense</th>
                <th style={{...TH_STYLE,width:100}} className="hm">Category</th>
                <th style={{...TH_STYLE,textAlign:"right",width:110}} className="hm">Budgeted</th>
                <th style={{...TH_STYLE,textAlign:"right",width:110}}>Actual</th>
                <th style={{...TH_STYLE,width:60}} className="hm">Notes</th>
                <th style={{...TH_STYLE,width:36}}/>
              </tr></thead>
              <tbody>
                {filteredExp.map(row => (
                  <FadeRow key={row.id} visible={vis[row.id]??true}>
                    <td style={{...TD_STYLE,textAlign:"center"}} className={`er ${row.paid?"paid":""}`}>
                      <input type="checkbox" checked={row.paid} onChange={()=>setE(row.id,"paid",!row.paid)}
                        style={{ width:16, height:16, cursor:"pointer", accentColor:"#06b6d4" }}/>
                    </td>
                    <td style={TD_STYLE} className={`er ${row.paid?"paid":""}`}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <TxtInput value={row.name} onChange={v=>setE(row.id,"name",v)} placeholder="Expense name..."/>
                        {row.paid && <Badge bg="rgba(239,68,68,0.1)" fg="#fca5a5">PAID</Badge>}
                      </div>
                    </td>
                    <td style={TD_STYLE} className={`er ${row.paid?"paid":""} hm`}>
                      <CatSelect value={row.category||"Essential"} onChange={v=>setE(row.id,"category",v)}/>
                    </td>
                    <td style={{...TD_STYLE,textAlign:"right"}} className={`er ${row.paid?"paid":""} hm`}>
                      <NumInput value={row.budgeted} onChange={v=>setE(row.id,"budgeted",v)}/>
                    </td>
                    <td style={{...TD_STYLE,textAlign:"right"}} className={`er ${row.paid?"paid":""}`}>
                      <NumInput value={row.actual} onChange={v=>setE(row.id,"actual",v)}/>
                    </td>
                    {/* FIX: NEW — notes column */}
                    <td style={TD_STYLE} className="hm">
                      <NotesInput value={row.notes||""} onChange={v=>setE(row.id,"notes",v)}/>
                    </td>
                    <td style={TD_STYLE}><DelBtn onClick={()=>delE(row.id)}/></td>
                  </FadeRow>
                ))}
                {filteredExp.length===0 && (
                  <tr>
                    <td colSpan={7} style={{ padding:"20px", textAlign:"center", color:"#3d5166", fontSize:12 }}>
                      {expenses.length===0 ? "No expenses yet — add one above" : "No results match your filter"}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot><tr>
                <td colSpan={2} style={{...TD_STYLE,fontWeight:800,color:"#f87171",borderTop:"1px solid rgba(239,68,68,0.12)"}}>Total</td>
                <td style={{borderTop:"1px solid rgba(239,68,68,0.12)"}} className="hm"/>
                <td style={{...TD_STYLE,textAlign:"right",color:"#3d5166",borderTop:"1px solid rgba(239,68,68,0.12)"}} className="hm">{fmt(bgtExp)}</td>
                <td style={{...TD_STYLE,textAlign:"right",fontWeight:800,color:"#f87171",fontSize:15,borderTop:"1px solid rgba(239,68,68,0.12)"}}>{fmt(totalExp)}</td>
                <td colSpan={2} style={{borderTop:"1px solid rgba(239,68,68,0.12)"}}/>
              </tr></tfoot>
            </table>
          </div>
        </Card>

        {/* DEBT TABLE */}
        <Card style={{ background:"rgba(99,102,241,0.035)", border:"1px solid rgba(99,102,241,0.1)" }} className="su">
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
            <div>
              <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#818cf8" }}>▸ Debt & Installment Tracker</span>
              <span style={{ marginLeft:10, fontSize:11, color:"#3d5166" }}>
                Cleared <span style={{ color:"#34d399", fontWeight:700 }}>{fmt(totalPaid)}</span>
                {" · "}Remaining <span style={{ color:"#f87171", fontWeight:700 }}>{fmt(remDebt)}</span>
              </span>
            </div>
            <AddBtn onClick={addD} label="Add Debt" color="#818cf8"/>
          </div>
          <div className="ts" style={{ marginBottom:16 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead><tr>
                <th style={{...TH_STYLE,width:32,textAlign:"center"}}>✓</th>
                <th style={TH_STYLE}>Debt / Installment</th>
                <th style={{...TH_STYLE,textAlign:"right",width:110}} className="hm">Total</th>
                <th style={{...TH_STYLE,textAlign:"right",width:110}}>Paid</th>
                <th style={{...TH_STYLE,textAlign:"right",width:100}}>Remaining</th>
                <th style={{...TH_STYLE,width:130}} className="hm">Progress</th>
                <th style={{...TH_STYLE,width:130}} className="hm">Due Date</th>
                <th style={{...TH_STYLE,width:60}} className="hm">Notes</th>
                <th style={{...TH_STYLE,width:36}}/>
              </tr></thead>
              <tbody>
                {debts.map(row => {
                  const rem  = Math.max(0,(row.totalDebt||0)-(row.paid||0));
                  const done = row.completed || rem===0;
                  const p    = pct(row.paid||0, row.totalDebt||1);
                  const col  = done?"#34d399":p>=75?"#fbbf24":"#818cf8";
                  return (
                    <FadeRow key={row.id} visible={vis[row.id]??true}>
                      <td style={{...TD_STYLE,textAlign:"center"}} className={`dr ${done?"done":""}`}>
                        <input type="checkbox" checked={row.completed} onChange={()=>setD(row.id,"completed",!row.completed)}
                          style={{ width:16, height:16, cursor:"pointer", accentColor:"#34d399" }}/>
                      </td>
                      <td style={TD_STYLE} className={`dr ${done?"done":""}`}>
                        <TxtInput value={row.name} onChange={v=>setD(row.id,"name",v)} placeholder="Debt name..."/>
                        {row.carriedOver && <span style={{ fontSize:9, color:"#fbbf24", marginLeft:4 }}>↩ carried over</span>}
                      </td>
                      <td style={{...TD_STYLE,textAlign:"right"}} className={`dr ${done?"done":""} hm`}>
                        <NumInput value={row.totalDebt} onChange={v=>setD(row.id,"totalDebt",v)}/>
                      </td>
                      <td style={{...TD_STYLE,textAlign:"right"}} className={`dr ${done?"done":""}`}>
                        <NumInput value={row.paid} onChange={v=>setD(row.id,"paid",clamp(v,0,row.totalDebt||999999))}/>
                      </td>
                      <td style={{...TD_STYLE,textAlign:"right",fontWeight:700,color:done?"#34d399":rem>0?"#f87171":"#4ade80"}}>{fmt(rem)}</td>
                      <td style={TD_STYLE} className="hm">
                        <div style={{ minWidth:90 }}>
                          <div style={{ fontSize:9, color:col, fontWeight:700, marginBottom:3 }}>{p}%</div>
                          <ProgBar value={row.paid||0} total={row.totalDebt||0} color={col} height={5}/>
                        </div>
                      </td>
                      <td style={TD_STYLE} className="hm">
                        <DateInput value={row.dueDate||""} onChange={v=>setD(row.id,"dueDate",v)}/>
                      </td>
                      <td style={TD_STYLE} className="hm">
                        <NotesInput value={row.notes||""} onChange={v=>setD(row.id,"notes",v)}/>
                      </td>
                      <td style={TD_STYLE}><DelBtn onClick={()=>delD(row.id)}/></td>
                    </FadeRow>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td colSpan={2} style={{...TD_STYLE,fontWeight:800,color:"#818cf8",borderTop:"1px solid rgba(99,102,241,0.14)"}}>Totals</td>
                <td style={{...TD_STYLE,textAlign:"right",fontWeight:700,color:"#c8d3e0",borderTop:"1px solid rgba(99,102,241,0.14)"}} className="hm">{fmt(totalDebt)}</td>
                <td style={{...TD_STYLE,textAlign:"right",fontWeight:700,color:"#34d399",borderTop:"1px solid rgba(99,102,241,0.14)"}}>{fmt(totalPaid)}</td>
                <td style={{...TD_STYLE,textAlign:"right",fontWeight:800,color:"#f87171",fontSize:14,borderTop:"1px solid rgba(99,102,241,0.14)"}}>{fmt(remDebt)}</td>
                <td colSpan={4} style={{borderTop:"1px solid rgba(99,102,241,0.14)"}}/>
              </tr></tfoot>
            </table>
          </div>

          {debts.length > 0 && (
            <>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                color:"#3d5166", marginBottom:10, paddingTop:6, borderTop:"1px solid rgba(255,255,255,0.04)" }}>
                Individual Progress
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:10, marginBottom:16 }}>
                {debts.map(row => <DebtCard key={row.id} row={row} visible={vis[row.id]??true}/>)}
              </div>
            </>
          )}

          <div style={{ padding:"14px 16px", background:"rgba(99,102,241,0.07)", borderRadius:12, border:"1px solid rgba(99,102,241,0.12)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10, flexWrap:"wrap", gap:8 }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#818cf8", textTransform:"uppercase", marginBottom:4 }}>Overall Debt Clearance</div>
                <div style={{ fontSize:18, fontWeight:800, color:"#a5b4fc" }}>
                  {fmt(totalPaid)}<span style={{ fontSize:12, color:"#3d5166", fontWeight:400 }}> / {fmt(totalDebt)}</span>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:28, fontWeight:800, color:"#818cf8", lineHeight:1 }}>{debtPct}%</div>
                <div style={{ fontSize:10, color:"#3d5166", marginTop:2 }}>{fmt(remDebt)} remaining</div>
              </div>
            </div>
            <ProgBar value={totalPaid} total={totalDebt} color="#818cf8" height={8}/>
          </div>
        </Card>

        {/* SAVINGS */}
        <Card style={{ background:"rgba(196,181,253,0.04)", border:"1px solid rgba(196,181,253,0.1)" }} className="su">
          <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#c4b5fd" }}>▸ Savings Tracker</span>
          <div className="cr" style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:14, marginBottom:14 }}>
            <MCard label={`${MONTHS[curM]} Savings`} value={fmt(mthSav)} color={mthSav>=0?"#c4b5fd":"#f87171"} sub="Income − Expenses − Loans" danger={mthSav<0}/>
            <MCard label="Total Accumulated" value={fmt(cumSav)} color="#a5b4fc" sub={`From ${allKeys.length} month${allKeys.length!==1?"s":""}`}/>
            <MCard label="Savings Rate" value={`${pct(Math.max(0,mthSav),totalInc||1)}%`}
              color={mthSav/Math.max(totalInc,1)>=0.2?"#34d399":"#fbbf24"} sub="of total income saved"/>
          </div>
          {totalInc > 0 && (
            <div style={{ marginBottom:14, padding:"12px 14px",
              background:"rgba(196,181,253,0.06)", borderRadius:10, border:"1px solid rgba(196,181,253,0.1)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:11 }}>
                <span style={{ color:"#c4b5fd", fontWeight:700 }}>Savings Rate This Month</span>
                <span style={{ color:"#c8d3e0" }}>{pct(Math.max(0,mthSav),totalInc)}% saved</span>
              </div>
              <ProgBar value={Math.max(0,mthSav)} total={totalInc} color="#c4b5fd" height={8}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, fontSize:10, color:"#3d5166" }}>
                <span>৳0</span><span>{fmt(totalInc)} income</span>
              </div>
            </div>
          )}
          {Object.keys(store.months).length >= 2 && (
            <>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#3d5166", marginBottom:8 }}>
                Savings Growth Trend
              </div>
              <SavingsChart allData={store.months}/>
            </>
          )}
        </Card>

        {/* MASTER SUMMARY */}
        <div style={{ padding:"14px 18px", background:"rgba(6,182,212,0.03)",
          border:"1px solid rgba(6,182,212,0.08)", borderRadius:12,
          display:"flex", gap:18, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#2a3a4a", flexShrink:0 }}>
            Summary — {MONTHS[curM]} {curY}
          </span>
          {[
            { l:"Income",        v:fmt(totalInc),  c:"#4ade80" },
            { l:"Expenses",      v:fmt(totalExp),  c:"#f87171" },
            { l:"Cash in Hand",  v:fmt(liveCash),  c:"#67e8f9" },
            { l:"Monthly Saved", v:fmt(mthSav),    c:"#c4b5fd" },
            { l:"Total Saved",   v:fmt(cumSav),    c:"#a5b4fc" },
            { l:"Debt Left",     v:fmt(remDebt),   c:"#fb923c" },
          ].map(i => (
            <div key={i.l} style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:9, color:"#2a3a4a", fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase" }}>{i.l}</span>
              <span style={{ fontSize:13, fontWeight:800, color:i.c }}>{i.v}</span>
            </div>
          ))}
        </div>

      </div>

      {/* CHARTS MODAL */}
      {modal==="charts" && (
        <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.85)",
          display:"flex", alignItems:"flex-start", justifyContent:"center",
          padding:"20px 16px", overflowY:"auto" }} onClick={()=>sm(null)}>
          <div style={{ background:"#0d1117", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:18, padding:"24px 20px", maxWidth:720, width:"100%", marginTop:40 }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:800, color:"#eef2f8" }}>Charts & Analytics</div>
              <Btn onClick={()=>sm(null)} color="#67e8f9" size="sm">Close</Btn>
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#3d5166", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>Income vs Expenses (Last 6 Months)</div>
              <TrendChart allData={store.months}/>
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#3d5166", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>Cumulative Savings Growth</div>
              <SavingsChart allData={store.months}/>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:"#3d5166", textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:10 }}>Expense Breakdown — {MONTHS[curM]}</div>
              <DonutChart expenses={expenses}/>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {modal==="history" && (
        <HistoryMgr store={store} onUpdate={s=>SS(s)} onClose={()=>sm(null)}/>
      )}

      {/* TEMPLATES MODAL */}
      {modal==="templates" && (
        <TemplateMgr
          templates={store.templates||defaultTemplates()}
          onSave={t => SS(p=>({...p,templates:t}))}
          onClose={()=>sm(null)}/>
      )}

    </div>
  );
}
