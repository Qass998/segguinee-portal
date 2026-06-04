"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ProductionEntry {
  id: string; volume_m3: number; station: string;
  zone: string; recorded_by: string; recorded_at: string;
}
interface Invoice {
  id: string; customer_phone: string; customer_name: string;
  amount_gnf: number; reference: string; description: string; due_date: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  signed: boolean; paid_at: string | null; created_at: string;
}
interface Incident {
  id: string; type: string; description: string;
  zone: string; station: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  reported_by: string; created_at: string;
}
interface Agent {
  id: string; agent: string; icon: string; statut: string;
  insight: string; derniere_execution: string; heure_execution: string;
}

type Tab = "overview" | "production" | "invoices" | "incidents" | "agents";

const T = {
  bg:"#070C18", surface:"#0D1424", surface2:"#131D30", surface3:"#1A2540",
  border:"#1E2D45", border2:"#253452", accent:"#3B82F6", accentDim:"rgba(59,130,246,0.10)",
  text:"#EFF6FF", text2:"#93A8C4", text3:"#4A6180",
  success:"#10B981", successDim:"rgba(16,185,129,0.10)",
  warning:"#F59E0B", warningDim:"rgba(245,158,11,0.10)",
  danger:"#EF4444", dangerDim:"rgba(239,68,68,0.10)",
  font:"'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

const ZONES = ["Kaloum","Dixinn","Matam","Ratoma","Matoto","Coyah","Dubréka","Kindia"];
const INCIDENT_TYPES = ["rupture","panne","contamination","fuite","autre"];
const TABS: {key:Tab;label:string;icon:string}[] = [
  {key:"overview",   label:"Vue d'ensemble", icon:"⬡"},
  {key:"production", label:"Production",     icon:"◈"},
  {key:"invoices",   label:"Factures",       icon:"◻"},
  {key:"incidents",  label:"Incidents",      icon:"△"},
  {key:"agents",     label:"Agents IA",      icon:"◎"},
];

function fDate(iso:string){if(!iso)return"—";return new Date(iso).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});}
function fTime(iso:string){if(!iso)return"—";const d=new Date(iso),now=new Date(),diff=now.getTime()-d.getTime(),mins=Math.floor(diff/60000);if(mins<1)return"à l'instant";if(mins<60)return`il y a ${mins}m`;const hrs=Math.floor(mins/60);if(hrs<24)return`il y a ${hrs}h`;return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});}
function fGNF(n:number){return(n||0).toLocaleString("fr-FR")+" GNF";}

const inp:React.CSSProperties={background:T.surface3,border:`1px solid ${T.border2}`,borderRadius:8,padding:"10px 14px",color:T.text,fontSize:13,width:"100%",fontFamily:T.font,outline:"none",boxSizing:"border-box"};
const lbl:React.CSSProperties={fontSize:10,fontWeight:700,color:T.text3,textTransform:"uppercase",letterSpacing:"1px",marginBottom:5,display:"block"};
function B(v:"primary"|"ghost"|"danger"="primary"):React.CSSProperties{
  if(v==="primary")return{padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font,background:T.accent,color:"#fff",border:"none"};
  if(v==="danger") return{padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font,background:T.danger,color:"#fff",border:"none"};
  return{padding:"10px 20px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:T.font,background:"transparent",color:T.text2,border:`1px solid ${T.border2}`};
}

function Badge({status}:{status:string}){
  const m:Record<string,{l:string;c:string;bg:string}>={
    pending:{l:"En attente",c:T.warning,bg:T.warningDim},paid:{l:"Payée",c:T.success,bg:T.successDim},
    overdue:{l:"En retard",c:T.danger,bg:T.dangerDim},cancelled:{l:"Annulée",c:T.text3,bg:T.surface3},
    open:{l:"Ouvert",c:T.danger,bg:T.dangerDim},in_progress:{l:"En cours",c:T.warning,bg:T.warningDim},
    resolved:{l:"Résolu",c:T.success,bg:T.successDim},closed:{l:"Fermé",c:T.text3,bg:T.surface3},
    actif:{l:"Actif",c:T.success,bg:T.successDim},
  };
  const s=m[status]??{l:status,c:T.text2,bg:T.surface3};
  return <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,color:s.c,background:s.bg,border:`1px solid ${s.c}33`,letterSpacing:"0.3px"}}>{s.l}</span>;
}

