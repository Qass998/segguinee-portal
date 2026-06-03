"use client";

import { useState } from "react";

export default function SignButton({
  invoiceId,
  token,
  amount,
  reference,
}: {
  invoiceId: string;
  token: string;
  amount: string;
  reference: string;
}) {
  const [signing, setSigning] = useState(false);
  const [done, setDone] = useState(false);

  const handleSign = async () => {
    setSigning(true);
    try {
      const res = await fetch("/api/invoices/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, token }),
      });
      if (res.ok) {
        setDone(true);
        // Reload after short delay to show server-rendered success state
        setTimeout(() => window.location.reload(), 800);
      }
    } catch {
      setSigning(false);
    }
  };

  const handlePrint = () => window.print();

  if (done) {
    return (
      <button className="btn-sign" disabled style={{ background: "#16A34A" }} aria-live="polite">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Confirmation enregistrée
      </button>
    );
  }

  return (
    <>
      <button
        className="btn-sign"
        onClick={handleSign}
        disabled={signing}
        aria-label={`Signer et confirmer la facture ${reference} de ${amount}`}
      >
        {signing ? (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ animation: "spin 0.8s linear infinite" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Enregistrement…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Je confirme et signe cette facture
          </>
        )}
      </button>

      <button className="btn-print" onClick={handlePrint} aria-label="Imprimer ou télécharger cette facture en PDF">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Imprimer / Télécharger PDF
      </button>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
