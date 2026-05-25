import { useState, useEffect } from "react";

const fmt   = (n) => "৳" + Math.round(n).toLocaleString("en-IN");
const pct   = (a, b) => b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0;
const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function loadLS(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}
function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function makeMonthKey(y, m) { return `${y}-${String(m+1).padStart(2,"0")}`; }

function freshMonth() {
  return {
    income: [
      { id:uid(), source:"Main Salary",  budgeted:60000, actual:60000 },
      { id:uid(), source:"Extra Income", budgeted:0,     actual:0     },
    ],
    expenses: [
      { id:uid(), name:"House Rent & Bills",     budgeted:16100, actual:16100, paid:false },
      { id:uid(), name:"Monthly Cash Groceries", budgeted:15000, actual:15000, paid:false },
      { id:uid(), name:"Fresh Vegetables",       budgeted:2500,  actual:2500,  paid:false },
    ],
    debts: [
      { id:uid(), name:"Loan Installment", totalDebt:100000, paid:0, dueDate:"2026-12-31", completed:false },
    ],
  };
}

function seedJune2025() {
  return {
    income: [
      { id:uid(), source:"May Carryover", budgeted:4400,  actual:4400  },
      { id:uid(), source:"Main Salary",   budgeted:60000, actual:60000 },
      { id:uid(), source:"Sublet Rent",   budgeted:7500,  actual:7500  },
      { id:uid(), source:"Extra Income",  budgeted:20000, actual:20000 },
    ],
    expenses: [
      { id:uid(), name:"Eid Meat & Groceries",                 budgeted:3600,  actual:3600,  paid:false },
      { id:uid(), name:"May Final Week Expenses",              budgeted:4000,  actual:4000,  paid:false },
      { id:uid(), name:"Loan/Installment (Arrears & Current)", budgeted:30000, actual:30000, paid:false },
      { id:uid(), name:"House Rent & Bills",                   budgeted:16100, actual:16100, paid:false },
      { id:uid(), name:"School Fees",                          budgeted:1500,  actual:1500,  paid:false },
      { id:uid(), name:"Shop Debt (1st Installment)",          budgeted:7000,  actual:7000,  paid:false },
      { id:uid(), name:"Monthly Cash Groceries",               budgeted:15000, actual:15000, paid:false },
      { id:uid(), name:"Fresh Vegetables",                     budgeted:2500,  actual:2500,  paid:false },
      { id:uid(), name:"Ammu Milad",                           budgeted:5000,  actual:5000,  paid:false },
      { id:uid(), name:"June Personal/Travel Expenses",        budgeted:4000,  actual:4000,  paid:false },
    ],
    debts: [
      { id:uid(), name:"Shop Debt",        totalDebt:20000,  paid:7000,  dueDate:"2025-09-30", completed:false },
      { id:uid(), name:"Loan Installment", totalDebt:100000, paid:30000, dueDate:"2026-12-31", completed:false },
      { id:uid(), name:"Family Loan",      totalDebt:50000,  paid:0,     dueDate:"",           completed:false },
    ],
  };
}

/* ── tiny components ── */
function NumInput({ value, onChange, width=100 }) {
  const [f,setF]=useState(false);
  return <input type="number" value={value}
    onChange={e=>onChange(Number(e.target.value)||0)}
    onFocus={()=>setF(true)} onBlur={()=>setF(false)}
    className="hs"
    style={{ background:"rgba(255,255,255,0.048)", border:`1px solid ${f?"rgba(6,182,212,0.6)":"rgba(255,255,255,0.09)"}`, borderRadius:8, padding:"6px 8px", color:"#dde4ee", fontSize:13, width, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}/>;
}
function TxtInput({ value, onChange, placeholder="Name..." }) {
  const [f,setF]=useState(false);
  return <input type="text" value={value}
    onChange={e=>onChange(e.target.value)}
    onFocus={()=>setF(true)} onBlur={()=>setF(false)}
    placeholder={placeholder}
    style={{ background:f?"rgba(255,255,255,0.055)":"transparent", border:`1px solid ${f?"rgba(6,182,212,0.4)":"transparent"}`, borderRadius:7, padding:"6px 8px", color:"#c8d3e0", fontSize:13, outline:"none", width:"100%", fontFamily:"inherit", boxSizing:"border-box" }}/>;
}
function DateInput({ value, onChange }) {
  return <input type="date" value={value} onChange={e=>onChange(e.target.value)}
    style={{ background:"rgba(255,255,255,0.048)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:8, padding:"6px 8px", color:"#8899aa", fontSize:12, width:"100%", outline:"none", colorScheme:"dark", fontFamily:"inherit", boxSizing:"border-box" }}/>;
}
function AddBtn({ onClick, label, color="#06b6d4" }) {
  const [h,setH]=useState(false);
  return <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"7px 13px", borderRadius:8, border:`1px solid ${h?color+"88":color+"33"}`, background:h?color+"20":color+"0d", color, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"all .2s", whiteSpace:"nowrap" }}>
    <span style={{fontSize:16,lineHeight:1}}>+</span>{label}
  </button>;
}
function DelBtn({ onClick }) {
  const [h,setH]=useState(false);
  return <button onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)} title="Remove"
    style={{ width:28, height:28, borderRadius:7, cursor:"pointer", border:`1px solid ${h?"rgba(239,68,68,0.5)":"rgba(239,68,68,0.2)"}`, background:h?"rgba(239,68,68,0.18)":"rgba(239,68,68,0.06)", color:"#f87171", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, transition:"all .2s", flexShrink:0 }}>x</button>;
}