function KpiCard({label,value,sub,color}:{label:string;value:string;sub?:string;color?:string}){
  return(
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"20px 24px",display:"flex",flexDirection:"column",gap:6,position:"relative",overflow:"hidden"}}>
      <div style={{fontSize:10,fontWeight:700,color:T.text3,textTransform:"uppercase",letterSpacing:"1.2px"}}>{label}</div>
      <div style={{fontSize:26,fontWeight:700,color:color||T.text,lineHeight:1.2,letterSpacing:"-0.5px"}}>{value}</div>
      {sub&&<div style={{fontSize:12,color:T.text3}}>{sub}</div>}
      <div style={{position:"absolute",right:-20,top:-20,width:80,height:80,borderRadius:"50%",background:`${color||T.accent}08`}}/>
    </div>
  );
}
function Empty({msg}:{msg:string}){return <div style={{padding:"48px 24px",textAlign:"center",color:T.text3,fontSize:13}}><div style={{fontSize:28,marginBottom:12,opacity:0.3}}>◌</div>{msg}</div>;}
function Loading(){return <div style={{padding:"32px 20px",display:"flex",flexDirection:"column",gap:12}}>{[100,80,90].map((w,i)=><div key={i} style={{height:14,borderRadius:6,background:T.surface3,width:`${w}%`,opacity:0.5}}/>)}</div>;}

