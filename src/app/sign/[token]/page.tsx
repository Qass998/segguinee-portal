/**
 * /sign/[token] — SEGGUINÉE Invoice Signing Page
 *
 * Public page (no auth required). Client opens this from WhatsApp link.
 * Server Component fetches invoice by token, renders professional invoice.
 * SignButton handles the interactive sign + print actions client-side.
 *
 * Design: Minimalist light document (§11.5) with SEGGUINÉE Navy header (§14.8)
 * Dials: VARIANCE=3 · MOTION=3 · DENSITY=5
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { atList } from "@/lib/airtable";
import SignButton from "./SignButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "Facture SEGGUINÉE",
  robots: "noindex, nofollow",
};

function fmt(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmtGNF(n: number) {
  return (n || 0).toLocaleString("fr-FR") + " GNF";
}

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const records = await atList("invoices", {
    filterByFormula: `{Sign_token}='${token}'`,
    maxRecords: 1,
  });

  if (!records[0]) notFound();

  const f = records[0].fields;
  const invoiceId = records[0].id;
  const isSigned = !!f.Signed;

  const whatsappLink = `https://wa.me/${process.env.SEGGUINEE_DIRECTOR_PHONE || ""}`;

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
          background: #F1F5F9;
          min-height: 100dvh;
          -webkit-font-smoothing: antialiased;
          color: #0F172A;
        }

        .invoice-wrapper {
          max-width: 640px;
          margin: 0 auto;
          padding: 24px 16px 48px;
        }

        .invoice-card {
          background: #FFFFFF;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04);
        }

        /* ── HEADER ─────────────────────────────────────── */
        .inv-header {
          background: #0C2340;
          padding: 28px 32px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .inv-brand { display: flex; align-items: center; gap: 12px; }
        .inv-brand-icon {
          width: 40px; height: 40px;
          background: rgba(59,130,246,0.2);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .inv-brand-name {
          font-size: 18px; font-weight: 700;
          color: #F8FAFC; letter-spacing: -0.02em;
        }
        .inv-brand-sub {
          font-size: 11px; color: rgba(248,250,252,0.55);
          font-weight: 500; margin-top: 2px;
          letter-spacing: 0.01em;
        }
        .inv-ref-block { text-align: right; }
        .inv-ref-label {
          font-size: 10px; font-weight: 600;
          color: rgba(248,250,252,0.45);
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .inv-ref-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 15px; font-weight: 600;
          color: #93C5FD; margin-top: 3px;
        }

        /* ── BODY ───────────────────────────────────────── */
        .inv-body { padding: 32px; }

        /* Status badge */
        .inv-status {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 999px;
          font-size: 12px; font-weight: 600; margin-bottom: 24px;
        }
        .inv-status-dot {
          width: 7px; height: 7px; border-radius: 50%;
        }
        .status-pending  { background: #FEF9C3; color: #854D0E; }
        .status-pending .inv-status-dot { background: #CA8A04; }
        .status-signed   { background: #DCFCE7; color: #14532D; }
        .status-signed .inv-status-dot  { background: #16A34A; }
        .status-overdue  { background: #FEE2E2; color: #7F1D1D; }
        .status-overdue .inv-status-dot { background: #DC2626; }

        /* Meta row */
        .inv-meta {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 16px; margin-bottom: 28px;
        }
        .inv-meta-item {}
        .inv-meta-label {
          font-size: 10px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: #94A3B8; margin-bottom: 4px;
        }
        .inv-meta-value { font-size: 14px; font-weight: 500; color: #0F172A; }

        /* Divider */
        .inv-divider {
          height: 1px; background: #E2E8F0;
          margin: 24px 0;
        }

        /* Bill-to block */
        .inv-bill-to {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 16px 20px;
          margin-bottom: 28px;
        }
        .inv-bill-to-label {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: #94A3B8; margin-bottom: 10px;
        }
        .inv-bill-to-name { font-size: 15px; font-weight: 600; color: #0F172A; }
        .inv-bill-to-phone {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 13px; color: #64748B; margin-top: 4px;
        }

        /* Line items */
        .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .inv-table th {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: #94A3B8; padding: 0 0 10px;
          border-bottom: 1px solid #E2E8F0;
        }
        .inv-table th:last-child { text-align: right; }
        .inv-table td {
          padding: 14px 0;
          border-bottom: 1px solid #F1F5F9;
          font-size: 14px; color: #0F172A;
          vertical-align: top;
        }
        .inv-table td:last-child {
          text-align: right;
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-weight: 600; white-space: nowrap;
        }
        .inv-table td .desc-sub {
          font-size: 12px; color: #64748B;
          margin-top: 3px; font-weight: 400;
        }

        /* Total row */
        .inv-total-row {
          display: flex; justify-content: flex-end;
          margin-top: 4px;
        }
        .inv-total-box {
          background: #0C2340;
          border-radius: 10px;
          padding: 14px 20px;
          display: flex; align-items: center; gap: 32px;
        }
        .inv-total-label {
          font-size: 12px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: rgba(248,250,252,0.6);
        }
        .inv-total-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 20px; font-weight: 700;
          color: #F8FAFC; letter-spacing: -0.01em;
        }

        /* Payment section */
        .inv-payment {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          padding: 16px 20px;
          margin-top: 24px;
        }
        .inv-payment-label {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.1em;
          color: #94A3B8; margin-bottom: 10px;
        }
        .inv-payment-item {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 8px; font-size: 13px; color: #334155;
        }
        .inv-payment-item:last-child { margin-bottom: 0; }
        .inv-payment-icon {
          width: 28px; height: 28px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; flex-shrink: 0;
          background: #E0F2FE;
        }

        /* Legal notice */
        .inv-legal {
          background: #FFF7ED;
          border: 1px solid #FED7AA;
          border-radius: 10px;
          padding: 14px 18px;
          margin-top: 24px;
          font-size: 13px;
          color: #7C2D12;
          line-height: 1.5;
        }

        /* CTA section */
        .inv-actions {
          margin-top: 28px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .btn-sign {
          width: 100%;
          padding: 16px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 15px; font-weight: 700;
          background: #16A34A; color: #FFFFFF;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 200ms cubic-bezier(0.32,0.72,0,1),
                      transform 150ms cubic-bezier(0.32,0.72,0,1);
          min-height: 52px;
        }
        .btn-sign:hover { background: #15803D; }
        .btn-sign:active { transform: scale(0.98); }
        .btn-sign:disabled { opacity: 0.4; cursor: not-allowed; }

        .btn-print {
          width: 100%;
          padding: 13px;
          border-radius: 10px;
          border: 1.5px solid #E2E8F0;
          cursor: pointer;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 14px; font-weight: 600;
          background: transparent; color: #64748B;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: border-color 200ms, color 200ms, background 200ms;
          min-height: 48px;
        }
        .btn-print:hover { border-color: #94A3B8; color: #0F172A; background: #F8FAFC; }
        .btn-print:active { transform: scale(0.98); }

        /* Success state */
        .inv-success {
          text-align: center;
          padding: 48px 32px;
        }
        .inv-success-icon {
          width: 72px; height: 72px;
          background: #DCFCE7;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px;
        }
        .inv-success-title {
          font-size: 22px; font-weight: 700;
          color: #0F172A; letter-spacing: -0.02em;
          margin-bottom: 10px;
        }
        .inv-success-sub {
          font-size: 14px; color: #64748B;
          line-height: 1.6; max-width: 320px; margin: 0 auto 24px;
        }
        .inv-success-ref {
          display: inline-flex; flex-direction: column; gap: 4px;
          background: #F8FAFC; border: 1px solid #E2E8F0;
          border-radius: 10px; padding: 14px 24px;
          text-align: left; margin-bottom: 24px;
        }
        .inv-success-ref-label {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.08em;
          color: #94A3B8;
        }
        .inv-success-ref-value {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 15px; font-weight: 600; color: #0F172A;
        }
        .inv-success-wa {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px 24px; border-radius: 10px;
          background: #25D366; color: #FFFFFF;
          font-size: 14px; font-weight: 600;
          text-decoration: none;
          transition: background 200ms;
          min-height: 48px;
        }
        .inv-success-wa:hover { background: #1FAD53; }

        /* Footer */
        .inv-footer {
          text-align: center;
          padding-top: 24px;
          font-size: 12px; color: #94A3B8;
        }
        .inv-footer a { color: #3B82F6; text-decoration: none; }

        /* Focus states */
        .btn-sign:focus-visible,
        .btn-print:focus-visible {
          outline: 2px solid #3B82F6;
          outline-offset: 2px;
        }

        /* Print styles */
        @media print {
          body { background: white; }
          .invoice-wrapper { padding: 0; }
          .invoice-card { box-shadow: none; border-radius: 0; }
          .no-print { display: none !important; }
          .inv-actions { display: none !important; }
          .inv-legal { background: #FFF7ED; }
          .inv-footer { display: none; }
          .inv-body { padding: 24px; }
          .inv-header { padding: 20px 24px; }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Mobile */
        @media (max-width: 480px) {
          .inv-body { padding: 20px; }
          .inv-header { padding: 20px; flex-direction: column; gap: 12px; }
          .inv-ref-block { text-align: left; }
          .inv-meta { grid-template-columns: 1fr; gap: 12px; }
          .inv-total-box { gap: 20px; }
          .inv-total-value { font-size: 17px; }
        }
      `}</style>

      <div className="invoice-wrapper">
        <div className="invoice-card">

          {/* ── HEADER ──────────────────────────────────── */}
          <div className="inv-header">
            <div className="inv-brand">
              <div className="inv-brand-icon" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#3B82F6">
                  <path d="M12 2C12 2 4 12.5 4 17a8 8 0 1 0 16 0C20 12.5 12 2 12 2Z"/>
                </svg>
              </div>
              <div>
                <div className="inv-brand-name">SEGGUINÉE</div>
                <div className="inv-brand-sub">Société des Eaux de Guinée</div>
              </div>
            </div>
            <div className="inv-ref-block">
              <div className="inv-ref-label">Facture</div>
              <div className="inv-ref-value">{f.Reference || "—"}</div>
            </div>
          </div>

          {/* ── BODY ────────────────────────────────────── */}
          {isSigned ? (
            /* ── SUCCESS STATE ───────────────────────── */
            <div className="inv-success">
              <div className="inv-success-icon" aria-hidden="true">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                  stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h1 className="inv-success-title">Facture confirmée</h1>
              <p className="inv-success-sub">
                Votre accord a été enregistré.
                Merci de votre confiance — notre équipe a été notifiée.
              </p>
              <div className="inv-success-ref">
                <span className="inv-success-ref-label">Référence</span>
                <span className="inv-success-ref-value">{f.Reference}</span>
                <span className="inv-success-ref-label" style={{ marginTop: 8 }}>Montant</span>
                <span className="inv-success-ref-value">{fmtGNF(f.Amount_GNF)}</span>
                {f.Signed_at && (
                  <>
                    <span className="inv-success-ref-label" style={{ marginTop: 8 }}>Signé le</span>
                    <span className="inv-success-ref-value">
                      {new Date(f.Signed_at).toLocaleString("fr-FR", {
                        day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </>
                )}
              </div>
              <a href={whatsappLink} className="inv-success-wa" target="_blank" rel="noopener noreferrer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Contacter SEGGUINÉE
              </a>
            </div>
          ) : (
            /* ── INVOICE VIEW ────────────────────────── */
            <div className="inv-body">

              {/* Status badge */}
              {(() => {
                const s = (f.Status || "pending") as string;
                const cls = s === "overdue" ? "status-overdue" : "status-pending";
                const label = s === "overdue" ? "En retard" : "En attente de confirmation";
                return (
                  <div className={`inv-status ${cls}`} role="status">
                    <div className="inv-status-dot" aria-hidden="true"/>
                    {label}
                  </div>
                );
              })()}

              {/* Dates */}
              <div className="inv-meta">
                <div className="inv-meta-item">
                  <div className="inv-meta-label">Date d&apos;émission</div>
                  <div className="inv-meta-value">{fmt(f.Created_at)}</div>
                </div>
                <div className="inv-meta-item">
                  <div className="inv-meta-label">Date d&apos;échéance</div>
                  <div className="inv-meta-value" style={{ color: f.Status === "overdue" ? "#DC2626" : undefined }}>
                    {fmt(f.Due_date)}
                  </div>
                </div>
              </div>

              <div className="inv-divider" role="separator"/>

              {/* Bill-to */}
              <div className="inv-bill-to">
                <div className="inv-bill-to-label">Facturer à</div>
                <div className="inv-bill-to-name">{f.Customer_name || "Client SEGGUINÉE"}</div>
                {f.Customer_phone && (
                  <div className="inv-bill-to-phone">{f.Customer_phone}</div>
                )}
              </div>

              {/* Line items */}
              <table className="inv-table" aria-label="Détail de la facture">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Description</th>
                    <th>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {f.Description || "Fourniture d'eau potable"}
                      {f.Due_date && (
                        <div className="desc-sub">
                          Période : {new Date(f.Due_date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                        </div>
                      )}
                    </td>
                    <td>{fmtGNF(f.Amount_GNF)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Total */}
              <div className="inv-total-row">
                <div className="inv-total-box">
                  <span className="inv-total-label">Total</span>
                  <span className="inv-total-value">{fmtGNF(f.Amount_GNF)}</span>
                </div>
              </div>

              {/* Payment methods */}
              <div className="inv-payment">
                <div className="inv-payment-label">Modes de paiement acceptés</div>
                <div className="inv-payment-item">
                  <div className="inv-payment-icon" aria-hidden="true">🟠</div>
                  <div>
                    <strong>Orange Money</strong> · +224 624 000 000
                  </div>
                </div>
                <div className="inv-payment-item">
                  <div className="inv-payment-icon" aria-hidden="true">🟡</div>
                  <div>
                    <strong>MTN Mobile Money</strong> · +224 655 000 000
                  </div>
                </div>
                <div className="inv-payment-item">
                  <div className="inv-payment-icon" aria-hidden="true">🏛</div>
                  <div>
                    <strong>Virement bancaire</strong> · Contactez-nous pour les coordonnées
                  </div>
                </div>
              </div>

              {/* Legal notice */}
              <div className="inv-legal" role="note">
                En confirmant cette facture, vous reconnaissez les services rendus et vous engagez
                à régler le montant de <strong>{fmtGNF(f.Amount_GNF)}</strong> avant
                le <strong>{fmt(f.Due_date)}</strong>.
                Tout retard de paiement peut entraîner la suspension du service.
              </div>

              {/* CTA Buttons */}
              <div className="inv-actions no-print">
                <SignButton
                  invoiceId={invoiceId}
                  token={token}
                  amount={fmtGNF(f.Amount_GNF)}
                  reference={f.Reference || ""}
                  alreadySigned={isSigned}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="inv-footer no-print">
          <p>SEGGUINÉE · Société des Eaux de Guinée · Conakry, Guinée</p>
          <p style={{ marginTop: 4 }}>
            Propulsé par <a href="https://pluggedin.ink" target="_blank" rel="noopener noreferrer">PluggedIN</a>
          </p>
        </div>
      </div>
    </>
  );
}