function FadeRow({ children, visible }) {
  const [mount,setMount]=useState(visible);
  const [show,setShow]=useState(false);
  useEffect(()=>{
    if(visible){setMount(true);requestAnimationFrame(()=>requestAnimationFrame(()=>setShow(true)));}
    else{setShow(false);const t=setTimeout(()=>setMount(false),300);return()=>clearTimeout(t);}
  },[visible]);
  if(!mount) return null;
  return <tr style={{opacity:show?1:0,transform:show?"none":"translateY(-8px)",transition:"opacity .3s,transform .3s"}}>{children}</tr>;
}

function Badge({bg,fg,children}){
  return <span style={{display:"inline-block",padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700,background:bg,color:fg,whiteSpace:"nowrap"}}>{children}</span>;
}

function MCard({ label, value, g1, g2, bd, val, isHero, sub, danger }) {
  const [h,setH]=useState(false);
  const heroS = { background:"linear-gradient(135deg,rgba(6,182,212,0.15),rgba(59,130,246,0.09))", border:"1px solid rgba(6,182,212,0.3)", borderRadius:14, padding:"16px 18px", flex:"1 1 160px", position:"relative", overflow:"hidden", transform:h?"translateY(-3px)":"none", transition:"transform .22s", minWidth:0 };
  const normS = { background:`linear-gradient(135deg,${g1||"rgba(34,197,94,0.09)"},${g2||"rgba(16,185,129,0.04)"})`, border:`1px solid ${bd||"rgba(34,197,94,0.17)"}`, borderRadius:14, padding:"16px 18px", flex:"1 1 160px", transform:h?"translateY(-3px)":"none", transition:"transform .22s", minWidth:0 };
  return (
    <div style={isHero?heroS:normS} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>
      <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.11em",textTransform:"uppercase",color:isHero?"#67e8f9":"#7a8fa8",marginBottom:7}}>{label}</div>
      <div style={{fontSize:isHero?24:20,fontWeight:800,color:danger?"#f87171":isHero?"#e0f7fa":(val||"#4ade80"),letterSpacing:"-0.02em",lineHeight:1,wordBreak:"break-all"}}>{value}</div>
      {sub&&<div style={{marginTop:6,fontSize:10,color:"#3d5166"}}>{sub}</div>}
    </div>
  );
}

function MiniBar({ value, total, done }) {
  const p=pct(value,total);
  const grad=done?"linear-gradient(90deg,#059669,#34d399)":p>=75?"linear-gradient(90deg,#b45309,#fbbf24)":"linear-gradient(90deg,#4338ca,#818cf8)";
  const col=done?"#34d399":p>=75?"#fbbf24":"#818cf8";
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#3d5166",marginBottom:4}}>
        <span style={{color:col,fontWeight:700}}>{p}%</span>
        <span>{fmt(value)} / {fmt(total)}</span>
      </div>
      <div style={{height:5,background:"rgba(255,255,255,0.055)",borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:99,background:grad,width:`${p}%`,transition:"width .5s"}}/>
      </div>
    </div>
  );
}

function DebtCard({ row, visible }) {
  const remaining=Math.max(0,(row.totalDebt||0)-(row.paid||0));
  const done=row.completed||remaining===0;
  return (
    <div style={{background:done?"rgba(5,150,105,0.07)":"rgba(255,255,255,0.025)",border:`1px solid ${done?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.065)"}`,borderRadius:12,padding:"14px 16px",opacity:visible?1:0,transform:visible?"none":"translateY(12px)",transition:"opacity .3s,transform .3s"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:done?"#6ee7b7":"#c8d3e0",textDecoration:done?"line-through":"none",marginBottom:2,wordBreak:"break-word"}}>{row.name}</div>
          {row.dueDate&&<div style={{fontSize:10,color:"#3d5166"}}>Due {row.dueDate}</div>}
        </div>
        {done?<Badge bg="rgba(5,150,105,0.18)" fg="#34d399">DONE</Badge>:<Badge bg="rgba(99,102,241,0.16)" fg="#818cf8">ACTIVE</Badge>}
      </div>
      <MiniBar value={row.paid||0} total={row.totalDebt||0} done={done}/>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:11,flexWrap:"wrap",gap:4}}>
        <span style={{color:"#3d5166"}}>Left <span style={{color:done?"#34d399":"#f87171",fontWeight:700}}>{fmt(remaining)}</span></span>
        <span style={{color:"#3d5166"}}>Total <span style={{color:"#c8d3e0",fontWeight:700}}>{fmt(row.totalDebt||0)}</span></span>
      </div>
    </div>
  );
}

