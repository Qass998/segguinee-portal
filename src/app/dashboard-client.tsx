"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ProductionEntry { id:string;volume_m3:number;station:string;zone:string;recorded_by:string;recorded_at:string; }
interface Invoice { id:string;customer_phone:string;customer_name:string;amount_gnf:number;reference:string;description:string;due_date:string;status:"pending"|"paid"|"overdue"|"cancelled";signed:boolean;paid_at:string|null;created_at:string; }
interface Incident { id:string;type:string;description:string;zone:string;station:string;status:"open"|"in_progress"|"resolved"|"closed";reported_by:string;created_at:string; }
interface Agent { id:string;agent:string;agent_id:string;icon:string;statut:string;insight:string;heure_execution:string; }
interface Projet { id:string;nom:string;type:string;zone:string;statut:string;budget_gnf:number;depense_gnf:number;date_debut:string;date_fin:string;chef_projet:string;description:string; }
interface Task { id:string;command:string;status:"pending"|"executing"|"done"|"failed";result:string;action_taken:string;created_at:string;executed_at:string; }

type Tab = "overview"|"production"|"invoices"|"incidents"|"projets"|"agents";

/* ── Design tokens — Swiss Rational, Midnight preset ─────────────────────
   Font: DM Sans (approved) — NOT Inter (banned AI fingerprint)
   Colors: from skill §4.4 dark mode baseline                            */
const T = {
  bg:      "#07090f",
  surface: "#0c1018",
  card:    "#111622",
  card2:   "#161d2b",
  card3:   "#1b2335",
  border:  "#1e2d42",
  border2: "#253450",
  text:    "#e2e8f0",   /* off-white — never pure #fff on dark */
  t2:      "#7a90aa",
  t3:      "#3d5270",
  blue:    "#3b82f6",
  blueDim: "rgba(59,130,246,0.08)",
  green:   "#16a34a",
  greenDim:"rgba(22,163,74,0.10)",
  amber:   "#d97706",
  amberDim:"rgba(217,119,6,0.10)",
  red:     "#dc2626",
  redDim:  "rgba(220,38,38,0.10)",
  mono:    "'JetBrains Mono','Fira Mono','Consolas',monospace",
  font:    "'DM Sans',-apple-system,'Segoe UI',sans-serif",
};

const ZONES=["Kaloum","Dixinn","Matam","Ratoma","Matoto","Coyah","Dubréka","Kindia"];
const INC_TYPES=["rupture","panne","contamination","fuite","autre"];
const PROJ_TYPES=["construction","réhabilitation","extension","maintenance","étude"];
const PROJ_STATUS=["planifié","en_cours","suspendu","terminé"];

const TABS:{key:Tab;label:string}[]=[
  {key:"overview",   label:"Vue d'ensemble"},
  {key:"production", label:"Production"},
  {key:"invoices",   label:"Facturation"},
  {key:"incidents",  label:"Incidents"},
  {key:"projets",    label:"Projets"},
  {key:"agents",     label:"Agents IA"},
];

/* ── Helpers ──────────────────────────────────────────────────────────── */
const fd=(s:string)=>s?new Date(s).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}):"—";
const ft=(s:string)=>{if(!s)return"—";const d=new Date(s),n=new Date(),m=Math.floor((n.getTime()-d.getTime())/60000);if(m<1)return"à l'instant";if(m<60)return`${m}m`;if(m<1440)return`${Math.floor(m/60)}h`;return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});};
const fg=(n:number)=>(n||0).toLocaleString("fr-FR")+" GNF";
const fp=(d:number,b:number)=>b>0?Math.min(100,Math.round((d/b)*100)):0;

/* ── Shared input / label ─────────────────────────────────────────────── */
const inp:React.CSSProperties={background:T.card3,border:`1px solid ${T.border2}`,borderRadius:5,padding:"8px 12px",color:T.text,fontSize:13,width:"100%",fontFamily:T.font,outline:"none",boxSizing:"border-box"};
const lbl:React.CSSProperties={fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:4,display:"block"};

/* ── Button ───────────────────────────────────────────────────────────── */
function Btn({ch,onClick,type="button",v="blue",dis}:{ch:React.ReactNode;onClick?:()=>void;type?:"button"|"submit";v?:"blue"|"ghost"|"red";dis?:boolean}){
  const s:React.CSSProperties=v==="blue"?{background:T.blue,color:"#fff",border:"none"}:v==="red"?{background:T.red,color:"#fff",border:"none"}:{background:"none",color:T.t2,border:`1px solid ${T.border2}`};
  return <button type={type} onClick={onClick} disabled={dis} style={{...s,padding:"8px 16px",borderRadius:5,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font,opacity:dis?.4:1,letterSpacing:"0.01em"}}>{ch}</button>;
}

/* ── Status pill ──────────────────────────────────────────────────────── */
function Pill({s}:{s:string}){
  const m:Record<string,{l:string;c:string;bg:string}>={
    pending:{l:"En attente",c:T.amber,bg:T.amberDim},paid:{l:"Payée",c:T.green,bg:T.greenDim},
    overdue:{l:"Retard",c:T.red,bg:T.redDim},cancelled:{l:"Annulé",c:T.t3,bg:T.card2},
    open:{l:"Ouvert",c:T.red,bg:T.redDim},in_progress:{l:"En cours",c:T.amber,bg:T.amberDim},
    resolved:{l:"Résolu",c:T.green,bg:T.greenDim},closed:{l:"Fermé",c:T.t3,bg:T.card2},
    actif:{l:"Actif",c:T.green,bg:T.greenDim},
    en_cours:{l:"En cours",c:T.blue,bg:T.blueDim},planifié:{l:"Planifié",c:T.t2,bg:T.card2},
    suspendu:{l:"Suspendu",c:T.amber,bg:T.amberDim},terminé:{l:"Terminé",c:T.green,bg:T.greenDim},
  };
  const v=m[s]??{l:s,c:T.t2,bg:T.card2};
  return <span style={{padding:"2px 8px",borderRadius:3,fontSize:11,fontWeight:600,color:v.c,background:v.bg,letterSpacing:"0.02em"}}>{v.l}</span>;
}