export function DashboardContent(){
  const router=useRouter();
  const searchParams=useSearchParams();
  const [authed,setAuthed]=useState(false);
  const [tab,setTab]=useState<Tab>("overview");

  useEffect(()=>{if(document.cookie.includes("segguinee_auth="))setAuthed(true);else router.push("/login");},[router]);
  useEffect(()=>{const t=searchParams.get("tab") as Tab;if(t&&TABS.some(x=>x.key===t))setTab(t);},[searchParams]);

  const goTab=useCallback((t:Tab)=>{
    setTab(t);
    const p=new URLSearchParams(searchParams.toString());
    p.set("tab",t);
    router.push(`?${p}`,{scroll:false});
  },[router,searchParams]);

  const logout=()=>{document.cookie="segguinee_auth=; path=/; max-age=0";router.push("/login");};
  if(!authed)return null;

  return(
    <div style={{display:"flex",height:"100dvh",background:T.bg,color:T.text,fontFamily:T.font,overflow:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box}input,select,textarea{font-family:inherit}input:focus,select:focus,textarea:focus{outline:none;border-color:${T.accent}!important;box-shadow:0 0 0 3px ${T.accentDim}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${T.border2};border-radius:4px}button:hover{opacity:0.85}`}</style>
      <aside style={{width:224,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"24px 20px 18px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:14,fontWeight:700,color:T.text,letterSpacing:"0.8px"}}>SEGGUINÉE</div>
          <div style={{fontSize:11,color:T.text3,marginTop:3}}>Portail Opérateur</div>
        </div>
        <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
          {TABS.map(t=>{
            const active=tab===t.key;
            return(
              <button key={t.key} onClick={()=>goTab(t.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:"none",borderRadius:8,marginBottom:2,background:active?T.accentDim:"transparent",color:active?T.accent:T.text2,cursor:"pointer",fontFamily:T.font,fontSize:13,fontWeight:active?600:400}}>
                <span style={{fontSize:14,opacity:active?1:0.5}}>{t.icon}</span>
                <span>{t.label}</span>
                {active&&<div style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:T.accent}}/>}
              </button>
            );
          })}
        </nav>
        <div style={{padding:"10px 8px",borderTop:`1px solid ${T.border}`}}>
          <button onClick={logout} style={{width:"100%",padding:"10px 12px",border:"none",borderRadius:8,background:"transparent",color:T.text3,cursor:"pointer",fontFamily:T.font,fontSize:13,textAlign:"left"}}>↩ Déconnexion</button>
        </div>
      </aside>
      <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <div style={{padding:"14px 28px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:T.surface,flexShrink:0}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:T.text}}>{TABS.find(t=>t.key===tab)?.label}</div>
            <div style={{fontSize:11,color:T.text3,marginTop:2}}>{new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:T.success,boxShadow:`0 0 8px ${T.success}`}}/>
            <span style={{fontSize:12,color:T.text3}}>Systèmes actifs</span>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"24px 28px"}}>
          {tab==="overview"   && <OverviewPanel onNav={goTab}/>}
          {tab==="production" && <ProductionPanel/>}
          {tab==="invoices"   && <InvoicesPanel/>}
          {tab==="incidents"  && <IncidentsPanel/>}
          {tab==="agents"     && <AgentsPanel/>}
        </div>
      </main>
    </div>
  );
}

function OverviewPanel({onNav}:{onNav:(t:Tab)=>void}){
  const [d,setD]=useState<{production:ProductionEntry[];invoices:Invoice[];incidents:Incident[];agents:Agent[];stats:{messages_today:number;total_conversations:number}}|null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    Promise.all([
      fetch("/api/data/production").then(r=>r.json()),
      fetch("/api/data/invoices?status=all").then(r=>r.json()),
      fetch("/api/data/incidents").then(r=>r.json()),
      fetch("/api/data/agents").then(r=>r.json()),
    ]).then(([production,invoices,incidents,agentsData])=>{
      setD({production:production||[],invoices:invoices||[],incidents:incidents||[],agents:agentsData.logs||[],stats:agentsData.stats||{messages_today:0,total_conversations:0}});
    }).finally(()=>setLoading(false));
  },[]);

  if(loading)return <Loading/>;
  if(!d)return <Empty msg="Erreur de chargement"/>;

  const totalProd=d.production.reduce((s,e)=>s+e.volume_m3,0);
  const pending=d.invoices.filter(i=>i.status==="pending").reduce((s,i)=>s+i.amount_gnf,0);
  const paid=d.invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+i.amount_gnf,0);
  const openInc=d.incidents.filter(i=>i.status==="open"||i.status==="in_progress").length;
  const overdueInv=d.invoices.filter(i=>i.status==="overdue").length;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:24}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        <KpiCard label="Production totale" value={`${totalProd.toLocaleString("fr-FR")} m³`} sub={`${d.production.length} relevés`} color={T.accent}/>
        <KpiCard label="Collecté" value={fGNF(paid)} sub={`${d.invoices.filter(i=>i.status==="paid").length} factures`} color={T.success}/>
        <KpiCard label="En attente" value={fGNF(pending)} sub={overdueInv>0?`${overdueInv} en retard`:"Aucun retard"} color={overdueInv>0?T.danger:T.warning}/>
        <KpiCard label="Incidents actifs" value={String(openInc)} sub={`${d.incidents.length} total`} color={openInc>0?T.danger:T.success}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:18}}>
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:11,fontWeight:700,color:T.text2,textTransform:"uppercase",letterSpacing:"1px"}}>Activité des agents</div>
            <div style={{fontSize:11,color:T.text3}}>{d.stats.messages_today} msg aujourd'hui</div>
          </div>
          <div style={{maxHeight:340,overflowY:"auto"}}>
            {d.agents.length===0?<Empty msg="Aucune activité récente"/>:d.agents.slice(0,8).map(a=>(
              <div key={a.id} style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:12}}>
                <div style={{fontSize:20,flexShrink:0}}>{a.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:600,color:T.text}}>{a.agent}</span>
                    <Badge status={a.statut}/>
                    <span style={{marginLeft:"auto",fontSize:10,color:T.text3}}>{fTime(a.heure_execution)}</span>
                  </div>
                  <div style={{fontSize:12,color:T.text2,lineHeight:1.5}}>{a.insight}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`}}>
              <div style={{fontSize:11,fontWeight:700,color:T.text2,textTransform:"uppercase",letterSpacing:"1px"}}>Actions rapides</div>
            </div>
            <div style={{padding:10,display:"flex",flexDirection:"column",gap:6}}>
              {([{label:"+ Ajouter relevé de production",tab:"production" as Tab,color:T.accent},{label:"+ Créer et envoyer facture",tab:"invoices" as Tab,color:T.success},{label:"+ Signaler un incident",tab:"incidents" as Tab,color:T.warning}] as const).map(a=>(
                <button key={a.tab} onClick={()=>onNav(a.tab)} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${a.color}25`,background:`${a.color}08`,color:a.color,cursor:"pointer",fontFamily:T.font,fontSize:12,fontWeight:600,textAlign:"left"}}>{a.label}</button>
              ))}
            </div>
          </div>
          {openInc>0&&(
            <div style={{background:T.surface,border:`1px solid ${T.danger}30`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:8,alignItems:"center"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:T.danger,boxShadow:`0 0 6px ${T.danger}`}}/>
                <div style={{fontSize:11,fontWeight:700,color:T.danger,textTransform:"uppercase",letterSpacing:"1px"}}>{openInc} incident(s) ouvert(s)</div>
              </div>
              {d.incidents.filter(i=>i.status==="open").slice(0,3).map(inc=>(
                <div key={inc.id} style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.text}}>{inc.type.toUpperCase()} — {inc.zone}</div>
                  <div style={{fontSize:11,color:T.text3,marginTop:2}}>{inc.station} · {fTime(inc.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {d.invoices.length>0&&(
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:11,fontWeight:700,color:T.text2,textTransform:"uppercase",letterSpacing:"1px"}}>Factures récentes</div>
            <button onClick={()=>onNav("invoices")} style={{fontSize:12,color:T.accent,background:"none",border:"none",cursor:"pointer",fontFamily:T.font}}>Voir tout →</button>
          </div>
          {d.invoices.slice(0,5).map((inv,i)=>(
            <div key={inv.id} style={{padding:"13px 18px",borderBottom:i<4?`1px solid ${T.border}`:"none",display:"flex",alignItems:"center",gap:14}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{inv.customer_name||"—"}</div><div style={{fontSize:11,color:T.text3,marginTop:2}}>{inv.reference} · Échéance {fDate(inv.due_date)}</div></div>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>{fGNF(inv.amount_gnf)}</div>
              <Badge status={inv.status}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductionPanel(){
  const [entries,setEntries]=useState<ProductionEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [form,setForm]=useState({volume_m3:"",station:"",zone:ZONES[0],recorded_by:""});

  const load=useCallback(async()=>{try{const d=await fetch("/api/data/production").then(r=>r.json());setEntries(d||[]);}finally{setLoading(false);}}, []);
  useEffect(()=>{load();},[load]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setSubmitting(true);
    try{const res=await fetch("/api/data/production",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,volume_m3:Number(form.volume_m3)})});if(res.ok){setForm({volume_m3:"",station:"",zone:ZONES[0],recorded_by:""});setShowForm(false);await load();}}
    finally{setSubmitting(false);}
  };
  const total=entries.reduce((s,e)=>s+e.volume_m3,0);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        <KpiCard label="Volume total" value={`${total.toLocaleString("fr-FR")} m³`} color={T.accent}/>
        <KpiCard label="Relevés" value={String(entries.length)} color={T.text2}/>
        <KpiCard label="Zones actives" value={String(new Set(entries.map(e=>e.zone)).size)} color={T.success}/>
      </div>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.text2,textTransform:"uppercase",letterSpacing:"1px"}}>Relevés de production</div>
          <button onClick={()=>setShowForm(!showForm)} style={B("primary")}>{showForm?"Fermer":"+ Ajouter relevé"}</button>
        </div>
        {showForm&&(
          <form onSubmit={submit} style={{padding:20,borderBottom:`1px solid ${T.border}`,background:T.surface2}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:14}}>
              <div><label style={lbl}>Volume m³</label><input type="number" step="0.01" required value={form.volume_m3} onChange={e=>setForm(f=>({...f,volume_m3:e.target.value}))} style={inp} placeholder="0.00"/></div>
              <div><label style={lbl}>Station</label><input type="text" required value={form.station} onChange={e=>setForm(f=>({...f,station:e.target.value}))} style={inp} placeholder="Station principale"/></div>
              <div><label style={lbl}>Zone</label><select value={form.zone} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} style={inp}>{ZONES.map(z=><option key={z}>{z}</option>)}</select></div>
              <div><label style={lbl}>Enregistré par</label><input type="text" required value={form.recorded_by} onChange={e=>setForm(f=>({...f,recorded_by:e.target.value}))} style={inp} placeholder="Nom"/></div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button type="submit" disabled={submitting} style={B("primary")}>{submitting?"Envoi...":"Enregistrer"}</button>
              <button type="button" onClick={()=>setShowForm(false)} style={B("ghost")}>Annuler</button>
            </div>
          </form>
        )}
        {loading?<Loading/>:entries.length===0?<Empty msg="Aucun relevé enregistré"/>:(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>{["Date","Volume m³","Station","Zone","Enregistré par"].map(h=><th key={h} style={{padding:"10px 18px",textAlign:"left",fontSize:10,fontWeight:700,color:T.text3,textTransform:"uppercase",letterSpacing:"1px"}}>{h}</th>)}</tr></thead>
            <tbody>{entries.map((e,i)=><tr key={e.id} style={{borderBottom:i<entries.length-1?`1px solid ${T.border}`:"none"}}><td style={{padding:"13px 18px",fontSize:12,color:T.text2}}>{fDate(e.recorded_at)}</td><td style={{padding:"13px 18px",fontSize:13,fontWeight:700,color:T.text}}>{e.volume_m3.toLocaleString("fr-FR")}</td><td style={{padding:"13px 18px",fontSize:13,color:T.text}}>{e.station}</td><td style={{padding:"13px 18px",fontSize:12,color:T.text2}}>{e.zone}</td><td style={{padding:"13px 18px",fontSize:12,color:T.text2}}>{e.recorded_by}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function InvoicesPanel(){
  const [invoices,setInvoices]=useState<Invoice[]>([]);
  const [loading,setLoading]=useState(true);
  const [filter,setFilter]=useState<"all"|"pending"|"paid"|"overdue">("all");
  const [showForm,setShowForm]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [confirm,setConfirm]=useState("");
  const [form,setForm]=useState({customer_name:"",customer_phone:"",amount_gnf:"",description:"",due_date:""});

  const load=useCallback(async()=>{try{const d=await fetch("/api/data/invoices?status=all").then(r=>r.json());setInvoices(d||[]);}finally{setLoading(false);}}, []);
  useEffect(()=>{load();},[load]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setSubmitting(true);
    try{
      const res=await fetch("/api/data/invoices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,amount_gnf:Number(form.amount_gnf)})});
      if(res.ok){const data=await res.json();setConfirm(`✓ Facture ${data.reference} créée — lien WhatsApp envoyé`);setForm({customer_name:"",customer_phone:"",amount_gnf:"",description:"",due_date:""});setShowForm(false);await load();setTimeout(()=>setConfirm(""),6000);}
    }finally{setSubmitting(false);}
  };

  const filtered=filter==="all"?invoices:invoices.filter(i=>i.status===filter);
  const pendingAmt=invoices.filter(i=>i.status==="pending").reduce((s,i)=>s+i.amount_gnf,0);
  const paidAmt=invoices.filter(i=>i.status==="paid").reduce((s,i)=>s+i.amount_gnf,0);
  const overdueN=invoices.filter(i=>i.status==="overdue").length;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        <KpiCard label="En attente" value={fGNF(pendingAmt)} sub={`${invoices.filter(i=>i.status==="pending").length} factures`} color={T.warning}/>
        <KpiCard label="Collecté" value={fGNF(paidAmt)} sub={`${invoices.filter(i=>i.status==="paid").length} payées`} color={T.success}/>
        <KpiCard label="En retard" value={String(overdueN)} sub={overdueN>0?"Action requise":"Aucun retard"} color={overdueN>0?T.danger:T.success}/>
      </div>
      {confirm&&<div style={{padding:"12px 16px",background:T.successDim,border:`1px solid ${T.success}40`,borderRadius:8,color:T.success,fontSize:13}}>{confirm}</div>}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{flex:1,display:"flex",gap:6,flexWrap:"wrap"}}>
            {(["all","pending","paid","overdue"] as const).map(s=>(
              <button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 14px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:T.font,border:"none",background:filter===s?T.accent:T.surface3,color:filter===s?"#fff":T.text2}}>
                {s==="all"?"Toutes":s==="pending"?"En attente":s==="paid"?"Payées":"En retard"}{s!=="all"&&` (${invoices.filter(i=>i.status===s).length})`}
              </button>
            ))}
          </div>
          <button onClick={()=>setShowForm(!showForm)} style={B("primary")}>{showForm?"Fermer":"+ Nouvelle facture"}</button>
        </div>
        {showForm&&(
          <form onSubmit={submit} style={{padding:20,borderBottom:`1px solid ${T.border}`,background:T.surface2}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:14}}>
              <div><label style={lbl}>Nom du client</label><input type="text" required value={form.customer_name} onChange={e=>setForm(f=>({...f,customer_name:e.target.value}))} style={inp} placeholder="Nom complet"/></div>
              <div><label style={lbl}>Téléphone WhatsApp</label><input type="tel" required value={form.customer_phone} onChange={e=>setForm(f=>({...f,customer_phone:e.target.value}))} style={inp} placeholder="+224 xxx xxx xxx"/></div>
              <div><label style={lbl}>Montant (GNF)</label><input type="number" required value={form.amount_gnf} onChange={e=>setForm(f=>({...f,amount_gnf:e.target.value}))} style={inp} placeholder="0"/></div>
              <div><label style={lbl}>Échéance</label><input type="date" required value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} style={inp}/></div>
              <div style={{gridColumn:"span 2"}}><label style={lbl}>Description</label><input type="text" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={inp} placeholder="Ex: Consommation eau — Juin 2026"/></div>
            </div>
            <div style={{fontSize:11,color:T.text3,marginBottom:12}}>↗ Lien de signature envoyé automatiquement par WhatsApp</div>
            <div style={{display:"flex",gap:10}}>
              <button type="submit" disabled={submitting} style={B("primary")}>{submitting?"Création...":"Créer et envoyer"}</button>
              <button type="button" onClick={()=>setShowForm(false)} style={B("ghost")}>Annuler</button>
            </div>
          </form>
        )}
        {loading?<Loading/>:filtered.length===0?<Empty msg="Aucune facture"/>:(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>{["Référence","Client","Montant","Échéance","Statut"].map(h=><th key={h} style={{padding:"10px 18px",textAlign:"left",fontSize:10,fontWeight:700,color:T.text3,textTransform:"uppercase",letterSpacing:"1px"}}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map((inv,i)=><tr key={inv.id} style={{borderBottom:i<filtered.length-1?`1px solid ${T.border}`:"none"}}><td style={{padding:"13px 18px",fontSize:11,color:T.text3,fontFamily:"monospace"}}>{inv.reference}</td><td style={{padding:"13px 18px"}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{inv.customer_name||"—"}</div><div style={{fontSize:11,color:T.text3}}>{inv.customer_phone}</div></td><td style={{padding:"13px 18px",fontSize:13,fontWeight:700,color:T.text}}>{fGNF(inv.amount_gnf)}</td><td style={{padding:"13px 18px",fontSize:12,color:T.text2}}>{fDate(inv.due_date)}</td><td style={{padding:"13px 18px"}}><Badge status={inv.status}/></td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function IncidentsPanel(){
  const [incidents,setIncidents]=useState<Incident[]>([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [form,setForm]=useState({type:INCIDENT_TYPES[0],description:"",zone:ZONES[0],station:"",reported_by:""});

  const load=useCallback(async()=>{try{const d=await fetch("/api/data/incidents").then(r=>r.json());setIncidents(d||[]);}finally{setLoading(false);}}, []);
  useEffect(()=>{load();},[load]);

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setSubmitting(true);
    try{const res=await fetch("/api/data/incidents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});if(res.ok){setForm({type:INCIDENT_TYPES[0],description:"",zone:ZONES[0],station:"",reported_by:""});setShowForm(false);await load();}}
    finally{setSubmitting(false);}
  };

  const openN=incidents.filter(i=>i.status==="open").length;
  const inProgN=incidents.filter(i=>i.status==="in_progress").length;
  const resolvedN=incidents.filter(i=>i.status==="resolved").length;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        <KpiCard label="Ouverts" value={String(openN)} color={openN>0?T.danger:T.success}/>
        <KpiCard label="En cours" value={String(inProgN)} color={inProgN>0?T.warning:T.text2}/>
        <KpiCard label="Résolus" value={String(resolvedN)} color={T.success}/>
      </div>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden"}}>
        <div style={{padding:"14px 18px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.text2,textTransform:"uppercase",letterSpacing:"1px"}}>Suivi des incidents</div>
          <button onClick={()=>setShowForm(!showForm)} style={{...B("primary"),background:T.danger}}>{showForm?"Fermer":"+ Signaler incident"}</button>
        </div>
        {showForm&&(
          <form onSubmit={submit} style={{padding:20,borderBottom:`1px solid ${T.border}`,background:T.surface2}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:14}}>
              <div><label style={lbl}>Type</label><select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))} style={inp}>{INCIDENT_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div>
              <div><label style={lbl}>Zone</label><select value={form.zone} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} style={inp}>{ZONES.map(z=><option key={z}>{z}</option>)}</select></div>
              <div><label style={lbl}>Station</label><input type="text" required value={form.station} onChange={e=>setForm(f=>({...f,station:e.target.value}))} style={inp} placeholder="Station concernée"/></div>
              <div><label style={lbl}>Signalé par</label><input type="text" required value={form.reported_by} onChange={e=>setForm(f=>({...f,reported_by:e.target.value}))} style={inp} placeholder="Nom"/></div>
              <div style={{gridColumn:"span 2"}}><label style={lbl}>Description</label><textarea required value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{...inp,minHeight:80,resize:"vertical" as const}} placeholder="Décrivez l'incident..."/></div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button type="submit" disabled={submitting} style={{...B("primary"),background:T.danger}}>{submitting?"Envoi...":"Signaler"}</button>
              <button type="button" onClick={()=>setShowForm(false)} style={B("ghost")}>Annuler</button>
            </div>
          </form>
        )}
        {loading?<Loading/>:incidents.length===0?<Empty msg="Aucun incident signalé"/>:(
          <div>{incidents.map((inc,i)=>(
            <div key={inc.id} style={{padding:"16px 18px",borderBottom:i<incidents.length-1?`1px solid ${T.border}`:"none"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:12,fontWeight:700,color:T.text,textTransform:"uppercase",letterSpacing:"0.5px"}}>{inc.type}</span>
                    <span style={{fontSize:11,color:T.text3}}>·</span>
                    <span style={{fontSize:12,color:T.text2}}>{inc.zone} — {inc.station}</span>
                    <Badge status={inc.status}/>
                  </div>
                  <div style={{fontSize:13,color:T.text2,lineHeight:1.5}}>{inc.description}</div>
                  <div style={{fontSize:11,color:T.text3,marginTop:6}}>{fTime(inc.created_at)} · Signalé par {inc.reported_by}</div>
                </div>
              </div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

function AgentsPanel(){
  const [agents,setAgents]=useState<Agent[]>([]);
  const [stats,setStats]=useState({messages_today:0,total_conversations:0});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{fetch("/api/data/agents").then(r=>r.json()).then(d=>{setAgents(d.logs||[]);setStats(d.stats||{messages_today:0,total_conversations:0});}).finally(()=>setLoading(false));},[]);

  if(loading)return <Loading/>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        <KpiCard label="Agents actifs" value={String(agents.filter(a=>a.statut==="actif").length)} color={T.success}/>
        <KpiCard label="Messages aujourd'hui" value={String(stats.messages_today)} color={T.accent}/>
        <KpiCard label="Conversations totales" value={String(stats.total_conversations)} color={T.text2}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {agents.length===0?<Empty msg="Aucun agent configuré"/>:agents.map(a=>(
          <div key={a.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:18,display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:42,height:42,borderRadius:10,background:T.accentDim,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{a.icon}</div>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:T.text}}>{a.agent}</div><div style={{marginTop:4}}><Badge status={a.statut}/></div></div>
              <div style={{fontSize:10,color:T.text3,textAlign:"right",flexShrink:0}}>{fTime(a.heure_execution)}</div>
            </div>
            <div style={{fontSize:12,color:T.text2,lineHeight:1.6}}>{a.insight}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