function MonthNav({ year, month, onChange, allKeys }) {
  const [ddOpen,setDdOpen]=useState(false);
  const key=makeMonthKey(year,month);
  function go(dir){
    let m=month+dir, y=year;
    if(m<0){m=11;y--;}
    if(m>11){m=0;y++;}
    onChange(y,m);
  }
  const sorted=[...allKeys].sort();
  const btn={borderRadius:8,border:"1px solid rgba(6,182,212,0.3)",background:"rgba(6,182,212,0.08)",color:"#67e8f9",cursor:"pointer",fontFamily:"inherit"};
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,position:"relative"}}>
      <button onClick={()=>go(-1)} style={{...btn,width:32,height:32,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>&#8249;</button>
      <button onClick={()=>setDdOpen(p=>!p)} style={{...btn,padding:"6px 12px",fontWeight:700,fontSize:13,minWidth:145,textAlign:"center"}}>
        {MONTHS[month]} {year} {ddOpen?"▲":"▼"}
      </button>
      <button onClick={()=>go(1)} style={{...btn,width:32,height:32,fontSize:20,display:"flex",alignItems:"center",justifyContent:"center"}}>&#8250;</button>
      {ddOpen&&(
        <div style={{position:"absolute",top:40,left:38,zIndex:200,background:"#0d1117",border:"1px solid rgba(6,182,212,0.25)",borderRadius:12,padding:8,minWidth:190,boxShadow:"0 8px 32px rgba(0,0,0,0.7)",maxHeight:280,overflowY:"auto"}}>
          {sorted.length===0&&<div style={{color:"#3d5166",fontSize:12,padding:"6px 10px"}}>No months yet</div>}
          {sorted.map(k=>{
            const [ky,km]=k.split("-");
            const isActive=k===key;
            return (
              <div key={k} onClick={()=>{onChange(parseInt(ky),parseInt(km)-1);setDdOpen(false);}}
                style={{padding:"7px 12px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:isActive?700:400,color:isActive?"#67e8f9":"#c8d3e0",background:isActive?"rgba(6,182,212,0.12)":"transparent",marginBottom:2}}>
                {MONTHS[parseInt(km)-1]} {ky}{isActive?" ✓":""}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════
   MAIN APP
══════════════════════════════ */
export default function App() {
  const now=new Date();
  const [curYear,  setCurYear]  = useState(now.getFullYear());
  const [curMonth, setCurMonth] = useState(now.getMonth());

  // ── THE FIX: load from localStorage once on mount ──
  const [allData, setAllData] = useState(()=>{
    const saved=loadLS("sft_v2",null);
    if(saved && Object.keys(saved).length>0) return saved;
    return {"2025-06":seedJune2025()};
  });

  const [vis,setVis]=useState({});

  const monthKey  = makeMonthKey(curYear,curMonth);
  const allKeys   = Object.keys(allData);
  const monthData = allData[monthKey] || freshMonth();
  const income    = monthData.income   || [];
  const expenses  = monthData.expenses || [];
  const debts     = monthData.debts    || [];

  // ── THE FIX: save to localStorage on every allData change ──
  useEffect(()=>{ saveLS("sft_v2", allData); }, [allData]);

  useEffect(()=>{
    const m={};
    [...(allData[monthKey]?.income||[]), ...(allData[monthKey]?.expenses||[]), ...(allData[monthKey]?.debts||[])].forEach(r=>{ m[r.id]=true; });
    setVis(m);
  // eslint-disable-next-line
  },[monthKey]);

  // ── THE FIX: always read fresh state from prev in setAllData ──
  function updIncome(fn) {
    setAllData(prev=>{
      const cur=prev[monthKey]||freshMonth();
      return {...prev,[monthKey]:{...cur,income:fn(cur.income||[])}};
    });
  }
  function updExpenses(fn) {
    setAllData(prev=>{
      const cur=prev[monthKey]||freshMonth();
      return {...prev,[monthKey]:{...cur,expenses:fn(cur.expenses||[])}};
    });
  }
  function updDebts(fn) {
    setAllData(prev=>{
      const cur=prev[monthKey]||freshMonth();
      return {...prev,[monthKey]:{...cur,debts:fn(cur.debts||[])}};
    });
  }

  function handleNewMonth() {
    const nextM=curMonth===11?0:curMonth+1;
    const nextY=curMonth===11?curYear+1:curYear;
    const nextKey=makeMonthKey(nextY,nextM);
    setAllData(prev=>{ if(prev[nextKey]) return prev; return {...prev,[nextKey]:freshMonth()}; });
    setCurYear(nextY); setCurMonth(nextM);
  }

  const showRow=(id)=>setVis(p=>({...p,[id]:true}));
  const hideRow=(id,del)=>{setVis(p=>({...p,[id]:false}));setTimeout(()=>del(id),310);};

  // Income handlers
  const addI=()=>{const id=uid();updIncome(a=>[...a,{id,source:"New Source",budgeted:0,actual:0}]);showRow(id);};
  const delI=(id)=>hideRow(id,()=>updIncome(a=>a.filter(r=>r.id!==id)));
  const setIF=(id,k,v)=>updIncome(a=>a.map(r=>r.id===id?{...r,[k]:v}:r));

  // Expense handlers
  const addE=()=>{const id=uid();updExpenses(a=>[...a,{id,name:"New Expense",budgeted:0,actual:0,paid:false}]);showRow(id);};
  const delE=(id)=>hideRow(id,()=>updExpenses(a=>a.filter(r=>r.id!==id)));
  const setEF=(id,k,v)=>updExpenses(a=>a.map(r=>r.id===id?{...r,[k]:v}:r));

  // Debt handlers
  const addD=()=>{const id=uid();updDebts(a=>[...a,{id,name:"New Debt",totalDebt:0,paid:0,dueDate:"",completed:false}]);showRow(id);};
  const delD=(id)=>hideRow(id,()=>updDebts(a=>a.filter(r=>r.id!==id)));
  const setDF=(id,k,v)=>updDebts(a=>a.map(r=>r.id===id?{...r,[k]:v}:r));

  // Totals
  const totalIncome    = income.reduce((s,i)=>s+(i.actual||0),0);
  const totalExpenses  = expenses.reduce((s,e)=>s+(e.actual||0),0);
  const paidExpenses   = expenses.filter(e=>e.paid).reduce((s,e)=>s+(e.actual||0),0);
  const liveCash       = totalIncome-paidExpenses;
  const netSavings     = totalIncome-totalExpenses;
  const totalDebt      = debts.reduce((s,d)=>s+(d.totalDebt||0),0);
  const totalPaid      = debts.reduce((s,d)=>s+(d.paid||0),0);
  const remainDebt     = totalDebt-totalPaid;
  const debtClearPct   = pct(totalPaid,totalDebt);
  const budgetedIncome = income.reduce((s,i)=>s+(i.budgeted||0),0);
  const budgetedExp    = expenses.reduce((s,e)=>s+(e.budgeted||0),0);
  const paidCount      = expenses.filter(e=>e.paid).length;
  const isCurrentMonth = makeMonthKey(now.getFullYear(),now.getMonth())===monthKey;

  const th={padding:"8px 10px",textAlign:"left",color:"#3d5166",fontSize:10,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",borderBottom:"1px solid rgba(255,255,255,0.05)",whiteSpace:"nowrap"};
  const td={padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.032)",verticalAlign:"middle"};

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#07090e 0%,#0b0f17 55%,#070a0f 100%)",fontFamily:"'DM Sans','Segoe UI',system-ui,sans-serif",color:"#dde4ee",paddingBottom:60}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .hs::-webkit-outer-spin-button,.hs::-webkit-inner-spin-button{-webkit-appearance:none}
        .hs{-moz-appearance:textfield}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .su{animation:fadeUp .38s ease both}
        .er{transition:opacity .25s,background .2s}.er:hover{background:rgba(255,255,255,0.016)!important}
        .er.paid{opacity:.4}
        .dr.done td{opacity:.55;text-decoration:line-through;text-decoration-color:rgba(52,211,153,0.4)}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.4) sepia(1) saturate(.5)}
        .wrap{max-width:1260px;margin:0 auto;padding:0 16px}
        @media(max-width:600px){
          .hdr{padding:12px 14px!important;flex-wrap:wrap!important;gap:10px!important}
          .wrap{padding:0 10px!important}
          .cards-row{flex-direction:column!important}
          .cards-row > div{min-width:0!important;flex:none!important;width:100%!important}
          .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
          .hide-mob{display:none!important}
          .month-nav-btn{min-width:120px!important;font-size:12px!important}
          .hist-card{min-width:100px!important}
        }
        @media(max-width:400px){
          .month-nav-btn{min-width:100px!important}
        }
      `}</style>

      {/* HEADER */}
      <header className="hdr" style={{borderBottom:"1px solid rgba(99,179,237,0.09)",background:"rgba(7,9,14,0.92)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:50,padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#06b6d4,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:15,flexShrink:0}}>S</div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:"#eef2f8",lineHeight:1.2}}>Sajjad's Finance Tracker</div>
            <div style={{fontSize:10,color:"#4a90d9",marginTop:2}} className="hide-mob">Personal Finance Dashboard</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <MonthNav year={curYear} month={curMonth} onChange={(y,m)=>{setCurYear(y);setCurMonth(m);}} allKeys={allKeys}/>
          {isCurrentMonth?<Badge bg="rgba(34,197,94,0.15)" fg="#4ade80">LIVE</Badge>:<Badge bg="rgba(251,191,36,0.12)" fg="#fbbf24">HISTORY</Badge>}
        </div>
      </header>

      <div className="wrap" style={{marginTop:22}}>

        {/* Top bar */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Badge bg="rgba(6,182,212,0.11)" fg="#67e8f9">{MONTHS[curMonth]} {curYear}</Badge>
            <Badge bg="rgba(34,197,94,0.1)" fg="#4ade80">{paidCount}/{expenses.length} Paid</Badge>
            <Badge bg="rgba(99,102,241,0.1)" fg="#818cf8">{allKeys.length} Month{allKeys.length!==1?"s":""} Saved</Badge>
          </div>
          {isCurrentMonth&&<button onClick={handleNewMonth} style={{padding:"7px 14px",borderRadius:9,border:"1px solid rgba(6,182,212,0.4)",background:"rgba(6,182,212,0.1)",color:"#67e8f9",cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:"inherit",whiteSpace:"nowrap"}}>+ Next Month</button>}
        </div>

        {/* History strip */}
        {allKeys.length>1&&(
          <div style={{marginBottom:18,padding:"12px 14px",background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.1)",borderRadius:12,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#3d5166",marginBottom:10}}>Monthly History</div>
            <div style={{display:"flex",gap:8,minWidth:"max-content"}}>
              {[...allKeys].sort().map(k=>{
                const [ky,km]=k.split("-");
                const d=allData[k];
                const inc=(d.income||[]).reduce((s,i)=>s+(i.actual||0),0);
                const exp=(d.expenses||[]).reduce((s,e)=>s+(e.actual||0),0);
                const sav=inc-exp;
                const isActive=k===monthKey;
                return (
                  <div key={k} onClick={()=>{setCurYear(parseInt(ky));setCurMonth(parseInt(km)-1);}} className="hist-card"
                    style={{padding:"9px 13px",borderRadius:10,border:`1px solid ${isActive?"rgba(6,182,212,0.4)":"rgba(255,255,255,0.06)"}`,background:isActive?"rgba(6,182,212,0.08)":"rgba(255,255,255,0.02)",cursor:"pointer",minWidth:110,flexShrink:0,transition:"all .2s"}}>
                    <div style={{fontSize:10,fontWeight:700,color:isActive?"#67e8f9":"#4a90d9",marginBottom:5}}>{MONTHS[parseInt(km)-1].slice(0,3)} {ky}</div>
                    <div style={{fontSize:11,color:"#4ade80",fontWeight:700}}>{fmt(inc)}</div>
                    <div style={{fontSize:10,color:"#f87171"}}>{fmt(exp)}</div>
                    <div style={{fontSize:10,color:sav>=0?"#c4b5fd":"#fb923c",fontWeight:700,marginTop:2}}>{sav>=0?"+":""}{fmt(sav)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Overview */}
        <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.13em",textTransform:"uppercase",color:"#2a3a4a",marginBottom:10}}>Financial Overview</div>
        <div className="cards-row" style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:10}}>
          <MCard label="Total Income"    value={fmt(totalIncome)}   g1="rgba(34,197,94,0.09)"  g2="rgba(16,185,129,0.04)" bd="rgba(34,197,94,0.17)"  val="#4ade80" sub={`${income.length} streams`}/>
          <MCard label="Total Expenses"  value={fmt(totalExpenses)} g1="rgba(239,68,68,0.09)"  g2="rgba(220,38,38,0.04)"  bd="rgba(239,68,68,0.17)"  val="#f87171" sub={`${expenses.length} items`}/>
          <MCard label="Cash in Hand"    value={fmt(liveCash)} isHero sub={`After ${fmt(paidExpenses)} paid`}/>
          <MCard label="Net Savings"     value={fmt(netSavings)} g1="rgba(168,85,247,0.09)" g2="rgba(139,92,246,0.04)" bd="rgba(168,85,247,0.17)" val="#c4b5fd" danger={netSavings<0}/>
        </div>
        <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.13em",textTransform:"uppercase",color:"#2a3a4a",margin:"18px 0 10px"}}>Debt Overview</div>
        <div className="cards-row" style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:24}}>
          <MCard label="Total Debt"     value={fmt(totalDebt)}    g1="rgba(239,68,68,0.09)"  g2="rgba(220,38,38,0.04)"  bd="rgba(239,68,68,0.17)"  val="#f87171"/>
          <MCard label="Total Paid"     value={fmt(totalPaid)}    g1="rgba(34,197,94,0.09)"  g2="rgba(16,185,129,0.04)" bd="rgba(34,197,94,0.17)"  val="#4ade80" sub={`${debtClearPct}% cleared`}/>
          <MCard label="Remaining Debt" value={fmt(remainDebt)}   g1="rgba(251,191,36,0.08)" g2="rgba(245,158,11,0.04)" bd="rgba(251,191,36,0.17)" val="#fbbf24" danger={remainDebt>0}/>
          <MCard label="Debt Clearance" value={`${debtClearPct}%`} g1="rgba(249,115,22,0.09)" g2="rgba(234,88,12,0.04)" bd="rgba(249,115,22,0.17)" val="#fb923c"/>
        </div>

        {/* Income table */}
        <div style={{background:"rgba(255,255,255,0.027)",border:"1px solid rgba(255,255,255,0.065)",borderRadius:16,padding:"18px 16px",marginBottom:16}} className="su">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#4a90d9"}}>Income Tracker</span>
            <AddBtn onClick={addI} label="Add Source"/>
          </div>
          <div className="tbl-wrap">
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>
                <th style={th}>Source</th>
                <th style={{...th,textAlign:"right",width:110}} className="hide-mob">Budgeted</th>
                <th style={{...th,textAlign:"right",width:110}}>Actual</th>
                <th style={{...th,textAlign:"right",width:90}}>Variance</th>
                <th style={{...th,width:36}}/>
              </tr></thead>
              <tbody>
                {income.map(row=>{
                  const v=(row.actual||0)-(row.budgeted||0);
                  return (
                    <FadeRow key={row.id} visible={vis[row.id]??false}>
                      <td style={td}><TxtInput value={row.source} onChange={v=>setIF(row.id,"source",v)} placeholder="Income source..."/></td>
                      <td style={{...td,textAlign:"right"}} className="hide-mob"><NumInput value={row.budgeted} onChange={v=>setIF(row.id,"budgeted",v)}/></td>
                      <td style={{...td,textAlign:"right"}}><NumInput value={row.actual} onChange={v=>setIF(row.id,"actual",v)}/></td>
                      <td style={{...td,textAlign:"right"}}><span style={{fontWeight:700,fontSize:12,color:v>=0?"#4ade80":"#f87171"}}>{v>=0?"+":""}{fmt(v)}</span></td>
                      <td style={td}><DelBtn onClick={()=>delI(row.id)}/></td>
                    </FadeRow>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td style={{...td,fontWeight:800,color:"#4ade80",borderTop:"1px solid rgba(34,197,94,0.14)"}}>Total</td>
                <td style={{...td,textAlign:"right",color:"#3d5166",borderTop:"1px solid rgba(34,197,94,0.14)"}} className="hide-mob">{fmt(budgetedIncome)}</td>
                <td style={{...td,textAlign:"right",fontWeight:800,color:"#4ade80",fontSize:15,borderTop:"1px solid rgba(34,197,94,0.14)"}}>{fmt(totalIncome)}</td>
                <td colSpan={2} style={{borderTop:"1px solid rgba(34,197,94,0.14)"}}/>
              </tr></tfoot>
            </table>
          </div>
        </div>

        {/* Expense table */}
        <div style={{background:"rgba(255,255,255,0.027)",border:"1px solid rgba(255,255,255,0.065)",borderRadius:16,padding:"18px 16px",marginBottom:16}} className="su">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
            <div>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#4a90d9"}}>Expense Tracker</span>
              <div style={{fontSize:11,color:"#3d5166",marginTop:3}}>Paid <span style={{color:"#f87171",fontWeight:700}}>{fmt(paidExpenses)}</span> · Pending <span style={{color:"#fbbf24",fontWeight:700}}>{fmt(totalExpenses-paidExpenses)}</span></div>
            </div>
            <AddBtn onClick={addE} label="Add Expense"/>
          </div>
          <div className="tbl-wrap">
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>
                <th style={{...th,width:32,textAlign:"center"}}>✓</th>
                <th style={th}>Expense</th>
                <th style={{...th,textAlign:"right",width:110}} className="hide-mob">Budgeted</th>
                <th style={{...th,textAlign:"right",width:110}}>Actual</th>
                <th style={{...th,width:36}}/>
              </tr></thead>
              <tbody>
                {expenses.map(row=>(
                  <FadeRow key={row.id} visible={vis[row.id]??false}>
                    <td style={{...td,textAlign:"center"}} className={`er ${row.paid?"paid":""}`}>
                      <input type="checkbox" checked={row.paid} onChange={()=>setEF(row.id,"paid",!row.paid)} style={{width:16,height:16,cursor:"pointer",accentColor:"#06b6d4"}}/>
                    </td>
                    <td style={td} className={`er ${row.paid?"paid":""}`}>
                      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        <TxtInput value={row.name} onChange={v=>setEF(row.id,"name",v)} placeholder="Expense name..."/>
                        {row.paid&&<Badge bg="rgba(239,68,68,0.1)" fg="#fca5a5">PAID</Badge>}
                      </div>
                    </td>
                    <td style={{...td,textAlign:"right"}} className={`er ${row.paid?"paid":""} hide-mob`}><NumInput value={row.budgeted} onChange={v=>setEF(row.id,"budgeted",v)}/></td>
                    <td style={{...td,textAlign:"right"}} className={`er ${row.paid?"paid":""}`}><NumInput value={row.actual} onChange={v=>setEF(row.id,"actual",v)}/></td>
                    <td style={td}><DelBtn onClick={()=>delE(row.id)}/></td>
                  </FadeRow>
                ))}
              </tbody>
              <tfoot><tr>
                <td colSpan={2} style={{...td,fontWeight:800,color:"#f87171",borderTop:"1px solid rgba(239,68,68,0.12)"}}>Total</td>
                <td style={{...td,textAlign:"right",color:"#3d5166",borderTop:"1px solid rgba(239,68,68,0.12)"}} className="hide-mob">{fmt(budgetedExp)}</td>
                <td style={{...td,textAlign:"right",fontWeight:800,color:"#f87171",fontSize:15,borderTop:"1px solid rgba(239,68,68,0.12)"}}>{fmt(totalExpenses)}</td>
                <td style={{borderTop:"1px solid rgba(239,68,68,0.12)"}}/>
              </tr></tfoot>
            </table>
          </div>
        </div>

        {/* Debt table */}
        <div style={{background:"rgba(99,102,241,0.035)",border:"1px solid rgba(99,102,241,0.1)",borderRadius:16,padding:"18px 16px",marginBottom:16}} className="su">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
            <div>
              <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#818cf8"}}>Debt Tracker</span>
              <div style={{fontSize:11,color:"#3d5166",marginTop:3}}>Cleared <span style={{color:"#34d399",fontWeight:700}}>{fmt(totalPaid)}</span> · Left <span style={{color:"#f87171",fontWeight:700}}>{fmt(remainDebt)}</span></div>
            </div>
            <AddBtn onClick={addD} label="Add Debt" color="#818cf8"/>
          </div>
          <div className="tbl-wrap" style={{marginBottom:18}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead><tr>
                <th style={{...th,width:32,textAlign:"center"}}>✓</th>
                <th style={th}>Debt Name</th>
                <th style={{...th,textAlign:"right",width:110}} className="hide-mob">Total</th>
                <th style={{...th,textAlign:"right",width:110}}>Paid</th>
                <th style={{...th,textAlign:"right",width:100}}>Left</th>
                <th style={{...th,width:130}} className="hide-mob">Progress</th>
                <th style={{...th,width:130}} className="hide-mob">Due Date</th>
                <th style={{...th,width:36}}/>
              </tr></thead>
              <tbody>
                {debts.map(row=>{
                  const remaining=Math.max(0,(row.totalDebt||0)-(row.paid||0));
                  const done=row.completed||remaining===0;
                  const p=pct(row.paid||0,row.totalDebt||1);
                  const barC=done?"#34d399":p>=75?"#fbbf24":"#818cf8";
                  const barG=done?"linear-gradient(90deg,#059669,#34d399)":p>=75?"linear-gradient(90deg,#b45309,#fbbf24)":"linear-gradient(90deg,#4338ca,#818cf8)";
                  return (
                    <FadeRow key={row.id} visible={vis[row.id]??false}>
                      <td style={{...td,textAlign:"center"}} className={`dr ${done?"done":""}`}>
                        <input type="checkbox" checked={row.completed} onChange={()=>setDF(row.id,"completed",!row.completed)} style={{width:16,height:16,cursor:"pointer",accentColor:"#34d399"}}/>
                      </td>
                      <td style={td} className={`dr ${done?"done":""}`}><TxtInput value={row.name} onChange={v=>setDF(row.id,"name",v)} placeholder="Debt name..."/></td>
                      <td style={{...td,textAlign:"right"}} className={`dr ${done?"done":""} hide-mob`}><NumInput value={row.totalDebt} onChange={v=>setDF(row.id,"totalDebt",v)}/></td>
                      <td style={{...td,textAlign:"right"}} className={`dr ${done?"done":""}`}><NumInput value={row.paid} onChange={v=>setDF(row.id,"paid",clamp(v,0,row.totalDebt||999999))}/></td>
                      <td style={{...td,textAlign:"right",fontWeight:700,color:done?"#34d399":remaining>0?"#f87171":"#4ade80"}}>{fmt(remaining)}</td>
                      <td style={td} className="hide-mob">
                        <div style={{minWidth:90}}>
                          <div style={{fontSize:9,color:barC,fontWeight:700,marginBottom:3}}>{p}%</div>
                          <div style={{height:5,background:"rgba(255,255,255,0.055)",borderRadius:99,overflow:"hidden"}}>
                            <div style={{height:"100%",borderRadius:99,background:barG,width:`${p}%`,transition:"width .5s"}}/>
                          </div>
                        </div>
                      </td>
                      <td style={td} className="hide-mob"><DateInput value={row.dueDate||""} onChange={v=>setDF(row.id,"dueDate",v)}/></td>
                      <td style={td}><DelBtn onClick={()=>delD(row.id)}/></td>
                    </FadeRow>
                  );
                })}
              </tbody>
              <tfoot><tr>
                <td colSpan={2} style={{...td,fontWeight:800,color:"#818cf8",borderTop:"1px solid rgba(99,102,241,0.14)"}}>Totals</td>
                <td style={{...td,textAlign:"right",fontWeight:700,color:"#c8d3e0",borderTop:"1px solid rgba(99,102,241,0.14)"}} className="hide-mob">{fmt(totalDebt)}</td>
                <td style={{...td,textAlign:"right",fontWeight:700,color:"#34d399",borderTop:"1px solid rgba(99,102,241,0.14)"}}>{fmt(totalPaid)}</td>
                <td style={{...td,textAlign:"right",fontWeight:800,color:"#f87171",fontSize:14,borderTop:"1px solid rgba(99,102,241,0.14)"}}>{fmt(remainDebt)}</td>
                <td colSpan={3} style={{borderTop:"1px solid rgba(99,102,241,0.14)"}}/>
              </tr></tfoot>
            </table>
          </div>

          {debts.length>0&&(
            <>
              <div style={{fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#3d5166",marginBottom:12,paddingTop:6,borderTop:"1px solid rgba(255,255,255,0.04)"}}>Individual Progress</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
                {debts.map(row=><DebtCard key={row.id} row={row} visible={vis[row.id]??false}/>)}
              </div>
            </>
          )}

          <div style={{marginTop:18,padding:"14px 16px",background:"rgba(99,102,241,0.07)",borderRadius:12,border:"1px solid rgba(99,102,241,0.12)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#818cf8",textTransform:"uppercase",marginBottom:4}}>Overall Debt Clearance</div>
                <div style={{fontSize:18,fontWeight:800,color:"#a5b4fc"}}>{fmt(totalPaid)} <span style={{fontSize:12,color:"#3d5166",fontWeight:400}}>/ {fmt(totalDebt)}</span></div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:30,fontWeight:800,color:"#818cf8",lineHeight:1}}>{debtClearPct}%</div>
                <div style={{fontSize:10,color:"#3d5166",marginTop:2}}>{fmt(remainDebt)} remaining</div>
              </div>
            </div>
            <div style={{height:8,background:"rgba(255,255,255,0.055)",borderRadius:99,overflow:"hidden"}}>
              <div style={{height:"100%",borderRadius:99,background:"linear-gradient(90deg,#4338ca,#818cf8,#a5b4fc)",width:`${debtClearPct}%`,transition:"width .7s"}}/>
            </div>
          </div>
        </div>

        {/* Master summary */}
        <div style={{padding:"14px 18px",background:"rgba(6,182,212,0.03)",border:"1px solid rgba(6,182,212,0.09)",borderRadius:12,display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"#2a3a4a",flexShrink:0}}>Summary — {MONTHS[curMonth]} {curYear}</span>
          {[
            {l:"Income",       v:fmt(totalIncome),  c:"#4ade80"},
            {l:"Expenses",     v:fmt(totalExpenses), c:"#f87171"},
            {l:"Cash in Hand", v:fmt(liveCash),      c:"#67e8f9"},
            {l:"Net Savings",  v:fmt(netSavings),    c:"#c4b5fd"},
            {l:"Total Debt",   v:fmt(totalDebt),     c:"#f87171"},
            {l:"Debt Paid",    v:fmt(totalPaid),     c:"#34d399"},
            {l:"Debt Left",    v:fmt(remainDebt),    c:"#fb923c"},
          ].map(i=>(
            <div key={i.l} style={{display:"flex",flexDirection:"column",gap:2}}>
              <span style={{fontSize:9,color:"#2a3a4a",fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase"}}>{i.l}</span>
              <span style={{fontSize:13,fontWeight:800,color:i.c}}>{i.v}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