/* ── KPI stat — Swiss Rational style, no decorative circles ─────────── */
function Stat({label,value,sub,c}:{label:string;value:string;sub?:string;c?:string}){
  return(
    <div style={{padding:"20px 22px",borderRight:`1px solid ${T.border}`}}>
      <div style={{fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:8}}>{label}</div>
      <div style={{fontSize:30,fontWeight:700,color:c||T.text,letterSpacing:"-0.03em",lineHeight:1,fontFamily:T.mono,fontVariantNumeric:"tabular-nums"}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:T.t3,marginTop:6,letterSpacing:"0.01em"}}>{sub}</div>}
    </div>
  );
}

/* ── Progress bar ─────────────────────────────────────────────────────── */
function ProgressBar({v,c="blue"}:{v:number;c?:"blue"|"green"|"amber"|"red"}){
  const col=c==="green"?T.green:c==="amber"?T.amber:c==="red"?T.red:T.blue;
  return <div style={{height:2,background:T.border2,borderRadius:1}}><div style={{height:"100%",width:`${v}%`,background:col,borderRadius:1}}/></div>;
}

/* ── Table head ───────────────────────────────────────────────────────── */
function TH({cols}:{cols:string[]}){
  return <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>{cols.map(c=><th key={c} style={{padding:"8px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.09em",whiteSpace:"nowrap"}}>{c}</th>)}</tr></thead>;
}

