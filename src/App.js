import { useState, useEffect, useRef, useCallback } from "react";

/* ─── helpers ─────────────────────────────────────────────── */
const fmt  = (n) => "৳" + Math.round(n).toLocaleString("en-IN");
const pct  = (a, b) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function loadLS(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}

/* ─── seed data ────────────────────────────────────────────── */
const SEED_INCOME = [
  { id:uid(), source:"May Carryover",  budgeted:4400,  actual:4400  },
  { id:uid(), source:"Main Salary",    budgeted:60000, actual:60000 },
  { id:uid(), source:"Sublet Rent",    budgeted:7500,  actual:7500  },
  { id:uid(), source:"Extra Income",   budgeted:20000, actual:20000 },
];
const SEED_EXPENSES = [
  { id:uid(), name:"Eid Meat & Groceries",              budgeted:3600,  actual:3600,  paid:false },
  { id:uid(), name:"May Final Week Expenses",            budgeted:4000,  actual:4000,  paid:false },
  { id:uid(), name:"Loan/Installment (Arrears & Current)",budgeted:30000,actual:30000,paid:false },
  { id:uid(), name:"House Rent & Bills",                 budgeted:16100, actual:16100, paid:false },
  { id:uid(), name:"School Fees",                        budgeted:1500,  actual:1500,  paid:false },
  { id:uid(), name:"Shop Debt (1st Installment)",        budgeted:7000,  actual:7000,  paid:false },
  { id:uid(), name:"Monthly Cash Groceries",             budgeted:15000, actual:15000, paid:false },
  { id:uid(), name:"Fresh Vegetables",                   budgeted:2500,  actual:2500,  paid:false },
  { id:uid(), name:"Ammu's Milad",                       budgeted:5000,  actual:5000,  paid:false },
  { id:uid(), name:"June Personal/Travel Expenses",      budgeted:4000,  actual:4000,  paid:false },
];
const SEED_DEBTS = [
  { id:uid(), name:"Shop Debt",           totalDebt:20000,  paid:7000,  dueDate:"2025-09-30", completed:false },
  { id:uid(), name:"Loan Installment",    totalDebt:100000, paid:30000, dueDate:"2026-12-31", completed:false },
  { id:uid(), name:"Family Loan",         totalDebt:50000,  paid:0,     dueDate:"",           completed:false },
];

const LS = { income:"sft_income_v3", expenses:"sft_expenses_v3", debts:"sft_debts_v1" };

