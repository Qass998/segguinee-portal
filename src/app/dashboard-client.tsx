"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────

interface Conversation {
  id: string; phone: string; profile_name: string;
  last_message: string; last_message_at: string;
  unread_count: number; status: string; is_director: boolean;
}
interface Message {
  id: string; conversation_phone: string;
  direction: "inbound" | "outbound"; body: string;
  action: string; ai_generated: boolean; created_at: string;
}
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

type Tab = "conversations" | "production" | "invoices" | "incidents" | "projects" | "terrain" | "agents";

// ── Design tokens ─────────────────────────────────────────────────────────

const T = {
  canvas: "#0F172A", surface: "#1E293B", surfaceHover: "#273449",
  border: "#334155", accent: "#3B82F6", accentDim: "rgba(59,130,246,.15)",
  text: "#F8FAFC", text2: "#CBD5E1", text3: "#94A3B8", subtle: "#64748B",
  success: "#34D399", successDim: "rgba(52,211,153,.15)",
  warning: "#FBBF24", warningDim: "rgba(251,191,36,.15)",
  danger: "#F87171", dangerDim: "rgba(248,113,113,.15)",
};

const ZONES = ["Kaloum", "Dixinn", "Matam", "Ratoma", "Matoto", "Coyah", "Dubréka", "Kindia"];
const INCIDENT_TYPES = ["rupture", "panne", "contamination", "fuite", "autre"];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso); const now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function formatGNF(n: number) { return n.toLocaleString("fr-FR") + " GNF"; }

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: "conversations", label: "Conversations", icon: "💬" },
  { key: "production",    label: "Production",    icon: "📊" },
  { key: "invoices",      label: "Factures",      icon: "📄" },
  { key: "incidents",     label: "Incidents",     icon: "🚨" },
  { key: "projects",      label: "Projets",       icon: "🏗️" },
  { key: "terrain",       label: "Terrain",       icon: "👷" },
  { key: "agents",        label: "Agents IA",     icon: "🤖" },
];

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  DASHBOARD — CLIENT COMPONENT                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("conversations");

  useEffect(() => {
    if (document.cookie.includes("segguinee_auth=")) setAuthed(true);
    else router.push("/login");
  }, [router]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabs.some(t => t.key === tabParam)) {
      setTab(tabParam as Tab);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  if (!authed) return null;

  const logout = () => { document.cookie = "segguinee_auth=; path=/; max-age=0"; router.push("/login"); };

  return (
    <div style={{ display: "flex", height: "100dvh", background: T.canvas, color: T.text, overflow: "hidden" }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, background: T.surface, borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column", overflow: "hidden"
      }}>
        {/* Brand */}
        <div style={{ padding: "20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <h1 style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: 0 }}>SEGGUINÉE</h1>
          <p style={{ fontSize: 10, color: T.subtle, margin: "4px 0 0", opacity: 0.7 }}>Portail Opérateur</p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {tabs.map(t => {
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", border: "none", background: active ? `${T.canvas}` : "transparent",
                  color: active ? T.accent : T.text3, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: active ? 600 : 400, transition: "all 150ms",
                  borderLeft: active ? `3px solid ${T.accent}` : "3px solid transparent"
                }}>
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <button onClick={logout}
          style={{
            width: "100%", padding: "12px 16px", border: "none", background: "transparent",
            color: T.text3, cursor: "pointer", fontFamily: "inherit", fontSize: 13,
            textAlign: "left", borderTop: `1px solid ${T.border}`, flexShrink: 0
          }}>
          🚪 Déconnexion
        </button>
      </aside>

      {/* ── MAIN AREA ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
            {tabs.find(t => t.key === tab)?.label}
          </h2>

          {tab === "production" && <ProductionPanel />}
          {tab === "invoices" && <InvoicesPanel />}
          {tab === "incidents" && <IncidentsPanel />}
          {tab === "agents" && <AgentsPanel />}
          {tab === "conversations" && <div style={{ color: T.text3, padding: "40px 20px", textAlign: "center" }}>Coming soon</div>}
          {tab === "projects" && <div style={{ color: T.text3, padding: "40px 20px", textAlign: "center" }}>Coming soon</div>}
          {tab === "terrain" && <div style={{ color: T.text3, padding: "40px 20px", textAlign: "center" }}>Coming soon</div>}
        </div>
      </div>
    </div>
  );
}

// ── PRODUCTION PANEL ──────────────────────────────────────────────────────

function ProductionPanel() {
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [volume_m3, setVolumeM3] = useState("");
  const [station, setStation] = useState("");
  const [zone, setZone] = useState(ZONES[0]);
  const [recorded_by, setRecordedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEntries = async () => {
    try {
      const res = await fetch("/api/data/production");
      const data = await res.json();
      setEntries(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/data/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume_m3: Number(volume_m3), station, zone, recorded_by }),
      });
      if (res.ok) {
        setVolumeM3("");
        setStation("");
        setZone(ZONES[0]);
        setRecordedBy("");
        await fetchEntries();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const totalVolume = entries.reduce((sum, e) => sum + e.volume_m3, 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stat Card */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Volume Total</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: T.accent }}>{totalVolume.toLocaleString("fr-FR")} m³</div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: 1 }}>Ajouter relevé</div>
        <input type="number" placeholder="Volume m³" value={volume_m3} onChange={e => setVolumeM3(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <input type="text" placeholder="Station" value={station} onChange={e => setStation(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <select value={zone} onChange={e => setZone(e.target.value)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }}>
          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <input type="text" placeholder="Enregistré par" value={recorded_by} onChange={e => setRecordedBy(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <button type="submit" disabled={submitting} style={{ background: T.accent, color: "#000", borderRadius: 4, padding: "8px 16px", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", opacity: submitting ? 0.5 : 1 }}>
          {submitting ? "Envoi..." : "+ Ajouter relevé"}
        </button>
      </form>

      {/* List */}
      {loading ? <div style={{ color: T.text3 }}>Chargement...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {entries.length === 0 ? <div style={{ color: T.text3 }}>Aucun relevé</div> : (
            entries.map(e => (
              <div key={e.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{e.volume_m3} m³ — {e.station} ({e.zone})</div>
                  <div style={{ fontSize: 12, color: T.text3 }}>{formatTime(e.recorded_at)} par {e.recorded_by}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── INVOICES PANEL ────────────────────────────────────────────────────────

function InvoicesPanel() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [customer_phone, setCustomerPhone] = useState("");
  const [customer_name, setCustomerName] = useState("");
  const [amount_gnf, setAmountGNF] = useState("");
  const [description, setDescription] = useState("");
  const [due_date, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchInvoices = async (status: string) => {
    try {
      const res = await fetch(`/api/data/invoices?status=${status === "all" ? "all" : status}`);
      const data = await res.json();
      setInvoices(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices(statusFilter);
  }, [statusFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/data/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_phone, customer_name, amount_gnf: Number(amount_gnf), description, due_date }),
      });
      if (res.ok) {
        setCustomerPhone("");
        setCustomerName("");
        setAmountGNF("");
        setDescription("");
        setDueDate("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        await fetchInvoices(statusFilter);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors = { pending: T.warning, paid: T.success, overdue: T.danger, cancelled: T.subtle };
  const filtered = statusFilter === "all" ? invoices : invoices.filter(i => i.status === statusFilter);
  const stats = { pending: invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.amount_gnf, 0), paid: invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount_gnf, 0), total: invoices.reduce((s, i) => s + i.amount_gnf, 0) };

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>En Attente</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.warning }}>{formatGNF(stats.pending)}</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Payé</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.success }}>{formatGNF(stats.paid)}</div>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Total</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{formatGNF(stats.total)}</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8 }}>
        {(["all", "pending", "paid", "overdue"] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "6px 12px", background: statusFilter === s ? T.accent : T.surface, color: statusFilter === s ? "#000" : T.text2, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {s === "all" ? "Toutes" : s === "pending" ? "En attente" : s === "paid" ? "Payées" : "En retard"}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: 1 }}>Ajouter facture</div>
        {success && <div style={{ padding: "8px 12px", background: `${T.success}20`, border: `1px solid ${T.success}`, borderRadius: 4, color: T.success, fontSize: 12 }}>✓ Facture envoyée + lien WhatsApp généré</div>}
        <input type="text" placeholder="Nom client" value={customer_name} onChange={e => setCustomerName(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <input type="tel" placeholder="Téléphone" value={customer_phone} onChange={e => setCustomerPhone(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <input type="number" placeholder="Montant GNF" value={amount_gnf} onChange={e => setAmountGNF(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <input type="text" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <input type="date" value={due_date} onChange={e => setDueDate(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <button type="submit" disabled={submitting} style={{ background: T.accent, color: "#000", borderRadius: 4, padding: "8px 16px", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", opacity: submitting ? 0.5 : 1 }}>
          {submitting ? "Envoi..." : "+ Ajouter facture"}
        </button>
      </form>

      {/* List */}
      {loading ? <div style={{ color: T.text3 }}>Chargement...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 ? <div style={{ color: T.text3 }}>Aucune facture</div> : (
            filtered.map(i => (
              <div key={i.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{i.customer_name} — {formatGNF(i.amount_gnf)}</div>
                    <div style={{ fontSize: 12, color: T.text3 }}>{i.reference} • {formatDate(i.due_date)}</div>
                  </div>
                  <div style={{ padding: "4px 8px", background: `${statusColors[i.status]}20`, border: `1px solid ${statusColors[i.status]}`, borderRadius: 4, color: statusColors[i.status], fontSize: 11, fontWeight: 600 }}>
                    {i.status === "pending" ? "En attente" : i.status === "paid" ? "Payée" : i.status === "overdue" ? "En retard" : "Annulée"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── INCIDENTS PANEL ───────────────────────────────────────────────────────

function IncidentsPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState(INCIDENT_TYPES[0]);
  const [description, setDescription] = useState("");
  const [zone, setZone] = useState(ZONES[0]);
  const [station, setStation] = useState("");
  const [reported_by, setReportedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchIncidents = async () => {
    try {
      const res = await fetch("/api/data/incidents");
      const data = await res.json();
      setIncidents(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/data/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, description, zone, station, reported_by }),
      });
      if (res.ok) {
        setType(INCIDENT_TYPES[0]);
        setDescription("");
        setZone(ZONES[0]);
        setStation("");
        setReportedBy("");
        await fetchIncidents();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors = { open: T.danger, in_progress: T.warning, resolved: T.success, closed: T.subtle };

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Form */}
      <form onSubmit={handleSubmit} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.subtle, textTransform: "uppercase", letterSpacing: 1 }}>Signaler incident</div>
        <select value={type} onChange={e => setType(e.target.value)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }}>
          {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%", minHeight: "80px", fontFamily: "inherit", resize: "vertical" }} />
        <select value={zone} onChange={e => setZone(e.target.value)} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }}>
          {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <input type="text" placeholder="Station" value={station} onChange={e => setStation(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <input type="text" placeholder="Signalé par" value={reported_by} onChange={e => setReportedBy(e.target.value)} required style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 12px", color: T.text, fontSize: 13, width: "100%" }} />
        <button type="submit" disabled={submitting} style={{ background: T.accent, color: "#000", borderRadius: 4, padding: "8px 16px", fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", opacity: submitting ? 0.5 : 1 }}>
          {submitting ? "Envoi..." : "+ Signaler incident"}
        </button>
      </form>

      {/* List */}
      {loading ? <div style={{ color: T.text3 }}>Chargement...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {incidents.length === 0 ? <div style={{ color: T.text3 }}>Aucun incident</div> : (
            incidents.map(i => (
              <div key={i.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{i.type.toUpperCase()} — {i.zone}</div>
                    <div style={{ fontSize: 12, color: T.text3, marginTop: 4, maxWidth: "400px" }}>{i.description}</div>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 4 }}>{formatTime(i.created_at)} • {i.station} • {i.reported_by}</div>
                  </div>
                  <div style={{ padding: "4px 8px", background: `${statusColors[i.status]}20`, border: `1px solid ${statusColors[i.status]}`, borderRadius: 4, color: statusColors[i.status], fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                    {i.status === "open" ? "Ouvert" : i.status === "in_progress" ? "En cours" : i.status === "resolved" ? "Résolu" : "Fermé"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── AGENTS PANEL ──────────────────────────────────────────────────────────

function AgentsPanel() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/data/agents")
      .then(r => r.json())
      .then(d => {
        setAgents(d.logs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: T.text3 }}>Chargement...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {agents.map(agent => (
        <div key={agent.id} style={{
          padding: 16, background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 8, display: "flex", flexDirection: "column", gap: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 32 }}>{agent.icon}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{agent.agent}</div>
              <div style={{ fontSize: 12, color: T.text3 }}>{agent.statut}</div>
            </div>
          </div>
          <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>{agent.insight}</div>
          <button style={{
            padding: "8px 12px", background: T.accent, color: "#000", border: "none",
            borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer"
          }}>
            Activer sur WhatsApp
          </button>
        </div>
      ))}
    </div>
  );
}
