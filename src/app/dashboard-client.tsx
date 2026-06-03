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

          {tab === "agents" && <AgentsPanel />}
          {tab !== "agents" && (
            <div style={{ color: T.text3, padding: "40px 20px", textAlign: "center" }}>
              Panel content for {tab}
            </div>
          )}
        </div>
      </div>
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