/* ─── design tokens ───────────────────────────────────────── */
const T = {
  app: {
    minHeight:"100vh",
    background:"linear-gradient(160deg,#07090e 0%,#0b0f17 55%,#070a0f 100%)",
    fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",
    color:"#dde4ee", paddingBottom:64,
  },
  hdr: {
    borderBottom:"1px solid rgba(99,179,237,0.09)",
    background:"rgba(7,9,14,0.9)", backdropFilter:"blur(24px)",
    position:"sticky", top:0, zIndex:50,
    padding:"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between",
  },
  wrap: { maxWidth:1260, margin:"0 auto", padding:"0 22px" },
  card: (x={}) => ({
    background:"rgba(255,255,255,0.027)", border:"1px solid rgba(255,255,255,0.065)",
    borderRadius:16, padding:"20px 22px", transition:"border-color .3s", ...x,
  }),
  th: {
    padding:"8px 11px", textAlign:"left", color:"#3d5166",
    fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
    borderBottom:"1px solid rgba(255,255,255,0.05)",
  },
  td: { padding:"9px 11px", borderBottom:"1px solid rgba(255,255,255,0.032)", verticalAlign:"middle" },
  sLabel: { fontSize:11, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#4a90d9" },
  badge: (bg,fg) => ({
    display:"inline-block", padding:"2px 8px", borderRadius:99,
    fontSize:10, fontWeight:700, background:bg, color:fg, letterSpacing:"0.05em",
  }),
  numIn: (f) => ({
    background:"rgba(255,255,255,0.048)", border:`1px solid ${f?"rgba(6,182,212,0.55)":"rgba(255,255,255,0.085)"}`,
    borderRadius:8, padding:"5px 9px", color:"#dde4ee", fontSize:13, width:108, outline:"none",
    boxShadow: f?"0 0 0 3px rgba(6,182,212,0.1)":"none",
    transition:"border-color .2s,box-shadow .2s", fontFamily:"inherit",
  }),
  txtIn: (f) => ({
    background: f?"rgba(255,255,255,0.055)":"transparent",
    border:`1px solid ${f?"rgba(6,182,212,0.38)":"transparent"}`,
    borderRadius:7, padding:"5px 8px", color:"#c8d3e0", fontSize:13, outline:"none", width:"100%",
    boxShadow: f?"0 0 0 3px rgba(6,182,212,0.08)":"none",
    transition:"all .2s", fontFamily:"inherit",
  }),
  dateIn: (f) => ({
    background:"rgba(255,255,255,0.048)", border:`1px solid ${f?"rgba(6,182,212,0.45)":"rgba(255,255,255,0.08)"}`,
    borderRadius:8, padding:"5px 9px", color: "#8899aa", fontSize:12, width:128, outline:"none",
    colorScheme:"dark", fontFamily:"inherit", transition:"border-color .2s",
  }),
  track: { height:6, background:"rgba(255,255,255,0.055)", borderRadius:99, overflow:"hidden", flexShrink:0 },
};

/* ─── metric accents ──────────────────────────────────────── */
const MA = {
  green:  { g1:"rgba(34,197,94,0.09)",  g2:"rgba(16,185,129,0.04)", bd:"rgba(34,197,94,0.17)",  val:"#4ade80" },
  red:    { g1:"rgba(239,68,68,0.09)",  g2:"rgba(220,38,38,0.04)",  bd:"rgba(239,68,68,0.17)",  val:"#f87171" },
  purple: { g1:"rgba(168,85,247,0.09)", g2:"rgba(139,92,246,0.04)", bd:"rgba(168,85,247,0.17)", val:"#c4b5fd" },
  amber:  { g1:"rgba(251,191,36,0.08)", g2:"rgba(245,158,11,0.04)", bd:"rgba(251,191,36,0.17)", val:"#fbbf24" },
  orange: { g1:"rgba(249,115,22,0.09)", g2:"rgba(234,88,12,0.04)",  bd:"rgba(249,115,22,0.17)", val:"#fb923c" },
};

/* ─── reusable primitives ─────────────────────────────────── */
function NumInput({ value, onChange, width=108 }) {
  const [f,setF] = useState(false);
  return <input type="number" value={value} onChange={e=>onChange(Number(e.target.value)||0)}
    onFocus={()=>setF(true)} onBlur={()=>setF(false)}
    style={{...T.numIn(f), width}} className="hs" />;
}
function TxtInput({ value, onChange, placeholder="Name…" }) {
  const [f,setF] = useState(false);
  return <input type="text" value={value} onChange={e=>onChange(e.target.value)}
    onFocus={()=>setF(true)} onBlur={()=>setF(false)}
    placeholder={placeholder} style={T.txtIn(f)} />;
}
function DateInput({ value, onChange }) {
  const [f,setF] = useState(false);
  return <input type="date" value={value} onChange={e=>onChange(e.target.value)}
    onFocus={()=>setF(true)} onBlur={()=>setF(false)} style={T.dateIn(f)} />;
}

function AddBtn({ onClick, label, color="#06b6d4" }) {
  const [h,setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 13px", borderRadius:8,
        border:`1px solid ${h?`${color}99`:`${color}44`}`,
        background: h?`${color}22`:`${color}0e`, color, fontSize:12, fontWeight:700,
        cursor:"pointer", letterSpacing:"0.04em", transition:"all .2s", fontFamily:"inherit",
        transform: h?"translateY(-1px)":"none",
        boxShadow: h?`0 4px 16px ${color}28`:"none" }}>
      <span style={{fontSize:15,lineHeight:1}}>+</span>{label}
    </button>
  );
}
function DelBtn({ onClick }) {
  const [h,setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      title="Remove" style={{ width:27, height:27, borderRadius:7, cursor:"pointer",
        border:`1px solid ${h?"rgba(239,68,68,0.48)":"rgba(239,68,68,0.18)"}`,
        background: h?"rgba(239,68,68,0.16)":"rgba(239,68,68,0.05)",
        color:"#f87171", display:"flex", alignItems:"center", justifyContent:"center",
        flexShrink:0, transition:"all .2s", fontSize:12,
        transform: h?"scale(1.1)":"scale(1)" }}>✕
    </button>
  );
}

function FadeRow({ children, visible }) {
  const [mount,setMount] = useState(visible);
  const [show,setShow]   = useState(false);
  useEffect(()=>{
    if(visible){ setMount(true); requestAnimationFrame(()=>requestAnimationFrame(()=>setShow(true))); }
    else{ setShow(false); const t=setTimeout(()=>setMount(false),320); return()=>clearTimeout(t); }
  },[visible]);
  if(!mount) return null;
  return <tr style={{ opacity:show?1:0, transform:show?"translateY(0)":"translateY(-10px)", transition:"opacity .32s ease,transform .32s ease" }}>{children}</tr>;
}

