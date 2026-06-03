/**
 * /reports/[id] — SEGGUINÉE Monthly Report
 * Public page (no auth). Director opens from WhatsApp link.
 * Design: Minimalist light document (§11.5) · SEGGUINÉE Navy header (§14.8)
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { atList } from '@/lib/airtable';

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: 'Rapport Mensuel — SEGGUINÉE',
  robots: 'noindex, nofollow',
};

function fmtGNF(n: number) { return (n || 0).toLocaleString('fr-FR') + ' GNF'; }
function pct(a: number, b: number) { return b > 0 ? Math.round((a / b) * 100) : 0; }

function ProgressBar({ value, max, color = '#3B82F6' }: { value: number; max: number; color?: string }) {
  const p = Math.min(100, max > 0 ? Math.round((value / max) * 100) : 0);
  return (
    <div style={{ background: '#E2E8F0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
      <div style={{ width: `${p}%`, background: color, height: '100%', borderRadius: 4,
        transition: 'width 0.6s cubic-bezier(0.16,1,0.3,1)' }} />
    </div>
  );
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 14, color: '#334155' }}>{label}</span>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 14, fontWeight: 600, color: '#0F172A', textAlign: 'right' }}>
        {value}
        {sub && <span style={{ display: 'block', fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>{sub}</span>}
      </span>
    </div>
  );
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const records = await atList('monthly_reports', {
    filterByFormula: `{Report_id}='${id}'`,
    maxRecords: 1,
  });

  if (!records[0]) notFound();
  const f = records[0].fields;

  const generatedAt = f.Generated_at
    ? new Date(f.Generated_at).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  const recoveryRate = pct(f.Invoices_paid || 0, (f.Invoices_paid || 0) + (f.Invoices_unpaid || 0));
  const resolutionRate = pct(f.Incidents_resolved || 0, f.Incidents_total || 0);

  const overallStatus = (f.Incidents_total || 0) - (f.Incidents_resolved || 0) > 2
    ? { label: 'Attention requise', color: '#D97706', bg: '#FEF3C7' }
    : recoveryRate < 60
    ? { label: 'Recouvrement à améliorer', color: '#D97706', bg: '#FEF3C7' }
    : { label: 'Opérations stables', color: '#16A34A', bg: '#DCFCE7' };

  const recs = (f.Recommendations as string || '')
    .split('\n')
    .filter((l: string) => l.trim())
    .map((l: string) => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', system-ui, sans-serif; background: #F1F5F9;
               -webkit-font-smoothing: antialiased; color: #0F172A; }
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .report-card { box-shadow: none !important; border-radius: 0 !important; }
          .report-wrapper { padding: 0 !important; }
        }
        @media (max-width: 600px) {
          .report-body { padding: 20px !important; }
          .report-header { padding: 20px !important; flex-direction: column !important; gap: 12px !important; }
          .stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="report-wrapper" style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px 48px' }}>
        <div className="report-card" style={{ background: '#fff', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04)' }}>

          {/* ── HEADER ─────────────────────────────────────── */}
          <div className="report-header" style={{ background: '#0C2340', padding: '28px 32px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, background: 'rgba(59,130,246,0.2)',
                borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#3B82F6">
                  <path d="M12 2C12 2 4 12.5 4 17a8 8 0 1 0 16 0C20 12.5 12 2 12 2Z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F8FAFC', letterSpacing: '-0.02em' }}>SEGGUINÉE</div>
                <div style={{ fontSize: 11, color: 'rgba(248,250,252,0.55)', marginTop: 2 }}>Société des Eaux de Guinée</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(248,250,252,0.45)',
                textTransform: 'uppercase', letterSpacing: '0.08em' }}>Rapport mensuel</div>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 15,
                fontWeight: 600, color: '#93C5FD', marginTop: 3 }}>{f.Period}</div>
            </div>
          </div>

          {/* ── BODY ───────────────────────────────────────── */}
          <div className="report-body" style={{ padding: 32 }}>

            {/* Overall status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
              <span style={{ padding: '5px 14px', borderRadius: 999, fontSize: 12,
                fontWeight: 600, background: overallStatus.bg, color: overallStatus.color }}>
                ● {overallStatus.label}
              </span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>Généré le {generatedAt}</span>
            </div>

            {/* AI narrative */}
            {f.Narrative && (
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
                padding: '16px 20px', marginBottom: 32 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: '#94A3B8', marginBottom: 8 }}>Synthèse du mois</div>
                <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.7 }}>{f.Narrative}</p>
              </div>
            )}

            {/* ── Section: Production ─────────────────────── */}
            <Section title="Production" icon="💧">
              <StatRow label="Volume produit" value={`${(f.Production_m3 || 0).toLocaleString('fr-FR')} m³`} />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>Objectif mensuel (estimation)</div>
                <ProgressBar value={f.Production_m3 || 0} max={50000} color="#3B82F6" />
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                  {pct(f.Production_m3 || 0, 50000)}% de l&apos;objectif
                </div>
              </div>
            </Section>

            {/* ── Section: Finance ────────────────────────── */}
            <Section title="Finance" icon="💰">
              <StatRow label="Factures payées" value={String(f.Invoices_paid || 0)} />
              <StatRow label="Revenus encaissés" value={fmtGNF(f.Revenue_GNF || 0)} />
              <StatRow label="Impayés en cours" value={String(f.Invoices_unpaid || 0)}
                sub={f.Invoices_unpaid ? 'Relances recommandées' : undefined} />
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>
                  Taux de recouvrement — {recoveryRate}%
                </div>
                <ProgressBar
                  value={recoveryRate} max={100}
                  color={recoveryRate >= 80 ? '#16A34A' : recoveryRate >= 60 ? '#D97706' : '#DC2626'} />
              </div>
            </Section>

            {/* ── Section: Incidents ──────────────────────── */}
            <Section title="Incidents" icon="🚨">
              <StatRow label="Incidents signalés" value={String(f.Incidents_total || 0)} />
              <StatRow label="Résolus" value={String(f.Incidents_resolved || 0)}
                sub={`${resolutionRate}% de résolution`} />
              <StatRow label="Actifs en fin de mois"
                value={String((f.Incidents_total || 0) - (f.Incidents_resolved || 0))} />
              {f.Incidents_total > 0 && (
                <div style={{ marginTop: 12 }}>
                  <ProgressBar value={f.Incidents_resolved || 0} max={f.Incidents_total || 1} color="#16A34A" />
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>
                    {resolutionRate}% résolution
                  </div>
                </div>
              )}
            </Section>

            {/* ── Section: Recommendations ────────────────── */}
            {recs.length > 0 && (
              <Section title="Recommandations" icon="✦">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recs.map((r: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EFF6FF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#3B82F6' }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: 14, color: '#334155', lineHeight: 1.5, paddingTop: 2 }}>{r}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Print button */}
            <div className="no-print" style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
              <button onClick={() => window.print()}
                style={{ padding: '12px 32px', borderRadius: 10, border: '1.5px solid #E2E8F0',
                  background: 'transparent', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  color: '#64748B', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Imprimer / Exporter PDF
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="no-print" style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#94A3B8' }}>
          <p>SEGGUINÉE · Société des Eaux de Guinée · Conakry, Guinée</p>
          <p style={{ marginTop: 4 }}>Propulsé par <a href="https://pluggedin.ink" style={{ color: '#3B82F6', textDecoration: 'none' }}>PluggedIN</a></p>
        </div>
      </div>
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: '#64748B' }}>{title}</h2>
        <div style={{ flex: 1, height: 1, background: '#E2E8F0', marginLeft: 4 }} />
      </div>
      {children}
    </div>
  );
}