function Empty({t}:{t:string}){return <div style={{padding:"40px",textAlign:"center",color:T.t3,fontSize:13}}>{t}</div>;}
function Spin(){return <div style={{padding:"28px 20px",display:"flex",flexDirection:"column",gap:8}}>{[80,60,72].map((w,i)=><div key={i} style={{height:11,borderRadius:2,background:T.card3,width:`${w}%`}}/>)}</div>;}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ SHELL                                                                ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
export function DashboardContent(){
  const router=useRouter();
  const sp=useSearchParams();
  const [ok,setOk]=useState(false);
  const [tab,setTab]=useState<Tab>("overview");

  useEffect(()=>{if(document.cookie.includes("segguinee_auth="))setOk(true);else router.push("/login");},[router]);
  useEffect(()=>{const t=sp.get("tab") as Tab;if(t&&TABS.some(x=>x.key===t))setTab(t);},[sp]);

  const go=useCallback((t:Tab)=>{setTab(t);const p=new URLSearchParams(sp.toString());p.set("tab",t);router.push(`?${p}`,{scroll:false});},[router,sp]);
  const out=()=>{document.cookie="segguinee_auth=; path=/; max-age=0";router.push("/login");};
  if(!ok)return null;

  return(
    <div style={{display:"flex",height:"100dvh",background:T.bg,color:T.text,fontFamily:T.font,overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=JetBrains+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select,textarea{font-family:inherit;color-scheme:dark}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${T.blue}!important}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:${T.card3};border-radius:2px}
        table{border-collapse:collapse;width:100%}
        button{transition:opacity 120ms}button:hover{opacity:0.75}
      `}</style>

      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      <nav style={{width:184,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"20px 16px 16px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:12,fontWeight:700,letterSpacing:"0.08em",color:T.text}}>SEGGUINÉE</div>
          <div style={{fontSize:10,color:T.t3,marginTop:3,letterSpacing:"0.06em"}}>PORTAIL OPÉRATEUR</div>
        </div>
        <div style={{flex:1,padding:"6px",overflowY:"auto"}}>
          {TABS.map(t=>{
            const on=tab===t.key;
            return(
              <button key={t.key} onClick={()=>go(t.key)} style={{
                display:"flex",alignItems:"center",width:"100%",padding:"8px 10px",
                background:on?T.card:"none",border:"none",borderRadius:4,cursor:"pointer",
                fontFamily:T.font,fontSize:12,fontWeight:on?600:400,color:on?T.text:T.t2,
                marginBottom:1,textAlign:"left",borderLeft:on?`2px solid ${T.blue}`:"2px solid transparent",
              }}>
                {t.label}
              </button>
            );
          })}
        </div>
        <div style={{padding:"6px",borderTop:`1px solid ${T.border}`}}>
          <button onClick={out} style={{width:"100%",padding:"8px 10px",background:"none",border:"none",cursor:"pointer",fontFamily:T.font,fontSize:11,color:T.t3,textAlign:"left",borderRadius:4}}>
            Déconnexion
          </button>
        </div>
      </nav>

      {/* ── CONTENT ──────────────────────────────────────────────────── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        {/* Header */}
        <div style={{padding:"12px 24px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.surface,flexShrink:0}}>
          <span style={{fontSize:12,fontWeight:600,letterSpacing:"0.01em",color:T.text}}>{TABS.find(t=>t.key===tab)?.label}</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:T.green,display:"inline-block"}}/>
            <span style={{fontSize:11,color:T.t3,fontFamily:T.mono}}>{new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}</span>
          </div>
        </div>
        {/* Command Bar */}
        <CommandBar/>
        {/* Tab content */}
        <div style={{flex:1,overflowY:"auto",padding:"24px"}}>
          {tab==="overview"   && <Overview go={go}/>}
          {tab==="production" && <Production/>}
          {tab==="invoices"   && <Invoices/>}
          {tab==="incidents"  && <Incidents/>}
          {tab==="projets"    && <Projets/>}
          {tab==="agents"     && <Agents/>}
        </div>
      </div>
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ OVERVIEW                                                             ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ COMMAND BAR — Director gives instructions, AI executes              ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
function CommandBar(){
  const [cmd,setCmd]=useState("");
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState<{text:string;status:"done"|"failed"}|null>(null);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [showHistory,setShowHistory]=useState(false);

  const loadTasks=useCallback(async()=>{
    const d=await fetch("/api/command").then(r=>r.json());
    setTasks(d||[]);
  },[]);

  useEffect(()=>{loadTasks();},[loadTasks]);

  const execute=async()=>{
    if(!cmd.trim()||busy)return;
    setBusy(true);setResult(null);
    try{
      const res=await fetch("/api/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command:cmd})});
      const d=await res.json();
      setResult({text:d.result||"Exécuté",status:d.status==="done"?"done":"failed"});
      setCmd("");
      await loadTasks();
    }catch(e:any){
      setResult({text:e.message,status:"failed"});
    }finally{setBusy(false);}
  };

  const suggestions=["Briefing du jour","Envoie les rappels de paiement","Déploie l'équipe à Kaloum","Rapport conseil d'administration","Résume la situation"];

  return(
    <div style={{borderBottom:`1px solid ${T.border}`,background:T.surface,flexShrink:0}}>
      {/* Input row */}
      <div style={{padding:"10px 16px",display:"flex",gap:8,alignItems:"center"}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:busy?T.amber:T.blue,flexShrink:0,boxShadow:busy?`0 0 8px ${T.amber}`:`0 0 6px ${T.blue}`}}/>
        <input
          value={cmd}
          onChange={e=>setCmd(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();execute();}}}
          placeholder="Donnez une instruction... ex: Crée une facture pour Alpha Corp, 200 000 GNF"
          disabled={busy}
          style={{flex:1,background:"transparent",border:"none",color:T.text,fontSize:13,fontFamily:T.font,outline:"none",opacity:busy?.5:1}}
        />
        <button onClick={execute} disabled={busy||!cmd.trim()} style={{padding:"5px 14px",background:T.blue,color:"#fff",border:"none",borderRadius:4,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font,opacity:busy||!cmd.trim()?.4:1,flexShrink:0}}>
          {busy?"...":"Exécuter"}
        </button>
        <button onClick={()=>setShowHistory(!showHistory)} style={{padding:"5px 10px",background:"none",border:`1px solid ${T.border}`,borderRadius:4,fontSize:11,color:T.t3,cursor:"pointer",fontFamily:T.mono,flexShrink:0}}>
          {tasks.length} tâches
        </button>
      </div>

      {/* Result feedback */}
      {result&&(
        <div style={{padding:"6px 36px",fontSize:12,color:result.status==="done"?T.green:T.red,fontFamily:T.mono,borderTop:`1px solid ${T.border}`}}>
          {result.status==="done"?"✓":"✗"} {result.text}
        </div>
      )}

      {/* Quick suggestions */}
      {!cmd&&!busy&&!result&&(
        <div style={{padding:"0 36px 8px",display:"flex",gap:6,flexWrap:"wrap"}}>
          {suggestions.map(s=>(
            <button key={s} onClick={()=>setCmd(s)} style={{padding:"3px 10px",background:"none",border:`1px solid ${T.border}`,borderRadius:3,fontSize:11,color:T.t3,cursor:"pointer",fontFamily:T.font}}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Task history */}
      {showHistory&&tasks.length>0&&(
        <div style={{borderTop:`1px solid ${T.border}`,maxHeight:200,overflowY:"auto"}}>
          {tasks.map(t=>(
            <div key={t.id} style={{padding:"8px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontSize:11,fontFamily:T.mono,color:t.status==="done"?T.green:t.status==="failed"?T.red:t.status==="executing"?T.amber:T.t3,flexShrink:0,paddingTop:1}}>
                {t.status==="done"?"✓":t.status==="failed"?"✗":t.status==="executing"?"⟳":"○"}
              </span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,color:T.text,fontWeight:500}}>{t.command}</div>
                {t.result&&<div style={{fontSize:11,color:T.t2,marginTop:2}}>{t.result}</div>}
              </div>
              <span style={{fontSize:10,color:T.t3,fontFamily:T.mono,flexShrink:0}}>{ft(t.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Overview({go}:{go:(t:Tab)=>void}){
  const [d,setD]=useState<{production:ProductionEntry[];invoices:Invoice[];incidents:Incident[];agents:Agent[];projets:Projet[];stats:{messages_today:number;total_conversations:number}}|null>(null);

  useEffect(()=>{
    Promise.all([
      fetch("/api/data/production").then(r=>r.json()),
      fetch("/api/data/invoices?status=all").then(r=>r.json()),
      fetch("/api/data/incidents").then(r=>r.json()),
      fetch("/api/data/agents").then(r=>r.json()),
      fetch("/api/data/projects").then(r=>r.json()),
    ]).then(([prod,inv,inc,ag,proj])=>setD({production:prod||[],invoices:inv||[],incidents:inc||[],agents:ag.logs||[],projets:proj||[],stats:ag.stats||{messages_today:0,total_conversations:0}}));
  },[]);

  if(!d)return <Spin/>;

  const vol=d.production.reduce((s,e)=>s+e.volume_m3,0);
  const coll=d.invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+i.amount_gnf,0);
  const pend=d.invoices.filter(i=>i.status==="pending").reduce((s,i)=>s+i.amount_gnf,0);
  const openInc=d.incidents.filter(i=>i.status==="open"||i.status==="in_progress").length;
  const activeProj=d.projets.filter(p=>p.statut==="en_cours").length;
  const overdue=d.invoices.filter(i=>i.status==="overdue").length;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* KPI strip — no cards, just a clean bordered row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <Stat label="Production m³" value={vol.toLocaleString("fr-FR")} sub={`${d.production.length} relevés`} c={T.blue}/>
        <Stat label="Collecté GNF" value={`${(coll/1000000).toFixed(1)}M`} sub={`${d.invoices.filter(i=>i.status==="paid").length} payées`} c={T.green}/>
        <Stat label="En attente GNF" value={`${(pend/1000000).toFixed(1)}M`} sub={overdue>0?`${overdue} en retard`:undefined} c={overdue>0?T.red:T.amber}/>
        <Stat label="Incidents" value={String(openInc)} sub="actifs" c={openInc>0?T.red:T.green}/>
        <Stat label="Projets actifs" value={String(activeProj)} sub={`${d.projets.length} total`} c={T.blue}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:16}}>
        {/* Agent feed */}
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.09em"}}>Activité agents</span>
            <span style={{fontSize:11,color:T.t3,fontFamily:T.mono}}>{d.stats.messages_today} msg · {d.stats.total_conversations} conv.</span>
          </div>
          {d.agents.length===0?<Empty t="Aucune activité"/>:d.agents.slice(0,7).map(a=>(
            <div key={a.id} style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10}}>
              <span style={{fontSize:17,flexShrink:0,paddingTop:1}}>{a.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:600,color:T.text}}>{a.agent}</span>
                  <Pill s={a.statut}/>
                  <span style={{marginLeft:"auto",fontSize:10,color:T.t3,fontFamily:T.mono,flexShrink:0}}>{ft(a.heure_execution)}</span>
                </div>
                <div style={{fontSize:12,color:T.t2,lineHeight:1.55}}>{a.insight}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Right column */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Actions */}
          <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`}}>
              <span style={{fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.09em"}}>Actions rapides</span>
            </div>
            <div style={{padding:6,display:"flex",flexDirection:"column",gap:3}}>
              {([{l:"+ Ajouter relevé",t:"production"as Tab},{l:"+ Nouvelle facture",t:"invoices"as Tab},{l:"+ Signaler incident",t:"incidents"as Tab},{l:"+ Nouveau projet",t:"projets"as Tab}] as const).map(a=>(
                <button key={a.t} onClick={()=>go(a.t as Tab)} style={{padding:"8px 12px",background:"none",border:`1px solid ${T.border}`,borderRadius:4,color:T.t2,cursor:"pointer",fontFamily:T.font,fontSize:12,textAlign:"left",width:"100%"}}>
                  {a.l}
                </button>
              ))}
            </div>
          </div>

          {/* Open incidents */}
          {openInc>0&&(
            <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:6,alignItems:"center"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:T.red,display:"inline-block",flexShrink:0}}/>
                <span style={{fontSize:10,fontWeight:700,color:T.red,textTransform:"uppercase",letterSpacing:"0.09em"}}>{openInc} incident{openInc>1?"s":""} ouvert{openInc>1?"s":""}</span>
              </div>
              {d.incidents.filter(i=>i.status==="open").slice(0,3).map(i=>(
                <div key={i.id} style={{padding:"8px 14px",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{fontSize:12,fontWeight:500,color:T.text}}>{i.type} · {i.zone}</div>
                  <div style={{fontSize:10,color:T.t3,marginTop:2,fontFamily:T.mono}}>{i.station} — {ft(i.created_at)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Active projects */}
          {d.projets.filter(p=>p.statut==="en_cours").slice(0,2).map(p=>{
            const pct=fp(p.depense_gnf,p.budget_gnf);
            return(
              <div key={p.id} style={{border:`1px solid ${T.border}`,borderRadius:8,padding:"14px",background:T.card}}>
                <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:3}}>{p.nom}</div>
                <div style={{fontSize:10,color:T.t3,marginBottom:10,fontFamily:T.mono}}>{p.zone} · {fd(p.date_fin)}</div>
                <ProgressBar v={pct} c={pct>85?"red":pct>60?"amber":"blue"}/>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                  <span style={{fontSize:10,color:T.t3}}>{pct}% consommé</span>
                  <span style={{fontSize:10,color:T.t3,fontFamily:T.mono}}>{(p.depense_gnf/1e6).toFixed(1)}M/{(p.budget_gnf/1e6).toFixed(1)}M</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent invoices */}
      {d.invoices.length>0&&(
        <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.09em"}}>Dernières factures</span>
            <button onClick={()=>go("invoices")} style={{fontSize:11,color:T.blue,background:"none",border:"none",cursor:"pointer",fontFamily:T.font}}>Voir tout</button>
          </div>
          <table>
            <TH cols={["Réf","Client","Montant","Échéance","Statut"]}/>
            <tbody>{d.invoices.slice(0,5).map((r,i)=>(
              <tr key={r.id} style={{borderBottom:i<4?`1px solid ${T.border}`:"none"}}>
                <td style={{padding:"10px 16px",fontSize:10,color:T.t3,fontFamily:T.mono}}>{r.reference}</td>
                <td style={{padding:"10px 16px",fontSize:12,fontWeight:500,color:T.text}}>{r.customer_name||"—"}</td>
                <td style={{padding:"10px 16px",fontSize:12,fontWeight:700,color:T.text,fontFamily:T.mono,fontVariantNumeric:"tabular-nums"}}>{fg(r.amount_gnf)}</td>
                <td style={{padding:"10px 16px",fontSize:11,color:T.t2,fontFamily:T.mono}}>{fd(r.due_date)}</td>
                <td style={{padding:"10px 16px"}}><Pill s={r.status}/></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ PRODUCTION                                                           ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
function Production(){
  const [rows,setRows]=useState<ProductionEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [f,setF]=useState({volume_m3:"",station:"",zone:ZONES[0],recorded_by:""});
  const load=useCallback(async()=>{const d=await fetch("/api/data/production").then(r=>r.json());setRows(d||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const sub=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);const r=await fetch("/api/data/production",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...f,volume_m3:Number(f.volume_m3)})});if(r.ok){setF({volume_m3:"",station:"",zone:ZONES[0],recorded_by:""});setOpen(false);await load();}setBusy(false);};
  const total=rows.reduce((s,e)=>s+e.volume_m3,0);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <Stat label="Volume total" value={`${total.toLocaleString("fr-FR")} m³`} c={T.blue}/>
        <Stat label="Relevés" value={String(rows.length)} c={T.t2}/>
        <Stat label="Zones actives" value={String(new Set(rows.map(r=>r.zone)).size)} c={T.green}/>
      </div>
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.09em"}}>Relevés</span>
          <Btn ch={open?"Fermer":"+ Ajouter relevé"} onClick={()=>setOpen(!open)}/>
        </div>
        {open&&(
          <form onSubmit={sub} style={{padding:16,borderBottom:`1px solid ${T.border}`,background:T.card2}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
              <div><label style={lbl}>Volume m³</label><input type="number" step="0.01" required value={f.volume_m3} onChange={e=>setF(x=>({...x,volume_m3:e.target.value}))} style={inp} placeholder="0.00"/></div>
              <div><label style={lbl}>Station</label><input required value={f.station} onChange={e=>setF(x=>({...x,station:e.target.value}))} style={inp} placeholder="Nom"/></div>
              <div><label style={lbl}>Zone</label><select value={f.zone} onChange={e=>setF(x=>({...x,zone:e.target.value}))} style={inp}>{ZONES.map(z=><option key={z}>{z}</option>)}</select></div>
              <div><label style={lbl}>Enregistré par</label><input required value={f.recorded_by} onChange={e=>setF(x=>({...x,recorded_by:e.target.value}))} style={inp} placeholder="Nom"/></div>
            </div>
            <div style={{display:"flex",gap:8}}><Btn ch={busy?"Envoi...":"Enregistrer"} type="submit" dis={busy}/><Btn ch="Annuler" v="ghost" onClick={()=>setOpen(false)}/></div>
          </form>
        )}
        {loading?<Spin/>:rows.length===0?<Empty t="Aucun relevé"/>:(
          <table>
            <TH cols={["Date","Volume m³","Station","Zone","Par"]}/>
            <tbody>{rows.map((r,i)=><tr key={r.id} style={{borderBottom:i<rows.length-1?`1px solid ${T.border}`:"none"}}>
              <td style={{padding:"10px 16px",fontSize:11,color:T.t2,fontFamily:T.mono}}>{fd(r.recorded_at)}</td>
              <td style={{padding:"10px 16px",fontSize:13,fontWeight:700,color:T.text,fontFamily:T.mono,fontVariantNumeric:"tabular-nums"}}>{r.volume_m3.toLocaleString("fr-FR")}</td>
              <td style={{padding:"10px 16px",fontSize:12,color:T.text}}>{r.station}</td>
              <td style={{padding:"10px 16px",fontSize:11,color:T.t2}}>{r.zone}</td>
              <td style={{padding:"10px 16px",fontSize:11,color:T.t3}}>{r.recorded_by}</td>
            </tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ INVOICES                                                             ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
function Invoices(){
  const [rows,setRows]=useState<Invoice[]>([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState<"all"|"pending"|"paid"|"overdue">("all");
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [toast,setToast]=useState("");
  const [f,setF]=useState({customer_name:"",customer_phone:"",amount_gnf:"",description:"",due_date:""});
  const load=useCallback(async()=>{const d=await fetch("/api/data/invoices?status=all").then(r=>r.json());setRows(d||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const sub=async(e:React.FormEvent)=>{
    e.preventDefault();setBusy(true);
    const r=await fetch("/api/data/invoices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...f,amount_gnf:Number(f.amount_gnf)})});
    if(r.ok){const d=await r.json();setToast(`✓ ${d.reference} créée — WhatsApp envoyé`);setF({customer_name:"",customer_phone:"",amount_gnf:"",description:"",due_date:""});setOpen(false);await load();setTimeout(()=>setToast(""),5000);}
    setBusy(false);
  };
  const shown=filter==="all"?rows:rows.filter(r=>r.status===filter);
  const pend=rows.filter(r=>r.status==="pending").reduce((s,r)=>s+r.amount_gnf,0);
  const paid=rows.filter(r=>r.status==="paid").reduce((s,r)=>s+r.amount_gnf,0);
  const ov=rows.filter(r=>r.status==="overdue").length;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <Stat label="En attente" value={`${(pend/1e6).toFixed(1)}M GNF`} sub={`${rows.filter(r=>r.status==="pending").length} factures`} c={T.amber}/>
        <Stat label="Collecté" value={`${(paid/1e6).toFixed(1)}M GNF`} sub={`${rows.filter(r=>r.status==="paid").length} payées`} c={T.green}/>
        <Stat label="En retard" value={String(ov)} sub={ov>0?"Action requise":"Aucun"} c={ov>0?T.red:T.green}/>
      </div>
      {toast&&<div style={{padding:"9px 14px",background:T.greenDim,border:`1px solid ${T.green}40`,borderRadius:5,color:T.green,fontSize:12,fontFamily:T.mono}}>{toast}</div>}
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1,display:"flex",gap:4}}>
            {(["all","pending","paid","overdue"] as const).map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{padding:"5px 10px",borderRadius:4,fontSize:11,fontWeight:500,cursor:"pointer",fontFamily:T.font,border:`1px solid ${filter===s?T.blue:T.border}`,background:filter===s?T.blueDim:"none",color:filter===s?T.blue:T.t2}}>
                {s==="all"?"Toutes":s==="pending"?"En attente":s==="paid"?"Payées":"En retard"}
                {s!=="all"&&<span style={{marginLeft:5,opacity:.6,fontFamily:T.mono}}>{rows.filter(r=>r.status===s).length}</span>}
              </button>
            ))}
          </div>
          <Btn ch={open?"Fermer":"+ Nouvelle facture"} onClick={()=>setOpen(!open)}/>
        </div>
        {open&&(
          <form onSubmit={sub} style={{padding:16,borderBottom:`1px solid ${T.border}`,background:T.card2}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
              <div><label style={lbl}>Nom du client</label><input required value={f.customer_name} onChange={e=>setF(x=>({...x,customer_name:e.target.value}))} style={inp} placeholder="Nom complet"/></div>
              <div><label style={lbl}>Téléphone WhatsApp</label><input type="tel" required value={f.customer_phone} onChange={e=>setF(x=>({...x,customer_phone:e.target.value}))} style={inp} placeholder="+224 xxx xxx xxx"/></div>
              <div><label style={lbl}>Montant (GNF)</label><input type="number" required value={f.amount_gnf} onChange={e=>setF(x=>({...x,amount_gnf:e.target.value}))} style={inp} placeholder="0"/></div>
              <div><label style={lbl}>Description</label><input value={f.description} onChange={e=>setF(x=>({...x,description:e.target.value}))} style={inp} placeholder="Objet de la facture"/></div>
              <div><label style={lbl}>Échéance</label><input type="date" required value={f.due_date} onChange={e=>setF(x=>({...x,due_date:e.target.value}))} style={inp}/></div>
            </div>
            <div style={{fontSize:10,color:T.t3,marginBottom:10,letterSpacing:"0.02em"}}>Lien de signature envoyé automatiquement par WhatsApp</div>
            <div style={{display:"flex",gap:8}}><Btn ch={busy?"Création...":"Créer et envoyer"} type="submit" dis={busy}/><Btn ch="Annuler" v="ghost" onClick={()=>setOpen(false)}/></div>
          </form>
        )}
        {loading?<Spin/>:shown.length===0?<Empty t="Aucune facture"/>:(
          <table>
            <TH cols={["Référence","Client","Montant","Échéance","Statut"]}/>
            <tbody>{shown.map((r,i)=><tr key={r.id} style={{borderBottom:i<shown.length-1?`1px solid ${T.border}`:"none"}}>
              <td style={{padding:"10px 16px",fontSize:10,color:T.t3,fontFamily:T.mono}}>{r.reference}</td>
              <td style={{padding:"10px 16px"}}><div style={{fontSize:12,fontWeight:500,color:T.text}}>{r.customer_name||"—"}</div><div style={{fontSize:10,color:T.t3,marginTop:1}}>{r.customer_phone}</div></td>
              <td style={{padding:"10px 16px",fontSize:12,fontWeight:700,color:T.text,fontFamily:T.mono,fontVariantNumeric:"tabular-nums"}}>{fg(r.amount_gnf)}</td>
              <td style={{padding:"10px 16px",fontSize:11,color:T.t2,fontFamily:T.mono}}>{fd(r.due_date)}</td>
              <td style={{padding:"10px 16px"}}><Pill s={r.status}/></td>
            </tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ INCIDENTS                                                            ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
function Incidents(){
  const [rows,setRows]=useState<Incident[]>([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [f,setF]=useState({type:INC_TYPES[0],description:"",zone:ZONES[0],station:"",reported_by:""});
  const load=useCallback(async()=>{const d=await fetch("/api/data/incidents").then(r=>r.json());setRows(d||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const sub=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);const r=await fetch("/api/data/incidents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});if(r.ok){setF({type:INC_TYPES[0],description:"",zone:ZONES[0],station:"",reported_by:""});setOpen(false);await load();}setBusy(false);};
  const openN=rows.filter(r=>r.status==="open").length;
  const inP=rows.filter(r=>r.status==="in_progress").length;
  const res=rows.filter(r=>r.status==="resolved").length;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <Stat label="Ouverts" value={String(openN)} c={openN>0?T.red:T.green}/>
        <Stat label="En cours" value={String(inP)} c={inP>0?T.amber:T.t2}/>
        <Stat label="Résolus" value={String(res)} c={T.green}/>
      </div>
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.09em"}}>Suivi des incidents</span>
          <Btn ch={open?"Fermer":"+ Signaler incident"} v="red" onClick={()=>setOpen(!open)}/>
        </div>
        {open&&(
          <form onSubmit={sub} style={{padding:16,borderBottom:`1px solid ${T.border}`,background:T.card2}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:10}}>
              <div><label style={lbl}>Type</label><select value={f.type} onChange={e=>setF(x=>({...x,type:e.target.value}))} style={inp}>{INC_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div>
              <div><label style={lbl}>Zone</label><select value={f.zone} onChange={e=>setF(x=>({...x,zone:e.target.value}))} style={inp}>{ZONES.map(z=><option key={z}>{z}</option>)}</select></div>
              <div><label style={lbl}>Station</label><input required value={f.station} onChange={e=>setF(x=>({...x,station:e.target.value}))} style={inp} placeholder="Station"/></div>
              <div><label style={lbl}>Signalé par</label><input required value={f.reported_by} onChange={e=>setF(x=>({...x,reported_by:e.target.value}))} style={inp} placeholder="Nom"/></div>
              <div style={{gridColumn:"span 4"}}><label style={lbl}>Description</label><textarea required value={f.description} onChange={e=>setF(x=>({...x,description:e.target.value}))} style={{...inp,minHeight:64,resize:"vertical" as const}} placeholder="Détail de l'incident..."/></div>
            </div>
            <div style={{display:"flex",gap:8}}><Btn ch={busy?"Envoi...":"Signaler"} type="submit" v="red" dis={busy}/><Btn ch="Annuler" v="ghost" onClick={()=>setOpen(false)}/></div>
          </form>
        )}
        {loading?<Spin/>:rows.length===0?<Empty t="Aucun incident"/>:(
          <div>{rows.map((r,i)=>(
            <div key={r.id} style={{padding:"13px 16px",borderBottom:i<rows.length-1?`1px solid ${T.border}`:"none"}}>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                <span style={{fontSize:12,fontWeight:700,color:T.text,textTransform:"uppercase",letterSpacing:"0.04em"}}>{r.type}</span>
                <span style={{fontSize:11,color:T.t3}}>·</span>
                <span style={{fontSize:12,color:T.t2}}>{r.zone} — {r.station}</span>
                <Pill s={r.status}/>
              </div>
              <div style={{fontSize:12,color:T.t2,lineHeight:1.55,marginBottom:4}}>{r.description}</div>
              <div style={{fontSize:10,color:T.t3,fontFamily:T.mono}}>{ft(r.created_at)} · {r.reported_by}</div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ PROJETS                                                              ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
function Projets(){
  const [rows,setRows]=useState<Projet[]>([]);
  const [loading,setLoading]=useState(true);
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [f,setF]=useState({nom:"",type:PROJ_TYPES[0],zone:ZONES[0],statut:"planifié",budget_gnf:"",depense_gnf:"0",date_debut:"",date_fin:"",chef_projet:"",description:""});
  const load=useCallback(async()=>{const d=await fetch("/api/data/projects").then(r=>r.json());setRows(d||[]);setLoading(false);},[]);
  useEffect(()=>{load();},[load]);
  const sub=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);const r=await fetch("/api/data/projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...f,budget_gnf:Number(f.budget_gnf),depense_gnf:Number(f.depense_gnf)})});if(r.ok){setF({nom:"",type:PROJ_TYPES[0],zone:ZONES[0],statut:"planifié",budget_gnf:"",depense_gnf:"0",date_debut:"",date_fin:"",chef_projet:"",description:""});setOpen(false);await load();}setBusy(false);};
  const totBudget=rows.reduce((s,r)=>s+r.budget_gnf,0);
  const totSpent=rows.reduce((s,r)=>s+r.depense_gnf,0);
  const active=rows.filter(r=>r.statut==="en_cours").length;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <Stat label="Projets actifs" value={String(active)} c={T.blue}/>
        <Stat label="Budget total" value={`${(totBudget/1e6).toFixed(0)}M`} sub="GNF" c={T.t2}/>
        <Stat label="Dépensé" value={`${(totSpent/1e6).toFixed(0)}M`} sub={`${totBudget>0?Math.round((totSpent/totBudget)*100):0}% du budget`} c={T.amber}/>
        <Stat label="Disponible" value={`${((totBudget-totSpent)/1e6).toFixed(0)}M`} sub="GNF restant" c={T.green}/>
      </div>
      <div style={{border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.09em"}}>Tous les projets</span>
          <Btn ch={open?"Fermer":"+ Nouveau projet"} onClick={()=>setOpen(!open)}/>
        </div>
        {open&&(
          <form onSubmit={sub} style={{padding:16,borderBottom:`1px solid ${T.border}`,background:T.card2}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:10}}>
              <div style={{gridColumn:"span 2"}}><label style={lbl}>Nom du projet</label><input required value={f.nom} onChange={e=>setF(x=>({...x,nom:e.target.value}))} style={inp} placeholder="Ex: Extension réseau Ratoma Nord"/></div>
              <div><label style={lbl}>Type</label><select value={f.type} onChange={e=>setF(x=>({...x,type:e.target.value}))} style={inp}>{PROJ_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div>
              <div><label style={lbl}>Zone</label><select value={f.zone} onChange={e=>setF(x=>({...x,zone:e.target.value}))} style={inp}>{ZONES.map(z=><option key={z}>{z}</option>)}</select></div>
              <div><label style={lbl}>Statut</label><select value={f.statut} onChange={e=>setF(x=>({...x,statut:e.target.value}))} style={inp}>{PROJ_STATUS.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1).replace("_"," ")}</option>)}</select></div>
              <div><label style={lbl}>Chef de projet</label><input required value={f.chef_projet} onChange={e=>setF(x=>({...x,chef_projet:e.target.value}))} style={inp} placeholder="Nom"/></div>
              <div><label style={lbl}>Budget (GNF)</label><input type="number" required value={f.budget_gnf} onChange={e=>setF(x=>({...x,budget_gnf:e.target.value}))} style={inp} placeholder="0"/></div>
              <div><label style={lbl}>Dépensé (GNF)</label><input type="number" value={f.depense_gnf} onChange={e=>setF(x=>({...x,depense_gnf:e.target.value}))} style={inp} placeholder="0"/></div>
              <div><label style={lbl}>Début</label><input type="date" required value={f.date_debut} onChange={e=>setF(x=>({...x,date_debut:e.target.value}))} style={inp}/></div>
              <div><label style={lbl}>Fin prévue</label><input type="date" required value={f.date_fin} onChange={e=>setF(x=>({...x,date_fin:e.target.value}))} style={inp}/></div>
              <div style={{gridColumn:"span 3"}}><label style={lbl}>Description</label><textarea value={f.description} onChange={e=>setF(x=>({...x,description:e.target.value}))} style={{...inp,minHeight:56,resize:"vertical" as const}} placeholder="Objectifs et portée..."/></div>
            </div>
            <div style={{display:"flex",gap:8}}><Btn ch={busy?"Création...":"Créer le projet"} type="submit" dis={busy}/><Btn ch="Annuler" v="ghost" onClick={()=>setOpen(false)}/></div>
          </form>
        )}
        {loading?<Spin/>:rows.length===0?<Empty t="Aucun projet enregistré"/>:(
          <div>{rows.map((r,i)=>{
            const p=fp(r.depense_gnf,r.budget_gnf);
            return(
              <div key={r.id} style={{padding:"14px 16px",borderBottom:i<rows.length-1?`1px solid ${T.border}`:"none"}}>
                <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:600,color:T.text}}>{r.nom}</span>
                      <Pill s={r.statut}/>
                      <span style={{fontSize:10,color:T.t3}}>{r.type}</span>
                    </div>
                    <div style={{fontSize:11,color:T.t2,marginBottom:10,fontFamily:T.mono}}>
                      {r.zone} · Chef: {r.chef_projet} · {fd(r.date_debut)} → {fd(r.date_fin)}
                    </div>
                    <ProgressBar v={p} c={p>90?"red":p>70?"amber":"blue"}/>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                      <span style={{fontSize:10,color:T.t3}}>{p}% du budget consommé</span>
                      <span style={{fontSize:10,color:T.t3,fontFamily:T.mono,fontVariantNumeric:"tabular-nums"}}>{fg(r.depense_gnf)} / {fg(r.budget_gnf)}</span>
                    </div>
                    {r.description&&<div style={{fontSize:11,color:T.t3,marginTop:8}}>{r.description}</div>}
                  </div>
                </div>
              </div>
            );
          })}</div>
        )}
      </div>
    </div>
  );
}

/* ╔══════════════════════════════════════════════════════════════════════╗
   ║ AGENTS                                                               ║
   ╚══════════════════════════════════════════════════════════════════════╝ */
// Static capability map per agent_id — defines function, capabilities, and suggested prompts
const AGENT_META: Record<string, { role: string; caps: string[]; prompts: string[]; color: string }> = {
  recouvrement: { role: "Gestion des créances et recouvrement", caps: ["Rappels WhatsApp", "Suivi paiements", "Liens de signature", "Alertes retards"], prompts: ["Envoie les rappels de paiement", "Envoie le lien de signature à [client]", "Combien de GNF en retard?"], color: T.amber },
  croissance:   { role: "Développement commercial et expansion", caps: ["Analyse marchés", "Appels d'offres", "Nouveaux territoires", "ROI projections"], prompts: ["Quels sont les marchés à fort potentiel?", "Statut appel d'offres SONAGUI", "Analyse la zone Coyah"], color: T.blue },
  briefing:     { role: "Coordination et dispatches urgents", caps: ["Briefing WhatsApp 7h", "Ordres de mission", "Escalades urgentes", "Résumés exécutifs"], prompts: ["Briefing du jour", "Déploie l'équipe à Kaloum", "Envoie un ordre de mission à [zone]"], color: T.green },
  analyste:     { role: "Intelligence opérationnelle et rapports", caps: ["KPIs production", "Rapports PDF", "Graphiques par zone", "Alertes churn"], prompts: ["Résume la situation", "Quel est le volume de production?", "Rapport mensuel pour le conseil"], color: T.blue },
  finance:      { role: "Contrôle financier et rapports conseil", caps: ["Suivi budget projets", "Rapport CA", "Alertes financières", "Tenders et contrats"], prompts: ["Rapport conseil d'administration", "Statut budget projets actifs", "Alertes financières du jour"], color: T.amber },
  terrain:      { role: "Coordination des équipes terrain", caps: ["Dispatch équipes", "Suivi interventions", "Coordination zones", "Ordres de mission"], prompts: ["Déploie l'équipe à Kaloum station 3", "Statut interventions en cours", "Mission urgente à [zone]"], color: T.red },
  clientele:    { role: "Relations clients et portail", caps: ["Portail client", "Demandes entrantes", "Liens factures", "Satisfaction client"], prompts: ["Envoie le lien de signature à [client]", "Statut des demandes clients", "Envoie une communication aux clients"], color: T.green },
};

interface ChatMessage { role: "user"|"assistant"; content: string; }

function AgentChat({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const meta = AGENT_META[agent.agent_id] || AGENT_META["analyste"];
  const [msgs, setMsgs] = useState<ChatMessage[]>([
    { role: "assistant", content: `Bonjour. Je suis votre ${agent.agent}. ${meta.role}.\n\nJe peux vous aider avec: ${meta.caps.join(", ")}.\n\nQue souhaitez-vous faire?` }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useCallback((el: HTMLDivElement | null) => { if (el) el.scrollIntoView({ behavior: "smooth" }); }, []);

  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg = input.trim();
    setInput("");
    setMsgs(m => [...m, { role: "user", content: userMsg }]);
    setBusy(true);
    try {
      const res = await fetch("/api/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: userMsg }) });
      const d = await res.json();
      setMsgs(m => [...m, { role: "assistant", content: d.result || "Commande exécutée." }]);
    } catch {
      setMsgs(m => [...m, { role: "assistant", content: "Erreur de connexion. Réessayez." }]);
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 24 }}>
      <div style={{ width: 420, height: 560, background: T.surface, border: `1px solid ${T.border2}`, borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 10, alignItems: "center", background: T.card }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: `${meta.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{agent.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{agent.agent}</div>
            <div style={{ fontSize: 10, color: T.t3, letterSpacing: "0.04em" }}>{meta.role}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.t3, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "80%", padding: "9px 13px", borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", background: m.role === "user" ? T.blue : T.card2, color: T.text, fontSize: 12, lineHeight: 1.55, fontFamily: T.font, whiteSpace: "pre-wrap" }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{ padding: "9px 13px", borderRadius: "12px 12px 12px 3px", background: T.card2, color: T.t2, fontSize: 12 }}>En cours...</div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        {/* Quick prompts */}
        <div style={{ padding: "6px 12px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 5, flexWrap: "wrap" }}>
          {meta.prompts.map(p => (
            <button key={p} onClick={() => setInput(p)} style={{ padding: "3px 9px", background: "none", border: `1px solid ${T.border}`, borderRadius: 3, fontSize: 10, color: T.t2, cursor: "pointer", fontFamily: T.font }}>{p}</button>
          ))}
        </div>
        {/* Input */}
        <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }} placeholder={`Instruction pour ${agent.agent}...`} disabled={busy} style={{ flex: 1, background: T.card3, border: `1px solid ${T.border2}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 12, fontFamily: T.font, outline: "none" }} />
          <button onClick={send} disabled={busy || !input.trim()} style={{ padding: "8px 14px", background: T.blue, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font, opacity: busy || !input.trim() ? 0.4 : 1 }}>
            {busy ? "..." : "→"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Agents(){
  const [agents,setAgents]=useState<Agent[]>([]);
  const [stats,setStats]=useState({messages_today:0,total_conversations:0});
  const [loading,setLoading]=useState(true);
  const [chatAgent,setChatAgent]=useState<Agent|null>(null);

  useEffect(()=>{fetch("/api/data/agents").then(r=>r.json()).then(d=>{setAgents(d.logs||[]);setStats(d.stats||{messages_today:0,total_conversations:0});setLoading(false);});},[]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      {chatAgent && <AgentChat agent={chatAgent} onClose={()=>setChatAgent(null)}/>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",border:`1px solid ${T.border}`,borderRadius:8,overflow:"hidden",background:T.card}}>
        <Stat label="Agents actifs" value={String(agents.filter(a=>a.statut==="active"||a.statut==="actif").length)} c={T.green}/>
        <Stat label="Messages aujourd'hui" value={String(stats.messages_today)} c={T.blue}/>
        <Stat label="Conversations" value={String(stats.total_conversations)} c={T.t2}/>
      </div>

      {loading?<Spin/>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:14}}>
          {agents.length===0?<Empty t="Aucun agent"/>:agents.map(a=>{
            const meta=AGENT_META[a.agent_id]||{role:"Assistant opérationnel",caps:["Analyse","Rapports","Alertes","Coordination"],prompts:["Que peux-tu faire?"],color:T.blue};
            return(
              <div key={a.id} style={{border:`1px solid ${T.border}`,borderRadius:10,background:T.card,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                {/* Card header */}
                <div style={{padding:"14px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{width:42,height:42,borderRadius:9,background:`${meta.color}12`,border:`1px solid ${meta.color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{a.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text,letterSpacing:"-0.01em"}}>{a.agent}</div>
                    <div style={{fontSize:11,color:T.t3,marginTop:2,lineHeight:1.4}}>{meta.role}</div>
                  </div>
                  <Pill s={a.statut==="active"?"actif":a.statut}/>
                </div>

                {/* Capabilities */}
                <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",flexWrap:"wrap",gap:5}}>
                  {meta.caps.map(c=>(
                    <span key={c} style={{padding:"3px 8px",background:`${meta.color}0a`,border:`1px solid ${meta.color}20`,borderRadius:3,fontSize:10,fontWeight:600,color:meta.color,letterSpacing:"0.03em"}}>{c}</span>
                  ))}
                </div>

                {/* Last insight */}
                <div style={{padding:"10px 16px",flex:1}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.t3,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:5}}>Dernière action</div>
                  <div style={{fontSize:12,color:T.t2,lineHeight:1.55}}>{a.insight}</div>
                  <div style={{fontSize:10,color:T.t3,marginTop:6,fontFamily:T.mono}}>{ft(a.heure_execution)}</div>
                </div>

                {/* Actions */}
                <div style={{padding:"10px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:8}}>
                  <button onClick={()=>setChatAgent(a)} style={{flex:1,padding:"8px 0",background:T.blue,border:"none",borderRadius:6,color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:T.font}}>
                    Ouvrir conversation
                  </button>
                  <button onClick={()=>setChatAgent(a)} title={`Exemples:\n${meta.prompts.join("\n")}`} style={{padding:"8px 10px",background:T.card2,border:`1px solid ${T.border}`,borderRadius:6,color:T.t2,fontSize:12,cursor:"pointer",fontFamily:T.font}}>
                    ?
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