/* ─── metric card ─────────────────────────────────────────── */
function MCard({ label, value, accent = MA.green, isHero, sub, danger }) {
  const [h,setH] = useState(false);
  const heroStyle = {
    background:"linear-gradient(135deg,rgba(6,182,212,0.13),rgba(59,130,246,0.09))",
    border:"1px solid rgba(6,182,212,0.28)", borderRadius:16, padding:"20px 22px",
    flex:1, minWidth:175, position:"relative", overflow:"hidden", cursor:"default",
    boxShadow: h?"0 0 48px rgba(6,182,212,0.2),0 10px 36px rgba(0,0,0,0.35)":"0 0 22px rgba(6,182,212,0.09)",
    transform: h?"translateY(-4px)":"translateY(0)", transition:"all .25s",
  };
  const normStyle = {
    background:`linear-gradient(135deg,${accent.g1},${accent.g2})`,
    border:`1px solid ${accent.bd}`, borderRadius:16, padding:"20px 22px",
    flex:1, minWidth:175, cursor:"default",
    transform: h?"translateY(-3px)":"translateY(0)", transition:"all .24s",
  };
  return (
    <div style={isHero?heroStyle:normStyle} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>
      <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.11em", textTransform:"uppercase",
        color: isHero?"#67e8f9":"#7a8fa8", marginBottom:8 }}>{label}</div>
      <div style={{ fontSize: isHero?27:22, fontWeight:800,
        color: danger?"#f87171": isHero?"#e0f7fa":(accent?.val||"#f1f5f9"),
        letterSpacing:"-0.025em", lineHeight:1 }}>{value}</div>
      {sub&&<div style={{ marginTop:7, fontSize:11, color:"#3d5166", fontWeight:500 }}>{sub}</div>}
      {isHero&&<div style={{ position:"absolute", top:-16,right:-16,width:80,height:80,borderRadius:"50%",background:"radial-gradient(circle,rgba(6,182,212,0.14) 0%,transparent 70%)" }}/>}
    </div>
  );
}

/* ─── inline progress bar ─────────────────────────────────── */
function MiniBar({ value, total, done }) {
  const p = pct(value, total);
  const grad = done
    ? "linear-gradient(90deg,#059669,#34d399)"
    : p >= 75
      ? "linear-gradient(90deg,#b45309,#fbbf24)"
      : "linear-gradient(90deg,#4338ca,#818cf8)";
  const glow = done ? "rgba(52,211,153,0.4)" : p>=75 ? "rgba(251,191,36,0.35)" : "rgba(129,140,248,0.4)";
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#3d5166", marginBottom:4, fontWeight:600 }}>
        <span style={{ color: done?"#34d399": p>=75?"#fbbf24":"#818cf8" }}>{p}%</span>
        <span>{fmt(value)} / {fmt(total)}</span>
      </div>
      <div style={{ ...T.track, width:"100%" }}>
        <div style={{ height:"100%", borderRadius:99, background:grad,
          boxShadow:`0 0 8px ${glow}`, width:`${p}%`,
          transition:"width .6s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

/* ─── debt card (visual summary per installment) ──────────── */
function DebtCard({ row, onUpdate, onDelete, visible }) {
  const remaining = Math.max(0, (row.totalDebt||0) - (row.paid||0));
  const p = pct(row.paid||0, row.totalDebt||1);
  const done = row.completed || remaining === 0;
  const [h,setH] = useState(false);

  return (
    <div onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ background: done?"rgba(5,150,105,0.07)":"rgba(255,255,255,0.025)",
        border:`1px solid ${done?"rgba(52,211,153,0.2)": h?"rgba(129,140,248,0.25)":"rgba(255,255,255,0.065)"}`,
        borderRadius:14, padding:"16px 18px",
        opacity: visible?1:0, transform: visible?"translateY(0)":"translateY(14px)",
        transition:"opacity .35s ease, transform .35s ease, border-color .25s",
        boxShadow: h&&!done?"0 4px 24px rgba(129,140,248,0.1)":"none" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color: done?"#6ee7b7":"#c8d3e0",
            textDecoration: done?"line-through":"none",
            textDecorationColor:"rgba(110,231,183,0.5)", marginBottom:3 }}>
            {row.name}
          </div>
          {row.dueDate && <div style={{ fontSize:10, color:"#3d5166" }}>Due {row.dueDate}</div>}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginLeft:8 }}>
          {done
            ? <span style={T.badge("rgba(5,150,105,0.18)","#34d399")}>COMPLETED</span>
            : <span style={T.badge("rgba(99,102,241,0.16)","#818cf8")}>ACTIVE</span>}
        </div>
      </div>
      <MiniBar value={row.paid||0} total={row.totalDebt||0} done={done} />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, fontSize:11 }}>
        <span style={{ color:"#3d5166" }}>Remaining <span style={{ color: done?"#34d399":"#f87171", fontWeight:700 }}>{fmt(remaining)}</span></span>
        <span style={{ color:"#3d5166" }}>Total <span style={{ color:"#c8d3e0", fontWeight:700 }}>{fmt(row.totalDebt||0)}</span></span>
      </div>
    </div>
  );
}

/* ═══ main app ════════════════════════════════════════════════ */
export default function App() {
  const [income,   setIncome]   = useState(()=>loadLS(LS.income,   SEED_INCOME));
  const [expenses, setExpenses] = useState(()=>loadLS(LS.expenses, SEED_EXPENSES));
  const [debts,    setDebts]    = useState(()=>loadLS(LS.debts,    SEED_DEBTS));
  const [vis,      setVis]      = useState({});
  const [cashPulse,setCashPulse]= useState(false);
  const prevCash = useRef(null);

  /* seed visibility */
  useEffect(()=>{
    const m={};
    income.forEach(r=>m[r.id]=true);
    expenses.forEach(r=>m[r.id]=true);
    debts.forEach(r=>m[r.id]=true);
    setVis(m);
  },[]);

  /* persist */
  useEffect(()=>{ try{localStorage.setItem(LS.income,  JSON.stringify(income));  }catch{} },[income]);
  useEffect(()=>{ try{localStorage.setItem(LS.expenses,JSON.stringify(expenses));}catch{} },[expenses]);
  useEffect(()=>{ try{localStorage.setItem(LS.debts,   JSON.stringify(debts));   }catch{} },[debts]);

  /* ── financials ── */
  const totalIncome   = income.reduce((s,i)=>s+(i.actual||0),0);
  const totalExpenses = expenses.reduce((s,e)=>s+(e.actual||0),0);
  const paidExpenses  = expenses.filter(e=>e.paid).reduce((s,e)=>s+(e.actual||0),0);
  const liveCash      = totalIncome - paidExpenses;
  const netSavings    = totalIncome - totalExpenses;

  /* ── debt totals ── */
  const totalDebt     = debts.reduce((s,d)=>s+(d.totalDebt||0),0);
  const totalPaid     = debts.reduce((s,d)=>s+(d.paid||0),0);
  const remainDebt    = totalDebt - totalPaid;
  const debtClearPct  = pct(totalPaid, totalDebt);

  const budgetedIncome   = income.reduce((s,i)=>s+(i.budgeted||0),0);
  const budgetedExpenses = expenses.reduce((s,e)=>s+(e.budgeted||0),0);
  const paidCount        = expenses.filter(e=>e.paid).length;

  /* cash pulse */
  useEffect(()=>{
    if(prevCash.current!==null && prevCash.current!==liveCash){
      setCashPulse(true);
      const t=setTimeout(()=>setCashPulse(false),700); return()=>clearTimeout(t);
    }
    prevCash.current=liveCash;
  },[liveCash]);

  /* ── row actions ── */
  const showRow  = (id)=> setVis(p=>({...p,[id]:true}));
  const hideRow  = (id, del)=>{ setVis(p=>({...p,[id]:false})); setTimeout(()=>del(id),340); };

  const addI = ()=>{ const id=uid(); setIncome(p=>[...p,{id,source:"New Source",budgeted:0,actual:0}]); showRow(id); };
  const delI = useCallback(id=>hideRow(id, id=>setIncome(p=>p.filter(r=>r.id!==id))),[]);
  const setIF = useCallback((id,k,v)=>setIncome(p=>p.map(r=>r.id===id?{...r,[k]:v}:r)),[]);

  const addE = ()=>{ const id=uid(); setExpenses(p=>[...p,{id,name:"New Expense",budgeted:0,actual:0,paid:false}]); showRow(id); };
  const delE = useCallback(id=>hideRow(id, id=>setExpenses(p=>p.filter(r=>r.id!==id))),[]);
  const setEF = useCallback((id,k,v)=>setExpenses(p=>p.map(r=>r.id===id?{...r,[k]:v}:r)),[]);

  const addD = ()=>{ const id=uid(); setDebts(p=>[...p,{id,name:"New Debt",totalDebt:0,paid:0,dueDate:"",completed:false}]); showRow(id); };
  const delD = useCallback(id=>hideRow(id, id=>setDebts(p=>p.filter(r=>r.id!==id))),[]);
  const setDF = useCallback((id,k,v)=>setDebts(p=>p.map(r=>r.id===id?{...r,[k]:v}:r)),[]);

  return (
    <div style={T.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        *{box-sizing:border-box}
        .hs::-webkit-outer-spin-button,.hs::-webkit-inner-spin-button{-webkit-appearance:none}
        .hs{-moz-appearance:textfield}
        @keyframes cashPop{0%{box-shadow:0 0 0 5px rgba(6,182,212,0.42)}100%{box-shadow:none}}
        @keyframes blink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.6)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .su{animation:fadeUp .42s ease both}
        .cp{animation:cashPop .7s ease-out!important}
        .er{transition:opacity .3s,background .22s}
        .er:hover{background:rgba(255,255,255,0.019)!important}
        .er.paid{opacity:.42}
        .dr{transition:opacity .3s}
        .dr.done{opacity:.5}
        .dr.done td{text-decoration:line-through;text-decoration-color:rgba(52,211,153,0.45)}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.45) sepia(1) saturate(.5)}
      `}</style>

      {/* ━━ Header ━━ */}
      <header style={T.hdr}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#06b6d4,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:15,boxShadow:"0 0 14px rgba(6,182,212,0.36)"}}>S</div>
          <div>
            <div style={{fontSize:15,fontWeight:800,color:"#eef2f8",letterSpacing:"-0.015em"}}>Sajjad's Finance Tracker</div>
            <div style={{fontSize:10,color:"#4a90d9",letterSpacing:"0.06em",marginTop:1}}>Personal Finance Intelligence Dashboard</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
          <span style={T.badge("rgba(6,182,212,0.11)","#67e8f9")}>June 2025</span>
          <span style={T.badge("rgba(34,197,94,0.1)","#4ade80")}>{paidCount}/{expenses.length} Paid</span>
          <span style={T.badge("rgba(139,92,246,0.1)","#c4b5fd")}>{income.length} Sources</span>
          <span style={T.badge("rgba(249,115,22,0.1)","#fb923c")}>{debts.length} Debts</span>
        </div>
      </header>

      <div style={{...T.wrap,marginTop:26}}>

        {/* ━━ Section divider helper ━━ */}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            FINANCIAL METRICS
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"#2a3a4a",marginBottom:10}}>
          ── Financial Overview
        </div>
        <div style={{display:"flex",gap:13,flexWrap:"wrap",marginBottom:10}}>
          <MCard label="Total Income"   value={fmt(totalIncome)}   accent={MA.green}
            sub={`${income.length} streams · budget ${fmt(budgetedIncome)}`} />
          <MCard label="Total Expenses" value={fmt(totalExpenses)} accent={MA.red}
            sub={`${expenses.length} items · budget ${fmt(budgetedExpenses)}`} />
          <div className={cashPulse?"cp":""} style={{flex:1,minWidth:175,borderRadius:16}}>
            <MCard label="Live Cash in Hand" value={fmt(liveCash)} isHero
              sub={`After ${fmt(paidExpenses)} paid`} />
          </div>
          <MCard label="Net Savings" value={fmt(netSavings)} accent={MA.purple}
            sub={netSavings>=0?"Positive balance ↑":"Over budget ↓"}
            danger={netSavings<0} />
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            DEBT METRICS
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"#2a3a4a",margin:"22px 0 10px"}}>
          ── Debt Overview
        </div>
        <div style={{display:"flex",gap:13,flexWrap:"wrap",marginBottom:28}}>
          <MCard label="Total Debt Owed"  value={fmt(totalDebt)}  accent={MA.red}
            sub={`${debts.length} active obligation${debts.length!==1?"s":""}`} />
          <MCard label="Total Paid"        value={fmt(totalPaid)}  accent={MA.green}
            sub={`${debtClearPct}% cleared overall`} />
          <MCard label="Remaining Debt"    value={fmt(remainDebt)} accent={MA.amber}
            sub={`${100-debtClearPct}% still outstanding`}
            danger={remainDebt>0} />
          <MCard label="Debt Clearance"    value={`${debtClearPct}%`} accent={MA.orange}
            sub={`${fmt(totalPaid)} of ${fmt(totalDebt)}`} />
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            INCOME TABLE
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{...T.card(),marginBottom:20}} className="su">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <span style={T.sLabel}>▸ Income Tracker</span>
            <AddBtn onClick={addI} label="Add Income Source" />
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>
                <th style={T.th}>Source</th>
                <th style={{...T.th,textAlign:"right",width:118}}>Budgeted</th>
                <th style={{...T.th,textAlign:"right",width:126}}>Actual</th>
                <th style={{...T.th,textAlign:"right",width:108}}>Variance</th>
                <th style={{...T.th,width:36}}/>
              </tr></thead>
              <tbody>
                {income.map(row=>{
                  const v=(row.actual||0)-(row.budgeted||0);
                  return (
                    <FadeRow key={row.id} visible={vis[row.id]??false}>
                      <td style={T.td}><TxtInput value={row.source} onChange={v=>setIF(row.id,"source",v)} placeholder="Income source…"/></td>
                      <td style={{...T.td,textAlign:"right"}}><NumInput value={row.budgeted} onChange={v=>setIF(row.id,"budgeted",v)}/></td>
                      <td style={{...T.td,textAlign:"right"}}><NumInput value={row.actual}   onChange={v=>setIF(row.id,"actual",v)}/></td>
                      <td style={{...T.td,textAlign:"right"}}>
                        <span style={{fontWeight:700,fontSize:12,color:v>=0?"#4ade80":"#f87171"}}>{v>=0?"+":""}{fmt(v)}</span>
                      </td>
                      <td style={T.td}><DelBtn onClick={()=>delI(row.id)}/></td>
                    </FadeRow>
                  );
                })}
              </tbody>
              <tfoot><tr style={{background:"rgba(34,197,94,0.03)"}}>
                <td style={{...T.td,fontWeight:800,color:"#4ade80",fontSize:13,borderTop:"1px solid rgba(34,197,94,0.12)"}}>Total Income</td>
                <td style={{...T.td,textAlign:"right",color:"#3d5166",borderTop:"1px solid rgba(34,197,94,0.12)"}}>{fmt(budgetedIncome)}</td>
                <td style={{...T.td,textAlign:"right",fontWeight:800,color:"#4ade80",fontSize:15,borderTop:"1px solid rgba(34,197,94,0.12)"}}>{fmt(totalIncome)}</td>
                <td colSpan={2} style={{borderTop:"1px solid rgba(34,197,94,0.12)"}}/>
              </tr></tfoot>
            </table>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            EXPENSE TABLE
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{...T.card(),marginBottom:20}} className="su">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div>
              <span style={T.sLabel}>▸ Expense Tracker</span>
              <span style={{marginLeft:12,fontSize:11,color:"#3d5166"}}>
                Paid <span style={{color:"#f87171",fontWeight:700}}>{fmt(paidExpenses)}</span>
                {" · "}Pending <span style={{color:"#fbbf24",fontWeight:700}}>{fmt(totalExpenses-paidExpenses)}</span>
              </span>
            </div>
            <AddBtn onClick={addE} label="Add Expense" />
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>
                <th style={{...T.th,width:34,textAlign:"center"}}>✓</th>
                <th style={T.th}>Expense</th>
                <th style={{...T.th,textAlign:"right",width:118}}>Budgeted</th>
                <th style={{...T.th,textAlign:"right",width:126}}>Actual</th>
                <th style={{...T.th,width:36}}/>
              </tr></thead>
              <tbody>
                {expenses.map(row=>(
                  <FadeRow key={row.id} visible={vis[row.id]??false}>
                    <td style={{...T.td,textAlign:"center"}} className={`er ${row.paid?"paid":""}`}>
                      <input type="checkbox" checked={row.paid}
                        onChange={()=>setEF(row.id,"paid",!row.paid)}
                        style={{width:15,height:15,cursor:"pointer",accentColor:"#06b6d4"}}/>
                    </td>
                    <td style={T.td} className={`er ${row.paid?"paid":""}`}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <TxtInput value={row.name} onChange={v=>setEF(row.id,"name",v)} placeholder="Expense name…"/>
                        {row.paid&&<span style={T.badge("rgba(239,68,68,0.1)","#fca5a5")}>PAID</span>}
                      </div>
                    </td>
                    <td style={{...T.td,textAlign:"right"}} className={`er ${row.paid?"paid":""}`}>
                      <NumInput value={row.budgeted} onChange={v=>setEF(row.id,"budgeted",v)}/>
                    </td>
                    <td style={{...T.td,textAlign:"right"}} className={`er ${row.paid?"paid":""}`}>
                      <NumInput value={row.actual}   onChange={v=>setEF(row.id,"actual",v)}/>
                    </td>
                    <td style={T.td}><DelBtn onClick={()=>delE(row.id)}/></td>
                  </FadeRow>
                ))}
              </tbody>
              <tfoot><tr style={{background:"rgba(239,68,68,0.03)"}}>
                <td colSpan={2} style={{...T.td,fontWeight:800,color:"#f87171",fontSize:13,borderTop:"1px solid rgba(239,68,68,0.11)"}}>Total Expenses</td>
                <td style={{...T.td,textAlign:"right",color:"#3d5166",borderTop:"1px solid rgba(239,68,68,0.11)"}}>{fmt(budgetedExpenses)}</td>
                <td style={{...T.td,textAlign:"right",fontWeight:800,color:"#f87171",fontSize:15,borderTop:"1px solid rgba(239,68,68,0.11)"}}>{fmt(totalExpenses)}</td>
                <td style={{borderTop:"1px solid rgba(239,68,68,0.11)"}}/>
              </tr></tfoot>
            </table>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            INSTALLMENT & DEBT SECTION
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{...T.card({background:"rgba(99,102,241,0.035)",border:"1px solid rgba(99,102,241,0.1)"}),marginBottom:20}} className="su">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
            <div>
              <span style={{...T.sLabel,color:"#818cf8"}}>▸ Installment & Debt Tracker</span>
              <span style={{marginLeft:12,fontSize:11,color:"#3d5166"}}>
                Cleared <span style={{color:"#34d399",fontWeight:700}}>{fmt(totalPaid)}</span>
                {" · "}Remaining <span style={{color:"#f87171",fontWeight:700}}>{fmt(remainDebt)}</span>
              </span>
            </div>
            <AddBtn onClick={addD} label="Add Installment" color="#818cf8"/>
          </div>

          {/* ── Debt Management Table ── */}
          <div style={{overflowX:"auto",marginBottom:22}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>
                <th style={{...T.th,width:30,textAlign:"center"}}>✓</th>
                <th style={T.th}>Installment / Debt Name</th>
                <th style={{...T.th,textAlign:"right",width:118}}>Total Debt</th>
                <th style={{...T.th,textAlign:"right",width:118}}>Amount Paid</th>
                <th style={{...T.th,textAlign:"right",width:118}}>Remaining</th>
                <th style={{...T.th,width:140}}>Progress</th>
                <th style={{...T.th,width:136}}>Due Date</th>
                <th style={{...T.th,width:36}}/>
              </tr></thead>
              <tbody>
                {debts.map(row=>{
                  const remaining = Math.max(0,(row.totalDebt||0)-(row.paid||0));
                  const done = row.completed || remaining===0;
                  const p = pct(row.paid||0, row.totalDebt||1);
                  const barColor = done?"#34d399": p>=75?"#fbbf24":"#818cf8";
                  const barGrad  = done
                    ? "linear-gradient(90deg,#059669,#34d399)"
                    : p>=75
                      ? "linear-gradient(90deg,#b45309,#fbbf24)"
                      : "linear-gradient(90deg,#4338ca,#818cf8)";
                  return (
                    <FadeRow key={row.id} visible={vis[row.id]??false}>
                      <td style={{...T.td,textAlign:"center"}} className={`dr ${done?"done":""}`}>
                        <input type="checkbox" checked={row.completed}
                          onChange={()=>setDF(row.id,"completed",!row.completed)}
                          style={{width:15,height:15,cursor:"pointer",accentColor:"#34d399"}}/>
                      </td>
                      <td style={T.td} className={`dr ${done?"done":""}`}>
                        <TxtInput value={row.name} onChange={v=>setDF(row.id,"name",v)} placeholder="Debt name…"/>
                      </td>
                      <td style={{...T.td,textAlign:"right"}} className={`dr ${done?"done":""}`}>
                        <NumInput value={row.totalDebt} onChange={v=>setDF(row.id,"totalDebt",v)}/>
                      </td>
                      <td style={{...T.td,textAlign:"right"}} className={`dr ${done?"done":""}`}>
                        <NumInput value={row.paid} onChange={v=>setDF(row.id,"paid",clamp(v,0,row.totalDebt||999999))}/>
                      </td>
                      <td style={{...T.td,textAlign:"right",fontWeight:700,
                        color: done?"#34d399": remaining>0?"#f87171":"#4ade80"}}>
                        {fmt(remaining)}
                      </td>
                      <td style={T.td}>
                        <div style={{minWidth:90}}>
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#3d5166",marginBottom:3}}>
                            <span style={{color:barColor,fontWeight:700}}>{p}%</span>
                          </div>
                          <div style={{...T.track,width:"100%"}}>
                            <div style={{height:"100%",borderRadius:99,background:barGrad,
                              boxShadow:`0 0 7px ${barColor}66`,width:`${p}%`,
                              transition:"width .55s cubic-bezier(.4,0,.2,1)"}}/>
                          </div>
                        </div>
                      </td>
                      <td style={T.td}>
                        <DateInput value={row.dueDate||""} onChange={v=>setDF(row.id,"dueDate",v)}/>
                      </td>
                      <td style={T.td}><DelBtn onClick={()=>delD(row.id)}/></td>
                    </FadeRow>
                  );
                })}
              </tbody>
              <tfoot><tr style={{background:"rgba(99,102,241,0.04)"}}>
                <td colSpan={2} style={{...T.td,fontWeight:800,color:"#818cf8",fontSize:13,borderTop:"1px solid rgba(99,102,241,0.13)"}}>Totals</td>
                <td style={{...T.td,textAlign:"right",fontWeight:700,color:"#c8d3e0",borderTop:"1px solid rgba(99,102,241,0.13)"}}>{fmt(totalDebt)}</td>
                <td style={{...T.td,textAlign:"right",fontWeight:700,color:"#34d399",borderTop:"1px solid rgba(99,102,241,0.13)"}}>{fmt(totalPaid)}</td>
                <td style={{...T.td,textAlign:"right",fontWeight:800,color:"#f87171",fontSize:14,borderTop:"1px solid rgba(99,102,241,0.13)"}}>{fmt(remainDebt)}</td>
                <td colSpan={3} style={{borderTop:"1px solid rgba(99,102,241,0.13)"}}/>
              </tr></tfoot>
            </table>
          </div>

          {/* ── Per-Debt Visual Progress Cards ── */}
          {debts.length > 0 && (
            <>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#3d5166",marginBottom:12,paddingTop:4,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                Individual Debt Progress
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
                {debts.map(row=>(
                  <DebtCard key={row.id} row={row} visible={vis[row.id]??false}/>
                ))}
              </div>
            </>
          )}

          {/* ── Overall Debt Progress Bar ── */}
          <div style={{marginTop:20,padding:"16px 18px",background:"rgba(99,102,241,0.07)",borderRadius:12,border:"1px solid rgba(99,102,241,0.1)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#818cf8",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:3}}>Overall Debt Clearance</div>
                <div style={{fontSize:22,fontWeight:800,color:"#a5b4fc",letterSpacing:"-0.02em"}}>
                  {fmt(totalPaid)} <span style={{fontSize:14,color:"#3d5166",fontWeight:400}}>/ {fmt(totalDebt)}</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:34,fontWeight:800,color:"#818cf8",letterSpacing:"-0.04em",lineHeight:1}}>{debtClearPct}%</div>
                <div style={{fontSize:11,color:"#3d5166",marginTop:3}}>{fmt(remainDebt)} left</div>
              </div>
            </div>
            <div style={{height:8,background:"rgba(255,255,255,0.055)",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:99,
                background:"linear-gradient(90deg,#4338ca,#818cf8,#a5b4fc)",
                boxShadow:"0 0 10px rgba(129,140,248,0.5)",
                width:`${debtClearPct}%`, transition:"width .7s cubic-bezier(.4,0,.2,1)"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:7,fontSize:10,color:"#2a3a4a"}}>
              <span>৳0</span>
              <span style={{color:"#818cf8"}}>{fmt(totalDebt)} Target</span>
            </div>
            <div style={{marginTop:14,display:"flex",alignItems:"center",gap:8}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#818cf8",boxShadow:"0 0 6px #818cf8",display:"inline-block",flexShrink:0,animation:"blink 2s infinite"}}/>
              <span style={{fontSize:11,color:"#7a8fa8"}}>
                {debts.filter(d=>!d.completed&&Math.max(0,(d.totalDebt||0)-(d.paid||0))>0).length} active obligation(s) — {debtClearPct}% of total debt cleared across all installments.
              </span>
            </div>
          </div>
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            MASTER SUMMARY
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div style={{padding:"15px 20px",background:"rgba(6,182,212,0.03)",border:"1px solid rgba(6,182,212,0.09)",borderRadius:12,display:"flex",gap:24,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.13em",textTransform:"uppercase",color:"#2a3a4a",flexShrink:0}}>Master Summary</span>
          {[
            {l:"Income",       v:fmt(totalIncome),    c:"#4ade80"},
            {l:"Expenses",     v:fmt(totalExpenses),  c:"#f87171"},
            {l:"Paid Out",     v:fmt(paidExpenses),   c:"#fbbf24"},
            {l:"Cash in Hand", v:fmt(liveCash),       c:"#67e8f9"},
            {l:"Net Savings",  v:fmt(netSavings),     c:"#c4b5fd"},
            {l:"Total Debt",   v:fmt(totalDebt),      c:"#f87171"},
            {l:"Debt Paid",    v:fmt(totalPaid),      c:"#34d399"},
            {l:"Debt Left",    v:fmt(remainDebt),     c:"#fb923c"},
          ].map(i=>(
            <div key={i.l} style={{display:"flex",flexDirection:"column",gap:2}}>
              <span style={{fontSize:9,color:"#2a3a4a",fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase"}}>{i.l}</span>
              <span style={{fontSize:14,fontWeight:800,color:i.c}}>{i.v}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}